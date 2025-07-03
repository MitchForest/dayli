import { memo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

interface PartialFailureAlertProps {
  successes: number;
  failures: number;
  failureDetails?: Array<{
    item: string;
    reason: string;
  }>;
  successMessage?: string;
  failureMessage?: string;
}

export const PartialFailureAlert = memo(function PartialFailureAlert({ 
  successes,
  failures,
  failureDetails,
  successMessage,
  failureMessage
}: PartialFailureAlertProps) {
  const total = successes + failures;
  const successRate = Math.round((successes / total) * 100);
  
  return (
    <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
      <AlertCircle className="h-4 w-4 text-yellow-600" />
      <AlertTitle className="flex items-center gap-2">
        Partial Success
        <Badge variant="outline" className="text-xs">
          {successRate}% Complete
        </Badge>
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            {successes} {successMessage || 'succeeded'}
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="h-3 w-3 text-red-600" />
            {failures} {failureMessage || 'failed'}
          </span>
        </div>
        
        {failureDetails && failureDetails.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="text-xs font-medium">Failed items:</div>
            {failureDetails.slice(0, 3).map((detail, idx) => (
              <div key={idx} className="text-xs flex items-start gap-1">
                <span className="text-red-600">•</span>
                <span>
                  <span className="font-medium">{detail.item}:</span> {detail.reason}
                </span>
              </div>
            ))}
            {failureDetails.length > 3 && (
              <div className="text-xs text-muted-foreground">
                +{failureDetails.length - 3} more failures
              </div>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
});

export default PartialFailureAlert;
