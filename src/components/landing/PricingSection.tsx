"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CheckCircle, Check } from 'lucide-react';
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
  isEnterprise?: boolean;
  disabled?: boolean;
}

const PricingCard: React.FC<PricingCardProps> = ({
  planName, price, priceSuffix, description, features, ctaText, ctaHref, onCtaClick, isPopular, isEnterprise, disabled
}) => {
  return (
    <div className={cn(
      "bg-slate-800 p-8 rounded-xl shadow-2xl flex flex-col border border-slate-700",
      isPopular && "border-indigo-500 ring-2 ring-indigo-500 scale-105 z-10"
    )}>
      {isPopular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <Badge className="bg-indigo-500 text-white text-xs font-semibold px-3 py-1">POPULAR</Badge>
        </div>
      )}
      <h3 className="text-2xl font-semibold text-slate-100 mb-2">{planName}</h3>
      <p className="text-slate-400 text-sm mb-6 h-10">{description}</p>
      
      <div className="mb-6">
        <span className="text-5xl font-bold text-white">{price}</span>
        {priceSuffix && <span className="text-lg text-slate-400 ml-1">{priceSuffix}</span>}
      </div>
      
      <ul className="space-y-3 mb-8 text-sm flex-grow">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center">
            <Check className="h-5 w-5 mr-2.5 text-indigo-400 flex-shrink-0" />
            <span className="text-slate-300">{feature}</span>
          </li>
        ))}
      </ul>
      
      {onCtaClick ? (
          <Button 
            size="lg" 
            onClick={onCtaClick} 
            className={cn(
                "w-full mt-auto text-base py-3 font-semibold rounded-md transition-transform hover:scale-[1.02]",
                isPopular ? "bg-indigo-500 hover:bg-indigo-400 text-white" : "bg-slate-700 hover:bg-slate-600 text-slate-100"
            )}
            disabled={disabled}
          >
              {ctaText}
          </Button>
      ) : (
          <Button asChild size="lg" className={cn("w-full mt-auto text-base py-3 font-semibold rounded-md transition-transform hover:scale-[1.02]", isPopular ? "bg-indigo-500 hover:bg-indigo-400 text-white" : "bg-slate-700 hover:bg-slate-600 text-slate-100")} disabled={disabled}>
              <Link href={ctaHref || '#'}>{ctaText}</Link>
          </Button>
      )}
    </div>
  );
};

const PricingSection: React.FC = () => {
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const { toast } = useToast();

  // TODO: Update with actual Stripe Price IDs from .env
  const proMonthlyPriceId = process.env.NEXT_PUBLIC_PRICE_PRO_MONTHLY || 'price_pro_monthly_placeholder';
  // const enterpriseContactUrl = '/contact-sales'; // Example

  const handleCheckout = async (planType: 'pro' /*| 'enterprise' could be added if it has a direct checkout*/) => {
    if (isCheckingOut) return;
    setIsCheckingOut(true);

    let priceId: string | undefined;
    if (planType === 'pro') {
      priceId = proMonthlyPriceId; // Assuming monthly for this example, toggle for annual could be added back
    }

    if (!priceId) {
      toast({title: "Configuration Error", description: "Pricing information is currently unavailable.", variant: "destructive"});
      setIsCheckingOut(false);
      return;
    }

    try {
      const { sessionId, error } = await apiClient<{sessionId?: string, error?: string}>('/api/billing/checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceId: priceId }), // No seats for these plans in this design
      });
      if (error || !sessionId) throw new Error(error || 'Failed to create checkout session.');
      if (!stripePromise) throw new Error('Stripe.js is not configured.');
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe.js failed to load.');
      const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });
      if (stripeError) throw new Error(`Failed to redirect to Stripe: ${stripeError.message}`);
    } catch (err: any) {
      const message = err.data?.error || err.message || "Checkout failed. Please try again.";
      toast({title: "Checkout Error", description: message, variant: "destructive"});
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <section className="py-16 sm:py-24 bg-slate-950 text-slate-50">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-indigo-300 bg-indigo-900/70 rounded-full mb-3">
            Pricing
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 tracking-tight">
            Choose Your <span className="text-indigo-400">Perfect Plan</span>
          </h2>
          <p className="text-lg text-slate-400">
            Simple, transparent pricing that grows with your needs.
          </p>
        </div>

        {/* Annual/Monthly Toggle - removed for now based on screenshot, can be re-added */}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
          <PricingCard
            planName="Basic"
            price="$9"
            priceSuffix="/month"
            description="Perfect for personal use and small projects."
            features={["5 Notion pages", "Daily snapshots", "Email notifications", "7-day history retention"]}
            ctaText="Get Started"
            ctaHref="/sign-up" // Or logic to start free trial / go to dashboard
          />
          <PricingCard
            planName="Pro"
            price="$19"
            priceSuffix="/month"
            description="Enhanced features for professionals."
            features={["15 Notion pages", "Hourly snapshots", "Advanced diff comparison", "One-click restore", "30-day history retention"]}
            ctaText="Start Pro Trial"
            onCtaClick={() => handleCheckout('pro')}
            isPopular={true}
            disabled={isCheckingOut}
          />
          <PricingCard
            planName="Enterprise"
            price="Custom"
            priceSuffix=""
            description="Complete solution for teams and businesses."
            features={["Unlimited Notion pages", "Custom snapshot frequency", "Advanced audit logs", "Custom retention policies", "Dedicated support", "SSO & advanced security"]}
            ctaText="Contact Sales"
            ctaHref="/contact-sales" // Link to a contact page or Calendly
            isEnterprise={true} 
          />
        </div>
      </div>
    </section>
  );
};

export default PricingSection; 