/**
 * Offline-first sync queue.
 *
 * Every change a department saves is written to this phone first (so the app works without
 * signal), then queued here and sent to the backend, which stores it in PostgreSQL. Changes stay
 * in the queue until the server confirms them, so nothing is lost if the network drops or the
 * app is closed.
 */
import { apiClient, getStoredToken } from './apiClient';

export type SyncOp = {
  key: string; // entity:id — one pending change per record
  entity: string;
  op: 'upsert' | 'delete';
  id: string;
  record?: Record<string, unknown>;
  tries: number;
  queuedAt: string;
  lastError?: string;
};

const QUEUE_KEY = 'open_church_sync_queue_v1';
const FAILED_KEY = 'open_church_sync_failed_v1';
const BATCH = 25;
const MAX_TRIES = 8;

const read = (k: string): SyncOp[] => {
  try {
    const v = JSON.parse(localStorage.getItem(k) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
const write = (k: string, v: SyncOp[]) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (err) {
    console.error('[sync] could not save the sync queue', err);
  }
};

type StatusListener = (s: SyncStatus) => void;
export type SyncStatus = { pending: number; failed: number; syncing: boolean; lastError?: string; lastSyncedAt?: string };
const statusListeners = new Set<StatusListener>();
let status: SyncStatus = { pending: read(QUEUE_KEY).length, failed: read(FAILED_KEY).length, syncing: false };
const setStatus = (patch: Partial<SyncStatus>) => {
  status = { ...status, ...patch, pending: read(QUEUE_KEY).length, failed: read(FAILED_KEY).length };
  statusListeners.forEach((fn) => fn(status));
};
export const getSyncStatus = () => status;
export const subscribeToSync = (fn: StatusListener) => {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
};

export const getPendingOps = (): SyncOp[] => read(QUEUE_KEY);
export const getFailedOps = (): SyncOp[] => read(FAILED_KEY);

let timer: ReturnType<typeof setTimeout> | null = null;
const schedule = (ms = 800) => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flushSync(), ms);
};

/** Queue changes; a newer change to the same record replaces the older one. */
export const enqueueSync = (ops: Omit<SyncOp, 'key' | 'tries' | 'queuedAt'>[]): void => {
  if (!ops.length) return;
  const queue = read(QUEUE_KEY);
  const now = new Date().toISOString();
  for (const o of ops) {
    const key = `${o.entity}:${o.id}`;
    const idx = queue.findIndex((q) => q.key === key);
    const next: SyncOp = { ...o, key, tries: 0, queuedAt: now };
    if (idx >= 0) queue.splice(idx, 1);
    queue.push(next);
  }
  write(QUEUE_KEY, queue);
  setStatus({});
  schedule();
};

let flushing: Promise<void> | null = null;

/** Send queued changes to the server. Safe to call any time. */
export const flushSync = (): Promise<void> => {
  if (flushing) return flushing;
  const run = async () => {
    if (!getStoredToken()) return;
    setStatus({ syncing: true });
    try {
      for (let round = 0; round < 40; round++) {
        const queue = read(QUEUE_KEY);
        if (!queue.length) break;
        const batch = queue.slice(0, BATCH);
        let results: { ok: boolean; retry?: boolean; error?: string }[];
        try {
          const res = await apiClient.post<{ results: typeof results }>('/sync', {
            ops: batch.map(({ entity, op, id, record }) => ({ entity, op, id, record })),
          });
          results = res.results || [];
        } catch (err) {
          // Offline, server asleep or signed out: keep everything and try again later.
          setStatus({ lastError: err instanceof Error ? err.message : String(err) });
          schedule(30_000);
          return;
        }
        const sent = new Map(batch.map((b, i) => [b.key, results[i]]));
        const failed = read(FAILED_KEY);
        let progressed = false;
        const remaining: SyncOp[] = [];
        for (const q of read(QUEUE_KEY)) {
          const r = sent.get(q.key);
          // Changed again while this batch was in flight: keep the newer version.
          const sameVersion = batch.find((b) => b.key === q.key)?.queuedAt === q.queuedAt;
          if (!r || !sameVersion) {
            remaining.push(q);
            continue;
          }
          if (r.ok) {
            progressed = true;
            continue;
          }
          const tries = q.tries + 1;
          if (!r.retry || tries >= MAX_TRIES) {
            failed.push({ ...q, tries, lastError: r.error });
            progressed = true;
            console.error(`[sync] gave up on ${q.op} ${q.entity} ${q.id}: ${r.error}`);
          } else {
            remaining.push({ ...q, tries, lastError: r.error });
          }
        }
        // Records that wait on another record go to the back so the rest can get through.
        remaining.sort((a, b) => a.tries - b.tries);
        write(QUEUE_KEY, remaining);
        write(FAILED_KEY, failed.slice(-200));
        setStatus({ lastSyncedAt: new Date().toISOString(), lastError: undefined });
        if (!progressed) {
          schedule(15_000);
          return;
        }
      }
    } finally {
      setStatus({ syncing: false });
    }
  };
  // Clear the lock only after this run has fully finished (run() can finish synchronously).
  flushing = run().finally(() => {
    flushing = null;
  });
  return flushing;
};

/** Put changes that failed for good back in the queue (e.g. after a fix on the server). */
export const retryFailedSync = () => {
  const failed = read(FAILED_KEY);
  if (!failed.length) return;
  write(FAILED_KEY, []);
  enqueueSync(failed.map(({ entity, op, id, record }) => ({ entity, op, id, record })));
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => schedule(500));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') schedule(500);
  });
  setInterval(() => {
    if (read(QUEUE_KEY).length) void flushSync();
  }, 60_000);
  schedule(2_000);
}
