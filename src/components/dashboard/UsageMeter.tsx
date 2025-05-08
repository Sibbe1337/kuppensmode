"use client";

import React, { useState } from 'react';
import { useQuota } from '@/hooks/useQuota';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Zap, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from '@stripe/stripe-js';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';

// Type for plan data fetched from /api/billing/plans
interface PlanFromApi {
  id: string; // Stripe Price ID
  name: string;
  price: string;
  priceDescription: string;
  features: string[];
}

// Initialize Stripe.js
const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    : null;

if (!stripePromise) {
    console.warn('Stripe Publishable Key is not set in UsageMeter. Stripe Checkout will not work.');
}

const UsageMeter: React.FC = () => {
  const { quota, isLoading: isQuotaLoading, isError: isQuotaError } = useQuota();
  const { data: plans, error: plansError, isLoading: plansLoading } = useSWR<PlanFromApi[]>('/api/billing/plans', fetcher);
  const { toast } = useToast();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleUpgradeClick = async () => {
    setIsRedirecting(true);
    if (!stripePromise) {
        toast({ title: "Error", description: "Stripe is not configured correctly.", variant: "destructive" });
        setIsRedirecting(false);
        return;
    }
    if (plansLoading || plansError || !plans) {
        toast({ title: "Error", description: "Could not load upgrade plans. Please try again.", variant: "destructive" });
        setIsRedirecting(false);
        return;
    }

    // --- Find the Target Upgrade Plan (e.g., Pro Monthly) ---
    // TODO: Make this more dynamic or configurable if needed
    const targetPlan = plans.find(p => p.name === 'Pro' && p.priceDescription.includes('month'));

    if (!targetPlan) {
        toast({ title: "Error", description: "Could not find the Pro Monthly plan.", variant: "destructive" });
        setIsRedirecting(false);
        return;
    }

    try {
      const response = await fetch('/api/billing/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: targetPlan.id }), // Use the found Price ID
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to create checkout session.' }));
        throw new Error(errorData.message || 'Failed to create checkout session.');
      }
      
      const { sessionId } = await response.json();
      if (!sessionId) {
        throw new Error('Checkout session ID not received.');
      }

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe.js failed to load.');

      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) {
        console.error('Stripe redirect error:', error);
        throw new Error(error.message || 'Failed to redirect to Stripe.');
      }
      // If redirectToCheckout fails, it might be due to network issues or Stripe config
      // The user remains on the page, so we reset loading state.

    } catch (err: any) {
      console.error("Failed to initiate upgrade checkout:", err);
      toast({ title: "Upgrade Error", description: err.message || "Could not start the upgrade process.", variant: "destructive" });
    } finally {
        setIsRedirecting(false); // Reset loading state in case of error or if redirect fails
    }
  };

  if (isQuotaLoading) {
    return <Skeleton className="h-10 w-full max-w-sm" />;
  }

  if (isQuotaError || !quota) {
    return (
      <div className="text-xs text-destructive flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        <span>Error loading usage data.</span>
      </div>
    );
  }

  const { planName, snapshotsUsed, snapshotsLimit } = quota;
  const usagePercent = snapshotsLimit > 0 ? Math.min(100, (snapshotsUsed / snapshotsLimit) * 100) : 0;

  return (
    <div className="p-3 border rounded-lg bg-card text-card-foreground shadow-sm max-w-sm text-sm space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-medium">{planName} Plan</span>
        {planName.toLowerCase() === 'starter' && (
          <Button 
            variant="outline"
            size="sm"
            onClick={handleUpgradeClick}
            disabled={isRedirecting || plansLoading}
            className="py-1 px-2 h-auto"
          >
            {isRedirecting || plansLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin"/> : <Zap className="h-3 w-3 mr-1" />}
            Upgrade
          </Button>
        )}
      </div>
      <Progress value={usagePercent} className="h-2" />
      <div className="text-xs text-muted-foreground">
        Snapshots used: {snapshotsUsed} / {snapshotsLimit}
      </div>
    </div>
  );
};

export default UsageMeter; 