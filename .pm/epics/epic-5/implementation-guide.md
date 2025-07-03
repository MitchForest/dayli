# Epic 5: Implementation Guide

This guide provides detailed code examples and implementation patterns for building the dayli marketing website.

## Project Structure

```
apps/web/app/
├── (marketing)/                 # Marketing site route group
│   ├── layout.tsx              # Marketing-specific layout
│   ├── page.tsx                # Landing page
│   ├── components/
│   │   ├── MarketingHeader.tsx
│   │   ├── Hero.tsx
│   │   ├── HeroVisual.tsx
│   │   ├── Features.tsx
│   │   ├── HowItWorks.tsx
│   │   ├── Testimonials.tsx
│   │   ├── Pricing.tsx
│   │   ├── FAQ.tsx
│   │   └── MarketingFooter.tsx
│   └── data/
│       ├── features.ts
│       ├── testimonials.ts
│       ├── pricing.ts
│       └── faq.ts
└── (app)/                      # Existing app routes

```

## Key Implementation Examples

### 1. Marketing Layout with Theme Support

```typescript
// apps/web/app/(marketing)/layout.tsx
import { Metadata } from "next";
import { MarketingHeader } from "./components/MarketingHeader";
import { MarketingFooter } from "./components/MarketingFooter";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "dayli - Stop managing your work. Start doing it.",
  description: "AI executive assistant that makes every decision about what you should work on, so you don't have to.",
  openGraph: {
    title: "dayli - Your AI Executive Assistant",
    description: "Stop managing your work. Start doing it.",
    type: "website",
    url: "https://dayli.app",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "dayli - AI Executive Assistant",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "dayli - Stop managing your work. Start doing it.",
    description: "AI executive assistant for focused professionals",
    images: ["/twitter-image.png"],
    creator: "@dayliapp",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="min-h-screen bg-background">
        <MarketingHeader />
        <main>{children}</main>
        <MarketingFooter />
      </div>
    </ThemeProvider>
  );
}
```

### 2. Hero Section with Animations

```typescript
// apps/web/app/(marketing)/components/Hero.tsx
"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Download } from "lucide-react";
import Link from "next/link";
import { HeroVisual } from "./HeroVisual";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
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
      duration: 0.6,
      ease: "easeOut",
    },
  },
};

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      {/* Background gradient */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.02]" />
      </div>
      
      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid lg:grid-cols-2 gap-12 items-center"
        >
          {/* Left column - Content */}
          <div className="text-center lg:text-left">
            <motion.h1 
              variants={itemVariants}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight"
            >
              Stop managing your work.
              <span className="block text-primary mt-2">Start doing it.</span>
            </motion.h1>
            
            <motion.p 
              variants={itemVariants}
              className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0"
            >
              Your AI executive assistant that makes every decision about what you should work on, 
              so you don't have to. No task lists. No priorities. Just focus.
            </motion.p>
            
            <motion.div 
              variants={itemVariants}
              className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Button size="lg" className="group" asChild>
                <Link href="/login">
                  Get Started with Google
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              
              <Button size="lg" variant="outline" className="group">
                <Download className="mr-2 h-4 w-4" />
                Download for Mac
              </Button>
            </motion.div>
            
            <motion.p 
              variants={itemVariants}
              className="mt-8 text-sm text-muted-foreground"
            >
              Free forever for personal use • No credit card required
            </motion.p>
          </div>
          
          {/* Right column - Visual */}
          <motion.div
            variants={itemVariants}
            className="relative lg:pl-8"
          >
            <HeroVisual />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
```

### 3. Scroll-Aware Header

