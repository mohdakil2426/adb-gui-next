export function formatTimestamp(ts: number | string | null): string {
  if (ts === null) {
    return 'N/A';
  }
  const num = typeof ts === 'string' ? Number.parseInt(ts, 10) : ts;
  if (isNaN(num) || num <= 0) {
    return 'N/A';
  }
  try {
    return new Date(num * 1000).toLocaleString(undefined, {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: '2-digit',
      timeZoneName: 'short',
      year: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

export function formatUpdateType(minorVersion: number | null): string {
  if (minorVersion === null) {
    return 'Unknown';
  }
  return minorVersion === 0 ? 'Full update' : `Delta (v${minorVersion})`;
}

export function sdkToAndroid(sdk: string): string {
  const map: Record<string, string> = {
    '21': '5.0',
    '22': '5.1',
    '23': '6.0',
    '24': '7.0',
    '25': '7.1',
    '26': '8.0',
    '27': '8.1',
    '28': '9',
    '29': '10',
    '30': '11',
    '31': '12',
    '32': '12L',
    '33': '13',
    '34': '14',
    '35': '15',
    '36': '16',
  };
  return map[sdk] ? `Android ${map[sdk]} (SDK ${sdk})` : `SDK ${sdk}`;
}
