import { 
  collection, 
  getDoc, 
  setDoc, 
  doc 
} from 'firebase/firestore';
import { Firestore } from 'firebase/firestore';

// Importazione dei dati statici iniziali
import { PIPE_CATALOG, PipeMaterial } from '../data/pipeCatalog';
import { EQUIVALENT_LENGTHS_TABLE, EquivalentLengthPiece } from '../data/equivalentLengths';
import { GAS_EQUIVALENT_LENGTHS } from '../data/gasEquivalentLengths';
import { CLIMATE_DATA, ProvinceClimateData } from '../data/climateData';

const COLLECTION_NAME = 'thermodynamic_catalog';

/**
 * Esegue il seeding iniziale delle tabelle termoidrauliche su Firestore se non esistono.
 */
export async function seedThermodynamicCatalog(db: Firestore): Promise<void> {
  try {
    const docsToSeed = [
      { id: 'pipe_catalog', defaultData: PIPE_CATALOG },
      { id: 'equivalent_lengths', defaultData: EQUIVALENT_LENGTHS_TABLE },
      { id: 'gas_equivalent_lengths', defaultData: GAS_EQUIVALENT_LENGTHS },
      { id: 'climate_data', defaultData: CLIMATE_DATA }
    ];

    for (const d of docsToSeed) {
      const docRef = doc(db, COLLECTION_NAME, d.id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        console.log(`Seeding database termoidraulico: ${d.id}...`);
        const cleanedData = JSON.parse(JSON.stringify(d.defaultData));
        await setDoc(docRef, { data: cleanedData });
      }
    }
    console.log("Seeding termoidraulico completato!");
  } catch (error) {
    console.error("Errore nel seeding termoidraulico:", error);
  }
}

// Mappatura delle formule matematiche per evitare di salvare funzioni in Firestore
const FORMULA_MAP: Record<string, (dn: number) => number> = {
  valvola_diaframma: (dn: number) => 0.069 * dn - 0.6766,
  curva_d: (dn: number) => 0.0173 * dn - 0.2022,
  innesto_t: (dn: number) => 0.1363 * dn - 2.2915,
  riduzione: (dn: number) => 0.0293 * dn - 0.3547
};


/**
 * Recupera il catalogo tubi (pipeCatalog).
 */
export async function fetchPipeCatalog(db: Firestore, isDemo: boolean): Promise<Record<string, PipeMaterial>> {
  if (isDemo) {
    const local = localStorage.getItem('demo_pipe_catalog');
    return local ? JSON.parse(local) : PIPE_CATALOG;
  }
  try {
    const docRef = doc(db, COLLECTION_NAME, 'pipe_catalog');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().data as Record<string, PipeMaterial>;
    } else {
      await seedThermodynamicCatalog(db);
      return PIPE_CATALOG;
    }
  } catch (e) {
    console.error("Errore lettura pipe_catalog da Firestore, uso fallback statico:", e);
    return PIPE_CATALOG;
  }
}

/**
 * Salva il catalogo tubi (pipeCatalog).
 */
export async function savePipeCatalog(db: Firestore, isDemo: boolean, data: Record<string, PipeMaterial>): Promise<void> {
  if (isDemo) {
    localStorage.setItem('demo_pipe_catalog', JSON.stringify(data));
    return;
  }
  try {
    const docRef = doc(db, COLLECTION_NAME, 'pipe_catalog');
    await setDoc(docRef, { data });
  } catch (e) {
    console.error("Errore nel salvataggio pipe_catalog su Firestore:", e);
    throw e;
  }
}

