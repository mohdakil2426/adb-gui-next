import type { FileEntry } from '@/features/file-explorer/model/fileExplorerTypes';

/** Windows-style Type column labels for known extensions. Unknown extensions
 *  still become `{EXT} File`. */
const NAMED_TYPES: Record<string, string> = {
  '3gp': '3GP Video',
  '7z': '7-Zip Archive',
  aab: 'Android App Bundle',
  aac: 'AAC Audio',
  apk: 'Android Package',
  apkm: 'APKM File',
  apex: 'APEX Package',
  art: 'ART Image',
  ass: 'ASS Subtitle',
  avi: 'AVI Video',
  avif: 'AVIF Image',
  bak: 'Backup File',
  bash: 'Bash Script',
  bat: 'Windows Batch File',
  bin: 'BIN File',
  bmp: 'BMP Image',
  bz2: 'BZIP2 Archive',
  c: 'C Source File',
  cab: 'Cabinet Archive',
  cfg: 'CFG File',
  cil: 'SELinux CIL File',
  cmd: 'Windows Command Script',
  conf: 'CONF File',
  cpp: 'C++ Source File',
  cs: 'C# Source File',
  css: 'CSS File',
  csv: 'CSV File',
  dart: 'Dart Source File',
  dat: 'DAT File',
  db: 'Database File',
  dex: 'Dalvik Executable',
  dll: 'Application Extension',
  dng: 'DNG Image',
  doc: 'Microsoft Word Document',
  docx: 'Microsoft Word Document',
  elf: 'ELF Binary',
  env: 'Environment File',
  epub: 'EPUB Book',
  exe: 'Application',
  flac: 'FLAC Audio',
  gif: 'GIF Image',
  go: 'Go Source File',
  gz: 'GZ Archive',
  h: 'C Header File',
  heic: 'HEIC Image',
  heif: 'HEIF Image',
  hpp: 'C++ Header File',
  htm: 'HTML File',
  html: 'HTML File',
  ico: 'Icon',
  ics: 'iCalendar File',
  img: 'Disk Image',
  ini: 'INI File',
  iso: 'ISO Disk Image',
  jar: 'Java Archive',
  java: 'Java Source File',
  jpeg: 'JPEG Image',
  jpg: 'JPEG Image',
  js: 'JavaScript File',
  json: 'JSON File',
  jsonc: 'JSON File',
  jsx: 'JavaScript File',
  kcm: 'Key Character Map',
  kl: 'Key Layout File',
  kt: 'Kotlin Source File',
  kts: 'Kotlin Script',
  less: 'LESS File',
  log: 'Text Document',
  lua: 'Lua Script',
  lz4: 'LZ4 Archive',
  m3u: 'Playlist File',
  m3u8: 'Playlist File',
  m4a: 'M4A Audio',
  md: 'Markdown File',
  mkv: 'MKV Video',
  mov: 'QuickTime Movie',
  mp3: 'MP3 File',
  mp4: 'MP4 Video',
  odex: 'Optimized DEX File',
  ogg: 'OGG Audio',
  opus: 'Opus Audio',
  otf: 'OpenType Font',
  pb: 'Protocol Buffer File',
  pdf: 'PDF File',
  php: 'PHP Script',
  png: 'PNG Image',
  policy: 'SELinux Policy File',
  ppt: 'Microsoft PowerPoint Presentation',
  pptx: 'Microsoft PowerPoint Presentation',
  prop: 'PROP File',
  properties: 'PROPERTIES File',
  proto: 'Protocol Buffer File',
  ps1: 'PowerShell Script',
  py: 'Python Script',
  rar: 'RAR Archive',
  rc: 'Init RC File',
  rs: 'Rust Source File',
  rst: 'reStructuredText File',
  rtf: 'Rich Text Format',
  scss: 'SCSS File',
  service: 'Systemd Service File',
  sh: 'Shell Script',
  so: 'Shared Library',
  sql: 'SQL File',
  sqlite: 'SQLite Database',
  srt: 'SubRip Subtitle',
  svg: 'SVG Image',
  swift: 'Swift Source File',
  sys: 'System File',
  tar: 'TAR Archive',
  te: 'SELinux Type Enforcement',
  tgz: 'TGZ Archive',
  tif: 'TIFF Image',
  tiff: 'TIFF Image',
  toml: 'TOML File',
  ts: 'TypeScript File',
  tsx: 'TypeScript File',
  ttf: 'TrueType Font',
  txt: 'Text Document',
  vdex: 'VDEX File',
  vtt: 'WebVTT File',
  wav: 'WAV File',
  webm: 'WEBM Video',
  webp: 'WEBP Image',
  woff: 'Web Font',
  woff2: 'Web Font',
  wmv: 'WMV Video',
  xapk: 'XAPK Package',
  xls: 'Microsoft Excel Worksheet',
  xlsx: 'Microsoft Excel Worksheet',
  xml: 'XML File',
  xz: 'XZ Archive',
  yaml: 'YAML File',
  yml: 'YAML File',
  zip: 'zip Archive',
  zsh: 'Zsh Script',
  zst: 'Zstandard Archive',
};

