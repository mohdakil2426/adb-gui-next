export interface ToolbarActionItem {
  description?: string;
  icon:
    | "power"
    | "vol-up"
    | "vol-down"
    | "camera"
    | "zoom"
    | "rotate-ccw"
    | "rotate-cw"
    | "back"
    | "home"
    | "recents"
    | "more";
  id: string;
  label: string;
  shortcut?: string;
}

export const MAIN_TOOLBAR_ACTIONS: ToolbarActionItem[] = [
  {
    description: "Toggle device power / screen lock",
    icon: "power",
    id: "power",
    label: "Power",
    shortcut: "Alt + P",
  },
  {
    description: "Increase audio volume",
    icon: "vol-up",
    id: "vol-up",
    label: "Volume Up",
    shortcut: "Alt + Up",
  },
  {
    description: "Decrease audio volume",
    icon: "vol-down",
    id: "vol-down",
    label: "Volume Down",
    shortcut: "Alt + Down",
  },
  {
    description: "Capture screen and save to host",
    icon: "camera",
    id: "camera",
    label: "Take Screenshot",
    shortcut: "Capture PNG",
  },
  {
    description: "Resize scrcpy window to 1:1 native resolution",
    icon: "zoom",
    id: "zoom",
    label: "1:1 Pixel Size / Zoom",
    shortcut: "Alt + W",
  },
  {
    description: "Rotate device orientation counter-clockwise",
    icon: "rotate-ccw",
    id: "rotate-ccw",
    label: "Rotate Left",
    shortcut: "Rotate 90° CCW",
  },
  {
    description: "Rotate device orientation clockwise",
    icon: "rotate-cw",
    id: "rotate-cw",
    label: "Rotate Right",
    shortcut: "Alt + R",
  },
  {
    description: "Navigate back",
    icon: "back",
    id: "back",
    label: "Back",
    shortcut: "Alt + B / Right-click",
  },
  {
    description: "Navigate to home screen",
    icon: "home",
    id: "home",
    label: "Home",
    shortcut: "Alt + H / Middle-click",
  },
  {
    description: "Open recent apps switcher",
    icon: "recents",
    id: "recents",
    label: "Overview / Recents",
    shortcut: "Alt + S",
  },
];
