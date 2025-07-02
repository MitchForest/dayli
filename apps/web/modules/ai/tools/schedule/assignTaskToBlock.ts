import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type TimeBlock, type ScheduleUpdate } from '../../schemas/schedule.schema';
import { type Task } from '../../schemas/task.schema';
import { buildToolResponse, buildErrorResponse, formatTime12Hour, formatTimeRange } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';
import { ensureServicesConfigured } from '../utils/auth';

export const assignTaskToBlock = tool({
  description: 'Assign a task to a specific time block',
  parameters: z.object({
    taskId: z.string(),
    blockId: z.string(),
  }),
  execute: async ({ taskId, blockId }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'assignTaskToBlock',
      operation: 'update' as const,
      resourceType: 'schedule' as const,
      startTime,
    };
    
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const taskService = ServiceFactory.getInstance().getTaskService();
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      
      // Verify both exist
      const task = await taskService.getTask(taskId);
      const block = await scheduleService.getTimeBlock(blockId);
      
      if (!task) {
        return buildErrorResponse(
          toolOptions,
          { code: 'TASK_NOT_FOUND', message: 'Task not found' },
          { title: 'Task Not Found' }
        );
      }
      
      if (!block) {
        return buildErrorResponse(
          toolOptions,
          { code: 'BLOCK_NOT_FOUND', message: 'Time block not found' },
          { title: 'Block Not Found' }
        );
      }
      
      // Verify block type is appropriate
      if (block.type === 'break' || block.type === 'meeting') {
        return buildErrorResponse(
          toolOptions,
          {
            code: 'INVALID_BLOCK_TYPE',
            message: `Cannot assign tasks to ${block.type} blocks`,
            blockType: block.type,
          },
          {
            title: 'Invalid Block Type',
            description: `Tasks can only be assigned to work, email, or focus blocks, not ${block.type} blocks.`,
          }
        );
      }
      
      // Check if task is already assigned somewhere
      if (task.status === 'scheduled') {
        return buildErrorResponse(
          toolOptions,
          {
            code: 'TASK_ALREADY_SCHEDULED',
            message: 'Task is already scheduled',
            currentStatus: task.status,
          },
          {
            title: 'Task Already Scheduled',
            description: 'This task is already scheduled. Unassign it first before reassigning.',
          }
        );
      }
      
      // Calculate if task fits in block
      const blockDuration = (block.endTime.getTime() - block.startTime.getTime()) / (1000 * 60); // minutes
      if (task.estimatedMinutes > blockDuration) {
        return buildErrorResponse(
          toolOptions,
          {
            code: 'TASK_TOO_LONG',
            message: `Task duration exceeds block duration`,
            taskDuration: task.estimatedMinutes,
            blockDuration: Math.floor(blockDuration),
          },
          {
            title: 'Task Too Long',
            description: `Task (${task.estimatedMinutes} min) is longer than the block (${Math.floor(blockDuration)} min)`,
          }
        );
      }
      
      await taskService.assignTaskToBlock(taskId, blockId);
      
      console.log(`[AI Tools] Assigned task ${taskId} to block ${blockId}`);
      
      const taskData: Task = {
        id: task.id,
        title: task.title,
        status: 'scheduled',
        priority: task.priority || 'medium',
        estimatedMinutes: task.estimatedMinutes,
        description: task.description,
        source: task.source === 'chat' ? 'ai' : task.source as Task['source'],
        assignedToBlockId: blockId,
      };
      
      const blockData: TimeBlock = {
        id: block.id,
        type: block.type as TimeBlock['type'],
        title: block.title,
        startTime: formatTime12Hour(block.startTime),
        endTime: formatTime12Hour(block.endTime),
        description: block.description,
        tasks: [{
          id: task.id,
          title: task.title,
          estimatedMinutes: task.estimatedMinutes,
          completed: false,
        }],
      };
      
      return buildToolResponse(
        toolOptions,
        {
          task: taskData,
          block: blockData,
          assignment: {
            taskId,
            blockId,
            assignedAt: new Date().toISOString(),
          },
        },
        {
          type: 'card',
          title: 'Task Assigned',
          description: `"${task.title}" assigned to ${block.title} block at ${formatTime12Hour(block.startTime)}`,
          priority: 'medium',
          components: [
            {
              type: 'taskCard',
              data: taskData,
            },
            {
              type: 'scheduleBlock',
              data: blockData,
            },
          ],
        },
        {
          notification: {
            show: true,
            type: 'success',
            message: 'Task assigned successfully',
            duration: 3000,
          },
          suggestions: [
            'Assign another task',
            'View updated schedule',
            'Complete this task',
          ],
          actions: [
            {
              id: 'view-schedule',
              label: 'View Schedule',
              icon: 'calendar',
              variant: 'primary',
              action: {
                type: 'tool',
                tool: 'getSchedule',
                params: {},
              },
            },
            {
              id: 'complete-task',
              label: 'Complete Task',
              icon: 'check',
              variant: 'secondary',
              action: {
                type: 'tool',
                tool: 'completeTask',
                params: { taskId },
              },
            },
          ],
        }
      );
      
    } catch (error) {
      console.error('Error in assignTaskToBlock:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to assign task',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
}); 