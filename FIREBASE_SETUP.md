# CivicEye — Firebase + Clarifai Verification System
## Complete Setup & Deployment Guide

---

## 📁 Final Project Structure

```
CivicEye/
├── report.html                  ← Main report form (GPS + EXIF + AI UI)
├── firebase.json                ← Firebase hosting/functions/emulator config
├── firestore.rules              ← Firestore security rules
├── storage.rules                ← Firebase Storage security rules
├── firestore.indexes.json       ← Composite index definitions
├── .firebaserc                  ← Links project to Firebase project ID
├── FIREBASE_SETUP.md            ← This file
│
├── js/
│   ├── verification.js          ← GPS · EXIF · Haversine · client validation
│   ├── firebase-config.js       ← Firebase ESM init (optional, see report.html)
│   ├── firebase-report.js       ← Storage upload helper module
│   └── app.js                   ← Shared UI utilities (Toast, DarkMode, etc.)
│
└── functions/
    ├── index.js                 ← Cloud Function: validateReport
    │                               └─ geolib distance check
    │                               └─ Clarifai AI recognition
    │                               └─ Firestore write
    └── package.json             ← Dependencies: geolib, node-fetch
```

---

## ✅ Step 1 — Create Firebase Project

1. Go to **https://console.firebase.google.com**
2. **Add Project** → name it `civiceye-app` → Create

Enable these services:

| Service | Steps |
|---|---|
| **Firestore** | Build → Firestore → Create → Production mode → `asia-south1` |
| **Storage** | Build → Storage → Get started → Production mode → same region |
| **Authentication** | Build → Authentication → Email/Password → Enable |
| **Functions** | Automatically enabled (requires Blaze plan) |
| **Hosting** | Optional — for production deployment |

---

## ✅ Step 2 — Get Clarifai API Key (Free Tier)

1. Go to **https://clarifai.com** → Sign up (free)
2. Go to **Security** → **Personal Access Tokens**
3. Click **Create New Token** → name it `civiceye`
4. Copy the **PAT** (looks like `abc123...`)

The Clarifai API used is:
```
POST https://api.clarifai.com/v2/models/general-image-recognition/outputs
Authorization: Key YOUR_PAT
```

---

## ✅ Step 3 — Store Clarifai Key as Firebase Secret

This keeps the API key **off the client** — it only lives in the Cloud Function runtime:

```powershell
# In terminal (inside CivicEye folder)
firebase functions:secrets:set CLARIFAI_PAT
# Paste your PAT when prompted, press Enter
```

Verify it was saved:
```powershell
firebase functions:secrets:access CLARIFAI_PAT
```

---

## ✅ Step 4 — Get Firebase Web Config

Project Settings ⚙️ → Your Apps → Web App `</>` → Register → copy config:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "civiceye-app.firebaseapp.com",
  projectId:         "civiceye-app",
  storageBucket:     "civiceye-app.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123:web:abc123"
};
```

---

## ✅ Step 5 — Paste Config Into Project

### `report.html` — find this block (around line 370):
```js
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",        // ← replace
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
```

### `.firebaserc`:
```json
{ "projects": { "default": "civiceye-app" } }
```

---

## ✅ Step 6 — Install Dependencies

```powershell
# 1. Install Firebase CLI globally (once)
npm install -g firebase-tools

# 2. Login
firebase login

# 3. Install Cloud Function packages
cd functions
npm install
cd ..
```

---

## ✅ Step 7 — Deploy Security Rules

```powershell
firebase deploy --only firestore:rules,storage
```

---

## ✅ Step 8 — Deploy Cloud Function

```powershell
firebase deploy --only functions
```

> **Important:** Cloud Functions require the **Blaze (pay-as-you-go)** plan.
> The free tier gives you 2M invocations/month — more than enough for a hackathon.
> The app **gracefully falls back** to client-side validation if the function is not deployed.

---

## ✅ Step 9 — Test with Local Emulator

```powershell
firebase emulators:start
```

| Service | URL |
|---|---|
| 🌐 App | http://localhost:5000/report.html |
| 🖥️ Dashboard | http://localhost:4000 |
| 🗄️ Firestore | http://localhost:8080 |
| ☁️ Functions | http://localhost:5001 |
| 📦 Storage | http://localhost:9199 |

---

## 🧠 Complete Verification Pipeline

```
User submits report
        │
        ▼
[1] 📡 Browser GPS (navigator.geolocation)
    └─ Captures: { latitude, longitude, accuracy }
    └─ Pins 📍 on Leaflet map
        │
        ▼
[2] 📷 EXIF Extraction (exifr library)
    └─ Reads: GPSLatitude, GPSLongitude, DateTimeOriginal
    └─ If found: pins 🖼️ on map (second marker)
    └─ If missing: fallback to GPS-only validation
        │
        ▼
[3] ☁️ Firebase Storage Upload
    └─ Path: reports/{userId}/{timestamp}_{random}.jpg
    └─ Returns: downloadable image URL
        │
        ▼
