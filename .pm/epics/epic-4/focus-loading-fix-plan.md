# Focus Page Loading Fix Plan - Epic 4

## Executive Summary
The `/focus` page shows "Loading..." on first load after server restart due to sequential auth verification and profile fetching. This document provides a comprehensive plan to fix the loading experience while maintaining the authentication patterns established in Epic 3.

## Current Issues

### 1. Primary Issue: Sequential Loading Operations
- **Symptom**: Page shows "Loading..." for 1-2 seconds on cold start
- **Cause**: AuthProvider waits for session check, then fetches profile sequentially
- **Impact**: Poor user experience on first page load

### 2. Root Causes
- Auth loading blocks entire page render
- No optimistic UI or progressive loading
- Profile fetch happens even when not immediately needed
- Cold start initializes everything from scratch

### 3. Secondary Issues
- Schedule data fetch only starts after auth completes
- No skeleton loaders or partial content display
- Middleware adds additional auth checks on each request

## Solution Overview

Fix the loading experience by implementing parallel operations, optimistic UI, and progressive enhancement while maintaining the secure auth patterns from Epic 3.

## Implementation Plan

### Phase 1: Optimize AuthProvider Loading

#### 1.1 Implement Parallel Operations
Update `packages/auth/src/providers/auth-provider.tsx`:

```typescript
// Current (Sequential)
const session = await getSession();
if (session) {
  const profile = await getProfile();
}

// Proposed (Parallel)
const [sessionResult, profileResult] = await Promise.allSettled([
  supabase.auth.getSession(),
  session?.user ? getProfile(session.user.id, supabase) : Promise.resolve(null)
]);
```

#### 1.2 Add Granular Loading States
```typescript
interface AuthContextType {
  user: User | null;
  profile: Record<string, unknown> | null;
  loading: boolean; // Keep for backward compatibility
  loadingStates: {
    session: boolean;
    profile: boolean;
  };
  // ... rest of interface
}
```

#### 1.3 Implement Progressive Profile Loading
- Load session first, set user immediately
- Load profile in background without blocking
- Update UI progressively as data arrives

### Phase 2: Optimize Focus Page Loading

#### 2.1 Implement Optimistic UI
Update `apps/web/app/focus/page.tsx`:

```typescript
export default function FocusPage() {
  const { loading, user, loadingStates } = useAuth();
  
  // Show layout immediately with loading states in components
  // Don't block entire page on auth
  
  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <PanelGroup direction="horizontal" className="h-full">
        <Panel defaultSize={67} minSize={50} className="h-full">
          <SchedulePanel />
        </Panel>
        
        <PanelResizeHandle />
        
        <Panel defaultSize={33} minSize={1} maxSize={50} className="h-full">
          {/* Show chat skeleton while loading */}
          {loading.session ? (
            <ChatPanelSkeleton />
          ) : user ? (
            <ChatPanel />
          ) : (
            <div>Please log in</div>
          )}
        </Panel>
      </PanelGroup>
      
      <DailyPlanningTrigger />
    </div>
  );
}
```

#### 2.2 Add Loading Skeletons
Create loading skeleton components:
- `ChatPanelSkeleton` - Shows chat UI structure
- `SchedulePanelSkeleton` - Shows time grid structure
- Progressive data population as it loads

### Phase 3: Optimize SchedulePanel Loading

#### 3.1 Implement Early Schedule Fetch
Update `apps/web/modules/schedule/components/SchedulePanel.tsx`:

```typescript
export function SchedulePanel() {
  const { user, loadingStates } = useAuth();
  
  // Start fetching schedule data immediately
  // Don't wait for profile to load
  const { loading: scheduleLoading } = useSchedule({
    enabled: !!user, // Start as soon as we have user
    ignoreProfile: true // Don't wait for profile
  });
  
  return (
    <div className="relative h-full w-full bg-background">
      {scheduleLoading && !user ? (
        <ScheduleViewSkeleton />
      ) : (
        <ScheduleView />
      )}
      
      {/* These can load independently */}
      <DateNavigator />
      <UserMenu />
    </div>
  );
}
```

#### 3.2 Cache Schedule Data
- Implement schedule caching in localStorage
- Show cached data immediately on load
- Update with fresh data in background
- Use stale-while-revalidate pattern

### Phase 4: Optimize Supabase Client

#### 4.1 Implement Connection Pooling
Update `apps/web/lib/supabase-client.ts`:

```typescript
export function createClient() {
  if (browserClient) return browserClient;
  
  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        storage: isDesktop ? customStorage : undefined,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        // Add these optimizations
        storageKey: 'dayli-auth', // Consistent storage key
        autoRefreshBuffer: 30, // Refresh 30s before expiry
      },
      // Add connection pooling
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'X-Client-Info': isDesktop ? 'dayli-desktop' : 'dayli-web',
          'X-Client-Version': process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        },
      },
      // Optimize realtime
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
        timeout: 10000, // 10s timeout
      },
    }
  );
  
  // Warm up the connection immediately
  browserClient.auth.getSession().catch(() => {
    // Ignore errors, just warming up
  });
  
  return browserClient;
}
```

### Phase 5: Middleware Optimization

#### 5.1 Implement Selective Auth Checks
Update `apps/web/middleware.ts`:

```typescript
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Skip auth for static assets and public routes
  const skipAuthPaths = [
    '/_next',
    '/favicon.ico',
    '/public',
    '/api/health', // Add health check endpoint
  ];
  
  if (skipAuthPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }
  
  // Cache auth state in cookies for faster checks
  const response = await updateSession(request);
  
  // Add cache headers for authed routes
  if (pathname.startsWith('/focus')) {
    response.headers.set(
      'Cache-Control',
      'private, max-age=0, stale-while-revalidate=60'
    );
  }
  
  return response;
}
```

### Phase 6: Progressive Enhancement

#### 6.1 Implement Service Worker (Optional)
- Cache critical assets
- Offline support for schedule view
- Background sync for data updates

#### 6.2 Add Prefetching
- Prefetch user preferences on app load
- Prefetch today's schedule data
- Warm up API connections

## Implementation Priority

1. **High Priority** (Immediate impact):
   - Parallel auth operations (1.1)
   - Optimistic UI for focus page (2.1)
   - Early schedule fetch (3.1)

2. **Medium Priority** (Better UX):
   - Loading skeletons (2.2)
   - Schedule caching (3.2)
   - Granular loading states (1.2)

3. **Low Priority** (Nice to have):
   - Service worker (6.1)
   - Advanced prefetching (6.2)
   - Connection pooling optimizations (4.1)

## Success Metrics

- First load time: < 500ms to show UI structure
- Time to interactive: < 1s with cached data
- Cold start improvement: 50% reduction in loading time
- No "Loading..." full-page blocks
- Progressive content population

## Testing Plan

1. **Performance Testing**:
   - Measure cold start time
   - Measure warm start time
   - Test with slow network (3G)
   - Test with offline mode

2. **User Experience Testing**:
   - No jarring loading states
   - Smooth progressive loading
   - Proper error handling
   - Graceful degradation

3. **Cross-Platform Testing**:
   - Web performance
   - Desktop (Tauri) performance
   - Mobile responsiveness

## Migration Strategy

1. Implement changes incrementally
2. Use feature flags for rollout
3. A/B test loading improvements
4. Monitor error rates and performance

## Next Steps

1. Create loading skeleton components
2. Update AuthProvider with parallel operations
3. Implement optimistic UI in focus page
4. Add performance monitoring
5. Test and iterate

---

**Note**: This plan maintains all the security and architectural decisions from the Epic 3 auth fix while significantly improving the loading experience. 