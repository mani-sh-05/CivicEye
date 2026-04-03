// js/admin.js
import { enforceAdminRoute } from './auth.js';

// First enforce that only admins see this page
enforceAdminRoute();

let currentCategory = "General";
let liveIssues = [];

window.initializeAdminDashboard = (category) => {
    currentCategory = category || "General";
    console.log("Admin initialized for category:", currentCategory);
    
    function fetchLocal() {
        if (window.ComplaintsDB) {
            liveIssues = window.ComplaintsDB.get();
        } else {
            liveIssues = JSON.parse(localStorage.getItem('civic_complaints') || '[]');
        }
        
        // Filter by category if needed
        if (currentCategory !== "General" && currentCategory !== "All") {
            liveIssues = liveIssues.filter(i => i.category === currentCategory);
        }

        if (typeof window.refreshUI === 'function') {
            window.refreshUI(liveIssues);
        }
    }
    
    // Initial fetch and poll to simulate real-time updates
    fetchLocal();
    setInterval(fetchLocal, 1500);
};

window.getIssues = () => {
    return liveIssues;
};

// Update issue status to In Progress
window.markProgress = async (id) => {
    try {
        if (window.ComplaintsDB) {
            window.ComplaintsDB.update(id, { status: "In Progress" });
        } else {
            const data = JSON.parse(localStorage.getItem('civic_complaints') || '[]');
            const updated = data.map(i => i.id === id ? { ...i, status: "In Progress" } : i);
            localStorage.setItem('civic_complaints', JSON.stringify(updated));
        }
        if (typeof toast !== 'undefined') toast('🔄 Status Updated', 'Issue marked as In Progress', 'info');
    } catch (e) {
        console.error("Error updating status: ", e);
    }
};

// Resolve an issue with an after image
window.submitResolution = async (id, afterDataURL, resolveComment) => {
    try {
        const payload = { 
            status: "Resolved",
            afterImage: afterDataURL,
            resolveComment: resolveComment || "Resolution confirmed by admin",
            resolvedAt: new Date().toISOString()
        };
        if (window.ComplaintsDB) {
            window.ComplaintsDB.update(id, payload);
        } else {
            const data = JSON.parse(localStorage.getItem('civic_complaints') || '[]');
            const updated = data.map(i => i.id === id ? { ...i, ...payload } : i);
            localStorage.setItem('civic_complaints', JSON.stringify(updated));
        }
        if (typeof toast !== 'undefined') toast('✅ Issue Resolved!', 'Proof of resolution saved.', 'success');
    } catch (e) {
        console.error("Error submitting resolution: ", e);
        if (typeof toast !== 'undefined') toast('⚠️ Error', 'Could not resolve issue.', 'warn');
    }
};
