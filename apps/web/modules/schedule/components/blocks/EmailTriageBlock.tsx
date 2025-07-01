'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface EmailTriageBlockProps {
  title: string;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  emailCount?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function EmailTriageBlock({ 
  title, 
  startTime, 
  endTime, 
  duration,
  emailCount,
  className,
  style
}: EmailTriageBlockProps) {
  // Calculate height based on duration (4px per minute = 60px per 15min block)
  const height = Math.max(40, (duration / 15) * 30);
  
  return (
    <div
      className={cn(
        "rounded-md border border-green-500/20",
        "bg-gradient-to-br from-green-100 to-green-200",
        "hover:from-green-200 hover:to-green-300",
        "transition-all duration-200 cursor-pointer",
        "shadow-sm hover:shadow-md",
        "overflow-hidden",
        className
      )}
      style={{ height: `${height}px`, ...style }}
    >
      <div className="p-2 h-full flex flex-col">
        <div className="flex items-center gap-1.5 text-xs font-medium text-green-800">
          <span className="text-base">📧</span>
          <span>{startTime} - {endTime}</span>
        </div>
        <div className="text-sm font-semibold text-green-900 mt-0.5 truncate">
          {title}
        </div>
        {emailCount !== undefined && (
          <div className="text-xs text-green-700 mt-auto">
            {emailCount} emails to process
          </div>
        )}
      </div>
    </div>
  );
} 