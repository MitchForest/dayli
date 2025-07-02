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

export const assignTaskToBlock = tool({
  description: 'Assign a task to a specific time block',
  parameters: z.object({
    taskId: z.string(),
    blockId: z.string(),
  }),
  execute: async ({ taskId, blockId }) => {
    try {
      const taskService = ServiceFactory.getInstance().getTaskService();
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      
      // Verify both exist
      const task = await taskService.getTask(taskId);
      const block = await scheduleService.getTimeBlock(blockId);
      
      if (!task) {
        return toolError(
          'TASK_NOT_FOUND',
          'Task not found'
        );
      }
      
      if (!block) {
        return toolError(
          'BLOCK_NOT_FOUND',
          'Time block not found'
        );
      }
      
      // Verify block type is appropriate
      if (block.type === 'break' || block.type === 'meeting') {
        return toolError(
          'INVALID_BLOCK_TYPE',
          `Cannot assign tasks to ${block.type} blocks. Tasks can only be assigned to work, email, or focus blocks.`,
          { blockType: block.type }
        );
      }
      
      // Check if task is already assigned somewhere
      if (task.status === 'scheduled') {
        return toolError(
          'TASK_ALREADY_SCHEDULED',
          'Task is already scheduled. Unassign it first before reassigning.',
          { currentStatus: task.status }
        );
      }
      
      // Calculate if task fits in block
      const blockDuration = (block.endTime.getTime() - block.startTime.getTime()) / (1000 * 60); // minutes
      if (task.estimatedMinutes > blockDuration) {
        return toolError(
          'TASK_TOO_LONG',
          `Task (${task.estimatedMinutes} min) is longer than the block (${blockDuration} min)`,
          { 
            taskDuration: task.estimatedMinutes,
            blockDuration: Math.floor(blockDuration)
          }
        );
      }
      
      await taskService.assignTaskToBlock(taskId, blockId);
      
      invalidateScheduleForDate(format(block.startTime, 'yyyy-MM-dd'));
      
      const result = {
        task: {
          id: task.id,
          title: task.title,
          estimatedMinutes: task.estimatedMinutes
        },
        block: {
          id: block.id,
          title: block.title,
          type: block.type,
          time: `${format(block.startTime, 'h:mm a')} - ${format(block.endTime, 'h:mm a')}`
        }
      };
      
      return toolSuccess(result, {
        type: 'text',
        content: `Assigned "${task.title}" to ${block.title} block at ${format(block.startTime, 'h:mm a')}`
      }, {
        affectedItems: [taskId, blockId],
        suggestions: [
          'Assign another task',
          'View updated schedule',
          'Complete this task'
        ]
      });
      
    } catch (error) {
      console.error('Error in assignTaskToBlock:', error);
      return toolError(
        'ASSIGNMENT_FAILED',
        `Failed to assign task to block: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
}); 