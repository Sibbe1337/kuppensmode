"use client";

import React from 'react';
import { PlayCircle, Settings2, ArrowRight } from 'lucide-react'; // Icons for video and settings/guide
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
    <div className="flex flex-col items-center text-center p-6 bg-slate-800/70 backdrop-blur-lg rounded-2xl shadow-xl hover:shadow-2xl shadow-black/30 transition-all duration-300 transform hover:-translate-y-1 border border-slate-700/50 hover:border-sky-500/60">
      {/* Thumbnail/Icon Area - Ideal for an actual image/video thumbnail */}
      <div className="w-full aspect-video bg-slate-700/50 rounded-xl mb-6 flex items-center justify-center overflow-hidden">
        {/* Placeholder Icon - replace with actual thumbnail image if available */}
        <Icon className="h-12 w-12 text-sky-400" strokeWidth={1.5}/>
      </div>
      <h3 className="text-xl font-semibold text-slate-50 mb-2">{title}</h3>
      <p className="text-sm text-slate-300 mb-5 flex-grow leading-relaxed">{description}</p>
      <Link href={linkUrl} passHref legacyBehavior>
        <a className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-sky-500 hover:bg-sky-400 rounded-lg transition-colors duration-200 ease-in-out shadow hover:shadow-md">
          {linkLabel} <ArrowRight className="ml-2 h-4 w-4" />
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
    <section className="py-16 sm:py-24 bg-slate-950 border-t border-slate-800/70">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <span className="inline-block px-3.5 py-1.5 text-xs font-semibold text-sky-300 bg-sky-800/50 rounded-full mb-4 shadow-sm">
            Showcase
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-4 text-slate-50 tracking-tight">
            See PageLifeline in <span className="text-sky-400">Action</span>
          </h2>
          <p className="text-lg text-slate-300 leading-relaxed">
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