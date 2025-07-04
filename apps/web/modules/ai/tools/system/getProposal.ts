/**
 * Get Proposal Tool
 * 
 * Retrieves a stored proposal by ID or finds the latest proposal for a workflow
 */

import { z } from 'zod';
import { proposalStore } from '../../utils/proposal-store';
import type { GetProposalResponse } from '../types/responses';

const paramsSchema = z.object({
  proposalId: z.string().optional().describe('Specific proposal ID to retrieve'),
  workflowType: z.string().describe('Type of workflow (e.g., workflow_schedule)'),
  date: z.string().optional().describe('Optional date to filter by (YYYY-MM-DD)'),
  userId: z.string().describe('User ID to retrieve proposal for'),
});

export const getProposal = {
  name: 'system_getProposal',
  description: 'Retrieve a stored workflow proposal by ID or find the latest proposal for a workflow type',
  parameters: paramsSchema,
  execute: async (params: z.infer<typeof paramsSchema>): Promise<GetProposalResponse> => {
    console.log('[GetProposal] Retrieving proposal:', params);
    
    try {
      let proposal = null;
      
      if (params.proposalId) {
        // Get specific proposal by ID
        proposal = proposalStore.getProposal(params.proposalId);
      } else {
        // Get latest proposal for workflow type
        proposal = proposalStore.getLatestProposal(
          params.userId,
          params.workflowType,
          params.date
        );
      }
      
      if (!proposal) {
        return {
          success: false,
          error: 'No proposal found matching the criteria',
        };
      }
      
      console.log('[GetProposal] Found proposal:', {
        id: proposal.id,
        type: proposal.type,
        date: proposal.date,
      });
      
      return {
        success: true,
        proposalId: proposal.id,
        type: proposal.type,
        workflowType: proposal.workflowType,
        date: proposal.date,
        data: proposal.data,
        createdAt: proposal.createdAt.toISOString(),
      };
      
    } catch (error) {
      console.error('[GetProposal] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve proposal',
      };
    }
  },
}; 