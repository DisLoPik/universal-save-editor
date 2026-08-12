import { BinaryReader } from '../binary/binary-reader';
import { parseOffset } from '../binary/offsets';
import { computeChecksum } from '../checksum/checksum-engine';
import { trialDecryptRegion } from '../encryption/encryption-engine';
import type { EncryptionRegion, FingerprintRule, FingerprintSet, SaveSchema } from '../schema/schema-types';

/**
 * Confidence model: every matched rule contributes a weight (an exact hash
 * match essentially proves identity; a bare file-size match proves very
 * little on its own). All top-level rules in a FingerprintSet are AND'd —
 * if any fails, the whole set contributes nothing. Scores from matched
 * rules are summed and capped at 100. The engine never "guesses": a schema
 * only counts as matched if at least one of its fingerprint sets fully
 * matched, and the final identification is only accepted if the winning
 * score clears MATCH_CONFIDENCE_THRESHOLD and isn't tied with a rival.
 *
 * Evaluation is async: `decryptedBytes` rules (trial-decrypt, then check for
 * a magic value — the only reliable way to fingerprint a format that's
 * encrypted-at-rest with no recognizable plaintext header) can involve
 * Web Crypto, which is promise-based.
 */
export const MATCH_CONFIDENCE_THRESHOLD = 50;

const DEFAULT_WEIGHTS: Record<FingerprintRule['type'], number> = {
  fileSize: 10,
  bytes: 30,
  string: 25,
  sha256: 100,
  sha1: 90,
  crc32: 60,
  checksumMatch: 50,
  decryptedBytes: 70,
  allOf: 0,
  anyOf: 0,
};

export interface FingerprintContext {
  buffer: ArrayBuffer;
  reader: BinaryReader;
  fileSize: number;
  sha256: string;
  sha1: string;
}

interface RuleResult {
  matched: boolean;
  score: number;
}

function parseBytePattern(pattern: string): Array<number | null> {
  return pattern
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => (token === '??' ? null : parseInt(token, 16)));
}

function matchBytePattern(reader: BinaryReader, offset: number, pattern: Array<number | null>): boolean {
  if (!reader.inBounds(offset, pattern.length)) return false;
  for (let i = 0; i < pattern.length; i++) {
    const expected = pattern[i];
    if (expected === null) continue;
    if (reader.uint8(offset + i) !== expected) return false;
  }
  return true;
}

