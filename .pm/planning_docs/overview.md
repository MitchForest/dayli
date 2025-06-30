# dayli - PRD Key Decisions Summary

## Core Concept
**dayli** - An AI-powered desktop app that acts as your personal executive assistant, managing tasks, emails, and schedule with radical focus.

## Spiky Point of View (POV)

### Our Non-Consensus Truth
> "Productivity apps are procrastination apps in disguise - they show you everything when you need to see almost nothing"

### What We Believe
- True productivity isn't about managing everything - it's about hiding everything except what matters TODAY
- The best executive assistant doesn't show you your task list; they show you your focus list
- 80% of what you track doesn't matter
- Organization IS the procrastination

### What We're NOT Building
- ❌ Task hierarchies, folders, or projects
- ❌ Priority levels (P1, P2, P3)
- ❌ Customizable workflows or views
- ❌ Productivity analytics/metrics
- ❌ Email folders or complex labeling
- ❌ "Someday/maybe" lists
- ❌ Manager mode (decided to go all-in on focus)

## Core Features

### 1. Time-Based Daily View
- Everything scheduled in time blocks
- 3-7 focus items maximum per day
- Visual timeline from 8am-6pm
- Integrated emails as time blocks

### 2. AI-Powered Scheduling
- Auto-blocks calendar for focus time
- Intelligently schedules email responses
- Places tasks in optimal time slots
- Protects lunch and break time

### 3. Email Triage
- Binary decisions: Now, Tomorrow, or Never
- Auto-archive/unsubscribe
- Important emails become time blocks
- No inbox view - only actions

### 4. Chat Assistant (AI SDK)
- Command-focused interface
- Natural language schedule control
- Examples: "Move this to 4pm", "Clear my morning"
- Streaming responses for responsiveness

### 5. Hidden History with RAG
- Yesterday's data is stored but invisible
- AI uses context for smarter scheduling
- User can ask about past decisions
- No browsing of historical data

## Technical Architecture

### Stack Decision
```
Frontend:       Tauri + Next.js
Styling:        Tailwind CSS
AI:             OpenAI API (GPT-4)
Chat:           AI SDK (Vercel)
Orchestration:  LangGraph.js 
Backend:        Next.js API Routes / Edge Functions
Database:       Supabase + pgvector
Auth:           Supabase (Google OAuth only)
Monorepo:       Turborepo
Language:       TypeScript everywhere!
```

### Architecture Flow
1. **Tauri Desktop App** → Beautiful native shell
2. **Next.js Frontend** → React UI with AI SDK hooks
3. **Next.js API Routes** → Backend logic
4. **LangGraph.js Workflows** → Complex AI orchestration
   - Email triage workflow
   - Schedule optimization workflow
   - RAG-enhanced decision making
5. **OpenAI API** → Via LangGraph nodes
6. **Supabase** → Auth, data storage, pgvector
7. **Google APIs** → Gmail and Calendar access

### Key Technical Decisions
- **LangGraph.js for orchestration** - Complex AI workflows in TypeScript
- **Pure TypeScript** - No Python needed!
- **Simpler deployment** - Just Node.js, no Python service
- **Streaming chat** - AI SDK for responsive assistant
- **Vector embeddings** - Store patterns in pgvector
- **Google Auth only** - Since we need Gmail/Calendar anyway

## UI/UX Decisions

### Two-Column Layout
```
[Time-Based Schedule] | [AI Assistant Chat]
- Left: Daily timeline with blocks
- Right: Chat for commands
- No navigation/sidebar
- No date picker (today only)
```

### Time Block Types
1. **Focus Blocks** - Deep work (2-4 hours)
2. **Quick Decisions** - Batched emails (15-30 min)
3. **Meetings** - From calendar
4. **Email Responses** - Thoughtful replies (30-60 min)

### Visual Design
- Minimal, distraction-free
- No badges or notifications
- Progress through completion, not metrics
- Empty space is intentional

