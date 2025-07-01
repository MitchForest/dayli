'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getProfile } from '@repo/database/queries';
import type { AuthContextType } from '../types';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@repo/database/types';

// Create the Supabase client outside the component to ensure single instance
export const supabaseClient = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AuthContextValue extends AuthContextType {
  supabase: SupabaseClient<Database>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        setUser(session?.user ?? null);
        if (session?.user) {
          const currentProfile = await getProfile(session.user.id, supabaseClient);
          if (currentProfile) {
            setProfile(currentProfile);
          }
        }
      } catch (error) {
        console.error('Error fetching session:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          const existingProfile = await getProfile(session.user.id, supabaseClient);
          if (existingProfile) {
            setProfile(existingProfile);
          } else {
            const { data: newProfile, error } = await supabaseClient
              .from('profiles')
              .insert({
                id: session.user.id,
                email: session.user.email,
                full_name: session.user.user_metadata.full_name,
                avatar_url: session.user.user_metadata.avatar_url,
              })
              .select()
              .single();

            if (error) {
              console.error('Error creating profile:', error);
            } else {
              setProfile(newProfile);
            }
          }
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'openid profile email',
        },
      });
      if (error) {
        console.error('Error signing in with Google:', error);
      }
    } catch (error) {
      console.error('Error in signInWithGoogle:', error);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }
      // Clear local state
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Error in signOut:', error);
      throw error;
    }
  };

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    signInWithGoogle,
    signOut,
    supabase: supabaseClient,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 