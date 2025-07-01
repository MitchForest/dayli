import { useEffect } from 'react';
import { useAuth } from '@repo/auth/hooks';
import { useScheduleStore } from '../store/scheduleStore';
import { format } from 'date-fns';

export function useScheduleSubscription() {
  const { user, supabase } = useAuth();
  const invalidateSchedule = useScheduleStore(state => state.invalidateSchedule);

  useEffect(() => {
    if (!user || !supabase) return;

    // Subscribe to time_blocks changes for the current user
    const subscription = supabase
      .channel('schedule-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'time_blocks',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Time block change detected:', payload);
          
          // Extract the date from the time block
          const newRecord = payload.new as Record<string, any> | null;
          const oldRecord = payload.old as Record<string, any> | null;
          
          const startTime = newRecord?.start_time || oldRecord?.start_time;
          if (startTime) {
            const date = format(new Date(startTime), 'yyyy-MM-dd');
            
            // Invalidate the schedule for this date
            invalidateSchedule(date);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Task change detected:', payload);
          
          // For tasks, we might need to invalidate today's schedule
          // since we don't know which date the task is assigned to
          const today = format(new Date(), 'yyyy-MM-dd');
          invalidateSchedule(today);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, supabase, invalidateSchedule]);
} 