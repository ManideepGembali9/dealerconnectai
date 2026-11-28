import {
  getPortalAuthContext,
  canClientReceiveRealtimeEvent,
} from '@/lib/server-auth';
import { subscribeRealtimeEvents, type RealtimeEvent } from '@/lib/server-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = getPortalAuthContext(request);
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
          cleanup?.();
        }
      };

      // Initial handshake event
      send(
        `event: connected\ndata: ${JSON.stringify({
          connected: true,
          timestamp: new Date().toISOString(),
          portals: {
            customer: Boolean(auth.customer),
            dealer: Boolean(auth.dealer),
            admin: Boolean(auth.admin),
          },
        })}\n\n`
      );

      const unsubscribe = subscribeRealtimeEvents((event: RealtimeEvent) => {
        if (!canClientReceiveRealtimeEvent(event, auth)) return;
        send(`event: sync\ndata: ${JSON.stringify(event)}\n\n`);
      });

      const heartbeat = setInterval(() => {
        send(`: ping ${Date.now()}\n\n`);
      }, 15000);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener('abort', () => {
        cleanup?.();
      });
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
