/**
 * Evidence Schema - Root schema for forensic evidence files
 *
 * Defines the complete structure for forensic evidence collection
 * Combines all sub-schemas into unified evidence format
 *
 * Part of ADR-009: Hybrid Evidence Format
 * Reconciles:
 * - ADR-001: Raw HTML Preservation (forensic layer)
 * - ADR-002: Cryptographic Integrity Proofs
 * - ADR-003: Chain of Custody Metadata
 * - JSON ADR v2.0: Structured JSON Export (analysis layer)
 *
 * This is the SINGLE FILE FORMAT that prevents dissociation of:
 * - Raw HTML (primary source for verification)
 * - Structured JSON (parsed data for analysis)
 * - Integrity proofs (cryptographic hashes)
 * - Chain of custody (legal provenance)
 *
 * Provides runtime validation and TypeScript type inference via Zod
 */

import { z } from 'zod';
import { StructuredDataSchema } from './structuredData.schema.js';
import { IntegritySchema } from './integrity.schema.js';
import { ChainOfCustodySchema } from './chainOfCustody.schema.js';

/**
 * Platform Information Schema
 *
 * Identifies the source platform and adapter versions
 */
export const PlatformSchema = z.object({
  name: z.string()
    .min(1, 'Platform name cannot be empty')
    .describe('Platform identifier (e.g., "gemini", "claude", "chatgpt")'),

  version: z.string()
    .min(1, 'Platform version cannot be empty')
    .describe('Platform version at time of collection (e.g., "2.5")'),

  adapter_version: z.string()
    .regex(/^\d+\.\d+\.\d+$/, 'Must be semantic version (e.g., "3.0.0")')
    .describe('Platform adapter version used for extraction')
});

/**
 * Format Version Schema
 *
 * Semantic versioning for evidence format
 * Format: "major.minor-type"
 *
 * Current version: "3.0-hybrid"
 * - Version 3.0: Major revision with hybrid format
 * - Type "hybrid": Contains both raw HTML and structured JSON
 */
export const FormatVersionSchema = z.string()
  .regex(/^\d+\.\d+-\w+$/, 'Must match format "X.Y-type" (e.g., "3.0-hybrid")')
  .describe('Evidence format version (semantic versioning with type suffix)');

/**
 * Evidence ID Schema
 *
 * UUID v4 for unique evidence identification
 * Generated at collection time, immutable
 */
export const EvidenceIdSchema = z.string()
  .uuid('Must be valid UUID v4')
  .describe('Unique evidence identifier (UUID v4)');

/**
 * Raw HTML Schema
 *
 * Complete raw HTML from source platform
 * This is the forensic layer - primary source for verification
 *
 * From ADR-001: Raw HTML with zero transformation
 * - Extracted after all expansions (thinking blocks, lazy load)
 * - Complete <main> element outerHTML
 * - No cleaning, no normalization, no modification
 */
export const RawHTMLSchema = z.string()
  .min(1, 'Raw HTML cannot be empty')
  .describe('Complete raw HTML from source platform (forensic layer)');

/**
 * Complete Evidence Schema
 *
 * Root schema for forensic evidence files (ADR-009)
 *
 * File structure:
 * 1. Metadata: evidence_id, format_version, platform, exported_at
 * 2. Forensic layer: raw_html (primary source)
 * 3. Analysis layer: structured_data (parsed exchanges/messages)
 * 4. Integrity proofs: SHA-256 hashes of both layers
 * 5. Chain of custody: Complete provenance metadata
 *
 * Invariants enforced:
 * - format_version must be "3.0-hybrid" (current version)
 * - raw_html cannot be empty (forensic requirement)
 * - structured_data must be valid (analysis requirement)
 * - integrity hashes must be valid SHA-256 (64 hex chars)
 * - chain_of_custody must be complete (legal requirement)
 * - exported_at must be valid ISO 8601 timestamp
 *
 * File naming convention (from questions.md Q8):
 * {platform}_{conversation_id}_{timestamp}.json
 *
 * Example:
 * gemini_c_abc123def456_20250111_142345.json
 */
