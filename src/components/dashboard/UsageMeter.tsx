"use client";

import React, { useState } from 'react';
import { useQuota } from '@/hooks/useQuota';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Zap } from 'lucide-react';
import UpgradeModal from '@/components/modals/UpgradeModal';
import { cn } from "@/lib/utils";

const UsageMeter: React.FC = () => {
  const { quota, isLoading: isQuotaLoading, isError: isQuotaError } = useQuota();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  if (isQuotaLoading) {
    return <Skeleton className="h-12 w-full max-w-[250px] rounded-md" />;
  }

  if (isQuotaError || !quota) {
    return (
      <div className="text-xs text-destructive flex items-center gap-1">
        <AlertCircle className="h-4 w-4" />
        <span>Usage Data Unavailable</span>
      </div>
    );
  }

  const { planName, snapshotsUsed, snapshotsLimit } = quota;
  const usagePercent = snapshotsLimit > 0 ? Math.min(100, (snapshotsUsed / snapshotsLimit) * 100) : 0;
  const isStarter = planName.toLowerCase() === 'starter';
  const isAlmostFull = usagePercent >= 80;
  const isFull = snapshotsUsed >= snapshotsLimit;

  const commonClasses = "p-3 border rounded-lg shadow-sm max-w-[250px] text-sm space-y-1.5 cursor-default";
  const clickableClasses = "hover:border-primary/70 hover:shadow-md transition-all";

  const meterContent = (
    <>
        <div className="flex justify-between items-baseline">
            <span className="text-xs font-medium text-muted-foreground">{planName} Plan</span>
            <span className="text-xs font-semibold">{snapshotsUsed} / {snapshotsLimit} used</span>
        </div>
        <Progress value={usagePercent} className={cn(
            "h-2",
            isAlmostFull && !isFull && "[&>div]:bg-orange-500",
            isFull && "[&>div]:bg-destructive"
        )} />
        {isAlmostFull && isStarter && !isFull && (
            <p className="text-xs text-orange-500 flex items-center">
                <Zap className="h-3 w-3 mr-1" /> Almost full! Upgrade to keep auto-backups.
            </p>
        )}
        {isFull && isStarter && (
             <p className="text-xs text-destructive flex items-center">
                <Zap className="h-3 w-3 mr-1" /> Limit reached! Upgrade for more snapshots.
            </p>
        )}
    </>
  );

  if (isStarter) {
    return (
      <>
        <button 
          onClick={() => setIsUpgradeModalOpen(true)} 
          className={cn(commonClasses, clickableClasses, "text-left")}
          aria-label={`Current plan: ${planName}. Snapshots used: ${snapshotsUsed} of ${snapshotsLimit}. Click to upgrade.`}
        >
          {meterContent}
        </button>
        <UpgradeModal 
          isOpen={isUpgradeModalOpen} 
          onOpenChange={setIsUpgradeModalOpen} 
          currentPlanName={planName}
          triggerFeature={isFull ? "more snapshots" : "uninterrupted automatic backups"}
        />
      </>
    );
  }

  // Non-clickable version for paid plans (or if not starter)
  return (
    <div className={commonClasses}>
      {meterContent}
    </div>
  );
};

export default UsageMeter; 