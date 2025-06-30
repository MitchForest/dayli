'use client';

import { useMockSchedule } from '@/modules/schedule/hooks/useMockSchedule';
import { useChatStore } from '@/stores';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DaySchedule } from '@/modules/schedule/components/DaySchedule';

export default function FocusPage() {
  useMockSchedule('typical_day');
  const { isCollapsed, toggleCollapsed } = useChatStore();

  return (
    <div className="flex h-full">
      {/* Schedule Column */}
      <div className={cn(
        "flex-1 transition-all duration-300",
        isCollapsed ? "pr-0" : "pr-80"
      )}>
        <div className="h-full overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-semibold mb-8">Today&apos;s Focus</h1>
            
            {/* Schedule View */}
            <DaySchedule />
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      <div className={cn(
        "fixed right-0 top-0 h-full bg-card border-l border-border transition-all duration-300",
        isCollapsed ? "w-0" : "w-80"
      )}>
        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "absolute -left-10 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-card border border-border",
            "hover:bg-accent hover:border-accent"
          )}
          onClick={toggleCollapsed}
        >
          {isCollapsed ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>

        {/* Chat Content */}
        {!isCollapsed && (
          <div className="h-full flex flex-col p-4">
            <h2 className="text-lg font-medium mb-4">AI Assistant</h2>
            <div className="flex-1 flex items-center justify-center text-center">
              <p className="text-sm text-muted-foreground">
                Chat interface will be implemented in Sprint 01.03
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 