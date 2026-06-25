// ============================================================
//  WOMEN SAFETY SYSTEM — Map Logic (Leaflet + Overpass API)
//  map.js
// ============================================================

let map, userMarker, userLocation;
const layerGroups = { police: null, hospital: null, safe: null };
const filterState  = { police: true, hospital: true, safe: true };
const poiData      = { police: [], hospital: [], safe: [] };

// ---- Custom Marker Icons ----
const createIcon = (color, faClass) => L.divIcon({
  html: `<div style="
    width:36px;height:36px;border-radius:50% 50% 50% 0;
    background:${color};transform:rotate(-45deg);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 4px 12px rgba(0,0,0,0.4);
    border:2px solid rgba(255,255,255,0.3);">
    <i class="${faClass}" style="transform:rotate(45deg);color:#fff;font-size:0.75rem;"></i>
  </div>`,
  className: '',
  iconSize:   [36, 36],
  iconAnchor: [18, 36],
  popupAnchor:[0, -36],
});

const ICONS = {
  police:   createIcon('#3b82f6', 'fa-solid fa-shield'),
  hospital: createIcon('#ef4444', 'fa-solid fa-hospital'),
  safe:     createIcon('#22c55e', 'fa-solid fa-house-chimney-medical'),
  user:     L.divIcon({
    html: `<div style="
      width:20px;height:20px;border-radius:50%;
      background:#a855f7;border:3px solid #fff;
      box-shadow:0 0 0 6px rgba(168,85,247,0.3),0 4px 12px rgba(0,0,0,0.4);">
    </div>`,
    className: '',
    iconSize:   [20, 20],
    iconAnchor: [10, 10],
  }),
};

// ============================================================
//  INIT MAP
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Leaflet map with dark tile layer
  map = L.map('main-map', {
    zoomControl: true,
    attributionControl: true,
  }).setView([20.5937, 78.9629], 5); // India center as default

  // Dark tile layer (CartoDB Dark Matter)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  // Layer groups for each POI type
  layerGroups.police   = L.layerGroup().addTo(map);
  layerGroups.hospital = L.layerGroup().addTo(map);
  layerGroups.safe     = L.layerGroup().addTo(map);

  // Get user location
  locateMe();

  // Search on Enter key
  const searchInput = document.getElementById('dest-search');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') searchDestination();
    });
  }
});

// ============================================================
//  LOCATE ME — Get user GPS position
// ============================================================
window.locateMe = function() {
  if (!navigator.geolocation) {
    WS.showToast('error', 'Not Supported', 'Geolocation is not supported by your browser.');
    hideLoader();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };

      // Place user marker
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: ICONS.user })
        .addTo(map)
        .bindPopup('<strong>📍 You are here</strong>');

      map.setView([userLocation.lat, userLocation.lng], 14);

      // Update sidebar coords
      const coordsEl = document.getElementById('my-coords');
      if (coordsEl) coordsEl.textContent = `Lat: ${userLocation.lat.toFixed(5)}, Lng: ${userLocation.lng.toFixed(5)}`;

      // Reverse geocode
      try {
        const addr = await reverseGeocode(userLocation.lat, userLocation.lng);
        const addrEl = document.getElementById('my-address');
        if (addrEl) addrEl.textContent = addr;
      } catch {}

      // Fetch nearby POIs
      await Promise.all([
        fetchPOIs('police',   userLocation.lat, userLocation.lng),
        fetchPOIs('hospital', userLocation.lat, userLocation.lng),
        fetchPOIs('safe',     userLocation.lat, userLocation.lng),
      ]);

      hideLoader();
      renderPOIList();
      WS.showToast('success', 'Location Found', 'Map centered to your current location.', 3000);
    },
    (err) => {
      hideLoader();
      const msgs = {
        1: 'Location permission denied. Showing default map.',
        2: 'Location unavailable.',
        3: 'Location request timed out.',
      };
      WS.showToast('warning', 'Location Error', msgs[err.code] || 'Could not get location.', 5000);
      // Load demo data for New Delhi
      userLocation = { lat: 28.6139, lng: 77.2090 };
      map.setView([userLocation.lat, userLocation.lng], 13);
      Promise.all([
        fetchPOIs('police',   userLocation.lat, userLocation.lng),
        fetchPOIs('hospital', userLocation.lat, userLocation.lng),
        fetchPOIs('safe',     userLocation.lat, userLocation.lng),
      ]).then(() => { renderPOIList(); });
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
  );
};

// ============================================================
//  FETCH POIs via Overpass API
// ============================================================
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const OVERPASS_QUERIES = {
  police: (lat, lng, r) =>
    `[out:json][timeout:15];(node["amenity"="police"](around:${r},${lat},${lng});way["amenity"="police"](around:${r},${lat},${lng}););out center 20;`,
  hospital: (lat, lng, r) =>
    `[out:json][timeout:15];(node["amenity"~"hospital|clinic|health_centre"](around:${r},${lat},${lng});way["amenity"~"hospital|clinic|health_centre"](around:${r},${lat},${lng}););out center 20;`,
  safe: (lat, lng, r) =>
    `[out:json][timeout:15];(node["amenity"~"community_centre|social_centre|library"](around:${r},${lat},${lng});way["amenity"~"community_centre|social_centre|library"](around:${r},${lat},${lng}););out center 15;`,
};

