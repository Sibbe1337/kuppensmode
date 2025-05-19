"use client";

import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import type { UserQuota } from '@/types'; // Import the shared UserQuota type

// Remove any local UserQuota interface definition if it exists here

export function useQuota() {
  // The API endpoint /api/user/quota should return data conforming to the UserQuota interface
  const { data, error, isLoading, mutate } = useSWR<UserQuota>('/api/user/quota', fetcher, {
    revalidateOnFocus: false, // Consider tuning SWR options as needed
  });

  return {
    quota: data, // This should now correctly be typed as UserQuota | undefined
    isLoading,
    isError: error,
    mutateQuota: mutate,
  };
} 