import { createServerActionClient } from '@/lib/supabase-server';

// Get current authenticated user ID
export async function getCurrentUserId(): Promise<string> {
  const supabase = await createServerActionClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new Error('User not authenticated');
  }
  
  return user.id;
}

// Convert time string to minutes since midnight
export function timeToMinutes(time: string): number {
  const parts = time.split(':');
  if (parts.length !== 2) return 0;
  const hours = parseInt(parts[0] || '0', 10);
  const minutes = parseInt(parts[1] || '0', 10);
  return hours * 60 + minutes;
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