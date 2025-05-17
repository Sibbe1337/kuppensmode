"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar"; // For DatePicker in Calendar View
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { SlidersHorizontal, CalendarDays, CheckCircle, AlertCircle, GitCompareArrows, Eye, Maximize2, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast"; // For notifications
import apiClient from '@/lib/apiClient'; // For API calls
import type { Snapshot } from "@/types"; 
import type { SemanticDiffResult, ChangedItemDetail } from "@/types/diff"; // Import from shared types

// Dummy data for select placeholders
const dummySnapshots = [
  { id: 'snap1', label: 'Project Plan (July 15th)' },
  { id: 'snap2', label: 'Weekly Report (July 22nd)' },
  { id: 'snap3', label: 'Alpha Launch Candidate (July 10th)' },
];

interface CurrentJobState {
  jobId?: string;
  statusUrl?: string;
  status: 'idle' | 'pending' | 'processing' | 'complete' | 'error';
  message?: string;
  fetchedResult?: SemanticDiffResult; // Use the shared type here
}

interface ComparisonEngineBarProps {
  snapshots: Snapshot[];
  initialCompareData?: any;
}

const SnapshotSelect: React.FC<{
  value?: string;
  onValueChange: (value: string) => void;
  snapshots: Snapshot[];
  placeholder: string;
  disabled?: boolean;
}> = ({ value, onValueChange, snapshots, placeholder, disabled }) => {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-full bg-slate-700 border-slate-600 hover:bg-slate-600/70 text-slate-200 focus:ring-indigo-500">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
        {snapshots.map(snap => (
          <SelectItem key={snap.id} value={snap.id} className="hover:bg-slate-700 focus:bg-slate-700">
            {snap.snapshotIdActual || snap.id} ({new Date(snap.timestamp).toLocaleDateString()})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const ComparisonEngineBar: React.FC<ComparisonEngineBarProps> = ({ snapshots, initialCompareData }) => {
  const [fromSnapshot, setFromSnapshot] = useState<string | undefined>(undefined);
  const [toSnapshot, setToSnapshot] = useState<string | undefined>(undefined);
  const [completedSnapshots, setCompletedSnapshots] = useState<Snapshot[]>([]);
  const [jobState, setJobState] = useState<CurrentJobState>({ status: 'idle' });
  const { toast } = useToast();

  useEffect(() => {
    const filtered = snapshots
      .filter(snap => snap.status === 'Completed')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setCompletedSnapshots(filtered);
  }, [snapshots]);

  useEffect(() => {
    if (completedSnapshots.length >= 2) {
      // Only set defaults if current selections are not among the completed snapshots or are not set
      const currentFromSnapshotIsValid = fromSnapshot && completedSnapshots.some(s => s.id === fromSnapshot);
      const currentToSnapshotIsValid = toSnapshot && completedSnapshots.some(s => s.id === toSnapshot);

      if (!currentToSnapshotIsValid) {
        setToSnapshot(completedSnapshots[0].id);
      }
      if (!currentFromSnapshotIsValid) {
        // If 'toSnapshot' is or was just set to the newest, 'fromSnapshot' should be the second newest.
        // Otherwise, if 'toSnapshot' is valid and not the newest, 'fromSnapshot' can be the newest.
        if (toSnapshot === completedSnapshots[0].id || (!currentToSnapshotIsValid && completedSnapshots[0].id)) {
             setFromSnapshot(completedSnapshots[1].id);
        } else {
            // toSnapshot is valid and *not* the newest, or toSnapshot will become the newest
            // fromSnapshot can be the newest (completedSnapshots[0]) if it's different from toSnapshot
            if (completedSnapshots[0].id !== toSnapshot) {
                setFromSnapshot(completedSnapshots[0].id);
            } else {
                 setFromSnapshot(completedSnapshots[1].id); // Fallback if toSnapshot is somehow already the newest and from isn't set
            }
        }
      } else if (fromSnapshot === toSnapshot && completedSnapshots.length > 1) {
        // Handle case where selections might become identical after filtering/prop updates
        if (toSnapshot === completedSnapshots[0].id) {
            setFromSnapshot(completedSnapshots[1].id);
        } else {
            setFromSnapshot(completedSnapshots[0].id);
        }
      }

    } else if (completedSnapshots.length === 1) {
      const currentToSnapshotIsValid = toSnapshot && completedSnapshots.some(s => s.id === toSnapshot);
      if (!currentToSnapshotIsValid) {
        setToSnapshot(completedSnapshots[0].id);
      }
      setFromSnapshot(undefined);
    } else {
      setFromSnapshot(undefined);
      setToSnapshot(undefined);
    }
  }, [completedSnapshots]); // Removed fromSnapshot, toSnapshot to simplify default setting logic

  const handleRunComparison = async () => {
    if (!fromSnapshot || !toSnapshot) {
      toast({ title: "Selection Error", description: "Please select both a source and target snapshot.", variant: "destructive" });
      return;
    }
    setJobState({ jobId: undefined, statusUrl: undefined, status: 'pending', message: 'Queueing comparison job...', fetchedResult: undefined });
    try {
      const response = await apiClient<{ success: boolean; message: string; jobId: string; statusUrl: string; }>(
        '/api/diff/run',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshotIdFrom: fromSnapshot, snapshotIdTo: toSnapshot }),
        }
      );
      if (response.success && response.jobId && response.statusUrl) {
        setJobState(prev => ({ ...prev, jobId: response.jobId, statusUrl: response.statusUrl, status: 'pending', message: 'Job queued. Awaiting status...' }));
        toast({ title: "Comparison Queued", description: `Job ID: ${response.jobId}` });
      } else {
        throw new Error(response.message || "Failed to queue comparison job.");
      }
    } catch (error: any) {
      console.error("Error running comparison:", error);
      toast({ title: "Error", description: error.message || "Could not start comparison.", variant: "destructive" });
      setJobState(prev => ({ ...prev, status: 'error', message: error.message || "Could not start comparison." }));
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (jobState.statusUrl && (jobState.status === 'pending' || jobState.status === 'processing')) {
      const pollStatus = async () => {
        try {
          const statusRes = await apiClient<{jobId: string; status: CurrentJobState['status']; message?: string; resultUrl?: string;}>(
            jobState.statusUrl!
          );
          setJobState(prev => ({ ...prev, status: statusRes.status, message: statusRes.message }));
          
          if (statusRes.status === 'complete' && statusRes.resultUrl) {
            clearInterval(intervalId);
            try {
                const results = await apiClient<SemanticDiffResult>(statusRes.resultUrl);
                setJobState(prev => ({ 
                    ...prev, 
                    status: 'complete', 
                    fetchedResult: results, // Store the full SemanticDiffResult
                    message: results.message || 'Comparison finished.'}));
            } catch (resultsError: any) {
                console.error("Error fetching diff results:", resultsError);
                setJobState(prev => ({ ...prev, status: 'error', message: "Failed to fetch results: " + resultsError.message }));
            }
          } else if (statusRes.status === 'error') {
            clearInterval(intervalId);
            // Message should already be in statusRes
          }
        } catch (err:any) {
          console.error("Error polling job status:", err);
          setJobState(prev => ({ ...prev, status: 'error', message: "Failed to get job status: " + err.message }));
          clearInterval(intervalId);
        }
      };
      pollStatus();
      intervalId = setInterval(pollStatus, 5000);
    }
    return () => clearInterval(intervalId);
  }, [jobState.statusUrl, jobState.status]);
  
  const displaySummary = jobState.fetchedResult?.summary;
  let semanticSimilarityPercent = 0;
  if (displaySummary) {
    const itemsWithSemanticResult = (displaySummary.semanticallySimilar || 0) + (displaySummary.semanticallyChanged || 0);
    if (itemsWithSemanticResult > 0) {
      semanticSimilarityPercent = ((displaySummary.semanticallySimilar || 0) / itemsWithSemanticResult) * 100;
    } else if (displaySummary.contentHashChanged === 0 && (displaySummary.added || 0) === 0 && (displaySummary.deleted || 0) === 0){
      semanticSimilarityPercent = 100; // No changes, so 100% similar in a way
    } else if (displaySummary.contentHashChanged > 0) {
      // Hashes changed, but no semantic results (e.g. all pending/error/no_embeddings_found)
      // This implies 0% known semantic similarity for the changed items
      semanticSimilarityPercent = 0; 
    }
  }

  let actionButtonText = "Compare Snapshots";
  if (jobState.jobId) {
    if (jobState.status === 'pending' || jobState.status === 'processing') {
      actionButtonText = "Comparing...";
    } else {
      actionButtonText = "Re-run Comparison";
    }
  }

  return (
    <Card className="w-full bg-slate-800/80 dark:bg-slate-800/80 shadow-xl border-slate-700/80 rounded-lg">
      <CardHeader className="pb-4 pt-5 px-5 border-b border-slate-700/60">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center">
            <GitCompareArrows className="h-6 w-6 mr-2.5 text-indigo-400" />
            <CardTitle className="text-lg font-semibold text-slate-100">Comparison Engine</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" className="text-xs border-slate-600 hover:bg-slate-700/50 hover:border-indigo-500 text-slate-300">
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" /> Filters
            </Button>
            <Button variant="outline" size="sm" className="text-xs border-slate-600 hover:bg-slate-700/50 hover:border-indigo-500 text-slate-300">
              <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> Calendar View
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 md:gap-4 items-end">
          <div>
            <label htmlFor="from-snapshot" className="text-xs font-medium text-slate-400 mb-1 block">From snapshot</label>
            <SnapshotSelect snapshots={completedSnapshots} value={fromSnapshot} onValueChange={setFromSnapshot} placeholder="Select source" disabled={jobState.status === 'pending' || jobState.status === 'processing'}/>
          </div>
          <div className="text-center hidden md:block pb-2">
            <ArrowRight className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <label htmlFor="to-snapshot" className="text-xs font-medium text-slate-400 mb-1 block">To snapshot</label>
            <SnapshotSelect snapshots={completedSnapshots} value={toSnapshot} onValueChange={setToSnapshot} placeholder="Select target" disabled={jobState.status === 'pending' || jobState.status === 'processing'}/>
          </div>
        </div>

        {(jobState.status === 'pending' || jobState.status === 'processing') && (
            <div className="flex items-center justify-center p-4 bg-slate-700/50 rounded-md text-sm text-slate-300">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                <span>{jobState.message || "Processing..."}</span>
            </div>
        )}

        {jobState.status === 'complete' && displaySummary && (
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-md text-sm">
              <div className="flex items-center text-green-400"><CheckCircle className="h-4 w-4 mr-2" /> Analysis Complete</div>
              {jobState.jobId && 
                <Button variant="link" size="sm" className="text-xs h-auto p-0 text-indigo-400 hover:text-indigo-300" asChild>
                  <Link href={`/comparison/${jobState.jobId}`}>View details</Link>
                </Button>
              }
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Confidence</span>
                <span>{semanticSimilarityPercent.toFixed(0)}%</span>
              </div>
              <Progress value={semanticSimilarityPercent} className="h-1.5 bg-slate-700" />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div>
                <p className="text-xs text-slate-400">Added</p>
                <p className="text-xl font-bold text-green-400">+{displaySummary.added || 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Modified</p>
                <p className="text-xl font-bold text-sky-400">~{displaySummary.contentHashChanged || 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Removed</p>
                <p className="text-xl font-bold text-red-400">-{displaySummary.deleted || 0}</p>
              </div>
            </div>
          </div>
        )}
        
        {jobState.status === 'error' && (
            <div className="p-3 bg-destructive/20 border border-destructive/50 rounded-md text-sm text-destructive">
                <AlertCircle className="h-4 w-4 inline mr-2" /> {jobState.message || "Comparison failed."}
            </div>
        )}
        
        <Separator className="my-4 bg-slate-700/60" />

        <div className="flex flex-col sm:flex-row justify-end items-center gap-3">
          <Button variant="ghost" size="sm" className="text-slate-300 hover:bg-slate-700/70 hover:text-slate-100">Compare with previous</Button>
          <Button 
            variant="default" 
            size="sm" 
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
            onClick={handleRunComparison}
            disabled={!fromSnapshot || !toSnapshot || jobState.status === 'pending' || jobState.status === 'processing'}
          >
            {(jobState.status === 'pending' || jobState.status === 'processing') ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Eye className="h-4 w-4 mr-2" />}
            {actionButtonText}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ComparisonEngineBar; 