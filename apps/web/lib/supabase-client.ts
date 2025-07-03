'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@repo/database/types';
import { isTauri } from './utils';

// Custom storage for Tauri (desktop app)
const customStorage = {
  getItem: (key: string) => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(key);
    }
    return null;
  },
  setItem: (key: string, value: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  },
  removeItem: (key: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
  },
};

// Create client factory function
function createSupabaseClient() {
  const isDesktop = typeof window !== 'undefined' ? isTauri() : false;
  
  const client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        storage: isDesktop ? customStorage : undefined,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      },
      global: {
        headers: {
          'X-Client-Info': isDesktop ? 'dayli-desktop' : 'dayli-web'
        }
      }
    }
  );

  console.log('[Supabase Client] Created new instance:', {
    isDesktop,
    storageType: isDesktop ? 'localStorage' : 'cookies',
    flowType: 'pkce'
  });

  return client;
}

// Singleton instance - created lazily
let clientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  // In React 19, we need to ensure the singleton is created safely
  if (!clientInstance) {
    clientInstance = createSupabaseClient();
  }
  return clientInstance;
}

// This should ONLY be used in client components that cannot use the useAuth hook
// For example: in non-React contexts or utility functions
// ALWAYS prefer useAuth() hook when possible
export const createSupabaseBrowserClient = () => {
  // Deprecated - use createClient() instead
  console.warn('createSupabaseBrowserClient is deprecated. Use createClient() instead.');
  return createClient();
};

// Function to reset the client (useful when auth is broken)
export function resetClient() {
  clientInstance = null;
  console.log('[Supabase Client] Client reset - will create new instance on next call');
}

// Debug function to check auth state
export async function debugAuthState() {
  const client = createClient();
  console.log('[Supabase Debug] Checking auth state...');
  
  try {
    const { data: { session }, error } = await client.auth.getSession();
    console.log('[Supabase Debug] Session:', {
      hasSession: !!session,
      userId: session?.user?.id,
      email: session?.user?.email,
      error: error
    });
    
    const { data: { user }, error: userError } = await client.auth.getUser();
    console.log('[Supabase Debug] User:', {
      hasUser: !!user,
      userId: user?.id,
      email: user?.email,
      error: userError
    });
    
    // Check storage based on platform
    if (isTauri()) {
      // Check default Supabase storage keys in localStorage
      const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-'));
      console.log('[Supabase Debug] Desktop auth storage:', {
        keys: keys,
        hasData: keys.length > 0
      });
    } else {
      // Check cookies for web
      console.log('[Supabase Debug] Web cookie storage:', {
        cookies: document.cookie.split(';').filter(c => c.includes('sb-')).map(c => c.trim().split('=')[0])
      });
    }
  } catch (e) {
    console.error('[Supabase Debug] Error:', e);
  }
}

// Add a global debug function for easy console access
if (typeof window !== 'undefined') {
  (window as Window & { debugAuth?: typeof debugAuthState }).debugAuth = debugAuthState;
} 