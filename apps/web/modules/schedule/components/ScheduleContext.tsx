'use client';

import { createContext, useContext } from 'react';

interface ScheduleNavigationContextType {
  navigateToNextDay: () => void;
  navigateToPreviousDay: () => void;
  navigateToToday: () => void;
}

const ScheduleNavigationContext = createContext<ScheduleNavigationContextType | null>(null);

export const ScheduleNavigationProvider = ScheduleNavigationContext.Provider;

export function useScheduleNavigation() {
  const context = useContext(ScheduleNavigationContext);
  if (!context) {
    throw new Error('useScheduleNavigation must be used within ScheduleNavigationProvider');
  }
  return context;
} 