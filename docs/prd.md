# dayli PRD - Product Requirements Document

## Executive Summary

**dayli** is an AI executive assistant that makes every decision about what you should work on, so you don't have to. It's a desktop application that shows you only what matters today through a radical simplification of productivity - no task lists, no priorities, no badges, just a clean schedule and a chat interface.

## Spiky Point of View

### Our Non-Consensus Truth
> "You don't have a productivity problem. You have a decision fatigue problem."

### What Everyone Believes
- More organization equals more productivity
- You need to see all your tasks to make good decisions
- Flexibility and customization help you work better
- Productivity apps help you get more done

### Why They're Wrong
- Every morning, you waste your best mental energy "planning your day" - which is really just anxiety-driven task shuffling
- You know exactly what important work needs doing, but it's buried under maybe-important, might-be-urgent noise
- Organization IS the procrastination
- Most productivity apps are procrastination apps in disguise

### What We're Building
- **We hide more than we show** - Yesterday's tasks? Gone. Next week? Doesn't exist.
- **AI has authority** - It decides, you execute (or override when needed)
- **Constraints drive productivity** - 3-7 tasks isn't a limitation, it's a feature
- **Natural language is the only interface** - If you need a button, we've failed
- **Learning without dashboards** - The AI gets smarter, you stay focused

### What We're NOT Building
- ❌ Task hierarchies, folders, or projects
- ❌ Priority levels (P1, P2, P3)
- ❌ Customizable workflows or views
- ❌ Productivity analytics/metrics
- ❌ Email folders or complex labeling
- ❌ "Someday/maybe" lists
- ❌ Week/month calendar views
- ❌ Manual task creation interfaces
- ❌ Settings pages or preferences panels
- ❌ Drag-and-drop interfaces

## System Architecture

### AI-First Architecture

The entire system is built around a sophisticated multi-layered AI architecture that combines intelligent orchestration, atomic tool composition, and adaptive multi-step workflows:

