const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAuSGpVV_I2pYgH_KFOPLG8J9R3mqP0PEs",
  authDomain: "suite-ingegneria-3621d.firebaseapp.com",
  projectId: "suite-ingegneria-3621d",
  storageBucket: "suite-ingegneria-3621d.firebasestorage.app",
  messagingSenderId: "991807979979",
  appId: "1:991807979979:web:cdcc10139efe9a86cb364e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  try {
    const snap = await getDocs(collection(db, "anagrafica"));
    console.log("Anagrafica entries:");
    snap.forEach(doc => {
      console.log(`- ID/Email: ${doc.id}, Name: ${doc.data().name}, Role: ${doc.data().role}`);
    });
  } catch (e) {
    console.error("Error reading anagrafica:", e.message);
  }
}

run();
