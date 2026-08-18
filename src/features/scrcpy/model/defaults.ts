import type { backend } from '@/desktop/models';

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
  { label: '16 Mbps (16M - High quality)', value: '16M' },
  { label: '32 Mbps (32M - Ultra quality)', value: '32M' },
  { label: '64 Mbps (64M - Lossless/Local)', value: '64M' },
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
