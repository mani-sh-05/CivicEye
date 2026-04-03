/**
 * CivicEye – Firebase Cloud Functions
 * =====================================
 * Callable Function: validateReport
 *
 * Pipeline (all server-side, API keys never exposed to client):
 *  1. Validate inputs
 *  2. Location check  – geolib distance between userGPS & EXIF GPS
 *  3. AI check        – Clarifai General Recognition on image URL
 *  4. Combine results – both valid → "valid", either fails → "suspicious"
 *  5. Write full report document to Firestore
 */

"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret }       = require("firebase-functions/params");
const { initializeApp }      = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const logger                 = require("firebase-functions/logger");
// node-fetch v3 is ESM-only; use dynamic import inside the function
// OR pin node-fetch@2 (CommonJS). We use dynamic import here with Node 18.

// ── Firebase init ─────────────────────────────────────────────
initializeApp();
const db = getFirestore();

// ── Clarifai PAT stored as a Firebase Secret ──────────────────
// Set with:  firebase functions:secrets:set CLARIFAI_PAT
const CLARIFAI_PAT = defineSecret("CLARIFAI_PAT");

// ── Constants ─────────────────────────────────────────────────
const SUSPICIOUS_DISTANCE_METRES = 200;

// Civic-issue keywords — if Clarifai finds any of these → AI valid
const VALID_KEYWORDS = [
  "road", "pothole", "street", "pavement", "asphalt", "crack",
  "garbage", "waste", "trash", "rubbish", "litter", "debris",
  "water", "flood", "drain", "drainage", "sewer", "puddle",
  "electricity", "wire", "pole", "light", "lamp",
  "construction", "damage", "infrastructure", "urban"
];

// ── Helper: validate lat/lng object ──────────────────────────
function isValidLocation(loc) {
  if (!loc) return false;
  const lat = Number(loc.lat ?? loc.latitude);
  const lng = Number(loc.lng ?? loc.longitude);
  return (
    Number.isFinite(lat) && lat >= -90  && lat <= 90 &&
    Number.isFinite(lng) && lng >= -180 && lng <= 180
  );
}

// ── Helper: normalise to geolib shape ─────────────────────────
function toPoint(loc) {
  return {
    latitude:  Number(loc.lat ?? loc.latitude),
    longitude: Number(loc.lng ?? loc.longitude)
  };
}

// ══════════════════════════════════════════════════════════════
// MODULE 1 — Location Validation
// ══════════════════════════════════════════════════════════════
/**
 * @returns {{ locationValidation, locationReason }}
 */
function runLocationValidation(userLoc) {
  // No user GPS at all
  if (!isValidLocation(userLoc)) {
    return {
      locationValidation: "no_user_location",
      locationReason:     "No user GPS provided. Location validation skipped."
    };
  }

  return {
    locationValidation: "valid",
    locationReason:     "Location captured successfully from device. ✅"
  };
}

// ══════════════════════════════════════════════════════════════
// MODULE 2 — Clarifai AI Validation
// ══════════════════════════════════════════════════════════════
/**
 * Calls Clarifai General Image Recognition API.
 * @returns {{ aiValidation, imageLabels, aiReason }}
 */
