import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Carichiamo le variabili d'ambiente di Vite. Se non sono definite, usiamo valori fittizi (placeholder)
// in modo da evitare il crash dell'applicazione a runtime prima che l'utente inserisca le sue chiavi nel file .env
const firebaseConfig: FirebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || "mock-api-key-replace-me-in-env-file",
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || "mock-project-id.firebaseapp.com",
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || "mock-project-id",
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || "mock-project-id.appspot.com",
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || "000000000000",
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || "1:000000000000:web:0000000000000000000000"
};

// Inizializziamo l'applicazione Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);

// Esportiamo i servizi di autenticazione e database
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const isFirebaseMock: boolean = firebaseConfig.apiKey === "mock-api-key-replace-me-in-env-file";
export default app;
