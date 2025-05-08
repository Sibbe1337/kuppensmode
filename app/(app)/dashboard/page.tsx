"use client";

import React, { useState } from 'react';
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import SnapshotsTable from "@/components/dashboard/SnapshotsTable"; 
import { useToast } from "@/hooks/use-toast"; 
import { mutate, useSWRConfig } from 'swr';
import { Loader2, Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import OnboardingTour from "@/components/OnboardingTour";
import posthog from 'posthog-js';
import { useQuota } from '@/hooks/useQuota';
import type { Snapshot } from "@/types";
import UsageMeter from "@/components/dashboard/UsageMeter";

const CreateSnapshotFAB = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { quota, isLoading: isQuotaLoading, isError: isQuotaError } = useQuota();
  const { mutate } = useSWRConfig();

  const isOverSnapshotLimit = !isQuotaLoading && !isQuotaError && quota ? quota.snapshotsUsed >= quota.snapshotsLimit : false;
  const snapshotsLimit = !isQuotaLoading && !isQuotaError && quota ? quota.snapshotsLimit : '...';

  const handleCreateSnapshot = async () => {
    if (isOverSnapshotLimit || isQuotaLoading || isQuotaError) {
        if (isOverSnapshotLimit) {
            toast({ title: "Snapshot Limit Reached", description: `You have used ${quota?.snapshotsUsed}/${quota?.snapshotsLimit} snapshots. Please upgrade your plan.`, variant: "destructive", });
        }
        if (isQuotaError) {
            toast({ title: "Error", description: "Could not verify snapshot quota. Please try again.", variant: "destructive", });
        }
      return;
    }
    setIsLoading(true);

    const tempId = `temp-${Date.now()}`;
    const tempSnapshot: Snapshot = {
        id: tempId,
        status: 'Pending',
        sizeKB: 0,
        timestamp: new Date().toISOString(),
    };

    mutate('/api/snapshots', 
        (currentData: Snapshot[] | undefined) => [
            tempSnapshot,
            ...(currentData || [])
        ],
        false
    );

    toast({ title: "Snapshot Started", description: "We'll notify you when it's ready.", duration: 5000 });

    try {
      const response = await fetch('/api/snapshots/create', { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to trigger snapshot creation.' }));
        throw new Error(errorData.message || 'Failed to trigger snapshot creation.');
      }
      toast({ title: "Snapshot Initiated", description: "Processing...", duration: 3000 }); 
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
      setIsLoading(false);
    }
  };

  const fabButton = (
    <Button 
      className="create-snapshot-fab fixed bottom-8 right-8 rounded-full w-16 h-16 shadow-lg text-2xl z-50"
      aria-label={isOverSnapshotLimit ? `Snapshot limit reached (${snapshotsLimit})` : isQuotaLoading ? "Loading quota..." : "Create new snapshot"}
      onClick={handleCreateSnapshot}
      disabled={isLoading || isQuotaLoading || isOverSnapshotLimit || isQuotaError}
    >
      {isLoading || isQuotaLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : <Plus className="h-8 w-8" /> }
    </Button>
  );

  if (isOverSnapshotLimit) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild><span tabIndex={0}>{fabButton}</span></TooltipTrigger>
          <TooltipContent><p>Snapshot limit ({snapshotsLimit}) reached. Upgrade plan for more.</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return fabButton;
};

export default function DashboardPage() {
  return (
    <>
      <SignedIn>
        <div className="relative">
          <h1 className="text-2xl font-semibold mb-4">My Notion Snapshots</h1>
          <div className="mb-6">
             <UsageMeter />
          </div>
          <SnapshotsTable />
          <CreateSnapshotFAB />
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