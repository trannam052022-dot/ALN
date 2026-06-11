/* ════════════════════════════════════════════════
   ALN PLATFORM — Firebase Config (dùng chung 5 trang)
   Import qua: import { ... } from "./firebase-config.js"
════════════════════════════════════════════════ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, initializeAuth,
  indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
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

/* Quy ước: tên đăng nhập "founder" ⇄ email "founder@aln.vn" */
const ALN_EMAIL_DOMAIN = "@aln.vn";
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
  onSnapshot, serverTimestamp
};
