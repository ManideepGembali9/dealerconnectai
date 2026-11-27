import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'dealerconnectai.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'dealerconnectai',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'dealerconnectai.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

export const isDemoFirebase =
  !firebaseConfig.apiKey ||
  firebaseConfig.apiKey.startsWith('AIzaSyDemo') ||
  firebaseConfig.projectId === 'dealerconnectai';

let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;

/**
 * Lazily returns Firebase App only in browser environments with real non-demo config.
 * Avoids eager client SDK initialization during SSR / React Server Component rendering.
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined' || isDemoFirebase) return null;
  if (cachedApp) return cachedApp;

  try {
    cachedApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    return cachedApp;
  } catch {
    return null;
  }
}

/**
 * Lazily returns Firestore instance when running in a configured browser environment.
 */
export function getFirebaseDb(): Firestore | null {
  if (typeof window === 'undefined' || isDemoFirebase) return null;
  if (cachedDb) return cachedDb;

  const app = getFirebaseApp();
  if (!app) return null;

  try {
    cachedDb = getFirestore(app);
    return cachedDb;
  } catch {
    return null;
  }
}
