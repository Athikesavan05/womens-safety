// ============================================================
//  WOMEN SAFETY SYSTEM — Incident Report Logic
//  report.js
// ============================================================

let miniMap, pinMarker, selectedType = '', isAnonymous = true, selectedFiles = [];
let currentLat = null, currentLng = null;

// ---- Global bindings ----
window.selectType     = selectType;
window.autoFillLocation = autoFillLocation;
window.toggleAnon     = toggleAnon;
window.handleFiles    = handleFiles;
window.submitReport   = submitReport;
window.resetForm      = resetForm;

// ============================================================
//  INIT MINI MAP
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Set today's date as default
  const dateInput = document.getElementById('incident-date');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

  // Init mini Leaflet map
  miniMap = L.map('mini-map', { zoomControl: true })
    .setView([20.5937, 78.9629], 5);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(miniMap);

  // Click to pin location
  miniMap.on('click', (e) => {
    const { lat, lng } = e.latlng;
    setMapPin(lat, lng);
    reverseGeocodeAndFill(lat, lng);
  });

  // Try to get user location to center the map
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      currentLat = pos.coords.latitude;
      currentLng = pos.coords.longitude;
      miniMap.setView([currentLat, currentLng], 14);
    }, () => {}, { timeout: 8000 });
  }

  // Drag-and-drop file upload
  const dropZone = document.getElementById('file-drop-zone');
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave',  ()  => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      handleFiles(e.dataTransfer.files);
    });
  }
});

// ============================================================
//  INCIDENT TYPE SELECTOR
// ============================================================
function selectType(type, el) {
  selectedType = type;
  document.querySelectorAll('.incident-type').forEach(t => t.classList.remove('selected'));
  el.classList.add('selected');
}

