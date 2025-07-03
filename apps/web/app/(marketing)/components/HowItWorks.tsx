"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Clock, Brain, Target, CheckCircle } from "lucide-react";

interface Block {
  type: string;
  label: string;
  time?: string;
  active?: boolean;
  completed?: boolean;
}

const steps = [
  {
    time: "8:45 AM",
    title: "Open dayli",
    description: "Your day is already planned. No decisions needed.",
    icon: Clock,
    preview: {
      title: "Good morning!",
      subtitle: "Let me plan your day",
      blocks: [
        { type: "empty", label: "Loading your schedule..." }
      ] as Block[]
    }
  },
  {
    time: "8:46 AM",
    title: "Say 'Plan my day'",
    description: "AI analyzes calendar, emails, and tasks to create optimal schedule.",
    icon: Brain,
    preview: {
      title: "Planning complete",
      subtitle: "6 tasks scheduled for today",
      blocks: [
        { type: "focus", label: "Deep Work: Q4 Strategy", time: "9:00 - 11:00 AM" },
        { type: "email", label: "Email Triage", time: "11:00 - 11:30 AM" },
        { type: "meeting", label: "Team Standup", time: "11:30 AM - 12:00 PM" },
        { type: "break", label: "Lunch Break", time: "12:00 - 1:00 PM" }
      ]
    }
  },
  {
    time: "9:00 AM",
    title: "Start Deep Work",
    description: "Focus time protected. Distractions blocked. Just execute.",
    icon: Target,
    preview: {
      title: "Focus Mode Active",
      subtitle: "All notifications paused",
      blocks: [
        { type: "focus", label: "Deep Work: Q4 Strategy", time: "9:00 - 11:00 AM", active: true },
        { type: "email", label: "Email Triage", time: "11:00 - 11:30 AM" },
        { type: "meeting", label: "Team Standup", time: "11:30 AM - 12:00 PM" },
        { type: "break", label: "Lunch Break", time: "12:00 - 1:00 PM" }
      ]
    }
  },
  {
    time: "4:00 PM",
    title: "Day Complete",
    description: "5 of 6 tasks done. Tomorrow planned. Sign off with clarity.",
    icon: CheckCircle,
    preview: {
      title: "Great work today!",
      subtitle: "83% completion rate",
      blocks: [
        { type: "focus", label: "Deep Work: Q4 Strategy", time: "9:00 - 11:00 AM", completed: true },
        { type: "email", label: "Email Triage", time: "11:00 - 11:30 AM", completed: true },
        { type: "meeting", label: "Team Standup", time: "11:30 AM - 12:00 PM", completed: true },
        { type: "focus", label: "Project Review", time: "2:00 - 4:00 PM", completed: true }
      ]
    }
  },
];

const blockColors = {
  focus: "bg-primary/10 border-primary/20 text-primary",
  email: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
  meeting: "bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400",
  break: "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400",
  empty: "bg-muted border-border text-muted-foreground"
};

function PreviewScreen({ step }: { step: typeof steps[0] }) {
  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-1">{step.preview.title}</h3>
        <p className="text-muted-foreground">{step.preview.subtitle}</p>
      </div>
      
      <div className="flex-1 space-y-3">
        {step.preview.blocks.map((block, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              "p-4 rounded-lg border-2 transition-all",
              blockColors[block.type as keyof typeof blockColors],
              block.active && "ring-2 ring-primary ring-offset-2",
              block.completed && "opacity-60"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{block.label}</span>
              {block.time && (
                <span className="text-sm opacity-60">{block.time}</span>
              )}
            </div>
            {block.completed && (
              <CheckCircle className="h-4 w-4 mt-2" />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

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
                    "absolute left-0 top-2 w-6 h-6 rounded-full border-2 transition-colors flex items-center justify-center",
                    activeStep === index
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  )}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <step.icon className="h-3 w-3 text-background" />
                </motion.div>
                
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
                <PreviewScreen step={steps[activeStep]!} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
} 