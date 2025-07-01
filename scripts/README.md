# Mock Data Scripts

This directory contains scripts for generating mock data to test the Dayli application.

## Prerequisites

1. Make sure you have logged into the app at least once with your email address
2. Ensure you have the required environment variables set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`

## Available Commands

### Generate Mock Data
```bash
bun run mock:setup --user-email=your@email.com
```

This will generate:
- 📧 Mock emails with realistic senders and content
- 📋 30-40 backlog tasks across various categories
- 📅 Calendar events for 7 days (-3 to +3 from today)
- ⏰ Intelligent time blocks including:
  - Morning and evening email triage
  - Deep work blocks
  - Meetings from calendar
  - Lunch breaks

### Clear and Regenerate Data
```bash
bun run mock:clear --user-email=your@email.com
```

This will:
1. Delete all existing mock data for the user
2. Generate fresh mock data

## What Gets Generated

### Emails
- Various categories: urgent, newsletters, notifications, etc.
- Realistic senders and subjects
- Full email bodies with base64 encoding

### Tasks
- Strategic tasks (OKRs, presentations, metrics)
- Development tasks (code reviews, bug fixes)
- Communication tasks (replies, 1:1s)
- Administrative tasks (expense reports, training)
- Research and planning tasks

### Calendar Events
- Daily standups (weekdays)
- Weekly team meetings
- Sprint planning sessions
- One-off meetings (client calls, reviews)
- All with proper attendees and descriptions

### Time Blocks
- Intelligent scheduling around existing meetings
- Morning email triage (8:00-8:30 AM)
- Deep work blocks (2-hour chunks)
- Lunch breaks (12:00-1:00 PM)
- Afternoon focus time
- Evening email review (4:30-5:00 PM)

## Notes

- The script requires the user to exist in the database (login at least once)
- Mock data is timezone-aware and uses the user's preference
- Data spans 7 days to show past and future schedules
- All generated IDs are unique to avoid conflicts 