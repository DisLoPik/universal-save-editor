// @ts-nocheck -- This file runs in the dedicated Worker global scope, which
// declares its own `self` (DedicatedWorkerGlobalScope). The rest of the app
// is type-checked against `lib: ["DOM", ...]`, and DOM + WebWorker libs
// declare conflicting `self` types when both are in play in one TS program.
// Rather than forcing a worker-flavored lib onto every other file, this one
// small, self-contained file opts out of type-checking; Vite/esbuild still
// compiles it normally at build and dev time regardless.

import { sha1Hex, sha256Hex } from '../core/hash/hash';
import { analyzeBuffer } from '../core/fingerprint/fingerprint-engine';

/**
 * Fingerprinting scans every loaded schema's byte patterns against the
 * file, which is real synchronous CPU work — running it here keeps the UI
 * thread free to render the loading state while large saves are analyzed.
 */

let loadedSchemas = [];

self.onmessage = async (event) => {
  const msg = event.data;

  if (msg.type === 'setSchemas') {
    loadedSchemas = msg.schemas;
    return;
  }

  if (msg.type === 'analyze') {
    const { requestId, buffer } = msg;
    try {
      const [sha256, sha1] = await Promise.all([sha256Hex(buffer), sha1Hex(buffer)]);
      const analysis = await analyzeBuffer(buffer, sha256, sha1, loadedSchemas);
      // Hand the buffer back (transferred, not copied) so the main thread regains ownership.
      self.postMessage({ type: 'analyzeResult', requestId, analysis, buffer }, [buffer]);
    } catch (e) {
      self.postMessage({
        type: 'analyzeError',
        requestId,
        message: e && e.message ? e.message : String(e),
      });
    }
  }
};