```
┌─────────────────────────────────────────────────────────────┐
│                        User Input                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Intelligent Orchestration Layer                 │
│  • GPT-4 Intent Classification                               │
│  • Context-Aware Routing (schedule, tasks, emails)          │
│  • Confidence Scoring & Reasoning                           │
│  • LRU Cache with 5-minute TTL                             │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┬─────────────────┐
        ▼                         ▼                 ▼
┌───────────────┐       ┌───────────────┐   ┌───────────────┐
│ Atomic Tools  │       │  Multi-Step   │   │    Direct     │
│  (33 Tools)   │       │  Workflows    │   │  Response     │
│               │       │  (3 Flows)    │   │               │
│ Single-purpose│       │ Tool composer │   │ Conversation  │
└───────────────┘       └───────────────┘   └───────────────┘
        │                         │                 │
        └─────────────┬───────────┴─────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                 Pure Data Response                           │
│  • Domain-specific data (blocks, tasks, emails)             │
│  • Success/error status                                      │
│  • No UI instructions                                        │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Client-Side Intelligence                        │
│  • ToolResultRenderer detects type                          │
│  • Loads appropriate display component                       │
│  • Interactive UI without AI formatting                      │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. Intelligent Orchestration Service
The cognitive center that routes requests based on complexity and intent:
- GPT-4 powered intent classification with structured output
- Context awareness: time of day, schedule density, task backlog, email pressure
- Intelligent caching for common queries
- Graceful fallback to keyword matching

#### 2. Atomic Tool System (33 Essential Operations)
Focused, single-purpose tools that return pure domain data:
- **Schedule Tools** (8): View, create, move, delete blocks + gap finding, batch creation, utilization analysis
- **Task Tools** (7): CRUD operations + intelligent scoring, time-based suggestions, block assignment
- **Email Tools** (9): View, read, process + backlog retrieval, AI categorization, batch operations, task conversion
- **Calendar Tools** (2): Schedule and reschedule meetings
- **Preference Tool** (1): Update user preferences
- **System Tools** (6): Confirmations, history, feedback, patterns, context management

#### 3. Multi-Step Workflow System (3 Complex Operations)
Sophisticated workflows that compose atomic tools with proposal-confirmation pattern:
- **Schedule Workflow**: Full day planning with analysis → proposal → confirmation → execution
- **Work Block Workflow**: Intelligent task assignment based on scoring and duration
- **Email Block Workflow**: Two-dimensional triage with batch processing

#### 4. RAG Context System
Three-layer learning for continuous personalization:
- Recent executions (last 7 days)
- Workflow patterns (common sequences)
- User preferences (learned behaviors)

#### 5. Pure Data Architecture
Complete separation of concerns:
- Tools return only domain data
- Client-side ToolResultRenderer handles all UI decisions
- Type-safe contracts between layers

## Technology Stack

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Desktop**: Tauri (10MB native app)
- **AI Architecture**: 
  - **Orchestration Layer**: GPT-4 intent classification with structured output
  - **Tool System**: 33 atomic tools via factory pattern + registry
  - **Workflows**: 3 multi-step operations with proposal-confirmation flow
  - **Vercel AI SDK**: Chat interface, streaming, tool execution
  - **RAG System**: pgvector for embeddings & continuous learning
- **LLM**: OpenAI GPT-4 Turbo
- **Database**: PostgreSQL with RLS (Supabase)
- **Auth**: Supabase Auth (Google OAuth)
- **APIs**: Gmail API, Google Calendar API
- **Monorepo**: Turborepo for coordinated development

## Core Features

### 1. Time-Based Daily View
Everything exists in time blocks, not lists:
```
┌─────────────────────────────────┬──────────────────────┐
│  📅 Today's Schedule            │  💬 AI Assistant     │
│                                 │                      │
│  9:00 ┌─────────────────┐      │  "Plan my day"       │
│       │ Deep Work Block │      │                      │
│       │ Payment Refactor│      │  "Done! I've         │
│       │ ✓ Task 1       │      │  scheduled 3 focus   │
│       │ ○ Task 2       │      │  blocks and batched  │
│       └─────────────────┘      │  your emails for     │
│                                 │  11am."              │
│ 11:00 ┌─────────────────┐      │                      │
│       │ Email Block     │      │                      │
│       │ 12 to process   │      │                      │
│       └─────────────────┘      │                      │
└─────────────────────────────────┴──────────────────────┘
```

### 2. AI-Powered Natural Language Control
Everything happens through chat:
- **"Plan my day"** → AI analyzes everything and creates optimal schedule
- **"Move my meeting to 3pm"** → Done, calendar updated
- **"Process my emails"** → Triaged by importance/urgency, scheduled
- **"What should I work on?"** → Context-aware suggestion based on time/energy

### 3. Two-Dimensional Email Triage
Emails analyzed on importance × urgency matrix:

|                | **Urgent** | **Can Wait** | **No Response** |
|----------------|------------|--------------|-----------------|
| **Important**  | Today block | Tomorrow | Archive |
| **Not Important** | Quick batch | Defer | Archive |

Result: 80% of emails handled without you seeing them.

### 4. Adaptive Scheduling
The AI adapts to your current state:
- **Empty schedule?** Full daily planning with optimal distribution
- **Partially filled?** Intelligent gap-filling  
- **Overbooked?** Smart optimization and task deferral
- **Always protected:** Lunch breaks at your preferred time

### 5. Multi-Layer Learning
Every decision is stored and learned from:
- **Pattern Layer**: Long-term behaviors
- **Recent Layer**: Last 7 days of decisions
- **Similar Layer**: Past situations with similar context

## Data Models

### Core Entities

```typescript
interface TimeBlock {
  id: string;
  type: 'work' | 'meeting' | 'email' | 'break' | 'blocked';
  title: string;
  startTime: Date;
  endTime: Date;
  description?: string;
  tasks?: Task[];
}

interface Task {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'completed' | 'backlog';
  estimatedMinutes?: number;
  source?: 'email' | 'chat' | 'calendar';
}

interface Email {
  id: string;
  subject: string;
  from: string;
  importance: 'important' | 'not_important';
  urgency: 'urgent' | 'can_wait' | 'no_response';
  hasActionItems: boolean;
}

