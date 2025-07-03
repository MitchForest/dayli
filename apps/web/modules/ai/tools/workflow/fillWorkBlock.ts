import { z } from "zod";
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type WorkflowFillWorkBlockResponse } from '../types/responses';

// Import our atomic tools
import { getBacklogWithScores } from '../task/getBacklogWithScores';
import { suggestForDuration } from '../task/suggestForDuration';
import { assignToTimeBlock } from '../task/assignToTimeBlock';
import { viewSchedule } from '../schedule/viewSchedule';

const parameters = z.object({
  blockId: z.string().describe("ID of the work block to fill"),
  blockTime: z.enum(["morning", "afternoon", "evening"]).optional().describe("Time of day for context"),
  confirmation: z.object({
    approved: z.boolean(),
    proposalId: z.string(),
    modifiedTasks: z.array(z.string()).optional().describe("Modified list of task IDs to assign")
  }).optional().describe("Confirmation of proposed task assignment")
});

// Store proposals temporarily (in production, use proper storage)
const proposalStore = new Map<string, any>();

export const fillWorkBlock = registerTool(
  createTool<typeof parameters, WorkflowFillWorkBlockResponse>({
    name: 'workflow_fillWorkBlock',
    description: "Multi-step workflow to intelligently fill work blocks with tasks",
    parameters,
    metadata: {
      category: 'workflow',
      displayName: 'Fill Work Block',
      requiresConfirmation: true,
      supportsStreaming: true,
    },
    execute: async ({ blockId, blockTime, confirmation }) => {
      try {
        // PHASE 1: ANALYSIS & PROPOSAL (no confirmation provided)
        if (!confirmation) {
          console.log('[FillWorkBlock Workflow] Phase 1: Analyzing and generating proposals');
          
          // Step 1: Get block details from schedule
          const scheduleResult = await viewSchedule.execute({ date: new Date().toISOString().split('T')[0] });
          if (!scheduleResult.success) {
            throw new Error('Failed to get schedule');
          }
          
          const block = scheduleResult.blocks.find((b: any) => b.id === blockId);
          if (!block) {
            throw new Error('Block not found');
          }
          
          const blockDuration = block.duration;
          
          // Step 2: Get scored task backlog using atomic tool
          const backlogResult = await getBacklogWithScores.execute({
            includeCompleted: false,
            sortBy: 'score'
          });
          if (!backlogResult.success) {
            throw new Error('Failed to get task backlog');
          }
          
          // Step 3: Get task suggestions for duration using atomic tool
          const suggestionsResult = await suggestForDuration.execute({
            availableMinutes: blockDuration,
            blockTime: blockTime || 'morning',
            maxTasks: 5
          });
          if (!suggestionsResult.success) {
            throw new Error('Failed to get task suggestions');
          }
          
          // Store proposal for later confirmation
          const proposalId = crypto.randomUUID();
          proposalStore.set(proposalId, {
            blockId,
            blockTitle: block.title,
            blockDuration,
            tasks: suggestionsResult.combination,
            timestamp: new Date()
          });
          
          // Return proposal for user review
          return {
            success: true,
            phase: 'proposal',
            requiresConfirmation: true,
            proposalId,
            blockId,
            blockTitle: block.title,
            proposals: {
              combination: suggestionsResult.combination,
              totalMinutes: suggestionsResult.totalMinutes,
              totalScore: suggestionsResult.totalScore,
              reasoning: suggestionsResult.reasoning
            },
            message: `Here are ${suggestionsResult.combination.length} tasks totaling ${suggestionsResult.totalMinutes} minutes for your ${block.title}. Would you like to assign these?`,
            summary: `Proposed ${suggestionsResult.combination.length} tasks for ${blockDuration}-minute block`
          };
        }
        
        // PHASE 2: EXECUTION (user confirmed)
        console.log('[FillWorkBlock Workflow] Phase 2: Executing approved task assignment');
        
        // Get the stored proposal
        const proposal = proposalStore.get(confirmation.proposalId);
        if (!proposal) {
          throw new Error('Proposal not found or expired');
        }
        
        // Use modified tasks if provided, otherwise use original proposal
        const taskIds = confirmation.modifiedTasks || proposal.tasks.map((t: any) => t.id);
        
        // Step 4: Assign tasks to block using atomic tool
        const assignResult = await assignToTimeBlock.execute({
          blockId: proposal.blockId,
          taskIds
        });
        
        if (!assignResult.success) {
          throw new Error('Failed to assign tasks to block');
        }
        
        // Clean up proposal
        proposalStore.delete(confirmation.proposalId);
        
        return {
          success: true,
          phase: 'completed',
          blockId: proposal.blockId,
          blockTitle: proposal.blockTitle,
          assigned: assignResult.assigned,
          summary: `Successfully assigned ${assignResult.totalAssigned} tasks to ${proposal.blockTitle}`
        };
        
      } catch (error) {
        console.error('[Workflow: fillWorkBlock] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fill work block',
          phase: 'proposal' as const,
          blockId,
          summary: 'Failed to manage task assignment'
        };
      }
    },
  })
); 