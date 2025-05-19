"use client";

import React, { useState } from 'react';
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import UpgradeModal from '../billing/UpgradeModal';
import Link from 'next/link';
import { SettingsIcon, LayoutDashboardIcon, BarChartBig, Loader2, AlertTriangle } from 'lucide-react';
import { useQuota } from '@/hooks/useQuota';
import type { UserQuota } from '@/types';

const Sidebar = () => {
  const { quota, isLoading, isError } = useQuota();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Default values for display when loading or error
  const displayQuota: Partial<UserQuota> = quota || { 
    snapshotsUsed: 0, 
    snapshotsLimit: 0, 
    planName: 'Loading...',
    // planId: 'loading' // Add a placeholder planId if your UserQuota strictly requires it and it's used elsewhere
  };
  const snapshotUsagePercent = displayQuota.snapshotsLimit && displayQuota.snapshotsLimit > 0 
    ? (displayQuota.snapshotsUsed! / displayQuota.snapshotsLimit!) * 100 
    : 0;

  return (
    <>
      <aside className="bg-slate-50 dark:bg-gray-800 text-primary border-r border-border w-64 min-h-screen p-4 shadow flex flex-col">
        <div className="mb-8">
          <div className="text-2xl font-bold text-foreground mb-6 pl-2">Notion Lifeline</div>
          
          <nav className="space-y-1">
            <Link 
              href="/dashboard"
              className="flex items-center gap-3 px-2 py-2 text-sm font-medium rounded-md hover:bg-muted hover:text-accent-foreground"
              passHref
            >
              <LayoutDashboardIcon className="h-4 w-4" />
              Dashboard
            </Link>
            <Link 
              href="/dashboard"
              className="flex items-center gap-3 px-2 py-2 text-sm font-medium rounded-md hover:bg-muted hover:text-accent-foreground"
              passHref
            >
              <BarChartBig className="h-4 w-4" />
              Analytics
            </Link>
            <Link 
              href="/dashboard/settings" 
              className="sidebar-settings-link flex items-center gap-3 px-2 py-2 text-sm font-medium rounded-md hover:bg-muted hover:text-accent-foreground"
              passHref
            >
              <SettingsIcon className="h-4 w-4" />
              Settings
            </Link>
          </nav>
        </div>
        
        <div className="sidebar-quota-section mt-auto">
          {isLoading && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg text-center">
              <Loader2 className="h-5 w-5 animate-spin inline-block mb-1" />
              <p className="text-xs text-muted-foreground">Loading usage...</p>
            </div>
          )}
          {isError && !isLoading && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-center">
              <AlertTriangle className="h-5 w-5 text-destructive inline-block mb-1" />
              <p className="text-xs text-destructive">Failed to load usage.</p>
            </div>
          )}
          {quota && !isLoading && !isError && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <h3 className="text-sm font-semibold text-foreground mb-1">Usage ({displayQuota.planName})</h3>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                    <span>Snapshots</span>
                    <span>{displayQuota.snapshotsUsed} / {displayQuota.snapshotsLimit}</span>
                  </div>
                  <Progress value={snapshotUsagePercent} className="h-2" />
                </div>
              </div>
            </div>
          )}
          <Button 
            variant="default"
            className="w-full"
            onClick={() => setIsUpgradeModalOpen(true)}
          >
            Upgrade Plan
          </Button>
        </div>
      </aside>
      <UpgradeModal 
        open={isUpgradeModalOpen} 
        onOpenChange={setIsUpgradeModalOpen} 
        currentPlanId={quota?.planName}
      />
    </>
  );
};

export default Sidebar; 