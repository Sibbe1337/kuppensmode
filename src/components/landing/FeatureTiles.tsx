"use client";

import React from 'react';
import { Zap, ShieldCheck, RotateCcw, Bot, CloudCog, Wind } from 'lucide-react'; // Added more icons for variety

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

interface FeatureTileProps {
  icon: React.ElementType;
  title: string;
  description: string;
  // className?: string; // If using CVA for the card itself
}

const FeatureTile: React.FC<FeatureTileProps> = ({ icon: Icon, title, description }) => {
  return (
    // Using direct Tailwind classes for hover and base style as per prompt description
    // shadow-md on hover, subtle shadow normally. Prompt was "card hover = subtle shadow rgba(0,0,0,.06)"
    // Tailwind's shadow-md is box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    // A custom shadow like 'shadow-[0_2px_10px_rgba(0,0,0,0.06)]' could be used for the subtle hover.
    // For now, using default shadow scaling.
    <div className="flex flex-col items-center p-6 bg-card dark:bg-slate-800/60 rounded-xl shadow-lg hover:shadow-xl dark:hover:shadow-slate-700/50 transition-all duration-300 transform hover:-translate-y-1 border border-border/30 hover:border-primary/50">
      <div className="p-3 bg-primary/10 dark:bg-primary/20 rounded-full mb-5 inline-block ring-4 ring-primary/5 dark:ring-primary/10">
        <Icon className="h-6 w-6 text-primary dark:text-sky-400" strokeWidth={1.5} /> 
      </div>
      <h3 className="text-xl font-semibold mb-2 text-foreground text-center">{title}</h3>
      <p className="text-muted-foreground text-sm text-center leading-relaxed">{description}</p>
    </div>
  );
};

const featuresData = [
  {
    icon: Zap, // Using Zap for speed/automation
    title: "Automated Backups",
    description: "Set it once and forget it. We handle hourly snapshots automatically."
  },
  {
    icon: RotateCcw,
    title: "One-Click Restore",
    description: "Effortlessly revert to any previous version of your pages or databases instantly."
  },
  {
    icon: Bot, // AI icon for smart features
    title: "AI Change Insights",
    description: "Understand what changed with intelligent summaries delivered to your inbox."
  },
  // Adding a few more to make it a 2x3 grid on larger screens if desired, or to choose from
  {
    icon: ShieldCheck,
    title: "Secure & Encrypted",
    description: "Your data is protected with bank-grade encryption, at rest and in transit."
  },
  {
    icon: CloudCog,
    title: "Cloud Agnostic",
    description: "Optionally store backups in your own cloud storage (S3, GCS) for full control."
  },
  {
    icon: Wind, // Lightness/ease of use
    title: "Effortless Setup",
    description: "Connect your Notion workspace in under 60 seconds. No complex configurations."
  }
];

const FeatureTiles: React.FC = () => {
  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-foreground tracking-tight">
            Peace of Mind for Your Notion Data
          </h2>
          <p className="text-lg text-muted-foreground">
            Pagelifeline provides robust, automated protection so you can focus on your work, not on data loss.
          </p>
        </div>
        {/* Responsive grid: 1 col on mobile, 2 on sm, 3 on lg */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Using first 3 features for the 3-column layout as per prompt */}
          {featuresData.slice(0, 3).map((feature, index) => (
            <FeatureTile 
              key={index} 
              icon={feature.icon} 
              title={feature.title} 
              description={feature.description} 
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureTiles; 