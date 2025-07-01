'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@repo/database/types';
import { isTauri } from './utils';

// Create a singleton instance
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (browserClient) return browserClient;

  // For Tauri desktop app, use localStorage-based auth
  if (isTauri()) {
    browserClient = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          storageKey: 'dayli-auth',
          storage: {
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
          },
        },
      }
    );
  } else {
    // For web app, use default cookie-based auth
    browserClient = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  return browserClient;
}

// This should ONLY be used in client components that cannot use the useAuth hook
// For example: in non-React contexts or utility functions
// ALWAYS prefer useAuth() hook when possible
export const createSupabaseBrowserClient = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}; 