import type { FileEntry } from '@/features/file-explorer/model/fileExplorerTypes';

const NAMED_TYPES: Record<string, string> = {
  apk: 'Android Package',
  apkm: 'APKM File',
  bmp: 'BMP Image',
  conf: 'CONF File',
  css: 'CSS File',
  csv: 'CSV File',
  gif: 'GIF Image',
  gz: 'GZ Archive',
  html: 'HTML File',
  ini: 'INI File',
  jpeg: 'JPEG Image',
  jpg: 'JPEG Image',
  js: 'JavaScript File',
  json: 'JSON File',
  log: 'Text Document',
  md: 'Markdown File',
  mkv: 'MKV Video',
  mp3: 'MP3 File',
  mp4: 'MP4 Video',
  pdf: 'PDF File',
  png: 'PNG Image',
  prop: 'PROP File',
  properties: 'PROPERTIES File',
  sh: 'Shell Script',
  svg: 'SVG Image',
  tar: 'TAR Archive',
  tgz: 'TGZ Archive',
  toml: 'TOML File',
  txt: 'Text Document',
  wav: 'WAV File',
  webm: 'WEBM Video',
  webp: 'WEBP Image',
  xml: 'XML File',
  yaml: 'YAML File',
  yml: 'YAML File',
  zip: 'zip Archive',
};

function fileExtension(name: string): string | null {
  const base = name.split('/').pop() ?? name;
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) {
    return null;
  }
  return base.slice(dot + 1).toLowerCase();
}

/** Windows-style Type column: Folder, or a name derived from the extension. */
export function fileTypeLabel(file: Pick<FileEntry, 'name' | 'type'>): string {
  if (file.type === 'Directory') {
    return 'Folder';
  }
  if (file.type === 'Symlink') {
    return 'Link';
  }
  const ext = fileExtension(file.name);
  if (!ext) {
    return 'File';
  }
  return NAMED_TYPES[ext] ?? `${ext.toUpperCase()} File`;
}
