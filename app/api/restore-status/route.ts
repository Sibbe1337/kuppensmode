import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import restoreEmitter from '@/lib/restore-emitter'; // Import the shared emitter

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
  // if (!restoreId.startsWith(`restore_${userId}_`)) { ... return 403 ... }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (eventName: string, data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          console.error("Error enqueuing SSE message:", e);
        }
      };

      // Listener for progress events
      const onProgress = (data: any) => {
        console.log(`[SSE ${restoreId}] Received progress:`, data);
        sendEvent('progress', data);
      };

      // Listener for completion events
      const onComplete = (data: any) => {
        console.log(`[SSE ${restoreId}] Received complete:`, data);
        sendEvent('complete', data);
        controller.close(); // Close the stream on completion
        cleanup(); // Unregister listeners
      };

      // Listener for error events
      const onError = (data: any) => {
        console.error(`[SSE ${restoreId}] Received error:`, data);
        sendEvent('error', data);
        controller.close(); // Close the stream on error
        cleanup(); // Unregister listeners
      };

      // --- Register listeners for this specific restoreId ---
      const progressEventName = `progress_${restoreId}`;
      const completeEventName = `complete_${restoreId}`;
      const errorEventName = `error_${restoreId}`;

      restoreEmitter.on(progressEventName, onProgress);
      restoreEmitter.on(completeEventName, onComplete);
      restoreEmitter.on(errorEventName, onError);

      console.log(`[SSE ${restoreId}] Listeners registered.`);
      
      // Send initial connection confirmation
      sendEvent('connected', { message: "SSE connection established for restore " + restoreId });

      // --- Cleanup function to unregister listeners ---
      const cleanup = () => {
        console.log(`[SSE ${restoreId}] Cleaning up listeners.`);
        restoreEmitter.off(progressEventName, onProgress);
        restoreEmitter.off(completeEventName, onComplete);
        restoreEmitter.off(errorEventName, onError);
      };

      // Cleanup when the client aborts the connection
      request.signal.addEventListener('abort', () => {
        console.log(`[SSE ${restoreId}] Client aborted connection.`);
        cleanup();
        // Controller might already be closed or errored, but attempt close just in case
        try { controller.close(); } catch (_) {}
      });
    },
    cancel(reason) {
      console.log(`[SSE ${restoreId}] Stream cancelled internally. Reason:`, reason);
      // Note: Cleanup should ideally happen via request.signal listener, 
      // but we call it here too as a fallback.
      // Find a way to call the cleanup function defined in start() if possible,
      // or duplicate the emitter.off() logic here.
      // This part is tricky as cleanup needs access to the specific listener functions.
      // For now, rely on the abort signal listener.
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