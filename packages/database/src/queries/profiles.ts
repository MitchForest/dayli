import { supabase } from '../client';
import type { QueryResult, QueryListResult, QueryOptions } from '../types';
import type { Database } from '../database.types';

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

/**
 * Get current user's profile
 */
export async function getCurrentUserProfile(): Promise<QueryResult<UserProfile>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'No authenticated user' };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (error && error.code === 'PGRST116') {
      // No user profile found - this is OK, they might need to complete onboarding
      return { data: null, error: null };
    }

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Get a user profile by user ID
 */
export async function getProfile(userId: string): Promise<Profile | null> {
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

/**
 * Get a user profile by username
 */
export async function getUserProfileByUsername(username: string): Promise<QueryResult<UserProfile>> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Update current user's profile
 */
export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating profile:', error);
    return null;
  }

  return data;
}

/**
 * Create a new user profile
 */
export async function createProfile(profile: Omit<Profile, 'created_at' | 'updated_at'>): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .insert(profile)
    .select()
    .single();

  if (error) {
    console.error('Error creating profile:', error);
    return null;
  }

  return data;
}

/**
 * Search user profiles with optional filters and pagination
 */
export async function searchUserProfiles(options: QueryOptions = {}): Promise<QueryListResult<UserProfile>> {
  try {
    let query = supabase.from('profiles').select('*', { count: 'exact' });

    // Only show non-private profiles or current user's profile
    const currentUser = await supabase.auth.getUser();
    if (currentUser.data.user) {
      query = query.or(`is_private.eq.false,auth_user_id.eq.${currentUser.data.user.id}`);
    } else {
      query = query.eq('is_private', false);
    }

    // Apply search filter
    if (options.search) {
      query = query.or(`username.ilike.%${options.search}%,display_name.ilike.%${options.search}%`);
    }

    // Apply sorting
    if (options.sortBy) {
      query = query.order(options.sortBy, { ascending: options.sortOrder === 'asc' });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // Apply pagination
    if (options.limit) {
      const offset = options.offset || (options.page ? (options.page - 1) * options.limit : 0);
      query = query.range(offset, offset + options.limit - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      return { data: null, error: error.message, count: 0 };
    }

    return { data, error: null, count: count || 0 };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error', count: 0 };
  }
}

/**
 * Check if username is available
 */
export async function isUsernameAvailable(username: string): Promise<QueryResult<boolean>> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data === null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
} 