import { tool } from 'ai';
import { z } from 'zod';
import { format } from 'date-fns';
import { ServiceFactory } from '@/services/factory/service.factory';
import type { ScheduleService } from '@/services/interfaces/schedule.interface';
import type { TaskService } from '@/services/interfaces/task.interface';

// Helper to get current user ID (will be provided by context)
function getCurrentUserId(): string {
  // This will be replaced with actual user ID from context
  if (typeof window === 'undefined' && (global as any).getCurrentUserId) {
    return (global as any).getCurrentUserId();
  }
  return 'current-user-id';
}

// Helper to format time block for AI response
function formatBlockForAI(block: any) {
  return {
    id: block.id,
    type: block.type,
    title: block.title,
    startTime: format(block.startTime, 'HH:mm'),
    endTime: format(block.endTime, 'HH:mm'),
    description: block.description
  };
}

// Helper to format task for AI response
function formatTaskForAI(task: any) {
  return {
    id: task.id,
    title: task.title,
    priority: task.priority,
    estimatedMinutes: task.estimatedMinutes,
    source: task.source
  };
}

export const createTimeBlock = tool({
  description: 'Create a new time block in the schedule',
  parameters: z.object({
    type: z.enum(['work', 'email', 'break', 'meeting', 'blocked']).describe('Type of time block'),
    title: z.string(),
    startTime: z.string().describe('Time in HH:MM format'),
    endTime: z.string().describe('Time in HH:MM format'),
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
  }),
  execute: async ({ type, title, startTime, endTime, date }) => {
    try {
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      
      // Get service from factory - it's already configured
      const factory = ServiceFactory.getInstance();
      const scheduleService = factory.getScheduleService();
      
      // Check for conflicts
      const hasConflict = await scheduleService.checkForConflicts(startTime, endTime, targetDate);
      if (hasConflict) {
        return {
          success: false,
          error: 'Time conflict detected. There is already a block scheduled at this time.'
        };
      }
      
      // Create the block
      const block = await scheduleService.createTimeBlock({
        type,
        title,
        startTime,
        endTime,
        date: targetDate,
      });
      
      return {
        success: true,
        blockId: block.id,
        message: `Created ${type} block "${title}" from ${startTime} to ${endTime}`,
      };
    } catch (error) {
      console.error('Error in createTimeBlock:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create time block'
      };
    }
  },
});

export const moveTimeBlock = tool({
  description: 'Move an existing time block to a new time',
  parameters: z.object({
    blockId: z.string(),
    newStartTime: z.string().describe('New start time in HH:MM format'),
    newEndTime: z.string().optional().describe('New end time in HH:MM format'),
  }),
  execute: async ({ blockId, newStartTime, newEndTime }) => {
    try {
      const factory = ServiceFactory.getInstance();
      const scheduleService = factory.getScheduleService();
      
      // Get the existing block
      const existingBlock = await scheduleService.getTimeBlock(blockId);
      if (!existingBlock) {
        return {
          success: false,
          error: 'Time block not found'
        };
      }
      
      // Calculate end time if not provided
      const endTime = newEndTime || calculateEndTime(newStartTime, existingBlock);
      const date = format(existingBlock.startTime, 'yyyy-MM-dd');
      
      // Check for conflicts
      const hasConflict = await scheduleService.checkForConflicts(
        newStartTime, 
        endTime, 
        date,
        blockId
      );
      
      if (hasConflict) {
        return {
          success: false,
          error: 'Cannot move block - time conflict detected'
        };
      }
      
      // Update the block
      const updated = await scheduleService.updateTimeBlock({
        id: blockId,
        startTime: newStartTime,
        endTime: endTime,
      });
      
      return {
        success: true,
        message: `Moved "${updated.title}" to ${newStartTime} - ${endTime}`,
      };
    } catch (error) {
      console.error('Error in moveTimeBlock:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to move time block'
      };
    }
  },
});

export const deleteTimeBlock = tool({
  description: 'Delete a time block from the schedule',
  parameters: z.object({
    blockId: z.string(),
    reason: z.string().optional(),
  }),
  execute: async ({ blockId, reason }) => {
    try {
      const factory = ServiceFactory.getInstance();
      const scheduleService = factory.getScheduleService();
      
      console.log('Attempting to delete block:', blockId);
      
      // Get the block details before deleting
      const block = await scheduleService.getTimeBlock(blockId);
      if (!block) {
        console.log('Block not found:', blockId);
        return {
          success: false,
          error: `Time block with ID ${blockId} not found. Please check the schedule first to get the correct block ID.`
        };
      }
      
      await scheduleService.deleteTimeBlock(blockId);
      
      return {
        success: true,
        message: `Deleted "${block.title}" block${reason ? ` (${reason})` : ''}`,
      };
    } catch (error) {
      console.error('Error in deleteTimeBlock:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete time block'
      };
    }
  },
});

