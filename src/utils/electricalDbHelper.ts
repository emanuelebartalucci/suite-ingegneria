import { 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { Firestore } from 'firebase/firestore';
import { 
  CableProduct, 
  ContainerFamily, 
  INITIAL_CABLES, 
  INITIAL_CONTAINERS 
} from '../data/electricalDatabase';

const COLLECTION_NAME = 'electrical_catalog';

// Helper per salvare la cache locale per demo
const getLocalCatalog = (): { cables: CableProduct[], containers: ContainerFamily[] } => {
  const data = localStorage.getItem('demo_electrical_catalog');
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("Errore nel parsing del catalogo locale:", e);
    }
  }
  return { cables: INITIAL_CABLES, containers: INITIAL_CONTAINERS };
};

const saveLocalCatalog = (cables: CableProduct[], containers: ContainerFamily[]) => {
  localStorage.setItem('demo_electrical_catalog', JSON.stringify({ cables, containers }));
};

/**
 * Esegue il seeding iniziale su Firestore se la collezione è vuota.
 */
export async function seedElectricalCatalog(db: Firestore): Promise<void> {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    if (querySnapshot.empty) {
      console.log("Inizializzazione electrical_catalog su Firestore...");
      
      // Upload cavi
      for (const cavo of INITIAL_CABLES) {
        await setDoc(doc(db, COLLECTION_NAME, cavo.id), cavo);
      }
      
      // Upload contenitori
      for (const contenitore of INITIAL_CONTAINERS) {
        await setDoc(doc(db, COLLECTION_NAME, contenitore.id), contenitore);
      }
      
      console.log("Seeding completato con successo!");
    }
  } catch (error) {
    console.error("Errore nel seeding del catalogo elettrico:", error);
  }
}

/**
 * Recupera i cavi da Firestore (o localStorage per modalità demo).
 */
export async function fetchElectricalCables(db: Firestore, isDemo: boolean): Promise<CableProduct[]> {
  if (isDemo) {
    return getLocalCatalog().cables;
  }
  
  try {
    const q = query(collection(db, COLLECTION_NAME), where("type", "==", "cavo"));
    const querySnapshot = await getDocs(q);
    
    // Se per qualche motivo il DB è vuoto e il seeding non è ancora scattato, usa i dati iniziali
    if (querySnapshot.empty) {
      await seedElectricalCatalog(db);
      const secondSnap = await getDocs(q);
      const results: CableProduct[] = [];
      secondSnap.forEach(d => {
        results.push(d.data() as CableProduct);
      });
      return results;
    }
    
    const results: CableProduct[] = [];
    querySnapshot.forEach(d => {
      results.push(d.data() as CableProduct);
    });
    return results;
  } catch (e) {
    console.error("Errore recupero cavi da Firestore, uso fallback locale:", e);
    return INITIAL_CABLES;
  }
}

/**
 * Recupera i contenitori da Firestore (o localStorage per modalità demo).
 */
export async function fetchElectricalContainers(db: Firestore, isDemo: boolean): Promise<ContainerFamily[]> {
  if (isDemo) {
    return getLocalCatalog().containers;
  }
  
  try {
    const q = query(collection(db, COLLECTION_NAME), where("type", "==", "contenitore"));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      await seedElectricalCatalog(db);
      const secondSnap = await getDocs(q);
      const results: ContainerFamily[] = [];
      secondSnap.forEach(d => {
        results.push(d.data() as ContainerFamily);
      });
      return results;
    }
    
    const results: ContainerFamily[] = [];
    querySnapshot.forEach(d => {
      results.push(d.data() as ContainerFamily);
    });
    return results;
  } catch (e) {
    console.error("Errore recupero contenitori da Firestore, uso fallback locale:", e);
    return INITIAL_CONTAINERS;
  }
}

/**
 * Salva o aggiorna un articolo nel database (cavo o contenitore).
 */
export async function saveElectricalItem(
  db: Firestore, 
  isDemo: boolean, 
  item: CableProduct | ContainerFamily
): Promise<void> {
  if (isDemo) {
    const catalog = getLocalCatalog();
    if (item.type === 'cavo') {
      const idx = catalog.cables.findIndex(c => c.id === item.id);
      if (idx >= 0) catalog.cables[idx] = item as CableProduct;
      else catalog.cables.push(item as CableProduct);
    } else {
      const idx = catalog.containers.findIndex(c => c.id === item.id);
      if (idx >= 0) catalog.containers[idx] = item as ContainerFamily;
      else catalog.containers.push(item as ContainerFamily);
    }
    saveLocalCatalog(catalog.cables, catalog.containers);
    return;
  }
  
  try {
    await setDoc(doc(db, COLLECTION_NAME, item.id), item);
  } catch (e) {
    console.error("Errore nel salvataggio su Firestore:", e);
    throw e;
  }
}

/**
 * Elimina un articolo dal database.
 */
export async function deleteElectricalItem(
  db: Firestore, 
  isDemo: boolean, 
  itemId: string, 
  type: 'cavo' | 'contenitore'
): Promise<void> {
  if (isDemo) {
    const catalog = getLocalCatalog();
    if (type === 'cavo') {
      catalog.cables = catalog.cables.filter(c => c.id !== itemId);
    } else {
      catalog.containers = catalog.containers.filter(c => c.id !== itemId);
    }
    saveLocalCatalog(catalog.cables, catalog.containers);
    return;
  }
  
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, itemId));
  } catch (e) {
    console.error("Errore nella cancellazione da Firestore:", e);
    throw e;
  }
}
