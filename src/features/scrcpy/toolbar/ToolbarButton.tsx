import { Camera, MoreHorizontal, Power, Volume1, Volume2, ZoomIn } from 'lucide-react';
import type React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';

interface ToolbarButtonProps {
  description?: string | undefined;
  disabled?: boolean | undefined;
  icon: string;
  isActive?: boolean | undefined;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  shortcut?: string | undefined;
}

// Android navigation icons (Back triangle, Home circle, Recents square, Rotate phone)
function AndroidBackIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <title>Back</title>
      <polygon points="17 4 7 12 17 20" />
    </svg>
  );
}

function AndroidHomeIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <title>Home</title>
      <circle cx="12" cy="12" r="7" />
    </svg>
  );
}

function AndroidRecentsIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <title>Recents</title>
      <rect height="13" rx="2" width="13" x="5.5" y="5.5" />
    </svg>
  );
}

function RotateCcwPhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <title>Rotate Counter-Clockwise</title>
      <rect height="14" rx="2" width="10" x="7" y="5" />
      <path d="M4 10A5 5 0 0 1 9 4" />
      <polyline points="4 6 4 10 8 10" />
    </svg>
  );
}

function RotateCwPhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <title>Rotate Clockwise</title>
      <rect height="14" rx="2" width="10" x="7" y="5" />
      <path d="M20 10A5 5 0 0 0 15 4" />
      <polyline points="20 6 20 10 16 10" />
    </svg>
  );
}

export function ToolbarButton({
  description,
  disabled = false,
  icon,
  isActive = false,
  label,
  onClick,
  shortcut,
}: ToolbarButtonProps) {
  const renderIcon = () => {
    const iconClass =
      'size-4.5 text-foreground/80 transition-colors group-hover:text-foreground group-active:text-foreground';
    switch (icon) {
      case 'power':
        return <Power className={iconClass} strokeWidth={2.2} />;
      case 'vol-up':
        return <Volume2 className={iconClass} strokeWidth={2.2} />;
      case 'vol-down':
        return <Volume1 className={iconClass} strokeWidth={2.2} />;
      case 'camera':
        return <Camera className={iconClass} strokeWidth={2.2} />;
      case 'zoom':
        return <ZoomIn className={iconClass} strokeWidth={2.2} />;
      case 'rotate-ccw':
        return <RotateCcwPhoneIcon className={iconClass} />;
      case 'rotate-cw':
        return <RotateCwPhoneIcon className={iconClass} />;
      case 'back':
        return <AndroidBackIcon className={iconClass} />;
      case 'home':
        return <AndroidHomeIcon className={iconClass} />;
      case 'recents':
        return <AndroidRecentsIcon className={iconClass} />;
      case 'more':
        return <MoreHorizontal className={iconClass} strokeWidth={2.2} />;
      default:
        return null;
    }
  };

  const tooltipText = shortcut ? `${label} (${shortcut})` : label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          className={`group flex size-8.5 items-center justify-center rounded-md transition-all duration-150 active:scale-90 ${
            isActive
              ? 'bg-accent text-accent-foreground shadow-xs'
              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          } ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
          disabled={disabled}
          onClick={onClick}
          title={tooltipText}
          type="button"
        >
          {renderIcon()}
        </button>
      </TooltipTrigger>
      <TooltipContent
        className="flex flex-col gap-0.5 rounded-md border border-border/80 bg-surface-raised/95 px-2.5 py-1.5 shadow-md backdrop-blur-md"
        side="left"
        sideOffset={8}
      >
        <div className="flex items-center gap-2 font-medium text-foreground text-xs">
          <span>{label}</span>
          {shortcut ? (
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {shortcut}
            </kbd>
          ) : null}
        </div>
        {description ? (
          <span className="text-[11px] text-muted-foreground">{description}</span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
