import useSWR from 'swr';
import type { UserSettings } from '@/types/user';

// Define a fetcher function for SWR
const fetcher = async (url: string) => {
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
  const { data, error, isLoading, mutate } = useSWR<UserSettings>('/api/user/settings', fetcher);

  return {
    settings: data,
    isLoading,
    isError: error,
    mutateSettings: mutate,
  };
} 