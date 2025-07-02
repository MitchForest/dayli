import { tool } from 'ai';
import { z } from 'zod';
import { format, parse, isValid } from 'date-fns';
import { ServiceFactory } from '@/services/factory/service.factory';
import type { ScheduleService } from '@/services/interfaces/schedule.interface';
import type { TaskService } from '@/services/interfaces/task.interface';
import { useScheduleStore } from '@/modules/schedule/store/scheduleStore';

// Helper to ensure services are configured
function ensureServicesConfigured() {
  const factory = ServiceFactory.getInstance();
  if (!factory.isConfigured()) {
    throw new Error('Services not configured. User must be authenticated.');
  }
  return factory;
}

// Helper to parse various time formats to 24-hour format
function parseTimeToMilitary(timeStr: string): string | null {
  // Remove extra spaces and convert to lowercase for easier parsing
  const cleanTime = timeStr.trim().toLowerCase();
  
  // Try various formats
  const formats = [
    { regex: /^(\d{1,2}):(\d{2})\s*(am|pm)$/i, parse: (match: RegExpMatchArray) => {
      let hours = parseInt(match[1] || '0');
      const minutes = match[2] || '00';
      const period = (match[3] || '').toLowerCase();
      
      if (period === 'pm' && hours !== 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;
      
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }},
    { regex: /^(\d{1,2})\s*(am|pm)$/i, parse: (match: RegExpMatchArray) => {
      let hours = parseInt(match[1] || '0');
      const period = (match[2] || '').toLowerCase();
      
      if (period === 'pm' && hours !== 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;
      
      return `${hours.toString().padStart(2, '0')}:00`;
    }},
    { regex: /^(\d{1,2}):(\d{2})$/, parse: (match: RegExpMatchArray) => {
      const hours = match[1] || '00';
      const minutes = match[2] || '00';
      return `${hours.padStart(2, '0')}:${minutes}`;
    }}
  ];
  
  for (const { regex, parse } of formats) {
    const match = cleanTime.match(regex);
    if (match) {
      return parse(match);
    }
  }
  
  return null;
}

// Helper to find a block by time or description
async function findBlockByDescription(
  description: string, 
  date: string,
  scheduleService: ScheduleService
): Promise<{ blockId: string | null, blocks: any[] }> {
  const blocks = await scheduleService.getScheduleForDate(date);
  
  // First try to parse as a time
  const parsedTime = parseTimeToMilitary(description);
  if (parsedTime) {
    const block = blocks.find(b => {
      const blockStartTime = format(b.startTime, 'HH:mm');
      return blockStartTime === parsedTime;
    });
    if (block) {
      return { blockId: block.id, blocks };
    }
  }
  
  // Try to match by title (case insensitive)
  const lowerDesc = description.toLowerCase();
  const blockByTitle = blocks.find(b => 
    b.title.toLowerCase().includes(lowerDesc)
  );
  if (blockByTitle) {
    return { blockId: blockByTitle.id, blocks };
  }
  
  // Try to match by type
  const blockByType = blocks.find(b => 
    b.type.toLowerCase() === lowerDesc
  );
  if (blockByType) {
    return { blockId: blockByType.id, blocks };
  }
  
  // Try partial time matching (e.g., "7" for "7pm")
  if (/^\d{1,2}$/.test(description)) {
    const hour = parseInt(description);
    const pmBlock = blocks.find(b => {
      const blockHour = b.startTime.getHours();
      return blockHour === (hour + 12) || blockHour === hour;
    });
    if (pmBlock) {
      return { blockId: pmBlock.id, blocks };
    }
  }
  
  return { blockId: null, blocks };
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

// Helper to invalidate schedule after changes
function invalidateScheduleForDate(date: string) {
  // This works because Zustand stores are singletons
  // We can access the store directly without being in a React component
  const { invalidateSchedule } = useScheduleStore.getState();
  invalidateSchedule(date);
  console.log(`[AI Tools] Invalidated schedule for date: ${date}`);
}

export const createTimeBlock = tool({
  description: 'Create a new time block in the schedule',
  parameters: z.object({
    type: z.enum(['work', 'email', 'break', 'meeting', 'blocked']).describe('Type of time block'),
    title: z.string(),
    startTime: z.string().describe('Time in HH:MM format or natural language (e.g., "2pm", "14:00")'),
    endTime: z.string().describe('Time in HH:MM format or natural language'),
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
  }),
  execute: async ({ type, title, startTime, endTime, date }) => {
    try {
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      
      // Parse natural language times
      const parsedStartTime = parseTimeToMilitary(startTime) || startTime;
      const parsedEndTime = parseTimeToMilitary(endTime) || endTime;
      
      console.log('[AI Tools] Creating block:', { 
        type, 
        title, 
        startTime: `${startTime} -> ${parsedStartTime}`,
        endTime: `${endTime} -> ${parsedEndTime}`,
        date: targetDate 
      });
      
      // Get service from factory - it's already configured
      const factory = ensureServicesConfigured();
      const scheduleService = factory.getScheduleService();
      
      // Check for conflicts
      const hasConflict = await scheduleService.checkForConflicts(parsedStartTime, parsedEndTime, targetDate);
      if (hasConflict) {
        // Get the current schedule to show what's blocking
        const currentSchedule = await scheduleService.getScheduleForDate(targetDate);
        const blockingBlocks = currentSchedule.filter(block => {
          const blockStart = format(block.startTime, 'HH:mm');
          const blockEnd = format(block.endTime, 'HH:mm');
          return (parsedStartTime < blockEnd && parsedEndTime > blockStart);
        }).map(b => `${format(b.startTime, 'h:mm a')}-${format(b.endTime, 'h:mm a')} ${b.title}`);
        
        return {
          success: false,
          error: `Time conflict detected. The following blocks overlap with ${parsedStartTime}-${parsedEndTime}:\n${blockingBlocks.join('\n')}`
        };
      }
      
      // Create the block
      const block = await scheduleService.createTimeBlock({
        type,
        title,
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        date: targetDate,
      });
      
      invalidateScheduleForDate(targetDate);
      
      return {
        success: true,
        blockId: block.id,
        message: `Created ${type} block "${title}" from ${parsedStartTime} to ${parsedEndTime}`,
      };
    } catch (error) {
      console.error('[AI Tools] Error in createTimeBlock:', error);
      
      // Don't invalidate on error to prevent data loss
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
    blockId: z.string().optional().describe('The ID of the block to move'),
    blockDescription: z.string().optional().describe('Description of the block (time, title, or type)'),
    newStartTime: z.string().describe('New start time in HH:MM format or natural language (e.g., "2pm")'),
    newEndTime: z.string().optional().describe('New end time in HH:MM format or natural language'),
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
  }),
  execute: async ({ blockId, blockDescription, newStartTime, newEndTime, date }) => {
    try {
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      const factory = ensureServicesConfigured();
      const scheduleService = factory.getScheduleService();
      
      // Find the block if description provided
      let actualBlockId = blockId;
      if (!actualBlockId && blockDescription) {
        const { blockId: foundId } = await findBlockByDescription(blockDescription, targetDate, scheduleService);
        if (!foundId) {
          return {
            success: false,
            error: `Could not find block matching "${blockDescription}". Please check the schedule first.`
          };
        }
        actualBlockId = foundId;
      }
      
      if (!actualBlockId) {
        return {
          success: false,
          error: 'Please provide either blockId or blockDescription'
        };
      }
      
      // Get the existing block
      const existingBlock = await scheduleService.getTimeBlock(actualBlockId);
      if (!existingBlock) {
        return {
          success: false,
          error: 'Time block not found'
        };
      }
      
      // Parse the new times
      const parsedStartTime = parseTimeToMilitary(newStartTime) || newStartTime;
      const parsedEndTime = newEndTime ? (parseTimeToMilitary(newEndTime) || newEndTime) : undefined;
      
      // Calculate end time if not provided
      const endTime = parsedEndTime || calculateEndTime(parsedStartTime, existingBlock);
      
      // Check for conflicts
      const hasConflict = await scheduleService.checkForConflicts(
        parsedStartTime, 
        endTime, 
        targetDate,
        actualBlockId
      );
      
      if (hasConflict) {
        return {
          success: false,
          error: 'Cannot move block - time conflict detected'
        };
      }
      
      // Update the block
      const updated = await scheduleService.updateTimeBlock({
        id: actualBlockId,
        startTime: parsedStartTime,
        endTime: endTime,
      });
      
      invalidateScheduleForDate(targetDate);
      
      return {
        success: true,
        message: `Moved "${updated.title}" to ${parsedStartTime} - ${endTime}`,
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
    blockId: z.string().optional().describe('The ID of the block to delete'),
    blockDescription: z.string().optional().describe('Description of the block (time, title, or type)'),
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
    reason: z.string().optional(),
  }),
  execute: async ({ blockId, blockDescription, date, reason }) => {
    try {
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      const factory = ensureServicesConfigured();
      const scheduleService = factory.getScheduleService();
      
      console.log('[AI Tools] Delete request:', { blockId, blockDescription, date: targetDate });
      
      // Find the block if description provided
      let actualBlockId = blockId;
      if (!actualBlockId && blockDescription) {
        const { blockId: foundId, blocks } = await findBlockByDescription(blockDescription, targetDate, scheduleService);
        if (!foundId) {
          // Provide helpful error with available blocks
          const availableBlocks = blocks.map(b => 
            `• ${format(b.startTime, 'h:mm a')} - ${b.title} (${b.type})`
          ).join('\n');
          
          return {
            success: false,
            error: `Could not find block matching "${blockDescription}". Available blocks:\n${availableBlocks || 'No blocks scheduled for this date.'}`
          };
        }
        actualBlockId = foundId;
      }
      
      if (!actualBlockId) {
        return {
          success: false,
          error: 'Please provide either blockId or blockDescription'
        };
      }
      
      // Get the block details before deleting
      const block = await scheduleService.getTimeBlock(actualBlockId);
      if (!block) {
        console.log('[AI Tools] Block not found:', actualBlockId);
        return {
          success: false,
          error: `Time block not found. Please check the schedule first.`
        };
      }
      
      await scheduleService.deleteTimeBlock(actualBlockId);
      
      invalidateScheduleForDate(targetDate);
      
      return {
        success: true,
        message: `Deleted "${block.title}" at ${format(block.startTime, 'h:mm a')}${reason ? ` (${reason})` : ''}`,
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
      const factory = ensureServicesConfigured();
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
      
      invalidateScheduleForDate(format(block.startTime, 'yyyy-MM-dd'));
      
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
      const factory = ensureServicesConfigured();
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
      
      // Invalidate today's schedule since we don't know which date the task is on
      invalidateScheduleForDate(format(new Date(), 'yyyy-MM-dd'));
      
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
      const factory = ensureServicesConfigured();
      const scheduleService = factory.getScheduleService();
      
      console.log('[AI Tools] Getting schedule for date:', targetDate);
      
      const blocks = await scheduleService.getScheduleForDate(targetDate);
      
      console.log('[AI Tools] Retrieved blocks:', blocks.map(b => ({
        id: b.id,
        time: `${format(b.startTime, 'h:mm a')} - ${format(b.endTime, 'h:mm a')}`,
        title: b.title,
        type: b.type
      })));
      
      // Format blocks with both 12-hour and 24-hour times for flexibility
      const formattedBlocks = blocks.map(block => ({
        id: block.id,
        type: block.type,
        title: block.title,
        startTime: format(block.startTime, 'HH:mm'),
        endTime: format(block.endTime, 'HH:mm'),
        startTime12: format(block.startTime, 'h:mm a'),
        endTime12: format(block.endTime, 'h:mm a'),
        description: block.description
      }));
      
      // Format for AI consumption, not direct display
      return {
        date: targetDate,
        blocks: formattedBlocks,
        totalBlocks: blocks.length,
        hasBreak: blocks.some(b => b.type === 'break'),
        hasFocusTime: blocks.some(b => b.type === 'work'),
        summary: blocks.length === 0 
          ? 'No blocks scheduled for this date.' 
          : `${blocks.length} blocks scheduled: ${blocks.map(b => `${format(b.startTime, 'h:mm a')} ${b.title}`).join(', ')}`
      };
    } catch (error) {
      console.error('[AI Tools] Error in getSchedule:', error);
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Failed to get schedule',
        date: date || format(new Date(), 'yyyy-MM-dd'),
        blocks: [],
        totalBlocks: 0,
        hasBreak: false,
        hasFocusTime: false,
        summary: 'Error retrieving schedule'
      };
    }
  },
});

export const getUnassignedTasks = tool({
  description: 'Get all tasks that are not yet scheduled',
  parameters: z.object({}),
  execute: async () => {
    try {
      const factory = ensureServicesConfigured();
      const taskService = factory.getTaskService();
      
      const tasks = await taskService.getUnassignedTasks();
      
      return { 
        tasks: tasks.map(formatTaskForAI),
        totalTasks: tasks.length,
        highPriorityCount: tasks.filter(t => t.priority === 'high').length,
      };
    } catch (error) {
      console.error('Error in getUnassignedTasks:', error);
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Failed to get unassigned tasks',
        tasks: [],
        totalTasks: 0,
        highPriorityCount: 0,
      };
    }
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

export const findTimeBlock = tool({
  description: 'Find a time block by time, title, or description. Use this before trying to move or delete blocks.',
  parameters: z.object({
    description: z.string().describe('Time (e.g., "7pm", "19:00"), title, or type of the block'),
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
  }),
  execute: async ({ description, date }) => {
    try {
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      const factory = ensureServicesConfigured();
      const scheduleService = factory.getScheduleService();
      
      console.log(`[AI Tools] Finding block by description: "${description}" on ${targetDate}`);
      
      const { blockId, blocks } = await findBlockByDescription(description, targetDate, scheduleService);
      
      if (blockId) {
        const block = blocks.find(b => b.id === blockId);
        return {
          success: true,
          blockId,
          block: formatBlockForAI(block),
          message: `Found block: ${block.title} at ${format(block.startTime, 'h:mm a')}`
        };
      }
      
      // Provide helpful error with available blocks
      const availableBlocks = blocks.map(b => 
        `• ${format(b.startTime, 'h:mm a')} - ${b.title} (${b.type})`
      ).join('\n');
      
      return {
        success: false,
        error: `No block found matching "${description}". Available blocks:\n${availableBlocks || 'No blocks scheduled for this date.'}`,
        availableBlocks: blocks.map(formatBlockForAI)
      };
    } catch (error) {
      console.error('Error in findTimeBlock:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find time block'
      };
    }
  },
});

export const regenerateSchedule = tool({
  description: 'Regenerate the schedule for a date if data was lost or corrupted',
  parameters: z.object({
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
    preserveUserCreatedBlocks: z.boolean().optional().describe('Whether to keep blocks created by the user'),
  }),
  execute: async ({ date, preserveUserCreatedBlocks = true }) => {
    try {
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      const factory = ensureServicesConfigured();
      const scheduleService = factory.getScheduleService();
      
      console.log(`[AI Tools] Regenerating schedule for ${targetDate}`);
      
      // Get current blocks
      const currentBlocks = await scheduleService.getScheduleForDate(targetDate);
      const userBlocks = preserveUserCreatedBlocks 
        ? currentBlocks.filter(b => b.source === 'ai' || b.source === 'manual')
        : [];
      
      // Force invalidation to trigger regeneration
      invalidateScheduleForDate(targetDate);
      
      // Get the new schedule (which should have regenerated mock data)
      const newSchedule = await scheduleService.getScheduleForDate(targetDate);
      
      return {
        success: true,
        message: `Schedule regenerated for ${targetDate}. ${userBlocks.length} user blocks preserved, ${newSchedule.length} total blocks now scheduled.`,
        preservedBlocks: userBlocks.length,
        totalBlocks: newSchedule.length
      };
    } catch (error) {
      console.error('[AI Tools] Error in regenerateSchedule:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to regenerate schedule'
      };
    }
  },
}); 