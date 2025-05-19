"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const FinalCta: React.FC = () => {
  return (
    <section className="py-20 sm:py-32 bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 text-white">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6">
          Ready to Safeguard Your Notion Workspace?
        </h2>
        <p className="text-lg md:text-xl text-indigo-100 max-w-2xl mx-auto mb-10">
          Join thousands of Notion users who never worry about losing their work. 
          Get started with automated backups today.
        </p>
        <Button 
          size="lg" 
          className="text-lg px-10 py-6 bg-white hover:bg-slate-100 text-indigo-700 rounded-lg shadow-2xl 
                     font-semibold transition-all duration-300 transform hover:scale-105 focus:ring-4 focus:ring-indigo-300"
          asChild
        >
          <Link href="/sign-up"> {/* Or primary CTA action from parent */}
            Start Your Free Trial <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
        <p className="text-sm text-indigo-200 mt-4">No credit card required. 14-day free trial.</p>
      </div>
    </section>
  );
};

export default FinalCta; 