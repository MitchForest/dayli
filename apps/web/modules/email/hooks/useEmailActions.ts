import { useCallback } from 'react';
import { useEmailStore } from '@/stores';

export function useEmailActions() {
  const { processEmail, processedEmails } = useEmailStore();
  
  const handleEmailDecision = useCallback((
    emailId: string, 
    decision: 'now' | 'tomorrow' | 'never'
  ) => {
    // Process the email with the decision
    processEmail(emailId, decision);
    
    // Additional logic could go here:
    // - Analytics tracking
    // - Toast notifications
    // - Sound effects
  }, [processEmail]);
  
  const getProcessedStats = useCallback(() => {
    const total = processedEmails.length;
    const now = processedEmails.filter(e => e.decision === 'now').length;
    const tomorrow = processedEmails.filter(e => e.decision === 'tomorrow').length;
    const never = processedEmails.filter(e => e.decision === 'never').length;
    
    return { total, now, tomorrow, never };
  }, [processedEmails]);
  
  const undoLastDecision = useCallback(() => {
    // This could be implemented to undo the last email decision
    // For now, it's a placeholder for future enhancement
    console.log('Undo not yet implemented');
  }, []);
  
  return {
    handleEmailDecision,
    getProcessedStats,
    undoLastDecision,
  };
} 