import type { TransformStep } from '../transform/transformation-engine';
import type { ChecksumAlgorithm, ChecksumParams } from '../checksum/checksum-engine';

export type Endianness = 'little' | 'big';
export type OffsetValue = string | number;

/* ------------------------------------------------------------------ */
/* Fingerprints                                                        */
/* ------------------------------------------------------------------ */

/**
 * Verifies a checksum embedded in the file against one freshly computed
 * over `dataRange`, using the same algorithms as the checksum-repair
 * engine. This is often a *stronger* fingerprint signal than a magic-byte
 * guess — a self-consistent checksum across a large data range is unlikely
 * to happen by chance — and it's honest: it doesn't require knowing an
 * unverified fixed byte sequence, just the (documented) algorithm.
 */
export interface ChecksumMatchRule {
  type: 'checksumMatch';
  algorithm: ChecksumAlgorithm;
  dataRange: { start: OffsetValue; end: OffsetValue };
  storedAt: OffsetValue;
  endianness?: Endianness;
  params?: ChecksumParams;
  weight?: number;
}

/**
 * Trial-decrypts a region using a declared algorithm/key and checks for an
 * expected byte pattern in the result — the only reliable way to fingerprint
 * a format that's encrypted-at-rest with no recognizable plaintext header
 * (e.g. "decrypt with this RC4 key; does it start with a known magic?").
 * aes-cbc/aes-ctr are supported here but note this makes fingerprint
 * evaluation asynchronous.
 */
export interface DecryptedBytesRule {
  type: 'decryptedBytes';
  algorithm: EncryptionAlgorithm;
  key: EncryptionKeySource;
  iv?: EncryptionKeySource;
  /** Region to decrypt for the check; defaults to the whole file. */
  range?: { start: OffsetValue; end: OffsetValue | 'eof' };
  /** Offset within the DECRYPTED region to check. */
  offset: OffsetValue;
  /** Space-separated hex bytes; "??" is a wildcard byte. */
  value: string;
  weight?: number;
}

export interface FileSizeRule {
  type: 'fileSize';
  value: number;
  tolerance?: number;
  weight?: number;
}

export interface BytesRule {
  type: 'bytes';
  offset: OffsetValue;
  /** Space-separated hex bytes; "??" is a wildcard byte, e.g. "45 58 ?? 4D". */
  value: string;
  weight?: number;
}

export interface StringRule {
  type: 'string';
  offset: OffsetValue;
  value: string;
  encoding?: 'ascii' | 'utf8';
  weight?: number;
}

export interface Sha256Rule {
  type: 'sha256';
  value: string;
  weight?: number;
}

export interface Sha1Rule {
  type: 'sha1';
  value: string;
  weight?: number;
}

export interface Crc32Rule {
  type: 'crc32';
  value: string;
  dataRange?: { start: OffsetValue; end: OffsetValue };
  weight?: number;
}

export interface AllOfRule {
  type: 'allOf';
  rules: FingerprintRule[];
  weight?: number;
}

export interface AnyOfRule {
  type: 'anyOf';
  rules: FingerprintRule[];
  weight?: number;
}

export type FingerprintRule =
  | FileSizeRule
  | BytesRule
  | StringRule
  | Sha256Rule
  | Sha1Rule
  | Crc32Rule
  | ChecksumMatchRule
  | DecryptedBytesRule
  | AllOfRule
  | AnyOfRule;

export interface FingerprintSet {
  /** Optional identifier, useful for debug/diagnostics (e.g. which variant matched). */
  id?: string;
  description?: string;
  /** All rules here must match (logical AND). Use `anyOf`/`allOf` rules for nested grouping. */
  rules: FingerprintRule[];
}

/* ------------------------------------------------------------------ */
/* Fields                                                               */
/* ------------------------------------------------------------------ */

export type FieldType =
  | 'uint8'
  | 'uint16'
  | 'uint32'
  | 'uint64'
  | 'int8'
  | 'int16'
  | 'int32'
  | 'int64'
  | 'float32'
  | 'float64'
  | 'boolean'
  | 'bitfield'
  | 'string'
  | 'hexBytes'
  | 'enum'
  | 'array'
  | 'struct';

export type JsonPrimitive = string | number | boolean;

export interface VisibleWhen {
  /** Field id, resolved relative to the same fields array (siblings, or top-level for nested fields). */
  field: string;
  equals?: JsonPrimitive;
  notEquals?: JsonPrimitive;
  in?: JsonPrimitive[];
}

export interface FieldSchemaBase {
  /** Unique within its containing fields[] array. */
  id: string;
  name: string;
  description?: string;
  type: FieldType;
  /** Offset relative to baseOffset (if any) and, for nested fields, relative to the parent struct/array element. */
  offset?: OffsetValue;
  /** Literal offset added before `offset`. */
  baseOffset?: OffsetValue;
  /** Name of an entry in the schema's top-level `baseOffsets` map, added before `offset`. */
  baseOffsetRef?: string;
  endianness?: Endianness;
  readOnly?: boolean;
  group?: string;
  order?: number;
  visibleWhen?: VisibleWhen;
  transform?: TransformStep[];
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: JsonPrimitive;

  /* boolean */
  bit?: number;

  /* bitfield */
  bitOffset?: number;
  bitLength?: number;

  /* string / hexBytes */
  length?: number;
  encoding?: 'ascii' | 'utf8' | 'utf16';
  stringMode?: 'fixed' | 'nullTerminated';

