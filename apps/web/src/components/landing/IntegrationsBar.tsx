"use client";

import React from 'react';
import Image from 'next/image'; // Assuming you might use Next/Image for actual logos

// Placeholder for actual logo assets. Replace with your actual logo paths and dimensions.
const integrationLogos = [
  { id: 'tool1', name: 'Tool One', src: '/assets/integrations/tool1-logo-dark.svg', width: 100, height: 30 },
  { id: 'tool2', name: 'Tool Two', src: '/assets/integrations/tool2-logo-dark.svg', width: 100, height: 30 },
  { id: 'tool3', name: 'Tool Three', src: '/assets/integrations/tool3-logo-dark.svg', width: 100, height: 30 },
  { id: 'tool4', name: 'Tool Four', src: '/assets/integrations/tool4-logo-dark.svg', width: 100, height: 30 },
  { id: 'tool5', name: 'Tool Five', src: '/assets/integrations/tool5-logo-dark.svg', width: 100, height: 30 },
  { id: 'tool6', name: 'Tool Six', src: '/assets/integrations/tool6-logo-dark.svg', width: 100, height: 30 },
];

const IntegrationsBar: React.FC = () => {
  return (
    <section className="py-12 sm:py-16 bg-slate-900"> {/* Slightly different background from Showcase */}
      <div className="container mx-auto px-4">
        <p className="text-center text-sm font-medium text-slate-400 uppercase tracking-wider mb-8">
          SEAMLESSLY INTEGRATES WITH YOUR FAVORITE TOOLS
        </p>
        <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-6">
          {integrationLogos.map((logo) => (
            <div key={logo.id} className="flex items-center justify-center" title={logo.name}>
              {/* Replace with <Image /> component and actual src when assets are available */}
              {/* Using a simple text placeholder for now to match screenshot style */}
              <div className="h-8 w-24 bg-slate-700 rounded flex items-center justify-center text-slate-500 text-xs">
                {/* {logo.name} */}
              </div>
              {/* <Image 
                src={logo.src} 
                alt={`${logo.name} logo`} 
                width={logo.width} 
                height={logo.height} 
                className="opacity-70 hover:opacity-100 transition-opacity duration-300 filter grayscale dark:brightness-0 dark:invert"
              /> */}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default IntegrationsBar; 