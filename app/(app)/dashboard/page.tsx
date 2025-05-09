"use client";

import React, { useState, useEffect } from 'react';
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import SnapshotsTable from "@/components/dashboard/SnapshotsTable"; 
import QuotaProgressButton from "@/components/dashboard/QuotaProgressButton";
import ActivationChecklist from "@/components/dashboard/ActivationChecklist"; 
import { useToast } from "@/hooks/use-toast"; 
import { useSWRConfig } from 'swr';
import { Loader2, Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import OnboardingTour from "@/components/OnboardingTour";
import posthog from 'posthog-js';
import { useQuota } from '@/hooks/useQuota';
import type { Snapshot } from "@/types";
import UpgradeModal from '@/components/modals/UpgradeModal';
import { useSearchParams, useRouter } from 'next/navigation';
import PreviewSheet from "@/components/dashboard/PreviewSheet";
import RestoreWizard from "@/components/dashboard/RestoreWizard";

export default function DashboardPage() {
  const searchParams = useSearchParams();
  console.log("DashboardPage INITIAL RENDER searchParams:", searchParams.toString());

  const { toast } = useToast();
  const { mutate } = useSWRConfig();
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const { quota, isLoading: isQuotaLoading, isError: isQuotaError, mutateQuota } = useQuota();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const router = useRouter();
  const [previewSnapshotIdForToast, setPreviewSnapshotIdForToast] = useState<string | null>(null);
  const [isToastPreviewSheetOpen, setIsToastPreviewSheetOpen] = useState(false);
  const [snapshotForRestoreToast, setSnapshotForRestoreToast] = useState<Snapshot | null>(null);
  const [isRestoreWizardOpenFromToast, setIsRestoreWizardOpenFromToast] = useState(false);

  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout');
    const sessionId = searchParams.get('session_id');
    console.log(`DashboardPage Effect: checkoutStatus=${checkoutStatus}, sessionId=${sessionId}`);

    if (checkoutStatus === 'success' && sessionId) {
      console.log(`DashboardPage: Success params found. Attempting to verify session: ${sessionId}`);
      toast({ title: "Payment Successful!", description: "Finalizing your subscription..." });
      
      fetch(`/api/billing/verify-checkout-session?session_id=${sessionId}`)
        .then(res => {
          console.log("DashboardPage: Verify fetch response status:", res.status);
          if (!res.ok) {
            return res.json().then(err => {
              console.error("DashboardPage: Verify API error response:", err);
              throw new Error(err.error || 'Verification failed (API error)'); 
            });
          }
          return res.json();
        })
        .then(data => {
          console.log("DashboardPage: Verify API success data:", data);
          if (data.success) {
            toast({ title: "Subscription Activated!", description: `You are now on the ${data.planName} plan.` });
            mutateQuota(); 
            mutate('/api/user/settings'); 
          } else {
            throw new Error(data.error || 'Verification step failed (data.success false).');
          }
        })
        .catch(err => {
          console.error("DashboardPage: Error in verify fetch chain:", err);
          toast({ title: "Error Finalizing Subscription", description: err.message, variant: "destructive" });
        })
        .finally(() => {
          console.log("DashboardPage: Verify fetch chain finally block. WOULD clean URL here.");
          // router.replace('/dashboard', { scroll: false }); // Temporarily commented out
        });
    } else if (checkoutStatus === 'cancel') {
      console.log("DashboardPage: Checkout canceled. WOULD clean URL here.");
      toast({ title: "Checkout Canceled", description: "Your upgrade process was canceled." });
      // router.replace('/dashboard', { scroll: false }); // Temporarily commented out
    }
  }, [searchParams, router, toast, mutateQuota]);

  const isOverSnapshotLimit = !isQuotaLoading && !isQuotaError && quota ? quota.snapshotsUsed >= quota.snapshotsLimit : false;

  const handleCreateSnapshot = async () => {
    if (isQuotaLoading || isQuotaError) {
        toast({ title: "Error", description: "Could not verify snapshot quota. Please try again.", variant: "destructive", });
        return;
    }
    if (isOverSnapshotLimit) {
        setIsUpgradeModalOpen(true);
        return;
    }
    setIsCreatingSnapshot(true);

    const tempId = `temp-${Date.now()}`;
    const tempSnapshot: Partial<Snapshot> = {
        id: tempId,
        status: 'Pending',
        sizeKB: 0,
        timestamp: new Date().toISOString(),
    };

    const tableElement = document.querySelector('.snapshots-table'); 
    if (tableElement) {
        tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    mutate('/api/snapshots', 
      (currentData: Snapshot[] | undefined) => [tempSnapshot as Snapshot, ...(currentData || [])], 
      false
    );

    toast({ 
      title: "Backup Started", 
      description: "Your snapshot is in progress. You can continue working.", 
      duration: 7000 
    });

    try {
      // const response = await fetch('/api/snapshots/create', { method: 'POST' });
      // Simulate API response for now if snapshot creation takes time
      const response = await new Promise<Response>(resolve => setTimeout(() => {
        // @ts-ignore
        resolve({ ok: true, json: async () => ({ success: true, snapshotId: tempSnapshot.id }) });
      }, 2000)); // Simulate 2s delay

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to trigger snapshot creation.' }));
        throw new Error(errorData.message || 'Failed to trigger snapshot creation.');
      }
      
      // Assuming backend returns the new snapshot ID or details
      const newSnapshotData = await response.json();
      const newSnapshotId = newSnapshotData.snapshotId || tempSnapshot.id;

      mutate('/api/snapshots'); 
      mutate('/api/user/quota'); 
      posthog.capture('snapshot_initiated');

      // Updated toast with actions
      toast({
        title: "Snapshot Saved!",
        description: "Your Notion workspace backup is complete.",
        duration: 10000, // Keep it longer for actions
        action: (
          <div className="flex flex-col gap-2 items-stretch">
            <Button variant="outline" size="sm" onClick={() => {
              setPreviewSnapshotIdForToast(newSnapshotId); // Use the actual ID of the created snapshot
              setIsToastPreviewSheetOpen(true);
              // Close the toast manually if needed: document.querySelector('[data-radix-toast-provider] button[aria-label=Close]')?.click();
            }}>
              👁 Preview
            </Button>
            <Button variant="default" size="sm" onClick={() => {
              // Find the full snapshot object to pass to wizard
              // This is a bit simplified; ideally, /api/snapshots returns the new snapshot object
              // or we fetch it. For now, constructing a partial one.
              setSnapshotForRestoreToast({ id: newSnapshotId, timestamp: tempSnapshot.timestamp!, sizeKB: 0, status: 'Completed' });
              setIsRestoreWizardOpenFromToast(true);
            }}>
              Restore
            </Button>
          </div>
        ),
      });

    } catch (error: any) {
      console.error("Error creating snapshot:", error);
      toast({ title: "Snapshot Error", description: error.message || "Could not initiate creation.", variant: "destructive", });
      mutate('/api/snapshots', 
          (currentData: Snapshot[] | undefined) => (currentData || []).filter(snap => snap.id !== tempId),
          false
      );
      mutate('/api/user/quota');
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  return (
    <>
      <SignedIn>
        <QuotaProgressButton /> 

        <div className="relative space-y-6">
          <div className="flex justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Recent Snapshots</h1>
            </div>
            <Button 
              onClick={handleCreateSnapshot} 
              disabled={isCreatingSnapshot || isQuotaLoading || isOverSnapshotLimit || isQuotaError}
              variant="default"
              size="lg"
            >
              {isCreatingSnapshot ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              New Snapshot
            </Button>
          </div>

          <ActivationChecklist /> 

          <SnapshotsTable />

          <OnboardingTour /> 
        </div>
      </SignedIn>
      <SignedOut>
        <div className="flex flex-col items-center justify-center h-full">
          <h1 className="text-3xl mb-4">Welcome to Notion Lifeline</h1>
          <p className="mb-8">Please sign in to manage your Notion snapshots.</p>
          <SignInButton mode="modal">
            <Button variant="secondary">Sign In</Button>
          </SignInButton>
        </div>
      </SignedOut>
    </>
  );
} 