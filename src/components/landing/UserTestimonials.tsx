"use client";

import React from 'react';
import { Star } from 'lucide-react';
import Image from 'next/image'; // For user avatars

interface TestimonialCardProps {
  quote: string;
  authorName: string;
  authorRole: string;
  avatarSrc: string; // Placeholder path, e.g., /assets/avatars/user1.png
  rating?: number; // e.g., 5
}

const TestimonialCard: React.FC<TestimonialCardProps> = (
  { quote, authorName, authorRole, avatarSrc, rating = 5 }
) => {
  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-lg flex flex-col h-full border border-slate-700">
      <div className="flex mb-3">
        {[...Array(5)].map((_, i) => (
          <Star 
            key={i} 
            className={`h-5 w-5 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600 fill-slate-600'}`} 
          />
        ))}
      </div>
      <blockquote className="text-slate-300 italic mb-6 flex-grow leading-relaxed">
        " {quote} "
      </blockquote>
      <div className="flex items-center mt-auto">
        {/* Placeholder for avatar */}
        <div className="w-10 h-10 rounded-full bg-slate-700 mr-3 flex items-center justify-center text-slate-400 text-sm overflow-hidden">
          {/* <Image src={avatarSrc} alt={authorName} width={40} height={40} className="rounded-full" /> */}
          {authorName.substring(0,1).toUpperCase()}{authorName.split(' ').pop()?.substring(0,1).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-slate-100 text-sm">{authorName}</p>
          <p className="text-xs text-slate-400">{authorRole}</p>
        </div>
      </div>
    </div>
  );
};

const testimonialsData: TestimonialCardProps[] = [
  {
    quote: "PageLifeline saved my project when I accidentally deleted a critical database. The one-click restore was a lifesaver!",
    authorName: "Sarah K.",
    authorRole: "Product Manager",
    avatarSrc: "/assets/avatars/sarah-k.png", // Placeholder
    rating: 5
  },
  {
    quote: "I run all my company docs in Notion, and PageLifeline gives me peace of mind knowing everything is backed up and retrievable.",
    authorName: "Alex M.",
    authorRole: "Startup Founder",
    avatarSrc: "/assets/avatars/alex-m.png", // Placeholder
    rating: 5
  },
  {
    quote: "The visual diff tool is brilliant. I can see exactly what changed in each document over time – perfect for our documentation workflow.",
    authorName: "Jamie T.",
    authorRole: "Technical Writer",
    avatarSrc: "/assets/avatars/jamie-t.png", // Placeholder
    rating: 5
  }
];

const UserTestimonials: React.FC = () => {
  return (
    <section className="py-16 sm:py-24 bg-slate-950">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-indigo-300 bg-indigo-900/70 rounded-full mb-3">
            Testimonials
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-slate-50 tracking-tight">
            Loved by Notion Power Users
          </h2>
          <p className="text-lg text-slate-400">
            See what our users are saying about PageLifeline.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonialsData.map((testimonial) => (
            <TestimonialCard key={testimonial.authorName} {...testimonial} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default UserTestimonials; 