/** Extensionless (or well-known) basenames — `hosts`, `Makefile`, `.gitignore`. */
const NAMED_BASENAMES: Record<string, string> = {
  adbd: 'ADB Daemon',
  authors: 'Authors File',
  bashrc: 'Bash RC File',
  busybox: 'BusyBox Binary',
  changelog: 'Changelog',
  copying: 'License File',
  dockerfile: 'Dockerfile',
  fstab: 'Filesystem Table',
  gemfile: 'Gemfile',
  gitignore: 'Git Ignore File',
  gitmodules: 'Git Modules File',
  group: 'Group File',
  hostname: 'Hostname File',
  hosts: 'Hosts File',
  issue: 'Issue File',
  jenkinsfile: 'Jenkinsfile',
  known_hosts: 'SSH Known Hosts',
  license: 'License File',
  magisk: 'Magisk Binary',
  makefile: 'Makefile',
  motd: 'Message of the Day',
  notice: 'Notice File',
  passwd: 'Password File',
  procfile: 'Procfile',
  profile: 'Shell Profile',
  rakefile: 'Rakefile',
  readme: 'Readme File',
  sepolicy: 'SELinux Policy',
  shadow: 'Shadow Password File',
  su: 'Superuser Binary',
  vagrantfile: 'Vagrantfile',
  vimrc: 'Vim RC File',
  zshrc: 'Zsh RC File',
};

function fileBaseName(name: string): string {
  return name.split('/').pop() ?? name;
}

function fileExtension(base: string): string | null {
  const dot = base.lastIndexOf('.');
  if (dot === base.length - 1) {
    return null;
  }
  if (dot < 0) {
    return null;
  }
  // `.gitignore` / `.bashrc` — the name after the leading dot is the type key.
  if (dot === 0) {
    const rest = base.slice(1);
    return rest.includes('.') ? rest.slice(rest.lastIndexOf('.') + 1) : rest;
  }
  return base.slice(dot + 1);
}

/** Windows-style Type column: Folder, Link, a named type, or `{EXT} File`. */
export function fileTypeLabel(file: Pick<FileEntry, 'name' | 'type'>): string {
  if (file.type === 'Directory') {
    return 'Folder';
  }
  if (file.type === 'Symlink') {
    return 'Link';
  }
  const base = fileBaseName(file.name);
  const lower = base.toLowerCase();
  const namedBase = NAMED_BASENAMES[lower] ?? NAMED_BASENAMES[lower.replace(/^\./, '')];
  if (namedBase) {
    return namedBase;
  }
  const ext = fileExtension(base);
  if (!ext) {
    return 'File';
  }
  const key = ext.toLowerCase();
  return NAMED_TYPES[key] ?? `${key.toUpperCase()} File`;
}
