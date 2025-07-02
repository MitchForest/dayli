'use client';

import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface StreamingProgressProps {
  progress: number; // 0-100
  message: string;
  status?: 'loading' | 'success' | 'error';
  className?: string;
  autoHide?: boolean;
  autoHideDelay?: number;
}

export function StreamingProgress({
  progress,
  message,
  status = 'loading',
  className,
  autoHide = true,
  autoHideDelay = 2000
}: StreamingProgressProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isComplete, setIsComplete] = useState(false);

  // Handle auto-hide when complete
  useEffect(() => {
    if (progress >= 100 && autoHide) {
      setIsComplete(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, autoHideDelay);
      
      return () => clearTimeout(timer);
    }
  }, [progress, autoHide, autoHideDelay]);

  // Reset visibility when progress restarts
  useEffect(() => {
    if (progress < 100 && !isVisible) {
      setIsVisible(true);
      setIsComplete(false);
    }
  }, [progress, isVisible]);

  if (!isVisible) return null;

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Loader2 className="w-4 h-4 animate-spin" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'bg-green-600';
      case 'error':
        return 'bg-red-600';
      default:
        return 'bg-primary';
    }
  };

  return (
    <div
      className={cn(
        'space-y-2 p-3 rounded-lg bg-muted/50 border border-border',
        'animate-in fade-in-0 slide-in-from-bottom-2 duration-300',
        isComplete && 'animate-out fade-out-0 slide-out-to-bottom-2',
        className
      )}
    >
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className="text-sm font-medium">{message}</span>
        {progress < 100 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {Math.round(progress)}%
          </span>
        )}
      </div>
      
      <Progress 
        value={progress} 
        className="h-2"
      />
    </div>
  );
}

// Hook to extract streaming progress from tool results
export function useStreamingProgress(toolInvocations?: any[]) {
  const [progressData, setProgressData] = useState<{
    progress: number;
    message: string;
    status: 'loading' | 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    if (!toolInvocations || toolInvocations.length === 0) {
      setProgressData(null);
      return;
    }

    // Find the latest tool invocation with streaming data
    const latestStreaming = toolInvocations
      .filter(inv => inv.state === 'partial-call' && inv.result?.streaming)
      .pop();

    if (latestStreaming && latestStreaming.result.streaming) {
      const { progress, message } = latestStreaming.result.streaming;
      setProgressData({
        progress: Math.min(Math.max(0, progress), 100),
        message: message || 'Processing...',
        status: 'loading'
      });
    } else {
      // Check if all tools completed
      const allCompleted = toolInvocations.every(
        inv => inv.state === 'result'
      );
      
      if (allCompleted && progressData) {
        setProgressData({
          ...progressData,
          progress: 100,
          status: 'success',
          message: 'Complete!'
        });
      }
    }
  }, [toolInvocations, progressData]);

  return progressData;
}

// Component to integrate with MessageContent
export function MessageStreamingProgress({ message }: { message: any }) {
  const progressData = useStreamingProgress(message.toolInvocations);

  if (!progressData) return null;

  return (
    <StreamingProgress
      progress={progressData.progress}
      message={progressData.message}
      status={progressData.status}
      className="mt-2"
    />
  );
}

export default StreamingProgress; 