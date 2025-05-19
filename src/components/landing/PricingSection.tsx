"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Switch is not used in the current design, can be removed if not planned for toggle
// import { Switch } from "@/components/ui/switch";
import { Check } from 'lucide-react'; // Using Check, CheckCircle is also an option
import apiClient from '@/lib/apiClient';
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from '@stripe/stripe-js';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY 
    ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    : null;

interface PricingCardProps {
  planName: string;
  price: string;
  priceSuffix?: string;
  description: string;
  features: string[];
  ctaText: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  isPopular?: boolean;
  isEnterprise?: boolean; // To style enterprise CTA differently if needed
  disabled?: boolean;
}

const PricingCard: React.FC<PricingCardProps> = ({
  planName, price, priceSuffix, description, features, ctaText, ctaHref, onCtaClick, isPopular, isEnterprise, disabled
}) => {
  return (
    <div className={cn(
      "flex flex-col p-8 bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/40 border border-slate-700/50",
      isPopular && "border-sky-500/80 ring-2 ring-sky-500/50 scale-105 z-10 bg-slate-750/70", // Popular card distinct background
      "transition-all duration-300 ease-in-out" // Added transition for all cards
    )}>
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <Badge className="bg-sky-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-md">POPULAR</Badge>
        </div>
      )}
      <h3 className="text-2xl font-medium text-slate-50 mb-2 text-center">{planName}</h3>
      <p className="text-slate-300 text-sm mb-6 min-h-[4rem] text-center">{description}</p>
      
      <div className="mb-8 text-center">
        <span className={cn(
          "text-5xl font-semibold tracking-tight",
          isPopular ? "text-sky-400" : "text-slate-50" // Highlight price for popular plan
        )}>{price}</span>
        {priceSuffix && <span className="text-lg text-slate-300 ml-1">{priceSuffix}</span>}
      </div>
      
      <ul className="space-y-3.5 mb-10 text-sm flex-grow">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <Check className="h-5 w-5 mr-2.5 text-sky-400 flex-shrink-0" strokeWidth={2.5} />
            <span className="text-slate-200">{feature}</span>
          </li>
        ))}
      </ul>
      
      {onCtaClick ? (
          <Button 
            size="lg" 
            onClick={onCtaClick} 
            className={cn(
                "w-full mt-auto text-base py-3.5 font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 ease-in-out transform hover:scale-[1.02]",
                isPopular ? "bg-sky-500 hover:bg-sky-400 text-white" 
                          : isEnterprise ? "bg-transparent hover:bg-sky-500/10 text-sky-400 border-2 border-sky-500"
                                         : "bg-slate-600/80 hover:bg-slate-600 text-slate-50"
            )}
            disabled={disabled}
          >
              {ctaText}
          </Button>
      ) : (
          <Button 
            asChild 
            size="lg" 
            className={cn(
                "w-full mt-auto text-base py-3.5 font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 ease-in-out transform hover:scale-[1.02]", 
                isPopular ? "bg-sky-500 hover:bg-sky-400 text-white" 
                          : isEnterprise ? "bg-transparent hover:bg-sky-500/10 text-sky-400 border-2 border-sky-500"
                                         : "bg-slate-600/80 hover:bg-slate-600 text-slate-50"
            )}
            disabled={disabled}
          >
              <Link href={ctaHref || '#'}>{ctaText}</Link>
          </Button>
      )}
    </div>
  );
};

const PricingSection: React.FC = () => {
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const { toast } = useToast();

  const proMonthlyPriceId = process.env.NEXT_PUBLIC_PRICE_PRO_MONTHLY || 'price_pro_monthly_placeholder';

  const handleCheckout = async (planType: 'pro') => {
    if (isCheckingOut) return;
    setIsCheckingOut(true);
    let priceId: string | undefined;
    if (planType === 'pro') priceId = proMonthlyPriceId;

    if (!priceId || priceId.includes('placeholder')) {
      toast({title: "Configuration Error", description: "Pricing ID is not set correctly.", variant: "destructive"});
      setIsCheckingOut(false);
      return;
    }
    if (!stripePromise) {
        toast({title: "Configuration Error", description: "Stripe is not configured.", variant: "destructive"});
        setIsCheckingOut(false);
        return;
    }

    try {
      const { sessionId, error } = await apiClient<{sessionId?: string, error?: string}>('/api/billing/checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceId: priceId }),
      });
      if (error || !sessionId) throw new Error(error || 'Failed to create checkout session.');
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe.js failed to load.');
      const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });
      if (stripeError) throw new Error(`Stripe redirect failed: ${stripeError.message}`);
    } catch (err: any) {
      const message = err.data?.error || err.message || "Checkout failed. Please try again.";
      toast({title: "Checkout Error", description: message, variant: "destructive"});
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <section className="py-16 sm:py-24 bg-slate-950 border-t border-slate-800/70">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <span className="inline-block px-3.5 py-1.5 text-xs font-semibold text-sky-300 bg-sky-800/50 rounded-full mb-4 shadow-sm">
            Pricing
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-4 text-slate-50 tracking-tight">
            Choose Your <span className="text-sky-400">Perfect Plan</span>
          </h2>
          <p className="text-lg text-slate-300 leading-relaxed">
            Simple, transparent pricing that grows with your needs.
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
          <PricingCard
            planName="Basic"
            price="$9"
            priceSuffix="/month"
            description="Perfect for personal use and small projects."
            features={[
                "Track 5 Notion pages", 
                "Daily snapshots", 
                "Email notifications", 
                "7-day history retention"
            ]}
            ctaText="Get Started"
            ctaHref="/sign-up"
          />
          <PricingCard
            planName="Pro"
            price="$19"
            priceSuffix="/month"
            description="Enhanced features for power users & professionals."
            features={[
                "Track 15 Notion pages", 
                "Hourly snapshots", 
                "Advanced diff comparison", 
                "One-click restore", 
                "30-day history retention",
                "Priority email support"
            ]}
            ctaText={isCheckingOut ? "Processing..." : "Start Pro Trial"}
            onCtaClick={() => handleCheckout('pro')}
            isPopular={true}
            disabled={isCheckingOut}
          />
          <PricingCard
            planName="Enterprise"
            price="Custom"
            description="Tailored solutions for teams and businesses at scale."
            features={[
                "Unlimited Notion pages", 
                "Custom snapshot frequency", 
                "Volume & storage options",
                "Advanced audit logs", 
                "Custom retention policies", 
                "Dedicated account manager", 
                "SSO & advanced security"
            ]}
            ctaText="Contact Sales"
            ctaHref="/contact-sales"
            isEnterprise={true}
          />
        </div>
      </div>
    </section>
  );
};

export default PricingSection; 