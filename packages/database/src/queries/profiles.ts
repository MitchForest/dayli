import type { QueryResult, QueryListResult, QueryOptions } from '../types';
import type { Database } from '../database.types';
import { SupabaseClient } from '@supabase/supabase-js';

type Profile = Database['public']['Tables']['profiles']['Row'];

// User profile type based on the profiles table
export interface UserProfile {
  id: string;
  auth_user_id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_private: boolean;
  show_bankroll: boolean;
  show_stats: boolean;
  show_picks: boolean;
  notification_settings: Record<string, unknown>;
  privacy_settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserProfileUpdate {
  username?: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  is_private?: boolean;
  show_bankroll?: boolean;
  show_stats?: boolean;
  show_picks?: boolean;
  notification_settings?: Record<string, unknown>;
  privacy_settings?: Record<string, unknown>;
}

// NOTE: These functions are commented out as they need to be refactored
// to accept a Supabase client parameter instead of using a global client

// /**
//  * Get current user's profile
//  */
// export async function getCurrentUserProfile(): Promise<QueryResult<UserProfile>> {
//   // Implementation needs refactoring
// }

/**
 * Get a user profile by user ID
 */
export async function getProfile(
  userId: string,
  supabase: SupabaseClient<Database>
): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      // Don't log error for missing profile (404)
      if (error.code !== 'PGRST116') {
        console.error('Error fetching profile:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          userId
        });
      }
      return null;
    }

    return data;
  } catch (err) {
    console.error('Unexpected error fetching profile:', err);
    return null;
  }
}

// /**
//  * Get a user profile by username
//  */
// export async function getUserProfileByUsername(username: string): Promise<QueryResult<UserProfile>> {
//   // Implementation needs refactoring
// }

// /**
//  * Update current user's profile
//  */
// export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile | null> {
//   // Implementation needs refactoring
// }

// /**
//  * Create a new user profile
//  */
// export async function createProfile(profile: Omit<Profile, 'created_at' | 'updated_at'>): Promise<Profile | null> {
//   // Implementation needs refactoring
// }

// /**
//  * Search user profiles with optional filters and pagination
//  */
// export async function searchUserProfiles(options: QueryOptions = {}): Promise<QueryListResult<UserProfile>> {
//   // Implementation needs refactoring
// }

// /**
//  * Check if username is available
//  */
// export async function isUsernameAvailable(username: string): Promise<QueryResult<boolean>> {
//   // Implementation needs refactoring
// } 