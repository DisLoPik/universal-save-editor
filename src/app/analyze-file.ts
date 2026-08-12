import type { FingerprintAnalysis } from '../core/fingerprint/fingerprint-engine';
import { SaveSession } from '../core/session/save-session';
import type { SaveSchema } from '../core/schema/schema-types';
import { getFingerprintWorkerClient } from '../workers/fingerprint-client';

export interface AnalyzeFileResult {
  session: SaveSession | null;
  fileName: string;
  fileSize: number;
  analysis: FingerprintAnalysis;
}

/**
 * Full client-side pipeline: File -> ArrayBuffer -> (worker) fingerprint ->
 * schema match -> SaveSession. Nothing here ever touches the network with
 * the file's bytes.
 */
export async function analyzeFile(file: File, schemas: SaveSchema[]): Promise<AnalyzeFileResult> {
  const buffer = await file.arrayBuffer();
  const client = getFingerprintWorkerClient();
  client.setSchemas(schemas);
  const { analysis, buffer: returnedBuffer } = await client.analyze(buffer);

  let session: SaveSession | null = null;
  if (analysis.bestMatch) {
    session = await SaveSession.create({
      originalBuffer: returnedBuffer,
      fileName: file.name,
      sha256: analysis.sha256,
      sha1: analysis.sha1,
      schema: analysis.bestMatch.schema,
    });
  }

  return { session, fileName: file.name, fileSize: file.size, analysis };
}
