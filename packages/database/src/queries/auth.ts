import type { Database, QueryResult } from '../index';
import type { User, SupabaseClient } from '@supabase/supabase-js';

/**
 * Sign out the current user
 */
export async function signOut(client: SupabaseClient<Database>): Promise<QueryResult<boolean>> {
  try {
    const { error } = await client.auth.signOut();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser(client: SupabaseClient<Database>): Promise<QueryResult<User>> {
  try {
    const { data: { user }, error } = await client.auth.getUser();

    if (error) {
      return { data: null, error: error.message };
    }

    if (!user) {
      return { data: null, error: 'No authenticated user' };
    }

    return { data: user, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Sign in with OAuth provider (Google or GitHub)
 */
export async function signInWithOAuth(provider: 'google' | 'github', client: SupabaseClient<Database>) {
  try {
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
} 