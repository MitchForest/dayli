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
    const factory = ServiceFactory.getInstance();
    
    if (user) {
      console.log('[Providers] Configuring ServiceFactory for user:', user.id);
      factory.configure({
        userId: user.id,
        supabaseClient
      });
    } else {
      console.log('[Providers] User logged out - ServiceFactory will need reconfiguration on next login');
      // Don't clear the factory when logged out, just note it needs reconfiguration
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