'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { UserStorageProvider, StorageProviderType } from '@notion-lifeline/storage-adapters';
import { Button } from '../../ui/button.js';
import { Input } from "../../ui/input.js";
import { Label } from "../../ui/label.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select.js";
import { Switch } from "../../ui/switch.js";

interface StorageProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    formData: Partial<
      Omit<
        UserStorageProvider,
        'id' | 'createdAt' | 'lastValidatedAt' | 'validationStatus' | 'validationError' | 'adapterVersion'
      > & { accessKeyId?: string; secretAccessKey?: string }
    >
  ) => void;
  initialData?: Partial<UserStorageProvider> | null;
}

const DEFAULTS = {
  type: 's3' as StorageProviderType,
  bucket: '',
  region: '',
  endpoint: '',
  forcePathStyle: false,
  isEnabled: true,
  replicationMode: 'mirror' as 'mirror' | 'archive',
  accessKeyId: '',
  secretAccessKey: '',
};

export default function StorageProviderModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}: StorageProviderModalProps) {
  // State initialization
  const [type, setType] = useState<StorageProviderType>(initialData?.type || DEFAULTS.type);
  const [bucket, setBucket] = useState(initialData?.bucket || DEFAULTS.bucket);
  const [region, setRegion] = useState(initialData?.region || DEFAULTS.region);
  const [endpoint, setEndpoint] = useState(initialData?.endpoint || DEFAULTS.endpoint);
  const [accessKeyId, setAccessKeyId] = useState(DEFAULTS.accessKeyId);
  const [secretAccessKey, setSecretAccessKey] = useState(DEFAULTS.secretAccessKey);
  const [forcePathStyle, setForcePathStyle] = useState<boolean>(
    initialData?.forcePathStyle === undefined
      ? (initialData?.type === 'r2') // Default to true for R2 if not specified
      : initialData.forcePathStyle
  );
  const [isEnabled, setIsEnabled] = useState<boolean>(
    initialData?.isEnabled === undefined ? DEFAULTS.isEnabled : initialData.isEnabled
  );
  const [replicationMode, setReplicationMode] = useState<'mirror' | 'archive'>(
    initialData?.replicationMode || DEFAULTS.replicationMode
  );

  const isEditMode = !!initialData?.id;

  // Reset state on initialData change or when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setType(initialData.type || DEFAULTS.type);
        setBucket(initialData.bucket || DEFAULTS.bucket);
        setRegion(initialData.region || DEFAULTS.region);
        setEndpoint(initialData.endpoint || DEFAULTS.endpoint);
        setForcePathStyle(
          initialData.forcePathStyle === undefined
            ? (initialData.type === 'r2')
            : initialData.forcePathStyle
        );
        setIsEnabled(initialData.isEnabled === undefined ? DEFAULTS.isEnabled : initialData.isEnabled);
        setReplicationMode(initialData.replicationMode || DEFAULTS.replicationMode);
        // Access keys are not pre-filled in edit mode for security/simplicity
        setAccessKeyId(DEFAULTS.accessKeyId);
        setSecretAccessKey(DEFAULTS.secretAccessKey);
      } else {
        // Reset to defaults for "Add New" mode
        setType(DEFAULTS.type);
        setBucket(DEFAULTS.bucket);
        setRegion(DEFAULTS.region);
        setEndpoint(DEFAULTS.endpoint);
        setForcePathStyle(DEFAULTS.type === 'r2'); // Default forcePathStyle based on default type
        setIsEnabled(DEFAULTS.isEnabled);
        setReplicationMode(DEFAULTS.replicationMode);
        setAccessKeyId(DEFAULTS.accessKeyId);
        setSecretAccessKey(DEFAULTS.secretAccessKey);
      }
    }
  }, [initialData, isOpen]);

  // Form validation
  const validateForm = useCallback((): string | null => {
    if (!bucket.trim()) return "Bucket name is required.";
    if (type === 's3' && !region.trim()) return "AWS Region is required for S3.";
    if (type === 'r2' && !endpoint.trim()) return "R2 Endpoint URL is required.";
    if (!isEditMode && (!accessKeyId.trim() || !secretAccessKey.trim())) {
      return "Access Key ID and Secret Access Key are required for new providers.";
    }
    // Validate R2 endpoint format
    if (type === 'r2' && endpoint.trim()) {
      try {
        const url = new URL(endpoint);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return "R2 Endpoint URL must start with http:// or https://.";
        }
      } catch (e) {
        return "Invalid R2 Endpoint URL format.";
      }
    }
    return null;
  }, [type, bucket, region, endpoint, accessKeyId, secretAccessKey, isEditMode]);

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateForm();
    if (error) {
      // Consider using a more user-friendly notification system instead of alert
      alert(error);
      return;
    }
    const formData: Partial<
      Omit<
        UserStorageProvider,
        'id' | 'createdAt' | 'lastValidatedAt' | 'validationStatus' | 'validationError' | 'adapterVersion'
      > & { accessKeyId?: string; secretAccessKey?: string }
    > = {
      type,
      bucket: bucket.trim(),
      isEnabled,
      replicationMode,
      // Only include forcePathStyle if type is R2, otherwise it's undefined
      forcePathStyle: type === 'r2' ? forcePathStyle : undefined, 
    };

    if (type === 's3') {
      formData.region = region.trim();
    }
    if (type === 'r2') {
      formData.endpoint = endpoint.trim();
    }

    if (!isEditMode) {
      formData.accessKeyId = accessKeyId; // Already trimmed by validation check or not required
      formData.secretAccessKey = secretAccessKey;
    }
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 transition-opacity duration-300 ease-in-out"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg transform transition-all duration-300 ease-in-out scale-100"
        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          {isEditMode ? 'Edit' : 'Add New'} Storage Provider
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div>
            <Label htmlFor="type">Provider Type</Label>
            <Select 
              value={type} 
              onValueChange={(value: string) => {
                const newType = value as StorageProviderType;
                setType(newType);
                // Automatically set forcePathStyle to true when switching to R2,
                // and false if switching from R2 to S3 (or other types if added later)
                if (newType === 'r2') {
                  setForcePathStyle(true);
                } else if (type === 'r2' && newType === 's3') {
                   setForcePathStyle(false);
                }
              }} 
              required
            >
              <SelectTrigger id="type">
                <SelectValue placeholder="Select provider type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="s3">AWS S3</SelectItem>
                <SelectItem value="r2">Cloudflare R2</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="bucket">Bucket Name</Label>
            <Input
              id="bucket"
              type="text"
              value={bucket}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBucket(e.target.value)}
              placeholder="your-bucket-name"
              required
              autoFocus={!isEditMode} // Autofocus only when adding new
            />
          </div>

          {type === 's3' && (
            <div>
              <Label htmlFor="region">AWS Region</Label>
              <Input
                id="region"
                type="text"
                value={region}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegion(e.target.value)}
                placeholder="e.g., us-east-1"
                required={type === 's3'}
              />
            </div>
          )}

          {type === 'r2' && (
            <div>
              <Label htmlFor="endpoint">R2 Endpoint URL</Label>
              <Input
                id="endpoint"
                type="url"
                value={endpoint}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndpoint(e.target.value)}
                placeholder="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
                required={type === 'r2'}
              />
            </div>
          )}

          {!isEditMode && (
            <>
              <div>
                <Label htmlFor="accessKeyId">Access Key ID</Label>
                <Input
                  id="accessKeyId"
                  type="password"
                  value={accessKeyId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAccessKeyId(e.target.value)}
                  placeholder="Provider Access Key ID"
                  required={!isEditMode}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Label htmlFor="secretAccessKey">Secret Access Key</Label>
                <Input
                  id="secretAccessKey"
                  type="password"
                  value={secretAccessKey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSecretAccessKey(e.target.value)}
                  placeholder="Provider Secret Access Key"
                  required={!isEditMode}
                  autoComplete="new-password"
                />
              </div>
            </>
          )}
          {isEditMode && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              To change access keys, please delete and re-add the provider configuration.
            </p>
          )}

          {type === 'r2' && (
            <div className="flex items-center space-x-2">
              <Switch
                id="forcePathStyle"
                checked={forcePathStyle}
                onCheckedChange={setForcePathStyle}
              />
              <Label htmlFor="forcePathStyle">Force Path Style (recommended for R2)</Label>
            </div>
          )}

          <div>
            <Label htmlFor="replicationMode">Replication Mode</Label>
            <Select
              value={replicationMode}
              onValueChange={(value: string) => setReplicationMode(value as 'mirror' | 'archive')}
            >
              <SelectTrigger id="replicationMode">
                <SelectValue placeholder="Select replication mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mirror">Mirror (Standard)</SelectItem>
                <SelectItem value="archive" disabled>Archive (Cold Storage - future)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="isEnabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
            <Label htmlFor="isEnabled">Enable this provider</Label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{isEditMode ? 'Save Changes' : 'Add Provider'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}