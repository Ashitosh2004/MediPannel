/**
 * clearFirestoreCache.ts
 *
 * Wipes stale Firestore IndexedDB caches and installs a crash guard.
 * Must be called before ANY Firestore initialization.
 *
 * v3 key: forces re-clear for all users who had the old persistentLocalCache.
 * Uses localStorage so the flag survives hard reloads and app crashes.
 */

const CLEARED_FLAG = 'firestore_idb_cleared_v3';

async function deleteAllFirestoreDBs(): Promise<void> {
  try {
    const databases = await indexedDB.databases();
    await Promise.all(
      databases
        .filter(
          (db) =>
            db.name &&
            (db.name.includes('firestore') ||
              db.name.includes('firebase') ||
              db.name.startsWith('firebaseLocalStorageDb'))
        )
        .map(
          (db) =>
            new Promise<void>((resolve) => {
              if (!db.name) return resolve();
              const req = indexedDB.deleteDatabase(db.name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            })
        )
    );
  } catch {
    // Non-fatal
  }
}

export async function clearFirestoreIndexedDBIfNeeded(): Promise<void> {
  // Use localStorage (not sessionStorage) so the flag persists across crashes
  if (localStorage.getItem(CLEARED_FLAG)) return;
  await deleteAllFirestoreDBs();
  localStorage.setItem(CLEARED_FLAG, '1');
}

/**
 * Installs a global error handler that catches Firestore INTERNAL ASSERTION
 * FAILED crashes at runtime (can happen with React StrictMode double-mounting
 * or race conditions). On detection: clears the cache flag + reloads once.
 */
export function installFirestoreCrashGuard(): void {
  const RELOAD_FLAG = 'firestore_crash_reload';

  window.addEventListener('error', async (event) => {
    const msg = event.message || '';
    if (msg.includes('INTERNAL ASSERTION FAILED') || msg.includes('Unexpected state')) {
      // Prevent reload loop — only auto-reload once
      if (sessionStorage.getItem(RELOAD_FLAG)) return;
      sessionStorage.setItem(RELOAD_FLAG, '1');

      // Force re-clear next load
      localStorage.removeItem(CLEARED_FLAG);
      await deleteAllFirestoreDBs();
      window.location.reload();
    }
  });

  // Also catch unhandled promise rejections from Firestore
  window.addEventListener('unhandledrejection', async (event) => {
    const msg = String(event.reason?.message || event.reason || '');
    if (msg.includes('INTERNAL ASSERTION FAILED') || msg.includes('Unexpected state')) {
      if (sessionStorage.getItem(RELOAD_FLAG)) return;
      sessionStorage.setItem(RELOAD_FLAG, '1');
      localStorage.removeItem(CLEARED_FLAG);
      await deleteAllFirestoreDBs();
      window.location.reload();
    }
  });
}
