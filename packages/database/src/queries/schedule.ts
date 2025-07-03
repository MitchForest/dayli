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
} from '../index';

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
    // First get the time block with its assigned tasks
    const { data: timeBlock, error: blockError } = await client
      .from('time_blocks')
      .select('assigned_tasks')
      .eq('id', timeBlockId)
      .single();

    if (blockError || !timeBlock || !timeBlock.assigned_tasks) {
      console.error('Error fetching time block:', blockError);
      return [];
    }

    // Extract task IDs from JSONB array
    const taskIds = (timeBlock.assigned_tasks as Array<{ id: string } | string>).map(t => 
      typeof t === 'string' ? t : t.id
    );

    if (taskIds.length === 0) {
      return [];
    }

    // Fetch the actual tasks
    const { data: tasks, error: tasksError } = await client
      .from('tasks')
      .select('*')
      .in('id', taskIds);

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      return [];
    }

    return tasks || [];
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
    // First get the time block with its assigned emails
    const { data: timeBlock, error: blockError } = await client
      .from('time_blocks')
      .select('assigned_emails')
      .eq('id', timeBlockId)
      .single();

    if (blockError || !timeBlock || !timeBlock.assigned_emails) {
      console.error('Error fetching time block:', blockError);
      return [];
    }

    // Extract email IDs from JSONB array
    const emailIds = (timeBlock.assigned_emails as Array<{ id: string } | string>).map(e => 
      typeof e === 'string' ? e : e.id
    );

    if (emailIds.length === 0) {
      return [];
    }

    // Fetch the actual emails
    const { data: emails, error: emailsError } = await client
      .from('emails')
      .select('*')
      .in('id', emailIds);

    if (emailsError) {
      console.error('Error fetching emails:', emailsError);
      return [];
    }

    return emails || [];
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
    // Get current assigned tasks
    const { data: timeBlock, error: fetchError } = await client
      .from('time_blocks')
      .select('assigned_tasks')
      .eq('id', timeBlockId)
      .single();

    if (fetchError || !timeBlock) {
      console.error('Error fetching time block:', fetchError);
      return false;
    }

    // Update the JSONB array
    const currentTasks = (timeBlock.assigned_tasks as Array<{ id: string; position: number }>) || [];
    const updatedTasks = [...currentTasks, { id: taskId, position }];

    const { error: updateError } = await client
      .from('time_blocks')
      .update({ assigned_tasks: updatedTasks })
      .eq('id', timeBlockId);

    if (updateError) {
      console.error('Error updating time block:', updateError);
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
    // Get current assigned tasks
    const { data: timeBlock, error: fetchError } = await client
      .from('time_blocks')
      .select('assigned_tasks')
      .eq('id', timeBlockId)
      .single();

    if (fetchError || !timeBlock) {
      console.error('Error fetching time block:', fetchError);
      return false;
    }

    // Remove the task from the JSONB array
    const currentTasks = (timeBlock.assigned_tasks as Array<{ id: string } | string>) || [];
    const updatedTasks = currentTasks.filter(t => {
      const id = typeof t === 'string' ? t : t.id;
      return id !== taskId;
    });

    const { error: updateError } = await client
      .from('time_blocks')
      .update({ assigned_tasks: updatedTasks })
      .eq('id', timeBlockId);

    if (updateError) {
      console.error('Error updating time block:', updateError);
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