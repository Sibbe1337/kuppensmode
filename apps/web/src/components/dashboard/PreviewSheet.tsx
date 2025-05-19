"use client";

import React from 'react';
import {
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription, 
  SheetClose
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, FileText, Database, ChevronRight, ChevronDown } from 'lucide-react';

interface SnapshotItemPreview {
  id: string;
  title: string;
  type: string;
}

interface PreviewSheetProps {
  snapshotId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PreviewSheet: React.FC<PreviewSheetProps> = ({ snapshotId, open, onOpenChange }) => {
  const { data, error, isLoading } = useSWR<{ items: SnapshotItemPreview[] } | null>(
    // Only fetch if a snapshotId is provided and the sheet is open
    snapshotId && open ? `/api/snapshots/${snapshotId}/preview` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const CollapsibleItem: React.FC<{ item: SnapshotItemPreview }> = ({ item }) => {
    // In a real version, this might have its own state for open/closed if items are deeply nested
    // For a simple list, we just display it.
    const Icon = item.type === 'database' ? Database : FileText;
    return (
      <div className="ml-4 py-2 border-b border-border/50 last:border-b-0">
        <div className="flex items-center">
          <Icon className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
          <span className="text-sm truncate" title={item.title}>{item.title}</span>
        </div>
        {/* <p className="text-xs text-muted-foreground pl-6">ID: {item.id}</p> */}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Snapshot Preview</SheetTitle>
          <SheetDescription>
            {snapshotId ? `Contents of snapshot (top level): ${snapshotId.split('/').pop()?.replace('.json.gz','')}` : "No snapshot selected."}
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="space-y-2 mt-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        )}
        {error && (
          <div className="text-destructive text-sm p-3 border border-destructive/30 rounded-md">
            Error loading preview: {error.message}
          </div>
        )}
        {data && data.items && (
          <div>
            {data.items.length === 0 && <p className="text-sm text-muted-foreground">No items found in this snapshot.</p>}
            {data.items.map(item => <CollapsibleItem key={item.id} item={item} />)}
          </div>
        )}
        {!isLoading && !error && !data && snapshotId && (
             <p className="text-sm text-muted-foreground">No preview data available.</p>
        )}

      </SheetContent>
    </Sheet>
  );
};

export default PreviewSheet; 