```typescript
// apps/web/app/(marketing)/components/MarketingHeader.tsx
"use client";

import { useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Menu, X } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it Works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function MarketingHeader() {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { scrollY } = useScroll();
  
  // Header animations based on scroll
  const headerOpacity = useTransform(scrollY, [0, 300], [0, 1]);
  const headerY = useTransform(scrollY, [0, 300], [-50, 0]);
  
  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 100);
    };
    
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  
  return (
    <motion.header
      style={{ opacity: headerOpacity, y: headerY }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        hasScrolled && "bg-background/80 backdrop-blur-md border-b"
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="font-bold text-xl">
            dayli
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm hover:text-primary transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="relative"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
            
            {/* Desktop CTAs */}
            <div className="hidden sm:flex items-center gap-4">
              <Button variant="outline" size="sm" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
              
              <Button size="sm" asChild>
                <Link href="/login">Get Started</Link>
              </Button>
            </div>
            
            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="md:hidden bg-background border-b"
        >
          <nav className="container mx-auto px-4 py-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block py-2 text-sm hover:text-primary transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-4 space-y-2">
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
              <Button size="sm" className="w-full" asChild>
                <Link href="/login">Get Started</Link>
              </Button>
            </div>
          </nav>
        </motion.div>
      )}
    </motion.header>
  );
}
```

### 4. Features Section with Scroll Animations

```typescript
// apps/web/app/(marketing)/components/Features.tsx
"use client";

import { motion } from "framer-motion";
import { Brain, Clock, Mail, Calendar, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Brain,
    title: "AI Executive Assistant",
    description: "Makes every decision about what you should work on, analyzing context and patterns.",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: Clock,
    title: "Time-Based Scheduling",
    description: "Everything exists in time blocks. No floating tasks, just a clear daily timeline.",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  {
    icon: Mail,
    title: "Email Triage",
    description: "2D analysis of importance × urgency. 80% of emails handled without you seeing them.",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: Calendar,
    title: "Protected Focus Time",
    description: "Deep work blocks are sacred. Meetings auto-declined during focus time.",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    icon: Shield,
    title: "Enforced Constraints",
    description: "3-7 tasks max per day. Yesterday is gone. Tomorrow doesn't exist.",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    icon: Zap,
    title: "Natural Language Control",
    description: "No buttons, no menus. Just tell the AI what you need in plain English.",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
};

export function Features() {
  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Productivity through
            <span className="text-primary"> constraint</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            We show less, not more. Every feature is designed to eliminate decisions, not create them.
          </p>
        </motion.div>
        
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={itemVariants}
              className="group"
            >
              <div className="bg-card border border-border rounded-xl p-6 h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className={cn("inline-flex p-3 rounded-lg mb-4", feature.bgColor)}>
                  <feature.icon className={cn("h-6 w-6", feature.color)} />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
```

### 5. Interactive Timeline Component

```typescript
// apps/web/app/(marketing)/components/HowItWorks.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";

const steps = [
  {
    time: "8:45 AM",
    title: "Open dayli",
    description: "Your day is already planned. No decisions needed.",
    preview: <EmptySchedulePreview />,
  },
  {
    time: "8:46 AM",
    title: "Say 'Plan my day'",
    description: "AI analyzes calendar, emails, and tasks to create optimal schedule.",
    preview: <AIPlanningPreview />,
  },
  {
    time: "9:00 AM",
    title: "Start Deep Work",
    description: "Focus time protected. Distractions blocked. Just execute.",
    preview: <ActiveWorkPreview />,
  },
  {
    time: "4:00 PM",
    title: "Day Complete",
    description: "5 of 6 tasks done. Tomorrow planned. Sign off with clarity.",
    preview: <CompletionPreview />,
  },
];

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  
  return (
    <section id="how-it-works" className="py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            A day with dayli
          </h2>
          <p className="text-lg text-muted-foreground">
            From morning paralysis to evening clarity in four simple moments.
          </p>
        </motion.div>
        
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Timeline */}
          <div className="space-y-8">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "relative pl-8 cursor-pointer transition-opacity",
                  activeStep === index ? "opacity-100" : "opacity-60 hover:opacity-80"
                )}
                onClick={() => setActiveStep(index)}
              >
                {/* Timeline line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-3 top-8 bottom-0 w-0.5 bg-border" />
                )}
                
                {/* Timeline dot */}
                <motion.div
                  className={cn(
                    "absolute left-0 top-2 w-6 h-6 rounded-full border-2 transition-colors",
                    activeStep === index
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  )}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                />
                
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{step.time}</p>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
          
          {/* Preview */}
          <div className="relative h-[500px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 bg-card border border-border rounded-2xl p-8 shadow-xl"
              >
                {steps[activeStep].preview}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
```

### 6. Pricing Section with Toggle

