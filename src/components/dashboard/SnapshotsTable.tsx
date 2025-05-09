"use client";

import React, { useState, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge"; // Keep for status pill, can customize
import RestoreWizard from './RestoreWizard';
import UpgradeModal from '@/components/modals/UpgradeModal';
import type { Snapshot } from "@/types";
import { fetcher } from "@/lib/fetcher";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Inbox, Zap, MoreHorizontal, Plus, CheckCircle, Loader2, Copy, Download, Eye, RotateCcw, Trash2 } from 'lucide-react';
import { EmptyState } from "@/components/ui/EmptyState";
import { timeAgo } from "@/lib/utils"; // Keep for "Latest backup: X ago"
import { useQuota } from '@/hooks/useQuota';
import {
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import PreviewSheet from './PreviewSheet';
import { useToast } from "@/hooks/use-toast";
import dayjs from 'dayjs'; // Import dayjs
import { filesize } from 'filesize'; // Import filesize
import { cn } from "@/lib/utils";

// IconButton component as suggested
const IconButton: React.FC<{
  icon: React.ElementType;
  onClick?: () => void;
  href?: string;
  tooltip: string;
  disabled?: boolean;
}> = ({ icon: Icon, onClick, href, tooltip, disabled }) => {
  const content = (
    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onClick} disabled={disabled}>
      <Icon className="h-4 w-4" />
      <span className="sr-only">{tooltip}</span>
    </Button>
  );
  if (href && !onClick) {
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild><a href={href} target="_blank" rel="noopener noreferrer">{content}</a></TooltipTrigger>
          <TooltipContent><p>{tooltip}</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent><p>{tooltip}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// StatusPill component
const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  if (status === "Completed") {
    return <Badge variant="success" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />Saved</Badge>;
  }
  if (status === "Pending") {
    return <Badge variant="secondary" className="text-xs"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Pending</Badge>;
  }
  return <Badge variant="destructive" className="text-xs">{status}</Badge>; // For Failed or other statuses
};


const SnapshotsTable = () => {
  const { data: snapshots, error, isLoading } = useSWR<Snapshot[]>('/api/snapshots', fetcher, {
      revalidateOnFocus: false,
      onError: (err) => { console.error('SWR onError:', err); }, 
  });
  const { quota, isLoading: isQuotaLoading } = useQuota();
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [previewSnapshotId, setPreviewSnapshotId] = useState<string | null>(null);
  const [isPreviewSheetOpen, setIsPreviewSheetOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeTriggerFeature, setUpgradeTriggerFeature] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const { mutate: globalMutate } = useSWRConfig(); // For revalidating after create from empty state

  const timeSinceLastBackup = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return null;
    const sortedSnapshots = [...snapshots].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return timeAgo(new Date(sortedSnapshots[0].timestamp));
  }, [snapshots]);

  const handleRestoreClick = (snapshot: Snapshot) => {
    setSelectedSnapshot(snapshot);
    setIsWizardOpen(true);
  };
  const handleUpgradeClick = (feature?: string) => {
    setUpgradeTriggerFeature(feature || "advanced features");
    setIsUpgradeModalOpen(true);
  };
  const handlePreviewClick = (snapshot: Snapshot) => {
    setPreviewSnapshotId(snapshot.id);
    setIsPreviewSheetOpen(true);
  };
  const handleDownloadClick = (snapshotId: string) => {
    window.open(`/api/snapshots/${snapshotId}/download`, '_blank');
  };

  const triggerNewSnapshotFromEmptyState = async () => {
    try {
      await fetch('/api/snapshots/create', { method: 'POST' });
      toast({ title: "Snapshot Started", description: "Your first backup is in progress!"});
      globalMutate('/api/snapshots');
      globalMutate('/api/user/quota');
    } catch (err) {
      console.error("Error creating snapshot from empty state", err);
      toast({ title: "Error", description: "Could not start snapshot.", variant: "destructive" });
    }
  };

  if (isLoading || (snapshots === undefined && !error)) { // Handle initial undefined state for snapshots
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-[180px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
     return (
      <div className="flex flex-col items-center justify-center py-10 border border-dashed border-destructive rounded-lg text-destructive">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p className="text-xl font-semibold mb-1">Failed to load snapshots</p>
        <p className="text-sm">{error.message || "Could not fetch data from the server."}</p>
      </div>
    );
  }

  if (snapshots && snapshots.length === 0) {
    return (
      <EmptyState 
        title="No Snapshots Yet!"
        description="Create your first backup, then click Preview to inspect or Restore when needed."
        icon={<Inbox className="h-16 w-16 text-gray-300 dark:text-gray-600" />} 
      >
        <Button onClick={triggerNewSnapshotFromEmptyState} className="mt-6">
          <Plus className="mr-2 h-4 w-4" /> Create First Snapshot
        </Button>
      </EmptyState>
    );
  }
  
  // Main card grid display
  return (
    <div className="space-y-4">
      {timeSinceLastBackup && (
        <p className="text-sm text-muted-foreground">
          Latest backup: {timeSinceLastBackup}
        </p>
      )}
      <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {snapshots && snapshots.map((snap) => {
          const isRecent = dayjs().diff(dayjs(snap.timestamp), 'day') < 7;
          return (
            <li 
              key={snap.id} 
              className={cn(
                "rounded-xl bg-muted/20 dark:bg-zinc-800/60 p-5 shadow-sm hover:shadow-lg transition-shadow duration-300 border border-border/50 flex flex-col",
                isRecent && "border-primary/50 ring-1 ring-primary/30" // Accent for recent snapshots
              )}
            >
              <div className="flex justify-between items-start mb-2">
                  <h3 className="text-base font-semibold text-foreground">
                      {dayjs(snap.timestamp).format("MMM D · HH:mm")}
                  </h3>
                  <StatusPill status={snap.status} />
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                  {/* Assuming snap.sizeKB is in kilobytes */}
                  {filesize(snap.sizeKB * 1024, { base: 2, standard: "jedec" })} 
                  {/* Add page count here when available, e.g., `· ${snap.pageCount || 0} pages` */}
              </p>
              
              <div className="mt-auto pt-4 border-t border-border/30 flex justify-end gap-1">
                <IconButton icon={Eye} tooltip="Preview" onClick={() => handlePreviewClick(snap)} />
                <IconButton icon={Download} tooltip="Download Raw File" href={`/api/snapshots/${snap.id}/download`} />
                <IconButton icon={RotateCcw} tooltip="Restore Snapshot" onClick={() => handleRestoreClick(snap)} />
                {/* TODO: Add Delete IconButton later */}
              </div>
            </li>
          );
        })}
      </ul>
      <RestoreWizard snapshot={selectedSnapshot} open={isWizardOpen} onOpenChange={setIsWizardOpen} onClose={() => setIsWizardOpen(false)} />
      <UpgradeModal isOpen={isUpgradeModalOpen} onOpenChange={setIsUpgradeModalOpen} triggerFeature={upgradeTriggerFeature} currentPlanName={quota?.planName} />
      <PreviewSheet snapshotId={previewSnapshotId} open={isPreviewSheetOpen} onOpenChange={setIsPreviewSheetOpen} />
    </div>
  );
};

export default SnapshotsTable; 