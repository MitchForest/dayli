import { z } from 'zod';
import { universalToolResponseSchema } from './universal.schema';

// Pure conversation response
export const conversationResponseSchema = z.object({
  type: z.literal('conversation'),
  content: z.string(),
  tone: z.enum(['friendly', 'professional', 'casual', 'urgent']).default('friendly'),
  formatting: z.object({
    paragraphs: z.boolean().default(true),
    emphasis: z.array(z.object({
      text: z.string(),
      type: z.enum(['bold', 'italic', 'code']),
    })).optional(),
  }).optional(),
});

// Data response with multiple tool results
export const dataResponseSchema = z.object({
  type: z.literal('data'),
  responses: z.array(universalToolResponseSchema),
});

// Mixed response for conversation + data
export const mixedResponseSchema = z.object({
  type: z.literal('mixed'),
  conversation: conversationResponseSchema,
  data: z.array(universalToolResponseSchema),
  layout: z.enum(['conversation-first', 'data-first', 'interleaved']).default('conversation-first'),
});

// Master AI response type
export const aiResponseSchema = z.discriminatedUnion('type', [
  conversationResponseSchema,
  dataResponseSchema,
  mixedResponseSchema,
]);

// Type exports
export type ConversationResponse = z.infer<typeof conversationResponseSchema>;
export type DataResponse = z.infer<typeof dataResponseSchema>;
export type MixedResponse = z.infer<typeof mixedResponseSchema>;
export type AIResponse = z.infer<typeof aiResponseSchema>; 