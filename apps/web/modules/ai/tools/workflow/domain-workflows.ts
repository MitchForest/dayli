import { z } from "zod";
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type OptimizeScheduleResponse, type TriageEmailsResponse, type PrioritizeTasksResponse, type OptimizeCalendarResponse } from '../types/responses';
import { getCurrentUserId } from '../utils/helpers';
import { storeProposedChanges } from '../utils/helpers';
import { createPersistentWorkflow } from '@/modules/workflows/utils/workflow-persistence';
import { createAdaptiveSchedulingWorkflow } from '@/modules/workflows/graphs/adaptiveScheduling';
import { format } from 'date-fns';

export const optimizeSchedule = registerTool(
  createTool<typeof optimizeScheduleParams, OptimizeScheduleResponse>({
    name: 'workflow_optimizeSchedule',
    description: "Intelligently analyze and optimize your daily schedule",
    parameters: z.object({
      date: z.string().optional().describe("Date to optimize (YYYY-MM-DD format)"),
      focus: z.enum(["efficiency", "balance", "focus_time"]).optional().describe("Optimization focus"),
    }),
    metadata: {
      category: 'workflow',
      displayName: 'Optimize Schedule',
      requiresConfirmation: true,
      supportsStreaming: true,
    },
    execute: async ({ date, focus }) => {
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
        console.log(`[Tool: optimizeSchedule] Schedule already optimized for ${date || 'today'}`);
        return {
          success: true,
          proposedChanges: [],
          insights: workflowResult.insights.map((insight: any) => ({
            type: insight.type,
            content: insight.content,
            confidence: insight.confidence,
          })),
          metrics: workflowResult.data.metrics,
          requiresConfirmation: false,
        };
      }
      
      // Store proposed changes for confirmation
      const confirmationId = crypto.randomUUID();
      await storeProposedChanges(confirmationId, workflowResult.proposedChanges);
      
      console.log(`[Tool: optimizeSchedule] Found ${workflowResult.proposedChanges.length} optimization opportunities`);
      
      return {
        success: true,
        proposedChanges: workflowResult.proposedChanges.map((change: any) => ({
          type: change.type,
          entity: change.entity,
          description: change.reason,
          impact: change.impact,
          confidence: change.confidence || 0.8,
        })),
        insights: workflowResult.insights.map((insight: any) => ({
          type: insight.type,
          content: insight.content,
          confidence: insight.confidence,
        })),
        metrics: workflowResult.data.metrics,
        requiresConfirmation: true,
        confirmationId,
      };
    },
  })
);

const optimizeScheduleParams = z.object({
  date: z.string().optional().describe("Date to optimize (YYYY-MM-DD format)"),
  focus: z.enum(["efficiency", "balance", "focus_time"]).optional().describe("Optimization focus"),
});

export const triageEmails = registerTool(
  createTool<typeof triageEmailsParams, TriageEmailsResponse>({
    name: 'workflow_triageEmails',
    description: "Analyze and batch emails for efficient processing",
    parameters: z.object({
      includeBacklog: z.boolean().default(true),
      maxMinutes: z.number().optional().describe("Maximum processing time in minutes"),
    }),
    metadata: {
      category: 'workflow',
      displayName: 'Triage Emails',
      requiresConfirmation: true,
      supportsStreaming: true,
    },
    execute: async ({ includeBacklog, maxMinutes }) => {
      const userId = await getCurrentUserId();
      // TODO: Implement createEmailManagementWorkflow in Sprint 4.3
      console.log(`[Tool: triageEmails] Feature not yet implemented`);
      
      return {
        success: false,
        error: 'Email management workflow will be available in Sprint 4.3',
        emailBatches: [],
        insights: [],
        requiresConfirmation: false,
      };
    },
  })
);

const triageEmailsParams = z.object({
  includeBacklog: z.boolean().default(true),
  maxMinutes: z.number().optional().describe("Maximum processing time in minutes"),
});

export const prioritizeTasks = registerTool(
  createTool<typeof prioritizeTasksParams, PrioritizeTasksResponse>({
    name: 'workflow_prioritizeTasks',
    description: "Get intelligent task recommendations based on multiple factors",
    parameters: z.object({
      timeAvailable: z.number().optional(),
      energyLevel: z.enum(["high", "medium", "low"]).optional(),
      focusArea: z.string().optional(),
    }),
    metadata: {
      category: 'workflow',
      displayName: 'Prioritize Tasks',
      requiresConfirmation: false,
      supportsStreaming: true,
    },
    execute: async ({ timeAvailable, energyLevel, focusArea }) => {
      const userId = await getCurrentUserId();
      // TODO: Implement createTaskIntelligenceWorkflow in Sprint 4.3
      console.log(`[Tool: prioritizeTasks] Feature not yet implemented`);
      
      return {
        success: false,
        error: 'Task intelligence workflow will be available in Sprint 4.3',
        prioritizedTasks: [],
        insights: [],
        metrics: null,
      };
      
      /* Commented out - workflow not implemented yet
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
      */
    },
  })
);

const prioritizeTasksParams = z.object({
  timeAvailable: z.number().optional(),
  energyLevel: z.enum(["high", "medium", "low"]).optional(),
  focusArea: z.string().optional(),
});

export const optimizeCalendar = registerTool(
  createTool<typeof optimizeCalendarParams, OptimizeCalendarResponse>({
    name: 'workflow_optimizeCalendar',
    description: "Detect and resolve calendar conflicts and inefficiencies",
    parameters: z.object({
      date: z.string().optional(),
      includeNextDays: z.number().default(1),
    }),
    metadata: {
      category: 'workflow',
      displayName: 'Optimize Calendar',
      requiresConfirmation: true,
      supportsStreaming: true,
    },
    execute: async ({ date, includeNextDays }) => {
      const userId = await getCurrentUserId();
      // TODO: Implement createCalendarOptimizationWorkflow in Sprint 4.3
      console.log(`[Tool: optimizeCalendar] Feature not yet implemented`);
      
      return {
        success: false,
        error: 'Calendar optimization workflow will be available in Sprint 4.3',
        conflicts: [],
        proposedChanges: [],
        insights: [],
        requiresConfirmation: false,
      };
      
      /* Commented out - workflow not implemented yet
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
      */
    },
  })
);

const optimizeCalendarParams = z.object({
  date: z.string().optional(),
  includeNextDays: z.number().default(1),
});