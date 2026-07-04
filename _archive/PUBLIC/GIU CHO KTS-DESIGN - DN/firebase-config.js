// ════════════════════════════════════════════════════════════════
//  ALN · firebase-config.js  (dùng riêng cho module Giữ chỗ)
// ────────────────────────────────────────────────────────────────
//  HƯỚNG DẪN: Dán đúng thông tin cấu hình Firebase CỦA BẠN vào
//  object firebaseConfig bên dưới. Bạn copy y nguyên các giá trị
//  từ file firebase-config.js đang chạy trong dự án ALN hiện tại
//  (cùng 1 project Firebase → dữ liệu dùng chung, code thì tách riêng).
//
//  Module này trỏ tới project Firebase CÓ SẴN của bạn, chỉ ghi vào
//  collection mới "reservations" + "users", KHÔNG đụng collection cũ.
// ════════════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// 🔴 THAY BẰNG CẤU HÌNH THẬT CỦA BẠN 🔴
const firebaseConfig = {
  apiKey:            "DÁN_API_KEY_CỦA_BẠN",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "DÁN_SENDER_ID",
  appId:             "DÁN_APP_ID"
};

const app     = initializeApp(firebaseConfig);
const auth    = getAuth(app);
const db      = getFirestore(app);
const storage = getStorage(app);

export {
  auth, db, storage,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut,
  doc, setDoc, getDoc, updateDoc, serverTimestamp,
  storageRef, uploadBytes, getDownloadURL
};
