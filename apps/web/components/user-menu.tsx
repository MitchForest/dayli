'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { LogOut, Settings, Moon, Sun } from 'lucide-react';
import { useAuth } from '@repo/auth/hooks';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function UserMenu() {
  const { user, profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const userInitial = String(profile?.full_name || user?.email || 'U').charAt(0).toUpperCase();
  const userName = String(profile?.full_name || user?.email?.split('@')[0] || 'User');
  const avatarUrl = (profile?.avatar_url as string) || user?.user_metadata?.avatar_url || '';
  
  // Debug avatar URL
  console.log('Avatar URL:', avatarUrl);
  console.log('Profile:', profile);
  console.log('User metadata:', user?.user_metadata);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-12 w-12 rounded-full p-0 hover:ring-2 hover:ring-primary/20 transition-all"
          >
            <Avatar className="h-12 w-12">
              <AvatarImage 
                src={avatarUrl} 
                alt={userName}
                onError={(e) => {
                  console.error('Avatar image failed to load:', e);
                  console.log('Attempted URL:', avatarUrl);
                }}
              />
              <AvatarFallback className="bg-blue-500 text-white text-lg font-medium">
                {userInitial}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="start" side="top" forceMount>
          <div className="flex items-center gap-3 p-3">
            <Avatar className="h-10 w-10">
              <AvatarImage 
                src={avatarUrl} 
                alt={userName}
              />
              <AvatarFallback className="bg-blue-500 text-white font-medium">
                {userInitial}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col space-y-1 leading-none">
              <p className="font-medium">{userName}</p>
              {user?.email && (
                <p className="text-xs text-muted-foreground">{user.email}</p>
              )}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            <span>Theme</span>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings" className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={handleSignOut} 
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
} 