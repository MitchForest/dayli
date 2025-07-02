# dayli PRD

### Spiky Point of View

**Our Non-Consensus Truth**: Productivity apps are procrastination apps in disguise - they show you everything when you need to see almost nothing.

**What Everyone Believes**: 
- More organization equals more productivity
- You need to track and manage everything
- Flexibility and customization help you work better
- Zero inbox and completed task lists equal success

**Why They're Wrong**: 
- Organizing tasks IS the procrastination
- 80% of what you track doesn't matter
- Customization is avoidance behavior
- Real productivity is doing the 2-3 things that actually move the needle

**What We're NOT Building**: 
- Task hierarchies, folders, or projects
- Priority levels (P1, P2, P3)
- Customizable workflows or views
- Productivity analytics/metrics
- Email folders or complex labeling
- Task search or filtering
- Week/month calendar views
- Manual task management interfaces

### Project Overview

**Vision**: An AI executive assistant that shows you only what matters today - your 3-7 must-do tasks scheduled in time blocks.

**Problem Statement**: Knowledge workers spend more time organizing work than doing work. They use "productivity" apps to avoid hard decisions about what actually matters. Every task management system becomes a graveyard of good intentions where important work hides among the noise.

**Success Criteria**: 
- Users spend <30 seconds planning their day
- 3-7 focused tasks identified daily
- 4+ hours of protected focus time
- 80% of emails processed without user seeing them

### User Stories

#### Story 1: Morning Planning
**As a** busy executive  
**I want to** see my 3-7 must-do tasks already scheduled in time blocks  
**So that** I can start working instead of planning

#### Story 2: Email to Tasks
**As a** someone drowning in email  
**I want to** have important emails automatically become scheduled tasks  
**So that** I handle what matters without managing an inbox

#### Story 3: Protected Focus Time
**As a** knowledge worker  
**I want to** have my calendar blocked for deep work  
**So that** I can focus on my most important tasks

#### Story 4: Quick Decisions
**As a** decision maker  
**I want to** handle quick yes/no emails in batches  
**So that** they don't interrupt my focus blocks

#### Story 5: AI Assistant Control
**As a** user who needs flexibility  
**I want to** use chat to adjust my schedule naturally  
**So that** I can adapt without complex UI interactions

### Architecture Pattern

**Selected Pattern**: Feature-Based Module Architecture

**POV-Driven Adaptations**:
- Modules organized around time-based workflows, not data types
- Each module shows only today's relevant information
- No modules for browsing or historical data
- Architecture enforces daily focus

**Core Principles**:
1. Today-only data in all modules
2. Time-based organization over task lists
3. AI makes decisions, UI displays them
4. Minimal user configuration
5. Chat as primary control interface

### Module Architecture

#### Identified Modules

| Module | Purpose | Why This Exists (POV) | What We're NOT Building |
|--------|---------|----------------------|-------------------------|
| `schedule` | Daily time-block view | Shows when to do tasks, not just what | Week/month views, drag-and-drop |
| `email` | Email triage | Converts emails to tasks or archives | Full email client, folders |
| `ai-assistant` | Chat interface | Natural control without complex UI | Settings panels, preferences |
| `workflows` | LangGraph.js orchestration | AI makes scheduling decisions | User-defined workflows |
| `auth` | Google OAuth | Access to Gmail/Calendar | Profile management |
| `shared` | Common components | Consistent, constrained UI | Customizable components |

#### Module Structure
```
modules/
  schedule/
    components/     # TimeBlock, DayView, TaskItem
    hooks/          # useSchedule, useTimeBlocks
    services/       # fetchToday, updateTimeBlock
    types/          # TimeBlock, DailySchedule
    
  email/
    components/     # EmailDecision, QuickActions
    services/       # fetchEmails, triageEmail
    types/          # EmailDecision
    
  workflows/
    graphs/         # emailTriageGraph, planningGraph
    nodes/          # analyzeEmail, optimizeSchedule
    
  ai-assistant/
    components/     # ChatInterface, MessageList
    hooks/          # useChat (AI SDK)
    
  auth/
    components/     # GoogleSignIn
    services/       # googleAuth, tokenManagement
```

### Technical Architecture

