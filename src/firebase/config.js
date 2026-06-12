import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Carichiamo le variabili d'ambiente di Vite. Se non sono definite, usiamo valori fittizi (placeholder)
// in modo da evitare il crash dell'applicazione a runtime prima che l'utente inserisca le sue chiavi nel file .env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "mock-api-key-replace-me-in-env-file",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mock-project-id.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mock-project-id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mock-project-id.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:000000000000:web:0000000000000000000000"
};

// Inizializziamo l'applicazione Firebase
const app = initializeApp(firebaseConfig);

// Esportiamo i servizi di autenticazione e database
export const auth = getAuth(app);
export const db = getFirestore(app);
export const isFirebaseMock = firebaseConfig.apiKey === "mock-api-key-replace-me-in-env-file";
export default app;
