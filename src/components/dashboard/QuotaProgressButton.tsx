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
    buttonContent = "Upgrade";
    tooltipContent = `Limit reached! ${tooltipContent}. Upgrade for more.`;
    buttonClasses = "bg-destructive hover:bg-destructive/90 text-destructive-foreground";
  } else if (isAlmostFull && isStarter) {
    buttonContent = "Upgrade";
    tooltipContent = `Almost full! ${tooltipContent}. Consider upgrading.`;
    buttonClasses = "bg-orange-500 hover:bg-orange-600 text-white border-orange-500";
  } else {
    buttonContent = `${snapshotsUsed}/${snapshotsLimit}`;
  }

  return (
    <>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" // Base variant
              size="sm"
              className={cn(
                "fixed top-4 right-4 md:right-6 h-10 rounded-md z-50 shadow-lg",
                buttonClasses // Apply conditional classes
              )}
              onClick={() => setIsUpgradeModalOpen(true)}
            >
              {(isFull && isStarter) || (isAlmostFull && isStarter) ? <Zap className="h-4 w-4 mr-1.5" /> : null}
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