#### High-Level Architecture
```
┌─────────────────┐     ┌─────────────────┐
│  Tauri Desktop  │     │   Web Browser   │
│   (Next.js)     │     │   (Next.js)     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
           ┌─────────────────────────┐
           │       Vercel            │
           ├─────────────────────────┤
           │ • Next.js Web App      │
           │ • API Routes:          │
           │   - LangGraph.js       │
           │   - OpenAI embeddings  │
           │   - Chat endpoints     │
           └────────┬────────────────┘
                    │
                    ▼
           ┌─────────────────────────┐
           │      Supabase           │
           ├─────────────────────────┤
           │ • Google Auth           │
           │ • PostgreSQL Database   │
           │ • pgvector storage     │
           │ • Vector search        │
           └─────────────────────────┘
```

#### Technology Stack

- **Frontend**: Tauri + Next.js (desktop), Next.js (web)
- **Backend**: 
  - Vercel hosting for web app
  - Vercel Functions for API:
    - LangGraph.js workflows
    - OpenAI embedding generation
    - RAG implementation
- **Styling**: Tailwind CSS
- **AI**: OpenAI API (GPT-4 + embeddings)
- **Chat**: AI SDK (Vercel)
- **Orchestration**: LangGraph.js (in Vercel Functions)
- **Database**: Supabase (PostgreSQL + pgvector)
- **Vector Storage**: Supabase pgvector for RAG
- **Auth**: Supabase Auth (Google OAuth only)
- **Monorepo**: Turborepo
- **Language**: TypeScript

### Epic Breakdown

#### Epic 1: App Shell & Beautiful UI
**Duration**: 1 week  
**Goal**: Build the complete UI with mock data - make it look and feel amazing

**Deliverables**:
1. Turborepo setup with Tauri + Next.js
2. Complete schedule view with time blocks
3. Task display within time blocks (3-7 daily tasks)
4. Email decision cards UI
5. Chat interface (non-functional)
6. Beautiful transitions and polish
7. Mock data for all scenarios

**Key Focus**: Get the entire user experience perfect with fake data before adding complexity

#### Epic 2: Authentication & Basic Chat
**Duration**: 1 week  
**Goal**: Add Google auth and basic chat functionality
**Modules**: `auth`, `ai-assistant`

**Deliverables**:
- Supabase setup and configuration
- Google OAuth implementation
- Basic AI SDK chat integration
- Simple commands (no complex workflows yet)
- User session management

#### Epic 3: Gmail & Calendar Integration
**Duration**: 1 week  
**Goal**: Connect real email and calendar data
**Modules**: `email`, `calendar`

**Deliverables**:
- Gmail API integration
- Fetch and display real emails
- Email decision functionality (now/tomorrow/never)
- Basic email → task conversion
- Email archiving
- Google Calendar API integration
- Fetch existing calendar events
- Create focus time blocks
- Auto-decline meeting conflicts

#### Epic 4a: LangGraph.js Workflows
**Duration**: 1 week  
**Goal**: Add the AI orchestration layer
**Module**: `workflows`

**Deliverables**:
- LangGraph.js setup in Vercel Functions
- Email analysis workflow (importance, urgency, action)
- Daily planning workflow (optimize task placement)
- Schedule optimization (protect focus time)
- Integration with OpenAI for decision making
- Connect workflows to UI actions

#### Epic 4b: RAG & Intelligent Features
**Duration**: 1 week  
**Goal**: Add memory and context-aware features
**Modules**: `workflows`, `ai-assistant`

**Deliverables**:
- pgvector table setup in Supabase
- Embedding generation pipeline
- Historical pattern storage
- RAG-powered chat responses
- Context-aware scheduling based on past behavior
- Natural language schedule control
- Final integration and testing

### Data Models

```typescript
interface DailyTask {
  id: string
  title: string
  completed: boolean
  source?: 'email' | 'calendar' | 'ai'
  emailId?: string
}

interface TimeBlock {
  id: string
  startTime: Date
  endTime: Date
  type: 'focus' | 'meeting' | 'email' | 'quick-decisions' | 'break'
  title: string
  tasks: DailyTask[] // What to do in this block
}

interface DailySchedule {
  userId: string
  date: string // Always today in UI
  timeBlocks: TimeBlock[]
  dailyTasks: DailyTask[] // The 3-7 must-dos
  stats: {
    emailsProcessed: number
    tasksCompleted: number
    focusMinutes: number
  }
}

interface EmailDecision {
  emailId: string
  subject: string
  from: string
  decision: 'now' | 'tomorrow' | 'never'
  taskCreated?: boolean
}

// Stored for RAG but never shown directly
interface HistoricalPattern {
  userId: string
  date: string
  embedding: number[] // pgvector
  patterns: {
    completionRate: number
    focusBlockTimes: string[]
    emailResponseTimes: Record<string, number>
  }
}
```

### Features to Include (MVP)

