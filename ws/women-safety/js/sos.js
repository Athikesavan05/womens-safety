// ============================================================
//  WOMEN SAFETY SYSTEM — SOS Alert Logic
//  sos.js
// ============================================================

let currentLocation = null;
let sosActivated    = false;

// ---- Expose globally ----
window.triggerSOS       = triggerSOS;
window.closeSOSModal    = closeSOSModal;
window.sendSOSToContact = sendSOSToContact;
window.sendSOSToAll     = sendSOSToAll;

// ============================================================
//  TRIGGER SOS — Open modal + fetch location
// ============================================================
function triggerSOS(e) {
  if (e) e.preventDefault();

  const modal = document.getElementById('sos-modal');
  if (!modal) return;

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Start location fetch
  fetchLocation();

  // Haptic feedback (mobile)
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

function closeSOSModal() {
  const modal = document.getElementById('sos-modal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

// Close modal on backdrop click
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('sos-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeSOSModal();
    });
  }

  // Keyboard shortcut: Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSOSModal();
  });
});

// ============================================================
//  FETCH DEVICE LOCATION
// ============================================================
function fetchLocation() {
  const locationEl = document.getElementById('sos-location-text');
  if (locationEl) locationEl.textContent = 'Fetching your location…';

  if (!navigator.geolocation) {
    if (locationEl) locationEl.textContent = 'Geolocation not supported. Please share your location manually.';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      currentLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };

      // Attempt reverse geocoding
      try {
        const addr = await reverseGeocode(currentLocation.lat, currentLocation.lng);
        if (locationEl) locationEl.textContent = `📍 ${addr} (Accuracy: ±${Math.round(currentLocation.accuracy)}m)`;
      } catch {
        if (locationEl) {
          locationEl.textContent = `📍 Lat: ${currentLocation.lat.toFixed(5)}, Lng: ${currentLocation.lng.toFixed(5)}`;
        }
      }

      // Update SOS status on hero
      const statusEl = document.getElementById('sos-status');
      if (statusEl) {
        statusEl.className = 'sos-status active';
        statusEl.innerHTML = '<i class="fa-solid fa-location-dot" style="color:#22c55e;margin-right:6px;"></i> Location acquired — Ready to send SOS';
      }
    },
    (err) => {
      const msgs = {
        1: 'Location permission denied. Your approximate location will be excluded from the alert.',
        2: 'Location unavailable. Please share your location manually.',
        3: 'Location request timed out. Send alert without location?',
      };
      if (locationEl) locationEl.textContent = msgs[err.code] || 'Location error. Alert will be sent without coordinates.';
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// ============================================================
//  BUILD SOS MESSAGE
// ============================================================
function buildSOSMessage() {
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
  let locationStr = 'Location unavailable';
  let mapsLink    = '';

  if (currentLocation) {
    locationStr = `Lat: ${currentLocation.lat.toFixed(6)}, Lng: ${currentLocation.lng.toFixed(6)}`;
    mapsLink    = `https://maps.google.com/maps?q=${currentLocation.lat},${currentLocation.lng}`;
  }

  const message = `🆘 *EMERGENCY SOS ALERT*\n\nI need help! Please come or call me immediately.\n\n📍 *Location:* ${locationStr}\n${mapsLink ? `🗺️ *Map:* ${mapsLink}` : ''}\n\n⏰ *Time:* ${timestamp}\n\nSent via SafeGuard Women Safety App`;
  return { message, mapsLink };
}

// ============================================================
//  SEND SOS TO A SINGLE CONTACT
// ============================================================
function sendSOSToContact(phoneNumber, name) {
  const { message } = buildSOSMessage();

  // Try WhatsApp Web first
  const whatsappURL = `https://api.whatsapp.com/send?phone=${phoneNumber.replace(/\D/g,'')}&text=${encodeURIComponent(message)}`;
  window.open(whatsappURL, '_blank', 'noopener,noreferrer');

  markContactSent(phoneNumber);

  if (window.WS) {
    WS.showToast('success', 'SOS Sent!', `Alert sent to ${name} via WhatsApp.`, 4000);
  }
}

function markContactSent(phone) {
  const allContacts = document.querySelectorAll('.contact-item');
  allContacts.forEach(item => {
    const btn = item.querySelector('.contact-send');
    if (btn && btn.getAttribute('onclick')?.includes(phone)) {
      btn.textContent = '✓ Sent';
      btn.style.background = 'rgba(34,197,94,0.2)';
      btn.style.color = '#4ade80';
      btn.style.borderColor = 'rgba(34,197,94,0.3)';
      btn.disabled = true;
    }
  });
}

// ============================================================
//  SEND SOS TO ALL CONTACTS
// ============================================================
function sendSOSToAll() {
  const { message, mapsLink } = buildSOSMessage();

  // 1. WhatsApp share
  const whatsappURL = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  window.open(whatsappURL, '_blank', 'noopener,noreferrer');

  // 2. Email fallback
  setTimeout(() => {
    const subject = '🆘 EMERGENCY SOS ALERT';
    const emailBody = message.replace(/\*/g, '');
    const mailtoURL = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailtoURL;
  }, 2000);

  // Update UI
  const btn = document.getElementById('send-all-btn');
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Alert Sent to All!';
    btn.style.background = 'linear-gradient(135deg,#16a34a,#15803d)';
    btn.disabled = true;
  }

  // Mark main SOS button as activated
  const mainBtn = document.getElementById('main-sos-btn');
  if (mainBtn) mainBtn.classList.add('activated');

  sosActivated = true;

  if (window.WS) {
    WS.showToast('success', 'SOS Alert Sent!', 'Your emergency contacts have been notified.', 5000);
  }
}

// ============================================================
//  REVERSE GEOCODE (Nominatim)
// ============================================================
async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`;
  const res  = await fetch(url, { headers: { 'Accept-Language': 'en-IN' } });
  const data = await res.json();
  return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
