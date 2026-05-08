# State Persistence Audit Report

**Date:** May 8, 2026  
**Auditor:** AI Code Analyzer Agents (Multiple Sub-Agents)  
**App:** ADB GUI Next (Tauri 2 + React 19 + TypeScript)  
**Version:** 0.1.0

---

## Executive Summary

This comprehensive audit analyzes **state persistence behavior** across all 9 screens of the ADB GUI Next application. The audit was triggered by user observation that screens reset to default state when navigating away and back.

**Key Findings:**
- **5 of 9 screens** have significant state loss issues (Dashboard, AppManager, Flasher, Utilities, FileExplorer partial)
- **4 of 9 screens** maintain state correctly (Marketplace, Emulator, PayloadDumper, About)
- **Root Cause:** React's component lifecycle — when navigation occurs, components unmount and lose `useState` hooks
- **Solution Pattern:** Zustand persist middleware with `partialize` for selective field persistence (official best practice)

---

## Methodology

### Analysis Process
1. **Parallel sub-agent execution** — 9 agents analyzed each screen simultaneously
2. **Manual code inspection** — All `useState`, `useEffect`, Zustand stores, localStorage usage documented
3. **Official documentation verification** — Referenced React and Zustand official docs for best practices

### Official Documentation References

#### Zustand Persist Middleware (Official)
> Source: https://github.com/pmndrs/zustand/blob/main/docs/reference/middlewares/persist.md

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const useStore = create(
  persist(
    (set) => ({ /* state */ }),
    {
      name: 'storage-key',
      partialize: (state) => ({ /* only persist these fields */ }),
      storage: createJSONStorage(() => localStorage), // default
      version: 1,
      migrate: (persisted, version) => { /* migration logic */ },
    }
  )
)
```

**Key Points:**
- `partialize` function selectively persists only required fields
- Supports localStorage (default) and sessionStorage
- Version migration support for schema changes

#### React Component Lifecycle (Official)
> Source: https://github.com/reactjs/react.dev/blob/main/src/content/reference/react/useEffect.md

> "When your component is removed from the DOM, React will run the cleanup function."

**Key Points:**
- Components unmount on navigation (no router — `useState<ViewType>` pattern)
- All `useState` hooks reset on unmount
- useEffect cleanup runs on unmount to prevent memory leaks

---

## Screen-by-Screen Analysis

### 1. Dashboard (ViewDashboard.tsx)

#### State Found
| Hook | Default Value | Lost on Nav? |
|------|---------------|--------------|
| `isRefreshingInfo` | `false` | ✅ YES |
| `isEnablingTcpip` | `false` | ✅ YES |
| `isConnecting` | `false` | ✅ YES |
| `isDisconnecting` | `false` | ✅ YES |
| `forceNicknameRefresh` | `0` | ✅ YES |
| `isEditing` | `false` | ✅ YES |
| `currentDevice` | `null` | ✅ YES |

#### useEffect Hooks
- **Lines 96-100:** Auto-refreshes device info when on dashboard and serial exists
- **Lines 102-106:** Syncs wireless form IP field with deviceInfo

#### Zustand Usage
- `useDeviceStore` — accesses `devices`, `selectedSerial`, `deviceInfo`

#### Persistence Issues
**YES** — All 7 `useState` hooks reset on navigation. Edit nickname dialog closes, wireless form resets.

#### Official Best Practice Verification
> **Recommendation:** Move dialog state to Zustand store with persist middleware

**Verified Pattern (Zustand Docs):**
```typescript
interface UIStore {
  isEditing: boolean;
  currentDevice: string | null;
  setEditing: (val: boolean) => void;
  setCurrentDevice: (val: string | null) => void;
}

