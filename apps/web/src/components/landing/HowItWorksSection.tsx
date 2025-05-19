"use client";

import React from 'react';
import { PlugZap, Settings, DatabaseZap, ArrowRight } from 'lucide-react'; // Added ArrowRight
import { Button } from "@/components/ui/button"; // Ensured Button is imported

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
    <div className="flex flex-col items-center text-center bg-slate-800/70 backdrop-blur-lg p-6 rounded-2xl shadow-xl hover:shadow-2xl shadow-black/30 border border-slate-700/50 hover:border-sky-500/60 transition-all duration-300 transform hover:-translate-y-1">
      <div className="flex items-center justify-center w-10 h-10 mb-6 bg-sky-500 text-white rounded-full text-lg font-semibold ring-2 ring-sky-500/40">
        {stepNumber}
      </div>
      <h3 className="text-xl font-semibold text-slate-50 mb-3">{title}</h3>
      {/* Placeholder for image - Replace with actual illustrative image */}
      <div className="w-full h-32 bg-slate-700/50 rounded-lg mb-4 flex items-center justify-center text-slate-400 text-sm">
        {imagePlaceholderText}
      </div>
      <p className="text-sm text-slate-300 mb-5 leading-relaxed flex-grow">{description}</p>
      <Button variant="link" className="text-sky-400 hover:text-sky-300 font-medium p-0 h-auto">
        {actionText} <ArrowRight className="inline ml-1.5 h-4 w-4" />
      </Button>
    </div>
  );
};

const stepsData: HowItWorksStepProps[] = [
  {
    stepNumber: "1",
    title: "Connect",
    imagePlaceholderText: "Illustrative: Notion API Connected",
    description: "Link your Notion account with PageLifeline using our secure OAuth integration.",
    actionText: "Link your Notion",
  },
  {
    stepNumber: "2",
    title: "Configure",
    imagePlaceholderText: "Illustrative: Settings Panel",
    description: "Select which pages to track and set your preferred snapshot frequency.",
    actionText: "Choose Settings",
  },
  {
    stepNumber: "3",
    title: "Capture",
    imagePlaceholderText: "Illustrative: Snapshots Progress",
    description: "Sit back as PageLifeline automatically captures your Notion content on schedule.",
    actionText: "View Snapshots", 
  },
];

const HowItWorksSection: React.FC = () => {
  return (
    <section className="py-16 sm:py-24 bg-slate-950 border-t border-slate-800/70">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <span className="inline-block px-3.5 py-1.5 text-xs font-semibold text-sky-300 bg-sky-800/50 rounded-full mb-4 shadow-sm">
            Simple Process
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-4 text-slate-50 tracking-tight">
            How PageLifeline Works
          </h2>
          <p className="text-lg text-slate-300 leading-relaxed">
            Get started in minutes with our seamless integration process.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {stepsData.map((step) => (
            <HowItWorksStepCard key={step.stepNumber} {...step} />
          ))}
        </div>

        {/* Central larger placeholder image - Replace with a compelling dashboard/feature screenshot */}
        <div className="max-w-3xl mx-auto">
          <div className="aspect-[16/9] bg-slate-800/70 backdrop-blur-lg border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/50 flex items-center justify-center p-6">
            <div className="text-center">
              {/* Using Settings as a generic placeholder; ideally a product screenshot */}
              <Settings className="h-20 w-20 text-sky-500/70 mx-auto mb-4" strokeWidth={1.5} /> 
              <p className="text-slate-400 text-lg font-medium">Seamlessly Integrated Experience</p>
              <p className="text-sm text-slate-500 mt-1">Full dashboard preview coming soon.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection; 