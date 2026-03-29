# Utilities View — Micro-Animation & UX Feedback Plan

> **Goal**: Add lightweight, consistent micro-animations to `ViewUtilities.tsx` so users get immediate visual confirmation when commands fire — without introducing heavy animation overhead or new dependencies.

---

## 1. Problem Statement

The Utilities page functions correctly — commands execute, logs record, toasts appear. But the **on-button UX feedback is nearly invisible**:

| Action | What the user sees now | What the user expects |
|--------|----------------------|----------------------|
| Click "Reboot System" | Button briefly disabled → toast in corner → button back to idle | Press feedback → button shows "command sent" → confirmation |
| Click "Restart ADB Server" | Spinner on button → toast appears | ✅ Good — but inconsistent with power buttons |
| Click "Set Active Slot A" | Spinner on button → toast | ✅ Good |
| Click "Reboot" while no device connected | Button greyed, no explanation | Tooltip explaining "No ADB device connected" |

### Root Cause Analysis

1. **Power Menu buttons lack `Loader2` spinner** — Server Control buttons swap their icon for a spinner during loading, but the 4 Power Menu buttons don't. They only disable via `isGlobalLoading`.

2. **`handleReboot` loading state is ephemeral** — The reboot command returns near-instantly (the device reboots asynchronously), so `loadingAction` is set and cleared within ~50ms. Even with a spinner, users can't perceive it.

3. **No "command sent" confirmation** — After the command fires, the button snaps straight back to idle. There's no visual bridge between "I clicked" and "it worked".

4. **No press animation** — Buttons have hover effects (via Tailwind `hover:`) but zero tactile `active:` press feedback, making clicks feel "dead".

5. **No disabled-state context** — When `deviceMode !== 'adb'`, power buttons are greyed but users get no explanation of WHY.

---

## 2. Design Principles

These guide every decision below:

| Principle | Implication |
|-----------|-------------|
| **Lightweight** | CSS + existing `framer-motion` v12 only — zero new dependencies |
| **Fast** | All animations ≤ 300ms — nothing should feel sluggish |
| **Consistent** | Match existing patterns (DropZone glow, destructive button glow, LoadingButton spinner) |
| **Functional** | Every animation communicates state — no decoration-only effects |
| **Accessible** | Respect `prefers-reduced-motion`; `framer-motion` handles this via `MotionConfig` |

---

## 3. Available Tools (Already Installed)

| Tool | Version | Used For |
|------|---------|----------|
| `framer-motion` | 12.38.0 | `whileTap`, `AnimatePresence`, icon transitions |
| `tw-animate-css` | 1.4.0 | `animate-in`, `fade-in`, `zoom-in-95` utilities |
| `sonner` | 2.0.7 | `toast.promise`, `toast.loading` → `toast.success` |
| Tailwind CSS | 4.2.2 | `active:scale`, `transition-*`, `duration-*` |
| `lucide-react` | 1.7.0 | `Check`, `Loader2`, existing icons |

**No new packages needed.**

---

## 4. Improvements — Prioritized

### 4.1 — Press Feedback on All Buttons (CSS-Only)

**Problem**: Clicking any button feels "dead" — no tactile response.

**Solution**: Add `active:scale-[0.97] transition-transform duration-100` to all interactive buttons in the Utilities view.

**Scope**: Power Menu buttons (4 ADB + 3 Fastboot), Server Control (2), Slot Management (2), Device Operations (2).

```tsx
// Before
<Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2">

// After
<Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 active:scale-[0.97] transition-transform duration-100">
```

**Impact**: Instant tactile feedback on every click. Zero performance cost.  
**Effort**: ~5 min — add classes to existing buttons.

---

### 4.2 — Consistent Loading Spinner on Power Menu Buttons

**Problem**: Server Control buttons show `Loader2` during loading, but Power Menu buttons don't. Inconsistent.

**Solution**: Add the same `Loader2` pattern to all 7 Power Menu buttons (4 ADB + 3 Fastboot).

