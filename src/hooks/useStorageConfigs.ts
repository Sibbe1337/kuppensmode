import useSWR from 'swr';
import type { UserStorageProvider } from '../types/storageProvider';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    let errorInfo = {};
    try {
      errorInfo = await res.json();
    } catch (e) {
      // Ignore if response is not json
    }
    const error = new Error('An error occurred while fetching storage configurations.');
    // Attach more info to the error object if available
    (error as any).info = errorInfo;
    (error as any).status = res.status;
    throw error;
  }
  return res.json();
};

export function useStorageConfigs() {
  const { data, error, isLoading, mutate } = useSWR<Partial<UserStorageProvider>[]>('/api/user/storage-configs', fetcher, {
    // Optional: SWR configuration like revalidation options
    // revalidateOnFocus: false,
  });

  return {
    configs: data,
    isLoading,
    isError: !!error, // Convert error object to boolean for easier checking
    errorDetails: error, // Provide the full error object for more details if needed
    mutateConfigs: mutate,
  };
} 