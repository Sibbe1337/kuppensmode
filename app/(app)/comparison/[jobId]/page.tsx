"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import apiClient from '@/lib/apiClient';
import type { SemanticDiffResult, ChangedItemDetail } from '@/types/diff';
import {
  AlertTriangle, CheckCircle, Info, ChevronDown, ChevronRight, Eye,
  FilePlus, FileMinus, ArrowRightLeft, RefreshCw, ExternalLink,
  FileText, Database, Blocks, HelpCircle
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

const getChangeTypeBadgeVariant = (changeType: ChangedItemDetail['changeType']): "default" | "secondary" | "destructive" | "outline" => {
  switch (changeType) {
    case 'hash_only_similar': return 'default';
    case 'semantic_divergence': return 'outline';
    case 'no_embeddings_found':
    case 'pending_semantic_check':
    case 'structural_change':
      return 'outline';
    case 'error_in_processing':
      return 'destructive';
    default: return 'secondary';
  }
};

const ItemTypeIcon = ({ type, blockType }: { type?: string, blockType?: string }) => {
  if (type === 'page') return <FileText className="h-4 w-4 mr-2 text-sky-500" />;
  if (type === 'database') return <Database className="h-4 w-4 mr-2 text-purple-500" />;
  if (type === 'block') return <Blocks className="h-4 w-4 mr-2 text-gray-500" />;
  return <HelpCircle className="h-4 w-4 mr-2 text-gray-400" />;
};

export default function ComparisonDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = typeof params.jobId === 'string' ? params.jobId : null;

  const { data: diffResult, error, isLoading, mutate } = useSWR<SemanticDiffResult>(
    jobId ? `/api/diff/results/${jobId}` : null,
    apiClient,
    {
      refreshInterval: (latestData: SemanticDiffResult | undefined) => {
        return latestData?.status === 'processing' || latestData?.status === 'pending' ? 5000 : 0;
      }
    }
  );

  if (isLoading || !jobId && !error) {
    return (
      <div className="container mx-auto py-8 px-4 space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-8 w-1/2" />
        <div className="grid md:grid-cols-3 gap-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Comparison</h2>
        <p className="text-muted-foreground">Could not load details for job ID: {jobId}. Error: {error.message}</p>
        <Button variant="outline" asChild className="mt-4"><Link href="/dashboard">Back to Dashboard</Link></Button>
      </div>
    );
  }

  if (!diffResult && !isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Comparison Not Found or Still Processing</h2>
        <p className="text-muted-foreground">Details for job ID: {jobId} are unavailable. It might be processing or no longer exists.</p>
        <Button variant="outline" asChild className="mt-4 mr-2"><Link href="/dashboard">Back to Dashboard</Link></Button>
        {jobId && <Button onClick={() => mutate()} className="mt-4"><RefreshCw className="mr-2 h-4 w-4"/>Retry</Button>}
      </div>
    );
  }

  const { summary, details, snapshotIdFrom, snapshotIdTo, message, status, createdAt, updatedAt } = diffResult as SemanticDiffResult;

  const isProcessing = status === 'processing' || status === 'pending';

  return (
    <main className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Snapshot Comparison</h1>
          <div className="text-sm text-muted-foreground space-x-2">
            <span>Job ID: <code className="bg-muted px-1 py-0.5 rounded-sm text-xs">{jobId}</code></span>
            <span>|</span>
            <span>From: <Badge variant="outline">{snapshotIdFrom}</Badge></span>
            <span>To: <Badge variant="outline">{snapshotIdTo}</Badge></span>
          </div>
        </div>
        <Button variant="outline" onClick={() => mutate()} disabled={isLoading || isProcessing}>
            <RefreshCw className={cn("mr-2 h-4 w-4", (isLoading || isProcessing) && "animate-spin")} /> 
            Refresh Status
        </Button>
      </div>

      {message && 
        <div className={cn(
            "p-3 rounded-md text-sm flex items-center gap-2",
            status === 'error' ? "bg-destructive/10 text-destructive border border-destructive/30" : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30"
        )}>
            <Info className="h-5 w-5"/> {message}
        </div>
      }
      {status && 
          <p className="text-sm">Overall Status: 
            <Badge 
              variant={status === 'completed' ? "outline" : "secondary"} 
              className={cn(
                status === 'completed' && "bg-green-100 text-green-700 border-green-300 dark:bg-green-700/30 dark:text-green-300 dark:border-green-600",
                isProcessing && "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-700/30 dark:text-yellow-300 dark:border-yellow-600",
                status === 'error' && "bg-red-100 text-red-700 border-red-300 dark:bg-red-700/30 dark:text-red-300 dark:border-red-600"
              )}
            >
              {isProcessing && <Loader2 className="inline h-3 w-3 mr-1 animate-spin" />} {status}
            </Badge>
          </p>}
      {updatedAt && <p className="text-xs text-muted-foreground">Last updated: {new Date(updatedAt as string).toLocaleString()}</p>}

      {summary && (
        <Card>
            <CardHeader><CardTitle>Comparison Summary</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 text-center">
                <div className="p-3 bg-muted/50 rounded-md"><p className="text-xs text-muted-foreground">Added</p><p className="text-2xl font-bold text-green-500">{summary.added}</p></div>
                <div className="p-3 bg-muted/50 rounded-md"><p className="text-xs text-muted-foreground">Deleted</p><p className="text-2xl font-bold text-red-500">{summary.deleted}</p></div>
                <div className="p-3 bg-muted/50 rounded-md"><p className="text-xs text-muted-foreground">Hash Changed</p><p className="text-2xl font-bold">{summary.contentHashChanged}</p></div>
                <div className="p-3 bg-muted/50 rounded-md"><p className="text-xs text-muted-foreground">Semantically Similar</p><p className="text-2xl font-bold text-green-600">{summary.semanticallySimilar}</p></div>
                <div className="p-3 bg-muted/50 rounded-md"><p className="text-xs text-muted-foreground">Semantically Changed</p><p className="text-2xl font-bold text-yellow-600">{summary.semanticallyChanged}</p></div>
            </CardContent>
        </Card>
      )}

      {isProcessing && (
        <div className="text-center py-10">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Diff analysis is currently in progress. This page will auto-refresh.</p>
        </div>
      )}

      {status === 'completed' && details && (
        <Accordion type="single" collapsible className="w-full space-y-3" defaultValue='changed-items'>
          {renderDetailSection("Changed Items", details.changedItems, (item: ChangedItemDetail) => (
            <>
              <TableCell><Badge variant={getChangeTypeBadgeVariant(item.changeType)} className="text-xs capitalize">{item.changeType.replace(/_/g, ' ')}</Badge></TableCell>
              <TableCell>{item.similarityScore !== undefined ? `${(item.similarityScore * 100).toFixed(1)}%` : 'N/A'}</TableCell>
            </>
          ), ["Change Type", "Similarity"])}
          {renderDetailSection("Added Items", details.addedItems)}
          {renderDetailSection("Deleted Items", details.deletedItems)}
        </Accordion>
      )}
       <div className="mt-10 text-center">
          <Button variant="outline" asChild><Link href="/dashboard">Back to Dashboard</Link></Button>
        </div>
    </main>
  );
}

