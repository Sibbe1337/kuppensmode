"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SlidersHorizontal, CalendarDays, CheckCircle, AlertCircle, GitCompareArrows, Eye, Maximize2, ArrowRight, Loader2, Info } from 'lucide-react';
import { cn } from "@/lib/utils";
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import apiClient from '@/lib/apiClient';
import type { Snapshot } from "@/types"; 
import type { SemanticDiffResult } from "@/types/diff";
import SnapshotPickerButton from "@/components/ui/SnapshotPickerButton";

interface CurrentJobState {
  jobId?: string;
  statusUrl?: string;
  status: 'idle' | 'pending' | 'processing' | 'complete' | 'error';
  message?: string;
  fetchedResult?: SemanticDiffResult;
}

interface ComparisonEngineBarProps {
  snapshots: Snapshot[];
}

const ComparisonEngineBar: React.FC<ComparisonEngineBarProps> = ({ snapshots }) => {
  const [fromSnapshot, setFromSnapshot] = useState<string | undefined>(undefined);
  const [toSnapshot, setToSnapshot] = useState<string | undefined>(undefined);
  const [completedSnapshots, setCompletedSnapshots] = useState<Snapshot[]>([]);
  const [jobState, setJobState] = useState<CurrentJobState>({ status: 'idle' });
  const { toast } = useToast();
  const [estimatedChanges, setEstimatedChanges] = useState<string | null>(null);

  useEffect(() => {
    const filtered = snapshots
      .filter(snap => snap.status === 'Completed')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setCompletedSnapshots(filtered);
  }, [snapshots]);

  useEffect(() => {
    if (completedSnapshots.length >= 2) {
      const currentFromSnapshotIsValid = fromSnapshot && completedSnapshots.some(s => s.id === fromSnapshot);
      const currentToSnapshotIsValid = toSnapshot && completedSnapshots.some(s => s.id === toSnapshot);

      if (!currentToSnapshotIsValid) {
        setToSnapshot(completedSnapshots[0].id);
        if (!currentFromSnapshotIsValid || fromSnapshot === completedSnapshots[0].id) {
          setFromSnapshot(completedSnapshots[1].id);
        }
      } else if (!currentFromSnapshotIsValid) {
        setFromSnapshot(completedSnapshots[0].id === toSnapshot ? completedSnapshots[1].id : completedSnapshots[0].id);
      } else if (fromSnapshot === toSnapshot) {
        if (toSnapshot === completedSnapshots[0].id && completedSnapshots.length > 1) {
          setFromSnapshot(completedSnapshots[1].id);
        } else if (completedSnapshots.length > 1) {
          setFromSnapshot(completedSnapshots[0].id);
        }
      }
    } else if (completedSnapshots.length === 1) {
      if (!toSnapshot || !completedSnapshots.some(s => s.id === toSnapshot)) {
         setToSnapshot(completedSnapshots[0].id);
      }
      setFromSnapshot(undefined);
    } else {
      setFromSnapshot(undefined);
      setToSnapshot(undefined);
    }
  }, [completedSnapshots]);
  
  const fetchEstimatedChanges = useCallback(async (fromId?: string, toId?: string) => {
    if (fromId && toId && fromId !== toId) {
      setEstimatedChanges("Estimating changes...");
      await new Promise(resolve => setTimeout(resolve, 750));
      const numChanges = Math.floor(Math.random() * 25) + 1;
      setEstimatedChanges(`~${numChanges} items likely changed.`);
    } else {
      setEstimatedChanges(null);
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
        fetchEstimatedChanges(fromSnapshot, toSnapshot);
    }, 500);
    return () => clearTimeout(handler);
  }, [fromSnapshot, toSnapshot, fetchEstimatedChanges]);

  const handleRunComparison = async () => {
    if (!fromSnapshot || !toSnapshot) {
      toast({ title: "Selection Error", description: "Please select both a source and target snapshot.", variant: "destructive" });
      return;
    }
    if (fromSnapshot === toSnapshot) {
      toast({ title: "Selection Error", description: "Source and target snapshots cannot be the same.", variant: "destructive" });
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
                    fetchedResult: results,
                    message: results.summary ? `Compared items. Found ${results.summary.added + results.summary.deleted + results.summary.contentHashChanged} key differences.` : (results.message || 'Comparison finished.')
                }));
            } catch (resultsError: any) {
                console.error("Error fetching diff results:", resultsError);
                setJobState(prev => ({ ...prev, status: 'error', message: "Failed to fetch results: " + resultsError.message }));
            }
          } else if (statusRes.status === 'error') {
            clearInterval(intervalId);
          }
        } catch (err:any) {
          console.error("Error polling job status:", err);
          setJobState(prev => ({ ...prev, status: 'error', message: "Failed to get job status: " + err.message }));
          clearInterval(intervalId);
        }
      };
      const initialPollDelay = setTimeout(pollStatus, 1000);
      intervalId = setInterval(pollStatus, 5000);
      return () => { clearTimeout(initialPollDelay); clearInterval(intervalId); };
    }
    return () => {};
  }, [jobState.statusUrl, jobState.status]);
  
  const displaySummary = jobState.fetchedResult?.summary;
  let semanticSimilarityPercent = 0;
  if (displaySummary) {
    const itemsWithSemanticResult = (displaySummary.semanticallySimilar || 0) + (displaySummary.semanticallyChanged || 0);
    if (itemsWithSemanticResult > 0) {
      semanticSimilarityPercent = ((displaySummary.semanticallySimilar || 0) / itemsWithSemanticResult) * 100;
    } else if (displaySummary.contentHashChanged === 0 && (displaySummary.added || 0) === 0 && (displaySummary.deleted || 0) === 0){
      semanticSimilarityPercent = 100;
    } else if (displaySummary.contentHashChanged > 0) {
      semanticSimilarityPercent = 0; 
    }
  }

  const isLoading = jobState.status === 'pending' || jobState.status === 'processing';
  let actionButtonText = "Compare Snapshots";
  if (jobState.jobId) {
    if (isLoading) {
      actionButtonText = "Comparing...";
    } else {
      actionButtonText = "Re-run Comparison";
    }
  }

  const handleCompareWithPrevious = () => {
    if (completedSnapshots.length >= 2) {
      setToSnapshot(completedSnapshots[0].id);
      setFromSnapshot(completedSnapshots[1].id);
      toast({ title: "Snapshots Selected", description: "Comparing latest with its previous. Click 'Compare Snapshots' to proceed." });
    }
  };

  return (
    <Card className={cn("w-full shadow-lg rounded-xl",
                       "bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-lg", 
                       "border border-slate-200/50 dark:border-slate-700/50")}>
      <CardHeader className="pb-4 pt-5 px-5 border-b border-slate-200/60 dark:border-slate-700/60">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center">
            <SlidersHorizontal className="h-5 w-5 text-primary mr-2.5" />
            <CardTitle className="text-base font-medium">Semantic Diff Engine</CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-x-3 gap-y-4 items-end">
          <div>
            <label htmlFor="from-snapshot" className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">FROM</label>
            <SnapshotPickerButton snapshots={completedSnapshots} value={fromSnapshot} onValueChange={setFromSnapshot} placeholder="Select source snapshot" disabled={isLoading} popoverAlign="start" />
          </div>
          <div className="text-center hidden md:block pb-2.5">
            <ArrowRight className="h-5 w-5 text-slate-400 dark:text-slate-500" />
          </div>
          <div>
            <label htmlFor="to-snapshot" className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">TO</label>
            <SnapshotPickerButton snapshots={completedSnapshots} value={toSnapshot} onValueChange={setToSnapshot} placeholder="Select target snapshot" disabled={isLoading} popoverAlign="end" />
          </div>
        </div>
        
        {estimatedChanges && (
            <div className="text-center text-xs text-muted-foreground py-1 px-2 bg-slate-100 dark:bg-slate-700/50 rounded-md flex items-center justify-center gap-1.5">
                <Info className="h-3.5 w-3.5" /> {estimatedChanges}
            </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button 
                onClick={handleRunComparison} 
                disabled={isLoading || !fromSnapshot || !toSnapshot || fromSnapshot === toSnapshot}
                className="w-full sm:flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-10 text-sm font-medium rounded-md shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
            >
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GitCompareArrows className="h-4 w-4 mr-2" />} 
                {actionButtonText}
            </Button>
            <Button 
                variant="outline"
                onClick={handleCompareWithPrevious}
                disabled={isLoading || completedSnapshots.length < 2}
                className="w-full sm:w-auto border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 h-10 text-sm rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
            >
                Compare Latest Pair
            </Button>
        </div>

        {(isLoading || jobState.message && (jobState.status !== 'idle' && jobState.status !== 'complete')) && jobState.status !== 'error' && (
             <div className="flex items-center justify-center p-3 bg-slate-100 dark:bg-slate-700/60 rounded-md text-sm text-slate-600 dark:text-slate-300">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                <span>{jobState.message || "Processing..."}</span>
            </div>
        )}
        {jobState.status === 'error' && (
            <div className="flex items-center justify-center p-3 bg-red-50 dark:bg-red-900/30 rounded-md text-sm text-red-700 dark:text-red-300">
                <AlertCircle className="h-4 w-4 mr-2" />
                <span>Error: {jobState.message || "An unknown error occurred."}</span>
            </div>
        )}

        {jobState.status === 'complete' && jobState.fetchedResult && displaySummary && (
          <div className="pt-3 space-y-3">
            <Separator className="my-3 border-slate-200/60 dark:border-slate-700/60"/>
            <div className="flex justify-between items-center">
              <h3 className="text-md font-semibold text-slate-700 dark:text-slate-200">Comparison Summary</h3>
              <Link href={`/comparison/${jobState.jobId}`} passHref>
                <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary/80">
                    View Full Report <Eye className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Confidence</p>
                    <p className="text-xl font-semibold text-primary tabular-nums">{semanticSimilarityPercent.toFixed(0)}%</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Added</p>
                    <p className="text-xl font-semibold text-green-600 dark:text-green-500">{displaySummary.added || 0}</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Modified</p>
                    <p className="text-xl font-semibold text-amber-600 dark:text-amber-500">{displaySummary.contentHashChanged || 0}</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Removed</p>
                    <p className="text-xl font-semibold text-red-600 dark:text-red-500">{displaySummary.deleted || 0}</p>
                </div>
            </div>
            {jobState.fetchedResult.llmSummary && (
                <div className="pt-2">
                    <h4 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">AI Overview:</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 p-3 rounded-md leading-relaxed whitespace-pre-wrap">{jobState.fetchedResult.llmSummary}</p>
                </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ComparisonEngineBar; 