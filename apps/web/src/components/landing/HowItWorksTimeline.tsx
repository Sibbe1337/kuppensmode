"use client";

import React from 'react';
import { Edit3, Camera, MailCheck, RotateCcw } from 'lucide-react';
// For animations, one might use Framer Motion, but keeping it static for now as per prompt's primary focus.
// import { motion } from 'framer-motion'; 

interface TimelineStepProps {
  stepNumber: number;
  title: string;
  description: string;
  icon: React.ElementType;
  isLast?: boolean;
}

const TimelineStep: React.FC<TimelineStepProps> = ({ stepNumber, title, description, icon: Icon, isLast }) => {
  return (
    // Each step approx 48px apart vertically due to connector height + item padding
    <div className="flex items-start pl-4">
      {/* Numbered Circle & Dashed Connector */}
      <div className="flex flex-col items-center mr-6 rtl:mr-0 rtl:ml-6">
        <div 
          className="flex items-center justify-center h-12 w-12 rounded-full bg-indigo-600 text-white font-semibold border-4 border-background shadow-md"
        >
          {stepNumber}
        </div>
        {!isLast && 
          <div 
            className="w-px h-12 border-l-2 border-dashed border-indigo-400 dark:border-indigo-500/70 my-2"
            // style={{ height: '48px' }} // explicit height to ensure 48px gap if content varies
          ></div>
        }
      </div>
      {/* Content: Title & Description */}
      <div className="pt-2 pb-6 flex-1">
        <div className="flex items-center mb-1.5">
            {/* Icon can be used if desired, prompt focused on numbered circles */}
            {/* <Icon className="h-5 w-5 text-indigo-600 mr-2" /> */}
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
};

const timelineData = [
  { 
    icon: Edit3, // Icon not directly used in this visual, but good for data structure
    title: "Connect & Configure", 
    description: "Securely link your Notion workspace in seconds. Choose your backup frequency and preferences with our simple setup wizard." 
  },
  {
    icon: Camera, 
    title: "Automatic Snapshots", 
    description: "Relax as we automatically capture snapshots of your entire workspace. Your data is saved regularly without any manual effort."
  },
  {
    icon: RotateCcw,
    title: "Restore with Confidence",
    description: "Easily browse snapshot versions and restore any page or database. Get your critical information back in just a few clicks."
  },
  // Example for a 4th step if needed, but prompt mentioned 3-step
  // {
  //   icon: MailCheck,
  //   title: "Stay Informed", 
  //   description: "Receive optional email summaries of changes or backup status. Always know your data is safe and what has been updated."
  // },
];

const HowItWorksTimeline: React.FC = () => {
  return (
    <section className="py-16 sm:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-foreground tracking-tight">Simple Steps to Secure Your Notion</h2>
            <p className="text-lg text-muted-foreground">
                Start protecting your valuable workspace in minutes.
            </p>
        </div>
        <div className="max-w-md mx-auto">
          {/* Rendering 3 steps as per prompt */}
          {timelineData.slice(0, 3).map((step, index) => (
            <TimelineStep 
              key={index} 
              stepNumber={index + 1} 
              title={step.title} 
              description={step.description} 
              icon={step.icon} // Icon data is passed but not rendered in TimelineStep per current design
              isLast={index === timelineData.slice(0, 3).length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksTimeline; 