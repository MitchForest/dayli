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
    type: z.enum(['focus', 'email', 'break', 'meeting', 'blocked']),
    title: z.string(),
    startTime: z.string().describe('Time in HH:MM format'),
    endTime: z.string().describe('Time in HH:MM format'),
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
  }),
  execute: async ({ type, title, startTime, endTime, date }) => {
    const targetDate = date || format(new Date(), 'yyyy-MM-dd');
    const userId = getCurrentUserId();
    
    // Get service from factory
    const factory = ServiceFactory.getInstance();
    factory.configure({ userId }, true); // Using mock for now
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
    const userId = getCurrentUserId();
    const factory = ServiceFactory.getInstance();
    factory.configure({ userId }, true);
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
  },
});

export const deleteTimeBlock = tool({
  description: 'Delete a time block from the schedule',
  parameters: z.object({
    blockId: z.string(),
    reason: z.string().optional(),
  }),
  execute: async ({ blockId, reason }) => {
    const userId = getCurrentUserId();
    const factory = ServiceFactory.getInstance();
    factory.configure({ userId }, true);
    const scheduleService = factory.getScheduleService();
    
    // Get the block details before deleting
    const block = await scheduleService.getTimeBlock(blockId);
    if (!block) {
      return {
        success: false,
        error: 'Time block not found'
      };
    }
    
    await scheduleService.deleteTimeBlock(blockId);
    
    return {
      success: true,
      message: `Deleted "${block.title}" block${reason ? ` (${reason})` : ''}`,
    };
  },
});

export const assignTaskToBlock = tool({
  description: 'Assign a task to a specific time block',
  parameters: z.object({
    taskId: z.string(),
    blockId: z.string(),
  }),
  execute: async ({ taskId, blockId }) => {
    const userId = getCurrentUserId();
    const factory = ServiceFactory.getInstance();
    factory.configure({ userId }, true);
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
  },
});

export const completeTask = tool({
  description: 'Mark a task as completed',
  parameters: z.object({
    taskId: z.string(),
  }),
  execute: async ({ taskId }) => {
    const userId = getCurrentUserId();
    const factory = ServiceFactory.getInstance();
    factory.configure({ userId }, true);
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
  },
});

export const getSchedule = tool({
  description: 'Get the current schedule for a specific date',
  parameters: z.object({
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
  }),
  execute: async ({ date }) => {
    const targetDate = date || format(new Date(), 'yyyy-MM-dd');
    const userId = getCurrentUserId();
    const factory = ServiceFactory.getInstance();
    factory.configure({ userId }, true);
    const scheduleService = factory.getScheduleService();
    
    const blocks = await scheduleService.getScheduleForDate(targetDate);
    
    // Format for AI consumption, not direct display
    return {
      date: targetDate,
      blocks: blocks.map(formatBlockForAI),
      totalBlocks: blocks.length,
      hasBreak: blocks.some(b => b.type === 'break'),
      hasFocusTime: blocks.some(b => b.type === 'focus'),
    };
  },
});

export const getUnassignedTasks = tool({
  description: 'Get all tasks that are not yet scheduled',
  parameters: z.object({}),
  execute: async () => {
    const userId = getCurrentUserId();
    const factory = ServiceFactory.getInstance();
    factory.configure({ userId }, true);
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