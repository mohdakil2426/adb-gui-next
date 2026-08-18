export interface ToolbarActionItem {
  id: string;
  label: string;
  shortcut?: string;
  icon: 'power' | 'vol-up' | 'vol-down' | 'camera' | 'zoom' | 'rotate-ccw' | 'rotate-cw' | 'back' | 'home' | 'recents' | 'more';
  description?: string;
}

export const MAIN_TOOLBAR_ACTIONS: ToolbarActionItem[] = [
  {
    id: 'power',
    label: 'Power',
    shortcut: 'Alt + P',
    icon: 'power',
    description: 'Toggle device power / screen lock',
  },
  {
    id: 'vol-up',
    label: 'Volume Up',
    shortcut: 'Alt + Up',
    icon: 'vol-up',
    description: 'Increase audio volume',
  },
  {
    id: 'vol-down',
    label: 'Volume Down',
    shortcut: 'Alt + Down',
    icon: 'vol-down',
    description: 'Decrease audio volume',
  },
  {
    id: 'camera',
    label: 'Take Screenshot',
    shortcut: 'Capture PNG',
    icon: 'camera',
    description: 'Capture screen and save to host',
  },
  {
    id: 'zoom',
    label: '1:1 Pixel Size / Zoom',
    shortcut: 'Alt + W',
    icon: 'zoom',
    description: 'Resize scrcpy window to 1:1 native resolution',
  },
  {
    id: 'rotate-ccw',
    label: 'Rotate Left',
    shortcut: 'Rotate 90° CCW',
    icon: 'rotate-ccw',
    description: 'Rotate device orientation counter-clockwise',
  },
  {
    id: 'rotate-cw',
    label: 'Rotate Right',
    shortcut: 'Alt + R',
    icon: 'rotate-cw',
    description: 'Rotate device orientation clockwise',
  },
  {
    id: 'back',
    label: 'Back',
    shortcut: 'Alt + B / Right-click',
    icon: 'back',
    description: 'Navigate back',
  },
  {
    id: 'home',
    label: 'Home',
    shortcut: 'Alt + H / Middle-click',
    icon: 'home',
    description: 'Navigate to home screen',
  },
  {
    id: 'recents',
    label: 'Overview / Recents',
    shortcut: 'Alt + S',
    icon: 'recents',
    description: 'Open recent apps switcher',
  },
];
