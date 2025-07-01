import { useCallback } from 'react';
import { useScheduleStore } from '../store/scheduleStore';
import { useCanvasStore } from '../canvas/CanvasStore';
import { generateMockSchedule } from '../utils/mockGenerator';
import { format } from 'date-fns';

export function useDailyPlanning() {
  const setSchedule = useScheduleStore(state => state.setSchedule);
  const currentDate = useCanvasStore(state => state.currentDate);
  
  const triggerDailyPlanning = useCallback(async () => {
    // Mock implementation - simulate API call
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Generate a new optimized schedule (using focus_day as the optimized version)
    const optimizedSchedule = generateMockSchedule('focus_day');
    const dateString = format(currentDate, 'yyyy-MM-dd');
    
    // Set the schedule with the current date
    setSchedule(dateString, optimizedSchedule);
    
    return optimizedSchedule;
  }, [setSchedule, currentDate]);
  
  return {
    triggerDailyPlanning,
  };
} 