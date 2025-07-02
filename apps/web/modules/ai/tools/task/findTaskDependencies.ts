import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';

interface TaskDependency {
  taskId: string;
  taskTitle: string;
  dependsOn: {
    taskId: string;
    taskTitle: string;
    type: 'blocking' | 'related' | 'optional';
    reason: string;
  }[];
  blockedBy: {
    taskId: string;
    taskTitle: string;
    type: 'blocking' | 'related' | 'optional';
    reason: string;
  }[];
}

export const findTaskDependencies = tool({
  description: 'Identify dependencies between tasks to determine execution order',
  parameters: z.object({
    taskId: z.string().optional().describe('Find dependencies for specific task'),
    analyzeAll: z.boolean().optional().default(false).describe('Analyze all unassigned tasks'),
  }),
  execute: async ({ taskId, analyzeAll }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'findTaskDependencies',
      operation: 'read' as const,
      resourceType: 'task' as const,
      startTime,
    };
    
    try {
      await ensureServicesConfigured();
      const taskService = ServiceFactory.getInstance().getTaskService();
      
      if (!taskId && !analyzeAll) {
        throw new Error('Either taskId or analyzeAll must be specified');
      }
      
      // Get tasks to analyze
      let tasksToAnalyze: any[] = [];
      let targetTask: any = null;
      
      if (taskId) {
        targetTask = await taskService.getTask(taskId);
        if (!targetTask) throw new Error('Task not found');
        tasksToAnalyze = [targetTask];
      }
      
      if (analyzeAll || !taskId) {
        const allTasks = await taskService.getUnassignedTasks();
        if (taskId) {
          // Get all other tasks for dependency analysis
          tasksToAnalyze = [targetTask];
        } else {
          tasksToAnalyze = allTasks;
        }
      }
      
      // Get all tasks for comparison
      const allTasks = await taskService.searchTasks('');
      
      // Analyze dependencies
      const dependencies: TaskDependency[] = [];
      
      for (const task of tasksToAnalyze) {
        const taskDeps: TaskDependency = {
          taskId: task.id,
          taskTitle: task.title,
          dependsOn: [],
          blockedBy: [],
        };
        
        // Analyze relationships with other tasks
        for (const otherTask of allTasks) {
          if (otherTask.id === task.id) continue;
          
          const relationship = analyzeDependency(task, otherTask);
          
          if (relationship) {
            if (relationship.direction === 'depends_on') {
              taskDeps.dependsOn.push({
                taskId: otherTask.id,
                taskTitle: otherTask.title,
                type: relationship.type,
                reason: relationship.reason,
              });
            } else if (relationship.direction === 'blocks') {
              taskDeps.blockedBy.push({
                taskId: otherTask.id,
                taskTitle: otherTask.title,
                type: relationship.type,
                reason: relationship.reason,
              });
            }
          }
        }
        
        // Only include tasks with dependencies
        if (taskDeps.dependsOn.length > 0 || taskDeps.blockedBy.length > 0) {
          dependencies.push(taskDeps);
        }
      }
      
      // Create dependency graph summary
      const totalDependencies = dependencies.reduce(
        (sum, d) => sum + d.dependsOn.length + d.blockedBy.length, 0
      );
      
      const blockingDependencies = dependencies.reduce(
        (sum, d) => sum + 
          d.dependsOn.filter(dep => dep.type === 'blocking').length +
          d.blockedBy.filter(dep => dep.type === 'blocking').length, 
        0
      );
      
      return buildToolResponse(
        toolOptions,
        {
          dependencies,
          summary: {
            tasksAnalyzed: tasksToAnalyze.length,
            tasksWithDependencies: dependencies.length,
            totalDependencies,
            blockingDependencies,
          },
        },
        {
          type: 'list',
          title: 'Task Dependencies',
          description: `Found ${totalDependencies} dependencies (${blockingDependencies} blocking)`,
          priority: blockingDependencies > 0 ? 'high' : 'medium',
          components: dependencies.slice(0, 3).map(dep => ({
            type: 'taskCard',
            data: {
              id: dep.taskId,
              title: dep.taskTitle,
              priority: dep.dependsOn.some(d => d.type === 'blocking') ? 'high' : 'medium',
              estimatedMinutes: 30,
              status: 'backlog' as const,
              description: `Depends on: ${dep.dependsOn.length} tasks, Blocks: ${dep.blockedBy.length} tasks`,
            },
          })),
        },
        {
          suggestions: [
            blockingDependencies > 0 ? 'Schedule blocking tasks first' : null,
            dependencies.length > 5 ? 'Create a project plan' : null,
            'Visualize dependency graph',
            'Find critical path',
          ].filter(Boolean) as string[],
          notification: {
            show: true,
            type: blockingDependencies > 0 ? 'warning' : 'info',
            message: `${dependencies.length} tasks have dependencies`,
            duration: 3000,
          },
          actions: blockingDependencies > 0 ? [{
            id: 'resolve-blockers',
            label: 'Show Blocking Tasks',
            variant: 'primary',
            action: {
              type: 'message',
              message: 'Show me all blocking dependencies',
            },
          }] : [],
        }
      );
      
    } catch (error) {
      console.error('[FIND TASK DEPENDENCIES] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Analysis Failed',
          description: 'Could not analyze task dependencies.',
        }
      );
    }
  },
});

