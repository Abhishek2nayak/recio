/**
 * IndexedDB-backed pending-upload store. The popup, studio, and offscreen recorder
 * all run on the same chrome-extension:// origin, so they share this database.
 *
 * A capture's bytes are persisted here BEFORE its upload starts and removed only
 * after the upload + metadata save succeed — so once a recording exists, it is
 * never held only in memory. A failed (or interrupted) upload stays recoverable:
 * the popup lists leftovers and the studio can retry or download them.
 */
export interface PendingUpload {
  id: string;
  title: string;
  type: "recording" | "screenshot";
  mimeType: string;
  durationMs: number;
  sizeBytes: number;
  createdAt: number;
  lastError?: string;
  /** Set once the instant-link metadata row exists — retries reuse it instead of
   *  creating a duplicate recording (and its share link stays valid). */
  mediaId?: string;
  blob: Blob;
}

const DB_NAME = "recio-pending-uploads";
const STORE = "pending";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open the recovery store."));
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("Recovery store operation failed."));
    });
  } finally {
    db.close();
  }
}

export function savePending(item: PendingUpload): Promise<unknown> {
  return tx("readwrite", (s) => s.put(item));
}

export async function getPending(id: string): Promise<PendingUpload | null> {
  return (await tx<PendingUpload | undefined>("readonly", (s) => s.get(id))) ?? null;
}

export function listPending(): Promise<PendingUpload[]> {
  return tx<PendingUpload[]>("readonly", (s) => s.getAll());
}

export async function setPendingError(id: string, lastError: string): Promise<void> {
  const item = await getPending(id);
  if (item) await savePending({ ...item, lastError });
}

export function deletePending(id: string): Promise<unknown> {
  return tx("readwrite", (s) => s.delete(id));
}
