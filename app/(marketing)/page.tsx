"use client";

import React, { useState } from 'react';
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import posthog from 'posthog-js';

// Import all new landing page sections
import Hero from '@/components/landing/Hero';
import FeatureTiles from '@/components/landing/FeatureTiles';
import ShowcaseSection from '@/components/landing/ShowcaseSection';
import IntegrationsBar from '@/components/landing/IntegrationsBar';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import StatisticsSection from '@/components/landing/StatisticsSection';
import UserTestimonials from '@/components/landing/UserTestimonials';
import PricingSection from '@/components/landing/PricingSection';
import FaqSection from '@/components/landing/FaqSection';
import NewsletterSection from '@/components/landing/NewsletterSection';
import FinalCta from '@/components/landing/FinalCta';
import MarketingFooter from '@/components/landing/MarketingFooter';
//Removed imports like Button, Badge, Switch, loadStripe, useToast as they are now encapsulated in child components or not directly used here.

const integrations = [
  {
    name: "Notion",
    logo: "/logos/notion-svgrepo-com.svg",
    status: "LIVE",
    tooltip: "Core datasource today – sets context for everything that follows.",
  },
  {
    name: "Google Cloud Storage",
    logo: "/logos/google-cloud-svgrepo-com.svg",
    status: "LIVE",
    tooltip: "Cross-cloud backup; logo is instantly recognisable by infra buyers.",
  },
  {
    name: "AWS S3",
    logo: "/logos/aws-svgrepo-com.svg",
    status: "LIVE",
    tooltip: "Backup snapshots directly to S3.",
  },
  {
    name: "Cloudflare R2",
    logo: "/logos/cloudflare-svgrepo-com.svg",
    status: "LIVE",
    tooltip: "Differentiates you from most Notion tools; indie/cost-savvy teams love it.",
  },
  {
    name: "Slack",
    logo: "/logos/slack-svgrepo-com.svg",
    status: "BETA",
    tooltip: "Send diff alerts to Slack (coming soon).",
  },
  {
    name: "Figma",
    logo: "/logos/figma-svgrepo-com.svg",
    status: "COMING SOON",
    tooltip: "Planned integration – tell us if you need this next!",
  },
  {
    name: "GitHub",
    logo: "/logos/github-color-svgrepo-com.svg",
    status: "LIVE",
    tooltip: "Beyond Git: snapshot real-time state of your repos.",
  },
  {
    name: "Google Docs / Word",
    logo: "/logos/google-drive-svgrepo-com.svg",
    status: "LIVE",
    tooltip: "Never lose a thesis (or client contract) again.",
  },
];

const StatusPill = ({ status }: { status: "LIVE" | "BETA" | "COMING SOON" }) => {
  const color =
    status === "LIVE"
      ? "bg-green-600 text-white"
      : status === "BETA"
      ? "bg-amber-500 text-white"
      : "bg-gray-500 text-white";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${color}`}>{status}</span>
  );
};

const Tooltip = ({ content, children }: { content: string; children: React.ReactNode }) => {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span className="absolute z-10 left-1/2 -translate-x-1/2 mt-2 w-48 bg-slate-800 text-slate-100 text-xs rounded shadow-lg p-2">
          {content}
        </span>
      )}
    </span>
  );
};

function IntegrationsSection() {
  const handleRequestIntegration = () => {
    if (typeof window !== "undefined" && (window as any).posthog) {
      (window as any).posthog.capture("request_integration_clicked");
    }
    window.open("mailto:support@yourdomain.com?subject=Request%20an%20integration", "_blank");
  };
  return (
    <section className="py-16 bg-slate-950 text-center">
      <h2 className="text-2xl font-bold mb-8">Works with the tools you already use</h2>
      <div className="flex flex-wrap justify-center gap-8 mb-6">
        {integrations.map((integration) => (
          <Tooltip key={integration.name} content={integration.tooltip}>
            <div className="flex flex-col items-center w-32">
              <img src={integration.logo} alt={integration.name} className="h-10 mb-2" />
              <span className="font-semibold mb-1">{integration.name}</span>
              <StatusPill status={integration.status as any} />
            </div>
          </Tooltip>
        ))}
      </div>
      <button className="btn-primary mt-4" onClick={handleRequestIntegration}>
        Need something else? → Request an integration
      </button>
      <div className="text-xs text-gray-400 mt-2">
        <span className="underline cursor-help" title="Planned integrations – tell us which one you need next.">
          Roadmap
        </span>
      </div>
    </section>
  );
}

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