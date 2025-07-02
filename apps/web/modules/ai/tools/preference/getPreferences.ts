import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type UserPreferences, type PreferenceGroup } from '../../schemas/preference.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { ensureServicesConfigured } from '../utils/auth';

export const getPreferences = tool({
  description: 'Get current user preferences for scheduling',
  parameters: z.object({
    category: z.enum(['all', 'schedule', 'email', 'task', 'meeting']).default('all'),
  }),
  execute: async ({ category }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'getPreferences',
      operation: 'read' as const,
      resourceType: 'preference' as const,
      startTime,
    };
    
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const factory = ServiceFactory.getInstance();
      const preferenceService = factory.getPreferenceService();
      
      const preferences = await preferenceService.getUserPreferences();
      
      // Extract key values from preferences
      const workStartTime = preferences.workStartTime || '09:00';
      const workEndTime = preferences.workEndTime || '17:00';
      const lunchTime = preferences.breakSchedule?.lunchTime || preferences.lunchStartTime || '12:00';
      const lunchDuration = preferences.breakSchedule?.lunchDuration || preferences.lunchDurationMinutes || 60;
      const focusBlockDuration = 90; // Default value
      const emailBatchSize = preferences.emailPreferences?.quickReplyMinutes || 30;
      
      // Build preference groups
      const groups: PreferenceGroup[] = [
        {
          category: 'schedule',
          label: 'Schedule Preferences',
          description: 'Configure your work hours and breaks',
          preferences: [
            {
              key: 'workStartTime',
              value: workStartTime,
              type: 'time',
              category: 'schedule',
              label: 'Work Start Time',
              description: 'When your workday begins',
            },
            {
              key: 'workEndTime',
              value: workEndTime,
              type: 'time',
              category: 'schedule',
              label: 'Work End Time',
              description: 'When your workday ends',
            },
            {
              key: 'lunchTime',
              value: lunchTime,
              type: 'time',
              category: 'schedule',
              label: 'Lunch Time',
              description: 'When you typically have lunch',
            },
            {
              key: 'lunchDuration',
              value: lunchDuration,
              type: 'number',
              category: 'schedule',
              label: 'Lunch Duration',
              description: 'Duration of lunch break in minutes',
            },
            {
              key: 'focusBlockDuration',
              value: focusBlockDuration,
              type: 'number',
              category: 'schedule',
              label: 'Focus Block Duration',
              description: 'Default duration for deep work sessions (minutes)',
            },
          ],
        },
        {
          category: 'email',
          label: 'Email Preferences',
          description: 'Configure email processing settings',
          preferences: [
            {
              key: 'emailBatchSize',
              value: emailBatchSize,
              type: 'number',
              category: 'email',
              label: 'Email Batch Size',
              description: 'Number of emails to process at once',
            },
          ],
        },
      ];
      
      // Build structured preferences
      const userPreferences: UserPreferences = {
        userId: preferences.userId || 'current-user',
        preferences: {
          workStartTime,
          workEndTime,
          lunchTime,
          lunchDuration,
          focusBlockDuration,
          emailBatchSize,
        },
        groups: category === 'all' ? groups : groups.filter(g => g.category === category),
        lastUpdated: preferences.updatedAt ? preferences.updatedAt.toISOString() : new Date().toISOString(),
        version: 1,
      };
      
      const workHours = calculateWorkHours(workStartTime, workEndTime);
      
      return buildToolResponse(
        toolOptions,
        userPreferences,
        {
          type: 'form',
          title: 'User Preferences',
          description: `Work hours: ${workStartTime} - ${workEndTime} (${workHours} hours/day)`,
          priority: 'medium',
          components: userPreferences.groups.flatMap(group => 
            group.preferences.map(pref => ({
              type: 'preferenceForm' as const,
              data: {
                key: pref.key,
                value: pref.value,
                type: pref.type === 'string' ? 'text' : pref.type as 'number' | 'boolean' | 'text' | 'select' | 'time',
                label: pref.label,
                description: pref.description,
              },
            }))
          ),
        },
        {
          suggestions: [
            'Update work hours',
            'Change lunch time',
            'Adjust focus block duration',
            'Apply to today\'s schedule',
          ],
          actions: [
            {
              id: 'update-work-hours',
              label: 'Update Work Hours',
              icon: 'clock',
              variant: 'primary',
              action: {
                type: 'message',
                message: 'Update my work hours',
              },
            },
            {
              id: 'apply-to-schedule',
              label: 'Apply to Schedule',
              icon: 'calendar',
              variant: 'secondary',
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
          title: 'Failed to get preferences',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
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