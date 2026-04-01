interface SectionHeaderProps {
  children: React.ReactNode;
}

/**
 * A small uppercase label used as a section divider within Card content.
 * Standardises the `text-xs font-semibold uppercase tracking-wider text-muted-foreground`
 * pattern used across multiple views.
 */
export function SectionHeader({ children }: SectionHeaderProps) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h4>
  );
}
