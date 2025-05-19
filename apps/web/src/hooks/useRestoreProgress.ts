import { useState, useEffect } from 'react';

// Define the structure of the events from the SSE endpoint
export interface RestoreProgressEvent {
  type: 'progress';
  percent: number;
  message: string;
}

export interface RestoreCompleteEvent {
  type: 'complete';
  message?: string;
}

export interface RestoreErrorEvent {
  type: 'error';
  error: string;
  details?: any; // Optional additional error details
}

export interface ConnectedEvent {
  type: 'connected';
  message: string;
}

export type RestoreEvent = RestoreProgressEvent | RestoreCompleteEvent | RestoreErrorEvent | ConnectedEvent;

export const useRestoreProgress = (restoreId?: string) => {
  const [lastEvent, setLastEvent] = useState<RestoreEvent | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    if (!restoreId) {
      setLastEvent(null);
      setIsConnected(false);
      return;
    }

    console.log(`useRestoreProgress: Connecting to /api/restore-status?id=${restoreId}`);
    const eventSource = new EventSource(`/api/restore-status?id=${restoreId}`);

    const handleEvent = (type: string, data: any) => {
      setLastEvent({ type, ...data } as RestoreEvent);
      if (type === 'complete' || type === 'error') {
        console.log(`useRestoreProgress: Closing SSE connection after ${type} event.`);
        eventSource.close();
        setIsConnected(false);
      }
    };

    eventSource.onopen = () => {
      console.log(`useRestoreProgress: SSE connection opened for ${restoreId}`);
      setIsConnected(true);
      // No initial event set here, wait for 'connected' event from server
    };

    eventSource.addEventListener('connected', (event) => {
      try {
        console.log('useRestoreProgress: Event [connected] received', (event as MessageEvent).data);
        const parsedData = JSON.parse((event as MessageEvent).data);
        handleEvent('connected', parsedData);
      } catch (error) {
        console.error('useRestoreProgress: Error parsing [connected] event:', error, (event as MessageEvent).data);
        handleEvent('error', { error: 'Failed to parse connected event.', details: (event as MessageEvent).data });
      }
    });

    eventSource.addEventListener('progress', (event) => {
      try {
        console.log('useRestoreProgress: Event [progress] received', (event as MessageEvent).data);
        const parsedData = JSON.parse((event as MessageEvent).data);
        handleEvent('progress', parsedData);
      } catch (error) {
        console.error('useRestoreProgress: Error parsing [progress] event:', error, (event as MessageEvent).data);
        handleEvent('error', { error: 'Failed to parse progress event.', details: (event as MessageEvent).data });
      }
    });

    eventSource.addEventListener('complete', (event) => {
      try {
        console.log('useRestoreProgress: Event [complete] received', (event as MessageEvent).data);
        const parsedData = JSON.parse((event as MessageEvent).data);
        handleEvent('complete', parsedData);
      } catch (error) {
        console.error('useRestoreProgress: Error parsing [complete] event:', error, (event as MessageEvent).data);
        handleEvent('error', { error: 'Failed to parse complete event.', details: (event as MessageEvent).data });
      }
    });

    eventSource.addEventListener('error', (event) => { // Note: this is for named 'error' events from server
      try {
        console.log('useRestoreProgress: Event [error] received from server', (event as MessageEvent).data);
        const parsedData = JSON.parse((event as MessageEvent).data);
        handleEvent('error', parsedData);
      } catch (error) {
        console.error('useRestoreProgress: Error parsing [error] event from server:', error, (event as MessageEvent).data);
        handleEvent('error', { error: 'Failed to parse server error event.', details: (event as MessageEvent).data });
      }
    });

    eventSource.onerror = (errorEvent) => { // This is for EventSource connection errors
      console.error('useRestoreProgress: SSE_CONNECTION_ERROR:', errorEvent);
      // Avoid setting lastEvent if already processing a terminal event from server
      if (lastEvent?.type !== 'complete' && lastEvent?.type !== 'error') {
         setLastEvent({ type: 'error', error: 'Connection to progress stream failed or interrupted.' });
      }
      setIsConnected(false);
      eventSource.close();
    };

    return () => {
      console.log(`useRestoreProgress: Closing SSE connection for ${restoreId} (cleanup)`);
      eventSource.close();
      setIsConnected(false);
    };
  }, [restoreId]);

  return { lastEvent, isConnected };
}; 