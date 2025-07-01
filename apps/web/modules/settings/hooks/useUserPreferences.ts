/**
 * Hook for managing user preferences using the Supabase client from AuthContext
 */

import { useEffect } from 'react';
import { useAuth } from '@repo/auth/hooks';
import { usePreferencesStore } from '@/stores';
import { 
  getUserPreferences, 
  upsertUserPreferences 
} from '@repo/database/queries';
import type { UserPreferencesFormData } from '../types/preferences.types';
import { DEFAULT_PREFERENCES } from '../types/preferences.types';

export const useUserPreferences = () => {
  const { user, supabase } = useAuth();
  const { 
    preferences, 
    isLoading, 
    error,
    setPreferences,
    setLoading,
    setError 
  } = usePreferencesStore();

  // Load preferences when user changes
  useEffect(() => {
    if (!user?.id || !supabase) return;

    const loadPreferences = async () => {
      setLoading(true);
      try {
        const data = await getUserPreferences(user.id, supabase);
        
        if (data) {
          // Parse JSONB fields
          setPreferences({
            ...data,
            meeting_windows: data.meeting_windows as any || [],
            focus_blocks: data.focus_blocks as any || [],
          });
        } else {
          // No preferences exist, create defaults
          const defaultPrefs = await upsertUserPreferences(
            {
              user_id: user.id,
              ...DEFAULT_PREFERENCES,
              // Convert typed arrays to JSON for database
              meeting_windows: DEFAULT_PREFERENCES.meeting_windows as any,
              focus_blocks: DEFAULT_PREFERENCES.focus_blocks as any,
            },
            supabase
          );
          
          if (defaultPrefs) {
            setPreferences({
              ...defaultPrefs,
              meeting_windows: defaultPrefs.meeting_windows as any || [],
              focus_blocks: defaultPrefs.focus_blocks as any || [],
            });
          }
        }
      } catch (err) {
        console.error('Failed to load preferences:', err);
        setError('Failed to load preferences');
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [user?.id, supabase, setPreferences, setLoading, setError]);

  const savePreferences = async (data: UserPreferencesFormData): Promise<boolean> => {
    if (!user?.id || !supabase) return false;

    setLoading(true);
    try {
      const result = await upsertUserPreferences(
        {
          user_id: user.id,
          ...data,
          // Convert typed arrays to JSON for database
          meeting_windows: data.meeting_windows as any,
          focus_blocks: data.focus_blocks as any,
        },
        supabase
      );

      if (result) {
        setPreferences({
          ...result,
          meeting_windows: result.meeting_windows as any || [],
          focus_blocks: result.focus_blocks as any || [],
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to save preferences:', err);
      setError('Failed to save preferences');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    preferences,
    isLoading,
    error,
    savePreferences,
  };
}; 