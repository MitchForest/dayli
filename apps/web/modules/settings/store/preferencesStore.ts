import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { UserPreferencesTyped, UserPreferencesFormData } from '../types/preferences.types';
import { DEFAULT_PREFERENCES } from '../types/preferences.types';

interface PreferencesState {
  preferences: UserPreferencesTyped | null;
  isLoading: boolean;
  error: string | null;
  
  // Setters
  setPreferences: (preferences: UserPreferencesTyped | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Actions
  resetToDefaults: () => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  devtools(
    (set) => ({
      preferences: null,
      isLoading: false,
      error: null,

      setPreferences: (preferences) => set({ preferences }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      resetToDefaults: () => {
        set({ 
          preferences: {
            ...DEFAULT_PREFERENCES,
            id: '',
            user_id: null,
            created_at: null,
            updated_at: null,
          } as UserPreferencesTyped 
        });
      },
    }),
    {
      name: 'preferences-store',
    }
  )
); 