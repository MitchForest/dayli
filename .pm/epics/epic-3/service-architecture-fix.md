# Service Architecture Fix: Single Source of Truth

## Problem Statement

The current architecture has a fundamental disconnect between what different parts of the system see:

1. **Mock Services** generate data on-the-fly in memory using `mockGenerator.ts`
2. **Seed Script** populates Supabase with different mock data
3. **The app uses Mock Services** by default (`useMock=true`)
4. **Real Services** exist but are never used
5. **Result**: UI, AI, and database all have different data

This causes:
- AI tools see different schedule than the user
- Database seed data is ignored
- Confusion about what data is "real"
- Architecture not ready for production

## Architecture Comparison

### Current (Broken) Architecture
- ServiceFactory configured with `useMock=true`
- Mock services generate data in-memory on each instantiation
- Real services exist but unused
- Database has seeded data that's never accessed
- No single source of truth

### Target Architecture
- ServiceFactory only uses Real services
- All data comes from Supabase (single source of truth)
- Mock data is just seeded data in the database
- Same architecture for dev and prod (only data differs)

## Implementation Plan

### Phase 1: Audit Mock vs Real Services

Before removing mock services, ensure real services have all required functionality:

#### 1.1 Compare Service Interfaces
- [ ] Review `ScheduleService` interface implementation
- [ ] Review `TaskService` interface implementation  
- [ ] Review `PreferenceService` interface implementation
- [ ] Document any methods missing in real services

#### 1.2 Mock Service Features to Preserve
- [ ] `ensureMockDataForDate()` logic - move to seed script
- [ ] `getScenarioForToday()` logic - move to seed script
- [ ] ID generation patterns (mock- prefix)
- [ ] Default data generation patterns

### Phase 1.5: Specific Functionality Gaps

#### Schedule Service Gaps
**Mock Service Has:**
- `ensureMockDataForDate()` - Generates data on-demand for any date
- `getScenarioForToday()` - Varies schedule by day of week
- In-memory Map storage with immediate updates
- Mock ID generation with `mock-` prefix

**Real Service Missing:**
- ✅ All core methods implemented
- ⚠️ No automatic data generation (this is correct - data should come from DB)

#### Task Service Gaps
**Mock Service Has:**
- `initializeMockData()` - Creates default tasks on startup
- Priority-based sorting in `getUnassignedTasks()`
- In-memory storage with immediate updates

**Real Service Has:**
- ✅ All methods implemented
- ⚠️ Different sorting (by created_at instead of priority) in `getUnassignedTasks()`
- ⚠️ Missing priority-based sorting logic

**Action Items:**
- [ ] Update real service to sort by priority first, then created_at
- [ ] Ensure seed script creates initial tasks

#### Preference Service Gaps
**Mock Service Has:**
- `createDefaultPreferences()` - Returns hardcoded defaults
- All preference update methods implemented

**Real Service Has:**
- ✅ All methods implemented
- ✅ `createDefaultPreferences()` creates defaults in DB when none exist
- ✅ Proper error handling for missing preferences
- ✅ Full feature parity with mock service

### Phase 1.6: Summary of Service Comparison

**Schedule Service**: ✅ Ready - Real service has all needed functionality
**Task Service**: ⚠️ Minor fix needed - Update sorting in `getUnassignedTasks()`
**Preference Service**: ✅ Ready - Real service has full functionality

The only code change needed is updating the task sorting logic. All other "missing" functionality from mock services (like data generation) should be moved to the seed script, not the services themselves.

### Phase 2: Update Real Services

#### 2.1 Schedule Service Enhancements
- [ ] Add better error handling for not found cases
- [ ] Ensure all date/time parsing matches mock service behavior
- [ ] Add logging for debugging
- [ ] Verify conflict detection logic matches mock

#### 2.2 Task Service Enhancements
- [ ] Implement any missing methods from mock service
- [ ] Ensure task assignment to blocks works properly
- [ ] Add proper filtering by user

#### 2.3 Preference Service Enhancements
- [ ] Implement any missing methods from mock service
- [ ] Ensure default preferences are created properly

### Phase 3: Remove Mock Dependencies

#### 3.1 Update ServiceFactory
```typescript
// Remove mock imports
// Remove useMockServices flag
// Remove mock service instantiation logic
// Always return real services
```

#### 3.2 Update Providers
```typescript
// Remove useMock parameter from configure()
// ServiceFactory.getInstance().configure({ userId, supabaseClient })
```

