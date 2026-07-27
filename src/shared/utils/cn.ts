import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The app's type scale (`text-display` … `text-mono-sm`, declared in
 * `styles/global.css`) is a set of *font-size* utilities, but tailwind-merge's
 * stock config falls back to "any `text-*` token is a colour". Without this
 * extension `cn('text-muted-foreground text-body')` silently drops the colour,
 * and `cn('text-body', 'text-destructive')` silently drops the size.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'title', 'body', 'label', 'caption', 'mono', 'mono-sm'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
