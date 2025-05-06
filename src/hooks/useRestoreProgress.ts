import { useState, useEffect } from 'react';

// Define the structure of the events from the SSE endpoint
export interface RestoreProgressEvent {
  type: 'progress';
  percent: number;
  message: string;
}

export interface RestoreCompleteEvent {
  type: 'complete';
}

export interface RestoreErrorEvent {
  type: 'error';
  error: string;
  details?: any; // Optional additional error details
}

export type RestoreEvent = RestoreProgressEvent | RestoreCompleteEvent | RestoreErrorEvent;

export const useRestoreProgress = (restoreId?: string) => {
  const [lastEvent, setLastEvent] = useState<RestoreEvent | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    if (!restoreId) {
      setLastEvent(null); // Clear event if restoreId is removed
      setIsConnected(false);
      return;
    }

    console.log(`useRestoreProgress: Connecting to /api/restore-status?id=${restoreId}`);
    const eventSource = new EventSource(`/api/restore-status?id=${restoreId}`);

    eventSource.onopen = () => {
      console.log(`useRestoreProgress: SSE connection opened for ${restoreId}`);
      setIsConnected(true);
      // Optionally set an initial event or clear previous one
      // setLastEvent({ type: 'progress', percent: 0, message: 'Connecting...' }); 
    };

    eventSource.onmessage = (event) => {
      try {
        console.log('useRestoreProgress: Message received', event.data);
        const parsedData = JSON.parse(event.data) as RestoreEvent;
        setLastEvent(parsedData);

        // If it's a completion or error event, we can close the connection from the client-side too
        // though the server should ideally close it after sending a final event.
        if (parsedData.type === 'complete' || parsedData.type === 'error') {
          console.log(`useRestoreProgress: Closing SSE connection after ${parsedData.type} event.`);
          eventSource.close();
          setIsConnected(false);
        }
      } catch (error) {
        console.error('useRestoreProgress: Error parsing SSE message data:', error, event.data);
        setLastEvent({ type: 'error', error: 'Failed to parse progress data.', details: event.data });
        eventSource.close(); // Close on parse error too
        setIsConnected(false);
      }
    };

    eventSource.onerror = (error) => {
      // This error event is for the EventSource object itself (e.g., connection failed)
      console.error('useRestoreProgress: SSE connection error:', error);
      setLastEvent({ type: 'error', error: 'Connection to progress stream failed.' });
      setIsConnected(false);
      eventSource.close(); // Important to close on error to prevent retries if not desired
    };

    // Cleanup function to close the connection when the component unmounts or restoreId changes
    return () => {
      console.log(`useRestoreProgress: Closing SSE connection for ${restoreId} (cleanup)`);
      eventSource.close();
      setIsConnected(false);
    };
  }, [restoreId]);

  return { lastEvent, isConnected };
}; 