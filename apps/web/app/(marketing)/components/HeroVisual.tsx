"use client";

import { motion } from "framer-motion";
import { Clock, Mail, Brain, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";

const timeBlocks = [
  {
    time: "9:00 AM",
    duration: "2h",
    title: "Deep Work: Q4 Strategy",
    type: "focus",
    icon: Brain,
    color: "bg-primary/10 border-primary/20 text-primary",
  },
  {
    time: "11:00 AM",
    duration: "30m",
    title: "Email Triage",
    type: "email",
    icon: Mail,
    color: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
  },
  {
    time: "11:30 AM",
    duration: "30m",
    title: "Team Standup",
    type: "meeting",
    icon: Clock,
    color: "bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400",
  },
  {
    time: "12:00 PM",
    duration: "1h",
    title: "Lunch Break",
    type: "break",
    icon: Coffee,
    color: "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

const blockVariants = {
  hidden: { opacity: 0, x: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: "easeOut" as const,
    },
  },
};

export function HeroVisual() {
  return (
    <div className="relative">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent blur-3xl" />
      
      {/* Main container */}
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-muted/50 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Today&apos;s Schedule</h3>
              <p className="text-sm text-muted-foreground">Tuesday, March 12</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              AI Active
            </div>
          </div>
        </div>
        
        {/* Time blocks */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="p-6 space-y-3"
        >
          {timeBlocks.map((block, index) => (
            <motion.div
              key={index}
              variants={blockVariants}
              whileHover={{ scale: 1.02, x: 5 }}
              className={cn(
                "relative p-4 rounded-xl border-2 transition-all cursor-pointer",
                block.color
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <block.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-medium">{block.title}</h4>
                    <p className="text-sm opacity-70 mt-1">
                      {block.time} • {block.duration}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Progress indicator for first block */}
              {index === 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/20 rounded-b-xl overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: "0%" }}
                    animate={{ width: "35%" }}
                    transition={{ duration: 2, delay: 1, ease: "linear" }}
                  />
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
        
        {/* AI Chat bubble */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 1.5, duration: 0.5 }}
          className="absolute bottom-4 right-4 bg-primary text-primary-foreground rounded-2xl px-4 py-2 shadow-lg"
        >
          <p className="text-sm font-medium">Ready to start your deep work?</p>
        </motion.div>
      </div>
    </div>
  );
} 