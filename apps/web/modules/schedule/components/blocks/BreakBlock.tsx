'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface BreakBlockProps {
  title: string;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  type?: 'lunch' | 'coffee' | 'other';
  className?: string;
  style?: React.CSSProperties;
}

export function BreakBlock({ 
  title, 
  startTime, 
  endTime, 
  duration,
  type = 'other',
  className,
  style
}: BreakBlockProps) {
  // Calculate height based on duration (4px per minute = 60px per 15min block)
  const height = (duration / 15) * 20;
  
  const getIcon = () => {
    switch(type) {
      case 'lunch': return '🍽️';
      case 'coffee': return '☕';
      default: return '☕';
    }
  };
  
  return (
    <div
      className={cn(
        "absolute left-0 right-0 rounded-md border border-yellow-500/20",
        "bg-gradient-to-br from-yellow-100 to-yellow-200",
        "hover:from-yellow-200 hover:to-yellow-300",
        "transition-all duration-200 cursor-pointer",
        "shadow-sm hover:shadow-md",
        "overflow-hidden",
        className
      )}
      style={{ height: `${height}px`, ...style }}
    >
      <div className="p-2 h-full flex flex-col">
        <div className="flex items-center gap-1.5 text-xs font-medium text-yellow-800">
          <span className="text-base">{getIcon()}</span>
          <span>{startTime} - {endTime}</span>
        </div>
        <div className="text-sm font-semibold text-yellow-900 mt-0.5 truncate">
          {title}
        </div>
      </div>
    </div>
  );
} 