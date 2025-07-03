import { tool } from "ai";
import { z } from "zod";
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { getCurrentUserId } from '../utils/helpers';
import { storeProposedChanges } from '../utils/helpers';
import { createPersistentWorkflow } from '@/modules/workflows/utils/workflow-persistence';
import { createAdaptiveSchedulingWorkflow } from '@/modules/workflows/graphs/adaptiveScheduling';
import { createEmailManagementWorkflow } from '@/modules/workflows/graphs/emailManagement';
import { createTaskIntelligenceWorkflow } from '@/modules/workflows/graphs/taskIntelligence';
import { createCalendarOptimizationWorkflow } from '@/modules/workflows/graphs/calendarOptimization';
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

export const triageEmails = tool({
  description: "Analyze and batch emails for efficient processing",
  parameters: z.object({
    includeBacklog: z.boolean().default(true),
    maxMinutes: z.number().optional().describe("Maximum processing time in minutes"),
  }),
  execute: async ({ includeBacklog, maxMinutes }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'triageEmails',
      operation: 'execute' as const,
      resourceType: 'workflow' as const,
      startTime,
    };
    
    try {
      const userId = await getCurrentUserId();
      const workflow = createPersistentWorkflow(
        createEmailManagementWorkflow(),
        'email_management'
      );
      
      const result = await workflow.invoke({
        userId,
        includeBacklog,
        maxProcessingTime: maxMinutes,
        intent: null,
        ragContext: null,
        data: {},
        proposedChanges: [],
        insights: [],
      });
      
      const confirmationId = crypto.randomUUID();
      await storeProposedChanges(confirmationId, result.proposedChanges);
      
      return buildToolResponse(
        toolOptions,
        {
          batches: result.data.emailBatches,
          insights: result.insights,
          proposedBlocks: result.proposedChanges.filter(c => c.type === "create"),
          proposedChanges: result.proposedChanges,
        },
        {
          type: 'list',
          title: 'Email Triage Results',
          description: `Analyzed ${result.data.emailBatches?.length || 0} email batches`,
          priority: 'medium',
          components: result.data.emailBatches?.map((batch: any) => ({
            type: 'emailBatch',
            data: batch,
          })) || [],
        },
        {
          confirmationRequired: result.proposedChanges.length > 0,
          confirmationId: result.proposedChanges.length > 0 ? confirmationId : undefined,
          suggestions: result.nextSteps || ['Process urgent emails', 'Schedule email blocks'],
          actions: result.proposedChanges.length > 0 ? [{
            id: 'apply-changes',
            label: 'Apply Email Organization',
            icon: 'check',
            variant: 'primary',
            action: {
              type: 'tool',
              tool: 'confirmProposal',
              params: { confirmationId },
            },
          }] : [],
        }
      );
    } catch (error) {
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Email Triage Failed',
          description: error instanceof Error ? error.message : 'Unknown error',
        }
      );
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
  execute: async ({ timeAvailable, energyLevel, focusArea }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'prioritizeTasks',
      operation: 'execute' as const,
      resourceType: 'workflow' as const,
      startTime,
    };
    
    try {
      const userId = await getCurrentUserId();
      const workflow = createPersistentWorkflow(
        createTaskIntelligenceWorkflow(),
        'task_intelligence'
      );
      
      const result = await workflow.invoke({
        userId,
        data: {
          currentEnergy: energyLevel || "medium",
          availableMinutes: timeAvailable,
          focusArea,
        },
        intent: null,
        ragContext: null,
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
      
      const topTasks = workflowResult.data.scoredTasks?.slice(0, 5) || [];
      const recommendations = workflowResult.data.recommendations || [];
      
      // Create task components
      const taskComponents = topTasks.map((task: any) => ({
        type: 'task' as const,
        data: {
          id: task.id,
          title: task.title,
          priority: task.priority,
          score: task.score,
          estimatedMinutes: task.estimatedMinutes,
          tags: task.tags,
          reasonForRecommendation: task.reasonForRecommendation,
        },
      }));
      
      // Add metrics if available
      const metricsComponent = workflowResult.data.metrics ? {
        type: 'metrics' as const,
        data: {
          title: 'Task Prioritization Metrics',
          metrics: [
            { label: 'Tasks Analyzed', value: workflowResult.data.metrics.totalTasks?.toString() || '0', trend: 'neutral' },
            { label: 'High Priority', value: workflowResult.data.metrics.highPriorityCount?.toString() || '0', trend: 'neutral' },
            { label: 'Match Score', value: `${Math.round(workflowResult.data.metrics.avgMatchScore || 0)}%`, trend: 'up' },
            { label: 'Energy Match', value: workflowResult.data.metrics.energyMatch || 'Good', trend: 'neutral' },
          ]
        }
      } : null;
      
      return buildToolResponse(
        toolOptions,
        {
          recommendations,
          topTasks,
          insights: workflowResult.insights,
          metrics: workflowResult.data.metrics,
          executionTime: workflowResult.executionTime,
        },
        {
          type: 'list',
          title: 'Task Recommendations',
          description: `${topTasks.length} tasks recommended based on your ${energyLevel || 'current'} energy${focusArea ? ` and ${focusArea} focus` : ''}`,
          priority: 'high',
          components: [
            ...(metricsComponent ? [metricsComponent] : []),
            ...taskComponents,
          ],
        },
        {
          suggestions: [
            'Start with the top task',
            'View full task details',
            'Adjust energy level',
            'Schedule work blocks',
          ],
          actions: topTasks.length > 0 ? [{
            id: 'start-task',
            label: 'Start Top Task',
            icon: 'play',
            variant: 'primary',
            action: {
              type: 'tool',
              tool: 'createTimeBlock',
              params: {
                type: 'work',
                title: topTasks[0].title,
                duration: topTasks[0].estimatedMinutes || 30,
              },
            },
          }, {
            id: 'view-all',
            label: 'View All Tasks',
            icon: 'list',
            variant: 'secondary',
            action: {
              type: 'tool',
              tool: 'viewTasks',
              params: { showScores: true },
            },
          }] : [],
        }
      );
    } catch (error) {
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Task Prioritization Failed',
          description: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  },
});

export const optimizeCalendar = tool({
  description: "Detect and resolve calendar conflicts and inefficiencies",
  parameters: z.object({
    date: z.string().optional(),
    includeNextDays: z.number().default(1),
  }),
  execute: async ({ date, includeNextDays }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'optimizeCalendar',
      operation: 'execute' as const,
      resourceType: 'workflow' as const,
      startTime,
    };
    
    try {
      const userId = await getCurrentUserId();
      const workflow = createPersistentWorkflow(
        createCalendarOptimizationWorkflow(),
        'calendar_optimization'
      );
      
      const result = await workflow.invoke({
        userId,
        startDate: date || format(new Date(), 'yyyy-MM-dd'),
        days: includeNextDays,
        intent: null,
        ragContext: null,
        data: {},
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
      
      const conflicts = workflowResult.data.conflicts || [];
      const inefficiencies = workflowResult.data.inefficiencies || [];
      
      if (conflicts.length === 0 && inefficiencies.length === 0) {
        return buildToolResponse(
          toolOptions,
          {
            message: "Your calendar is conflict-free and well-organized!",
            insights: workflowResult.insights,
            metrics: workflowResult.data.metrics,
          },
          {
            type: 'card',
            title: 'Calendar Analysis Complete',
            description: 'Your calendar is conflict-free and well-organized!',
            priority: 'low',
            components: [
              {
                type: 'insight',
                data: {
                  type: 'success',
                  content: 'No conflicts or inefficiencies detected',
                  confidence: 1.0,
                }
              },
              ...workflowResult.insights.slice(0, 2).map((insight: any) => ({
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
      
      const confirmationId = crypto.randomUUID();
      await storeProposedChanges(confirmationId, workflowResult.proposedChanges);
      
      // Create conflict components
      const conflictComponents = conflicts.map((conflict: any) => ({
        type: 'conflict' as const,
        data: {
          type: 'time_overlap',
          events: conflict.events,
          severity: conflict.severity || 'medium',
          resolution: conflict.suggestedResolution,
        },
      }));
      
      // Create inefficiency components
      const inefficiencyComponents = inefficiencies.map((item: any) => ({
        type: 'insight' as const,
        data: {
          type: 'warning',
          content: item.description,
          confidence: item.confidence || 0.8,
        },
      }));
      
      // Add metrics component
      const metricsComponent = workflowResult.data.metrics ? {
        type: 'metrics' as const,
        data: {
          title: 'Calendar Optimization Metrics',
          metrics: [
            { label: 'Conflicts Found', value: conflicts.length.toString(), trend: conflicts.length > 0 ? 'down' : 'neutral' },
            { label: 'Inefficiencies', value: inefficiencies.length.toString(), trend: inefficiencies.length > 0 ? 'down' : 'neutral' },
            { label: 'Time Saved', value: `${workflowResult.data.metrics.timeSaved || 0} min`, trend: 'up' },
            { label: 'Optimization Score', value: `${Math.round(workflowResult.data.metrics.score || 85)}%`, trend: 'up' },
          ]
        }
      } : null;
      
      return buildToolResponse(
        toolOptions,
        {
          conflicts,
          inefficiencies,
          proposedChanges: workflowResult.proposedChanges,
          insights: workflowResult.insights,
          metrics: workflowResult.data.metrics,
          executionTime: workflowResult.executionTime,
        },
        {
          type: 'confirmation',
          title: 'Calendar Optimization Report',
          description: `Found ${conflicts.length} conflicts and ${inefficiencies.length} optimization opportunities`,
          priority: 'high',
          components: [
            ...(metricsComponent ? [metricsComponent] : []),
            ...conflictComponents,
            ...inefficiencyComponents,
          ],
        },
        {
          confirmationRequired: true,
          confirmationId,
          suggestions: workflowResult.nextSteps || [
            'Apply all optimizations',
            'Review conflicts individually',
            'Reschedule meetings',
          ],
          actions: [{
            id: 'apply-all',
            label: 'Apply All Optimizations',
            icon: 'check',
            variant: 'primary',
            action: {
              type: 'tool',
              tool: 'confirmProposal',
              params: { confirmationId },
            },
          }, {
            id: 'view-calendar',
            label: 'View Calendar',
            icon: 'calendar',
            variant: 'secondary',
            action: {
              type: 'message',
              message: 'Show my calendar with conflicts highlighted',
            },
          }],
        }
      );
    } catch (error) {
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Calendar Optimization Failed',
          description: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  },
});