export async function fetchEquivalentLengths(db: Firestore, isDemo: boolean): Promise<Record<string, EquivalentLengthPiece>> {
  let rawData: Record<string, EquivalentLengthPiece>;
  if (isDemo) {
    const local = localStorage.getItem('demo_equivalent_lengths');
    rawData = local ? JSON.parse(local) : EQUIVALENT_LENGTHS_TABLE;
  } else {
    try {
      const docRef = doc(db, COLLECTION_NAME, 'equivalent_lengths');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        rawData = docSnap.data().data as Record<string, EquivalentLengthPiece>;
      } else {
        await seedThermodynamicCatalog(db);
        rawData = EQUIVALENT_LENGTHS_TABLE;
      }
    } catch (e) {
      console.error("Errore lettura equivalent_lengths da Firestore, uso fallback statico:", e);
      rawData = EQUIVALENT_LENGTHS_TABLE;
    }
  }

  // Ricostruisce le funzioni formula non memorizzabili in Firestore
  const resolved = { ...rawData };
  Object.keys(resolved).forEach(key => {
    if (FORMULA_MAP[key]) {
      resolved[key] = {
        ...resolved[key],
        formula: FORMULA_MAP[key]
      };
    }
  });
  return resolved;
}

/**
 * Salva le lunghezze equivalenti fluidi.
 */
export async function saveEquivalentLengths(db: Firestore, isDemo: boolean, data: Record<string, EquivalentLengthPiece>): Promise<void> {
  const cleanedData = JSON.parse(JSON.stringify(data));
  if (isDemo) {
    localStorage.setItem('demo_equivalent_lengths', JSON.stringify(cleanedData));
    return;
  }
  try {
    const docRef = doc(db, COLLECTION_NAME, 'equivalent_lengths');
    await setDoc(docRef, { data: cleanedData });
  } catch (e) {
    console.error("Errore salvataggio equivalent_lengths su Firestore:", e);
    throw e;
  }
}


/**
 * Recupera le lunghezze equivalenti gas.
 */
export async function fetchGasEquivalentLengths(db: Firestore, isDemo: boolean): Promise<Record<string, Record<number, number>>> {
  if (isDemo) {
    const local = localStorage.getItem('demo_gas_equivalent_lengths');
    return local ? JSON.parse(local) : GAS_EQUIVALENT_LENGTHS;
  }
  try {
    const docRef = doc(db, COLLECTION_NAME, 'gas_equivalent_lengths');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().data as Record<string, Record<number, number>>;
    } else {
      await seedThermodynamicCatalog(db);
      return GAS_EQUIVALENT_LENGTHS;
    }
  } catch (e) {
    console.error("Errore lettura gas_equivalent_lengths da Firestore, uso fallback statico:", e);
    return GAS_EQUIVALENT_LENGTHS;
  }
}

/**
 * Salva le lunghezze equivalenti gas.
 */
export async function saveGasEquivalentLengths(db: Firestore, isDemo: boolean, data: Record<string, Record<number, number>>): Promise<void> {
  if (isDemo) {
    localStorage.setItem('demo_gas_equivalent_lengths', JSON.stringify(data));
    return;
  }
  try {
    const docRef = doc(db, COLLECTION_NAME, 'gas_equivalent_lengths');
    await setDoc(docRef, { data });
  } catch (e) {
    console.error("Errore salvataggio gas_equivalent_lengths su Firestore:", e);
    throw e;
  }
}

/**
 * Recupera i dati climatici.
 */
export async function fetchClimateData(db: Firestore, isDemo: boolean): Promise<ProvinceClimateData[]> {
  if (isDemo) {
    const local = localStorage.getItem('demo_climate_data');
    return local ? JSON.parse(local) : CLIMATE_DATA;
  }
  try {
    const docRef = doc(db, COLLECTION_NAME, 'climate_data');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().data as ProvinceClimateData[];
    } else {
      await seedThermodynamicCatalog(db);
      return CLIMATE_DATA;
    }
  } catch (e) {
    console.error("Errore lettura climate_data da Firestore, uso fallback statico:", e);
    return CLIMATE_DATA;
  }
}

/**
 * Salva i dati climatici.
 */
export async function saveClimateData(db: Firestore, isDemo: boolean, data: ProvinceClimateData[]): Promise<void> {
  if (isDemo) {
    localStorage.setItem('demo_climate_data', JSON.stringify(data));
    return;
  }
  try {
    const docRef = doc(db, COLLECTION_NAME, 'climate_data');
    await setDoc(docRef, { data });
  } catch (e) {
    console.error("Errore salvataggio climate_data su Firestore:", e);
    throw e;
  }
}