export const EvidenceSchema = z.object({
  // === Metadata ===
  evidence_id: EvidenceIdSchema
    .describe('Unique evidence identifier (UUID v4)'),

  format_version: FormatVersionSchema
    .describe('Evidence format version (currently "3.0-hybrid")'),

  platform: PlatformSchema
    .describe('Source platform and adapter information'),

  exported_at: z.string()
    .datetime()
    .describe('ISO 8601 timestamp when evidence was exported'),

  // === Forensic Layer (Verification) ===
  raw_html: RawHTMLSchema
    .describe('Complete raw HTML from source platform (forensic layer)'),

  // === Analysis Layer (Consumption) ===
  structured_data: StructuredDataSchema
    .describe('Parsed conversation data (analysis layer)'),

  // === Integrity Proofs ===
  integrity: IntegritySchema
    .describe('Cryptographic integrity proofs (SHA-256 hashes)'),

  // === Chain of Custody ===
  chain_of_custody: ChainOfCustodySchema
    .describe('Complete provenance metadata (legal chain of custody)')
}).superRefine((evidence, ctx) => {
  // Invariant 1: Format version must be 3.0-hybrid (current version)
  if (!evidence.format_version.startsWith('3.0-')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Evidence format version must be 3.0-hybrid (current version)',
      path: ['format_version']
    });
  }

  // Invariant 2: conversation_id must match between structured_data and chain_of_custody
  const structuredConvId = evidence.structured_data.conversation_id;
  const custodyConvId = evidence.chain_of_custody.collection.source.conversation_id;

  if (structuredConvId !== custodyConvId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Conversation ID mismatch: structured_data has "${structuredConvId}", chain_of_custody has "${custodyConvId}"`,
      path: ['structured_data', 'conversation_id']
    });
  }

  // Invariant 3: exported_at should be close to integrity.computed_at
  // (within 5 seconds - allows for computation time)
  const exportedTime = new Date(evidence.exported_at).getTime();
  const computedTime = new Date(evidence.integrity.computed_at).getTime();
  const timeDiffMs = Math.abs(exportedTime - computedTime);

  if (timeDiffMs > 5000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Suspicious time difference between exported_at and integrity.computed_at: ${timeDiffMs}ms (should be < 5000ms)`,
      path: ['integrity', 'computed_at']
    });
  }
});

/**
 * TypeScript type inference
 * Use these types in your code for full type safety
 */
export type Platform = z.infer<typeof PlatformSchema>;
export type FormatVersion = z.infer<typeof FormatVersionSchema>;
export type EvidenceId = z.infer<typeof EvidenceIdSchema>;
export type RawHTML = z.infer<typeof RawHTMLSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;

/**
 * Validation helper functions
 */
export const validateEvidence = (data) => EvidenceSchema.parse(data);
export const validateEvidenceSafe = (data) => EvidenceSchema.safeParse(data);

/**
 * Evidence file verification workflow
 *
 * Complete verification process for forensic evidence:
 * 1. Validate schema (this file)
 * 2. Verify raw HTML hash
 * 3. Verify structured JSON hash
 * 4. Re-parse raw HTML and compare to structured_data (optional deep verification)
 *
 * @param evidenceFile - Evidence object to verify
 * @returns Verification result with detailed status
 */
export const verifyEvidenceFile = async (evidenceFile) => {
  // Step 1: Schema validation
  const schemaResult = EvidenceSchema.safeParse(evidenceFile);
  if (!schemaResult.success) {
    return {
      valid: false,
      error: 'Schema validation failed',
      details: schemaResult.error.issues
    };
  }

  // Step 2: Verify raw HTML hash
  const { computeSHA256 } = await import('./integrity.schema.js');
  const rawHTMLHash = await computeSHA256(evidenceFile.raw_html);

  if (rawHTMLHash !== evidenceFile.integrity.sha256_raw_html) {
    return {
      valid: false,
      error: 'Raw HTML hash mismatch - evidence may be tampered',
      expected: evidenceFile.integrity.sha256_raw_html,
      computed: rawHTMLHash
    };
  }

  // Step 3: Verify structured JSON hash
  const structuredJSONString = JSON.stringify(evidenceFile.structured_data.exchanges);
  const structuredJSONHash = await computeSHA256(structuredJSONString);

  if (structuredJSONHash !== evidenceFile.integrity.sha256_structured_json) {
    return {
      valid: false,
      error: 'Structured JSON hash mismatch - evidence may be tampered',
      expected: evidenceFile.integrity.sha256_structured_json,
      computed: structuredJSONHash
    };
  }

  // All checks passed
  return {
    valid: true,
    evidence_id: evidenceFile.evidence_id,
    format_version: evidenceFile.format_version,
    verified_at: new Date().toISOString()
  };
};
