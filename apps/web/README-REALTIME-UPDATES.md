# Real-Time Schedule Updates

## Overview

The schedule now updates automatically when the AI makes changes. No more manual refreshing needed!

## How It Works

### 1. **AI Tool Detection**
When the AI executes schedule-related tools (createTimeBlock, moveTimeBlock, etc.), the chat panel detects this and triggers a schedule refresh.

### 2. **Cache Invalidation**
The schedule store has a new `invalidateSchedule` method that:
- Removes cached data for specific dates
- Triggers a `refreshTrigger` that causes the schedule to refetch

### 3. **Real-Time Subscriptions**
Using Supabase's real-time features to listen for database changes:
- `time_blocks` table changes
- `tasks` table changes
- Automatically refreshes when changes are detected

## Setup Required

### Enable Real-Time in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to Database > Replication
3. Enable replication for these tables:
   - `time_blocks`
   - `tasks`
   - `daily_schedules` (optional)

### Implementation Details

#### Schedule Store Changes
```typescript
// New methods in scheduleStore
invalidateSchedule(date?: string) // Clear cache for date
refreshTrigger // Increments to force refetch
```

#### Chat Panel Integration
```typescript
// Detects tool executions and refreshes
onFinish: (message) => {
  if (message.toolInvocations?.some(/* schedule tools */)) {
    invalidateSchedule(today);
  }
}
```

#### Real-Time Hook
```typescript
// Subscribes to database changes
useScheduleSubscription()
// Listens to time_blocks and tasks changes
// Auto-refreshes on any change
```

## User Experience

1. User asks AI to move a meeting
2. AI executes the `moveTimeBlock` tool
3. Chat panel detects the tool execution
4. Schedule cache is invalidated
5. Schedule automatically refetches
6. UI updates instantly without refresh

Additionally, if changes are made directly in the database or from another session, real-time subscriptions ensure the UI stays in sync.

## Troubleshooting

If real-time updates aren't working:

1. Check browser console for subscription errors
2. Verify real-time is enabled in Supabase dashboard
3. Check that RLS policies allow SELECT on the tables
4. Ensure the user is authenticated

## Future Improvements

- Add optimistic updates for instant feedback
- Show loading states during updates
- Add animations for schedule changes
- Implement conflict resolution for concurrent edits 