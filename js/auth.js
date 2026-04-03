// js/auth.js  — CivicEye Firebase Auth (Email/Password + Google Popup/Redirect)
import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Redirect already-logged-in users away from auth page
const authPagePath = window.location.pathname.split('/').pop();
if (authPagePath === 'auth.html') {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.href = 'profile.html';
    }
  });
}


// ─────────────────────────────────────────────
//  Setup
// ─────────────────────────────────────────────

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({ prompt: 'select_account' });

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

function toast(msg, type = 'info') {
  if (typeof window.showAuthToast === 'function') {
    window.showAuthToast(msg, type);
  } else {
    console.log(`[${type.toUpperCase()}] ${msg}`);
  }
}

function setBtnLoading(btnId, loading, defaultLabel) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Please wait…' : defaultLabel;
}

function setGoogleBtnState(loading) {
  const btn = document.getElementById('googleBtn');
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.innerHTML = `<span class="spinner-inline"></span>&nbsp; Connecting to Google…`;
  } else {
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" style="flex-shrink:0">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09V7.07H2.18C1.43 8.55 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Continue with Google`;
  }
}

/** Ensure Firestore user doc exists. Returns the role string. */
async function ensureUserDoc(user, extras = {}) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) return snap.data().role || 'user';

  const payload = {
    uid: user.uid,
    email: user.email,
    name: user.displayName || extras.name || user.email.split('@')[0],
    photoURL: user.photoURL || null,
    role: extras.role || 'user',
    createdAt: new Date().toISOString(),
    ...extras
  };
  await setDoc(ref, payload);
  return payload.role;
}

/** Route user after successful login */
function redirectByRole(role) {
  toast(role === 'admin' ? 'Redirecting to Admin Panel…' : 'Welcome! Redirecting…', 'success');
  setTimeout(() => {
    window.location.href = role === 'admin' ? 'admin-panel.html' : 'index.html';
  }, 1200);
}

/** Convert Firebase error codes to friendly messages */
function friendlyError(code) {
  const map = {
    'auth/user-not-found': 'No account found with this email. Please sign up first.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/email-already-in-use': 'This email is already registered. Try signing in instead.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment.',
    'auth/network-request-failed': 'Network error. Check your internet connection.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed.',
    'auth/popup-blocked': 'Popup blocked — trying redirect instead…',
    'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}


// ─────────────────────────────────────────────
//  GOOGLE SIGN-IN  (Popup → Redirect fallback)
// ─────────────────────────────────────────────

window.handleGoogleSignIn = async () => {
  setGoogleBtnState(true);
  try {
    // Primary: popup (works on http/https)
    const result = await signInWithPopup(auth, googleProvider);
    const role = await ensureUserDoc(result.user);
    redirectByRole(role);

  } catch (error) {
    console.error('Google popup error:', error.code, error.message);

    if (
      error.code === 'auth/popup-blocked' ||
      error.code === 'auth/popup-closed-by-user' ||
      error.code === 'auth/cancelled-popup-request'
    ) {
      // Fallback: redirect flow
      toast('Opening Google Sign-In…', 'info');
      try {
        sessionStorage.setItem('civiceye_google_redirect', '1');
        await signInWithRedirect(auth, googleProvider);
        // Page will reload — execution continues in getRedirectResult below
      } catch (redirErr) {
        setGoogleBtnState(false);
        toast(friendlyError(redirErr.code), 'error');
        console.error('Google redirect error:', redirErr);
      }
    } else {
      setGoogleBtnState(false);
      toast(friendlyError(error.code), 'error');
    }
  }
};


// ─────────────────────────────────────────────
//  Handle redirect result on page load
//  (fires after signInWithRedirect returns)
// ─────────────────────────────────────────────

(async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      sessionStorage.removeItem('civiceye_google_redirect');
      setGoogleBtnState(true);
      toast(`Welcome, ${result.user.displayName || result.user.email}! 🎉`, 'success');
      const role = await ensureUserDoc(result.user);
      redirectByRole(role);
    }
  } catch (error) {
    if (error.code !== 'auth/null-user') {
      console.error('getRedirectResult error:', error);
      toast(friendlyError(error.code), 'error');
    }
  }
})();


// ─────────────────────────────────────────────
//  EMAIL / PASSWORD — Login
// ─────────────────────────────────────────────

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPassword').value;

    if (!email || !pass) { toast('Please fill in all fields.', 'error'); return; }

    setBtnLoading('loginBtn', true, 'Sign In →');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const user = userCredential.user;

      // Fetch role from Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        if (typeof showAuthToast !== 'undefined') showAuthToast("Login successful!", "success");

        // Route Guarding based on Role
        setTimeout(() => {
          if (data.role === 'admin') {
            window.location.href = 'admin-panel.html';
          } else {
            window.location.href = 'index.html';
          }
        }, 1000);
      } else {
        throw new Error("User record not found in database.");
      }
    } catch (error) {
      setBtnLoading('loginBtn', false, 'Sign In →');
      toast(friendlyError(error.code), 'error');
      console.error('Login error:', error);
    }
  });
}


// ─────────────────────────────────────────────
//  EMAIL / PASSWORD — Sign Up
// ─────────────────────────────────────────────

const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (document.getElementById('signupName')?.value || '').trim();
    const email = document.getElementById('signupEmail').value.trim();
    const pass = document.getElementById('signupPassword').value;
    const isAdmin = document.getElementById('adminToggle')?.checked || false;
    const category = isAdmin ? (document.getElementById('adminCategory')?.value || 'Others') : null;

    if (!email || !pass) { toast('Please fill in all fields.', 'error'); return; }
    if (pass.length < 6) { toast('Password must be at least 6 characters.', 'error'); return; }

    setBtnLoading('signupBtn', true, 'Create Account →');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      if (name) await updateProfile(cred.user, { displayName: name });

      const extras = { name, role: isAdmin ? 'admin' : 'user', ...(isAdmin && { category }) };
      await ensureUserDoc(cred.user, extras);

      redirectByRole(extras.role);
    } catch (error) {
      setBtnLoading('signupBtn', false, 'Create Account →');
      toast(friendlyError(error.code), 'error');
      console.error('Signup error:', error);
    }
  });
}


// ─────────────────────────────────────────────
//  Global logout
// ─────────────────────────────────────────────

window.logout = async () => {
  try {
    await signOut(auth);
    window.location.href = 'index.html';
  } catch (err) {
    console.error('Logout error:', err);
  }
};


// ─────────────────────────────────────────────
//  Auth state — skip sign-in page if logged in
// ─────────────────────────────────────────────

onAuthStateChanged(auth, (user) => {
  // Only redirect if this isn't a redirect-result page load
  if (user && !sessionStorage.getItem('civiceye_google_redirect')) {
    const saved = sessionStorage.getItem('civiceye_redirect');
    sessionStorage.removeItem('civiceye_redirect');
    window.location.href = saved || 'index.html';
  }
});


// ─────────────────────────────────────────────
//  Admin route enforcer (imported by admin pages)
// ─────────────────────────────────────────────

export async function enforceAdminRoute() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'auth.html'; return; }

    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists() || snap.data().role !== 'admin') {
      window.location.href = 'index.html';
      return;
    }
    const data = snap.data();
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('sidebarName', data.name || 'Admin');
    setEl('deptLabel', data.category || 'General');
    const tb = document.getElementById('topbarDept');
    if (tb) tb.innerHTML = `🏢 ${data.category || 'General'}`;
    if (typeof window.initializeAdminDashboard === 'function') {
      window.initializeAdminDashboard(data.category);
    }
  });
}
