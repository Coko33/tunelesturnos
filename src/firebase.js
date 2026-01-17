import { initializeApp } from "firebase/app";
import { getFirestore, collection } from "firebase/firestore";
import { getAuth } from "firebase/auth";

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

//prod
export const TURNOS_CONFIRMADOS_REF = collection(db, "turnos");
export const RESERVAS_PENDIENTES_REF = collection(db, "reservas_pendientes");
export const TURNOS_PUBLICOS_REF = collection(db, "turnos_publicos");
export const MAPEO_EMAILS_REF = collection(db, "mapeo_emails");
export const TURNOS_CAIDOS_REF = collection(db, "turnos_caidos");

//dev
/* 
export const TURNOS_CONFIRMADOS_REF = collection(db, "turnos_dev");
export const RESERVAS_PENDIENTES_REF = collection(db, "reservas_pendientes_dev");
export const TURNOS_PUBLICOS_REF = collection(db, "turnos_publicos_dev");
export const MAPEO_EMAILS_REF = collection(db, "mapeo_emails_dev"); 
*/

export { db, auth };
