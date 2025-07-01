import type { Database } from '@repo/database/database.types';

// Base type from database
export type UserPreferences = Database['public']['Tables']['user_preferences']['Row'];

// Typed versions of JSONB fields
export interface MeetingWindow {
  start: string; // "10:00"
  end: string;   // "12:00"
}

export interface FocusBlock {
  day: string;   // "monday"
  start: string; // "09:00"
  end: string;   // "11:00"
}

// Extended type with proper typing for JSONB fields
export interface UserPreferencesTyped extends Omit<UserPreferences, 'meeting_windows' | 'focus_blocks'> {
  meeting_windows: MeetingWindow[] | null;
  focus_blocks: FocusBlock[] | null;
}

// Form data type for settings page
export interface UserPreferencesFormData {
  // Work Hours
  work_start_time: string;
  work_end_time: string;
  work_days: string[];
  lunch_start_time: string;
  lunch_duration_minutes: number;
  
  // Deep Work Preferences
  target_deep_work_blocks: number;
  deep_work_duration_hours: number;
  deep_work_preference: 'morning' | 'afternoon' | 'no_preference';
  
  // Email Triage Times
  morning_triage_time: string;
  morning_triage_duration_minutes: number;
  evening_triage_time: string;
  evening_triage_duration_minutes: number;
  
  // Meeting Rules
  meeting_windows: MeetingWindow[];
  focus_blocks: FocusBlock[];
  
  // Calendar Auto-Blocking
  protect_deep_work: boolean;
  show_busy_during_triage: boolean;
  add_meeting_buffer: boolean;
  meeting_buffer_minutes: number;
  
  // UI Preferences
  timezone: string;
}

// Default preferences for new users
export const DEFAULT_PREFERENCES: UserPreferencesFormData = {
  work_start_time: '08:00',
  work_end_time: '18:00',
  work_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  lunch_start_time: '12:00',
  lunch_duration_minutes: 60,
  
  target_deep_work_blocks: 2,
  deep_work_duration_hours: 2,
  deep_work_preference: 'no_preference',
  
  morning_triage_time: '08:00',
  morning_triage_duration_minutes: 30,
  evening_triage_time: '16:30',
  evening_triage_duration_minutes: 30,
  
  meeting_windows: [
    { start: '10:00', end: '12:00' },
    { start: '14:00', end: '16:00' }
  ],
  focus_blocks: [
    { day: 'monday', start: '09:00', end: '11:00' },
    { day: 'friday', start: '14:00', end: '17:00' }
  ],
  
  protect_deep_work: true,
  show_busy_during_triage: true,
  add_meeting_buffer: true,
  meeting_buffer_minutes: 15,
  
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
}; 