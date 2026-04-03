// ===========================
// CivicEye – Map Module
// ===========================

let civicMap = null;
let markerCluster = null;
let userMarker = null;
let complaintMarkers = [];

// Status colors for markers
const statusColors = {
  pending: '#F59E0B',
  resolved: '#22C55E',
  delayed: '#EF4444',
  processing: '#3B82F6'
};

const severityColors = {
  high: '#B91C1C',
  medium: '#B45309',
  low: '#15803D'
};

// Custom marker icons based on Severity
function createMarkerIcon(severity, verified, boosted) {
  const color  = severityColors[severity] || '#6B7280';
  const border = verified ? '#22C55E' : '#EF4444';
  const ring   = boosted
    ? 'box-shadow:0 0 0 3px rgba(20,184,166,0.40),0 4px 16px rgba(0,0,0,0.25);'
    : 'box-shadow:0 4px 16px rgba(0,0,0,0.25);';
  const badge  = boosted
    ? `<div style="position:absolute;top:-6px;right:-6px;background:linear-gradient(135deg,#4F46E5,#14B8A6);color:white;font-size:9px;font-weight:900;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;border:1.5px solid white;z-index:2;">⚡</div>`
    : '';
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="position:relative;">
        ${badge}
        <div style="
          width: 36px; height: 36px;
          background: white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          ${ring}
          border: 3px solid ${border};
          display: flex; align-items: center; justify-content: center;
        ">
          <div style="
            width: 18px; height: 18px;
            background: ${color};
            border-radius: 50%;
            transform: rotate(45deg);
          "></div>
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38]
  });
}

// User location marker
function createUserIcon() {
  return L.divIcon({
    className: 'user-marker',
    html: `
      <div style="position:relative">
        <div style="
          width: 20px; height: 20px;
          background: #4F46E5;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 0 3px rgba(79,70,229,0.3);
        "></div>
        <div style="
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%,-50%);
          width: 50px; height: 50px;
          border-radius: 50%;
          border: 2px solid rgba(79,70,229,0.4);
          animation: mapPulse 2s infinite;
        "></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
}

// Initialize the map
function initMap(containerId, defaultLat = 30.7046, defaultLng = 76.7179, zoom = 12) {
  if (civicMap) { civicMap.remove(); civicMap = null; }

  const lat = localStorage.getItem('civiceye_lat') || defaultLat;
  const lng = localStorage.getItem('civiceye_lng') || defaultLng;

  civicMap = L.map(containerId, {
    zoomControl: false,
    scrollWheelZoom: true
  }).setView([lat, lng], zoom);

  // OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(civicMap);

  // Custom zoom controls
  L.control.zoom({ position: 'bottomright' }).addTo(civicMap);

  // Add scale
  L.control.scale({ position: 'bottomleft', imperial: false }).addTo(civicMap);

  // Initialize marker cluster if available
  if (typeof L.markerClusterGroup !== 'undefined') {
    markerCluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      iconCreateFunction: function(cluster) {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="
            width:44px; height:44px;
            background: linear-gradient(135deg, #1E3A8A, #4F46E5);
            border-radius: 50%;
            display:flex; align-items:center; justify-content:center;
            color:white; font-weight:800; font-size:0.85rem;
            box-shadow: 0 4px 16px rgba(79,70,229,0.4);
            border: 2px solid white;
          ">${count}</div>`,
          className: '',
          iconSize: [44, 44],
          iconAnchor: [22, 22]
        });
      }
    });
    civicMap.addLayer(markerCluster);
  }

  return civicMap;
}

// Add complaint markers to map
let heatLayer = null;
let isHeatmapActive = false;

