import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { adminResetActionSettings } from '../../lib/emailActionSettings';

export interface AdminData {
  uid: string;
  email: string;
  role: 'super_admin';
  name?: string;
  createdAt?: any;
}

interface AdminAuthContextType {
  adminUser: User | null;
  adminData: AdminData | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  sendAdminPasswordReset: (email: string) => Promise<void>;
  refreshAdminData: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN EMAIL ALLOWLIST
// This is the primary gate. Firebase Auth sign-in succeeds → email is in this
// list → admin access granted. Firestore is used for bonus profile data only
// and NEVER blocks login even if rules deny the read/write.
// To add more admins, append their email below.
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_EMAIL_ALLOWLIST: string[] = [
  'ashitoshingale9@gmail.com',
  'ashitoshingale8@gmail.com', // keep previous for safety
];

function isAllowedAdmin(email: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAIL_ALLOWLIST.includes(email.toLowerCase().trim());
}

/** Build a local AdminData object from a Firebase Auth user */
function buildAdminData(user: User): AdminData {
  return {
    uid: user.uid,
    email: user.email!,
    role: 'super_admin',
    name: user.displayName || user.email!.split('@')[0],
  };
}

/**
 * Try to sync admin data to/from Firestore.
 * This is fire-and-forget — failures are silently swallowed so Firestore
 * permission errors NEVER block the login flow.
 */
async function syncFirestoreAdminDoc(user: User): Promise<AdminData> {
  const base = buildAdminData(user);
  try {
    const ref = doc(db, 'admins', user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as AdminData;
      // Return merged data (Firestore wins for name/extra fields)
      return { ...base, ...data, uid: user.uid, email: user.email!, role: 'super_admin' };
    }
    // Create the doc if it doesn't exist yet
    const newDoc: AdminData = { ...base, createdAt: serverTimestamp() };
    await setDoc(ref, newDoc);
    return base;
  } catch {
    // Firestore rules may deny — that's fine, return base data from Auth
    return base;
  }
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only run on /admin routes to avoid interfering with the patient portal
    if (!window.location.pathname.startsWith('/admin')) {
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && isAllowedAdmin(user.email)) {
        // Email is in allowlist → grant access immediately
        const data = await syncFirestoreAdminDoc(user);
        setAdminUser(user);
        setAdminData(data);
      } else {
        if (user && !isAllowedAdmin(user.email)) {
          // Signed in but not an admin — sign them out silently
          await signOut(auth).catch(() => {});
        }
        setAdminUser(null);
        setAdminData(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const login = async (email: string, password: string) => {
    // ── Step 1: Pre-check email against allowlist ──────────────────
    // This gives a fast, clear error without even attempting Firebase Auth
    // if the email is obviously not an admin.
    if (!isAllowedAdmin(email)) {
      throw new Error(
        'This email is not authorised as an admin account.\n' +
        'Please contact your system administrator.'
      );
    }

    // ── Step 2: Firebase Auth sign-in ─────────────────────────────
    let userCred;
    try {
      userCred = await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const code = err.code as string;
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        throw new Error('No Firebase account found for this email. Check credentials and try again.');
      }
      if (code === 'auth/wrong-password') {
        throw new Error('Incorrect password. Please try again.');
      }
      if (code === 'auth/too-many-requests') {
        throw new Error('Account temporarily locked due to too many failed attempts. Use "Forgot password" to reset.');
      }
      if (code === 'auth/invalid-email') {
        throw new Error('Invalid email address format.');
      }
      if (code === 'auth/network-request-failed') {
        throw new Error('Network error. Please check your connection and try again.');
      }
      throw new Error(err.message || 'Sign in failed. Please try again.');
    }

    // ── Step 3: Double-check email on the returned user ───────────
    if (!isAllowedAdmin(userCred.user.email)) {
      await signOut(auth);
      throw new Error('Access denied. This account is not registered as an admin.');
    }

    // ── Step 4: Sync Firestore (best-effort, never blocks) ─────────
    const data = await syncFirestoreAdminDoc(userCred.user);
    setAdminUser(userCred.user);
    setAdminData(data);
  };

  const logout = async () => {
    await signOut(auth);
    setAdminUser(null);
    setAdminData(null);
  };

  const sendAdminPasswordReset = async (email: string) => {
    // Any email can request a reset — Firebase handles delivery
    await firebaseSendPasswordResetEmail(auth, email, adminResetActionSettings);
  };

  const refreshAdminData = async () => {
    if (adminUser) {
      const data = await syncFirestoreAdminDoc(adminUser);
      setAdminData(data);
    }
  };

  return (
    <AdminAuthContext.Provider
      value={{ adminUser, adminData, loading, login, logout, sendAdminPasswordReset, refreshAdminData }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
};
