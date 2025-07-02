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
            title: 'Action Cancelled',
            description: `The ${proposal.type} action was cancelled by the user.`,
            priority: 'low',
            components: [],
          },
          {
            notification: {
              show: true,
              type: 'info',
              message: 'Action cancelled',
              duration: 3000,
            },
          }
        );
      }
      
      // Consume the proposal (removes it from store)
      const consumedProposal = proposalStore.consume(proposalId);
      
      if (!consumedProposal) {
        return buildErrorResponse(
          toolOptions,
          new Error('Failed to consume proposal'),
          {
            title: 'Execution Failed',
            description: 'Could not execute the proposal.',
          }
        );
      }
      
      // Handle different proposal types
      let result: any;
      let nextAction: string | null = null;
      
      switch (consumedProposal.type) {
        case 'confirmation':
          // Simple confirmation - return the stored data
          result = consumedProposal.data;
          nextAction = `Execute the confirmed action: ${consumedProposal.description}`;
          break;
          
        case 'choice':
          // Multi-choice - return the selected option's data
          if (!selectedOption) {
            return buildErrorResponse(
              toolOptions,
              new Error('No option selected for choice proposal'),
              {
                title: 'No Selection',
                description: 'Please select an option to proceed.',
              }
            );
          }
          
          const option = consumedProposal.data.options.find(
            (opt: any) => opt.id === selectedOption
          );
          
          if (!option) {
            return buildErrorResponse(
              toolOptions,
              new Error('Invalid option selected'),
              {
                title: 'Invalid Selection',
                description: 'The selected option is not valid.',
              }
            );
          }
          
          result = option.data;
          nextAction = `Execute the selected option: ${option.label}`;
          break;
          
        default:
          // Custom proposal type - return all data
          result = consumedProposal.data;
          break;
      }
      
      return buildToolResponse(
        toolOptions,
        {
          proposalId,
          status: 'confirmed',
          proposal: consumedProposal,
          result,
          nextAction,
        },
        {
          type: 'card',
          title: 'Action Confirmed',
          description: `${consumedProposal.description} has been confirmed and is ready to execute.`,
          priority: 'high',
          components: consumedProposal.metadata?.consequences ? [{
            type: 'confirmationDialog',
            data: {
              title: 'Executing Action',
              message: consumedProposal.description,
              confirmText: 'Confirmed',
              cancelText: 'N/A',
              variant: 'info',
            },
          }] : [],
        },
        {
          suggestions: nextAction ? [nextAction] : [],
          notification: {
            show: true,
            type: 'success',
            message: 'Action confirmed and ready to execute',
            duration: 4000,
          },
          actions: nextAction ? [{
            id: 'execute-action',
            label: 'Execute Now',
            variant: 'primary',
            action: {
              type: 'message',
              message: nextAction,
            },
          }] : [],
        }
      );
      
    } catch (error) {
      console.error('[CONFIRM PROPOSAL] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Confirmation Failed',
          description: 'Could not process the proposal confirmation.',
        }
      );
    }
  },
}); 