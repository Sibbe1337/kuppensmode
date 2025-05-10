"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/apiClient';
import posthog from 'posthog-js'; // Ensure posthog is imported if not already
// Import your new landing page sections here, e.g.:
// import Hero from '@/components/landing/Hero';
// import Features from '@/components/landing/Features';
// import HowItWorks from '@/components/landing/HowItWorks';
// import SocialProof from '@/components/landing/SocialProof';
// import PricingTeaser from '@/components/landing/PricingTeaser';
// import Footer from '@/components/layout/Footer'; // Assuming a shared or new footer

// Added imports from old app/page.tsx that are needed for pricing/checkout
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { loadStripe } from '@stripe/stripe-js';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation"; // Already imported effectively by Next.js
import { useAuth } from "@clerk/nextjs"; // Import useAuth

// Stripe Promise (from old app/page.tsx)
const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY 
    ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    : null;
if (!stripePromise) {
    console.warn('Stripe Publishable Key is not set. Stripe Checkout will not work.');
}

// PricingCard component (simplified from old app/page.tsx, or assume it's moved to components/landing/PricingCard.tsx)
// For now, to resolve errors, let's include a minimal version or props definition.
interface PricingCardProps {
  planName: string;
  price: string;
  priceFrequency?: string;
  features: string[];
  ctaText: string;
  ctaVariant?: any;
  isPrimary?: boolean;
  highlightText?: string;
  badgeText?: string;
  ribbonText?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  seatSelectorElement?: React.ReactNode;
}
const PricingCard: React.FC<PricingCardProps> = ({planName, price, features, ctaText, onCtaClick, seatSelectorElement, isPrimary, badgeText}) => (
    <div className={`p-4 border ${isPrimary ? 'border-blue-500' : 'border-gray-300'}`}> 
        <h3 className="font-bold">{planName} {badgeText && <Badge>{badgeText}</Badge>}</h3> <p>{price}</p> <ul>{features.map(f => <li key={f}>{f}</li>)}</ul> {seatSelectorElement} <Button onClick={onCtaClick}>{ctaText}</Button> 
    </div>
);

export default function MarketingPage() {
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [teamSeatCount, setTeamSeatCount] = useState(1);
  const [isAnnualPricing, setIsAnnualPricing] = useState(false);
  const { toast } = useToast();
  const router = useRouter(); // From next/navigation
  const { isSignedIn } = useAuth(); // Call useAuth to get isSignedIn

  // Stripe Price IDs (from old app/page.tsx)
  const teamsMonthlyPriceId = process.env.NEXT_PUBLIC_PRICE_TEAMS_MONTHLY;
  const teamsAnnualPriceId = process.env.NEXT_PUBLIC_PRICE_TEAMS_ANNUAL;
  const teamsMonthlyPricePerSeat = 2900; // Example value
  const teamsAnnualPricePerSeat = 2400; // Example value

  const handleTeamSeatChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let count = parseInt(event.target.value, 10);
    if (isNaN(count)) count = 1;
    if (count < 1) count = 1;
    if (count > 50) count = 50;
    setTeamSeatCount(count);
  };

  const handleTeamCheckout = async () => {
    if (isCheckingOut) return;
    setIsCheckingOut(true);
    console.log(`Initiating Teams checkout for ${teamSeatCount} seats, annual: ${isAnnualPricing}`);

    const priceId = isAnnualPricing ? teamsAnnualPriceId : teamsMonthlyPriceId;
    if (!priceId) {
        console.error("Stripe Price ID for Teams plan is not configured in environment variables.");
        toast({title: "Configuration Error", description: "Pricing information is currently unavailable. Please try again later.", variant: "destructive"});
        setIsCheckingOut(false);
        return;
    }

    try {
        const { sessionId, error } = await apiClient<{sessionId?: string, error?: string}>('/api/billing/checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                priceId: priceId,
                seats: teamSeatCount,
                billingInterval: isAnnualPricing ? 'year' : 'month',
            }),
        });

        if (error || !sessionId) {
            throw new Error(error || 'Failed to create checkout session (no session ID).');
        }

        console.log('Redirecting to Stripe Checkout with session ID:', sessionId);
        
        if (!stripePromise) {
            throw new Error('Stripe.js is not configured. Publishable key missing.');
        }

        const stripe = await stripePromise;
        if (!stripe) {
            throw new Error('Stripe.js failed to load.');
        }

        const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });

        if (stripeError) {
            console.error("Stripe redirectToCheckout error:", stripeError);
            throw new Error(`Failed to redirect to Stripe: ${stripeError.message}`);
        }

    } catch (err: any) {
        console.error("Checkout initiation failed:", err);
        const message = err.data?.error || err.message || "Checkout failed. Please try again.";
        toast({title: "Checkout Error", description: message, variant: "destructive"});
    } finally {
        setIsCheckingOut(false);
    }
  };

  const primaryCtaAction = () => {
    posthog.capture('landing_cta_click', {
      // cta_text: "Start Free Backup", 
    });

    if (isSignedIn) { 
      router.push('/dashboard');
    } else {
      router.push('/sign-up'); 
    }
  };

  // Placeholder for the rest of the marketing page content using Hero, Features, etc.
  // For now, just rendering a basic structure that would use the PricingCard and handleTeamCheckout
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-grow container mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-center">New Marketing Landing Page</h1>
        <p className="text-center text-muted-foreground mt-4">
          Placeholder for sections: Hero, Features, HowItWorks, SocialProof, PricingTeaser.
        </p>
        <section className="py-16">
            <h2 className="text-2xl font-bold text-center mb-8">Pricing</h2>
            <PricingCard
                planName="Teams"
                price={`$${((isAnnualPricing ? teamsAnnualPricePerSeat : teamsMonthlyPricePerSeat) * teamSeatCount / 100).toFixed(2)}`}
                features={["Feature 1", "Feature 2"]}
                ctaText={isCheckingOut ? "Processing..." : "Checkout Teams Plan"}
                onCtaClick={handleTeamCheckout}
                seatSelectorElement={
                    <div className="my-2">
                        <label htmlFor="seats">Seats: </label>
                        <input type="number" id="seats" value={teamSeatCount} onChange={handleTeamSeatChange} className="border p-1 w-16" />
                    </div>
                }
            />
        </section>
      </main>
    </div>
  );
} 