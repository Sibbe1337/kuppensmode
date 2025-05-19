"use client";

import React from 'react';
import useSWR from 'swr';
import apiClient from '@/lib/apiClient';
import KpiCard, { KpiCardProps } from '@/components/dashboard/KpiCard';
import ComparisonEngine from '@/components/dashboard/ComparisonEngine';
import LatestAnalysis from '@/components/dashboard/LatestAnalysis';
import ActivityLog from '@/components/dashboard/ActivityLog';
import StatusBadge from '@/components/layout/StatusBadge';
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { Snapshot } from "@/types";
import ComparisonEngineBar from '@/components/dashboard/ComparisonEngineBar';
import { useKpis } from '@/hooks/useKpis';

// Define types for the expected API responses (can be moved to @/types)
// interface KpiData extends Omit<KpiCardProps, 'slotRight' | 'className'> {} // This type is no longer needed for KPIs from API

interface ComparisonData {
  fromSnapshot: { id: string; label: string };
  toSnapshot: { id: string; label: string };
  availableSnapshots: { id: string; label: string }[];
  analysisComplete: boolean;
  confidenceScore: number;
  added: number;
  modified: number;
  removed: number;
  viewDetailsUrl?: string;
}

interface AiInsight {
  id: string;
  text: string;
  iconName: string; // We'll map this to an icon component if needed
}
interface LatestData {
  similarityScore: number;
  confidenceText: string;
  systemStatusText: string;
  aiInsights: AiInsight[];
}

// Re-add dummyChanges for ActivityLog until a real endpoint is available
const dummyChanges = [
  { id: 'c1', description: 'Updated Project Plan with new milestones.', date: '2025-05-10T08:30:00Z', snapshotId: 'snap123' },
  { id: 'c2', description: 'Client Feedback document archived.', date: '2025-05-09T17:00:00Z', snapshotId: 'snap122' },
];

// Placeholder for Circular Gauge for Monthly Usage
const MonthlyUsageGauge: React.FC<{ value: number; limit: number; warning?: boolean }> = ({ value, limit, warning }) => {
  const percentage = limit > 0 ? Math.min(100, (value / limit) * 100) : 0;
  return (
    <div className="flex flex-col items-center justify-center w-28 h-28">
      <div className="relative w-20 h-20">
        {/* Basic circle for placeholder */}
        <svg viewBox="0 0 36 36" className="w-full h-full">
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="2" className="stroke-slate-200 dark:stroke-slate-700"/>
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="2" strokeDasharray={`${percentage}, 100`} className="stroke-primary" transform="rotate(-90 18 18)"/>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-foreground">{percentage.toFixed(0)}%</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground mt-1">{value} of {limit} used</span>
      {warning && <span className="text-xs text-yellow-500 mt-0.5">Warning</span>}
    </div>
  );
};

export default function DashboardPage() {
  // const { data: kpis, error: kpisError, isLoading: kpisLoading } = useSWR<KpiData[]>('/api/analytics/kpis', apiClient); // Old KPI fetching
  const { data: kpisData, error: kpisError, isLoading: kpisLoading } = useKpis(); // New KPI fetching
  const { data: compareData, error: compareError, isLoading: compareLoading } = useSWR<ComparisonData>('/api/analytics/compare', apiClient);
  const { data: latestData, error: latestError, isLoading: latestLoading } = useSWR<LatestData>('/api/analytics/latest', apiClient);
  const { data: snapshotsData, error: snapshotsError, isLoading: snapshotsLoading } = useSWR<Snapshot[]>('/api/snapshots', apiClient);
  const { data: quotaData, error: quotaError, isLoading: quotaLoading } = useSWR<any>('/api/user/quota', apiClient);

  const monthlyUsageData = quotaData ? // Renamed from dummyMonthlyUsage to avoid confusion
    { value: quotaData.snapshotsUsed, limit: quotaData.snapshotsLimit, warning: quotaData.snapshotsUsed / quotaData.snapshotsLimit >= 0.85 } :
    { value: 0, limit: 0, warning: false };

  const activityLogSnapshots = snapshotsData?.map(snap => ({
    id: snap.id,
    name: snap.snapshotIdActual || snap.id, 
    date: snap.timestamp, 
    sizeKb: snap.sizeKB,
  })) || [];

  if (kpisLoading || compareLoading || latestLoading || snapshotsLoading || quotaLoading) {
    return (
      <main className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <Skeleton className="h-8 w-1/2 mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
        <div className="flex flex-col lg:flex-row gap-6 md:gap-8 mb-8">
          <Skeleton className="flex-1 h-96 rounded-lg" />
          <Skeleton className="w-full lg:w-auto lg:max-w-xs xl:max-w-sm h-96 rounded-lg hidden sm:block" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </main>
    );
  }
  
  if (kpisError || compareError || latestError || snapshotsError || quotaError) {
    return (
        <main className="container mx-auto py-8 px-4 flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold text-destructive mb-2">Oops! Something went wrong.</h2>
            <p className="text-muted-foreground">We couldn't load all dashboard data. Please try again later.</p>
        </main>
    );
  }

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">PageLifeline Dashboard</h1>
        <p className="text-muted-foreground">Insights and analytics for your workspace</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        {/* Real KPI Card for Total Snapshots */}
        {kpisData && (
          <KpiCard
            title="Total Snapshots"
            value={kpisData.snapshotsTotal.toLocaleString()}
            subtitle={
              kpisData.latestSnapshotAt
                ? `Last: ${new Date(kpisData.latestSnapshotAt).toLocaleString()}`
                : 'No snapshots yet'
            }
            gradientPreset="blue"
            // delta could be added here if calculated or available from API in future
          />
        )}
        {/* Placeholder for other KPIs that were previously mapped, if needed later, or add new specific ones */}
        {/* Example: If you want to keep a placeholder for Avg. Processing Time (static for now) */}
        {/* <KpiCard title="Avg. Processing Time" value="1.1s" delta="-2%" subtitle="Snapshot worker efficiency" gradientPreset="purple" /> */}
        
        {quotaData && (
            <KpiCard 
                title="Monthly Usage" 
                value={`${(monthlyUsageData.value / (monthlyUsageData.limit || 1) * 100).toFixed(0)}%`} 
                subtitle="Snapshot storage and processing" 
                gradientPreset="cyan" 
                slotRight={<MonthlyUsageGauge value={monthlyUsageData.value} limit={monthlyUsageData.limit || 1} warning={monthlyUsageData.warning} />}
            />
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 md:gap-8 mb-8">
        <div className="flex-1 min-w-0">
          <ComparisonEngineBar snapshots={snapshotsData || []} />
        </div>
        <div className="w-full lg:w-auto lg:max-w-xs xl:max-w-sm hidden sm:block lg:ml-4">
          {latestData && <LatestAnalysis /* Pass latestData props here */ />}
          {!latestData && !latestLoading && <div className="p-4 text-center text-muted-foreground">Latest analysis unavailable.</div>}
        </div>
      </div>

      <div className="mt-8">
        <ActivityLog snapshots={activityLogSnapshots} changes={dummyChanges} />
      </div>

      <footer className="mt-12 pt-6 border-t border-border/30 text-center">
        <div className="text-sm text-muted-foreground flex items-center justify-center">
          <span>Last updated: {new Date().toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'})} &mdash; {new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}</span>
          <span className="mx-2">|</span>
          <StatusBadge />
        </div>
      </footer>
    </main>
  );
} 