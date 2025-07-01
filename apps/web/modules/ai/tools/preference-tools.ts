import { tool } from 'ai';
import { z } from 'zod';
import { ServiceFactory } from '@/services/factory/service.factory';

// Helper to get current user ID (will be provided by context)
function getCurrentUserId(): string {
  // This will be replaced with actual user ID from context
  if (typeof window === 'undefined' && (global as any).getCurrentUserId) {
    return (global as any).getCurrentUserId();
  }
  return 'current-user-id';
}

export const updatePreference = tool({
  description: 'Update user preferences based on request or learned behavior',
  parameters: z.object({
    preference: z.enum(['lunch_time', 'work_hours', 'break_schedule', 'email_settings', 'open_time']),
    value: z.any().describe('The new value for the preference'),
    reason: z.string().describe('Why this change is being made'),
  }),
  execute: async ({ preference, value, reason }) => {
    const userId = getCurrentUserId();
    const factory = ServiceFactory.getInstance();
    factory.configure({ userId }, true);
    const preferenceService = factory.getPreferenceService();
    
    try {
      switch (preference) {
        case 'lunch_time': {
          const { startTime, duration } = value as { startTime: string; duration?: number };
          await preferenceService.updateBreakSchedule({
            lunchTime: startTime,
            lunchDuration: duration || 60
          });
          
          return {
            success: true,
            message: `Updated lunch time to ${startTime} with duration ${duration || 60} minutes. Reason: ${reason}`,
          };
        }
        
        case 'work_hours': {
          const { startTime, endTime } = value as { startTime: string; endTime: string };
          await preferenceService.updatePreferences({
            workStartTime: startTime,
            workEndTime: endTime
          });
          
          return {
            success: true,
            message: `Updated work hours to ${startTime} - ${endTime}. Reason: ${reason}`,
          };
        }
        
        case 'break_schedule': {
          await preferenceService.updateBreakSchedule(value);
          
          return {
            success: true,
            message: `Updated break schedule. Reason: ${reason}`,
          };
        }
        
        case 'email_settings': {
          await preferenceService.updateEmailPreferences(value);
          
          return {
            success: true,
            message: `Updated email preferences. Reason: ${reason}`,
          };
        }
        
        case 'open_time': {
          await preferenceService.updateOpenTimePreferences(value);
          
          return {
            success: true,
            message: `Updated open time preferences. Reason: ${reason}`,
          };
        }
        
        default:
          return {
            success: false,
            error: `Unknown preference type: ${preference}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to update preference: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },
});

export const getPreferences = tool({
  description: 'Get current user preferences',
  parameters: z.object({}),
  execute: async () => {
    const userId = getCurrentUserId();
    const factory = ServiceFactory.getInstance();
    factory.configure({ userId }, true);
    const preferenceService = factory.getPreferenceService();
    
    try {
      const preferences = await preferenceService.getUserPreferences();
      
      return {
        success: true,
        preferences: {
          workHours: {
            start: preferences.workStartTime,
            end: preferences.workEndTime
          },
          lunch: {
            time: preferences.lunchStartTime,
            duration: preferences.lunchDurationMinutes
          },
          breaks: preferences.breakSchedule,
          email: preferences.emailPreferences,
          openTime: preferences.openTimePreferences
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get preferences: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },
}); 