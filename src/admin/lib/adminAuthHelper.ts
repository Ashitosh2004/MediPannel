import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

/**
 * The Firebase config - MUST match src/lib/firebase.ts
 */
const firebaseConfig = {
  apiKey: "AIzaSyDztQnTNkmNOMr6HDyQKBEkmB22xSdZIJU",
  authDomain: "hospital-management-1cb98.firebaseapp.com",
  projectId: "hospital-management-1cb98",
  storageBucket: "hospital-management-1cb98.firebasestorage.app",
  messagingSenderId: "235004392426",
  appId: "1:235004392426:web:f318f9f9cdaee332e33893",
  measurementId: "G-ESXJ1JXE63"
};

/**
 * Creates a Firebase Auth account for a newly added doctor WITHOUT
 * logging out the currently logged-in Admin.
 *
 * It does this by creating a temporary separate 'Secondary' Firebase app instance.
 * 
 * @param email The doctor's email
 * @returns The newly created Firebase UID, or null if it already exists (which is fine)
 */
export async function createSecondaryAuthAccount(email: string): Promise<string | null> {
  // 1. Generate a random temporary password (the doctor will reset this immediately)
  const tempPassword = `Temp@${Math.random().toString(36).slice(-10)}${Date.now()}`;

  // 2. Initialize a secondary Firebase app
  // Use a unique name so multiple rapid additions don't conflict
  const secondaryAppName = `SecondaryApp_${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  let newUid: string | null = null;
  
  try {
    // 3. Create the user using the secondary auth instance
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword);
    newUid = userCredential.user.uid;
    
    // Sign out just in case
    await signOut(secondaryAuth);
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      console.warn(`User ${email} already exists in Firebase Auth. Skipping creation.`);
      // returning null means "already exists"
    } else {
      console.error('Failed to create secondary auth account:', error);
      throw error;
    }
  } finally {
    // 4. Clean up the secondary app instance to prevent memory leaks
    await deleteApp(secondaryApp).catch(console.error);
  }

  return newUid;
}
