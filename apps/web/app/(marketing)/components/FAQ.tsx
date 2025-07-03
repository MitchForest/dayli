"use client";

import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How is dayli different from other productivity apps?",
    answer: "dayli eliminates decision-making entirely. While other apps give you more dashboards and features, we show less. No task lists to manage, no priorities to set. Our AI makes every decision about what you should work on, so you can focus on execution."
  },
  {
    question: "What if I don't agree with the AI's decisions?",
    answer: "You can always override the AI with natural language commands. Just say 'I need to work on X instead' and dayli will adjust. Over time, it learns your preferences and makes better decisions. Most users find the AI's choices are better than their own after a week."
  },
  {
    question: "How does the email triage work?",
    answer: "dayli analyzes every email on two dimensions: importance and urgency. It automatically schedules important emails into your day, archives low-priority ones, and can even draft responses. You'll only see the emails that truly need your attention."
  },
  {
    question: "Can I use dayli with my existing calendar?",
    answer: "Yes! dayli integrates with Google Calendar, Outlook, and Apple Calendar. It respects your existing meetings and schedules deep work around them. Your calendar becomes the source of truth for your time."
  },
  {
    question: "What happens to tasks I don't complete?",
    answer: "Unlike traditional apps, incomplete tasks don't create an endless backlog. Each day starts fresh. Important incomplete work is automatically rescheduled by the AI. This constraint forces focus on what truly matters."
  },
  {
    question: "Is my data secure?",
    answer: "Absolutely. We use end-to-end encryption for all data. Your emails and calendar data are processed in isolated environments and never stored permanently. We're SOC 2 Type II certified and GDPR compliant."
  },
  {
    question: "Can I use dayli for team collaboration?",
    answer: "dayli is designed for individual productivity. We believe the best teams are made of highly productive individuals. Team features would add complexity that goes against our core philosophy of simplicity."
  },
  {
    question: "What's included in the free plan?",
    answer: "The free plan includes unlimited daily planning, email triage, calendar integration, and 7-day history. It's fully functional for personal use. The Professional plan adds unlimited AI credits and 30-day analytics."
  }
];

export function FAQ() {
  return (
    <section id="faq" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Frequently asked questions
          </h2>
          <p className="text-lg text-muted-foreground">
            Everything you need to know about reclaiming your focus with dayli.
          </p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
} 