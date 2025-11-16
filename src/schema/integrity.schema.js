/**
 * Integrity Schema - Cryptographic proof of evidence integrity
 *
 * Defines cryptographic integrity proofs for forensic evidence
 * Part of ADR-002: Cryptographic Integrity Proofs
 * Part of ADR-009: Hybrid Evidence Format
 *
 * Two layers of integrity proofs:
 * 1. Raw HTML hash - proves raw HTML hasn't been tampered with
 * 2. Structured JSON hash - proves structured data hasn't been tampered with
 *
 * Together, these allow verification that:
 * - Raw HTML is authentic (from collection time)
 * - Structured JSON is authentic (from collection time)
 * - Structured JSON was correctly derived from raw HTML (by re-parsing and comparing hashes)
 *
 * Provides runtime validation and TypeScript type inference via Zod
 */

import { z } from 'zod';

/**
 * Hash Algorithm Enum
 *
 * Currently only SHA-256 supported for forensic use
 * Other algorithms may be added in future (SHA-512, BLAKE3, etc.)
 */
export const HashAlgorithmSchema = z.enum(['SHA-256']);

/**
 * SHA-256 Hash String Schema
 *
 * Validates that hash string is:
 * - Exactly 64 hexadecimal characters
 * - Lowercase hex format
 *
 * SHA-256 produces 256 bits = 32 bytes = 64 hex characters
 */
export const SHA256HashSchema = z.string()
  .length(64, 'SHA-256 hash must be exactly 64 characters')
  .regex(/^[a-f0-9]{64}$/, 'SHA-256 hash must be lowercase hexadecimal')
  .describe('SHA-256 hash as 64-character lowercase hex string');

/**
 * Integrity Proof Schema
 *
 * Complete cryptographic integrity metadata for evidence file
 *
 * Forensic requirements (ADR-002):
 * - sha256_raw_html: Hash of raw HTML (forensic layer)
 * - sha256_structured_json: Hash of structured data (analysis layer)
 * - algorithm: Hash algorithm used (SHA-256)
 * - computed_at: ISO 8601 timestamp when hashes were computed
 *
 * Verification workflow:
 * 1. Re-hash raw_html field → compare to sha256_raw_html
 * 2. Re-hash structured_data field → compare to sha256_structured_json
 * 3. If both match → evidence is authentic and untampered
 * 4. If mismatch → evidence has been tampered with (reject)
 *
 * Chain of custody:
 * - computed_at establishes when hashes were generated
 * - Must be during or immediately after collection
 * - Any modification after computed_at breaks chain of custody
 */
export const IntegritySchema = z.object({
  sha256_raw_html: SHA256HashSchema
    .describe('SHA-256 hash of raw_html field (forensic layer)'),

  sha256_structured_json: SHA256HashSchema
    .describe('SHA-256 hash of structured_data.exchanges field (analysis layer)'),

  algorithm: HashAlgorithmSchema
    .describe('Hash algorithm used (currently only SHA-256 supported)'),

  computed_at: z.string()
    .datetime()
    .describe('ISO 8601 timestamp when hashes were computed')
});

/**
 * TypeScript type inference
 * Use these types in your code for full type safety
 */
export type HashAlgorithm = z.infer<typeof HashAlgorithmSchema>;
export type SHA256Hash = z.infer<typeof SHA256HashSchema>;
export type Integrity = z.infer<typeof IntegritySchema>;

/**
 * Validation helper functions
 */
export const validateIntegrity = (data) => IntegritySchema.parse(data);
export const validateIntegritySafe = (data) => IntegritySchema.safeParse(data);

/**
 * Hash verification helper
 *
 * Verifies that computed hash matches stored hash
 * Used by downstream forensic verification tools
 *
 * @param computedHash - Freshly computed hash
 * @param storedHash - Hash from integrity object
 * @returns true if hashes match (evidence is authentic)
 */
export const verifyHash = (computedHash, storedHash) => {
  return computedHash.toLowerCase() === storedHash.toLowerCase();
};

/**
 * Compute SHA-256 hash (browser environment)
 *
 * @param data - String data to hash
 * @returns Promise<string> - SHA-256 hash as lowercase hex string
 */
export const computeSHA256 = async (data) => {
  // Convert string to Uint8Array
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  // Compute SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
};
