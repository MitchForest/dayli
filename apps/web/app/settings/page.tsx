'use client';

import Link from 'next/link';
import { ArrowLeft, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@repo/auth/hooks';

export default function SettingsPage() {
  const { loading } = useAuth();
  
  // Show loading state while auth is being verified
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link href="/focus">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Focus
            </Button>
          </Link>
        </div>
        
        <h1 className="text-3xl font-semibold mb-8">Settings</h1>
        
        <div className="bg-card rounded-lg p-8 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <Bot className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-medium">AI-Managed Preferences</h2>
          </div>
          <p className="text-muted-foreground mb-4">
            Your AI assistant learns and adapts to your preferences automatically.
          </p>
          <p className="text-sm text-muted-foreground">
            Just tell me what you&apos;d like to change! For example:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground ml-4">
            <li>• &quot;I prefer lunch at 11:30 now&quot;</li>
            <li>• &quot;I want to start work at 8:30am&quot;</li>
            <li>• &quot;Block my calendar during focus time&quot;</li>
            <li>• &quot;I need longer breaks on Fridays&quot;</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 