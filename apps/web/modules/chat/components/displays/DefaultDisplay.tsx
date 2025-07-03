import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

interface DefaultDisplayProps {
  toolName: string;
  data: any;
  onAction?: (action: { type: string; payload?: any }) => void;
}

export const DefaultDisplay = memo(function DefaultDisplay({ 
  toolName,
  data 
}: DefaultDisplayProps) {
  // For unknown tools or debugging, show a formatted JSON view
  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <span className="text-sm font-medium">Tool Result</span>
          <Badge variant="outline" className="text-xs">
            {toolName}
          </Badge>
        </div>
        
        <div className="p-3 bg-muted rounded-md">
          <pre className="text-xs overflow-auto max-h-64">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
        
        <p className="text-xs text-muted-foreground">
          This is a fallback display. A specific display component for "{toolName}" has not been implemented yet.
        </p>
      </div>
    </Card>
  );
});

export default DefaultDisplay;