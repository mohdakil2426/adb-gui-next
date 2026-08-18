import type { backend } from '@/desktop/models';

export { SCRCPY_SHORTCUTS, type ShortcutItem } from '@/features/scrcpy/model/shortcuts';

export const DEFAULT_SCRCPY_OPTIONS: backend.ScrcpyLaunchOptions = {
  alwaysOnTop: false,
  audioSource: null,
  borderless: false,
  fullscreen: false,
  keyboard: 'uhid',
  maxFps: null,
  maxSize: null,
  noAudio: false,
  noControl: false,
  recordFormat: null,
  recordPath: null,
  showTouches: false,
  stayAwake: true,
  turnScreenOff: false,
  videoBitRate: '8M',
  videoCodec: 'h264',
};

export interface QualityPreset {
  badge: string;
  description: string;
  id: 'gaming' | 'productivity' | 'battery' | 'creator';
  label: string;
  options: Partial<backend.ScrcpyLaunchOptions>;
  specs: string[];
}

export const QUALITY_PRESETS: QualityPreset[] = [
  {
    id: 'gaming',
    label: 'High Performance / Gaming',
    badge: '60 FPS · 16M · H.265',
    description:
      'Ultra-smooth 60 FPS streaming with low-latency H.265 video and audio passthrough.',
    specs: ['60 FPS Cap', '16 Mbps Bitrate', 'H.265 / HEVC', 'Audio Passthrough'],
    options: {
      maxFps: 60,
      videoBitRate: '16M',
      videoCodec: 'h265',
      noAudio: false,
      audioSource: 'playback',
      stayAwake: true,
      turnScreenOff: false,
    },
  },
  {
    id: 'productivity',
    label: 'Productivity & Work',
    badge: 'Native · 12M · UHID',
    description:
      'Crisp native resolution, stay awake enabled, and hardware UHID keyboard forwarding.',
    specs: ['Native Resolution', '12 Mbps Bitrate', 'Stay Awake', 'UHID Keyboard'],
    options: {
      maxSize: null,
      videoBitRate: '12M',
      videoCodec: 'h264',
      maxFps: null,
      stayAwake: true,
      keyboard: 'uhid',
      turnScreenOff: false,
      alwaysOnTop: false,
    },
  },
  {
    id: 'battery',
    label: 'Battery Saver / Ultra-Light',
    badge: '1080p · 4M · Screen Off',
    description:
      'Optimized for low thermal impact and battery conservation with device screen turned off.',
    specs: ['1080p Limit', '4 Mbps Bitrate', '30 FPS Cap', 'Turn Screen Off'],
    options: {
      maxSize: 1080,
      videoBitRate: '4M',
      maxFps: 30,
      turnScreenOff: true,
      videoCodec: 'h264',
      stayAwake: true,
    },
  },
  {
    id: 'creator',
    label: 'Content Creator / Recording',
    badge: 'Max · 24M · H.265',
    description:
      'Studio-grade video stream with 24 Mbps bitrate, H.265 codec, and MP4 container readiness.',
    specs: ['Original Size', '24 Mbps High Bitrate', 'H.265 Encoding', 'Studio Audio'],
    options: {
      maxSize: null,
      videoBitRate: '24M',
      videoCodec: 'h265',
      noAudio: false,
      recordFormat: 'mp4',
      stayAwake: true,
    },
  },
];

export const MAX_SIZE_PRESETS: { label: string; value: number | null }[] = [
  { label: 'Original (Device default)', value: null },
  { label: '720p HD (720)', value: 720 },
  { label: '1080p FHD (1080)', value: 1080 },
  { label: '1440p QHD (1440)', value: 1440 },
  { label: '1920 (FHD Max)', value: 1920 },
  { label: '2560 2K (2560)', value: 2560 },
  { label: '3840 4K (3840)', value: 3840 },
];

export const BITRATE_PRESETS: { label: string; value: string }[] = [
  { label: '2 Mbps (2M - Low bandwidth)', value: '2M' },
  { label: '4 Mbps (4M - Balanced)', value: '4M' },
  { label: '8 Mbps (8M - Default)', value: '8M' },
  { label: '12 Mbps (12M - High quality)', value: '12M' },
  { label: '16 Mbps (16M - Ultra stream)', value: '16M' },
  { label: '24 Mbps (24M - Creator studio)', value: '24M' },
  { label: '32 Mbps (32M - Lossless tier)', value: '32M' },
  { label: '64 Mbps (64M - Direct local)', value: '64M' },
];

export const FPS_PRESETS: { label: string; value: number | null }[] = [
  { label: 'Max / Native (Default)', value: null },
  { label: '30 FPS', value: 30 },
  { label: '60 FPS', value: 60 },
  { label: '90 FPS', value: 90 },
  { label: '120 FPS', value: 120 },
  { label: '144 FPS', value: 144 },
];

export const RECORD_FORMAT_PRESETS = [
  { label: 'Auto (from filename)', value: null },
  { label: 'MP4 (Default - Video + Audio)', value: 'mp4' },
  { label: 'MKV (Matroska - Crash resilient)', value: 'mkv' },
  { label: 'M4A (Audio only)', value: 'm4a' },
  { label: 'AAC (Audio only)', value: 'aac' },
  { label: 'Opus (Audio only)', value: 'opus' },
  { label: 'FLAC (Lossless audio)', value: 'flac' },
  { label: 'WAV (Uncompressed audio)', value: 'wav' },
];

export const VIDEO_CODECS = ['h264', 'h265', 'av1', 'vp8', 'vp9'] as const;
export const KEYBOARDS = ['sdk', 'uhid', 'aoa', 'disabled'] as const;
export const AUDIO_SOURCES = [
  'output',
  'playback',
  'mic',
  'mic-unprocessed',
  'mic-camcorder',
  'mic-voice-recognition',
  'mic-voice-communication',
  'voice-call',
  'voice-call-uplink',
  'voice-call-downlink',
  'voice-performance',
] as const;
