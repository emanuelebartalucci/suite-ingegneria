import { collection, getDocs, doc, writeBatch, limit, query } from "firebase/firestore";

export const INITIAL_REGISTRY = [
  // Soci (Admin e non cancellabili)
  { email: "mcorbellini@ingegno06.it", name: "Corbellini Matteo", role: "admin", isSocio: true },
  { email: "aprofeti@ingegno06.it", name: "Profeti Andrea", role: "admin", isSocio: true },

  // Collaboratori P.IVA (ebartalucci@ingegno06.it elevato ad admin)
  { email: "dattanasio@ingegno06.it", name: "Attanasio Daniele", role: "user", isSocio: false },
  { email: "ebartalucci@ingegno06.it", name: "Bartalucci Emanuele", role: "admin", isSocio: false },
  { email: "mbiagioni@ingegno06.it", name: "Biagioni Matteo", role: "user", isSocio: false },
  { email: "mcappelli@ingegno06.it", name: "Cappelli Marco", role: "user", isSocio: false },
  { email: "mmancini@ingegno06.it", name: "Mancini Marco", role: "user", isSocio: false },
  { email: "dmarchetti@ingegno06.it", name: "Marchetti Davide", role: "user", isSocio: false },
  { email: "gmenichetti@ingegno06.it", name: "Menichetti Giulia", role: "user", isSocio: false },
  { email: "lmenichetti@ingegno06.it", name: "Menichetti Lorenzo", role: "user", isSocio: false },
  { email: "ppanchetti@ingegno06.it", name: "Panchetti Paolo", role: "user", isSocio: false },
  { email: "nrossi@ingegno06.it", name: "Rossi Niccolò", role: "user", isSocio: false },
  { email: "mrusso@ingegno06.it", name: "Russo Marco", role: "user", isSocio: false },
  { email: "lsignorini@ingegno06.it", name: "Signorini Leonardo", role: "user", isSocio: false },

  // Dipendenti
  { email: "fbadalassi@ingegno06.it", name: "Badalassi Federico", role: "user", isSocio: false },
  { email: "cballerini@ingegno06.it", name: "Ballerini Chiara", role: "user", isSocio: false },
  { email: "sboni@ingegno06.it", name: "Boni Serena", role: "user", isSocio: false },
  { email: "lbrotini@ingegno06.it", name: "Brotini Lucrezia", role: "user", isSocio: false },
  { email: "mcalugi@ingegno06.it", name: "Calugi Marta", role: "user", isSocio: false },
  { email: "acecca@ingegno06.it", name: "Cecca Antonella", role: "user", isSocio: false },
  { email: "lcolangelo@ingegno06.it", name: "Colangelo Luigi", role: "user", isSocio: false },
  { email: "fcritelli@ingegno06.it", name: "Critelli Federica", role: "user", isSocio: false },
  { email: "lfasano@ingegno06.it", name: "Fasano Lara", role: "user", isSocio: false },
  { email: "lgiusti@ingegno06.it", name: "Giusti Lorenzo", role: "user", isSocio: false },
  { email: "mgori@ingegno06.it", name: "Gori Matteo", role: "user", isSocio: false },
  { email: "llapi@ingegno06.it", name: "Lapi Lucia", role: "user", isSocio: false },
  { email: "plucchesi@ingegno06.it", name: "Lucchesi Paolo", role: "user", isSocio: false },
  { email: "vmannucci@ingegno06.it", name: "Mannucci Valentina", role: "user", isSocio: false },
  { email: "smenciassi@ingegno06.it", name: "Menciassi Simone", role: "user", isSocio: false },
  { email: "gorsi@ingegno06.it", name: "Orsi Giovanni", role: "user", isSocio: false },
  { email: "rostuni@ingegno06.it", name: "Ostuni Riccardo", role: "user", isSocio: false },
  { email: "mpapi@ingegno06.it", name: "Papi Mattia", role: "user", isSocio: false },
  { email: "eparenti@ingegno06.it", name: "Parenti Enrico", role: "user", isSocio: false },
  { email: "dpranzile@ingegno06.it", name: "Pranzile Daniele", role: "user", isSocio: false },
  { email: "crocchini@ingegno06.it", name: "Rocchini Carlotta", role: "user", isSocio: false },
  { email: "aromanello@ingegno06.it", name: "Romanello Andrea", role: "user", isSocio: false },
  { email: "tsabatini@ingegno06.it", name: "Sabatini Thomas", role: "user", isSocio: false },
  { email: "astefanelli@ingegno06.it", name: "Stefanelli Alessandro", role: "user", isSocio: false },
  { email: "lstefanelli@ingegno06.it", name: "Stefanelli Luca", role: "user", isSocio: false },
  { email: "ptaddei@ingegno06.it", name: "Taddei Paolo", role: "user", isSocio: false },
  { email: "gtempone@ingegno06.it", name: "Tempone Giulia", role: "user", isSocio: false },
  { email: "fturi@ingegno06.it", name: "Turi Francesca", role: "user", isSocio: false },
  { email: "culivieri@ingegno06.it", name: "Ulivieri Christian", role: "user", isSocio: false },
  { email: "fvotino@ingegno06.it", name: "Votino Federica", role: "user", isSocio: false }
];

export async function seedRegistryIfEmpty(db) {
  try {
    const q = query(collection(db, "anagrafica"), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      console.log("Seeding anagrafica collection in Firestore...");
      const batch = writeBatch(db);
      INITIAL_REGISTRY.forEach(user => {
        const ref = doc(db, "anagrafica", user.email.toLowerCase().trim());
        batch.set(ref, user);
      });
      await batch.commit();
      console.log("Seeding completed successfully.");
    }
  } catch (err) {
    console.error("Errore durante il seed dell'anagrafica:", err);
  }
}

export function getLocalRegistry() {
  const data = localStorage.getItem("demo_anagrafica");
  if (!data) {
    localStorage.setItem("demo_anagrafica", JSON.stringify(INITIAL_REGISTRY));
    return INITIAL_REGISTRY;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    localStorage.setItem("demo_anagrafica", JSON.stringify(INITIAL_REGISTRY));
    return INITIAL_REGISTRY;
  }
}

export function saveLocalRegistry(registry) {
  localStorage.setItem("demo_anagrafica", JSON.stringify(registry));
}

