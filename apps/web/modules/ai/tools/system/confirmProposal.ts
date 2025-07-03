import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type ConfirmProposalResponse } from '../types/responses';
import { proposalStore } from '../../utils/proposal-store';

export const confirmProposal = registerTool(
  createTool<typeof parameters, ConfirmProposalResponse>({
    name: 'system_confirmProposal',
    description: 'Execute a stored proposal after user confirmation',
    parameters: z.object({
      proposalId: z.string().describe('The ID of the proposal to execute'),
      userConfirmed: z.boolean().describe('Whether the user has confirmed the action'),
      selectedOption: z.string().optional().describe('For choice proposals, the selected option ID'),
    }),
    metadata: {
      category: 'system',
      displayName: 'Confirm Proposal',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ proposalId, userConfirmed, selectedOption }) => {
      // Get the proposal
      const proposal = proposalStore.get(proposalId);
      
      if (!proposal) {
        return {
          success: false,
          error: 'Proposal not found or expired',
          proposalId,
          executed: false,
          changes: [],
        };
      }
      
      // Check if user confirmed
      if (!userConfirmed) {
        // Remove the proposal since it was rejected
        proposalStore.delete(proposalId);
        
        console.log(`[Tool: confirmProposal] Proposal ${proposalId} rejected`);
        
        return {
          success: true,
          proposalId,
          executed: false,
          changes: [],
        };
      }
      
      // Handle choice proposals
      if (proposal.type === 'choice' && proposal.data?.options) {
        if (!selectedOption) {
          return {
            success: false,
            error: 'Choice proposal requires a selected option',
            proposalId,
            executed: false,
            changes: [],
          };
        }
        
        const option = proposal.data.options.find((opt: any) => opt.id === selectedOption);
        if (!option) {
          return {
            success: false,
            error: 'Invalid option selected',
            proposalId,
            executed: false,
            changes: [],
          };
        }
        
        // Execute the selected option
        const result = await option.execute();
        
        // Remove the consumed proposal
        proposalStore.delete(proposalId);
        
        console.log(`[Tool: confirmProposal] Executed choice ${selectedOption} for proposal ${proposalId}`);
        
        return {
          success: true,
          proposalId,
          executed: true,
          changes: [{
            type: 'choice',
            description: `Selected option: ${option.label || option.id}`,
            result: 'success',
          }],
        };
      }
      
      // Execute the proposal data
      const result = proposal.data;
      
      // Remove the consumed proposal
      proposalStore.delete(proposalId);
      
      console.log(`[Tool: confirmProposal] Executed proposal ${proposalId}`);
      
      return {
        success: true,
        proposalId,
        executed: true,
        changes: (proposal.data?.changes || proposal.metadata?.changes) || [{
          type: 'action',
          description: proposal.description,
          result: 'success',
        }],
      };
      
    },
  })
);

const parameters = z.object({
  proposalId: z.string().describe('The ID of the proposal to execute'),
  userConfirmed: z.boolean().describe('Whether the user has confirmed the action'),
  selectedOption: z.string().optional().describe('For choice proposals, the selected option ID'),
});