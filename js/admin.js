// js/admin.js
import { db } from './firebase-config.js';
import { enforceAdminRoute } from './auth.js';
import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    doc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// First enforce that only admins see this page
enforceAdminRoute();

let currentCategory = "General";
let liveIssues = [];

window.initializeAdminDashboard = (category) => {
    currentCategory = category || "General";
    console.log("Admin initialized for category:", currentCategory);
    
    const q = query(collection(db, "reports"), where("category", "==", currentCategory));
    
    // Real-time listener
    onSnapshot(q, (snapshot) => {
        liveIssues = [];
        snapshot.forEach((docSnap) => {
            liveIssues.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        // Ensure UI functions exist before calling them
        if (typeof window.refreshUI === 'function') {
            window.refreshUI(liveIssues);
        }
    });
};

window.getIssues = () => {
    return liveIssues;
};

// Update issue status to In Progress
window.markProgress = async (id) => {
    try {
        const issueRef = doc(db, "reports", id);
        await updateDoc(issueRef, { status: "In Progress" });
        if (typeof toast !== 'undefined') toast('🔄 Status Updated', 'Issue marked as In Progress', 'info');
    } catch (e) {
        console.error("Error updating status: ", e);
    }
};

// Resolve an issue with an after image
window.submitResolution = async (id, afterDataURL, resolveComment) => {
    try {
        const issueRef = doc(db, "reports", id);
        await updateDoc(issueRef, { 
            status: "Resolved",
            afterImage: afterDataURL,
            resolveComment: resolveComment || "Resolution confirmed by admin",
            resolvedAt: new Date().toISOString()
        });
        if (typeof toast !== 'undefined') toast('✅ Issue Resolved!', 'Proof of resolution saved.', 'success');
    } catch (e) {
        console.error("Error submitting resolution: ", e);
        if (typeof toast !== 'undefined') toast('⚠️ Error', 'Could not resolve issue.', 'warn');
    }
};
