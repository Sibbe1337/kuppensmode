"use client";

import React from 'react';
import { PlugZap, Settings, DatabaseZap } from 'lucide-react'; // Example icons

interface HowItWorksStepProps {
  stepNumber: string;
  title: string;
  description: string;
  actionText: string;
  // icon: React.ElementType; // Icon for the step itself, if needed beyond number
  imagePlaceholderText: string; // Text for the placeholder image box
}

const HowItWorksStepCard: React.FC<HowItWorksStepProps> = (
  { stepNumber, title, description, actionText, imagePlaceholderText }
) => {
  return (
    <div className="flex flex-col items-center text-center bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700">
      <div className="flex items-center justify-center w-12 h-12 mb-6 bg-indigo-600 text-white rounded-full text-xl font-bold ring-4 ring-indigo-600/30">
        {stepNumber}
      </div>
      <h3 className="text-xl font-semibold text-slate-100 mb-2">{title}</h3>
      {/* Placeholder for image */}
      <div className="w-full h-32 bg-slate-700 rounded-md mb-4 flex items-center justify-center text-slate-500 text-sm">
        {imagePlaceholderText}
      </div>
      <p className="text-sm text-slate-400 mb-4 leading-relaxed flex-grow">{description}</p>
      <Button variant="link" className="text-indigo-400 hover:text-indigo-300 p-0">
        {actionText}
      </Button>
    </div>
  );
};

const stepsData: HowItWorksStepProps[] = [
  {
    stepNumber: "1",
    title: "Connect",
    imagePlaceholderText: "Connect Notion API",
    description: "Link your Notion account with PageLifeline using our secure OAuth integration.",
    actionText: "Link your Notion account",
  },
  {
    stepNumber: "2",
    title: "Configure",
    imagePlaceholderText: "Settings Dashboard",
    description: "Select which pages to track and set your preferred snapshot frequency.",
    actionText: "Select pages & frequency",
  },
  {
    stepNumber: "3",
    title: "Capture",
    imagePlaceholderText: "Automatic Snapshots",
    description: "Sit back as PageLifeline automatically captures your Notion content on schedule.",
    actionText: "View snapshot history",
  },
];

const HowItWorksSection: React.FC = () => {
  return (
    <section className="py-16 sm:py-24 bg-slate-950">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-indigo-300 bg-indigo-900/70 rounded-full mb-3">
            Simple Process
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-slate-50 tracking-tight">
            How PageLifeline Works
          </h2>
          <p className="text-lg text-slate-400">
            Get started in minutes with our seamless integration process.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {stepsData.map((step) => (
            <HowItWorksStepCard key={step.stepNumber} {...step} />
          ))}
        </div>

        {/* Central larger placeholder image */}
        <div className="max-w-2xl mx-auto">
          <div className="aspect-[16/9] bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex items-center justify-center">
            <div className="text-center">
              <Settings className="h-16 w-16 text-slate-600 mx-auto mb-2" /> {/* Placeholder icon */}
              <p className="text-slate-500">PageLifeline Dashboard Interface Preview</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Need to import Button if not already imported at the top
import { Button } from "@/components/ui/button";

export default HowItWorksSection; 