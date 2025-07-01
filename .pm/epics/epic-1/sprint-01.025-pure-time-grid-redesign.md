# Sprint 01.025: Pure Time Grid UI Redesign with Infinite Canvas

## Sprint Overview

**Status**: IN PROGRESS  
**Start Date**: 2024-12-30  
**End Date**: [TBD]  
**Epic**: Epic 1 - App Shell & Beautiful UI

**Sprint Goal**: Complete UI redesign - implement an infinite canvas time grid with horizontal date navigation and beautiful, calming aesthetics.

**Philosophy**: "Productivity apps are procrastination apps in disguise." We're building the anti-productivity app - just a beautiful, infinite time canvas that shows your day.

## 🚨 Critical Design Decisions

### What We're Building
- **Infinite canvas**: Vertical scrolling through 24 hours, horizontal scrolling between days
- **Fixed date navigator**: `< June 30th >` header with smooth navigation
- **Pure time grid**: Hour blocks with 15-minute cells
- **User's work hours focus**: Click date to center on configured work hours
- **5 block types**: Deep Work, Meeting, Email, Blocked Time, Break
- **Beautiful aesthetics**: Calming colors, subtle shadows, smooth transitions
- **Settings page**: One-time setup for time preferences

### What We're REMOVING
- ❌ All stats and progress indicators
- ❌ Sidebars and floating elements (except date nav)
- ❌ Excessive animations (only smooth scrolling)
- ❌ Hover effects (except minimal interactions)
- ❌ Tooltips and help text
- ❌ Task counts and summaries
- ❌ The entire current DaySchedule component

## Enhanced Architecture with Infinite Canvas

### Canvas Foundation
```
apps/web/modules/schedule/canvas/
├── CanvasStore.ts              # Viewport and camera state
├── RenderLoop.ts               # 60fps performance optimization
├── utils/
│   ├── math-utils.ts           # Viewport calculations, bounds checking
│   ├── camera-utils.ts         # Coordinate transformations
│   └── date-utils.ts           # Date calculations and formatting
└── hooks/
    ├── useRenderLoop.ts        # React integration for canvas
    └── useCanvasGestures.ts    # Touch/mouse handling
```

### Component Structure
```
apps/web/modules/schedule/components/
├── InfiniteTimeGrid.tsx        # Main canvas container
├── DateNavigator.tsx           # Fixed header with date navigation
├── TimeGridDay.tsx             # Single day's 24-hour grid
├── GridHour.tsx                # Hour row with 15-minute cells
├── TimeLabel.tsx               # Elegant time labels
├── CurrentTimeIndicator.tsx    # Smooth moving time line
├── foundation/
│   └── Position.tsx            # Canvas positioning component
└── blocks/
    ├── DeepWorkBlock.tsx
    ├── MeetingBlock.tsx
    ├── EmailTriageBlock.tsx
    ├── BlockedTimeBlock.tsx
    └── BreakBlock.tsx
```

## Database Schema

