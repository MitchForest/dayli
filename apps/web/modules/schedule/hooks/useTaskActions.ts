import { useCallback } from 'react';
import { useScheduleStore } from '../store/scheduleStore';
import { useSimpleScheduleStore } from '../store/simpleScheduleStore';
import { format } from 'date-fns';
import type { DailyTask } from '../types/schedule.types';

export function useTaskActions() {
  const { toggleTaskComplete, getSchedule } = useScheduleStore();
  const currentDate = useSimpleScheduleStore(state => state.currentDate);
  
  const completeTask = useCallback((taskId: string) => {
    const dateString = format(currentDate, 'yyyy-MM-dd');
    toggleTaskComplete(dateString, taskId);
  }, [toggleTaskComplete, currentDate]);
  
  const getTaskById = useCallback((taskId: string): DailyTask | null => {
    const dateString = format(currentDate, 'yyyy-MM-dd');
    const schedule = getSchedule(dateString);
    
    if (!schedule) return null;
    
    // Search through all time blocks for the task
    for (const block of schedule.timeBlocks) {
      const task = block.tasks.find((t: DailyTask) => t.id === taskId);
      if (task) return task;
    }
    
    // Also check daily tasks
    return schedule.dailyTasks.find((t: DailyTask) => t.id === taskId) || null;
  }, [getSchedule, currentDate]);
  
  const getTaskStats = useCallback(() => {
    const dateString = format(currentDate, 'yyyy-MM-dd');
    const schedule = getSchedule(dateString);
    
    if (!schedule) return { total: 0, completed: 0, percentage: 0 };
    
    const total = schedule.dailyTasks.length;
    const completed = schedule.dailyTasks.filter((t: DailyTask) => t.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { total, completed, percentage };
  }, [getSchedule, currentDate]);
  
  return {
    completeTask,
    getTaskById,
    getTaskStats,
  };
} 