## Data Philosophy

### What We Track
- Daily schedules and completions
- Email → task conversion patterns
- Focus time effectiveness
- User behavior for AI learning

### What We DON'T Show
- Historical task lists
- Productivity scores
- Email counts
- Yesterday's anything

## MVP Scope

### Must Have
- Google OAuth login
- Fetch Gmail + Calendar
- AI creates daily schedule
- Time block visualization
- Basic chat commands
- Focus time auto-blocking
- Email triage (archive/task/defer)

### Post-MVP
- Email draft generation
- Voice input
- Multi-calendar support
- Team features
- Mobile app

## LangGraph.js Integration

### Why LangGraph.js?
LangGraph.js orchestrates complex, multi-step AI workflows in TypeScript, keeping our entire stack unified:

### Core LangGraph.js Workflows

1. **Daily Planning Workflow**
   ```typescript
   const planningGraph = new StateGraph({
     channels: {
       emails: null,
       calendar: null,
       timeBlocks: null
     }
   })
   .addNode("fetchEmails", fetchEmailsNode)
   .addNode("triageEmails", triageEmailsNode)
   .addNode("checkCalendar", checkCalendarNode)
   .addNode("optimizeSchedule", optimizeScheduleNode)
   .addEdge("fetchEmails", "triageEmails")
   .addEdge("triageEmails", "checkCalendar")
   .addEdge("checkCalendar", "optimizeSchedule")
   ```

2. **Email Triage Workflow**
   - Classify urgency using OpenAI
   - Check sender patterns from pgvector
   - Route to appropriate time block
   - Archive or create task

3. **RAG-Enhanced Chat Workflow**
   - Embed user queries
   - Search historical context in pgvector
   - Generate contextual responses
   - Update daily schedule if needed

### LangGraph.js Benefits
- **TypeScript native** - Type safety throughout workflows
- **Same runtime** - Runs in Node.js with your Next.js app
- **Easier deployment** - No separate Python service
- **Better integration** - Direct access to Supabase client
- **Streaming support** - Works great with AI SDK

## Development Approach

### Turborepo Structure
```
apps/
  desktop/     (Tauri + Next.js)
  web/         (Future web version)
packages/
  ui/          (Shared components)
  types/       (TypeScript types)
```

### Phases
1. **Week 1**: Auth + basic UI + LangGraph.js setup
2. **Week 2**: Email triage workflow + Gmail integration  
3. **Week 3**: Schedule optimization workflow + AI SDK chat
4. **Week 4**: RAG integration + polish + testing

### Deployment (Much Simpler!)
- **Frontend**: Tauri desktop app
- **Backend**: Next.js with LangGraph.js (Vercel/Railway)
- **Database**: Supabase cloud
- **Development**: Pure TypeScript monorepo

## Key Differentiators

1. **Radical Focus** - Can't see more than today
2. **AI Authority** - System decides, user trusts
3. **No Procrastination** - Can't organize or browse
4. **Time-First** - Everything has a when, not just what
5. **Invisible Intelligence** - Gets smarter without showing complexity

## Success Metrics

### What Matters
- Time to daily planning: <30 seconds
- Focus time protected: 4+ hours/day
- Decisions eliminated: 80% of emails
- User trust: Minimal overrides

### What Doesn't
- Number of tasks completed
- Email zero achievement
- Feature usage analytics
- Time spent in app

## Open Questions Resolved

1. **Manager Mode?** → No, fully committed to focus-only
2. **Python backend?** → No, TypeScript everywhere
3. **Task limits?** → 3-7 items (flexible but constrained)
4. **History access?** → Stored but hidden, accessible via chat
5. **Other integrations?** → Google only for MVP
6. **AI model?** → OpenAI GPT-4

---

*This PRD embodies our spiky POV: Most productivity apps enable procrastination. dayli enforces focus by showing less, deciding more, and making today the only day that matters.*