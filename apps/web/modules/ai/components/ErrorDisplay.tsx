'use client';

import { memo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface ErrorDisplayProps {
  error: {
    code: string;
    message: string;
    details?: any;
    recoverable: boolean;
    suggestedActions: string[];
  };
  onRetry?: () => void;
  className?: string;
}

export const ErrorDisplay = memo(function ErrorDisplay({
  error,
  onRetry,
  className,
}: ErrorDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Alert variant="destructive" className={cn('', className)}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>Error: {error.code}</span>
        {error.recoverable && (
          <span className="text-xs font-normal text-muted-foreground">
            This error can be recovered
          </span>
        )}
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{error.message}</p>
        
        {error.suggestedActions.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium">Suggested actions:</p>
            <ul className="text-xs space-y-0.5 ml-4">
              {error.suggestedActions.map((action, idx) => (
                <li key={idx} className="list-disc">
                  {action}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {error.details && (
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="h-6 text-xs gap-1 px-2"
            >
              {showDetails ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Hide details
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show details
                </>
              )}
            </Button>
            
            {showDetails && (
              <pre className="text-xs bg-black/10 dark:bg-white/10 p-2 rounded overflow-x-auto">
                {JSON.stringify(error.details, null, 2)}
              </pre>
            )}
          </div>
        )}
        
        {error.recoverable && onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="gap-2"
          >
            <RefreshCw className="h-3 w-3" />
            Retry operation
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}); 