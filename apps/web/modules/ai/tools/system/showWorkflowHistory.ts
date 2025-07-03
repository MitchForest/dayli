import { tool } from 'ai';
import { z } from 'zod';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { getCurrentUserId } from '../utils/helpers';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { format } from 'date-fns';

export const showWorkflowHistory = tool({
  description: 'View history of past workflow executions with results and insights',
  parameters: z.object({
    workflowType: z.enum(['all', 'adaptive_scheduling', 'email_management', 'task_intelligence', 'calendar_optimization']).default('all'),
    limit: z.number().default(10).describe('Maximum number of workflows to show'),
    includeDetails: z.boolean().default(false).describe('Include full workflow details'),
  }),
  execute: async ({ workflowType, limit, includeDetails }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'showWorkflowHistory',
      operation: 'read' as const,
      resourceType: 'workflow' as const,
      startTime,
    };
    
    try {
      const userId = await getCurrentUserId();
      const factory = ServiceFactory.getInstance();
      const workflowService = factory.getWorkflowService();
      
      // Get workflow history
      const history = await workflowService.getWorkflowHistory({
        userId,
        type: workflowType === 'all' ? undefined : workflowType,
        limit,
      });
      
      if (!history || history.length === 0) {
        return buildToolResponse(
          toolOptions,
          {
            message: 'No workflow history found',
            workflowType,
          },
          {
            type: 'card',
            title: 'No Workflow History',
            description: 'You have not run any workflows yet',
            priority: 'low',
            components: [],
          }
        );
      }
      
      // Create history components
      const historyComponents = history.map((workflow: any) => ({
        type: 'workflowHistory' as const,
        data: {
          id: workflow.id,
          type: workflow.type,
          status: workflow.status,
          startedAt: format(new Date(workflow.startedAt), 'PPp'),
          completedAt: workflow.completedAt ? format(new Date(workflow.completedAt), 'PPp') : null,
          duration: workflow.executionTime || 0,
          proposedChanges: workflow.proposedChanges?.length || 0,
          insights: includeDetails ? workflow.insights : workflow.insights?.slice(0, 2),
          metrics: workflow.metrics,
          error: workflow.error,
        },
      }));
      
      // Add summary metrics
      const successCount = history.filter((w: any) => w.status === 'completed').length;
      const errorCount = history.filter((w: any) => w.status === 'failed').length;
      const avgDuration = history.reduce((sum: number, w: any) => sum + (w.executionTime || 0), 0) / history.length;
      
      const metricsComponent = {
        type: 'metrics' as const,
        data: {
          title: 'Workflow Statistics',
          metrics: [
            { label: 'Total Runs', value: history.length.toString(), trend: 'neutral' },
            { label: 'Success Rate', value: `${Math.round((successCount / history.length) * 100)}%`, trend: successCount > errorCount ? 'up' : 'down' },
            { label: 'Avg Duration', value: `${Math.round(avgDuration / 1000)}s`, trend: 'neutral' },
            { label: 'Recent Errors', value: errorCount.toString(), trend: errorCount > 0 ? 'down' : 'neutral' },
          ],
        },
      };
      
      return buildToolResponse(
        toolOptions,
        {
          workflows: history,
          totalCount: history.length,
          successRate: (successCount / history.length) * 100,
          avgDuration,
        },
        {
          type: 'list',
          title: 'Workflow History',
          description: `Showing ${history.length} ${workflowType === 'all' ? 'workflows' : workflowType.replace('_', ' ') + ' workflows'}`,
          priority: 'medium',
          components: [metricsComponent, ...historyComponents],
        },
        {
          suggestions: [
            'Resume an incomplete workflow',
            'View detailed insights',
            'Run a new workflow',
          ],
          actions: history.some((w: any) => w.status === 'interrupted') ? [{
            id: 'resume-workflow',
            label: 'Resume Interrupted',
            icon: 'play',
            variant: 'primary',
            action: {
              type: 'tool',
              tool: 'resumeWorkflow',
              params: {
                workflowId: history.find((w: any) => w.status === 'interrupted')?.id,
              },
            },
          }] : [],
        }
      );
    } catch (error) {
      return buildErrorResponse(toolOptions, error, {
        title: 'Failed to retrieve workflow history',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
});