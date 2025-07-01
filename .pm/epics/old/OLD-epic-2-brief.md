# Epic 2: Authentication & Basic Chat Tracker

## Epic Overview

**Status**: NOT STARTED  
**Start Date**: [TBD]  
**Target End Date**: [TBD + 1 week]  
**Actual End Date**: [TBD]

**Epic Goal**: Implement Google authentication through Supabase and add basic AI-powered chat functionality using the AI SDK, establishing the foundation for user sessions and natural language interaction.

**User Stories Addressed**:
- Story 5: AI Assistant Control - Functional chat interface with basic commands (partial)
- Foundation for all stories - User authentication required for Gmail/Calendar access

**PRD Reference**: [Link to dayli PRD - Epic 2 section]

## Sprint Breakdown

| Sprint # | Sprint Name | Status | Start Date | End Date | Key Deliverable |
|----------|-------------|--------|------------|----------|-----------------|
| 02.00 | Supabase Setup & Auth | NOT STARTED | - | - | Google OAuth working |
| 02.01 | User Session Management | NOT STARTED | - | - | Protected routes & token storage |
| 02.02 | AI SDK Integration | NOT STARTED | - | - | Basic chat functionality |
| 02.03 | Chat Commands & Polish | NOT STARTED | - | - | Simple commands working |

**Statuses**: NOT STARTED | IN PROGRESS | IN REVIEW | APPROVED | BLOCKED

## Architecture & Design Decisions

### High-Level Architecture for This Epic
- Supabase handles all authentication (Google OAuth only)
- Session tokens stored securely for API access
- AI SDK integrated in Next.js API routes for chat
- Chat component connects to streaming API endpoint

### Key Design Decisions
1. **Auth Provider**: Supabase Auth with Google OAuth only
   - Alternatives considered: NextAuth, Clerk, Auth0
   - Rationale: Integrated with our database, handles tokens for Google APIs
   - Trade-offs: Vendor lock-in but significantly simpler

2. **Session Management**: Supabase session + HTTP-only cookies
   - Alternatives considered: JWT in localStorage, session tokens
   - Rationale: Secure by default, works with SSR
   - Trade-offs: Requires middleware but more secure

3. **AI Chat Approach**: Vercel AI SDK with streaming
   - Alternatives considered: Raw OpenAI API, LangChain
   - Rationale: Built for Next.js, handles streaming elegantly
   - Trade-offs: Another dependency but saves significant work

4. **Chat State**: Temporary in-memory (no persistence)
   - Alternatives considered: Store chat history in database
   - Rationale: Aligns with POV - no historical browsing
   - Trade-offs: Chat resets on refresh but that's intentional

### Dependencies
**External Dependencies**:
- @supabase/supabase-js: ^2.39.0
- @supabase/auth-helpers-nextjs: ^0.8.0
- ai: ^3.0.0 (Vercel AI SDK)
- openai: ^4.0.0

**Internal Dependencies**:
- Requires: UI components from Epic 1
- Provides: Auth context for Epic 3 (Gmail/Calendar access)

## Implementation Notes

### File Structure for Epic
```
apps/web/
├── app/
│   ├── auth/
│   │   ├── callback/          # OAuth callback handler
│   │   │   └── route.ts
│   │   └── signout/
│   │       └── route.ts
│   ├── api/
│   │   └── chat/              # AI chat endpoint
│   │       └── route.ts       # Streaming endpoint
│   ├── login/
│   │   └── page.tsx           # Login page with Google button
│   └── layout.tsx             # Add auth wrapper
├── components/
│   ├── auth/
│   │   ├── AuthButton.tsx     # Google sign-in button
│   │   └── AuthProvider.tsx   # Supabase auth context
│   └── chat/
│       ├── ChatInterface.tsx   # Updated from Epic 1
│       ├── ChatMessage.tsx     # Individual message
│       └── ChatInput.tsx       # Input with streaming
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # Browser client
│   │   ├── server.ts          # Server client
│   │   └── middleware.ts      # Auth middleware
│   └── ai/
│       └── chat.ts            # AI SDK setup
└── middleware.ts              # Protect routes
```

