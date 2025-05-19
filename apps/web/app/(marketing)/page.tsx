"use client";

import React, { useState } from 'react';
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import posthog from 'posthog-js';

// Import all new landing page sections
import Hero from '@/components/landing/Hero';
import FeatureTiles from '@/components/landing/FeatureTiles';
import ShowcaseSection from '@/components/landing/ShowcaseSection';
import IntegrationsSection from '@/components/landing/IntegrationsSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import StatisticsSection from '@/components/landing/StatisticsSection';
import UserTestimonials from '@/components/landing/UserTestimonials';
import PricingSection from '@/components/landing/PricingSection';
import FaqSection from '@/components/landing/FaqSection';
import NewsletterSection from '@/components/landing/NewsletterSection';
import FinalCta from '@/components/landing/FinalCta';
import MarketingFooter from '@/components/landing/MarketingFooter';
//Removed imports like Button, Badge, Switch, loadStripe, useToast as they are now encapsulated in child components or not directly used here.

export default function MarketingPage() {
  const { isSignedIn } = useAuth(); 
  const router = useRouter();

  const handlePrimaryHeroCta = () => {
    posthog.capture('landing_hero_cta_click');
    if (isSignedIn) {
      router.push('/dashboard'); // Or /analytics if that's the new main dashboard
    } else {
      router.push('/sign-up');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-50">
      {/* Render sections in order based on the screenshots */}
      <Hero onPrimaryCtaClick={handlePrimaryHeroCta} />
      <FeatureTiles />
      <ShowcaseSection />
      <IntegrationsSection />
      <HowItWorksSection />
      <StatisticsSection />
      <UserTestimonials />
      <PricingSection />
      <FaqSection />
      <NewsletterSection />
      <FinalCta />
      <MarketingFooter />
    </div>
  );
} 