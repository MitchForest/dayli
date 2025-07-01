'use client';

import { DateNavigator } from './DateNavigator';
import { UserMenu } from '@/components/user-menu';
import { ScheduleView } from './ScheduleView';

export function SchedulePanel() {
  return (
    <div className="relative h-full w-full bg-background">
      {/* Schedule Content - fills entire panel */}
      <ScheduleView />
      
      {/* Date Navigator - overlaid on top */}
      <div className="absolute top-4 left-0 right-0 z-30 pointer-events-none">
        <div className="flex justify-center">
          <div className="pointer-events-auto">
            <DateNavigator />
          </div>
        </div>
      </div>
      
      {/* User Menu - positioned within the schedule panel */}
      <div className="absolute bottom-6 left-6 z-20">
        <UserMenu />
      </div>
    </div>
  );
} 