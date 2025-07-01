import type { GmailMessage } from '../mock/gmail.service';

export interface IGmailService {
  listMessages(params: {
    userId: string;
    q?: string;
    pageToken?: string;
    maxResults?: number;
  }): Promise<{
    messages: Array<{
      id: string;
      threadId: string;
    }>;
    nextPageToken?: string;
    resultSizeEstimate: number;
  }>;
  
  getMessage(params: {
    userId: string;
    id: string;
  }): Promise<GmailMessage | null>;
} 