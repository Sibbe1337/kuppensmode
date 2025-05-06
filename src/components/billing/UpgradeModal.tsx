"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogOverlay,
  DialogContent as ShadDialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { CheckCircle2, Loader2 } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import posthog from 'posthog-js';

// Make sure to replace with your actual Stripe publishable key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "your_stripe_publishable_key_here");

interface Plan {
  id: string;
  name: string;
  price: string;
  priceDescription: string;
  features: string[];
  isCurrent?: boolean;
  ctaText?: string;
}

// Mock plans data
const mockPlans: Plan[] = [
  {
    id: "price_1PG...", // Example Stripe Price ID for Free (if you model it in Stripe)
    name: "Free Tier",
    price: "$0",
    priceDescription: "per month",
    features: [
      "5 Snapshots",
      "500MB Storage",
      "Manual Backups",
      "Community Support"
    ],
    isCurrent: true,
  },
  {
    id: "price_1PG...", // Example Stripe Price ID for Pro
    name: "Pro Plan",
    price: "$10",
    priceDescription: "per month",
    features: [
      "50 Snapshots",
      "5GB Storage",
      "Automated Daily Backups",
      "Priority Email Support",
      "Selective Restore"
    ],
    ctaText: "Upgrade to Pro",
  },
  {
    id: "price_1PG...", // Example Stripe Price ID for Team
    name: "Team Plan",
    price: "$25",
    priceDescription: "per month",
    features: [
      "Unlimited Snapshots",
      "20GB Storage",
      "All Pro Features",
      "Team Collaboration (soon)",
      "Dedicated Support Channel"
    ],
    ctaText: "Upgrade to Team",
  },
];

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanId?: string;
}

// Animation variants (can be shared or defined locally)
const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.15, ease: "easeIn" } }
};

const UpgradeModal: React.FC<UpgradeModalProps> = ({ open, onOpenChange, currentPlanId }) => {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChoosePlan = async (planId: string) => {
    setIsLoading(planId);
    setError(null);
    console.log(`User chose plan: ${planId}. Creating Stripe Checkout session...`);
    
    // Capture PostHog event before potential redirect
    posthog.capture('plan_chosen', { plan_id: planId });

    try {
      // Call your backend to create the Checkout session
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId: planId }), // Send Stripe Price ID
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create checkout session.");
      }

      const { sessionId } = await response.json();

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error("Stripe.js has not loaded yet.");
      }

      const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });

      if (stripeError) {
        console.error("Stripe redirect error:", stripeError);
        setError(stripeError.message || "An unexpected error occurred during redirect.");
      }
    } catch (err: any) {
      console.error("Error choosing plan:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(null);
    }
    // onOpenChange(false); // Modal will close on redirect or can be closed on error
  };

  return (
    <AnimatePresence>
      {open && (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <ShadDialogContent 
            forceMount
            className="sm:max-w-[800px] p-0 overflow-hidden"
            asChild
          >
            <motion.div
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={modalVariants}
              className="sm:max-w-[800px] bg-background rounded-lg shadow-lg"
            >
              <DialogHeader className="p-6 pb-0">
                <DialogTitle className="text-2xl">Upgrade Your Plan</DialogTitle>
                <DialogDescription>
                  Choose the plan that best fits your needs. Unlock more features and increase your limits.
                  {error && <p className="text-red-500 mt-2">Error: {error}</p>}
                </DialogDescription>
              </DialogHeader>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {mockPlans.map((plan) => (
                  <Card key={plan.id} className={`flex flex-col ${plan.id === (currentPlanId || mockPlans.find(p=>p.isCurrent)?.id) ? 'border-primary ring-2 ring-primary' : ''}`}>
                    <CardHeader>
                      <CardTitle>{plan.name}</CardTitle>
                      <div className="text-3xl font-bold">{plan.price} <span className="text-sm font-normal text-muted-foreground">{plan.priceDescription}</span></div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <ul className="space-y-2 text-sm">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-start">
                            <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-green-500 shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      {plan.id === (currentPlanId || mockPlans.find(p=>p.isCurrent)?.id) ? (
                        <Button disabled className="w-full">Current Plan</Button>
                      ) : (
                        <Button 
                          onClick={() => handleChoosePlan(plan.id)} 
                          className="w-full"
                          disabled={isLoading === plan.id}
                        >
                          {isLoading === plan.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            plan.ctaText || "Choose Plan"
                          )}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
              <DialogFooter className="p-6 pt-0 sm:justify-center">
                  <DialogClose asChild>
                    <Button type="button" variant="ghost">Maybe Later</Button>
                  </DialogClose>
              </DialogFooter>
            </motion.div>
          </ShadDialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
};

export default UpgradeModal; 