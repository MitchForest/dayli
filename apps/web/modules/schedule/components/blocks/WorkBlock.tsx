'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Briefcase, Clock, CheckSquare } from 'lucide-react';
import { DailyTask } from '../../types/schedule.types';
import { CELL_HEIGHT, MIN_BLOCK_HEIGHT } from '../../constants/grid-constants';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BlockContextMenu } from './BlockContextMenu';

interface WorkBlockProps {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number;
  tasks?: DailyTask[];
  className?: string;
  style?: React.CSSProperties;
}

export function WorkBlock({ 
  id,
  title,
  startTime, 
  endTime,
  duration,
  tasks = [],
  className,
  style
}: WorkBlockProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const completedCount = tasks.filter(t => t.completed).length;
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;
  
  // Calculate height based on duration, ensuring it's a multiple of CELL_HEIGHT
  const cells = Math.ceil(duration / 15);
  const baseHeight = Math.max(cells * CELL_HEIGHT, MIN_BLOCK_HEIGHT);
  
  // Smart content display based on height
  const showTaskCount = baseHeight >= 60; // 2+ cells
  const showTaskList = baseHeight >= 90; // 3+ cells
  const showProgressBar = baseHeight >= 120 && tasks.length > 0; // 4+ cells

  return (
    <>
      <div
        data-block-id={id}
        className={cn(
          "rounded-md border border-blue-500/20",
          "bg-gradient-to-br from-blue-100 to-blue-200",
          "hover:from-blue-200 hover:to-blue-300",
          "transition-all duration-200 cursor-pointer",
          "shadow-sm hover:shadow-md hover:shadow-blue-300/20",
          "overflow-hidden group relative",
          className
        )}
        style={{
          ...style,
          height: `${baseHeight}px`
        }}
        onClick={() => setIsOpen(true)}
      >
        {/* Context menu button */}
        <BlockContextMenu
          id={id}
          title={title}
          type="work"
          startTime={startTime}
          endTime={endTime}
          color="blue"
        />

        <div className="p-2 h-full flex flex-col">
          {/* Header - Always shown */}
          <div className="flex items-center gap-1.5 text-xs font-medium text-blue-900">
            <Briefcase size={14} className="text-blue-700" />
            <span>{startTime} - {endTime}</span>
          </div>
          
          {/* Title - Always shown */}
          <div className="text-sm font-semibold text-blue-900 mt-0.5 truncate">
            {title}
          </div>
          
          {/* Task count - Show if 60px+ */}
          {showTaskCount && tasks.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-blue-700 mt-1">
              <CheckSquare size={12} />
              <span>{completedCount}/{tasks.length} tasks</span>
            </div>
          )}
          
          {/* Task list preview - Show if 90px+ */}
          {showTaskList && tasks.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {tasks.slice(0, 2).map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    "text-xs truncate",
                    task.completed ? "text-blue-600 line-through" : "text-blue-800"
                  )}
                >
                  • {task.title}
                </div>
              ))}
              {tasks.length > 2 && (
                <div className="text-xs text-blue-600">
                  +{tasks.length - 2} more
                </div>
              )}
            </div>
          )}
          
          {/* Progress bar - Show if 120px+ */}
          {showProgressBar && (
            <div className="mt-auto">
              <div className="h-1.5 bg-blue-300/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-600" />
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{startTime} - {endTime} ({duration} minutes)</span>
            </div>
            
            {tasks.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Tasks ({completedCount}/{tasks.length})</h4>
                <div className="space-y-1">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-md text-sm",
                        task.completed ? "bg-green-50 text-green-700" : "bg-gray-50"
                      )}
                    >
                      <CheckSquare
                        className={cn(
                          "h-4 w-4",
                          task.completed ? "text-green-600" : "text-gray-400"
                        )}
                      />
                      <span className={task.completed ? "line-through" : ""}>
                        {task.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No tasks assigned to this block.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 