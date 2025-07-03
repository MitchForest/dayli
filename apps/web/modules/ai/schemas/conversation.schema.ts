import { z } from 'zod';

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

// Type exports
export type ConversationResponse = z.infer<typeof conversationResponseSchema>; 