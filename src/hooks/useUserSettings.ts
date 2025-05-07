// src/hooks/useUserSettings.ts
import useSWR from 'swr';
import type { UserSettings } from '@/types/user';

// Define a fetcher function for SWR with an explicit return type
const fetcher = async (url: string): Promise<UserSettings> => {
  const response = await fetch(url);
  if (!response.ok) {
    const errorInfo = await response.json().catch(() => ({ message: response.statusText }));
    const error = new Error('An error occurred while fetching the data.') as any;
    error.info = errorInfo;
    error.status = response.status;
    throw error; 
  }
  return response.json(); 
};

export function useUserSettings() {
  const { data, error, isLoading, mutate } = useSWR<UserSettings>(
    '/api/user/settings', 
    fetcher,
    {
      onSuccess: (data, key, config) => {
        console.log("useUserSettings (SWR onSuccess): Data fetched for key:", key, data);
      },
      onError: (err, key, config) => {
        console.error("useUserSettings (SWR onError): Error fetching data for key:", key, err);
      }
      // You can also add other SWR options here if needed, e.g., revalidation intervals
    }
  );

  return {
    settings: data,
    isLoading,
    isError: error,
    mutateSettings: mutate,
  };
}