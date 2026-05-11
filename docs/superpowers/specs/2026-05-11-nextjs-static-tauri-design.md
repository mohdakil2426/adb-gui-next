# Next.js Static Tauri Design

## Goal

Migrate the frontend build host from Vite to Next.js while preserving the existing desktop-only Tauri application behavior and UI exactly.

## Scope

This migration is intentionally narrow:

- Keep the app desktop-only.
- Use Next.js only as a static SPA build host.
- Keep the existing React UI, view switching, stores, hooks, Tauri IPC wrappers, and Rust backend contracts.
- Do not introduce browser/web deployment support.
- Do not introduce Next.js API routes, Server Actions, or runtime server features.

## Architecture

```text
Next.js static export
  -> client-only App wrapper
  -> existing App.tsx
  -> existing MainLayout
  -> existing views, stores, hooks, components
  -> existing src/lib/desktop/backend.ts
  -> Tauri invoke
  -> existing Rust commands
```

The packaged desktop application has no Next.js server runtime. Next.js produces static assets, and Tauri loads those assets from the configured `frontendDist`.

## Core Design Decisions

### Use Static Export

Next.js must be configured with `output: 'export'` because Tauri desktop packaging consumes static frontend assets. The output directory becomes the Tauri `frontendDist`.

### Keep One Client-Side App

The existing app is already a desktop SPA with internal `MainLayout` view state. That model stays unchanged. Next.js should mount the existing app through a client-only wrapper, not convert every view into a route.

### Keep Tauri IPC Direct

Frontend command flow remains:

```text
component -> src/lib/desktop/backend.ts -> @tauri-apps/api/core.invoke -> Rust command
```

There are no Next.js route handlers between the UI and Tauri. Adding route handlers would be bogus shit for this desktop-only static export target because runtime server endpoints are not available inside the packaged Tauri app.

### Preserve UI and State

The migration must not change visual layout, component hierarchy, Zustand store shape, TanStack Query polling, bottom panel behavior, device selection, or feature flows.

## Files Expected To Change

Configuration:

- `package.json` scripts and dependencies
- `tsconfig.json` include/plugins if required by Next.js
- `src-tauri/tauri.conf.json` build section
- `.gitignore` for `.next/` and `out/`
- new `next.config.ts`
- remove or retire Vite-specific config after verification

Entrypoint:

- new `src/app/layout.tsx`
- new `src/app/[[...slug]]/page.tsx`
- new `src/app/[[...slug]]/client.tsx`
- global CSS import moves into the Next app entry

Likely cleanup:

- `src/main.tsx` becomes obsolete after migration
- `index.html` becomes obsolete after migration
- `vite.config.ts` becomes obsolete after migration
- `src/vite-env.d.ts` becomes obsolete after migration

## Explicit Non-Goals

- No route-per-view migration.
- No App Router navigation rewrite.
- No Next.js API routes.
- No Server Actions.
- No server-side data fetching.
- No browser/web build.
- No Rust command changes.
- No Tauri permission changes unless build tooling unexpectedly requires them.
- No UI redesign or component refactor.

## Migration Shape

```text
1. Install/configure Next.js static export
   -> verify: Next build emits static output.

2. Add Next app entry that mounts the existing App client-side
   -> verify: the same app shell renders.

3. Point Tauri at Next dev/build output
   -> verify: Tauri dev opens the same UI.

4. Remove Vite-only entry/config after parity is proven
   -> verify: frontend tests/build stay clean.

5. Run desktop packaging verification
   -> verify: debug Tauri build bundles the static Next output.
```

## Testing Strategy

Minimum verification:

```text
1. `bun run build` -> Next static export succeeds and produces `out/`.
2. `bun run test` -> existing frontend tests pass or are adjusted only for entrypoint assumptions.
3. `bun run lint:web` -> ESLint stays clean.
4. `bun run tauri dev` -> desktop window opens and existing UI appears.
5. `bun run tauri build --debug` -> Tauri bundles the Next static output.
```

If Rust files are not changed, Rust tests are not migration-specific, but the project gate can still run them as part of final verification where practical.

## Risks

- Some tests may assume the Vite entrypoint or `import.meta.env`.
- Next static export may require minor changes for asset imports.
- Next dev port changes from `1420` to `3000`, requiring Tauri config updates.
- Client-only dynamic import must be used carefully so Tauri browser APIs are not touched during prerender.

## Rejection Criteria

Reject any migration patch that:

- Changes feature behavior without being required by the build migration.
- Replaces Tauri IPC with HTTP/API route indirection.
- Converts views to routes before the static wrapper works.
- Adds server-only Next features to a static Tauri target.
- Performs broad unrelated cleanup.
- Claims parity without running reproducible verification.
