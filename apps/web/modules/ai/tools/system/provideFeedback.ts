import { tool } from 'ai';
import { z } from 'zod';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { getCurrentUserId } from '../utils/helpers';
import { type UniversalToolResponse } from '../../schemas/universal.schema';

export const provideFeedback = tool({
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
  execute: async ({ feedbackType, category, message, context }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'provideFeedback',
      operation: 'create' as const,
      resourceType: 'workflow' as const,
      startTime,
    };
    
    try {
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
      
      // Generate response based on feedback type
      let responseMessage = '';
      let suggestions = [];
      
      switch (feedbackType) {
        case 'positive':
          responseMessage = 'Thank you for your positive feedback! This helps us understand what\'s working well.';
          suggestions = ['Continue using the feature', 'Share more feedback'];
          break;
        case 'negative':
          responseMessage = 'Thank you for reporting this issue. We\'ll use this to improve the system.';
          suggestions = ['Try an alternative approach', 'Check for updates', 'Report another issue'];
          break;
        case 'suggestion':
          responseMessage = 'Great suggestion! We\'ll consider this for future improvements.';
          suggestions = ['Submit more ideas', 'View current features'];
          break;
        case 'bug':
          responseMessage = 'Bug report received. We\'ll investigate and fix this as soon as possible.';
          suggestions = ['Try a workaround', 'Check system status', 'Report another bug'];
          break;
      }
      
      return buildToolResponse(
        toolOptions,
        {
          feedbackId: feedback.id,
          type: feedbackType,
          category,
          acknowledged: true,
        },
        {
          type: 'card',
          title: 'Feedback Received',
          description: responseMessage,
          priority: 'medium',
          components: [],
        },
        {
          notification: {
            show: true,
            type: 'success',
            message: 'Thank you for your feedback!',
            duration: 3000,
          },
          suggestions,
          actions: feedbackType === 'bug' ? [{
            id: 'check-status',
            label: 'Check System Status',
            icon: 'info',
            variant: 'secondary',
            action: {
              type: 'message',
              message: 'Show system status',
            },
          }] : [],
        }
      );
    } catch (error) {
      return buildErrorResponse(toolOptions, error, {
        title: 'Failed to submit feedback',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
});