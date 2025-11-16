/**
 * Chain of Custody Schema - Legal provenance for forensic evidence
 *
 * Defines complete chain of custody metadata required for legal admissibility
 * Part of ADR-003: Chain of Custody Metadata
 * Part of ADR-009: Hybrid Evidence Format
 *
 * Documents:
 * - WHO collected the evidence (tool, version, commit)
 * - WHAT was collected (platform, conversation, URL)
 * - WHEN it was collected (timestamp)
 * - WHERE it was collected from (source platform, environment)
 * - HOW it was collected (extraction parameters, strategy)
 * - WHERE it was stored initially (storage location)
 *
 * Provides runtime validation and TypeScript type inference via Zod
 */

import { z } from 'zod';

/**
 * Collector Metadata Schema
 *
 * Identifies the tool that collected the evidence
 * Critical for legal admissibility - establishes collection method
 */
export const CollectorSchema = z.object({
  tool: z.string()
    .min(1, 'Tool name cannot be empty')
    .describe('Name of collection tool (e.g., "forensic-conversation-exporter")'),

  version: z.string()
    .regex(/^\d+\.\d+\.\d+$/, 'Must be semantic version (e.g., "3.0.0")')
    .describe('Tool version (semantic versioning)'),

  source_url: z.string()
    .url('Must be valid URL')
    .describe('Source code repository URL (for code review and verification)'),

  commit_hash: z.string()
    .regex(/^[a-f0-9]{7,40}$/, 'Must be valid git commit hash')
    .describe('Git commit hash of tool version (for reproducibility)')
});

/**
 * Source Platform Metadata Schema
 *
 * Identifies where evidence was collected from
 */
export const SourceSchema = z.object({
  platform: z.string()
    .min(1, 'Platform cannot be empty')
    .describe('Source platform identifier (e.g., "gemini-2.5", "claude-3.5")'),

  url: z.string()
    .url('Must be valid URL')
    .describe('Full URL where evidence was collected'),

  conversation_id: z.string()
    .min(1, 'Conversation ID cannot be empty')
    .describe('Platform-specific conversation identifier'),

  conversation_title: z.string()
    .min(1, 'Conversation title cannot be empty')
    .describe('Conversation title from source platform')
});

/**
 * Environment Metadata Schema
 *
 * Documents the collection environment
 * Important for reproducibility and troubleshooting
 */
export const EnvironmentSchema = z.object({
  user_agent: z.string()
    .min(1, 'User agent cannot be empty')
    .describe('Browser user agent string'),

  browser: z.string()
    .min(1, 'Browser cannot be empty')
    .describe('Browser name and version (e.g., "Chrome 131.0.0.0")'),

  timezone: z.string()
    .min(1, 'Timezone cannot be empty')
    .describe('Timezone where collection occurred (e.g., "America/New_York")')
});

/**
 * Extraction Parameters Schema
 *
 * Documents HOW evidence was collected
 * Critical for understanding evidence completeness and reliability
 *
 * From ADR-008: Strategy Pattern for Thinking Block Expansion
 */
export const ExtractionParametersSchema = z.object({
  thinking_blocks_expanded: z.boolean()
    .describe('Whether thinking blocks were expanded before extraction'),

  expansion_strategy: z.string()
    .min(1, 'Expansion strategy cannot be empty')
    .describe('Strategy used to expand thinking blocks (e.g., "ButtonClick", "AlwaysVisible")'),

  expansion_count: z.number()
    .int()
    .nonnegative()
    .describe('Number of thinking blocks expanded (0 if none or already visible)'),

  lazy_load_complete: z.boolean()
    .describe('Whether all lazy-loaded content was fully loaded'),

  verification_passed: z.boolean()
    .describe('Whether post-extraction verification passed (ADR-007 invariants)')
});

/**
 * Collection Metadata Schema
 *
 * Complete metadata about the collection event
 */
export const CollectionSchema = z.object({
  timestamp: z.string()
    .datetime()
    .describe('ISO 8601 timestamp when collection started'),

  collector: CollectorSchema
    .describe('Tool that collected the evidence'),

  source: SourceSchema
    .describe('Platform where evidence was collected from'),

  environment: EnvironmentSchema
    .describe('Environment metadata (browser, timezone, etc.)'),

  extraction_parameters: ExtractionParametersSchema
    .describe('How evidence was collected (expansion strategy, verification, etc.)')
});

/**
 * Storage Metadata Schema
 *
 * Documents initial storage location and format
 */
export const StorageSchema = z.object({
  initial_location: z.string()
    .min(1, 'Initial location cannot be empty')
    .describe('Initial storage location/path (e.g., "~/Downloads/evidence/...")'),

  format: z.string()
    .regex(/^forensic-evidence-v\d+-\w+$/, 'Must match format pattern "forensic-evidence-vX-type"')
    .describe('Evidence file format version (e.g., "forensic-evidence-v3-hybrid")'),

  compression: z.enum(['none', 'gzip', 'brotli'])
    .describe('Compression applied to evidence file')
});

/**
 * Complete Chain of Custody Schema
 *
 * Legal provenance metadata for forensic evidence
 *
 * From ADR-003: This metadata establishes:
 * - Authenticity: Evidence came from stated source
 * - Completeness: All relevant content was collected
 * - Reliability: Collection method was sound
 * - Continuity: Unbroken chain from collection to analysis
 */
export const ChainOfCustodySchema = z.object({
  collection: CollectionSchema
    .describe('Complete collection metadata (who, what, when, where, how)'),

  storage: StorageSchema
    .describe('Initial storage metadata (location, format, compression)')
});

/**
 * TypeScript type inference
 * Use these types in your code for full type safety
 */
export type Collector = z.infer<typeof CollectorSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;
export type ExtractionParameters = z.infer<typeof ExtractionParametersSchema>;
export type Collection = z.infer<typeof CollectionSchema>;
export type Storage = z.infer<typeof StorageSchema>;
export type ChainOfCustody = z.infer<typeof ChainOfCustodySchema>;

/**
 * Validation helper functions
 */
export const validateChainOfCustody = (data) => ChainOfCustodySchema.parse(data);
export const validateChainOfCustodySafe = (data) => ChainOfCustodySchema.safeParse(data);
