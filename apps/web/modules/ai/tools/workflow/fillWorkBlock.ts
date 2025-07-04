import { z } from "zod";
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type WorkflowFillWorkBlockResponse } from '../types/responses';

// Import our atomic tools
import { getBacklogWithScores } from '../task/getBacklogWithScores';
import { suggestForDuration } from '../task/suggestForDuration';
import { assignToTimeBlock } from '../task/assignToTimeBlock';
import { viewSchedule } from '../schedule/viewSchedule';
import { format } from 'date-fns';

const parameters = z.object({
  blockId: z.string().describe("ID of the work block to fill"),
  date: z.string().describe("Date in YYYY-MM-DD format"),
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
    description: "Multi-step workflow to intelligently fill work blocks with tasks - requires block ID",
    parameters,
    metadata: {
      category: 'workflow',
      displayName: 'Fill Work Block',
      requiresConfirmation: true,
      supportsStreaming: true,
    },
    execute: async ({ blockId, date, confirmation }) => {
      try {
        // PHASE 1: ANALYSIS & PROPOSAL (no confirmation provided)
        if (!confirmation) {
          console.log('[FillWorkBlock Workflow] Phase 1: Analyzing and generating proposals');
          
          // Step 1: Get block details from schedule
          const scheduleResult = await viewSchedule.execute({ date });
          if (!scheduleResult.success) {
            throw new Error('Failed to get schedule');
          }
          
          // Find the block by ID
          const block = scheduleResult.blocks.find((b: any) => b.id === blockId);
          
          if (!block) {
            throw new Error(`Block with ID "${blockId}" not found`);
          }
          
          if (block.type !== 'work') {
            throw new Error(`Block "${blockId}" is not a work block (type: ${block.type})`);
          }
          
          // Calculate duration in minutes
          const startTime = new Date(block.startTime);
          const endTime = new Date(block.endTime);
          const blockDuration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
          
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
            duration: blockDuration,
            strategy: 'mixed'
          });
          if (!suggestionsResult.success || !suggestionsResult.suggestions.length) {
            throw new Error('Failed to get task suggestions');
          }
          
          // Get the best suggestion (first one, as they're sorted by score)
          const bestSuggestion = suggestionsResult.suggestions[0];
          
          // Store proposal for later confirmation
          const proposalId = crypto.randomUUID();
          proposalStore.set(proposalId, {
            blockId: block.id,
            blockTitle: block.title,
            blockDuration,
            tasks: bestSuggestion.combination,
            timestamp: new Date()
          });
          
          // Return proposal for user review
          return {
            success: true,
            phase: 'proposal',
            requiresConfirmation: true,
            proposalId,
            blockId: block.id,
            blockTitle: block.title,
            proposals: {
              combination: bestSuggestion.combination,
              totalMinutes: bestSuggestion.totalMinutes,
              totalScore: bestSuggestion.totalScore,
              reasoning: bestSuggestion.reasoning
            },
            message: `Here are ${bestSuggestion.combination.length} tasks totaling ${bestSuggestion.totalMinutes} minutes for your ${block.title}. Would you like to assign these?`,
            summary: `Proposed ${bestSuggestion.combination.length} tasks for ${blockDuration}-minute block`
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