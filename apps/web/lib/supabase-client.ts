'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@repo/database/types';

// This should ONLY be used in client components that cannot use the useAuth hook
// For example: in non-React contexts or utility functions
// ALWAYS prefer useAuth() hook when possible
export const createSupabaseBrowserClient = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}; 