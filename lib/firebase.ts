import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

export interface Auth {
  currentUser: any;
  signOut?: () => Promise<void>;
  [key: string]: any;
}

// Default Firebase Configuration (can be overridden via environment variables or Admin Settings)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDemoDealerConnectKey2026',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'dealerconnectai.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'dealerconnectai',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'dealerconnectai.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '1029384756',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:1029384756:web:a1b2c3d4e5f6',
};

// Initialize Firebase App safely (singleton)
let app: FirebaseApp;
const auth: Auth = { currentUser: null };
let db: Firestore = null as any;

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  try {
    db = getFirestore(app);
  } catch {}
} catch (error) {
  try {
    app = initializeApp(firebaseConfig, 'dealerconnect-fallback');
    try {
      db = getFirestore(app);
    } catch {}
  } catch {}
}

export { app, auth, db, firebaseConfig };
