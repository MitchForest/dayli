import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Mail, Clock } from 'lucide-react';
import type { DailySchedule } from '../types/schedule.types';

interface DailyStatsProps {
  schedule: DailySchedule;
  className?: string;
}

export function DailyStats({ schedule, className }: DailyStatsProps) {
  const completedTasks = schedule.dailyTasks.filter(task => task.completed).length;
  const totalTasks = schedule.dailyTasks.length;
  const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  
  const focusHours = Math.round(schedule.stats.focusMinutes / 60);
  const emailsProcessed = schedule.stats.emailsProcessed;
  
  return (
    <div className={cn(
      "bg-card border border-border rounded-lg p-4 mb-6",
      className
    )}>
      <div className="grid grid-cols-3 gap-4">
        {/* Tasks Progress */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Tasks</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold">{completedTasks}</span>
              <span className="text-sm text-muted-foreground">/ {totalTasks}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${taskProgress}%` }}
              />
            </div>
          </div>
        </div>
        
        {/* Emails Processed */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium">Emails</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold">{emailsProcessed}</span>
              <span className="text-sm text-muted-foreground">processed</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Keep inbox clear
            </div>
          </div>
        </div>
        
        {/* Focus Time */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-secondary-foreground" />
            <span className="text-sm font-medium">Focus Time</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold">{focusHours}</span>
              <span className="text-sm text-muted-foreground">hours</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Deep work scheduled
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 