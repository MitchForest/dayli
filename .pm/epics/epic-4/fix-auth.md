# Epic 4: Complete Authentication System Fix for React 19 + Next.js 15

## Executive Summary

The authentication system is failing due to fundamental incompatibilities with React 19's stricter hydration rules and Next.js 15's new async architecture. This document outlines a complete architectural overhaul to fix authentication while incorporating PKCE flow lessons from Epic 3.

## Root Cause Analysis

### 1. React 19 Breaking Changes
- **Hydration Mismatch**: Client components attempting to fetch auth state during initial render
- **useEffect Timing**: Effects run differently in React 19's concurrent mode
- **Client Boundaries**: All imports in 'use client' files become part of client bundle

### 2. Next.js 15 Breaking Changes
- **Async Params**: All route params and searchParams are now Promises
- **Cookie Handling**: Requires proper async handling with `await cookies()`
- **Middleware Changes**: Response handling requires special cookie forwarding

### 3. Current Architecture Flaws
- AuthProvider tries to fetch session in client component (causes hydration mismatch)
- No server-side auth state initialization
- Middleware not properly refreshing sessions
- Mixed client/server Supabase instances without proper separation

## Solution Architecture

### Core Principle: Server Components Handle Initial State, Client Components Handle Changes

```
┌─────────────────────┐
│   Root Layout       │ (Server Component)
│ - Fetch user state  │
│ - Pass to providers │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│     Providers       │ (Client Component)
│ - Accept initial    │
│ - Listen to changes │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│    AuthProvider     │ (Client Component)
│ - NO session fetch  │
│ - Only listeners    │
└─────────────────────┘
```

## Implementation Plan

### Phase 1: Server-Side Supabase Client Setup

#### 1.1 Create Server Component Client
**File**: `apps/web/lib/supabase/server.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@repo/database/types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Component - readonly cookies
          }
        },
      },
    }
  )
}
```

#### 1.2 Create Route Handler Client
**File**: `apps/web/lib/supabase/route-handler.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@repo/database/types'

export async function createRouteHandlerClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}
```

### Phase 2: Update Middleware for Proper Session Handling

#### 2.1 Middleware with PKCE Support
**File**: `apps/web/middleware.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // CRITICAL: Refresh session to ensure PKCE flow works
  const { data: { user }, error } = await supabase.auth.getUser()

  // Protected routes
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/focus') ||
                          request.nextUrl.pathname.startsWith('/settings')
  
  if (isProtectedRoute && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Phase 3: Update Root Layout (Server Component)

#### 3.1 Fetch Initial Auth State
**File**: `apps/web/app/layout.tsx`

```typescript
import { createClient } from '@/lib/supabase/server'
import { Providers } from '@/components/providers'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Fetch user on server
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers initialUser={user}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
```

### Phase 4: Simplify Client Components

#### 4.1 Update Providers Component
**File**: `apps/web/components/providers.tsx`

```typescript
"use client";

import { useMemo, useCallback } from "react";
import { AuthProvider } from "@repo/auth/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { createClient } from "@/lib/supabase-client";
import { ServiceFactory } from "@/services/factory/service.factory";
import type { User } from "@supabase/supabase-js";

interface ProvidersProps {
  children: React.ReactNode;
  initialUser: User | null;
}

export function Providers({ children, initialUser }: ProvidersProps) {
  // Create client once
  const supabaseClient = useMemo(() => createClient(), []);
  
  // Handle auth state changes
  const handleAuthStateChange = useCallback((user: User | null) => {
    const factory = ServiceFactory.getInstance();
    
    if (user && supabaseClient) {
      factory.configure({
        userId: user.id,
        supabaseClient: supabaseClient
      });
    } else {
      factory.configure(null); // Clear on logout
    }
  }, [supabaseClient]);
  
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider 
        supabaseClient={supabaseClient}
        initialUser={initialUser}
        onAuthStateChange={handleAuthStateChange}
      >
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
```

#### 4.2 Simplified AuthProvider
**File**: `packages/auth/src/providers/auth-provider.tsx`

```typescript
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getProfile } from '@repo/database/queries';
import type { AuthContextType } from '../types';
import type { Database } from '@repo/database/types';

interface AuthProviderProps {
  children: React.ReactNode;
  supabaseClient: SupabaseClient<Database>;
  initialUser: User | null;
  onAuthStateChange?: (user: User | null) => void;
}

