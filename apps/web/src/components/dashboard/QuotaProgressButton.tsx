"use client";

import React, { useState } from 'react';
import { useQuota } from '@/hooks/useQuota';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ShoppingCart, Zap } from 'lucide-react'; // Zap or ShoppingCart for upgrade idea
import UpgradeModal from '@/components/modals/UpgradeModal';
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

const QuotaProgressButton: React.FC = () => {
  const { quota, isLoading: isQuotaLoading, isError: isQuotaError } = useQuota();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  if (isQuotaLoading) {
    return <Skeleton className="fixed top-4 right-6 h-10 w-24 rounded-md z-50" />;
  }

  if (isQuotaError || !quota) {
    return null; // Don't show if error or no quota
  }

  const { planName, snapshotsUsed, snapshotsLimit } = quota;
  const usagePercent = snapshotsLimit > 0 ? Math.min(100, (snapshotsUsed / snapshotsLimit) * 100) : 0;
  const isStarter = planName.toLowerCase() === 'starter' || planName.toLowerCase() === 'free tier';
  const isAlmostFull = usagePercent >= 80;
  const isFull = snapshotsUsed >= snapshotsLimit;

  let buttonContent;
  let tooltipContent = `Snapshots: ${snapshotsUsed} / ${snapshotsLimit}`;
  let buttonClasses = ""; // Use classes for destructive/warning states

  if (isFull && isStarter) {
    buttonContent = (
      <div className="flex items-center">
        <Zap className="h-4 w-4 mr-1.5" />
        Upgrade
      </div>
    );
    tooltipContent = `Limit reached! ${snapshotsUsed}/${snapshotsLimit} backups. Upgrade for more.`;
    buttonClasses = "bg-destructive hover:bg-destructive/90 text-destructive-foreground";
  } else if (isAlmostFull && isStarter) {
    buttonContent = (
      <div className="flex items-center">
        <Zap className="h-4 w-4 mr-1.5" />
        Upgrade
      </div>
    );
    tooltipContent = `Almost full! ${snapshotsUsed}/${snapshotsLimit} backups. Consider upgrading.`;
    buttonClasses = "bg-orange-500 hover:bg-orange-600 text-white border-orange-500";
  } else {
    buttonContent = (
      <div className="flex flex-col items-center w-full px-1">
        <Progress value={usagePercent} className="h-2 w-full" />
        <span className="text-xs mt-0.5">{`${snapshotsUsed}/${snapshotsLimit} backups`}</span>
      </div>
    );
  }

  return (
    <>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size={ (isFull && isStarter) || (isAlmostFull && isStarter) ? "sm" : "default" }
              className={cn(
                "fixed top-4 right-4 md:right-6 rounded-md z-50 shadow-lg",
                (isFull && isStarter) || (isAlmostFull && isStarter) ? "h-10" : "h-auto py-2 px-3",
                buttonClasses 
              )}
              onClick={() => setIsUpgradeModalOpen(true)}
            >
              {buttonContent}
            </Button>
          </TooltipTrigger>
          <TooltipContent align="end">
            <p>{tooltipContent}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <UpgradeModal 
        isOpen={isUpgradeModalOpen} 
        onOpenChange={setIsUpgradeModalOpen} 
        currentPlanName={planName}
        triggerFeature={isFull ? "more snapshots" : (isAlmostFull ? "uninterrupted backups" : "more features")}
      />
    </>
  );
};

export default QuotaProgressButton; 