import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type ScheduleChange, type TimeBlock } from '../../schemas/schedule.schema';
import { type Task } from '../../schemas/task.schema';
import { buildToolResponse, buildErrorResponse, formatTime12Hour, formatTimeRange } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';
import { ensureServicesConfigured } from '../utils/auth';
import { toMilitaryTime } from '../../utils/time-parser';

export const assignTaskToBlock = tool({
  description: 'Assign a task to a time block',
  parameters: z.object({
    taskId: z.string().describe('ID of the task to assign'),
    blockDescription: z.string().describe('Description or title of the block'),
    date: z.string().optional().describe('Date in YYYY-MM-DD format, defaults to today'),
  }),
  execute: async ({ taskId, blockDescription, date }): Promise<UniversalToolResponse> => {
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
      
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      const taskService = ServiceFactory.getInstance().getTaskService();
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      
      // Get current schedule
      const schedule = await scheduleService.getScheduleForDate(targetDate);
      
      // Find the block by searching through titles and times
      let targetBlock = null;
      const searchLower = blockDescription.toLowerCase().trim();
      
      // First, try exact title match
      targetBlock = schedule.find(block => 
        block.title.toLowerCase() === searchLower
      );
      
      // If not found, try partial matches and time references
      if (!targetBlock) {
        // Check if searching by time
        const timeMatch = searchLower.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/);
        if (timeMatch && timeMatch[1]) {
          const searchTime = toMilitaryTime(timeMatch[1]);
          targetBlock = schedule.find(block => {
            const blockStart = format(block.startTime, 'HH:mm');
            return blockStart === searchTime;
          });
        }
        
        // Try partial title match
        if (!targetBlock) {
          targetBlock = schedule.find(block => 
            block.title.toLowerCase().includes(searchLower) ||
            searchLower.includes(block.title.toLowerCase())
          );
        }
        
        // Try type match
        if (!targetBlock) {
          targetBlock = schedule.find(block => 
            block.type.toLowerCase() === searchLower
          );
        }
      }
      
      if (!targetBlock) {
        return buildErrorResponse(
          toolOptions,
          { code: 'BLOCK_NOT_FOUND', message: 'Could not find a matching block' },
          {
            title: 'Block Not Found',
            description: `No block matching "${blockDescription}" found on ${targetDate}`,
          }
        );
      }
      
      // Verify block type is appropriate
      if (targetBlock.type === 'break' || targetBlock.type === 'meeting') {
        return buildErrorResponse(
          toolOptions,
          {
            code: 'INVALID_BLOCK_TYPE',
            message: `Cannot assign tasks to ${targetBlock.type} blocks`,
            blockType: targetBlock.type,
          },
          {
            title: 'Invalid Block Type',
            description: `Tasks can only be assigned to work, email, or focus blocks, not ${targetBlock.type} blocks.`,
          }
        );
      }
      
      // Verify task exists
      const task = await taskService.getTask(taskId);
      if (!task) {
        return buildErrorResponse(
          toolOptions,
          { code: 'TASK_NOT_FOUND', message: 'Task not found' },
          { title: 'Task Not Found' }
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
      const blockDuration = (targetBlock.endTime.getTime() - targetBlock.startTime.getTime()) / (1000 * 60); // minutes
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
      
      await taskService.assignTaskToBlock(taskId, targetBlock.id);
      
      console.log(`[AI Tools] Assigned task ${taskId} to block ${targetBlock.id}`);
      
      const taskData: Task = {
        id: task.id,
        title: task.title,
        status: 'scheduled',
        priority: task.priority || 'medium',
        estimatedMinutes: task.estimatedMinutes,
        description: task.description,
        source: task.source === 'chat' ? 'ai' : task.source as Task['source'],
        assignedToBlockId: targetBlock.id,
      };
      
      const blockData: TimeBlock = {
        id: targetBlock.id,
        type: targetBlock.type as TimeBlock['type'],
        title: targetBlock.title,
        startTime: formatTime12Hour(targetBlock.startTime),
        endTime: formatTime12Hour(targetBlock.endTime),
        description: targetBlock.description,
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
            blockId: targetBlock.id,
            assignedAt: new Date().toISOString(),
          },
        },
        {
          type: 'card',
          title: 'Task Assigned',
          description: `"${task.title}" assigned to ${targetBlock.title} block at ${formatTime12Hour(targetBlock.startTime)}`,
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