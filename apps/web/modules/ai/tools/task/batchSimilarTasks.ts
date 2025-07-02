import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';

interface TaskBatch {
  batchType: string;
  tasks: any[];
  commonalities: string[];
  estimatedMinutes: number;
  contextSwitches: number;
}

export const batchSimilarTasks = tool({
  description: 'Group similar tasks together to minimize context switching and optimize flow',
  parameters: z.object({
    strategy: z.enum(['by_type', 'by_project', 'by_context', 'by_duration']).default('by_context'),
    maxBatchSize: z.number().optional().default(5).describe('Maximum tasks per batch'),
    includeScheduled: z.boolean().optional().default(false).describe('Include already scheduled tasks'),
  }),
  execute: async ({ strategy, maxBatchSize, includeScheduled }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'batchSimilarTasks',
      operation: 'read' as const,
      resourceType: 'task' as const,
      startTime,
    };
    
    try {
      await ensureServicesConfigured();
      const taskService = ServiceFactory.getInstance().getTaskService();
      
      // Get tasks to batch
      let tasks: any[] = [];
      if (includeScheduled) {
        tasks = await taskService.searchTasks('');
      } else {
        tasks = await taskService.getUnassignedTasks();
      }
      
      if (tasks.length === 0) {
        return buildToolResponse(
          toolOptions,
          {
            batches: [],
            message: 'No tasks available to batch',
          },
          {
            type: 'card',
            title: 'No Tasks to Batch',
            description: 'No unassigned tasks found',
            priority: 'low',
            components: [],
          },
          {
            suggestions: ['Create some tasks first', 'Include scheduled tasks in batching'],
          }
        );
      }
      
      // Create batches based on strategy
      const batches: TaskBatch[] = [];
      
      switch (strategy) {
        case 'by_type':
          batches.push(...batchByType(tasks, maxBatchSize));
          break;
          
        case 'by_project':
          batches.push(...batchByProject(tasks, maxBatchSize));
          break;
          
        case 'by_context':
          batches.push(...batchByContext(tasks, maxBatchSize));
          break;
          
        case 'by_duration':
          batches.push(...batchByDuration(tasks, maxBatchSize));
          break;
      }
      
      // Calculate context switches saved
      const totalContextSwitches = tasks.length - 1;
      const batchedContextSwitches = batches.reduce((sum, batch) => 
        sum + (batch.tasks.length > 0 ? batch.tasks.length - 1 : 0), 0
      );
      const switchesSaved = totalContextSwitches - batchedContextSwitches;
      
      return buildToolResponse(
        toolOptions,
        {
          batches,
          summary: {
            totalTasks: tasks.length,
            batchCount: batches.length,
            contextSwitchesSaved: switchesSaved,
            efficiency: tasks.length > 0 
              ? Math.round((switchesSaved / totalContextSwitches) * 100)
              : 0,
          },
        },
        {
          type: 'list',
          title: 'Task Batches Created',
          description: `${batches.length} batches from ${tasks.length} tasks (${switchesSaved} context switches saved)`,
          priority: 'medium',
          components: batches.slice(0, 3).map(batch => ({
            type: 'taskCard',
            data: {
              id: `batch-${batch.batchType}`,
              title: `${batch.batchType} Batch`,
              priority: 'medium' as const,
              estimatedMinutes: batch.estimatedMinutes,
              status: 'backlog' as const,
              description: `${batch.tasks.length} tasks: ${batch.commonalities.join(', ')}`,
            },
          })),
        },
        {
          suggestions: [
            batches.length > 0 && batches[0] ? `Schedule the "${batches[0].batchType}" batch first` : null,
            switchesSaved > 10 ? 'Great batching! This will save significant context switching' : null,
            'Create time blocks for each batch',
            'Review batch details',
          ].filter(Boolean) as string[],
          notification: {
            show: true,
            type: 'success',
            message: `Created ${batches.length} task batches`,
            duration: 3000,
          },
          actions: batches.length > 0 ? [{
            id: 'schedule-batches',
            label: 'Schedule All Batches',
            variant: 'primary',
            action: {
              type: 'message',
              message: 'Schedule all task batches in my calendar',
            },
          }] : [],
        }
      );
      
    } catch (error) {
      console.error('[BATCH SIMILAR TASKS] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Batching Failed',
          description: 'Could not batch similar tasks.',
        }
      );
    }
  },
});

function batchByType(tasks: any[], maxBatchSize: number): TaskBatch[] {
  const typeGroups = new Map<string, any[]>();
  
  // Group by priority/type
  tasks.forEach(task => {
    const type = task.priority || 'medium';
    if (!typeGroups.has(type)) {
      typeGroups.set(type, []);
    }
    typeGroups.get(type)!.push(task);
  });
  
  // Create batches
  const batches: TaskBatch[] = [];
  typeGroups.forEach((groupTasks, type) => {
    // Split large groups into smaller batches
    for (let i = 0; i < groupTasks.length; i += maxBatchSize) {
      const batchTasks = groupTasks.slice(i, i + maxBatchSize);
      batches.push({
        batchType: `${type}-priority`,
        tasks: batchTasks,
        commonalities: [`${type} priority tasks`],
        estimatedMinutes: batchTasks.reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0),
        contextSwitches: batchTasks.length - 1,
      });
    }
  });
  
  return batches;
}

