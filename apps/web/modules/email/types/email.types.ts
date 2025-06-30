export interface EmailDecision {
  id: string;
  from: string;
  subject: string;
  preview: string;
  decision?: 'now' | 'tomorrow' | 'never';
} 