import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { router } from 'expo-router';
import { auth, db } from './firebase';
import type { UserProfile } from './types';
import { Button, ErrorText, Loading, Muted, Screen, Title } from './ui';

interface AuthValue {
  user: User | null;
  profile: UserProfile | null;
  /** Playing without an account. Everything still saves, but only on this device. */
  isGuest: boolean;
  loading: boolean;
  /** Set when the automatic guest sign-in failed. */
  error: string | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, displayName: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        if (u) {
          setIsGuest(u.isAnonymous);
          setError(null);
          setAuthReady(true);
          return;
        }
        // Nobody is signed in, so start a guest session and the app works straight away.
        // Creating an account later upgrades this same user, so nothing played as a guest is lost.
        setAuthReady(false);
        signInAnonymously(auth).catch((e) => {
          setError(friendlyAuthError(e));
          setAuthReady(true);
        });
      }),
    [],
  );

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const ref = doc(db, 'users', user.uid);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setProfile({ uid: snap.id, ...snap.data() } as UserProfile);
        return;
      }
      setProfile(null);
      // merge, so this can't overwrite a profile that signUp writes at the same moment.
      setDoc(ref, { displayName: '', avatar: '🀄', createdAt: serverTimestamp() }, { merge: true }).catch(
        (e) => setError((e as Error).message),
      );
    });
  }, [user]);

  const value: AuthValue = {
    user,
    profile,
    isGuest,
    loading: !authReady,
    error,
    async signIn(email, password) {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    async signUp(email, password, displayName) {
      const current = auth.currentUser;
      let uid: string;
      if (current?.isAnonymous) {
        // Keeps the guest's uid, so their groups, games and stats carry over.
        const cred = await linkWithCredential(current, EmailAuthProvider.credential(email.trim(), password));
        uid = cred.user.uid;
        setIsGuest(false);
      } else {
        uid = (await createUserWithEmailAndPassword(auth, email.trim(), password)).user.uid;
      }
      await setDoc(doc(db, 'users', uid), { displayName: displayName.trim() }, { merge: true });
    },
    async signOut() {
      await firebaseSignOut(auth);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Use inside <Protected>, where a user (guest or account) is guaranteed. */
export function useSignedInUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('No signed-in user');
  return user;
}

/** The name to show for a profile. Guests who haven't picked a name yet are "Guest". */
export function displayNameOf(profile: UserProfile | null): string {
  return profile?.displayName?.trim() || 'Guest';
}

/** Waits for the guest or account session. Nobody is sent to a login screen. */
export function Protected({ children }: { children: ReactNode }) {
  const { user, loading, error } = useAuth();
  if (loading) return <Loading />;
  if (!user) {
    return (
      <Screen>
        <Title>Can’t connect</Title>
        <ErrorText message={error} />
        <Muted>You can still log in if you already have an account.</Muted>
        <Button title="Log in" onPress={() => router.push('/login')} />
      </Screen>
    );
  }
  return <>{children}</>;
}

/** Turns Firebase error codes into messages people can act on. */
export function friendlyAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address doesn’t look right.';
    case 'auth/missing-password':
    case 'auth/weak-password':
      return 'Use a password with at least 6 characters.';
    case 'auth/email-already-in-use':
    case 'auth/credential-already-in-use':
      return 'An account already uses that email. Log in instead.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect.';
    case 'auth/network-request-failed':
      return 'No connection. Check your internet and try again.';
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return 'Guest play is turned off. In the Firebase console, turn on Anonymous under Authentication > Sign-in method.';
    default:
      return (e as Error)?.message ?? 'Something went wrong. Try again.';
  }
}
