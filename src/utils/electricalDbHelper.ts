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

    // Rileva se il DB ha ancora le vecchie etichette nel formato HxL
    const passerellaFiloDoc = querySnapshot.docs.find(d => d.id === 'passerella_filo');
    const hasOldLabel = !!passerellaFiloDoc && (passerellaFiloDoc.data().sizes || []).some((sz: any) => sz.label === '54x100');

    // Rileva se i contenitori hanno le nuove etichette col prefisso DN
    const tuboFlessibileDoc = querySnapshot.docs.find(d => d.id === 'tubo_flessibile');
    const hasDnLabels = !!tuboFlessibileDoc && (tuboFlessibileDoc.data().sizes || []).some((sz: any) => sz.label && sz.label.startsWith('DN '));

    // Rileva se mancano i nuovi cavi
    const has6undhpn = querySnapshot.docs.some(d => d.id === '6undhpn');
    const hasRg26 = querySnapshot.docs.some(d => d.id === 'rg26h1m16_12_20kv');

    // Rileva se manca la proprietà raggioCurvaturaMinFattore
    const hasBending = fg16om16Doc && fg16om16Doc.data().raggioCurvaturaMinFattore !== undefined;

    // Rileva se i cavi hanno ancora i vecchi nomi
    const doc6undhpn = querySnapshot.docs.find(d => d.id === '6undhpn');
    const docSf225rz = querySnapshot.docs.find(d => d.id === 'sf225rz');
    const hasNewNames = doc6undhpn && doc6undhpn.data().name === 'Cat. 6 UTP Reti LAN Posa Esterno' &&
                        docSf225rz && docSf225rz.data().name === 'FTE32OHAM16';

    if (isCablesOutdated || !hasNewCables || !hasPasserellaFilo || !hasOlflex || hasOldLabel || !has6undhpn || !hasRg26 || !hasBending || !hasNewNames || !hasDnLabels) {
      console.log("Rilevata versione precedente, parziale, con formato etichette, raggio curvatura o nomi obsoleti su Firestore. Avvio allineamento complessivo (cavi e condotti)...");
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
  let list: CableProduct[] = [];
  if (isDemo) {
    const catalog = getLocalCatalog();
    const fg16om16 = catalog.cables.find(c => c.id === 'fg16om16');
    const isOutdated = !fg16om16 || !fg16om16.formations || fg16om16.formations.length < 50;
    const hasOlflex = catalog.cables.some(c => c.id === 'olflex_classic_110_ch');
    const hasOldLabel = catalog.containers.some(c => c.id === 'passerella_filo' && (c.sizes || []).some(sz => sz.label === '54x100'));
    const has6undhpn = catalog.cables.some(c => c.id === '6undhpn');
    const hasRg26 = catalog.cables.some(c => c.id === 'rg26h1m16_12_20kv');
    const hasBending = fg16om16 && fg16om16.raggioCurvaturaMinFattore !== undefined;
    const hasNewNames = catalog.cables.some(c => c.id === '6undhpn' && c.name === 'Cat. 6 UTP Reti LAN Posa Esterno') &&
                        catalog.cables.some(c => c.id === 'sf225rz' && c.name === 'FTE32OHAM16');
    const hasDnLabels = catalog.containers.some(c => c.id === 'tubo_flessibile' && (c.sizes || []).some(sz => sz.label && sz.label.startsWith('DN ')));

    if (isOutdated || !catalog.cables.some(c => c.id === 'fg16r16') || !catalog.containers.some(c => c.id === 'passerella_filo') || !hasOlflex || hasOldLabel || !has6undhpn || !hasRg26 || !hasBending || !hasNewNames || !hasDnLabels) {
      saveLocalCatalog(INITIAL_CABLES, INITIAL_CONTAINERS);
      list = INITIAL_CABLES;
    } else {
      list = catalog.cables;
    }
  } else {
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
        list = results;
      } else {
        const results: CableProduct[] = [];
        querySnapshot.forEach(d => {
          results.push(d.data() as CableProduct);
        });

        // Se mancano i nuovi cavi o le formazioni su Firestore, allineiamo
        const fg16om16 = results.find(c => c.id === 'fg16om16');
        const isOutdated = !fg16om16 || fg16om16.formations.length < 50;
        const hasOlflex = results.some(c => c.id === 'olflex_classic_110_ch');
        const has6undhpn = results.some(c => c.id === '6undhpn');
        const hasRg26 = results.some(c => c.id === 'rg26h1m16_12_20kv');
        const hasBending = fg16om16 && fg16om16.raggioCurvaturaMinFattore !== undefined;
        const hasNewNames = results.some(c => c.id === '6undhpn' && c.name === 'Cat. 6 UTP Reti LAN Posa Esterno') &&
                            results.some(c => c.id === 'sf225rz' && c.name === 'FTE32OHAM16');

        if (isOutdated || !results.some(c => c.id === 'fg16r16') || !hasOlflex || !has6undhpn || !hasRg26 || !hasBending || !hasNewNames) {
          console.log("Rilevata assenza, versione parziale o vecchi nomi su Firestore, eseguo allineamento...");
          await seedElectricalCatalog(db);
          const updatedSnap = await getDocs(q);
          const updatedResults: CableProduct[] = [];
          updatedSnap.forEach(d => {
            updatedResults.push(d.data() as CableProduct);
          });
          list = updatedResults;
        } else {
          list = results;
        }
      }
    } catch (e) {
      console.error("Errore recupero cavi da Firestore, uso fallback locale:", e);
      list = INITIAL_CABLES;
    }
  }

  // Ordina alfabeticamente in modo naturale e case-insensitive
  return [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

/**
 * Recupera i contenitori da Firestore (o localStorage per modalità demo).
 */
export async function fetchElectricalContainers(db: Firestore, isDemo: boolean): Promise<ContainerFamily[]> {
  if (isDemo) {
    const catalog = getLocalCatalog();
    const hasOldLabel = catalog.containers.some(c => c.id === 'passerella_filo' && (c.sizes || []).some(sz => sz.label === '54x100'));
    if (!catalog.containers.some(c => c.id === 'passerella_filo') || hasOldLabel) {
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

/**
 * Hash deterministico DJB2 della stringa ID del cavo.
 * Restituisce un numero intero unsigned a 32 bit usato come seme per la generazione del colore.
 */
function hashCableId(id: string): number {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) + hash) ^ id.charCodeAt(i);
    hash = hash >>> 0; // Forza conversione a Uint32 per evitare overflow negativi
  }
  return hash;
}

/**
 * Ritorna un colore standard per il cavo basato sulla sua categoria/sigla per uniformità tra i vari tool.
 *
 * CODIFICA CROMATICA PER MACRO-CATEGORIA:
 *  - Media Tensione (MT) → palette rossa  (hue 0–20)
 *  - Resistenti al Fuoco → palette arancione (hue 24–40)
 *  - Dati / Segnale      → palette blu   (hue 210–240)
 *  - Bassa Tensione (BT) → palette verde  (hue 100–165)
 *  - Personalizzato      → grigio neutro  #64748b
 *
 * All'interno di ogni macro-categoria la sfumatura è DETERMINISTICA sull'ID del cavo
 * tramite un hash DJB2, così lo stesso cavo mantiene identico colore in tutte le schermate.
 */
export function getCableColor(cableId: string): string {
  // Personalizzato – grigio fisso
  if (cableId === 'personalizzato') return '#64748b';

  const seed = hashCableId(cableId);
  // Valore normalizzato [0, 1) per variare la sfumatura
  const t = (seed % 1000) / 1000;

  // Media Tensione (MT) → hue 0–18, sat 70–85%, lit 40–50%
  if (cableId.startsWith('rg26')) {
    const h = Math.round(0  + t * 18);
    const s = Math.round(70 + t * 15);
    const l = Math.round(40 + t * 10);
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  // Resistenti al Fuoco → hue 24–40, sat 85–95%, lit 45–55%
  if (['fte29ohm16', 'ftg18om16', 'fts29om16', 'sf225rz'].includes(cableId)) {
    const h = Math.round(24 + t * 16);
    const s = Math.round(85 + t * 10);
    const l = Math.round(45 + t * 10);
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  // Dati / Segnale → hue 210–240, sat 65–80%, lit 44–54%
  if (['futp_cat6', 'futp_cat6a', '6undhpn', '12s1yvi'].includes(cableId)) {
    const h = Math.round(210 + t * 30);
    const s = Math.round(65  + t * 15);
    const l = Math.round(44  + t * 10);
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  // Bassa Tensione (BT) – fallback → hue 100–162, sat 45–65%, lit 36–50%
  const h = Math.round(100 + t * 62);
  const s = Math.round(45  + t * 20);
  const l = Math.round(36  + t * 14);
  return `hsl(${h}, ${s}%, ${l}%)`;
}
