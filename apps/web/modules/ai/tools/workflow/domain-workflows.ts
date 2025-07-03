import { tool } from "ai";
import { z } from "zod";
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { getCurrentUserId } from '../utils/helpers';
import { storeProposedChanges } from '../utils/helpers';
import { createPersistentWorkflow } from '@/modules/workflows/utils/workflow-persistence';
import { createAdaptiveSchedulingWorkflow } from '@/modules/workflows/graphs/adaptiveScheduling';
// import { createEmailManagementWorkflow } from '@/modules/workflows/graphs/emailManagement';
// import { createTaskIntelligenceWorkflow } from '@/modules/workflows/graphs/taskIntelligence';
// import { createCalendarOptimizationWorkflow } from '@/modules/workflows/graphs/calendarOptimization';
import { format } from 'date-fns';
import type { UniversalToolResponse } from '../../schemas/universal.schema';

export const optimizeSchedule = tool({
  description: "Intelligently analyze and optimize your daily schedule",
  parameters: z.object({
    date: z.string().optional().describe("Date to optimize (YYYY-MM-DD format)"),
    focus: z.enum(["efficiency", "balance", "focus_time"]).optional().describe("Optimization focus"),
  }),
  execute: async ({ date, focus }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'optimizeSchedule',
      operation: 'execute' as const,
      resourceType: 'workflow' as const,
      startTime,
    };
    
    try {
      const userId = await getCurrentUserId();
      const workflow = createPersistentWorkflow(
        createAdaptiveSchedulingWorkflow(),
        'adaptive_scheduling'
      );
      
      const result = await workflow.invoke({
        userId,
        intent: focus,
        ragContext: null,
        data: {
          date: date || format(new Date(), 'yyyy-MM-dd'),
          currentSchedule: [],
          gaps: [],
          inefficiencies: [],
          preferences: null,
          availableTasks: [],
          emailBacklog: [],
        },
        proposedChanges: [],
        insights: [],
        messages: [],
        startTime: Date.now(),
        result: null
      });
      
      // Extract the DomainWorkflowResult
      const workflowResult = result.result;
      if (!workflowResult) {
        throw new Error('Workflow did not produce a result');
      }
      
      // No changes needed - schedule is already optimized
      if (workflowResult.proposedChanges.length === 0) {
        return buildToolResponse(
          toolOptions,
          {
            message: "Your schedule is already well-optimized!",
            insights: workflowResult.insights,
            metrics: workflowResult.data.metrics,
            schedule: workflowResult.data.currentSchedule,
          },
          {
            type: 'card',
            title: 'Schedule Analysis Complete',
            description: workflowResult.data.summary || 'Your schedule is already well-optimized!',
            priority: 'low',
            components: [
              {
                type: 'progressIndicator',
                data: {
                  label: 'Schedule Efficiency',
                  percentage: 100 - (workflowResult.data.metrics.fragmentationScore * 100),
                  current: workflowResult.data.metrics.totalBlocks,
                  total: 8, // Typical work day blocks
                }
              },
              ...workflowResult.insights.slice(0, 3).map((insight: any) => ({
                type: 'insight' as const,
                data: {
                  type: insight.type,
                  content: insight.content,
                  confidence: insight.confidence,
                }
              }))
            ],
          }
        );
      }
      
      // Store proposed changes for confirmation
      const confirmationId = crypto.randomUUID();
      await storeProposedChanges(confirmationId, workflowResult.proposedChanges);
      
      // Create UI components for proposed changes
      const changeComponents = workflowResult.proposedChanges.map((change: any) => ({
        type: 'proposedChange' as const,
        data: {
          type: change.type,
          entity: change.entity,
          description: change.reason,
          impact: change.impact,
          confidence: change.confidence || 0.8,
          details: change.data,
        },
      }));
      
      // Add metrics component
      const metricsComponent = {
        type: 'metrics' as const,
        data: {
          title: 'Schedule Optimization Metrics',
          metrics: [
            { label: 'Focus Time', value: `${workflowResult.data.metrics.focusTime} min`, trend: 'up' },
            { label: 'Efficiency Gain', value: `+${Math.round(workflowResult.data.metrics.efficiencyGain)}%`, trend: 'up' },
            { label: 'Energy Alignment', value: `${Math.round(workflowResult.data.metrics.energyAlignment)}%`, trend: 'up' },
            { label: 'Tasks Assigned', value: workflowResult.data.metrics.tasksAssigned.toString(), trend: 'neutral' },
          ]
        }
      };
      
      return buildToolResponse(
        toolOptions,
        {
          proposedChanges: workflowResult.proposedChanges,
          insights: workflowResult.insights,
          metrics: workflowResult.data.metrics,
          summary: workflowResult.data.summary,
          executionTime: workflowResult.executionTime,
        },
        {
          type: 'confirmation',
          title: 'Schedule Optimization Proposal',
          description: workflowResult.data.summary || `Found ${workflowResult.proposedChanges.length} optimization opportunities`,
          priority: 'medium',
          components: [metricsComponent, ...changeComponents],
        },
        {
          confirmationRequired: true,
          confirmationId,
          suggestions: workflowResult.nextSteps,
          actions: [{
            id: 'confirm-all',
            label: 'Apply All Changes',
            icon: 'check',
            variant: 'primary',
            action: {
              type: 'tool',
              tool: 'confirmProposal',
              params: { confirmationId },
            },
          }, {
            id: 'view-details',
            label: 'View Details',
            icon: 'eye',
            variant: 'secondary',
            action: {
              type: 'message',
              message: 'Show me the detailed schedule comparison',
            },
          }],
        }
      );
    } catch (error) {
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Schedule Optimization Failed',
          description: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  },
});

