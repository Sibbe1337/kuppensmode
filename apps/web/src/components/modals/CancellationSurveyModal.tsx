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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import posthog from 'posthog-js';
import { useAuth } from '@clerk/nextjs';
import { useToast } from "@/hooks/use-toast";

interface CancellationSurveyModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const CANCELLATION_REASONS = [
  { id: "price", label: "It was too expensive" },
  { id: "not_used_enough", label: "I didn't use it enough" },
  { id: "missing_features", label: "It was missing features I needed" },
  { id: "found_alternative", label: "I found an alternative solution" },
  { id: "temporary_pause", label: "I'm just taking a temporary break" },
  { id: "other", label: "Other (please specify below)" },
];

const CancellationSurveyModal: React.FC<CancellationSurveyModalProps> = ({ isOpen, onOpenChange }) => {
  const { userId } = useAuth();
  const { toast } = useToast();
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [otherReasonText, setOtherReasonText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitSurvey = () => {
    if (!selectedReason) {
      toast({ title: "Please select a reason", variant: "destructive" });
      return;
    }
    if (selectedReason === 'other' && !otherReasonText.trim()) {
      toast({ title: "Please specify your reason", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const surveyData = {
      userId,
      reason: selectedReason,
      otherReasonDetail: selectedReason === 'other' ? otherReasonText.trim() : null,
    };

    posthog.capture('cancellation_survey_submitted', surveyData);
    
    // Optionally, send to a backend endpoint to store in Firestore if detailed analysis beyond PostHog is needed
    // fetch('/api/survey/cancellation', { method: 'POST', body: JSON.stringify(surveyData) });

    toast({ title: "Feedback Submitted", description: "Thank you for your feedback. We appreciate you trying Pagelifeline!" });
    setIsSubmitting(false);
    onOpenChange(false);
    // Reset form
    setSelectedReason("");
    setOtherReasonText("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (isSubmitting) return; // Prevent closing while submitting
        onOpenChange(open);
        if (!open) { // Reset form if closed without submitting
            setSelectedReason("");
            setOtherReasonText("");
        }
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>We're Sorry to See You Go!</DialogTitle>
          <DialogDescription>
            Your feedback is valuable and will help us improve Pagelifeline. 
            Please let us know why you decided to cancel your subscription.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="space-y-2">
            <Label className="text-base font-medium">Primary reason for cancelling:</Label>
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {CANCELLATION_REASONS.map((reason) => (
                <div key={reason.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={reason.id} id={`reason-${reason.id}`} />
                  <Label htmlFor={`reason-${reason.id}`} className="font-normal cursor-pointer">{reason.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {selectedReason === 'other' && (
            <div className="space-y-2">
              <Label htmlFor="otherReasonText" className="text-base font-medium">Please specify:</Label>
              <Textarea 
                id="otherReasonText" 
                value={otherReasonText} 
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setOtherReasonText(e.target.value)} 
                placeholder="Your reason..."
                rows={3}
              />
            </div>
          )}
        </div>
        <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Skip Feedback
            </Button>
          <Button onClick={handleSubmitSurvey} disabled={isSubmitting || !selectedReason}>
            {isSubmitting ? "Submitting..." : "Submit Feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancellationSurveyModal; 