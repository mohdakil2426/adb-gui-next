# Next.js Migration Plan - ADB GUI Next

> **Project:** ADB GUI Next  
> **Current Stack:** Tauri 2 + React 19 + Vite 8 + TypeScript 6 + Tailwind CSS v4 + Rust  
> **Target Stack:** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + (Optional: Keep Tauri for Desktop)  
> **Created:** 2026-05-11  
> **Status:** Planning Phase  
> **Migration Type:** Incremental (Frontend migration with Tauri backend retention)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Feasibility Analysis](#feasibility-analysis)
3. [Migration Strategy](#migration-strategy)
4. [File Impact Analysis](#file-impact-analysis)
5. [Phase-by-Phase Implementation Plan](#phase-by-phase-implementation-plan)
6. [Configuration Changes](#configuration-changes)
7. [Code Migration Guide](#code-migration-guide)
8. [Testing Strategy](#testing-strategy)
9. [Risk Assessment](#risk-assessment)
10. [Rollback Plan](#rollback-plan)
11. [Timeline Estimates](#timeline-estimates)

---

## Executive Summary

### What This Migration Entails

This document outlines a comprehensive plan to migrate the ADB GUI Next frontend from a Vite + React standalone application to Next.js 15 with App Router, while optionally retaining the Tauri 2 backend for desktop-specific features.

### Key Benefits of Migration

| Benefit | Description |
|---------|-------------|
| **Modern Rendering** | Server Components, Static Site Generation (SSG), and Incremental Static Regeneration (ISR) capabilities |
| **SEO-Ready** | Built-in SEO optimization with metadata API and server-side rendering |
| **Performance** | Automatic code splitting, image optimization, and edge deployment support |
| **Developer Experience** | File-based routing, API routes, and built-in TypeScript support |
| **Ecosystem** | Access to Next.js ecosystem, Vercel deployment, and extensive documentation |
| **Desktop + Web** | Possibility to run both as desktop app (via Tauri) and web app (via Next.js) |

### Recommended Approach

**Incremental Migration (Recommended):**

- Phase 1: Set up Next.js alongside existing Vite project
- Phase 2: Migrate components and state incrementally
- Phase 3: Replace Tauri IPC with Next.js API routes (still calling Rust backend)
- Phase 4: Keep Tauri for desktop-specific features

This approach allows:
- ✅ Running both Vite and Next.js versions in parallel
- ✅ Gradual adoption of Next.js features
- ✅ Keeping existing Tauri functionality for desktop
- ✅ Ability to test and rollback at each phase

---

## Feasibility Analysis

### Can We Migrate Successfully?

**YES - The migration is feasible.** Based on research and analysis:

| Factor | Assessment | Notes |
|--------|------------|-------|
| **React 19 Compatibility** | ✅ Fully Compatible | Next.js 15 supports React 19 |
| **State Management** | ✅ Compatible | Zustand v5 and TanStack Query v5 work with Next.js |
| **Tailwind CSS v4** | ✅ Compatible | Next.js has official Tailwind integration |
| **shadcn/ui** | ✅ Fully Supported | Official Next.js support via CLI |
| **TypeScript** | ✅ Native Support | Next.js has built-in TypeScript support |
| **Rust Backend** | ✅ Keep as-is | Tauri backend remains unchanged |

### Potential Challenges

| Challenge | Impact | Mitigation |
|-----------|--------|------------|
| **Tauri IPC Replacement** | Medium | Create API routes that proxy to Rust backend |
| **Desktop-Specific APIs** | Low | Keep Tauri for window controls, native dialogs |
| **Environment Variables** | Low | Change VITE_ to NEXT_PUBLIC_ prefix |
| **Routing Pattern Change** | Medium | Convert useState<ViewType> to Next.js file-based routing |
| **Offline Capabilities** | Medium | Use PWA plugins for offline support |

---

## Migration Strategy

### Three Strategic Options

#### Option A: Full Migration (Recommended for Web-First)
```
Vite/React App → Next.js App Router → Deploy to Vercel/Netlify
```
- **Pros:** Full Next.js features, simplest setup, best performance
- **Cons:** Lose desktop features (window controls, native dialogs)
- **Best For:** Web deployment priority, no need for desktop app

#### Option B: Incremental Hybrid (Recommended for Desktop + Web)
```
Vite/React App → Next.js (static export) → Tauri wrapper
```
- **Pros:** Keep both web and desktop, gradual migration
- **Cons:** More complex configuration, static-only (no SSR)
- **Best For:** Want both desktop and web versions

#### Option C: Parallel Development
```
Keep Vite/Tauri version + Create separate Next.js web version
```
- **Pros:** No risk to existing app, complete flexibility
- **Cons:** Double maintenance, code duplication risk
- **Best For:** Team with capacity to maintain two versions

### Recommended: Option B (Incremental Hybrid)

This plan assumes **Option B** - incremental migration while keeping Tauri for desktop features.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     NEXT.JS FRONTEND                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   app/      │  │  components │  │    lib/     │         │
│  │  (pages)    │  │  (shared)   │  │  (stores)   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                 │
│         └────────────────┴────────────────┘                 │
│                          │                                   │
│                    ┌─────┴─────┐                            │
│                    │ API Routes│                            │
│                    │(proxies to│                            │
│                    │  Rust)    │                            │
│                    └─────┬─────┘                            │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                    TAURI IPC                                 │
│                          │                                   │
│  ┌───────────────────────┴───────────────────────────────┐  │
│  │                  RUST BACKEND (UNCHANGED)              │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │ commands │ │ payload/ │ │marketplace│ │emulator/│  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## File Impact Analysis

### Files That Will Change

#### Configuration Files (9 files)

| File | Change Type | Migration Action |
|------|-------------|------------------|
| `package.json` | ⚠️ Major | Add Next.js dependencies, update scripts |
| `vite.config.ts` | ❌ Deleted | Not needed - Next.js has built-in config |
| `tsconfig.json` | ⚠️ Update | Update for Next.js paths and settings |
| `tsconfig.node.json` | ⚠️ Update | Update for Next.js config files |
| `next.config.mjs` | 🆕 New | Create for Next.js configuration |
| `tailwind.config.ts` | ⚠️ Update | May need adjustments for Next.js |
| `.eslintrc.json` | ⚠️ Update | Add Next.js ESLint config |
| `.gitignore` | ⚠️ Update | Add Next.js build directories |
| `postcss.config.js` | ⚠️ Update | May need adjustment |

#### Source Code Files (159 files in src/)

| Category | Files | Migration Action |
|----------|-------|------------------|
| **Components** | ~70 files | Copy to `app/` with 'use client' directives |
| **UI Components** | ~40 files | Reinstall via shadcn CLI for Next.js |
| **Views** | 9 files | Convert to Next.js pages in `app/` |
| **Stores (Zustand)** | ~12 files | Keep as-is, verify compatibility |
| **Hooks** | ~3 files | Keep as-is with minor adjustments |
| **Utils** | ~2 files | Keep as-is |
| **Test Files** | ~23 files | Update test setup for Next.js |
| **Styles** | 1 file | Copy global CSS to `app/` |

#### New Files to Create

| File | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout with providers |
| `app/page.tsx` | Catch-all page for SPA routing |
| `app/api/*/route.ts` | API routes to proxy Tauri calls |
| `app/globals.css` | Global styles with Tailwind |
| `next-env.d.ts` | Next.js TypeScript types |

#### Files to Delete (After Migration)

| File | Reason |
|------|--------|
| `src/main.tsx` | Replaced by Next.js entry point |
| `src/vite-env.d.ts` | Not needed in Next.js |
| `vite.config.ts` | Replaced by next.config.mjs |
| `index.html` | Replaced by `app/page.tsx` |

### Backend (Rust) - No Changes Required

The following remain **unchanged**:

```
src-tauri/
├── Cargo.toml          (No change)
├── src/
│   ├── lib.rs          (No change)
│   ├── helpers.rs      (No change)
│   ├── commands/       (No change)
│   ├── payload/        (No change)
│   ├── marketplace/    (No change)
│   ├── emulator/       (No change)
│   └── debloat/        (No change)
├── tauri.conf.json     (Minor update for Next.js)
└── permissions/        (No change)
```

---

## Phase-by-Phase Implementation Plan

### Phase 1: Setup and Configuration (Week 1)

#### 1.1 Initialize Next.js Project

```bash
# Create new Next.js app in parallel directory
npx create-next-app@latest adb-gui-next-web \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-npm

# Navigate to new project
cd adb-gui-next-web
```

#### 1.2 Install Additional Dependencies

```bash
# Install existing dependencies that work with Next.js
npm install react react-dom zustand @tanstack/react-query

# Install shadcn/ui for Next.js
npx shadcn@latest init

# Install desktop-specific Tauri APIs (for hybrid mode)
npm install @tauri-apps/api @tauri-apps/plugin-dialog @tauri-apps/plugin-clipboard-manager
```

#### 1.3 Configure Next.js for Tauri Compatibility

```typescript
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Required for Tauri static export
  images: {
    unoptimized: true, // Required for static export
  },
  // Use trailing slash for better Tauri compatibility
  trailingSlash: true,
  // Enable static export
  distDir: 'out',
};

export default nextConfig;
```

#### 1.4 Update Tauri Configuration

```json
// src-tauri/tauri.conf.json (UPDATE)
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:3000",
    "frontendDist": "../out"
  }
}
```

#### 1.5 Update Package.json Scripts

```json
// package.json (UPDATE)
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "tauri": "tauri"
  }
}
```

### Phase 2: Component Migration (Week 2-3)

#### 2.1 Create Directory Structure

```
app/
├── layout.tsx           # Root layout with providers
├── page.tsx             # Catch-all SPA entry
├── globals.css          # Global styles
├── (routes)/
│   ├── dashboard/
│   ├── app-manager/
│   ├── file-explorer/
│   ├── flasher/
│   ├── utilities/
│   ├── payload-dumper/
│   ├── marketplace/
│   ├── emulator/
│   └── about/
├── api/
│   ├── devices/
│   ├── adb/
│   ├── fastboot/
│   ├── files/
│   ├── apps/
│   └── ...
└── components/          # Shared components (copied from src/)
```

#### 2.2 Migrate Layout and Providers

```typescript
// app/layout.tsx
import { ThemeProvider } from '@/components/ThemeProvider';
import { QueryClientProvider } from '@/lib/query-provider';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryClientProvider>
            {children}
          </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

#### 2.3 Create SPA Catch-All Page

```typescript
// app/page.tsx
'use client';

import dynamic from 'next/dynamic';

const App = dynamic(() => import('@/components/MainLayout'), { ssr: false });

export default function HomePage() {
  return <App />;
}
```

#### 2.4 Copy and Adapt Components

**Copy from:**
- `src/components/` → `app/components/`
- `src/lib/` → `app/lib/` (stores, utils)
- `src/hooks/` → `app/hooks/`

**Adaptations needed:**
- Add `'use client'` directive to components using hooks
- Update imports to use new `@/` alias
- Wrap interactive components in Client Components

### Phase 3: IPC Replacement (Week 3-4)

#### 3.1 Create API Route for Device Commands

```typescript
// app/api/devices/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Dynamic import to avoid issues in edge runtime
    const { invoke } = await import('@tauri-apps/api/core');
    const devices = await invoke('get_devices');
    return NextResponse.json(devices);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

#### 3.2 Update Frontend to Use API Routes

```typescript
// lib/desktop/backend.ts (ADAPTED)

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

// Old (Tauri)
export async function getDevices() {
  return invoke<Device[]>('get_devices');
}

// New (Next.js API)
export async function getDevices() {
  const response = await fetch(`${API_BASE}/api/devices`);
  return response.json();
}
```

#### 3.3 Create All Required API Routes

| Tauri Command | API Route |
|--------------|-----------|
| `get_devices` | `GET /api/devices` |
| `get_device_info` | `GET /api/devices/[serial]/info` |
| `run_adb_host_command` | `POST /api/adb/command` |
| `install_package` | `POST /api/apps/install` |
| `list_files` | `GET /api/files` |
| ... | ... |

### Phase 4: Testing and Polish (Week 4-5)

#### 4.1 Run Existing Tests

```bash
# Update test configuration for Next.js
npm test

# Update any Tauri-specific tests
```

#### 4.2 Verify All Features Work

- Device detection and connection
- File operations
- App installation
- Payload extraction
- Marketplace functionality

#### 4.3 PWA Configuration (Optional)

```typescript
// next.config.mjs (ADD PWA)
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

module.exports = withPWA(nextConfig);
```

---

## Configuration Changes

### Package.json Changes

**Dependencies to Add:**

```json
{
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

**Dependencies to Remove:**

```json
{
  "devDependencies": {
    "vite": "^8.0.0",
    "@vitejs/plugin-react": "^6.0.0",
    "@tailwindcss/vite": "^4.0.0"
  }
}
```

**Scripts to Update:**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "tauri": "tauri"
  }
}
```

### Environment Variables

| Vite Variable | Next.js Variable |
|---------------|------------------|
| `VITE_API_URL` | `NEXT_PUBLIC_API_URL` |
| `VITE_DEV_HOST` | `NEXT_PUBLIC_DEV_HOST` |
| `import.meta.env.MODE` | `process.env.NODE_ENV` |
| `import.meta.env.DEV` | `process.env.NODE_ENV !== 'production'` |
| `import.meta.env.PROD` | `process.env.NODE_ENV === 'production'` |

### TypeScript Configuration

```json
// tsconfig.json (UPDATE)
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## Code Migration Guide

### 1. Import Statements

```typescript
// Before (Vite)
import { invoke } from '@tauri-apps/api/core';

// After (Next.js)
import { invoke } from '@tauri-apps/api/core'; // If using Tauri API routes
// OR
const response = await fetch('/api/devices'); // If using Next.js API routes
```

### 2. Environment Variables

```typescript
// Before (Vite)
const apiUrl = import.meta.env.VITE_API_URL;

// After (Next.js)
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
```

### 3. Routing

```typescript
// Before (React Router / useState)
const [activeView, setActiveView] = useState<ViewType>('dashboard');

// After (Next.js)
// Convert to file-based routing in app/ directory
// app/dashboard/page.tsx
// app/app-manager/page.tsx
```

### 4. State Management (Zustand)

```typescript
// No changes needed - Zustand works with Next.js
import { create } from 'zustand';

interface DeviceStore {
  devices: Device[];
  setDevices: (devices: Device[]) => void;
}

export const useDeviceStore = create<DeviceStore>((set) => ({
  devices: [],
  setDevices: (devices) => set({ devices }),
}));
```

### 5. Data Fetching (TanStack Query)

```typescript
// TanStack Query v5 works with Next.js - no major changes
import { useQuery } from '@tanstack/react-query';

function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await fetch('/api/devices');
      return res.json();
    },
  });
}
```

### 6. Client vs Server Components

```typescript
// Server Component (default in App Router)
export default async function DashboardPage() {
  // Can do direct data fetching here
  const devices = await getDevices();
  return <Dashboard devices={devices} />;
}

// Client Component (for interactivity)
'use client';

export default function Dashboard({ devices }) {
  const [selected, setSelected] = useState(null);
  // Interactive logic here
  return <DeviceList devices={devices} onSelect={setSelected} />;
}
```

### 7. Global Styles

```css
/* Before (src/styles/global.css) */
/* Copy content to app/globals.css - mostly compatible */
```

### 8. shadcn/ui Components

```bash
# Reinstall for Next.js
npx shadcn@latest init
npx shadcn@latest add button
npx shadcn@latest add card
# ... add other components used in project
```

---

## Testing Strategy

### Test Migration Checklist

| Test Type | Action | Notes |
|-----------|--------|-------|
| **Unit Tests** | Run existing Vitest tests | May need to update import paths |
| **Integration Tests** | Create new tests for API routes | Test Next.js API endpoints |
| **E2E Tests** | Keep using Playwright/Cypress | Test full user flows |
| **Manual Testing** | Test all features manually | Critical for desktop features |

### Testing Commands

```bash
# Run tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Lint
npm run lint

# Build
npm run build
```

---

## Risk Assessment

### High Risk Items

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Tauri IPC Failure** | Medium | High | Create fallback API routes, test thoroughly |
| **Performance Issues** | Low | Medium | Optimize with SSR/SSG where appropriate |
| **State Management Bugs** | Medium | Medium | Extensive testing of stores |

### Medium Risk Items

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Routing Issues** | Medium | Low | Test all routes thoroughly |
| **CSS Compatibility** | Low | Low | Global CSS should work mostly as-is |
| **Build Errors** | Low | Medium | Test build process early |

### Low Risk Items

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **TypeScript Errors** | Low | Low | Incremental fixes |
| **Package Conflicts** | Low | Low | Clean install |

---

## Rollback Plan

### If Migration Fails

1. **Keep both versions running:**
   - Continue using Vite version for production
   - Use Next.js version for testing

2. **Revert to Vite:**
   - No code needs to be deleted
   - Just stop developing the Next.js version

3. **Fix issues in Next.js:**
   - Address specific issues
   - Continue development

4. **Rollback specific changes:**
   - Use Git to revert specific files
   - No mass rollback needed

### Emergency Contacts

- Tauri Discord: https://discord.gg/tauri
- Next.js Documentation: https://nextjs.org/docs
- Community Support: https://github.com/vercel/next.js/discussions

---

## Timeline Estimates

### Detailed Timeline

| Phase | Duration | Tasks | Deliverable |
|-------|----------|-------|--------------|
| **Phase 1** | 1 week | Setup Next.js, configure, install deps | Running Next.js dev server |
| **Phase 2** | 2 weeks | Migrate components, stores, views | Working UI in Next.js |
| **Phase 3** | 2 weeks | Create API routes, update IPC | Full feature parity |
| **Phase 4** | 1 week | Testing, polish, PWA (optional) | Production-ready |
| **Total** | **6 weeks** | | **Complete migration** |

### Milestones

| Milestone | Target | Success Criteria |
|-----------|--------|------------------|
| M1: Next.js Setup | Week 1 | Dev server running |
| M2: UI Migration | Week 3 | Components render correctly |
| M3: Feature Complete | Week 5 | All features work |
| M4: Production Ready | Week 6 | Tests pass, build succeeds |

### Resource Requirements

| Resource | Quantity | Notes |
|----------|----------|-------|
| Developer Time | 20-30 hours/week | 6 weeks |
| Testing Time | 8-10 hours | Throughout |
| Code Reviews | 3-4 sessions | Weekly |

---

## Appendix A: API Routes Mapping

### Complete Tauri Command to API Route Mapping

| Tauri Command | HTTP Method | API Route | Payload |
|--------------|-------------|-----------|---------|
| `get_devices` | GET | `/api/devices` | - |
| `get_device_info` | GET | `/api/devices/[serial]/info` | - |
| `get_device_mode` | GET | `/api/devices/[serial]/mode` | - |
| `run_adb_host_command` | POST | `/api/adb/command` | `{ command: string }` |
| `run_shell_command` | POST | `/api/adb/shell` | `{ serial: string, command: string }` |
| `install_package` | POST | `/api/apps/install` | `{ serial: string, filePath: string }` |
| `uninstall_package` | POST | `/api/apps/uninstall` | `{ serial: string, packageName: string }` |
| `list_files` | GET | `/api/files` | `{ serial: string, path: string }` |
| `push_file` | POST | `/api/files/push` | `{ serial: string, local: string, remote: string }` |
| `pull_file` | POST | `/api/files/pull` | `{ serial: string, remote: string, local: string }` |
| `extract_payload` | POST | `/api/payload/extract` | `{ path: string, outputDir: string, partitions: string[] }` |
| `marketplace_search` | GET | `/api/marketplace/search` | `{ query: string, providers: string[] }` |
| `list_avds` | GET | `/api/emulator/list` | - |
| `launch_avd` | POST | `/api/emulator/launch` | `{ name: string, options: object }` |
| `get_debloat_packages` | GET | `/api/debloat/packages` | `{ serial: string }` |

---

## Appendix B: Component Mapping

### View to Page Mapping

| Current View (Vite) | Next.js Page | Route |
|---------------------|--------------|-------|
| `ViewDashboard` | `app/dashboard/page.tsx` | `/dashboard` |
| `ViewAppManager` | `app/app-manager/page.tsx` | `/app-manager` |
| `ViewFileExplorer` | `app/file-explorer/page.tsx` | `/file-explorer` |
| `ViewFlasher` | `app/flasher/page.tsx` | `/flasher` |
| `ViewUtilities` | `app/utilities/page.tsx` | `/utilities` |
| `ViewPayloadDumper` | `app/payload-dumper/page.tsx` | `/payload-dumper` |
| `ViewMarketplace` | `app/marketplace/page.tsx` | `/marketplace` |
| `ViewEmulatorManager` | `app/emulator/page.tsx` | `/emulator` |
| `ViewAbout` | `app/about/page.tsx` | `/about` |

---

## Appendix C: Store Compatibility

### Zustand Stores

| Store | Compatibility | Action Required |
|-------|---------------|-----------------|
| `deviceStore` | ✅ Compatible | None |
| `logStore` | ✅ Compatible | None |
| `shellStore` | ✅ Compatible | None |
| `payloadDumperStore` | ✅ Compatible | None |
| `marketplaceStore` | ✅ Compatible | None |
| `emulatorManagerStore` | ✅ Compatible | None |
| `debloatStore` | ✅ Compatible | None |
| `nicknameStore` | ✅ Compatible | None |

---

## Appendix D: Dependencies Compatibility

### Dependencies to Update/Remove

| Package | Current Version | Next.js Version | Action |
|---------|----------------|-----------------|--------|
| `react` | ^19.2.6 | ^19.0.0 | Update |
| `react-dom` | ^19.2.6 | ^19.0.0 | Update |
| `vite` | ^8.0.11 | ❌ REMOVE | Remove |
| `@vitejs/plugin-react` | ^6.0.1 | ❌ REMOVE | Remove |
| `@tailwindcss/vite` | ^4.3.0 | ✅ Built-in | Remove |
| `next` | 🆕 NEW | ^15.1.0 | Add |
| `typescript` | ^6.0.3 | ^5.0.0 | Update |

### Dependencies to Keep

| Package | Reason |
|---------|--------|
| `zustand` | Works with Next.js |
| `@tanstack/react-query` | Works with Next.js |
| `react-hook-form` | Works with Next.js |
| `zod` | Works with Next.js |
| `framer-motion` | Works with Next.js (with 'use client') |
| `lucide-react` | Works with Next.js |
| `tailwind-merge` | Works with Next.js |
| `clsx` | Works with Next.js |
| `class-variance-authority` | Works with Next.js |
| `next-themes` | Works with Next.js |
| `sonner` | Works with Next.js |

---

## Document Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-05-11 | Initial migration plan | ADB GUI Next Team |

---

## Next Steps

1. **Review this plan** - Confirm strategy and timeline
2. **Create Next.js project** - Start Phase 1 setup
3. **Set up CI/CD** - Configure automated testing
4. **Begin component migration** - Start Phase 2
5. **Regular reviews** - Weekly check-ins on progress

---

**End of Migration Plan**