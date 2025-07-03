"use client";

import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const testimonials = [
  {
    name: "Sarah Chen",
    handle: "@sarahchen",
    avatar: "SC",
    avatarUrl: "https://i.pravatar.cc/150?img=32",
    content: "dayli completely changed how I work. No more decision fatigue, no more task lists. I just open it and know exactly what to do. My productivity has doubled.",
    role: "Product Manager at Stripe"
  },
  {
    name: "Alex Rivera",
    handle: "@alexrivera",
    avatar: "AR",
    avatarUrl: "https://i.pravatar.cc/150?img=14",
    content: "The email triage alone saves me 2 hours a day. It's like having an executive assistant that actually understands what's important.",
    role: "Founder & CEO"
  },
  {
    name: "Jordan Park",
    handle: "@jordanpark",
    avatar: "JP",
    avatarUrl: "https://i.pravatar.cc/150?img=11",
    content: "I was skeptical about giving up control, but dayli makes better decisions than I do. My focus time is sacred now. Game changer.",
    role: "Senior Engineer at GitHub"
  },
  {
    name: "Emma Wilson",
    handle: "@emmawilson",
    avatar: "EW",
    avatarUrl: "https://i.pravatar.cc/150?img=5",
    content: "Finally, a productivity tool that shows LESS, not more. No dashboards, no metrics, just clarity. This is the future of work.",
    role: "Design Lead at Figma"
  },
  {
    name: "Michael Zhang",
    handle: "@michaelzhang",
    avatar: "MZ",
    avatarUrl: "https://i.pravatar.cc/150?img=8",
    content: "The constraint-based approach is genius. 3-7 tasks max means I actually finish my day. No more endless backlogs.",
    role: "VP Engineering"
  },
  {
    name: "Lisa Thompson",
    handle: "@lisathompson",
    avatar: "LT",
    avatarUrl: "https://i.pravatar.cc/150?img=20",
    content: "dayli understands context better than any AI I've used. It knows when I need deep work vs quick wins. Absolutely brilliant.",
    role: "Data Scientist at OpenAI"
  }
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
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

export function Testimonials() {
  return (
    <section id="testimonials" className="py-24 bg-muted/30">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Loved by focused professionals
          </h2>
          <p className="text-lg text-muted-foreground">
            Join thousands who&apos;ve reclaimed their focus and doubled their output.
          </p>
        </motion.div>
        
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto"
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-all"
            >
              <div className="flex items-start gap-4 mb-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage 
                    src={testimonial.avatarUrl} 
                    alt={testimonial.name}
                  />
                  <AvatarFallback>{testimonial.avatar}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h4 className="font-semibold">{testimonial.name}</h4>
                  <p className="text-sm text-muted-foreground">{testimonial.handle}</p>
                </div>
              </div>
              
              <p className="text-muted-foreground mb-4">
                &ldquo;{testimonial.content}&rdquo;
              </p>
              
              <p className="text-sm text-muted-foreground">
                {testimonial.role}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
} 