import { useCallback } from 'react';
import { useScheduleStore } from '@/stores';

export function useTaskActions() {
  const { toggleTaskComplete, schedule } = useScheduleStore();
  
  const completeTask = useCallback((taskId: string) => {
    // Add any enhanced completion logic here
    // For now, just use the store action
    toggleTaskComplete(taskId);
  }, [toggleTaskComplete]);
  
  const getTaskById = useCallback((taskId: string) => {
    if (!schedule) return null;
    
    // Search through all time blocks for the task
    for (const block of schedule.timeBlocks) {
      const task = block.tasks.find(t => t.id === taskId);
      if (task) return task;
    }
    
    // Also check daily tasks
    return schedule.dailyTasks.find(t => t.id === taskId) || null;
  }, [schedule]);
  
  const getTaskStats = useCallback(() => {
    if (!schedule) return { total: 0, completed: 0, percentage: 0 };
    
    const total = schedule.dailyTasks.length;
    const completed = schedule.dailyTasks.filter(t => t.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { total, completed, percentage };
  }, [schedule]);
  
  return {
    completeTask,
    getTaskById,
    getTaskStats,
  };
} 