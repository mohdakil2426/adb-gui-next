import { ExternalLink } from 'lucide-react';
import type { ComponentProps } from 'react';
import { BrowserOpenURL } from '@/desktop/runtime';
import { Button } from '@/shared/ui/button';

interface ExternalLinkButtonProps {
  children: string;
  className?: string;
  url: string;
  variant?: ComponentProps<typeof Button>['variant'];
}

/**
 * Opens a URL in the system browser.
 *
 * It is a button, not an anchor, because the target leaves the app entirely —
 * and it always carries the external-link icon plus an accessible name that
 * says so, which the previous bare link-styled button did not.
 */
export function ExternalLinkButton({
  children,
  className,
  url,
  variant = 'outline',
}: ExternalLinkButtonProps) {
  return (
    <Button
      aria-label={`${children} (opens in your browser)`}
      className={className}
      onClick={() => {
        BrowserOpenURL(url);
      }}
      size="sm"
      type="button"
      variant={variant}
    >
      {children}
      <ExternalLink aria-hidden="true" />
    </Button>
  );
}
