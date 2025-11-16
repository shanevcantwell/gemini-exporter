/**
 * Message Schema - Foundation schema for conversation messages
 *
 * Defines the structure for individual messages within exchanges, including:
 * - User input messages
 * - Assistant response messages
 * - Thinking block messages (with structured thinking stages)
 *
 * Part of ADR-009: Hybrid Evidence Format
 * Provides runtime validation and TypeScript type inference via Zod
 */

import { z } from 'zod';

/**
 * Thinking Stage Schema
 *
 * Represents a single stage in AI reasoning/thinking process
 * Only present in messages with message_type: "thinking"
 */
export const ThinkingStageSchema = z.object({
  stage_name: z.string()
    .min(1, 'Stage name cannot be empty')
    .describe('Name of the thinking stage (e.g., "Understanding the Request")'),

  text: z.string()
    .min(1, 'Thinking stage text cannot be empty')
    .describe('Content of the thinking stage - the actual reasoning text')
});

/**
 * Message Type Enum
 *
 * Three types of messages in conversation exchanges:
 * - user_input: Message from user
 * - assistant_response: Final response from AI assistant
 * - thinking: AI reasoning process (may contain thinking_stages)
 */
export const MessageTypeSchema = z.enum([
  'user_input',
  'assistant_response',
  'thinking'
]);

/**
 * Speaker Enum
 *
 * Who produced this message
 * Platform-specific values (e.g., "Gemini", "Claude", "ChatGPT")
 */
export const SpeakerSchema = z.string()
  .min(1, 'Speaker cannot be empty');

/**
 * Complete Message Schema
 *
 * Forensic requirements:
 * - message_index: Establishes message order within exchange
 * - timestamp: If available from platform (ISO 8601 format or null)
 * - text: Message content (null for thinking-only messages)
 * - thinking_stages: Structured reasoning (null for non-thinking messages)
 *
 * Invariants:
 * - If message_type is "thinking", thinking_stages must be array (can be empty)
 * - If message_type is not "thinking", thinking_stages must be null
 * - If message_type is "thinking", text must be null
 * - If message_type is not "thinking", text must be string
 */
export const MessageSchema = z.object({
  message_index: z.number()
    .int()
    .nonnegative()
    .describe('Zero-based index of message within exchange'),

  speaker: SpeakerSchema
    .describe('Who produced this message (e.g., "User", "Gemini", "Claude")'),

  message_type: MessageTypeSchema
    .describe('Type of message: user_input, assistant_response, or thinking'),

  timestamp: z.string()
    .datetime()
    .nullable()
    .describe('ISO 8601 timestamp if available from platform, null otherwise'),

  text: z.string()
    .nullable()
    .describe('Message content text (null for thinking-only messages)'),

  thinking_stages: z.array(ThinkingStageSchema)
    .nullable()
    .describe('Array of thinking stages (only for thinking messages, null otherwise)')
}).superRefine((message, ctx) => {
  // Invariant: thinking messages must have thinking_stages array, others must have null
  if (message.message_type === 'thinking') {
    if (message.thinking_stages === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Thinking messages must have thinking_stages array (can be empty)',
        path: ['thinking_stages']
      });
    }
    if (message.text !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Thinking messages must have null text',
        path: ['text']
      });
    }
  } else {
    if (message.thinking_stages !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Non-thinking messages must have null thinking_stages',
        path: ['thinking_stages']
      });
    }
    if (typeof message.text !== 'string') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Non-thinking messages must have string text',
        path: ['text']
      });
    }
  }
});

/**
 * TypeScript type inference
 * Use these types in your code for full type safety
 */
export type ThinkingStage = z.infer<typeof ThinkingStageSchema>;
export type MessageType = z.infer<typeof MessageTypeSchema>;
export type Speaker = z.infer<typeof SpeakerSchema>;
export type Message = z.infer<typeof MessageSchema>;

/**
 * Validation helper functions
 */
export const validateMessage = (data) => MessageSchema.parse(data);
export const validateMessageSafe = (data) => MessageSchema.safeParse(data);
