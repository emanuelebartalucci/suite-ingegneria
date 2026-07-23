import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, isFirebaseMock } from '../firebase/config';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import { formatNumber } from '../utils/format';
import { fetchElectricalCables, getCableColor } from '../utils/electricalDbHelper';
import { CableProduct, ContainerFamily, INITIAL_CONTAINERS, CAVIDOTTI_DOPPIA_PARETE, POZZETTI_CLS_PRESETS, PozzettoClsPreset, CavidottoDoppiaParete } from '../data/electricalDatabase';
import { 
  Plus, 
  Trash2, 
  Save, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  Info,
  CheckCircle,
  XCircle,
  Copy,
  Grid,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ToolDimensionamentoPozzettiElettriciProps {
  projectData: ProjectData;
  setProjectData: (data: any) => void;
  setAppMode: (mode: string) => void;
  cablesCatalog?: CableProduct[];
  containersCatalog?: ContainerFamily[];
  importedCables?: any | null;
  clearImportedCables?: () => void;
}

export interface CavoSelezionatoPozzetto {
  cableId: string;              // ID del tipo cavo o 'personalizzato'
  sigla?: string;               // Sigla/Riferimento (es. '01')
  formation: string;            // Formazione scelta
  diameter: number;             // Diametro esterno in mm
  weight: number;               // Peso in kg/m
  qty: number;                  // Quantità
  customBendingFactor?: number; // Fattore k personalizzato se cavo personalizzato
  destinationSide?: 'sx' | 'dx' | 'alto' | 'basso'; // Lato di uscita specifico per il cavo
  destinationFamilyId?: string; // Famiglia del condotto di uscita per il cavo
  destinationSizeCode?: string; // Taglia/Misura del condotto di uscita per il cavo
  destinationConduitId?: string; // ID del condotto di uscita condiviso (es. 'exit_dx_1')
}

export interface GruppoCavidotto {
  id: string;
  familyId?: string;           // ID famiglia dal catalogo o 'cavidotto'/'canala_pvc'/etc.
  familyName?: string;         // Nome descrittivo (es. "Passerella metallica P31+", "Canale PVC", ecc.)
  sizeCode?: string;           // Codice della taglia scelta nel catalogo (es. 'CEFD90', 'P31_100x50', ecc.)
  sectionType?: 'circolare' | 'rettangolare'; // Tipo sezione
  width?: number;              // Larghezza in mm (se rettangolare)
  height?: number;             // Altezza in mm (se rettangolare)
  dn: number;                  // DN nominale (es. 50, 63, 90, 110, 125, 160, 200) o dimensione caratteristica
  outerDiameter: number;       // OD (mm) o Larghezza esterna
  innerDiameter: number;       // ID (mm) o Altezza interna
  bendingFactor: number;       // default 8 per tubi, 6 per canali
  qty: number;                 // numero di condotti/canali paralleli
  cables: CavoSelezionatoPozzetto[];
  destinationSide?: 'sx' | 'dx' | 'alto' | 'basso';
  destinationFamilyId?: string;
  destinationSizeCode?: string;
  destinationConduitId?: string;
}

export interface EgressConduitDef {
  id: string;
  tag: string;
  side: 'sx' | 'dx' | 'alto' | 'basso';
  familyId: string;
  sizeCode: string;
  cablesCount: number;
}

export function getEgressConduitsForPozzetto(
  pozzetto: PozzettoProgetto,
  targetSide: 'sx' | 'dx' | 'alto' | 'basso',
  containersCatalog?: ContainerFamily[]
): EgressConduitDef[] {
  if (!pozzetto) return [];
  const pareti = ensurePozzettoPareti(pozzetto);
  const map = new Map<string, EgressConduitDef>();

  pareti.forEach(w => {
    w.cavidotti.forEach(cond => {
      cond.cables.forEach(c => {
        const destSide = c.destinationSide;
        if (destSide === targetSide) {
          const id = c.destinationConduitId || `exit_${targetSide}_${cond.id}`;
          const famId = c.destinationFamilyId || 'cavidotto';
          const sizeCode = c.destinationSizeCode || 'CEFD90';

          if (!map.has(id)) {
            const tagNumber = map.size + 1;
            map.set(id, {
              id,
              tag: `Condotto #${tagNumber}`,
              side: targetSide,
              familyId: famId,
              sizeCode: sizeCode,
              cablesCount: c.qty
            });
          } else {
            const entry = map.get(id)!;
            entry.cablesCount += c.qty;
          }
        }
      });
    });
  });

  return Array.from(map.values());
}

export function resolveContainerSize(
  familyId: string | undefined,
  sizeCode: string | undefined,
  containersCatalog?: ContainerFamily[]
) {
  const catalog = (containersCatalog && containersCatalog.length > 0) ? containersCatalog : INITIAL_CONTAINERS;
  const fam = catalog.find(f => f.id === familyId) || catalog.find(f => f.id === 'cavidotto') || catalog[0];
  const isRect = fam?.sectionType === 'rettangolare';
  const sizes = fam?.sizes || [];
  const sz = sizes.find(s => s.code === sizeCode) || sizes[0];

  if (sz) {
    const isSzRect = isRect || Boolean(sz.width && sz.height);
    return {
      familyId: fam?.id || familyId || 'cavidotto',
      familyName: fam?.name || 'Canalizzazione',
      sizeCode: sz.code,
      sectionType: (isSzRect ? 'rettangolare' : 'circolare') as 'rettangolare' | 'circolare',
      width: sz.width,
      height: sz.height,
      dn: (sz as any).dn || sz.outerDiameter || (sz.width ? sz.width : 90),
      outerDiameter: sz.outerDiameter || (sz.width ? sz.width : 90),
      innerDiameter: sz.innerDiameter || (sz.height ? sz.height : 75),
      bendingFactor: isSzRect ? 6 : 8
    };
  }

  return {
    familyId: familyId || 'cavidotto',
    familyName: fam?.name || 'Cavidotto Doppia Parete',
    sizeCode: 'CEFD90',
    sectionType: 'circolare' as const,
    dn: 90,
    outerDiameter: 90,
    innerDiameter: 75,
    bendingFactor: 8
  };
}

export function getConduitLabel(cond: GruppoCavidotto): string {
  const isRect = cond.sectionType === 'rettangolare' || Boolean(cond.width && cond.height);
  if (cond.familyName) {
    if (isRect && cond.width && cond.height) {
      return `${cond.familyName} ${cond.width}x${cond.height} mm`;
    }
    return `${cond.familyName} (DN ${cond.dn})`;
  }
  if (isRect && cond.width && cond.height) {
    return `Canale Rettangolare ${cond.width}x${cond.height} mm`;
  }
  return `Cavidotto DN ${cond.dn} (Est: ${cond.outerDiameter}, Int: ${cond.innerDiameter} mm)`;
}

export interface ParetePozzetto {
  id: string;
  side: 'sx' | 'dx' | 'alto' | 'basso';
  label: string;
  cavidotti: GruppoCavidotto[];
  destinationSide?: 'sx' | 'dx' | 'alto' | 'basso';
}

export interface PozzettoProgetto {
  tag: string;                  // ID univoco (es. 'P1')
  name: string;                 // Nome pozzetto
  shape: 'rettangolare' | 'cilindrico';
  // Geometria Rettangolare
  baseB: number;                // in cm (Esterna)
  lengthL: number;              // in cm (Esterna)
  // Geometria Cilindrica
  diameterD: number;            // in cm (Esterna)
  // Altezza comune
  depthH: number;               // in cm (Esterna)
  presetSize: string;           // 'POZZET05', 'custom', ecc.
  scortaPct: number;            // maggiorazione ricchezza cavo (default 25%)
  cables: CavoSelezionatoPozzetto[]; // Deprecato, tenuto solo per compatibilità JSON
  pareti: ParetePozzetto[];     // Nuova configurazione a pareti
}

interface ToolState {
  pozzetti: PozzettoProgetto[];
  activePozzettoTag: string;
}

export function ensurePozzettoPareti(p: any): ParetePozzetto[] {
  if (p.pareti && p.pareti.length > 0) {
    const sides: ('sx' | 'dx' | 'alto' | 'basso')[] = ['sx', 'dx', 'alto', 'basso'];
    const labels = {
      sx: 'Lato Sinistro (Arrivo)',
      dx: 'Lato Destro (Partenza)',
      alto: 'Lato Superiore',
      basso: 'Lato Inferiore'
    };
    return sides.map(side => {
      const existing = p.pareti.find((w: any) => w.side === side);
      if (existing) {
        // Forza tipi ed esplicito sectionType
        return {
          id: existing.id || `parete_${side}_${Date.now()}`,
          side,
          label: existing.label || labels[side],
          destinationSide: existing.destinationSide,
          cavidotti: Array.isArray(existing.cavidotti) ? existing.cavidotti.map((c: any) => ({
            ...c,
            sectionType: c.sectionType || (c.width && c.height && !c.outerDiameter ? 'rettangolare' : 'circolare')
          })) : []
        };
      }
      return {
        id: `parete_${side}_${Date.now()}`,
        side,
        label: labels[side],
        cavidotti: []
      };
    });
  }

  // Migrazione: sposta i cavi esistenti in un corrugato default DN90 sul lato sx
  const defaultCables = Array.isArray(p.cables) ? p.cables : [];
  return [
    {
      id: `parete_sx_${Date.now()}`,
      side: 'sx',
      label: 'Lato Sinistro (Arrivo)',
      destinationSide: undefined,
      cavidotti: defaultCables.length > 0 ? [
        {
          id: `cond_mig_${Date.now()}`,
          familyId: 'cavidotto',
          familyName: 'Cavidotto doppia parete',
          sectionType: 'circolare',
          sizeCode: 'CEFD090',
          dn: 90,
          outerDiameter: 90,
          innerDiameter: 77,
          bendingFactor: 8,
          qty: 1,
          cables: defaultCables
        }
      ] : []
    },
    { id: `parete_dx_${Date.now()}`, side: 'dx', label: 'Lato Destro (Partenza)', cavidotti: [] },
    { id: `parete_alto_${Date.now()}`, side: 'alto', label: 'Lato Superiore', cavidotti: [] },
    { id: `parete_basso_${Date.now()}`, side: 'basso', label: 'Lato Inferiore', cavidotti: [] }
  ];
}

const defaultState: ToolState = {
  pozzetti: [
    {
      tag: 'P1',
      name: 'Pozzetto 1',
      shape: 'rettangolare',
      baseB: 60,
      lengthL: 60,
      diameterD: 60,
      depthH: 60,
      presetSize: 'POZZET05',
      scortaPct: 25,
      cables: [],
      pareti: [
        { id: 'p_sx_init', side: 'sx', label: 'Lato Sinistro (Arrivo)', cavidotti: [] },
        { id: 'p_dx_init', side: 'dx', label: 'Lato Destro (Partenza)', cavidotti: [] },
        { id: 'p_alto_init', side: 'alto', label: 'Lato Superiore', cavidotti: [] },
        { id: 'p_basso_init', side: 'basso', label: 'Lato Inferiore', cavidotti: [] }
      ]
    }
  ],
  activePozzettoTag: 'P1'
};

export function regeneratePozzettiTags(pozzetti: PozzettoProgetto[]): PozzettoProgetto[] {
  return pozzetti.map((p, index) => {
    const newTag = `P${index + 1}`;
    // Rinomina il pozzetto solo se ha il nome di default o quello d'importazione
    const hasDefaultName = p.name.startsWith('Pozzetto ') || 
                           p.name === p.tag || 
                           p.name === 'Pozzetto da Importazione' ||
                           /^P\d+$/.test(p.name);
    const newName = hasDefaultName ? `Pozzetto ${index + 1}` : p.name;
    return {
      ...p,
      tag: newTag,
      name: newName
    };
  });
}

export function calcolaCompliancePozzetto(p: PozzettoProgetto, cablesCatalog: CableProduct[], containersCatalog?: ContainerFamily[]) {
  if (!p) return null;

  // Assicura che le pareti siano popolate ed integre
  const pareti = ensurePozzettoPareti(p);

  // 1. Ricerca Preset per dimensioni interne ed esterne reali
  const preset = POZZETTI_CLS_PRESETS.find(item => item.code === p.presetSize);
  const innerB = preset ? preset.innerBaseB : (p.shape === 'rettangolare' ? p.baseB - 10 : p.diameterD - 10);
  const innerL = preset ? preset.innerLengthL : (p.shape === 'rettangolare' ? p.lengthL - 10 : p.diameterD - 10);
  const innerH = preset ? preset.innerDepthH : p.depthH - 10;

  // Volume interno Pozzetto in cm^3
  let volumePozzetto = 0;
  if (p.shape === 'rettangolare') {
    volumePozzetto = innerB * innerL * innerH;
  } else {
    volumePozzetto = Math.PI * Math.pow(innerB / 2, 2) * innerH;
  }

  // 2. Calcoli aggregati per tutti i cavi di tutte le pareti (evitando doppi conteggi)
  let a_tot = 0;
  let pesoTotCaviLineare = 0;
  let dMax = 0;
  let globalMaxRMin = 0;
  let maxRMinCableName = '';

  pareti.forEach(w => {
    w.cavidotti.forEach(cond => {
      cond.cables.forEach(c => {
        const dExtCavoCm = c.diameter / 10;
        const areaCavo = Math.PI * Math.pow(dExtCavoCm / 2, 2);
        a_tot += areaCavo * c.qty;
        pesoTotCaviLineare += c.weight * c.qty;
        if (c.diameter > dMax) {
          dMax = c.diameter;
        }
      });
    });
  });
  // Informazioni di conformità per ciascuna parete
  const CORNER_MARGIN_CM = 5; // Margine di rispetto standard da ciascun angolo interno per carotaggi/spalla pareti adiacenti
  let totalConduitsOuterAreaGlobal = 0;

  const paretiCompliance = pareti.map(w => {
    const wallArea = (w.side === 'sx' || w.side === 'dx') ? innerL * innerH : innerB * innerH;
    const wallW = (w.side === 'sx' || w.side === 'dx') ? innerL : innerB;
    const wallWUtile = Math.max(0, wallW - 2 * CORNER_MARGIN_CM);

    let conduitsOuterArea = 0;
    let totalConduitsWidthCm = 0;
    let wallMaxRMin = 0;
    let wallMaxRMinName = '';

    // Raccoglie sia i cavidotti in ingresso su questa parete,
    // sia i cavidotti in uscita da altre pareti che escono da questa
    const ingressCavidotti = w.cavidotti;
    const egressMap = new Map<string, GruppoCavidotto>();

    pareti.forEach(otherW => {
      if (otherW.side === w.side) return;
      otherW.cavidotti.forEach(otherCond => {
        otherCond.cables.forEach(c => {
          const destSide = c.destinationSide;
          if (destSide === w.side) {
            const destFamId = c.destinationFamilyId || 'cavidotto';
            const destSizeCode = c.destinationSizeCode || 'CEFD90';
            const conduitId = c.destinationConduitId || `exit_${w.side}_${otherCond.id}`;
            const geom = resolveContainerSize(destFamId, destSizeCode, containersCatalog);

            if (!egressMap.has(conduitId)) {
              egressMap.set(conduitId, {
                id: conduitId,
                familyId: geom.familyId,
                familyName: geom.familyName,
                sizeCode: geom.sizeCode,
                sectionType: geom.sectionType,
                width: geom.width,
                height: geom.height,
                dn: geom.dn,
                outerDiameter: geom.outerDiameter,
                innerDiameter: geom.innerDiameter,
                bendingFactor: geom.bendingFactor,
                qty: 1,
                cables: [c],
                destinationSide: undefined
              });
            } else {
              egressMap.get(conduitId)!.cables.push(c);
            }
          }
        });
      });
    });

    const egressCavidotti = Array.from(egressMap.values());
    const allCavidotti = [...ingressCavidotti, ...egressCavidotti];

    allCavidotti.forEach(cond => {
      // Sezione esterna e larghezza del cavidotto/canale in cm
      const isRect = cond.sectionType === 'rettangolare';
      let condOuterSec = 0;
      let condWCm = 0;
      if (isRect) {
        condWCm = (cond.width || cond.outerDiameter || 100) / 10;
        const hCm = (cond.height || cond.innerDiameter || 75) / 10;
        condOuterSec = (condWCm * hCm) * cond.qty;
      } else {
        const dExtCm = (cond.outerDiameter || cond.dn || 90) / 10;
        condWCm = dExtCm;
        condOuterSec = (Math.PI * Math.pow(dExtCm / 2, 2)) * cond.qty;
      }
      conduitsOuterArea += condOuterSec;
      totalConduitsWidthCm += (condWCm * cond.qty);

      // Cavi all'interno del cavidotto
      cond.cables.forEach(c => {
        let cFactor = 12;
        let descCavo = c.formation;
        if (c.cableId === 'personalizzato') {
          cFactor = c.customBendingFactor || 12;
          descCavo = `Personalizzato (${c.formation})`;
        } else {
          const dbCavo = cablesCatalog.find(item => item.id === c.cableId);
          if (dbCavo) {
            cFactor = dbCavo.raggioCurvaturaMinFattore || 12;
            descCavo = dbCavo.name;
          }
        }

        const rMinC = cFactor * c.diameter;
        if (rMinC > wallMaxRMin) {
          wallMaxRMin = rMinC;
          wallMaxRMinName = `${descCavo} [${c.sigla || '?'}] (Raggio curvatura = ${cFactor}xØ = ${formatNumber(rMinC, 0)} mm)`;
        }
      });
    });

    totalConduitsOuterAreaGlobal += conduitsOuterArea;

    const fillRate = wallArea > 0 ? (conduitsOuterArea / wallArea) * 100 : 0;
    
    // Calcolo capacità per riga dentro wallWUtile (spazio netto tra i 5 cm dagli spigoli)
    const cornerMarginTotalCm = 2 * CORNER_MARGIN_CM; // 5 cm per lato = 10 cm totali
    const wallHUtile = Math.max(1, (p.depthH || 50) - cornerMarginTotalCm);
    const totalConduitsQty = allCavidotti.reduce((sum, c) => sum + (c.qty || 1), 0);

    // Troviamo quanti condotti ci stanno in 1 riga singola entro wallWUtile
    let maxItemsPerSingleRow = 0;
    let accumWCm = 0;
    allCavidotti.forEach(cond => {
      const isRect = cond.sectionType === 'rettangolare';
      const wCm = isRect ? (cond.width || 100) / 10 : (cond.outerDiameter || 90) / 10;
      for (let q = 0; q < (cond.qty || 1); q++) {
        if (accumWCm + wCm <= wallWUtile + 0.1) {
          accumWCm += wCm;
          maxItemsPerSingleRow++;
        }
      }
    });
    if (maxItemsPerSingleRow < 1) maxItemsPerSingleRow = 1;

    const numRowsNeeded = Math.ceil(totalConduitsQty / maxItemsPerSingleRow);

    // Altezza totale impilata delle file
    const maxCondHCm = allCavidotti.reduce((maxH, cond) => {
      const isRect = cond.sectionType === 'rettangolare';
      const hCm = isRect ? (cond.height || 75) / 10 : (cond.outerDiameter || 90) / 10;
      return Math.max(maxH, hCm);
    }, 5);
    const totalStackedHeightCm = numRowsNeeded * maxCondHCm;

    // Condizioni reali di sovraccarico sulla parete:
    const isAreaOverflow = fillRate > 40;
    const isHeightOverflow = totalStackedHeightCm > wallHUtile;
    const isCornerOverflow = accumWCm > wallWUtile && numRowsNeeded === 1;
    const isLinearOverflow = isAreaOverflow || isHeightOverflow || isCornerOverflow;

    const linearFillRate = wallW > 0 ? (totalConduitsWidthCm / wallW) * 100 : 0;
    const linearFillRateNet = wallWUtile > 0 ? (totalConduitsWidthCm / wallWUtile) * 100 : 0;
    
    // Se c'è una destinazione/curva o un transito di uscita attivo
    const hasCurve = allCavidotti.some(cond => cond.destinationSide !== undefined && cond.destinationSide !== w.side);
    const isEgress = egressCavidotti.length > 0;
    if (wallMaxRMin > globalMaxRMin && (allCavidotti.length > 0 || hasCurve || isEgress)) {
      globalMaxRMin = wallMaxRMin;
      maxRMinCableName = `${wallMaxRMinName} (sulla parete "${w.label}")`;
    }

    return {
      side: w.side,
      label: w.label,
      wallArea,
      wallW,
      wallWUtile,
      wallHUtile,
      conduitsOuterArea,
      totalConduitsWidthCm,
      totalConduitsQty,
      numRowsNeeded,
      totalStackedHeightCm,
      fillRate,
      linearFillRate,
      linearFillRateNet,
      isAreaOverflow,
      isHeightOverflow,
      isLinearOverflow,
      isCornerOverflow,
      maxRMin: wallMaxRMin,
      maxRMinName: wallMaxRMinName,
      hasCurve: hasCurve || isEgress
    };
  });

  // 3. Diagonale / Passaggio nel Pozzetto (L_passaggio) in cm
  let l_passaggio = 0;
  if (p.shape === 'rettangolare') {
    l_passaggio = Math.sqrt(Math.pow(innerB, 2) + Math.pow(innerL, 2));
  } else {
    l_passaggio = innerB;
  }

  // 4. Volume Occupato Cavi (V_c) e Volume Occupato Condotti (V_tubi) in cm^3
  const volumeCaviSenzaScorta = a_tot * l_passaggio;
  const maggiorazioneScorta = volumeCaviSenzaScorta * (p.scortaPct / 100);
  const volumeCaviConScorta = volumeCaviSenzaScorta + maggiorazioneScorta;

  const volumeTubiTotale = totalConduitsOuterAreaGlobal * l_passaggio;

  // 5. Grado di riempimento volumetrico complessivo (%)
  const fillRateCavi = volumePozzetto > 0 ? (volumeCaviConScorta / volumePozzetto) * 100 : 0;
  const fillRateTubi = volumePozzetto > 0 ? (volumeTubiTotale / volumePozzetto) * 100 : 0;

  // 6. Raggio Minimo di Curvatura
  const maxRMinCm = globalMaxRMin / 10; // mm -> cm
  const spaceRequired = 1.0 * maxRMinCm;
  const dimMin = p.shape === 'rettangolare' ? Math.min(innerB, innerL) : innerB;

  const bendingRadiusOk = dimMin >= spaceRequired;
  const bendingRadiusClose = dimMin >= spaceRequired && dimMin < 1.25 * maxRMinCm;

  // 7. Verifica Fill Rate delle Pareti
  const worstWall = paretiCompliance.reduce((prev, curr) => curr.fillRate > prev.fillRate ? curr : prev, paretiCompliance[0]);
  const worstLinearWall = paretiCompliance.reduce((prev, curr) => curr.isLinearOverflow ? curr : prev, paretiCompliance[0]);
  const worstCornerWall = paretiCompliance.reduce((prev, curr) => curr.isCornerOverflow ? curr : prev, paretiCompliance[0]);

  // 8. Esito finale
  let esito: 'verificato' | 'attenzione' | 'rosso' = 'verificato';
  let dettagliVerifica = '';

  if (fillRateCavi > 25 || !bendingRadiusOk || worstWall.fillRate > 40 || worstLinearWall.isLinearOverflow) {
    esito = 'rosso';
    if (worstWall.fillRate > 40) {
      dettagliVerifica = `NON VERIFICATO: Sovraccarico di area sulla parete ${worstWall.label} (${formatNumber(worstWall.fillRate, 1)}% > 40% max consentito per posa corrugati).`;
    } else if (worstLinearWall.isHeightOverflow) {
      dettagliVerifica = `NON VERIFICATO: Le file sovrapposte sulla parete ${worstLinearWall.label} (${worstLinearWall.numRowsNeeded} file = ${formatNumber(worstLinearWall.totalStackedHeightCm, 0)} cm) superano l'altezza utile del pozzetto.`;
    } else if (worstLinearWall.isCornerOverflow) {
      dettagliVerifica = `NON VERIFICATO: I condotti sulla parete ${worstLinearWall.label} invadono il margine di rispetto d'angolo (5 cm per lato).`;
    } else if (fillRateCavi > 25 && !bendingRadiusOk) {
      dettagliVerifica = `NON VERIFICATO: Riempimento volumetrico cavi critico (${formatNumber(fillRateCavi, 1)}% > 25%) e spazio di curvatura insufficiente. Elemento limitante: ${maxRMinCableName}. Richiesto: ${formatNumber(spaceRequired, 1)} cm, Interno netto pozzetto: ${formatNumber(dimMin, 1)} cm.`;
    } else if (fillRateCavi > 25) {
      dettagliVerifica = `NON VERIFICATO: Tasso di riempimento volumetrico globale cavi critico (${formatNumber(fillRateCavi, 1)}% > 25% max).`;
    } else {
      dettagliVerifica = `NON VERIFICATO: Spazio di curvatura insufficiente per la piegatura a 90°. Elemento limitante: ${maxRMinCableName}. Spazio minimo richiesto: ${formatNumber(spaceRequired, 1)} cm, Interno utile pozzetto: ${formatNumber(dimMin, 1)} cm.`;
    }
  } else if (fillRateCavi > 15 || bendingRadiusClose || worstWall.fillRate > 25) {
    esito = 'attenzione';
    if (worstWall.fillRate > 25) {
      dettagliVerifica = `ATTENZIONE: Riempimento elevato di area sulla parete ${worstWall.label} (${formatNumber(worstWall.fillRate, 1)}% > 25%).`;
    } else if (fillRateCavi > 15 && bendingRadiusClose) {
      dettagliVerifica = `ATTENZIONE: Riempimento elevato (${formatNumber(fillRateCavi, 1)}% > 15%) e spazio di curvatura al limite per la piegatura a 90°. Elemento limitante: ${maxRMinCableName}. Spazio minimo richiesto: ${formatNumber(spaceRequired, 1)} cm (consigliato >= ${formatNumber(1.25 * maxRMinCm, 1)} cm), Interno utile: ${formatNumber(dimMin, 1)} cm.`;
    } else if (fillRateCavi > 15) {
      dettagliVerifica = `ATTENZIONE: Grado di riempimento volumetrico globale cavi elevato (${formatNumber(fillRateCavi, 1)}% > 15%).`;
    } else {
      dettagliVerifica = `ATTENZIONE: Spazio di curvatura al limite per la piegatura a 90°. Elemento limitante: ${maxRMinCableName}. Spazio minimo richiesto: ${formatNumber(spaceRequired, 1)} cm (consigliato >= ${formatNumber(1.25 * maxRMinCm, 1)} cm), Interno utile: ${formatNumber(dimMin, 1)} cm.`;
    }
  } else {
    esito = 'verificato';
    dettagliVerifica = `VERIFICATO: Riempimento volumetrico cavi ottimale (${formatNumber(fillRateCavi, 1)}% <= 15%, condotti: ${formatNumber(fillRateTubi, 1)}%), posa pareti conforme (connessione su ${worstWall.numRowsNeeded > 1 ? worstWall.numRowsNeeded + ' file' : '1 fila'}) ed elemento limitante verificato per la posa (${maxRMinCableName} con ${formatNumber(dimMin, 1)} cm >= richiesto ${formatNumber(spaceRequired, 1)} cm).`;
  }

  return {
    volumePozzetto,
    a_tot,
    l_passaggio,
    volumeCaviSenzaScorta,
    maggiorazioneScorta,
    volumeCaviConScorta,
    fillRate: fillRateCavi,
    fillRateCavi,
    fillRateTubi,
    riempimentoPct: fillRateCavi,
    paretiCompliance,
    worstWall,
    worstWallFillRate: worstWall.fillRate,
    worstLinearWall,
    worstCornerWall,
    maxRMin: globalMaxRMin,
    maxRMinCm,
    maxRMinCableName,
    spaceRequired,
    dimMin,
    dMax,
    bendingRadiusOk,
    bendingRadiusClose,
    esito,
    dettagliVerifica,
    innerB,
    innerL,
    innerH
  };
}

function getPackedCablePositions(
  cables: { color: string; diameter: number }[],
  cx: number,
  cy: number,
  rIntScaled: number,
  scale: number
) {
  const count = cables.length;
  if (count === 0) return [];

  const wallInset = 1.2; // Margine interno dal tubo
  const maxR = Math.max(0.8, (rIntScaled - wallInset) * 0.45);

  // Ordina i cavi dal diametro più grande al più piccolo (i grandi sotto, i piccoli sopra)
  const sortedCables = [...cables].sort((a, b) => b.diameter - a.diameter);

  const items = sortedCables.map(c => {
    const rawR = ((c.diameter / 10) / 2) * scale;
    const r = Math.max(0.8, Math.min(maxR, rawR));
    return { color: c.color, r };
  });

  const positions: { color: string; ccx: number; ccy: number; r: number }[] = [];

  if (count === 1) {
    const item = items[0];
    positions.push({
      color: item.color,
      ccx: cx,
      ccy: cy + rIntScaled - item.r - wallInset,
      r: item.r
    });
    return positions;
  }

  if (count === 2) {
    const r1 = items[0].r;
    const r2 = items[1].r;
    const rAvg = (r1 + r2) / 2;
    const dx = rAvg + 0.4;
    const maxD = Math.max(0, rIntScaled - rAvg - wallInset);
    const dy = Math.sqrt(Math.max(0, maxD * maxD - dx * dx));

    positions.push({
      color: items[0].color,
      ccx: cx - dx,
      ccy: cy + dy,
      r: r1
    });
    positions.push({
      color: items[1].color,
      ccx: cx + dx,
      ccy: cy + dy,
      r: r2
    });
    return positions;
  }

  if (count === 3) {
    const r1 = items[0].r;
    const r2 = items[1].r;
    const r3 = items[2].r;
    const rAvg = (r1 + r2 + r3) / 3;

    const dx = rAvg + 0.5;
    const maxD = Math.max(0, rIntScaled - rAvg - wallInset);
    const dy = Math.sqrt(Math.max(0, maxD * maxD - dx * dx));

    const ccx1 = cx - dx;
    const ccy1 = cy + dy;
    const ccx2 = cx + dx;
    const ccy2 = cy + dy;

    positions.push({ color: items[0].color, ccx: ccx1, ccy: ccy1, r: r1 });
    positions.push({ color: items[1].color, ccx: ccx2, ccy: ccy2, r: r2 });

    const distTarget = rAvg * 2 + 0.5;
    const heightDiff = Math.sqrt(Math.max(0, distTarget * distTarget - dx * dx));
    const ccy3 = ccy1 - heightDiff;

    positions.push({ color: items[2].color, ccx: cx, ccy: ccy3, r: r3 });
    return positions;
  }

  // 4 o più cavi: impaccamento esagonale dinamico a strati dal basso verso l'alto
  const rAvg = items.reduce((acc, it) => acc + it.r, 0) / count;
  const R_eff = rIntScaled - wallInset;
  let idx = 0;
  let curY = cy + R_eff - items[0].r;

  while (idx < count && curY >= cy - R_eff) {
    const distY = Math.abs(curY - cy);
    const halfW = distY < R_eff ? Math.sqrt(Math.max(0, R_eff * R_eff - distY * distY)) : 0;
    
    const curR = items[idx].r;
    const stepX = curR * 2 + 0.4;
    const maxInRow = Math.max(1, Math.floor((halfW * 2) / stepX));
    const countInRow = Math.min(maxInRow, count - idx);

    const startX = cx - ((countInRow - 1) * stepX) / 2;
    for (let i = 0; i < countInRow && idx < count; i++, idx++) {
      const item = items[idx];
      positions.push({
        color: item.color,
        ccx: startX + i * stepX,
        ccy: curY,
        r: item.r
      });
    }

    curY -= (items[Math.min(idx, count - 1)].r * 1.73);
  }

  return positions;
}

const PozzettoGraficaDettaglio: React.FC<{
  pozzetto: PozzettoProgetto;
  compliance: any;
  cablesCatalog: CableProduct[];
  containersCatalog?: ContainerFamily[];
  selectedWallSide?: 'sx' | 'dx' | 'alto' | 'basso';
}> = ({ pozzetto, compliance, cablesCatalog, containersCatalog, selectedWallSide }) => {
  const [activeWallSide, setActiveWallSide] = useState<'sx' | 'dx' | 'alto' | 'basso'>(selectedWallSide || 'sx');
  const availableContainers = containersCatalog && containersCatalog.length > 0 ? containersCatalog : INITIAL_CONTAINERS;

  useEffect(() => {
    if (selectedWallSide) {
      setActiveWallSide(selectedWallSide);
    }
  }, [selectedWallSide]);
  const [imgUrlPianta, setImgUrlPianta] = useState<string>('');
  const [imgUrlSezione, setImgUrlSezione] = useState<string>('');
  const canvasPiantaRef = useRef<HTMLCanvasElement>(null);
  const canvasSezioneRef = useRef<HTMLCanvasElement>(null);
  const dpr = 3;

  const isRect = pozzetto.shape === 'rettangolare';
  const B = pozzetto.baseB;
  const L = pozzetto.lengthL;
  const D = pozzetto.diameterD;
  const H = pozzetto.depthH;

  const innerB = compliance?.innerB || (isRect ? B - 10 : D - 10);
  const innerL = compliance?.innerL || (isRect ? L - 10 : D - 10);
  const innerH = compliance?.innerH || H - 10;
  const dimMin = isRect ? Math.min(innerB, innerL) : innerB;

  const drawDimensionLine = (
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number,
    x2: number, y2: number,
    text: string,
    offset: number,
    isVertical: boolean
  ) => {
    ctx.save();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 0.8;
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (!isVertical) {
      const y = y1 + offset;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x1, y - 3); ctx.lineTo(x1, y + 3);
      ctx.moveTo(x2, y - 3); ctx.lineTo(x2, y + 3);
      ctx.stroke();

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x1, y - 5);
      ctx.moveTo(x2, y2); ctx.lineTo(x2, y - 5);
      ctx.stroke();

      const textWidth = ctx.measureText(text).width;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect((x1 + x2)/2 - textWidth/2 - 2, y - 5, textWidth + 4, 10);
      ctx.fillStyle = '#475569';
      ctx.fillText(text, (x1 + x2)/2, y);
    } else {
      const x = x1 + offset;
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x - 3, y1); ctx.lineTo(x + 3, y1);
      ctx.moveTo(x - 3, y2); ctx.lineTo(x + 3, y2);
      ctx.stroke();

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x - 5, y1);
      ctx.moveTo(x2, y2); ctx.lineTo(x - 5, y2);
      ctx.stroke();

      const textWidth = ctx.measureText(text).width;
      ctx.save();
      ctx.translate(x, (y1 + y2)/2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-textWidth/2 - 2, -5, textWidth + 4, 10);
      ctx.fillStyle = '#475569';
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  };

  // 1. Render Pianta (Dall'alto)
  useEffect(() => {
    const canvas = canvasPiantaRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, 360, 280);

    const cx = 360 / 2;
    const cy = 280 / 2;

    const pad = 52;
    const maxDim = isRect ? Math.max(B, L) : D;
    const scale = Math.min((360 - 2 * pad) / maxDim, (280 - 2 * pad) / maxDim);

    const wExtScaled = (isRect ? B : D) * scale;
    const hExtScaled = (isRect ? L : D) * scale;
    const wIntScaled = innerB * scale;
    const hIntScaled = innerL * scale;

    const xStartExt = cx - wExtScaled / 2;
    const yStartExt = cy - hExtScaled / 2;
    const xStartInt = cx - wIntScaled / 2;
    const yStartInt = cy - hIntScaled / 2;

    // Disegno corpo in cemento
    ctx.save();
    ctx.fillStyle = '#cbd5e1';
    if (isRect) {
      ctx.fillRect(xStartExt, yStartExt, wExtScaled, hExtScaled);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.strokeRect(xStartExt, yStartExt, wExtScaled, hExtScaled);
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, wExtScaled / 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Interno pozzetto
    ctx.fillStyle = '#E2E8F0';
    if (isRect) {
      ctx.fillRect(xStartInt, yStartInt, wIntScaled, hIntScaled);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(xStartInt, yStartInt, wIntScaled, hIntScaled);
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, wIntScaled / 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();

    // Linee di quota esterne ed interne distanziate sufficientemente per ospitare i badge dei condotti
    if (isRect) {
      drawDimensionLine(ctx, xStartExt, yStartExt, xStartExt + wExtScaled, yStartExt, `${B} cm (Est)`, -32, false);
      drawDimensionLine(ctx, xStartExt, yStartExt, xStartExt, yStartExt + hExtScaled, `${L} cm (Est)`, -34, true);
    } else {
      drawDimensionLine(ctx, cx - wExtScaled/2, cy, cx + wExtScaled/2, cy, `Ø Ext: ${D} cm`, -wExtScaled/2 - 20, false);
    }

    // Disegna Cavidotti in pianta ed i tracciati delle curve
    const pareti = ensurePozzettoPareti(pozzetto);
    const sideCoords: Record<string, { x: number; y: number; dx: number; dy: number }> = {
      sx: { x: xStartInt, y: cy, dx: -20, dy: 0 },
      dx: { x: xStartInt + wIntScaled, y: cy, dx: 20, dy: 0 },
      alto: { x: cx, y: yStartInt, dx: 0, dy: -20 },
      basso: { x: cx, y: yStartInt + hIntScaled, dx: 0, dy: 20 }
    };

    // 1. Calcola la mappa dei condotti di uscita raggruppati per ogni parete
    const egressMapBySide: Record<string, GruppoCavidotto[]> = { sx: [], dx: [], alto: [], basso: [] };
    ['sx', 'dx', 'alto', 'basso'].forEach((targetSide: any) => {
      const map = new Map<string, GruppoCavidotto>();
      pareti.forEach(otherW => {
        if (otherW.side === targetSide) return;
        otherW.cavidotti.forEach(otherCond => {
          otherCond.cables.forEach(c => {
            if (c.destinationSide === targetSide) {
              const destFamId = c.destinationFamilyId || 'cavidotto';
              const destSizeCode = c.destinationSizeCode || 'CEFD90';
              const conduitId = c.destinationConduitId || `exit_${targetSide}_${otherCond.id}`;
              const geom = resolveContainerSize(destFamId, destSizeCode, availableContainers);

              if (!map.has(conduitId)) {
                map.set(conduitId, {
                  id: conduitId,
                  familyId: geom.familyId,
                  familyName: geom.familyName,
                  sizeCode: geom.sizeCode,
                  sectionType: geom.sectionType,
                  width: geom.width,
                  height: geom.height,
                  dn: geom.dn,
                  outerDiameter: geom.outerDiameter,
                  innerDiameter: geom.innerDiameter,
                  bendingFactor: geom.bendingFactor,
                  qty: 1,
                  cables: [c],
                  destinationSide: undefined
                });
              } else {
                map.get(conduitId)!.cables.push(c);
              }
            }
          });
        });
      });
      egressMapBySide[targetSide] = Array.from(map.values());
    });

    // Helper per disegnare frecce direzionali AL CENTRO del rettangolo condotto in pianta
    const drawDirectionArrow = (
      side: 'sx' | 'dx' | 'alto' | 'basso',
      direction: 'in' | 'out',
      rx: number,
      ry: number,
      rw: number,
      rh: number
    ) => {
      ctx.save();
      ctx.fillStyle = direction === 'in' ? '#22c55e' : '#f97316'; // Verde per IN (Arrivo), Arancio per OUT (Uscita)
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;

      // Centro esatto del rettangolo del cavidotto
      const cxPos = rx + rw / 2;
      const cyPos = ry + rh / 2;

      ctx.beginPath();
      const size = Math.min(4.5, Math.min(Math.abs(rw), Math.abs(rh)) * 0.4);
      let angle = 0;

      if (side === 'sx') {
        angle = direction === 'in' ? 0 : Math.PI;
      } else if (side === 'dx') {
        angle = direction === 'in' ? Math.PI : 0;
      } else if (side === 'alto') {
        angle = direction === 'in' ? Math.PI / 2 : -Math.PI / 2;
      } else if (side === 'basso') {
        angle = direction === 'in' ? -Math.PI / 2 : Math.PI / 2;
      }

      ctx.translate(cxPos, cyPos);
      ctx.rotate(angle);

      ctx.moveTo(size, 0);
      ctx.lineTo(-size, -size * 0.7);
      ctx.lineTo(-size * 0.5, 0);
      ctx.lineTo(-size, size * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    // 2. Lay-out combinato ed unificato (Arrivi + Uscite) per ciascun lato di parete per evitare sovrapposizioni
    const ingressPositions = new Map<string, { startX: number; startY: number }>();
    const egressPositions = new Map<string, { endX: number; endY: number }>();

    ['sx', 'dx', 'alto', 'basso'].forEach((side: any) => {
      const wall = pareti.find(w => w.side === side);
      const ingressConduits = wall ? wall.cavidotti : [];
      const egressConduits = egressMapBySide[side] || [];

      const wallItems: { type: 'ingress' | 'egress'; cond: GruppoCavidotto }[] = [];
      ingressConduits.forEach(c => wallItems.push({ type: 'ingress', cond: c }));
      egressConduits.forEach(c => wallItems.push({ type: 'egress', cond: c }));

      if (wallItems.length === 0) return;
      const coords = sideCoords[side];

      // Flatten tutte le istanze di condotto
      interface FlatPlanItem {
        type: 'ingress' | 'egress';
        cond: GruppoCavidotto;
        wCm: number;
        wScaled: number;
        isRect: boolean;
      }
      const flatPlanItems: FlatPlanItem[] = [];
      wallItems.forEach(item => {
        const c = item.cond;
        const isRect = c.sectionType === 'rettangolare';
        const wCm = isRect ? (c.width || 100) / 10 : (c.outerDiameter || 90) / 10;
        const wScaled = wCm * scale;
        const qty = c.qty || 1;
        for (let q = 0; q < qty; q++) {
          flatPlanItems.push({ type: item.type, cond: c, wCm, wScaled, isRect });
        }
      });

      const totalItems = flatPlanItems.length;
      const wallSpanScaled = (side === 'sx' || side === 'dx') ? hIntScaled : wIntScaled;
      const cornerPx = 5 * scale;
      const netSpanScaled = Math.max(0, wallSpanScaled - 2 * cornerPx);
      const availableSpan = netSpanScaled > 0 ? netSpanScaled : wallSpanScaled;

      // Quanti condotti ci stanno in 1 sola riga dentro availableSpan?
      let accumW = 0;
      let maxPerLine = 0;
      for (let i = 0; i < totalItems; i++) {
        const itemW = flatPlanItems[i].wScaled;
        if (accumW + itemW + (maxPerLine > 0 ? 2 : 0) <= availableSpan + 0.5) {
          accumW += itemW + (maxPerLine > 0 ? 2 : 0);
          maxPerLine++;
        } else {
          break;
        }
      }
      if (maxPerLine < 1) maxPerLine = 1;

      // Numero di colonne in pianta (pari alla capacità massima per riga)
      const numCols = Math.min(totalItems, maxPerLine);

      // Raggruppiamo gli elementi per colonna (sovrapposizione su più livelli)
      interface ColumnGroup {
        items: FlatPlanItem[];
        maxWScaled: number;
        levelCount: number;
      }

      const columns: ColumnGroup[] = [];
      for (let c = 0; c < numCols; c++) {
        columns.push({ items: [], maxWScaled: 0, levelCount: 0 });
      }

      flatPlanItems.forEach((item, idx) => {
        const colIdx = idx % numCols;
        columns[colIdx].items.push(item);
        columns[colIdx].levelCount++;
        columns[colIdx].maxWScaled = Math.max(columns[colIdx].maxWScaled, item.wScaled);
      });

      // Calcoliamo lo span e la centratura delle colonne lungo la parete in pianta dentro la fascia utile
      const totalColsW = columns.reduce((sum, col) => sum + col.maxWScaled, 0);
      const colGap = columns.length > 1
        ? Math.min(3, Math.max(0.5, (availableSpan - totalColsW) / (columns.length + 1)))
        : 0;
      const totalUsedSpan = totalColsW + (columns.length - 1) * colGap;

      let currentOffset = -totalUsedSpan / 2;

      columns.forEach((colGroup) => {
        const dExtScaled = colGroup.maxWScaled;

        let rx = coords.x;
        let ry = coords.y;
        let rw = 0;
        let rh = 0;
        let centerX = coords.x;
        let centerY = coords.y;

        if (side === 'sx' || side === 'dx') {
          ry = coords.y + currentOffset;
          rw = coords.dx;
          rh = dExtScaled;
          centerX = coords.x;
          centerY = ry + dExtScaled / 2;
        } else {
          rx = coords.x + currentOffset;
          rw = dExtScaled;
          rh = coords.dy;
          centerX = rx + dExtScaled / 2;
          centerY = coords.y;
        }

        // Mappiamo le posizioni di ingresso/uscita per ciascun condotto della colonna
        colGroup.items.forEach(item => {
          if (item.type === 'ingress') {
            ingressPositions.set(item.cond.id, { startX: centerX, startY: centerY });
          } else {
            egressPositions.set(item.cond.id, { endX: centerX, endY: centerY });
          }
        });

        // 1. Se ci sono più livelli (sovrapposizione), disegna l'effetto ombra/sfalsato 3D sotto
        if (colGroup.levelCount > 1) {
          ctx.save();
          const offsetX = side === 'alto' || side === 'basso' ? 1.5 : (side === 'sx' ? -1.5 : 1.5);
          const offsetY = side === 'sx' || side === 'dx' ? 1.5 : (side === 'alto' ? -1.5 : 1.5);
          ctx.fillStyle = 'rgba(30, 58, 138, 0.35)'; // Ombra del condotto inferiore
          ctx.strokeStyle = '#1e3a8a';
          ctx.lineWidth = 0.8;
          ctx.setLineDash([2, 2]);
          ctx.fillRect(rx + offsetX, ry + offsetY, rw, rh);
          ctx.strokeRect(rx + offsetX, ry + offsetY, rw, rh);
          ctx.restore();
        }

        // 2. Disegna il condotto principale (Livello superiore)
        const firstItem = colGroup.items[0];
        ctx.save();
        ctx.fillStyle = firstItem.type === 'ingress' 
          ? (firstItem.isRect ? (firstItem.cond.familyId === 'canala_pvc' ? '#cbd5e1' : '#64748b') : 'rgba(59, 130, 246, 0.95)')
          : (firstItem.isRect ? (firstItem.cond.familyId === 'canala_pvc' ? '#e2e8f0' : '#475569') : 'rgba(37, 99, 235, 0.85)');
        ctx.strokeStyle = firstItem.type === 'ingress' ? '#1d4ed8' : '#0284c7';
        ctx.lineWidth = 1.2;

        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);

        if (firstItem.isRect) {
          ctx.fillStyle = '#ffffff';
          if (side === 'sx' || side === 'dx') {
            ctx.fillRect(rx + (rw < 0 ? rw + 2 : 2), ry + 2, Math.abs(rw) - 4, Math.max(1, rh - 4));
          } else {
            ctx.fillRect(rx + 2, ry + (rh < 0 ? rh + 2 : 2), Math.max(1, rw - 4), Math.abs(rh) - 4);
          }
        }
        ctx.restore();

        // 3. Freccia direzionale AL CENTRO
        drawDirectionArrow(side, firstItem.type === 'ingress' ? 'in' : 'out', rx, ry, rw, rh);

        // 4. Badge "×N" ad alta leggibilità e contrasto elevato con anello di stacco bianco
        if (colGroup.levelCount > 1) {
          ctx.save();
          ctx.font = '900 8.5px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Collochiamo il badge all'ESTERNO del pozzetto, accanto all'ingresso del condotto
          let badgeX = centerX;
          let badgeY = centerY;

          if (side === 'sx') {
            badgeX = rx + rw - 8;
            badgeY = centerY;
          } else if (side === 'dx') {
            badgeX = rx + rw + 8;
            badgeY = centerY;
          } else if (side === 'alto') {
            badgeX = centerX;
            badgeY = ry + rh - 8;
          } else if (side === 'basso') {
            badgeX = centerX;
            badgeY = ry + rh + 8;
          }

          const badgeR = 6.5;

          // 1. Anello di stacco bianco per staccare dal fondo
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, badgeR + 1.2, 0, 2 * Math.PI);
          ctx.fillStyle = '#ffffff';
          ctx.fill();

          // 2. Corpo badge Amber 600 ad altissima visibilità
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, badgeR, 0, 2 * Math.PI);
          ctx.fillStyle = '#d97706'; // Amber 600 nitido
          ctx.fill();
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 1;
          ctx.stroke();

          // 3. Testo bianco ultra-nitido "×2", "×3"
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`×${colGroup.levelCount}`, badgeX, badgeY + 0.5);
          ctx.restore();
        }

        currentOffset += dExtScaled + colGap;
      });
    });

    // 3. Traccia le curve per ciascun cavo dagli arrivi reali alle uscite reali raggruppate
    pareti.forEach(w => {
      const coords = sideCoords[w.side];
      w.cavidotti.forEach(cond => {
        const inPos = ingressPositions.get(cond.id);
        const isRect = cond.sectionType === 'rettangolare';
        const wCm = isRect ? (cond.width || 100) / 10 : (cond.outerDiameter || 90) / 10;
        const dExtScaled = wCm * scale;

        cond.cables.forEach((c) => {
          const destSide = c.destinationSide || cond.destinationSide;
          if (destSide && destSide !== w.side) {
            const conduitId = c.destinationConduitId || `exit_${destSide}_${cond.id}`;
            const egPos = egressPositions.get(conduitId);

            const startX = inPos ? inPos.startX : (w.side === 'sx' || w.side === 'dx' ? coords.x : coords.x + dExtScaled / 2);
            const startY = inPos ? inPos.startY : (w.side === 'sx' || w.side === 'dx' ? coords.y + dExtScaled / 2 : coords.y);

            const endX = egPos ? egPos.endX : sideCoords[destSide].x;
            const endY = egPos ? egPos.endY : sideCoords[destSide].y;

            // Bezier Curve
            ctx.save();
            ctx.strokeStyle = getCableColor(c.cableId);
            ctx.lineWidth = Math.max(1.2, (c.diameter / 10) * scale * 0.45);
            ctx.beginPath();
            ctx.moveTo(startX, startY);

            let cpX = startX;
            let cpY = startY;

            if (w.side === 'sx' || w.side === 'dx') {
              cpX = endX;
              cpY = startY;
            } else {
              cpX = startX;
              cpY = endY;
            }

            ctx.quadraticCurveTo(cpX, cpY, endX, endY);
            ctx.stroke();
            ctx.restore();
          }
        });
      });
    });

    // Etichette orientamento pareti collocate esternamente al disegno per evitare qualsiasi sovrapposizione
    ctx.save();
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const hasBottomConduits = pareti.some(w => w.side === 'basso' && w.cavidotti.length > 0) || pareti.some(otherW => otherW.cavidotti.some(c => c.destinationSide === 'basso' || c.cables.some(cb => cb.destinationSide === 'basso')));

    // Helper per calcolare sia Ingressi che Uscite totali su ciascuna parete
    const calcTotalWallConduits = (wallSide: string) => {
      const wObj = pareti.find(w => w.side === wallSide);
      const ing = wObj ? wObj.cavidotti.reduce((s, c) => s + (c.qty || 1), 0) : 0;
      const eg = (egressMapBySide[wallSide] || []).reduce((s, c) => s + (c.qty || 1), 0);
      return ing + eg;
    };

    // PARETE ALTO
    const qtyAlto = calcTotalWallConduits('alto');
    const labelAlto = qtyAlto > 0 ? `PARETE ALTO (${qtyAlto} Cavidott${qtyAlto === 1 ? 'o' : 'i'})` : 'PARETE ALTO';
    ctx.fillText(labelAlto, cx, Math.max(9, yStartExt - 40));

    // PARETE BASSO
    const qtyBasso = calcTotalWallConduits('basso');
    const labelBasso = qtyBasso > 0 ? `PARETE BASSO (${qtyBasso} Cavidott${qtyBasso === 1 ? 'o' : 'i'})` : 'PARETE BASSO';
    const posYBasso = hasBottomConduits 
      ? Math.min(272, yStartInt + hIntScaled + 42)
      : Math.min(272, yStartExt + hExtScaled + 26);
    ctx.fillText(labelBasso, cx, posYBasso);

    // PARETE SX
    const qtySX = calcTotalWallConduits('sx');
    const labelSX = qtySX > 0 ? `PARETE SX (${qtySX} Cavidott${qtySX === 1 ? 'o' : 'i'})` : 'PARETE SX';
    ctx.save();
    ctx.translate(Math.max(10, xStartExt - 46), cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(labelSX, 0, 0);
    ctx.restore();

    // PARETE DX
    const qtyDX = calcTotalWallConduits('dx');
    const labelDX = qtyDX > 0 ? `PARETE DX (${qtyDX} Cavidott${qtyDX === 1 ? 'o' : 'i'})` : 'PARETE DX';
    ctx.save();
    ctx.translate(Math.min(350, xStartInt + wIntScaled + 46), cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(labelDX, 0, 0);
    ctx.restore();

    ctx.restore();

    const url = canvas.toDataURL('image/png');
    setImgUrlPianta(url);
  }, [pozzetto, compliance, activeWallSide]);

  // 2. Render Sezione Parete (Skyline packing dei corrugati/canali con centraggio orizzontale)
  useEffect(() => {
    const canvas = canvasSezioneRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, 360, 280);

    const pad = 36;
    const wallW = (activeWallSide === 'sx' || activeWallSide === 'dx') ? innerL : innerB;
    const wallH = innerH;

    const maxWallDim = Math.max(wallW, wallH);
    const scale = Math.min((360 - 2 * pad) / maxWallDim, (280 - 2 * pad) / maxWallDim);
    const wScaled = wallW * scale;
    const hScaled = wallH * scale;

    const xStart = (360 - wScaled) / 2;
    const yStart = (280 - hScaled) / 2;

    // Disegna la parete (in cemento)
    ctx.save();
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(xStart - 10, yStart - 10, wScaled + 20, hScaled + 20);
    ctx.fillStyle = '#e2e8f0'; // sfondo interno sfondatura
    ctx.fillRect(xStart, yStart, wScaled, hScaled);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(xStart, yStart, wScaled, hScaled);
    ctx.restore();

    // Disegna quote interne sezione
    drawDimensionLine(ctx, xStart, yStart, xStart + wScaled, yStart, `${formatNumber(wallW, 0)} cm`, -20, false);
    drawDimensionLine(ctx, xStart, yStart, xStart, yStart + hScaled, `${formatNumber(wallH, 0)} cm`, -20, true);

    // Linee tratteggiate di rispetto angoli interni (5 cm per lato)
    const cornerPx = 5 * scale;
    if (wScaled > 2 * cornerPx) {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 0.8;

      // Linea sinistra (5 cm)
      ctx.beginPath();
      ctx.moveTo(xStart + cornerPx, yStart);
      ctx.lineTo(xStart + cornerPx, yStart + hScaled);
      ctx.stroke();

      // Linea destra (5 cm)
      ctx.beginPath();
      ctx.moveTo(xStart + wScaled - cornerPx, yStart);
      ctx.lineTo(xStart + wScaled - cornerPx, yStart + hScaled);
      ctx.stroke();

      ctx.restore();
    }

    const pareti = ensurePozzettoPareti(pozzetto);
    const activeWall = pareti.find(w => w.side === activeWallSide);
    
    const ingressCavidotti = activeWall ? activeWall.cavidotti : [];
    const egressMap = new Map<string, GruppoCavidotto>();

    pareti.forEach(w => {
      if (w.side === activeWallSide) return;
      w.cavidotti.forEach(cond => {
        cond.cables.forEach(c => {
          const destSide = c.destinationSide;
          if (destSide === activeWallSide) {
            const destFamId = c.destinationFamilyId || 'cavidotto';
            const destSizeCode = c.destinationSizeCode || 'CEFD90';
            const conduitId = c.destinationConduitId || `exit_${activeWallSide}_${cond.id}`;
            const geom = resolveContainerSize(destFamId, destSizeCode, availableContainers);

            if (!egressMap.has(conduitId)) {
              egressMap.set(conduitId, {
                id: conduitId,
                familyId: geom.familyId,
                familyName: geom.familyName,
                sizeCode: geom.sizeCode,
                sectionType: geom.sectionType,
                width: geom.width,
                height: geom.height,
                dn: geom.dn,
                outerDiameter: geom.outerDiameter,
                innerDiameter: geom.innerDiameter,
                bendingFactor: geom.bendingFactor,
                qty: 1,
                cables: [c],
                destinationSide: undefined
              });
            } else {
              egressMap.get(conduitId)!.cables.push(c);
            }
          }
        });
      });
    });

    const egressCavidotti = Array.from(egressMap.values());
    const allCavidotti = [...ingressCavidotti, ...egressCavidotti];

    if (allCavidotti.length > 0) {
      // 1. Margini netti d'angolo (5 cm per lato) e larghezza utile interna
      const cornerPx = 5 * scale;
      const netXStart = xStart + cornerPx;
      const netW = Math.max(0, wScaled - 2 * cornerPx);

      // Usiamo il margine netto dei 5 cm se sufficiente, altrimenti la larghezza intera parete
      const boundXStart = netW > 0 ? netXStart : xStart;
      const availableW = netW > 0 ? netW : wScaled;

      // 2. Creiamo una lista di tutti gli elementi singoli di condotto
      interface FlatConduitItem {
        cond: GruppoCavidotto;
        wScaled: number;
        hScaled: number;
        isRect: boolean;
      }

      const flatConduitItems: FlatConduitItem[] = [];
      allCavidotti.forEach(cond => {
        const isRect = cond.sectionType === 'rettangolare';
        const wCm = isRect ? (cond.width || cond.outerDiameter || 100) / 10 : (cond.outerDiameter || 90) / 10;
        const hCm = isRect ? (cond.height || cond.innerDiameter || 75) / 10 : (cond.outerDiameter || 90) / 10;
        const itemWScaled = wCm * scale;
        const itemHScaled = hCm * scale;

        for (let q = 0; q < cond.qty; q++) {
          flatConduitItems.push({
            cond,
            wScaled: itemWScaled,
            hScaled: itemHScaled,
            isRect
          });
        }
      });

      const totalItems = flatConduitItems.length;

      // 3. Capacità massima di elementi per singola riga nella fascia utile
      let accumW = 0;
      let maxPerLine = 0;
      for (let i = 0; i < totalItems; i++) {
        const itemW = flatConduitItems[i].wScaled;
        if (accumW + itemW + (maxPerLine > 0 ? 2 : 0) <= availableW + 0.5) {
          accumW += itemW + (maxPerLine > 0 ? 2 : 0);
          maxPerLine++;
        } else {
          break;
        }
      }
      if (maxPerLine < 1) maxPerLine = 1;

      // 4. Posa a strati reale con bin-packing basato sulla larghezza disponibile tra i 5 cm dagli angoli
      const rows: FlatConduitItem[][] = [];
      let currentRow: FlatConduitItem[] = [];
      let currentRowW = 0;

      flatConduitItems.forEach(item => {
        const gap = currentRow.length > 0 ? 2 : 0;
        if (currentRowW + item.wScaled + gap <= availableW + 0.5) {
          currentRow.push(item);
          currentRowW += item.wScaled + gap;
        } else {
          if (currentRow.length > 0) rows.push(currentRow);
          currentRow = [item];
          currentRowW = item.wScaled;
        }
      });
      if (currentRow.length > 0) {
        rows.push(currentRow);
      }

      // 5. Disegno dal basso verso l'alto con centratura orizzontale di ciascuna riga
      let curY = yStart + hScaled;

      rows.forEach((rowItems) => {
        const rowConduitsW = rowItems.reduce((sum, item) => sum + item.wScaled, 0);
        const rowGap = rowItems.length > 1 
          ? Math.min(4, Math.max(1, (availableW - rowConduitsW) / (rowItems.length + 1))) 
          : 0;
        const totalRowW = rowConduitsW + (rowItems.length - 1) * rowGap;

        let curX = boundXStart + Math.max(0, (availableW - totalRowW) / 2);
        let maxRowH = 0;

        rowItems.forEach((item) => {
          maxRowH = Math.max(maxRowH, item.hScaled);
          const cond = item.cond;

          if (item.isRect) {
            const rectWScaled = item.wScaled;
            const rectHScaled = item.hScaled;
            const rx = curX;
            const ry = curY - rectHScaled;

            // Disegna Canale Rettangolare
            ctx.save();
            ctx.fillStyle = cond.familyId === 'canala_pvc' ? '#94a3b8' : '#64748b';
            ctx.fillRect(rx, ry, rectWScaled, rectHScaled);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1.2;
            ctx.strokeRect(rx, ry, rectWScaled, rectHScaled);

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(rx + 2, ry + 2, Math.max(1, rectWScaled - 4), Math.max(1, rectHScaled - 4));
            ctx.restore();

            if (cond.cables.length > 0) {
              const flatCables: { color: string; diameter: number }[] = [];
              cond.cables.forEach(c => {
                for (let i = 0; i < c.qty; i++) {
                  flatCables.push({ color: getCableColor(c.cableId), diameter: c.diameter });
                }
              });

              const maxCavoD = Math.max(...flatCables.map(c => c.diameter), 10);
              const cRadius = Math.max(1.2, Math.min((maxCavoD / 20) * scale, (rectHScaled - 4) / 3));
              const cols = Math.max(1, Math.floor((rectWScaled - 4) / (2.4 * cRadius)));
              
              flatCables.forEach((cItem, idx) => {
                const col = idx % cols;
                const row = Math.floor(idx / cols);
                const ccx = rx + 3 + cRadius + col * (2.4 * cRadius);
                const ccy = ry + rectHScaled - 3 - cRadius - row * (2.4 * cRadius);

                if (ccy >= ry + 2 + cRadius && ccx <= rx + rectWScaled - 2 - cRadius) {
                  ctx.save();
                  ctx.beginPath();
                  ctx.arc(ccx, ccy, cRadius, 0, 2 * Math.PI);
                  ctx.fillStyle = cItem.color;
                  ctx.fill();
                  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
                  ctx.lineWidth = 0.5;
                  ctx.stroke();
                  ctx.restore();
                }
              });
            }
          } else {
            // Disegna Circolare (Tubo / Cavidotto)
            const rExtScaled = item.wScaled / 2;
            const rIntScaled = (((cond.innerDiameter || 80) / 10) / 2) * scale;
            const cx = curX + rExtScaled;
            const cy = curY - rExtScaled;

            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, rExtScaled, 0, 2 * Math.PI);
            ctx.fillStyle = '#3b82f6';
            ctx.fill();
            ctx.strokeStyle = '#1d4ed8';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(cx, cy, rIntScaled, 0, 2 * Math.PI);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 0.8;
            ctx.stroke();

            ctx.restore();

            if (cond.cables.length > 0) {
              const flatCables: { color: string; diameter: number }[] = [];
              cond.cables.forEach(c => {
                for (let i = 0; i < c.qty; i++) {
                  flatCables.push({ color: getCableColor(c.cableId), diameter: c.diameter });
                }
              });

              const maxCavoD = Math.max(...flatCables.map(c => c.diameter), 10);
              const cRadius = Math.max(1.0, Math.min((maxCavoD / 20) * scale, (rIntScaled - 2) / 3));

              let currentIdx = 0;
              let ring = 0;
              while (currentIdx < flatCables.length) {
                if (ring === 0) {
                  const cItem = flatCables[currentIdx];
                  ctx.save();
                  ctx.beginPath();
                  ctx.arc(cx, cy, cRadius, 0, 2 * Math.PI);
                  ctx.fillStyle = cItem.color;
                  ctx.fill();
                  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
                  ctx.lineWidth = 0.5;
                  ctx.stroke();
                  ctx.restore();
                  currentIdx++;
                  ring++;
                } else {
                  const ringRadius = ring * (2.2 * cRadius);
                  if (ringRadius > rIntScaled - cRadius - 1) break;
                  const maxInRing = Math.floor((2 * Math.PI * ringRadius) / (2.4 * cRadius));
                  const countInRing = Math.max(1, Math.min(maxInRing, flatCables.length - currentIdx));
                  for (let i = 0; i < countInRing; i++) {
                    const angle = (i * 2 * Math.PI) / countInRing;
                    const ccx = cx + Math.cos(angle) * ringRadius;
                    const ccy = cy + Math.sin(angle) * ringRadius;
                    const cItem = flatCables[currentIdx];

                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(ccx, ccy, cRadius, 0, 2 * Math.PI);
                    ctx.fillStyle = cItem.color;
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                    ctx.restore();

                    currentIdx++;
                  }
                  ring++;
                }
              }
            }
          }

          curX += item.wScaled + rowGap;
        });

        curY -= maxRowH + 4;
      });
    }

    const url = canvas.toDataURL('image/png');
    setImgUrlSezione(url);
  }, [pozzetto, activeWallSide, innerB, innerL, innerH]);

  const activeWallComp = compliance?.paretiCompliance?.find((wc: any) => wc.side === activeWallSide);

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col gap-6 relative w-full print:p-0 print:border-none print:shadow-none print:bg-transparent print:rounded-none">
      {/* Selector della Parete da Ispezionare (Nascosto in stampa) */}
      <div className="flex flex-wrap md:flex-nowrap justify-between items-center gap-4 border-b border-slate-100 pb-3 print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-bold text-slate-800">Ispezione Parete Pozzetto:</span>
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {(['sx', 'dx', 'alto', 'basso'] as const).map(side => (
              <button
                key={side}
                onClick={() => setActiveWallSide(side)}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                  activeWallSide === side 
                    ? 'bg-white text-indigo-700 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {side.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 ml-auto pl-4">
          <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black px-2.5 py-1 rounded-lg">
            Riempimento Volumetrico Cavi: {formatNumber(compliance?.fillRateCavi || compliance?.fillRate || 0, 1)}%
          </span>
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border transition-all ${
            activeWallComp?.isLinearOverflow
              ? 'bg-rose-50 border-rose-200 text-rose-700 font-extrabold animate-pulse'
              : activeWallComp?.isCornerOverflow
              ? 'bg-amber-50 border-amber-200 text-amber-700 font-bold'
              : (activeWallComp?.fillRate || 0) > 25
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            {activeWallComp?.isAreaOverflow
              ? `⚠️ AREA PARETE SUPERATA (${formatNumber(activeWallComp?.fillRate || 0, 1)}% > 40%)`
              : activeWallComp?.isHeightOverflow
              ? `⚠️ ALTEZZA PARETE SUPERATA (${activeWallComp?.numRowsNeeded} File)`
              : activeWallComp?.isCornerOverflow
              ? '⚠️ INVASIONE RISPETTO ANGOLO (5cm)'
              : `✓ Parete ${activeWallSide.toUpperCase()}: ${activeWallComp?.numRowsNeeded > 1 ? `Posa su ${activeWallComp.numRowsNeeded} File` : 'Posa 1 Fila'} (${activeWallComp?.totalConduitsQty || 0} Condotti - Area ${formatNumber(activeWallComp?.fillRate || 0, 1)}%)`}
          </span>
        </div>
      </div>

      {/* Viste Affiancate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        
        {/* Vista Pianta */}
        <div className="flex flex-col justify-between items-center bg-slate-50/50 border border-slate-100 rounded-2xl p-4 w-full print:border-none print:bg-white print:p-1 print:shadow-none">
          <div className="w-full flex items-center justify-between pb-2 border-b border-slate-200/60 mb-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>

              VISTA IN PIANTA (Dall'alto)
            </span>
          </div>
          <div className="w-full flex-1 flex items-center justify-center min-h-[220px]">
            <canvas
              ref={canvasPiantaRef}
              width={360 * dpr}
              height={280 * dpr}
              className="w-full max-w-[340px] aspect-[360/280] rounded-xl bg-white border border-slate-100 shadow-xs print:hidden"
            />
            {imgUrlPianta && (
              <img
                src={imgUrlPianta}
                alt="Pianta Pozzetto"
                className="hidden print:block w-full max-w-[340px] aspect-[360/280] object-contain"
              />
            )}
          </div>
          <span className="text-[10px] text-slate-500 mt-2 text-center italic">
            Mostra l'ingresso dei cavidotti e l'andamento curvo dei cavi.
          </span>
        </div>

        {/* Vista Sezione Parete */}
        <div className="flex flex-col justify-between items-center bg-slate-50/50 border border-slate-100 rounded-2xl p-4 w-full print:border-none print:bg-white print:p-1 print:shadow-none">
          <div className="w-full flex items-center justify-between pb-2 border-b border-slate-200/60 mb-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>

              SEZIONE PARETE {activeWallSide.toUpperCase()}
            </span>
          </div>
          <div className="w-full flex-1 flex items-center justify-center min-h-[220px]">
            <canvas
              ref={canvasSezioneRef}
              width={360 * dpr}
              height={280 * dpr}
              className="w-full max-w-[340px] aspect-[360/280] rounded-xl bg-white border border-slate-100 shadow-xs print:hidden"
            />
            {imgUrlSezione && (
              <img
                src={imgUrlSezione}
                alt="Sezione Parete"
                className="hidden print:block w-full max-w-[340px] aspect-[360/280] object-contain"
              />
            )}
          </div>
          <span className="text-[10px] text-slate-500 mt-2 text-center italic">
            Sezione frontale della parete: corrugati e cavi interni.
          </span>
        </div>

      </div>

      {/* Legenda Colori */}
      <div className="border-t border-slate-100 pt-4 flex flex-wrap gap-4 items-center justify-between print:hidden">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2 text-[11px] text-slate-600 font-bold">
            <span className="w-3 h-3 rounded-full shrink-0 border border-slate-900/10" style={{ backgroundColor: '#ef4444' }} />
            <span>Media Tensione (MT)</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-600 font-bold">
            <span className="w-3 h-3 rounded-full shrink-0 border border-slate-900/10" style={{ backgroundColor: '#10b981' }} />
            <span>Bassa Tensione (BT)</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-600 font-bold">
            <span className="w-3 h-3 rounded-full shrink-0 border border-slate-900/10" style={{ backgroundColor: '#f97316' }} />
            <span>Resistente al Fuoco</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-600 font-bold">
            <span className="w-3 h-3 rounded-full shrink-0 border border-slate-900/10" style={{ backgroundColor: '#3b82f6' }} />
            <span>Dati / Segnale</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-600 font-bold">
            <span className="w-3 h-3 rounded-full shrink-0 border border-slate-900/10" style={{ backgroundColor: '#64748b' }} />
            <span>Personalizzato</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-600 font-bold border-l border-slate-200 pl-4">
            <span className="w-4 h-3 bg-blue-500 rounded-sm shrink-0 border border-blue-600" />
            <span>Cavidotto/Corrugato (Esterno)</span>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 font-medium italic">
          Raggi di curvatura corrugati verificati a 8xDN.
        </div>
      </div>
    </div>
  );
};

export function ToolDimensionamentoPozzettiElettrici({ 
  projectData, 
  setProjectData, 
  setAppMode, 
  cablesCatalog: propCablesCatalog,
  containersCatalog: propContainersCatalog,
  importedCables,
  clearImportedCables
}: ToolDimensionamentoPozzettiElettriciProps) {

  const [state, setState] = useState<ToolState>(defaultState);
  const [cablesCatalog, setCablesCatalog] = useState<CableProduct[]>(propCablesCatalog || []);
  const [loadingDb, setLoadingDb] = useState<boolean>(false);
  const [configWallSide, setConfigWallSide] = useState<'sx' | 'dx' | 'alto' | 'basso'>('sx');

  // Stato per instradamento cumulativo / selezione multipla cavi
  const [selectedCableIndicesMap, setSelectedCableIndicesMap] = useState<Record<string, number[]>>({});
  const [batchExitSide, setBatchExitSide] = useState<'sx' | 'dx' | 'alto' | 'basso' | 'none' | ''>('');
  const [batchExitFamily, setBatchExitFamily] = useState<string>('cavidotto');
  const [batchExitSizeCode, setBatchExitSizeCode] = useState<string>('CEFD90');

  const availableContainers = useMemo(() => {
    if (propContainersCatalog && propContainersCatalog.length > 0) return propContainersCatalog;
    return INITIAL_CONTAINERS;
  }, [propContainersCatalog]);

  const handleBatchExitFamilyChange = (famId: string) => {
    setBatchExitFamily(famId);
    const fam = availableContainers.find(f => f.id === famId);
    if (fam && fam.sizes.length > 0) {
      setBatchExitSizeCode(fam.sizes[0].code);
    }
  };

  const toggleSelectCable = (condId: string, idx: number) => {
    setSelectedCableIndicesMap(prev => {
      const current = prev[condId] || [];
      const updated = current.includes(idx) ? current.filter(i => i !== idx) : [...current, idx];
      return { ...prev, [condId]: updated };
    });
  };

  const toggleSelectAllCables = (condId: string, totalCount: number, forceSelect?: boolean) => {
    setSelectedCableIndicesMap(prev => {
      const current = prev[condId] || [];
      if (forceSelect !== undefined) {
        return { ...prev, [condId]: forceSelect ? Array.from({ length: totalCount }, (_, i) => i) : [] };
      }
      const allSelected = current.length === totalCount;
      return { ...prev, [condId]: allSelected ? [] : Array.from({ length: totalCount }, (_, i) => i) };
    });
  };

  const handleApplyBatchRouting = (side: 'sx' | 'dx' | 'alto' | 'basso', condId: string) => {
    const selectedIndices = selectedCableIndicesMap[condId] || [];
    if (selectedIndices.length === 0 || !batchExitSide) return;

    const destSide = batchExitSide === 'none' ? undefined : (batchExitSide as 'sx' | 'dx' | 'alto' | 'basso');
    const destFamily = destSide ? batchExitFamily : undefined;
    const destSize = destSide ? batchExitSizeCode : undefined;

    const updatedPareti = activePozzetto.pareti.map(w => {
      if (w.side === side) {
        return {
          ...w,
          cavidotti: w.cavidotti.map(cond => {
            if (cond.id === condId) {
              const updatedCables = cond.cables.map((c, idx) => {
                if (selectedIndices.includes(idx)) {
                  return {
                    ...c,
                    destinationSide: destSide,
                    destinationFamilyId: destFamily,
                    destinationSizeCode: destSize
                  };
                }
                return c;
              });
              return { ...cond, cables: updatedCables };
            }
            return cond;
          })
        };
      }
      return w;
    });

    updatePozzettoField(activePozzetto.tag, 'pareti', updatedPareti);
    if ((window as any).suiteUI) {
      (window as any).suiteUI.toast(`Instradamento applicato a ${selectedIndices.length} cavi!`, "success");
    }
  };

  // Inizializza DB
  useEffect(() => {
    const initDb = async () => {
      if (propCablesCatalog) {
        setCablesCatalog(propCablesCatalog);
        return;
      }
      setLoadingDb(true);
      try {
        const isDemoMode = isFirebaseMock || (projectData && (projectData as any).isDemo);
        const cab = await fetchElectricalCables(db, isDemoMode);
        setCablesCatalog(cab);
      } catch (e) {
        console.error("Errore inizializzazione db:", e);
      } finally {
        setLoadingDb(false);
      }
    };
    initDb();
  }, [projectData, propCablesCatalog]);

  // Intercetta importazione da canalizzazioni
  useEffect(() => {
    if (importedCables) {
      const payloadCables = Array.isArray(importedCables) ? importedCables : (importedCables.cables || []);
      const payloadConduit = Array.isArray(importedCables) ? undefined : importedCables.conduit;
      
      if (payloadCables.length > 0) {
        const timer = setTimeout(() => {
          const newTag = `TEMP_${Date.now()}`;
          const name = payloadConduit?.familyName ? `Pozzetto da ${payloadConduit.familyName}` : `Pozzetto da Canalizzazione`;
          
          let importedConduits: GruppoCavidotto[] = [];
          if (payloadConduit) {
            const isRect = payloadConduit.sectionType === 'rettangolare' || Boolean(payloadConduit.width && payloadConduit.height);
            const w = payloadConduit.width || (isRect ? payloadConduit.outerDiameter || 100 : undefined);
            const h = payloadConduit.height || (isRect ? payloadConduit.innerDiameter || 75 : undefined);
            const od = payloadConduit.outerDiameter || (isRect ? (w || 100) : 110);
            const id = payloadConduit.innerDiameter || (isRect ? (h || 75) : 92);

            importedConduits = [{
              id: `cond_${Date.now()}`,
              familyId: payloadConduit.familyId,
              familyName: payloadConduit.familyName || 'Canalizzazione',
              sectionType: isRect ? 'rettangolare' : 'circolare',
              width: w,
              height: h,
              dn: isRect ? Math.max(w || 100, h || 75) : od,
              outerDiameter: od,
              innerDiameter: id,
              bendingFactor: isRect ? 6 : 8,

              qty: 1,
              destinationSide: undefined,
              cables: payloadCables.map((c: any, idx: number) => ({
                cableId: c.cableId,
                sigla: c.sigla || String(idx + 1).padStart(2, '0'),
                formation: c.formation,
                diameter: c.diameter,
                weight: c.weight || 0,
                qty: c.qty || 1,
                customBendingFactor: 12
              }))
            }];
          } else {
            // Default Cavidotto DN90
            importedConduits = [{
              id: `cond_default_${Date.now()}`,
              familyId: 'cavidotto',
              familyName: 'Cavidotto doppia parete',
              sectionType: 'circolare',
              dn: 90,
              outerDiameter: 110,
              innerDiameter: 92,
              bendingFactor: 8,
              qty: 1,
              destinationSide: undefined,
              cables: payloadCables.map((c: any, idx: number) => ({
                cableId: c.cableId,
                sigla: c.sigla || String(idx + 1).padStart(2, '0'),
                formation: c.formation,
                diameter: c.diameter,
                weight: c.weight || 0,
                qty: c.qty || 1,
                customBendingFactor: 12
              }))
            }];
          }

          const newPareti: ParetePozzetto[] = [
            {
              id: `parete_sx_${Date.now()}`,
              side: 'sx',
              label: 'Lato Sinistro (Arrivo)',
              cavidotti: importedConduits
            },
            { id: `parete_dx_${Date.now()}`, side: 'dx', label: 'Lato Destro (Partenza)', cavidotti: [] },
            { id: `parete_alto_${Date.now()}`, side: 'alto', label: 'Lato Superiore', cavidotti: [] },
            { id: `parete_basso_${Date.now()}`, side: 'basso', label: 'Lato Inferiore', cavidotti: [] }
          ];

          const newPozzetto: PozzettoProgetto = {
            tag: newTag,
            name: name,
            shape: 'rettangolare',
            baseB: 60,
            lengthL: 60,
            diameterD: 60,
            depthH: 60,
            presetSize: 'POZZET05',
            scortaPct: 25,
            cables: [],
            pareti: newPareti
          };

          setState(prev => {
            const filtered = prev.pozzetti.filter(p => p.name !== name);
            const newList = [...filtered, newPozzetto];
            const updated = regeneratePozzettiTags(newList);
            const finalTag = updated.find(p => p.name === name || p.tag === newTag)?.tag || updated[updated.length - 1].tag;
            return {
              pozzetti: updated,
              activePozzettoTag: finalTag
            };
          });

          if ((window as any).suiteUI) {
            (window as any).suiteUI.toast("Importati cavi e condotto nel nuovo pozzetto!", "success");
          }

          if (clearImportedCables) {
            clearImportedCables();
          }
        }, 150);

        return () => clearTimeout(timer);
      }
    }
  }, [importedCables, clearImportedCables]);

  const handleLoadProject = (loadedData: any) => {
    if (loadedData && Array.isArray(loadedData.pozzetti) && loadedData.pozzetti.length > 0) {
      const validated = loadedData.pozzetti.map((p: any) => {
        const validatedP = {
          tag: p.tag,
          name: p.name || p.tag,
          shape: p.shape || 'rettangolare',
          baseB: Number(p.baseB) || 60,
          lengthL: Number(p.lengthL) || 60,
          diameterD: Number(p.diameterD) || 60,
          depthH: Number(p.depthH) || 60,
          presetSize: p.presetSize || 'POZZET05',
          scortaPct: p.scortaPct !== undefined ? Number(p.scortaPct) : 25,
          cables: Array.isArray(p.cables) ? p.cables : [],
          pareti: [] as ParetePozzetto[]
        };
        validatedP.pareti = ensurePozzettoPareti(p);
        return validatedP;
      });
      const updated = regeneratePozzettiTags(validated);
      setState({
        pozzetti: updated,
        activePozzettoTag: updated[0].tag
      });
    } else {
      setState(defaultState);
    }
  };

  const activePozzetto = useMemo(() => {
    return state.pozzetti.find(p => p.tag === state.activePozzettoTag) || state.pozzetti[0];
  }, [state.pozzetti, state.activePozzettoTag]);

  const calcoliActive = useMemo(() => {
    return calcolaCompliancePozzetto(activePozzetto, cablesCatalog, availableContainers);
  }, [activePozzetto, cablesCatalog, availableContainers]);

  const pozzettiCompliance = useMemo(() => {
    return state.pozzetti.map(p => {
      const comp = calcolaCompliancePozzetto(p, cablesCatalog, availableContainers);
      return {
        tag: p.tag,
        esito: comp?.esito || 'verificato',
        fillRate: comp?.fillRate || 0
      };
    });
  }, [state.pozzetti, cablesCatalog, availableContainers]);

  const handleAddPozzetto = () => {
    const tempTag = `TEMP_${Date.now()}`;
    const newPozz: PozzettoProgetto = {
      tag: tempTag,
      name: `Pozzetto ${state.pozzetti.length + 1}`,
      shape: 'rettangolare',
      baseB: 60,
      lengthL: 60,
      diameterD: 60,
      depthH: 60,
      presetSize: 'POZZET05', // 60x60
      scortaPct: 25,
      cables: [],
      pareti: [
        { id: `p_sx_${Date.now()}`, side: 'sx', label: 'Lato Sinistro (Arrivo)', cavidotti: [] },
        { id: `p_dx_${Date.now()}`, side: 'dx', label: 'Lato Destro (Partenza)', cavidotti: [] },
        { id: `p_alto_${Date.now()}`, side: 'alto', label: 'Lato Superiore', cavidotti: [] },
        { id: `p_basso_${Date.now()}`, side: 'basso', label: 'Lato Inferiore', cavidotti: [] }
      ]
    };

    setState(prev => {
      const newList = [...prev.pozzetti, newPozz];
      const updated = regeneratePozzettiTags(newList);
      const nextActive = updated[updated.length - 1].tag;
      return { pozzetti: updated, activePozzettoTag: nextActive };
    });
    if ((window as any).suiteUI) (window as any).suiteUI.toast("Pozzetto aggiunto!", "success");
  };

  const handleDuplicatePozzetto = () => {
    const tempTag = `TEMP_DUP_${Date.now()}`;
    const duplicated: PozzettoProgetto = {
      ...activePozzetto,
      tag: tempTag,
      name: `${activePozzetto.name} Copia`,
      pareti: activePozzetto.pareti.map(w => ({
        ...w,
        cavidotti: w.cavidotti.map(cond => ({
          ...cond,
          cables: cond.cables.map(c => ({ ...c }))
        }))
      }))
    };

    setState(prev => {
      const newList = [...prev.pozzetti, duplicated];
      const updated = regeneratePozzettiTags(newList);
      const nextActive = updated[updated.length - 1].tag;
      return { pozzetti: updated, activePozzettoTag: nextActive };
    });
    if ((window as any).suiteUI) (window as any).suiteUI.toast("Pozzetto duplicato!", "success");
  };

  const handleDeletePozzetto = (tag: string) => {
    if (state.pozzetti.length <= 1) {
      if ((window as any).suiteUI) (window as any).suiteUI.alert("Impossibile eliminare l'unico pozzetto del progetto.");
      return;
    }
    setState(prev => {
      const filtered = prev.pozzetti.filter(p => p.tag !== tag);
      const updated = regeneratePozzettiTags(filtered);
      const nextActive = prev.activePozzettoTag === tag ? updated[0].tag : updated.find(p => p.tag === prev.activePozzettoTag)?.tag || updated[0].tag;
      return { pozzetti: updated, activePozzettoTag: nextActive };
    });
    if ((window as any).suiteUI) (window as any).suiteUI.toast("Pozzetto rimosso!", "info");
  };

  const updatePozzettoField = (tag: string, field: keyof PozzettoProgetto, value: any) => {
    setState(prev => {
      const updated = prev.pozzetti.map(p => {
        if (p.tag === tag) {
          const updatedP = { ...p, [field]: value } as PozzettoProgetto;
          
          if (field === 'shape') {
            updatedP.presetSize = value === 'rettangolare' ? 'POZZET05' : 'o60x60';
            if (value === 'rettangolare') {
              updatedP.baseB = 60;
              updatedP.lengthL = 60;
            } else {
              updatedP.diameterD = 60;
            }
            updatedP.depthH = 60;
          }

          if (field === 'presetSize') {
            if (value !== 'custom') {
              const preset = POZZETTI_CLS_PRESETS.find(item => item.code === value);
              if (preset) {
                updatedP.baseB = preset.baseB;
                updatedP.lengthL = preset.lengthL;
                updatedP.depthH = preset.depthH;
              } else if (p.shape === 'rettangolare') {
                const parts = value.split('x').map(Number);
                if (parts.length === 3) {
                  updatedP.baseB = parts[0];
                  updatedP.lengthL = parts[1];
                  updatedP.depthH = parts[2];
                }
              } else {
                const cleaned = value.replace('o', '');
                const parts = cleaned.split('x').map(Number);
                if (parts.length === 2) {
                  updatedP.diameterD = parts[0];
                  updatedP.depthH = parts[1];
                }
              }
            }
          }
          return updatedP;
        }
        return p;
      });
      return { ...prev, pozzetti: updated };
    });
  };

  const handleAddCavidotto = (side: 'sx' | 'dx' | 'alto' | 'basso') => {
    const defaultFam = availableContainers.find(f => f.id === 'cavidotto') || availableContainers[0];
    const defaultSize = defaultFam?.sizes.find(s => s.outerDiameter === 90 || s.code === 'CEFD90') || defaultFam?.sizes[0];

    const newCond: GruppoCavidotto = {
      id: `cond_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      familyId: defaultFam?.id || 'cavidotto',
      familyName: defaultFam?.name || 'Cavidotto doppia parete',
      sectionType: defaultFam?.sectionType || 'circolare',
      sizeCode: defaultSize?.code || 'CEFD90',
      dn: defaultSize?.outerDiameter || 90,
      outerDiameter: defaultSize?.outerDiameter || 90,
      innerDiameter: defaultSize?.innerDiameter || 77,
      bendingFactor: 8,
      qty: 1,
      cables: []
    };
    
    const updatedPareti = activePozzetto.pareti.map(w => {
      if (w.side === side) {
        return { ...w, cavidotti: [...w.cavidotti, newCond] };
      }
      return w;
    });
    updatePozzettoField(activePozzetto.tag, 'pareti', updatedPareti);
    if ((window as any).suiteUI) (window as any).suiteUI.toast("Cavidotto aggiunto alla parete!", "success");
  };

  const handleDeleteCavidotto = (side: 'sx' | 'dx' | 'alto' | 'basso', condId: string) => {
    const updatedPareti = activePozzetto.pareti.map(w => {
      if (w.side === side) {
        return { ...w, cavidotti: w.cavidotti.filter(c => c.id !== condId) };
      }
      return w;
    });
    updatePozzettoField(activePozzetto.tag, 'pareti', updatedPareti);
    if ((window as any).suiteUI) (window as any).suiteUI.toast("Cavidotto rimosso dalla parete!", "info");
  };

  const handleUpdateCavidotto = (side: 'sx' | 'dx' | 'alto' | 'basso', condId: string, field: string, value: any) => {
    const updatedPareti = activePozzetto.pareti.map(w => {
      if (w.side === side) {
        return {
          ...w,
          cavidotti: w.cavidotti.map(c => {
            if (c.id === condId) {
              const updatedCond = { ...c, [field]: value } as GruppoCavidotto;
              
              if (field === 'familyId') {
                const fam = availableContainers.find(f => f.id === value);
                if (fam) {
                  updatedCond.familyId = fam.id;
                  updatedCond.familyName = fam.name;
                  updatedCond.sectionType = fam.sectionType;
                  const firstSize = fam.sizes[0];
                  if (firstSize) {
                    updatedCond.sizeCode = firstSize.code;
                    if (fam.sectionType === 'rettangolare') {
                      updatedCond.width = firstSize.width || 100;
                      updatedCond.height = firstSize.height || 75;
                      updatedCond.outerDiameter = firstSize.width || 100;
                      updatedCond.innerDiameter = firstSize.height || 75;
                      updatedCond.dn = Math.max(firstSize.width || 100, firstSize.height || 75);
                      updatedCond.bendingFactor = 6;
                    } else {
                      delete updatedCond.width;
                      delete updatedCond.height;
                      updatedCond.outerDiameter = firstSize.outerDiameter || 90;
                      updatedCond.innerDiameter = firstSize.innerDiameter || 77;
                      updatedCond.dn = firstSize.outerDiameter || 90;
                      updatedCond.bendingFactor = 8;
                    }
                  }
                } else if (value === 'personalizzato') {
                  updatedCond.familyId = 'personalizzato';
                  updatedCond.familyName = 'Personalizzato';
                  updatedCond.sectionType = 'rettangolare';
                  updatedCond.sizeCode = 'custom';
                  updatedCond.width = 100;
                  updatedCond.height = 75;
                  updatedCond.outerDiameter = 100;
                  updatedCond.innerDiameter = 75;
                  updatedCond.dn = 100;
                  updatedCond.bendingFactor = 6;
                }
              } else if (field === 'sizeCode') {
                const fam = availableContainers.find(f => f.id === updatedCond.familyId) || availableContainers.find(f => f.sizes.some(s => s.code === value)) || availableContainers[0];
                const sz = fam?.sizes.find(s => s.code === value);
                if (sz) {
                  updatedCond.sizeCode = sz.code;
                  updatedCond.sectionType = fam.sectionType;
                  if (fam.sectionType === 'rettangolare' || sz.width) {
                    updatedCond.width = sz.width || 100;
                    updatedCond.height = sz.height || 75;
                    updatedCond.outerDiameter = sz.width || 100;
                    updatedCond.innerDiameter = sz.height || 75;
                    updatedCond.dn = Math.max(sz.width || 100, sz.height || 75);
                  } else {
                    delete updatedCond.width;
                    delete updatedCond.height;
                    updatedCond.outerDiameter = sz.outerDiameter || 90;
                    updatedCond.innerDiameter = sz.innerDiameter || 77;
                    updatedCond.dn = sz.outerDiameter || 90;
                  }
                }
              } else if (field === 'dn') {
                const cat = CAVIDOTTI_DOPPIA_PARETE.find(item => item.dn === Number(value));
                if (cat) {
                  updatedCond.outerDiameter = cat.outerDiameter;
                  updatedCond.innerDiameter = cat.innerDiameter;
                  updatedCond.bendingFactor = cat.bendingFactor;
                }
              }
              return updatedCond;
            }
            return c;
          })
        };
      }
      return w;
    });
    updatePozzettoField(activePozzetto.tag, 'pareti', updatedPareti);
  };

  const handleAddCableToConduit = (side: 'sx' | 'dx' | 'alto' | 'basso', condId: string) => {
    const defaultCable = cablesCatalog[0] || { id: 'personalizzato', name: 'Personalizzato', description: '', formations: [], type: 'cavo' };
    const defaultFormation = defaultCable.formations?.[0]?.formation || 'Personalizzato';
    const defaultDiameter = defaultCable.formations?.[0]?.diameter || 10;
    const defaultWeight = defaultCable.formations?.[0]?.weight || 0.15;

    let nextNum = 1;
    const existingNums: number[] = [];
    activePozzetto.pareti.forEach(w => {
      w.cavidotti.forEach(cond => {
        cond.cables.forEach(c => {
          const num = parseInt(c.sigla || '') || 0;
          if (num > 0) existingNums.push(num);
        });
      });
    });
    if (existingNums.length > 0) {
      nextNum = Math.max(...existingNums) + 1;
    }
    const sigla = String(nextNum).padStart(2, '0');

    const newCable: CavoSelezionatoPozzetto = {
      cableId: defaultCable.id,
      sigla,
      formation: defaultFormation,
      diameter: defaultDiameter,
      weight: defaultWeight,
      qty: 1,
      customBendingFactor: 12
    };

    const updatedPareti = activePozzetto.pareti.map(w => {
      if (w.side === side) {
        return {
          ...w,
          cavidotti: w.cavidotti.map(c => {
            if (c.id === condId) {
              return { ...c, cables: [...c.cables, newCable] };
            }
            return c;
          })
        };
      }
      return w;
    });
    updatePozzettoField(activePozzetto.tag, 'pareti', updatedPareti);
  };

  const handleUpdateCableInConduit = (side: 'sx' | 'dx' | 'alto' | 'basso', condId: string, cableIdx: number, field: keyof CavoSelezionatoPozzetto, value: any) => {
    let targetConduitIdToSync: string | undefined = undefined;
    let newFamilyToSync: string | undefined = undefined;
    let newSizeToSync: string | undefined = undefined;

    const updatedPareti = activePozzetto.pareti.map(w => {
      if (w.side === side) {
        return {
          ...w,
          cavidotti: w.cavidotti.map(cond => {
            if (cond.id === condId) {
              const updatedCables = [...cond.cables];
              const cable = { ...updatedCables[cableIdx], [field]: value } as CavoSelezionatoPozzetto;

              if (field === 'cableId') {
                if (value === 'personalizzato') {
                  cable.formation = 'Personalizzato';
                  cable.diameter = 10;
                  cable.weight = 0.15;
                  cable.customBendingFactor = 12;
                } else {
                  const prod = cablesCatalog.find(c => c.id === value);
                  if (prod) {
                    const form = prod.formations[0];
                    cable.formation = form.formation;
                    cable.diameter = form.diameter;
                    cable.weight = form.weight;
                    cable.customBendingFactor = prod.raggioCurvaturaMinFattore || 12;
                  }
                }
              } else if (field === 'formation' && cable.cableId !== 'personalizzato') {
                const prod = cablesCatalog.find(c => c.id === cable.cableId);
                const form = prod?.formations.find(f => f.formation === value);
                if (form) {
                  cable.diameter = form.diameter;
                  cable.weight = form.weight;
                }
              } else if (field === 'destinationSide') {
                const newSide = value as 'sx' | 'dx' | 'alto' | 'basso' | undefined;
                cable.destinationSide = newSide;
                if (newSide) {
                  const existingEgress = getEgressConduitsForPozzetto(activePozzetto, newSide, availableContainers);
                  if (existingEgress.length > 0) {
                    cable.destinationConduitId = existingEgress[0].id;
                    cable.destinationFamilyId = existingEgress[0].familyId;
                    cable.destinationSizeCode = existingEgress[0].sizeCode;
                  } else {
                    const newCondId = `exit_${newSide}_${Date.now()}`;
                    cable.destinationConduitId = newCondId;
                    cable.destinationFamilyId = 'cavidotto';
                    cable.destinationSizeCode = 'CEFD90';
                  }
                } else {
                  delete cable.destinationConduitId;
                  delete cable.destinationFamilyId;
                  delete cable.destinationSizeCode;
                }
              } else if (field === 'destinationConduitId') {
                if (value === 'new') {
                  const destSide = cable.destinationSide || 'dx';
                  const newCondId = `exit_${destSide}_${Date.now()}`;
                  cable.destinationConduitId = newCondId;
                  cable.destinationFamilyId = 'cavidotto';
                  cable.destinationSizeCode = 'CEFD90';
                } else {
                  cable.destinationConduitId = value;
                  const existing = getEgressConduitsForPozzetto(activePozzetto, cable.destinationSide || 'dx', availableContainers).find(e => e.id === value);
                  if (existing) {
                    cable.destinationFamilyId = existing.familyId;
                    cable.destinationSizeCode = existing.sizeCode;
                  }
                }
              } else if (field === 'destinationFamilyId') {
                cable.destinationFamilyId = value;
                const fam = availableContainers.find(f => f.id === value);
                if (fam && fam.sizes.length > 0) {
                  cable.destinationSizeCode = fam.sizes[0].code;
                }
              } else if (field === 'destinationSizeCode') {
                cable.destinationSizeCode = value;
              }

              if (cable.destinationConduitId && (field === 'destinationFamilyId' || field === 'destinationSizeCode')) {
                targetConduitIdToSync = cable.destinationConduitId;
                newFamilyToSync = cable.destinationFamilyId;
                newSizeToSync = cable.destinationSizeCode;
              }

              updatedCables[cableIdx] = cable;
              return { ...cond, cables: updatedCables };
            }
            return cond;
          })
        };
      }
      return w;
    });

    if (targetConduitIdToSync && (newFamilyToSync || newSizeToSync)) {
      const syncedPareti = updatedPareti.map(w => ({
        ...w,
        cavidotti: w.cavidotti.map(c => ({
          ...c,
          cables: c.cables.map(cb => {
            if (cb.destinationConduitId === targetConduitIdToSync) {
              return {
                ...cb,
                destinationFamilyId: newFamilyToSync || cb.destinationFamilyId,
                destinationSizeCode: newSizeToSync || cb.destinationSizeCode
              };
            }
            return cb;
          })
        }))
      }));
      updatePozzettoField(activePozzetto.tag, 'pareti', syncedPareti);
    } else {
      updatePozzettoField(activePozzetto.tag, 'pareti', updatedPareti);
    }
  };

  const handleDeleteCableFromConduit = (side: 'sx' | 'dx' | 'alto' | 'basso', condId: string, cableIdx: number) => {
    const updatedPareti = activePozzetto.pareti.map(w => {
      if (w.side === side) {
        return {
          ...w,
          cavidotti: w.cavidotti.map(cond => {
            if (cond.id === condId) {
              return { ...cond, cables: cond.cables.filter((_, idx) => idx !== cableIdx) };
            }
            return cond;
          })
        };
      }
      return w;
    });
    updatePozzettoField(activePozzetto.tag, 'pareti', updatedPareti);
  };

  const handleUpdateDestinationSide = (side: 'sx' | 'dx' | 'alto' | 'basso', destSide: 'sx' | 'dx' | 'alto' | 'basso' | undefined) => {
    const updatedPareti = activePozzetto.pareti.map(w => {
      if (w.side === side) {
        return { ...w, destinationSide: destSide === side ? undefined : destSide };
      }
      return w;
    });
    updatePozzettoField(activePozzetto.tag, 'pareti', updatedPareti);
  };

  // Esporta in Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const exportRows: any[] = [];
    state.pozzetti.forEach(pozz => {
      const calc = calcolaCompliancePozzetto(pozz, cablesCatalog);
      const pareti = ensurePozzettoPareti(pozz);
      
      let hasAnyCables = false;
      
      pareti.forEach(w => {
        w.cavidotti.forEach(cond => {
          cond.cables.forEach(c => {
            hasAnyCables = true;
            let fattore = 12;
            if (c.cableId === 'personalizzato') {
              fattore = c.customBendingFactor || 12;
            } else {
              const dbC = cablesCatalog.find(x => x.id === c.cableId);
              if (dbC) fattore = dbC.raggioCurvaturaMinFattore || 12;
            }

            exportRows.push({
              "Pozzetto": pozz.name,
              "Forma": pozz.shape === 'rettangolare' ? 'Rettangolare' : 'Cilindrico',
              "Dimensioni Est [cm]": pozz.shape === 'rettangolare' 
                ? `${pozz.baseB}x${pozz.lengthL}x${pozz.depthH}` 
                : `Ø${pozz.diameterD}x${pozz.depthH}`,
              "Dimensioni Int [cm]": pozz.shape === 'rettangolare'
                ? `${calc?.innerB}x${calc?.innerL}x${calc?.innerH}`
                : `Ø${calc?.innerB}x${calc?.innerH}`,
              "Volume Utilizzato [L]": formatNumber((calc?.volumePozzetto || 0) / 1000, 1),
              "Scorta Cavi [%]": pozz.scortaPct,
              "Parete di Ingresso": w.label,
              "Tratta in Uscita": cond.destinationSide ? cond.destinationSide.toUpperCase() : "Nessuno",
              "Cavidotto (DN)": cond.dn,
              "Cavidotto Q.tà": cond.qty,
              "Sigla Cavo": c.sigla || "",
              "Formazione": c.formation,
              "Q.tà Cavi": c.qty,
              "Ø Esterno [mm]": c.diameter,
              "Fattore Curvatura Cavo": fattore,
              "R_min Cavo [mm]": fattore * c.diameter,
              "Riempimento Globale [%]": formatNumber(calc?.fillRate || 0, 1),
              "Riempimento Parete [%]": formatNumber(calc?.paretiCompliance?.find((wc: any) => wc.side === w.side)?.fillRate || 0, 1),
              "Esito Verifica": calc?.esito === 'verificato' ? 'VERIFICATO' : calc?.esito === 'attenzione' ? 'ATTENZIONE' : 'NON VERIFICATO'
            });
          });
        });
      });

      if (!hasAnyCables) {
        exportRows.push({
          "Pozzetto": pozz.name,
          "Forma": pozz.shape === 'rettangolare' ? 'Rettangolare' : 'Cilindrico',
          "Dimensioni Est [cm]": pozz.shape === 'rettangolare' 
            ? `${pozz.baseB}x${pozz.lengthL}x${pozz.depthH}` 
            : `Ø${pozz.diameterD}x${pozz.depthH}`,
          "Volume Utilizzato [L]": formatNumber((calc?.volumePozzetto || 0) / 1000, 1),
          "Scorta Cavi [%]": pozz.scortaPct,
          "Riempimento Globale [%]": "0.0",
          "Esito Verifica": "VERIFICATO (VUOTO)"
        });
      }
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, ws, "Pozzetti Elettrici");
    XLSX.writeFile(wb, "Verifica_Pozzetti_Elettrici.xlsx");
    if ((window as any).suiteUI) (window as any).suiteUI.toast("Verifica esportata in Excel con successo!", "success");
  };

  return (
    <div className="bg-slate-100 rounded-3xl p-6 md:p-8 animate-in fade-in duration-300">
      
      {/* Project Storage bar */}
      <div className="print:hidden mb-6">
        <ProjectStorage 
          toolType="dimensionamento_pozzetti" 
          currentData={state} 
          onLoadProject={handleLoadProject} 
          projectInfo={projectData} 
          setProjectInfo={setProjectData} 
        />
      </div>

      {/* Intestazione */}
      <ProjectHeader pData={projectData} setPData={setProjectData} title="Dimensionamento e Verifica Pozzetti Elettrici" setAppMode={setAppMode} iconColor="orange" />

      {/* Spiegazione & Formule */}
      <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 mb-5 text-xs text-slate-650 space-y-2.5 print:hidden">
        <p>
          <strong>Descrizione:</strong> Verifica il grado di riempimento volumetrico globale netto del pozzetto di tiraggio/derivazione elettrica, il rispetto del raggio minimo di curvatura dei cavi (R<sub>min</sub> per piegatura a 90°) e l'ingombro dei cavidotti sulle singole pareti.
        </p>
        <div className="bg-white/80 border border-amber-100 rounded-xl p-4 text-slate-600">
          <p className="font-bold text-slate-700 mb-2.5 text-[11px] uppercase tracking-wide">Formule applicate e Criteri di Verifica:</p>
          <div className="space-y-3 pl-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span>• Riempimento Volumettrico Netto Pozzetto:</span>
              <span className="font-serif font-bold text-slate-800 flex items-center">
                Fill Rate = 
                <span className="inline-flex flex-col items-center align-middle mx-1.5 text-center text-[10px]">
                  <span className="border-b border-slate-400 px-1 pb-0.5">V<sub>cavi</sub> × (1 + Scorta%)</span>
                  <span className="px-1 pt-0.5">V<sub>netto pozzetto</sub></span>
                </span>
                × 100 [%]
                <span className="text-[11px] text-slate-500 font-sans font-normal ml-2">(Soglia max: 15% ottimale, 25% limite)</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span>• Raggio Minimo di Curvatura Cavo (Piegatura 90°):</span>
              <span className="font-serif font-bold text-slate-800 flex items-center">
                R<sub>min</sub> = k × Ø<sub>cavo</sub>
                <span className="text-[11px] text-slate-500 font-sans font-normal ml-2">➔ Spazio utile richiesto: Dim<sub>min</sub> ≥ R<sub>min</sub> + Ø<sub>cavo</sub></span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span>• Ingombro Pareti & Distanza Angoli:</span>
              <span className="font-serif font-bold text-slate-800 flex items-center">
                Fill Parete ≤ 40%
                <span className="text-[11px] text-slate-500 font-sans font-normal ml-2">(Margine di rispetto di 5 cm dagli angoli interni)</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="print:hidden space-y-6">
        
        {/* Elenco dei Pozzetti (Menu a schede in stile Tratte) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-800">
                Pozzetti in Progetto
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Seleziona, aggiungi o duplica i pozzetti del progetto. Clicca su una scheda per configurarla.
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleAddPozzetto}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Pozzetto
              </button>
              <button 
                onClick={handleDuplicatePozzetto}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-150 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                <Copy className="w-4 h-4" /> Duplica
              </button>
              {state.pozzetti.length > 1 && (
                <button 
                  onClick={() => handleDeletePozzetto(activePozzetto.tag)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Rimuovi
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {state.pozzetti.map(p => {
              const comp = pozzettiCompliance.find(c => c.tag === p.tag);
              const isSelected = p.tag === state.activePozzettoTag;
              return (
                <div
                  key={p.tag}
                  onClick={() => setState(prev => ({ ...prev, activePozzettoTag: p.tag }))}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-amber-400 bg-amber-50/30 ring-2 ring-amber-400/20'
                      : 'border-slate-150 bg-slate-50/30 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-black text-slate-800 truncate">
                      {p.name}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                      comp?.esito === 'verificato' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      comp?.esito === 'attenzione' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {comp?.esito === 'verificato' ? 'IDONEO' : comp?.esito === 'attenzione' ? 'ATTENZIONE' : 'ERRATO'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold space-y-0.5">
                    <div>Tipo: {p.shape === 'rettangolare' ? 'Rettangolare' : 'Cilindrico'}</div>
                    <div>Dim: {p.shape === 'rettangolare' ? `${p.baseB}x${p.lengthL}x${p.depthH} cm` : `Ø ${p.diameterD}x${p.depthH} cm`}</div>
                    <div>Riempimento: <strong className="text-slate-700 font-bold">{formatNumber(comp?.fillRate || 0, 1)}%</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Configurazione Pozzetto e Cavi */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Colonna Sinistra/Centro: Dati geometrici e cavi */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Box Configurazione Geometria */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-black text-slate-800 border-b border-slate-100 pb-3">
                Geometria Pozzetto: {activePozzetto.name}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Forma Pozzetto</label>
                  <select
                    value={activePozzetto.shape}
                    onChange={e => updatePozzettoField(activePozzetto.tag, 'shape', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="rettangolare">Rettangolare / Quadrato</option>
                    <option value="cilindrico">Cilindrico</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Dimensioni Standard</label>
                  <select
                    value={activePozzetto.presetSize}
                    onChange={e => updatePozzettoField(activePozzetto.tag, 'presetSize', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {activePozzetto.shape === 'rettangolare' ? (
                      <>
                        {POZZETTI_CLS_PRESETS.map(preset => (
                          <option key={preset.code} value={preset.code}>
                            {preset.label}
                          </option>
                        ))}
                      </>
                    ) : (
                      <>
                        <option value="o40x40">Ø 40 H 40 cm</option>
                        <option value="o50x50">Ø 50 H 50 cm</option>
                        <option value="o60x60">Ø 60 H 60 cm</option>
                        <option value="o80x80">Ø 80 H 80 cm</option>
                        <option value="o100x100">Ø 100 H 100 cm</option>
                        <option value="o120x120">Ø 120 H 120 cm</option>
                      </>
                    )}
                    <option value="custom">Personalizzato</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Scorta Cavi (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={activePozzetto.scortaPct}
                    onChange={e => updatePozzettoField(activePozzetto.tag, 'scortaPct', e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              {/* Campi dimensionali */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                {activePozzetto.shape === 'rettangolare' ? (
                  <>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Base B (cm)</label>
                      <input
                        type="number"
                        min="1"
                        disabled={activePozzetto.presetSize !== 'custom'}
                        value={activePozzetto.baseB ?? ''}
                        onChange={e => updatePozzettoField(activePozzetto.tag, 'baseB', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full bg-slate-50 disabled:opacity-60 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Lunghezza L (cm)</label>
                      <input
                        type="number"
                        min="1"
                        disabled={activePozzetto.presetSize !== 'custom'}
                        value={activePozzetto.lengthL ?? ''}
                        onChange={e => updatePozzettoField(activePozzetto.tag, 'lengthL', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full bg-slate-50 disabled:opacity-60 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Diametro D (cm)</label>
                    <input
                      type="number"
                      min="1"
                      disabled={activePozzetto.presetSize !== 'custom'}
                      value={activePozzetto.diameterD ?? ''}
                      onChange={e => updatePozzettoField(activePozzetto.tag, 'diameterD', e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full bg-slate-50 disabled:opacity-60 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Profondità H (cm)</label>
                  <input
                    type="number"
                    min="1"
                    disabled={activePozzetto.presetSize !== 'custom'}
                    value={activePozzetto.depthH ?? ''}
                    onChange={e => updatePozzettoField(activePozzetto.tag, 'depthH', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full bg-slate-50 disabled:opacity-60 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold"
                  />
                </div>
              </div>
            </div>
            {/* Box Tabella Pareti/Cavidotti/Cavi */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-3 mb-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    Configurazione Pareti e Ingressi
                  </h3>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Seleziona una parete del pozzetto per gestire i cavidotti/corrugati e i cavi associati.
                  </p>
                </div>
                {/* Selector Parete Configurazione */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  {(['sx', 'dx', 'alto', 'basso'] as const).map(side => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setConfigWallSide(side)}
                      className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                        configWallSide === side 
                          ? 'bg-white text-indigo-700 shadow-xs' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {side.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dettagli della Parete selezionata */}
              {(() => {
                const pareti = ensurePozzettoPareti(activePozzetto);
                const w = pareti.find(item => item.side === configWallSide)!;
                const comp = calcoliActive?.paretiCompliance?.find((item: any) => item.side === configWallSide);

                return (
                  <div className="space-y-6">
                    {/* Elenco Condotti / Canalizzazioni */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-slate-700 uppercase tracking-wide">Innestati / Canalizzazioni ({w.cavidotti.length})</span>
                        <button
                          type="button"
                          onClick={() => handleAddCavidotto(configWallSide)}
                          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Condotto/Canala
                        </button>
                      </div>

                      {w.cavidotti.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400 font-semibold border-2 border-dashed border-slate-200 rounded-2xl">
                          Nessuna canalizzazione o cavidotto installato su questa parete. Clicca su "+ Condotto/Canala".
                        </div>
                      ) : (
                        w.cavidotti.map((cond, condIdx) => {
                          const isRect = cond.sectionType === 'rettangolare' || Boolean(cond.width && cond.height);
                          const curFam = availableContainers.find(f => f.id === (cond.familyId || 'cavidotto'));


                          return (
                            <div key={cond.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                              {/* Header Dati Condotto */}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                                  <span className="text-xs font-black text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shrink-0">
                                    #{condIdx + 1} {getConduitLabel(cond)}
                                  </span>

                                  {/* Famiglia Condotto */}
                                  <select
                                    value={cond.familyId || (isRect ? 'canala_pvc' : 'cavidotto')}
                                    onChange={e => handleUpdateCavidotto(configWallSide, cond.id, 'familyId', e.target.value)}
                                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 max-w-[150px] truncate shrink-0"
                                  >
                                    {availableContainers.map(f => (
                                      <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                    <option value="personalizzato">Personalizzato</option>
                                  </select>

                                  {/* Misura / Taglia */}
                                  {curFam && curFam.sizes && (
                                    <select
                                      value={cond.sizeCode || curFam.sizes.find(s => (isRect ? (s.width === cond.width && s.height === cond.height) : (s.outerDiameter === cond.outerDiameter)))?.code || curFam.sizes[0]?.code || ''}
                                      onChange={e => handleUpdateCavidotto(configWallSide, cond.id, 'sizeCode', e.target.value)}
                                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 max-w-[150px] truncate shrink-0"
                                    >
                                      {curFam.sizes.map(sz => (
                                        <option key={sz.code} value={sz.code}>{sz.label}</option>
                                      ))}
                                    </select>
                                  )}

                                  {/* Quantità condotti paralleli */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">Q.tà:</span>
                                    <input
                                      type="number"
                                      min="1"
                                      value={cond.qty}
                                      onChange={e => handleUpdateCavidotto(configWallSide, cond.id, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                                      className="bg-white border border-slate-200 rounded-lg p-1 text-[11px] w-11 text-center font-bold text-slate-700"
                                    />
                                  </div>

                                  {/* Info Raggio Curvatura Tubo nel Terreno (solo per tubi/sezione circolare) */}
                                  {!isRect && (
                                    <div className="flex items-center gap-1 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg shrink-0">
                                      <span className="text-[9.5px] text-blue-600 font-bold uppercase">Raggio Tubo:</span>
                                      <span className="text-[10.5px] font-extrabold text-blue-700 font-mono">
                                        {formatNumber(((cond.bendingFactor || 8) * (cond.outerDiameter || cond.dn || 90)) / 10, 0)} cm
                                      </span>
                                      <span className="text-[9px] text-blue-500 font-bold">({cond.bendingFactor || 8}xDN)</span>
                                    </div>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteCavidotto(configWallSide, cond.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer shrink-0 ml-auto"
                                  title="Rimuovi cavidotto"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                            {/* Cavi all'interno del cavidotto */}
                            <div className="space-y-3 pl-2 border-l-2 border-blue-200">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Cavi posati nel cavidotto ({cond.cables.length})</span>
                                <button
                                  type="button"
                                  onClick={() => handleAddCableToConduit(configWallSide, cond.id)}
                                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[9px] rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" /> Cavo
                                </button>
                              </div>

                              {cond.cables.length === 0 ? (
                                <div className="p-4 text-center text-[10px] text-slate-400 font-bold border border-dashed border-slate-200 rounded-xl bg-white">
                                  Nessun cavo in questo condotto. Clicca su "+ Cavo" per aggiungerne uno.
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {/* Pannello Assegnazione Massiva Uscite (Batch Routing) */}
                                  {(selectedCableIndicesMap[cond.id] || []).length > 0 && (
                                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
                                      <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-indigo-600" />
                                        <span className="text-xs font-black text-indigo-900">
                                          {(selectedCableIndicesMap[cond.id] || []).length} { (selectedCableIndicesMap[cond.id] || []).length === 1 ? 'cavo selezionato' : 'cavi selezionati' }
                                        </span>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2">
                                        {/* Lato Uscita */}
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] font-bold text-slate-500 uppercase">Uscita:</span>
                                          <select
                                            value={batchExitSide}
                                            onChange={e => setBatchExitSide(e.target.value as any)}
                                            className="bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 shadow-2xs"
                                          >
                                            <option value="">(Scegli Uscita...)</option>
                                            <option value="sx" disabled={configWallSide === 'sx'}>Lato SX</option>
                                            <option value="dx" disabled={configWallSide === 'dx'}>Lato DX</option>
                                            <option value="alto" disabled={configWallSide === 'alto'}>Lato ALTO</option>
                                            <option value="basso" disabled={configWallSide === 'basso'}>Lato BASSO</option>
                                            <option value="none">Termina nel Pozzetto</option>
                                          </select>
                                        </div>

                                        {/* Tipo Condotto Uscita */}
                                        {batchExitSide && batchExitSide !== 'none' && (
                                          <>
                                            <div className="flex items-center gap-1">
                                              <span className="text-[10px] font-bold text-slate-500 uppercase">Condotto:</span>
                                              <select
                                                value={batchExitFamily}
                                                onChange={e => handleBatchExitFamilyChange(e.target.value)}
                                                className="bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 shadow-2xs"
                                              >
                                                {availableContainers.map(f => (
                                                  <option key={f.id} value={f.id}>{f.name}</option>
                                                ))}
                                                <option value="personalizzato">Personalizzato</option>
                                              </select>
                                            </div>

                                            <div className="flex items-center gap-1">
                                              <span className="text-[10px] font-bold text-slate-500 uppercase">Misura:</span>
                                              <select
                                                value={batchExitSizeCode}
                                                onChange={e => setBatchExitSizeCode(e.target.value)}
                                                className="bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 shadow-2xs"
                                              >
                                                {(() => {
                                                  const curFam = availableContainers.find(f => f.id === batchExitFamily) || availableContainers[0];
                                                  return (curFam?.sizes || []).map(sz => (
                                                    <option key={sz.code} value={sz.code}>{sz.label}</option>
                                                  ));
                                                })()}
                                              </select>
                                            </div>
                                          </>
                                        )}

                                        {/* Button Applica */}
                                        <button
                                          type="button"
                                          onClick={() => handleApplyBatchRouting(configWallSide, cond.id)}
                                          disabled={!batchExitSide}
                                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
                                        >
                                          <Save className="w-3.5 h-3.5" /> Applica Uscita ai Cavi Selezionati
                                        </button>

                                        {/* Button Annulla Selezione */}
                                        <button
                                          type="button"
                                          onClick={() => setSelectedCableIndicesMap(prev => ({ ...prev, [cond.id]: [] }))}
                                          className="px-2 py-1.5 text-slate-500 hover:text-slate-700 text-xs font-bold"
                                        >
                                          Deseleziona
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                   <div className="space-y-2">
                                     {cond.cables.map((cavo, cIdx) => {
                                       const prod = cablesCatalog.find(c => c.id === cavo.cableId);
                                       let bFact = 12;
                                       if (cavo.cableId === 'personalizzato') {
                                         bFact = cavo.customBendingFactor || 12;
                                       } else {
                                         bFact = prod?.raggioCurvaturaMinFattore || 12;
                                       }

                                       const isSelected = (selectedCableIndicesMap[cond.id] || []).includes(cIdx);
                                       const curDestSide = cavo.destinationSide;
                                       const availableEgress = curDestSide ? getEgressConduitsForPozzetto(activePozzetto, curDestSide, availableContainers) : [];

                                       const curFamId = cavo.destinationFamilyId || 'cavidotto';
                                       const curFam = availableContainers.find(f => f.id === curFamId) || availableContainers[0];
                                       const sizes = curFam?.sizes || [];

                                       return (
                                         <div 
                                           key={cIdx} 
                                           className={`p-2 rounded-xl border transition-all space-y-1.5 ${
                                             isSelected 
                                               ? 'bg-indigo-50/70 border-indigo-200 shadow-2xs' 
                                               : 'bg-white border-slate-200 hover:border-slate-300'
                                           }`}
                                         >
                                           {/* Riga 1: Identificazione Cavo & Geometria */}
                                           <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                                             <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                                               <input
                                                 type="checkbox"
                                                 checked={isSelected}
                                                 onChange={() => toggleSelectCable(cond.id, cIdx)}
                                                 className="rounded text-indigo-600 cursor-pointer shrink-0"
                                               />

                                               <span className="text-[9px] font-bold text-slate-400 uppercase shrink-0">Sigla:</span>
                                               <input
                                                 type="text"
                                                 value={cavo.sigla || ''}
                                                 onChange={e => handleUpdateCableInConduit(configWallSide, cond.id, cIdx, 'sigla', e.target.value)}
                                                 className="bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[10px] w-9 text-center font-bold text-slate-800 shrink-0"
                                               />

                                               <select
                                                 value={cavo.cableId}
                                                 onChange={e => handleUpdateCableInConduit(configWallSide, cond.id, cIdx, 'cableId', e.target.value)}
                                                 className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[10.5px] font-bold text-slate-800 flex-1 min-w-[140px] max-w-[280px] truncate shrink-0"
                                               >
                                                 {cablesCatalog.map(c => (
                                                   <option key={c.id} value={c.id}>{c.name}</option>
                                                 ))}
                                                 <option value="personalizzato">Personalizzato</option>
                                               </select>

                                               {cavo.cableId === 'personalizzato' ? (
                                                 <input
                                                   type="text"
                                                   value={cavo.formation}
                                                   onChange={e => handleUpdateCableInConduit(configWallSide, cond.id, cIdx, 'formation', e.target.value)}
                                                   className="bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[10px] w-16 shrink-0"
                                                   placeholder="es. 4x1.5"
                                                 />
                                               ) : (
                                                 <select
                                                   value={cavo.formation}
                                                   onChange={e => handleUpdateCableInConduit(configWallSide, cond.id, cIdx, 'formation', e.target.value)}
                                                   className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[10.5px] font-semibold min-w-[85px] max-w-[110px] shrink-0"
                                                 >
                                                   {prod?.formations.map(f => (
                                                     <option key={f.formation} value={f.formation}>{f.formation}</option>
                                                   ))}
                                                 </select>
                                               )}

                                               <span className="text-[9px] font-bold text-slate-400 uppercase shrink-0">Q.tà:</span>
                                               <input
                                                 type="number"
                                                 min="1"
                                                 value={cavo.qty}
                                                 onChange={e => handleUpdateCableInConduit(configWallSide, cond.id, cIdx, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                                                 className="bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[10px] w-9 text-center font-extrabold shrink-0"
                                               />
                                             </div>

                                             <button
                                               type="button"
                                               onClick={() => handleDeleteCableFromConduit(configWallSide, cond.id, cIdx)}
                                               className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer shrink-0"
                                               title="Rimuovi cavo"
                                             >
                                               <Trash2 className="w-3.5 h-3.5" />
                                             </button>
                                           </div>

                                           {/* Riga 2: Destinazione & Condotto Uscita (Compattata su esattamente 1 riga) */}
                                           <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 text-[10px]">
                                             <span className="font-extrabold text-indigo-700 uppercase tracking-wider text-[9px] shrink-0">
                                               Uscita:
                                             </span>

                                             <select
                                               value={cavo.destinationSide || ''}
                                               onChange={e => handleUpdateCableInConduit(configWallSide, cond.id, cIdx, 'destinationSide', e.target.value ? e.target.value as any : undefined)}
                                               className="bg-white border border-indigo-200 rounded px-1.5 py-0.5 text-[9.5px] font-bold text-indigo-700 shadow-2xs max-w-[120px] shrink-0"
                                             >
                                               <option value="">(Termina in pozzetto)</option>
                                               <option value="sx" disabled={configWallSide === 'sx'}>Lato SX</option>
                                               <option value="dx" disabled={configWallSide === 'dx'}>Lato DX</option>
                                               <option value="alto" disabled={configWallSide === 'alto'}>Lato ALTO</option>
                                               <option value="basso" disabled={configWallSide === 'basso'}>Lato BASSO</option>
                                             </select>

                                             {cavo.destinationSide && (
                                               <>
                                                 <span className="font-bold text-slate-400 text-[9px] shrink-0">Condotto:</span>
                                                 <select
                                                   value={cavo.destinationConduitId || ''}
                                                   onChange={e => handleUpdateCableInConduit(configWallSide, cond.id, cIdx, 'destinationConduitId', e.target.value)}
                                                   className="bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 text-[9.5px] font-extrabold text-indigo-900 shadow-2xs max-w-[120px] truncate shrink-0"
                                                 >
                                                   {availableEgress.map((eg, idx) => (
                                                     <option key={eg.id} value={eg.id}>{eg.tag} ({eg.cablesCount} cavi)</option>
                                                   ))}
                                                   <option value="new">+ Nuovo Condotto</option>
                                                 </select>

                                                 <span className="font-bold text-slate-400 text-[9px] shrink-0">Tipo:</span>
                                                 <select
                                                   value={curFamId}
                                                   onChange={e => handleUpdateCableInConduit(configWallSide, cond.id, cIdx, 'destinationFamilyId', e.target.value)}
                                                   className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[9.5px] font-bold text-slate-700 max-w-[110px] truncate shrink-0"
                                                 >
                                                   {availableContainers.map(f => (
                                                     <option key={f.id} value={f.id}>{f.name}</option>
                                                   ))}
                                                   <option value="personalizzato">Personalizzato</option>
                                                 </select>

                                                 <span className="font-bold text-slate-400 text-[9px] shrink-0">Misura:</span>
                                                 <select
                                                   value={cavo.destinationSizeCode || sizes[0]?.code || ''}
                                                   onChange={e => handleUpdateCableInConduit(configWallSide, cond.id, cIdx, 'destinationSizeCode', e.target.value)}
                                                   className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[9.5px] font-bold text-slate-700 max-w-[105px] truncate shrink-0"
                                                 >
                                                   {sizes.map(sz => (
                                                     <option key={sz.code} value={sz.code}>{sz.label}</option>
                                                   ))}
                                                 </select>
                                               </>
                                             )}
                                           </div>
                                         </div>
                                       );
                                     })}
                                   </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Rendering Grafici Doppia Vista */}
            {activePozzetto && calcoliActive && (
              <PozzettoGraficaDettaglio 
                pozzetto={activePozzetto} 
                compliance={calcoliActive} 
                cablesCatalog={cablesCatalog} 
                selectedWallSide={configWallSide}
              />
            )}

          </div>

          {/* Colonna Destra: Visualizzazione grafica e compliance */}
          <div className="space-y-6">
            
            {/* Box Risultati Calcoli */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-800">
                  Esito Verifica Pozzetto
                </h3>
                <button
                  onClick={handleExportExcel}
                  className="p-1 text-slate-400 hover:text-amber-500 flex items-center justify-center cursor-pointer"
                  title="Esporta foglio Excel della verifica"
                >
                  <FileSpreadsheet className="w-5 h-5" />
                </button>
              </div>

              {calcoliActive && (
                <>
                  <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                    calcoliActive.esito === 'verificato' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
                    calcoliActive.esito === 'attenzione' ? 'bg-amber-50 border-amber-200 text-amber-900' :
                    'bg-rose-50 border-rose-200 text-rose-900'
                  }`}>
                    {calcoliActive.esito === 'verificato' ? (
                      <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
                    ) : calcoliActive.esito === 'attenzione' ? (
                      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold text-sm">
                        {calcoliActive.esito === 'verificato' ? 'VERIFICATO' : calcoliActive.esito === 'attenzione' ? 'ATTENZIONE' : 'NON VERIFICATO'}
                      </p>
                      <p className="text-[11px] mt-1 opacity-95 leading-relaxed font-semibold">
                        {calcoliActive.dettagliVerifica}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs font-semibold text-slate-700">
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-400 font-medium">Volume Interno Pozzetto:</span>
                      <span>{formatNumber(calcoliActive.volumePozzetto / 1000, 1)} L ({formatNumber(calcoliActive.volumePozzetto, 0)} cm³)</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-400 font-medium">Sezione Totale Cavi:</span>
                      <span>{formatNumber(calcoliActive.a_tot, 2)} cm²</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-400 font-medium">Lunghezza di Passaggio:</span>
                      <span>{formatNumber(calcoliActive.l_passaggio, 1)} cm</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-400 font-medium">Volume Cavi (Senza Scorta):</span>
                      <span>{formatNumber(calcoliActive.volumeCaviSenzaScorta / 1000, 2)} L</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-400 font-medium">Maggiorazione Scorta ({activePozzetto.scortaPct}%):</span>
                      <span>+{formatNumber(calcoliActive.maggiorazioneScorta / 1000, 2)} L</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100 text-slate-900 font-bold">
                      <span>Volume Cavi (Con Scorta):</span>
                      <span>{formatNumber(calcoliActive.volumeCaviConScorta / 1000, 2)} L</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100 text-sm font-black">
                      <span className="text-slate-800">Riempimento Pozzetto:</span>
                      <span className={calcoliActive.riempimentoPct > 25 ? 'text-rose-600' : calcoliActive.riempimentoPct > 15 ? 'text-amber-600' : 'text-emerald-600'}>
                        {formatNumber(calcoliActive.riempimentoPct, 1)}%
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-400 font-medium">Diametro Cavo Massimo:</span>
                      <span>{formatNumber(calcoliActive.dMax, 1)} mm</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-400 font-medium">Raggio Curvatura Massimo:</span>
                      <span>{formatNumber(calcoliActive.maxRMin, 0)} mm ({formatNumber(calcoliActive.maxRMinCm, 1)} cm)</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100 text-slate-900 font-bold">
                      <span>Ingombro Piegatura Richiesto:</span>
                      <span>{formatNumber(calcoliActive.spaceRequired, 1)} cm</span>
                    </div>
                    <div className="flex justify-between py-1.5 text-slate-900 font-bold">
                      <span>Dimensione Utile Pozzetto:</span>
                      <span>{formatNumber(calcoliActive.dimMin, 1)} cm</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 rounded-xl p-3 leading-relaxed font-medium mt-3">
                    <strong>Criteri di Dimensionamento:</strong>
                    <br />• **Riempimento Volumetrico:** max 15% (ottimale per manovre e giunzioni), max 25% ammesso.
                    <br />• **Piegatura Cavi:** La dimensione utile del pozzetto deve essere sufficiente a garantire il raggio di curvatura del cavo più rigido.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Report di Stampa Clean & Premium */}
      <div className="hidden print:block space-y-6 mt-6">
        <div className="w-full">
          <h3 className="text-base font-black text-slate-800 border-b-2 border-slate-800 pb-1 uppercase tracking-wider">
            Report di Dimensionamento e Verifica Pozzetti Elettrici
          </h3>

          <table className="w-full text-left border-collapse text-xs mt-6 border border-slate-200 rounded-xl overflow-hidden">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100 font-black text-slate-700 text-[10px] uppercase tracking-wider">
                <th className="py-2.5 px-3">Pozzetto & Geometria</th>
                <th className="py-2.5 px-3 text-right">Volumetria & Scorta</th>
                <th className="py-2.5 px-4 text-center">Ingombro Singole Pareti</th>
                <th className="py-2.5 px-3 text-center">Piegatura & Curvatura</th>
                <th className="py-2.5 px-3 text-center">Esito Finale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {state.pozzetti.map(pozz => {
                const calc = calcolaCompliancePozzetto(pozz, cablesCatalog, availableContainers);
                if (!calc) return null;

                const activePareti = ensurePozzettoPareti(pozz);
                let conduitsCount = 0;
                let totalCablesQty = 0;

                activePareti.forEach(w => {
                  w.cavidotti.forEach(cond => {
                    conduitsCount += cond.qty;
                    totalCablesQty += cond.cables.reduce((a, b) => a + b.qty, 0);
                  });
                });

                return (
                  <tr key={pozz.tag} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 align-top">
                      <div className="font-extrabold text-slate-800 text-sm">{pozz.name}</div>
                      <div className="text-[10px] font-semibold text-slate-600">
                        {pozz.shape === 'rettangolare' ? 'Rettangolare' : 'Cilindrico'} • {pozz.shape === 'rettangolare' ? `${pozz.baseB}x${pozz.lengthL}x${pozz.depthH} cm` : `Ø ${pozz.diameterD}x${pozz.depthH} cm`}
                      </div>
                      <div className="text-[9.5px] text-slate-400 mt-1">
                        {conduitsCount} Condotti | {totalCablesQty} Cavi Posati
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right align-top font-mono">
                      <div className="text-[11px] font-bold text-slate-800">{formatNumber(calc.volumePozzetto / 1000, 1)} L</div>
                      <div className="text-[10px] text-slate-600">Cavi: {formatNumber(calc.volumeCaviConScorta / 1000, 2)} L</div>
                      <div className="text-[9.5px] font-extrabold text-indigo-700 mt-1">
                        Riempimento: {formatNumber(calc.fillRateCavi, 1)}%
                      </div>
                    </td>

                    <td className="py-3 px-4 align-top">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-200/70">
                        {(['sx', 'dx', 'alto', 'basso'] as const).map(side => {
                          const wComp = calc.paretiCompliance.find(w => w.side === side);
                          const rate = wComp ? wComp.linearFillRate : 0;
                          const isOverflow = wComp?.isLinearOverflow || wComp?.isCornerOverflow;
                          return (
                            <div key={side} className="flex justify-between items-center gap-2">
                              <span className="font-bold text-slate-500">PARETE {side.toUpperCase()}:</span>
                              <span className={`font-mono font-extrabold ${isOverflow ? 'text-rose-600' : rate > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                                {formatNumber(rate, 1)}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center align-top">
                      <div className="text-[10px] space-y-0.5">
                        <div className="text-slate-600 font-medium">Ø Max Cavo: <strong className="text-slate-800">{formatNumber(calc.dMax, 1)} mm</strong></div>
                        <div className="text-slate-600 font-medium">R_min: <strong className="text-slate-800">{formatNumber(calc.maxRMinCm, 1)} cm</strong></div>
                        <div className={`text-[9px] font-extrabold mt-1 ${calc.spaceRequired > calc.dimMin ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {calc.spaceRequired > calc.dimMin ? '⚠️ Piegatura Insufficiente' : '✓ Piegatura Conforme'}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center align-middle whitespace-nowrap">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`inline-block text-[10px] font-black px-3 py-1.5 rounded-lg border ${
                          calc.esito === 'verificato' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                          calc.esito === 'attenzione' ? 'bg-amber-50 text-amber-800 border-amber-300' :
                          'bg-rose-50 text-rose-800 border-rose-300'
                        }`}>
                          {calc.esito === 'verificato' ? '✓ VERIFICATO' : calc.esito === 'attenzione' ? '⚠️ ATTENZIONE' : '✕ NON VERIFICATO'}
                        </span>
                        <span className="text-[8.5px] font-bold text-slate-500">
                          Max Parete: {formatNumber(calc.worstLinearWall.linearFillRate, 1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Registro Specifiche e Raggi di Curvatura Cavidotti (Dati Reali di Progetto) */}
          {(() => {
            const map = new Map<string, {
              label: string;
              sectionType: string;
              outerDiameter: number;
              width?: number;
              height?: number;
              bendingFactor: number;
              rMinCm: number;
              pozzetti: Set<string>;
              totalQty: number;
            }>();

            state.pozzetti.forEach(p => {
              const activePareti = ensurePozzettoPareti(p);
              activePareti.forEach(w => {
                w.cavidotti.forEach(cond => {
                  const isRect = cond.sectionType === 'rettangolare';
                  const label = getConduitLabel(cond);
                  const outerD = cond.outerDiameter || cond.dn || 90;
                  const key = isRect ? `rect_${cond.width}x${cond.height}` : `circ_${outerD}_${label}`;
                  const bFact = cond.bendingFactor || 8;
                  const rMinCm = !isRect ? Math.round((bFact * outerD) / 10) : 0;

                  if (!map.has(key)) {
                    map.set(key, {
                      label,
                      sectionType: cond.sectionType || 'circolare',
                      outerDiameter: outerD,
                      width: cond.width,
                      height: cond.height,
                      bendingFactor: bFact,
                      rMinCm,
                      pozzetti: new Set([p.name]),
                      totalQty: cond.qty
                    });
                  } else {
                    const existing = map.get(key)!;
                    existing.pozzetti.add(p.name);
                    existing.totalQty += cond.qty;
                  }
                });
              });
            });

            const projectConduitsList = Array.from(map.values());

            return (
              <div className="mt-6 space-y-2">
                <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wide block border-b-2 border-slate-800 pb-1">
                  📌 Prescrizioni Esecutive & Raggi di Curvatura Cavidotti
                </span>

                {projectConduitsList.length === 0 ? (
                  <div className="text-[10px] text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                    Nessun condotto o corrugato inserito nel progetto.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-[10px] border border-slate-200 rounded-xl overflow-hidden mt-2">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 font-black text-slate-700 uppercase tracking-wider text-[9px]">
                        <th className="py-2 px-3">Tipologia Cavidotto / Corrugato</th>
                        <th className="py-2 px-3 text-center">Dimensioni Esterne</th>
                        <th className="py-2 px-3 text-center">Fattore Piegatura</th>
                        <th className="py-2 px-3 text-center">Raggio Minimo Tubo Terreno</th>
                        <th className="py-2 px-3 text-center">Q.tà Totale</th>
                        <th className="py-2 px-3">Pozzetti Interessati</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {projectConduitsList.map((item, idx) => {
                        const isRect = item.sectionType === 'rettangolare';
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-bold text-slate-800">{item.label}</td>
                            <td className="py-2 px-3 text-center font-mono font-semibold text-slate-700">
                              {isRect ? `${item.width || 100}x${item.height || 75} mm` : `DN ${item.outerDiameter}`}
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-indigo-700">
                              {isRect ? 'N/A' : `${item.bendingFactor}xDN`}
                            </td>
                            <td className="py-2 px-3 text-center align-middle">
                              {isRect ? (
                                <span className="text-slate-400 italic text-[9px]">Posa lineare</span>
                              ) : (
                                <div className="inline-flex flex-col items-center bg-blue-50 border border-blue-200 text-blue-800 font-extrabold px-2.5 py-1 rounded font-mono text-[10px] leading-tight">
                                  <span className="text-[9px] font-bold text-blue-600">Raggio Tubo:</span>
                                  <span>{item.rMinCm} cm ({item.bendingFactor}xDN)</span>
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-slate-800">{item.totalQty}</td>
                            <td className="py-2 px-3 text-slate-600 font-semibold">{Array.from(item.pozzetti).join(', ')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                <p className="text-[9.5px] text-slate-500 italic mt-2 leading-relaxed">
                  * Note per la posa in opera: I corrugati e cavidotti posati nello scavo esterno devono rispettare tassativamente il valore di <strong>Raggio Tubo</strong> sopra calcolato in funzione del diametro esterno e della specifica costruttore (8xDN). Garantire che le curve di approccio ai pozzetti siano prive di strozzature o schiacciamenti.
                </p>
              </div>
            );
          })()}
        </div>

        {/* Schede Dettagliate e Grafici Sezioni Pozzetti */}
        <div className="print:break-before-page w-full space-y-10">
          <h4 className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-2 uppercase tracking-wider">
            Schede Dettagliate Posa e Grafici Sezioni Pareti per Ciascun Pozzetto
          </h4>

          {state.pozzetti.map(p => {
            const comp = calcolaCompliancePozzetto(p, cablesCatalog, availableContainers);
            if (!comp) return null;
            const activePareti = ensurePozzettoPareti(p);

            return (
              <div key={p.tag} className="border border-slate-200 rounded-2xl p-5 bg-white space-y-6 print:break-inside-avoid shadow-xs">
                {/* Header Pozzetto */}
                <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-2">
                  <div>
                    <h5 className="text-sm font-black text-slate-800">{p.name}</h5>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      Tipologia: {p.shape === 'rettangolare' ? `Rettangolare ${p.baseB}x${p.lengthL}x${p.depthH} cm` : `Cilindrico Ø${p.diameterD}x${p.depthH} cm`} • Volume: {formatNumber(comp.volumePozzetto / 1000, 1)} L
                    </span>
                  </div>
                  <span className={`text-[10px] font-black px-3 py-1 rounded-lg border ${
                    comp.esito === 'verificato' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                    comp.esito === 'attenzione' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                    'bg-rose-50 text-rose-800 border-rose-200'
                  }`}>
                    ESITO: {comp.esito.toUpperCase()} (Volumetr. Cavi: {formatNumber(comp.fillRateCavi, 1)}% | Ingombro Max Parete: {formatNumber(comp.worstLinearWall.linearFillRate, 1)}%)
                  </span>
                </div>

                {/* Tabella Elenco Esteso Condotti e Cavi */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide block">
                    1. Registro Canalizzazioni e Cavi Innestati
                  </span>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-[9px] font-black text-slate-600 uppercase">
                          <th className="py-2 px-2.5">Parete</th>
                          <th className="py-2 px-2.5">Condotto / Canala</th>
                          <th className="py-2 px-2 text-center">Q.tà</th>
                          <th className="py-2 px-2 text-center">Raggio Curvatura Tubo</th>
                          <th className="py-2 px-2.5">Sigla & Cavo Formazione</th>
                          <th className="py-2 px-2 text-center">Q.tà Cavi</th>
                          <th className="py-2 px-2 text-center">Ø Cavo</th>
                          <th className="py-2 px-2 text-center">Raggio Curvatura Cavo</th>
                          <th className="py-2 px-2.5">Uscita Destinazione</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activePareti.map(w => {
                          if (w.cavidotti.length === 0) return null;
                          return w.cavidotti.map((cond, cIdx) => {
                            const isRect = cond.sectionType === 'rettangolare';
                            const rMinTubo = !isRect ? formatNumber(((cond.bendingFactor || 8) * (cond.outerDiameter || cond.dn || 90)) / 10, 0) + ' cm' : 'N/A';

                            if (cond.cables.length === 0) {
                              return (
                                <tr key={`${w.side}_${cond.id}_empty`} className="hover:bg-slate-50">
                                  <td className="py-2 px-2.5 font-bold text-indigo-700 uppercase">{w.label}</td>
                                  <td className="py-2 px-2.5 font-semibold text-slate-800">{getConduitLabel(cond)}</td>
                                  <td className="py-2 px-2 text-center font-bold">{cond.qty}</td>
                                  <td className="py-2 px-2 text-center font-mono text-slate-600">{rMinTubo}</td>
                                  <td colSpan={4} className="py-2 px-2.5 text-slate-400 italic">Nessun cavo posato</td>
                                  <td className="py-2 px-2.5 font-semibold text-slate-700">
                                    {cond.destinationSide ? cond.destinationSide.toUpperCase() : 'Termina nel Pozzetto'}
                                  </td>
                                </tr>
                              );
                            }

                            return cond.cables.map((cavo, cableIdx) => {
                              const prod = cablesCatalog.find(p => p.id === cavo.cableId);
                              const cableName = cavo.cableId === 'personalizzato' ? 'Cavo Personalizzato' : (prod?.name || cavo.cableId);
                              let bFact = 12;
                              if (cavo.cableId === 'personalizzato') bFact = cavo.customBendingFactor || 12;
                              else bFact = prod?.raggioCurvaturaMinFattore || 12;

                              const destSide = cavo.destinationSide || cond.destinationSide;

                              return (
                                <tr key={`${w.side}_${cond.id}_${cableIdx}`} className="hover:bg-slate-50">
                                  {cableIdx === 0 && (
                                    <>
                                      <td rowSpan={cond.cables.length} className="py-2 px-2.5 font-bold text-indigo-700 uppercase align-top border-r border-slate-100">
                                        {w.label}
                                      </td>
                                      <td rowSpan={cond.cables.length} className="py-2 px-2.5 font-semibold text-slate-800 align-top border-r border-slate-100">
                                        #{cIdx + 1} {getConduitLabel(cond)}
                                      </td>
                                      <td rowSpan={cond.cables.length} className="py-2 px-2 text-center font-bold align-top border-r border-slate-100">
                                        {cond.qty}
                                      </td>
                                      <td rowSpan={cond.cables.length} className="py-2 px-2 text-center font-mono text-slate-600 align-top border-r border-slate-100">
                                        {rMinTubo}
                                      </td>
                                    </>
                                  )}
                                  <td className="py-2 px-2.5 font-semibold text-slate-800">
                                    <span className="text-indigo-600 font-bold mr-1">[{cavo.sigla}]</span> {cableName} ({cavo.formation})
                                  </td>
                                  <td className="py-2 px-2 text-center font-bold">{cavo.qty}</td>
                                  <td className="py-2 px-2 text-center font-mono">{formatNumber(cavo.diameter, 1)} mm</td>
                                  <td className="py-2 px-2 text-center font-mono font-semibold text-slate-700">{formatNumber(bFact * cavo.diameter, 0)} mm</td>
                                  <td className="py-2 px-2.5 font-semibold text-indigo-700">
                                    {destSide ? `Lato ${destSide.toUpperCase()}` : 'Termina nel Pozzetto'}
                                  </td>
                                </tr>
                              );
                            });
                          });
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Grafici Sezioni Pareti per TUTTI i Lati Attivi (Inizia pulito a pagina nuova) */}
                <div className="space-y-4 print:break-before-page mt-6">
                  <h5 className="text-xs font-black text-slate-800 border-b-2 border-slate-800 pb-1.5 uppercase tracking-wider">
                    2. Grafici 2D Sezioni Pareti e Vista in Pianta (Lati Non Vuoti)
                  </h5>
                  
                  <div className="space-y-6">
                    {(['sx', 'dx', 'alto', 'basso'] as const).map(side => {
                      const wallObj = activePareti.find(w => w.side === side);
                      const hasConduits = wallObj && wallObj.cavidotti.length > 0;
                      const hasEgress = activePareti.some(otherW => otherW.cavidotti.some(c => c.destinationSide === side || c.cables.some(cb => cb.destinationSide === side)));
                      
                      if (!hasConduits && !hasEgress) return null;

                      const wallComp = comp.paretiCompliance.find(wc => wc.side === side);

                      return (
                        <div key={side} className="border border-slate-200 rounded-xl p-4 bg-white space-y-3 print:break-inside-avoid print:border-slate-300 print:shadow-none print:rounded-lg">
                          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                            <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                              Parete {side.toUpperCase()} — Sezione e Pianta
                            </span>
                            <span className="text-[9px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                              Ingombro Parete {side.toUpperCase()}: {formatNumber(wallComp?.linearFillRate || 0, 1)}% Larghezza
                            </span>
                          </div>
                          <div className="w-full flex justify-center">
                            <PozzettoGraficaDettaglio
                              pozzetto={p}
                              compliance={comp}
                              cablesCatalog={cablesCatalog}
                              selectedWallSide={side}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Attestato di conformità in stampa */}
        <div className="pt-4 border-t-2 border-slate-300 print:break-inside-avoid mt-8 bg-white">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1 flex-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Attestato di Conformità Pozzetti</span>
              <p className="text-[10px] text-slate-650 font-medium leading-relaxed italic">
                Si attesta che la verifica volumetrica e la verifica del raggio minimo di curvatura per i pozzetti elettrici del presente report sono state eseguite nel pieno rispetto dei parametri di piegatura e degli ingombri fisici dei cavi forniti dai rispettivi produttori nelle schede tecniche di prodotto.
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2 border border-emerald-300 bg-emerald-50 px-3 py-1.5 rounded-lg text-emerald-800 font-bold shadow-xs">
              <span className="text-xs">🛡️</span>
              <span className="text-[10px] font-black uppercase tracking-wider">CONFORME A SCHEDE TECNICHE COSTRUTTORE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
