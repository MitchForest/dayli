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
      resourceType: 'context' as const,
      startTime,
    };
    
    try {
      const userId = await getCurrentUserId();
      const factory = ServiceFactory.getInstance();
      const contextService = factory.getContextService();
      
      let clearedItems = [];
      
      // Clear based on scope
      switch (scope) {
        case 'conversation':
          await contextService.clearConversationContext(userId);
          clearedItems.push('Conversation history');
          break;
          
        case 'proposals':
          const proposalService = factory.getProposalService();
          const clearedCount = await proposalService.clearUserProposals(userId);
          clearedItems.push(`${clearedCount} pending proposals`);
          break;
          
        case 'workflow_state':
          const workflowService = factory.getWorkflowService();
          const workflowCount = await workflowService.clearInterruptedWorkflows(userId);
          clearedItems.push(`${workflowCount} workflow states`);
          break;
          
        case 'all':
          // Clear everything except patterns if preservePatterns is true
          await contextService.clearConversationContext(userId);
          const proposalCount = await factory.getProposalService().clearUserProposals(userId);
          const wfCount = await factory.getWorkflowService().clearInterruptedWorkflows(userId);
          
          clearedItems.push('Conversation history');
          clearedItems.push(`${proposalCount} pending proposals`);
          clearedItems.push(`${wfCount} workflow states`);
          
          if (!preservePatterns) {
            await factory.getPatternService().clearUserPatterns(userId);
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
          components: [
            {
              type: 'list',
              data: {
                title: 'Cleared Items',
                items: clearedItems.map(item => ({
                  label: item,
                  icon: 'check',
                  status: 'success',
                })),
              },
            },
            ...(preservePatterns ? [{
              type: 'info' as const,
              data: {
                message: 'Your learned patterns and preferences have been preserved',
                type: 'info',
              },
            }] : []),
          ],
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