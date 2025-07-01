import type { SupabaseClient } from '@supabase/supabase-js';
import type { 
  Database, 
  DailySchedule, 
  DailyScheduleInsert,
  TimeBlock, 
  TimeBlockInsert,
  TimeBlockUpdate,
  Task,
  Email
} from '../types';

/**
 * Get or create a daily schedule for a specific date
 */
export async function getDailySchedule(
  userId: string,
  date: string, // YYYY-MM-DD format
  client: SupabaseClient<Database>
): Promise<DailySchedule | null> {
  try {
    // First try to get existing schedule
    const { data: existingSchedule, error: fetchError } = await client
      .from('daily_schedules')
      .select('*')
      .eq('user_id', userId)
      .eq('schedule_date', date)
      .single();

    if (existingSchedule) {
      return existingSchedule;
    }

    // If not found and it's not a real error, create new schedule
    if (fetchError && fetchError.code === 'PGRST116') {
      const newSchedule: DailyScheduleInsert = {
        user_id: userId,
        schedule_date: date,
        stats: {
          emailsProcessed: 0,
          tasksCompleted: 0,
          focusMinutes: 0
        }
      };

      const { data: createdSchedule, error: createError } = await client
        .from('daily_schedules')
        .insert(newSchedule)
        .select()
        .single();

      if (createError) {
        console.error('Error creating daily schedule:', createError);
        return null;
      }

      return createdSchedule;
    }

    // If there was a different error, log it
    if (fetchError) {
      console.error('Error fetching daily schedule:', fetchError);
    }

    return null;
  } catch (err) {
    console.error('Unexpected error in getDailySchedule:', err);
    return null;
  }
}

/**
 * Get all time blocks for a daily schedule
 */
export async function getTimeBlocksForSchedule(
  scheduleId: string,
  client: SupabaseClient<Database>
): Promise<TimeBlock[]> {
  try {
    const { data, error } = await client
      .from('time_blocks')
      .select('*')
      .eq('daily_schedule_id', scheduleId)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching time blocks:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Unexpected error in getTimeBlocksForSchedule:', err);
    return [];
  }
}

/**
 * Get tasks assigned to a time block
 */
export async function getTasksForTimeBlock(
  timeBlockId: string,
  client: SupabaseClient<Database>
): Promise<Task[]> {
  try {
    const { data, error } = await client
      .from('time_block_tasks')
      .select(`
        position,
        tasks (*)
      `)
      .eq('time_block_id', timeBlockId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error fetching tasks for time block:', error);
      return [];
    }

    // Extract and return just the task objects
    return data?.map(item => {
      const taskItem = item as { position: number | null; tasks: Task };
      return taskItem.tasks;
    }).filter(Boolean) || [];
  } catch (err) {
    console.error('Unexpected error in getTasksForTimeBlock:', err);
    return [];
  }
}

/**
 * Get emails assigned to a time block
 */
export async function getEmailsForTimeBlock(
  timeBlockId: string,
  client: SupabaseClient<Database>
): Promise<Email[]> {
  try {
    const { data, error } = await client
      .from('time_block_emails')
      .select(`
        position,
        emails (*)
      `)
      .eq('time_block_id', timeBlockId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error fetching emails for time block:', error);
      return [];
    }

    // Extract and return just the email objects
    return data?.map(item => {
      const emailItem = item as { position: number | null; emails: Email };
      return emailItem.emails;
    }).filter(Boolean) || [];
  } catch (err) {
    console.error('Unexpected error in getEmailsForTimeBlock:', err);
    return [];
  }
}

/**
 * Create a new time block
 */
export async function createTimeBlock(
  block: TimeBlockInsert,
  client: SupabaseClient<Database>
): Promise<TimeBlock | null> {
  try {
    const { data, error } = await client
      .from('time_blocks')
      .insert(block)
      .select()
      .single();

    if (error) {
      console.error('Error creating time block:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Unexpected error in createTimeBlock:', err);
    return null;
  }
}

/**
 * Update a time block
 */
export async function updateTimeBlock(
  id: string,
  updates: TimeBlockUpdate,
  client: SupabaseClient<Database>
): Promise<TimeBlock | null> {
  try {
    const { data, error } = await client
      .from('time_blocks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating time block:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Unexpected error in updateTimeBlock:', err);
    return null;
  }
}

/**
 * Assign a task to a time block
 */
export async function assignTaskToTimeBlock(
  timeBlockId: string,
  taskId: string,
  position: number,
  client: SupabaseClient<Database>
): Promise<boolean> {
  try {
    const { error } = await client
      .from('time_block_tasks')
      .insert({
        time_block_id: timeBlockId,
        task_id: taskId,
        position
      });

    if (error) {
      console.error('Error assigning task to time block:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Unexpected error in assignTaskToTimeBlock:', err);
    return false;
  }
}

/**
 * Remove a task from a time block
 */
export async function removeTaskFromTimeBlock(
  timeBlockId: string,
  taskId: string,
  client: SupabaseClient<Database>
): Promise<boolean> {
  try {
    const { error } = await client
      .from('time_block_tasks')
      .delete()
      .eq('time_block_id', timeBlockId)
      .eq('task_id', taskId);

    if (error) {
      console.error('Error removing task from time block:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Unexpected error in removeTaskFromTimeBlock:', err);
    return false;
  }
}

/**
 * Update daily schedule stats
 */
export async function updateScheduleStats(
  scheduleId: string,
  stats: Partial<{
    emailsProcessed: number;
    tasksCompleted: number;
    focusMinutes: number;
  }>,
  client: SupabaseClient<Database>
): Promise<boolean> {
  try {
    // First get current stats
    const { data: schedule, error: fetchError } = await client
      .from('daily_schedules')
      .select('stats')
      .eq('id', scheduleId)
      .single();

    if (fetchError || !schedule) {
      console.error('Error fetching schedule for stats update:', fetchError);
      return false;
    }

    // Merge stats
    const currentStats = schedule.stats as {
      emailsProcessed: number;
      tasksCompleted: number;
      focusMinutes: number;
    } || {
      emailsProcessed: 0,
      tasksCompleted: 0,
      focusMinutes: 0
    };

    const updatedStats = {
      emailsProcessed: stats.emailsProcessed ?? currentStats.emailsProcessed,
      tasksCompleted: stats.tasksCompleted ?? currentStats.tasksCompleted,
      focusMinutes: stats.focusMinutes ?? currentStats.focusMinutes
    };

    // Update with merged stats
    const { error: updateError } = await client
      .from('daily_schedules')
      .update({ stats: updatedStats })
      .eq('id', scheduleId);

    if (updateError) {
      console.error('Error updating schedule stats:', updateError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Unexpected error in updateScheduleStats:', err);
    return false;
  }
} 