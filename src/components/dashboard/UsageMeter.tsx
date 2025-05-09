"use client";

import React, { useState } from 'react';
import { useQuota } from '@/hooks/useQuota';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Zap, Loader2 } from 'lucide-react';
import UpgradeModal from '@/components/modals/UpgradeModal';

const UsageMeter: React.FC = () => {
  const { quota, isLoading: isQuotaLoading, isError: isQuotaError } = useQuota();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  if (isQuotaLoading) {
    return <Skeleton className="h-4 w-32" />;
  }

  if (isQuotaError || !quota) {
    return (
      <span className="text-xs text-destructive flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        <span>Usage Error</span>
      </span>
    );
  }

  const { planName, snapshotsUsed, snapshotsLimit } = quota;
  const isStarter = planName.toLowerCase() === 'starter';

  return (
    <>
      <span className="text-sm text-muted-foreground flex items-center gap-2">
        <span>Back-ups: {snapshotsUsed} / {snapshotsLimit}</span>
        <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-full">
          {planName}
        </span>
        {isStarter && (
            <Button 
              variant="link"
              size="sm" 
              onClick={() => setIsUpgradeModalOpen(true)}
              className="text-xs h-auto p-0 text-primary hover:underline"
            >
              (Upgrade)
            </Button>
          )}
      </span>
      <UpgradeModal 
        isOpen={isUpgradeModalOpen} 
        onOpenChange={setIsUpgradeModalOpen} 
        currentPlanName={planName}
        triggerFeature="more snapshots and features"
      />
    </>
  );
};

export default UsageMeter; 