"use client";

import React, { useState } from 'react';
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import SnapshotsTable from "@/components/dashboard/SnapshotsTable"; 
import UsageMeter from "@/components/dashboard/UsageMeter"; 
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

export default function DashboardPage() {
  const { toast } = useToast();
  const { mutate } = useSWRConfig();
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const { quota, isLoading: isQuotaLoading, isError: isQuotaError } = useQuota();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

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

    toast({ title: "Backup Started", description: "Your backup is in progress. You can continue working.", duration: 5000 });

    try {
      const response = await fetch('/api/snapshots/create', { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to trigger snapshot creation.' }));
        throw new Error(errorData.message || 'Failed to trigger snapshot creation.');
      }
      mutate('/api/snapshots'); 
      mutate('/api/user/quota'); 
      posthog.capture('snapshot_initiated');
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
        <div className="relative space-y-6">
          <div className="flex justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Latest Back-ups</h1>
              <div className="mt-1">
                  <UsageMeter />
              </div>
            </div>
            <Button 
              onClick={handleCreateSnapshot} 
              disabled={isCreatingSnapshot || isQuotaLoading || isOverSnapshotLimit || isQuotaError}
            >
              {isCreatingSnapshot ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              New Snapshot
            </Button>
          </div>

          <ActivationChecklist /> 

          <SnapshotsTable />

          <OnboardingTour /> 
          <UpgradeModal 
            isOpen={isUpgradeModalOpen} 
            onOpenChange={setIsUpgradeModalOpen} 
            triggerFeature="more snapshots"
            currentPlanName={quota?.planName}
          />
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