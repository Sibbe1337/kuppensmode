"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CheckCircle } from 'lucide-react';
import apiClient from '@/lib/apiClient';
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from '@stripe/stripe-js';
import Link from 'next/link'; // For Free plan CTA
import { cn } from "@/lib/utils";

// Re-using the Stripe Promise initialization logic if needed here, or assume it's handled by a parent context/provider
const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY 
    ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    : null;

interface PricingCardProps {
  planName: string;
  price: string;
  priceFrequency?: string;
  features: string[];
  ctaText: string;
  ctaVariant?: "default" | "outline" | "secondary" | "ghost" | "link" | string;
  isPrimary?: boolean;
  highlightText?: string;
  badgeText?: string;
  ribbonText?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  seatSelectorElement?: React.ReactNode;
  disabled?: boolean;
}

const PricingCard: React.FC<PricingCardProps> = ({
  planName, price, priceFrequency = "/mo", features, ctaText, ctaVariant = "default",
  isPrimary, highlightText, badgeText, ribbonText, ctaHref, onCtaClick, seatSelectorElement, disabled
}) => {
  return (
    <div className={cn(
      "relative p-6 md:p-8 rounded-xl flex flex-col border shadow-lg hover:shadow-xl transition-all duration-300",
      isPrimary ? 
        'bg-primary text-primary-foreground border-primary/70 ring-2 ring-offset-4 ring-offset-background ring-primary/70' : 
        'bg-card text-card-foreground border-border'
    )}>
      {highlightText && (
        <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full ${isPrimary ? 'bg-background text-foreground' : 'bg-primary text-primary-foreground'}`}>
          {highlightText}
        </div>
      )}
      {badgeText && (
         <div className="flex justify-center mb-3 mt-3"> 
            <Badge variant={isPrimary ? "secondary" : "default"} className={isPrimary ? "bg-background text-primary" : ""}> 
                {badgeText}
            </Badge>
         </div>
      )}
      <h3 className={`text-2xl font-semibold text-center ${isPrimary ? '' : 'text-foreground'}`}>{planName}</h3>
      <div className="my-4 text-center">
        <span className={`text-5xl font-bold ${isPrimary ? '' : 'text-foreground'}`}>{price}</span>
        {price !== "Free" && <span className={`text-sm ${isPrimary ? 'opacity-80' : 'text-muted-foreground'}`}>{priceFrequency}</span>}
      </div>
      <ul className="space-y-2.5 mb-8 text-sm flex-grow">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <CheckCircle className={`h-5 w-5 mr-2.5 flex-shrink-0 ${isPrimary ? 'opacity-80' : 'text-primary'}`} />
            <span className={`${isPrimary ? '' : 'text-muted-foreground'}`}>{feature}</span>
          </li>
        ))}
      </ul>
      {seatSelectorElement}
      {onCtaClick ? (
          <Button variant={ctaVariant as any} size="lg" onClick={onCtaClick} className={`w-full mt-auto ${isPrimary ? 'bg-background text-primary hover:bg-background/90' : '' }`} disabled={disabled}>
              {ctaText}
          </Button>
      ) : (
          <Button asChild variant={ctaVariant as any} size="lg" className={`w-full mt-auto ${isPrimary ? 'bg-background text-primary hover:bg-background/90' : '' }`} disabled={disabled}>
              <Link href={ctaHref || '#'}>{ctaText}</Link>
          </Button>
      )}
      {ribbonText && (
          <p className={`mt-4 text-xs text-center ${isPrimary ? 'opacity-80' : 'text-muted-foreground'}`}>{ribbonText}</p>
      )}
    </div>
  );
};

const PricingSection: React.FC = () => {
  const [isAnnualPricing, setIsAnnualPricing] = useState(false);
  const [teamSeatCount, setTeamSeatCount] = useState(1);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const { toast } = useToast();

  // These should ideally come from a centralized config or env variables
  const proMonthlyPriceId = process.env.NEXT_PUBLIC_PRICE_PRO_MONTHLY || 'price_pro_monthly_placeholder';
  const proAnnualPriceId = process.env.NEXT_PUBLIC_PRICE_PRO_ANNUAL || 'price_pro_annual_placeholder';
  const teamsMonthlyPriceId = process.env.NEXT_PUBLIC_PRICE_TEAMS_MONTHLY || 'price_teams_monthly_placeholder';
  const teamsAnnualPriceId = process.env.NEXT_PUBLIC_PRICE_TEAMS_ANNUAL || 'price_teams_annual_placeholder';
  
  const proPriceMonthly = 9;
  const proPriceAnnual = 7.5;
  const teamsPricePerSeatMonthly = 29;
  const teamsPricePerSeatAnnual = 24;

  const handleTeamSeatChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let count = parseInt(event.target.value, 10);
    if (isNaN(count) || count < 1) count = 1;
    if (count > 50) count = 50; // Max seats example
    setTeamSeatCount(count);
  };

  const handleCheckout = async (planType: 'pro' | 'teams') => {
    if (isCheckingOut) return;
    setIsCheckingOut(true);

    let priceId: string | undefined;
    let quantity = 1;

    if (planType === 'pro') {
      priceId = isAnnualPricing ? proAnnualPriceId : proMonthlyPriceId;
    } else if (planType === 'teams') {
      priceId = isAnnualPricing ? teamsAnnualPriceId : teamsMonthlyPriceId;
      quantity = teamSeatCount;
    }

    if (!priceId) {
      console.error(`Stripe Price ID for ${planType} plan (annual: ${isAnnualPricing}) is not configured.`);
      toast({title: "Configuration Error", description: "Pricing information is currently unavailable.", variant: "destructive"});
      setIsCheckingOut(false);
      return;
    }

    try {
      const { sessionId, error } = await apiClient<{sessionId?: string, error?: string}>('/api/billing/checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              priceId: priceId,
              seats: planType === 'teams' ? quantity : undefined, // Only send seats for teams plan
              billingInterval: isAnnualPricing ? 'year' : 'month',
          }),
      });

      if (error || !sessionId) {
          throw new Error(error || 'Failed to create checkout session.');
      }
      if (!stripePromise) throw new Error('Stripe.js is not configured.');
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe.js failed to load.');
      const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });
      if (stripeError) throw new Error(`Failed to redirect to Stripe: ${stripeError.message}`);

    } catch (err: any) {
      console.error("Checkout initiation failed:", err);
      const message = err.data?.error || err.message || "Checkout failed. Please try again.";
      toast({title: "Checkout Error", description: message, variant: "destructive"});
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <section className="py-16 sm:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">Simple, Transparent Pricing</h2>
          <p className="text-muted-foreground">Choose the plan that's right for you. Cancel anytime.</p>
        </div>

        <div className="flex justify-center items-center mb-10">
          <span className={`mr-3 text-sm font-medium ${!isAnnualPricing ? 'text-primary' : 'text-muted-foreground'}`}>Monthly</span>
          <Switch
            checked={isAnnualPricing}
            onCheckedChange={setIsAnnualPricing}
            id="pricing-toggle"
            aria-label="Toggle annual pricing"
          />
          <span className={`ml-3 text-sm font-medium ${isAnnualPricing ? 'text-primary' : 'text-muted-foreground'}`}>
            Annual <Badge variant="outline" className="ml-1 border-green-500 text-green-600">Save ~17%</Badge>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          <PricingCard
            planName="Free"
            price="$0"
            priceFrequency="forever"
            features={["5 Snapshots / Workspace", "Daily Automatic Backups", "Manual Snapshots", "Standard Email Support"]}
            ctaText="Get Started"
            ctaHref="/sign-up" // Or /dashboard if already signed in
            ctaVariant="outline"
          />
          <PricingCard
            planName="Pro"
            price={isAnnualPricing ? `$${proPriceAnnual.toFixed(2)}` : `$${proPriceMonthly.toFixed(2)}`}
            priceFrequency={isAnnualPricing ? "/mo, billed annually" : "/mo"}
            features={["Unlimited Snapshots", "Hourly Automatic Backups", "AI Change Diff Emails", "Priority Restore Queue", "Priority Email Support"]}
            ctaText="Choose Pro"
            onCtaClick={() => handleCheckout('pro')}
            disabled={isCheckingOut}
            highlightText="Best Value"
          />
          <PricingCard
            planName="Teams"
            price={`$${((isAnnualPricing ? teamsPricePerSeatAnnual : teamsPricePerSeatMonthly) * teamSeatCount).toFixed(2)}`}
            priceFrequency={isAnnualPricing ? "/total/mo, billed annually" : "/total/mo for selected seats"}
            features={["All Pro Features, plus:", "Centralized Billing", "Team Management", "Customizable Roles (soon)", "Audit Logs (90 days)"]}
            ctaText="Choose Teams"
            onCtaClick={() => handleCheckout('teams')}
            disabled={isCheckingOut}
            isPrimary={true}
            badgeText="Most Popular"
            seatSelectorElement={
              <div className="my-4 flex items-center justify-between text-sm">
                <label htmlFor="team-seats" className={`font-medium ${true ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>Seats:</label>
                <input 
                  type="number" id="team-seats" name="team-seats" min="1" max="50"
                  value={teamSeatCount} onChange={handleTeamSeatChange}
                  className="w-20 p-1.5 border rounded bg-background/10 border-primary-foreground/30 text-center text-primary-foreground focus:ring-primary focus:border-primary disabled:opacity-70"
                  disabled={isCheckingOut}
                />
              </div>
            }
          />
        </div>
      </div>
    </section>
  );
};

export default PricingSection; 