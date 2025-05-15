// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDcgotS8nxHvWISIt94K8Qo6BgTg7osAr0",
  authDomain: "tpv-zapatos.firebaseapp.com",
  projectId: "tpv-zapatos",
  storageBucket: "tpv-zapatos.firebasestorage.app",
  messagingSenderId: "499850831360",
  appId: "1:499850831360:web:03d3ffe90d4c533cd21ae5",
  measurementId: "G-K2916FHLPY"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
