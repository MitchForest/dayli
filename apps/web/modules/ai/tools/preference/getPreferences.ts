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
          lunchTime: preferences.lunchTime || '12:00',
          lunchDuration: preferences.lunchDuration || 60,
          breakFrequency: preferences.breakFrequency || 90
        },
        scheduling: {
          focusBlockDuration: preferences.focusBlockDuration || 120,
          emailBatchSize: preferences.emailBatchSize || 10,
          meetingBuffer: preferences.meetingBuffer || 15
        }
      };
      
      const summary = `Work hours: ${formatted.workHours.start} - ${formatted.workHours.end} (${formatted.workHours.hoursPerDay} hours/day)
Lunch: ${formatted.breaks.lunchTime} for ${formatted.breaks.lunchDuration} minutes
Breaks: Every ${formatted.breaks.breakFrequency} minutes
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
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  return Math.round((endMinutes - startMinutes) / 60 * 10) / 10;
} 