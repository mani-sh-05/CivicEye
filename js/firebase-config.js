// ========================================
// CivicEye – Firebase Configuration
// ========================================
// Replace these with your actual Firebase project config from:
// Firebase Console → Project Settings → Your Apps → Web App

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

// ⚠️  REPLACE  these values with your Firebase project credentials
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// Initialize Firebase
const app       = initializeApp(firebaseConfig);
const auth      = getAuth(app);
const db        = getFirestore(app);
const storage   = getStorage(app);
const functions = getFunctions(app, "us-central1"); // adjust region if needed

// ── Auth state helper ──────────────────────────────────────────
/**
 * Returns a Promise that resolves with the current user (or null).
 * Waits for Firebase to determine the auth state before resolving.
 */
function getCurrentUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export { app, auth, db, storage, functions, getCurrentUser };
