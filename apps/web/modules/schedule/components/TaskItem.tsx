import React from 'react';
import { cn } from '@/lib/utils';
import type { DailyTask } from '../types/schedule.types';

interface TaskItemProps {
  task: DailyTask;
  onToggle?: (taskId: string) => void;
  className?: string;
}

export function TaskItem({ task, onToggle, className }: TaskItemProps) {
  return (
    <div 
      className={cn(
        "flex items-start gap-2 py-1",
        className
      )}
    >
      <input
        type="checkbox"
        checked={task.completed}
        onChange={() => onToggle?.(task.id)}
        className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-ring focus:ring-offset-0"
        aria-label={`Mark "${task.title}" as ${task.completed ? 'incomplete' : 'complete'}`}
      />
      <span 
        className={cn(
          "text-sm leading-tight transition-all duration-150",
          task.completed && "line-through text-muted-foreground"
        )}
      >
        {task.title}
      </span>
    </div>
  );
} 