```sql
-- Migration: Create user_preferences table
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Work Hours
  work_start_time TIME DEFAULT '08:00',
  work_end_time TIME DEFAULT '18:00',
  work_days TEXT[] DEFAULT ARRAY['monday','tuesday','wednesday','thursday','friday'],
  lunch_start_time TIME DEFAULT '12:00',
  lunch_duration_minutes INT DEFAULT 60,
  
  -- Deep Work Preferences
  target_deep_work_blocks INT DEFAULT 2,
  deep_work_duration_hours INT DEFAULT 2,
  deep_work_preference TEXT DEFAULT 'no_preference', -- 'morning', 'afternoon', 'no_preference'
  
  -- Email Triage Times
  morning_triage_time TIME DEFAULT '08:00',
  morning_triage_duration_minutes INT DEFAULT 30,
  evening_triage_time TIME DEFAULT '16:30',
  evening_triage_duration_minutes INT DEFAULT 30,
  
  -- Meeting Rules (stored as JSONB for flexibility)
  meeting_windows JSONB DEFAULT '[{"start": "10:00", "end": "12:00"}, {"start": "14:00", "end": "16:00"}]',
  focus_blocks JSONB DEFAULT '[{"day": "monday", "start": "09:00", "end": "11:00"}, {"day": "friday", "start": "14:00", "end": "17:00"}]',
  
  -- Calendar Auto-Blocking
  protect_deep_work BOOLEAN DEFAULT true,
  show_busy_during_triage BOOLEAN DEFAULT true,
  add_meeting_buffer BOOLEAN DEFAULT true,
  meeting_buffer_minutes INT DEFAULT 15,
  
  -- UI Preferences
  timezone TEXT DEFAULT 'America/New_York',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- RLS Policy
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Implementation Plan

### Phase 1: Database & Types ✓
**Status**: COMPLETED
- Created user_preferences table migration
- Added database types
- Created preferences queries
- Set up preferences store

### Phase 2: Canvas Foundation ✓
**Status**: COMPLETED
**Files created:**
- `apps/web/modules/schedule/canvas/CanvasStore.ts` - Viewport and camera state management with spring animations
- `apps/web/modules/schedule/canvas/RenderLoop.ts` - 60fps render loop for smooth performance
- `apps/web/modules/schedule/canvas/utils/math-utils.ts` - Viewport calculations and time conversions
- `apps/web/modules/schedule/canvas/utils/camera-utils.ts` - Coordinate transformations and spring physics
- `apps/web/modules/schedule/canvas/utils/date-utils.ts` - Date navigation and formatting utilities
- `apps/web/modules/schedule/canvas/hooks/useRenderLoop.ts` - React integration for render loop
- `apps/web/modules/schedule/canvas/hooks/useCanvasGestures.ts` - Smooth scroll and touch handling
- `apps/web/modules/schedule/constants/grid-constants.ts` - Beautiful design system constants
- `apps/web/modules/schedule/components/foundation/Position.tsx` - Canvas element positioning
- `apps/web/modules/schedule/components/DateNavigator.tsx` - Frosted glass date navigation
- `apps/web/app/focus-new/page.tsx` - Test page with canvas foundation

**Key accomplishments:**
- Implemented smooth spring physics for camera animations
- Created beautiful frosted glass date navigator
- Set up 60fps render loop with viewport culling
- Established calming color palette and typography
- Added horizontal/vertical scroll with day memory
- Integrated with user preferences store

### Phase 3: Build Infinite Time Grid ✓
**Status**: COMPLETED
**Files created:**
- `apps/web/modules/schedule/components/InfiniteTimeGrid.tsx` - Main canvas container
- `apps/web/modules/schedule/components/TimeGridDay.tsx` - Full 24-hour day grid
- `apps/web/modules/schedule/components/GridHour.tsx` - Hour blocks with 15-minute cells
- `apps/web/modules/schedule/components/TimeLabel.tsx` - Hour labels on the left
- `apps/web/modules/schedule/components/CurrentTimeIndicator.tsx` - Blue line showing current time

**Files modified:**
- `apps/web/app/focus-new/page.tsx` - Integrated TimeGrid component

**Key accomplishments:**
- Implemented all 24 hours with visible grid lines (6-12% opacity)
- Created smooth infinite canvas with separated controls (scroll for hours, drag for days)
- Added current time indicator with real-time updates
- Optimized performance with fast easing animations (250-300ms)
- Added smart Today button positioning based on current time
- Implemented momentum-based day navigation with snap behavior

### Phase 4: Settings Page
**Files to create:**
```
apps/web/modules/settings/
├── components/
│   ├── SettingsLayout.tsx
│   ├── sections/
│   │   ├── WorkHoursSection.tsx
│   │   ├── DeepWorkSection.tsx
│   │   ├── EmailSection.tsx
│   │   ├── MeetingRulesSection.tsx
│   │   └── AutoBlockingSection.tsx
│   └── controls/
│       ├── TimeSelect.tsx
│       ├── DurationSelect.tsx
│       └── DayCheckboxes.tsx
└── hooks/
    └── useUserPreferences.ts
```

**Modify:**
- `apps/web/app/settings/page.tsx` - Implement settings UI

### Phase 5: Migration & Polish
- Test with various screen sizes and preferences
- Optimize performance for smooth 60fps
- Replace `/focus` with new implementation
- Remove old components

## Canvas Technical Specifications

### Coordinate System
```typescript
interface CanvasState {
  viewport: {
    width: number;
    height: number;
  };
  camera: {
    x: number;      // Horizontal offset (days)
    y: number;      // Vertical offset (hours)
    scale: number;  // Zoom level (future enhancement)
  };
  currentDate: Date;
  scrollMemory: Map<string, number>; // Per-day scroll positions
}

