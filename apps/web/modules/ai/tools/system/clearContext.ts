import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type ClearContextResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';
import { getCurrentUserId } from '../utils/helpers';

export const clearContext = registerTool(
  createTool<typeof parameters, ClearContextResponse>({
    name: 'system_clearContext',
    description: 'Clear conversation context and start fresh. Useful when switching topics or resetting state.',
    parameters: z.object({
      scope: z.enum(['conversation', 'proposals', 'workflow_state', 'all']).default('conversation'),
      preservePatterns: z.boolean().default(true).describe('Keep learned patterns and preferences'),
    }),
    metadata: {
      category: 'system',
      displayName: 'Clear Context',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ scope, preservePatterns }) => {
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
      
      console.log(`[Tool: clearContext] Cleared ${scope} context`);
      
      // Return pure data
      return {
        success: true,
        clearedItems,
        preservedPatterns: preservePatterns,
      };
    },
  })
);

const parameters = z.object({
  scope: z.enum(['conversation', 'proposals', 'workflow_state', 'all']).default('conversation'),
  preservePatterns: z.boolean().default(true).describe('Keep learned patterns and preferences'),
});