import type { GmailMessage } from '../real/gmail.service';

export interface IGmailService {
  listMessages(params?: {
    maxResults?: number;
    pageToken?: string;
    q?: string;
    labelIds?: string[];
  }): Promise<{
    messages: Array<{ id: string; threadId: string }>;
    nextPageToken?: string;
    resultSizeEstimate: number;
  }>;
  
  getMessage(id: string): Promise<GmailMessage | null>;
  
  sendMessage(params: {
    to: string;
    subject: string;
    body: string;
    threadId?: string;
  }): Promise<GmailMessage>;
  
  createDraft(params: {
    to: string[];
    subject: string;
    body: string;
    threadId?: string;
  }): Promise<string>; // Returns draft ID
  
  sendDraft(draftId: string): Promise<GmailMessage>;
  
  trashMessage(id: string): Promise<void>;
  
  archiveMessage(id: string): Promise<void>;
} 