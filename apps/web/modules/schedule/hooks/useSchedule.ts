import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@repo/auth/hooks';
import { useScheduleStore } from '../store/scheduleStore';
import { useSimpleScheduleStore } from '../store/simpleScheduleStore';
import {
  getTimeBlocksForSchedule,
  getTasksForTimeBlock,
  getEmailsForTimeBlock,
} from '@repo/database/queries';
import type { DailySchedule, TimeBlock as AppTimeBlock } from '../types/schedule.types';
import type { TimeBlock as DbTimeBlock, Task as DbTask, Email as DbEmail } from '@repo/database';
import { format, addDays, subDays, startOfDay, endOfDay } from 'date-fns';

export function useSchedule() {
  const { user, supabase } = useAuth();
  const { getSchedule, setSchedule, refreshTrigger } = useScheduleStore();
  const currentDate = useSimpleScheduleStore((state) => state.currentDate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScheduleForDate = useCallback(async (date: Date, forceRefresh = false) => {
    if (!user || !supabase) return null;

    const dateString = format(date, 'yyyy-MM-dd');
    
    // Check if we already have this schedule (unless forcing refresh)
    const existingSchedule = getSchedule(dateString);
    if (existingSchedule && !forceRefresh) return existingSchedule;

    try {
      // Skip daily_schedules and fetch time blocks directly
      const startOfDayDate = startOfDay(date);
      const endOfDayDate = endOfDay(date);

      const { data: dbTimeBlocks, error: blocksError } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', startOfDayDate.toISOString())
        .lte('start_time', endOfDayDate.toISOString())
        .order('start_time', { ascending: true });

      if (blocksError) {
        console.error('Error fetching time blocks:', blocksError);
        throw blocksError;
      }

      const blocksWithDetails = await Promise.all(
        (dbTimeBlocks || []).map(async (block: DbTimeBlock) => {
          const tasks = await getTasksForTimeBlock(block.id, supabase);
          const emails = await getEmailsForTimeBlock(block.id, supabase);
          return { ...block, tasks, emails };
        })
      );

      const fullSchedule: DailySchedule = {
        date: dateString,
        timeBlocks: blocksWithDetails.map(block => {
          const getBlockType = (type: DbTimeBlock['type']): AppTimeBlock['type'] => {
            const typeMap: Record<string, AppTimeBlock['type']> = {
              'work': 'work',
              'meeting': 'meeting', 
              'email': 'email', 
              'break': 'break',
              'blocked': 'blocked',
              // Map legacy types
              'focus': 'work',
              'quick-decisions': 'email'
            };
            return typeMap[type || 'work'] || 'work';
          };
          return {
            id: block.id,
            type: getBlockType(block.type),
            title: block.title || 'Untitled',
            startTime: format(new Date(block.start_time), 'HH:mm'),
            endTime: format(new Date(block.end_time), 'HH:mm'),
            tasks: (block.tasks || []).map((task: DbTask) => ({
              id: task.id,
              title: task.title,
              completed: task.completed || false,
              priority: 'medium',
              estimatedMinutes: 30,
              source: 'manual',
            })),
            emailQueue: (block.emails || []).map((email: DbEmail) => ({
              id: email.id,
              from: email.from_name || email.from_email || 'Unknown',
              subject: email.subject || 'No Subject',
              preview: email.body_preview || '',
            })),
            source: 'manual',
          };
        }),
        dailyTasks: [],
        stats: { emailsProcessed: 0, tasksCompleted: 0, focusMinutes: 0 },
      };

      setSchedule(dateString, fullSchedule);
      return fullSchedule;
    } catch (e: any) {
      console.error('Failed to fetch schedule for', dateString, ':', e);
      setError('Failed to load schedule.');
      return null;
    }
  }, [user, supabase, getSchedule, setSchedule]);

  const fetchAdjacentSchedules = useCallback(async (centerDate: Date, forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      // Always fetch current day and adjacent days
      const datesToFetch = [
        subDays(centerDate, 1),
        centerDate,
        addDays(centerDate, 1)
      ];
      
      await Promise.all(datesToFetch.map(date => fetchScheduleForDate(date, forceRefresh)));
    } catch (e: any) {
      console.error('Failed to fetch schedules:', e);
      setError('Failed to load surrounding schedules.');
    } finally {
      setLoading(false);
    }
  }, [fetchScheduleForDate]);

  // Fetch schedules whenever the current date changes
  useEffect(() => {
    if (user && supabase && currentDate) {
      fetchAdjacentSchedules(currentDate);
    }
  }, [currentDate, user, supabase, fetchAdjacentSchedules]);

  // Refetch when refresh is triggered
  useEffect(() => {
    if (user && supabase && currentDate && refreshTrigger > 0) {
      fetchAdjacentSchedules(currentDate, true);
    }
  }, [refreshTrigger, currentDate, user, supabase, fetchAdjacentSchedules]);

  return { loading, error };
} 