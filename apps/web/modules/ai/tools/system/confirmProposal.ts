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
      const proposal = proposalStore.getProposal(proposalId);
      
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
        proposalStore.clearProposal(proposalId);
        
        console.log(`[Tool: confirmProposal] Proposal ${proposalId} rejected`);
        
        return {
          success: true,
          proposalId,
          executed: false,
          changes: [],
        };
      }
      
      // For now, this tool just confirms that the proposal exists
      // The actual execution should be done by calling the workflow again with confirmation
      console.log(`[Tool: confirmProposal] Confirmed proposal ${proposalId} of type ${proposal.workflowType}`);
      
      return {
        success: true,
        proposalId,
        executed: true,
        workflowType: proposal.workflowType,
        date: proposal.date,
                  blockId: (proposal.data as any).blockId,
        changes: proposal.data?.changes || [{
          type: 'confirmation',
          description: `Confirmed ${proposal.workflowType} proposal`,
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