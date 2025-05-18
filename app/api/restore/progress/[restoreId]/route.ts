import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/firestore';
import { DocumentData } from '@shared/firestore';

// Define the structure for progress updates read from Firestore
interface RestoreProgress {
  status: 'pending' | 'downloading' | 'restoring' | 'error' | 'completed';
  message: string;
  percentage: number; // 0-100, -1 for error
  updatedAt: number;
}

// Force the route handler to be dynamic
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { restoreId: string } }
) {
  const db = getDb();
  const { userId } = await auth();
  if (!userId) {
    // Although Clerk typically protects API routes, double-check
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const restoreId = params.restoreId;
  if (!restoreId) {
    return new NextResponse("Missing restoreId", { status: 400 });
  }

  console.log(`SSE connection opened for user: ${userId}, restoreId: ${restoreId}`);

  // Create the SSE stream
  const stream = new ReadableStream({
    start(controller) {
      const progressRef = db.collection('restores').doc(restoreId);
      
      // TODO: Add security rule in Firestore to ensure only the correct user can read this doc!
      // Example rule for `restores/{restoreDocId}`:
      // allow read: if request.auth != null && request.auth.uid == resource.data.userId; 
      // (This assumes you store `userId` on the restore document itself when creating it, which is recommended)

      const unsubscribe = progressRef.onSnapshot(
        (docSnapshot) => {
          if (!docSnapshot.exists) {
            console.log(`[SSE ${restoreId}] Document does not exist yet.`);
            // Optionally send a pending event or just wait
            const pendingEvent = `event: pending\ndata: ${JSON.stringify({ status: 'pending', message: 'Waiting for process to start...', percentage: 0, updatedAt: Date.now() })}\n\n`;
            controller.enqueue(new TextEncoder().encode(pendingEvent));
            return;
          }

          const data = docSnapshot.data() as RestoreProgress;
          console.log(`[SSE ${restoreId}] Sending update:`, data);

          // Format data for SSE
          const sseEvent = `event: progress\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(new TextEncoder().encode(sseEvent));

          // If completed or error, close the connection from the server side
          if (data.status === 'completed' || data.status === 'error') {
            console.log(`[SSE ${restoreId}] Status is ${data.status}, closing stream.`);
            unsubscribe(); // Stop listening to Firestore
            controller.close();
          }
        },
        (error) => {
          console.error(`[SSE ${restoreId}] Firestore listener error:`, error);
          let errorMessage = 'Error listening for updates.';
          let status : RestoreProgress['status'] = 'error';
          // Check for Firestore permission error code (gRPC status code 7)
          // or the string code 'permission-denied' if using a different client version or context
          if (error && typeof error === 'object' && 'code' in error && (error.code === 7 || error.code === 'permission-denied')) {
             errorMessage = 'Permission denied reading restore progress.';
          } else {
             // Keep generic error message for other types of errors
          }
          // Send an error event to the client
          const errorEvent = `event: error\ndata: ${JSON.stringify({ status: status, message: errorMessage, percentage: -1, updatedAt: Date.now() })}\n\n`;
          controller.enqueue(new TextEncoder().encode(errorEvent));
          unsubscribe();
          controller.close();
        }
      );

      // Handle client disconnect (though browser closing often handles this)
      // `request.signal` can sometimes be used but reliability varies.
      // A simple timeout might be added here if needed, or rely on the completion/error closing.
    },
    cancel() {
      // This is called if the stream consumer cancels (e.g., client disconnects)
      // Although the `unsubscribe()` in start() handles completion/error, 
      // we might not have the unsubscribe variable here reliably.
      // Firestore listeners might clean up automatically after some time.
      console.log(`[SSE ${restoreId}] Stream cancelled by client.`);
      // If you have the `unsubscribe` function accessible here, call it.
    },
  });

  // Return the stream response with appropriate headers
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      // Add CORS headers if your frontend is on a different domain
      // 'Access-Control-Allow-Origin': '*',
    },
  });
} 