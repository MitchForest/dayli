# Comprehensive Authentication Fix Plan - Epic 3

## Executive Summary
The application is experiencing a critical PKCE authentication flow failure that prevents users from logging in successfully. This document provides a complete plan to fix the authentication system while maintaining the mock services that are essential for creating test data.

## Current Issues

### 1. Primary Issue: PKCE Flow Broken
- **Error**: `invalid request: both auth code and code verifier should be non-empty`
- **Cause**: Browser client stores PKCE verifier, but server callback can't access it
- **Impact**: Users must attempt login twice to authenticate

### 2. Secondary Issues
- Multiple Supabase client instances causing inconsistencies
- ServiceFactory not initialized with authenticated user context
- UserMenu shows default values when not authenticated
- Desktop and web authentication flows incompatible

## Solution Overview

The fix involves ensuring consistent cookie-based storage for PKCE flow across all Supabase clients while maintaining the existing mock service architecture for development.

## Implementation Status

### ✅ Phase 1: Fix PKCE Authentication Flow - COMPLETED

#### 1.1 Update Browser Client Configuration ✅
- Updated `apps/web/lib/supabase-client.ts` to:
  - Explicitly set `flowType: 'pkce'`
  - Maintain localStorage for desktop, cookies for web (auto-handled by SSR)
  - Added debug logging for initialization

#### 1.2 Create Unified Server Client Utilities ✅
- Created `apps/web/lib/supabase-server.ts` with:
  - `createServerComponentClient()` - for Server Components
  - `createServerActionClient()` - for Server Actions/Route Handlers
  - `createMiddlewareClient()` - for Middleware
  - `updateSession()` - helper for middleware session refresh

#### 1.3 Fix Auth Callback Route ✅
- Updated `apps/web/app/auth/callback/route.ts` to:
  - Use new server client utility
  - Improved error handling and logging
  - Better error messages for PKCE failures

#### 1.4 Update Auth Provider ✅
- Modified `packages/auth/src/providers/auth-provider.tsx` to:
  - Accept `onAuthStateChange` callback for ServiceFactory initialization
  - Removed direct ServiceFactory import (package boundary issue)
  - Added comprehensive logging

### ✅ Phase 2: Fix Service Integration - COMPLETED

#### 2.1 Initialize ServiceFactory Correctly ✅
- Updated `apps/web/components/providers.tsx` to:
  - Handle ServiceFactory initialization on auth state change
  - Configure with user context and mock services flag
  - Clear configuration on logout

#### 2.2 Fix AI Tools Context ✅
- Updated `apps/web/app/api/chat/route.ts` to:
  - Remove global `getCurrentUserId` hack
  - Use new server client utility
  - Configure ServiceFactory if not already configured
  - Better error handling and logging

#### 2.3 Update Schedule Tools ✅
- Modified `apps/web/modules/ai/tools/schedule-tools.ts` to:
  - Add `ensureServicesConfigured()` helper
  - Remove hardcoded user ID function
  - Proper error handling for unconfigured services

### ✅ Phase 3: Fix UI/UX Issues - COMPLETED

#### 3.1 Fix UserMenu Component ✅
- Updated `apps/web/components/user-menu.tsx` to:
  - Add loading skeleton during auth initialization
  - Don't render if no user/profile
  - Ensure userName is always defined
  - Better null safety

#### 3.2 Update Middleware ✅
- Modified `apps/web/middleware.ts` to:
  - Use new `updateSession` helper
  - Better route handling
  - Improved logging
  - Pass through auth callbacks without modification

### ✅ Phase 4: Additional Fixes - COMPLETED

#### 4.1 Update Workflow Routes ✅
- Updated `apps/web/app/api/workflows/daily-planning/route.ts`
- Updated `apps/web/app/api/workflows/email-triage/route.ts`
- Both now use new server client utilities

#### 4.2 ServiceFactory Enhancement ✅
- Modified `apps/web/services/factory/service.factory.ts` to:
  - Accept `null` in configure method for clearing
  - Added `isConfigured()` helper method
  - Better logging

## Remaining Tasks

### Phase 5: Testing & Verification

1. **Manual Testing Checklist**:
   - [ ] Clear all cookies/localStorage
   - [ ] Test Google OAuth login
   - [ ] Verify first-attempt success (no PKCE error)
   - [ ] Check session persistence
   - [ ] Test logout functionality
   - [ ] Verify ServiceFactory initialization
   - [ ] Test AI chat functionality
   - [ ] Verify schedule loads correctly

2. **Cross-Platform Testing**:
   - [ ] Test web authentication
   - [ ] Test desktop authentication (Tauri)
   - [ ] Verify session persistence on both platforms

3. **Edge Cases**:
   - [ ] Test expired session refresh
   - [ ] Test concurrent requests
   - [ ] Test network interruptions

## Key Changes Summary

1. **Supabase Client Architecture**:
   - Single browser client instance with PKCE enabled
   - Centralized server client utilities
   - Consistent cookie handling across all server contexts

2. **ServiceFactory Integration**:
   - Initialization handled in web app providers
   - Proper cleanup on logout
   - Safety checks before service usage

3. **Error Handling**:
   - Better error messages throughout
   - Comprehensive logging for debugging
   - Loading states in UI components

## Next Steps

1. Deploy to staging environment
2. Run through testing checklist
3. Monitor logs for any new auth issues
4. If all tests pass, deploy to production

## Success Metrics

- OAuth login works on first attempt (no PKCE errors)
- ServiceFactory properly initialized with user context
- No UI flashing or default values shown
- Both web and desktop platforms authenticate successfully
- Mock services remain functional for development

---

**Note**: All implementation phases have been completed. The system is ready for comprehensive testing before deployment. 