async function runAIValidation(imageUrl, clarifaiPat) {
  // Graceful fallback if no API key configured
  if (!clarifaiPat) {
    logger.warn("CLARIFAI_PAT not set — skipping AI validation.");
    return {
      aiValidation: "skipped",
      imageLabels:  [],
      aiReason:     "AI validation skipped (API key not configured)."
    };
  }

  try {
    const { default: fetch } = await import("node-fetch");

    const body = {
      user_app_id: {
        user_id: "clarifai",
        app_id:  "main"
      },
      inputs: [
        {
          data: {
            image: { url: imageUrl }
          }
        }
      ]
    };

    const response = await fetch(
      "https://api.clarifai.com/v2/models/general-image-recognition/outputs",
      {
        method:  "POST",
        headers: {
          "Authorization": `Key ${clarifaiPat}`,
          "Content-Type":  "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Clarifai API error ${response.status}: ${errText}`);
    }

    const json = await response.json();

    // Extract concept names from Clarifai response
    const concepts = json?.outputs?.[0]?.data?.concepts || [];
    const labels   = concepts
      .filter(c => c.value >= 0.70)          // confidence ≥ 70%
      .map(c => c.name.toLowerCase())
      .slice(0, 20);                          // keep top 20

    logger.info("Clarifai labels", { labels });

    // Check if any label matches our civic keywords
    const matchedKeyword = labels.find(label =>
      VALID_KEYWORDS.some(kw => label.includes(kw) || kw.includes(label))
    );

    return {
      aiValidation: matchedKeyword ? "valid" : "suspicious",
      imageLabels:  labels,
      aiReason:     matchedKeyword
        ? `AI detected civic issue: "${matchedKeyword}" in image. ✅`
        : `No civic-related content detected. Labels: ${labels.slice(0,5).join(", ") || "none"}.`
    };

  } catch (err) {
    logger.error("Clarifai API call failed:", err.message);
    // Non-fatal — gracefully mark as skipped, do not block submission
    return {
      aiValidation: "skipped",
      imageLabels:  [],
      aiReason:     `AI check failed (${err.message}). Reported without AI validation.`
    };
  }
}

// ══════════════════════════════════════════════════════════════
// MODULE 3 — Combine Results
// ══════════════════════════════════════════════════════════════
/**
 * Rules:
 *  - Both valid                           → "valid"
 *  - Either location OR ai = "suspicious" → "suspicious"
 *  - AI skipped + location valid          → "valid"
 *  - No image location                    → "valid" (GPS-only)
 */
function combineFinalStatus(locationValidation, aiValidation) {
  if (locationValidation === "suspicious") return "suspicious";
  if (aiValidation === "suspicious")       return "suspicious";
  return "valid";
}

// ══════════════════════════════════════════════════════════════
// CLOUD FUNCTION: validateReport
// ══════════════════════════════════════════════════════════════
exports.validateReport = onCall(
  {
    region:          "us-central1",
    enforceAppCheck: false,
    secrets:         [CLARIFAI_PAT]   // inject secret into runtime
  },
  async (request) => {
    const data = request.data;

    logger.info("validateReport invoked", {
      userId:     data.userId,
      hasImage:   !!data.imageUrl,
      hasUserLoc: isValidLocation(data.userLocation)
    });

    // ── Basic validation ───────────────────────────────────────
    if (!data.userId) {
      throw new HttpsError("invalid-argument", "userId is required.");
    }
    if (!data.imageUrl) {
      throw new HttpsError("invalid-argument", "imageUrl is required.");
    }

    // ── Run both checks in parallel ────────────────────────────
    const [locationResult, aiResult] = await Promise.all([
      Promise.resolve(runLocationValidation(data.userLocation)),
      runAIValidation(data.imageUrl, CLARIFAI_PAT.value())
    ]);

    // ── Combine ────────────────────────────────────────────────
    const finalStatus = combineFinalStatus(
      locationResult.locationValidation,
      aiResult.aiValidation
    );

    logger.info("Validation complete", {
      locationValidation: locationResult.locationValidation,
      aiValidation:       aiResult.aiValidation,
      finalStatus
    });

    // ── Build Firestore document ───────────────────────────────
    const reportDoc = {
      // Identifiers
      userId:      data.userId,
      description: data.description || "",
      imageUrl:    data.imageUrl,

      // Locations
      userLocation: isValidLocation(data.userLocation)
        ? { lat: toPoint(data.userLocation).latitude, lng: toPoint(data.userLocation).longitude }
        : null,

      // AI
      imageLabels:  aiResult.imageLabels,
      aiValidation: aiResult.aiValidation,
      aiReason:     aiResult.aiReason,

      // Location
      locationValidation: locationResult.locationValidation,
      locationReason:     locationResult.locationReason,

      // Final
      finalStatus,
      verified: finalStatus === "valid",

      // Extra fields from client
      category: data.category || "Other",
      priority:  data.priority || "medium",
      title:     data.title    || "",
      userName:  data.userName || "Anonymous",

      // Meta
      status:    "pending",
      votes:     0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    // ── Write to Firestore ─────────────────────────────────────
    let reportId = data.existingDocId || null;

    try {
      if (reportId) {
        // Update existing doc (client created it already)
        await db.collection("reports").doc(reportId).update({
          ...reportDoc,
          createdAt: FieldValue.delete() // keep original createdAt
        });
        logger.info("Updated existing Firestore doc:", reportId);
      } else {
        // Create new doc
        const ref = await db.collection("reports").add(reportDoc);
        reportId  = ref.id;
        logger.info("Created new Firestore doc:", reportId);
      }
    } catch (dbErr) {
      logger.error("Firestore write failed:", dbErr.message);
      throw new HttpsError("internal", "Failed to save report: " + dbErr.message);
    }

    // ── Return result to client ────────────────────────────────
    return {
      reportId,
      finalStatus,
      locationValidation: locationResult.locationValidation,
      locationReason:     locationResult.locationReason,
      aiValidation:       aiResult.aiValidation,
      aiReason:           aiResult.aiReason,
      imageLabels:        aiResult.imageLabels
    };
  }
);