/*
export const triageEmails = tool({
  description: "Analyze and batch emails for efficient processing",
  parameters: z.object({
    includeBacklog: z.boolean().default(true),
    maxMinutes: z.number().optional(),
  }),
  execute: async ({ includeBacklog, maxMinutes }) => {
    try {
      const workflow = createPersistentWorkflow(
        createEmailManagementWorkflow(),
        'email_management'
      );
      
      const result = await workflow.invoke({
        userId: await getCurrentUserId(),
        includeBacklog,
        maxProcessingTime: maxMinutes,
      });
      
      return buildToolResponse({
        success: true,
        data: {
          batches: result.data.emailBatches,
          insights: result.insights,
          proposedBlocks: result.proposedChanges.filter(c => c.type === "create"),
        },
        display: {
          type: 'email',
          content: result.data.emailBatches,
        }
      });
    } catch (error) {
      return buildErrorResponse('EMAIL_TRIAGE_FAILED', error.message);
    }
  },
});

export const prioritizeTasks = tool({
  description: "Get intelligent task recommendations based on multiple factors",
  parameters: z.object({
    timeAvailable: z.number().optional(),
    energyLevel: z.enum(["high", "medium", "low"]).optional(),
    focusArea: z.string().optional(),
  }),
  execute: async ({ timeAvailable, energyLevel, focusArea }) => {
    try {
      const workflow = createPersistentWorkflow(
        createTaskIntelligenceWorkflow(),
        'task_intelligence'
      );
      
      const result = await workflow.invoke({
        userId: await getCurrentUserId(),
        data: {
          currentEnergy: energyLevel || "medium",
          availableMinutes: timeAvailable,
          focusArea,
        },
      });
      
      return buildToolResponse({
        success: true,
        data: {
          recommendations: result.data.recommendations,
          topTasks: result.data.scoredTasks.slice(0, 5),
          insights: result.insights,
        },
        display: {
          type: 'task',
          content: result.data.recommendations,
        }
      });
    } catch (error) {
      return buildErrorResponse('TASK_PRIORITIZATION_FAILED', error.message);
    }
  },
});

export const optimizeCalendar = tool({
  description: "Detect and resolve calendar conflicts and inefficiencies",
  parameters: z.object({
    date: z.string().optional(),
    includeNextDays: z.number().default(1),
  }),
  execute: async ({ date, includeNextDays }) => {
    try {
      const workflow = createPersistentWorkflow(
        createCalendarOptimizationWorkflow(),
        'calendar_optimization'
      );
      
      const result = await workflow.invoke({
        userId: await getCurrentUserId(),
        startDate: date || format(new Date(), 'yyyy-MM-dd'),
        days: includeNextDays,
      });
      
      if (result.data.conflicts.length === 0 && result.data.inefficiencies.length === 0) {
        return buildToolResponse({
          success: true,
          data: {
            message: "Your calendar is conflict-free and well-organized!",
            insights: result.insights,
          }
        });
      }
      
      const confirmationId = crypto.randomUUID();
      await storeProposedChanges(confirmationId, result.proposedChanges);
      
      return buildToolConfirmation(
        result,
        confirmationId,
        `Found ${result.data.conflicts.length} conflicts and ${result.data.inefficiencies.length} optimization opportunities.`
      );
    } catch (error) {
      return buildErrorResponse('CALENDAR_OPTIMIZATION_FAILED', error.message);
    }
  },
});
*/ 