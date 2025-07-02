import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError, toolConfirmation, ProposedChange } from '../types';
import { createDailyPlanningWorkflow } from '@/modules/workflows/graphs/dailyPlanning';
import { format } from 'date-fns';
import { createServerActionClient } from '@/lib/supabase-server';
import { ServiceFactory } from '@/services/factory/service.factory';
import { ensureServicesConfigured } from '../utils/auth';

// Helper to store proposed changes for confirmation
async function storeProposedChanges(confirmationId: string, changes: ProposedChange[]): Promise<void> {
  // In a real implementation, this would store in database or cache
  console.log('Storing proposed changes:', confirmationId, changes);
}

export const scheduleDay = tool({
  description: "Intelligently plan or adjust the daily schedule",
  parameters: z.object({
    date: z.string().optional().describe("YYYY-MM-DD format, defaults to today"),
    includeBacklog: z.boolean().default(true),
  }),
  execute: async ({ date, includeBacklog }) => {
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const supabase = await createServerActionClient();
      const workflow = createDailyPlanningWorkflow(supabase);
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      
      // Get userId from the authenticated session
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        return toolError(
          'AUTH_REQUIRED',
          'User not authenticated'
        );
      }
      const userId = user.id;
      
      const result = await workflow.invoke({
        userId,
        date: targetDate,
        includeBacklog,
        proposedChanges: [],
        messages: [],
      });
      
      // Check if we have proposed changes that need confirmation
      if (result.proposedChanges && result.proposedChanges.length > 0) {
        const confirmationId = crypto.randomUUID();
        await storeProposedChanges(confirmationId, result.proposedChanges);
        
        const changesSummary = result.proposedChanges.map((change: ProposedChange) => {
          switch (change.type) {
            case 'create':
              return `• Create ${change.block?.type} block "${change.block?.title}" at ${change.block?.startTime}`;
            case 'move':
              return `• Move "${change.block?.title}" to ${change.newStartTime}`;
            case 'delete':
              return `• Remove "${change.block?.title}"`;
            case 'assign':
              return `• Assign "${change.task?.title}" to ${change.block?.title}`;
            default:
              return `• ${change.type} ${change.description}`;
          }
        }).join('\n');
        
        return toolConfirmation(
          {
            proposedChanges: result.proposedChanges,
            summary: result.summary,
            changeCount: result.proposedChanges.length
          },
          confirmationId,
          `I've analyzed your schedule and have ${result.proposedChanges.length} suggested changes:\n\n${changesSummary}\n\nWould you like me to apply these changes?`
        );
      }
      
      // No changes needed
      return toolSuccess(
        {
          message: 'Your schedule is already well-optimized!',
          stats: result.stats || {}
        },
        {
          type: 'text',
          content: 'Your schedule looks good - no changes needed.'
        },
        {
          suggestions: [
            'View current schedule',
            'Add a new task',
            'Check tomorrow\'s schedule'
          ]
        }
      );
      
    } catch (error) {
      // Handle authentication errors specifically
      if (error instanceof Error && error.message.includes('not configured')) {
        return toolError(
          'AUTH_REQUIRED',
          'Please log in to use this feature',
          error
        );
      }
      
      return toolError(
        'WORKFLOW_FAILED',
        `Failed to plan schedule: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
}); 