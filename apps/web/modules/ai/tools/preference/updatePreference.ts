import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';

export const updatePreference = tool({
  description: 'Update user preferences for scheduling',
  parameters: z.object({
    preference: z.enum([
      'workStartTime',
      'workEndTime',
      'lunchTime',
      'lunchDuration',
      'focusBlockDuration',
      'breakFrequency',
      'emailBatchSize',
      'meetingBuffer'
    ]),
    value: z.string().describe('New value for the preference'),
  }),
  execute: async ({ preference, value }) => {
    try {
      const factory = ServiceFactory.getInstance();
      const preferenceService = factory.getPreferenceService();
      
      // Validate the value based on preference type
      const validation = validatePreferenceValue(preference, value);
      if (!validation.valid) {
        return toolError(
          'INVALID_VALUE',
          validation.error || 'Invalid value for preference'
        );
      }
      
      // Update the preference
      const updates: any = {};
      updates[preference] = value;
      await preferenceService.updatePreferences(updates);
      
      // Get friendly description
      const description = getPreferenceDescription(preference, value);
      
      const result = {
        preference,
        oldValue: validation.oldValue,
        newValue: value,
        description
      };
      
      return toolSuccess(result, {
        type: 'text',
        content: `Updated ${description}`
      }, {
        suggestions: [
          'View all preferences',
          'Update another preference',
          'Apply preferences to schedule'
        ]
      });
      
    } catch (error) {
      return toolError(
        'PREFERENCE_UPDATE_FAILED',
        `Failed to update preference: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
});

function validatePreferenceValue(preference: string, value: string): { valid: boolean; error?: string; oldValue?: string } {
  // Time preferences should be in HH:MM format
  if (preference.includes('Time') && !preference.includes('Duration')) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(value)) {
      return { valid: false, error: 'Time must be in HH:MM format (e.g., 09:00)' };
    }
  }
  
  // Duration preferences should be numbers
  if (preference.includes('Duration') || preference.includes('Frequency') || preference.includes('Buffer') || preference.includes('Size')) {
    const num = parseInt(value);
    if (isNaN(num) || num < 0) {
      return { valid: false, error: 'Value must be a positive number' };
    }
  }
  
  return { valid: true };
}

function getPreferenceDescription(preference: string, value: string): string {
  const descriptions: Record<string, string> = {
    workStartTime: `work start time to ${value}`,
    workEndTime: `work end time to ${value}`,
    lunchTime: `lunch time to ${value}`,
    lunchDuration: `lunch duration to ${value} minutes`,
    focusBlockDuration: `default focus block duration to ${value} minutes`,
    breakFrequency: `break frequency to every ${value} minutes`,
    emailBatchSize: `email batch size to ${value} emails`,
    meetingBuffer: `meeting buffer time to ${value} minutes`
  };
  
  return descriptions[preference] || `${preference} to ${value}`;
} 