async function evaluateRule(rule: FingerprintRule, ctx: FingerprintContext): Promise<RuleResult> {
  try {
    switch (rule.type) {
      case 'fileSize': {
        const tolerance = rule.tolerance ?? 0;
        const matched = Math.abs(ctx.fileSize - rule.value) <= tolerance;
        return { matched, score: matched ? rule.weight ?? DEFAULT_WEIGHTS.fileSize : 0 };
      }
      case 'bytes': {
        const offset = parseOffset(rule.offset);
        const pattern = parseBytePattern(rule.value);
        const matched = matchBytePattern(ctx.reader, offset, pattern);
        return { matched, score: matched ? rule.weight ?? DEFAULT_WEIGHTS.bytes : 0 };
      }
      case 'string': {
        const offset = parseOffset(rule.offset);
        const encoding = rule.encoding ?? 'ascii';
        const byteLength = encoding === 'utf8' ? new TextEncoder().encode(rule.value).length : rule.value.length;
        if (!ctx.reader.inBounds(offset, byteLength)) return { matched: false, score: 0 };
        const actual = encoding === 'utf8' ? ctx.reader.utf8String(offset, byteLength) : ctx.reader.asciiString(offset, byteLength);
        const matched = actual === rule.value;
        return { matched, score: matched ? rule.weight ?? DEFAULT_WEIGHTS.string : 0 };
      }
      case 'sha256': {
        const matched = ctx.sha256.toLowerCase() === rule.value.toLowerCase();
        return { matched, score: matched ? rule.weight ?? DEFAULT_WEIGHTS.sha256 : 0 };
      }
      case 'sha1': {
        const matched = ctx.sha1.toLowerCase() === rule.value.toLowerCase();
        return { matched, score: matched ? rule.weight ?? DEFAULT_WEIGHTS.sha1 : 0 };
      }
      case 'crc32': {
        const start = rule.dataRange ? parseOffset(rule.dataRange.start) : 0;
        const end = rule.dataRange ? parseOffset(rule.dataRange.end) : ctx.fileSize;
        if (!ctx.reader.inBounds(start, end - start)) return { matched: false, score: 0 };
        const data = ctx.reader.bytes(start, end - start);
        const computed = computeChecksum('crc32', data).toString(16).padStart(8, '0');
        const expected = rule.value.replace(/^0x/i, '').toLowerCase().padStart(8, '0');
        const matched = computed === expected;
        return { matched, score: matched ? rule.weight ?? DEFAULT_WEIGHTS.crc32 : 0 };
      }
      case 'checksumMatch': {
        const start = parseOffset(rule.dataRange.start);
        const end = parseOffset(rule.dataRange.end);
        const storedAt = parseOffset(rule.storedAt);
        if (!ctx.reader.inBounds(start, end - start)) return { matched: false, score: 0 };
        const data = ctx.reader.bytes(start, end - start);
        const computed = computeChecksum(rule.algorithm, data, rule.params);
        const little = (rule.endianness ?? 'little') === 'little';
        let stored: number;
        if (!ctx.reader.inBounds(storedAt, 4)) return { matched: false, score: 0 };
        switch (rule.algorithm) {
          case 'crc8':
          case 'sum8':
          case 'xor8':
            stored = ctx.reader.uint8(storedAt);
            break;
          case 'crc16':
          case 'sum16':
            stored = ctx.reader.uint16(storedAt, little);
            break;
          default:
            stored = ctx.reader.uint32(storedAt, little);
            break;
        }
        const matched = stored === computed;
        return { matched, score: matched ? rule.weight ?? DEFAULT_WEIGHTS.checksumMatch : 0 };
      }
      case 'decryptedBytes': {
        const range = rule.range ?? { start: 0, end: 'eof' as const };
        const region: EncryptionRegion = { id: '__fingerprint__', algorithm: rule.algorithm, range, key: rule.key, iv: rule.iv };
        const decrypted = await trialDecryptRegion(region, ctx.buffer);
        const offset = parseOffset(rule.offset);
        const pattern = parseBytePattern(rule.value);
        const decryptedReader = new BinaryReader(decrypted.buffer, decrypted.byteOffset, decrypted.byteLength);
        const matched = matchBytePattern(decryptedReader, offset, pattern);
        return { matched, score: matched ? rule.weight ?? DEFAULT_WEIGHTS.decryptedBytes : 0 };
      }
      case 'allOf': {
        let sum = 0;
        for (const sub of rule.rules) {
          const r = await evaluateRule(sub, ctx);
          if (!r.matched) return { matched: false, score: 0 };
          sum += r.score;
        }
        return { matched: true, score: rule.weight ?? sum };
      }
      case 'anyOf': {
        let best = 0;
        let any = false;
        for (const sub of rule.rules) {
          const r = await evaluateRule(sub, ctx);
          if (r.matched) {
            any = true;
            best = Math.max(best, r.score);
          }
        }
        return { matched: any, score: any ? rule.weight ?? best : 0 };
      }
      default:
        return { matched: false, score: 0 };
    }
  } catch {
    // Malformed/adversarial schema data, or a decrypt failure, must never crash fingerprinting — treat as a non-match.
    return { matched: false, score: 0 };
  }
}

/** Returns null if any top-level rule fails (the set's AND requirement isn't met). */
export async function evaluateFingerprintSet(set: FingerprintSet, ctx: FingerprintContext): Promise<number | null> {
  let total = 0;
  for (const rule of set.rules) {
    const result = await evaluateRule(rule, ctx);
    if (!result.matched) return null;
    total += result.score;
  }
  return Math.min(100, total);
}

export interface FingerprintMatchResult {
  schema: SaveSchema;
  score: number;
  matchedSetId?: string;
}

export interface FingerprintAnalysis {
  /** The accepted, confident match — null if nothing cleared the confidence threshold or the top matches tied. */
  bestMatch: FingerprintMatchResult | null;
  /** Every schema that matched at least one fingerprint set, sorted by score descending, for diagnostics. */
  allMatches: FingerprintMatchResult[];
  ambiguous: boolean;
  fileSize: number;
  sha256: string;
  sha1: string;
}

export async function analyzeBuffer(
  buffer: ArrayBuffer,
  sha256: string,
  sha1: string,
  schemas: SaveSchema[],
): Promise<FingerprintAnalysis> {
  const reader = new BinaryReader(buffer);
  const ctx: FingerprintContext = { buffer, reader, fileSize: buffer.byteLength, sha256, sha1 };

  const results: FingerprintMatchResult[] = [];
  for (const schema of schemas) {
    let bestScore = 0;
    let bestSetId: string | undefined;
    for (const set of schema.fingerprints) {
      const score = await evaluateFingerprintSet(set, ctx);
      if (score !== null && score > bestScore) {
        bestScore = score;
        bestSetId = set.id;
      }
    }
    if (bestScore > 0) {
      results.push({ schema, score: bestScore, matchedSetId: bestSetId });
    }
  }

  results.sort((a, b) => b.score - a.score);
  const top = results[0] ?? null;
  const ambiguous = results.length > 1 && results[0].score === results[1].score;
  const bestMatch = top && top.score >= MATCH_CONFIDENCE_THRESHOLD && !ambiguous ? top : null;

  return { bestMatch, allMatches: results, ambiguous, fileSize: buffer.byteLength, sha256, sha1 };
}
