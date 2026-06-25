// ============================================================
//  WOMEN SAFETY SYSTEM — Firebase Configuration
//  firebase-config.js
//
//  ⚠️  IMPORTANT: Replace the placeholder values below with
//  your own Firebase project credentials from:
//  https://console.firebase.google.com
//  Project Settings > General > Your Apps > Firebase SDK snippet
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot, query, orderBy, where, serverTimestamp }
       from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup }
       from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL }
       from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ---- YOUR FIREBASE CONFIG ----
// Replace everything inside firebaseConfig with your own values:
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID",
  measurementId:     "YOUR_MEASUREMENT_ID"
};

// ---- Initialize Firebase ----
let app, db, auth, storage;
let isFirebaseConfigured = false;

try {
  // Check if placeholder values are still present
  if (firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.warn(
      "[Firebase] ⚠️  Placeholder config detected.\n" +
      "Firebase features (incident reporting, community alerts) will run in DEMO mode.\n" +
      "Replace the config in js/firebase-config.js with your real Firebase credentials."
    );
    isFirebaseConfigured = false;
  } else {
    app     = initializeApp(firebaseConfig);
    db      = getFirestore(app);
    auth    = getAuth(app);
    storage = getStorage(app);
    isFirebaseConfigured = true;
    console.log("[Firebase] ✅ Connected to project:", firebaseConfig.projectId);
  }
} catch (error) {
  console.error("[Firebase] Initialization error:", error.message);
  isFirebaseConfigured = false;
}

// ---- Mock/Demo Data (used when Firebase is not configured) ----
const DEMO_INCIDENTS = [
  {
    id: "demo_1",
    type: "Harassment",
    description: "Verbal harassment near the bus stand.",
    location: { lat: 28.6139, lng: 77.2090, address: "Connaught Place, New Delhi" },
    timestamp: new Date(Date.now() - 3600000),
    severity: "high",
    anonymous: true,
    status: "Reported"
  },
  {
    id: "demo_2",
    type: "Stalking",
    description: "Suspicious individual following a person for several blocks.",
    location: { lat: 28.6304, lng: 77.2177, address: "Karol Bagh, New Delhi" },
    timestamp: new Date(Date.now() - 7200000),
    severity: "medium",
    anonymous: false,
    status: "Under Review"
  },
  {
    id: "demo_3",
    type: "Unsafe Location",
    description: "Poor lighting on the road after 9 PM. Multiple complaints from women.",
    location: { lat: 28.6062, lng: 77.2190, address: "Lajpat Nagar, New Delhi" },
    timestamp: new Date(Date.now() - 86400000),
    severity: "low",
    anonymous: true,
    status: "Verified"
  },
  {
    id: "demo_4",
    type: "Cyber Harassment",
    description: "Fake social media account created impersonating a local woman.",
    location: { lat: 28.5355, lng: 77.3910, address: "Noida Sector 18" },
    timestamp: new Date(Date.now() - 172800000),
    severity: "high",
    anonymous: false,
    status: "Reported"
  }
];

// ---- Firestore Helpers ----

/**
 * Add an incident report to Firestore.
 * Falls back to demo mode if Firebase is not configured.
 */
async function addIncidentReport(reportData) {
  if (!isFirebaseConfigured) {
    // Demo mode — simulate a successful save
    console.log("[Demo] Incident report would be saved:", reportData);
    return { id: `demo_${Date.now()}`, ...reportData, demo: true };
  }
  const docRef = await addDoc(collection(db, "incidents"), {
    ...reportData,
    timestamp: serverTimestamp(),
    status: "Reported"
  });
  return { id: docRef.id };
}

/**
 * Get all incidents (one-time read).
 * Falls back to demo data if Firebase is not configured.
 */
async function getIncidents(filters = {}) {
  if (!isFirebaseConfigured) {
    let data = [...DEMO_INCIDENTS];
    if (filters.type) data = data.filter(d => d.type === filters.type);
    return data;
  }
  let q = query(collection(db, "incidents"), orderBy("timestamp", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Subscribe to real-time incident updates.
 * Falls back to demo data if Firebase is not configured.
 */
function subscribeToIncidents(callback) {
  if (!isFirebaseConfigured) {
    // Return demo data once, then simulate no further updates
    callback(DEMO_INCIDENTS);
    return () => {}; // unsubscribe no-op
  }
  const q = query(collection(db, "incidents"), orderBy("timestamp", "desc"));
  return onSnapshot(q, (snapshot) => {
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(docs);
  });
}

/**
 * Upload a file to Firebase Storage and return the download URL.
 */
async function uploadFile(file, path) {
  if (!isFirebaseConfigured) {
    console.log("[Demo] File upload simulated:", file.name);
    return null;
  }
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

// ---- Auth Helpers ----

async function signInWithGoogle() {
  if (!isFirebaseConfigured) {
    console.log("[Demo] Google Sign-In simulated.");
    return { user: { displayName: "Demo User", email: "demo@example.com", photoURL: null } };
  }
  const provider = new GoogleAuthProvider();
  return await signInWithPopup(auth, provider);
}

async function registerUser(email, password) {
  if (!isFirebaseConfigured) return null;
  return await createUserWithEmailAndPassword(auth, email, password);
}

async function loginUser(email, password) {
  if (!isFirebaseConfigured) return null;
  return await signInWithEmailAndPassword(auth, email, password);
}

async function logoutUser() {
  if (!isFirebaseConfigured) return;
  return await signOut(auth);
}

function onAuthChange(callback) {
  if (!isFirebaseConfigured) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

// ---- Exports ----
export {
  db, auth, storage,
  isFirebaseConfigured,
  addIncidentReport,
  getIncidents,
  subscribeToIncidents,
  uploadFile,
  signInWithGoogle,
  registerUser,
  loginUser,
  logoutUser,
  onAuthChange,
  DEMO_INCIDENTS
};
