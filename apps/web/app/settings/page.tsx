import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
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
        
        <div className="bg-card rounded-lg p-8 border border-border text-center">
          <p className="text-muted-foreground">
            Settings functionality coming soon...
          </p>
        </div>
      </div>
    </div>
  );
} 