import { useState } from 'react';
import { useChatStore } from '@/modules/chat/store/chatStore';
import { useAuth } from '@repo/auth/hooks';

export function useDailyPlanning() {
  const [isPlanning, setIsPlanning] = useState(false);
  const addMessage = useChatStore(state => state.addMessage);
  const { supabase } = useAuth();
  
  const triggerDailyPlanning = async () => {
    setIsPlanning(true);
    
    // Add planning message to chat
    addMessage({
      role: 'assistant',
      content: 'I\'m analyzing your calendar and emails to create the perfect schedule for today...',
    });

    try {
      const response = await fetch('/api/workflows/daily-planning', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
        }),
      });

      const data = await response.json();

      if (data.success) {
        addMessage({
          role: 'assistant',
          content: `✅ I've created your schedule for today:
          
• ${data.schedule.filter((b: any) => b.type === 'work').length} deep work blocks
• ${data.schedule.filter((b: any) => b.type === 'email').length} email triage sessions
• Protected time for lunch and breaks
• Calendar blocked to protect your focus time

Ready to start your day?`,
        });

        // Refresh the schedule view
        // TODO: Implement refresh once CanvasStore has the method
      } else {
        throw new Error(data.error || 'Failed to generate schedule');
      }
    } catch (error) {
      addMessage({
        role: 'assistant',
        content: 'Sorry, I encountered an error while planning your day. Please try again.',
      });
      console.error('Daily planning error:', error);
    } finally {
      setIsPlanning(false);
    }
  };

  return { triggerDailyPlanning, isPlanning };
} 