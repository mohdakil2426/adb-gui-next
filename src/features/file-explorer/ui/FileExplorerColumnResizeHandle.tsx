interface Props {
  label: string;
  onDelta: (dx: number) => void;
}

/** Drag the Details-view divider. Resizes the column to the left of the grip. */
export function FileExplorerColumnResizeHandle({ label, onDelta }: Props) {
  return (
    <span
      aria-label={label}
      aria-orientation="vertical"
      className="absolute top-0 right-0 z-10 flex h-full w-2 cursor-col-resize items-stretch justify-center"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const handle = event.currentTarget;
        const pointerId = event.pointerId;
        let lastX = event.clientX;
        handle.setPointerCapture(pointerId);
        const onMove = (moveEvent: PointerEvent) => {
          const dx = moveEvent.clientX - lastX;
          lastX = moveEvent.clientX;
          if (dx !== 0) {
            onDelta(dx);
          }
        };
        const onUp = () => {
          handle.releasePointerCapture(pointerId);
          handle.removeEventListener('pointermove', onMove);
          handle.removeEventListener('pointerup', onUp);
        };
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
      }}
      role="separator"
    >
      <span aria-hidden="true" className="w-px bg-border" />
    </span>
  );
}