```tsx
// Before (power button — no loading state)
<Power className="h-5 w-5" />
Reboot System

// After
{isActionLoading('system') ? (
  <Loader2 className="h-5 w-5 animate-spin" />
) : (
  <Power className="h-5 w-5" />
)}
Reboot System
```

**Impact**: Visual consistency across the entire page.  
**Effort**: ~10 min — apply pattern to 7 buttons.

---

### 4.3 — "Command Sent" Success State (Key UX Fix)

**Problem**: `handleReboot` returns instantly (~50ms), so the spinner flashes imperceptibly. The button snaps back to idle and user wonders "did it work?"

**Solution**: Introduce a **2-second "sent" state** where the button shows a ✓ checkmark + "Sent!" before reverting to idle. This applies to ALL fire-and-forget commands (reboots, kill server).

**Implementation**:

```tsx
// New state alongside loadingAction
const [sentAction, setSentAction] = useState<string | null>(null);

// Updated handleReboot
const handleReboot = async (mode: string, modeId: RebootMode) => {
  if (loadingAction || sentAction) return;
  setLoadingAction(modeId);
  try {
    await Reboot(mode);
    useLogStore.getState().addLog(`Rebooting to ${modeId || 'system'}...`, 'info');
    toast.info(`Rebooting device...`);
    // Show "sent" state for 2 seconds
    setSentAction(modeId);
    setTimeout(() => setSentAction(null), 2000);
  } catch (error) {
    // ... existing error handling
  }
  setLoadingAction(null);
  void refetchDevices();
};
```

**Button rendering with 3-state icon**:

```tsx
// idle → loading → sent (with AnimatePresence for smooth icon transitions)
<Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-2 ...">
  <AnimatePresence mode="wait">
    {sentAction === 'system' ? (
      <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
        <Check className="h-5 w-5 text-success" />
      </motion.div>
    ) : isActionLoading('system') ? (
      <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <Loader2 className="h-5 w-5 animate-spin" />
      </motion.div>
    ) : (
      <motion.div key="icon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <Power className="h-5 w-5" />
      </motion.div>
    )}
  </AnimatePresence>
  {sentAction === 'system' ? 'Sent!' : 'Reboot System'}
</Button>
```

**Impact**: Users see a clear ✓ "Sent!" confirmation that persists for 2s — the single biggest UX improvement.  
**Effort**: ~30 min — new state, 3-state rendering for ~11 buttons, AnimatePresence wrapping.

---

### 4.4 — Success Border Flash

**Problem**: Even with the checkmark, there's no ambient "glow" feedback like the destructive button has.

**Solution**: When a button enters "sent" state, briefly pulse a `ring-success` border glow, then fade it out. Pure CSS with conditional class.

```tsx
// Conditional class on the button
className={cn(
  "h-20 flex flex-col items-center justify-center gap-2 active:scale-[0.97] transition-all duration-200",
  sentAction === 'system' && "ring-2 ring-success/50 shadow-[0_0_12px_color-mix(in_oklch,var(--success)_40%,transparent)]"
)}
```

This matches the existing `destructive` glow pattern in `button-variants.ts` but uses `--success` token.

**Impact**: Subtle green glow on success — visual hierarchy is: idle (no glow) → sent (green glow) → back to idle.  
**Effort**: ~5 min — conditional `cn()` class per button.

---

### 4.5 — Tooltips on Disabled Buttons

**Problem**: When no device is connected, power buttons are greyed out but users don't know why.

**Solution**: Wrap each disabled button in a `Tooltip` explaining the requirement.

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <span tabIndex={deviceMode !== 'adb' ? 0 : undefined}>
      <Button ... disabled={isGlobalLoading || deviceMode !== 'adb'}>
        ...
      </Button>
    </span>
  </TooltipTrigger>
  {deviceMode !== 'adb' && (
    <TooltipContent>No ADB device connected</TooltipContent>
  )}
