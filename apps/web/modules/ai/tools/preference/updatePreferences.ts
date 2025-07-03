import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type PreferenceUpdate } from '../../schemas/preference.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';

export const updatePreferences = tool({
  description: 'Update user preferences for scheduling and workflow',
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
  execute: async ({ preference, value }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'updatePreferences',
      operation: 'update' as const,
      resourceType: 'preference' as const,
      startTime,
    };
    
    try {
      const factory = ServiceFactory.getInstance();
      const preferenceService = factory.getPreferenceService();
      
      // Get current value
      const currentPrefs = await preferenceService.getUserPreferences();
      const oldValue = (currentPrefs as any)[preference] || getDefaultValue(preference);
      
      // Validate the value based on preference type
      const validation = validatePreferenceValue(preference, value);
      if (!validation.valid) {
        return buildErrorResponse(
          toolOptions,
          new Error(validation.error || 'Invalid value for preference'),
          {
            title: 'Invalid preference value',
            description: validation.error || 'The provided value is not valid for this preference',
          }
        );
      }
      
      // Update the preference
      const updates: Record<string, string> = {};
      updates[preference] = value;
      await preferenceService.updatePreferences(updates);
      
      // Get friendly description
      const description = getPreferenceDescription(preference, value);
      
      const preferenceUpdate: PreferenceUpdate = {
        key: preference,
        previousValue: oldValue,
        newValue: value,
        validation: {
          isValid: true,
        },
        impact: {
          affectedFeatures: getAffectedFeatures(preference),
          requiresRestart: false,
          immediateEffect: true,
        },
      };
      
      return buildToolResponse(
        toolOptions,
        preferenceUpdate,
        {
          type: 'card',
          title: 'Preference Updated',
          description: `Updated ${description}`,
          priority: 'medium',
          components: [],
        },
        {
          notification: {
            show: true,
            type: 'success',
            message: `Updated ${description}`,
            duration: 3000,
          },
          suggestions: [
            'View all preferences',
            'Update another preference',
            'Apply preferences to schedule',
          ],
          actions: [
            {
              id: 'view-preferences',
              label: 'View All Preferences',
              icon: 'settings',
              variant: 'secondary',
              action: {
                type: 'tool',
                tool: 'getPreferences',
                params: { category: 'all' },
              },
            },
            {
              id: 'apply-to-schedule',
              label: 'Apply to Schedule',
              icon: 'calendar',
              variant: 'primary',
              action: {
                type: 'tool',
                tool: 'scheduleDay',
                params: { includeBacklog: true },
              },
            },
          ],
        }
      );
      
    } catch (error) {
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to update preference',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
});

function getDefaultValue(preference: string): string {
  const defaults: Record<string, string> = {
    workStartTime: '09:00',
    workEndTime: '17:00',
    lunchTime: '12:00',
    lunchDuration: '60',
    focusBlockDuration: '90',
    breakFrequency: '90',
    emailBatchSize: '30',
    meetingBuffer: '15',
  };
  return defaults[preference] || '';
}

function validatePreferenceValue(preference: string, value: string): { valid: boolean; error?: string } {
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

function getAffectedFeatures(preference: string): string[] {
  const featureMap: Record<string, string[]> = {
    workStartTime: ['Daily Schedule', 'Calendar Sync'],
    workEndTime: ['Daily Schedule', 'Calendar Sync'],
    lunchTime: ['Daily Schedule', 'Break Management'],
    lunchDuration: ['Daily Schedule', 'Break Management'],
    focusBlockDuration: ['Task Scheduling', 'Time Blocking'],
    breakFrequency: ['Break Reminders', 'Health Tracking'],
    emailBatchSize: ['Email Processing', 'Inbox Management'],
    meetingBuffer: ['Meeting Scheduling', 'Calendar Management'],
  };
  
  return featureMap[preference] || ['General Settings'];
} 