  /* enum */
  storageType?: 'uint8' | 'uint16' | 'uint32';
  values?: Record<string, string>;

  /* array */
  count?: number;
  stride?: OffsetValue;
  items?: FieldSchema;

  /* struct */
  fields?: FieldSchema[];

  /**
   * Search-based addressing — an alternative to `offset` for name-tagged
   * serialization formats (e.g. Unreal Engine's GVAS property lists) where
   * a field's position isn't fixed and must be located by searching for its
   * property name at read time. Mutually exclusive with `offset`: when
   * `searchPattern` is set, `offset` (and `baseOffset`/`baseOffsetRef`) are
   * ignored. If the pattern isn't found in a given file (e.g. optional/DLC
   * content), the field is simply omitted from that file's editable layout
   * rather than erroring.
   */
  searchPattern?: string;
  /** Optional second marker searched for within `searchValueTypeMaxDistance` bytes after the end of `searchPattern` (e.g. a serialized type tag like "Int64Property"). */
  searchValueType?: string;
  /** Max bytes to search forward for `searchValueType` after `searchPattern`. Default 64. */
  searchValueTypeMaxDistance?: number;
  /** Bytes from the start of the `searchValueType` match (or, if absent, the end of `searchPattern`) to the start of the actual value. */
  searchValueDelta?: number;
}

export type FieldSchema = FieldSchemaBase;

/* ------------------------------------------------------------------ */
/* Encryption                                                           */
/* ------------------------------------------------------------------ */

/**
 * Algorithms deliberately limited to what can be implemented correctly and
 * unambiguously: RC4/XOR are simple symmetric stream operations with no
 * padding concerns; aes-cbc/aes-ctr map directly onto the browser's native
 * Web Crypto SubtleCrypto algorithms. Raw/no-padding AES-ECB is NOT
 * supported — the Web Crypto API has no ECB mode, and implementing it
 * correctly on top of the CBC primitive is not reliable (SubtleCrypto
 * always applies/strips PKCS7 padding per call), so it's excluded rather
 * than shipped subtly broken.
 */
export type EncryptionAlgorithm = 'rc4' | 'xor' | 'aes-cbc' | 'aes-ctr';

export interface EncryptionKeySource {
  /** 'literal': a fixed key baked into the schema. 'fileRegion': the key/IV is itself stored in the save file (e.g. an embedded IV in an unencrypted header). */
  type: 'literal' | 'fileRegion';
  /** Space-separated hex bytes — required when type is 'literal'. */
  value?: string;
  /** Required when type is 'fileRegion': read from the ORIGINAL (undecrypted) file bytes. */
  offset?: OffsetValue;
  length?: number;
}

export interface EncryptionRegion {
  id: string;
  algorithm: EncryptionAlgorithm;
  /** Byte range within the ORIGINAL file that is encrypted. `end` may be the literal string "eof" for whole-file/tail encryption. */
  range: { start: OffsetValue; end: OffsetValue | 'eof' };
  key: EncryptionKeySource;
  /** Required for aes-cbc/aes-ctr; ignored for rc4/xor. */
  iv?: EncryptionKeySource;
  /** aes-ctr only: bit-length of the incrementing counter portion of the 16-byte counter block. Defaults to 64. */
  counterLength?: number;
}

/* ------------------------------------------------------------------ */
/* Checksums                                                            */
/* ------------------------------------------------------------------ */

export interface ChecksumDefinition {
  id: string;
  type: 'checksum';
  algorithm: ChecksumAlgorithm;
  dataRange: { start: OffsetValue; end: OffsetValue };
  writeOffset: OffsetValue;
  endianness?: Endianness;
  params?: ChecksumParams;
  description?: string;
}

/* ------------------------------------------------------------------ */
/* Schema                                                               */
/* ------------------------------------------------------------------ */

export interface SchemaGroup {
  id: string;
  name: string;
  order?: number;
  description?: string;
}

/**
 * A pointer to a standalone community editor (see /community-editors and
 * public/community-editors/NOTICE.md) instead of an inline, field-by-field
 * editable schema. Used for games supported by a bespoke third-party tool
 * this app doesn't (and, for some formats, realistically can't) model with
 * the generic field engine. A schema carrying this MUST have an empty
 * `fields` array — fingerprinting still runs normally, but a match is
 * surfaced as a "want to open the community editor?" prompt instead of the
 * field editor UI.
 */
export interface CommunityEditorLink {
  /** Matches the directory name under /community-editors/. */
  slug: string;
}

export interface SaveSchema {
  id: string;
  game: string;
  platform: string;
  region?: string;
  version?: string;
  author?: string;
  license?: string;
  description?: string;
  lastUpdated?: string;
  schemaVersion: number;

  fingerprints: FingerprintSet[];
  baseOffsets?: Record<string, OffsetValue>;
  groups?: SchemaGroup[];
  fields: FieldSchema[];
  checksums?: ChecksumDefinition[];
  /** Regions to decrypt before fields/checksums are read, and re-encrypt (in reverse order) on export. */
  encryption?: EncryptionRegion[];
  communityEditor?: CommunityEditorLink;
}

/* ------------------------------------------------------------------ */
/* Schema index (repository)                                           */
/* ------------------------------------------------------------------ */

export interface SchemaIndexEntry {
  id: string;
  path: string;
  game?: string;
  platform?: string;
}

export interface SchemaIndex {
  schemaVersion: number;
  updatedAt?: string;
  schemas: SchemaIndexEntry[];
}