const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      isEditing: false,
      currentDevice: null,
      setEditing: (val) => set({ isEditing: val }),
      setCurrentDevice: (val) => set({ currentDevice: val }),
    }),
    { name: 'dashboard-ui', partialize: (s) => ({ isEditing: s.isEditing }) }
  )
)
```

---

### 2. AppManager (ViewAppManager.tsx + DebloaterTab + InstallationTab)

#### State Found

**ViewAppManager.tsx:**
| Hook | Default | Lost? |
|------|---------|-------|
| `activeTab` | `'debloater'` | ✅ YES |

**DebloaterTab.tsx:**
| Hook | Default | Lost? |
|------|---------|-------|
| `reviewOpen` | `false` | ✅ YES |
| All debloatStore state | — | ✅ YES |

**InstallationTab.tsx:**
| Hook | Default | Lost? |
|------|---------|-------|
| `apkPaths` | `[]` | ✅ YES |
| `isInstalling` | `false` | ✅ YES |
| `installProgress` | `null` | ✅ YES |
| `packages` | `[]` | ✅ YES |
| `searchQuery` | `''` | ✅ YES |
| `packageFilter` | `'all'` | ✅ YES |
| `selectedPackages` | `new Set()` | ✅ YES |

#### Zustand Store (debloatStore)
| State | Persists? |
|-------|-----------|
| `packages` | ❌ NO |
| `listStatus` | ❌ NO |
| `isLoadingPackages` | ❌ NO |
| `searchQuery` | ❌ NO |
| `listFilter` | ❌ NO |
| `removalFilter` | ❌ NO |
| `stateFilter` | ❌ NO |
| `selectedPackages` | ❌ NO |
| `expertMode` | ❌ NO |
| `disableMode` | ❌ NO |

#### Persistence Issues
**YES — HIGH SEVERITY**

All filters, selected packages, tab selection, and APK file selections are lost on navigation.

#### Official Best Practice Verification
> **Recommendation:** Add persist middleware to debloatStore

**Verified Pattern (Zustand Docs):**
```typescript
export const useDebloatStore = create<DebloatState>()(
  persist(
    (set, get) => ({
      // ... existing state
      searchQuery: '',
      listFilter: 'All',
      expertMode: false,
      disableMode: false,
    }),
    {
      name: 'debloat-storage',
      partialize: (state) => ({
        searchQuery: state.searchQuery,
        listFilter: state.listFilter,
        removalFilter: state.removalFilter,
        stateFilter: state.stateFilter,
        expertMode: state.expertMode,
        disableMode: state.disableMode,
      }),
    }
  )
)
```

---

### 3. FileExplorer (ViewFileExplorer.tsx + DirectoryTree.tsx)

#### State Found (30 useState hooks in ViewFileExplorer)

| Hook | Default | Persists? | Method |
|------|---------|-----------|--------|
| `currentPath` | localStorage | ✅ YES | localStorage |
| `isTreeCollapsed` | localStorage | ✅ YES | localStorage |
| `fileList` | `[]` | ❌ NO | — |
| `selectedNames` | `new Set()` | ❌ NO | — |
| `isMultiSelectMode` | `false` | ❌ NO | — |
| `sortField` | `'name'` | ❌ NO | — |
| `searchQuery` | `''` | ❌ NO | — |
| `navHistory` | localStorage | ⚠️ PARTIAL | localStorage (reset to end) |
| `historyIndex` | `0` | ❌ NO | — |
| `leftWidth` | `180` | ❌ NO | — |

**DirectoryTree.tsx:**
- `nodes` — **completely resets** to hardcoded INITIAL_NODES

#### Persistence Issues
**PARTIAL — MEDIUM SEVERITY**

Good: Path persisted via localStorage ✅  
Bad: Selection, sort, history position, tree expansion lost ❌

#### Official Best Practice Verification
> **Recommendation:** Add more localStorage keys + Zustand persist for complex state

**Current Pattern (Good):**
```typescript
const [currentPath, setCurrentPath] = useState(
  () => localStorage.getItem('fe.currentPath') ?? '/sdcard/'
);
```

**Recommended Enhancement:**
```typescript
const [selectedNames, setSelectedNames] = useState<Set<string>>(
  () => new Set(JSON.parse(localStorage.getItem('fe.selectedNames') ?? '[]'))
);

