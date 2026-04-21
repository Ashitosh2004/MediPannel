import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDztQnTNkmNOMr6HDyQKBEkmB22xSdZIJU",
  authDomain: "hospital-management-1cb98.firebaseapp.com",
  projectId: "hospital-management-1cb98",
  storageBucket: "hospital-management-1cb98.firebasestorage.app",
  messagingSenderId: "235004392426",
  appId: "1:235004392426:web:f318f9f9cdaee332e33893",
  measurementId: "G-ESXJ1JXE63"
};

// Prevent duplicate app initialization on HMR / hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use in-memory cache to avoid IndexedDB cache assertion failures when
// Firestore security rules change server-side. The persistent cache can cause
// "INTERNAL ASSERTION FAILED: Unexpected state" SDK crashes when stale cached
// entries conflict with newly deployed rule-sets.
let db: ReturnType<typeof getFirestore>;
try {
  db = initializeFirestore(app, {
    localCache: memoryLocalCache()
  });
} catch {
  // initializeFirestore can only be called once — fall back to existing instance on HMR
  db = getFirestore(app);
}

export { db };

export const auth = getAuth(app);
// Ensure auth session survives page refreshes
setPersistence(auth, browserLocalPersistence).catch(() => {});

export const storage = getStorage(app);
