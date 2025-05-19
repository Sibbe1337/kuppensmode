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
import { Loader2, Plus, Copy, Check, AlertTriangle } from 'lucide-react';
import { useSWRConfig } from 'swr';
import { useRestoreProgress, RestoreEvent } from '@/hooks/useRestoreProgress';
import { fetcher } from "@/lib/fetcher";
import useSWR from 'swr';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import NotionPageSearchCombobox, { NotionPageInfo } from './NotionPageSearchCombobox';
import { useSandbox } from '@/hooks/useSandbox';
import { apiClient } from '@/lib/apiClient';

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

// Helper to truncate text
const truncateText = (text: string, maxLength: number = 20): string => {
  if (text.length <= maxLength) return text;
  const start = text.substring(0, maxLength / 2);
  const end = text.substring(text.length - maxLength / 2);
  return `${start}...${end}`;
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
  const [statusMessage, setStatusMessage] = useState("Getting things ready...");
  const [isRestoreInProgress, setIsRestoreInProgress] = useState(false);
  const { toast } = useToast();
  const restoreStartTimeRef = useRef<number | null>(null);

  const [currentRestoreId, setCurrentRestoreId] = useState<string | null>(null);
  const { mutate } = useSWRConfig(); // Need mutate for SSE complete handler
  const { lastEvent, isConnected } = useRestoreProgress(currentRestoreId ?? undefined); // *** UNCOMMENTED THIS HOOK ***

  const [copiedId, setCopiedId] = useState(false);
  const [restoreTargetType, setRestoreTargetType] = useState<'new_page' | 'specific_page' | 'in_place'>('new_page');
  const [targetParentPageId, setTargetParentPageId] = useState<string | null>(null);
  const [targetParentPageTitle, setTargetParentPageTitle] = useState<string | null>(null);

  const isSandbox = useSandbox(); // Use the hook

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
      setStatusMessage("Getting things ready...");
      setCurrentRestoreId(null);
      restoreStartTimeRef.current = null;
      setRestoreTargetType('new_page');
      setTargetParentPageId(null);
      setTargetParentPageTitle(null);
    } else {
      // Reset when dialog closes
      setIsRestoreInProgress(false);
      setCurrentRestoreId(null);
    }
  }, [open]); // Only depend on open for this simplified version


  // --- useEffect for useRestoreProgress events (KEEP THIS) --- 
  useEffect(() => {
       if (!lastEvent) {
         if (currentRestoreId && !isConnected && isRestoreInProgress) {
           setStatusMessage("Connecting to restore monitor...");
         } else if (!currentRestoreId && !isRestoreInProgress && currentStep === 3) {
           setStatusMessage("Initiating restore process...");
         }
         return;
       }

       if (lastEvent.type === 'connected') {
         setStatusMessage("Connection established. Starting restore...");
       } else if (lastEvent.type === 'progress') {
         let userFriendlyMessage = `Restoring your items... (${lastEvent.percent}%)`;
         const technicalMessage = lastEvent.message.toLowerCase();

         if (technicalMessage.includes("downloading snapshot")) {
            userFriendlyMessage = "Downloading your backup data...";
         } else if (technicalMessage.includes("decompressing")) {
            userFriendlyMessage = "Preparing backup files...";
         } else if (technicalMessage.includes("parsing json")) {
            userFriendlyMessage = "Reading backup structure...";
         } else if (technicalMessage.includes("queueing notion api calls")) {
            userFriendlyMessage = "Preparing to write to Notion...";
         } else if (technicalMessage.includes("restoring item") || technicalMessage.includes("creating database") || technicalMessage.includes("creating page")) {
            userFriendlyMessage = `Restoring items to Notion... (${lastEvent.percent}%)`;
         }
         
         console.log("RestoreWizard: Received progress event in useEffect", lastEvent);
         setProgressValue(lastEvent.percent);
         setStatusMessage(userFriendlyMessage);
         setIsRestoreInProgress(true);
       } else if (lastEvent.type === 'complete') {
         setProgressValue(100);
         setStatusMessage("All items restored successfully!");
         setIsRestoreInProgress(false);
       } else if (lastEvent.type === 'error') {
         setStatusMessage(`Restore failed: ${lastEvent.error}. Please try again or contact support.`);
         setIsRestoreInProgress(false);
       }
  }, [lastEvent, isConnected, currentRestoreId, toast, mutate, isRestoreInProgress, currentStep]);

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

    // const selectedIdsArray: string[] = Array.from(selectedItemIds); // Re-enable if item selection is used
    const selectedIdsArray: string[] = []; 
    console.log(`Attempting to initiate restore for snapshot: ${snapshot.id}, Targets: ${selectedIdsArray.length > 0 ? selectedIdsArray.join(', ') : 'Full Restore'}`);
    
    setCurrentStep(3); 
    setProgressValue(0);
    setStatusMessage(isSandbox ? "Simulating restore initiation..." : "Initiating restore..."); 
    setIsRestoreInProgress(true);
    restoreStartTimeRef.current = Date.now();
    
    let effectiveTargetParentPageId: string | null = targetParentPageId;

    posthog.capture('restore_started', { 
        snapshot_id: snapshot.id, 
        target_count: selectedIdsArray.length, 
        restore_target_type: restoreTargetType,
        ...(restoreTargetType === 'specific_page' && effectiveTargetParentPageId && { target_parent_page_id: effectiveTargetParentPageId }),
        demo: isSandbox // Add demo flag
    });

    if (isSandbox) {
      // Simulate sandbox restore
      setStatusMessage("Demo: Preparing restore environment...");
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProgressValue(25);
      setStatusMessage("Demo: Downloading snapshot data...");
      await new Promise(resolve => setTimeout(resolve, 1500));
      setProgressValue(50);
      setStatusMessage("Demo: Restoring items to Notion (simulated)...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      setProgressValue(100);
      setStatusMessage("Demo: Restore completed successfully!");
      setIsRestoreInProgress(false);
      // No actual currentRestoreId is set for demo, so SSE won't connect
      // The useRestoreProgress hook's lastEvent will not update further for this demo restore.
      // We directly set final state.
      return;
    }

    if (restoreTargetType === 'new_page') {
         console.log("Restore target type: new_page (passing null parent)");
         effectiveTargetParentPageId = null; 
    } else if (restoreTargetType === 'in_place') {
         console.log("Restore target type: in_place (passing null parent)");
         effectiveTargetParentPageId = null; 
    } else if (restoreTargetType === 'specific_page' && !effectiveTargetParentPageId) {
        console.warn("Restore target type: specific_page, but no targetParentPageId selected. Defaulting to null parent.");
         effectiveTargetParentPageId = null; 
    }

    try {
      const response = await apiClient<{restoreId: string}>(/* Using apiClient now */ '/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          snapshotId: snapshot.id, 
          targets: selectedIdsArray, 
          targetParentPageId: effectiveTargetParentPageId 
        }),
      });

      // No need to check response.ok, apiClient handles it
      // const result = response; // apiClient returns parsed JSON directly
      setCurrentRestoreId(response.restoreId);
      setIsRestoreInProgress(true);
      // setCurrentStep(3); // Already set
      setStatusMessage("Restore process initiated. Waiting for progress updates..."); // Updated message
    } catch (err: any) {
      console.error("Failed to initiate restore:", err);
      toast({
        title: "Restore Error",
        description: err.data?.message || err.message || "Failed to start restore process.",
        variant: "destructive",
      });
      // Reset state on failure to allow retry or closing
      setIsRestoreInProgress(false);
      setCurrentStep(1); // Or back to step 2
      setStatusMessage("Failed to start. Please try again.");
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

  const handleCopyId = () => {
    if (snapshot?.id) {
      navigator.clipboard.writeText(snapshot.id)
        .then(() => {
          setCopiedId(true);
          toast({ title: 'Snapshot ID Copied!' });
          setTimeout(() => setCopiedId(false), 2000); // Reset icon after 2 seconds
        })
        .catch(err => {
          console.error('Failed to copy ID: ', err);
          toast({ title: 'Copy Failed', description: 'Could not copy ID to clipboard.', variant: 'destructive' });
        });
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div>
            <DialogDescription className="text-sm text-muted-foreground">Step 1: Confirm Backup Details</DialogDescription>
            <p className="my-2 text-sm">Make sure this is the backup you want to use before you continue.</p>
            <ul className="list-disc list-inside my-4 p-4 bg-muted rounded-md text-sm space-y-1">
              <li className="flex items-center">
                <strong>ID:</strong> 
                <span className='ml-2 font-mono text-xs'>{truncateText(snapshot.id)}</span>
                <Button variant="ghost" size="icon" className="ml-1 h-5 w-5" onClick={handleCopyId} title="Copy full ID">
                  {copiedId ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </li>
              <li><strong>Date:</strong> {new Date(snapshot.timestamp).toLocaleString()}</li>
              <li><strong>Size:</strong> {(snapshot.sizeKB / 1024).toFixed(2)} MB</li>
              <li><strong>Status:</strong> {snapshot.status}</li>
            </ul>
          </div>
        );
      case 2: 
        return (
          <div>
            <DialogDescription className="text-sm text-muted-foreground">Step 2: Choose What & Where to Restore</DialogDescription>
            
            {/* --- Restore Location --- */}
            <div className='my-4'>
              <Label className='text-sm font-medium'>Restore Location:</Label>
              <RadioGroup 
                value={restoreTargetType}
                onValueChange={(value) => {
                    setRestoreTargetType(value as any);
                    if (value !== 'specific_page') {
                        setTargetParentPageId(null); // Clear if not specific page
                        setTargetParentPageTitle(null);
                    }
                }} 
                className="mt-2 space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="new_page" id="target-new" />
                  <Label htmlFor="target-new" className="text-sm font-normal cursor-pointer">
                    Restore into a new page (Safe Default)
                    <p className='text-xs text-muted-foreground'>Creates a new page in your Notion root containing the restored items.</p>
                  </Label>
                </div>
                 
                 <div className="flex items-start space-x-2"> 
                   <RadioGroupItem value="specific_page" id="target-specific" />
                   <div className="flex-grow">
                     <Label htmlFor="target-specific" className="text-sm font-normal cursor-pointer">
                     Restore into a specific existing page...
                       <p className='text-xs text-muted-foreground'>Select a page you own to restore the content into.</p>
                   </Label>
                     {restoreTargetType === 'specific_page' && (
                        <div className="mt-2">
                            <NotionPageSearchCombobox 
                                selectedPageId={targetParentPageId}
                                onPageSelect={(page) => {
                                    setTargetParentPageId(page?.id || null);
                                    setTargetParentPageTitle(page?.title || null);
                                }}
                            />
                        </div>
                     )}
                   </div>
                 </div>
                 <div className="flex items-center space-x-2 opacity-50 cursor-not-allowed"> 
                   <RadioGroupItem value="in_place" id="target-inplace" disabled />
                   <Label htmlFor="target-inplace" className="text-sm font-normal">
                     Restore in place (Overwrite - Use with caution!)
                     <p className='text-xs text-muted-foreground'>Attempts to overwrite original items. (Experimental)</p>
                   </Label>
                 </div>
              </RadioGroup>
            </div>
            
             {/* --- Item Selection (Temporarily disabled) --- */}
             <Label className='text-sm font-medium mt-4 block'>Items to Restore:</Label>
            <p className="my-4 text-center text-muted-foreground border rounded-md p-6 bg-muted/50">Item selection temporarily disabled for debugging.</p>
            
          </div>
        );
      case 3: 
        return (
          <div>
            <DialogDescription className="text-sm text-muted-foreground">Step 3: Restore in Progress</DialogDescription>
            <div className="my-4 space-y-3">
              <p className="text-sm">Status: <span className={`font-semibold ${lastEvent?.type === 'error' ? 'text-destructive' : ''}`}>{statusMessage}</span></p>
              <Progress value={progressValue} className="w-full" />
              {progressValue === 100 && lastEvent?.type === 'complete' && (
                <p className="text-green-600 font-semibold text-sm">Restore completed successfully!</p>
              )}
              {isRestoreInProgress && progressValue < 100 && (
                 <p className="text-xs text-muted-foreground">Restoring backup from <strong>{new Date(snapshot.timestamp).toLocaleDateString()}</strong>...</p>
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
                      disabled={isRestoreInProgress || (currentStep === 2 && restoreTargetType === 'specific_page' && !targetParentPageId)}
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