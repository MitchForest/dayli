import React from 'react';
import { TimeBlock } from './TimeBlock';
import { TIME_BLOCK_GRADIENTS } from '@/lib/constants';
import { Coffee, Utensils } from 'lucide-react';
import type { TimeBlock as TimeBlockType } from '../types/schedule.types';
import type { TimeGridPosition } from '../utils/timeGrid';

interface BreakBlockProps {
  block: TimeBlockType;
  gridPosition: TimeGridPosition;
  style?: React.CSSProperties;
}

export function BreakBlock({ block, gridPosition, style }: BreakBlockProps) {
  const isLunch = block.title.toLowerCase().includes('lunch');
  const Icon = isLunch ? Utensils : Coffee;
  
  return (
    <TimeBlock
      block={block}
      gridPosition={gridPosition}
      className="border-secondary-foreground/20"
      style={{
        background: TIME_BLOCK_GRADIENTS.break,
        ...style,
      }}
    >
      <div className="flex items-center gap-2 text-secondary-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">Break time</span>
      </div>
    </TimeBlock>
  );
} 