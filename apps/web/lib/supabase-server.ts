import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@repo/database/types';

/**
 * Creates a Supabase client for use in Server Components.
 * This client can read cookies but cannot write them.
 */
export async function createServerComponentClient() {
  const cookieStore = await cookies();
  
  return createSupabaseServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        set(name: string, value: string, options: CookieOptions) {
          // Server Components cannot write cookies
          // This is expected behavior - we handle cookie updates in middleware
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        remove(name: string, options: CookieOptions) {
          // Server Components cannot write cookies
          // This is expected behavior - we handle cookie updates in middleware
        },
      },
    }
  );
}

/**
 * Creates a Supabase client for use in Server Actions and Route Handlers.
 * This client can both read and write cookies.
 */
export async function createServerActionClient() {
  const cookieStore = await cookies();
  
  return createSupabaseServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (error) {
            // This can happen when called from a Server Component
            // Safe to ignore as the cookie was already set in middleware
            console.debug('[Supabase Server] Cookie set attempted in read-only context');
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (error) {
            // Safe to ignore
            console.debug('[Supabase Server] Cookie remove attempted in read-only context');
          }
        },
      },
    }
  );
}

/**
 * Creates a Supabase client for use in Middleware.
 * This client properly handles cookie updates on both request and response.
 */
export function createMiddlewareClient(request: NextRequest, response: NextResponse) {
  return createSupabaseServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Set cookie on both request and response
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          // Remove cookie from both request and response
          request.cookies.set({ name, value: '', ...options });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );
}

/**
 * Helper function to update session in middleware.
 * This is used to refresh auth tokens and ensure they're properly stored.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createMiddlewareClient(request, response);

  // This will refresh the session if needed and update cookies
  const { error } = await supabase.auth.getUser();

  if (error) {
    console.error('[Middleware] Error refreshing session:', error);
  }

  return response;
} 