async function fetchPOIs(type, lat, lng, radius = 3000) {
  try {
    const query = OVERPASS_QUERIES[type](lat, lng, radius);
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      body:   `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const data = await res.json();

    layerGroups[type].clearLayers();
    poiData[type] = [];

    data.elements.forEach(el => {
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (!elLat || !elLng) return;

      const name = el.tags?.name || (type === 'police' ? 'Police Station' : type === 'hospital' ? 'Hospital/Clinic' : 'Safe Zone');
      const dist = calcDistance(lat, lng, elLat, elLng);

      poiData[type].push({ name, lat: elLat, lng: elLng, dist, type });

      const marker = L.marker([elLat, elLng], { icon: ICONS[type] })
        .bindPopup(`
          <div style="font-family:'Inter',sans-serif;min-width:160px;">
            <strong style="font-size:0.9rem;">${name}</strong><br>
            <span style="font-size:0.78rem;color:#888;">${type.charAt(0).toUpperCase()+type.slice(1)}</span><br>
            <span style="font-size:0.8rem;margin-top:4px;display:block;color:#aaa;">~${formatDist(dist)} away</span>
            <a href="https://maps.google.com/?q=${elLat},${elLng}" target="_blank"
               style="font-size:0.78rem;color:#a78bfa;margin-top:6px;display:inline-block;">
               Open in Google Maps ↗
            </a>
          </div>
        `);

      layerGroups[type].addLayer(marker);
    });

    // Sort by distance
    poiData[type].sort((a, b) => a.dist - b.dist);

    // Update count badge
    const countEl = document.getElementById(`count-${type}`);
    if (countEl) countEl.textContent = poiData[type].length;

  } catch (err) {
    console.warn(`[Map] Failed to fetch ${type} POIs:`, err.message);
  }
}

// ============================================================
//  TOGGLE LAYER FILTER
// ============================================================
window.toggleFilter = function(type) {
  filterState[type] = !filterState[type];
  const btn = document.getElementById(`filter-${type}`);
  if (btn) btn.classList.toggle('active', filterState[type]);

  if (filterState[type]) {
    map.addLayer(layerGroups[type]);
  } else {
    map.removeLayer(layerGroups[type]);
  }
};

// ============================================================
//  RENDER POI LIST IN SIDEBAR
// ============================================================
function renderPOIList() {
  const listEl = document.getElementById('poi-list');
  if (!listEl) return;

  const all = [
    ...poiData.police.slice(0,3).map(p => ({...p, type:'police'})),
    ...poiData.hospital.slice(0,3).map(p => ({...p, type:'hospital'})),
    ...poiData.safe.slice(0,2).map(p => ({...p, type:'safe'})),
  ].sort((a,b) => a.dist - b.dist).slice(0, 10);

  if (!all.length) {
    listEl.innerHTML = '<div style="text-align:center;padding:1.5rem;color:hsl(240,10%,50%);font-size:0.85rem;">No nearby places found. Try expanding the search radius.</div>';
    return;
  }

  const icons = { police: 'fa-shield', hospital: 'fa-hospital', safe: 'fa-house-chimney-medical' };
  const classes = { police: 'poi-police', hospital: 'poi-hospital', safe: 'poi-safe' };

  listEl.innerHTML = all.map(p => `
    <div class="poi-item" onclick="flyToMarker(${p.lat},${p.lng},'${p.name}')" title="${p.name}">
      <div class="poi-icon ${classes[p.type]}"><i class="fa-solid ${icons[p.type]}"></i></div>
      <div>
        <div class="poi-name">${p.name}</div>
        <div class="poi-dist">${formatDist(p.dist)} away · ${p.type.charAt(0).toUpperCase()+p.type.slice(1)}</div>
      </div>
    </div>
  `).join('');
}

// ============================================================
//  FLY TO MARKER (sidebar click)
// ============================================================
window.flyToMarker = function(lat, lng, name) {
  map.flyTo([lat, lng], 16, { duration: 1.5 });
};

// ============================================================
//  SEARCH DESTINATION (Nominatim)
// ============================================================
window.searchDestination = async function() {
  const query = document.getElementById('dest-search')?.value?.trim();
  if (!query) return;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();

    if (!data.length) {
      WS.showToast('warning', 'Not Found', `No results found for "${query}". Try a more specific address.`);
      return;
    }

    const result = data[0];
    map.flyTo([result.lat, result.lon], 15, { duration: 2 });

    L.marker([result.lat, result.lon], { icon: createIcon('#f59e0b', 'fa-solid fa-flag') })
      .addTo(map)
      .bindPopup(`<strong>Destination:</strong><br>${result.display_name}`)
      .openPopup();

    WS.showToast('info', 'Destination Found', result.display_name.substring(0, 60) + '…', 4000);
  } catch {
    WS.showToast('error', 'Search Error', 'Could not complete search. Please check your connection.');
  }
};

// ============================================================
//  UTILITIES
// ============================================================
function calcDistance(lat1, lng1, lat2, lng2) {
  const R   = 6371000; // Earth radius in metres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function formatDist(m) {
  return m < 1000 ? `${Math.round(m)}m` : `${(m/1000).toFixed(1)}km`;
}

async function reverseGeocode(lat, lng) {
  const url  = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`;
  const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function hideLoader() {
  const loader = document.getElementById('map-loading');
  if (loader) loader.style.display = 'none';
}
