'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
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
  onAuthStateChange?: (user: User | null) => void;
}

export function AuthProvider({ children, supabaseClient, onAuthStateChange }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStates, setLoadingStates] = useState({
    session: true,
    profile: false,
  });

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('[AuthProvider] Initializing auth...');
        
        // Start loading session
        setLoadingStates({ session: true, profile: false });
        
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (sessionError) {
          console.error('[AuthProvider] Session error:', sessionError);
        }
        
        console.log('[AuthProvider] Session check:', {
          hasSession: !!session,
          userId: session?.user?.id,
          email: session?.user?.email
        });
        
        // Set user immediately after session check
        setUser(session?.user ?? null);
        setLoadingStates(prev => ({ ...prev, session: false }));
        
        // Notify parent component about auth state immediately
        onAuthStateChange?.(session?.user ?? null);
        
        // If we have a user, fetch profile in parallel (non-blocking)
        if (session?.user) {
          setLoadingStates(prev => ({ ...prev, profile: true }));
          
          // Fetch profile asynchronously without blocking
          getProfile(session.user.id, supabaseClient)
            .then((currentProfile) => {
              if (currentProfile) {
                console.log('[AuthProvider] Profile loaded:', currentProfile.id);
                setProfile(currentProfile);
              } else {
                console.log('[AuthProvider] No profile found for user');
              }
            })
            .catch((error) => {
              console.error('[AuthProvider] Error loading profile:', error);
            })
            .finally(() => {
              setLoadingStates(prev => ({ ...prev, profile: false }));
            });
        }
        
        // Set main loading to false after session is checked (not waiting for profile)
        setLoading(false);
        
      } catch (error) {
        console.error('[AuthProvider] Error initializing auth:', error);
        setLoading(false);
        setLoadingStates({ session: false, profile: false });
      }
    };

    initializeAuth();

    // Set up auth state change listener
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthProvider] Auth state changed:', event, {
          hasSession: !!session,
          userId: session?.user?.id
        });
        
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Start profile loading
          setLoadingStates(prev => ({ ...prev, profile: true }));
          
          // Handle profile asynchronously
          try {
            const existingProfile = await getProfile(session.user.id, supabaseClient);
            if (existingProfile) {
              setProfile(existingProfile);
            } else {
              // Create profile if it doesn't exist
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
                console.error('[AuthProvider] Error creating profile:', error);
              } else {
                setProfile(newProfile);
              }
            }
          } catch (error) {
            console.error('[AuthProvider] Error handling profile:', error);
          } finally {
            setLoadingStates(prev => ({ ...prev, profile: false }));
          }
        } else {
          setProfile(null);
          setLoadingStates({ session: false, profile: false });
        }
        
        // Notify parent component about auth state change
        onAuthStateChange?.(session?.user ?? null);
        
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabaseClient, onAuthStateChange]);

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
      setLoadingStates({ session: false, profile: false });
      
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
    loadingStates,
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