// Constants
export const HOUR_HEIGHT = 80;        // 4 × 20px for 15-min cells
export const CELL_HEIGHT = 20;        // 15-minute cell
export const TIME_LABEL_WIDTH = 48;   // Compact time labels
export const DAY_WIDTH = 'viewport';  // Full viewport width per day
```

### Visual Design System

```typescript
// Beautiful, calming color palette
export const CANVAS_COLORS = {
  // Backgrounds
  canvasBackground: '#fafafa',     // Soft off-white
  gridBackground: '#ffffff',       // Pure white for grid
  
  // Grid lines - ultra subtle
  gridLine: 'rgba(0, 0, 0, 0.03)', // Almost invisible
  gridLineQuarter: 'rgba(0, 0, 0, 0.05)', // 15-min marks
  gridLineHour: 'rgba(0, 0, 0, 0.08)', // Hour divisions
  gridLineWorkHours: 'rgba(59, 130, 246, 0.08)', // Subtle work hours indicator
  
  // Time elements
  timeLabel: 'rgba(0, 0, 0, 0.4)', // Muted gray
  timeLabelHour: 'rgba(0, 0, 0, 0.6)', // Hour labels darker
  currentTime: '#3b82f6', // Soft blue accent
  currentTimeGlow: 'rgba(59, 130, 246, 0.1)', // Subtle glow
  
  // Navigation
  dateNavBackground: 'rgba(255, 255, 255, 0.8)', // Frosted glass effect
  dateNavBorder: 'rgba(0, 0, 0, 0.06)',
  dateNavText: 'rgba(0, 0, 0, 0.9)',
  dateNavArrow: 'rgba(0, 0, 0, 0.4)',
  
  // Shadows and effects
  blockShadow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
  hoverShadow: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.04)',
  glassEffect: 'rgba(255, 255, 255, 0.7)',
};

// Block visual styles with beautiful gradients
export const BLOCK_STYLES = {
  deepWork: {
    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    backgroundHover: 'linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    color: '#1e40af',
    icon: '🎯', // Focus icon
  },
  meeting: {
    background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
    backgroundHover: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
    border: '1px solid rgba(100, 116, 139, 0.2)',
    color: '#334155',
    icon: '👥', // People icon
  },
  email: {
    background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
    backgroundHover: 'linear-gradient(135deg, #a7f3d0 0%, #6ee7b7 100%)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    color: '#047857',
    icon: '📧', // Email icon
  },
  blocked: {
    background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0, 0, 0, 0.02) 10px, rgba(0, 0, 0, 0.02) 20px)',
    backgroundColor: '#f9fafb',
    border: '1px solid rgba(107, 114, 128, 0.2)',
    color: '#374151',
    icon: '🚫', // Blocked icon
  },
  break: {
    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    backgroundHover: 'linear-gradient(135deg, #fde68a 0%, #fcd34d 100%)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    color: '#92400e',
    icon: '☕', // Coffee icon
  },
};
```

### Performance Optimizations

1. **Immediate Mode Rendering**: Only render visible elements
2. **Viewport Culling**: Calculate bounds before rendering
3. **Scroll Throttling**: Limit updates to 60fps
4. **Day Virtualization**: Only render current ± 1 day
5. **Smooth Transitions**: CSS transforms for camera movement

### Navigation Behavior

```typescript
// Date Navigator interactions
interface DateNavigatorProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onTodayClick: () => void; // Centers on work hours
}

// Navigation methods in CanvasStore
class CanvasStore {
  // Smooth horizontal scroll to date
  navigateToDate(date: Date, animated = true) {
    const dayOffset = differenceInDays(date, this.startDate);
    this.animateCamera({ x: dayOffset * this.viewport.width });
  }
  
  // Center on work hours for current date
  centerOnWorkHours() {
    const workStart = this.preferences.work_start_time;
    const hourOffset = parseHour(workStart) * HOUR_HEIGHT;
    this.animateCamera({ y: hourOffset - this.viewport.height / 2 });
  }
  
