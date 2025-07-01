'use client';

import { useState } from 'react';
import { Sparkles, Calendar, Clock, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDailyPlanning } from '../hooks/useDailyPlanning';
import { useChatStore } from '@/modules/chat/store/chatStore';

export function DailyPlanningTrigger() {
  const [isPlanning, setIsPlanning] = useState(false);
  const { triggerDailyPlanning } = useDailyPlanning();
  const addMessage = useChatStore(state => state.addMessage);
  
  const handlePlanDay = async () => {
    setIsPlanning(true);
    
    // Add message to chat
    addMessage({
      content: "I'll analyze your calendar and create the perfect schedule...",
      role: 'assistant',
    });
    
    try {
      await triggerDailyPlanning();
      
      // Add success message after 3 seconds
      setTimeout(() => {
        addMessage({
          content: "✅ Your day is planned! 4 deep work blocks, 2 email sessions, and protected lunch.",
          role: 'assistant',
        });
      }, 3000);
    } finally {
      setTimeout(() => {
        setIsPlanning(false);
      }, 3000);
    }
  };
  
  return (
    <div className="fixed bottom-4 left-4 z-50">
      <Button
        onClick={handlePlanDay}
        disabled={isPlanning}
        size="lg"
        className="shadow-lg"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        {isPlanning ? 'Planning your day...' : 'Plan My Day'}
      </Button>
      
      {/* Planning Preview */}
      {isPlanning && (
        <div className="absolute bottom-full left-0 mb-2 w-64 p-4 bg-card rounded-lg shadow-xl border">
          <h3 className="font-semibold mb-2">Creating your perfect day...</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar size={14} />
              <span>Analyzing calendar events</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock size={14} />
              <span>Scheduling focus blocks</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target size={14} />
              <span>Assigning priority tasks</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 