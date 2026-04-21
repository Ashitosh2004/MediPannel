import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, query, collection, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { verificationActionSettings, resetActionSettings } from '../lib/emailActionSettings';

export interface UserData {
  uid: string;
  name: string;
  email: string;
  createdAt: any;
  profileImage: string;
  phone?: string;
  address?: string;
  bloodGroup?: string;
  dateOfBirth?: string;
  medPanelUID?: string;       // Auto-generated unique patient identifier
  profileComplete?: boolean;  // Set to true only after onboarding form is submitted
}


interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Check if the given email belongs to a doctor account.
 * Doctors are stored in the 'doctors' collection with an email field.
 */
async function isDoctorEmail(email: string): Promise<boolean> {
  try {
    const snap = await Promise.race([
      getDocs(query(collection(db, 'doctors'), where('email', '==', email))),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]) as Awaited<ReturnType<typeof getDocs>>;
    return !snap.empty;
  } catch {
    // On timeout or error, assume not a doctor so login can proceed
    return false;
  }
}

/**
 * Check if the given email belongs to an admin account.
 */
const ADMIN_EMAIL_ALLOWLIST = ['ashitoshingale9@gmail.com', 'ashitoshingale8@gmail.com'];
function isAdminEmail(email: string): boolean {
  return ADMIN_EMAIL_ALLOWLIST.includes(email.toLowerCase().trim());
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data() as UserData);
      } else {
        setUserData(null);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserData(null);
    }
  };

  useEffect(() => {
    // Only run patient auth on non-doctor, non-admin routes
    if (
      window.location.pathname.startsWith('/doctor') ||
      window.location.pathname.startsWith('/admin')
    ) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Immediately signal "checking auth" to prevent ProtectedRoute from
        // redirecting to /login during the async Firestore role-check below.
        setLoading(true);

        // If signed-in user is a doctor or admin, don't treat them as a patient
        const email = currentUser.email || '';
        if (isAdminEmail(email)) {
          // Admin trying to access patient portal — sign out
          await signOut(auth).catch(() => {});
          setUser(null);
          setUserData(null);
          setLoading(false);
          return;
        }

        const isDoctor = await isDoctorEmail(email);
        if (isDoctor) {
          // Doctor trying to access patient portal — sign out
          await signOut(auth).catch(() => {});
          setUser(null);
          setUserData(null);
          setLoading(false);
          return;
        }

        setUser(currentUser);
        await fetchUserData(currentUser.uid);
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    // Pre-check: reject doctors and admins at the patient portal login
    if (isAdminEmail(email)) {
      throw new Error('This is an admin account. Please use the Admin Portal to sign in.');
    }
    const isDoctor = await isDoctorEmail(email);
    if (isDoctor) {
      throw new Error('This is a doctor account. Please use the Doctor Portal to sign in.');
    }
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signup = async (email: string, pass: string, name: string) => {
    // Prevent creating patient accounts for doctor/admin emails
    if (isAdminEmail(email)) {
      throw new Error('This email is reserved for an admin account.');
    }
    const isDoctor = await isDoctorEmail(email);
    if (isDoctor) {
      throw new Error('This email is already registered as a doctor account. Please use the Doctor Portal.');
    }

    const result = await createUserWithEmailAndPassword(auth, email, pass);
    const newUser = result.user;

    // Send email verification with a redirect back to the app's login page
    await sendEmailVerification(newUser, verificationActionSettings);

    // Create user document in Firestore
    const newUserData: UserData = {
      uid: newUser.uid,
      name,
      email,
      createdAt: serverTimestamp(),
      profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff`,
    };

    await setDoc(doc(db, 'users', newUser.uid), newUserData);
    setUserData(newUserData);

    // Sign out immediately so the auth listener doesn't navigate away
    // before the user sees the "Check your email" verification prompt.
    await signOut(auth);
    setUser(null);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setUserData(null);
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email, resetActionSettings);
    } catch (err: any) {
      if (err.code === 'auth/too-many-requests') {
        throw new Error('Too many requests. Please wait a few minutes and try again.');
      }
      if (err.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      }
      if (err.code === 'auth/user-not-found') {
        return; // silently succeed (anti-enumeration)
      }
      throw err;
    }
  };

  const refreshUserData = async () => {
    if (user) {
      await fetchUserData(user.uid);
    }
  };

  const value = {
    user,
    userData,
    loading,
    login,
    signup,
    logout,
    resetPassword,
    refreshUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
