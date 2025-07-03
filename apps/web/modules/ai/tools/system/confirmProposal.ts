import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { proposalStore } from '../../utils/proposal-store';

export const confirmProposal = tool({
  description: 'Execute a stored proposal after user confirmation',
  parameters: z.object({
    proposalId: z.string().describe('The ID of the proposal to execute'),
    userConfirmed: z.boolean().describe('Whether the user has confirmed the action'),
    selectedOption: z.string().optional().describe('For choice proposals, the selected option ID'),
  }),
  execute: async ({ proposalId, userConfirmed, selectedOption }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'confirmProposal',
      operation: 'execute' as const,
      resourceType: 'workflow' as const,
      startTime,
    };
    
    try {
      // Get the proposal
      const proposal = proposalStore.get(proposalId);
      
      if (!proposal) {
        return buildErrorResponse(
          toolOptions,
          new Error('Proposal not found or expired'),
          {
            title: 'Proposal Not Found',
            description: 'The proposal has expired or does not exist.',
          }
        );
      }
      
      // Check if user confirmed
      if (!userConfirmed) {
        // Remove the proposal since it was rejected
        proposalStore.delete(proposalId);
        
        return buildToolResponse(
          toolOptions,
          {
            proposalId,
            status: 'rejected',
            proposal,
          },
          {
            type: 'card',
            title: 'Proposal Rejected',
            description: 'The proposed changes were not applied.',
            priority: 'medium',
            components: [],
          },
          {
            notification: {
              show: true,
              type: 'info',
              message: 'Proposal cancelled',
              duration: 3000,
            },
            suggestions: ['Try a different approach', 'Modify the request'],
            actions: [],
          }
        );
      }
      
      // Handle choice proposals
      if (proposal.type === 'choice' && proposal.options) {
        if (!selectedOption) {
          return buildErrorResponse(
            toolOptions,
            new Error('Choice proposal requires a selected option'),
            {
              title: 'Option Required',
              description: 'Please select one of the available options.',
            }
          );
        }
        
        const option = proposal.options.find(opt => opt.id === selectedOption);
        if (!option) {
          return buildErrorResponse(
            toolOptions,
            new Error('Invalid option selected'),
            {
              title: 'Invalid Option',
              description: 'The selected option is not valid for this proposal.',
            }
          );
        }
        
        // Execute the selected option
        const result = await option.execute();
        
        // Remove the consumed proposal
        proposalStore.delete(proposalId);
        
        return buildToolResponse(
          toolOptions,
          {
            proposalId,
            status: 'executed',
            selectedOption: option.id,
            result,
          },
          {
            type: 'card',
            title: 'Option Executed',
            description: `${option.label} has been applied successfully.`,
            priority: 'high',
            components: [],
          },
          {
            notification: {
              show: true,
              type: 'success',
              message: `${option.label} completed`,
              duration: 4000,
            },
            suggestions: [],
            actions: [],
          }
        );
      }
      
      // Execute the proposal
      const result = await proposal.execute();
      
      // Remove the consumed proposal
      proposalStore.delete(proposalId);
      
      return buildToolResponse(
        toolOptions,
        {
          proposalId,
          status: 'executed',
          result,
        },
        {
          type: 'card',
          title: 'Proposal Executed',
          description: proposal.description || 'The proposed changes have been applied successfully.',
          priority: 'high',
          components: [],
        },
        {
          notification: {
            show: true,
            type: 'success',
            message: 'Changes applied successfully',
            duration: 4000,
          },
          suggestions: ['View the changes', 'Continue with next task'],
          actions: [],
        }
      );
      
    } catch (error) {
      console.error('[AI Tools] Error in confirmProposal:', error);
      
      // Remove the proposal on error
      proposalStore.delete(proposalId);
      
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Execution Failed',
          description: error instanceof Error ? error.message : 'Failed to execute the proposal',
        }
      );
    }
  },
});