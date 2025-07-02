import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';

interface OrderedTask {
  position: number;
  task: any;
  reasoning: string[];
  score: number;
}

export const suggestTaskOrder = tool({
  description: 'Suggest optimal task execution order based on dependencies, energy, and context',
  parameters: z.object({
    timeFrame: z.enum(['today', 'this_week', 'all']).default('today'),
    considerEnergy: z.boolean().optional().default(true).describe('Factor in energy levels'),
    respectDependencies: z.boolean().optional().default(true).describe('Respect task dependencies'),
  }),
  execute: async ({ timeFrame, considerEnergy, respectDependencies }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'suggestTaskOrder',
      operation: 'execute' as const,
      resourceType: 'task' as const,
      startTime,
    };
    
    try {
      await ensureServicesConfigured();
      const taskService = ServiceFactory.getInstance().getTaskService();
      const supabase = await createServerActionClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      // Get user preferences
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      // Get unassigned tasks
      let tasks = await taskService.getUnassignedTasks();
      
      if (tasks.length === 0) {
        return buildToolResponse(
          toolOptions,
          {
            orderedTasks: [],
            message: 'No unassigned tasks to order',
          },
          {
            type: 'card',
            title: 'No Tasks to Order',
            description: 'All tasks are already scheduled',
            priority: 'low',
            components: [],
          },
          {
            suggestions: ['Create new tasks', 'Review scheduled tasks'],
          }
        );
      }
      
      // Filter by timeframe
      if (timeFrame === 'today') {
        // Estimate we can do about 6 hours of focused work
        const availableMinutes = 360;
        tasks = filterTasksByTime(tasks, availableMinutes);
      } else if (timeFrame === 'this_week') {
        // About 30 hours for the week
        const availableMinutes = 1800;
        tasks = filterTasksByTime(tasks, availableMinutes);
      }
      
      // Score and order tasks
      const orderedTasks: OrderedTask[] = [];
      const remainingTasks = [...tasks];
      let position = 1;
      
      // Get task dependencies if needed
      let dependencies: Map<string, Set<string>> = new Map();
      if (respectDependencies) {
        dependencies = await getTaskDependencies(tasks, taskService);
      }
      
      while (remainingTasks.length > 0) {
        let bestTask: any = null;
        let bestScore = -1;
        let bestReasons: string[] = [];
        
        for (const task of remainingTasks) {
          // Check if task has unmet dependencies
          if (respectDependencies && dependencies.has(task.id)) {
            const deps = dependencies.get(task.id)!;
            const unmetDeps = [...deps].filter(depId => 
              remainingTasks.some(t => t.id === depId)
            );
            if (unmetDeps.length > 0) continue;
          }
          
          const { score, reasons } = scoreTaskForPosition(
            task, 
            position, 
            orderedTasks, 
            preferences,
            considerEnergy
          );
          
          if (score > bestScore) {
            bestScore = score;
            bestTask = task;
            bestReasons = reasons;
          }
        }
        
        if (!bestTask) {
          // No valid task found (all have dependencies), pick first
          bestTask = remainingTasks[0];
          bestReasons = ['No other options due to dependencies'];
          bestScore = 0;
        }
        
        orderedTasks.push({
          position,
          task: bestTask,
          reasoning: bestReasons,
          score: bestScore,
        });
        
        remainingTasks.splice(remainingTasks.indexOf(bestTask), 1);
        position++;
      }
      
      // Calculate total time and context switches
      const totalMinutes = orderedTasks.reduce((sum, ot) => 
        sum + (ot.task.estimatedMinutes || 30), 0
      );
      
      const contextSwitches = calculateContextSwitches(orderedTasks);
      
      return buildToolResponse(
        toolOptions,
        {
          orderedTasks,
          summary: {
            totalTasks: orderedTasks.length,
            totalMinutes,
            totalHours: Math.round(totalMinutes / 60 * 10) / 10,
            contextSwitches,
            timeFrame,
          },
        },
        {
          type: 'list',
          title: 'Suggested Task Order',
          description: `${orderedTasks.length} tasks ordered for ${timeFrame} (${Math.round(totalMinutes / 60)} hours)`,
          priority: 'medium',
          components: orderedTasks.slice(0, 5).map(ot => ({
            type: 'taskCard',
            data: {
              id: ot.task.id,
              title: `${ot.position}. ${ot.task.title}`,
              priority: ot.task.priority || 'medium',
              estimatedMinutes: ot.task.estimatedMinutes || 30,
              status: 'backlog' as const,
              description: ot.reasoning.join('; '),
              score: ot.score,
            },
          })),
        },
        {
          suggestions: [
            orderedTasks[0] ? `Start with "${orderedTasks[0].task.title}"` : null,
            contextSwitches > 5 ? 'Consider batching similar tasks' : null,
            totalMinutes > 480 ? 'This is a full day - consider breaks' : null,
            'Create time blocks for this order',
          ].filter(Boolean) as string[],
          notification: {
            show: true,
            type: 'success',
            message: `Optimized order for ${orderedTasks.length} tasks`,
            duration: 3000,
          },
          actions: [{
            id: 'schedule-order',
            label: 'Schedule in This Order',
            variant: 'primary',
            action: {
              type: 'message',
              message: `Schedule these ${orderedTasks.length} tasks in the suggested order`,
            },
          }],
        }
      );
      
    } catch (error) {
      console.error('[SUGGEST TASK ORDER] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Ordering Failed',
          description: 'Could not suggest task order.',
        }
      );
    }
  },
});