[4] 🔥 Firebase Cloud Function: validateReport()
    │
    ├─ [A] 📏 Location Validation (geolib)
    │       └─ Calculate Haversine distance: userGPS ↔ EXIF GPS
    │       └─ > 200 m → locationValidation = "suspicious"
    │       └─ ≤ 200 m → locationValidation = "valid"
    │       └─ No EXIF → locationValidation = "no_image_location" (valid)
    │
    └─ [B] 🤖 Clarifai AI Recognition (REST API)
            └─ Sends image URL to general-image-recognition model
            └─ Extracts top labels (confidence ≥ 70%)
            └─ Matches against civic keywords:
               ["road","pothole","garbage","waste","street",
                "drain","light","water","flood","construction"]
            └─ Match found → aiValidation = "valid"
            └─ No match   → aiValidation = "suspicious"
        │
        ▼
[5] 🔗 Combine Results
    ├─ Both valid               → finalStatus = "valid"      ✅
    ├─ Location suspicious      → finalStatus = "suspicious"  ⚠️
    ├─ AI suspicious            → finalStatus = "suspicious"  ⚠️
    └─ AI skipped + loc valid   → finalStatus = "valid"      ✅
        │
        ▼
[6] 💾 Firestore Write: reports collection
    └─ Full document stored (see schema below)
        │
        ▼
[7] 📱 Frontend Feedback
    └─ Shows location + AI results with chips
    └─ Toast: "Report Verified ✅" OR "Flagged for Review ⚠️"
    └─ Redirects to tracker.html
```

---

## 🗄️ Firestore Document Schema

**Collection:** `reports`

```json
{
  "userId":             "uid_abc123",
  "userName":           "Rajesh Kumar",
  "title":              "Large pothole on Main Street",
  "description":        "Deep pothole near school causing tyre damage...",
  "category":           "Road",
  "priority":           "high",
  "imageUrl":           "https://firebasestorage.googleapis.com/v0/b/...",
  "imagePath":          "reports/uid_abc123/1712345678_xyz.jpg",

  "userLocation":       { "lat": 30.70460, "lng": 76.71790 },
  "imageLocation":      { "lat": 30.70490, "lng": 76.71810 },
  "imageTimestamp":     "2026-04-03T10:30:00.000Z",
  "distance":           34,

  "imageLabels":        ["road", "asphalt", "pavement", "crack", "urban"],
  "aiValidation":       "valid",
  "aiReason":           "AI detected civic issue: 'road' in image. ✅",

  "locationValidation": "valid",
  "locationReason":     "Image GPS matches user GPS within 34 m. ✅",

  "finalStatus":        "valid",
  "verified":           true,
  "status":             "pending",
  "votes":              0,
  "createdAt":          "ServerTimestamp",
  "updatedAt":          "ServerTimestamp"
}
```

---

## ⚙️ Configuration Reference

### Distance threshold (metres)
| File | Line | Variable |
|---|---|---|
| `js/verification.js` | 33 | `SUSPICIOUS_DISTANCE_METRES = 200` |
| `functions/index.js` | 25 | `SUSPICIOUS_DISTANCE_METRES = 200` |

### Clarifai AI keywords
`functions/index.js` lines 28-33:
```js
const VALID_KEYWORDS = [
  "road", "pothole", "street", "pavement", "asphalt", "crack",
  "garbage", "waste", "trash", "rubbish", "litter", "debris",
  "water", "flood", "drain", "drainage", "sewer", "puddle",
  "electricity", "wire", "pole", "light", "lamp",
  "construction", "damage", "infrastructure", "urban"
];
```

### AI confidence threshold
`functions/index.js` line 94:
```js
.filter(c => c.value >= 0.70)   // ← Change to 0.50 for more permissive matching
```

---

## 🔑 EXIF GPS Compatibility

| Source | EXIF GPS |
|---|---|
| Phone camera (location ON) | ✅ Embedded |
| DSLR with GPS module | ✅ Embedded |
| WhatsApp / Telegram forwarded | ❌ Stripped |
| Instagram download | ❌ Stripped |
| Screenshot | ❌ None |

> When EXIF GPS is absent → `locationValidation = "no_image_location"` → treated as **valid**.
> The AI check alone is sufficient in this case.

---

## 🚀 Deploy Everything

```powershell
firebase deploy
```

App URL: `https://YOUR_PROJECT_ID.web.app`

---

## 📦 Libraries Summary

| Library | Where | Purpose |
|---|---|---|
| `exifr` v7.1.3 | Browser (CDN) | Extract GPS from image EXIF |
| `geolib` v3.3.4 | Cloud Function (npm) | Haversine distance calculation |
| `node-fetch` v3.3.2 | Cloud Function (npm) | Call Clarifai REST API |
| `firebase-functions` v5 | Cloud Function | Callable function + Secrets |
| `firebase-admin` v12 | Cloud Function | Firestore write via Admin SDK |
| Firebase JS SDK v10.12 | Browser (CDN) | Auth · Firestore · Storage · Functions |
| Leaflet.js v1.9.4 | Browser (CDN) | Interactive map + dual GPS pins |

---

## 🔒 Security Model

| What | How |
|---|---|
| Clarifai PAT | Stored as **Firebase Secret** — never in client code |
| Image upload | Only authenticated users can write to their own path |
| Report creation | Only authenticated users; userId must match auth.uid |
| Report reads | All authenticated users (for community dashboard) |
| Deletes | Blocked client-side (admin SDK only) |
