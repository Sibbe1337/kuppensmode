"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
// Link component is not used in the provided snippet, but keeping it if needed elsewhere or for future.
// import Link from 'next/link'; 
import { ArrowRight, PlayCircle } from 'lucide-react';

interface HeroProps {
  onPrimaryCtaClick: () => void;
}

const Hero: React.FC<HeroProps> = ({ onPrimaryCtaClick }) => {
  const mainMockupSrc = "/assets/screenshots/dashboard-overview-mock.png"; // Placeholder for actual image
  const subMockup1Src = "/assets/screenshots/snapshot-comparison-mock.png"; // Placeholder
  const subMockup2Src = "/assets/screenshots/code-tracking-mock.png";       // Placeholder
  const subMockup3Src = "/assets/screenshots/version-history-mock.png";     // Placeholder
  const subMockup4Src = "/assets/screenshots/user-dashboard-mock.png";      // Placeholder

  return (
    <section className="relative bg-gradient-to-br from-slate-900 to-slate-950 text-slate-100 overflow-hidden">
      <div className="container mx-auto px-4 py-24 md:py-36 lg:py-48 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Column: Headline, Sub-copy, CTAs */}
          <div className="text-center lg:text-left">
            <div className="inline-block px-3.5 py-1.5 text-xs font-medium text-sky-300 bg-sky-800/50 rounded-full mb-5 shadow-sm">
              Introducing PageLifeline
            </div>
            <h1 
              className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight mb-6 text-slate-50"
            >
              Never Lose Your <span className="text-sky-400">Notion</span> Work Again
            </h1>
            <p 
              className="text-lg md:text-xl text-slate-300 max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed"
            >
              Capture snapshots of your Notion workspace and track changes over time. Restore previous versions, compare documents, and keep your knowledge safe.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button 
                size="lg" 
                className="text-base font-semibold px-8 py-4 bg-sky-500 hover:bg-sky-400 text-white rounded-xl shadow-md hover:shadow-lg hover:shadow-sky-500/30 transition-all duration-200 ease-in-out transform hover:scale-105"
                onClick={onPrimaryCtaClick}
              >
                Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                variant="outline"
                size="lg" 
                className="text-base font-medium px-8 py-4 text-slate-100 bg-slate-700/30 hover:bg-slate-700/50 backdrop-blur-md border-slate-600/70 hover:border-slate-500/70 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 ease-in-out"
                // onClick={() => {/* TODO: Open Demo Modal */}}
              >
                <PlayCircle className="mr-2 h-5 w-5" /> Watch Demo
              </Button>
            </div>
            <p className="text-xs font-medium text-slate-400 mt-5 text-center lg:text-left">No credit card required.</p>
          </div>

          {/* Right Column: Composite Mockup Images */}
          <div className="hidden lg:block relative mt-12 lg:mt-0">
            <div className="relative w-full max-w-2xl mx-auto">
              {/* Main Dashboard Mockup */}
              <div className="relative z-10 bg-slate-800/70 backdrop-blur-lg border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden aspect-[16/10]">
                {/* Replace div with actual <Image /> component when ready */}
                <div className="w-full h-full bg-slate-700/30 flex items-center justify-center">
                  <p className="text-slate-400 text-lg">PageLifeline Dashboard Mockup</p>
                </div>
              </div>
              {/* Smaller floating mockups - requires careful positioning and actual images */}
              {[subMockup1Src, subMockup2Src, subMockup3Src, subMockup4Src].map((src, index) => (
                <div 
                  key={index} 
                  className={`absolute bg-slate-700/50 backdrop-blur-md border border-slate-600/50 rounded-lg shadow-xl overflow-hidden aspect-video w-44 h-auto 
                    ${index === 0 ? '-bottom-10 -left-20 z-20 transform -rotate-3' : ''}
                    ${index === 1 ? '-top-12 -right-16 z-0 transform rotate-6' : ''}
                    ${index === 2 ? 'bottom-20 -right-24 z-20 transform -rotate-8' : ''}
                    ${index === 3 ? 'top-1/4 -left-28 z-0 transform rotate-4' : ''}
                  `}
                  style={{ width: '180px'}} // Example fixed width for better control of aspect ratio for sub-mockups
                >
                  {/* Replace div with actual <Image /> component when ready */}
                  <div className="w-full h-full bg-slate-600/30 flex items-center justify-center text-xs p-2">
                    <p className="text-slate-300 text-center">Feature Mockup {index+1}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero; 