import React from 'react';
import { cn } from '@/lib/utils';
import { Mail, Calendar, Sparkles, Check } from 'lucide-react';
import type { DailyTask } from '../types/schedule.types';

interface TaskItemProps {
  task: DailyTask;
  onToggle?: (taskId: string) => void;
  className?: string;
}

const sourceIcons = {
  email: Mail,
  calendar: Calendar,
  ai: Sparkles,
};

export function TaskItem({ task, onToggle, className }: TaskItemProps) {
  const SourceIcon = task.source ? sourceIcons[task.source] : null;
  
  return (
    <div 
      className={cn(
        "group flex items-start gap-2 py-1.5 px-1 -mx-1 rounded-md transition-colors hover:bg-muted/50",
        className
      )}
    >
      <div className="relative flex items-center justify-center">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => onToggle?.(task.id)}
          className={cn(
            "peer h-4 w-4 rounded border-border bg-background text-primary",
            "transition-all duration-200",
            "focus:ring-2 focus:ring-ring focus:ring-offset-0",
            "hover:border-primary/50",
            task.completed && "border-primary bg-primary"
          )}
          aria-label={`Mark "${task.title}" as ${task.completed ? 'incomplete' : 'complete'}`}
        />
        <Check 
          className={cn(
            "absolute h-3 w-3 text-primary-foreground pointer-events-none",
            "transition-all duration-200",
            task.completed ? "scale-100 opacity-100" : "scale-0 opacity-0"
          )}
        />
      </div>
      
      <div className="flex-1 flex items-start gap-2">
        <span 
          className={cn(
            "text-sm leading-tight transition-all duration-200",
            task.completed && "line-through text-muted-foreground opacity-70"
          )}
        >
          {task.title}
        </span>
        
        {SourceIcon && (
          <SourceIcon 
            className={cn(
              "h-3 w-3 mt-0.5 shrink-0 transition-opacity duration-200",
              task.completed ? "text-muted-foreground opacity-50" : "text-muted-foreground opacity-70"
            )}
            aria-label={`Source: ${task.source}`}
          />
        )}
      </div>
    </div>
  );
} 