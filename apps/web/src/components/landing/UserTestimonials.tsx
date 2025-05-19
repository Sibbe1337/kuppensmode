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
    <div className="flex flex-col h-full p-6 bg-slate-800/70 backdrop-blur-lg rounded-2xl shadow-xl hover:shadow-2xl shadow-black/30 transition-all duration-300 transform hover:-translate-y-1 border border-slate-700/50 hover:border-sky-500/60">
      <div className="flex mb-4">
        {[...Array(5)].map((_, i) => (
          <Star 
            key={i} 
            className={`h-5 w-5 ${i < rating ? 'text-yellow-400 fill-yellow-400/70' : 'text-slate-600 fill-slate-700/50'}`} 
            strokeWidth={1.5}
          />
        ))}
      </div>
      <blockquote className="text-slate-200 italic text-md mb-6 flex-grow leading-relaxed">
        {/* Using CSS pseudo-elements for quotes can be an option for more decorative quotes */}
        &ldquo;{quote}&rdquo;
      </blockquote>
      <div className="flex items-center mt-auto pt-4 border-t border-slate-700/50">
        {/* Replace div with actual <Image /> component when ready and avatarSrc is valid */}
        <div className="w-10 h-10 rounded-full bg-slate-700/80 mr-3 flex items-center justify-center text-slate-200 text-sm font-medium overflow-hidden flex-shrink-0">
          {avatarSrc && avatarSrc !== '/assets/avatars/default.png' ? (
            <Image src={avatarSrc} alt={authorName} width={40} height={40} className="rounded-full object-cover" />
          ) : (
            <>{authorName.substring(0,1).toUpperCase()}{authorName.split(' ').length > 1 ? authorName.split(' ').pop()?.substring(0,1).toUpperCase() : ''}</>
          )}
        </div>
        <div>
          <p className="font-medium text-slate-100 text-sm">{authorName}</p>
          <p className="text-xs text-slate-300">{authorRole}</p>
        </div>
      </div>
    </div>
  );
};

const testimonialsData: TestimonialCardProps[] = [
  {
    quote: "PageLifeline saved my project when I accidentally deleted a critical database. The one-click restore was a lifesaver!",
    authorName: "Sarah K.",
    authorRole: "Product Manager @ TechCorp",
    avatarSrc: "/assets/avatars/sarah-k.png", 
    rating: 5
  },
  {
    quote: "I run all my company docs in Notion, and PageLifeline gives me peace of mind knowing everything is backed up and retrievable.",
    authorName: "Alex Maxwell", // Full name example
    authorRole: "Startup Founder, Innovate Ltd.",
    avatarSrc: "/assets/avatars/alex-m.png",
    rating: 5
  },
  {
    quote: "The visual diff tool is brilliant. I can see exactly what changed in each document over time – perfect for our documentation workflow.",
    authorName: "Jamie T.",
    authorRole: "Lead Technical Writer, DocuPros",
    avatarSrc: "/assets/avatars/jamie-t.png", 
    rating: 5
  }
];

const UserTestimonials: React.FC = () => {
  return (
    <section className="py-16 sm:py-24 bg-slate-950 border-t border-slate-800/70">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <span className="inline-block px-3.5 py-1.5 text-xs font-semibold text-sky-300 bg-sky-800/50 rounded-full mb-4 shadow-sm">
            Testimonials
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-4 text-slate-50 tracking-tight">
            Loved by Notion Power Users
          </h2>
          <p className="text-lg text-slate-300 leading-relaxed">
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