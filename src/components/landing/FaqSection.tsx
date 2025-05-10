"use client";

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqItemsData = [
  {
    q: "How does PageLifeline protect my Notion data?",
    a: "PageLifeline creates regular, automated snapshots of your selected Notion pages or entire workspace. These snapshots are securely stored, allowing you to restore previous versions in case of accidental deletion, unwanted changes, or data corruption."
  },
  {
    q: "Can I restore just part of a page?",
    a: "Currently, PageLifeline supports restoring entire pages or databases. Granular, block-level restore is a feature on our roadmap for Pro and Enterprise users. You can, however, restore a full page to a new location and then copy the specific content you need."
  },
  {
    q: "How frequently are snapshots taken?",
    a: "The frequency depends on your plan. Our Basic plan offers daily snapshots, while Pro and Enterprise plans provide hourly snapshots and options for custom intervals to ensure your most critical data is captured frequently."
  },
  {
    q: "Does PageLifeline work with all Notion content types?",
    a: "Yes, PageLifeline is designed to work with all standard Notion content types, including pages, databases, text, images, embeds, and more. We continuously update our system to maintain compatibility with Notion's evolving features."
  },
  {
    q: "Can I export my snapshots?",
    a: "Yes, you can download your snapshots as raw JSON data. This gives you an offline copy of your Notion content for archival purposes or if you wish to migrate your data elsewhere."
  }
];

const FaqSection: React.FC = () => {
  return (
    <section className="py-16 sm:py-24 bg-slate-900">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-indigo-300 bg-indigo-900/70 rounded-full mb-3">
            FAQ
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-slate-50 tracking-tight">
            Common Questions
          </h2>
          <p className="text-lg text-slate-400">
            Everything you need to know about PageLifeline.
          </p>
        </div>
        <div className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible className="w-full space-y-3">
            {faqItemsData.map((item, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index + 1}`} 
                className="bg-slate-800 rounded-lg px-6 border border-slate-700 hover:border-indigo-500/50 transition-colors focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/30"
              >
                <AccordionTrigger className="text-left text-lg font-medium text-slate-100 hover:text-indigo-400 hover:no-underline py-5">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-slate-300 pt-0 pb-5 text-sm leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FaqSection; 