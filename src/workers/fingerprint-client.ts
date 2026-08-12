import type { FingerprintAnalysis } from '../core/fingerprint/fingerprint-engine';
import type { SaveSchema } from '../core/schema/schema-types';

interface PendingRequest {
  resolve: (value: { analysis: FingerprintAnalysis; buffer: ArrayBuffer }) => void;
  reject: (reason: Error) => void;
}

/**
 * Thin client for fingerprint.worker.ts. Owns the worker instance and
 * correlates requests/responses by id so a stale response (e.g. the user
 * swapped files before the previous analysis finished) can't resolve the
 * wrong promise.
 */
export class FingerprintWorkerClient {
  private worker: Worker;
  private pending = new Map<string, PendingRequest>();
  private nextId = 0;

  constructor() {
    this.worker = new Worker(new URL('./fingerprint.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent) => {
      const msg = event.data as
        | { type: 'analyzeResult'; requestId: string; analysis: FingerprintAnalysis; buffer: ArrayBuffer }
        | { type: 'analyzeError'; requestId: string; message: string };
      const pending = this.pending.get(msg.requestId);
      if (!pending) return;
      this.pending.delete(msg.requestId);
      if (msg.type === 'analyzeResult') {
        pending.resolve({ analysis: msg.analysis, buffer: msg.buffer });
      } else {
        pending.reject(new Error(msg.message));
      }
    };
    this.worker.onerror = (event: ErrorEvent) => {
      for (const [, pending] of this.pending) {
        pending.reject(new Error(event.message || 'Fingerprint worker crashed'));
      }
      this.pending.clear();
    };
  }

  setSchemas(schemas: SaveSchema[]): void {
    this.worker.postMessage({ type: 'setSchemas', schemas });
  }

  /**
   * Transfers `buffer` to the worker (zero-copy) and gets it back
   * (transferred again, still zero-copy) once analysis completes.
   */
  analyze(buffer: ArrayBuffer): Promise<{ analysis: FingerprintAnalysis; buffer: ArrayBuffer }> {
    const requestId = String(this.nextId++);
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.worker.postMessage({ type: 'analyze', requestId, buffer }, [buffer]);
    });
  }

  terminate(): void {
    this.worker.terminate();
    this.pending.clear();
  }
}

let singleton: FingerprintWorkerClient | null = null;

/** Lazily creates one worker for the app's lifetime instead of spawning one per file. */
export function getFingerprintWorkerClient(): FingerprintWorkerClient {
  if (!singleton) singleton = new FingerprintWorkerClient();
  return singleton;
}
