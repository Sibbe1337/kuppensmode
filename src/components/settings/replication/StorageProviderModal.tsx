'use client';

import React, { useState, useEffect } from 'react';
import type { UserStorageProvider, StorageProviderType } from '../../../../packages/storage-adapters/src/storageProvider';
import { Button } from '../../ui/button';
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Switch } from "../../ui/switch";
// import { Textarea } from "@/components/ui/textarea"; // For access keys if shown, though usually password fields

interface StorageProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: Partial<Omit<UserStorageProvider, 'id' | 'createdAt' | 'lastValidatedAt' | 'validationStatus' | 'validationError' | 'adapterVersion'> & { accessKeyId?: string; secretAccessKey?: string; }>) => void;
  initialData?: Partial<UserStorageProvider> | null;
}

// Mock Input, Label, Select, Switch components if not using Shadcn/ui or similar
const LabelMock = ({ children, htmlFor }: {children: React.ReactNode, htmlFor?: string}) => <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{children}</label>;
const InputMock = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />;
const SelectMock = ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & {children: React.ReactNode}) => <select {...props} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">{children}</select>;
const SwitchMock = ({ checked, onCheckedChange, id }: { checked: boolean, onCheckedChange: (checked: boolean) => void, id?: string }) => (
  <button type="button" id={id} onClick={() => onCheckedChange(!checked)} className={`${checked ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'} relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}>
    <span className={`${checked ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform`} />
  </button>
);

export default function StorageProviderModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}: StorageProviderModalProps) {
  const [type, setType] = useState<StorageProviderType>(initialData?.type || 's3');
  const [bucket, setBucket] = useState(initialData?.bucket || '');
  const [region, setRegion] = useState(initialData?.region || ''); // S3 specific
  const [endpoint, setEndpoint] = useState(initialData?.endpoint || ''); // R2 specific
  const [accessKeyId, setAccessKeyId] = useState(''); // Always new entry for security
  const [secretAccessKey, setSecretAccessKey] = useState(''); // Always new entry
  const [forcePathStyle, setForcePathStyle] = useState<boolean>(initialData?.forcePathStyle === undefined ? (type === 'r2') : initialData.forcePathStyle);
  const [isEnabled, setIsEnabled] = useState<boolean>(initialData?.isEnabled === undefined ? true : initialData.isEnabled);
  const [replicationMode, setReplicationMode] = useState<'mirror' | 'archive'>(initialData?.replicationMode || 'mirror');
  
  const isEditMode = !!initialData?.id;

  useEffect(() => {
    if (initialData) {
      setType(initialData.type || 's3');
      setBucket(initialData.bucket || '');
      setRegion(initialData.region || '');
      setEndpoint(initialData.endpoint || '');
      setForcePathStyle(initialData.forcePathStyle === undefined ? (initialData.type === 'r2') : initialData.forcePathStyle);
      setIsEnabled(initialData.isEnabled === undefined ? true : initialData.isEnabled);
      setReplicationMode(initialData.replicationMode || 'mirror');
      // Keys are not pre-filled for edit for security, user must re-enter if they intend to change (though API doesn't support key update)
      setAccessKeyId(''); 
      setSecretAccessKey('');
    } else {
      // Defaults for new provider
      setType('s3');
      setBucket('');
      setRegion('');
      setEndpoint('');
      setForcePathStyle(false);
      setIsEnabled(true);
      setReplicationMode('mirror');
      setAccessKeyId('');
      setSecretAccessKey('');
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData: Partial<Omit<UserStorageProvider, 'id' | 'createdAt' | 'lastValidatedAt' | 'validationStatus' | 'validationError' | 'adapterVersion'> & { accessKeyId?: string; secretAccessKey?: string; }> = {
      type,
      bucket,
      isEnabled,
      replicationMode,
      forcePathStyle: type === 'r2' ? forcePathStyle : undefined, // Only relevant for R2 or custom S3 with path style
    };
    if (type === 's3') {
      formData.region = region;
    }
    if (type === 'r2') {
      formData.endpoint = endpoint;
    }
    // Only include keys if they are being set (i.e., for a new provider)
    // For edit, API doesn't update keys, so we don't send them.
    if (!isEditMode) {
        if (!accessKeyId || !secretAccessKey) {
            alert("Access Key ID and Secret Access Key are required for new providers.");
            return;
        }
        formData.accessKeyId = accessKeyId;
        formData.secretAccessKey = secretAccessKey;
    }

    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 transition-opacity duration-300 ease-in-out" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg transform transition-all duration-300 ease-in-out scale-100" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">{isEditMode ? 'Edit' : 'Add New'} Storage Provider</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="type">Provider Type</Label>
            <Select value={type} onValueChange={(value: string) => setType(value as StorageProviderType)} required>
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
            <Input id="bucket" type="text" value={bucket} onChange={(e) => setBucket(e.target.value)} placeholder="your-bucket-name" required />
          </div>

          {type === 's3' && (
            <div>
              <Label htmlFor="region">AWS Region</Label>
              <Input id="region" type="text" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g., us-east-1" required={type === 's3'} />
            </div>
          )}

          {type === 'r2' && (
            <div>
              <Label htmlFor="endpoint">R2 Endpoint URL</Label>
              <Input id="endpoint" type="url" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://<ACCOUNT_ID>.r2.cloudflarestorage.com" required={type === 'r2'} />
            </div>
          )}
          
          {!isEditMode && (
            <>
              <div>
                <Label htmlFor="accessKeyId">Access Key ID</Label>
                <Input id="accessKeyId" type="password" value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} placeholder="Provider Access Key ID" required={!isEditMode} />
              </div>
              <div>
                <Label htmlFor="secretAccessKey">Secret Access Key</Label>
                <Input id="secretAccessKey" type="password" value={secretAccessKey} onChange={(e) => setSecretAccessKey(e.target.value)} placeholder="Provider Secret Access Key" required={!isEditMode} />
              </div>
            </>
          )}
          {isEditMode && <p className="text-xs text-gray-500 dark:text-gray-400">To change access keys, please delete and re-add the provider configuration.</p>}

          {type === 'r2' && (
             <div className="flex items-center space-x-2">
                <Switch id="forcePathStyle" checked={forcePathStyle} onCheckedChange={setForcePathStyle} />
                <Label htmlFor="forcePathStyle">Force Path Style (usually needed for R2)</Label>
            </div>
          )}

          <div>
            <Label htmlFor="replicationMode">Replication Mode</Label>
            <Select value={replicationMode} onValueChange={(value: string) => setReplicationMode(value as 'mirror' | 'archive')}>
              <SelectTrigger id="replicationMode">
                <SelectValue placeholder="Select replication mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mirror">Mirror (Standard)</SelectItem>
                <SelectItem value="archive">Archive (Cold Storage - future)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="isEnabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
            <Label htmlFor="isEnabled">Enable this provider</Label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">{isEditMode ? 'Save Changes' : 'Add Provider'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
} 