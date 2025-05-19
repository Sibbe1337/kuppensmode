import React from 'react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, CalendarDays } from 'lucide-react'; 
import { cn } from "@/lib/utils";
import type { Snapshot } from "@/types";

interface SnapshotPickerButtonProps {
  value?: string;
  onValueChange: (value: string) => void;
  snapshots: Snapshot[];
  placeholder: string;
  disabled?: boolean;
  className?: string;
  popoverClassName?: string;
  popoverAlign?: "start" | "center" | "end";
}

const SnapshotPickerButton: React.FC<SnapshotPickerButtonProps> = ({
  value,
  onValueChange,
  snapshots,
  placeholder,
  disabled,
  className,
  popoverClassName,
  popoverAlign = "center"
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const selectedSnapshot = snapshots.find(snap => snap.id === value);
  
  let displayLabel = placeholder;
  if (selectedSnapshot) {
    const date = new Date(selectedSnapshot.timestamp);
    const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}`;
    displayLabel = `${selectedSnapshot.snapshotIdActual || selectedSnapshot.id} (${formattedDate})`;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className={cn(
            "w-full justify-between font-normal h-10 px-3 py-2 text-sm truncate",
            "bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600",
            "hover:bg-slate-100 dark:hover:bg-slate-600/80",
            "text-slate-900 dark:text-slate-100",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-background dark:focus-visible:ring-offset-slate-800 focus-visible:ring-offset-2",
            !selectedSnapshot && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate flex-grow text-left">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        align={popoverAlign}
        className={cn(
            "w-[--radix-popover-trigger-width] p-0 mt-1 shadow-lg rounded-lg",
            "bg-slate-50/90 dark:bg-slate-800/90 backdrop-blur-lg border-slate-200/70 dark:border-slate-700/70",
            popoverClassName
        )}
        style={{ zIndex: 50 }}
      >
        {/* Optional: Add a search input here for many snapshots */}
        <div className="max-h-[280px] overflow-y-auto p-1 space-y-0.5"> 
          {snapshots.length === 0 && (
            <p className="p-2 text-xs text-muted-foreground text-center">No snapshots available.</p>
          )}
          {snapshots.map((snap) => {
            const snapDate = new Date(snap.timestamp);
            const formattedSnapDate = `${snapDate.toLocaleDateString()} ${snapDate.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}`;
            return (
              <Button
                key={snap.id}
                variant="ghost"
                className={cn(
                  "w-full justify-start font-normal h-auto px-2 py-1.5 text-xs rounded-md flex items-center gap-2",
                  "text-slate-700 dark:text-slate-200",
                  "hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary dark:hover:text-primary",
                  value === snap.id && "bg-primary/20 dark:bg-primary/30 text-primary dark:text-primary"
                )}
                onClick={() => {
                  onValueChange(snap.id);
                  setIsOpen(false);
                }}
              >
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0"/> 
                <span className="flex-grow text-left truncate">{snap.snapshotIdActual || snap.id} ({formattedSnapDate})</span>
                <Check
                  className={cn(
                    "ml-auto h-4 w-4 shrink-0",
                    value === snap.id ? "opacity-100 text-primary" : "opacity-0"
                  )}
                />
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SnapshotPickerButton; 