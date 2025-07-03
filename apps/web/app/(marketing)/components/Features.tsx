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
      ease: "easeOut" as const,
    },
  },
};

export function Features() {
  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
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
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto"
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