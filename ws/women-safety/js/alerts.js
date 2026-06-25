// ============================================================
//  WOMEN SAFETY SYSTEM — Community Alerts Map Logic
//  alerts.js
// ============================================================

let alertsMap, userAlertMarker;
let allIncidents = [];
let activeFilter = 'all';
let markerLayer  = null;

// ---- Demo data (mirrors firebase-config.js DEMO_INCIDENTS) ----
const DEMO = [
  { id:'d1', type:'Harassment',       description:'Verbal harassment near the bus stand. Several witnesses present.',          location:{ lat:28.6139, lng:77.2090, address:'Connaught Place, New Delhi' },           timestamp:new Date(Date.now()-3600000),   severity:'high',   anonymous:true,  status:'Reported'     },
  { id:'d2', type:'Stalking',         description:'Suspicious individual following a person for several blocks near the market.',location:{ lat:28.6304, lng:77.2177, address:'Karol Bagh, New Delhi' },              timestamp:new Date(Date.now()-7200000),   severity:'medium', anonymous:false, status:'Under Review' },
  { id:'d3', type:'Unsafe Location',  description:'Very poor lighting on the road after 9 PM. Multiple complaints received.',  location:{ lat:28.6062, lng:77.2190, address:'Lajpat Nagar, New Delhi' },             timestamp:new Date(Date.now()-86400000),  severity:'low',    anonymous:true,  status:'Verified'     },
  { id:'d4', type:'Cyber Harassment', description:'Fake social media account impersonating a local woman with edited photos.', location:{ lat:28.5355, lng:77.3910, address:'Noida Sector 18, UP' },                  timestamp:new Date(Date.now()-172800000), severity:'high',   anonymous:false, status:'Reported'     },
  { id:'d5', type:'Harassment',       description:'Eve teasing reported near the metro station exit.',                         location:{ lat:28.6428, lng:77.2195, address:'Rajiv Chowk Metro, Delhi' },            timestamp:new Date(Date.now()-10800000),  severity:'medium', anonymous:true,  status:'Reported'     },
  { id:'d6', type:'Unsafe Location',  description:'Broken street lights on the entire stretch. Very dark after 8 PM.',        location:{ lat:28.5921, lng:77.2262, address:'Hauz Khas Village, Delhi' },             timestamp:new Date(Date.now()-259200000), severity:'low',    anonymous:true,  status:'Verified'     },
  { id:'d7', type:'Stalking',         description:'Woman followed from office to home on two consecutive days.',              location:{ lat:28.5672, lng:77.3210, address:'Sector 62, Noida, UP' },                 timestamp:new Date(Date.now()-43200000),  severity:'high',   anonymous:false, status:'Under Review' },
];

const SEVERITY_COLORS = { high:'#ef4444', medium:'#f59e0b', low:'#22c55e', cyber:'#3b82f6' };
const TYPE_ICONS  = {
  'Harassment':      'fa-person-harassing',
  'Stalking':        'fa-eye',
  'Unsafe Location': 'fa-triangle-exclamation',
  'Cyber Harassment':'fa-laptop-code',
  'Theft/Robbery':   'fa-hand-holding',
  'Other':           'fa-ellipsis',
};

// ============================================================
//  INIT MAP
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  alertsMap = L.map('alerts-map', { zoomControl: true })
    .setView([28.6139, 77.2090], 11); // Default: Delhi

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(alertsMap);

  markerLayer = L.layerGroup().addTo(alertsMap);

  // Load demo data (replace with real Firestore subscription when configured)
  loadIncidents();
  buildTypeFilters();
});

// ============================================================
//  LOAD INCIDENTS
// ============================================================
function loadIncidents() {
  // Simulate async load
  setTimeout(() => {
    allIncidents = DEMO;
    document.getElementById('alerts-loading').style.display = 'none';
    renderAll();
    updateStats();
    WS.showToast('info', 'Demo Data', 'Showing sample incident data. Connect Firebase for real-time reports.', 5000);
  }, 1200);
}

// ============================================================
//  RENDER ALL (markers + list)
// ============================================================
function renderAll() {
  const filtered = activeFilter === 'all'
    ? allIncidents
    : allIncidents.filter(i => i.type === activeFilter);

  renderMarkers(filtered);
  renderIncidentList(filtered);
  updateTypeFilterCounts();
}

