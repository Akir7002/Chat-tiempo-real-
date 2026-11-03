// Configuración del SDK modular de Firebase para la Web
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAlQC_A2gQfvsT-LtHM-9yhUwHy9Fm68u4",
  authDomain: "colegio-35e34.firebaseapp.com",
  projectId: "colegio-35e34",
  storageBucket: "colegio-35e34.firebasestorage.app",
  messagingSenderId: "328032929639",
  appId: "1:328032929639:web:a9b23dc5d4854ee1f611c2",
  measurementId: "G-5GFJWBC3NY"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar y exportar Cloud Firestore
export const db = getFirestore(app);

// Exportar helpers de Firestore
export {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
};
