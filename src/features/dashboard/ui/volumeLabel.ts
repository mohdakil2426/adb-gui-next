const MEDIA_RW_PREFIX = '/mnt/media_rw/';

/**
 * Human label for a queried mount path. `mount` is the path *we* asked `df`
 * about (see `parse_df` in the Rust backend) — authoritative, unlike `df`'s
 * own "Mounted on" text (`rawMount`), which is never used to identify a
 * volume, only shown as secondary/diagnostic text.
 */
export function volumeLabel(mount: string): string {
  if (mount === '/data') {
    return 'Internal storage';
  }
  if (mount === '/storage/emulated' || mount === '/sdcard') {
    return 'Shared storage';
  }
  if (mount.startsWith(MEDIA_RW_PREFIX)) {
    return 'SD card';
  }
  return mount;
}