interface UserPreference {
  workStartTime: string;
  workEndTime: string;
  lunchTime: string;
  minFocusBlock: number;
  emailBatchSize: number;
}
```

## User Experience Principles

### 1. Radical Simplicity
- Two panels: Schedule and AI chat
- No navigation, no menus, no settings
- Today is the only day that exists

### 2. AI Authority
- The AI makes decisions, users trust or override
- No manual task creation - tasks come from email/calendar/chat
- No priority setting - AI decides based on context

### 3. Time as Primary Dimension
- Everything has a "when", not just a "what"
- Tasks don't exist outside of time blocks
- Visual timeline from start to end of workday

### 4. Invisible Intelligence
- AI learns without showing learning
- No analytics dashboards
- No productivity scores
- Adaptation happens silently

## Implementation Status

### ✅ Completed (Sprint 4.3)
- **33 Atomic Tools**: All implemented with pure data pattern
  - 8 Schedule tools (including new analysis tools)
  - 7 Task tools (including scoring and suggestions)
  - 9 Email tools (including AI categorization and batch ops)
  - 2 Calendar tools
  - 1 Preference tool
  - 6 System tools
- **3 Multi-Step Workflows**: Refactored to compose atomic tools
  - Schedule workflow with 4-phase execution
  - Work block filling with intelligent task selection
  - Email triage with two-dimensional analysis
- **Pure Data Architecture**: Complete separation of logic and presentation
- **Tool Factory Pattern**: Consistent tool creation and error handling
- **Tool Registry**: Auto-discovery and registration by category
- **Orchestration Layer**: GPT-4 powered intent classification
- **Database Schema**: Consolidated with pgvector support
- **Service Factory**: Mock/real data switching for all services

### 🚧 In Progress (Sprint 4.4)
- **RAG Learning System**: Pattern recognition and personalization
- **ToolResultRenderer**: Enhanced client-side rendering
- **Display Components**: Rich interactive components for each tool type

### 📋 Upcoming
- **Gmail & Calendar Integration**: Real API connections
- **Voice Commands**: Natural language input
- **Mobile App**: iOS/Android versions
- **Team Features**: Shared schedules and collaboration

## Design Decisions

### Architecture Decisions
1. **Pure Data Returns**: Tools focus on business logic, UI handles presentation
2. **Tool Factory Pattern**: Consistent creation and error handling
3. **Client-Side Intelligence**: UI makes rendering decisions based on tool type
4. **Streaming Support**: Long operations show progress
5. **TypeScript Everywhere**: Type safety from database to UI

### UI/UX Decisions
1. **No Manual Controls**: Natural language only
2. **Time-Based View**: Everything scheduled, nothing floating
3. **Enforced Constraints**: 3-7 tasks max, today only
4. **Protected Focus**: Deep work blocks are sacred
5. **Hidden History**: Past data stored but invisible

### Data Philosophy
1. **Track Everything**: For AI learning
2. **Show Almost Nothing**: For user focus
3. **Learn Silently**: No visible analytics
4. **Adapt Continuously**: Every interaction improves the system

## Key Architectural Innovations

### 1. Proposal-Confirmation Pattern
Every workflow follows a sophisticated multi-phase execution model:
```typescript
// Phase 1: Analysis - Gather context using atomic tools
// Phase 2: Proposal - Generate optimal suggestions
// Phase 3: Confirmation - User reviews and can modify
// Phase 4: Execution - Apply approved changes atomically
```
This ensures user control while enabling powerful automation.

### 2. Intelligent Tool Composition
Multi-step workflows don't implement logic - they orchestrate:
- Workflows are composers, not implementers
- Each atomic tool is independently useful
- Failure isolation between tools
- Partial success handling

### 3. Context-Aware Routing
The orchestration layer considers multiple dimensions:
- **Temporal Context**: Morning vs afternoon behavior
- **State Context**: Empty schedule vs busy day
- **Pressure Context**: Task backlog and email urgency
- **Historical Context**: Past patterns and preferences

### 4. Pure Data Architecture
Complete separation between logic and presentation:
- Tools return only domain data
- No UI instructions in responses
- Client decides rendering based on metadata
- Type-safe contracts throughout

### 5. Adaptive Scoring Algorithms
Intelligent prioritization based on multiple factors:
```typescript
// Task Scoring
score = priority(60%) + age(40%) + contextBonus
// Email Scoring  
score = urgency + importance + senderRank + age
// Time Block Scoring
score = utilization + continuity + energyMatch
```

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

## Competitive Moat

1. **Philosophical Commitment**: We resist feature creep by design
2. **Architecture Constraints**: Built to prevent complexity
3. **User Selection**: Appeals to those exhausted by traditional tools
4. **Trust-Based UX**: Requires commitment to "less is more"
5. **AI-First Design**: Not a productivity app with AI added

## Future Vision

dayli will expand while maintaining its core philosophy:
- **Team Features**: Shared focus time, meeting optimization
- **Voice First**: Complete voice control
- **Predictive Planning**: AI suggests tomorrow based on patterns
- **Cross-Platform**: Native mobile apps
- **Offline Mode**: Local AI for privacy

But we will NEVER add:
- Project management
- Task hierarchies  
- Customizable workflows
- Productivity metrics
- Feature toggles
- Settings pages

---

*dayli exists because productivity apps cause procrastination. We show you exactly what to do today and when to do it. Nothing more, nothing less. Stop managing your work. Start doing it.*