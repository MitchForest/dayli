'use client';

import { useAuth } from '@repo/auth/hooks'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut" as const,
    },
  },
};

function LoginContent() {
  const { loading, signInWithGoogle, user } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const error = searchParams.get('error')
  const message = searchParams.get('message')
  const redirectTo = searchParams.get('redirectTo') || '/focus'

  // Debug logging
  useEffect(() => {
    console.log('[LoginPage] Auth state:', { loading, hasUser: !!user });
  }, [loading, user]);

  // Handle redirect when user is authenticated
  useEffect(() => {
    if (!loading && user) {
      console.log('[LoginPage] User authenticated, redirecting to:', redirectTo);
      router.push(redirectTo);
    }
  }, [loading, user, redirectTo, router]);

  // Debug function to check auth state
  const debugAuth = async () => {
    console.log('[LoginPage] Debug: Running auth state check...');
    if (typeof window !== 'undefined') {
      const win = window as Window & { debugAuth?: () => Promise<void> };
      if (win.debugAuth) {
        await win.debugAuth();
      }
    }
  };

  // Show loading state while auth is initializing
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading...</p>
          <Button 
            onClick={debugAuth} 
            variant="ghost" 
            size="sm" 
            className="mt-4"
          >
            Debug Auth State
          </Button>
        </div>
      </div>
    )
  }

  // If user is authenticated but redirect hasn't happened yet, show loading
  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Background gradient - subtle */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-grid-black/[0.01] dark:bg-grid-white/[0.01]" />
      </div>

      {/* Main content */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-sm space-y-6"
        >
          {/* Logo */}
          <motion.div variants={itemVariants} className="text-center mb-8">
            <Link href="/" className="font-bold text-4xl inline-block">
              dayli
            </Link>
          </motion.div>

          {/* Welcome text */}
          <motion.div variants={itemVariants} className="text-center mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Let&apos;s get you focused on what matters
            </p>
          </motion.div>

          {/* Error message */}
          {error && (
            <motion.div 
              variants={itemVariants}
              className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive"
            >
              <p className="font-medium text-sm">
                {error === 'auth_callback_error' ? 'Authentication failed' : 'Sign in error'}
              </p>
              {message && <p className="mt-1 text-xs opacity-90">{decodeURIComponent(message)}</p>}
            </motion.div>
          )}

          {/* Sign in button */}
          <motion.div variants={itemVariants} className="space-y-4">
            <Button
              variant="default"
              size="lg"
              className="relative w-full h-12 text-sm font-medium group"
              onClick={signInWithGoogle}
            >
              <svg className="absolute left-4 h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  className="text-primary-foreground"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  className="text-primary-foreground"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  className="text-primary-foreground"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  className="text-primary-foreground"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </motion.div>

          {/* Divider */}
          <motion.div 
            variants={itemVariants}
            className="relative my-8"
          >
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </motion.div>

          {/* Alternative actions */}
          <motion.div 
            variants={itemVariants}
            className="text-center space-y-4"
          >
            <p className="text-sm text-muted-foreground">
              New to dayli?{' '}
              <Link href="/" className="text-primary hover:underline underline-offset-4">
                Learn more
              </Link>
            </p>
          </motion.div>

          {/* Terms - positioned at bottom */}
          <motion.p 
            variants={itemVariants}
            className="mt-8 text-xs text-center text-muted-foreground"
          >
            By continuing, you agree to our{' '}
            <Link href="/terms" className="hover:underline underline-offset-4">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="hover:underline underline-offset-4">
              Privacy Policy
            </Link>
          </motion.p>
        </motion.div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
} 