/* ════════════════════════════════════════════════
   ALN PLATFORM — Firebase Config (dùng chung 5 trang)
════════════════════════════════════════════════ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
// App Check được import động (dynamic) để debug token được set trước khi SDK load
import {
  getAuth, initializeAuth,
  indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getMessaging, getToken, onMessage as onFcmMessage, isSupported as fcmSupported
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs, query, where, orderBy, limit, limitToLast,
  onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCPv-KbyK8ajRba1b2wy5qSwc--m_vbRUc",
  authDomain: "aln-platform.firebaseapp.com",
  projectId: "aln-platform",
  storageBucket: "aln-platform.firebasestorage.app",
  messagingSenderId: "1073827504988",
  appId: "1:1073827504988:web:8895fd6b68dff00a67d799",
  measurementId: "G-CGXJKGG5CQ"
};

const app  = initializeApp(firebaseConfig);

// BƯỚC 1 — Set debug token TRƯỚC KHI load App Check SDK
if (typeof self !== 'undefined') {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}
// BƯỚC 2 — Dynamic import để đảm bảo token đã được set
const { initializeAppCheck, ReCaptchaV3Provider } = await import(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check.js"
);
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LeuZi8tAAAAMfnZOHxH_xnLM8C0OpnexVgKFPb'),
  isTokenAutoRefreshEnabled: true
});

/* Persistence đa tầng: nếu kho lưu trữ chính của trình duyệt lỗi
   (ví dụ sau khi tab bị crash), tự lùi xuống tầng kế tiếp thay vì mất phiên */
let auth;
try {
  auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence]
  });
} catch (e) {
  auth = getAuth(app);
}
const db = getFirestore(app);
const storage = getStorage(app);

/* Quy ước: tên đăng nhập "founder" ⇄ email "founder@aln.vn" */
const ALN_EMAIL_DOMAIN = "@aln.vn";

/* KHÓA WEB PUSH (VAPID) */
const ALN_VAPID_KEY = "BI2O01Nr82Q59n9pQSdqgoTuoMHeG-agdjzRo-8yYDqevWmdH9rh65Lhxu0VdNZHGfRGHDu_FQB0UD39eZOXVWo";

function usernameToEmail(username) {
  username = (username || "").trim().toLowerCase();
  return username.includes("@") ? username : username + ALN_EMAIL_DOMAIN;
}

export {
  app, auth, db, usernameToEmail, ALN_EMAIL_DOMAIN,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, signOut,
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs, query, where, orderBy, limit, limitToLast,
  onSnapshot, serverTimestamp,
  getMessaging, getToken, onFcmMessage, fcmSupported, ALN_VAPID_KEY,
  storage, storageRef, uploadBytes, getDownloadURL
};
