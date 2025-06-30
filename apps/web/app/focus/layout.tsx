import { UserMenu } from '@/components/user-menu';

export default function FocusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <UserMenu />
      <main className="h-screen overflow-hidden">
        {children}
      </main>
    </div>
  );
} 