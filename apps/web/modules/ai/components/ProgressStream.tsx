'use client';

import { memo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressStreamProps {
  progress: number;
  stage?: 'initializing' | 'processing' | 'finalizing' | 'complete';
  title: string;
  message?: string;
  className?: string;
}

export const ProgressStream = memo(function ProgressStream({
  progress,
  stage = 'processing',
  title,
  message,
  className,
}: ProgressStreamProps) {
  const stageMessages = {
    initializing: 'Starting...',
    processing: 'Processing...',
    finalizing: 'Almost done...',
    complete: 'Complete!',
  };

  const stageColors = {
    initializing: 'text-blue-600',
    processing: 'text-primary',
    finalizing: 'text-green-600',
    complete: 'text-green-700',
  };

  return (
    <div className={cn('space-y-3 p-4 rounded-lg bg-muted/30', className)}>
      <div className="flex items-center gap-3">
        {stage !== 'complete' && (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        )}
        <div className="flex-1">
          <h4 className="text-sm font-medium">{title}</h4>
          <p className={cn('text-xs', stageColors[stage])}>
            {message || stageMessages[stage]}
          </p>
        </div>
        <span className="text-sm font-medium">{progress}%</span>
      </div>
      
      <Progress value={progress} className="h-2" />
      
      {stage === 'complete' && (
        <div className="text-xs text-green-600 font-medium text-center">
          ✓ Operation completed successfully
        </div>
      )}
    </div>
  );
}); 