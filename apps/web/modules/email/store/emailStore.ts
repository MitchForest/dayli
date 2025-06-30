import { create } from 'zustand';
import type { EmailDecision } from '../types/email.types';

interface EmailStore {
  emailQueue: EmailDecision[];
  processedEmails: EmailDecision[];
  setEmailQueue: (emails: EmailDecision[]) => void;
  processEmail: (emailId: string, decision: 'now' | 'tomorrow' | 'never') => void;
  addToQueue: (email: EmailDecision) => void;
}

export const useEmailStore = create<EmailStore>((set, get) => ({
  emailQueue: [],
  processedEmails: [],
  
  setEmailQueue: (emails) => set({ emailQueue: emails }),
  
  processEmail: (emailId, decision) => {
    const { emailQueue } = get();
    const email = emailQueue.find(e => e.id === emailId);
    
    if (!email) return;
    
    const processedEmail = { ...email, decision };
    
    set({
      emailQueue: emailQueue.filter(e => e.id !== emailId),
      processedEmails: [...get().processedEmails, processedEmail],
    });
  },
  
  addToQueue: (email) => {
    set({ emailQueue: [...get().emailQueue, email] });
  },
})); 