function addComplaintMarkers(complaints) {
  if (!civicMap) return;
  complaintMarkers.forEach(m => m.remove());
  complaintMarkers = [];
  
  if (markerCluster) {
    markerCluster.clearLayers();
  }

  const heatPoints = [];
  const target = markerCluster || civicMap;

  complaints.forEach(complaint => {
    if (!complaint.location) return;
    const { lat, lng, address } = complaint.location;
    const marker = L.marker([lat, lng], {
      icon: createMarkerIcon(complaint.severity, complaint.verified, complaint.boosted)
    });

    const statusLabel = complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1);
    const verifiedBadge = complaint.verified
      ? '<span style="background:rgba(34,197,94,0.15);color:#15803D;border:1px solid rgba(34,197,94,0.3);padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:700;">✓ Verified</span>'
      : '<span style="background:rgba(239,68,68,0.12);color:#B91C1C;border:1px solid rgba(239,68,68,0.25);padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:700;">⚠ Suspicious</span>';

    const severityLabel = complaint.severity.charAt(0).toUpperCase() + complaint.severity.slice(1);

    const boostedBadge = complaint.boosted
      ? '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:20px;font-size:0.66rem;font-weight:800;background:linear-gradient(135deg,#4F46E5,#14B8A6);color:white;margin-left:6px;">⚡ Priority</span>'
      : '';

    marker.bindPopup(`
      <div class="popup-card">
        <div style="background:linear-gradient(135deg,#1E3A8A,#4F46E5);height:8px;border-radius:8px 8px 0 0;margin:-16px -16px 16px;"></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:0.72rem;color:#6B7280;font-weight:500;">${complaint.category.toUpperCase()}</span>
          <div style="display:flex;gap:4px;align-items:center;">${verifiedBadge}${boostedBadge}</div>
        </div>
        <div class="popup-title">${complaint.title}</div>
        <div class="popup-desc">${complaint.description}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <span style="padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;color:${severityColors[complaint.severity]}">&#9679; ${severityLabel}</span>
          <span style="font-size:0.78rem;color:#6B7280;">👍 ${complaint.votes} votes</span>
        </div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,0.06);font-size:0.78rem;color:#6B7280;">
          Status: <strong>${statusLabel}</strong>
        </div>
        ${!complaint.boosted ? `
        <button class="map-boost-btn" onclick="handleMapBoost('${complaint.id}')">
          ⚡ Prioritize for ₹20
        </button>` : ''}
      </div>
    `, { maxWidth: 300 });

    target.addLayer(marker);
    complaintMarkers.push(marker);

    // Prepare heatmap data
    const intensity = complaint.severity === 'high' ? 1.0 : complaint.severity === 'medium' ? 0.6 : 0.3;
    heatPoints.push([lat, lng, intensity]);
  });

  // Handle Heatmap
  if (typeof L.heatLayer !== 'undefined') {
    if (heatLayer) {
      civicMap.removeLayer(heatLayer);
    }
    heatLayer = L.heatLayer(heatPoints, { radius: 25, blur: 15, maxZoom: 14 });
    if (isHeatmapActive) {
      civicMap.addLayer(heatLayer);
      if (markerCluster) civicMap.removeLayer(markerCluster);
    }
  }
}

window.toggleHeatLayer = function() {
  isHeatmapActive = !isHeatmapActive;
  if (!civicMap || !heatLayer) return;
  
  if (isHeatmapActive) {
    civicMap.addLayer(heatLayer);
    if (markerCluster) civicMap.removeLayer(markerCluster);
    if (typeof Toast !== 'undefined') Toast.info('Heatmap Enabled', 'Showing severity density');
  } else {
    civicMap.removeLayer(heatLayer);
    if (markerCluster) civicMap.addLayer(markerCluster);
    if (typeof Toast !== 'undefined') Toast.info('Heatmap Disabled', 'Showing individual markers');
  }
};

