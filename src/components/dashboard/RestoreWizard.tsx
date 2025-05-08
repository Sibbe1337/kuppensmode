"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogOverlay,
  DialogContent as ShadDialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import type { Snapshot } from "@/types";
import { useToast } from "@/hooks/use-toast";
import posthog from 'posthog-js';
import { Loader2 } from 'lucide-react';
import { useSWRConfig } from 'swr';
import { useRestoreProgress, RestoreEvent } from '@/hooks/useRestoreProgress';
import { fetcher } from "@/lib/fetcher";
import useSWR from 'swr';

interface RestoreWizardProps {
  snapshot: Snapshot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

interface RestorableItem {
  id: string;
  name: string;
  type: 'database' | 'page' | string;
  selected: boolean;
}

const modalVariants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95, 
    y: -20 
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.2, ease: "easeOut" }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.15, ease: "easeIn" }
  }
};

// Helper to extract the base snapshot ID (e.g., snap_...) from a full path/filename
const getCleanSnapshotId = (fullId: string | undefined | null): string | null => {
    if (!fullId) return null;
    // Assumes format like "userId/snap_timestamp.json.gz" or just "snap_timestamp.json.gz"
    const parts = fullId.split('/');
    const filename = parts[parts.length - 1];
    // Remove extension
    return filename?.replace('.json.gz', '') ?? null;
};

