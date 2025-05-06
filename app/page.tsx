"use client";

import React, { useState } from 'react';
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import SnapshotsTable from "@/components/dashboard/SnapshotsTable"; 
import { useToast } from "@/hooks/use-toast"; 
import { mutate } from 'swr';
import { Loader2, Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import OnboardingTour from "@/components/OnboardingTour";
import posthog from 'posthog-js';

// Mock data for quota - replace with actual data fetching later
// Should ideally match the structure fetched in Sidebar or come from a shared source
const mockUserQuota = {
  planName: "Free Tier",
  planId: "plan_free",
  snapshotsUsed: 2,
  snapshotsLimit: 5, // Set this to e.g., 2 to test the disabled state
  storageUsedMB: 150,
  storageLimitMB: 500,
};

const CreateSnapshotFAB = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const quota = mockUserQuota; 
  const isOverSnapshotLimit = quota.snapshotsUsed >= quota.snapshotsLimit;

  const handleCreateSnapshot = async () => {
    if (isOverSnapshotLimit) {
      toast({ title: "Snapshot Limit Reached", description: `You have used ${quota.snapshotsUsed}/${quota.snapshotsLimit} snapshots. Please upgrade your plan.`, variant: "destructive", });
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/snapshots/create', { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to trigger snapshot creation.' }));
        throw new Error(errorData.message || 'Failed to trigger snapshot creation.');
      }
      toast({ title: "Snapshot Initiated", description: "Your Notion workspace backup has started." });
      
      posthog.capture('snapshot_initiated');
      
      mutate('/api/snapshots'); 
    } catch (error: any) {
      console.error("Error creating snapshot:", error);
      toast({ title: "Error", description: error.message || "Could not initiate snapshot creation.", variant: "destructive", });
    } finally {
      setIsLoading(false);
    }
  };

  const fabButton = (
    <Button 
      className="create-snapshot-fab fixed bottom-8 right-8 rounded-full w-16 h-16 shadow-lg text-2xl z-50"
      aria-label={isOverSnapshotLimit ? `Snapshot limit reached (${quota.snapshotsLimit})` : "Create new snapshot"}
      onClick={handleCreateSnapshot}
      disabled={isLoading || isOverSnapshotLimit}
    >
      {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : <Plus className="h-8 w-8" /> }
    </Button>
  );

  if (isOverSnapshotLimit) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild><span tabIndex={0}>{fabButton}</span></TooltipTrigger>
          <TooltipContent><p>Snapshot limit ({quota.snapshotsLimit}) reached. Upgrade plan for more.</p></TooltipContent>
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
          <h1 className="text-2xl font-semibold mb-6">My Notion Snapshots</h1>
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