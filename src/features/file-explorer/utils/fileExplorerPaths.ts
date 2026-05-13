export function isValidDevicePath(path: string | null): path is string {
  if (!path || typeof path !== 'string') {
    return false;
  }
  const trimmed = path.trim();
  if (!trimmed.startsWith('/')) {
    return false;
  }
  if (trimmed.includes('..')) {
    return false;
  }
  return true;
}
