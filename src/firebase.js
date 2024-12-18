// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA78yyx4mNKlQYr7vVQ4jIRFENQfC-Kn9Y",
  authDomain: "tunelesturnos.firebaseapp.com",
  projectId: "tunelesturnos",
  storageBucket: "tunelesturnos.firebasestorage.app",
  messagingSenderId: "604452400614",
  appId: "1:604452400614:web:e663fbc102ceb6d057ba27",
  measurementId: "G-XS6TDNE4L3",
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Inicializa Firestore
const db = getFirestore(app);

export { db };