export const assignTaskToBlock = tool({
  description: 'Assign a task to a specific time block',
  parameters: z.object({
    taskId: z.string(),
    blockId: z.string(),
  }),
  execute: async ({ taskId, blockId }) => {
    try {
      const factory = ServiceFactory.getInstance();
      const taskService = factory.getTaskService();
      const scheduleService = factory.getScheduleService();
      
      // Verify both exist
      const task = await taskService.getTask(taskId);
      const block = await scheduleService.getTimeBlock(blockId);
      
      if (!task) {
        return {
          success: false,
          error: 'Task not found'
        };
      }
      
      if (!block) {
        return {
          success: false,
          error: 'Time block not found'
        };
      }
      
      // Verify block type is appropriate
      if (block.type === 'break' || block.type === 'meeting') {
        return {
          success: false,
          error: `Cannot assign tasks to ${block.type} blocks`
        };
      }
      
      await taskService.assignTaskToBlock(taskId, blockId);
      
      return {
        success: true,
        message: `Assigned "${task.title}" to ${block.title} block`,
      };
    } catch (error) {
      console.error('Error in assignTaskToBlock:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to assign task to block'
      };
    }
  },
});

export const completeTask = tool({
  description: 'Mark a task as completed',
  parameters: z.object({
    taskId: z.string(),
  }),
  execute: async ({ taskId }) => {
    try {
      const factory = ServiceFactory.getInstance();
      const taskService = factory.getTaskService();
      
      const task = await taskService.getTask(taskId);
      if (!task) {
        return {
          success: false,
          error: 'Task not found'
        };
      }
      
      if (task.completed) {
        return {
          success: false,
          error: 'Task is already completed'
        };
      }
      
      await taskService.completeTask(taskId);
      
      return {
        success: true,
        message: `Completed "${task.title}"`,
      };
    } catch (error) {
      console.error('Error in completeTask:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete task'
      };
    }
  },
});

export const getSchedule = tool({
  description: 'Get the current schedule for a specific date',
  parameters: z.object({
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
  }),
  execute: async ({ date }) => {
    try {
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      const factory = ServiceFactory.getInstance();
      const scheduleService = factory.getScheduleService();
      
      console.log('Getting schedule for date:', targetDate);
      
      const blocks = await scheduleService.getScheduleForDate(targetDate);
      
      console.log('Retrieved blocks:', blocks.length);
      
      // Format for AI consumption, not direct display
      return {
        date: targetDate,
        blocks: blocks.map(formatBlockForAI),
        totalBlocks: blocks.length,
        hasBreak: blocks.some(b => b.type === 'break'),
        hasFocusTime: blocks.some(b => b.type === 'work'),
      };
    } catch (error) {
      console.error('Error in getSchedule tool:', error);
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Failed to get schedule',
        date: date || format(new Date(), 'yyyy-MM-dd'),
        blocks: [],
        totalBlocks: 0,
        hasBreak: false,
        hasFocusTime: false,
      };
    }
  },
});

export const getUnassignedTasks = tool({
  description: 'Get all tasks that are not yet scheduled',
  parameters: z.object({}),
  execute: async () => {
    const factory = ServiceFactory.getInstance();
    const taskService = factory.getTaskService();
    
    const tasks = await taskService.getUnassignedTasks();
    
    return { 
      tasks: tasks.map(formatTaskForAI),
      totalTasks: tasks.length,
      highPriorityCount: tasks.filter(t => t.priority === 'high').length,
    };
  },
});

// Helper function to calculate end time based on duration
function calculateEndTime(startTime: string, existingBlock: any): string {
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const duration = existingBlock.endTime.getTime() - existingBlock.startTime.getTime();
  const durationMinutes = Math.floor(duration / 60000);
  
  let endHours = startHours || 0;
  let endMinutes = (startMinutes || 0) + durationMinutes;
  
  while (endMinutes >= 60) {
    endHours++;
    endMinutes -= 60;
  }
  
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
} 