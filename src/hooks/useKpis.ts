import useSWR from 'swr';
import apiClient from '@/lib/apiClient';

export interface KpisResponse {
  snapshotsTotal   : number;
  latestSnapshotAt : number | null;
}

export const useKpis = () =>
  useSWR<KpisResponse>('/api/analytics/kpis', apiClient, {
    errorRetryCount: 2,          // Bail early
    errorRetryInterval: 10000,  // 10s back-off
  }); 