### API Endpoints Added
| Method | Path | Purpose | Sprint |
|--------|------|---------|--------|
| GET | /auth/callback | Handle Google OAuth callback | 02.00 |
| POST | /auth/signout | Sign out user | 02.00 |
| POST | /api/chat | Stream chat responses | 02.02 |

### Data Model Changes
```typescript
// No database schema changes - Supabase auth tables are automatic

// lib/types.ts additions
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}
```

### Key Functions/Components Created
- `AuthProvider` - Wraps app with Supabase auth context - Sprint 02.00
- `useAuth` - Hook for accessing auth state - Sprint 02.00
- `middleware` - Protects routes requiring auth - Sprint 02.01
- `createServerClient` - Supabase client for SSR - Sprint 02.01
- `ChatInterface` - Updated with real functionality - Sprint 02.02
- `streamChat` - AI SDK streaming helper - Sprint 02.02

## Sprint Execution Log

### Sprint 02.00: Supabase Setup & Auth
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

### Sprint 02.01: User Session Management
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

### Sprint 02.02: AI SDK Integration
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

### Sprint 02.03: Chat Commands & Polish
**Status**: NOT STARTED
**Summary**: [To be completed]
**Key Decisions**: [To be completed]
**Issues Encountered**: [To be completed]

## Testing & Quality

### Testing Approach
- Manual testing of auth flow in both web and desktop
- Test Google OAuth redirect handling
- Verify session persistence across refreshes
- Test chat streaming in different network conditions
- Ensure desktop app handles auth redirects properly

### Known Issues
| Issue | Severity | Sprint | Status | Resolution |
|-------|----------|--------|--------|------------|
| [TBD] | - | - | - | - |

## Refactoring Completed

### Code Improvements
- [To be tracked during development]

### Performance Optimizations
- [To be tracked during development]

## Learnings & Gotchas

### What Worked Well
- [To be documented]

### Challenges Faced
- [To be documented]

### Gotchas for Future Development
- **Desktop OAuth**: Tauri apps need special handling for OAuth redirects
- **Session Storage**: Be careful with cookies in desktop app
- [Additional gotchas to be documented]

## Build Testing & Verification

### Epic-End Build Process (MANDATORY)

Before marking Epic 2 as complete:

1. **Clean build test:**
   ```bash
   cd apps/web
   rm -rf .next node_modules/.cache
   bun install
   bun run build
   ```

2. **Environment check:**
   ```bash
   # Ensure all env vars are set
   # NEXT_PUBLIC_SUPABASE_URL
   # NEXT_PUBLIC_SUPABASE_ANON_KEY
   # OPENAI_API_KEY
   ```

3. **Run quality checks:**
   ```bash
   bun run lint      # MUST return 0 errors, 0 warnings
   bun run typecheck # MUST return 0 errors
   ```

4. **Test auth flow:**
   - Sign in with Google in web browser
   - Sign in with Google in desktop app
   - Verify session persists
   - Test sign out

5. **Test chat functionality:**
   - Send basic message
   - Verify streaming response
   - Test error handling

6. **Verification checklist:**
   - [ ] Google OAuth works in web browser
   - [ ] Google OAuth works in desktop app
   - [ ] Sessions persist across refreshes
   - [ ] Protected routes redirect to login
   - [ ] Chat accepts input and responds
   - [ ] Streaming responses work smoothly
   - [ ] Sign out clears session properly
   - [ ] No console errors
   - [ ] Environment variables documented

## Epic Completion Checklist

- [ ] All planned sprints completed and approved
- [ ] Google authentication fully functional
- [ ] Session management working properly
- [ ] Basic chat interface operational
- [ ] AI SDK properly integrated
- [ ] Auth works in both web and desktop
- [ ] No security vulnerabilities
- [ ] Documentation updated
- [ ] Epic summary added to project tracker

## Epic Summary for Project Tracker

**[To be completed at epic end]**

**Delivered Features**:
- [To be documented]

**Key Architectural Decisions**:
- [To be documented]

**Critical Learnings**:
- [To be documented]

**Technical Debt Created**:
- [To be documented]

---

*Epic Started: [Date]*  
*Epic Completed: [Date]*  
*Total Duration: [X days]*