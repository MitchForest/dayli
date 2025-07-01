'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface MeetingBlockProps {
  title: string;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  attendees?: string[];
  className?: string;
  style?: React.CSSProperties;
}

export function MeetingBlock({ 
  title, 
  startTime, 
  endTime, 
  duration,
  attendees,
  className,
  style
}: MeetingBlockProps) {
  // Calculate height based on duration (4px per minute = 60px per 15min block)
  const height = (duration / 15) * 20;
  
  return (
    <div
      className={cn(
        "absolute left-0 right-0 rounded-md border border-gray-500/20",
        "bg-gradient-to-br from-gray-100 to-gray-200",
        "hover:from-gray-200 hover:to-gray-300",
        "transition-all duration-200 cursor-pointer",
        "shadow-sm hover:shadow-md",
        "overflow-hidden",
        className
      )}
      style={{ height: `${height}px`, ...style }}
    >
      <div className="p-2 h-full flex flex-col">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
          <span className="text-base">👥</span>
          <span>{startTime} - {endTime}</span>
        </div>
        <div className="text-sm font-semibold text-gray-800 mt-0.5 truncate">
          {title}
        </div>
        {attendees && attendees.length > 0 && (
          <div className="text-xs text-gray-600 mt-1 truncate">
            {attendees.length > 2 
              ? `${attendees.slice(0, 2).join(', ')} +${attendees.length - 2}`
              : attendees.join(', ')
            }
          </div>
        )}
      </div>
    </div>
  );
} 