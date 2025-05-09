"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import useSWR, { useSWRConfig } from 'swr';
import { fetcher } from '@/lib/fetcher';
import { Loader2, Zap, CheckCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from '@stripe/stripe-js';
import { Badge } from "@/components/ui/badge";

interface PlanFromApi {
  id: string; 
  name: string;
  price: string;
  priceDescription: string;
  features: string[];
}

interface UpgradeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  triggerFeature?: string; // Optional: e.g., "Priority Restore", "More Snapshots"
  currentPlanName?: string;
}

// Initialize Stripe.js
const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    : null;

const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onOpenChange, triggerFeature, currentPlanName }) => {
  const swrKey = isOpen ? '/api/billing/plans' : null;
  const { data: plans, error: plansError, isLoading: plansLoading, mutate } = useSWR<PlanFromApi[]>(
    swrKey, 
    fetcher
  );
  const { toast } = useToast();
  const [isRedirecting, setIsRedirecting] = useState<string | null>(null);

  // Effect to manually revalidate when the modal opens and SWR key is set
  useEffect(() => {
    if (isOpen && swrKey) {
      console.log("UpgradeModal: isOpen is true, manually revalidating /api/billing/plans");
      mutate(); // Call mutate to trigger revalidation of the current key
    }
  }, [isOpen, swrKey, mutate]); // Add mutate to dependency array

  console.log("UpgradeModal: SWR Data:", { plans, plansError, plansLoading, isOpen, currentPlanName, swrKey });

  const handleUpgrade = async (priceId: string, planName: string) => {
    setIsRedirecting(priceId);
    if (!stripePromise) {
      toast({ title: "Error", description: "Stripe is not configured.", variant: "destructive" });
      setIsRedirecting(null);
      return;
    }

    try {
      const response = await fetch('/api/billing/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to create checkout session.' }));
        throw new Error(errData.message);
      }
      const { sessionId } = await response.json();
      if (!sessionId) throw new Error('Checkout session ID not received.');
      
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe.js failed to load.');
      
      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) throw new Error(error.message || 'Failed to redirect to Stripe.');

    } catch (err: any) {
      toast({ title: `Upgrade to ${planName} Failed`, description: err.message, variant: "destructive" });
    } finally {
      setIsRedirecting(null);
    }
  };

  let title = "Upgrade Your Plan";
  let description = "Choose the plan that best fits your needs. Unlock more features and increase your limits.";
  if (triggerFeature) {
    description = `Unlock ${triggerFeature} and more by upgrading your plan.`
  }

  const filteredPlans = plans
    ? plans.filter(p => p.name.toLowerCase() !== 'starter' && p.name.toLowerCase() !== currentPlanName?.toLowerCase())
    : [];
  
  console.log("UpgradeModal: Filtered Plans:", filteredPlans);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        
        {plansLoading && (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}

        {plansError && (
          <div className="text-destructive text-sm p-4 border border-destructive/50 rounded-md">
            Could not load plans. Please try again later.
          </div>
        )}

        {!plansLoading && !plansError && plans && (
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            {filteredPlans.map((plan) => (
                <div key={plan.id} className="p-4 border rounded-lg flex flex-col">
                  <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                  <p className="text-2xl font-bold">{plan.price}<span className="text-sm font-normal text-muted-foreground">{plan.priceDescription}</span></p>
                  {/* TODO: Add annual/monthly toggle if applicable */}
                  <ul className="mt-3 mb-4 space-y-1 text-sm text-muted-foreground">
                    {plan.features.slice(0, 3).map(feature => (
                       <li key={feature} className="flex items-center">
                         <CheckCircle className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                         {feature}
                       </li>
                    ))}
                  </ul>
                  <Button 
                    className="mt-auto w-full"
                    onClick={() => handleUpgrade(plan.id, plan.name)}
                    disabled={isRedirecting === plan.id}
                  >
                    {isRedirecting === plan.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Zap className="h-4 w-4 mr-2" />}
                    Upgrade to {plan.name}
                  </Button>
                </div>
            ))}
            {filteredPlans.length === 0 && plans.length > 0 && (
              <p className="text-sm text-muted-foreground col-span-full text-center py-4">
                No other upgrade plans available at this time.
              </p>
            )}
            {plans.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full text-center py-4">
                No upgrade plans found.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={!!isRedirecting}>
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeModal; 