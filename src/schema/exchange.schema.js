/**
 * Exchange Schema - User-Assistant conversation exchange
 *
 * Defines the structure for conversation exchanges, where each exchange contains:
 * - One or more user messages
 * - Zero or more thinking messages (AI reasoning)
 * - One or more assistant response messages
 *
 * Part of ADR-009: Hybrid Evidence Format
 * Provides runtime validation and TypeScript type inference via Zod
 */

import { z } from 'zod';
import { MessageSchema } from './message.schema.js';

/**
 * Exchange Schema
 *
 * Represents a complete user-assistant exchange with all messages
 *
 * Forensic requirements:
 * - exchange_index: Establishes exchange order in conversation
 * - container_id: DOM container ID for matching with raw HTML timestamps
 * - messages: Ordered array of all messages in this exchange
 *
 * Invariants enforced:
 * - exchange_index must be non-negative integer
 * - container_id must be non-empty string
 * - messages array cannot be empty (at minimum: user input + assistant response)
 * - message_index values within messages must be sequential starting from 0
 */
export const ExchangeSchema = z.object({
  exchange_index: z.number()
    .int()
    .nonnegative()
    .describe('Zero-based index of exchange within conversation'),

  container_id: z.string()
    .min(1, 'Container ID cannot be empty')
    .describe('DOM container ID from source platform (for timestamp matching with raw HTML)'),

  messages: z.array(MessageSchema)
    .min(1, 'Exchange must contain at least one message')
    .describe('Ordered array of messages in this exchange (user input, thinking, assistant response)')
}).superRefine((exchange, ctx) => {
  // Invariant: message_index values must be sequential starting from 0
  const messages = exchange.messages;

  for (let i = 0; i < messages.length; i++) {
    if (messages[i].message_index !== i) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Message at position ${i} has message_index ${messages[i].message_index}, expected ${i}. Message indices must be sequential starting from 0.`,
        path: ['messages', i, 'message_index']
      });
    }
  }

  // Forensic validation: At minimum, exchange should have user input and assistant response
  // (This is a soft warning - some exchanges might be incomplete during collection)
  const hasUserMessage = messages.some(m => m.message_type === 'user_input');
  const hasAssistantResponse = messages.some(m => m.message_type === 'assistant_response');

  if (!hasUserMessage) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Exchange should contain at least one user_input message',
      path: ['messages']
    });
  }

  if (!hasAssistantResponse) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Exchange should contain at least one assistant_response message',
      path: ['messages']
    });
  }
});

/**
 * TypeScript type inference
 * Use this type in your code for full type safety
 */
export type Exchange = z.infer<typeof ExchangeSchema>;

/**
 * Validation helper functions
 */
export const validateExchange = (data) => ExchangeSchema.parse(data);
export const validateExchangeSafe = (data) => ExchangeSchema.safeParse(data);