// ============================================================
//  LOCATION AUTO-FILL (GPS)
// ============================================================
function autoFillLocation() {
  if (!navigator.geolocation) {
    WS.showToast('error', 'Not Supported', 'Geolocation is not supported in this browser.');
    return;
  }

  const statusEl = document.getElementById('location-status');
  if (statusEl) {
    statusEl.style.display = 'flex';
    statusEl.innerHTML = '<i class="fa-solid fa-spinner anim-spin"></i> Fetching your location…';
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      currentLat = pos.coords.latitude;
      currentLng = pos.coords.longitude;
      setMapPin(currentLat, currentLng);
      miniMap.setView([currentLat, currentLng], 15);
      await reverseGeocodeAndFill(currentLat, currentLng);
    },
    (err) => {
      if (statusEl) statusEl.style.display = 'none';
      WS.showToast('warning', 'Location Unavailable', 'Could not get your GPS location. Please type the address manually.');
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

async function reverseGeocodeAndFill(lat, lng) {
  currentLat = lat; currentLng = lng;
  try {
    const url  = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en-IN' } });
    const data = await res.json();
    const addr = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    const locInput = document.getElementById('location-text');
    if (locInput) locInput.value = addr;

    const statusEl = document.getElementById('location-status');
    if (statusEl) {
      statusEl.style.display = 'flex';
      statusEl.innerHTML = `<i class="fa-solid fa-check-circle" style="color:#4ade80;"></i> <span>${addr}</span>`;
    }
  } catch {
    const locInput = document.getElementById('location-text');
    if (locInput) locInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

// ============================================================
//  MAP PIN DROP
// ============================================================
function setMapPin(lat, lng) {
  const pinIcon = L.divIcon({
    html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:linear-gradient(135deg,hsl(270,70%,55%),hsl(340,80%,65%));transform:rotate(-45deg);box-shadow:0 4px 12px rgba(0,0,0,0.5);border:2px solid rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-triangle-exclamation" style="transform:rotate(45deg);color:#fff;font-size:0.65rem;"></i></div>`,
    className: '',
    iconSize:   [28, 28],
    iconAnchor: [14, 28],
  });

  if (pinMarker) miniMap.removeLayer(pinMarker);
  pinMarker = L.marker([lat, lng], { icon: pinIcon, draggable: true })
    .addTo(miniMap)
    .bindPopup('📍 Incident location pinned')
    .openPopup();

  pinMarker.on('dragend', (e) => {
    const { lat, lng } = e.target.getLatLng();
    reverseGeocodeAndFill(lat, lng);
  });
}

// ============================================================
//  ANONYMOUS TOGGLE
// ============================================================
function toggleAnon() {
  isAnonymous = !isAnonymous;
  const toggle = document.getElementById('anon-toggle');
  const contactGroup = document.getElementById('contact-group');
  if (toggle) toggle.classList.toggle('on', isAnonymous);
  if (toggle) toggle.setAttribute('aria-checked', isAnonymous);
  if (contactGroup) contactGroup.style.display = isAnonymous ? 'none' : 'block';
}
// Set initial state
document.addEventListener('DOMContentLoaded', () => {
  const cg = document.getElementById('contact-group');
  if (cg) cg.style.display = 'none'; // anonymous by default
});

// ============================================================
//  FILE UPLOAD HANDLER
// ============================================================
function handleFiles(files) {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const fileListEl = document.getElementById('file-list');
  Array.from(files).forEach(file => {
    if (file.size > MAX_SIZE) {
      WS.showToast('error', 'File Too Large', `${file.name} exceeds 10MB limit.`);
      return;
    }
    selectedFiles.push(file);
    if (fileListEl) {
      const chip = document.createElement('div');
      chip.className = 'file-chip';
      chip.innerHTML = `<i class="fa-solid fa-paperclip"></i> ${file.name.substring(0,20)}${file.name.length > 20 ? '…' : ''}`;
      fileListEl.appendChild(chip);
    }
  });
  if (selectedFiles.length) {
    WS.showToast('info', 'Files Added', `${selectedFiles.length} file(s) ready to upload.`, 2500);
  }
}

// ============================================================
//  FORM VALIDATION
// ============================================================
function validateForm() {
  const errors = [];
  if (!selectedType) errors.push('Please select an incident type.');
  if (!document.getElementById('location-text')?.value?.trim()) errors.push('Please enter or pin the incident location.');
  if (!document.getElementById('incident-date')?.value)          errors.push('Please select the incident date.');
  if (!document.getElementById('severity')?.value)               errors.push('Please select a severity level.');
  if (!document.getElementById('description')?.value?.trim())    errors.push('Please describe what happened.');
  return errors;
}

// ============================================================
//  SUBMIT REPORT
// ============================================================
async function submitReport() {
  const errors = validateForm();
  if (errors.length) {
    WS.showToast('error', 'Incomplete Report', errors[0]);
    return;
  }

  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner anim-spin"></i> Submitting…';
  }

  const reportData = {
    type:       selectedType,
    location:   {
      address: document.getElementById('location-text')?.value?.trim(),
      lat:     currentLat,
      lng:     currentLng,
    },
    date:       document.getElementById('incident-date')?.value,
    time:       document.getElementById('incident-time')?.value,
    severity:   document.getElementById('severity')?.value,
    description:document.getElementById('description')?.value?.trim(),
    anonymous:  isAnonymous,
    contact:    isAnonymous ? null : document.getElementById('contact-phone')?.value?.trim(),
    fileCount:  selectedFiles.length,
  };

  try {
    // Simulate a 1.5s network delay for demo feel
    await new Promise(r => setTimeout(r, 1500));

    // In a real app: await addIncidentReport(reportData) from firebase-config.js
    const reportId = `RPT-${Date.now().toString(36).toUpperCase()}`;

    // Show success state
    document.getElementById('form-state').style.display = 'none';
    const successEl = document.getElementById('success-state');
    successEl.classList.add('show');

    const reportIdEl = document.getElementById('report-id-display');
    if (reportIdEl) reportIdEl.textContent = `Report ID: ${reportId}  ·  Submitted: ${new Date().toLocaleString('en-IN')}`;

    WS.showToast('success', 'Report Submitted!', `Report ID: ${reportId}`, 6000);

  } catch (err) {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Report';
    }
    WS.showToast('error', 'Submission Failed', 'Please check your connection and try again.');
  }
}

// ============================================================
//  RESET FORM
// ============================================================
function resetForm() {
  selectedType = '';
  isAnonymous  = true;
  selectedFiles = [];
  currentLat = null; currentLng = null;

  document.querySelectorAll('.incident-type').forEach(t => t.classList.remove('selected'));
  ['location-text','description','contact-phone'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('incident-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('severity').value = '';

  const fileList = document.getElementById('file-list');
  if (fileList) fileList.innerHTML = '';

  const statusEl = document.getElementById('location-status');
  if (statusEl) statusEl.style.display = 'none';

  const anon = document.getElementById('anon-toggle');
  if (anon) anon.classList.add('on');
  const cg = document.getElementById('contact-group');
  if (cg) cg.style.display = 'none';

  if (pinMarker) { miniMap.removeLayer(pinMarker); pinMarker = null; }

  document.getElementById('form-state').style.display = '';
  document.getElementById('success-state').classList.remove('show');

  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Report';
  }
}
