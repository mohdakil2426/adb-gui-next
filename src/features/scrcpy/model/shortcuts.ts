export interface ShortcutItem {
  category: "navigation" | "display" | "device" | "audio";
  description: string;
  keys: string[];
  label: string;
}

export const SCRCPY_SHORTCUTS: ShortcutItem[] = [
  {
    category: "display",
    description: "Toggle mirror window fullscreen",
    keys: ["MOD", "F"],
    label: "Fullscreen Mode",
  },
  {
    category: "navigation",
    description: "Navigate to device home screen (or middle-click)",
    keys: ["MOD", "H"],
    label: "Home Button",
  },
  {
    category: "navigation",
    description: "Navigate back (or right-click)",
    keys: ["MOD", "B"],
    label: "Back Button",
  },
  {
    category: "navigation",
    description: "Open recent apps overview",
    keys: ["MOD", "S"],
    label: "App Switcher / Recents",
  },
  {
    category: "device",
    description: "Turn physical display off while keeping mirror active",
    keys: ["MOD", "O"],
    label: "Turn Screen Off",
  },
  {
    category: "device",
    description: "Power physical device display back on",
    keys: ["MOD", "Shift", "O"],
    label: "Turn Screen On",
  },
  {
    category: "device",
    description: "Expand Android notification drawer",
    keys: ["MOD", "N"],
    label: "Open Notifications",
  },
  {
    category: "device",
    description: "Simulate hardware power button press",
    keys: ["MOD", "P"],
    label: "Power Button",
  },
  {
    category: "display",
    description: "Rotate device orientation by 90 degrees",
    keys: ["MOD", "R"],
    label: "Rotate Screen",
  },
  {
    category: "display",
    description: "Resize window to exact 1:1 device pixel scale",
    keys: ["MOD", "W"],
    label: "1:1 Native Pixel Size",
  },
  {
    category: "audio",
    description: "Increase device audio volume",
    keys: ["MOD", "Up"],
    label: "Volume Up",
  },
  {
    category: "audio",
    description: "Decrease device audio volume",
    keys: ["MOD", "Down"],
    label: "Volume Down",
  },
];
