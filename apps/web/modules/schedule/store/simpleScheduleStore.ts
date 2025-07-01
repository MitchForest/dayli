import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { startOfToday, format } from 'date-fns';
import type { UserPreferencesTyped } from '@/modules/settings/types/preferences.types';

interface SimpleScheduleState {
  currentDate: Date;
  preferences: UserPreferencesTyped | null;
  navigatedToTodayViaButton: boolean;
  
  // Actions
  setCurrentDate: (date: Date) => void;
  setPreferences: (prefs: UserPreferencesTyped) => void;
  navigateToToday: () => void;
  navigateToNextDay: () => void;
  navigateToPreviousDay: () => void;
  clearTodayNavigation: () => void;
}

export const useSimpleScheduleStore = create<SimpleScheduleState>()(
  subscribeWithSelector((set, get) => ({
    currentDate: startOfToday(),
    preferences: null,
    navigatedToTodayViaButton: false,
    
    setCurrentDate: (date) => set({ currentDate: date }),
    
    setPreferences: (prefs) => set({ preferences: prefs }),
    
    navigateToToday: () => {
      const today = startOfToday();
      set({ currentDate: today, navigatedToTodayViaButton: true });
    },
    
    navigateToNextDay: () => set((state) => {
      const nextDay = new Date(state.currentDate);
      nextDay.setDate(nextDay.getDate() + 1);
      return { currentDate: nextDay };
    }),
    
    navigateToPreviousDay: () => set((state) => {
      const prevDay = new Date(state.currentDate);
      prevDay.setDate(prevDay.getDate() - 1);
      return { currentDate: prevDay };
    }),
    
    clearTodayNavigation: () => set({ navigatedToTodayViaButton: false }),
  }))
); 