function batchByProject(tasks: any[], maxBatchSize: number): TaskBatch[] {
  const projectGroups = new Map<string, any[]>();
  
  // Extract project from task title/description
  tasks.forEach(task => {
    const text = `${task.title} ${task.description || ''}`.toLowerCase();
    let project = 'general';
    
    // Simple project detection (could be enhanced)
    if (text.includes('email')) project = 'email';
    else if (text.includes('meeting')) project = 'meetings';
    else if (text.includes('report') || text.includes('document')) project = 'documentation';
    else if (text.includes('code') || text.includes('fix') || text.includes('bug')) project = 'development';
    
    if (!projectGroups.has(project)) {
      projectGroups.set(project, []);
    }
    projectGroups.get(project)!.push(task);
  });
  
  // Create batches
  const batches: TaskBatch[] = [];
  projectGroups.forEach((groupTasks, project) => {
    for (let i = 0; i < groupTasks.length; i += maxBatchSize) {
      const batchTasks = groupTasks.slice(i, i + maxBatchSize);
      batches.push({
        batchType: project,
        tasks: batchTasks,
        commonalities: [`${project} related`],
        estimatedMinutes: batchTasks.reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0),
        contextSwitches: batchTasks.length - 1,
      });
    }
  });
  
  return batches;
}

function batchByContext(tasks: any[], maxBatchSize: number): TaskBatch[] {
  const contextGroups = new Map<string, any[]>();
  
  // Analyze task context
  tasks.forEach(task => {
    const contexts = extractContexts(task);
    
    // Add task to each relevant context
    contexts.forEach(context => {
      if (!contextGroups.has(context)) {
        contextGroups.set(context, []);
      }
      contextGroups.get(context)!.push(task);
    });
  });
  
  // Create batches, avoiding duplicates
  const batches: TaskBatch[] = [];
  const assignedTasks = new Set<string>();
  
  // Sort contexts by group size (larger groups first)
  const sortedContexts = Array.from(contextGroups.entries())
    .sort((a, b) => b[1].length - a[1].length);
  
  sortedContexts.forEach(([context, groupTasks]) => {
    const unassignedTasks = groupTasks.filter(t => !assignedTasks.has(t.id));
    
    if (unassignedTasks.length > 0) {
      for (let i = 0; i < unassignedTasks.length; i += maxBatchSize) {
        const batchTasks = unassignedTasks.slice(i, i + maxBatchSize);
        batchTasks.forEach(t => assignedTasks.add(t.id));
        
        batches.push({
          batchType: context,
          tasks: batchTasks,
          commonalities: [`${context} context`],
          estimatedMinutes: batchTasks.reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0),
          contextSwitches: batchTasks.length - 1,
        });
      }
    }
  });
  
  return batches;
}

function batchByDuration(tasks: any[], maxBatchSize: number): TaskBatch[] {
  const durationGroups = new Map<string, any[]>();
  
  // Group by duration ranges
  tasks.forEach(task => {
    const minutes = task.estimatedMinutes || 30;
    let group: string;
    
    if (minutes <= 15) group = 'quick-wins';
    else if (minutes <= 30) group = 'short-tasks';
    else if (minutes <= 60) group = 'medium-tasks';
    else group = 'deep-work';
    
    if (!durationGroups.has(group)) {
      durationGroups.set(group, []);
    }
    durationGroups.get(group)!.push(task);
  });
  
  // Create batches
  const batches: TaskBatch[] = [];
  durationGroups.forEach((groupTasks, duration) => {
    for (let i = 0; i < groupTasks.length; i += maxBatchSize) {
      const batchTasks = groupTasks.slice(i, i + maxBatchSize);
      batches.push({
        batchType: duration,
        tasks: batchTasks,
        commonalities: [duration.replace('-', ' ')],
        estimatedMinutes: batchTasks.reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0),
        contextSwitches: batchTasks.length - 1,
      });
    }
  });
  
  return batches.sort((a, b) => {
    // Sort by duration type (quick wins first)
    const order = ['quick-wins', 'short-tasks', 'medium-tasks', 'deep-work'];
    return order.indexOf(a.batchType) - order.indexOf(b.batchType);
  });
}

function extractContexts(task: any): string[] {
  const contexts: string[] = [];
  const text = `${task.title} ${task.description || ''}`.toLowerCase();
  
  // Communication context
  if (text.match(/email|message|respond|reply|contact/)) {
    contexts.push('communication');
  }
  
  // Administrative context
  if (text.match(/report|document|update|review|approve/)) {
    contexts.push('administrative');
  }
  
  // Creative context
  if (text.match(/design|create|write|plan|brainstorm/)) {
    contexts.push('creative');
  }
  
  // Technical context
  if (text.match(/code|fix|debug|implement|deploy|test/)) {
    contexts.push('technical');
  }
  
  // If no specific context found, use general
  if (contexts.length === 0) {
    contexts.push('general');
  }
  
  return contexts;
} 