// ============================================================
//  RENDER MAP MARKERS
// ============================================================
function renderMarkers(incidents) {
  markerLayer.clearLayers();
  incidents.forEach(inc => {
    if (!inc.location?.lat || !inc.location?.lng) return;

    const color  = getSevColor(inc);
    const faIcon = TYPE_ICONS[inc.type] || 'fa-circle-exclamation';

    const icon = L.divIcon({
      html: `<div style="
        width:36px;height:36px;border-radius:50%;
        background:${color};
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 0 0 4px rgba(${hexToRgb(color)},0.3),0 4px 12px rgba(0,0,0,0.5);
        border:2px solid rgba(255,255,255,0.3);">
        <i class="fa-solid ${faIcon}" style="color:#fff;font-size:0.75rem;"></i>
      </div>`,
      className: '',
      iconSize:   [36, 36],
      iconAnchor: [18, 18],
      popupAnchor:[0, -20],
    });

    const ts = formatTime(inc.timestamp);
    L.marker([inc.location.lat, inc.location.lng], { icon })
      .bindPopup(`
        <div style="font-family:'Inter',sans-serif;min-width:200px;padding:4px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>
            <strong style="font-size:0.9rem;">${inc.type}</strong>
            <span style="margin-left:auto;font-size:0.72rem;padding:2px 8px;border-radius:999px;background:${color}22;color:${color};font-weight:600;">${inc.severity?.toUpperCase()}</span>
          </div>
          <p style="font-size:0.82rem;color:#aaa;margin-bottom:8px;line-height:1.5;">${inc.description}</p>
          <div style="font-size:0.75rem;color:#666;display:flex;align-items:center;gap:4px;">
            <i class="fa-solid fa-location-dot"></i> ${inc.location.address || 'Location'}
          </div>
          <div style="font-size:0.72rem;color:#555;margin-top:4px;">
            <i class="fa-regular fa-clock"></i> ${ts}
          </div>
        </div>
      `)
      .addTo(markerLayer);
  });
}

