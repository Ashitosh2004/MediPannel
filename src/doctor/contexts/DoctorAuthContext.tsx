import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, getDocFromServer, getDocs, getDocsFromServer, setDoc, query, collection, where, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { doctorResetActionSettings } from '../../lib/emailActionSettings';

export interface DoctorData {
  uid: string;
  name: string;
  email: string;
  specialty: string;
  experience?: string;
  profileImage?: string;
  role: 'doctor';
  createdAt: any;
  status?: string;
  originalDocId?: string;
}

interface DoctorAuthContextType {
  doctorUser: User | null;
  doctorData: DoctorData | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  sendDoctorPasswordReset: (email: string) => Promise<void>;
  refreshDoctorData: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mapAuthError(code: string): string {
  switch (code) {
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/user-not-found':
      return 'No account found with this email address.';
    case 'auth/too-many-requests':
      return 'Account locked due to too many failed attempts. Use forgot password to reset.';
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please check your credentials.';
    case 'auth/invalid-email':
      return 'Invalid email address format.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    default:
      return 'Sign in failed. Please try again.';
  }
}

/**
 * Look up a doctor record by their Firebase Auth UID first,
 * then fall back to email-based lookup (handles first-time login after admin creation).
 * When found by email, updates the record with the correct UID.
 *
 * IMPORTANT: This function NEVER throws — always returns DoctorData | null.
 */
async function findDoctorByUser(user: User): Promise<DoctorData | null> {
  // Step 1: Try direct UID lookup — force server read to bypass stale local cache
  try {
    const uidSnap = await getDocFromServer(doc(db, 'doctors', user.uid));
    if (uidSnap.exists()) {
      const d = uidSnap.data();
      return { ...d, uid: user.uid } as DoctorData;
    }
  } catch {
    // Firestore read failed — continue to email fallback
  }

  // Step 2: Email-based lookup (first login after admin creates account)
  // Force server fetch so we never get an empty local-cache result.
  let emailSnap;
  try {
    emailSnap = await getDocsFromServer(
      query(collection(db, 'doctors'), where('email', '==', user.email))
    );
  } catch {
    // If server query fails, fall back to cached read as last resort
    try {
      emailSnap = await getDocs(
        query(collection(db, 'doctors'), where('email', '==', user.email))
      );
    } catch {
      console.warn('[Doctor] Both server and cache email queries failed');
      return null;
    }
  }

  if (!emailSnap || emailSnap.empty) {
    // Last resort: try case-insensitive by scanning all docs (small collection)
    try {
      const allSnap = await getDocsFromServer(collection(db, 'doctors'));
      const match = allSnap.docs.find(
        (d) => d.data().email?.toLowerCase() === user.email?.toLowerCase()
      );
      if (!match) return null;
      // Found via case-insensitive scan — treat as email match
      emailSnap = { docs: [match], empty: false } as any;
    } catch {
      return null;
    }
  }

  // Prefer the record that has a matching UID already set, otherwise take first
  const docSnap =
    emailSnap.docs.find((d) => d.data().uid === user.uid) ?? emailSnap.docs[0];

  const rawData = docSnap.data();
  const doctorData: DoctorData = {
    ...(rawData as any),
    uid: user.uid,
    originalDocId: docSnap.id !== user.uid ? docSnap.id : rawData.originalDocId,
  };

  // Step 3: ALWAYS ensure doctors/{auth.uid} document physically exists.
  //
  // WHY this must be unconditional:
  //   A previous partial sync may have stamped `uid` on the OLD doc
  //   (doctors/{oldDocId}.uid = auth.uid) but never created the NEW doc at
  //   doctors/{auth.uid}. If we only check rawData.uid == user.uid, we wrongly
  //   skip the setDoc and doctors/{auth.uid} never gets created.
  //   The isDoctor() Firestore rule does: exists(doctors/{auth.uid}), so
  //   if the document is missing every dashboard query returns permission-denied.
  //
  // FIX: Always check the document physically exists; create it if not.
  try {
    const uidDocSnap = await getDocFromServer(doc(db, 'doctors', user.uid));
    if (!uidDocSnap.exists()) {
      // BLOCKING: create the uid-keyed doctor document so isDoctor() passes
      await setDoc(
        doc(db, 'doctors', user.uid),
        {
          ...rawData,
          uid: user.uid,
          originalDocId: docSnap.id,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (e) {
    console.warn('[Doctor] UID doc existence check/create failed:', e);
  }

  // BACKGROUND: stamp uid field on the original doc (non-critical)
  if (!rawData.uid || rawData.uid !== user.uid) {
    updateDoc(doc(db, 'doctors', docSnap.id), {
      uid: user.uid,
      updatedAt: serverTimestamp(),
    }).catch((e) => console.warn('[Doctor] Background uid update failed:', e));
  }

  return doctorData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const DoctorAuthContext = createContext<DoctorAuthContextType | undefined>(undefined);

export const DoctorAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [doctorUser, setDoctorUser] = useState<User | null>(null);
  const [doctorData, setDoctorData] = useState<DoctorData | null>(null);
  const [loading, setLoading] = useState(true);

  // Track whether we're mid-login so the auth-state listener doesn't sign out
  // the user before the login() function finishes its own verification
  const isLoggingIn = useRef(false);

  useEffect(() => {
    // Only run the auth listener on /doctor routes to avoid conflicting with
    // the patient portal or admin portal auth state.
    if (!window.location.pathname.startsWith('/doctor')) {
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // If login() is handling this auth event, let it own the state update
        if (isLoggingIn.current) {
          setLoading(false);
          return;
        }

        // Session restore: verify the user is still a valid doctor
        const data = await findDoctorByUser(user);
        if (data && data.status !== 'suspended') {
          setDoctorUser(user);
          setDoctorData(data);
        } else {
          // Signed in via Firebase Auth but no doctor record or suspended — sign out
          await signOut(auth).catch(() => {});
          setDoctorUser(null);
          setDoctorData(null);
        }
      } else {
        setDoctorUser(null);
        setDoctorData(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // ── login ──────────────────────────────────────────────────────
  const login = async (email: string, password: string): Promise<void> => {
    isLoggingIn.current = true;

    // Step 1: Firebase Auth sign-in
    let userCred;
    try {
      userCred = await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      isLoggingIn.current = false;
      throw new Error(mapAuthError(err.code as string));
    }

    // Step 2: Verify the Firestore doctors document exists (by email or UID)
    const data = await findDoctorByUser(userCred.user);
    isLoggingIn.current = false;

    if (!data) {
      await signOut(auth).catch(() => {});
      throw new Error(
        'Access denied: This account is not registered as a doctor.\nPlease contact your administrator.'
      );
    }

    // Step 3: Check if suspended
    if (data.status === 'suspended') {
      await signOut(auth).catch(() => {});
      throw new Error('Your account has been suspended. Please contact your administrator.');
    }

    // Step 4: Set state — login complete
    setDoctorUser(userCred.user);
    setDoctorData(data);
    setLoading(false);
  };

  // ── logout ─────────────────────────────────────────────────────
  const logout = async (): Promise<void> => {
    await signOut(auth).catch(() => {});
    setDoctorUser(null);
    setDoctorData(null);
  };

  // ── password reset ─────────────────────────────────────────────
  const sendDoctorPasswordReset = async (email: string): Promise<void> => {
    await firebaseSendPasswordResetEmail(auth, email, doctorResetActionSettings);
  };

  // ── refresh doctor data ────────────────────────────────────────
  const refreshDoctorData = async (): Promise<void> => {
    if (!doctorUser) return;
    const data = await findDoctorByUser(doctorUser);
    if (data) setDoctorData(data);
  };

  return (
    <DoctorAuthContext.Provider
      value={{ doctorUser, doctorData, loading, login, logout, sendDoctorPasswordReset, refreshDoctorData }}
    >
      {children}
    </DoctorAuthContext.Provider>
  );
};

export function useDoctorAuth(): DoctorAuthContextType {
  const ctx = useContext(DoctorAuthContext);
  if (!ctx) throw new Error('useDoctorAuth must be used inside DoctorAuthProvider');
  return ctx;
}
