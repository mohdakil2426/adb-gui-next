import type { ExtractionStatus } from '@/features/payload-dumper/model/payloadDumperStore';

/**
 * The Payload Dumper's four mutually-exclusive layouts, as data.
 *
 * They used to be a triple-nested ternary inside one `CardContent`, so the
 * empty and loaded states shared neither structure nor spacing and nothing
 * could assert which one was meant to be showing. Resolving the state here
 * makes the view a flat switch and makes the machine testable on its own.
 */
export type PayloadViewState =
  | { kind: 'source' }
  | { kind: 'loading-remote' }
  | { kind: 'loading-local' }
  | { kind: 'loaded' };

export interface PayloadViewInput {
  activeMode: 'local' | 'remote';
  partitionCount: number;
  payloadPath: string;
  remoteUrl: string;
  status: ExtractionStatus;
}

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

/** A payload is remote when the mode says so or the path is itself a URL. */
export function isRemoteSource(activeMode: 'local' | 'remote', payloadPath: string): boolean {
  return activeMode === 'remote' || isHttpUrl(payloadPath);
}

export function resolvePayloadViewState({
  activeMode,
  partitionCount,
  payloadPath,
  remoteUrl,
  status,
}: PayloadViewInput): PayloadViewState {
  if (!payloadPath) {
    return { kind: 'source' };
  }
  if (status !== 'loading-partitions' || partitionCount > 0) {
    return { kind: 'loaded' };
  }
  // The remote lister only sets `payloadPath` after it succeeds, so the URL has
  // to be recognised from the mode or from either of the two URL fields.
  const remote = activeMode === 'remote' || isHttpUrl(remoteUrl) || isHttpUrl(payloadPath);
  return remote ? { kind: 'loading-remote' } : { kind: 'loading-local' };
}
