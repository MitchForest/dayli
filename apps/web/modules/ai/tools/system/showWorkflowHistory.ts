import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type WorkflowHistoryResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';
import { getCurrentUserId } from '../utils/helpers';
import { format } from 'date-fns';

export const showWorkflowHistory = registerTool(
  createTool<typeof parameters, WorkflowHistoryResponse>({
    name: 'system_showWorkflowHistory',
    description: 'View history of past workflow executions with results and insights',
    parameters: z.object({
      workflowType: z.enum(['all', 'adaptive_scheduling', 'email_management', 'task_intelligence', 'calendar_optimization']).default('all'),
      limit: z.number().default(10).describe('Maximum number of workflows to show'),
      includeDetails: z.boolean().default(false).describe('Include full workflow details'),
    }),
    metadata: {
      category: 'system',
      displayName: 'Show Workflow History',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ workflowType, limit, includeDetails }) => {
      const userId = await getCurrentUserId();
      
      // TODO: Implement workflow service in Sprint 4.3
      // For now, return empty history
      const history: any[] = [];
      
      if (!history || history.length === 0) {
        return {
          success: true,
          workflows: [],
        };
      }
      
      // Add summary metrics
      const successCount = history.filter((w: any) => w.status === 'completed').length;
      const errorCount = history.filter((w: any) => w.status === 'failed').length;
      const avgDuration = history.reduce((sum: number, w: any) => sum + (w.executionTime || 0), 0) / history.length;
      
      console.log(`[Tool: showWorkflowHistory] Found ${history.length} workflows`);
      
      // Return pure data
      return {
        success: true,
        workflows: history.slice(0, limit).map((workflow: any) => ({
          id: workflow.id,
          type: workflow.type,
          executedAt: (workflow.startedAt || new Date()).toISOString(),
          status: workflow.status as 'completed' | 'failed' | 'interrupted',
          changes: workflow.changes || 0,
          outcome: workflow.outcome || workflow.result?.summary,
        })),
      };
    },
  })
);

const parameters = z.object({
  workflowType: z.enum(['all', 'adaptive_scheduling', 'email_management', 'task_intelligence', 'calendar_optimization']).default('all'),
  limit: z.number().default(10).describe('Maximum number of workflows to show'),
  includeDetails: z.boolean().default(false).describe('Include full workflow details'),
});