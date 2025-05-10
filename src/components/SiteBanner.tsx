"use client";

import React from 'react';
import { SignedOut } from '@clerk/nextjs';
import { ShieldCheck, Info } from 'lucide-react'; // Using Info as a generic callout icon for now
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Define a basic Callout component structure if not available globally
// This is a simplified version. A shared Callout component would be better if used elsewhere.
interface CalloutProps {
  icon?: React.ElementType;
  text: string;
  linkLabel?: string;
  href?: string;
  variant?: 'info' | 'warning' | 'destructive' | 'success'; // Example variants
  className?: string;
}

const Callout: React.FC<CalloutProps> = ({
  icon: Icon = Info,
  text,
  linkLabel,
  href,
  variant = 'info',
  className,
}) => {
  const baseClasses = "p-4 rounded-md border";
  const variantClasses = {
    info: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-300",
    destructive: "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300",
    success: "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300",
  };

  return (
    <div className={cn(baseClasses, variantClasses[variant], className)}>
      <div className="flex items-center">
        <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
        <div className="flex-grow">
          <p className="text-sm">{text}</p>
          {linkLabel && href && (
            <Link href={href} className="text-sm font-medium hover:underline mt-1 inline-block">
              {linkLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
// End of basic Callout component

const SiteBanner: React.FC = () => {
  return (
    <SignedOut>
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md shadow-sm">
        <div className="container mx-auto max-w-screen-xl px-4">
          <Callout
            icon={ShieldCheck as React.ElementType} // Pass the component directly
            text="All data encrypted at rest • Single-tenant buckets Q3 • SOC-2 underway"
            linkLabel="Security Roadmap"
            href="/security"
            variant="info"
            className="my-2"
          />
        </div>
      </div>
    </SignedOut>
  );
};

export default SiteBanner; 