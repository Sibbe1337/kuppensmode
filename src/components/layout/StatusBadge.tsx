"use client";

import React from 'react';
import useSWR from 'swr';
import apiClient from '@/lib/apiClient';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StatusData {
  status: string; 
  backupSuccessRate?: number;
  totalPagesStored?: number;
  lastUpdated?: string;
}

const StatusBadge: React.FC = () => {
  const { data, error, isLoading } = useSWR<StatusData>('/api/status', apiClient, {
    refreshInterval: 300000, 
    revalidateOnFocus: true,
  });

  let dotColor = 'bg-gray-400';
  let statusText = 'Checking Status...';
  let tooltipText = 'Loading system status...';

  if (error) {
    dotColor = 'bg-red-500';
    statusText = 'Status Unavailable';
    tooltipText = 'Error fetching status.';
  } else if (data) {
    switch (data.status?.toLowerCase()) {
      case 'operational':
        dotColor = 'bg-green-500';
        statusText = 'All Systems Operational';
        tooltipText = `Backup Success: ${data.backupSuccessRate?.toFixed(1)}%`;
        break;
      case 'degraded_performance':
        dotColor = 'bg-yellow-500';
        statusText = 'Degraded Performance';
        tooltipText = 'Some systems may be slow or impacted.';
        break;
      case 'partial_outage':
      case 'major_outage':
        dotColor = 'bg-red-500';
        statusText = 'Service Disruption';
        tooltipText = 'Some services are currently unavailable.';
        break;
      default:
        dotColor = 'bg-yellow-500';
        statusText = 'Status Unknown';
        tooltipText = 'Current system status is undetermined.';
    }
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/status" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors" aria-label="View system status page">
            <span className={cn("h-2.5 w-2.5 rounded-full mr-2", dotColor, isLoading && "animate-pulse")}></span>
            {isLoading ? 'Loading Status...' : 'System Status'}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          <p>{tooltipText}</p>
          {data?.lastUpdated && <p className="text-xs text-muted-foreground mt-1">Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default StatusBadge; 