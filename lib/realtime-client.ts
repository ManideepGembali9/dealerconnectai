'use client';

import { useEffect, useRef } from 'react';
import type { RealtimeTopic } from './server-db';

export type ClientRealtimeEvent = {
  id: string;
  topic: RealtimeTopic;
  action: 'created' | 'updated' | 'deleted' | 'status_changed' | 'moderated' | 'replied' | 'reset';
  recordId?: string;
  dealerId?: string | null;
  productId?: string | null;
  customerId?: string | null;
  customerEmail?: string | null;
  recipientRole?: 'customer' | 'dealer' | 'admin' | 'all';
  timestamp: string;
};

type ListenerEntry = {
  topics: RealtimeTopic[] | 'all';
  onEvent: (evt?: ClientRealtimeEvent) => void;
  onReconnect?: () => void;
};

const listeners = new Map<number, ListenerEntry>();
let nextListenerId = 1;
let sharedEventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let hasEverDisconnected = false;
let windowHooksBound = false;

function dispatchToListeners(event: ClientRealtimeEvent) {
  listeners.forEach((entry) => {
    if (entry.topics === 'all' || entry.topics.includes(event.topic)) {
      try {
        entry.onEvent(event);
      } catch {
        // ignore listener failure
      }
    }
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dc-sync-event', { detail: event }));
  }
}

function dispatchReconnect() {
  listeners.forEach((entry) => {
    try {
      entry.onReconnect?.();
      if (!entry.onReconnect) entry.onEvent();
    } catch {
      // ignore listener failure
    }
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dc-sync-event', { detail: { topic: 'reconnect' } }));
  }
}

function cleanupConnection() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (sharedEventSource) {
    try {
      sharedEventSource.close();
    } catch {
      // ignore
    }
    sharedEventSource = null;
  }
}

function connectSharedStream() {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
  if (listeners.size === 0) return;
  if (sharedEventSource) return;

  try {
    const es = new EventSource('/api/realtime');
    sharedEventSource = es;

    es.addEventListener('connected', () => {
      const wasDisconnected = hasEverDisconnected;
      reconnectAttempt = 0;
      hasEverDisconnected = false;
      if (wasDisconnected) {
        dispatchReconnect();
      }
    });

    es.addEventListener('sync', (msg) => {
      try {
        const parsed = JSON.parse((msg as MessageEvent).data) as ClientRealtimeEvent;
        dispatchToListeners(parsed);
      } catch {
        // ignore malformed event
      }
    });

    es.onerror = () => {
      hasEverDisconnected = true;
      if (sharedEventSource) {
        try {
          sharedEventSource.close();
        } catch {
          // ignore
        }
        sharedEventSource = null;
      }
      if (listeners.size === 0 || reconnectTimer) return;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 10000);
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectSharedStream();
      }, delay);
    };
  } catch {
    // ignore EventSource init error
  }
}

function ensureWindowHooks() {
  if (typeof window === 'undefined' || windowHooksBound) return;
  windowHooksBound = true;

  window.addEventListener('online', () => {
    hasEverDisconnected = true;
    cleanupConnection();
    connectSharedStream();
    dispatchReconnect();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && listeners.size > 0) {
      if (!sharedEventSource || sharedEventSource.readyState === EventSource.CLOSED) {
        hasEverDisconnected = true;
        cleanupConnection();
        connectSharedStream();
      }
      dispatchReconnect();
    }
  });

  window.addEventListener('pagehide', () => {
    cleanupConnection();
  });

  window.addEventListener('beforeunload', () => {
    cleanupConnection();
  });

  window.addEventListener('pageshow', (evt) => {
    if (evt.persisted && listeners.size > 0) {
      cleanupConnection();
      connectSharedStream();
      dispatchReconnect();
    }
  });
}

export function forceRealtimeReconnect() {
  if (typeof window === 'undefined') return;
  hasEverDisconnected = true;
  cleanupConnection();
  connectSharedStream();
}

export function subscribeRealtime(entry: ListenerEntry): () => void {
  const id = nextListenerId++;
  listeners.set(id, entry);
  ensureWindowHooks();
  connectSharedStream();

  return () => {
    listeners.delete(id);
    if (listeners.size === 0) {
      cleanupConnection();
    }
  };
}

export function useRealtimeSync(
  topics: RealtimeTopic[] | 'all',
  onSync: (event?: ClientRealtimeEvent) => void,
  options?: {
    enabled?: boolean;
    debounceMs?: number;
    onReconnect?: () => void;
  }
) {
  const onSyncRef = useRef(onSync);
  const onReconnectRef = useRef(options?.onReconnect);
  onSyncRef.current = onSync;
  onReconnectRef.current = options?.onReconnect;

  const enabled = options?.enabled !== false;
  const debounceMs = options?.debounceMs ?? 80;
  const topicsKey = topics === 'all' ? 'all' : topics.join(',');

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const parsedTopics: RealtimeTopic[] | 'all' =
      topicsKey === 'all' ? 'all' : (topicsKey.split(',') as RealtimeTopic[]);

    const scheduleSync = (evt?: ClientRealtimeEvent) => {
      if (debounceMs <= 0) {
        onSyncRef.current(evt);
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        onSyncRef.current(evt);
      }, debounceMs);
    };

    const unsub = subscribeRealtime({
      topics: parsedTopics,
      onEvent: (evt) => scheduleSync(evt),
      onReconnect: () => {
        if (onReconnectRef.current) onReconnectRef.current();
        else scheduleSync();
      },
    });

    const handleLocalSync = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail || detail.topic === 'reconnect' || parsedTopics === 'all' || parsedTopics.includes(detail.topic)) {
        scheduleSync(detail?.topic ? (detail as ClientRealtimeEvent) : undefined);
      }
    };

    window.addEventListener('dc-sync-event', handleLocalSync);

    return () => {
      if (timer) clearTimeout(timer);
      unsub();
      window.removeEventListener('dc-sync-event', handleLocalSync);
    };
  }, [enabled, debounceMs, topicsKey]);
}
