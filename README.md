# dayli

**The AI executive assistant that shows you only what matters today.**

Most productivity apps are procrastination apps in disguise. They show you everything when you need to see almost nothing. dayli takes a radically different approach: AI-first, today-only, zero-button interface.

## The Problem We're Solving

Knowledge workers spend more time organizing work than doing work. They use "productivity" apps to avoid hard decisions about what actually matters. Every task management system becomes a graveyard of good intentions where important work hides among the noise.

**dayli fixes this by enforcing radical focus**: 3-7 tasks max per day, scheduled in time blocks, with everything else hidden.

## Core Features

### 🤖 AI-First Natural Language Control
No buttons. No menus. No settings pages. Just chat.
- "Plan my day" - AI analyzes your calendar, tasks, and patterns to create an optimal schedule
- "Move my strategy session to 3pm" - Done
- "I need 2 hours for deep work" - AI finds the time and protects it
- "What should I work on now?" - Context-aware suggestions based on time and energy

### 📅 Adaptive Scheduling with LangGraph
Our AI doesn't just move blocks around - it understands context:
- **Empty schedule?** Full daily planning with optimal task distribution
- **Partially filled?** Intelligent gap-filling without disrupting existing blocks  
- **Overbooked?** Smart optimization and deferrals
- **Always protected:** Lunch breaks and focus time are sacred

### 📧 Two-Dimensional Email Triage
Stop drowning in your inbox. Our AI analyzes emails by:
- **Importance**: Important / Not Important / Archive
- **Urgency**: Today / Can Wait / No Response Needed

The result? Important+Urgent emails get dedicated time blocks. Everything else waits or archives. 80% of emails handled without you seeing them.

### 🧠 RAG-Powered Learning System
dayli gets smarter every day:
- Learns when you actually take breaks vs. scheduled breaks
- Notices which emails need thoughtful responses vs. quick replies
- Adapts to your energy patterns throughout the day
- Remembers rejected suggestions to avoid repeating mistakes

No dashboards. No analytics. Just increasingly personalized assistance.

### 🎯 Enforced Constraints
- **3-7 tasks maximum** per day (not negotiable)
- **Today-only view** (yesterday is gone, tomorrow doesn't exist)
- **Time-blocked everything** (if it's not scheduled, it's not happening)
- **Protected focus time** (meetings auto-declined during deep work)

## Technical Architecture

### Stack
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Desktop**: Tauri (native performance, 10MB installers)
- **AI Orchestration**: LangGraph.js for complex multi-step workflows
- **Chat Interface**: Vercel AI SDK with streaming responses
- **LLM**: OpenAI GPT-4 Turbo for intelligence
- **Vector Database**: Supabase + pgvector for RAG
- **Database**: PostgreSQL with row-level security
- **Auth**: Supabase Auth (Google OAuth only)
- **Monorepo**: Turborepo for coordinated development

### Why These Choices?

**AI-First Architecture**: We use LangGraph.js to orchestrate complex workflows that would typically require multiple user interactions. When you say "plan my day," the AI:
1. Fetches your current schedule and unfinished tasks
2. Analyzes patterns from your RAG context
3. Determines optimal strategy (full planning vs. optimization)
4. Creates time blocks intelligently
5. Protects lunch and break times
6. Assigns tasks based on energy patterns
7. Validates no conflicts
8. Returns a natural language summary

All in under 3 seconds.

**Streaming Everything**: Using Vercel's AI SDK, users see real-time progress. No loading spinners - watch the AI think and act.

**Vector Embeddings for Memory**: Every decision, pattern, and preference is embedded and stored. The AI doesn't just remember what you did - it understands why and when to apply that knowledge.

**TypeScript Everywhere**: From database types to AI tool definitions, everything is type-safe. This isn't just about catching bugs - it's about modeling the domain correctly.

## Design Philosophy

### Radical Simplicity
- **One screen**: Your daily schedule
- **One interaction method**: Chat
- **One goal**: Do what matters today

### AI as Invisible Intelligence
The AI should feel like a brilliant assistant, not a chatbot:
- Never mentions tool names or technical details
- Explains actions in human terms
- Learns without showing learning
- Adapts without configuration

### Time as the Primary Dimension
Everything in dayli has a "when," not just a "what":
- Tasks exist within time blocks
- Emails become scheduled work
- Even breaks are protected time

### Trust Through Transparency
- AI explains its reasoning
- Changes preview before applying
- Undo is always available
- You can ask "why did you do that?"

## Who Is This For?

dayli is for knowledge workers who:
- Know the 80/20 principle but struggle to apply it
- Want to process emails and meetings efficiently to create time for deep work
- Are tired of productivity theater and want real focus
- Need things to not fall through the cracks
- Value their time and attention above all else

## Current Status

### ✅ Implemented
- Complete UI with time-based daily view
- Resizable AI chat interface  
- Mock data architecture for testing
- Core AI tools for schedule manipulation
- Multi-step AI operations with progress tracking
- Database schema with pgvector for embeddings

### 🚧 In Development
- Adaptive scheduling workflow (Sprint 03.02)
- Email triage with intelligent batching (Sprint 03.03)
- RAG system for pattern learning (Sprint 03.04)
- Gmail & Calendar API integration (Sprint 03.05)
- Visual change previews (Sprint 03.06)

## The dayli Difference

1. **We hide more than we show** - Yesterday's tasks? Gone. Next week? Doesn't exist.
2. **AI has authority** - It decides, you trust (or override when needed)
3. **Constraints drive productivity** - 3-7 tasks isn't a limitation, it's a feature
4. **Natural language is the only interface** - If you need a button, we've failed
5. **Learning without dashboards** - The AI gets smarter, you stay focused

## Getting Started

```bash
# Clone the repository
git clone https://github.com/yourusername/dayli.git

# Install dependencies
cd dayli
bun install

# Set up environment variables
cp .env.example .env.local
# Add your OpenAI API key and Supabase credentials

# Run database migrations
bun run db:migrate

# Start development
bun run dev
```

## Architecture Decisions Worth Noting

### Service Factory Pattern
We built a data-source agnostic architecture that allows seamless switching between mock and real data:

```typescript
const factory = ServiceFactory.getInstance();
factory.configure({ userId, supabaseClient }, useMockData);

// Same interface whether mock or real
const schedule = await scheduleService.getScheduleForDate(date);
```

### Tool-Based AI Architecture
Instead of hard-coded actions, everything is a tool the AI can use:

```typescript
const tools = {
  createTimeBlock,    // "Schedule a 2-hour focus block at 9am"
  moveTimeBlock,      // "Move my meeting to 3pm"
  deleteTimeBlock,    // "Cancel my afternoon email time"
  assignTaskToBlock,  // "Add budget review to morning focus"
  scheduleDay,        // "Plan my day" (triggers full workflow)
};
```

### Multi-Layer RAG Context
We don't just store data - we store understanding:

1. **Pattern Layer**: Long-term behaviors ("usually takes lunch at 11:30")
2. **Recent Layer**: Last 7 days of decisions  
3. **Similar Layer**: Past situations with similar context

This allows queries like "What should I work on?" to consider your current state, recent patterns, and similar past situations.

---

**dayli isn't another productivity app. It's an AI executive assistant that enforces focus by showing less, deciding more, and making today the only day that matters.**

Built with TypeScript, powered by AI, designed for focus.
