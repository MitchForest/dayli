import { z } from "zod";
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type WorkflowFillEmailBlockResponse } from '../types/responses';

// Import our atomic tools
import { getBacklog } from '../email/getBacklog';
import { batchCategorize } from '../email/batchCategorize';
import { groupBySender } from '../email/groupBySender';
import { archiveBatch } from '../email/archiveBatch';
import { viewSchedule } from '../schedule/viewSchedule';
import { toMilitaryTime } from '../../utils/time-parser';
import { format } from 'date-fns';

const parameters = z.object({
  blockId: z.string().describe("ID or description of the email block to fill (e.g., '8:30', 'morning email block')"),
  date: z.string().optional().describe("Date of the block (YYYY-MM-DD format)"),
  confirmation: z.object({
    approved: z.boolean(),
    proposalId: z.string(),
    modifications: z.object({
      toArchive: z.array(z.string()).optional(),
      toProcess: z.array(z.string()).optional()
    }).optional()
  }).optional().describe("Confirmation of proposed email processing")
});

// Store proposals temporarily (in production, use proper storage)
const proposalStore = new Map<string, any>();

export const fillEmailBlock = registerTool(
  createTool<typeof parameters, WorkflowFillEmailBlockResponse>({
    name: 'workflow_fillEmailBlock',
    description: "Multi-step workflow to intelligently process emails during email blocks",
    parameters,
    metadata: {
      category: 'workflow',
      displayName: 'Fill Email Block',
      requiresConfirmation: true,
      supportsStreaming: true,
    },
    execute: async ({ blockId, date, confirmation }) => {
      try {
        // PHASE 1: ANALYSIS & PROPOSAL (no confirmation provided)
        if (!confirmation) {
          console.log('[FillEmailBlock Workflow] Phase 1: Analyzing and generating proposals');
          
          // Step 1: Get block details from schedule
          const scheduleResult = await viewSchedule.execute({ date: date || new Date().toISOString().split('T')[0] });
          if (!scheduleResult.success) {
            throw new Error('Failed to get schedule');
          }
          
          // Find the block by ID, time, or description
          let block = null;
          const searchLower = blockId.toLowerCase().trim();
          
          // First try exact ID match
          block = scheduleResult.blocks.find((b: any) => b.id === blockId);
          
          // If not found, try to match by time
          if (!block) {
            const timeMatch = searchLower.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/);
            if (timeMatch && timeMatch[1]) {
              const searchTime = toMilitaryTime(timeMatch[1]);
              block = scheduleResult.blocks.find((b: any) => {
                const blockStart = format(new Date(b.startTime), 'HH:mm');
                return blockStart === searchTime && b.type === 'email';
              });
            }
          }
          
          // Try partial title match for email blocks
          if (!block) {
            block = scheduleResult.blocks.find((b: any) => 
              b.type === 'email' && (
                b.title.toLowerCase().includes(searchLower) ||
                searchLower.includes(b.title.toLowerCase())
              )
            );
          }
          
          // Try any email block if just "email" is mentioned
          if (!block && searchLower.includes('email')) {
            block = scheduleResult.blocks.find((b: any) => b.type === 'email');
          }
          
          if (!block) {
            throw new Error(`No email block matching "${blockId}" found`);
          }
          
          const blockDuration = block.duration;
          
          // Step 2: Get email backlog using atomic tool
          const backlogResult = await getBacklog.execute({
            status: ['unread', 'backlog'],
            limit: 100
          });
          if (!backlogResult.success) {
            throw new Error('Failed to get email backlog');
          }
          
          // Step 3: Batch categorize emails using atomic tool
          const emailIds = backlogResult.emails.map((e: any) => e.id);
          const categorizeResult = await batchCategorize.execute({ emailIds });
          if (!categorizeResult.success) {
            throw new Error('Failed to categorize emails');
          }
          
          // Step 4: Group by sender for batch processing using atomic tool
          const groupResult = await groupBySender.execute({
            emailIds,
            minGroupSize: 2
          });
          if (!groupResult.success) {
            throw new Error('Failed to group emails');
          }
          
          // Analyze categorized emails for proposals
          const urgent = categorizeResult.categorized
            .filter((e: any) => e.urgencyScore > 70 || e.daysInBacklog > 3)
            .map((e: any) => ({
              emailId: e.emailId,
              category: e.category,
              urgencyScore: e.urgencyScore
            }));
          
          const toArchive = categorizeResult.categorized
            .filter((e: any) => e.category === 'can_archive')
            .map((e: any) => e.emailId);
          
          // Store proposal for later confirmation
          const proposalId = crypto.randomUUID();
          proposalStore.set(proposalId, {
            blockId,
            blockDuration,
            emails: categorizeResult.categorized,
            toArchive,
            timestamp: new Date()
          });
          
          // Return proposal for user review
          return {
            success: true,
            phase: 'proposal',
            requiresConfirmation: true,
            proposalId,
            blockId,
            blockDuration,
            proposals: {
              urgent: urgent.slice(0, 5), // Top 5 urgent
              batched: groupResult.groups.slice(0, 3), // Top 3 sender groups
              toArchive
            },
            message: `Found ${urgent.length} urgent emails, ${groupResult.groups.length} sender batches, and ${toArchive.length} emails to archive. Process these?`,
            summary: `Proposed processing for ${blockDuration}-minute email block`
          };
        }
        
        // PHASE 2: EXECUTION (user confirmed)
        console.log('[FillEmailBlock Workflow] Phase 2: Executing approved email processing');
        
        // Get the stored proposal
        const proposal = proposalStore.get(confirmation.proposalId);
        if (!proposal) {
          throw new Error('Proposal not found or expired');
        }
        
        // Use modified lists if provided
        const toArchive = confirmation.modifications?.toArchive || proposal.toArchive;
        
        let archived = 0;
        
        // Step 5: Archive emails if any using atomic tool
        if (toArchive.length > 0) {
          const archiveResult = await archiveBatch.execute({
            emailIds: toArchive,
            reason: 'Processed during email block'
          });
          if (archiveResult.success) {
            archived = archiveResult.totalArchived;
          }
        }
        
        // Clean up proposal
        proposalStore.delete(confirmation.proposalId);
        
        // Calculate processed count (emails marked for processing, not archived)
        const processed = proposal.emails.filter((e: any) => 
          e.category !== 'can_archive' && !toArchive.includes(e.emailId)
        ).length;
        
        return {
          success: true,
          phase: 'completed',
          blockId: proposal.blockId,
          processed,
          archived,
          summary: `Processed ${processed} emails and archived ${archived} during email block`
        };
        
      } catch (error) {
        console.error('[Workflow: fillEmailBlock] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fill email block',
          phase: 'proposal' as const,
          blockId,
          summary: 'Failed to manage email processing'
        };
      }
    },
  })
); 