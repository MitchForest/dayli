import { createServerActionClient } from '@/lib/supabase-server';
import { format, parse, addMinutes } from 'date-fns';

// Get current authenticated user ID
export async function getCurrentUserId(): Promise<string> {
  const supabase = await createServerActionClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new Error('User not authenticated');
  }
  
  return user.id;
}

// Parse time string to Date object
export function parseTime(timeStr: string): Date {
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

// Add minutes to time string
export function addMinutesToTime(time: string | Date, minutes: number): string {
  const date = typeof time === 'string' ? parseTime(time) : new Date(time);
  return format(addMinutes(date, minutes), 'HH:mm');
}

// Format time range for display
export function formatTimeRange(start: string, end: string): string {
  const startTime = parseTime(start);
  const endTime = parseTime(end);
  return `${format(startTime, 'h:mm a')} - ${format(endTime, 'h:mm a')}`;
}

// Convert time string to minutes since midnight
export function timeToMinutes(time: string): number {
  const parts = time.split(':');
  if (parts.length !== 2) return 0;
  const hours = parseInt(parts[0] || '0', 10);
  const minutes = parseInt(parts[1] || '0', 10);
  return hours * 60 + minutes;
}

// Parse natural language time
export function parseNaturalTime(timeStr: string): Date {
  const now = new Date();
  const lower = timeStr.toLowerCase();
  
  // Handle relative days
  if (lower.includes('tomorrow')) {
    now.setDate(now.getDate() + 1);
  } else if (lower.includes('next week')) {
    now.setDate(now.getDate() + 7);
  }
  
  // Extract time like "3pm", "15:00", etc
  const timeMatch = timeStr.match(/(\d{1,2}):?(\d{0,2})\s*(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1] || '0', 10);
    const minutes = parseInt(timeMatch[2] || '0', 10);
    const meridiem = timeMatch[3]?.toLowerCase();
    
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    
    now.setHours(hours, minutes, 0, 0);
  }
  
  return now;
}

// Get user's working hours
export async function getUserWorkingHours(): Promise<{ start: string; end: string }> {
  try {
    const supabase = await createServerActionClient();
    const userId = await getCurrentUserId();
    
    const { data } = await supabase
      .from('user_preferences')
      .select('work_start_time, work_end_time')
      .eq('user_id', userId)
      .single();
    
    return {
      start: data?.work_start_time || '09:00',
      end: data?.work_end_time || '17:00'
    };
  } catch {
    // Return defaults if preferences not found
    return { start: '09:00', end: '17:00' };
  }
}

// Store proposed changes for confirmation workflows
const proposedChangesStore = new Map<string, any[]>();

export async function storeProposedChanges(confirmationId: string, changes: any[]): Promise<void> {
  proposedChangesStore.set(confirmationId, changes);
  
  // Clear after 5 minutes
  setTimeout(() => {
    proposedChangesStore.delete(confirmationId);
  }, 5 * 60 * 1000);
}

export function getProposedChanges(confirmationId: string): any[] | undefined {
  return proposedChangesStore.get(confirmationId);
}

// Helper to get Date from calendar event start/end
export function getEventDate(eventTime: { dateTime?: string; date?: string }): Date {
  if (eventTime.dateTime) {
    return new Date(eventTime.dateTime);
  } else if (eventTime.date) {
    return new Date(eventTime.date);
  }
  throw new Error('Event has no valid date');
} 