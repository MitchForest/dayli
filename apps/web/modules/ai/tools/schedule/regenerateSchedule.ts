import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type TimeBlock, type ScheduleUpdate, type ScheduleChange } from '../../schemas/schedule.schema';
import { buildToolResponse, buildErrorResponse, formatTime12Hour } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';
import { ensureServicesConfigured } from '../utils/auth';

export const regenerateSchedule = tool({
  description: 'Regenerate the entire schedule for a day based on preferences and priorities',
  parameters: z.object({
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
    keepMeetings: z.boolean().default(true).describe('Keep existing meetings/appointments'),
    optimizeFor: z.enum(['focus', 'variety', 'energy', 'meetings']).default('focus'),
  }),
  execute: async ({ date, keepMeetings, optimizeFor }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'regenerateSchedule',
      operation: 'update' as const,
      resourceType: 'schedule' as const,
      startTime,
    };
    
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      const taskService = ServiceFactory.getInstance().getTaskService();
      const preferenceService = ServiceFactory.getInstance().getPreferenceService();
      
      // Get current schedule
      const currentBlocks = await scheduleService.getScheduleForDate(targetDate);
      
      // Get user preferences
      const preferences = await preferenceService.getUserPreferences();
      
      // Get unassigned tasks
      const unassignedTasks = await taskService.getUnassignedTasks();
      
      // Separate meetings from other blocks
      const meetings = keepMeetings 
        ? currentBlocks.filter(b => b.type === 'meeting')
        : [];
      const blocksToReplace = currentBlocks.filter(b => 
        !keepMeetings || b.type !== 'meeting'
      );
      
      // Generate new schedule
      const proposedSchedule = generateOptimalSchedule({
        date: targetDate,
        existingMeetings: meetings,
        availableTasks: unassignedTasks,
        preferences,
        optimizeFor,
        workStart: preferences.workStartTime || '09:00',
        workEnd: preferences.workEndTime || '17:00',
        lunchTime: preferences.breakSchedule?.lunchTime || '12:00',
        lunchDuration: preferences.breakSchedule?.lunchDuration || 60,
      });
      
      // Calculate changes
      const changes = calculateScheduleChanges(blocksToReplace, proposedSchedule);
      
      if (changes.length === 0) {
        const stats = {
          meetings: meetings.length,
          focusBlocks: proposedSchedule.filter(b => b.type === 'work').length,
          breaks: proposedSchedule.filter(b => b.type === 'break').length,
        };
        
        return buildToolResponse(
          toolOptions,
          { 
            message: 'Schedule is already optimal',
            stats,
          },
          {
            type: 'card',
            title: 'Schedule Already Optimal',
            description: 'Your schedule is already well-optimized!',
            priority: 'low',
            components: [],
          },
          {
            suggestions: [
              'View current schedule',
              'Add a new task',
              'Adjust preferences',
            ],
          }
        );
      }
      
      // Calculate focus time
      const focusMinutes = proposedSchedule
        .filter(b => b.type === 'work')
        .reduce((sum, b) => {
          const duration = b.startTime && b.endTime 
            ? timeToMinutes(b.endTime as string) - timeToMinutes(b.startTime as string)
            : 0;
          return sum + duration;
        }, 0);
      
      const focusHours = Math.floor(focusMinutes / 60);
      
      // Build schedule update
      const scheduleUpdate: ScheduleUpdate = {
        date: targetDate,
        changes,
        summary: `Regenerated schedule optimized for ${optimizeFor} with ${focusHours} hours of focus time`,
        requiresConfirmation: true,
      };
      
      const confirmationId = crypto.randomUUID();
      
      return buildToolResponse(
        toolOptions,
        scheduleUpdate,
        {
          type: 'confirmation',
          title: 'Regenerate Schedule',
          description: `I've regenerated your schedule optimized for ${optimizeFor}. This will give you ${focusHours} hours of focus time.`,
          priority: 'high',
          components: [
            // Show removed blocks
            ...changes.filter(c => c.type === 'remove').map(change => ({
              type: 'scheduleBlock' as const,
              data: {
                ...change.previousState!,
                metadata: { action: 'remove' },
              },
            })),
            // Show added blocks
            ...changes.filter(c => c.type === 'add').map(change => ({
              type: 'scheduleBlock' as const,
              data: {
                ...change.newState!,
                metadata: { action: 'add' },
              },
            })),
          ],
        },
        {
          confirmationRequired: true,
          confirmationId,
          suggestions: [],
          actions: [
            {
              id: 'apply-changes',
              label: 'Apply Changes',
              icon: 'check',
              variant: 'primary',
              action: {
                type: 'message',
                message: 'Apply the regenerated schedule',
              },
            },
            {
              id: 'cancel',
              label: 'Cancel',
              variant: 'secondary',
              action: {
                type: 'message',
                message: 'Keep current schedule',
              },
            },
          ],
          notification: {
            show: true,
            type: 'info',
            message: `${changes.length} changes proposed`,
            duration: 5000,
          },
        }
      );
      
    } catch (error) {
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to regenerate schedule',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
});

