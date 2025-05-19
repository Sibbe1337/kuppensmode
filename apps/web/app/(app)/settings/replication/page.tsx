'use client';

import React, { useState } from 'react';
import { useStorageConfigs } from '../../../../src/hooks/useStorageConfigs';
import StorageProviderList from '../../../../src/components/settings/replication/StorageProviderList';
import StorageProviderModal from '../../../../src/components/settings/replication/StorageProviderModal';
import { Button } from '../../../../src/components/ui/button';
import type { UserStorageProvider } from '@notion-lifeline/storage-adapters'; // Changed from relative path

export default function ReplicationSettingsPage() {
  const { configs, isLoading, isError, errorDetails, mutateConfigs } = useStorageConfigs();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Partial<UserStorageProvider> | null>(null);

  const handleAddProvider = () => {
    setEditingConfig(null); // Clear any previous editing data
    setIsModalOpen(true);
  };

  const handleEditProvider = (config: Partial<UserStorageProvider>) => {
    setEditingConfig(config);
    setIsModalOpen(true);
  };

  const handleDeleteProvider = async (providerId: string) => {
    if (!confirm('Are you sure you want to delete this storage provider configuration?')) return;
    try {
      const res = await fetch(`/api/user/storage-configs/${providerId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to delete' })); // Provide default
        throw new Error(errorData.message || `Failed to delete configuration (status ${res.status})`);
      }
      mutateConfigs(); // Re-fetch the list
      // Consider using a toast notification system instead of alert
      alert('Configuration deleted successfully.');
    } catch (error: any) {
      console.error("Error deleting provider:", error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleValidateProvider = async (providerId: string) => {
    // Optionally, set a specific loading state for the item being validated
    // e.g., by adding a `validatingId` to component state or updating the item in `configs` locally.
    try {
      const res = await fetch(`/api/user/storage-configs/${providerId}/validate`, {
        method: 'POST',
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.details || result.message || 'Validation request failed');
      }
      mutateConfigs(); // Re-fetch to get updated validation status
      alert(result.message || 'Validation completed.'); // More generic message
    } catch (error: any) {
      console.error("Error validating provider:", error);
      alert(`Error: ${error.message}`);
      mutateConfigs(); // Re-fetch even on error to get any status update from backend
    }
  };

  const handleModalSubmit = async (formData: any) => {
    const isEditMode = !!editingConfig?.id;
    const url = isEditMode ? `/api/user/storage-configs/${editingConfig.id}` : '/api/user/storage-configs';
    const method = isEditMode ? 'PUT' : 'POST';

    // For PUT (edit), ensure accessKeyId and secretAccessKey are not sent if they are empty
    // The API PUT handler already ignores them, but good practice not to send empty strings if they mean "no change"
    let payload = { ...formData };
    if (isEditMode) {
      delete payload.accessKeyId; // API does not update keys on PUT
      delete payload.secretAccessKey;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to save' }));
        throw new Error(errorData.message || `Failed to save configuration (status ${res.status})`);
      }
      mutateConfigs();
      setIsModalOpen(false);
      setEditingConfig(null);
      alert('Configuration saved successfully.');
    } catch (error: any) {
      console.error("Error saving provider config:", error);
      // Potentially show error in a more user-friendly way than alert
      alert(`Error: ${error.message}`);
    }
  };

  if (isError) {
    return (
      <div className="p-4 md:p-6">
        <h1 className="text-2xl font-semibold mb-4">Storage Replication</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error! </strong>
          <span className="block sm:inline">{errorDetails?.message || 'Could not load configurations.'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">Storage Replication</h1>
        <Button onClick={handleAddProvider}>Add Provider</Button>
      </div>

      <StorageProviderList 
        configs={configs}
        isLoading={isLoading}
        onValidate={handleValidateProvider}
        onDelete={handleDeleteProvider}
        onEdit={handleEditProvider}
      />

      <StorageProviderModal 
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingConfig(null);
        }}
        onSubmit={handleModalSubmit}
        initialData={editingConfig}
      />
    </div>
  );
} 