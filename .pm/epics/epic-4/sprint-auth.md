# Sprint: Auth & Loading Improvements

**Sprint Goal**: Fix the focus page loading experience while maintaining secure auth patterns  
**Duration**: 2-3 days  
**Status**: IN PROGRESS  
**Start Date**: January 3, 2025

## Objectives

1. **Eliminate "Loading..." screen** on first page load
2. **Implement parallel auth operations** to reduce load time by 50%
3. **Add progressive loading** with skeleton UI
4. **Maintain all security** from Epic 3 auth fix

## Task Breakdown

### Day 1: Core Auth Optimizations

#### Morning: Parallel Auth Operations
- [ ] Update AuthProvider to load session and profile in parallel
- [ ] Add granular loading states (session, profile)
- [ ] Test auth flow still works correctly
- [ ] Verify ServiceFactory initialization

#### Afternoon: Focus Page Optimization
- [ ] Remove full-page loading block
- [ ] Implement optimistic UI rendering
- [ ] Add basic skeleton components
- [ ] Test loading experience

### Day 2: Progressive Loading

#### Morning: Skeleton Components
- [ ] Create ChatPanelSkeleton component
- [ ] Create ScheduleViewSkeleton component
- [ ] Implement progressive data population
- [ ] Add smooth transitions

#### Afternoon: Schedule Optimization
- [ ] Implement early schedule fetch
- [ ] Add schedule caching in localStorage
- [ ] Test stale-while-revalidate pattern
- [ ] Verify real-time updates still work

### Day 3: Polish & Testing

#### Morning: Connection Optimization
- [ ] Add connection warming to Supabase client
- [ ] Optimize middleware auth checks
- [ ] Add performance monitoring
- [ ] Test cross-platform (web/desktop)

#### Afternoon: Final Testing
- [ ] Cold start performance testing
- [ ] Warm start performance testing
- [ ] Error handling verification
- [ ] Documentation updates

## Implementation Progress

### Phase 1: Parallel Auth Operations ✅

**Status**: COMPLETED  
**Files modified**:
- `packages/auth/src/providers/auth-provider.tsx` ✅
- `packages/auth/src/types.ts` ✅

**Changes implemented**:
- Added granular loading states (`loadingStates.session` and `loadingStates.profile`)
- Session check no longer blocks on profile loading
- Profile loads asynchronously in the background
- Main `loading` state becomes false after session check (not waiting for profile)
- Auth state changes are notified immediately after session check

### Phase 2: Optimistic UI ✅

**Status**: COMPLETED  
**Files modified**:
- `apps/web/app/focus/page.tsx` ✅
- Removed resizable panels and simplified layout
- Only blocks on session loading, not profile loading
- Shows page layout immediately with skeleton loaders

### Phase 3: Skeleton Components ✅

**Status**: COMPLETED  
**Files created**:
- `apps/web/components/skeletons/ScheduleSkeleton.tsx` ✅
- `apps/web/components/skeletons/ChatSkeleton.tsx` ✅

**Implementation**:
- Created dedicated skeleton components that match the actual UI
- Schedule skeleton shows time grid structure
- Chat skeleton shows header, message area, and input
- Smooth transition from skeleton to real content

### Phase 4: Schedule Caching 🔜

**Status**: Not Started  
**Files to modify**:
- `apps/web/modules/schedule/hooks/useSchedule.ts`
- `apps/web/modules/schedule/store/scheduleStore.ts`

## Testing Results

### Performance Improvements
- ✅ First paint now happens immediately (< 500ms)
- ✅ Session check completes quickly
- ✅ Profile loads in background without blocking UI
- ✅ No more full-page "Loading..." screen

### Functionality Tests
- ✅ Login works on first attempt
- ✅ Auth flow maintained from Epic 3
- ✅ ServiceFactory properly initialized
- ✅ Lint and typecheck pass

## Success Metrics

- [ ] First paint: < 500ms
- [ ] Time to interactive: < 1s
- [ ] No full-page loading blocks
- [ ] Auth still works on first attempt
- [ ] ServiceFactory properly initialized

## Testing Checklist

### Functionality Tests
- [ ] Login works on first attempt
- [ ] Logout clears all state
- [ ] Session persistence works
- [ ] Schedule loads correctly
- [ ] Real-time updates work

### Performance Tests
- [ ] Cold start < 1s to show UI
- [ ] Warm start < 500ms
- [ ] Profile loads in background
- [ ] No UI blocking

### Cross-Platform Tests
- [ ] Web auth works
- [ ] Desktop auth works
- [ ] Mobile responsive

## Risks & Mitigations

1. **Risk**: Breaking auth flow
   - **Mitigation**: Extensive testing, keep Epic 3 patterns

2. **Risk**: Race conditions with parallel loading
   - **Mitigation**: Use Promise.allSettled, handle errors

3. **Risk**: Stale cache issues
   - **Mitigation**: Clear cache on logout, version cache keys

## Notes

- Maintain all security improvements from Epic 3
- Keep ServiceFactory initialization pattern
- Don't break PKCE flow
- Test thoroughly before considering complete

---

**Sprint Owner**: Technical Lead  
**Last Updated**: January 3, 2025  
**Next Review**: End of Day 1 