// ========================================================
// CivicEye – Firebase Report Submission
// Handles: Storage upload → Cloud Function → Firestore write
// ========================================================

import { db, storage, functions, getCurrentUser } from "./firebase-config.js";
import {
  collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import {
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

// ── Upload image to Firebase Storage ──────────────────────────
/**
 * @param {File}   file
 * @param {string} userId
 * @param {Function} onProgress  (percent: number) => void
 * @returns {Promise<{url: string, path: string}>}
 */
async function uploadReportImage(file, userId, onProgress) {
  const ext      = (file.name.split(".").pop() || "jpg").toLowerCase();
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = `reports/${userId}/${filename}`;
  const fileRef  = storageRef(storage, filePath);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(fileRef, file, {
      contentType: file.type || "image/jpeg"
    });

    task.on(
      "state_changed",
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        if (typeof onProgress === "function") onProgress(pct);
      },
      (err) => reject(new Error(`Image upload failed: ${err.message}`)),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({ url, path: filePath });
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

// ── Call the Cloud Function for server-side validation ───────
/**
 * Calls the "validateReport" Firebase Cloud Function.
 * Returns { validationStatus, distance, reason }
 */
async function callValidateReport(payload) {
  try {
    const validateReport = httpsCallable(functions, "validateReport");
    const result = await validateReport(payload);
    return result.data;
  } catch (err) {
    console.warn("Cloud Function call failed, falling back to client validation:", err.message);
    // Graceful fallback – use client-side result already computed
    return {
      validationStatus: payload.clientValidationStatus || "valid",
      distance:         payload.distance               || null,
      reason:           "Validated client-side (function unavailable)."
    };
  }
}

// ── Save report document to Firestore ────────────────────────
/**
 * Writes the complete report to Firestore.
 * @returns {Promise<string>} documentId
 */
async function saveReportToFirestore(reportData) {
  const docRef = await addDoc(collection(db, "reports"), {
    ...reportData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

// ── Master submit function ────────────────────────────────────
/**
 * Orchestrates the full report submission pipeline:
 *   1. Get authenticated user
 *   2. Upload image → Storage
 *   3. Call Cloud Function for validation
 *   4. Save report → Firestore
 *
 * @param {object} formData
 *   {
 *     title, description, category, priority,
 *     imageFile,          // File object
 *     userLocation,       // { latitude, longitude }
 *     imageExifLocation,  // { latitude, longitude, timestamp } | null
 *     clientValidationStatus, distance, validationReason
 *   }
 * @param {Function} onProgress  (pct: number) => void
 * @returns {Promise<{ reportId, validationStatus, imageUrl }>}
 */
async function submitReport(formData, onProgress) {
  // 1. Auth check
  const user = await getCurrentUser();
  const userId   = user ? user.uid   : "anonymous";
  const userName = user ? (user.displayName || user.email || "Anonymous") : "Anonymous";

  // 2. Upload image
  let imageUrl  = null;
  let imagePath = null;
  if (formData.imageFile) {
    onProgress && onProgress({ step: "upload", pct: 0 });
    const { url, path } = await uploadReportImage(
      formData.imageFile,
      userId,
      (pct) => onProgress && onProgress({ step: "upload", pct })
    );
    imageUrl  = url;
    imagePath = path;
  }
  onProgress && onProgress({ step: "validate", pct: 0 });

  // 3. Server-side validation (Cloud Function)
  const cfPayload = {
    userId,
    imageUrl,
    userLocation:      formData.userLocation,
    // Pass the client result as a hint / fallback
    clientValidationStatus: formData.clientValidationStatus
  };
  const validation = await callValidateReport(cfPayload);

  onProgress && onProgress({ step: "save", pct: 0 });

  // 4. Build & save Firestore document
  const reportDoc = {
    // Identity
    userId,
    userName,
    // Report content
    title:       formData.title,
    description: formData.description,
    category:    formData.category,
    priority:    formData.priority,
    // Image
    imageUrl,
    imagePath,
    // Locations
    userLocation: formData.userLocation
      ? { lat: formData.userLocation.latitude, lng: formData.userLocation.longitude }
      : null,
    // Validation
    validationStatus: validation.validationStatus,
    validationReason: validation.reason     ?? null,
    // Status
    status:    "pending",
    votes:     0,
    verified:  validation.validationStatus === "valid"
  };

  const reportId = await saveReportToFirestore(reportDoc);
  onProgress && onProgress({ step: "done", pct: 100 });

  return {
    reportId,
    validationStatus: validation.validationStatus,
    imageUrl
  };
}

// Export for use in report.html
window.FirebaseReport = { submitReport };
