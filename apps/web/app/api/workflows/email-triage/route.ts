import { NextRequest, NextResponse } from 'next/server';
import { createEmailTriageWorkflow } from '@/modules/workflows/graphs/emailTriage';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@repo/database/types';

export async function POST(request: NextRequest) {
  try {
    // Create server-side Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );

    // Get user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { blockId } = await request.json();
    
    // Fetch unprocessed emails
    const { data: emails, error: emailError } = await supabase
      .from('emails')
      .select('*')
      .eq('user_id', user.id)
      .is('decision', null)
      .order('received_at', { ascending: false })
      .limit(20);

    if (emailError) {
      console.error('Error fetching emails:', emailError);
      return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 });
    }

    if (!emails || emails.length === 0) {
      return NextResponse.json({
        success: true,
        stats: {
          processed: 0,
          now: 0,
          later: 0,
          never: 0,
        },
      });
    }

    // Run the workflow
    const workflow = createEmailTriageWorkflow();
    const result = await workflow.invoke({
      userId: user.id,
      blockId,
      emails,
      decisions: [],
      stats: null,
    });

    return NextResponse.json({
      success: true,
      stats: result.stats,
      decisions: result.decisions,
    });
  } catch (error) {
    console.error('Email triage error:', error);
    return NextResponse.json(
      { error: 'Failed to process emails' },
      { status: 500 }
    );
  }
} 