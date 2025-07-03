"use client";

import { useMemo, useCallback } from "react";
import { AuthProvider } from "@repo/auth/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { createClient } from "@/lib/supabase-client";
import { ServiceFactory } from "@/services/factory/service.factory";
import type { User } from "@supabase/supabase-js";


interface ProvidersProps {
  children: React.ReactNode;
  initialUser?: User | null;
}

export function Providers({ children, initialUser }: ProvidersProps) {
  // Use useMemo to ensure client is created only once
  const supabaseClient = useMemo(() => {
    console.log('[Providers] Creating supabase client');
    return createClient();
  }, []);
  
  // Handle auth state changes to configure ServiceFactory
  const handleAuthStateChange = useCallback((user: User | null) => {
    const factory = ServiceFactory.getInstance();
    
    if (user && supabaseClient) {
      console.log('[Providers] Configuring ServiceFactory for user:', user.id);
      factory.configure({
        userId: user.id,
        supabaseClient: supabaseClient
      });
    } else {
      console.log('[Providers] User logged out - ServiceFactory will need reconfiguration on next login');
      // Note: ServiceFactory doesn't support clearing configuration yet
      // This is handled by checking authentication in each service call
    }
  }, [supabaseClient]);
  
  return (
    <AuthProvider 
      supabaseClient={supabaseClient}
      onAuthStateChange={handleAuthStateChange}
      initialUser={initialUser}
    >
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </AuthProvider>
  );
} 