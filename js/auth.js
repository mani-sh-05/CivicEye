// js/auth.js
import { auth, db } from './firebase-config.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  doc, 
  setDoc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Make signOut available globally for the navbar and dashboards
window.logout = async () => {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Logout error", error);
    }
};

/**
 * Handle Login Form Submission
 */
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');
    
    btn.disabled = true;
    btn.textContent = "Authenticating...";

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
      btn.disabled = false;
      btn.textContent = "Sign In";
      if (typeof showAuthToast !== 'undefined') {
        showAuthToast(error.message.replace('Firebase:', '').trim(), "error");
      }
      console.error(error);
    }
  });
}

/**
 * Handle Signup Form Submission
 */
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value.trim();
    const pass = document.getElementById('signupPassword').value;
    const isAdmin = document.getElementById('adminToggle').checked;
    let selectedCategory = "None";

    if (isAdmin) {
      selectedCategory = document.getElementById('adminCategory').value;
    }

    const btn = document.getElementById('signupBtn');
    btn.disabled = true;
    btn.textContent = "Creating account...";

    try {
      // Create user auth registry
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const user = userCredential.user;

      // Save role into Firestore
      const userPayload = {
        uid: user.uid,
        email: user.email,
        role: isAdmin ? "admin" : "user",
        createdAt: new Date().toISOString()
      };

      if (isAdmin) {
        userPayload.category = selectedCategory;
      }

      await setDoc(doc(db, "users", user.uid), userPayload);

      if (typeof showAuthToast !== 'undefined') showAuthToast("Account created successfully!", "success");

      // Redirect payload
      setTimeout(() => {
        if (isAdmin) {
          window.location.href = 'admin-panel.html';
        } else {
          window.location.href = 'index.html';
        }
      }, 1000);

    } catch (error) {
      btn.disabled = false;
      btn.textContent = "Create Account";
      if (typeof showAuthToast !== 'undefined') {
        showAuthToast(error.message.replace('Firebase:', '').trim(), "error");
      }
      console.error(error);
    }
  });
}

/**
 * Global Route Guard for protected views
 * If this script is loaded onto a page with `id="admin-guard"` or similar, we can enforce access natively.
 */
export async function enforceAdminRoute() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'auth.html';
        } else {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                if (data.role !== 'admin') {
                    // Not an admin, boot them
                    window.location.href = 'index.html';
                } else {
                    // Load Admin Name & Dept onto the page UI generically
                    const lbl = document.getElementById('sidebarName');
                    if (lbl) lbl.textContent = "Admin";
                    const deptLbl = document.getElementById('deptLabel');
                    if (deptLbl) deptLbl.textContent = data.category || "General";
                    const tbDept = document.getElementById('topbarDept');
                    if (tbDept) tbDept.innerHTML = `🏢 ${data.category || "General"}`;
                    
                    // Allow data initialization by invoking global load function if present
                    if (typeof window.initializeAdminDashboard === 'function') {
                        window.initializeAdminDashboard(data.category);
                    }
                }
            } else {
                window.location.href = 'auth.html';
            }
        }
    });
}
