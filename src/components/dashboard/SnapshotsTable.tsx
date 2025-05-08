"use client";

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
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
import type { Snapshot } from "@/types";
import { fetcher } from "@/lib/fetcher";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Inbox, Zap, MoreHorizontal } from 'lucide-react';
import { EmptyState } from "@/components/ui/EmptyState";
import { timeAgo } from "@/lib/utils";
import { useQuota } from '@/hooks/useQuota';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  const handleUpgradeClick = () => {
      console.log("Upgrade clicked from table action");
       window.location.href = '/pricing';
  };

  const handleRestoreClick = (snapshot: Snapshot) => {
    setSelectedSnapshot(snapshot);
    setIsWizardOpen(true);
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

  // Empty State
  if (snapshots !== undefined && snapshots.length === 0) {
    // console.log("Rendering: Empty State"); 
    return (
      <EmptyState 
        title="No snapshots yet!" 
        description="Use the '+' button in the bottom right to create your first snapshot backup."
        icon={<Inbox className="h-16 w-16 text-gray-300 dark:text-gray-600" />} 
      />
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
              <TableCaption>Your recent Notion workspace backups.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
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
                    {snapshot.status !== "Completed" ? (
                       <Badge variant={snapshot.status === "Failed" ? "destructive" : "secondary"}>
                         {snapshot.status}
                       </Badge>
                    ) : (
                       <span className="text-sm text-muted-foreground">Completed</span>
                    )}
                  </TableCell>
                   <TableCell className="text-xs text-muted-foreground">
                       {(snapshot.sizeKB / 1024).toFixed(2)} MB
                   </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleRestoreClick(snapshot)}>
                          Restore Snapshot
                        </DropdownMenuItem>
                        {isStarterPlan && (
                           <DropdownMenuItem onClick={handleUpgradeClick} className="text-yellow-600 focus:text-yellow-700 focus:bg-yellow-50">
                             <Zap className="h-4 w-4 mr-2"/> Priority Restore (Upgrade)
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