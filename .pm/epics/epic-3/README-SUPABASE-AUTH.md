# Supabase Client Architecture Guide

## Overview

This guide explains the proper way to use Supabase clients in our Next.js App Router application to avoid multiple client instances and auth issues.

## Key Principles

1. **Client-Side**: Use ONE shared browser client via React Context
2. **Server-Side**: Create fresh server clients per request
3. **Never create clients directly in components**

## Client-Side Usage

### ✅ Correct: Use the useAuth Hook

```tsx
'use client';

import { useAuth } from '@repo/auth/hooks';

export function MyComponent() {
  const { supabase, user } = useAuth();
  
  // Use supabase client for queries
  const { data } = await supabase
    .from('table')
    .select('*');
}
```

### ❌ Wrong: Creating Your Own Client

```tsx
// DON'T DO THIS!
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key); // Creates duplicate instance!
```

## Server-Side Usage

### ✅ Correct: API Routes

```tsx
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  
  // Create server client for this request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.delete({ name, ...options });
        },
      },
    }
  );
  
  // Pass to services/workflows
  const service = new MyService(supabase);
}
```

### ✅ Correct: Server Functions

```tsx
// Accept supabase client as parameter
export function createWorkflow(supabase: SupabaseClient<Database>) {
  // Use the passed client
  const { data } = await supabase.from('table').select('*');
}
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Client-Side (Browser)                 │
├─────────────────────────────────────────────────────────┤
│  Root Layout                                            │
│    └── AuthProvider                                     │
│          └── Single Supabase Browser Client            │
│                └── Shared via React Context             │
│                      └── useAuth() hook                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    Server-Side (Node.js)                 │
├─────────────────────────────────────────────────────────┤
│  API Route / Server Component                           │
│    └── Create Server Client (per request)              │
│          └── Pass to Services/Workflows                │
│                └── Never store globally                 │
└─────────────────────────────────────────────────────────┘
```

## Common Patterns

### 1. Service Factory Pattern

```tsx
// In API route
const supabase = createServerClient(...);
const factory = ServiceFactory.getInstance();
factory.configure({ userId: user.id, supabaseClient: supabase });
```

### 2. Workflow Pattern

```tsx
// In API route
const supabase = createServerClient(...);
const workflow = createMyWorkflow(supabase);
const result = await workflow.invoke(state);
```

### 3. Hook Pattern (Client-Side)

```tsx
// In custom hooks
export function useMyData() {
  const { supabase } = useAuth();
  
  return useQuery({
    queryKey: ['myData'],
    queryFn: () => supabase.from('table').select('*'),
  });
}
```

## Troubleshooting

### Multiple GoTrueClient Instances Warning

**Cause**: Creating multiple Supabase clients in the browser
**Solution**: Use `useAuth()` hook instead of creating new clients

### Authentication Errors in API Routes

**Cause**: Not creating server client properly
**Solution**: Use `createServerClient` with proper cookie handling

### Stale Auth State

**Cause**: Using browser client in server context
**Solution**: Always use server clients for server-side operations

## Migration Checklist

When updating code:

- [ ] Replace all `createClient` with `useAuth()` in client components
- [ ] Update API routes to use `createServerClient`
- [ ] Pass supabase client to services/workflows as parameter
- [ ] Remove any global supabase client instances
- [ ] Test auth flow works correctly

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=your-openai-key
```

Note: The OpenAI key should be `OPENAI_API_KEY` (not `OPEN_AI_KEY`) 