import { useEffect } from 'react';
import { useAuth } from '@repo/auth/hooks';
import { useScheduleStore } from '../store/scheduleStore';
import { format } from 'date-fns';
import { isTauri } from '@/lib/utils';

export function useScheduleSubscription() {
  const { user, supabase } = useAuth();
  const invalidateSchedule = useScheduleStore(state => state.invalidateSchedule);

  useEffect(() => {
    if (!user || !supabase) {
      console.log('[ScheduleSubscription] No user or supabase client');
      return;
    }

    console.log('[ScheduleSubscription] Setting up real-time subscription', {
      userId: user.id,
      isDesktop: isTauri()
    });

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
          console.log('[ScheduleSubscription] Time block change detected:', {
            event: payload.eventType,
            table: payload.table,
            old: payload.old,
            new: payload.new
          });
          
          // Extract the date from the time block
          const newRecord = payload.new as Record<string, any> | null;
          const oldRecord = payload.old as Record<string, any> | null;
          
          const startTime = newRecord?.start_time || oldRecord?.start_time;
          if (startTime) {
            const date = format(new Date(startTime), 'yyyy-MM-dd');
            
            console.log(`[ScheduleSubscription] Invalidating schedule for date: ${date}`);
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
          console.log('[ScheduleSubscription] Task change detected:', payload);
          
          // For tasks, we might need to invalidate today's schedule
          // since we don't know which date the task is assigned to
          const today = format(new Date(), 'yyyy-MM-dd');
          invalidateSchedule(today);
        }
      )
      .subscribe((status, err) => {
        console.log('[ScheduleSubscription] Subscription status:', status);
        if (err) {
          console.error('[ScheduleSubscription] Subscription error:', err);
        }
        
        if (status === 'SUBSCRIBED') {
          console.log('[ScheduleSubscription] Successfully subscribed to real-time changes');
        } else if (status === 'CLOSED') {
          console.log('[ScheduleSubscription] Subscription closed');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[ScheduleSubscription] Channel error - auth might be failing');
        }
      });

    return () => {
      console.log('[ScheduleSubscription] Cleaning up subscription');
      subscription.unsubscribe();
    };
  }, [user, supabase, invalidateSchedule]);
} 