/**
 * Forensic Evidence Schema Index
 *
 * Central export point for all evidence schemas
 * Part of ADR-009: Hybrid Evidence Format
 *
 * Usage:
 * ```javascript
 * // Import specific schemas
 * import { EvidenceSchema, validateEvidence } from './schema/index.js';
 *
 * // Import all schemas
 * import * as schemas from './schema/index.js';
 *
 * // Validate evidence file
 * try {
 *   const evidence = validateEvidence(data);
 *   console.log('Valid evidence:', evidence.evidence_id);
 * } catch (error) {
 *   console.error('Invalid evidence:', error.issues);
 * }
 * ```
 */

// === Root Evidence Schema ===
export {
  EvidenceSchema,
  PlatformSchema,
  FormatVersionSchema,
  EvidenceIdSchema,
  RawHTMLSchema,
  validateEvidence,
  validateEvidenceSafe,
  verifyEvidenceFile
} from './evidence.schema.js';

export type {
  Evidence,
  Platform,
  FormatVersion,
  EvidenceId,
  RawHTML
} from './evidence.schema.js';

// === Structured Data Schemas ===
export {
  StructuredDataSchema,
  DerivationSchema,
  validateStructuredData,
  validateStructuredDataSafe,
  validateDerivation,
  validateDerivationSafe
} from './structuredData.schema.js';

export type {
  StructuredData,
  Derivation
} from './structuredData.schema.js';

// === Exchange Schemas ===
export {
  ExchangeSchema,
  validateExchange,
  validateExchangeSafe
} from './exchange.schema.js';

export type {
  Exchange
} from './exchange.schema.js';

// === Message Schemas ===
export {
  MessageSchema,
  MessageTypeSchema,
  SpeakerSchema,
  ThinkingStageSchema,
  validateMessage,
  validateMessageSafe
} from './message.schema.js';

export type {
  Message,
  MessageType,
  Speaker,
  ThinkingStage
} from './message.schema.js';

// === Integrity Schemas ===
export {
  IntegritySchema,
  HashAlgorithmSchema,
  SHA256HashSchema,
  validateIntegrity,
  validateIntegritySafe,
  verifyHash,
  computeSHA256
} from './integrity.schema.js';

export type {
  Integrity,
  HashAlgorithm,
  SHA256Hash
} from './integrity.schema.js';

// === Chain of Custody Schemas ===
export {
  ChainOfCustodySchema,
  CollectionSchema,
  CollectorSchema,
  SourceSchema,
  EnvironmentSchema,
  ExtractionParametersSchema,
  StorageSchema,
  validateChainOfCustody,
  validateChainOfCustodySafe
} from './chainOfCustody.schema.js';

export type {
  ChainOfCustody,
  Collection,
  Collector,
  Source,
  Environment,
  ExtractionParameters,
  Storage
} from './chainOfCustody.schema.js';