export function AuthProvider({ 
  children, 
  supabaseClient, 
  initialUser,
  onAuthStateChange 
}: AuthProviderProps) {
  // Initialize with server-provided user
  const [user, setUser] = useState<User | null>(initialUser);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false); // Not loading initially!

  // Load profile for user
  const loadProfile = useCallback(async (userId: string) => {
    try {
      const userProfile = await getProfile(userId, supabaseClient);
      setProfile(userProfile);
    } catch (error) {
      console.error('[AuthProvider] Error loading profile:', error);
    }
  }, [supabaseClient]);

  // Load initial profile if user exists
  useEffect(() => {
    if (initialUser) {
      loadProfile(initialUser.id);
    }
  }, [initialUser, loadProfile]);

  // Listen for auth changes only
  useEffect(() => {
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthProvider] Auth state changed:', event);
        
        const newUser = session?.user ?? null;
        setUser(newUser);
        
        if (newUser) {
          await loadProfile(newUser.id);
        } else {
          setProfile(null);
        }
        
        onAuthStateChange?.(newUser);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabaseClient, onAuthStateChange, loadProfile]);

  // ... rest of provider implementation
}
```

### Phase 5: Update Auth Callback Route

#### 5.1 Handle PKCE Flow Properly
**File**: `apps/web/app/auth/callback/route.ts`

```typescript
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createRouteHandlerClient()
    
    try {
      // Exchange code for session - PKCE verifier handled by cookies
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('[Auth Callback] Error exchanging code:', error)
        return NextResponse.redirect(`${origin}/login?error=${error.message}`)
      }
    } catch (error) {
      console.error('[Auth Callback] Unexpected error:', error)
      return NextResponse.redirect(`${origin}/login?error=Authentication failed`)
    }
  }

  // Redirect to focus page after successful auth
  return NextResponse.redirect(`${origin}/focus`)
}
```

### Phase 6: Update Client-Side Supabase Client

#### 6.1 Browser Client with PKCE
**File**: `apps/web/lib/supabase-client.ts`

```typescript
'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@repo/database/types';

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (browserClient) return browserClient;

  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    }
  );

  return browserClient;
}
```

## PKCE Flow Considerations

### Key Lessons from Epic 3:
1. **PKCE Verifier Storage**: Must be accessible by both browser client and server callback
2. **Cookie-based Storage**: Essential for PKCE flow to work across client/server boundary
3. **Session Refresh**: Middleware MUST refresh session for auth to persist
4. **Error Handling**: Clear error messages for PKCE failures

### PKCE Flow Diagram:
```
1. Browser: Generate code_verifier → Store in cookie
2. Browser: Redirect to OAuth with code_challenge
3. OAuth: User authorizes → Redirect with code
4. Server: Read code_verifier from cookie
5. Server: Exchange code + verifier for session
6. Server: Set session cookies → Redirect
```

## Migration Steps

### Step 1: Create New Directory Structure
```
apps/web/lib/
├── supabase/
│   ├── server.ts         # Server component client
│   ├── route-handler.ts  # Route handler client
│   └── middleware.ts     # Middleware client
└── supabase-client.ts    # Browser client (existing)
```

### Step 2: Update All Server Components
- Replace direct Supabase usage with server client
- Fetch user state and pass to client components

### Step 3: Update All Route Handlers
- Use async params pattern
- Use route handler client
- Handle PKCE properly in auth callback

### Step 4: Update Client Components
- Remove all session fetching
- Accept initial state from props
- Only handle auth state changes

### Step 5: Test PKCE Flow
1. Clear all cookies/storage
2. Initiate OAuth login
3. Verify first-attempt success
4. Check session persistence

## Success Criteria

1. **No Hydration Errors**: Console clean of hydration warnings
2. **First-Login Success**: PKCE flow works on first attempt
3. **Session Persistence**: Auth state survives page refreshes
4. **ServiceFactory Integration**: Properly initialized with user context
5. **Performance**: No loading spinner on authenticated routes

## Common Pitfalls to Avoid

1. **Don't fetch auth in client components** - Causes hydration mismatches
2. **Don't use synchronous cookie access** - Use `await cookies()` in Next.js 15
3. **Don't skip middleware session refresh** - Critical for PKCE flow
4. **Don't mix server/client Supabase instances** - Keep them separate
5. **Don't forget to handle async params** - All route params are Promises now

## Monitoring & Debugging

### Key Log Points:
1. Middleware: User detection and session refresh
2. Auth Callback: Code exchange success/failure
3. AuthProvider: State change events only
4. ServiceFactory: Configuration changes

### Debug Commands:
```javascript
// In browser console
window.debugAuth() // Check current auth state
```

## Rollback Plan

If issues arise:
1. Revert to previous auth system
2. Disable PKCE temporarily (`flowType: 'implicit'`)
3. Add compatibility layer for gradual migration

---

**Status**: Ready for implementation
**Estimated Time**: 4-6 hours
**Risk Level**: High (core auth system)
**Testing Required**: Comprehensive 