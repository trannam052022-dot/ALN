// ALN · firebase-config.js — module Giữ chỗ & Phòng chờ
// Dùng cùng project Firebase với dự án ALN chính.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCPv-KbyK8ajRba1b2wy5qSwc--m_vbRUc",
  authDomain:        "aln-platform.firebaseapp.com",
  projectId:         "aln-platform",
  storageBucket:     "aln-platform.firebasestorage.app",
  messagingSenderId: "1073827504988",
  appId:             "1:1073827504988:web:8895fd6b68dff00a67d799"
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