function analyzeDependency(task1: any, task2: any): {
  direction: 'depends_on' | 'blocks' | null;
  type: 'blocking' | 'related' | 'optional';
  reason: string;
} | null {
  const task1Text = `${task1.title} ${task1.description || ''}`.toLowerCase();
  const task2Text = `${task2.title} ${task2.description || ''}`.toLowerCase();
  
  // Check for explicit dependencies in text
  if (task1Text.includes(`after ${task2.title.toLowerCase()}`) ||
      task1Text.includes(`requires ${task2.title.toLowerCase()}`) ||
      task1Text.includes(`depends on ${task2.title.toLowerCase()}`)) {
    return {
      direction: 'depends_on',
      type: 'blocking',
      reason: 'Explicit dependency mentioned',
    };
  }
  
  // Check for sequential indicators
  const sequentialPatterns = [
    { pattern: /step (\d+)/i, extract: (m: RegExpMatchArray) => parseInt(m[1] || '0') },
    { pattern: /phase (\d+)/i, extract: (m: RegExpMatchArray) => parseInt(m[1] || '0') },
    { pattern: /part (\d+)/i, extract: (m: RegExpMatchArray) => parseInt(m[1] || '0') },
  ];
  
  for (const { pattern, extract } of sequentialPatterns) {
    const match1 = task1.title.match(pattern);
    const match2 = task2.title.match(pattern);
    
    if (match1 && match2) {
      const num1 = extract(match1);
      const num2 = extract(match2);
      
      if (num1 > num2) {
        return {
          direction: 'depends_on',
          type: 'blocking',
          reason: `${task1.title} comes after ${task2.title}`,
        };
      } else if (num1 < num2) {
        return {
          direction: 'blocks',
          type: 'blocking',
          reason: `${task1.title} must complete before ${task2.title}`,
        };
      }
    }
  }
  
  // Check for data dependencies
  if (task1Text.includes('analyze') && task2Text.includes('collect')) {
    return {
      direction: 'depends_on',
      type: 'blocking',
      reason: 'Analysis requires data collection first',
    };
  }
  
  if (task1Text.includes('implement') && task2Text.includes('design')) {
    return {
      direction: 'depends_on',
      type: 'blocking',
      reason: 'Implementation requires design first',
    };
  }
  
  if (task1Text.includes('test') && task2Text.includes('implement')) {
    return {
      direction: 'depends_on',
      type: 'blocking',
      reason: 'Testing requires implementation first',
    };
  }
  
  // Check for related tasks (same project/area)
  const commonWords = findCommonSignificantWords(task1Text, task2Text);
  if (commonWords.length >= 2) {
    return {
      direction: 'depends_on',
      type: 'related',
      reason: `Related tasks: ${commonWords.join(', ')}`,
    };
  }
  
  return null;
}

function findCommonSignificantWords(text1: string, text2: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'been']);
  
  const words1 = new Set(
    text1.split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w))
  );
  
  const words2 = new Set(
    text2.split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w))
  );
  
  return [...words1].filter(w => words2.has(w));
} 