// Helper to render detail tables
function renderDetailSection(title: string, items: any[] | undefined, additionalCells?: (item: any) => React.ReactNode, additionalHeaders?: string[]) {
  if (!items || items.length === 0) return null;
  return (
    <AccordionItem value={title.toLowerCase().replace(/\s+/g, '-')} className="border border-border rounded-lg overflow-hidden">
      <AccordionTrigger className="bg-muted/50 hover:bg-muted px-4 py-3 text-base font-medium">
        <div className="flex items-center">
          {title.includes('Added') && <FilePlus className="mr-2 h-5 w-5 text-green-500"/>}
          {title.includes('Deleted') && <FileMinus className="mr-2 h-5 w-5 text-red-500"/>}
          {title.includes('Changed') && <ArrowRightLeft className="mr-2 h-5 w-5 text-blue-500"/>}
          {title} ({items.length})
        </div>
      </AccordionTrigger>
      <AccordionContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Name</TableHead>
              <TableHead className="w-[20%]">Type</TableHead>
              {additionalHeaders?.map(h => <TableHead key={h}>{h}</TableHead>)}
              <TableHead className="w-[30%]">ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium flex items-center"><ItemTypeIcon type={item.type || item.itemType} blockType={item.blockType}/> {item.name || 'N/A'}</TableCell>
                <TableCell>{item.type || item.itemType}{item.blockType ? ` (${item.blockType})` : ''}</TableCell>
                {additionalCells && additionalCells(item)}
                <TableCell className="font-mono text-xs text-muted-foreground">{item.id}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AccordionContent>
    </AccordionItem>
  );
} 