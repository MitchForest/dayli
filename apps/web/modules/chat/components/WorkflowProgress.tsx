import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, Play, ArrowRight } from 'lucide-react';

interface WorkflowProgressProps {
  currentPhase: 'analysis' | 'proposal' | 'confirmation' | 'execution' | 'completed';
  workflowType?: string;
}

export const WorkflowProgress = memo(function WorkflowProgress({ 
  currentPhase,
  workflowType 
}: WorkflowProgressProps) {
  const phases = [
    { id: 'analysis', label: 'Analysis', icon: Play },
    { id: 'proposal', label: 'Proposal', icon: Clock },
    { id: 'confirmation', label: 'Review', icon: Clock },
    { id: 'execution', label: 'Execute', icon: Play },
    { id: 'completed', label: 'Complete', icon: CheckCircle2 },
  ];
  
  const currentIndex = phases.findIndex(p => p.id === currentPhase);
  
  return (
    <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1">
      {phases.map((phase, idx) => {
        const isActive = idx === currentIndex;
        const isCompleted = idx < currentIndex;
        const Icon = phase.icon;
        
        return (
          <div key={phase.id} className="flex items-center">
            <Badge 
              variant={isActive ? 'default' : isCompleted ? 'secondary' : 'outline'}
              className={`gap-1 whitespace-nowrap ${
                isActive ? '' : isCompleted ? 'opacity-80' : 'opacity-50'
              }`}
            >
              <Icon className="h-3 w-3" />
              {phase.label}
            </Badge>
            {idx < phases.length - 1 && (
              <ArrowRight className={`h-3 w-3 mx-1 ${
                idx < currentIndex ? 'text-muted-foreground' : 'text-muted-foreground/50'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
});

export default WorkflowProgress;
