import React from 'react';
import { cn } from '@/lib/utils';
import { useCurrentTime } from '../hooks/useCurrentTime';

interface CurrentTimeIndicatorProps {
  className?: string;
}

export function CurrentTimeIndicator({ className }: CurrentTimeIndicatorProps) {
  const { gridRow, isWithinWorkHours } = useCurrentTime();
  
  if (!isWithinWorkHours) {
    return null;
  }
  
  return (
    <div
      className={cn(
        "absolute left-0 right-0 pointer-events-none z-10",
        className
      )}
      style={{
        gridRow: gridRow,
        gridColumn: '1 / -1',
      }}
    >
      <div className="relative h-full">
        <div className="absolute left-[-4px] top-0 w-2 h-2 bg-destructive rounded-full -translate-y-1/2" style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
        <div className="absolute left-2 right-0 h-[1px] bg-destructive/80 -translate-y-1/2" />
      </div>
    </div>
  );
} 