'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Plus, Check, X, Mail, Calendar, Bot, HandIcon } from 'lucide-react';
import type { DailyTask } from '@/modules/schedule/types/schedule.types';

interface DeepWorkBlockProps {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  tasks?: DailyTask[];
  capacity?: number; // Max tasks for this block
  onAddTask?: () => void;
  onToggleTask?: (taskId: string) => void;
  onRemoveTask?: (taskId: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

const SOURCE_ICONS = {
  email: { icon: Mail, color: 'text-purple-600' },
  calendar: { icon: Calendar, color: 'text-green-600' },
  ai: { icon: Bot, color: 'text-blue-600' },
  manual: { icon: HandIcon, color: 'text-gray-600' },
} as const;

export function DeepWorkBlock({ 
  id,
  title, 
  startTime, 
  endTime, 
  duration,
  tasks = [],
  capacity = 3,
  onAddTask,
  onToggleTask,
  onRemoveTask,
  className,
  style 
}: DeepWorkBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  // Calculate height based on duration (30px per 15min block)
  const height = Math.max(40, (duration / 15) * 30);
  
  return (
    <div
      className={cn(
        "rounded-md border border-blue-500/20",
        "bg-gradient-to-br from-blue-100 to-blue-200",
        "hover:from-blue-200 hover:to-blue-300",
        "transition-all duration-200 cursor-pointer",
        "shadow-sm hover:shadow-md",
        "overflow-hidden group",
        isExpanded && "z-10 scale-[1.02]",
        className
      )}
      style={{ height: `${height}px`, ...style }}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="p-2 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-blue-900">
            <span className="text-base">🎯</span>
            <span>{startTime} - {endTime}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-blue-700">
              {tasks.filter(t => t.completed).length}/{tasks.length}
            </span>
            {tasks.length < capacity && onAddTask && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddTask();
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Plus size={14} className="text-blue-700" />
              </button>
            )}
          </div>
        </div>
        
        {/* Title */}
        <div className="text-sm font-semibold text-blue-900 mt-0.5 truncate">
          {title}
        </div>
        
        {/* Tasks Preview/List */}
        {isExpanded && tasks.length > 0 ? (
          <div className="mt-2 space-y-1 flex-1 overflow-y-auto">
            {tasks.map((task) => {
              const sourceInfo = task.source && task.source in SOURCE_ICONS ? SOURCE_ICONS[task.source as keyof typeof SOURCE_ICONS] : SOURCE_ICONS.manual;
              const Icon = sourceInfo.icon;
              
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-1 p-1 rounded bg-blue-50/50 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onToggleTask?.(task.id)}
                    className="flex-shrink-0"
                  >
                    {task.completed ? (
                      <Check size={12} className="text-green-600" />
                    ) : (
                      <div className="w-3 h-3 border border-blue-400 rounded-sm" />
                    )}
                  </button>
                  <Icon size={12} className={cn("flex-shrink-0", sourceInfo.color)} />
                  <span className={cn(
                    "flex-1 truncate",
                    task.completed && "line-through text-blue-600/60"
                  )}>
                    {task.title}
                  </span>
                  {onRemoveTask && (
                    <button
                      onClick={() => onRemoveTask(task.id)}
                      className="opacity-0 hover:opacity-100 flex-shrink-0"
                    >
                      <X size={12} className="text-red-500" />
                    </button>
                  )}
                </div>
              );
            })}
            {tasks.length === 0 && (
              <div className="text-xs text-blue-600 text-center py-2">
                Click + to add tasks or ask AI for suggestions
              </div>
            )}
          </div>
        ) : (
          <div className="mt-1 text-xs text-blue-700">
            {tasks.length > 0 && tasks[0] ? (
              <div className="truncate">
                {tasks[0].title}
                {tasks.length > 1 && ` +${tasks.length - 1} more`}
              </div>
            ) : (
              <div className="text-blue-600 italic">No tasks assigned</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 