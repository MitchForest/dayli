"use client";

import { useMemo, useCallback } from "react";
import { AuthProvider } from "@repo/auth/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { createClient } from "@/lib/supabase-client";
import { ServiceFactory } from "@/services/factory/service.factory";
import type { User } from "@supabase/supabase-js";

export function Providers({ children }: { children: React.ReactNode }) {
  // Create client only once
  const supabaseClient = useMemo(() => createClient(), []);
  
  // Handle auth state changes to configure ServiceFactory
  const handleAuthStateChange = useCallback((user: User | null) => {
    if (user) {
      console.log('[Providers] Configuring ServiceFactory for user:', user.id);
      ServiceFactory.getInstance().configure({
        userId: user.id,
        supabaseClient: supabaseClient
      }, true); // Use mock services for development
    } else {
      console.log('[Providers] Clearing ServiceFactory configuration');
      ServiceFactory.getInstance().configure(null);
    }
  }, [supabaseClient]);
  
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider 
        supabaseClient={supabaseClient}
        onAuthStateChange={handleAuthStateChange}
      >
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
} 