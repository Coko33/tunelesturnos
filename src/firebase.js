import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyA78yyx4mNKlQYr7vVQ4jIRFENQfC-Kn9Y",
  authDomain: "tunelesturnos.firebaseapp.com",
  projectId: "tunelesturnos",
  storageBucket: "tunelesturnos.firebasestorage.app",
  messagingSenderId: "604452400614",
  appId: "1:604452400614:web:e663fbc102ceb6d057ba27",
  measurementId: "G-XS6TDNE4L3",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app);

// Detectamos si estamos en desarrollo (localhost)
const isDev = process.env.NODE_ENV === "development";

if (isDev) {
  // Conectar a los emuladores locales (puertos por defecto)
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

// Función auxiliar para elegir el nombre de la colección (usa _dev para coincidir con functions)
const getCollectionName = (name) => (isDev ? `${name}_dev` : name);

export const TURNOS_CONFIRMADOS_REF = collection(
  db,
  getCollectionName("turnos"),
);
export const RESERVAS_PENDIENTES_REF = collection(
  db,
  getCollectionName("reservas_pendientes"),
); //seleccionados no confirmados expuestos en el Front
export const TURNOS_PUBLICOS_REF = collection(
  db,
  getCollectionName("turnos_publicos"),
); //datos de turnos confirmados expuestos en el Front
export const MAPEO_EMAILS_REF = collection(
  db,
  getCollectionName("mapeo_emails"),
);
export const TURNOS_CAIDOS_REF = collection(
  db,
  getCollectionName("turnos_caidos"),
); //reservas que no confirmaron

export { db, auth, functions };
