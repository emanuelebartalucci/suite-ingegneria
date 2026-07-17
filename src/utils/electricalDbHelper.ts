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
      return;
    }

    // Verifichiamo se mancano i nuovi cavi, le formazioni o le nuove famiglie di condotti
    const fg16om16Doc = querySnapshot.docs.find(d => d.id === 'fg16om16');
    const isCablesOutdated = !fg16om16Doc || !fg16om16Doc.data().formations || fg16om16Doc.data().formations.length < 50;
    const hasNewCables = querySnapshot.docs.some(d => d.id === 'fg16r16');
    const hasPasserellaFilo = querySnapshot.docs.some(d => d.id === 'passerella_filo');
    const hasOlflex = querySnapshot.docs.some(d => d.id === 'olflex_classic_110_ch');

    if (isCablesOutdated || !hasNewCables || !hasPasserellaFilo || !hasOlflex) {
      console.log("Rilevata versione precedente o parziale su Firestore. Avvio allineamento complessivo (cavi e condotti)...");
      // Allineamento cavi
      for (const cavo of INITIAL_CABLES) {
        await setDoc(doc(db, COLLECTION_NAME, cavo.id), cavo);
      }
      // Allineamento contenitori
      for (const contenitore of INITIAL_CONTAINERS) {
        await setDoc(doc(db, COLLECTION_NAME, contenitore.id), contenitore);
      }
      console.log("Allineamento Firestore completato con successo!");
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
    const catalog = getLocalCatalog();
    const fg16om16 = catalog.cables.find(c => c.id === 'fg16om16');
    const isOutdated = !fg16om16 || !fg16om16.formations || fg16om16.formations.length < 50;
    const hasOlflex = catalog.cables.some(c => c.id === 'olflex_classic_110_ch');
    if (isOutdated || !catalog.cables.some(c => c.id === 'fg16r16') || !catalog.containers.some(c => c.id === 'passerella_filo') || !hasOlflex) {
      saveLocalCatalog(INITIAL_CABLES, INITIAL_CONTAINERS);
      return INITIAL_CABLES;
    }
    return catalog.cables;
  }
  
  try {
    const q = query(collection(db, COLLECTION_NAME), where("type", "==", "cavo"));
    const querySnapshot = await getDocs(q);
    
    // Se per qualche motivo il DB è vuoto, usa i dati iniziali
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

    // Se mancano i nuovi cavi o le formazioni su Firestore, allineiamo
    const fg16om16 = results.find(c => c.id === 'fg16om16');
    const isOutdated = !fg16om16 || fg16om16.formations.length < 50;
    const hasOlflex = results.some(c => c.id === 'olflex_classic_110_ch');

    if (isOutdated || !results.some(c => c.id === 'fg16r16') || !hasOlflex) {
      console.log("Rilevata assenza o versione parziale su Firestore, eseguo allineamento...");
      await seedElectricalCatalog(db);
      const updatedSnap = await getDocs(q);
      const updatedResults: CableProduct[] = [];
      updatedSnap.forEach(d => {
        updatedResults.push(d.data() as CableProduct);
      });
      return updatedResults;
    }
    
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
    const catalog = getLocalCatalog();
    if (!catalog.containers.some(c => c.id === 'passerella_filo')) {
      saveLocalCatalog(catalog.cables, INITIAL_CONTAINERS);
      return INITIAL_CONTAINERS;
    }
    return catalog.containers;
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

    if (!results.some(c => c.id === 'passerella_filo')) {
      console.log("Rilevata assenza di passerella_filo su Firestore, eseguo allineamento...");
      await seedElectricalCatalog(db);
      const updatedSnap = await getDocs(q);
      const updatedResults: ContainerFamily[] = [];
      updatedSnap.forEach(d => {
        updatedResults.push(d.data() as ContainerFamily);
      });
      return updatedResults;
    }
    
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
