"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface PlanFromApi {
  id: string; 
  productId?: string; // Keep productId for grouping
  name: string; 
  nickname: string | null; 
  price: string; 
  priceDescription: string; 
  interval: string | null;
  features: string[]; 
  productMetadata: any;
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
  const [billingCycle, setBillingCycle] = useState<'month' | 'year'>('month');

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
      
      const { id: sessionIdFromResponse } = responseData;
      if (!sessionIdFromResponse) {
        console.error("UpgradeModal: Session ID (expected as 'id') missing in responseData:", responseData);
        throw new Error('Session ID not received from server.');
      }
      
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe.js failed to load.');
      
      const { error } = await stripe.redirectToCheckout({ sessionId: sessionIdFromResponse });
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

  // Get unique product names (e.g., ["Pro", "Teams"]) excluding Starter and current plan
  const productNamesToShow = useMemo(() => {
    if (!plans) return [];
    const uniqueNames = [...new Set(plans.map(p => p.name))];
    return uniqueNames.filter(name => 
      name.toLowerCase() !== 'starter' && 
      name.toLowerCase() !== currentPlanName?.toLowerCase()
    );
  }, [plans, currentPlanName]);

  if (isOpen) {
    console.log("UpgradeModal (isOpen=true): Product Names to Show:", productNamesToShow);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-3xl"> {/* Adjusted width for potentially 3 cards */}
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center space-x-2 my-4">
          <Label htmlFor="billing-cycle-toggle" className={billingCycle === 'month' ? 'font-semibold' : 'text-muted-foreground'}>Monthly</Label>
          <Switch 
            id="billing-cycle-toggle"
            checked={billingCycle === 'year'}
            onCheckedChange={(checked) => setBillingCycle(checked ? 'year' : 'month')}
          />
          <Label htmlFor="billing-cycle-toggle" className={billingCycle === 'year' ? 'font-semibold' : 'text-muted-foreground'}>
            Annual <Badge variant="outline" className="ml-1 border-green-500 text-green-600">Save 20%</Badge>
          </Label>
        </div>
        
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
          // Adjust grid columns based on how many products we are showing
          <div className={`grid gap-4 py-4 sm:grid-cols-1 md:grid-cols-${Math.min(productNamesToShow.length, 3)}`}> 
            {productNamesToShow.map((productName) => {
              // Find the relevant monthly or annual price for this product based on the toggle
              const priceForCurrentCycle = plans.find(p => 
                p.name === productName && 
                p.interval === billingCycle
              );

              if (!priceForCurrentCycle) {
                // Could show a placeholder or a message if a plan doesn't have the selected cycle
                // For now, just skip rendering this product card if no matching price for cycle
                console.warn(`No ${billingCycle} price found for ${productName}`);
                return null; 
              }
              
              // Determine if this is the "Most Popular" - example logic
              const isMostPopular = productName === 'Pro'; // Or based on a metadata flag

              return (
                <div key={priceForCurrentCycle.productId || priceForCurrentCycle.id} 
                     className={`p-4 md:p-6 border rounded-lg flex flex-col h-full relative ${isMostPopular ? 'border-primary ring-2 ring-primary' : ''}`}>
                  {isMostPopular && (
                    <Badge variant="default" className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</Badge>
                  )}
                  <h3 className="text-xl font-semibold mb-1 text-center">{priceForCurrentCycle.name}</h3>
                  <p className="text-3xl font-bold text-center">{priceForCurrentCycle.price}
                    <span className="text-base font-normal text-muted-foreground">{priceForCurrentCycle.priceDescription}</span>
                  </p>
                  <p className="text-xs text-muted-foreground text-center mb-3">
                    {billingCycle === 'year' ? `Billed as $${(parseFloat(priceForCurrentCycle.price.substring(1)) * 12).toFixed(2)} per year` : 'Billed monthly'}
                  </p>
                  
                  <ul className="mt-3 mb-6 space-y-2 text-sm text-muted-foreground flex-grow">
                    {priceForCurrentCycle.features.slice(0, 3).map(feature => (
                       <li key={feature} className="flex items-center">
                         <CheckCircle className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                         {feature}
                       </li>
                    ))}
                    {priceForCurrentCycle.features.length > 3 && <li className='text-xs'>+ {priceForCurrentCycle.features.length - 3} more</li>}
                  </ul>
                  <Button 
                    variant={isMostPopular ? 'default' : 'outline'}
                    className="mt-auto w-full py-3 text-base"
                    onClick={() => handleUpgrade(priceForCurrentCycle.id, priceForCurrentCycle.nickname || priceForCurrentCycle.name)}
                    disabled={isRedirecting === priceForCurrentCycle.id}
                  >
                    {isRedirecting === priceForCurrentCycle.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Zap className="h-4 w-4 mr-2" />}
                    Choose {priceForCurrentCycle.name}
                  </Button>
                   {/* Plan Guidance Micro-copy */}
                   <p className="text-xs text-muted-foreground text-center mt-2">
                    { productName === 'Pro' && "For power users & creators." }
                    { productName === 'Teams' && "For 3+ collaborators, seat-based." }
                   </p>
                </div>
              );
            })}
            {productNamesToShow.length === 0 && plans.length > 0 && (
              <p className="text-sm text-muted-foreground col-span-full text-center py-4">
                No other upgrade plans available for the selected billing cycle.
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