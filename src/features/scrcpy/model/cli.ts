import type { backend } from '@/desktop/models';

export function generateScrcpyCliCommand(
  options: backend.ScrcpyLaunchOptions,
  serial?: string | null,
): string {
  const args: string[] = ['scrcpy'];

  if (serial && serial.trim().length > 0) {
    args.push('-s', serial.trim());
  }
  if (options.maxSize && options.maxSize > 0) {
    args.push('-m', String(options.maxSize));
  }
  if (options.videoBitRate && options.videoBitRate.trim().length > 0) {
    args.push('-b', options.videoBitRate.trim());
  }
  if (options.maxFps && options.maxFps > 0) {
    args.push('--max-fps', String(options.maxFps));
  }
  if (options.videoCodec && options.videoCodec.trim().length > 0) {
    args.push(`--video-codec=${options.videoCodec.trim()}`);
  }
  if (options.noAudio) {
    args.push('--no-audio');
  }
  if (options.audioSource && options.audioSource.trim().length > 0) {
    args.push(`--audio-source=${options.audioSource.trim()}`);
  }
  if (options.stayAwake) {
    args.push('--stay-awake');
  }
  if (options.turnScreenOff) {
    args.push('--turn-screen-off');
  }
  if (options.showTouches) {
    args.push('--show-touches');
  }
  if (options.fullscreen) {
    args.push('--fullscreen');
  }
  if (options.alwaysOnTop) {
    args.push('--always-on-top');
  }
  if (options.borderless) {
    args.push('--window-borderless');
  }
  if (options.recordPath && options.recordPath.trim().length > 0) {
    args.push('--record', `"${options.recordPath.trim()}"`);
  }
  if (options.recordFormat && options.recordFormat.trim().length > 0) {
    args.push(`--record-format=${options.recordFormat.trim()}`);
  }
  if (options.keyboard && options.keyboard.trim().length > 0) {
    args.push(`--keyboard=${options.keyboard.trim()}`);
  }
  if (options.noControl) {
    args.push('--no-control');
  }

  return args.join(' ');
}

export function explainScrcpyFlags(
  options: backend.ScrcpyLaunchOptions,
  serial?: string | null,
): { description: string; flag: string }[] {
  const flags: { description: string; flag: string }[] = [];

  if (serial) {
    flags.push({ flag: `-s ${serial}`, description: `Target device: ${serial}` });
  }
  if (options.maxSize) {
    flags.push({
      flag: `-m ${options.maxSize}`,
      description: `Resolution limit: ${options.maxSize}px`,
    });
  }
  if (options.videoBitRate) {
    flags.push({
      flag: `-b ${options.videoBitRate}`,
      description: `Video bitrate: ${options.videoBitRate}`,
    });
  }
  if (options.maxFps) {
    flags.push({
      flag: `--max-fps ${options.maxFps}`,
      description: `Framerate cap: ${options.maxFps} FPS`,
    });
  }
  if (options.videoCodec) {
    flags.push({
      flag: `--video-codec=${options.videoCodec}`,
      description: `Codec: ${options.videoCodec.toUpperCase()}`,
    });
  }
  if (options.noAudio) {
    flags.push({ flag: '--no-audio', description: 'Disable audio forwarding' });
  }
  if (options.audioSource) {
    flags.push({
      flag: `--audio-source=${options.audioSource}`,
      description: `Audio source: ${options.audioSource}`,
    });
  }
  if (options.stayAwake) {
    flags.push({ flag: '--stay-awake', description: 'Prevent sleep during mirror' });
  }
  if (options.turnScreenOff) {
    flags.push({ flag: '--turn-screen-off', description: 'Turn physical screen off' });
  }
  if (options.showTouches) {
    flags.push({ flag: '--show-touches', description: 'Show touch dots' });
  }
  if (options.fullscreen) {
    flags.push({ flag: '--fullscreen', description: 'Start fullscreen' });
  }
  if (options.alwaysOnTop) {
    flags.push({ flag: '--always-on-top', description: 'Pin above all windows' });
  }
  if (options.borderless) {
    flags.push({ flag: '--window-borderless', description: 'Borderless window' });
  }
  if (options.recordPath) {
    flags.push({ flag: '--record ...', description: 'Record stream to disk' });
  }
  if (options.recordFormat) {
    flags.push({
      flag: `--record-format=${options.recordFormat}`,
      description: `Format: ${options.recordFormat.toUpperCase()}`,
    });
  }
  if (options.keyboard) {
    flags.push({
      flag: `--keyboard=${options.keyboard}`,
      description: `Keyboard mode: ${options.keyboard.toUpperCase()}`,
    });
  }
  if (options.noControl) {
    flags.push({ flag: '--no-control', description: 'View-only mode' });
  }

  return flags;
}
