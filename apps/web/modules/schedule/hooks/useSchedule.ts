import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@repo/auth/hooks';
import { useScheduleStore } from '../store/scheduleStore';
import { useCanvasStore } from '../canvas/CanvasStore';
import {
  getDailySchedule,
  getTimeBlocksForSchedule,
  getTasksForTimeBlock,
  getEmailsForTimeBlock,
} from '@repo/database/queries';
import type { DailySchedule, TimeBlock as AppTimeBlock } from '../types/schedule.types';
import type { TimeBlock as DbTimeBlock, Task as DbTask, Email as DbEmail } from '@repo/database/types';
import { format, addDays, subDays } from 'date-fns';

export function useSchedule() {
  const { user, supabase } = useAuth();
  const { getSchedule, setSchedule } = useScheduleStore();
  const currentDate = useCanvasStore((state) => state.currentDate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScheduleForDate = useCallback(async (date: Date) => {
    if (!user || !supabase) return null;

    const dateString = format(date, 'yyyy-MM-dd');
    if (getSchedule(dateString)) return getSchedule(dateString);

    try {
      const dailySchedule = await getDailySchedule(user.id, dateString, supabase);
      if (!dailySchedule) return null;

      const dbTimeBlocks = await getTimeBlocksForSchedule(dailySchedule.id, supabase);
      const blocksWithDetails = await Promise.all(
        dbTimeBlocks.map(async (block: DbTimeBlock) => {
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
              'focus': 'focus', 'meeting': 'meeting', 'email': 'email', 'break': 'break', 'quick-decisions': 'quick-decisions'
            };
            return typeMap[type || 'focus'] || 'focus';
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

  const fetchAdjacentSchedules = useCallback(async (centerDate: Date) => {
    setLoading(true);
    setError(null);
    try {
      const datesToFetch = [centerDate, subDays(centerDate, 1), addDays(centerDate, 1)];
      await Promise.all(datesToFetch.map(date => fetchScheduleForDate(date)));
    } catch (e: any) {
      console.error('Failed to fetch schedules:', e);
      setError('Failed to load surrounding schedules.');
    } finally {
      setLoading(false);
    }
  }, [fetchScheduleForDate]);

  useEffect(() => {
    if (user && supabase) {
      fetchAdjacentSchedules(currentDate);
    }
  }, [currentDate, user, supabase, fetchAdjacentSchedules]);

  return { loading, error };
} 