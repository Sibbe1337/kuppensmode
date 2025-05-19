"use client";

import React, { useState } from 'react';
import {
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter,
  DialogTrigger // If opened by a button
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from 'lucide-react';

interface SchedulerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  // TODO: Add props for current schedules if editing, and a callback for when schedules are updated
}

const cronPresets = [
  { label: "Daily at 2:00 AM", value: "0 2 * * *" },
  { label: "Weekly on Monday at 5:00 AM", value: "0 5 * * 1" },
  { label: "Monthly on 1st at 12:00 AM (midnight)", value: "0 0 1 * *" },
  // { label: "Disable Auto-Snapshots", value: "disable" } // Consider how to handle disabling
];

const SchedulerDialog: React.FC<SchedulerDialogProps> = ({ isOpen, onOpenChange }) => {
  const { toast } = useToast();
  const [selectedCron, setSelectedCron] = useState<string>(cronPresets[0].value);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCron) {
      toast({ title: "Error", description: "Please select a schedule.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cron: selectedCron }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update schedule.');
      }

      toast({ title: "Schedule Updated", description: `Auto-snapshots will now run based on the new schedule.` });
      onOpenChange(false); // Close dialog on success
      // TODO: Trigger re-fetch of schedules in the dashboard
    } catch (error: any) {
      toast({ title: "Error Updating Schedule", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Snapshot Schedule</DialogTitle>
          <DialogDescription>
            Choose how often you want automatic snapshots to be created.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="schedule-preset">Scheduling Preset</Label>
            <Select value={selectedCron} onValueChange={setSelectedCron}>
              <SelectTrigger id="schedule-preset">
                <SelectValue placeholder="Select a schedule" />
              </SelectTrigger>
              <SelectContent>
                {cronPresets.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* TODO: Display current active schedule if any */}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Set Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SchedulerDialog; 