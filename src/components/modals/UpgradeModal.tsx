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
  const { data: plans, error: plansError, isLoading: plansLoading } = useSWR<PlanFromApi[]>(
    isOpen ? '/api/billing/plans' : null, 
    fetcher,
    { revalidateOnFocus: false }
  );
  const { toast } = useToast();
  const [isRedirecting, setIsRedirecting] = useState<string | null>(null);

  useEffect(() => {
    console.log("UpgradeModal: isOpen prop changed to:", isOpen);
    if (isOpen) {
        console.log("UpgradeModal: Now attempting to fetch plans because isOpen is true.");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
        console.log("UpgradeModal (isOpen=true): SWR Data Update:", { plans, plansError, plansLoading, currentPlanName });
    }
  });

  const handleUpgrade = async (priceId: string, planName: string) => {
    console.log(`UpgradeModal: handleUpgrade CALLED for plan: ${planName}, priceId: ${priceId}`);
    setIsRedirecting(priceId);
    
    if (!stripePromise) {
      toast({ title: "Error", description: "Stripe is not configured (publishable key missing).", variant: "destructive" });
      console.error("UpgradeModal: stripePromise is null. NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY might be missing.");
      setIsRedirecting(null);
      return;
    }

    try {
      console.log("UpgradeModal: Attempting to fetch /api/billing/checkout-session");
      const response = await fetch('/api/billing/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });

      console.log("UpgradeModal: checkout-session API response status:", response.status);
      const responseData = await response.json();
      console.log("UpgradeModal: checkout-session API responseData:", responseData);

      if (!response.ok) {
        throw new Error(responseData.error || responseData.message || 'Failed to create checkout session.');
      }
      
      const { sessionId } = responseData;
      if (!sessionId) {
        console.error("UpgradeModal: Checkout session ID missing in responseData:", responseData);
        throw new Error('Checkout session ID not received.');
      }
      
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe.js failed to load.');
      
      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) throw new Error(error.message || 'Failed to redirect to Stripe.');

    } catch (err: any) {
      console.error("UpgradeModal: Error in handleUpgrade catch block:", err);
      toast({ title: `Upgrade to ${planName} Failed`, description: err.message || "An unexpected error occurred.", variant: "destructive" });
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
    ? plans.filter(p => {
        const planNameLower = p.name.toLowerCase();
        const currentPlanNameLower = currentPlanName?.toLowerCase();
        
        // Don't show the "Starter" plan from Stripe if it's literally named "Starter"
        if (planNameLower === 'starter') {
          return false;
        }
        // Don't show the plan if its name matches the user's current plan name
        if (planNameLower === currentPlanNameLower) {
          return false;
        }
        return true;
      })
    : [];
  
  if (isOpen) {
    console.log("UpgradeModal (isOpen=true): Filtered Plans:", filteredPlans);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        
        {isOpen && plansLoading && (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}

        {isOpen && plansError && (
          <div className="text-destructive text-sm p-4 border border-destructive/50 rounded-md">
            Could not load plans. Please try again later.
          </div>
        )}

        {isOpen && !plansLoading && !plansError && plans && (
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            {filteredPlans.map((plan) => (
              <div 
                key={`wrapper-${plan.id}`} 
                onClick={() => console.log(`--- PLAN CARD (Wrapper Div) CLICKED for ${plan.name} ---`)}
              >
                <div key={plan.id} className="p-4 border rounded-lg flex flex-col h-full">
                  <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                  <p className="text-2xl font-bold">{plan.price}<span className="text-sm font-normal text-muted-foreground">{plan.priceDescription}</span></p>
                  <ul className="mt-3 mb-4 space-y-1 text-sm text-muted-foreground flex-grow">
                    {plan.features.slice(0, 3).map(feature => (
                       <li key={feature} className="flex items-center">
                         <CheckCircle className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                         {feature}
                       </li>
                    ))}
                  </ul>
                  <Button 
                    className="mt-auto w-full"
                    onClick={(e) => {
                      // e.stopPropagation(); // Temporarily add, then remove if it works, to test theory
                      console.log(`--- BUTTON itself CLICKED FOR ${plan.name} ---`); 
                    }}
                    disabled={isRedirecting === plan.id}
                  >
                    {isRedirecting === plan.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Zap className="h-4 w-4 mr-2" />}
                    Upgrade to {plan.name}
                  </Button>
                </div>
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