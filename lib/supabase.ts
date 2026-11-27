// ============================================================
// Supabase compatibility bridge -> Routed to Firebase Firestore
// All database operations are processed via Firebase
// ============================================================

import { firebaseDb } from './firebase-db';

export type * from './types';

// Redirect all database queries to Firebase Firestore
export const supabase = firebaseDb;