```typescript
// apps/web/app/(marketing)/components/Pricing.tsx
"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const plans = [
  {
    name: "Personal",
    price: { monthly: "Free", annual: "Free" },
    description: "For individuals who want to reclaim their focus",
    features: [
      "Unlimited daily planning",
      "Email triage & scheduling", 
      "Calendar integration",
      "7-day history",
      "Basic AI assistance",
    ],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Professional",
    price: { monthly: "$12", annual: "$10" },
    period: { monthly: "/month", annual: "/month" },
    description: "For professionals who need unlimited AI power",
    features: [
      "Everything in Personal",
      "Unlimited AI credits",
      "Advanced scheduling algorithms",
      "30-day history & analytics",
      "Priority support",
      "Custom preferences",
    ],
    cta: "Start 14-day Trial",
    highlighted: true,
  },
];

export function Pricing() {
  const [isAnnual, setIsAnnual] = useState(false);
  
  return (
    <section id="pricing" className="py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Start free. Upgrade when you need more AI power.
          </p>
          
          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-4 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setIsAnnual(false)}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                !isAnnual ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                isAnnual ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              Annual
              <span className="ml-1 text-xs text-primary">Save 20%</span>
            </button>
          </div>
        </motion.div>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              className={cn(
                "relative bg-card border rounded-2xl p-8 transition-all",
                plan.highlighted
                  ? "border-primary shadow-xl"
                  : "border-border"
              )}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </div>
              )}
              
              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-bold">
                    {isAnnual ? plan.price.annual : plan.price.monthly}
                  </span>
                  {plan.period && (
                    <span className="text-muted-foreground">
                      {isAnnual ? plan.period.annual : plan.period.monthly}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground">{plan.description}</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button
                className="w-full"
                variant={plan.highlighted ? "default" : "outline"}
                size="lg"
              >
                {plan.cta}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

## Performance Optimization Tips

### 1. Image Optimization

```typescript
// Use Next.js Image component with proper sizing
import Image from 'next/image';

<Image
  src="/hero-visual.png"
  alt="dayli interface preview"
  width={600}
  height={400}
  priority // For above-fold images
  placeholder="blur"
  blurDataURL={blurDataUrl}
/>
```

### 2. Font Loading

```typescript
// apps/web/app/(marketing)/layout.tsx
import { Geist } from 'next/font/google';

const geist = Geist({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial'],
});
```

### 3. Animation Performance

```typescript
// Use transform and opacity for animations
const optimizedVariants = {
  hidden: { 
    opacity: 0, 
    transform: 'translateY(20px)' // Better than 'y'
  },
  visible: { 
    opacity: 1, 
    transform: 'translateY(0px)',
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1] // Custom easing
    }
  }
};

// Respect reduced motion
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

if (prefersReducedMotion) {
  // Disable or simplify animations
}
```

### 4. Lazy Loading Components

```typescript
// Lazy load heavy components
import dynamic from 'next/dynamic';

const HowItWorks = dynamic(
  () => import('./components/HowItWorks'),
  { 
    loading: () => <HowItWorksSkeleton />,
    ssr: true 
  }
);
```

## Testing Checklist

- [ ] Run Lighthouse audit (target > 90 all categories)
- [ ] Test on real devices (not just dev tools)
- [ ] Check animations at 60fps
- [ ] Verify all links and CTAs work
- [ ] Test form submissions
- [ ] Check accessibility with screen reader
- [ ] Validate SEO meta tags
- [ ] Test light/dark mode toggle
- [ ] Verify responsive breakpoints
- [ ] Check load time on slow 3G

## Common Pitfalls to Avoid

1. **Over-animating**: Keep animations subtle and purposeful
2. **Large bundle size**: Code split and lazy load where possible
3. **Poor mobile experience**: Test on real devices early
4. **Accessibility issues**: Use semantic HTML and ARIA labels
5. **SEO mistakes**: Ensure proper meta tags and structured data

## Resources

- [Framer Motion Best Practices](https://www.framer.com/motion/animation/)
- [Next.js Performance](https://nextjs.org/docs/advanced-features/measuring-performance)
- [Web Vitals](https://web.dev/vitals/)
- [Tailwind CSS Optimization](https://tailwindcss.com/docs/optimizing-for-production) 