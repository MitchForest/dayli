'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Lock, Clock } from 'lucide-react';

interface BlockedTimeBlockProps {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number;
  reason?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function BlockedTimeBlock({ 
  id,
  title,
  startTime, 
  endTime,
  duration,
  reason,
  className,
  style
}: BlockedTimeBlockProps) {
  // Calculate height based on duration
  const baseHeight = Math.max(40, (duration / 15) * 30);

  return (
    <div
      data-block-id={id}
      className={cn(
        "rounded-md border border-gray-300",
        "bg-gradient-to-br from-gray-100 to-gray-200",
        "transition-all duration-200",
        "shadow-sm overflow-hidden group",
        "opacity-75",
        className
      )}
      style={{
        ...style,
        height: `${baseHeight}px`
      }}
    >
      <div className="p-2 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <Lock size={16} className="text-gray-600" />
            <span>{startTime} - {endTime}</span>
          </div>
        </div>
        
        {/* Title */}
        <div className="text-sm font-semibold text-gray-800 mt-0.5 truncate">
          {title}
        </div>
        
        {/* Reason */}
        {reason && baseHeight > 60 && (
          <div className="text-xs text-gray-600 mt-1 truncate">
            {reason}
          </div>
        )}
      </div>
    </div>
  );
} 