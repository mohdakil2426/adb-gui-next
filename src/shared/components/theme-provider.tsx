"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

export const ThemeProvider = ({
  children,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  ...props
}: ThemeProviderProps) => (
  <NextThemesProvider
    attribute={attribute}
    defaultTheme={defaultTheme}
    disableTransitionOnChange
    enableSystem={enableSystem}
    {...props}
  >
    {children}
  </NextThemesProvider>
);
