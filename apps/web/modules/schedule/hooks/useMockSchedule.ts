import { useEffect } from 'react';
import { useScheduleStore } from '@/stores';
import { generateMockSchedule } from '../utils/mockGenerator';
import type { MockScenario } from '@/lib/constants';

export function useMockSchedule(scenario: MockScenario = 'typical_day') {
  const { schedule, setSchedule } = useScheduleStore();
  
  useEffect(() => {
    // Only generate if we don't have a schedule
    if (!schedule) {
      const mockSchedule = generateMockSchedule(scenario);
      setSchedule(mockSchedule);
    }
  }, [scenario, schedule, setSchedule]);
  
  const regenerateSchedule = (newScenario?: MockScenario) => {
    const mockSchedule = generateMockSchedule(newScenario || scenario);
    setSchedule(mockSchedule);
  };
  
  return {
    schedule,
    regenerateSchedule,
  };
} 