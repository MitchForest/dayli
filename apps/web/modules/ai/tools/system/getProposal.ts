import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { proposalStore } from '../../utils/proposal-store';

const parameters = z.object({
  workflowType: z.string().describe('The workflow type (e.g., "workflow_schedule")'),
  date: z.string().optional().describe('The date associated with the proposal (YYYY-MM-DD)'),
  blockId: z.string().optional().describe('The block ID associated with the proposal'),
});

export const getProposal = registerTool(
  createTool<typeof parameters, any>({
    name: 'system_getProposal',
    description: 'Retrieve a stored proposal for a workflow. Use this when the user wants to approve, modify, or cancel a proposal.',
    parameters,
    metadata: {
      category: 'system',
      displayName: 'Get Proposal',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ workflowType, date, blockId }) => {
      try {
        let proposal = null;
        
        // Try to find by date first
        if (date) {
          proposal = proposalStore.findByWorkflowAndDate(workflowType, date);
        }
        
        // If not found by date, try by block
        if (!proposal && blockId) {
          proposal = proposalStore.findByWorkflowAndBlock(workflowType, blockId);
        }
        
        // If still not found, get the latest
        if (!proposal) {
          proposal = proposalStore.getLatestByWorkflow(workflowType);
        }
        
        if (!proposal) {
          return {
            success: false,
            error: `No proposal found for ${workflowType}`,
          };
        }
        
        return {
          success: true,
          proposalId: proposal.proposalId,
          workflowType: proposal.workflowType,
          date: proposal.date,
          blockId: proposal.blockId,
          timestamp: proposal.timestamp,
          // Don't return the full data, just the metadata
        };
      } catch (error) {
        console.error('[Tool: getProposal] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to retrieve proposal',
        };
      }
    },
  })
); 