import { tool } from 'ai';
import { z } from 'zod';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { createPersistentWorkflow } from '@/modules/workflows/utils/workflow-persistence';
import { createAdaptiveSchedulingWorkflow } from '@/modules/workflows/graphs/adaptiveScheduling';
import { createEmailManagementWorkflow } from '@/modules/workflows/graphs/emailManagement';
import { createTaskIntelligenceWorkflow } from '@/modules/workflows/graphs/taskIntelligence';
import { createCalendarOptimizationWorkflow } from '@/modules/workflows/graphs/calendarOptimization';
import { getCurrentUserId } from '../utils/helpers';

export const resumeWorkflow = tool({
  description: 'Resume an interrupted workflow from where it left off',
  parameters: z.object({
    workflowId: z.string().describe('ID of the workflow to resume'),
    continueFrom: z.string().optional().describe('Specific step to continue from'),
  }),
  execute: async ({ workflowId, continueFrom }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'resumeWorkflow',
      operation: 'execute' as const,
      resourceType: 'workflow' as const,
      startTime,
    };
    
    try {
      const userId = await getCurrentUserId();
      
      // Get workflow state from persistence
      const savedState = await WorkflowPersistenceService.getState(workflowId);
      if (!savedState) {
        throw new Error('Workflow state not found. It may have expired.');
      }
      
      // Verify user owns this workflow
      if (savedState.userId !== userId) {
        throw new Error('Unauthorized: This workflow belongs to another user');
      }
      
      // Create the appropriate workflow based on type
      let workflow;
      switch (savedState.type) {
        case 'adaptive_scheduling':
          workflow = createPersistentWorkflow(
            createAdaptiveSchedulingWorkflow(),
            'adaptive_scheduling'
          );
          break;
        case 'email_management':
          workflow = createPersistentWorkflow(
            createEmailManagementWorkflow(),
            'email_management'
          );
          break;
        case 'task_intelligence':
          workflow = createPersistentWorkflow(
            createTaskIntelligenceWorkflow(),
            'task_intelligence'
          );
          break;
        case 'calendar_optimization':
          workflow = createPersistentWorkflow(
            createCalendarOptimizationWorkflow(),
            'calendar_optimization'
          );
          break;
        default:
          throw new Error(`Unknown workflow type: ${savedState.type}`);
      }
      
      // Resume from saved state
      const result = await workflow.resumeFrom(savedState, continueFrom);
      
      // Handle the result
      const workflowResult = result.result;
      if (!workflowResult) {
        throw new Error('Workflow did not produce a result');
      }
      
      return buildToolResponse(
        toolOptions,
        {
          workflowId,
          type: savedState.type,
          resumedFrom: continueFrom || savedState.lastStep,
          result: workflowResult,
          proposedChanges: workflowResult.proposedChanges,
          insights: workflowResult.insights,
        },
        {
          type: 'card',
          title: 'Workflow Resumed',
          description: `Successfully resumed ${savedState.type.replace('_', ' ')} workflow`,
          priority: 'high',
          components: [
            {
              type: 'workflowProgress',
              data: {
                steps: savedState.steps,
                currentStep: savedState.lastStep,
                progress: savedState.progress || 0,
                status: 'resumed',
              },
            },
            ...workflowResult.insights.map((insight: any) => ({
              type: 'insight' as const,
              data: {
                type: insight.type,
                content: insight.content,
                confidence: insight.confidence,
              },
            })),
          ],
        },
        {
          notification: {
            show: true,
            type: 'success',
            message: 'Workflow resumed successfully',
            duration: 3000,
          },
          suggestions: workflowResult.nextSteps || [
            'Review proposed changes',
            'Apply recommendations',
            'View detailed results',
          ],
          actions: workflowResult.proposedChanges.length > 0 ? [{
            id: 'apply-changes',
            label: 'Apply All Changes',
            icon: 'check',
            variant: 'primary',
            action: {
              type: 'tool',
              tool: 'confirmProposal',
              params: {
                confirmationId: workflowResult.confirmationId,
              },
            },
          }] : [],
        }
      );
    } catch (error) {
      return buildErrorResponse(toolOptions, error, {
        title: 'Failed to resume workflow',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
});

// Import at runtime to avoid circular dependency
let WorkflowPersistenceService: any;
if (typeof window !== 'undefined') {
  import('@/modules/workflows/utils/workflow-persistence').then(module => {
    WorkflowPersistenceService = module.WorkflowPersistenceService;
  });
}