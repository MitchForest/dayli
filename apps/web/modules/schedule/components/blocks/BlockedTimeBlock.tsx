'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface BlockedTimeBlockProps {
  title: string;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  reason?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function BlockedTimeBlock({ 
  title, 
  startTime, 
  endTime, 
  duration,
  reason,
  className,
  style
}: BlockedTimeBlockProps) {
  // Calculate height based on duration (4px per minute = 60px per 15min block)
  const height = (duration / 15) * 20;
  
  return (
    <div
      className={cn(
        "absolute left-0 right-0 rounded-md border border-gray-400/20",
        "bg-gray-50",
        "transition-all duration-200 cursor-pointer",
        "shadow-sm hover:shadow-md",
        "overflow-hidden",
        className
      )}
      style={{ 
        height: `${height}px`,
        backgroundImage: `repeating-linear-gradient(
          45deg,
          transparent,
          transparent 10px,
          rgba(0, 0, 0, 0.02) 10px,
          rgba(0, 0, 0, 0.02) 20px
        )`,
        ...style
      }}
    >
      <div className="p-2 h-full flex flex-col">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
          <span className="text-base">🚫</span>
          <span>{startTime} - {endTime}</span>
        </div>
        <div className="text-sm font-semibold text-gray-700 mt-0.5 truncate">
          {title}
        </div>
        {reason && (
          <div className="text-xs text-gray-500 mt-auto truncate">
            {reason}
          </div>
        )}
      </div>
    </div>
  );
} 