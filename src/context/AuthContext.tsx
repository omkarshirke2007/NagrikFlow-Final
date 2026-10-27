import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, BOOTSTRAP_ADMIN_EMAIL, handleFirestoreError, OperationType, testConnection } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { checkAndSeedIfEmpty } from '../lib/demoData';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole;
  effectiveRole: UserRole;
  setEffectiveRole: (role: UserRole) => void;
  loading: boolean;
  isFirebaseConnected: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string, requestedRole: UserRole) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  quickDemoSignIn: (role: 'admin' | 'worker' | 'citizen') => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [effectiveRole, setEffectiveRole] = useState<UserRole>('citizen');
  const [loading, setLoading] = useState(true);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(true);

  // Probe connection on initial boot
  useEffect(() => {
    testConnection().then((connected) => {
      setIsFirebaseConnected(connected);
    });
  }, []);

  // Fetch or create user profile in Firestore
  const syncUserProfile = async (firebaseUser: User): Promise<UserProfile> => {
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    try {
      const snap = await getDoc(userDocRef);
      const isBootstrapAdmin = firebaseUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        // If bootstrapped admin, ensure admin privilege
        if (isBootstrapAdmin && data.role !== 'admin') {
          const updatedProfile: UserProfile = { ...data, role: 'admin' };
          await setDoc(userDocRef, updatedProfile, { merge: true });
          await setDoc(doc(db, 'admins', firebaseUser.uid), {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            createdAt: new Date().toISOString(),
          }, { merge: true });
          return updatedProfile;
        }
        return data;
      } else {
        // Create new profile document
        const initialRole: UserRole = isBootstrapAdmin ? 'admin' : 'citizen';
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Nagrik Citizen',
          email: firebaseUser.email || '',
          role: initialRole,
          createdAt: new Date().toISOString(),
        };

        await setDoc(userDocRef, newProfile);

        if (initialRole === 'admin') {
          await setDoc(doc(db, 'admins', firebaseUser.uid), {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            createdAt: new Date().toISOString(),
          });
        }

        return newProfile;
      }
    } catch (err) {
      console.error('Error syncing user profile:', err);
      // Fallback local profile if offline or permission denied
      const isBootstrapAdmin = firebaseUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
      return {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Citizen',
        email: firebaseUser.email || '',
        role: isBootstrapAdmin ? 'admin' : 'citizen',
        createdAt: new Date().toISOString(),
      };
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userProfile = await syncUserProfile(currentUser);
          setProfile(userProfile);
          setEffectiveRole(userProfile.role);

          // If admin, check and seed demo data if database is fresh
          if (userProfile.role === 'admin') {
            checkAndSeedIfEmpty(currentUser.uid).catch((err) => {
              console.warn('Auto-seed check error:', err);
            });
          }
        } catch (e) {
          console.error('Failed to load profile:', e);
        }
      } else {
        setProfile(null);
        setEffectiveRole('citizen');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (!user) return;
    const prof = await syncUserProfile(user);
    setProfile(prof);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), pass);
  };

  const registerWithEmail = async (
    email: string,
    pass: string,
    name: string,
    requestedRole: UserRole
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    if (name.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() });
    }
    // Prevent unprivileged self-assignment to admin unless matching bootstrap admin email
    const safeRole: UserRole =
      email.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()
        ? 'admin'
        : requestedRole === 'admin'
        ? 'citizen'
        : requestedRole;

    const newProfile: UserProfile = {
      uid: cred.user.uid,
      displayName: name.trim() || email.split('@')[0],
      email: cred.user.email || email.trim(),
      role: safeRole,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'users', cred.user.uid), newProfile);
      if (safeRole === 'admin') {
        await setDoc(doc(db, 'admins', cred.user.uid), {
          uid: cred.user.uid,
          email: cred.user.email,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${cred.user.uid}`);
    }

    setProfile(newProfile);
    setEffectiveRole(safeRole);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const quickDemoSignIn = async (targetRole: 'admin' | 'worker' | 'citizen') => {
    let email = '';
    let pass = '';
    let name = '';

    if (targetRole === 'admin') {
      email = BOOTSTRAP_ADMIN_EMAIL;
      pass = 'Admin@123456';
      name = 'Omkar Shirke (Municipal Admin)';
    } else if (targetRole === 'worker') {
      email = 'worker.rajesh@nagrikflow.in';
      pass = 'Worker@123456';
      name = 'Rajesh Kumar (Field Lead)';
    } else {
      email = 'citizen.priya@nagrikflow.in';
      pass = 'Citizen@123456';
      name = 'Priya Sharma (Resident)';
    }

    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch {
      // If user does not exist in Auth, register and seed immediately
      try {
        await registerWithEmail(email, pass, name, targetRole);
      } catch (regErr) {
        console.error('Registration fallback failed:', regErr);
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role || 'citizen',
        effectiveRole,
        setEffectiveRole,
        loading,
        isFirebaseConnected,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        resetPassword,
        quickDemoSignIn,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
