import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type WorkflowResult } from '../../schemas/workflow.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { createDailyPlanningWorkflow } from '@/modules/workflows/graphs/dailyPlanning';
import { format } from 'date-fns';
import { createServerActionClient } from '@/lib/supabase-server';
import { ServiceFactory } from '@/services/factory/service.factory';
import { ensureServicesConfigured } from '../utils/auth';

interface ProposedChange {
  type: 'create' | 'move' | 'delete' | 'assign';
  block?: any;
  task?: any;
  newStartTime?: string;
  description?: string;
}

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
  execute: async ({ date, includeBacklog }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'scheduleDay',
      operation: 'execute' as const,
      resourceType: 'workflow' as const,
      startTime,
    };
    
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const supabase = await createServerActionClient();
      const workflow = createDailyPlanningWorkflow(supabase);
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      
      // Get userId from the authenticated session
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        return buildErrorResponse(
          toolOptions,
          new Error('User not authenticated'),
          {
            title: 'Authentication required',
            description: 'Please log in to use this feature',
          }
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
        
        const workflowResult: WorkflowResult = {
          workflowId: 'daily-planning',
          type: 'schedule_optimization',
          summary: `Proposed ${result.proposedChanges.length} schedule changes`,
          changes: result.proposedChanges.map((change: ProposedChange) => ({
            type: change.type,
            description: getChangeDescription(change),
            entityType: change.type === 'assign' ? 'task' : 'schedule' as const,
          })),
          requiresConfirmation: true,
          confirmationId,
          metrics: {
            blocksOptimized: result.proposedChanges.filter((c: ProposedChange) => c.type === 'move').length,
            tasksProcessed: result.proposedChanges.filter((c: ProposedChange) => c.type === 'assign').length,
          },
        };
        
        return buildToolResponse(
          toolOptions,
          workflowResult,
          {
            type: 'confirmation',
            title: 'Schedule Optimization Ready',
            description: `I've analyzed your schedule and have ${result.proposedChanges.length} suggested changes`,
            priority: 'high',
            components: [
              {
                type: 'confirmationDialog',
                data: {
                  title: 'Confirm Schedule Changes',
                  message: changesSummary,
                  confirmText: 'Apply Changes',
                  cancelText: 'Cancel',
                  variant: 'info',
                },
              },
            ],
          },
          {
            confirmationRequired: true,
            confirmationId,
            suggestions: [
              'Apply these changes',
              'Review each change individually',
              'Cancel optimization',
            ],
            actions: [],
          }
        );
      }
      
      // No changes needed
      const workflowResult: WorkflowResult = {
        workflowId: 'daily-planning',
        type: 'schedule_optimization',
        summary: 'Schedule is already optimized',
        changes: [],
        requiresConfirmation: false,
        metrics: {
          blocksOptimized: 0,
          tasksProcessed: 0,
        },
      };
      
      return buildToolResponse(
        toolOptions,
        workflowResult,
        {
          type: 'card',
          title: 'Schedule Optimized',
          description: 'Your schedule looks good - no changes needed.',
          priority: 'low',
          components: [],
        },
        {
          notification: {
            show: true,
            type: 'info',
            message: 'Schedule is already optimized',
            duration: 3000,
          },
          suggestions: [
            'View current schedule',
            'Add a new task',
            'Check tomorrow\'s schedule',
          ],
          actions: [
            {
              id: 'view-schedule',
              label: 'View Schedule',
              icon: 'calendar',
              variant: 'primary',
              action: {
                type: 'tool',
                tool: 'getSchedule',
                params: { date: targetDate },
              },
            },
            {
              id: 'add-task',
              label: 'Add Task',
              icon: 'plus',
              variant: 'secondary',
              action: {
                type: 'message',
                message: 'Create a new task',
              },
            },
          ],
        }
      );
      
    } catch (error) {
      // Handle authentication errors specifically
      if (error instanceof Error && error.message.includes('not configured')) {
        return buildErrorResponse(
          toolOptions,
          error,
          {
            title: 'Authentication required',
            description: 'Please log in to use this feature',
          }
        );
      }
      
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Workflow failed',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
});

function getChangeDescription(change: ProposedChange): string {
  switch (change.type) {
    case 'create':
      return `Create ${change.block?.type} block "${change.block?.title}" at ${change.block?.startTime}`;
    case 'move':
      return `Move "${change.block?.title}" to ${change.newStartTime}`;
    case 'delete':
      return `Remove "${change.block?.title}"`;
    case 'assign':
      return `Assign "${change.task?.title}" to ${change.block?.title}`;
    default:
      return `${change.type} ${change.description}`;
  }
} 