// Get user location
function getUserLocation(callback) {
  if (!navigator.geolocation) {
    callback(null, 'Geolocation not supported');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      callback({ lat, lng });
      if (civicMap) {
        if (userMarker) userMarker.remove();
        userMarker = L.marker([lat, lng], { icon: createUserIcon() })
          .addTo(civicMap)
          .bindPopup('<b>📍 Your Location</b>')
          .openPopup();
        civicMap.setView([lat, lng], 14);
      }
    },
    (err) => callback(null, err.message),
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// Allow clicking to select location on map
function enableLocationPicker(onSelect) {
  if (!civicMap) return;
  civicMap.on('click', (e) => {
    const { lat, lng } = e.latlng;
    if (userMarker) userMarker.remove();
    userMarker = L.marker([lat, lng], { icon: createUserIcon() })
      .addTo(civicMap)
      .bindPopup('<b>📍 Selected Location</b>')
      .openPopup();
    if (typeof onSelect === 'function') {
      onSelect({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
    }
  });
  civicMap.getContainer().style.cursor = 'crosshair';
}

// ======================================
// LIVE MAP - FIREBASE INTEGRATION
// ======================================
window.liveIssues = [];
window.initLiveMap = function() {
  if (typeof firebase === 'undefined') {
    console.error("Firebase not loaded on map.html");
    return;
  }
  const db = firebase.firestore();

  // Listen to 'reports' collection in real-time
  db.collection("reports").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
    const issues = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (!data.userLocation && !data.imageLocation) return; // Skip if no location

      const loc = data.userLocation || data.imageLocation;

      // Auto-calculate severity from votes if not directly set
      let severity = data.severity || data.priority || 'low';
      if (!data.severity && data.votes !== undefined) {
        if (data.votes > 10) severity = 'high';
        else if (data.votes > 5) severity = 'medium';
      }

      issues.push({
        id: doc.id,
        title: data.title || 'Untitled Issue',
        description: data.description || 'No description provided.',
        category: data.category || 'Other',
        status: data.status || 'pending',
        severity: severity,
        verified: data.verified || false,
        boosted: data.boosted || false,
        votes: data.votes || 0,
        date: data.createdAt ? new Date(data.createdAt.toMillis()).toLocaleDateString() : new Date().toLocaleDateString(),
        location: { lat: loc.lat, lng: loc.lng, address: 'Live reported location' }
      });
    });

    window.liveIssues = issues;
    
    // Refresh map 
    if (typeof addComplaintMarkers === 'function') addComplaintMarkers(window.liveIssues);
    
    // Refresh sidebar if it's currently showing
    if (typeof renderSidebarList === 'function') {
      const activeFilterChip = document.querySelector('.filter-chip.active');
      let currentFilter = activeFilterChip ? activeFilterChip.dataset.filter : 'all';
      if (typeof window.filterMarkersInfo === 'function') {
        window.filterMarkersInfo(currentFilter);
      } else {
        renderSidebarList(window.liveIssues);
      }
    }
  }, (err) => {
    console.error("Error fetching live issues:", err);
  });
};

// ══════════════════════════════════════════════════════════════
// BOOST FROM MAP POPUP
// ══════════════════════════════════════════════════════════════
window.handleMapBoost = function(reportId) {
  if (typeof Toast !== 'undefined') {
    Toast.info('⚡ Processing Boost…', 'Simulating ₹20 payment for demo.');
  }
  // In production: open Razorpay/UPI modal here
  // For demo: update Firestore boosted flag after 1.5s
  setTimeout(async () => {
    try {
      if (typeof firebase !== 'undefined') {
        await firebase.firestore().collection('reports').doc(reportId).update({ boosted: true });
      }
      if (typeof Toast !== 'undefined') {
        Toast.success('⚡ Priority Boost Activated!',
          'This issue is now highlighted in the admin dashboard.');
      }
    } catch(e) {
      console.warn('Could not update boost flag:', e.message);
      if (typeof Toast !== 'undefined') {
        Toast.success('⚡ Priority Boost Activated! (Demo)', 'Issue flagged as high priority.');
      }
    }
  }, 1500);
};
