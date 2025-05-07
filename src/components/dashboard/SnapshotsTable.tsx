"use client";

import React, { useState } from 'react';
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
import { AlertCircle, Inbox } from 'lucide-react';
import { EmptyState } from "@/components/ui/EmptyState";

const SnapshotsTable = () => {
  // console.log("!!! SnapshotsTable function invoked !!!"); 
  // console.log("SnapshotsTable rendering..."); 

  const { data: snapshots, error, isLoading } = useSWR<Snapshot[]>('/api/snapshots', fetcher, {
      revalidateOnFocus: false,
      onError: (err) => { console.error('SWR onError:', err); }, 
      onSuccess: (data) => { /* console.log('SWR onSuccess Data:', data); */ }, // Keep success log minimal
  });

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);

  // console.log('SWR State:', { isLoading, error, snapshots }); 

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
      // console.log("Rendering: Data Table State"); 
      return (
        <div className="snapshots-table"> 
            <Table>
            <TableCaption>A list of your recent Notion snapshots.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.map((snapshot, index) => (
                <TableRow key={snapshot.id}>
                  <TableCell className="font-medium">
                    {new Date(snapshot.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>{(snapshot.sizeKB / 1024).toFixed(2)} MB</TableCell>
                  <TableCell>
                    <Badge variant={snapshot.status === "Completed" ? "default" : "secondary"}>
                      {snapshot.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      className={index === 0 ? "restore-button" : ""} 
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreClick(snapshot)}
                    >
                      Restore
                    </Button>
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