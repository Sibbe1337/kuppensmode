"use client";

import React from 'react';
import Marquee from "react-fast-marquee";
import Image from 'next/image';
import { useTheme } from 'next-themes'; // Import useTheme
import { cn } from '@/lib/utils'; // Import cn for conditional class names

// Placeholder for actual logo assets. 
// Ensure these paths exist in your /public/assets/logos/ directory.
const logos = [
  { id: 'logo1', name: 'Abstract Corp', src: '/assets/logos/logo-abstract.svg', width: 120, height: 40 },
  { id: 'logo2', name: 'Fusion Dynamics', src: '/assets/logos/logo-fusion.svg', width: 130, height: 35 },
  { id: 'logo3', name: 'QuantumLeap AI', src: '/assets/logos/logo-quantum.svg', width: 140, height: 30 },
  { id: 'logo4', name: 'NextGen Solutions', src: '/assets/logos/logo-nextgen.svg', width: 125, height: 45 },
  { id: 'logo5', name: 'Stellar Ventures', src: '/assets/logos/logo-stellar.svg', width: 110, height: 40 },
  { id: 'logo6', name: 'Momentum Labs', src: '/assets/logos/logo-momentum.svg', width: 135, height: 35 },
];

const SocialProofBar: React.FC = () => {
  const { theme } = useTheme(); // Get current theme

  return (
    <section className="py-12 sm:py-16 bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto px-4">
        <p className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider mb-10">
          Trusted by Innovative Teams Worldwide
        </p>
        <Marquee 
          gradient={true} 
          // Using specific hex values for gradient color that match typical light/dark backgrounds
          gradientColor={theme === 'dark' ? '#0F172A' /* slate-900 */ : '#F8FAFC' /* slate-50 */}
          gradientWidth={100} 
          speed={35} 
          pauseOnHover
        >
          {logos.map((logo) => (
            <div key={logo.id} className="mx-10 md:mx-12 py-2 flex items-center justify-center" title={logo.name}>
              <Image 
                src={logo.src} 
                alt={`${logo.name} logo`} 
                width={logo.width} 
                height={logo.height} 
                className={cn(
                  "transition-all duration-300",
                  "opacity-40 hover:opacity-100 filter grayscale hover:grayscale-0",
                  "dark:opacity-60 dark:hover:opacity-100 dark:filter-none dark:hover:filter-none" // Simpler dark mode: remove grayscale, rely on opacity.
                  // If logos are SVG and can have their color changed by `fill-current`, that's another option.
                  // The prompt specified grayscale and opacity hover, this aims to match that.
                )}
              />
            </div>
          ))}
        </Marquee>
      </div>
    </section>
  );
};

// Need to get theme for gradientColor
const SocialProofBarWrapper: React.FC = () => {
    const [theme, setTheme] = React.useState("light"); // Default or get from useTheme
    React.useEffect(() => {
        // Crude way to get theme if useTheme is not easily usable here
        // or if this component isn't deeply nested in ThemeProvider context from layout
        if (typeof window !== 'undefined' && window.document.documentElement.classList.contains('dark')) {
            setTheme("dark");
        }
    }, []);
    return <SocialProofBar theme={theme} />
}

// This wrapper is a bit of a hack. Ideally, SocialProofBar itself uses useTheme or gets theme via prop from parent.
// For now, let's modify SocialProofBar to accept theme as a prop or use useTheme if available.
// Removing the wrapper for now, and making SocialProofBar use useTheme from next-themes.

export default SocialProofBar; // Will adjust to use useTheme inside SocialProofBar 