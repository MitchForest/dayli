import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type ProvideFeedbackResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';
import { getCurrentUserId } from '../utils/helpers';

export const provideFeedback = registerTool(
  createTool<typeof parameters, ProvideFeedbackResponse>({
    name: 'system_provideFeedback',
    description: 'Capture user feedback about AI performance, suggestions, or decisions',
    parameters: z.object({
      feedbackType: z.enum(['positive', 'negative', 'suggestion', 'bug']),
      category: z.enum(['workflow', 'tool', 'ui', 'accuracy', 'performance', 'other']),
      message: z.string().describe('Detailed feedback message'),
      context: z.object({
        toolName: z.string().optional(),
        workflowType: z.string().optional(),
        sessionId: z.string().optional(),
      }).optional(),
    }),
    metadata: {
      category: 'system',
      displayName: 'Provide Feedback',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ feedbackType, category, message, context }) => {
      const userId = await getCurrentUserId();
      
      // TODO: Implement feedback service in Sprint 4.4
      // For now, create a mock feedback object
      const feedback = {
        id: crypto.randomUUID(),
        userId,
        type: feedbackType,
        category,
        message,
        metadata: {
          ...context,
          timestamp: new Date().toISOString(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        },
        createdAt: new Date(),
      };
      
      console.log(`[Tool: provideFeedback] Received ${feedbackType} feedback for ${category}`);
      
      // Return pure data
      return {
        success: true,
        feedbackId: feedback.id,
        acknowledged: true,
      };
    },
  })
);

const parameters = z.object({
  feedbackType: z.enum(['positive', 'negative', 'suggestion', 'bug']),
  category: z.enum(['workflow', 'tool', 'ui', 'accuracy', 'performance', 'other']),
  message: z.string().describe('Detailed feedback message'),
  context: z.object({
    toolName: z.string().optional(),
    workflowType: z.string().optional(),
    sessionId: z.string().optional(),
  }).optional(),
});