// ============================================================
//  RENDER INCIDENT LIST
// ============================================================
function renderIncidentList(incidents) {
  const listEl = document.getElementById('incident-list');
  if (!listEl) return;

  if (!incidents.length) {
    listEl.innerHTML = `<div class="no-incidents"><i class="fa-solid fa-circle-check"></i>No incidents match this filter.</div>`;
    return;
  }

  const sorted = [...incidents].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  listEl.innerHTML = sorted.map(inc => {
    const color  = getSevColor(inc);
    const faIcon = TYPE_ICONS[inc.type] || 'fa-circle-exclamation';
    const sevClass = inc.severity === 'high' ? 'sev-high' : inc.severity === 'medium' ? 'sev-medium' : 'sev-low';
    return `
      <div class="incident-item" onclick="flyToIncident(${inc.location?.lat},${inc.location?.lng})" title="${inc.type} — ${inc.location?.address || ''}">
        <div class="incident-icon" style="background:${color}22;">
          <i class="fa-solid ${faIcon}" style="color:${color};"></i>
        </div>
        <div class="incident-body">
          <div class="incident-type-label">${inc.type}</div>
          <div class="incident-addr">${inc.location?.address || 'Location unknown'}</div>
          <div class="incident-meta">
            <span class="sev-pill ${sevClass}">${inc.severity || 'unknown'}</span>
            <span class="incident-time">${formatTime(inc.timestamp)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================
//  TYPE FILTER SIDEBAR
// ============================================================
function buildTypeFilters() {
  const types = ['Harassment','Stalking','Unsafe Location','Cyber Harassment','Theft/Robbery'];
  const container = document.getElementById('type-filters');
  if (!container) return;

  container.innerHTML = `
    <button class="type-filter-btn active" id="tfilter-all" onclick="filterIncidents('all')">
      <i class="fa-solid fa-layer-group" style="color:hsl(270,60%,68%);"></i> All Types
      <span class="type-count" id="tc-all">0</span>
    </button>
    ${types.map(t => `
      <button class="type-filter-btn" id="tfilter-${t.replace(/\s/g,'-')}" onclick="filterIncidents('${t}')">
        <i class="fa-solid ${TYPE_ICONS[t] || 'fa-circle'}" style="color:hsl(270,60%,68%);font-size:0.8rem;"></i> ${t}
        <span class="type-count" id="tc-${t.replace(/\s/g,'-')}">0</span>
      </button>
    `).join('')}
  `;
}

function updateTypeFilterCounts() {
  document.getElementById('tc-all').textContent = allIncidents.length;
  ['Harassment','Stalking','Unsafe Location','Cyber Harassment','Theft/Robbery'].forEach(t => {
    const el = document.getElementById(`tc-${t.replace(/\s/g,'-')}`);
    if (el) el.textContent = allIncidents.filter(i=>i.type===t).length;
  });
}

// ============================================================
//  FILTER INCIDENTS
// ============================================================
window.filterIncidents = function(type) {
  activeFilter = type;

  // Update top ctrl buttons
  ['all','Harassment','Stalking','Unsafe Location','Cyber Harassment'].forEach(t => {
    const id = `filter-${t.replace(/\s/g,'-').toLowerCase()}-btn`;
    const btn = document.getElementById(id.replace('unsafe-location','unsafe'));
    // Simplified — just target the known buttons
  });

  // Update type filter sidebar
  document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById(`tfilter-${type === 'all' ? 'all' : type.replace(/\s/g,'-')}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Update top bar buttons
  document.querySelectorAll('.ctrl-btn').forEach(b => b.classList.remove('active'));
  const topBtn = document.getElementById(`filter-${type === 'all' ? 'all' : type.toLowerCase().replace(/\s/g,'-')}-btn`);
  if (topBtn) topBtn.classList.add('active');

  renderAll();
};

// ============================================================
//  FLY TO INCIDENT
// ============================================================
window.flyToIncident = function(lat, lng) {
  if (!lat || !lng) return;
  alertsMap.flyTo([lat, lng], 15, { duration: 1.5 });
};

// ============================================================
//  LOCATE USER ON ALERT MAP
// ============================================================
window.locateUserOnAlertMap = function() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lng } = pos.coords;
    const userIcon = L.divIcon({
      html: `<div style="width:20px;height:20px;border-radius:50%;background:#a855f7;border:3px solid #fff;box-shadow:0 0 0 6px rgba(168,85,247,0.3),0 4px 12px rgba(0,0,0,0.4);"></div>`,
      className: '', iconSize:[20,20], iconAnchor:[10,10],
    });
    if (userAlertMarker) alertsMap.removeLayer(userAlertMarker);
    userAlertMarker = L.marker([lat, lng], { icon: userIcon }).addTo(alertsMap).bindPopup('📍 You are here').openPopup();
    alertsMap.flyTo([lat, lng], 14, { duration: 1.5 });
    WS.showToast('success','Location Found','Map centered to your location.', 2000);
  }, () => WS.showToast('warning','Location Error','Could not get your location.'));
};

// ============================================================
//  UPDATE STATS
// ============================================================
function updateStats() {
  const total   = allIncidents.length;
  const high    = allIncidents.filter(i => i.severity === 'high').length;
  const today   = allIncidents.filter(i => {
    const d = new Date(i.timestamp);
    const n = new Date();
    return d.getDate()===n.getDate() && d.getMonth()===n.getMonth() && d.getFullYear()===n.getFullYear();
  }).length;

  WS.animateCounter(document.getElementById('total-count'), total);
  WS.animateCounter(document.getElementById('high-count'),  high);
  WS.animateCounter(document.getElementById('today-count'), today);
}

// ============================================================
//  UTILITIES
// ============================================================
function getSevColor(inc) {
  if (inc.type === 'Cyber Harassment') return '#3b82f6';
  return SEVERITY_COLORS[inc.severity?.toLowerCase()] || '#8b5cf6';
}

function formatTime(ts) {
  if (!ts) return 'Unknown';
  const date = ts instanceof Date ? ts : (ts.toDate ? ts.toDate() : new Date(ts));
  const diff  = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60000);
  const hrs   = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24)  return `${hrs}h ago`;
  if (days < 7)  return `${days}d ago`;
  return date.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}
