import React from 'react';
import { TimeBlock } from './TimeBlock';
import { TaskItem } from './TaskItem';
import { TIME_BLOCK_GRADIENTS } from '@/lib/constants';
import type { TimeBlock as TimeBlockType } from '../types/schedule.types';
import type { TimeGridPosition } from '../utils/timeGrid';

interface FocusBlockProps {
  block: TimeBlockType;
  gridPosition: TimeGridPosition;
  onTaskToggle?: (taskId: string) => void;
  style?: React.CSSProperties;
}

export function FocusBlock({ block, gridPosition, onTaskToggle, style }: FocusBlockProps) {
  return (
    <TimeBlock
      block={block}
      gridPosition={gridPosition}
      className="border-primary/20"
      style={{
        background: TIME_BLOCK_GRADIENTS.focus,
        ...style,
        gridRow: `${gridPosition.row} / span ${gridPosition.span}`,
      }}
    >
      <div className="space-y-1">
        {block.tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onToggle={onTaskToggle}
          />
        ))}
        {block.tasks.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No tasks scheduled</p>
        )}
      </div>
    </TimeBlock>
  );
} 