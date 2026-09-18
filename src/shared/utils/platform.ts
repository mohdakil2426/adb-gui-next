export const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/iu.test(navigator.userAgent);
export const isLinux = typeof navigator !== "undefined" && /Linux/iu.test(navigator.userAgent);
export const isWindows = typeof navigator !== "undefined" && /Windows/iu.test(navigator.userAgent);
