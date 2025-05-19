"use client";

import React from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Circle, CircleDashed, ArrowRight, PartyPopper } from 'lucide-react';
import Link from 'next/link';
import posthog from 'posthog-js';

// Type matching the API response
interface ActivationStatus {
  connectedNotion: boolean;
  createdFirstBackup: boolean;
  initiatedFirstRestore: boolean;
}

interface ChecklistItemProps {
  isComplete: boolean;
  title: string;
  description: string;
  actionHref?: string; // Optional link for incomplete steps
  actionText?: string;
}

const ChecklistItem: React.FC<ChecklistItemProps> = ({ 
    isComplete, title, description, actionHref, actionText 
}) => {
    const Icon = isComplete ? CheckCircle2 : CircleDashed;
    const iconColor = isComplete ? "text-green-600" : "text-muted-foreground";

    return (
        <div className="flex items-start gap-4 py-3 border-b last:border-b-0">
            <Icon className={`h-5 w-5 mt-1 flex-shrink-0 ${iconColor}`} />
            <div className="flex-grow">
                <p className={`font-medium ${isComplete ? 'line-through text-muted-foreground' : ''}`}>{title}</p>
                <p className={`text-sm text-muted-foreground ${isComplete ? 'line-through' : ''}`}>{description}</p>
                {!isComplete && actionHref && actionText && (
                    <Button variant="link" size="sm" asChild className="p-0 h-auto mt-1">
                        <Link href={actionHref}>{actionText} <ArrowRight className='h-3 w-3 ml-1'/></Link>
                    </Button>
                )}
            </div>
        </div>
    );
};

const ActivationChecklist: React.FC = () => {
  const { data: status, error, isLoading } = useSWR<ActivationStatus>(
    '/api/user/activation-status', 
    fetcher, 
    { revalidateOnFocus: false } // Only fetch once usually
  );

  if (isLoading) {
    return <Skeleton className="h-40 w-full max-w-md" />;
  }

  if (error || !status) {
    // Don't render the checklist if there's an error fetching status
    console.error("Error loading activation status:", error);
    return null; 
  }

  const steps = [
    {
      key: 'connectedNotion',
      title: "Connect Notion",
      description: "Grant access to back up your workspace.",
      actionHref: "/dashboard/settings",
      actionText: "Go to Settings"
    },
    {
      key: 'createdFirstBackup',
      title: "Create First Backup",
      description: "Initiate your first snapshot.",
      // No direct link, user clicks the FAB
    },
    {
      key: 'initiatedFirstRestore',
      title: "Try Restoring",
      description: "Restore a page or database from a backup.",
      // No direct link, user uses the table actions
    },
  ];

  const completedSteps = steps.filter(step => status[step.key as keyof ActivationStatus]).length;
  const totalSteps = steps.length;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  const isFullyComplete = completedSteps === totalSteps;

  // Only render the checklist if not fully complete
  if (isFullyComplete) {
      // Optionally, track completion only once
      // useEffect(() => { posthog.capture('activation_checklist_completed'); }, []); 
      return null; 
  }

  return (
    <div className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm max-w-md mb-6">
      <h3 className="text-lg font-semibold mb-2">Getting Started Checklist</h3>
      <div className="flex items-center gap-2 mb-3">
         <Progress value={progressPercent} className="flex-grow h-2" />
         <span className='text-xs text-muted-foreground'>{completedSteps}/{totalSteps} Complete</span>
      </div>
      
      <div className="space-y-1">
        {steps.map((step) => (
            <ChecklistItem 
                key={step.key}
                isComplete={status[step.key as keyof ActivationStatus]}
                title={step.title}
                description={step.description}
                actionHref={step.actionHref}
                actionText={step.actionText}
            />
        ))}
      </div>

      {/* Optional CTA when incomplete */} 
      {/* 
      <div className="mt-4 text-center">
         <p className="text-sm text-muted-foreground">Complete these steps to secure your workspace!</p>
      </div>
      */}

      {/* TODO: Add 'Get 14-day Pro Trial' button on completion if desired */} 
    </div>
  );
};

export default ActivationChecklist; 