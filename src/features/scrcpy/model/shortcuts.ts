export interface ShortcutItem {
  category: 'navigation' | 'display' | 'device' | 'audio';
  description: string;
  keys: string[];
  label: string;
}

export const SCRCPY_SHORTCUTS: ShortcutItem[] = [
  {
    category: 'display',
    label: 'Fullscreen Mode',
    keys: ['MOD', 'F'],
    description: 'Toggle mirror window fullscreen',
  },
  {
    category: 'navigation',
    label: 'Home Button',
    keys: ['MOD', 'H'],
    description: 'Navigate to device home screen (or middle-click)',
  },
  {
    category: 'navigation',
    label: 'Back Button',
    keys: ['MOD', 'B'],
    description: 'Navigate back (or right-click)',
  },
  {
    category: 'navigation',
    label: 'App Switcher / Recents',
    keys: ['MOD', 'S'],
    description: 'Open recent apps overview',
  },
  {
    category: 'device',
    label: 'Turn Screen Off',
    keys: ['MOD', 'O'],
    description: 'Turn physical display off while keeping mirror active',
  },
  {
    category: 'device',
    label: 'Turn Screen On',
    keys: ['MOD', 'Shift', 'O'],
    description: 'Power physical device display back on',
  },
  {
    category: 'device',
    label: 'Open Notifications',
    keys: ['MOD', 'N'],
    description: 'Expand Android notification drawer',
  },
  {
    category: 'device',
    label: 'Power Button',
    keys: ['MOD', 'P'],
    description: 'Simulate hardware power button press',
  },
  {
    category: 'display',
    label: 'Rotate Screen',
    keys: ['MOD', 'R'],
    description: 'Rotate device orientation by 90 degrees',
  },
  {
    category: 'display',
    label: '1:1 Native Pixel Size',
    keys: ['MOD', 'W'],
    description: 'Resize window to exact 1:1 device pixel scale',
  },
  {
    category: 'audio',
    label: 'Volume Up',
    keys: ['MOD', 'Up'],
    description: 'Increase device audio volume',
  },
  {
    category: 'audio',
    label: 'Volume Down',
    keys: ['MOD', 'Down'],
    description: 'Decrease device audio volume',
  },
];
