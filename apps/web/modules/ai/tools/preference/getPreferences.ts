import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';

export const getPreferences = tool({
  description: 'Get current user preferences for scheduling',
  parameters: z.object({}),
  execute: async () => {
    try {
      const factory = ServiceFactory.getInstance();
      const preferenceService = factory.getPreferenceService();
      
      const preferences = await preferenceService.getUserPreferences();
      
      // Format preferences for display
      const formatted = {
        workHours: {
          start: preferences.workStartTime || '09:00',
          end: preferences.workEndTime || '17:00',
          hoursPerDay: calculateWorkHours(
            preferences.workStartTime || '09:00', 
            preferences.workEndTime || '17:00'
          )
        },
        breaks: {
          lunchTime: preferences.breakSchedule?.lunchTime || preferences.lunchStartTime || '12:00',
          lunchDuration: preferences.breakSchedule?.lunchDuration || preferences.lunchDurationMinutes || 60,
          breakFrequency: preferences.breakSchedule?.morningBreak || preferences.breakSchedule?.afternoonBreak ? 'Configured' : 'Not set'
        },
        scheduling: {
          focusBlockDuration: 90, // Default value since not in interface
          emailBatchSize: preferences.emailPreferences?.quickReplyMinutes || 30,
          meetingBuffer: 15 // Default value since not in interface
        },
        lastUpdated: preferences.updatedAt
      };
      
      const summary = `Work hours: ${formatted.workHours.start} - ${formatted.workHours.end} (${formatted.workHours.hoursPerDay} hours/day)
Lunch: ${formatted.breaks.lunchTime} for ${formatted.breaks.lunchDuration} minutes
Breaks: ${formatted.breaks.breakFrequency}
Focus blocks: ${formatted.scheduling.focusBlockDuration} minutes
Email batches: ${formatted.scheduling.emailBatchSize} emails
Meeting buffer: ${formatted.scheduling.meetingBuffer} minutes`;
      
      return toolSuccess({
        preferences: formatted,
        raw: preferences,
        summary
      }, {
        type: 'text',
        content: summary
      }, {
        suggestions: [
          'Update work hours',
          'Change lunch time',
          'Adjust focus block duration',
          'Apply to today\'s schedule'
        ]
      });
      
    } catch (error) {
      return toolError(
        'PREFERENCES_FETCH_FAILED',
        `Failed to get preferences: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
});

function calculateWorkHours(start: string, end: string): number {
  const startParts = start.split(':');
  const endParts = end.split(':');
  
  if (startParts.length !== 2 || endParts.length !== 2) {
    return 8; // Default to 8 hours
  }
  
  const startHour = parseInt(startParts[0] || '9', 10);
  const startMin = parseInt(startParts[1] || '0', 10);
  const endHour = parseInt(endParts[0] || '17', 10);
  const endMin = parseInt(endParts[1] || '0', 10);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  return Math.round((endMinutes - startMinutes) / 60 * 10) / 10;
} 