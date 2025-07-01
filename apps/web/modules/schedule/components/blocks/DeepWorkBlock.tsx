'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface DeepWorkBlockProps {
  title: string;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  className?: string;
  style?: React.CSSProperties;
}

export function DeepWorkBlock({ 
  title, 
  startTime, 
  endTime, 
  duration,
  className,
  style 
}: DeepWorkBlockProps) {
  // Calculate height based on duration (4px per minute = 60px per 15min block)
  const height = (duration / 15) * 20;
  
  return (
    <div
      className={cn(
        "absolute left-0 right-0 rounded-md border border-blue-500/20",
        "bg-gradient-to-br from-blue-100 to-blue-200",
        "hover:from-blue-200 hover:to-blue-300",
        "transition-all duration-200 cursor-pointer",
        "shadow-sm hover:shadow-md",
        "overflow-hidden",
        className
      )}
      style={{ height: `${height}px`, ...style }}
    >
      <div className="p-2 h-full flex flex-col">
        <div className="flex items-center gap-1.5 text-xs font-medium text-blue-900">
          <span className="text-base">🎯</span>
          <span>{startTime} - {endTime}</span>
        </div>
        <div className="text-sm font-semibold text-blue-900 mt-0.5 truncate">
          {title}
        </div>
      </div>
    </div>
  );
} 