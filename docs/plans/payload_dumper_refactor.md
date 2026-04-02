# Refactoring Plan: ViewPayloadDumper

## Objective
Refactor `src/components/views/ViewPayloadDumper.tsx` to reduce cognitive load and file size by moving distinct logic and UI into focused, modular files.

## Recommended Folder Structure
```text
src/
├── components/
│   ├── views/
│   │   └── ViewPayloadDumper.tsx         # The slimmed-down container component
│   │
│   └── payload-dumper/                   # UI Sub-components
│       ├── PayloadSourceTabs.tsx         # Local / Remote URL tabs logic
│       ├── PartitionTable.tsx            # Main table layout and header
│       ├── PartitionRow.tsx              # Single partition row
│       ├── ExtractionProgressBar.tsx     # Progress indicator bar
│       ├── ActionFooter.tsx              # Reset / Extract buttons
│       └── ExtractionStatusCard.tsx      # Success/error outcome UI
│
├── lib/
│   └── payload-dumper/                   # Business logic
│       ├── usePayloadActions.ts          # Orchestrates backend commands and extraction
│       └── usePayloadEvents.ts           # Handles Tauri IPC progress event listeners
```

## Execution Steps

### Phase 1: Logic Extraction (Hooks)
1. **Create `src/lib/payload-dumper/usePayloadEvents.ts`**
   - Move the `EventsOn('payload:progress')` event listener inside this hook.
   - It will interact with `usePayloadDumperStore` securely.

2. **Create `src/lib/payload-dumper/usePayloadActions.ts`**
   - Extract the `handleCheckUrl`, `loadRemotePartitions`, `handlePayloadDrop`, `handleSelectPayload`, `handleSelectOutput`, `handleExtract`, etc.
   - Setup pure actions bound to the view's current state and return callable methods.

### Phase 2: UI Decomposition (Sub-components)
1. **Extract Simple Components First**
   - Move `ExtractionProgressBar` from the main file to `src/components/payload-dumper/ExtractionProgressBar.tsx`.
   - Create `ExtractionStatusCard.tsx` and move the post-extraction success/fail summary card logic here.
   - Create `ActionFooter.tsx` for the footer buttons.

2. **Extract Complex Layout Components**
   - Create `PartitionRow.tsx` to encapsulate row rendering and click/checkbox interactions.
   - Create `PartitionTable.tsx` to iterate over partitions and render the `PartitionRow` components.
   - Create `PayloadSourceTabs.tsx` to isolate the `DropZone` and `RemoteUrlPanel` tabs logic.

### Phase 3: Integration and Cleanup
1. **Refactor `ViewPayloadDumper.tsx`**
   - Remove old inline implementations.
   - Import the custom hooks (`usePayloadActions`, `usePayloadEvents`) and connect state.
   - Swap the inlined big blocks of JSX for the new sub-components.
   - Ensure the UI operates without regressions by conducting a local smoke test handling:
     - Selecting local files mapping.
     - Connecting to remote URLs.
     - Processing partition progress updates accurately.

### Expected Benefits
- Sub-files will each remain significantly smaller (most around 50-150 lines).
- True separation of concerns (UI components vs business logic orchestration).
- Enables easier React performance scaling (especially for components like `PartitionRow` utilizing `React.memo`).
