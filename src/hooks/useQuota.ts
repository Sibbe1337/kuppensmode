import useSWR from 'swr';

export interface UserQuota {
  used: number;
  limit: number;
  planName: string;
  // Potentially add more fields here later, e.g., percentageUsed
}

// Define a fetcher function for SWR (can be the same as in useUserSettings or a shared one)
const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    const errorInfo = await response.json().catch(() => ({ message: response.statusText }));
    const error = new Error('An error occurred while fetching the quota data.') as any;
    error.info = errorInfo;
    error.status = response.status;
    throw error;
  }
  return response.json();
};

export function useQuota() {
  const { data, error, isLoading, mutate } = useSWR<UserQuota>('/api/user/quota', fetcher);

  // Optionally, derive more data here, e.g., percentage
  // const percentageUsed = data && data.limit > 0 ? (data.used / data.limit) * 100 : 0;

  return {
    quota: data,
    // percentageUsed,
    isLoading,
    isError: error,
    mutateQuota: mutate,
  };
} 