"use client";

import React, { useState, useEffect } from 'react';
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import SnapshotsTable from "@/components/dashboard/SnapshotsTable"; 
import QuotaProgressButton from "@/components/dashboard/QuotaProgressButton";
import ActivationChecklist from "@/components/dashboard/ActivationChecklist"; 
import { useToast } from "@/hooks/use-toast"; 
import { useSWRConfig } from 'swr';
import { Loader2, Plus, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Tour from "@/components/Tour";
import posthog from 'posthog-js';
import { useQuota } from '@/hooks/useQuota';
import type { Snapshot } from "@/types";
import UpgradeModal from '@/components/modals/UpgradeModal';
import { useSearchParams, useRouter } from 'next/navigation';
import PreviewSheet from "@/components/dashboard/PreviewSheet";
import RestoreWizard from "@/components/dashboard/RestoreWizard";
import useSWR from 'swr';
import apiClient from '@/lib/apiClient';
import { useSandbox, setSandboxMode } from '@/hooks/useSandbox';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from "@/components/ui/EmptyState";
import { useUserSettings } from "@/hooks/useUserSettings";
import CancellationSurveyModal from "@/components/modals/CancellationSurveyModal";
import Link from 'next/link';

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  console.log("DashboardPage INITIAL RENDER searchParams:", searchParams.toString());

  const { toast } = useToast();
  const { mutate } = useSWRConfig();
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const { quota, isLoading: isQuotaLoading, isError: isQuotaError, mutateQuota } = useQuota();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [previewSnapshotIdForToast, setPreviewSnapshotIdForToast] = useState<string | null>(null);
  const [isToastPreviewSheetOpen, setIsToastPreviewSheetOpen] = useState(false);
  const [snapshotForRestoreToast, setSnapshotForRestoreToast] = useState<Snapshot | null>(null);
  const [isRestoreWizardOpenFromToast, setIsRestoreWizardOpenFromToast] = useState(false);
  const { settings: userSettings, mutateSettings: mutateUserSettings } = useUserSettings();
  const [isCancellationSurveyModalOpen, setIsCancellationSurveyModalOpen] = useState(false);

  const { data: snapshots, error: snapshotsError, isLoading: isLoadingSnapshots } = useSWR<Snapshot[]>(
    '/api/snapshots',
    apiClient
  );

  useEffect(() => {
    if (searchParams.get('sandbox') === '1') {
      setSandboxMode(true);
      // Optional: remove the query param from URL after setting the flag
      // router.replace('/dashboard', { scroll: false }); 
    }
  }, [searchParams, router]);

  const isSandbox = useSandbox();

  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout');
    const sessionId = searchParams.get('session_id');
    if (checkoutStatus === 'success' && sessionId) {
      toast({ title: "Payment Successful!", description: "Finalizing your subscription..." });
      apiClient<{success: boolean, planName?: string, error?: string}>(`/api/billing/verify-checkout-session?session_id=${sessionId}`)
        .then(data => {
          if (data.success) {
            toast({ title: "Subscription Activated!", description: `You are now on the ${data.planName || 'selected'} plan.` });
            mutateQuota(); 
            mutate('/api/user/settings'); 
          } else {
            throw new Error(data.error || 'Verification step failed (data.success false).');
          }
        })
        .catch((err: any) => {
          toast({ title: "Error Finalizing Subscription", description: err.message, variant: "destructive" });
        })
        .finally(() => {
          // router.replace('/dashboard', { scroll: false }); 
        });
    } else if (checkoutStatus === 'cancel') {
      toast({ title: "Checkout Canceled", description: "Your upgrade process was canceled." });
      // router.replace('/dashboard', { scroll: false });
    }
  }, [searchParams, router, toast, mutateQuota, mutate]);

  useEffect(() => {
    if (userSettings?.flags?.needsCancellationSurvey) {
      console.log("DashboardPage: needsCancellationSurvey flag is true. Opening modal.");
      setIsCancellationSurveyModalOpen(true);
      apiClient<{success: boolean}>('/api/user/flags/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagName: 'needsCancellationSurvey' }),
      })
      .then(data => {
        if (data.success) {
          console.log("DashboardPage: Cleared needsCancellationSurvey flag.");
        } else {
          console.error("DashboardPage: Failed to clear needsCancellationSurvey flag.");
        }
      })
      .catch((err: any) => console.error("DashboardPage: Error clearing needsCancellationSurvey flag:", err));
    }
  }, [userSettings]);

  const isOverSnapshotLimit = !isSandbox && !isQuotaLoading && !isQuotaError && quota ? quota.snapshotsUsed >= quota.snapshotsLimit : false;

  const handleCreateSnapshot = async () => {
    if (!isSandbox && (isQuotaLoading || isQuotaError)) {
        toast({ title: "Error", description: "Could not verify snapshot quota. Please try again.", variant: "destructive" });
        return;
    }
    if (!isSandbox && isOverSnapshotLimit) {
        router.push('/pricing?reason=limit');
        return;
    }
    setIsCreatingSnapshot(true);

    const tempIdString: string = `optimistic_snap_${Date.now()}`;
    const tempSnapshot: Partial<Snapshot> = {
        id: tempIdString,
        snapshotIdActual: tempIdString,
        status: 'Pending',
        sizeKB: 0,
        timestamp: new Date().toISOString(),
    };

    const tableElement = document.querySelector('.snapshots-table'); 
    if (tableElement) {
        tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    mutate('/api/snapshots', 
      (currentData: Snapshot[] = []) => [tempSnapshot as Snapshot, ...currentData], 
      { revalidate: false }
    );

    toast({ 
      title: "Backup Started", 
      description: isSandbox ? "Demo snapshot in progress..." : "Your snapshot is in progress. You can continue working.", 
      duration: 7000 
    });

    if (isSandbox) {
      posthog.capture('snapshot_start', { demo: true, snapshot_id_optimistic: tempIdString });
      await new Promise(resolve => setTimeout(resolve, 1500));
      mutate('/api/snapshots',
        (currentData: Snapshot[] = []) => currentData.map(s => 
          s.id === tempIdString ? { ...s, status: 'Completed', sizeKB: Math.floor(Math.random() * 500 + 50) } as Snapshot : s
        ),
        false
      );
      toast({ title: "Demo Snapshot Saved!", description: "This is a simulated snapshot."});
      setIsCreatingSnapshot(false);
      return;
    }

    try {
      await apiClient<{snapshotId?: string, success: boolean, message: string}>('/api/snapshots/create', { method: 'POST' }); 
      const newSnapshotId: string = tempIdString;

      mutate('/api/snapshots'); 
      mutateQuota(); 
      posthog.capture('snapshot_start', { snapshot_id_optimistic: newSnapshotId });

      toast({
        title: "Snapshot Saved!",
        description: "Your Notion workspace backup is complete.",
        duration: 10000,
        action: (
          <div className="flex flex-col gap-2 items-stretch">
            <Button variant="outline" size="sm" onClick={() => {
              setPreviewSnapshotIdForToast(newSnapshotId);
              setIsToastPreviewSheetOpen(true);
            }}>
              👁 Preview
            </Button>
            <Button variant="default" size="sm" onClick={() => {
              setSnapshotForRestoreToast({ 
                id: newSnapshotId, 
                snapshotIdActual: newSnapshotId, 
                timestamp: tempSnapshot.timestamp!,
                sizeKB: 0, 
                status: 'Completed' 
              });
              setIsRestoreWizardOpenFromToast(true);
            }}>
              Restore
            </Button>
          </div>
        ),
      });

    } catch (error: any) {
      console.error("Error creating snapshot:", error);
      toast({ title: "Snapshot Error", description: error.data?.error || error.message || "Could not initiate creation.", variant: "destructive" });
      mutate('/api/snapshots', 
          (currentData: Snapshot[] = []) => currentData.filter(snap => snap.id !== tempIdString),
          false
      );
      if(error.data?.errorCode !== 'SNAPSHOT_LIMIT_REACHED') {
        mutateQuota();
      }
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  return (
    <>
      <SignedIn>
        {!isSandbox && <QuotaProgressButton />}

        <div className="relative space-y-6">
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">Recent Snapshots</h1>
              {isSandbox && <Badge variant="outline" className="border-yellow-500 text-yellow-600"><Info className="h-3 w-3 mr-1" />Demo Mode</Badge>}
            </div>
            <Button 
              onClick={handleCreateSnapshot} 
              disabled={isCreatingSnapshot || (!isSandbox && (isQuotaLoading || isOverSnapshotLimit || isQuotaError))}
              variant="default"
              size="lg"
            >
              {isCreatingSnapshot ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              New Snapshot
            </Button>
          </div>

          {!isSandbox && <ActivationChecklist />}

          {isSandbox && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300">
              <Info className="inline h-4 w-4 mr-1.5 -mt-0.5" />
              You are in Demo Mode. Data is mocked and actions are simulated. 
              <Link href="/dashboard/settings" className="font-semibold underline hover:text-blue-600 dark:hover:text-blue-200 ml-1" onClick={() => setSandboxMode(false)}>
                Connect your real Notion workspace
              </Link> 
              to use live features.
            </div>
          )}

          {isLoadingSnapshots && (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {snapshotsError && !isSandbox && (
            <div className="text-center py-10 px-4 border border-dashed border-destructive rounded-lg text-destructive">
              <p className="text-xl font-semibold mb-1">Failed to load snapshots</p>
              <p className="text-sm">{snapshotsError.message || "Could not fetch snapshot data."}</p>
            </div>
          )}
          {snapshots && snapshots.length === 0 && !isLoadingSnapshots && (!snapshotsError || isSandbox) && (
            <EmptyState
              title={isSandbox ? "Demo Snapshots Area" : "No snapshots yet"}
              description={isSandbox ? "This is where your snapshots would appear. Try creating a demo snapshot!" : "Create your first backup..."}
              illustration="/assets/empty-backup.svg"
            >
              <Button onClick={handleCreateSnapshot} className="mt-6">
                <Plus className="mr-2 h-4 w-4" />
                {isSandbox ? "Try Demo Snapshot" : "Take my first snapshot"}
              </Button>
            </EmptyState>
          )}
          {snapshots && snapshots.length > 0 && !isLoadingSnapshots && (!snapshotsError || isSandbox) && (
            <SnapshotsTable snapshots={snapshots} />
          )}

          {!isSandbox && <Tour />}
          <CancellationSurveyModal 
            isOpen={isCancellationSurveyModalOpen} 
            onOpenChange={setIsCancellationSurveyModalOpen} 
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
      <PreviewSheet snapshotId={previewSnapshotIdForToast} open={isToastPreviewSheetOpen} onOpenChange={setIsToastPreviewSheetOpen} />
      <RestoreWizard snapshot={snapshotForRestoreToast} open={isRestoreWizardOpenFromToast} onOpenChange={setIsRestoreWizardOpenFromToast} onClose={() => setIsRestoreWizardOpenFromToast(false)} />
    </>
  );
} 