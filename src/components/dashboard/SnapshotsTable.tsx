"use client";

import React, { useState, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import RestoreWizard from './RestoreWizard';
import UpgradeModal from '@/components/modals/UpgradeModal';
import type { Snapshot } from "@/types";
import { fetcher } from "@/lib/fetcher";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Inbox, Zap, MoreHorizontal, Plus, CheckCircle, Loader2, Copy, Download, Eye, Trash2, RotateCcw } from 'lucide-react';
import { EmptyState } from "@/components/ui/EmptyState";
import { timeAgo } from "@/lib/utils";
import { useQuota } from '@/hooks/useQuota';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PreviewSheet from './PreviewSheet';

const SnapshotsTable = () => {
  // console.log("!!! SnapshotsTable function invoked !!!"); 
  // console.log("SnapshotsTable rendering..."); 

  const { data: snapshots, error, isLoading } = useSWR<Snapshot[]>('/api/snapshots', fetcher, {
      revalidateOnFocus: false,
      onError: (err) => { console.error('SWR onError:', err); }, 
      onSuccess: (data) => { /* console.log('SWR onSuccess Data:', data); */ }, // Keep success log minimal
  });

  const { quota, isLoading: isQuotaLoading } = useQuota();

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeTriggerFeature, setUpgradeTriggerFeature] = useState<string | undefined>(undefined);
  const [previewSnapshotId, setPreviewSnapshotId] = useState<string | null>(null);
  const [isPreviewSheetOpen, setIsPreviewSheetOpen] = useState(false);

  const { toast } = useToast();

  // console.log('SWR State:', { isLoading, error, snapshots }); 

  // Calculate time since last backup
  const timeSinceLastBackup = useMemo(() => {
    if (!snapshots || snapshots.length === 0) {
      return null;
    }
    // Assuming snapshots are sorted newest first by the API or sorted here
    const sortedSnapshots = [...snapshots].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const lastTimestamp = sortedSnapshots[0].timestamp;
    return timeAgo(new Date(lastTimestamp)); // Use a helper like timeAgo
  }, [snapshots]);

  const handleUpgradeClick = (feature?: string) => {
    setUpgradeTriggerFeature(feature || "advanced features");
    setIsUpgradeModalOpen(true);
  };

  const handleRestoreClick = (snapshot: Snapshot) => {
    setSelectedSnapshot(snapshot);
    setIsWizardOpen(true);
  };

  const handleCopySnapshotLink = (snapshotId: string) => {
    // For now, let's assume the link just points to the dashboard
    // In the future, this could be a deep link to a specific snapshot view
    const snapshotUrl = `${window.location.origin}/dashboard#snapshot-${snapshotId.replace(/[^a-zA-Z0-9-_]/g, '-')}`;
    navigator.clipboard.writeText(snapshotUrl)
      .then(() => {
        toast({ title: "Link Copied", description: "Snapshot link copied to clipboard." });
      })
      .catch(err => {
        console.error("Failed to copy snapshot link:", err);
        toast({ title: "Error", description: "Could not copy link.", variant: "destructive" });
      });
  };

  const handlePreviewClick = (snapshot: Snapshot) => {
    setPreviewSnapshotId(snapshot.id);
    setIsPreviewSheetOpen(true);
  };
  
  const handleDownloadClick = (snapshotId: string) => {
    // Construct the full URL to the download API endpoint
    // Assuming snapshotId is the full filePath like 'userId/snap_....json.gz'
    window.open(`/api/snapshots/${snapshotId}/download`, '_blank');
  };

  // Function to trigger snapshot creation (can be passed to EmptyState)
  // This assumes handleCreateSnapshot from DashboardPage is not easily accessible here
  // or we want a more direct action.
  // For a cleaner approach, consider a global state/context for this action.
  const triggerNewSnapshot = async () => {
      console.log("Create First Snapshot clicked from empty state");
      // Directly call the API endpoint or use a shared optimistic update logic if available
      // This is a simplified call for now, ideally reuse DashboardPage logic
      try {
        await fetch('/api/snapshots/create', { method: 'POST' });
        // Optionally show a toast, though the optimistic update in DashboardPage would handle it if on same view
        // Revalidate data to update table
        useSWRConfig().mutate('/api/snapshots');
        useSWRConfig().mutate('/api/user/quota');
      } catch (err) {
        console.error("Error creating snapshot from empty state", err);
        // Show error toast if useToast is available here
      }
  };

  // Loading State
  if (isLoading) {
    // console.log("Rendering: Loading State"); 
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  // Error State
  if (error) {
    // console.log("Rendering: Error State"); 
     return (
      <div className="flex flex-col items-center justify-center py-10 border border-dashed border-destructive rounded-lg text-destructive">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p className="text-xl font-semibold mb-1">Failed to load snapshots</p>
        <p className="text-sm">{error.message || "Could not fetch data from the server."}</p>
      </div>
    );
  }

  // Empty State or Sample Row
  if (snapshots !== undefined && snapshots.length === 0) {
    const sampleSnapshot: Snapshot = {
      id: "sample-snapshot-id",
      timestamp: new Date().toISOString(),
      sizeKB: 1234, // Approx 1.2 MB
      status: "Completed",
    };
    return (
      <div className="snapshots-table-sample">
        <EmptyState 
          title="No Snapshots Yet!"
          description="Create your first backup, then click Preview to inspect or Restore when needed."
          icon={<Inbox className="h-12 w-12 text-gray-300 dark:text-gray-600" />} 
        >
          <Button onClick={triggerNewSnapshot} className="mt-4">
            <Plus className="mr-2 h-4 w-4" /> Create First Snapshot
          </Button>
        </EmptyState>
        <Table className="mt-4"> {/* Add margin if button above is removed */}
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Size</TableHead> 
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow key={sampleSnapshot.id} className="opacity-70">
                  <TableCell className="font-medium">
                    {new Date(sampleSnapshot.timestamp).toLocaleString()} (Sample)
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-green-600 flex items-center">
                        <CheckCircle className="h-4 w-4 mr-1.5 flex-shrink-0" /> Saved
                    </span>
                  </TableCell>
                   <TableCell className="text-xs text-muted-foreground">
                       {(sampleSnapshot.sizeKB / 1024).toFixed(2)} MB
                   </TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0 cursor-not-allowed" disabled>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>This is a sample snapshot. Create one to enable actions.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
            </TableBody>
        </Table>
      </div>
    );
  }

  // Data Loaded State
  if (Array.isArray(snapshots) && snapshots.length > 0) {
      const isStarterPlan = !isQuotaLoading && quota?.planName.toLowerCase() === 'starter';
      return (
        <div className="snapshots-table"> 
            {/* Display Time Since Last Backup */}
            {timeSinceLastBackup && (
              <p className="text-sm text-muted-foreground mb-2">
                Latest backup: {timeSinceLastBackup}
              </p>
            )}
            <Table>
              <TableCaption>Your recent Notion workspace snapshots.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {snapshots.map((snapshot, index) => (
                <TableRow key={snapshot.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {new Date(snapshot.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {snapshot.status === "Completed" ? (
                       <span className="text-sm text-green-600 flex items-center">
                         <CheckCircle className="h-4 w-4 mr-1.5 flex-shrink-0" /> Saved
                       </span>
                    ) : snapshot.status !== "Pending" ? (
                       <Badge variant={snapshot.status === "Failed" ? "destructive" : "secondary"}>
                         {snapshot.status}
                       </Badge>
                    ) : (
                       <span className="text-sm text-muted-foreground flex items-center">
                         <Loader2 className="h-4 w-4 mr-1.5 flex-shrink-0 animate-spin" />
                         {snapshot.status}...
                       </span>
                    )}
                  </TableCell>
                   <TableCell className="text-xs text-muted-foreground">
                       {(snapshot.sizeKB / 1024).toFixed(2)} MB
                   </TableCell>
                  <TableCell className="text-right space-x-1">
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreviewClick(snapshot)}>
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Preview</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Preview Snapshot</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleRestoreClick(snapshot)}>
                            <RotateCcw className="h-4 w-4" />
                            <span className="sr-only">Restore</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Restore Snapshot</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                           <span className="sr-only">More actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleCopySnapshotLink(snapshot.id)}>
                          <Copy className="h-4 w-4 mr-2" /> Copy Link
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownloadClick(snapshot.id)}>
                          <Download className="h-4 w-4 mr-2" /> Download Raw File
                        </DropdownMenuItem>
                        {isStarterPlan && (
                           <DropdownMenuItem onClick={() => handleUpgradeClick("Priority Restore")} className="text-yellow-600 focus:text-yellow-700 focus:bg-yellow-50">
                             <Zap className="h-4 w-4 mr-2"/> Priority Features (Upgrade)
                           </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
            <RestoreWizard 
              snapshot={selectedSnapshot}
              open={isWizardOpen}
              onOpenChange={setIsWizardOpen}
              onClose={() => setIsWizardOpen(false)}
            />
            <UpgradeModal 
              isOpen={isUpgradeModalOpen} 
              onOpenChange={setIsUpgradeModalOpen} 
              triggerFeature={upgradeTriggerFeature}
              currentPlanName={quota?.planName}
            />
            <PreviewSheet snapshotId={previewSnapshotId} open={isPreviewSheetOpen} onOpenChange={setIsPreviewSheetOpen} />
        </div>
      );
  } 

  // Fallback if none of the above conditions are met (e.g., snapshots is initially undefined)
  // console.log("Rendering: Fallback (Initial/Loading)");
  // Render loading state initially while `snapshots` is undefined
   return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
};

export default SnapshotsTable; 