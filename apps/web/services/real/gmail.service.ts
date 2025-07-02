import { ServiceConfig } from '../interfaces/base.interface';
import type { IGmailService } from '../interfaces/gmail.interface';

// Define GmailMessage type here for now (will move to a shared types file later)
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: {
    partId: string;
    mimeType: string;
    filename: string;
    headers: Array<{
      name: string;
      value: string;
    }>;
    body: {
      size: number;
      data?: string;
    };
    parts?: Array<{
      partId: string;
      mimeType: string;
      filename: string;
      headers: Array<{
        name: string;
        value: string;
      }>;
      body: {
        size: number;
        data?: string;
        attachmentId?: string;
      };
    }>;
  };
  sizeEstimate: number;
  raw?: string;
}

export class RealGmailService implements IGmailService {
  readonly serviceName = 'RealGmailService';
  readonly isRealImplementation = true;
  private userId: string;
  private supabase: any;

  constructor(private config: ServiceConfig) {
    this.userId = config.userId;
    this.supabase = config.supabaseClient;
  }

  async listMessages(params?: {
    maxResults?: number;
    pageToken?: string;
    q?: string;
    labelIds?: string[];
  }): Promise<{
    messages: Array<{ id: string; threadId: string }>;
    nextPageToken?: string;
    resultSizeEstimate: number;
  }> {
    try {
      // For now, fetch emails from our database
      // Later, this will integrate with Gmail API
      let query = this.supabase
        .from('emails')
        .select('id, thread_id, created_at')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false });

      if (params?.maxResults) {
        query = query.limit(params.maxResults);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching emails:', error);
        return {
          messages: [],
          resultSizeEstimate: 0
        };
      }

      // Transform to Gmail API format
      const messages = (data || []).map((email: any) => ({
        id: email.id,
        threadId: email.thread_id || email.id
      }));

      return {
        messages,
        resultSizeEstimate: messages.length
      };
    } catch (error) {
      console.error('Unexpected error in listMessages:', error);
      return {
        messages: [],
        resultSizeEstimate: 0
      };
    }
  }

  async getMessage(id: string): Promise<GmailMessage | null> {
    try {
      const { data, error } = await this.supabase
        .from('emails')
        .select()
        .eq('id', id)
        .eq('user_id', this.userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw new Error(`Failed to get email: ${error.message}`);
      }

      // Transform to Gmail API format
      return this.transformToGmailMessage(data);
    } catch (error) {
      console.error('Error getting message:', error);
      return null;
    }
  }

  async sendMessage(params: {
    to: string;
    subject: string;
    body: string;
    threadId?: string;
  }): Promise<GmailMessage> {
    // For now, store in our database
    // Later, this will send via Gmail API
    const { data, error } = await this.supabase
      .from('emails')
      .insert({
        user_id: this.userId,
        thread_id: params.threadId,
        from_email: 'user@example.com', // Will get from user profile
        to_email: params.to,
        subject: params.subject,
        body: params.body,
        snippet: params.body.substring(0, 200),
        status: 'sent',
        label_ids: ['SENT']
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to send email: ${error.message}`);

    return this.transformToGmailMessage(data);
  }

  async trashMessage(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('emails')
      .update({ 
        label_ids: ['TRASH'],
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', this.userId);

    if (error) throw new Error(`Failed to trash email: ${error.message}`);
  }

  async archiveMessage(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('emails')
      .update({ 
        label_ids: ['ARCHIVE'],
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', this.userId);

    if (error) throw new Error(`Failed to archive email: ${error.message}`);
  }

  async createDraft(params: {
    to: string[];
    subject: string;
    body: string;
    threadId?: string;
  }): Promise<string> {
    // For now, store draft in our database
    // Later, this will use Gmail API
    const { data, error } = await this.supabase
      .from('emails')
      .insert({
        user_id: this.userId,
        thread_id: params.threadId,
        from_email: 'user@example.com', // Will get from user profile
        to_email: params.to.join(', '),
        subject: params.subject,
        body: params.body,
        snippet: params.body.substring(0, 200),
        status: 'draft',
        label_ids: ['DRAFT']
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create draft: ${error.message}`);

    return data.id;
  }

  async sendDraft(draftId: string): Promise<GmailMessage> {
    // Get the draft
    const { data: draft, error: fetchError } = await this.supabase
      .from('emails')
      .select()
      .eq('id', draftId)
      .eq('user_id', this.userId)
      .eq('status', 'draft')
      .single();

    if (fetchError) throw new Error(`Failed to find draft: ${fetchError.message}`);

    // Update status to sent
    const { data, error } = await this.supabase
      .from('emails')
      .update({
        status: 'sent',
        label_ids: ['SENT'],
        updated_at: new Date().toISOString()
      })
      .eq('id', draftId)
      .select()
      .single();

    if (error) throw new Error(`Failed to send draft: ${error.message}`);

    return this.transformToGmailMessage(data);
  }

  private transformToGmailMessage(data: any): GmailMessage {
    return {
      id: data.id,
      threadId: data.thread_id || data.id,
      labelIds: data.label_ids || ['INBOX'],
      snippet: data.snippet || data.body?.substring(0, 200) || '',
      historyId: data.history_id || '1',
      internalDate: new Date(data.created_at).getTime().toString(),
      payload: {
        partId: '0',
        mimeType: 'text/plain',
        filename: '',
        headers: [
          { name: 'From', value: data.from_email || '' },
          { name: 'To', value: data.to_email || '' },
          { name: 'Subject', value: data.subject || '' },
          { name: 'Date', value: data.created_at }
        ],
        body: {
          size: data.body?.length || 0,
          data: Buffer.from(data.body || '').toString('base64')
        }
      },
      sizeEstimate: data.body?.length || 0
    };
  }
} 