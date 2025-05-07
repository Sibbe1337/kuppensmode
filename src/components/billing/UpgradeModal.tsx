"use client";

import React, { useState } from 'react';
// import { motion, AnimatePresence } from 'framer-motion'; // Temporarily comment out Framer Motion
import {
  Dialog,
  DialogContent as ShadDialogContent, // Keep alias for clarity if you prefer
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from '@stripe/stripe-js';
import { fetcher } from '@/lib/fetcher'; // Assuming you have a fetcher utility
import useSWR from 'swr';
import posthog from 'posthog-js';

// Define Plan type matching the API response structure
interface Plan {
  id: string; // Stripe Price ID (price_...)
  name: string; // Stripe Product Name
  price: string; // Formatted price string (e.g., "$10")
  priceDescription: string; // e.g., "/mo"
  features: string[]; // Features (fetched from Product metadata)
  ctaText?: string; // Optional override for CTA text (default handled below)
  isCurrent?: boolean; // Flag if this is the user's current plan
}

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanId?: string; // Pass the user's current Stripe Price ID if available
}

// Animation variants commented out
// const modalVariants = { ... };

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY 
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

const UpgradeModal: React.FC<UpgradeModalProps> = ({ open, onOpenChange, currentPlanId }) => {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch plans using SWR
  const { data: plans, error: fetchError, isLoading: isPlansLoading } = useSWR<Plan[]>(
    '/api/billing/plans', 
    fetcher
  );

  const handleChoosePlan = async (priceId: string) => {
    setError(null);
    setIsLoading(priceId);

    if (!stripePromise) {
      console.error("Stripe is not initialized. Publishable key missing?");
      setError("Payment processing is not available.");
      setIsLoading(null);
      return;
    }

    try {
      // 1. Call your backend to create a Checkout Session
      const response = await fetch('/api/billing/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: priceId }), // Send the chosen price ID
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create checkout session.');
      }

      const session = await response.json();

      if (!session.id) {
        throw new Error('Invalid checkout session received.');
      }

      // 2. Redirect to Stripe Checkout
      const stripe = await stripePromise;
      if (!stripe) throw new Error("Stripe.js failed to load.");

      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId: session.id,
      });

      if (stripeError) {
        console.error("Stripe redirect error:", stripeError);
        setError(stripeError.message || "Failed to redirect to payment.");
      }
      // If redirection fails, stop loading
      setIsLoading(null);

    } catch (err: any) {
      console.error("Error handling plan choice:", err);
      setError(err.message || "An unexpected error occurred.");
      toast({ title: "Error", description: err.message || "Could not process plan change.", variant: "destructive" });
      setIsLoading(null);
    }
  };

  // return (
  //   <AnimatePresence> // Temporarily remove AnimatePresence
  //     {open && (
  //       <Dialog open={open} onOpenChange={onOpenChange}>
  //         <ShadDialogContent 
  //           forceMount
  //           className="sm:max-w-[800px] p-0 overflow-hidden"
  //           asChild // Removing asChild and motion.div for this test
  //         >
  //           {/* <motion.div ...> */}
  //             <DialogHeader className="p-6 pb-0">
  //               <DialogTitle className="text-2xl">Upgrade Your Plan</DialogTitle>
  //               <DialogDescription>
  //                 Choose the plan that best fits your needs. Unlock more features and increase your limits.
  //                 {error && <p className="text-red-500 mt-2">Error: {error}</p>}
  //               </DialogDescription>
  //             </DialogHeader>
  //             <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
  //               {mockPlans.map((plan) => (
  //                 <Card key={plan.id} className={`flex flex-col ${plan.id === (currentPlanId || mockPlans.find(p=>p.isCurrent)?.id) ? 'border-primary ring-2 ring-primary' : ''}`}>
  //                   <CardHeader>
  //                     <CardTitle>{plan.name}</CardTitle>
  //                     <div className="text-3xl font-bold">{plan.price} <span className="text-sm font-normal text-muted-foreground">{plan.priceDescription}</span></div>
  //                   </CardHeader>
  //                   <CardContent className="flex-grow">
  //                     <ul className="space-y-2 text-sm">
  //                       {plan.features.map((feature, index) => (
  //                         <li key={index} className="flex items-start">
  //                           <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-green-500 shrink-0" />
  //                           <span>{feature}</span>
  //                         </li>
  //                       ))}
  //                     </ul>
  //                   </CardContent>
  //                   <CardFooter>
  //                     {plan.id === (currentPlanId || mockPlans.find(p=>p.isCurrent)?.id) ? (
  //                       <Button disabled className="w-full">Current Plan</Button>
  //                     ) : (
  //                       <Button 
  //                         onClick={() => handleChoosePlan(plan.id)} 
  //                         className="w-full"
  //                         disabled={isLoading === plan.id}
  //                       >
  //                         {isLoading === plan.id ? (
  //                           <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  //                         ) : (
  //                           plan.ctaText || "Choose Plan"
  //                         )}
  //                       </Button>
  //                     )}
  //                   </CardFooter>
  //                 </Card>
  //               ))}
  //             </div>
  //             <DialogFooter className="p-6 pt-0 sm:justify-center">
  //                 <DialogClose asChild>
  //                   <Button type="button" variant="ghost">Maybe Later</Button>
  //                 </DialogClose>
  //             </DialogFooter>
  //           {/* </motion.div> */}
  //         </ShadDialogContent>
  //       </Dialog>
  //     )}
  //   </AnimatePresence>
  // );

  // Simplified return for testing:
  if (!open) return null;

  // Handle loading state for fetching plans
  if (isPlansLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <ShadDialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Upgrade Your Plan</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        </ShadDialogContent>
      </Dialog>
    );
  }

  // Handle error state for fetching plans
  if (fetchError) {
    return (
       <Dialog open={open} onOpenChange={onOpenChange}>
         <ShadDialogContent className="sm:max-w-[800px]">
           <DialogHeader>
             <DialogTitle className="text-2xl">Upgrade Your Plan</DialogTitle>
           </DialogHeader>
          <div className="flex flex-col items-center justify-center h-64 text-center text-destructive">
            <AlertTriangle className="h-12 w-12 mb-4" />
            <p className="font-semibold mb-2">Failed to load pricing plans.</p>
            <p className="text-sm">{fetchError.message || "Could not connect to the server."}</p>
          </div>
        </ShadDialogContent>
      </Dialog>
    );
  }

  // Render plans once loaded
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ShadDialogContent className="sm:max-w-[800px] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="text-2xl">Upgrade Your Plan</DialogTitle>
          <DialogDescription>
            Choose the plan that best fits your needs. Unlock more features and increase your limits.
            {error && <p className="text-red-500 mt-2">Error: {error}</p>}
          </DialogDescription>
        </DialogHeader>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans?.map((plan) => (
            <Card key={plan.id} className={`flex flex-col ${plan.id === currentPlanId ? 'border-primary ring-2 ring-primary' : 'border-border'}`}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <div className="text-3xl font-bold">{plan.price} <span className="text-sm font-normal text-muted-foreground">{plan.priceDescription}</span></div>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-green-500 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {plan.id === currentPlanId ? (
                  <Button disabled className="w-full">Current Plan</Button>
                ) : (
                  <Button 
                    onClick={() => handleChoosePlan(plan.id)} 
                    className="w-full"
                    disabled={isLoading === plan.id || !stripePromise}
                  >
                    {isLoading === plan.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      plan.ctaText || `Choose ${plan.name}` // Default CTA based on plan name
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
        <DialogFooter className="p-6 pt-4 border-t sm:justify-center">
            <DialogClose asChild>
              <Button type="button" variant="ghost">Maybe Later</Button>
            </DialogClose>
        </DialogFooter>
      </ShadDialogContent>
    </Dialog>
  );
};

export default UpgradeModal; 