const RestoreWizard: React.FC<RestoreWizardProps> = ({ snapshot, open, onOpenChange, onClose }) => {
  const [currentStep, setCurrentStep] = useState(1);
  // const [selectAllTargets, setSelectAllTargets] = useState(true); // Temporarily unused
  // const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set()); // Temporarily unused

  const [progressValue, setProgressValue] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Awaiting connection to restore service...");
  const [isRestoreInProgress, setIsRestoreInProgress] = useState(false);
  const { toast } = useToast();
  const restoreStartTimeRef = useRef<number | null>(null);

  const [currentRestoreId, setCurrentRestoreId] = useState<string | null>(null);
  const { mutate } = useSWRConfig(); // Need mutate for SSE complete handler
  const { lastEvent, isConnected } = useRestoreProgress(currentRestoreId ?? undefined); // *** UNCOMMENTED THIS HOOK ***

  // Use the helper function to clean the ID for the URL
  const cleanSnapshotId = snapshot ? getCleanSnapshotId(snapshot.id) : null;
  const snapshotContentUrl = cleanSnapshotId ? `/api/snapshots/${cleanSnapshotId}/content` : null;
  // const { data: fetchedItems, error: fetchItemsError, isLoading: isLoadingItems } = useSWR<
  //   { id: string; name: string; type: 'database' | 'page' | string }[]
  // >(
  //   open && currentStep === 2 && snapshotContentUrl ? snapshotContentUrl : null,
  //   fetcher,
  //   { 
  //       revalidateOnFocus: false, 
  //       shouldRetryOnError: false,
  //       onError: (err) => console.error("Error fetching snapshot content:", err)
  //   }
  // );
  
  // Assign placeholder values since hook is commented out
  const fetchedItems = undefined;
  const fetchItemsError = undefined;
  const isLoadingItems = false;

  // --- Temporarily Commented Out Derived State ---
  /*
  const restorableItems: RestorableItem[] = React.useMemo(() => {
    if (!fetchedItems) return [];
    return fetchedItems.map(item => ({
        ...item,
        selected: selectedItemIds.has(item.id)
    }));
  }, [fetchedItems, selectedItemIds]);
  */
 const restorableItems: RestorableItem[] = []; // Use empty array
 const selectedItemIds = new Set<string>(); // Use empty set
 const selectAllTargets = false; // Set default 

  // --- Temporarily Commented Out Effect depending on fetchedItems ---
  /*
  useEffect(() => {
    if (open) {
      // ... Reset logic ...
      if (fetchedItems && selectedItemIds.size === 0) {
          const initialIds = new Set(fetchedItems.map(item => item.id));
          setSelectedItemIds(initialIds);
          setSelectAllTargets(true);
      }
       else if (snapshot && !fetchedItems) {
            setSelectedItemIds(new Set());
            setSelectAllTargets(true);
       }
    } else {
      // ... Reset logic ...
      setSelectedItemIds(new Set());
      setSelectAllTargets(true);
    }
  }, [open, snapshot, fetchedItems]);
 */

 // --- Simplified useEffect for opening/closing --- 
  useEffect(() => {
    if (open) {
      // Reset state when dialog opens
      setCurrentStep(1);
      setIsRestoreInProgress(false);
      setProgressValue(0);
      setStatusMessage("Awaiting connection to restore service...");
      setCurrentRestoreId(null);
      restoreStartTimeRef.current = null;
    } else {
      // Reset when dialog closes
      setIsRestoreInProgress(false);
      setCurrentRestoreId(null);
    }
  }, [open]); // Only depend on open for this simplified version


  // --- useEffect for useRestoreProgress events (KEEP THIS) --- 
  useEffect(() => {
       if (!lastEvent) {
         // ... Handle initial connection states ...
         return;
       }
       // ... Handle progress, complete, error events from lastEvent ...
       // (This part uses `mutate`, so uncommented useSWRConfig above)
  }, [lastEvent, isConnected, currentRestoreId, toast, mutate, isRestoreInProgress]);

  // --- Temporarily Commented Out Effect for selectAll checkbox ---
  /*
  useEffect(() => {
      if (restorableItems.length > 0) {
          const allSelected = restorableItems.length === selectedItemIds.size && restorableItems.every(item => selectedItemIds.has(item.id));
          if (allSelected !== selectAllTargets) {
              setSelectAllTargets(allSelected);
          }
      } else if (selectAllTargets) {
          setSelectAllTargets(false);
      }
  }, [selectedItemIds, restorableItems, selectAllTargets]);
  */

  if (!snapshot) {
    return null;
  }

  const handleBeginRestore = async () => {
    if (!snapshot || currentRestoreId) return;

    // Since we removed item selection, we pass null for targets (full restore)
    const selectedIdsArray: string[] = []; 
    console.log("Attempting to initiate restore for snapshot:", snapshot.id, "(Full Restore - No Targets Selected)");
    
    setCurrentStep(3); 
    setProgressValue(0);
    setStatusMessage("Initiating restore..."); 
    setIsRestoreInProgress(true);
    restoreStartTimeRef.current = Date.now();
    posthog.capture('restore_started', { snapshot_id: snapshot.id, target_count: selectedIdsArray.length });

    try {
      const response = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          snapshotId: snapshot.id, 
          targets: null // Send null targets for now
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to start restore process.' }));
        throw new Error(errorData.message || 'Failed to start restore process.');
      }
      
      const responseData = await response.json();
      if (responseData.restoreId) {
        setCurrentRestoreId(responseData.restoreId);
        toast({
          title: "Restore Process Sent",
          description: `Restoring snapshot ${snapshot.id}. Monitoring progress...`,
        });
      } else {
        throw new Error("Restore initiated, but a restore ID was not received from the server.");
      }

    } catch (error: any) {
      console.error("Failed to initiate restore:", error);
      setStatusMessage(`Error: ${error.message || "Could not connect to the restore service."}`);
      toast({
        title: "Error Starting Restore",
        description: error.message || "Could not connect to the restore service.",
        variant: "destructive",
      });
      setIsRestoreInProgress(false);
      setProgressValue(0);
      if (restoreStartTimeRef.current) {
        const durationMs = Date.now() - restoreStartTimeRef.current;
        posthog.capture('restore_failed_to_initiate', { duration_ms: durationMs, error: error.message });
        restoreStartTimeRef.current = null;
      }
    }
  };

  const goToNextStep = () => {
    console.log('goToNextStep called! Current step:', currentStep);
    setCurrentStep((prev) => {
        const nextStep = Math.min(prev + 1, 3);
        console.log('Setting currentStep to:', nextStep);
        return nextStep;
    });
  };
  const goToPreviousStep = () => {
     console.log('goToPreviousStep called! Current step:', currentStep);
      setCurrentStep((prev) => {
          const prevStep = Math.max(prev - 1, 1);
          console.log('Setting currentStep to:', prevStep);
          return prevStep;
      });
  }

  // --- Temporarily Remove Item Selection Handlers ---
  /*
  const handleItemToggle = (itemId: string) => {
     // ... 
  };

  const handleSelectAllToggle = () => {
     // ... 
  };
  */

  const effectiveOnClose = () => {
    onOpenChange(false);
    if (onClose) onClose(); 
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div>
            <DialogDescription className="text-sm text-muted-foreground">Step 1: Confirm Snapshot Details</DialogDescription>
            <p className="my-2 text-sm">You are about to restore the following snapshot:</p>
            <ul className="list-disc list-inside my-4 p-4 bg-muted rounded-md text-sm">
              <li><strong>ID:</strong> {snapshot.id}</li>
              <li><strong>Date:</strong> {new Date(snapshot.timestamp).toLocaleString()}</li>
              <li><strong>Size:</strong> {(snapshot.sizeKB / 1024).toFixed(2)} MB</li>
              <li><strong>Status:</strong> {snapshot.status}</li>
            </ul>
            <p className="text-sm">Please ensure this is the correct snapshot before proceeding.</p>
          </div>
        );
      case 2: // --- Simplified Step 2 --- 
        return (
          <div>
            <DialogDescription className="text-sm text-muted-foreground">Step 2: Select Items to Restore</DialogDescription>
            <p className="my-10 text-center text-muted-foreground">Item selection temporarily disabled for debugging.</p>
          </div>
        );
      case 3: // --- Simplified Step 3 Display (No target list) ---
        return (
          <div>
            <DialogDescription className="text-sm text-muted-foreground">Step 3: Restore Progress</DialogDescription>
            <div className="my-4 space-y-3">
              <p className="text-sm">Status: <span className={`font-semibold ${lastEvent?.type === 'error' ? 'text-destructive' : ''}`}>{statusMessage}</span></p>
              <Progress value={progressValue} className="w-full" />
              {progressValue === 100 && lastEvent?.type === 'complete' && (
                <p className="text-green-600 font-semibold text-sm">Restore completed successfully!</p>
              )}
              {isRestoreInProgress && progressValue < 100 && (
                 <p className="text-xs text-muted-foreground">Restoring snapshot <strong>{snapshot.id}</strong>...</p>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const isDone = progressValue === 100 && !isRestoreInProgress;

  console.log("RestoreWizard: Last Event on Render:", lastEvent);
  console.log("RestoreWizard: Rendering with progressValue =", progressValue);

  return (
    <AnimatePresence>
      {open && (
        <Dialog open={open} onOpenChange={effectiveOnClose}> 
          <ShadDialogContent 
            forceMount
            className="sm:max-w-[600px] overflow-hidden p-0 bg-transparent border-none shadow-none"
          >
            <motion.div
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={modalVariants}
              className="sm:max-w-[600px] bg-background rounded-lg shadow-lg flex flex-col"
            >
              <DialogHeader className="p-6 pb-4 border-b">
                <DialogTitle className="text-xl">Restore Snapshot Wizard - Step {currentStep} of 3</DialogTitle>
              </DialogHeader>
              <div className="p-6 py-4 min-h-[300px] flex-grow">
                {renderStepContent()}
              </div>
              <DialogFooter className="sm:justify-between p-6 pt-4 border-t bg-muted/30">
                <div>
                  {currentStep > 1 && !isRestoreInProgress && (
                    <Button variant="outline" onClick={goToPreviousStep} disabled={isDone}>
                      Previous
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={effectiveOnClose} disabled={isRestoreInProgress && !isDone}>
                    Cancel
                  </Button>
                  
                  {currentStep < 3 && (
                    <Button 
                      onClick={goToNextStep}
                      disabled={isRestoreInProgress}
                    >
                      Next
                    </Button>
                  )}

                  {currentStep === 3 && !isDone && (
                    <Button 
                      onClick={handleBeginRestore}
                      disabled={isRestoreInProgress || !!currentRestoreId}
                    >
                      {isRestoreInProgress && !currentRestoreId && <Loader2 className="mr-2 h-4 w-4 animate-spin" /> }
                      {isRestoreInProgress ? (currentRestoreId ? "Restoring..." : "Initiating...") : "Begin Restore"}
                    </Button>
                  )}

                  {isDone && currentStep === 3 && (
                      <Button type="button" variant="default" onClick={effectiveOnClose}>
                          Close
                      </Button>
                  )}
                </div>
              </DialogFooter>
            </motion.div>
          </ShadDialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
};

export default RestoreWizard; 