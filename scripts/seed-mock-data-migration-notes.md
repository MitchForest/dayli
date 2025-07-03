# Seed Mock Data Script Migration Notes

## Changes Made (Sprint 4.1 - Day 4)

### Database Schema Changes
1. **Removed tables**:
   - `task_backlog` (now a view)
   - `email_backlog` (now a view)
   - `time_block_tasks` (data moved to tasks.assigned_to_block_id)

2. **Updated columns**:
   - `emails` table now has: status, urgency, importance, days_in_backlog
   - `tasks` table now has: status, urgency, tags, assigned_to_block_id

### Script Updates

#### Email Generation
- Added urgency, importance, status fields directly to email inserts
- Removed separate email_backlog inserts (data now in main table)

#### Task Generation  
- Added status field ('scheduled' or 'backlog')
- Added urgency field (decreasing by index)
- Added tags array field
- Added metadata.days_in_backlog for backlog items
- Removed separate task_backlog inserts (data now in main table)

#### Task Assignment to Time Blocks
- Changed from inserting into `time_block_tasks` junction table
- Now updates `tasks.assigned_to_block_id` directly
- Also sets `tasks.status = 'scheduled'` when assigning

#### Clear Data
- Removed deletion from task_backlog and email_backlog views
- Added update to clear task block assignments

## Testing
Run the script with:
```bash
bun run scripts/seed-mock-data.ts --user-email=your-email@example.com
```

To clear existing data first:
```bash
bun run scripts/seed-mock-data.ts --user-email=your-email@example.com --clear
```

## Summary
The script now works with the new consolidated database schema where backlog data is stored directly in the main tables rather than separate backlog tables.