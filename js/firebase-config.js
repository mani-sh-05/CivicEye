// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAgx-d_GbUdTGJ68XAhH_dDXo_0LoqWofU",
  authDomain: "civiceye-a9066.firebaseapp.com",
  projectId: "civiceye-a9066",
  storageBucket: "civiceye-a9066.firebasestorage.app",
  messagingSenderId: "337106143583",
  appId: "1:337106143583:web:952b6defa716ed66dfceea",
  measurementId: "G-H85NEMG69W"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Auth Helper for waiting on resolution
export const getCurrentUser = () => {
    return new Promise((resolve, reject) => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            unsubscribe();
            resolve(user);
        }, reject);
    });
};
