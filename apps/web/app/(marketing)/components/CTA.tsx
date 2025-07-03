"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function CTA() {
  return (
    <section className="py-24 bg-primary/5">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to reclaim your focus?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of professionals who&apos;ve stopped managing their work and started doing it.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="group" asChild>
              <Link href="/login">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            
            <Button size="lg" variant="outline" asChild>
              <Link href="#pricing">
                View Pricing
              </Link>
            </Button>
          </div>
          
          <p className="mt-8 text-sm text-muted-foreground">
            No credit card required • Free forever for personal use
          </p>
        </motion.div>
      </div>
    </section>
  );
} 