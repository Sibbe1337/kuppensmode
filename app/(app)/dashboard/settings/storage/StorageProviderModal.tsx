"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import apiClient from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';
import type { UserStorageProvider, StorageProviderType } from '@/types/storageProvider';

interface StorageProviderModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  provider?: Partial<UserStorageProvider> | null; // For editing, null for new
  onSuccess: () => void;
}

const StorageProviderModal: React.FC<StorageProviderModalProps> = ({
  isOpen,
  onOpenChange,
  provider,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [type, setType] = useState<StorageProviderType>('s3');
  const [bucket, setBucket] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [region, setRegion] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [replicationMode, setReplicationMode] = useState<'mirror' | 'archive'>('mirror');
  const [forcePathStyle, setForcePathStyle] = useState<boolean>(false);
  const [isEnabled, setIsEnabled] = useState<boolean>(true);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (provider?.id) {
        setType(provider.type || 's3');
        setBucket(provider.bucket || '');
        setRegion(provider.region || '');
        setEndpoint(provider.endpoint || '');
        setReplicationMode(provider.replicationMode || 'mirror');
        setForcePathStyle(provider.forcePathStyle !== undefined ? provider.forcePathStyle : (provider.type === 'r2'));
        setIsEnabled(provider.isEnabled !== undefined ? provider.isEnabled : true);
        setAccessKeyId('');
        setSecretAccessKey('');
      } else {
        setType('s3');
        setBucket('');
        setAccessKeyId('');
        setSecretAccessKey('');
        setRegion('');
        setEndpoint('');
        setReplicationMode('mirror');
        setForcePathStyle(type === 'r2');
        setIsEnabled(true);
      }
    }
  }, [provider, isOpen]);

  useEffect(() => {
    if (isOpen && !provider?.id) {
        setForcePathStyle(type === 'r2');
    }
  }, [type, isOpen, provider?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!type || !bucket) {
        toast({ title: "Error", description: "Provider type and bucket name are required.", variant: "destructive" });
        setIsLoading(false);
        return;
    }
    if (!provider?.id && (!accessKeyId || !secretAccessKey)) {
        toast({ title: "Error", description: "Access key and secret key are required for new providers.", variant: "destructive" });
        setIsLoading(false);
        return;
    }
    if (provider?.id && ((accessKeyId && !secretAccessKey) || (!accessKeyId && secretAccessKey))) {
        toast({ title: "Error", description: "Both Access Key ID and Secret Access Key are required to update credentials.", variant: "destructive" });
        setIsLoading(false);
        return;
    }
    if (type === 'r2' && !endpoint) {
        toast({ title: "Error", description: "Endpoint is required for R2 storage type.", variant: "destructive" });
        setIsLoading(false);
        return;
    }
    if (type === 's3' && !region) {
        toast({ title: "Error", description: "Region is required for S3 storage type.", variant: "destructive" });
        setIsLoading(false);
        return;
    }

    const payload: any = {
      type,
      bucket,
      replicationMode,
      forcePathStyle,
      isEnabled,
    };
    if (type === 's3') payload.region = region;
    if (type === 'r2') payload.endpoint = endpoint;

    if (accessKeyId && secretAccessKey) {
      payload.accessKeyId = accessKeyId;
      payload.secretAccessKey = secretAccessKey;
    }

    try {
      if (provider?.id) {
        await apiClient(`/api/user/storage-configs/${provider.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        toast({ title: "Success", description: `Storage provider updated. Re-validation may be needed if credentials changed.` });
      } else {
        await apiClient('/api/user/storage-configs', { method: 'POST', body: JSON.stringify(payload) });
        toast({ title: "Success", description: `Storage provider added. Validation pending.` });
      }
      onSuccess(); 
    } catch (err: any) {
      console.error("Error submitting storage config:", err);
      const apiErrorMessage = err.response?.data?.error || err.response?.data?.message || err.message;
      toast({ title: "Error", description: apiErrorMessage || `Failed to ${provider?.id ? 'update' : 'add'} storage provider.`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const isEditMode = !!provider?.id;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add New'} Storage Provider</DialogTitle>
          <DialogDescription>
            Configure an S3 or Cloudflare R2 bucket for snapshot replication. Credentials are encrypted at rest.
            {isEditMode && " Leave key fields blank to keep existing credentials."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="type">Provider Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as StorageProviderType)} required disabled={isEditMode}>
              <SelectTrigger id="type"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="s3">AWS S3</SelectItem>
                <SelectItem value="r2">Cloudflare R2</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="bucket">Bucket Name</Label>
            <Input id="bucket" value={bucket} onChange={(e) => setBucket(e.target.value)} placeholder="your-s3-or-r2-bucket-name" required />
          </div>

          {type === 's3' && (
            <div className="space-y-1">
              <Label htmlFor="region">Region</Label>
              <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g., us-east-1" required={type === 's3'} />
            </div>
          )}

          {type === 'r2' && (
            <div className="space-y-1">
              <Label htmlFor="endpoint">Endpoint URL</Label>
              <Input id="endpoint" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="e.g., https://<ACCOUNT_ID>.r2.cloudflarestorage.com" required={type === 'r2'} />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="accessKeyId">Access Key ID {isEditMode && "(Optional)"}</Label>
            <Input id="accessKeyId" type="password" value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} placeholder={isEditMode ? 'Leave blank to keep existing' : 'Enter Access Key ID'} required={!isEditMode} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="secretAccessKey">Secret Access Key {isEditMode && "(Optional)"}</Label>
            <Input id="secretAccessKey" type="password" value={secretAccessKey} onChange={(e) => setSecretAccessKey(e.target.value)} placeholder={isEditMode ? 'Leave blank to keep existing' : 'Enter Secret Access Key'} required={!isEditMode} />
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="replicationMode">Replication Mode</Label>
            <Select value={replicationMode} onValueChange={(value) => setReplicationMode(value as 'mirror' | 'archive')} required>
              <SelectTrigger id="replicationMode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mirror">Mirror (real-time replication)</SelectItem>
                <SelectItem value="archive">Archive (for cold storage)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox id="forcePathStyle" checked={forcePathStyle} onCheckedChange={(checked) => setForcePathStyle(checked as boolean)} />
            <Label htmlFor="forcePathStyle" className="text-sm font-normal">
              Use Path Style Access (forcePathStyle)
              <p className="text-xs text-muted-foreground">Usually for S3-compatible services or non-virtual-hosted style.</p>
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="isEnabled" checked={isEnabled} onCheckedChange={(checked) => setIsEnabled(checked as boolean)} />
            <Label htmlFor="isEnabled" className="text-sm font-normal">Enable this provider for replication</Label>
          </div>

          <DialogFooter className="pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Add Provider')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default StorageProviderModal; 