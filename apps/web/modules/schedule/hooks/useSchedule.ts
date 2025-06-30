import { useScheduleStore } from '@/stores';

export function useSchedule() {
  const store = useScheduleStore();
  
  return {
    schedule: store.schedule,
    isLoading: !store.schedule,
    toggleTaskComplete: store.toggleTaskComplete,
    updateTimeBlock: store.updateTimeBlock,
    updateStats: store.updateStats,
  };
} 