</Tooltip>
```

> **Note**: The `<span>` wrapper is needed because disabled buttons don't fire pointer events for tooltips. The `tabIndex` makes it keyboard-accessible too.

**Impact**: Self-documenting UI — no user confusion about greyed buttons.  
**Effort**: ~15 min — wrap 7 ADB + 3 Fastboot buttons.

---

### 4.6 — Upgrade `handleReboot` to Use `toast.loading` Pattern

**Problem**: `handleRestartServer` already uses `toast.loading` → `toast.success(id)` for a smooth toast transition. But `handleReboot` uses a plain `toast.info` which doesn't connect visually to the action.

**Solution**: Use the same `toast.loading` → `toast.success(id)` pattern:

```tsx
const handleReboot = async (mode: string, modeId: RebootMode) => {
  if (loadingAction || sentAction) return;
  setLoadingAction(modeId);
  const toastId = toast.loading(`Sending reboot command...`);
  try {
    await Reboot(mode);
    toast.success(`Reboot to ${modeId || 'system'} initiated`, { id: toastId });
    useLogStore.getState().addLog(`Rebooting to ${modeId || 'system'}...`, 'info');
    setSentAction(modeId);
    setTimeout(() => setSentAction(null), 2000);
  } catch (error) {
    toast.error('Reboot command failed', { id: toastId, description: String(error) });
    useLogStore.getState().addLog(`Reboot failed: ${error}`, 'error');
  }
  setLoadingAction(null);
  void refetchDevices();
};
```

**Impact**: Toast smoothly transitions loading → success (or error) instead of appearing as a disconnected notification.  
**Effort**: ~5 min — update 1 function.

---

### 4.7 — Extract `ActionButton` Component (DRY)

**Problem**: After adding the 3-state icon, press animation, disabled tooltips, and success glow to every button, there's massive code duplication across ~11 buttons.

**Solution**: Extract a reusable `ActionButton` component encapsulating all the micro-animation patterns:

```tsx
interface ActionButtonProps {
  actionId: string;
  icon: LucideIcon;
  label: string;
  sentLabel?: string;   // defaults to "Sent!"
  loadingAction: string | null;
  sentAction: string | null;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;  // tooltip text
  variant?: 'outline' | 'secondary' | 'destructive';
  tall?: boolean;       // h-20 for power buttons, default h-9 for inline
  className?: string;
}
```

This keeps the ViewUtilities file clean and makes the pattern reusable for ViewFlasher or any future view that needs fire-and-forget button feedback.

**Impact**: DRY code, single source of truth for animation patterns, easy to maintain.  
**Effort**: ~25 min — new component + refactor existing buttons.

---

## 5. Implementation Order

| Step | Change | Estimated Effort | Files Changed |
|------|--------|-----------------|---------------|
| **1** | Press feedback (CSS `active:scale`) | 5 min | `ViewUtilities.tsx` |
| **2** | Consistent Loader2 on power buttons | 10 min | `ViewUtilities.tsx` |
| **3** | Extract `ActionButton` component | 25 min | New: `ActionButton.tsx`, `ViewUtilities.tsx` |
| **4** | "Command Sent" state + AnimatePresence icon | 30 min | `ActionButton.tsx`, `ViewUtilities.tsx` |
| **5** | Success border glow | 5 min | `ActionButton.tsx` |
| **6** | Disabled tooltips | 15 min | `ActionButton.tsx` |
| **7** | Upgrade toast patterns | 5 min | `ViewUtilities.tsx` |

**Total: ~1.5 hours**

---

## 6. UI States — Complete State Machine

Every action button in the Utilities view will have this 4-state lifecycle:

```
  ┌──────────────────────────────────────────────────────────────┐
  │                        Button States                          │
  │                                                               │
  │   ┌────────┐   click   ┌─────────┐  success  ┌──────────┐   │
  │   │  IDLE  │ ────────► │ LOADING │ ────────► │   SENT   │   │
  │   │        │           │         │           │  (2 sec)  │   │
  │   │ [icon] │           │ [spin]  │           │ [✓ check] │   │
  │   │ normal │           │ disabled│           │ glow ring │   │
  │   └────────┘           └────┬────┘           └─────┬─────┘   │
  │       ▲                     │ error                 │ timeout │
  │       │                     ▼                       │         │
  │       │                ┌─────────┐                  │         │
  │       │                │  ERROR  │                  │         │
  │       │◄───────────────┤ (toast) │◄─────────────────┘         │
  │       │    immediate   └─────────┘     2s timer               │
  │                                                               │
  │   ┌──────────┐                                                │
  │   │ DISABLED │  No device connected                           │
  │   │ (greyed) │  → Tooltip: "No ADB device connected"         │
  │   └──────────┘                                                │
  └──────────────────────────────────────────────────────────────┘
