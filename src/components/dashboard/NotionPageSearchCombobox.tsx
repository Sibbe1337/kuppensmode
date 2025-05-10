"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDebounce } from '@/hooks/useDebounce'; // Assuming a useDebounce hook exists

export interface NotionPageInfo {
  id: string;
  title: string;
  icon?: string | null; // Emoji or URL
}

interface NotionPageSearchComboboxProps {
  selectedPageId: string | null;
  onPageSelect: (page: NotionPageInfo | null) => void;
  disabled?: boolean;
}

const NotionPageSearchCombobox: React.FC<NotionPageSearchComboboxProps> = ({ 
  selectedPageId, 
  onPageSelect, 
  disabled 
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedPages, setFetchedPages] = useState<NotionPageInfo[]>([]);
  const [selectedPageTitle, setSelectedPageTitle] = useState<string | null>(null);

  // Fetch initial title if a page is already selected
  useEffect(() => {
    if (selectedPageId && !selectedPageTitle) {
      // This would require an endpoint to fetch a single page by ID, or initial data prop
      // For now, if there's an ID but no title, it will just show ID until searched/reselected.
      // A better UX would involve fetching the title for the selectedPageId on mount.
      // Or, the parent component could pass the initial title.
      setSelectedPageTitle(`Page ID: ${selectedPageId}`); 
    }
    if (!selectedPageId) setSelectedPageTitle(null);
  }, [selectedPageId, selectedPageTitle]);

  useEffect(() => {
    if (debouncedSearchQuery || open) { // Fetch if query exists or if popover opened without query (initial list)
      setIsLoading(true);
      fetch(`/api/notion/search-pages?query=${encodeURIComponent(debouncedSearchQuery)}`)
        .then(res => res.json())
        .then((data: NotionPageInfo[] | {error: string}) => {
          if (Array.isArray(data)) {
            setFetchedPages(data);
          } else {
            console.error("Error fetching pages:", data.error);
            setFetchedPages([]);
          }
        })
        .catch(err => {
            console.error("Error fetching pages:", err);
            setFetchedPages([]);
        })
        .finally(() => setIsLoading(false));
    }
  }, [debouncedSearchQuery, open]);

  const handleSelect = (page: NotionPageInfo) => {
    onPageSelect(page);
    setSelectedPageTitle(page.title);
    setOpen(false);
    setSearchQuery(""); // Clear search query after selection
  };

  const handleClear = () => {
    onPageSelect(null);
    setSelectedPageTitle(null);
    setSearchQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between truncate"
          disabled={disabled}
        >
          {selectedPageId && selectedPageTitle ? (
            <span className="truncate">{selectedPageTitle}</span>
          ) : (
            "Select a Notion page..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}> {/* We handle filtering via API call & debouncedSearchQuery */}
          <CommandInput 
            placeholder="Search Notion pages..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isLoading && (
              <div className="p-2 flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!isLoading && fetchedPages.length === 0 && debouncedSearchQuery && (
                 <CommandEmpty>No pages found for "{debouncedSearchQuery}".</CommandEmpty>
            )}
             {!isLoading && fetchedPages.length === 0 && !debouncedSearchQuery && (
                 <CommandEmpty>No pages found. Type to search.</CommandEmpty>
            )}
            <CommandGroup>
              {fetchedPages.map((page) => (
                <CommandItem
                  key={page.id}
                  value={page.id} // Command uses this for its own filtering/value, ensure it's unique
                  onSelect={() => {
                    handleSelect(page);
                  }}
                  className="truncate"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedPageId === page.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {/* TODO: Add page.icon display here */}
                  <span className="truncate">{page.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
           {selectedPageId && (
            <div className="p-1 border-t">
                 <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={handleClear}>
                     Clear selection
                 </Button>
            </div>
            )}
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default NotionPageSearchCombobox; 