#### 3.3 Delete Mock Service Files
- [ ] Delete `services/mock/schedule.service.ts`
- [ ] Delete `services/mock/task.service.ts`
- [ ] Delete `services/mock/preference.service.ts`
- [ ] Delete `services/mock/gmail.service.ts`
- [ ] Delete `services/mock/calendar.service.ts`

### Phase 4: Enhance Seed Script

#### 4.1 Move Mock Generation Logic
- [ ] Move scenario selection logic from mock service
- [ ] Move date-based data generation
- [ ] Ensure comprehensive data for all scenarios

#### 4.2 Add Development Helpers
- [ ] Create `npm run seed:dev` script
- [ ] Add `--clean` flag to clear existing data
- [ ] Add `--scenario` flag to seed specific scenarios
- [ ] Add `--date-range` flag for custom date ranges

#### 4.3 Improve Seed Data Quality
- [ ] Ensure all time blocks have proper titles
- [ ] Add tasks to work blocks consistently
- [ ] Create realistic overlaps for testing
- [ ] Match the mockGenerator patterns

### Phase 5: Update AI Tools

#### 5.1 Remove Mock-Specific Logic
- [ ] Remove any mock-specific ID handling
- [ ] Ensure all tools work with database IDs
- [ ] Update error messages for clarity

#### 5.2 Add Better Debugging
- [ ] Log actual database queries
- [ ] Show what data AI sees vs user sees
- [ ] Add helpers to dump current state

### Phase 6: Testing & Validation

#### 6.1 Functionality Tests
- [ ] All CRUD operations work via UI
- [ ] AI tools can manipulate schedule correctly
- [ ] No data inconsistencies between views
- [ ] Conflict detection works properly

#### 6.2 Data Consistency Tests
- [ ] Seed script creates expected data
- [ ] All views show same schedule
- [ ] Time zones handled correctly
- [ ] No orphaned data

## Migration Steps

1. **Backup Current State**
   ```bash
   # Document current mock service behavior
   # Save any important test scenarios
   ```

2. **Implement Real Service Updates**
   ```bash
   # Add missing methods to real services
   # Test with existing seed data
   ```

3. **Switch to Real Services**
   ```bash
   # Update providers.tsx
   # Update service factory
   # Test everything still works
   ```

4. **Remove Mock Services**
   ```bash
   # Delete mock files
   # Clean up imports
   # Verify no references remain
   ```

5. **Enhance Seed Script**
   ```bash
   # Add new seed options
   # Test data generation
       # Document usage
    ```

## Critical Implementation Notes

### Data Consistency
- **IMPORTANT**: After switching to real services, the app will show whatever is in the database
- If the database is empty, the schedule will be empty
- Run the seed script immediately after switching to populate test data

### ID Format Changes
- Mock services use `mock-` prefix for IDs
- Database uses UUID format
- AI tools should not hardcode ID formats

### Real-time Updates
- Mock services had instant in-memory updates
- Real services require database round-trips
- Consider implementing optimistic updates in the UI if needed

### Development Workflow
1. Switch to real services
2. Run seed script to populate data
3. Use database tools to inspect/modify data
4. AI and UI will see the same data

## Benefits of New Architecture

1. **Single Source of Truth**: All data comes from Supabase
2. **Consistency**: UI, AI, and developers see same data
3. **Production Ready**: Same code path for dev and prod
4. **Easier Testing**: Seed specific scenarios as needed
5. **Better Debugging**: Can inspect actual database state
6. **Simpler Code**: No mock/real service switching logic

## Rollback Plan

If issues arise:
1. Git revert the service factory changes
2. Re-enable mock services temporarily
3. Fix issues in real services
4. Retry migration

## Success Criteria

- [ ] All existing functionality works
- [ ] AI and UI see identical schedules
- [ ] Seed script generates comprehensive test data
- [ ] No mock service code remains
- [ ] Development workflow is smooth
- [ ] Clear documentation for seeding data

## Timeline Estimate

- Phase 1-2: 2-3 hours (audit and updates)
- Phase 3-4: 2-3 hours (removal and seed enhancement)
- Phase 5-6: 1-2 hours (AI tools and testing)
- Total: 5-8 hours

## Next Steps

1. Start with Phase 1 audit to identify gaps
2. Update real services with missing functionality
3. Test thoroughly before removing mock services
4. Document new development workflow 