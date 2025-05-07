import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/firestore'; // Added Firestore db import
import type { DocumentData } from '@google-cloud/firestore';

// This forces the route to be dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const restoreId = searchParams.get('id');

  if (!restoreId) {
    return new NextResponse("Missing restore ID", { status: 400 });
  }

  console.log(`SSE connection requested for restoreId: ${restoreId}, User: ${userId}`);

  // TODO: Add validation to ensure the requesting userId matches the userId in restoreId
  // This is now more critical as we are directly accessing Firestore based on these IDs.
  // Example: A simple check if restoreId was prefixed by worker with userId might not be enough.
  // Consider if the restore document itself should also store the userId for verification.
  // For now, proceeding with the assumption that restoreId is unique and implies user ownership via other means.

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let unsubscribe: (() => void) | null = null;

      const sendEvent = (eventName: string, data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          console.error(`[SSE ${restoreId}] Error enqueuing SSE message:`, e);
          // If controller is already closed, this might error.
        }
      };

      const docPath = `restores/${userId}/items/${restoreId}`;
      const restoreDocRef = db.doc(docPath);

      console.log(`[SSE ${restoreId}] Setting up Firestore listener for ${docPath}`);

      unsubscribe = restoreDocRef.onSnapshot(
        (docSnapshot: DocumentData) => {
          if (!docSnapshot.exists) {
            console.log(`[SSE ${restoreId}] Document ${docPath} does not exist yet or was deleted.`);
            // Optionally send an event or wait. For now, just logging.
            // If it's an initial connection and doc doesn't exist, it might be created soon.
            // If it's deleted mid-stream, it could be an error or unexpected completion.
            return;
          }

          const data = docSnapshot.data();
          console.log(`[SSE ${restoreId}] Received Firestore update:`, data);

          // Assuming data matches the RestoreProgress structure from the worker:
          // { status: 'pending' | 'downloading' | ..., message: string, percentage: number, updatedAt: number }
          if (!data || !data.status) {
            console.warn(`[SSE ${restoreId}] Firestore data missing 'status' field.`);
            return;
          }
          
          // Adapt worker's progress structure to client's expected event structure if needed.
          // For now, assuming direct mapping for 'progress', 'complete', 'error'.
          // The hook useRestoreProgress expects:
          // RestoreProgressEvent: { type: 'progress', percent: number, message: string }
          // RestoreCompleteEvent: { type: 'complete', message?: string }
          // RestoreErrorEvent: { type: 'error', error: string, details?: any }

          if (data.status === 'completed') {
            sendEvent('complete', { message: data.message || 'Restore completed successfully!' });
            if (unsubscribe) unsubscribe();
            controller.close();
          } else if (data.status === 'error') {
            sendEvent('error', { error: data.message || 'An error occurred during restore.', details: data });
            if (unsubscribe) unsubscribe();
            controller.close();
          } else { // Any other status is treated as progress
            sendEvent('progress', { percent: data.percentage, message: data.message });
          }
        },
        (error) => {
          console.error(`[SSE ${restoreId}] Firestore listener error:`, error);
          sendEvent('error', { error: 'Failed to listen for restore progress.' });
          if (unsubscribe) unsubscribe();
          controller.close();
        }
      );
      
      // Send initial connection confirmation
      sendEvent('connected', { message: "SSE connection established, waiting for restore updates for " + restoreId });
      
      // Cleanup when the client aborts the connection
      request.signal.addEventListener('abort', () => {
        console.log(`[SSE ${restoreId}] Client aborted connection.`);
        if (unsubscribe) {
          unsubscribe();
          console.log(`[SSE ${restoreId}] Firestore listener detached.`);
        }
        try { controller.close(); } catch (_) {}
      });
    },
    cancel(reason) {
      console.log(`[SSE ${restoreId}] Stream cancelled internally. Reason:`, reason);
      // Unsubscribe is handled by the 'abort' event on request.signal for client-side cancellations.
      // If cancellation happens for other reasons, unsubscribe might need to be called here,
      // but the reference to 'unsubscribe' from the start() scope is tricky.
      // The abort listener is generally more reliable for cleanup.
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
} 