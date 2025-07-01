import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

type UserPreferences = Database['public']['Tables']['user_preferences']['Row'];
type UserPreferencesInsert = Database['public']['Tables']['user_preferences']['Insert'];
type UserPreferencesUpdate = Database['public']['Tables']['user_preferences']['Update'];

export async function getUserPreferences(
  userId: string,
  client: SupabaseClient<Database>
): Promise<UserPreferences | null> {
  
  const { data, error } = await client
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user preferences:', error);
    return null;
  }

  return data;
}

export async function createUserPreferences(
  preferences: UserPreferencesInsert,
  client: SupabaseClient<Database>
): Promise<UserPreferences | null> {
  const { data, error } = await client
    .from('user_preferences')
    .insert(preferences)
    .select()
    .single();

  if (error) {
    console.error('Error creating user preferences:', error);
    return null;
  }

  return data;
}

export async function updateUserPreferences(
  userId: string,
  updates: UserPreferencesUpdate,
  client: SupabaseClient<Database>
): Promise<UserPreferences | null> {
  const { data, error } = await client
    .from('user_preferences')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating user preferences:', error);
    return null;
  }

  return data;
}

export async function upsertUserPreferences(
  preferences: UserPreferencesInsert,
  client: SupabaseClient<Database>
): Promise<UserPreferences | null> {
  const { data, error } = await client
    .from('user_preferences')
    .upsert(preferences, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    console.error('Error upserting user preferences:', error);
    return null;
  }

  return data;
} 