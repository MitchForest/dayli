import { useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Database, Email } from '@repo/database/types';

interface EmailTriageStats {
  processed: number;
  now: number;
  later: number;
  never: number;
}

export function useEmailTriage(blockId: string) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<EmailTriageStats>({
    processed: 0,
    now: 0,
    later: 0,
    never: 0,
  });

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const loadEmails = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('emails')
        .select('*')
        .eq('user_id', user.id)
        .is('decision', null)
        .order('received_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setEmails(data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [blockId]);

  const processEmail = useCallback(async (emailId: string, decision: 'now' | 'later' | 'never') => {
    // Update local state optimistically
    setEmails(prev => prev.map(email => 
      email.id === emailId ? { ...email, decision } : email
    ));

    // Update stats
    setStats(prev => ({
      ...prev,
      processed: prev.processed + 1,
      [decision]: prev[decision] + 1,
    }));

    // Call the workflow API
    try {
      const response = await fetch('/api/workflows/email-triage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blockId }),
      });

      if (!response.ok) {
        console.error('Failed to process email');
        // Revert optimistic update on error
        setEmails(prev => prev.map(email => 
          email.id === emailId ? { ...email, decision: null } : email
        ));
        setStats(prev => ({
          ...prev,
          processed: prev.processed - 1,
          [decision]: prev[decision] - 1,
        }));
      }
    } catch (error) {
      console.error('Error processing email:', error);
    }
  }, [blockId]);

  return {
    emails,
    processEmail,
    isLoading,
    stats,
    loadEmails,
  };
} 