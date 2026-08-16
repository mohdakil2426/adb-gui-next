/** Keep in sync with `TEXT_EXTENSIONS` in `src-tauri/src/commands/files.rs`. */
export const TEXT_FILE_EXTENSIONS = [
  'sh',
  'md',
  'txt',
  'toml',
  'xml',
  'bak',
  'json',
  'conf',
  'prop',
  'log',
  'cfg',
  'ini',
  'yaml',
  'yml',
  'properties',
  'rc',
  'service',
] as const;

export function isTextDeviceFile(name: string): boolean {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) {
    return false;
  }
  const ext = name.slice(dot + 1).toLowerCase();
  return (TEXT_FILE_EXTENSIONS as readonly string[]).includes(ext);
}
