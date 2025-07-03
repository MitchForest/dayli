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
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
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
        
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
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
                  ? "border-primary shadow-lg" 
                  : "border-border"
              )}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-sm font-medium px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              
              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-muted-foreground mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">
                    {plan.price[isAnnual ? "annual" : "monthly"]}
                  </span>
                  {plan.period && (
                    <span className="text-muted-foreground">
                      {plan.period[isAnnual ? "annual" : "monthly"]}
                    </span>
                  )}
                </div>
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