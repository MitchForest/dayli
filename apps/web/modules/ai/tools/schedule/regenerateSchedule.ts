import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError, toolConfirmation } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';

export const regenerateSchedule = tool({
  description: 'Regenerate the entire schedule for a day based on preferences and priorities',
  parameters: z.object({
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
    keepMeetings: z.boolean().default(true).describe('Keep existing meetings/appointments'),
    optimizeFor: z.enum(['focus', 'variety', 'energy', 'meetings']).default('focus'),
  }),
  execute: async ({ date, keepMeetings, optimizeFor }) => {
    try {
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
        switch (change.action) {
          case 'add':
            return `• Add ${change.block.type} "${change.block.title}" at ${change.block.startTime}`;
          case 'remove':
            return `• Remove "${change.block.title}"`;
          case 'modify':
            return `• Adjust "${change.block.title}" time or duration`;
          default:
            return `• ${change.description}`;
        }
      }).join('\n');
      
      return toolConfirmation({
        proposedSchedule,
        changes,
        stats: {
          totalChanges: changes.length,
          blocksAdded: changes.filter(c => c.action === 'add').length,
          blocksRemoved: changes.filter(c => c.action === 'remove').length,
          focusTime: proposedSchedule
            .filter(b => b.type === 'work')
            .reduce((sum, b) => sum + (b.duration || 0), 0)
        }
      }, confirmationId, 
      `I've regenerated your schedule optimized for ${optimizeFor}:\n\n${changesSummary}\n\nThis will give you ${Math.floor(proposedSchedule.filter(b => b.type === 'work').reduce((sum, b) => sum + (b.duration || 0), 0) / 60)} hours of focus time. Apply these changes?`
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
  existingMeetings: any[];
  availableTasks: any[];
  preferences: any;
  optimizeFor: string;
  workStart: string;
  workEnd: string;
  lunchTime: string;
  lunchDuration: number;
}): any[] {
  const schedule: any[] = [];
  
  // Add lunch break if configured
  if (params.preferences.breakSchedule?.lunchTime && params.preferences.breakSchedule?.lunchDuration) {
    const lunchStart = parseTime(params.preferences.breakSchedule.lunchTime);
    schedule.push({
      type: 'break',
      title: 'Lunch',
      startTime: lunchStart,
      endTime: addMinutesToTime(lunchStart, params.lunchDuration),
      duration: params.lunchDuration
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
      duration: 150
    });
    
    schedule.push({
      type: 'work',
      title: 'Afternoon Focus',
      startTime: '13:30',
      endTime: '16:00',
      duration: 150
    });
  } else if (params.optimizeFor === 'variety') {
    // Mix different types of blocks
    schedule.push(
      {
        type: 'work',
        title: 'Morning Tasks',
        startTime: params.workStart,
        endTime: '10:30',
        duration: 90
      },
      {
        type: 'email',
        title: 'Email Processing',
        startTime: '10:30',
        endTime: '11:00',
        duration: 30
      },
      {
        type: 'work',
        title: 'Project Work',
        startTime: '14:00',
        endTime: '15:30',
        duration: 90
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
      duration: 15
    });
  }
  
  return schedule.sort((a, b) => 
    timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );
}

// Helper to calculate changes
function calculateScheduleChanges(current: any[], proposed: any[]): any[] {
  const changes: any[] = [];
  
  // Find blocks to remove
  current.forEach(block => {
    if (!proposed.find(p => p.id === block.id)) {
      changes.push({
        action: 'remove',
        block
      });
    }
  });
  
  // Find blocks to add
  proposed.forEach(block => {
    if (!block.id || !current.find(c => c.id === block.id)) {
      changes.push({
        action: 'add',
        block
      });
    }
  });
  
  return changes;
}

// Time helpers
function timeToMinutes(time: string): number {
  const parts = time.split(':');
  if (parts.length !== 2) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

// Helper function to parse time string
function parseTime(timeStr: string): Date {
  const parts = timeStr.split(':');
  if (parts.length !== 2) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
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

// Helper function to format time range
function formatTimeRange(start: string | undefined, end: string | undefined): string {
  if (!start || !end) return 'Invalid time range';
  const startTime = parseTime(start);
  const endTime = parseTime(end);
  return `${format(startTime, 'h:mm a')} - ${format(endTime, 'h:mm a')}`;
} 