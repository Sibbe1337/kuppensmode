import useSWR from 'swr';
import apiClient from '@/lib/apiClient';

export interface KpisResponse {
  snapshotsTotal   : number;
  latestSnapshotAt : number | null;
}

export const useKpis = () =>
  useSWR<KpisResponse>('/api/analytics/kpis', apiClient); 