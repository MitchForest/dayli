"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Download } from "lucide-react";
import Link from "next/link";
import { HeroVisual } from "./HeroVisual";
import { useState, useEffect } from "react";

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
      ease: "easeOut" as const,
    },
  },
};

interface GitHubRelease {
  tag_name: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

export function Hero() {
  const [latestRelease, setLatestRelease] = useState<GitHubRelease | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);

  // Fetch latest release on mount
  useEffect(() => {
    fetch('https://api.github.com/repos/MitchForest/dayli/releases/latest')
      .then(res => res.json())
      .then(data => {
        if (data.assets) {
          setLatestRelease(data);
        }
      })
      .catch(err => console.error('Failed to fetch release:', err));
  }, []);

  const handleDownload = () => {
    if (!latestRelease) return;

    // Find the DMG file for Mac
    const dmgAsset = latestRelease.assets.find((asset) => 
      asset.name.endsWith('.dmg')
    );

    if (dmgAsset) {
      setDownloadLoading(true);
      window.open(dmgAsset.browser_download_url, '_blank');
      setTimeout(() => setDownloadLoading(false), 2000);
    }
  };

  const getDownloadText = () => {
    if (downloadLoading) return "Starting download...";
    if (!latestRelease) return "Download coming soon";
    return "Download for Mac";
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      {/* Background gradient */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.02]" />
      </div>
      
      <div className="relative w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto"
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
              so you don&apos;t have to. No task lists. No priorities. Just focus.
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
              
              <Button 
                size="lg" 
                variant="outline" 
                className="group"
                onClick={handleDownload}
                disabled={!latestRelease || downloadLoading}
              >
                <Download className="mr-2 h-4 w-4" />
                {getDownloadText()}
              </Button>
            </motion.div>
            
            <motion.p 
              variants={itemVariants}
              className="mt-8 text-sm text-muted-foreground"
            >
              Free forever for personal use • No credit card required
              {latestRelease && (
                <span className="block mt-1 text-xs">
                  Version {latestRelease.tag_name} available
                </span>
              )}
            </motion.p>
          </div>
          
          {/* Right column - Visual */}
          <motion.div
            variants={itemVariants}
            className="hidden lg:block"
          >
            <HeroVisual />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
} 