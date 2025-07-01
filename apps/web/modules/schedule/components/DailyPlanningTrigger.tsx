'use client';

import { useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDailyPlanning } from '../hooks/useDailyPlanning';

export function DailyPlanningTrigger() {
  const { triggerDailyPlanning, isPlanning } = useDailyPlanning();

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        onClick={triggerDailyPlanning}
        disabled={isPlanning}
        size="lg"
        className="shadow-lg"
      >
        {isPlanning ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Planning your day...
          </>
        ) : (
          <>
            <Calendar className="mr-2 h-4 w-4" />
            Plan My Day
          </>
        )}
      </Button>
    </div>
  );
} 