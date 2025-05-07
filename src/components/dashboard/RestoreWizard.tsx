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

interface RestoreWizardProps {
  snapshot: Snapshot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

interface RestorableItem {
  id: string;
  name: string;
  type: 'database' | 'page';
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

const RestoreWizard: React.FC<RestoreWizardProps> = ({ snapshot, open, onOpenChange, onClose }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [restorableItems, setRestorableItems] = useState<RestorableItem[]>([]);
  const [selectAllTargets, setSelectAllTargets] = useState(true);
  
  const [progressValue, setProgressValue] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Awaiting connection to restore service...");
  const [isRestoreInProgress, setIsRestoreInProgress] = useState(false);
  const { toast } = useToast();
  const restoreStartTimeRef = useRef<number | null>(null);

  const [currentRestoreId, setCurrentRestoreId] = useState<string | null>(null);
  const { mutate } = useSWRConfig();
  const { lastEvent, isConnected } = useRestoreProgress(currentRestoreId ?? undefined);

  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setIsRestoreInProgress(false);
      setProgressValue(0);
      setStatusMessage("Awaiting connection to restore service...");
      setCurrentRestoreId(null);
      restoreStartTimeRef.current = null;

      if (snapshot) {
        const itemsFromSnapshot: Omit<RestorableItem, 'selected'>[] = [
          { id: 'db_tasks_123', name: 'Company Tasks Q3', type: 'database' },
          { id: 'db_projects_456', name: 'Project Phoenix Docs', type: 'database' },
          { id: 'page_roadmap_789', name: 'Product Roadmap 2024', type: 'page' },
          { id: 'page_onboarding_abc', name: 'New Hire Onboarding Guide', type: 'page' },
          { id: 'db_fin_xyz', name: 'Financials Q3', type: 'database' },
          { id: 'page_mkt_def', name: 'Marketing Campaign Plan', type: 'page' },
        ];
        setRestorableItems(itemsFromSnapshot.map(item => ({ ...item, selected: true })));
        setSelectAllTargets(true);
      } else {
        setRestorableItems([]);
      }
    } else {
      setIsRestoreInProgress(false);
      setCurrentRestoreId(null);
    }
  }, [open, snapshot]);

  useEffect(() => {
    if (!lastEvent) {
      if (currentRestoreId && !isConnected && isRestoreInProgress) {
        setStatusMessage("Connecting to restore stream...");
      } else if (!currentRestoreId && !isRestoreInProgress) {
        setStatusMessage("Awaiting initiation...");
      }
      return;
    }

    if (lastEvent.type === 'connected') {
      setStatusMessage(lastEvent.message);
    } else if (lastEvent.type === 'progress') {
      console.log("RestoreWizard: Received progress event in useEffect", lastEvent);
      setProgressValue(lastEvent.percent);
      setStatusMessage(lastEvent.message);
      setIsRestoreInProgress(true);
    } else if (lastEvent.type === 'complete') {
      setProgressValue(100);
      setStatusMessage(lastEvent.message || "Restore completed successfully!");
      toast({ title: "Restore Complete", description: lastEvent.message || "Your workspace has been successfully restored." });
      mutate('/api/snapshots');
      setIsRestoreInProgress(false);
      if (restoreStartTimeRef.current) {
        const durationMs = Date.now() - restoreStartTimeRef.current;
        posthog.capture('restore_completed', { duration_ms: durationMs, success: true });
        restoreStartTimeRef.current = null;
      }
      setCurrentRestoreId(null);
    } else if (lastEvent.type === 'error') {
      setStatusMessage(`Error: ${lastEvent.error}`);
      toast({ title: "Restore Failed", description: lastEvent.error, variant: "destructive" });
      setIsRestoreInProgress(false);
      if (restoreStartTimeRef.current) {
        const durationMs = Date.now() - restoreStartTimeRef.current;
        posthog.capture('restore_completed', { duration_ms: durationMs, success: false, error: lastEvent.error });
        restoreStartTimeRef.current = null;
      }
      setCurrentRestoreId(null);
    }
  }, [lastEvent, isConnected, currentRestoreId, toast, mutate, isRestoreInProgress]);

  useEffect(() => {
    if (restorableItems.length > 0) {
      const allSelected = restorableItems.every(item => item.selected);
      if (allSelected !== selectAllTargets) {
        setSelectAllTargets(allSelected);
      }
    } else if (selectAllTargets) {
        setSelectAllTargets(false);
    }
  }, [restorableItems, selectAllTargets]);

  if (!snapshot) {
    return null;
  }

  const handleBeginRestore = async () => {
    if (!snapshot || currentRestoreId) return;

    const selectedTargetIds = restorableItems
      .filter(item => item.selected)
      .map(i => i.id);

    console.log("Attempting to initiate restore for snapshot:", snapshot.id, "with targets:", selectedTargetIds);
    
    setProgressValue(0);
    setStatusMessage("Initiating restore..."); 
    setIsRestoreInProgress(true);
    restoreStartTimeRef.current = Date.now();
    posthog.capture('restore_started', { snapshot_id: snapshot.id, target_count: selectedTargetIds.length });

    try {
      const response = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          snapshotId: snapshot.id, 
          targets: selectedTargetIds 
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

  const goToNextStep = () => setCurrentStep((prev) => Math.min(prev + 1, 3));
  const goToPreviousStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  const handleItemToggle = (itemId: string) => {
    setRestorableItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleSelectAllToggle = () => {
    const newSelectAllState = !selectAllTargets;
    setSelectAllTargets(newSelectAllState);
    setRestorableItems(items => items.map(item => ({ ...item, selected: newSelectAllState })));
  };

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
      case 2:
        return (
          <div>
            <DialogDescription className="text-sm text-muted-foreground">Step 2: Select Items to Restore</DialogDescription>
            <div className="flex items-center space-x-2 my-4 p-2 border-b">
              <Checkbox 
                id="select-all-targets"
                checked={selectAllTargets}
                onCheckedChange={handleSelectAllToggle}
                disabled={isRestoreInProgress}
              />
              <label
                htmlFor="select-all-targets"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Select All / Deselect All
              </label>
            </div>
            <ScrollArea className="h-[200px] w-full rounded-md border p-2">
              {restorableItems.length > 0 ? (
                restorableItems.map((item) => (
                  <div key={item.id} className="flex items-center space-x-2 mb-1 p-1.5 hover:bg-muted/50 rounded-md">
                    <Checkbox 
                      id={`item-${item.id}`}
                      checked={item.selected}
                      onCheckedChange={() => handleItemToggle(item.id)}
                      disabled={isRestoreInProgress}
                    />
                    <label 
                      htmlFor={`item-${item.id}`}
                      className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {item.name} <span className="text-xs text-muted-foreground">({item.type})</span>
                    </label>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No restorable items found in this snapshot's metadata.</p>
              )}
            </ScrollArea>
            <p className="text-xs text-muted-foreground mt-2">
              Selected {restorableItems.filter(item => item.selected).length} of {restorableItems.length} items to restore.
            </p>
          </div>
        );
      case 3:
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
            <p className="text-sm text-muted-foreground mb-2">Selected targets for restore:</p>
            <ScrollArea className="h-[80px] w-full rounded-md border p-2 text-xs bg-muted/50">
              {restorableItems.filter(item => item.selected).length > 0 ? (
                restorableItems.filter(item => item.selected).map(item => item.name).join(", ")
              ) : (
                "Full snapshot restore (no specific targets selected)."
              )}
            </ScrollArea>
          </div>
        );
      default:
        return null;
    }
  };

  const isDone = progressValue === 100 && !isRestoreInProgress;

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
                      disabled={isRestoreInProgress || (currentStep === 2 && restorableItems.filter(item => item.selected).length === 0)}
                    >
                      Next
                    </Button>
                  )}

                  {currentStep === 3 && !isDone && (
                    <Button 
                      onClick={handleBeginRestore}
                      disabled={isRestoreInProgress || (restorableItems.filter(item => item.selected).length === 0) || !!currentRestoreId}
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