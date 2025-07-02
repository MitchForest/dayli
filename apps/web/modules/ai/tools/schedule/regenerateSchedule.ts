import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError, toolConfirmation, TimeBlock, ProposedChange, Task } from '../types';
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
  execute: async ({ date, keepMeetings, optimizeFor }) => {
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
        return toolSuccess({
          message: 'Schedule is already optimal',
          stats: {
            meetings: meetings.length,
            focusBlocks: proposedSchedule.filter(b => b.type === 'work').length,
            breaks: proposedSchedule.filter(b => b.type === 'break').length
          }
        }, {
          type: 'text',
          content: 'Your schedule is already well-optimized!'
        }, {
          suggestions: [
            'View current schedule',
            'Add a new task',
            'Adjust preferences'
          ]
        });
      }
      
      // Store proposed changes for confirmation
      const confirmationId = crypto.randomUUID();
      
      const changesSummary = changes.map(change => {
        switch (change.type) {
          case 'create':
            return `• Add ${change.block?.type} "${change.block?.title}" at ${change.block?.startTime}`;
          case 'delete':
            return `• Remove "${change.block?.title}"`;
          case 'update':
            return `• Adjust "${change.block?.title}" time or duration`;
          default:
            return `• ${change.type} ${change.description}`;
        }
      }).join('\n');
      
      return toolConfirmation({
        proposedSchedule,
        changes,
        stats: {
          totalChanges: changes.length,
          blocksAdded: changes.filter(c => c.type === 'create').length,
          blocksRemoved: changes.filter(c => c.type === 'delete').length,
          focusTime: proposedSchedule
            .filter(b => b.type === 'work')
            .reduce((sum, b) => {
              const duration = b.startTime && b.endTime 
                ? timeToMinutes(b.endTime as string) - timeToMinutes(b.startTime as string)
                : 0;
              return sum + duration;
            }, 0)
        }
      }, confirmationId, 
      `I've regenerated your schedule optimized for ${optimizeFor}:\n\n${changesSummary}\n\nThis will give you ${Math.floor(proposedSchedule.filter(b => b.type === 'work').reduce((sum, b) => {
        const duration = b.startTime && b.endTime 
          ? timeToMinutes(b.endTime as string) - timeToMinutes(b.startTime as string)
          : 0;
        return sum + duration;
      }, 0) / 60)} hours of focus time. Apply these changes?`
      );
      
    } catch (error) {
      return toolError(
        'REGENERATE_FAILED',
        `Failed to regenerate schedule: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
});

// Helper to generate optimal schedule
function generateOptimalSchedule(params: {
  date: string;
  existingMeetings: TimeBlock[];
  availableTasks: Task[];
  preferences: {
    workStartTime?: string;
    workEndTime?: string;
    breakSchedule?: {
      lunchTime?: string;
      lunchDuration?: number;
      morningBreak?: { time: string; duration: number };
      afternoonBreak?: { time: string; duration: number };
    };
    breakFrequency?: number;
    emailPreferences?: {
      quickReplyMinutes?: number;
    };
  };
  optimizeFor: string;
  workStart: string;
  workEnd: string;
  lunchTime: string;
  lunchDuration: number;
}): Partial<TimeBlock>[] {
  const schedule: Partial<TimeBlock>[] = [];
  
  // Add lunch break if configured
  if (params.preferences.breakSchedule?.lunchTime && params.preferences.breakSchedule?.lunchDuration) {
    const lunchStart = parseTime(params.preferences.breakSchedule.lunchTime);
    schedule.push({
      type: 'break',
      title: 'Lunch',
      startTime: lunchStart,
      endTime: addMinutesToTime(lunchStart, params.preferences.breakSchedule.lunchDuration),
      description: 'Lunch break'
    });
  }
  
  // Add existing meetings
  schedule.push(...params.existingMeetings);
  
  // Generate work blocks based on optimization strategy
  if (params.optimizeFor === 'focus') {
    // Create large focus blocks
    schedule.push({
      type: 'work',
      title: 'Deep Focus Work',
      startTime: params.workStart,
      endTime: '11:30',
      description: 'Focus time for deep work'
    });
    
    schedule.push({
      type: 'work',
      title: 'Afternoon Focus',
      startTime: '13:30',
      endTime: '16:00',
      description: 'Afternoon focus session'
    });
  } else if (params.optimizeFor === 'variety') {
    // Mix different types of blocks
    schedule.push(
      {
        type: 'work',
        title: 'Morning Tasks',
        startTime: params.workStart,
        endTime: '10:30',
        description: 'Morning task work'
      },
      {
        type: 'email',
        title: 'Email Processing',
        startTime: '10:30',
        endTime: '11:00',
        description: 'Process emails'
      },
      {
        type: 'work',
        title: 'Project Work',
        startTime: '14:00',
        endTime: '15:30',
        description: 'Project focused work'
      }
    );
  }
  
  // Add breaks
  if (params.preferences.breakFrequency) {
    schedule.push({
      type: 'break',
      title: 'Morning Break',
      startTime: '10:30',
      endTime: '10:45',
      description: '15 minute break'
    });
  }
  
  return schedule.sort((a, b) => 
    timeToMinutes(a.startTime as string) - timeToMinutes(b.startTime as string)
  );
}

// Helper to calculate changes
function calculateScheduleChanges(current: TimeBlock[], proposed: Partial<TimeBlock>[]): ProposedChange[] {
  const changes: ProposedChange[] = [];
  
  // Find blocks to remove
  current.forEach(block => {
    if (!proposed.find(p => p.id === block.id)) {
      changes.push({
        type: 'delete',
        block: {
          id: block.id,
          type: block.type,
          title: block.title,
          startTime: typeof block.startTime === 'string' ? block.startTime : format(block.startTime, 'HH:mm'),
          endTime: typeof block.endTime === 'string' ? block.endTime : format(block.endTime, 'HH:mm')
        }
      });
    }
  });
  
  // Find blocks to add
  proposed.forEach(block => {
    if (!block.id || !current.find(c => c.id === block.id)) {
      changes.push({
        type: 'create',
        block: {
          type: block.type || 'work',
          title: block.title || 'New Block',
          startTime: typeof block.startTime === 'string' ? block.startTime : format(block.startTime as Date, 'HH:mm'),
          endTime: typeof block.endTime === 'string' ? block.endTime : format(block.endTime as Date, 'HH:mm')
        }
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