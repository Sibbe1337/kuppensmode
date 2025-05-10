"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
// Removed Link import as it's not used in this version of Hero based on prompt

interface HeroProps {
  // Props for headline, sub-copy, CTA text/action if they need to be dynamic
  // For now, assuming they are static as per the prompt example
  onPrimaryCtaClick: () => void;
}

const Hero: React.FC<HeroProps> = ({ onPrimaryCtaClick }) => {
  return (
    <section 
      className="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-white dark:from-slate-900 dark:via-slate-950 dark:to-slate-950"
      // The prompt asked for radial gradient, but a subtle top-down gradient might be easier to make look good generally.
      // style={{ background: 'radial-gradient(circle at top center, #EEF2FF 0%, transparent 70%)' }}
    >
      <div className="container mx-auto px-4 py-20 md:py-32 lg:py-40">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column: Headline, Sub-copy, CTA */}
          <div className="text-center lg:text-left">
            <h1 
              className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 
                         bg-gradient-to-r from-primary via-blue-500 to-indigo-600 
                         dark:from-sky-400 dark:via-cyan-400 dark:to-fuchsia-500 
                         text-transparent bg-clip-text"
            >
              Automatic Notion snapshots in the background
            </h1>
            <p 
              className="text-lg md:text-xl text-muted-foreground max-w-md lg:max-w-[45ch] mx-auto lg:mx-0 mb-8"
            >
              Reliable, automated backups for your entire Notion workspace. Secure your data effortlessly and restore any page with one click.
            </p>
            <Button 
              size="lg" 
              className="text-lg px-8 py-6 bg-[#4F46E5] hover:bg-[#4338CA] dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              onClick={onPrimaryCtaClick}
            >
              Get started free
            </Button>
          </div>

          {/* Right Column: Mock browser frame with screenshot placeholder */}
          <div className="hidden lg:block relative mx-auto w-full max-w-2xl">
            <div className="relative rounded-xl shadow-2xl bg-slate-800 dark:bg-slate-700 p-1.5 overflow-hidden">
              {/* Browser Header */}
              <div className="flex items-center h-8 px-3 bg-slate-700 dark:bg-slate-600 rounded-t-lg">
                <div className="flex space-x-2">
                  <span className="h-3 w-3 bg-red-500 rounded-full"></span>
                  <span className="h-3 w-3 bg-yellow-400 rounded-full"></span>
                  <span className="h-3 w-3 bg-green-500 rounded-full"></span>
                </div>
                <div className="flex-grow px-4">
                  <div className="bg-slate-600 dark:bg-slate-500 h-4 rounded-sm opacity-50"></div>
                </div>
              </div>
              {/* Screenshot Placeholder */}
              <div className="aspect-[16/10] bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">App Screenshot Placeholder</p>
                {/* You would replace this div with an <Image /> component */}
                {/* e.g., <Image src="/path/to/your/screenshot.png" alt="App screenshot" layout="fill" objectFit="cover" className="rounded-b-md" /> */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero; 