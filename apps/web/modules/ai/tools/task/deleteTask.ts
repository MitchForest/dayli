import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError, toolConfirmation } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';
import { ensureServicesConfigured } from '../utils/auth';

export const deleteTask = tool({
  description: "Delete a task permanently",
  parameters: z.object({
    taskId: z.string(),
    skipConfirmation: z.boolean().default(false),
  }),
  execute: async ({ taskId, skipConfirmation }) => {
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const taskService = ServiceFactory.getInstance().getTaskService();
      
      // Get task details first
      const task = await taskService.getTask(taskId);
      if (!task) {
        return toolError(
          'TASK_NOT_FOUND',
          `Task with ID ${taskId} not found`
        );
      }
      
      // If not confirmed, return confirmation request
      if (!skipConfirmation) {
        const confirmationId = crypto.randomUUID();
        
        return toolConfirmation(
          {
            taskId,
            task: {
              title: task.title,
              status: task.status,
              priority: task.priority,
              estimatedMinutes: task.estimatedMinutes
            }
          },
          confirmationId,
          `Are you sure you want to delete "${task.title}"? This action cannot be undone.`
        );
      }
      
      // Check if task is currently scheduled
      const wasScheduled = task.status === 'scheduled';
      
      // Delete the task
      await taskService.deleteTask(taskId);
      
      return toolSuccess({
        deleted: true,
        taskTitle: task.title,
        wasScheduled
      }, {
        type: 'text',
        content: `Task "${task.title}" has been deleted`
      }, {
        affectedItems: [taskId],
        suggestions: wasScheduled
          ? ['View updated schedule', 'Create new task', 'View remaining tasks']
          : ['Create new task', 'View all tasks', 'Undo (create similar task)']
      });
      
    } catch (error) {
      return toolError(
        'TASK_DELETE_FAILED',
        `Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
}); 