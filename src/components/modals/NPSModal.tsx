"use client";

import React, { useState } from 'react';
import {
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import posthog from 'posthog-js';
import { useAuth } from '@clerk/nextjs';
import { useToast } from "@/hooks/use-toast";

interface NPSModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const NPSModal: React.FC<NPSModalProps> = ({ isOpen, onOpenChange }) => {
  const { userId } = useAuth();
  const { toast } = useToast();
  const [selectedScore, setSelectedScore] = useState<number | null>(null);

  const handleSubmitNPS = (score: number) => {
    posthog.capture('nps_score_submitted', { score: score, userId });
    toast({ title: "Thanks for your feedback!", description: `You rated us ${score}/10.`, duration: 4000 });
    localStorage.setItem(`npsShown_${userId}`, 'true'); // Also mark here
    onOpenChange(false);
    setSelectedScore(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) setSelectedScore(null); // Reset score if modal is closed
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate Pagelifeline</DialogTitle>
          <DialogDescription>
            How likely are you to recommend Pagelifeline to a friend or colleague?
            (0 = Not at all likely, 10 = Extremely likely)
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="grid grid-cols-11 gap-1.5">
            {[...Array(11)].map((_, i) => (
              <Button
                key={i}
                variant={selectedScore === i ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedScore(i)}
                className="aspect-square p-0 h-8 w-8 text-xs md:h-9 md:w-9 md:text-sm"
              >
                {i}
              </Button>
            ))}
          </div>
        </div>
        <DialogFooter>
            <Button variant="ghost" onClick={() => { 
                onOpenChange(false); 
                setSelectedScore(null);
                // Optionally log 'nps_skipped_in_modal' if not already handled by `npsShown` flag
            }}>Maybe Later</Button>
          <Button onClick={() => selectedScore !== null && handleSubmitNPS(selectedScore)} disabled={selectedScore === null}>
            Submit Score
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NPSModal; 