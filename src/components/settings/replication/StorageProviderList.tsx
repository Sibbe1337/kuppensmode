'use client';

import React from 'react';
import type { UserStorageProvider } from '../../../types/storageProvider';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table"; // Corrected path if used
// import { MoreHorizontal, CheckCircle, XCircle, AlertTriangle, Zap } from "lucide-react"; // Example icons
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
  // onToggleEnable?: (providerId: string, isEnabled: boolean) => void;
}

const getStatusBadgeVariant = (status?: string): "default" | "destructive" | "secondary" | "outline" => {
  switch (status) {
    case 'success':
      return 'default'; // Typically green in Shadcn/ui with default theme
    case 'error':
      return 'destructive';
    case 'pending':
      return 'secondary'; // Or 'outline' for a less prominent look
    default:
      return 'outline';
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
          <div key={i} className="bg-card text-card-foreground border rounded-lg p-4 md:p-6 animate-pulse">
            <div className="h-5 bg-muted rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-muted rounded w-1/2 mb-1"></div>
            <div className="h-4 bg-muted rounded w-1/4 mb-3"></div>
            <div className="flex space-x-2 mt-4">
              <div className="h-9 bg-muted rounded w-20"></div>
              <div className="h-9 bg-muted rounded w-20"></div>
              <div className="h-9 bg-muted rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!configs || configs.length === 0) {
    return (
      <div className="text-center py-10 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No storage providers</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by adding a new storage provider.</p>
        {/* Optionally, include the Add Provider button here if it's not exclusively in the header of the page */}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {configs.map((config) => (
        <div key={config.id} className="bg-card text-card-foreground border dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
              <div>
                <h3 className="text-lg font-semibold">
                  {config.type?.toUpperCase()} - {config.bucket}
                </h3>
                <Badge variant={config.isEnabled ? 'default' : 'outline'} className={`text-xs ${config.isEnabled ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                  {config.isEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <div className="flex items-center space-x-2 whitespace-nowrap shrink-0">
                <Badge variant={getStatusBadgeVariant(config.validationStatus)} className="capitalize">
                  {config.validationStatus || 'N/A'}
                </Badge>
              </div>
            </div>
            
            {config.validationError && (
              <p className="text-destructive text-xs mt-2 p-2 bg-red-50 dark:bg-red-900/30 rounded-md">Error: {config.validationError}</p>
            )}
            
            <div className="text-sm text-muted-foreground mt-3 space-y-1">
              <p><strong>ID:</strong> <span className="font-mono text-xs">{config.id}</span></p>
              {config.region && <p><strong>Region:</strong> {config.region}</p>}
              {config.endpoint && <p><strong>Endpoint:</strong> <span className="text-xs">{config.endpoint}</span></p>}
              <p><strong>Replication:</strong> {config.replicationMode ? config.replicationMode.charAt(0).toUpperCase() + config.replicationMode.slice(1) : 'Mirror'}</p>
              {config.lastValidatedAt && (
                <p><strong>Last Validated:</strong> {new Date((config.lastValidatedAt as any)._seconds * 1000).toLocaleString()}</p>
              )}
            </div>
          </div>
          <div className="bg-muted/50 dark:bg-gray-700/30 px-4 py-3 md:px-6 flex flex-wrap gap-2 justify-end border-t dark:border-gray-700">
            <Button variant="outline" size="sm" onClick={() => onValidate(config.id!)} disabled={isLoading}>Validate</Button>
            <Button variant="outline" size="sm" onClick={() => onEdit(config)} disabled={isLoading}>Edit</Button>
            <Button variant="destructive" size="sm" onClick={() => onDelete(config.id!)} disabled={isLoading}>Delete</Button>
            {/* TODO: Add toggle for isEnabled using a Switch and onToggleEnable prop */}
          </div>
        </div>
      ))}
    </div>
  );
} 