// ============================================================
//  WOMEN SAFETY SYSTEM — Shared Utilities
//  main.js
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initScrollReveal();
  initAccordions();
  initProgressBar();
  initMobileMenu();
  markActiveNavLink();
});

// ============================================================
//  NAVBAR — Scroll shadow + active link
// ============================================================
function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

function markActiveNavLink() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// ============================================================
//  MOBILE MENU — Hamburger toggle
// ============================================================
function initMobileMenu() {
  const toggle  = document.getElementById('mobile-toggle');
  const menu    = document.getElementById('nav-menu');
  const overlay = document.getElementById('nav-overlay');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('open');
    toggle.innerHTML = isOpen
      ? '<i class="fa-solid fa-xmark"></i>'
      : '<i class="fa-solid fa-bars"></i>';
    if (overlay) overlay.classList.toggle('active', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Close when clicking a link
  menu.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close overlay click
  if (overlay) overlay.addEventListener('click', closeMenu);

  function closeMenu() {
    menu.classList.remove('open');
    toggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// ============================================================
//  SCROLL REVEAL — Intersection Observer
// ============================================================
function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  elements.forEach(el => observer.observe(el));
}

// ============================================================
//  ACCORDIONS
// ============================================================
function initAccordions() {
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      const isOpen = item.classList.contains('open');
      // Close all in same container
      const parent = item.parentElement;
      parent.querySelectorAll('.accordion-item.open').forEach(i => {
        if (i !== item) i.classList.remove('open');
      });
      item.classList.toggle('open', !isOpen);
    });
  });
}

// ============================================================
//  PAGE PROGRESS BAR
// ============================================================
function initProgressBar() {
  const bar = document.getElementById('page-progress');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const total  = document.documentElement.scrollHeight - window.innerHeight;
    const pct    = total > 0 ? (window.scrollY / total) * 100 : 0;
    bar.style.width = pct + '%';
  }, { passive: true });
}

// ============================================================
//  TOAST NOTIFICATION SYSTEM
// ============================================================
const TOAST_ICONS = {
  success: 'fa-solid fa-circle-check',
  error:   'fa-solid fa-circle-xmark',
  warning: 'fa-solid fa-triangle-exclamation',
  info:    'fa-solid fa-circle-info',
};

/**
 * Show a toast notification.
 * @param {string} type    - 'success' | 'error' | 'warning' | 'info'
 * @param {string} title   - Bold title text
 * @param {string} message - Body text
 * @param {number} duration- Auto-dismiss in ms (default 4000)
 */
function showToast(type = 'info', title = '', message = '', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="toast-icon ${TOAST_ICONS[type] || TOAST_ICONS.info}"></i>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-msg">${message}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
  `;

  const dismiss = () => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  toast.querySelector('.toast-close').addEventListener('click', dismiss);
  container.appendChild(toast);

  if (duration > 0) setTimeout(dismiss, duration);
  return { dismiss };
}

// ============================================================
//  TABS
// ============================================================
function initTabs(containerSelector) {
  const containers = document.querySelectorAll(containerSelector || '[data-tabs]');
  containers.forEach(container => {
    const tabs  = container.querySelectorAll('.tab-btn');
    const panes = container.querySelectorAll('.tab-pane');

    tabs.forEach((tab, idx) => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        if (panes[idx]) panes[idx].classList.add('active');
      });
    });
  });
}

// ============================================================
//  ANIMATE NUMBER COUNTER
// ============================================================
function animateCounter(el, target, duration = 1500) {
  const start  = 0;
  const step   = target / (duration / 16);
  let current  = start;
  const update = () => {
    current = Math.min(current + step, target);
    el.textContent = Math.floor(current).toLocaleString();
    if (current < target) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ============================================================
//  COPY TO CLIPBOARD
// ============================================================
function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('success', 'Copied!', text, 2000);
    });
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity  = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('success', 'Copied!', text, 2000);
  }
}

// ============================================================
//  GEOLOCATION HELPER
// ============================================================
function getCurrentLocation(onSuccess, onError) {
  if (!navigator.geolocation) {
    onError?.('Geolocation is not supported by this browser.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => onSuccess({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
    err => {
      const msgs = {
        1: 'Location permission denied. Please allow location access in your browser settings.',
        2: 'Location unavailable. Please check your device settings.',
        3: 'Location request timed out. Please try again.'
      };
      onError?.(msgs[err.code] || 'Unknown location error.');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// ============================================================
//  SHARE / WHATSAPP
// ============================================================
function shareViaWhatsApp(message) {
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function shareViaSMS(number, message) {
  window.location.href = `sms:${number}?body=${encodeURIComponent(message)}`;
}

function shareViaEmail(to, subject, body) {
  window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ============================================================
//  REVERSE GEOCODING (Nominatim / OpenStreetMap)
// ============================================================
async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

// ============================================================
//  FORMAT TIMESTAMP
// ============================================================
function formatTimestamp(ts) {
  if (!ts) return 'Unknown time';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff  = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60000);
  const hrs   = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'Just now';
  if (mins  < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  if (hrs   < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  if (days  < 7)  return `${days} day${days > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ============================================================
//  SEVERITY COLOR
// ============================================================
function getSeverityColor(severity) {
  const map = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e', cyber: '#3b82f6' };
  return map[severity?.toLowerCase()] || '#8b5cf6';
}

// Export all utilities globally (since we're not using a module bundler for HTML pages)
window.WS = {
  showToast,
  initTabs,
  animateCounter,
  copyToClipboard,
  getCurrentLocation,
  shareViaWhatsApp,
  shareViaSMS,
  shareViaEmail,
  reverseGeocode,
  formatTimestamp,
  getSeverityColor,
};
