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

// Custom marker icons
function createMarkerIcon(status, verified) {
  const color = statusColors[status] || '#6B7280';
  const border = verified ? '#22C55E' : '#EF4444';
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 36px; height: 36px;
        background: white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 16px rgba(0,0,0,0.25);
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
function initMap(containerId, lat = 30.7046, lng = 76.7179, zoom = 12) {
  if (civicMap) { civicMap.remove(); civicMap = null; }

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
function addComplaintMarkers(complaints) {
  if (!civicMap) return;
  complaintMarkers.forEach(m => m.remove());
  complaintMarkers = [];

  const target = markerCluster || civicMap;

  complaints.forEach(complaint => {
    if (!complaint.location) return;
    const { lat, lng, address } = complaint.location;
    const marker = L.marker([lat, lng], {
      icon: createMarkerIcon(complaint.status, complaint.verified)
    });

    const statusLabel = complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1);
    const verifiedBadge = complaint.verified
      ? '<span style="background:rgba(34,197,94,0.15);color:#15803D;border:1px solid rgba(34,197,94,0.3);padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:700;">✓ Verified</span>'
      : '<span style="background:rgba(239,68,68,0.12);color:#B91C1C;border:1px solid rgba(239,68,68,0.25);padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:700;">⚠ Suspicious</span>';

    const statusStyle = {
      pending: 'background:rgba(245,158,11,0.12);color:#B45309;border:1px solid rgba(245,158,11,0.25)',
      resolved: 'background:rgba(34,197,94,0.12);color:#15803D;border:1px solid rgba(34,197,94,0.25)',
      delayed: 'background:rgba(239,68,68,0.12);color:#B91C1C;border:1px solid rgba(239,68,68,0.25)',
      processing: 'background:rgba(59,130,246,0.12);color:#1D4ED8;border:1px solid rgba(59,130,246,0.25)'
    };

    marker.bindPopup(`
      <div class="popup-card">
        <div style="background:linear-gradient(135deg,#1E3A8A,#4F46E5);height:8px;border-radius:8px 8px 0 0;margin:-16px -16px 16px;"></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <span style="font-size:0.72rem;color:#6B7280;font-weight:500;">${complaint.category.toUpperCase()}</span>
          ${verifiedBadge}
        </div>
        <div class="popup-title">${complaint.title}</div>
        <div class="popup-desc">${complaint.description}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;${statusStyle[complaint.status] || ''}">${statusLabel}</span>
          <span style="font-size:0.78rem;color:#6B7280;">👍 ${complaint.votes} votes</span>
        </div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,0.06);font-size:0.78rem;color:#6B7280;">
          📍 ${address || 'Location on map'} &nbsp;|&nbsp; 📅 ${complaint.date}
        </div>
      </div>
    `, { maxWidth: 300 });

    target.addLayer(marker);
    complaintMarkers.push(marker);
  });
}

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