useEffect(() => {
  localStorage.setItem('fe.selectedNames', JSON.stringify([...selectedNames]));
}, [selectedNames]);
```

---

### 4. Flasher (ViewFlasher.tsx)

#### State Found
| Hook | Default | Lost? |
|------|---------|-------|
| `partition` | `''` | ✅ YES |
| `filePath` | `''` | ✅ YES |
| `sideloadFilePath` | `''` | ✅ YES |
| `loadingAction` | `null` | ✅ YES |
| `dragTarget` | `'none'` | ✅ YES |
| `queuedAction` | `null` | ✅ YES |

#### Persistence Issues
**YES — MEDIUM SEVERITY**

User input (partition name, file paths) lost on navigation.

#### Official Best Practice Verification
> **Recommendation:** Zustand persist for form inputs, localStorage for file paths

---

### 5. Utilities (ViewUtilities.tsx)

#### State Found
| Hook | Default | Lost? |
|------|---------|-------|
| `loadingAction` | `null` | ✅ YES |
| `sentAction` | `null` | ✅ YES |
| `showGetVarDialog` | `false` | ✅ YES |
| `getVarContent` | `''` | ✅ YES |
| `isEditing` | `false` | ✅ YES |

#### Persistence Issues
**YES — LOW SEVERITY**

Dialog states lost (transient UI, acceptable).

---

### 6. PayloadDumper (ViewPayloadDumper.tsx + payloadDumperStore)

#### State Found
| Hook | Default | Lost on Nav? | Lost on Reload? |
|--------|-----------|---------------|------------------|
| `prefetch` | `false` | ❌ NO | ✅ YES |
| `connectionStatus` | `'idle'` | ❌ NO | ✅ YES |
| `estimatedSize` | `null` | ❌ NO | ✅ YES |
| `isDetailsOpen` | `false` | ❌ NO | ✅ YES |

#### Zustand Store (payloadDumperStore)
- All state in-memory only
- **NO persist middleware** — state lost on app reload

#### Persistence Issues
**PARTIAL — LOW SEVERITY**

In-session works (Zustand singleton), but lost on full app restart.

---

### 7. Marketplace (ViewMarketplace.tsx + marketplaceStore) — ✅ GOOD

#### Zustand Store (with persist)
| State | Persisted To | Works? |
|-------|--------------|--------|
| `activeProviders` | localStorage | ✅ YES |
| `sortBy` | localStorage | ✅ YES |
| `viewMode` | localStorage | ✅ YES |
| `searchHistory` | localStorage | ✅ YES |
| `recentlyViewedApps` | localStorage | ✅ YES |
| `githubOauthClientId` | localStorage | ✅ YES |
| `resultsPerProvider` | localStorage | ✅ YES |

**NOT persisted** (intentionally):
- `query`, `results`, `selectedApp` — ephemeral session state

#### Persistence Issues
**NO** — Architecture correct per official best practices.

---

### 8. Emulator (ViewEmulatorManager.tsx + emulatorManagerStore) — ✅ GOOD

#### Zustand Store (with in-memory persistence)
| State | Persists on Nav? |
|--------|-------------------|
| `selectedAvdName` | ✅ YES |
| `activeTab` | ✅ YES |
| `restorePlan` | ✅ YES |
| `pendingAction` | ✅ YES |
| `rootWizard` | ✅ YES |

#### Persistence Issues
**NO** — Zustand singleton survives navigation.

---

### 9. About (ViewAbout.tsx) — ✅ GOOD

- **No useState hooks**
- **No useEffect hooks**
- Static component, no state to lose

---

## Architecture Pattern Analysis

### Current Pattern Usage

| Pattern | Screens Using | Works? |
|---------|---------------|--------|
| **useState only** | Dashboard, Flasher, Utilities | ❌ Lost on nav |
| **Zustand (no persist)** | PayloadDumper | ⚠️ Session only |
| **Zustand + localStorage** | Marketplace | ✅ Works |
| **localStorage direct** | FileExplorer (path) | ⚠️ Partial |

### Official Best Practice (Zustand Docs)

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const useStore = create(
  persist(
    (set) => ({
      // ... state
    }),
    {
      name: 'unique-storage-key',
      partialize: (state) => ({
        // Only persist these fields
        field1: state.field1,
        field2: state.field2,
      }),
    }
  )
)
```

