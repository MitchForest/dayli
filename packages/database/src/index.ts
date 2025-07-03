// Re-export all types from the generated types file
export * from './types';

// Import the types we need
import type { Tables, TablesInsert, TablesUpdate } from './types';

// Create specific table type aliases for convenience
export type DailySchedule = Tables<'daily_schedules'>;
export type DailyScheduleInsert = TablesInsert<'daily_schedules'>;
export type DailyScheduleUpdate = TablesUpdate<'daily_schedules'>;

export type TimeBlock = Tables<'time_blocks'>;
export type TimeBlockInsert = TablesInsert<'time_blocks'>;
export type TimeBlockUpdate = TablesUpdate<'time_blocks'>;

export type Task = Tables<'tasks'>;
export type TaskInsert = TablesInsert<'tasks'>;
export type TaskUpdate = TablesUpdate<'tasks'>;

export type Email = Tables<'emails'>;
export type EmailInsert = TablesInsert<'emails'>;
export type EmailUpdate = TablesUpdate<'emails'>;

export type Profile = Tables<'profiles'>;
export type ProfileInsert = TablesInsert<'profiles'>;
export type ProfileUpdate = TablesUpdate<'profiles'>;

export type UserPreferences = Tables<'user_preferences'>;
export type UserPreferencesInsert = TablesInsert<'user_preferences'>;
export type UserPreferencesUpdate = TablesUpdate<'user_preferences'>;

// All data is now consolidated in the main tables:
// - Tasks: use status='backlog' for backlog items
// - Emails: use status='backlog' for backlog items

// Query result types
export type QueryResult<T> = {
  data: T | null;
  error: string | null;
}; 