function filterTasksByTime(tasks: any[], availableMinutes: number): any[] {
  // Sort by priority and estimated time
  const sorted = [...tasks].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1;
    
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    // Prefer shorter tasks if same priority
    return (a.estimatedMinutes || 30) - (b.estimatedMinutes || 30);
  });
  
  // Take tasks that fit in available time
  const selected: any[] = [];
  let totalMinutes = 0;
  
  for (const task of sorted) {
    const taskMinutes = task.estimatedMinutes || 30;
    if (totalMinutes + taskMinutes <= availableMinutes) {
      selected.push(task);
      totalMinutes += taskMinutes;
    }
  }
  
  return selected;
}

async function getTaskDependencies(
  tasks: any[], 
  taskService: any
): Promise<Map<string, Set<string>>> {
  const dependencies = new Map<string, Set<string>>();
  
  // Simple dependency detection based on task titles
  for (const task of tasks) {
    const taskDeps = new Set<string>();
    
    for (const otherTask of tasks) {
      if (task.id === otherTask.id) continue;
      
      const taskText = task.title.toLowerCase();
      const otherTitle = otherTask.title.toLowerCase();
      
      // Check for explicit dependencies
      if (taskText.includes(`after ${otherTitle}`) ||
          taskText.includes(`requires ${otherTitle}`)) {
        taskDeps.add(otherTask.id);
      }
      
      // Check for sequential patterns
      const taskMatch = task.title.match(/step (\d+)/i);
      const otherMatch = otherTask.title.match(/step (\d+)/i);
      
      if (taskMatch && otherMatch) {
        const taskNum = parseInt(taskMatch[1] || '0');
        const otherNum = parseInt(otherMatch[1] || '0');
        if (taskNum > otherNum) {
          taskDeps.add(otherTask.id);
        }
      }
    }
    
    if (taskDeps.size > 0) {
      dependencies.set(task.id, taskDeps);
    }
  }
  
  return dependencies;
}

function scoreTaskForPosition(
  task: any,
  position: number,
  orderedTasks: OrderedTask[],
  preferences: any,
  considerEnergy: boolean
): { score: number; reasons: string[] } {
  let score = 50; // Base score
  const reasons: string[] = [];
  
  // Priority scoring
  if (task.priority === 'high') {
    score += 30;
    reasons.push('High priority');
  } else if (task.priority === 'low') {
    score -= 10;
    reasons.push('Low priority');
  }
  
  // Quick wins early
  if (position <= 3 && task.estimatedMinutes <= 15) {
    score += 20;
    reasons.push('Quick win to build momentum');
  }
  
  // Energy considerations
  if (considerEnergy) {
    const isComplexTask = (task.estimatedMinutes || 30) > 60 ||
      task.title.toLowerCase().match(/complex|difficult|analyze|design/);
    
    if (position <= 2 && isComplexTask) {
      score += 15;
      reasons.push('Complex task when energy is high');
    } else if (position > 5 && isComplexTask) {
      score -= 15;
      reasons.push('Complex task better earlier');
    }
    
    // Prefer admin tasks in the afternoon
    if (position > 4 && task.title.toLowerCase().match(/email|admin|review|approve/)) {
      score += 10;
      reasons.push('Administrative task for lower energy');
    }
  }
  
  // Context switching penalty
  if (orderedTasks.length > 0) {
    const prevTask = orderedTasks[orderedTasks.length - 1]?.task;
    if (prevTask) {
      const similarity = calculateTaskSimilarity(task, prevTask);
      
      if (similarity > 0.5) {
        score += 15;
        reasons.push('Similar to previous task');
      } else if (similarity < 0.2) {
        score -= 5;
        reasons.push('Context switch');
      }
    }
  }
  
  // Deadline urgency
  if (task.dueDate) {
    const hoursUntilDue = (new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilDue < 24) {
      score += 40;
      reasons.push('Due soon');
    } else if (hoursUntilDue < 72) {
      score += 20;
      reasons.push('Due this week');
    }
  }
  
  return { score, reasons };
}

function calculateTaskSimilarity(task1: any, task2: any): number {
  const text1 = `${task1.title} ${task1.description || ''}`.toLowerCase();
  const text2 = `${task2.title} ${task2.description || ''}`.toLowerCase();
  
  const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 3));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

function calculateContextSwitches(orderedTasks: OrderedTask[]): number {
  let switches = 0;
  
  for (let i = 1; i < orderedTasks.length; i++) {
    const currentTask = orderedTasks[i];
    const prevTask = orderedTasks[i - 1];
    
    if (currentTask && prevTask) {
      const similarity = calculateTaskSimilarity(
        currentTask.task,
        prevTask.task
      );
      
      if (similarity < 0.3) {
        switches++;
      }
    }
  }
  
  return switches;
} 