// Helper to generate optimal schedule
function generateOptimalSchedule(params: {
  date: string;
  existingMeetings: any[];
  availableTasks: any[];
  preferences: any;
  optimizeFor: string;
  workStart: string;
  workEnd: string;
  lunchTime: string;
  lunchDuration: number;
}): TimeBlock[] {
  const schedule: TimeBlock[] = [];
  let blockId = 1;
  
  // Add lunch break if configured
  if (params.preferences.breakSchedule?.lunchTime && params.preferences.breakSchedule?.lunchDuration) {
    const lunchStart = params.preferences.breakSchedule.lunchTime;
    const lunchEnd = addMinutesToTime(lunchStart, params.preferences.breakSchedule.lunchDuration);
    
    schedule.push({
      id: `generated-${blockId++}`,
      type: 'break',
      title: 'Lunch',
      startTime: formatTime12Hour(parseTime(lunchStart)),
      endTime: formatTime12Hour(parseTime(lunchEnd)),
      description: 'Lunch break',
    });
  }
  
  // Add existing meetings
  params.existingMeetings.forEach(meeting => {
    schedule.push({
      id: meeting.id,
      type: 'meeting',
      title: meeting.title,
      startTime: formatTime12Hour(meeting.startTime),
      endTime: formatTime12Hour(meeting.endTime),
      description: meeting.description,
    });
  });
  
  // Generate work blocks based on optimization strategy
  if (params.optimizeFor === 'focus') {
    // Create large focus blocks
    schedule.push({
      id: `generated-${blockId++}`,
      type: 'work',
      title: 'Deep Focus Work',
      startTime: formatTime12Hour(parseTime(params.workStart)),
      endTime: formatTime12Hour(parseTime('11:30')),
      description: 'Focus time for deep work',
    });
    
    schedule.push({
      id: `generated-${blockId++}`,
      type: 'work',
      title: 'Afternoon Focus',
      startTime: formatTime12Hour(parseTime('13:30')),
      endTime: formatTime12Hour(parseTime('16:00')),
      description: 'Afternoon focus session',
    });
  } else if (params.optimizeFor === 'variety') {
    // Mix different types of blocks
    schedule.push(
      {
        id: `generated-${blockId++}`,
        type: 'work',
        title: 'Morning Tasks',
        startTime: formatTime12Hour(parseTime(params.workStart)),
        endTime: formatTime12Hour(parseTime('10:30')),
        description: 'Morning task work',
      },
      {
        id: `generated-${blockId++}`,
        type: 'email',
        title: 'Email Processing',
        startTime: formatTime12Hour(parseTime('10:30')),
        endTime: formatTime12Hour(parseTime('11:00')),
        description: 'Process emails',
      },
      {
        id: `generated-${blockId++}`,
        type: 'work',
        title: 'Project Work',
        startTime: formatTime12Hour(parseTime('14:00')),
        endTime: formatTime12Hour(parseTime('15:30')),
        description: 'Project focused work',
      }
    );
  }
  
  // Add breaks
  if (params.preferences.breakFrequency) {
    schedule.push({
      id: `generated-${blockId++}`,
      type: 'break',
      title: 'Morning Break',
      startTime: formatTime12Hour(parseTime('10:30')),
      endTime: formatTime12Hour(parseTime('10:45')),
      description: '15 minute break',
    });
  }
  
  // Sort by start time
  return schedule.sort((a, b) => {
    const aMinutes = timeToMinutes(convertTo24Hour(a.startTime));
    const bMinutes = timeToMinutes(convertTo24Hour(b.startTime));
    return aMinutes - bMinutes;
  });
}

// Helper to calculate changes
function calculateScheduleChanges(current: any[], proposed: TimeBlock[]): ScheduleChange[] {
  const changes: ScheduleChange[] = [];
  
  // Find blocks to remove
  current.forEach(block => {
    if (!proposed.find(p => p.id === block.id)) {
      changes.push({
        type: 'remove',
        blockId: block.id,
        previousState: {
          id: block.id,
          type: block.type,
          title: block.title,
          startTime: formatTime12Hour(block.startTime),
          endTime: formatTime12Hour(block.endTime),
          description: block.description,
        },
      });
    }
  });
  
  // Find blocks to add
  proposed.forEach(block => {
    if (block.id.startsWith('generated-')) {
      changes.push({
        type: 'add',
        blockId: block.id,
        newState: block,
      });
    }
  });
  
  return changes;
}

// Time helpers
function timeToMinutes(time: string): number {
  const parts = time.split(':');
  if (parts.length !== 2) return 0;
  const hours = parseInt(parts[0] || '0', 10);
  const minutes = parseInt(parts[1] || '0', 10);
  return hours * 60 + minutes;
}

// Convert 12-hour to 24-hour format
function convertTo24Hour(time12: string): string {
  const parts = time12.split(' ');
  if (parts.length !== 2) return '00:00';
  
  const time = parts[0];
  const period = parts[1];
  
  if (!time || !period) return '00:00';
  
  const timeParts = time.split(':');
  if (timeParts.length !== 2) return '00:00';
  
  const hoursStr = timeParts[0];
  const minutesStr = timeParts[1];
  
  if (!hoursStr || !minutesStr) return '00:00';
  
  let hours = parseInt(hoursStr, 10);
  let minutes = parseInt(minutesStr, 10);
  
  if (isNaN(hours) || isNaN(minutes)) return '00:00';
  
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Helper function to parse time string
function parseTime(timeStr: string): Date {
  const parts = timeStr.split(':');
  if (parts.length !== 2) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }
  const hours = parseInt(parts[0] || '0', 10);
  const minutes = parseInt(parts[1] || '0', 10);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

// Helper function to add minutes to time
function addMinutesToTime(time: Date | string, minutes: number): string {
  const date = typeof time === 'string' ? parseTime(time) : new Date(time);
  date.setMinutes(date.getMinutes() + minutes);
  return format(date, 'HH:mm');
} 