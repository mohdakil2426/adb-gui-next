const isDebug = import.meta.env.DEV || localStorage.getItem("debug") === "true";

export const debugLog = (...args: unknown[]): void => {
  if (isDebug) {
    console.log("[DEBUG]", ...args);
  }
};
