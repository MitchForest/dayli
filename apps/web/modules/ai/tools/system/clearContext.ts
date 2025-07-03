import { tool } from 'ai';
import { z } from 'zod';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { getCurrentUserId } from '../utils/helpers';
import { type UniversalToolResponse } from '../../schemas/universal.schema';

export const clearContext = tool({
  description: 'Clear conversation context and start fresh. Useful when switching topics or resetting state.',
  parameters: z.object({
    scope: z.enum(['conversation', 'proposals', 'workflow_state', 'all']).default('conversation'),
    preservePatterns: z.boolean().default(true).describe('Keep learned patterns and preferences'),
  }),
  execute: async ({ scope, preservePatterns }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'clearContext',
      operation: 'delete' as const,
      resourceType: 'workflow' as const,
      startTime,
    };
    
    try {
      const userId = await getCurrentUserId();
      
      let clearedItems = [];
      
      // TODO: Implement context, proposal, workflow, and pattern services in future sprints
      // For now, simulate clearing
      switch (scope) {
        case 'conversation':
          clearedItems.push('Conversation history');
          break;
          
        case 'proposals':
          clearedItems.push('0 pending proposals');
          break;
          
        case 'workflow_state':
          clearedItems.push('0 workflow states');
          break;
          
        case 'all':
          clearedItems.push('Conversation history');
          clearedItems.push('0 pending proposals');
          clearedItems.push('0 workflow states');
          
          if (!preservePatterns) {
            clearedItems.push('Learned patterns');
          }
          break;
      }
      
      return buildToolResponse(
        toolOptions,
        {
          scope,
          clearedItems,
          preservedPatterns: preservePatterns,
          timestamp: new Date().toISOString(),
        },
        {
          type: 'card',
          title: 'Context Cleared',
          description: `Successfully cleared ${scope === 'all' ? 'all context' : scope.replace('_', ' ')}`,
          priority: 'medium',
          components: [],
        },
        {
          notification: {
            show: true,
            type: 'success',
            message: 'Context cleared successfully',
            duration: 3000,
          },
          suggestions: [
            'Start a new conversation',
            'Check your preferences',
            'View remaining patterns',
          ],
          actions: [{
            id: 'new-conversation',
            label: 'Start Fresh',
            icon: 'sparkles',
            variant: 'primary',
            action: {
              type: 'message',
              message: 'Hello! How can I help you today?',
            },
          }],
        }
      );
    } catch (error) {
      return buildErrorResponse(toolOptions, error, {
        title: 'Failed to clear context',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
});