#### Schedule Module
- Time-based daily view (8 AM - 6 PM)
- Display 3-7 daily tasks distributed across time blocks
- Each focus block contains 1-3 tasks maximum
- Show meetings from Google Calendar
- Visual indication of current time/block
- Mark tasks as complete

#### Email Module  
- Fetch emails from Gmail
- AI-powered triage (important/urgent/skip)
- Quick action buttons for decisions
- Convert emails to scheduled tasks
- Auto-archive handled emails

#### Workflows Module
- Email → Task conversion logic
- Daily planning optimization (max 7 tasks enforced)
- Focus time protection
- Smart task scheduling based on patterns
- Handle edge cases (PTO, weekends, too many urgent items)

#### AI Assistant Module
- Natural language commands:
  - "Move [task] to [time]"
  - "Mark [task] done"
  - "What's next?"
  - "Clear my morning"
  - "Show me what's hidden"
- Answer questions using RAG
- Streaming responses for better UX

#### Mock Data Structure (Epic 1)
```typescript
// Example daily schedule for UI development
{
  date: "2024-12-30",
  timeBlocks: [
    {
      id: "1",
      startTime: "9:00 AM",
      endTime: "11:00 AM", 
      type: "focus",
      title: "Deep Work Block",
      tasks: [
        { id: "t1", title: "Finalize Q4 strategy deck", completed: false },
        { id: "t2", title: "Review key metrics", completed: false }
      ]
    },
    {
      id: "2",
      startTime: "11:00 AM",
      endTime: "12:00 PM",
      type: "email",
      title: "Email Response Time",
      tasks: [
        { id: "t3", title: "Reply to Sarah about timeline", completed: false }
      ]
    },
    {
      id: "3", 
      startTime: "2:00 PM",
      endTime: "3:00 PM",
      type: "meeting",
      title: "Team Standup",
      tasks: [] // Meetings might not have tasks
    }
  ],
  dailyTasks: [
    // Same tasks as above, just listed out (3-7 total)
  ]
}
```

### Features to Exclude

- Project management or task hierarchies
- Manual task creation interface
- Calendar views beyond today
- Email folders or labels
- Search functionality
- Settings/preferences beyond auth
- Productivity metrics dashboards
- Task templates or recurring tasks
- Collaboration features
- Mobile app (desktop focus only)
- Offline mode (MVP is online-only)
- Timezone selection (uses system timezone)

### Edge Case Handling

| Scenario | Solution |
|----------|----------|
| More than 7 urgent tasks | AI picks top 7, rest go to tomorrow. Chat can swap items |
| All-day events (PTO) | Show as full-day block, no tasks scheduled |
| Weekends | Minimal schedule (1-2 personal tasks) or blank |
| No internet connection | Show cached data as read-only |
| Conflicting calendar events | Last-write-wins, refresh on focus |

### Deployment Strategy

**Vercel handles:**
- Next.js web app hosting
- API endpoints via Vercel Functions:
  - LangGraph.js workflow execution
  - OpenAI API calls (chat + embeddings)
  - RAG pipeline (generate embeddings → search → respond)
- Automatic deployments from git

**Supabase handles:**
- Google OAuth authentication
- PostgreSQL database
- pgvector for storing/searching embeddings
- Row-level security for user data

**Desktop App:**
- Distributed via direct download
- Connects to Vercel API endpoints
- Future: Mac App Store / Windows Store

**Development Flow:**
- Local: Next.js dev server + Supabase local
- Staging: Vercel preview deployments
- Production: Vercel production + Supabase cloud

### Success Metrics

**Metrics That Matter**:
- Daily planning time: <30 seconds
- Tasks identified: 3-7 per day
- Focus time achieved: 4+ hours
- Email decisions automated: 80%+

**Metrics We Don't Track**:
- Total tasks completed (quantity over quality)
- Time spent in app
- Feature usage analytics
- User "engagement"

### Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Users want more control | High | Provide chat for adjustments, not UI complexity |
| Missing important emails | High | Show decision summary, allow chat queries |
| Over-scheduling | Medium | Hard limit of 7 tasks, enforce breaks |
| API rate limits | Medium | Implement caching, batch operations |

### Competitive Moat

**Why This Can't Be Copied**:
1. **Philosophical commitment**: Competitors can't resist adding features
2. **Architecture constraints**: Built to prevent feature creep
3. **User selection**: Appeals to those exhausted by traditional tools
4. **Trust-based UX**: Requires commitment to "less is more"

---

*This PRD embodies our belief that productivity apps cause procrastination. dayli shows you exactly what to do today and when to do it. Nothing more, nothing less.*