"use client";

import React from 'react';
import { Camera, Rows, RotateCcw, History, Check } from 'lucide-react'; // Updated icons

// If class-variance-authority was intended for card variants (e.g. size, style)
// import { cva, type VariantProps } from "class-variance-authority";

// const featureCardVariants = cva(
//   "flex flex-col items-center p-6 bg-card rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1",
//   {
//     variants: {
//       size: {
//         default: "", // Add sizing classes here if needed
//       },
//     },
//     defaultVariants: {
//       size: "default",
//     },
//   }
// );

interface FeatureDetailProps {
  icon: React.ElementType;
  title: string;
  description: string;
  details: string[]; // For bullet points
}

const FeatureDetailCard: React.FC<FeatureDetailProps> = ({ icon: Icon, title, description, details }) => {
  return (
    <div className="flex flex-col p-6 bg-slate-800/70 backdrop-blur-lg rounded-2xl shadow-xl hover:shadow-2xl shadow-black/30 transition-all duration-300 transform hover:-translate-y-1 border border-slate-700/50 hover:border-sky-500/60">
      <div className="flex items-center mb-5">
        <div className="p-2.5 bg-sky-500/10 rounded-xl mr-4 ring-1 ring-sky-500/30">
          <Icon className="h-6 w-6 text-sky-400" strokeWidth={1.5} /> 
        </div>
        <h3 className="text-xl font-semibold text-slate-50">{title}</h3>
      </div>
      <p className="text-slate-300 text-sm mb-5 leading-relaxed flex-grow">{description}</p>
      <ul className="space-y-2.5 text-sm">
        {details.map((detail, index) => (
          <li key={index} className="flex items-start">
            <Check className="h-4 w-4 mr-2.5 mt-0.5 text-sky-400 flex-shrink-0" strokeWidth={2} />
            <span className="text-slate-200">{detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const featuresData: FeatureDetailProps[] = [
  {
    icon: Camera,
    title: "Automated Snapshots",
    description: "Schedule daily, weekly, or custom interval snapshots of your entire Notion workspace.",
    details: [
      "Configure snapshot frequency",
      "Choose specific pages or entire workspaces",
      "Set retention policies"
    ]
  },
  {
    icon: Rows, // Using Rows for Visual Diff, could be BarChartHorizontal or similar
    title: "Visual Diff Comparison",
    description: "See side-by-side comparisons between any two versions of your Notion pages.",
    details: [
      "Highlight what's changed",
      "Track content additions and removals",
      "Compare across time periods"
    ]
  },
  {
    icon: RotateCcw,
    title: "One-Click Restore",
    description: "Instantly restore previous versions of your Notion pages with a single click.",
    details: [
      "Rollback to any snapshot point",
      "Restore specific content blocks (coming soon)",
      "Preview before restoring"
    ]
  },
  {
    icon: History,
    title: "Version History",
    description: "Browse through your complete Notion revision history with powerful search.",
    details: [
      "Timeline view of all changes",
      "Filter by page or date range",
      "Search across all snapshots"
    ]
  }
];

const FeatureTiles: React.FC = () => {
  return (
    <section className="py-16 sm:py-24 bg-slate-900 border-y border-slate-800/70">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <span className="inline-block px-3.5 py-1.5 text-xs font-semibold text-sky-300 bg-sky-800/50 rounded-full mb-4 shadow-sm">Features</span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-4 text-slate-50 tracking-tight">
            Everything you need to track your Notion
          </h2>
          <p className="text-lg text-slate-300 leading-relaxed">
            PageLifeline helps you capture, compare, and restore your Notion workspace with powerful features.
          </p>
        </div>
        {/* Responsive grid: 1 col on mobile, 2 on md */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {featuresData.map((feature, index) => (
            <FeatureDetailCard 
              key={index} 
              icon={feature.icon} 
              title={feature.title} 
              description={feature.description}
              details={feature.details}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureTiles; 