```

### Visual Summary Per State

| State | Icon | Label | Border | Background | Effect |
|-------|------|-------|--------|------------|--------|
| **Idle** | Original (Power/Zap/etc) | Original text | Default | Default | Hover lift |
| **Loading** | `Loader2 animate-spin` | Original text | Default | Default | Disabled |
| **Sent** | `Check text-success` | "Sent!" | `ring-success/50` | Default | Green glow 2s |
| **Error** | Original | Original text | Default | Default | Toast shows error |
| **Disabled** | Original (dimmed) | Original text | Default | Default | Tooltip on hover |

---

## 7. Consistency Check

These changes maintain full alignment with existing project patterns:

| Existing Pattern | Where Used Now | How Utilities Aligns |
|-----------------|----------------|---------------------|
| `Loader2 animate-spin` for loading | Server Control, Flasher, AppManager | ✅ Added to all power buttons |
| `toast.loading → toast.success(id)` | `handleRestartServer`, Flasher | ✅ Applied to `handleReboot` |
| `active:scale` press effect | None explicitly, but standard Tailwind | ✅ Added as `active:scale-[0.97]` |
| `AnimatePresence` | MainLayout view transitions | ✅ Used for icon state transitions |
| `cn()` conditional classes | Universal | ✅ Used for success glow ring |
| `buttonVariants` shadow glow | Destructive buttons | ✅ Success variant uses same `color-mix` pattern |
| `Tooltip` on buttons | All icon buttons per system patterns | ✅ Added for disabled state context |
| `handleError` utility | Flasher, AppManager | ✅ Can adopt in error paths |
| `SectionHeader` component | Already used in Utilities | ✅ No change needed |
| `LoadingButton` component | Not used in Utilities | ⚠️ `ActionButton` is more purpose-built for fire-and-forget commands with sent state |

---

## 8. What NOT to Do

| Anti-Pattern | Why |
|-------------|-----|
| ❌ CSS `@keyframes` for button pulse loops | Distracting, battery-wasting, decorative-only |
| ❌ `canvas-confetti` on success | Way too heavy for a utility command |
| ❌ Full-page transition overlay | Overkill — toast + button state is enough |
| ❌ Sound effects | Desktop app — unexpected and annoying |
| ❌ Skeleton loading states | Commands return instantly — no content to skeleton |
| ❌ New npm package for animations | `framer-motion` already handles everything |
| ❌ Per-view `animate-in` classes | Violates system pattern — MainLayout's `motion.div` handles view transitions |

---

## 9. Accessibility Notes

- `framer-motion` respects `prefers-reduced-motion` automatically when wrapped in `<MotionConfig reducedMotion="user">`
- For CSS-only animations (`active:scale`, `transition-*`), add a media query if needed:
  ```css
  @media (prefers-reduced-motion: reduce) {
    .active\:scale-\[0\.97\]:active { transform: none; }
  }
  ```
- Disabled button tooltips use `<span tabIndex={0}>` wrapper for keyboard accessibility
- Success glow uses `--success` CSS token (not hardcoded green) — adapts to light/dark theme

---

## 10. File Change Summary

| File | Change Type | Description |
|------|------------|-------------|
| `src/components/ActionButton.tsx` | **NEW** | Reusable 4-state button with press/loading/sent/disabled |
| `src/components/views/ViewUtilities.tsx` | **MODIFY** | Use `ActionButton`, add `sentAction` state, upgrade toast patterns |
| `src/styles/global.css` | **OPTIONAL** | `prefers-reduced-motion` fallback if desired |

**Zero new dependencies. Zero new npm packages.**
