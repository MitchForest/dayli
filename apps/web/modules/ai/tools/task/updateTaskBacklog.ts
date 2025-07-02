import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';
import { differenceInDays } from 'date-fns';

export const updateTaskBacklog = tool({
  description: 'Update task backlog by adding, removing, or modifying task priority/aging',
  parameters: z.object({
    action: z.enum(['add', 'remove', 'update_priority', 'refresh_aging']),
    taskId: z.string().optional().describe('Task ID for remove/update actions'),
    taskDetails: z.object({
      title: z.string(),
      description: z.string().optional(),
      estimatedMinutes: z.number().optional(),
      priority: z.enum(['high', 'medium', 'low']).optional(),
      source: z.enum(['email', 'chat', 'calendar', 'manual']).optional(),
    }).optional().describe('Task details for add action'),
    newPriority: z.enum(['high', 'medium', 'low']).optional().describe('New priority for update action'),
  }),
  execute: async ({ action, taskId, taskDetails, newPriority }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    let operation: 'create' | 'read' | 'update' | 'delete' | 'execute';
    if (action === 'add') {
      operation = 'create';
    } else if (action === 'remove') {
      operation = 'delete';
    } else {
      operation = 'update';
    }
    
    const toolOptions = {
      toolName: 'updateTaskBacklog',
      operation,
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
      
      let result: any = null;
      let message = '';
      
      switch (action) {
        case 'add':
          if (!taskDetails) {
            throw new Error('Task details required for add action');
          }
          
          // Create new task in backlog
          const newTask = await taskService.createTask({
            title: taskDetails.title,
            description: taskDetails.description,
            estimatedMinutes: taskDetails.estimatedMinutes,
            priority: taskDetails.priority,
            source: taskDetails.source,
          });
          
          result = newTask;
          message = `Added "${newTask.title}" to backlog`;
          break;
          
        case 'remove':
          if (!taskId) {
            throw new Error('Task ID required for remove action');
          }
          
          // Delete task
          await taskService.deleteTask(taskId);
          result = { taskId, removed: true };
          message = 'Task removed from backlog';
          break;
          
        case 'update_priority':
          if (!taskId || !newPriority) {
            throw new Error('Task ID and new priority required for update action');
          }
          
          // Update task priority
          const updatedTask = await taskService.updateTask(taskId, {
            priority: newPriority,
          });
          
          result = updatedTask;
          message = `Updated priority to ${newPriority}`;
          break;
          
        case 'refresh_aging':
          // Get all backlog tasks and calculate aging
          const backlogTasks = await taskService.getTasksByStatus('backlog');
          
          const agingStats = backlogTasks.map(task => {
            const ageInDays = differenceInDays(new Date(), new Date(task.createdAt || new Date()));
            return {
              id: task.id,
              title: task.title,
              ageInDays,
              isStale: ageInDays > 7,
              isCritical: ageInDays > 14,
            };
          });
          
          const staleTasks = agingStats.filter(t => t.isStale).length;
          const criticalTasks = agingStats.filter(t => t.isCritical).length;
          
          result = {
            totalTasks: backlogTasks.length,
            staleTasks,
            criticalTasks,
            agingStats: agingStats.slice(0, 5), // Top 5 oldest
          };
          message = `Backlog refreshed: ${staleTasks} stale, ${criticalTasks} critical`;
          break;
      }
      
      // Get updated backlog stats
      const backlogTasks = await taskService.getTaskBacklog();
      const highPriorityCount = backlogTasks.filter(t => t.priority === 'high').length;
      const totalEstimatedHours = backlogTasks.reduce((sum, t) => 
        sum + (t.estimatedMinutes || 30), 0
      ) / 60;
      
      return buildToolResponse(
        toolOptions,
        {
          action,
          result,
          backlogStats: {
            totalTasks: backlogTasks.length,
            highPriorityTasks: highPriorityCount,
            estimatedHours: Math.round(totalEstimatedHours * 10) / 10,
          },
        },
        {
          type: 'card',
          title: 'Backlog Updated',
          description: message,
          priority: action === 'refresh_aging' && result.criticalTasks > 0 ? 'high' : 'medium',
          components: [
            {
              type: 'progressIndicator',
              data: {
                current: highPriorityCount,
                total: backlogTasks.length,
                label: 'High Priority Tasks',
                percentage: backlogTasks.length > 0 
                  ? Math.round((highPriorityCount / backlogTasks.length) * 100)
                  : 0,
              },
            },
          ],
        },
        {
          suggestions: [
            backlogTasks.length > 20 ? 'Consider archiving old tasks' : null,
            highPriorityCount > 5 ? 'Too many high priority tasks - reprioritize' : null,
            totalEstimatedHours > 40 ? 'Backlog is large - schedule a planning session' : null,
            'View full backlog',
          ].filter(Boolean) as string[],
          notification: {
            show: true,
            type: action === 'add' ? 'success' : 'info',
            message,
            duration: 3000,
          },
        }
      );
      
    } catch (error) {
      console.error('[UPDATE TASK BACKLOG] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Backlog Update Failed',
          description: 'Could not update task backlog.',
        }
      );
    }
  },
}); 