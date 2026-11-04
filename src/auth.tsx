import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  AuthCredential,
  User,
  UserCredential,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { auth, db, googleRedirectPage, googleWebClientId } from './firebase';
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
  /**
   * Signs in with a Google popup. A guest's games come with them, unless that Google account
   * already has a TileTalk account, which this switches to.
   */
  signInWithGoogle(displayName?: string): Promise<void>;
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
    async signInWithGoogle(displayName) {
      const current = auth.currentUser;
      let result: UserCredential;
      let keptGuest = false;
      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        if (current?.isAnonymous) {
          try {
            // Keeps the guest's uid, like signUp.
            result = await linkWithPopup(current, provider);
            keptGuest = true;
          } catch (e) {
            // That Google account already has a TileTalk account. Switch to it without a second popup.
            const cred = (e as { code?: string }).code === 'auth/credential-already-in-use'
              ? GoogleAuthProvider.credentialFromError(e as Parameters<typeof GoogleAuthProvider.credentialFromError>[0])
              : null;
            if (!cred) throw e;
            result = await signInWithCredential(auth, cred);
          }
        } else {
          result = await signInWithPopup(auth, provider);
        }
      } else {
        const cred = await googleCredentialFromBrowser();
        if (current?.isAnonymous) {
          try {
            result = await linkWithCredential(current, cred);
            keptGuest = true;
          } catch (e) {
            if ((e as { code?: string }).code !== 'auth/credential-already-in-use') throw e;
            result = await signInWithCredential(auth, cred);
          }
        } else {
          result = await signInWithCredential(auth, cred);
        }
      }
      if (keptGuest) setIsGuest(false);
      // A name typed on the sign-up form wins, then the one already on the profile, then Google's.
      const ref = doc(db, 'users', result.user.uid);
      const stored = ((await getDoc(ref)).data()?.displayName as string | undefined)?.trim() ?? '';
      const name = (keptGuest && displayName?.trim()) || stored || result.user.displayName?.trim() || '';
      if (name !== stored) await setDoc(ref, { displayName: name }, { merge: true });
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

/**
 * The app can't show Firebase's Google popup, so it opens Google in a browser sheet instead. Google
 * sends the result to public/google-auth.html, which hands it back to the app's own address.
 */
async function googleCredentialFromBrowser(): Promise<AuthCredential> {
  if (!googleWebClientId) throw { code: 'tiletalk/google-not-set-up' };
  const returnUrl = Linking.createURL('google-auth');
  const params = new URLSearchParams({
    client_id: googleWebClientId,
    redirect_uri: googleRedirectPage,
    response_type: 'id_token',
    scope: 'openid email profile',
    // Google requires one for this kind of sign-in.
    nonce: Math.random().toString(36).slice(2) + Date.now().toString(36),
    state: returnUrl,
    prompt: 'select_account',
  });
  const res = await WebBrowser.openAuthSessionAsync(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, returnUrl);
  if (res.type !== 'success') throw { code: 'auth/user-cancelled' };
  const query = Linking.parse(res.url).queryParams ?? {};
  const idToken = query.id_token;
  if (typeof idToken !== 'string') {
    throw query.error === 'access_denied' ? { code: 'auth/user-cancelled' } : { code: 'tiletalk/google-failed', message: String(query.error ?? '') };
  }
  return GoogleAuthProvider.credential(idToken);
}

/** The person closed the Google window, so there's nothing to report. */
export function isCancelledSignIn(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/user-cancelled';
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
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google window. Allow pop-ups for TileTalk and try again.';
    case 'auth/unauthorized-domain':
      return 'Google sign-in isn’t allowed on this web address yet. Add it under Authentication > Settings > Authorized domains in the Firebase console.';
    case 'auth/account-exists-with-different-credential':
      return 'That Google account’s email already has a password account. Log in with your email and password instead.';
    case 'tiletalk/google-not-set-up':
      return 'Google sign-in isn’t set up in the app yet. Paste the Web client ID into src/firebase.ts.';
    case 'tiletalk/google-failed':
      return `Google sign-in didn’t finish${(e as { message?: string }).message ? ` (${(e as { message?: string }).message})` : ''}. Try again.`;
    case 'auth/network-request-failed':
      return 'No connection. Check your internet and try again.';
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return 'Guest play is turned off. In the Firebase console, turn on Anonymous under Authentication > Sign-in method.';
    default:
      return (e as Error)?.message ?? 'Something went wrong. Try again.';
  }
}
