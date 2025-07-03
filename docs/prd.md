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

The entire system is built around a sophisticated multi-layered AI architecture that makes intelligent decisions on behalf of the user:

```
┌─────────────────────────────────────────────────────────────┐
│                        User Input                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Orchestration Layer                         │
│  • Intent Classification (GPT-4)                             │
│  • RAG Context Injection                                     │
│  • Confidence Scoring                                        │
│  • Route Determination                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┬─────────────────┐
        ▼                         ▼                 ▼
┌───────────────┐       ┌───────────────┐   ┌───────────────┐
│  AI SDK Tools │       │   LangGraph   │   │    Direct     │
│   (Atomic)    │       │  (Workflows)  │   │  Response     │
│               │       │               │   │               │
│  25 Tools     │       │  4 Workflows  │   │ Conversation  │
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
│              Client-Side Rendering                           │
│  • ToolResultRenderer detects type                          │
│  • Loads appropriate display component                       │
│  • Interactive UI without AI formatting                      │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. Orchestration Service
The brain of the system that intelligently routes requests based on complexity and intent.

#### 2. Tool System (25 Essential Operations)
Atomic operations that return pure domain data:
- **Schedule Tools** (5): View, create, move, delete, fill time blocks
- **Task Tools** (4): View, create, update, complete tasks  
- **Email Tools** (3): View, read, process emails
- **Calendar Tools** (2): Schedule, reschedule meetings
- **Preference Tool** (1): Update user preferences
- **System Tools** (6): Confirmations, history, feedback, patterns
- **Workflow Tools** (4): Complex multi-step operations

#### 3. Workflow Engine (LangGraph)
Complex, multi-step operations with state management:
- **Email Triage**: Batch process emails with intelligent action extraction
- **Schedule Optimization**: Full day optimization with conflict resolution
- **Daily Planning**: Morning routine with task scheduling
- **Calendar Optimization**: Meeting conflict resolution

#### 4. RAG Context System
Three-layer context building for personalized responses:
- Recent tool executions (last 7 days)
- Workflow patterns
- User preferences

#### 5. Pure Data Architecture
Tools return only domain data without UI formatting instructions. The client-side ToolResultRenderer intelligently renders based on tool type.

## Technology Stack

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Desktop**: Tauri (10MB native app)
- **AI Architecture**: 
  - Orchestration Layer: GPT-4 intent classification & routing
  - Vercel AI SDK: Chat interface, streaming, tool execution
  - LangGraph: Complex stateful workflows
  - RAG System: pgvector for embeddings & learning
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

### ✅ Completed (100%)
- **25 Essential Tools**: All migrated to pure data pattern
- **Pure Data Architecture**: Tools return domain data without UI instructions
- **Tool Factory Pattern**: Consistent tool creation with metadata
- **Service Factory Pattern**: Mock/real data switching
- **Database Schema**: Consolidated tables with pgvector
- **AI Chat Interface**: Streaming responses with tool execution
- **Tool Registry**: Auto-discovery and registration with categories
- **Time Block UI**: Complete with all block types

### 🚧 In Progress
- **ToolResultRenderer**: Client-side component for intelligent rendering
- **Display Components**: Specialized components for each data type
- **MessageList Update**: Simplified tool result extraction
- **Legacy Code Removal**: Clean up old references

### 📋 Upcoming
- **Orchestration Layer**: Intent classification and routing
- **LangGraph Workflows**: Complex multi-step operations
- **RAG Learning System**: Continuous personalization
- **Gmail & Calendar Integration**: Real data connection
- **Voice Commands**: Natural language input
- **Mobile App**: iOS/Android versions

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