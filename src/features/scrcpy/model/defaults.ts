import type { backend } from '@/desktop/models';

export const DEFAULT_SCRCPY_OPTIONS: backend.ScrcpyLaunchOptions = {
  alwaysOnTop: false,
  audioSource: null,
  borderless: false,
  fullscreen: false,
  keyboard: 'uhid',
  maxFps: null,
  maxSize: 1920,
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
