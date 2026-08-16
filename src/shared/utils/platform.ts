export const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent);
export const isLinux = typeof navigator !== 'undefined' && /Linux/i.test(navigator.userAgent);
export const isWindows = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);
