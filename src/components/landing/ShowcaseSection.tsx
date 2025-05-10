"use client";

import React from 'react';
import { PlayCircle, Settings2 } from 'lucide-react'; // Icons for video and settings/guide
import Link from 'next/link';

interface ShowcaseCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  linkUrl: string; // Could be a link to a video or a guide page
  linkLabel: string;
}

const ShowcaseCard: React.FC<ShowcaseCardProps> = ({ icon: Icon, title, description, linkUrl, linkLabel }) => {
  return (
    <div className="bg-slate-800 rounded-xl shadow-lg p-6 flex flex-col items-center text-center border border-slate-700 hover:border-indigo-500/50 transition-colors">
      {/* Placeholder for image/video thumbnail */}
      <div className="w-full aspect-video bg-slate-700 rounded-lg mb-6 flex items-center justify-center">
        <Icon className="h-16 w-16 text-slate-500" />
      </div>
      <h3 className="text-xl font-semibold text-slate-100 mb-2">{title}</h3>
      <p className="text-sm text-slate-400 mb-4 flex-grow">{description}</p>
      <Link href={linkUrl} passHref legacyBehavior>
        <a className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
          {linkLabel} &rarr;
        </a>
      </Link>
    </div>
  );
};

const showcaseItems: ShowcaseCardProps[] = [
  {
    icon: PlayCircle,
    title: "Quick Product Tour",
    description: "See how PageLifeline helps you protect your Notion content in just 3 minutes.",
    linkUrl: "#product-tour-video", // Placeholder, link to actual video or modal trigger
    linkLabel: "Watch Video"
  },
  {
    icon: Settings2, // Icon for setup/guide
    title: "Setup Guide",
    description: "Learn how to connect PageLifeline to your Notion workspace in minutes.",
    linkUrl: "/docs/setup-guide", // Placeholder, link to actual guide
    linkLabel: "Read Guide"
  }
];

const ShowcaseSection: React.FC = () => {
  return (
    <section className="py-16 sm:py-24 bg-slate-950">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-indigo-300 bg-indigo-900/70 rounded-full mb-3">
            Showcase
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-slate-50 tracking-tight">
            See PageLifeline in <span className="text-indigo-400">Action</span>
          </h2>
          <p className="text-lg text-slate-400">
            Discover how PageLifeline helps you manage and recover your Notion content.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {showcaseItems.map((item, index) => (
            <ShowcaseCard key={index} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ShowcaseSection; 