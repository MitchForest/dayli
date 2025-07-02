import { NextRequest, NextResponse } from 'next/server';
import { RealGmailService } from '@/services/real/gmail.service';
import { createServerActionClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const maxResults = searchParams.get('maxResults') 
      ? parseInt(searchParams.get('maxResults')!) 
      : 10;
    const pageToken = searchParams.get('pageToken') || undefined;
    const q = searchParams.get('q') || undefined;
    
    // Get authenticated user
    const supabase = await createServerActionClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Create Gmail service
    const gmailService = new RealGmailService({
      userId: user.id,
      supabaseClient: supabase
    });
    
    const result = await gmailService.listMessages({
      maxResults,
      pageToken,
      q
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing messages:', error);
    return NextResponse.json(
      { error: 'Failed to list messages' },
      { status: 500 }
    );
  }
} 