"use client";

import React, { useState } from 'react';
import useSWR from 'swr';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle, Edit3, Trash2, CheckCircle, AlertTriangle, Loader2, FileInput, Link2, RefreshCw } from 'lucide-react';
import apiClient from '@/lib/apiClient';
import type { UserStorageProvider } from '@/types/storageProvider';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import StorageProviderModal from './StorageProviderModal';

const StorageSettingsPage = () => {
  const { toast } = useToast();
  const { data: providers, error, isLoading, mutate } = useSWR<Partial<UserStorageProvider>[]>(
    '/api/user/storage-configs',
    apiClient
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<Partial<UserStorageProvider> | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);

  const handleAddNew = () => {
    setCurrentProvider(null);
    setIsModalOpen(true);
  };

  const handleEdit = (provider: Partial<UserStorageProvider>) => {
    setCurrentProvider(provider);
    setIsModalOpen(true);
  };

  const handleDelete = async (providerId?: string) => {
    if (!providerId) {
        toast({ title: 'Error', description: 'Provider ID missing for delete.', variant: 'destructive' });
        return;
    }
    if (!confirm('Are you sure you want to delete this storage provider configuration?')) return;
    
    try {
      await apiClient(`/api/user/storage-configs/${providerId}`, { method: 'DELETE' });
      toast({ title: 'Success', description: 'Storage provider configuration deleted.' });
      mutate(); // Re-fetch list
    } catch (err: any) {
      const apiErrorMessage = err.response?.data?.error || err.response?.data?.message || err.message;
      toast({ title: 'Error', description: apiErrorMessage || 'Failed to delete storage provider.', variant: 'destructive' });
    }
  };

  const handleValidate = async (providerId?: string) => {
    if (!providerId) {
        toast({ title: 'Error', description: 'Provider ID missing for validation.', variant: 'destructive' });
        return;
    }
    setValidatingId(providerId);
    try {
        const result = await apiClient(`/api/user/storage-configs/${providerId}`, { method: 'POST' });
        
        if (result.success || result.validationStatus === 'success') {
            toast({ title: 'Validation Success', description: `Connection validated successfully.` });
        } else {
            toast({ title: 'Validation Failed', description: result.error || 'Could not validate connection.', variant: 'destructive' });
        }
        mutate();
    } catch (err: any) {
        const apiErrorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to validate connection.';
        toast({ title: 'Validation Error', description: apiErrorMessage, variant: 'destructive' });
        mutate();
    } finally {
        setValidatingId(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (error) {
    return <div className="text-destructive p-4">Error loading storage configurations: {error.message}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Storage Replication</h1>
          <p className="text-muted-foreground">
            Configure S3 or Cloudflare R2 to mirror your snapshots for added redundancy.
          </p>
        </div>
        <Button onClick={handleAddNew} variant="default">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Provider
        </Button>
      </div>

      {providers && providers.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => (
            <Card key={provider.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg">{(provider.type || 'N/A').toUpperCase()} - {provider.bucket}</CardTitle>
                        <CardDescription className="text-xs">
                            {provider.region && `Region: ${provider.region}`}
                            {provider.region && provider.endpoint && <br/>}
                            {provider.endpoint && `Endpoint: ${provider.endpoint.substring(0,30)}${provider.endpoint.length > 30 ? '...' : ''}`}
                            {!provider.region && !provider.endpoint && 'No region/endpoint details'}
                        </CardDescription>
                    </div>
                     {provider.isEnabled ? 
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" /> : 
                        <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />} 
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">
                  Replication: {provider.replicationMode || 'mirror'} <br />
                  Status: <span className={cn(
                    'font-medium',
                    provider.validationStatus === 'success' && 'text-green-600 dark:text-green-400',
                    provider.validationStatus === 'pending' && 'text-yellow-600 dark:text-yellow-400',
                    provider.validationStatus === 'error' && 'text-red-600 dark:text-red-500',
                  )}>{provider.validationStatus || 'unknown'}</span>
                </p>
                {provider.validationError && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-1">Error: {provider.validationError}</p>
                )}
              </CardContent>
              <div className="border-t p-4 flex flex-wrap justify-end gap-2">
                <Button 
                    variant="outline"
                    size="sm" 
                    onClick={() => handleValidate(provider.id)}
                    disabled={validatingId === provider.id}
                >
                  {validatingId === provider.id ? 
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : 
                    <RefreshCw className="mr-1 h-3 w-3" />}
                  Validate
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleEdit(provider)}>
                  <Edit3 className="mr-1 h-3 w-3" /> Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(provider.id)} >
                  <Trash2 className="mr-1 h-3 w-3" /> Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        !isLoading && (
            <Card className="text-center py-12">
            <CardHeader>
                <CardTitle>No Storage Providers Configured</CardTitle>
                <CardDescription>Add an S3 or R2 bucket to start replicating your snapshots.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={handleAddNew} variant="default">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Your First Provider
                </Button>
            </CardContent>
            </Card>
        )
      )}
      <StorageProviderModal 
        isOpen={isModalOpen} 
        onOpenChange={setIsModalOpen} 
        provider={currentProvider} 
        onSuccess={() => { 
            mutate();
            setIsModalOpen(false);
            setCurrentProvider(null);
        }} 
      />
    </div>
  );
};

export default StorageSettingsPage; 