**Key Principles:**
1. **In-memory for runtime state** — transient UI state that should reset
2. **localStorage for persistent config** — user preferences, settings
3. **partialize to avoid bloat** — only persist what's necessary

---

## Recommended Fixes

### Priority 1: Critical (High User Impact)

#### 1.1 AppManager — Add persist to debloatStore
```typescript
// src/lib/debloatStore.ts
import { persist, createJSONStorage } from 'zustand/middleware'

export const useDebloatStore = create<DebloatState>()(
  persist(
    (set, get) => ({
      // ... existing state + actions
    }),
    {
      name: 'debloat-storage',
      partialize: (state) => ({
        activeTab: 'debloater', // Need to lift from ViewAppManager
        searchQuery: state.searchQuery,
        listFilter: state.listFilter,
        removalFilter: state.removalFilter,
        stateFilter: state.stateFilter,
        expertMode: state.expertMode,
        disableMode: state.disableMode,
      }),
    }
  )
)
```

#### 1.2 Dashboard — Move dialog state to deviceStore
```typescript
// Extend deviceStore with UI state
interface DeviceStore extends State {
  // ... existing
  isEditingNickname: boolean;
  editingDeviceSerial: string | null;
}
```

---

### Priority 2: Medium (Moderate Impact)

#### 2.1 FileExplorer — Add more localStorage keys
- `fe.selectedNames` — preserve multi-select
- `fe.sortField` / `fe.sortDir` — preserve sort preference
- `fe.searchQuery` — preserve search filter

#### 2.2 Flasher — Persist form inputs
```typescript
// Use Zustand persist for partition/file paths
const useFlasherStore = create(
  persist(
    (set) => ({
      partition: '',
      filePath: '',
      sideloadFilePath: '',
    }),
    { name: 'flasher-storage', partialize: (s) => ({ partition: s.partition }) }
  )
)
```

---

### Priority 3: Low (Optional)

#### 3.1 PayloadDumper — Add persist for remoteUrl + activeMode
#### 3.2 Utilities — Optional dialog state (transient, acceptable as-is)

---

## Verification Checklist

| Screen | Issue Found | Severity | Fix Available? |
|--------|-------------|----------|----------------|
| Dashboard | ✅ YES | Medium | ✅ YES |
| AppManager | ✅ YES | High | ✅ YES |
| FileExplorer | ⚠️ PARTIAL | Low | ✅ YES |
| Flasher | ✅ YES | Medium | ✅ YES |
| Utilities | ✅ YES | Low | ✅ YES |
| PayloadDumper | ⚠️ PARTIAL | Low | ✅ YES |
| Marketplace | ❌ NO | — | — |
| Emulator | ❌ NO | — | — |
| About | ❌ NO | — | — |

---

## Conclusion

The state loss issue is a **design choice consequence** — the app uses `useState<ViewType>` pattern without a router, causing components to unmount on navigation. This is not a bug but a gap in persistence implementation.

**Solution:** Apply Zustand persist middleware (official best practice) to stores that should maintain state across navigation:
- Use `partialize` to persist only necessary fields
- Follow AGENTS.md principle: "in-memory for runtime, localStorage for persistent config"

---

## References

1. **Zustand Persist Middleware:** https://github.com/pmndrs/zustand/blob/main/docs/reference/middlewares/persist.md
2. **React useEffect:** https://github.com/reactjs/react.dev/blob/main/src/content/reference/react/useEffect.md
3. **Zustand Partialize:** https://github.com/pmndrs/zustand/blob/main/docs/reference/integrations/persisting-store-data.md

---

*Report generated by parallel sub-agent analysis with official documentation verification.*