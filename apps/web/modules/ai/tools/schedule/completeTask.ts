import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';
import { ensureServicesConfigured } from '../utils/auth';

export const completeTask = tool({
  description: 'Mark a task as completed',
  parameters: z.object({
    taskId: z.string(),
    notes: z.string().optional().describe('Completion notes or outcomes'),
  }),
  execute: async ({ taskId, notes }) => {
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const taskService = ServiceFactory.getInstance().getTaskService();
      
      const task = await taskService.getTask(taskId);
      if (!task) {
        return toolError(
          'TASK_NOT_FOUND',
          'Task not found'
        );
      }
      
      if (task.status === 'completed') {
        return toolError(
          'TASK_ALREADY_COMPLETED',
          'Task is already completed'
        );
      }
      
      // Complete the task
      const completedTask = await taskService.completeTask(taskId);
      
      // If task had notes, append completion notes
      if (notes) {
        const updatedNotes = task.description 
          ? `${task.description}\n\nCompletion notes: ${notes}`
          : `Completion notes: ${notes}`;
          
        await taskService.updateTask(taskId, { description: updatedNotes });
      }
      
      // Note: Schedule invalidation should be handled by the service or UI layer
      console.log(`[AI Tools] Completed task ${taskId}`);
      
      // Calculate time saved/spent
      const timeInfo = task.estimatedMinutes
        ? `Estimated time was ${task.estimatedMinutes} minutes`
        : 'No time estimate was set';
      
      const result = {
        task: {
          id: completedTask.id,
          title: completedTask.title,
          completedAt: new Date().toISOString(),
          estimatedMinutes: task.estimatedMinutes,
          priority: task.priority
        },
        notes,
        timeInfo
      };
      
      return toolSuccess(result, {
        type: 'text',
        content: `✅ Completed "${completedTask.title}". ${timeInfo}.`
      }, {
        affectedItems: [taskId],
        suggestions: [
          'View remaining tasks',
          'Complete another task',
          'Review today\'s progress',
          'Schedule tomorrow'
        ]
      });
      
    } catch (error) {
      console.error('Error in completeTask:', error);
      return toolError(
        'TASK_COMPLETE_FAILED',
        `Failed to complete task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
}); 