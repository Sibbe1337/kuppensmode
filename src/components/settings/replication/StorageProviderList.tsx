'use client';

import React from 'react';
import type { UserStorageProvider } from '@/types/storageProvider'; // Assuming path alias resolves
import { Button } from '@/components/ui/button'; // Assuming path alias resolves
// import { Badge } from '@/components/ui/badge'; // Assuming you might have a Badge component for status
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // If using a table
// import { MoreHorizontal } from "lucide-react" // For a dropdown menu for actions
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuLabel,
//   DropdownMenuSeparator,
//   DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu"

interface StorageProviderListProps {
  configs: Partial<UserStorageProvider>[] | undefined;
  isLoading: boolean;
  onEdit: (config: Partial<UserStorageProvider>) => void;
  onDelete: (providerId: string) => void;
  onValidate: (providerId: string) => void;
  // onToggleEnable?: (providerId: string, isEnabled: boolean) => void; // Future enhancement
}

// Helper to get a status color/icon (tailwind classes or actual icons)
const getStatusIndicator = (status?: string) => {
  switch (status) {
    case 'success':
      return <span className="h-2 w-2 rounded-full bg-green-500 inline-block mr-2" title="Validated"></span>;
    case 'error':
      return <span className="h-2 w-2 rounded-full bg-red-500 inline-block mr-2" title="Error"></span>;
    case 'pending':
      return <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse inline-block mr-2" title="Pending Validation"></span>;
    default:
      return <span className="h-2 w-2 rounded-full bg-gray-300 inline-block mr-2" title="Unknown"></span>;
  }
};

export default function StorageProviderList({ 
  configs, 
  isLoading, 
  onEdit,
  onDelete,
  onValidate 
}: StorageProviderListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="p-4 border rounded-md animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-1"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-3"></div>
            <div className="flex space-x-2">
              <div className="h-8 bg-gray-200 rounded w-20"></div>
              <div className="h-8 bg-gray-200 rounded w-20"></div>
              <div className="h-8 bg-gray-200 rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!configs || configs.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500">No storage provider configurations added yet.</p>
        <p className="text-sm text-gray-400 mt-1">Click "Add Provider" to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {configs.map((config) => (
        <div key={config.id} className="bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-lg p-4 md:p-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-3">
            <div className="mb-2 sm:mb-0">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                {config.type?.toUpperCase()} - {config.bucket}
              </h3>
              <p className={`text-xs ${config.isEnabled ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {config.isEnabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <div className="flex items-center space-x-2 whitespace-nowrap">
                {getStatusIndicator(config.validationStatus)}
                <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">
                    {config.validationStatus || 'N/A'}
                </span>
            </div>
          </div>
          
          {config.validationError && (
            <p className="text-red-500 dark:text-red-400 text-xs mb-2">Error: {config.validationError}</p>
          )}
          
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            <p>ID: <span className="font-mono">{config.id}</span></p>
            {config.region && <p>Region: {config.region}</p>}
            {config.endpoint && <p>Endpoint: {config.endpoint}</p>}
            <p>Replication: {config.replicationMode || 'mirror'}</p>
            {config.lastValidatedAt && (
              <p>Last Validated: {new Date((config.lastValidatedAt as any)._seconds * 1000).toLocaleString()}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onValidate(config.id!)} disabled={isLoading}>Validate</Button>
            <Button variant="outline" size="sm" onClick={() => onEdit(config)} disabled={isLoading}>Edit</Button>
            <Button variant="destructive" size="sm" onClick={() => onDelete(config.id!)} disabled={isLoading}>Delete</Button>
            {/* TODO: Add toggle for isEnabled */}
          </div>
        </div>
      ))}
    </div>
  );
} 