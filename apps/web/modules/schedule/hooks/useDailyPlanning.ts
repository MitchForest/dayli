import { useCallback } from 'react';
import { useScheduleStore } from '@/stores';
import { generateMockSchedule } from '../utils/mockGenerator';

export function useDailyPlanning() {
  const setSchedule = useScheduleStore(state => state.setSchedule);
  
  const triggerDailyPlanning = useCallback(async () => {
    // Mock implementation - simulate API call
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Generate a new optimized schedule (using focus_day as the optimized version)
    const optimizedSchedule = generateMockSchedule('focus_day');
    setSchedule(optimizedSchedule);
    
    return optimizedSchedule;
  }, [setSchedule]);
  
  return {
    triggerDailyPlanning,
  };
} 