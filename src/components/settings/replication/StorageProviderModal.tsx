'use client';

import React, { useState, useEffect } from 'react';
import type { UserStorageProvider, StorageProviderType } from '@/types/storageProvider'; // Assuming path alias resolves
import { Button } from '@/components/ui/button'; // Assuming path alias resolves
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Switch } from "@/components/ui/switch";
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
            <LabelMock htmlFor="type">Provider Type</LabelMock>
            <SelectMock id="type" value={type} onChange={(e) => setType(e.target.value as StorageProviderType)} required>
              <option value="s3">AWS S3</option>
              <option value="r2">Cloudflare R2</option>
            </SelectMock>
          </div>

          <div>
            <LabelMock htmlFor="bucket">Bucket Name</LabelMock>
            <InputMock id="bucket" type="text" value={bucket} onChange={(e) => setBucket(e.target.value)} placeholder="your-bucket-name" required />
          </div>

          {type === 's3' && (
            <div>
              <LabelMock htmlFor="region">AWS Region</LabelMock>
              <InputMock id="region" type="text" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g., us-east-1" required={type === 's3'} />
            </div>
          )}

          {type === 'r2' && (
            <div>
              <LabelMock htmlFor="endpoint">R2 Endpoint URL</LabelMock>
              <InputMock id="endpoint" type="url" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://<ACCOUNT_ID>.r2.cloudflarestorage.com" required={type === 'r2'} />
            </div>
          )}
          
          {!isEditMode && (
            <>
              <div>
                <LabelMock htmlFor="accessKeyId">Access Key ID</LabelMock>
                <InputMock id="accessKeyId" type="password" value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} placeholder="Provider Access Key ID" required={!isEditMode} />
              </div>
              <div>
                <LabelMock htmlFor="secretAccessKey">Secret Access Key</LabelMock>
                <InputMock id="secretAccessKey" type="password" value={secretAccessKey} onChange={(e) => setSecretAccessKey(e.target.value)} placeholder="Provider Secret Access Key" required={!isEditMode} />
              </div>
            </>
          )}
          {isEditMode && <p className="text-xs text-gray-500 dark:text-gray-400">To change access keys, please delete and re-add the provider configuration.</p>}

          {type === 'r2' && (
             <div className="flex items-center space-x-2">
                <SwitchMock id="forcePathStyle" checked={forcePathStyle} onCheckedChange={setForcePathStyle} />
                <LabelMock htmlFor="forcePathStyle">Force Path Style (usually needed for R2)</LabelMock>
            </div>
          )}

          <div>
            <LabelMock htmlFor="replicationMode">Replication Mode</LabelMock>
            <SelectMock id="replicationMode" value={replicationMode} onChange={(e) => setReplicationMode(e.target.value as 'mirror' | 'archive')}>
              <option value="mirror">Mirror (Standard)</option>
              <option value="archive">Archive (Cold Storage - future)</option>
            </SelectMock>
          </div>

          <div className="flex items-center space-x-2">
            <SwitchMock id="isEnabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
            <LabelMock htmlFor="isEnabled">Enable this provider</LabelMock>
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