/**
 * Structured Data Schema - Analysis layer for forensic evidence
 *
 * Defines the structured/parsed representation of conversation data
 * This is the "analysis layer" from ADR-009 Hybrid Evidence Format
 *
 * The exporter extracts raw HTML AND parses it into this structured format
 * Downstream tools consume this structured data, never parsing raw HTML
 *
 * Part of ADR-009: Hybrid Evidence Format
 * Provides runtime validation and TypeScript type inference via Zod
 */

import { z } from 'zod';
import { ExchangeSchema } from './exchange.schema.js';

/**
 * Derivation Metadata Schema
 *
 * Documents how structured data was derived from raw HTML
 * Critical for forensic chain of custody - proves structured data
 * was correctly parsed from raw HTML source
 */
export const DerivationSchema = z.object({
  parsed_from: z.literal('raw_html')
    .describe('Source of structured data - always "raw_html"'),

  parser_version: z.string()
    .regex(/^\d+\.\d+\.\d+$/, 'Must be semantic version (e.g., "3.0.0")')
    .describe('Version of parser that generated this structured data'),

  parsed_at: z.string()
    .datetime()
    .describe('ISO 8601 timestamp when parsing occurred'),

  parsing_duration_ms: z.number()
    .int()
    .nonnegative()
    .optional()
    .describe('Optional: How long parsing took in milliseconds')
});

/**
 * Structured Data Schema
 *
 * Complete parsed conversation data for analysis
 *
 * Forensic requirements:
 * - conversation_id: Must match source platform conversation ID
 * - title: Conversation title from source platform
 * - url: Source URL where evidence was collected
 * - exchange_count: Must match exchanges.length (invariant enforced)
 * - message_count: Total messages across all exchanges (invariant enforced)
 * - exchanges: All parsed exchanges with messages
 * - derivation: Proof of how this was derived from raw HTML
 */
export const StructuredDataSchema = z.object({
  conversation_id: z.string()
    .min(1, 'Conversation ID cannot be empty')
    .describe('Platform-specific conversation identifier (e.g., "c_abc123def456")'),

  title: z.string()
    .min(1, 'Conversation title cannot be empty')
    .describe('Conversation title from source platform'),

  url: z.string()
    .url('Must be valid URL')
    .describe('Full URL where evidence was collected'),

  exchange_count: z.number()
    .int()
    .nonnegative()
    .describe('Total number of exchanges in conversation (must match exchanges.length)'),

  message_count: z.number()
    .int()
    .nonnegative()
    .describe('Total number of messages across all exchanges (includes thinking blocks)'),

  exchanges: z.array(ExchangeSchema)
    .min(1, 'Conversation must contain at least one exchange')
    .describe('Ordered array of all exchanges in conversation'),

  derivation: DerivationSchema
    .describe('Metadata documenting derivation from raw HTML source')
}).superRefine((data, ctx) => {
  // Invariant 1: exchange_count must match actual exchanges array length
  if (data.exchange_count !== data.exchanges.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `exchange_count (${data.exchange_count}) does not match exchanges array length (${data.exchanges.length})`,
      path: ['exchange_count']
    });
  }

  // Invariant 2: message_count must match total messages across all exchanges
  const actualMessageCount = data.exchanges.reduce(
    (total, exchange) => total + exchange.messages.length,
    0
  );

  if (data.message_count !== actualMessageCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `message_count (${data.message_count}) does not match actual message count (${actualMessageCount})`,
      path: ['message_count']
    });
  }

  // Invariant 3: exchange_index values must be sequential starting from 0
  for (let i = 0; i < data.exchanges.length; i++) {
    if (data.exchanges[i].exchange_index !== i) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Exchange at position ${i} has exchange_index ${data.exchanges[i].exchange_index}, expected ${i}. Exchange indices must be sequential starting from 0.`,
        path: ['exchanges', i, 'exchange_index']
      });
    }
  }
});

/**
 * TypeScript type inference
 * Use these types in your code for full type safety
 */
export type Derivation = z.infer<typeof DerivationSchema>;
export type StructuredData = z.infer<typeof StructuredDataSchema>;

/**
 * Validation helper functions
 */
export const validateDerivation = (data) => DerivationSchema.parse(data);
export const validateDerivationSafe = (data) => DerivationSchema.safeParse(data);
export const validateStructuredData = (data) => StructuredDataSchema.parse(data);
export const validateStructuredDataSafe = (data) => StructuredDataSchema.safeParse(data);
