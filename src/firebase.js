import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";

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

const isDev =
  window.location.hostname === "localhost" ||
  process.env.NODE_ENV === "development";

if (isDev) {
  // token harcodeado desde varriable de entorno
  window.FIREBASE_APPCHECK_DEBUG_TOKEN =
    process.env.REACT_APP_APPCHECK_DEBUG_TOKEN;
  /* connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001); */
  connectFirestoreEmulator(db, "localhost", 8080);
  connectFunctionsEmulator(functions, "localhost", 5001);
}

// selecciona las colecciones de testing en entorno de desarrollo
const getCollectionName = (name) => (isDev ? `${name}_dev` : name);

export const TURNOS_CONFIRMADOS_REF = collection(
  db,
  getCollectionName("turnos"),
);
export const RESERVAS_PENDIENTES_REF = collection(
  db,
  getCollectionName("reservas_pendientes"),
);
export const TURNOS_PUBLICOS_REF = collection(
  db,
  getCollectionName("turnos_publicos"),
);
export const MAPEO_EMAILS_REF = collection(
  db,
  getCollectionName("mapeo_emails"),
);
export const TURNOS_CAIDOS_REF = collection(
  db,
  getCollectionName("turnos_caidos"),
);
export const COUNTERS_REF = collection(db, getCollectionName("counters"));
export const APERTURA_REF = collection(db, getCollectionName("apertura"));

initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(
    "6LeneVssAAAAAEhWDjyUDCiGyUGMyM3G5NAXeju7",
  ),
  isTokenAutoRefreshEnabled: true,
});

export { db, auth, functions };
