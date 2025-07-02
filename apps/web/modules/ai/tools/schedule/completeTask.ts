import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';
import { useScheduleStore } from '@/modules/schedule/store/scheduleStore';

// Helper to invalidate schedule after changes
function invalidateScheduleForDate(date: string) {
  const { invalidateSchedule } = useScheduleStore.getState();
  invalidateSchedule(date);
}

export const completeTask = tool({
  description: 'Mark a task as completed',
  parameters: z.object({
    taskId: z.string(),
    notes: z.string().optional().describe('Completion notes or outcomes'),
  }),
  execute: async ({ taskId, notes }) => {
    try {
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
      
      // Invalidate today's schedule since we don't know which date the task is on
      invalidateScheduleForDate(format(new Date(), 'yyyy-MM-dd'));
      
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