  // Restore scroll position for a day
  restoreScrollPosition(date: Date) {
    const key = format(date, 'yyyy-MM-dd');
    const savedY = this.scrollMemory.get(key) || 0;
    this.camera.y = savedY;
  }
}
```

## Settings Page Specifications

### Layout
```typescript
<div className="max-w-2xl mx-auto p-8">
  <div className="mb-8">
    <h1 className="text-2xl font-semibold">Schedule Settings</h1>
    <p className="text-gray-600 mt-2">
      Set your preferences once. The AI handles the rest.
    </p>
  </div>
  
  <form onSubmit={handleSave} className="space-y-8">
    <WorkHoursSection />
    <DeepWorkSection />
    <EmailSection />
    <MeetingRulesSection />
    <AutoBlockingSection />
    
    <div className="pt-6 border-t">
      <button type="submit" className="btn-primary">
        Save Settings
      </button>
    </div>
  </form>
</div>
```

### Time Selection Components
```typescript
// Reusable time picker with beautiful styling
<TimeSelect
  label="Start Time"
  value={workStartTime}
  onChange={setWorkStartTime}
  step={15} // 15-minute increments
  className="beautiful-select"
/>

// Duration selector with visual feedback
<DurationSelect
  label="Duration"
  value={lunchDuration}
  onChange={setLunchDuration}
  options={[30, 45, 60, 90]} // minutes
  visual="blocks" // Shows as time blocks
/>
```

## Migration Strategy

1. **Keep existing code** until new grid is complete
2. **Build in parallel** under `/focus-new` route
3. **Test thoroughly** with different preferences and devices
4. **Swap routes** when ready
5. **Delete old code** after verification

## Testing Checklist

### Visual Tests
- [x] Grid aligns perfectly at all zoom levels
- [x] Smooth scrolling between hours and days
- [ ] Current time indicator updates smoothly
- [x] Date navigation is responsive
- [ ] Blocks render without overlap
- [x] Beautiful gradients and shadows render correctly
- [ ] Settings save and apply immediately

### Performance Tests
- [x] 60fps scrolling on modern devices
- [x] No jank when switching days
- [x] Memory usage stays constant
- [x] Render loop optimizations working

### Edge Cases
- [ ] Early birds (5 AM start time)
- [ ] Night owls (10 PM end time)
- [ ] Weekend workers
- [ ] Different timezones
- [ ] Very small screens
- [ ] Ultra-wide monitors

### Browser Testing
- [ ] Chrome
- [ ] Safari  
- [ ] Firefox
- [ ] Edge

## Success Criteria

1. **Beauty**: Calming, modern interface that's a joy to use
2. **Performance**: Smooth 60fps infinite scrolling
3. **Simplicity**: Understand entire day in 2 seconds
4. **Focus**: No distractions from the schedule
5. **Reliability**: Settings persist correctly
6. **Delight**: Subtle animations and transitions feel premium

## Rollback Plan

If issues arise:
1. Route `/focus` back to old component
2. Keep `/focus-new` for debugging
3. Fix issues without time pressure
4. Re-deploy when ready

---

**Sprint Status**: IN PROGRESS

## Key Decisions Log

### Why Infinite Canvas?
The infinite canvas provides spatial memory and fluid navigation. Users can see their entire day in context, scroll to any hour, and navigate between days naturally. This creates a more intuitive mental model than pagination.

### Why Fixed Date Navigator?
Having the date always visible provides context and quick navigation. The minimal `< June 30th >` design keeps focus on the content while allowing easy date changes.

### Why 24-Hour View Available?
While we focus on work hours by default, users should be able to scroll and see their entire day. This respects user autonomy while maintaining sensible defaults.

### Why Beautiful Aesthetics Matter?
A calming, beautiful interface reduces stress and makes planning feel less like a chore. Subtle gradients, smooth shadows, and thoughtful typography create an environment users want to return to.

### Canvas Foundation Design Decisions
- **Spring Physics**: Used for camera animations to create natural, organic movement
- **Frosted Glass Effect**: Date navigator uses backdrop blur for modern, elegant appearance
- **Ultra-Subtle Grid Lines**: Almost invisible lines reduce visual noise while maintaining structure
- **Scroll Memory**: Each day remembers its scroll position for better UX when navigating
- **Viewport Culling**: Only render visible elements for optimal performance

---

*Sprint Started: 2024-12-30*  
*Sprint Completed: [Date]*  
*Final Status: IN PROGRESS* 