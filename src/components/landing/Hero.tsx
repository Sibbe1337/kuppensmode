"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, PlayCircle } from 'lucide-react';

interface HeroProps {
  onPrimaryCtaClick: () => void; // Re-enable this prop
}

const Hero: React.FC<HeroProps> = ({ onPrimaryCtaClick }) => {
  // TODO: Replace with actual screenshot paths or more sophisticated mockups
  const mainMockupSrc = "/assets/screenshots/dashboard-overview-mock.png"; // Placeholder
  const subMockup1Src = "/assets/screenshots/snapshot-comparison-mock.png"; // Placeholder
  const subMockup2Src = "/assets/screenshots/code-tracking-mock.png"; // Placeholder
  const subMockup3Src = "/assets/screenshots/version-history-mock.png"; // Placeholder
  const subMockup4Src = "/assets/screenshots/user-dashboard-mock.png"; // Placeholder

  return (
    <section className="relative bg-slate-900 text-white overflow-hidden">
      <div className="container mx-auto px-4 py-20 md:py-32 lg:py-40 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column: Headline, Sub-copy, CTAs */}
          <div className="text-center lg:text-left">
            <div className="inline-block px-3 py-1 text-xs font-medium text-indigo-300 bg-indigo-900/70 rounded-full mb-4">
              Introducing PageLifeline
            </div>
            <h1 
              className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6"
            >
              Never Lose Your <span className="text-indigo-400">Notion</span> Work Again
            </h1>
            <p 
              className="text-lg md:text-xl text-slate-300 max-w-xl mx-auto lg:mx-0 mb-10"
            >
              Capture snapshots of your Notion workspace and track changes over time. Restore previous versions, compare documents, and keep your knowledge safe.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button 
                size="lg" 
                className="text-base px-8 py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg hover:shadow-indigo-500/50 transition-all duration-300 transform hover:scale-105"
                onClick={onPrimaryCtaClick}
              >
                Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                variant="outline"
                size="lg" 
                className="text-base px-8 py-6 text-slate-200 border-slate-700 hover:bg-slate-800 hover:text-white rounded-lg transition-colors duration-300"
                // onClick={() => {/* TODO: Open Demo Modal */}}
              >
                <PlayCircle className="mr-2 h-5 w-5" /> Watch Demo
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-4 text-center lg:text-left">No credit card required.</p>
          </div>

          {/* Right Column: Composite Mockup Images */}
          <div className="hidden lg:block relative mt-12 lg:mt-0">
            <div className="relative w-full max-w-2xl mx-auto">
              {/* Main Dashboard Mockup */}
              <div className="relative z-10 bg-slate-800 border-2 border-slate-700 rounded-lg shadow-2xl overflow-hidden aspect-[16/10]">
                {/* <Image src={mainMockupSrc} alt="PageLifeline Dashboard Preview" layout="fill" objectFit="cover" /> */}
                <div className="w-full h-full bg-slate-700 flex items-center justify-center"><p className="text-slate-500">PageLifeline Dashboard</p></div>
              </div>
              {/* Smaller floating mockups - requires careful positioning */}
              {[subMockup1Src, subMockup2Src, subMockup3Src, subMockup4Src].map((src, index) => (
                <div 
                  key={index} 
                  className={`absolute bg-slate-700 border border-slate-600 rounded-md shadow-xl overflow-hidden aspect-video w-40 h-auto 
                    ${index === 0 ? '-bottom-8 -left-16 z-20' : ''}
                    ${index === 1 ? '-top-10 -right-12 z-0 transform rotate-6' : ''}
                    ${index === 2 ? 'bottom-16 -right-20 z-20 transform -rotate-8' : ''}
                    ${index === 3 ? 'top-1/4 -left-24 z-0 transform rotate-3' : ''}
                  `}
                >
                  {/* <Image src={src} alt={`Feature mockup ${index + 1}`} layout="fill" objectFit="contain" /> */}
                  <div className="w-full h-full bg-slate-600 flex items-center justify-center text-xs p-1"><p className="text-slate-400 text-center">Feature {index+1}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Optional: Add a subtle background pattern or elements if seen in design */}
    </section>
  );
};

export default Hero; 