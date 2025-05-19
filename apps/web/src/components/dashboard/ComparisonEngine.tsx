"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress"; // For confidence bar
import { Separator } from "@/components/ui/separator";
import { SlidersHorizontal, CalendarDays, CheckCircle, AlertCircle, GitCompareArrows, Eye, FileText, Database } from 'lucide-react'; // Using GitCompareArrows for Comparison Engine icon
import { cn } from "@/lib/utils";

// Dummy data for select placeholders - replace with actual snapshot data
const dummySnapshots = [
  { id: 'snap1', label: 'Project Plan (July 15th)' },
  { id: 'snap2', label: 'Weekly Report (July 22nd)' },
  { id: 'snap3', label: 'Alpha Launch Candidate (July 10th)' },
];

interface ComparisonEngineProps {
  // Props to be added later for actual data and functionality
}

const ComparisonEngine: React.FC<ComparisonEngineProps> = () => {
  const [fromSnapshot, setFromSnapshot] = useState<string | undefined>(dummySnapshots[0]?.id);
  const [toSnapshot, setToSnapshot] = useState<string | undefined>(dummySnapshots[1]?.id);

  // Example diff data
  const diffData = {
    added: 1,
    modified: 1,
    removed: -1, // Assuming negative for removed
    confidenceScore: 65, // percentage
    analysisComplete: true,
  };

  return (
    <Card className="w-full bg-card/90 dark:bg-slate-800/80 shadow-lg border-border/30">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center">
            <GitCompareArrows className="h-5 w-5 mr-2 text-primary" />
            <CardTitle className="text-lg">Comparison Engine</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" className="text-xs">
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" /> Filters
            </Button>
            <Button variant="outline" size="sm" className="text-xs">
              <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> Calendar View
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Snapshot Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div>
            <label htmlFor="from-snapshot" className="text-xs font-medium text-muted-foreground mb-1 block">From snapshot</label>
            <Select value={fromSnapshot} onValueChange={setFromSnapshot}>
              <SelectTrigger id="from-snapshot" className="w-full">
                <SelectValue placeholder="Select snapshot..." />
              </SelectTrigger>
              <SelectContent>
                {dummySnapshots.map(snap => (
                  <SelectItem key={snap.id} value={snap.id}>{snap.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="to-snapshot" className="text-xs font-medium text-muted-foreground mb-1 block">To snapshot</label>
            <Select value={toSnapshot} onValueChange={setToSnapshot}>
              <SelectTrigger id="to-snapshot" className="w-full">
                <SelectValue placeholder="Select snapshot..." />
              </SelectTrigger>
              <SelectContent>
                {dummySnapshots.map(snap => (
                  <SelectItem key={snap.id} value={snap.id}>{snap.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex justify-between items-center p-3 bg-muted/50 dark:bg-slate-700/50 rounded-md">
          <div className="flex items-center text-sm">
            {diffData.analysisComplete ? 
              <CheckCircle className="h-4 w-4 mr-2 text-green-500" /> : 
              <AlertCircle className="h-4 w-4 mr-2 text-yellow-500" />
            }
            <span>{diffData.analysisComplete ? "Analysis Complete" : "Analysis Pending"}</span>
          </div>
          <Button variant="link" size="sm" className="text-xs h-auto py-0 px-1">
            View details
          </Button>
        </div>

        {/* Confidence Bar */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Confidence Score</label>
          <Progress value={diffData.confidenceScore} className="h-2 bg-muted dark:bg-slate-700" />
        </div>

        {/* Diff Counts */}
        <div className="grid grid-cols-3 gap-4 text-center pt-2">
          <div>
            <p className="text-xs text-muted-foreground">Added</p>
            <p className="text-2xl font-bold text-green-500">+{diffData.added}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Modified</p>
            {/* Using text-blue-500 for modified as orange might be too close to red for destructive */}
            <p className="text-2xl font-bold text-blue-500 dark:text-sky-400">{diffData.modified}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Removed</p>
            <p className="text-2xl font-bold text-red-500">{diffData.removed}</p>
          </div>
        </div>
        
        <Separator className="my-4 bg-border/50 dark:bg-slate-700" />

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-end items-center gap-3">
          <Button variant="ghost" size="sm">Compare with previous</Button>
          <Button variant="default" size="sm" className="bg-primary hover:bg-primary/90">
             <Eye className="h-4 w-4 mr-2" /> View Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ComparisonEngine; 