"use client";

import React, { useState } from 'react';

// Define types for props if any, or for data used internally
const integrations = [
  {
    name: "Notion",
    logo: "/logos/notion-svgrepo-com.svg",
    status: "LIVE" as const, // Use const assertion for stricter typing
    tooltip: "Core datasource today – sets context for everything that follows.",
  },
  {
    name: "Google Cloud Storage",
    logo: "/logos/google-cloud-svgrepo-com.svg",
    status: "LIVE" as const,
    tooltip: "Cross-cloud backup; logo is instantly recognisable by infra buyers.",
  },
  {
    name: "AWS S3",
    logo: "/logos/aws-svgrepo-com.svg",
    status: "LIVE" as const,
    tooltip: "Backup snapshots directly to S3.",
  },
  {
    name: "Cloudflare R2",
    logo: "/logos/cloudflare-svgrepo-com.svg",
    status: "LIVE" as const,
    tooltip: "Differentiates you from most Notion tools; indie/cost-savvy teams love it.",
  },
  {
    name: "Slack",
    logo: "/logos/slack-svgrepo-com.svg",
    status: "BETA" as const,
    tooltip: "Send diff alerts to Slack (coming soon).",
  },
  {
    name: "Figma",
    logo: "/logos/figma-svgrepo-com.svg",
    status: "COMING SOON" as const,
    tooltip: "Planned integration – tell us if you need this next!",
  },
  {
    name: "GitHub",
    logo: "/logos/github-color-svgrepo-com.svg",
    status: "LIVE" as const,
    tooltip: "Beyond Git: snapshot real-time state of your repos.",
  },
  {
    name: "Google Docs / Word",
    logo: "/logos/google-drive-svgrepo-com.svg",
    status: "LIVE" as const,
    tooltip: "Never lose a thesis (or client contract) again.",
  },
];

const StatusPill = ({ status }: { status: "LIVE" | "BETA" | "COMING SOON" }) => {
  const color =
    status === "LIVE"
      ? "bg-green-600 text-white"
      : status === "BETA"
      ? "bg-yellow-500 text-black" // Adjusted for better contrast if yellow is light
      : "bg-slate-600 text-slate-100";
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${color}`}>{status}</span>
  );
};

const Tooltip = ({ content, children }: { content: string; children: React.ReactNode }) => {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative group"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span 
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 
                     bg-slate-800 text-slate-100 text-xs rounded-md shadow-lg p-2.5 z-20 
                     opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out"
        >
          {content}
        </span>
      )}
    </span>
  );
};

const IntegrationsSection: React.FC = () => {
  const handleRequestIntegration = () => {
    if (typeof window !== "undefined" && (window as any).posthog) {
      (window as any).posthog.capture("request_integration_clicked");
    }
    // Consider a more user-friendly way to request, e.g., a form or dedicated page
    window.open("mailto:support@yourdomain.com?subject=Request%20an%20integration", "_blank");
  };

  return (
    // Will apply macOS polish in the next step
    <section className="py-16 sm:py-24 bg-slate-950 border-y border-slate-800/70">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-4 text-slate-50 tracking-tight">
            Works With Your Favorite Tools
          </h2>
          <p className="text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Connect PageLifeline with the services you already rely on for a seamless workflow.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-10 justify-items-center mb-12">
          {integrations.map((integration) => (
            <Tooltip key={integration.name} content={integration.tooltip}>
              <div className="flex flex-col items-center w-32 p-4 bg-slate-800/50 rounded-xl shadow-lg hover:shadow-sky-500/20 border border-slate-700/50 hover:border-sky-500/50 transition-all duration-200 ease-in-out transform hover:-translate-y-1 cursor-default">
                <img 
                  src={integration.logo} 
                  alt={`${integration.name} logo`} 
                  className="h-12 w-12 mb-3 object-contain" // Ensure logos are scaled well
                />
                <span className="font-medium text-sm text-slate-100 mb-1.5 text-center block truncate w-full">{integration.name}</span>
                <StatusPill status={integration.status} />
              </div>
            </Tooltip>
          ))}
        </div>

        <div className="text-center">
          <button 
            onClick={handleRequestIntegration}
            className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-sky-500 hover:bg-sky-400 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105"
          >
            Request an Integration
          </button>
          <p className="text-sm text-slate-400 mt-4">
            Don't see your tool? Let us know and we'll consider it for our roadmap.
          </p>
        </div>
      </div>
    </section>
  );
};

export default IntegrationsSection; 