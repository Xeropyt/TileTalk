import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Paste the firebaseConfig object from the Firebase console here
// (Project settings > General > Your apps).
const firebaseConfig = {
  apiKey: "AIzaSyB5CUucxPWfYDvew-euxIPkE3lxzZvyoQ8",
  authDomain: "tiletalk-4f62d.firebaseapp.com",
  projectId: "tiletalk-4f62d",
  storageBucket: "tiletalk-4f62d.firebasestorage.app",
  messagingSenderId: "791034227814",
  appId: "1:791034227814:web:7b5d40fea741884a7d51a7",
  measurementId: "G-YJF3FF4YYF"
};
console.log('Firebase key:', firebaseConfig.apiKey);
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createAuth(): FirebaseAuth.Auth {
  if (Platform.OS === 'web') return FirebaseAuth.getAuth(app);

  // getReactNativePersistence only exists in Firebase's React Native build,
  // so it's looked up at runtime. It keeps people signed in between app launches.
  const getRNPersistence = (FirebaseAuth as any).getReactNativePersistence;
  if (!getRNPersistence) {
    console.warn('Firebase React Native persistence not found. Users will be signed out when the app closes.');
    return FirebaseAuth.getAuth(app);
  }
  try {
    return FirebaseAuth.initializeAuth(app, { persistence: getRNPersistence(AsyncStorage) });
  } catch {
    // initializeAuth throws if it already ran, e.g. after a fast refresh.
    return FirebaseAuth.getAuth(app);
  }
}

export const auth = createAuth();

// Google sign-in in the app (Expo Go and builds). Paste the Web client ID from the Firebase console:
// Authentication > Sign-in method > Google > Web SDK configuration.
export const googleWebClientId = '791034227814-elqp8q8neao4s4i6plbu9osnmkgj0lk0.apps.googleusercontent.com';
// public/google-auth.html, once deployed. Add this exact address to that client's Authorized redirect
// URIs in Google Cloud console > APIs & Services > Credentials.
export const googleRedirectPage = `https://${firebaseConfig.projectId}.web.app/google-auth.html`;
export const db = getFirestore(app);
