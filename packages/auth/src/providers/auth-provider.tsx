'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getProfile } from '@repo/database/queries';
import type { AuthContextType } from '../types';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@repo/database/types';

interface AuthContextValue extends AuthContextType {
  supabase: SupabaseClient<Database>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
  supabaseClient: SupabaseClient<Database>;
  initialUser?: User | null;
  onAuthStateChange?: (user: User | null) => void;
}

export function AuthProvider({ 
  children, 
  supabaseClient, 
  initialUser = null,
  onAuthStateChange 
}: AuthProviderProps) {
  // Initialize with server-provided user - NO CLIENT FETCHING
  const [user, setUser] = useState<User | null>(initialUser);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const loading = false; // Always false - we have initialUser from server

  // Handle profile loading
  const loadProfile = useCallback(async (userId: string) => {
    try {
      const userProfile = await getProfile(userId, supabaseClient);
      setProfile(userProfile);
      return userProfile;
    } catch (error) {
      console.error('[AuthProvider] Error loading profile:', error);
      return null;
    }
  }, [supabaseClient]);

  // Load initial profile if user exists
  useEffect(() => {
    if (initialUser) {
      console.log('[AuthProvider] Loading profile for initial user:', initialUser.id);
      loadProfile(initialUser.id);
    }
  }, [initialUser, loadProfile]);

  // ONLY listen for auth state changes - NO INITIAL FETCH
  useEffect(() => {
    console.log('[AuthProvider] Setting up auth state listener');
    
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthProvider] Auth state changed:', event);

      const newUser = session?.user ?? null;
      setUser(newUser);

      if (newUser) {
        await loadProfile(newUser.id);
      } else {
        setProfile(null);
      }

      onAuthStateChange?.(newUser);
    });

    return () => {
      console.log('[AuthProvider] Cleaning up auth state listener');
      subscription.unsubscribe();
    };
  }, [supabaseClient, onAuthStateChange, loadProfile]);

  const signInWithGoogle = async () => {
    try {
      console.log('[AuthProvider] Initiating Google OAuth sign in');
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'openid profile email',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      
      if (error) {
        console.error('[AuthProvider] Error signing in with Google:', error);
        throw error;
      }
      
      console.log('[AuthProvider] OAuth sign in initiated successfully');
    } catch (error) {
      console.error('[AuthProvider] Error in signInWithGoogle:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      console.log('[AuthProvider] Signing out user');
      const { error } = await supabaseClient.auth.signOut();
      if (error) {
        console.error('[AuthProvider] Error signing out:', error);
        throw error;
      }
      
      // Clear local state
      setUser(null);
      setProfile(null);
      
      console.log('[AuthProvider] User signed out successfully');
    } catch (error) {
      console.error('[AuthProvider] Error in signOut:', error);
      throw error;
    }
  };

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    loadingStates: {
      session: loading,
      profile: false
    },
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