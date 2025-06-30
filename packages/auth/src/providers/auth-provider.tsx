'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { getProfile } from '@repo/database/queries';
import type { AuthContextType } from '../types';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@repo/database/database.types';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() =>
    createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
  []);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        const currentProfile = await getProfile(session.user.id, supabase);
        if (currentProfile) {
          setProfile(currentProfile);
        }
      }
      setLoading(false);
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          const existingProfile = await getProfile(session.user.id, supabase);
          if (existingProfile) {
            setProfile(existingProfile);
          } else {
            const { data: newProfile, error } = await supabase
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
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'openid profile email',
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    loading,
    signInWithGoogle,
    signOut,
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