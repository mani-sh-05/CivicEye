// ================================================================
// CivicEye – Client-side Verification Engine
// ================================================================
// Responsibilities:
//  1. Capture live GPS from browser
//  2. Extract EXIF GPS + timestamp from image file (via exifr)
//  3. Calculate Haversine distance (no external dependency)
//  4. Run location validation (client-side preview before Cloud Fn)
// ================================================================

"use strict";

// ── Haversine distance (metres) ──────────────────────────────
const GeoHelper = {
  /**
   * Returns distance in metres between two { latitude, longitude } points.
   * Matches geolib output closely enough for client-side preview.
   */
  getDistance(pointA, pointB) {
    const R    = 6371000; // Earth radius (metres)
    const toR  = d => (d * Math.PI) / 180;
    const dLat = toR(pointB.latitude  - pointA.latitude);
    const dLon = toR(pointB.longitude - pointA.longitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toR(pointA.latitude)) *
      Math.cos(toR(pointB.latitude)) *
      Math.sin(dLon / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }
};

// ── Constants ─────────────────────────────────────────────────
const SUSPICIOUS_DISTANCE_METRES = 200;

// ── 1. Capture user GPS ───────────────────────────────────────
/**
 * Returns Promise<{ latitude, longitude, accuracy }>
 * Rejects with a user-friendly Error message.
 */
function captureUserGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        latitude:  pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy:  pos.coords.accuracy
      }),
      err => {
        const msg = {
          1: "Location access denied. Please allow GPS in browser settings.",
          2: "GPS position unavailable. Check your device GPS.",
          3: "GPS request timed out. Please retry."
        };
        reject(new Error(msg[err.code] || err.message));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}


// ── 2. Location Validation (client-side preview) ──────────────
/**
 * Mirrors the server-side logic so the UI can show an instant result.
 *
 * @param {{ latitude, longitude }|null} userLocation
 * @returns {{
 *   locationValidation: "valid"|"no_user_location",
 *   locationReason: string
 * }}
 */
function validateLocations(userLocation) {
  if (!userLocation) {
    return {
      locationValidation: "no_user_location",
      locationReason:     "No user GPS captured. Location verification skipped."
    };
  }
  return {
    locationValidation: "valid",
    locationReason: `Location captured successfully from device. ✅`
  };
}

// ── 4. Client-side AI label check (keyword scan only) ────────
/**
 * When Cloud Function is unavailable (emulator / free tier),
 * this is NEVER called — AI check always runs server-side.
 * Exposed for unit-test / debug purposes only.
 */
const AI_KEYWORDS = [
  "road","pothole","street","pavement","asphalt","crack",
  "garbage","waste","trash","rubbish","litter","debris",
  "water","flood","drain","drainage","sewer","puddle",
  "electricity","wire","pole","light","lamp",
  "construction","damage","infrastructure","urban"
];

function checkLabelsLocally(labels = []) {
  const hit = labels.find(l =>
    AI_KEYWORDS.some(kw => l.includes(kw) || kw.includes(l))
  );
  return {
    aiValidation: hit ? "valid" : "suspicious",
    matchedKeyword: hit || null
  };
}

// ── 5. Combined final status (mirrors Cloud Function logic) ───
/**
 * Both valid → "valid". Either suspicious → "suspicious".
 * AI "skipped" or location "no_image_location" don't penalise.
 */
function combineFinalStatus(locationValidation, aiValidation) {
  if (locationValidation === "suspicious") return "suspicious";
  if (aiValidation       === "suspicious") return "suspicious";
  return "valid";
}

// ── Public API ────────────────────────────────────────────────
window.VerificationEngine = {
  captureUserGPS,
  validateLocations,
  combineFinalStatus,
  checkLabelsLocally,
  GeoHelper,
  SUSPICIOUS_DISTANCE_METRES,
  AI_KEYWORDS
};
