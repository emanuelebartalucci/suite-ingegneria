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

export function calcolaCompliancePozzetto(p: PozzettoProgetto, cablesCatalog: CableProduct[]) {
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
    const egressCavidotti: typeof ingressCavidotti = [];
    pareti.forEach(otherW => {
      otherW.cavidotti.forEach(otherCond => {
        if (otherW.side !== w.side && (otherCond.destinationSide === w.side || otherCond.cables.some(c => c.destinationSide === w.side))) {
          egressCavidotti.push(otherCond);
        }
      });
    });

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
          wallMaxRMinName = `${descCavo} [${c.sigla || '?'}] (R_min = ${cFactor}xØ = ${formatNumber(rMinC, 0)} mm)`;
        }
      });
    });

    totalConduitsOuterAreaGlobal += conduitsOuterArea;

    const fillRate = wallArea > 0 ? (conduitsOuterArea / wallArea) * 100 : 0;
    const linearFillRate = wallW > 0 ? (totalConduitsWidthCm / wallW) * 100 : 0;
    const linearFillRateNet = wallWUtile > 0 ? (totalConduitsWidthCm / wallWUtile) * 100 : 0;
    const isLinearOverflow = linearFillRate > 100;
    const isCornerOverflow = totalConduitsWidthCm > wallWUtile;
    
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
      conduitsOuterArea,
      totalConduitsWidthCm,
      fillRate,
      linearFillRate,
      linearFillRateNet,
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
  const worstLinearWall = paretiCompliance.reduce((prev, curr) => curr.linearFillRate > prev.linearFillRate ? curr : prev, paretiCompliance[0]);
  const worstCornerWall = paretiCompliance.reduce((prev, curr) => curr.linearFillRateNet > prev.linearFillRateNet ? curr : prev, paretiCompliance[0]);

  // 8. Esito finale
  let esito: 'verificato' | 'attenzione' | 'rosso' = 'verificato';
  let dettagliVerifica = '';

  if (fillRateCavi > 25 || !bendingRadiusOk || worstWall.fillRate > 40 || worstLinearWall.linearFillRate > 100) {
    esito = 'rosso';
    if (worstLinearWall.linearFillRate > 100) {
      dettagliVerifica = `NON VERIFICATO: Sovraccarico di ingombro sulla parete ${worstLinearWall.label} (${formatNumber(worstLinearWall.linearFillRate, 1)}% > 100%). I condotti occupano ${formatNumber(worstLinearWall.totalConduitsWidthCm, 1)} cm su una larghezza parete di ${formatNumber(worstLinearWall.wallW, 1)} cm e non possono stare su un solo livello.`;
    } else if (worstWall.fillRate > 40) {
      dettagliVerifica = `NON VERIFICATO: Sovraccarico di area sulla parete ${worstWall.label} (${formatNumber(worstWall.fillRate, 1)}% > 40% max consentito per posa corrugati).`;
    } else if (fillRateCavi > 25 && !bendingRadiusOk) {
      dettagliVerifica = `NON VERIFICATO: Riempimento volumetrico cavi critico (${formatNumber(fillRateCavi, 1)}% > 25%) e spazio di curvatura insufficiente. Elemento limitante: ${maxRMinCableName}. Richiesto: ${formatNumber(spaceRequired, 1)} cm, Interno netto pozzetto: ${formatNumber(dimMin, 1)} cm.`;
    } else if (fillRateCavi > 25) {
      dettagliVerifica = `NON VERIFICATO: Tasso di riempimento volumetrico globale cavi critico (${formatNumber(fillRateCavi, 1)}% > 25% max).`;
    } else {
      dettagliVerifica = `NON VERIFICATO: Spazio di curvatura insufficiente per la piegatura a 90°. Elemento limitante: ${maxRMinCableName}. Spazio minimo richiesto: ${formatNumber(spaceRequired, 1)} cm, Interno utile pozzetto: ${formatNumber(dimMin, 1)} cm.`;
    }
  } else if (fillRateCavi > 15 || bendingRadiusClose || worstWall.fillRate > 25 || worstLinearWall.linearFillRate > 85 || worstCornerWall.isCornerOverflow) {
    esito = 'attenzione';
    if (worstCornerWall.isCornerOverflow) {
      dettagliVerifica = `ATTENZIONE: I condotti sulla parete ${worstCornerWall.label} (${formatNumber(worstCornerWall.totalConduitsWidthCm, 1)} cm) invadono il margine di rispetto d'angolo (5 cm per lato, larghezza utile ${formatNumber(worstCornerWall.wallWUtile, 1)} cm su ${formatNumber(worstCornerWall.wallW, 1)} cm). Rischio interferenza con le pareti adiacenti.`;
    } else if (worstLinearWall.linearFillRate > 85) {
      dettagliVerifica = `ATTENZIONE: Ingombro lineare elevato sulla parete ${worstLinearWall.label} (${formatNumber(worstLinearWall.linearFillRate, 1)}% della larghezza parete di ${formatNumber(worstLinearWall.wallW, 1)} cm).`;
    } else if (worstWall.fillRate > 25) {
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
    dettagliVerifica = `VERIFICATO: Riempimento volumetrico cavi ottimale (${formatNumber(fillRateCavi, 1)}% <= 15%, condotti: ${formatNumber(fillRateTubi, 1)}%), riempimento pareti conforme ed elemento limitante verificato per la posa (${maxRMinCableName} con ${formatNumber(dimMin, 1)} cm >= richiesto ${formatNumber(spaceRequired, 1)} cm).`;
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
  selectedWallSide?: 'sx' | 'dx' | 'alto' | 'basso';
}> = ({ pozzetto, compliance, cablesCatalog, selectedWallSide }) => {
  const [activeWallSide, setActiveWallSide] = useState<'sx' | 'dx' | 'alto' | 'basso'>(selectedWallSide || 'sx');

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

    const pad = 36;
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

    // Linee di quota esterne ed interne
    if (isRect) {
      drawDimensionLine(ctx, xStartExt, yStartExt, xStartExt + wExtScaled, yStartExt, `${B} cm (Est)`, -20, false);
      drawDimensionLine(ctx, xStartExt, yStartExt, xStartExt, yStartExt + hExtScaled, `${L} cm (Est)`, -20, true);
    } else {
      drawDimensionLine(ctx, cx - wExtScaled/2, cy, cx + wExtScaled/2, cy, `Ø Ext: ${D} cm`, -wExtScaled/2 - 12, false);
    }

    // Disegna Cavidotti in pianta ed i tracciati delle curve
    const pareti = ensurePozzettoPareti(pozzetto);
    const sideCoords: Record<string, { x: number; y: number; dx: number; dy: number }> = {
      sx: { x: xStartInt, y: cy, dx: -22, dy: 0 },
      dx: { x: xStartInt + wIntScaled, y: cy, dx: 22, dy: 0 },
      alto: { x: cx, y: yStartInt, dx: 0, dy: -22 },
      basso: { x: cx, y: yStartInt + hIntScaled, dx: 0, dy: 22 }
    };

    pareti.forEach(w => {
      if (w.cavidotti.length === 0) return;
      const coords = sideCoords[w.side];
      
      // Calcola ingombro totale puro dei condotti/canali (in pixel)
      let pureTotalWidthScaled = 0;
      let totalConduitsQty = 0;
      w.cavidotti.forEach(c => {
        const isRect = c.sectionType === 'rettangolare';
        const wCm = isRect ? (c.width || 100) / 10 : (c.outerDiameter || 90) / 10;
        pureTotalWidthScaled += (wCm * scale) * c.qty;
        totalConduitsQty += c.qty;
      });

      const wallSpanScaled = (w.side === 'sx' || w.side === 'dx') ? hIntScaled : wIntScaled;
      const fitsOnWall = pureTotalWidthScaled <= wallSpanScaled + 1.0;
      let itemGap = 0;

      if (fitsOnWall) {
        const remainingSpace = Math.max(0, wallSpanScaled - pureTotalWidthScaled);
        itemGap = totalConduitsQty > 1 ? Math.min(1.5, remainingSpace / (totalConduitsQty - 1)) : 0;
      } else {
        itemGap = 2;
      }

      const totalUsedSpanScaled = pureTotalWidthScaled + itemGap * Math.max(0, totalConduitsQty - 1);
      let currentOffset = -totalUsedSpanScaled / 2;

      w.cavidotti.forEach(cond => {
        const isRect = cond.sectionType === 'rettangolare';
        const wCm = isRect ? (cond.width || 100) / 10 : (cond.outerDiameter || 90) / 10;
        const dExtScaled = wCm * scale;
        
        for (let q = 0; q < cond.qty; q++) {
          ctx.save();
          ctx.fillStyle = isRect ? (cond.familyId === 'canala_pvc' ? '#cbd5e1' : '#64748b') : 'rgba(59, 130, 246, 0.85)';
          ctx.strokeStyle = isRect ? '#334155' : '#2563eb';
          ctx.lineWidth = 1.2;

          let rx = coords.x;
          let ry = coords.y;
          let rw = 0;
          let rh = 0;

          if (w.side === 'sx' || w.side === 'dx') {
            ry = coords.y + currentOffset;
            rw = coords.dx;
            rh = dExtScaled;
            ctx.fillRect(rx, ry, rw, rh);
            ctx.strokeRect(rx, ry, rw, rh);
            if (isRect) {
              // Interno vuoto canala rettangolare vista dall'alto
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(rx + (rw < 0 ? rw + 2 : 2), ry + 2, Math.abs(rw) - 4, Math.max(1, rh - 4));
            } else {
              // Righe corrugate per cavidotto circolare
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
              ctx.lineWidth = 0.5;
              for (let ox = 0; ox < Math.abs(rw); ox += 3) {
                ctx.beginPath();
                ctx.moveTo(rx + (rw < 0 ? -ox : ox), ry);
                ctx.lineTo(rx + (rw < 0 ? -ox : ox), ry + rh);
                ctx.stroke();
              }
            }
          } else {
            rx = coords.x + currentOffset;
            rw = dExtScaled;
            rh = coords.dy;
            ctx.fillRect(rx, ry, rw, rh);
            ctx.strokeRect(rx, ry, rw, rh);
            if (isRect) {
              // Interno vuoto canala rettangolare vista dall'alto
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(rx + 2, ry + (rh < 0 ? rh + 2 : 2), Math.max(1, rw - 4), Math.abs(rh) - 4);
            } else {
              // Righe corrugate per cavidotto circolare
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
              ctx.lineWidth = 0.5;
              for (let oy = 0; oy < Math.abs(rh); oy += 3) {
                ctx.beginPath();
                ctx.moveTo(rx, ry + (rh < 0 ? -oy : oy));
                ctx.lineTo(rx + rw, ry + (rh < 0 ? -oy : oy));
                ctx.stroke();
              }
            }
          }
          ctx.restore();

          // Traccia le curve per ciascun cavo in base al proprio lato di uscita
          cond.cables.forEach((c, cIdx) => {
            const destSide = c.destinationSide || cond.destinationSide;
            if (destSide && destSide !== w.side) {
              const destCoords = sideCoords[destSide];
              
              const startX = w.side === 'sx' || w.side === 'dx' ? coords.x : coords.x + currentOffset + dExtScaled/2;
              const startY = w.side === 'sx' || w.side === 'dx' ? coords.y + currentOffset + dExtScaled/2 : coords.y;
              
              let endX = destCoords.x;
              let endY = destCoords.y;

              let erx = destCoords.x;
              let ery = destCoords.y;
              let erw = 0;
              let erh = 0;

              if (destSide === 'sx' || destSide === 'dx') {
                ery = destCoords.y + currentOffset;
                erw = destCoords.dx;
                erh = dExtScaled;
                endX = destCoords.x;
                endY = ery + dExtScaled / 2;
              } else {
                erx = destCoords.x + currentOffset;
                erw = dExtScaled;
                erh = destCoords.dy;
                endX = erx + dExtScaled / 2;
                endY = destCoords.y;
              }

              // Disegna il tubo/canale di uscita sulla parete di destinazione
              ctx.save();
              ctx.fillStyle = isRect ? '#64748b' : 'rgba(59, 130, 246, 0.85)';
              ctx.strokeStyle = isRect ? '#334155' : '#2563eb';
              ctx.lineWidth = 0.8;
              ctx.fillRect(erx, ery, erw, erh);
              ctx.strokeRect(erx, ery, erw, erh);
              ctx.restore();

              // Curve Bezier per ciascun cavo
              ctx.save();
              ctx.strokeStyle = getCableColor(c.cableId);
              ctx.lineWidth = Math.max(1.2, (c.diameter/10) * scale * 0.45);
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

          currentOffset += dExtScaled + itemGap;
        }
      });
    });

    // Etichette orientamento pareti collocate senza sovrapposizione nel bordo del pozzetto
    ctx.save();
    ctx.font = 'bold 8px sans-serif';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const wallThickX = (xStartInt - xStartExt);
    const wallThickY = (yStartInt - yStartExt);

    // PARETE ALTO e BASSO centrate negli spessori orizzontali
    ctx.fillText('PARETE ALTO', cx, yStartExt + wallThickY / 2);
    ctx.fillText('PARETE BASSO', cx, yStartInt + hIntScaled + wallThickY / 2);

    // PARETE SX e DX inserite nel bordo superiore esterno dove non ci sono tubi
    ctx.fillText('PARETE SX', Math.max(28, xStartExt + wallThickX / 2), yStartExt + 10);
    ctx.fillText('PARETE DX', Math.min(332, xStartInt + wIntScaled + wallThickX / 2), yStartExt + 10);

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
    const egressCavidotti: typeof ingressCavidotti = [];
    pareti.forEach(w => {
      w.cavidotti.forEach(cond => {
        if (w.side !== activeWallSide && (cond.destinationSide === activeWallSide || cond.cables.some(c => c.destinationSide === activeWallSide))) {
          egressCavidotti.push(cond);
        }
      });
    });

    const allCavidotti = [...ingressCavidotti, ...egressCavidotti];

    if (allCavidotti.length > 0) {
      // 1. Calcoliamo l'ingombro orizzontale totale puro dei condotti (in pixel)
      let pureConduitsWidthScaled = 0;
      let totalConduitItems = 0;

      allCavidotti.forEach(cond => {
        const isRect = cond.sectionType === 'rettangolare';
        const condW = isRect ? (cond.width || cond.outerDiameter || 100) / 10 : (cond.outerDiameter || 90) / 10;
        pureConduitsWidthScaled += (condW * scale) * cond.qty;
        totalConduitItems += cond.qty;
      });

      // Fino al 100% dell'ingombro lineare, i condotti DEVONO stare tutti sulla prima fila in basso
      const fitsOnSingleRow = pureConduitsWidthScaled <= wScaled + 1.0;
      let itemGap = 0;
      let curX = xStart;

      if (fitsOnSingleRow) {
        const remainingSpace = Math.max(0, wScaled - pureConduitsWidthScaled);
        itemGap = totalConduitItems > 1 ? Math.min(2, remainingSpace / (totalConduitItems - 1)) : 0;
        const totalUsedRowWidth = pureConduitsWidthScaled + itemGap * Math.max(0, totalConduitItems - 1);
        curX = xStart + (wScaled - totalUsedRowWidth) / 2;
      } else {
        itemGap = 2;
        curX = xStart;
      }


      let curY = yStart + hScaled;
      let rowHeight = 0;

      allCavidotti.forEach(cond => {
        const isRect = cond.sectionType === 'rettangolare';

        for (let q = 0; q < cond.qty; q++) {
          if (isRect) {
            const wCm = (cond.width || cond.outerDiameter || 100) / 10;
            const hCm = (cond.height || cond.innerDiameter || 75) / 10;
            const rectWScaled = wCm * scale;
            const rectHScaled = hCm * scale;


            if (!fitsOnSingleRow && curX + rectWScaled > xStart + wScaled + 0.5) {
              curX = xStart;
              curY -= rowHeight + 4;
              rowHeight = 0;
            }

            const rx = curX;
            const ry = curY - rectHScaled;

            // Disegna Canale Rettangolare (sezione con profilo metallico/PVC distinto)
            ctx.save();
            ctx.fillStyle = cond.familyId === 'canala_pvc' ? '#94a3b8' : '#64748b'; // Grigio metallo / PVC
            ctx.fillRect(rx, ry, rectWScaled, rectHScaled);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1.2;
            ctx.strokeRect(rx, ry, rectWScaled, rectHScaled);

            // Interno vuoto canale
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(rx + 2, ry + 2, Math.max(1, rectWScaled - 4), Math.max(1, rectHScaled - 4));
            
            // Etichetta misura canale
            ctx.font = 'bold 8px sans-serif';
            ctx.fillStyle = '#334155';
            ctx.textAlign = 'center';
            ctx.fillText(`${cond.width || 100}x${cond.height || 75}`, rx + rectWScaled/2, ry - 3);
            ctx.restore();

            // Layout a Griglia per i cavi interni al canale rettangolare
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

            curX += rectWScaled + itemGap;
            rowHeight = Math.max(rowHeight, rectHScaled);
          } else {
            // Circolare (Tubo / Cavidotto)
            const rExtScaled = ((cond.outerDiameter / 10) / 2) * scale;
            const dExtScaled = rExtScaled * 2;
            const rIntScaled = ((cond.innerDiameter / 10) / 2) * scale;

            if (!fitsOnSingleRow && curX + dExtScaled > xStart + wScaled + 0.5) {
              curX = xStart;
              curY -= rowHeight + 4;
              rowHeight = 0;
            }

            const cx = curX + rExtScaled;
            const cy = curY - rExtScaled;

            // Disegna Tubo / Corrugato Circolare
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, rExtScaled, 0, 2 * Math.PI);
            ctx.fillStyle = '#3b82f6'; // Blu
            ctx.fill();
            ctx.strokeStyle = '#1d4ed8';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Interno Cavidotto
            ctx.beginPath();
            ctx.arc(cx, cy, rIntScaled, 0, 2 * Math.PI);
            ctx.fillStyle = '#ffffff'; // Bianco
            ctx.fill();
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 0.8;
            ctx.stroke();

            // Etichetta misura tubo
            ctx.font = 'bold 8px sans-serif';
            ctx.fillStyle = '#1d4ed8';
            ctx.textAlign = 'center';
            ctx.fillText(`Ø${cond.outerDiameter || cond.dn}`, cx, cy - rExtScaled - 3);
            ctx.restore();

            // Concentric Ring Spiral Packing per i cavi interni al corrugato
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
                  // Cavo al centro
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

            curX += dExtScaled + itemGap;
            rowHeight = Math.max(rowHeight, dExtScaled);

          }
        }
      });
    }

    const url = canvas.toDataURL('image/png');
    setImgUrlSezione(url);
  }, [pozzetto, activeWallSide, innerB, innerL, innerH]);

  const activeWallComp = compliance?.paretiCompliance?.find((wc: any) => wc.side === activeWallSide);

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col gap-6 relative w-full">
      {/* Selector della Parete da Ispezionare */}
      <div className="flex flex-wrap md:flex-nowrap justify-between items-center gap-4 border-b border-slate-100 pb-3">
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
              : (activeWallComp?.linearFillRate || 0) > 85
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-blue-50 border-blue-100 text-blue-700'
          }`}>
            {activeWallComp?.isLinearOverflow 
              ? '⚠️ SOVRACCARICO LINEARE' 
              : activeWallComp?.isCornerOverflow 
              ? '⚠️ INVASIONE RISPETTO ANGOLO (5cm)' 
              : 'Ingombro Parete'} {activeWallSide.toUpperCase()}: {formatNumber(activeWallComp?.linearFillRate || 0, 1)}% Larghezza
          </span>
        </div>
      </div>

      {/* Viste Affiancate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        
        {/* Vista Pianta */}
        <div className="flex flex-col justify-between items-center bg-slate-50/50 border border-slate-100 rounded-2xl p-4 w-full">
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
        <div className="flex flex-col justify-between items-center bg-slate-50/50 border border-slate-100 rounded-2xl p-4 w-full">
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

  const availableContainers = useMemo(() => {
    if (propContainersCatalog && propContainersCatalog.length > 0) return propContainersCatalog;
    return INITIAL_CONTAINERS;
  }, [propContainersCatalog]);

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
                    destinationFamilyId: destFamily
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
    return calcolaCompliancePozzetto(activePozzetto, cablesCatalog);
  }, [activePozzetto, cablesCatalog]);

  const pozzettiCompliance = useMemo(() => {
    return state.pozzetti.map(p => {
      const comp = calcolaCompliancePozzetto(p, cablesCatalog);
      return {
        tag: p.tag,
        esito: comp?.esito || 'verificato',
        fillRate: comp?.fillRate || 0
      };
    });
  }, [state.pozzetti, cablesCatalog]);

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
    updatePozzettoField(activePozzetto.tag, 'pareti', updatedPareti);
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
                              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="text-xs font-black text-slate-800 bg-white border border-slate-200 px-2 py-1 rounded-lg">
                                    #{condIdx + 1} {getConduitLabel(cond)}
                                  </span>

                                  {/* Famiglia Condotto */}
                                  <div>
                                    <select
                                      value={cond.familyId || (isRect ? 'canala_pvc' : 'cavidotto')}
                                      onChange={e => handleUpdateCavidotto(configWallSide, cond.id, 'familyId', e.target.value)}
                                      className="bg-white border border-slate-200 rounded-lg p-1 text-[11px] font-bold text-slate-700 max-w-[170px] truncate"
                                    >
                                      {availableContainers.map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                      ))}
                                      <option value="personalizzato">Personalizzato</option>
                                    </select>
                                  </div>

                                  {/* Misura / Taglia */}
                                  {curFam && curFam.sizes && (
                                    <div>
                                      <select
                                        value={cond.sizeCode || curFam.sizes.find(s => (isRect ? (s.width === cond.width && s.height === cond.height) : (s.outerDiameter === cond.outerDiameter)))?.code || curFam.sizes[0]?.code || ''}
                                        onChange={e => handleUpdateCavidotto(configWallSide, cond.id, 'sizeCode', e.target.value)}
                                        className="bg-white border border-slate-200 rounded-lg p-1 text-[11px] font-bold text-slate-700"
                                      >
                                        {curFam.sizes.map(sz => (
                                          <option key={sz.code} value={sz.code}>{sz.label}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}

                                  {/* Quantità condotti paralleli */}
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">Q.tà:</span>
                                    <input
                                      type="number"
                                      min="1"
                                      value={cond.qty}
                                      onChange={e => handleUpdateCavidotto(configWallSide, cond.id, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                                      className="bg-white border border-slate-200 rounded-lg p-1 text-[11px] w-12 text-center font-bold text-slate-700"
                                    />
                                  </div>

                                  {/* Info Raggio Curvatura Tubo nel Terreno (solo per tubi/sezione circolare) */}
                                  {!isRect && (
                                    <div className="flex items-center gap-1 bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg">
                                      <span className="text-[10px] text-blue-600 font-bold uppercase">R_min Tubo:</span>
                                      <span className="text-[11px] font-extrabold text-blue-700 font-mono">
                                        {formatNumber(((cond.bendingFactor || 8) * (cond.outerDiameter || cond.dn || 90)) / 10, 0)} cm
                                      </span>
                                      <span className="text-[9px] text-blue-500 font-bold">({cond.bendingFactor || 8}xDN)</span>
                                    </div>
                                  )}
                                </div>

                              <button
                                type="button"
                                onClick={() => handleDeleteCavidotto(configWallSide, cond.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
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
                                          <div className="flex items-center gap-1">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Condotto:</span>
                                            <select
                                              value={batchExitFamily}
                                              onChange={e => setBatchExitFamily(e.target.value)}
                                              className="bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 shadow-2xs"
                                            >
                                              {availableContainers.map(f => (
                                                <option key={f.id} value={f.id}>{f.name}</option>
                                              ))}
                                              <option value="personalizzato">Personalizzato</option>
                                            </select>
                                          </div>
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

                                  <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 p-2 shadow-2xs">
                                    <table className="w-full text-left text-[11px] divide-y divide-slate-100">
                                      <thead>
                                        <tr className="text-slate-400 uppercase font-black tracking-wide text-[9px]">
                                          <th className="py-2 px-1 text-center w-6">
                                            <input
                                              type="checkbox"
                                              checked={(selectedCableIndicesMap[cond.id] || []).length === cond.cables.length && cond.cables.length > 0}
                                              onChange={e => toggleSelectAllCables(cond.id, cond.cables.length, e.target.checked)}
                                              className="rounded text-indigo-600 cursor-pointer"
                                            />
                                          </th>
                                          <th className="py-2 px-1">Sigla</th>
                                          <th className="py-2 px-1">Cavo</th>
                                          <th className="py-2 px-1">Formazione</th>
                                          <th className="py-2 px-1 text-center">Q.tà</th>
                                          <th className="py-2 px-1 text-center">Ø [mm]</th>
                                          <th className="py-2 px-1 text-center">R_min</th>
                                          <th className="py-2 px-1">Uscita Cavo</th>
                                          <th className="py-2 px-1">Condotto Uscita</th>
                                          <th className="py-2 px-1 text-right">Azioni</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 text-slate-700 font-bold">
                                        {cond.cables.map((cavo, cIdx) => {
                                          const prod = cablesCatalog.find(c => c.id === cavo.cableId);
                                          let bFact = 12;
                                          if (cavo.cableId === 'personalizzato') {
                                            bFact = cavo.customBendingFactor || 12;
                                          } else {
                                            bFact = prod?.raggioCurvaturaMinFattore || 12;
                                          }

                                          const effDestSide = cavo.destinationSide || cond.destinationSide;
                                          const isSelected = (selectedCableIndicesMap[cond.id] || []).includes(cIdx);

                                          return (
                                            <tr key={cIdx} className={`hover:bg-slate-50/50 ${isSelected ? 'bg-indigo-50/60' : ''}`}>
                                              <td className="py-1.5 px-1 text-center">
                                                <input
                                                  type="checkbox"
                                                  checked={isSelected}
                                                  onChange={() => toggleSelectCable(cond.id, cIdx)}
                                                  className="rounded text-indigo-600 cursor-pointer"
                                                />
                                              </td>
                                            <td className="py-1.5 px-1">
                                              <input
                                                type="text"
                                                value={cavo.sigla || ''}
                                                onChange={e => handleUpdateCableInConduit(configWallSide, cond.id, cIdx, 'sigla', e.target.value)}
                                                className="bg-slate-50 border border-slate-200 rounded-md p-0.5 text-[10px] w-9 text-center font-bold"
                                              />
                                            </td>
                                            <td className="py-1.5 px-1">
                                              <select
                                                value={cavo.cableId}
                                                onChange={e => handleUpdateCableInConduit(configWallSide, cond.id, cIdx, 'cableId', e.target.value)}
                                                className="bg-slate-55 border border-slate-200 rounded-md p-0.5 text-[10px] max-w-[110px] truncate"
                                              >
                                                {cablesCatalog.map(c => (
                                                  <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                                <option value="personalizzato">Personalizzato</option>
                                              </select>
                                            </td>
                                            <td className="py-1.5 px-1">
                                              {cavo.cableId === 'personalizzato' ? (
                                                <input
                                                  type="text"
                                                  value={cavo.formation}
                                                  onChange={e => handleUpdateCableInConduit(configWallSide, cond.id, cIdx, 'formation', e.target.value)}
                                                  className="bg-slate-50 border border-slate-200 rounded-md p-0.5 text-[10px] w-20"
                                                />
                                              ) : (
                                                <select
                                                  value={cavo.formation}
                                                  onChange={e => handleUpdateCableInConduit(configWallSide, cond.id, cIdx, 'formation', e.target.value)}
                                                  className="bg-slate-50 border border-slate-200 rounded-md p-0.5 text-[10px]"
                                                >
                                                  {prod?.formations.map(f => (
                                                    <option key={f.formation} value={f.formation}>{f.formation}</option>
                                                  ))}
                                                </select>
                                              )}
                                            </td>
                                            <td className="py-1.5 px-1 text-center">
                                              <input
                                                type="number"
                                                min="1"
                                                value={cavo.qty}
                                                onChange={e => handleUpdateCableInConduit(configWallSide, cond.id, cIdx, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                                                className="bg-slate-50 border border-slate-200 rounded-md p-0.5 text-[10px] w-9 text-center"
                                              />
                                            </td>
                                            <td className="py-1.5 px-1 text-center">
                                              {cavo.cableId === 'personalizzato' ? (
                                                <input
                                                  type="number"
                                                  step="any"
                                                  value={cavo.diameter}
                                                  onChange={e => handleUpdateCableInConduit(configWallSide, cond.id, cIdx, 'diameter', parseFloat(e.target.value) || 0)}
                                                  className="bg-slate-55 border border-slate-200 rounded-md p-0.5 text-[10px] w-12 text-center"
                                                />
                                              ) : (
                                                <span>{formatNumber(cavo.diameter, 1)}</span>
                                              )}
                                            </td>
                                            <td className="py-1.5 px-1 text-center font-mono text-[10px] text-slate-500">
                                              {formatNumber(bFact * cavo.diameter, 0)} mm
                                            </td>
                                            <td className="py-1.5 px-1">
                                              <select
                                                value={cavo.destinationSide || ''}
                                                onChange={e => handleUpdateCableInConduit(configWallSide, cond.id, cIdx, 'destinationSide', e.target.value ? e.target.value as any : undefined)}
                                                className="bg-white border border-slate-200 rounded-md p-0.5 text-[10px] font-bold text-indigo-700 max-w-[95px]"
                                              >
                                                <option value="">Termina nel Pozzetto</option>
                                                <option value="sx" disabled={configWallSide === 'sx'}>Lato SX</option>
                                                <option value="dx" disabled={configWallSide === 'dx'}>Lato DX</option>
                                                <option value="alto" disabled={configWallSide === 'alto'}>Lato ALTO</option>
                                                <option value="basso" disabled={configWallSide === 'basso'}>Lato BASSO</option>
                                              </select>
                                            </td>
                                            <td className="py-1.5 px-1">
                                              <select
                                                value={cavo.destinationFamilyId || cond.familyId || 'cavidotto'}
                                                disabled={!cavo.destinationSide}
                                                onChange={e => handleUpdateCableInConduit(configWallSide, cond.id, cIdx, 'destinationFamilyId', e.target.value)}
                                                className="bg-white border border-slate-200 rounded-md p-0.5 text-[10px] max-w-[110px] truncate font-bold text-slate-700 disabled:opacity-40"
                                              >
                                                {availableContainers.map(f => (
                                                  <option key={f.id} value={f.id}>{f.name}</option>
                                                ))}
                                                <option value="personalizzato">Personalizzato</option>
                                              </select>
                                            </td>
                                            <td className="py-1.5 px-1 text-right">
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteCableFromConduit(configWallSide, cond.id, cIdx)}
                                                className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
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
                      <span className="text-slate-400 font-medium">Volume Pozzetto (V_p):</span>
                      <span>{formatNumber(calcoliActive.volumePozzetto / 1000, 1)} L ({formatNumber(calcoliActive.volumePozzetto, 0)} cm³)</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-400 font-medium">Sezione Cavi (A_tot):</span>
                      <span>{formatNumber(calcoliActive.a_tot, 2)} cm²</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-400 font-medium">Passaggio (L_passaggio):</span>
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
                      <span className="text-slate-400 font-medium">Ø Cavo Massimo (D_max):</span>
                      <span>{formatNumber(calcoliActive.dMax, 1)} mm</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-400 font-medium">Max Raggio Curvatura (R_min):</span>
                      <span>{formatNumber(calcoliActive.maxRMin, 0)} mm ({formatNumber(calcoliActive.maxRMinCm, 1)} cm)</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100 text-slate-900 font-bold">
                      <span>Piegatura Min. Richiesta (2 · R_min):</span>
                      <span>{formatNumber(calcoliActive.spaceRequired, 1)} cm</span>
                    </div>
                    <div className="flex justify-between py-1.5 text-slate-900 font-bold">
                      <span>Lato/Ø Pozzetto Disponibile (dim_min):</span>
                      <span>{formatNumber(calcoliActive.dimMin, 1)} cm</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 rounded-xl p-3 leading-relaxed font-medium">
                    <strong>Criteri di Dimensionamento:</strong>
                    <br />• **Riempimento Volumetrico:** max 15% (ottimale per manovre e giunzioni), max 25% ammesso.
                    <br />• **Piegatura Cavi:** La dimensione minima del pozzetto (dim_min) deve essere almeno pari a 2 · R_min per permettere la piegatura del cavo più rigido.
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

          <table className="w-full text-left border-collapse text-xs mt-6">
            <thead>
              <tr className="border-b border-slate-350 bg-slate-50 font-bold text-slate-700">
                <th className="py-2 px-3">Pozzetto</th>
                <th className="py-2 px-2">Forma & Dimensioni (cm)</th>
                <th className="py-2 px-2 text-right">Volume (L)</th>
                <th className="py-2 px-2">Cavi Posati per Parete</th>
                <th className="py-2 px-2 text-right">Volume Cavi (L)</th>
                <th className="py-2 px-3 text-center">Esito Verifica</th>
              </tr>
            </thead>
            <tbody>
              {state.pozzetti.map(pozz => {
                const calc = calcolaCompliancePozzetto(pozz, cablesCatalog);
                if (!calc) return null;

                const activePareti = ensurePozzettoPareti(pozz);
                let conduitsCount = 0;
                let totalCablesQty = 0;
                const activeSidesList: string[] = [];

                activePareti.forEach(w => {
                  if (w.cavidotti.length > 0) {
                    activeSidesList.push(`${w.side.toUpperCase()}: ${w.cavidotti.length}`);
                    w.cavidotti.forEach(cond => {
                      conduitsCount += cond.qty;
                      totalCablesQty += cond.cables.reduce((a, b) => a + b.qty, 0);
                    });
                  }
                });

                return (
                  <tr key={pozz.tag} className="border-b border-slate-200">
                    <td className="py-3 px-3 font-bold text-slate-800">{pozz.name}</td>
                    <td className="py-3 px-2">
                      <div className="font-semibold text-slate-700">
                        {pozz.shape === 'rettangolare' ? 'Rettangolare' : 'Cilindrico'}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {pozz.shape === 'rettangolare' 
                          ? `${pozz.baseB}x${pozz.lengthL}x${pozz.depthH} cm` 
                          : `Ø ${pozz.diameterD}x${pozz.depthH} cm`}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right font-mono font-semibold">
                      {formatNumber(calc.volumePozzetto / 1000, 1)} L
                    </td>
                    <td className="py-3 px-2">
                      {conduitsCount === 0 ? (
                        <span className="text-slate-400 italic text-[10px]">Nessun condotto</span>
                      ) : (
                        <div className="space-y-0.5 text-[10px]">
                          <div className="font-bold text-slate-700">{conduitsCount} Condotti ({activeSidesList.join(', ')})</div>
                          <div className="text-slate-500 font-medium">{totalCablesQty} Cavi totali posati</div>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right font-mono">
                      <div><strong>{formatNumber(calc.volumeCaviConScorta / 1000, 2)} L</strong></div>
                      <div className="text-[10px] text-slate-500">Scorta: +{pozz.scortaPct}%</div>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className={`inline-block text-[9px] font-black px-2.5 py-1 rounded-lg border ${
                        calc.esito === 'verificato' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        calc.esito === 'attenzione' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                        'bg-rose-50 text-rose-800 border-rose-200'
                      }`}>
                        <div>{calc.esito === 'verificato' ? 'VERIFICATO' : calc.esito === 'attenzione' ? 'ATTENZIONE' : 'NON VERIFICATO'}</div>
                        <div className="text-[8px] font-semibold opacity-80 mt-0.5">
                          Vol: {formatNumber(calc.fillRateCavi, 1)}% | Parete Max: {formatNumber(calc.worstLinearWall.linearFillRate, 1)}%
                        </div>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Schede Dettagliate e Grafici Sezioni Pozzetti */}
        <div className="print:break-before-page w-full space-y-10">
          <h4 className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-2 uppercase tracking-wider">
            Schede Dettagliate Posa e Grafici Sezioni Pareti per Ciascun Pozzetto
          </h4>

          {state.pozzetti.map(p => {
            const comp = calcolaCompliancePozzetto(p, cablesCatalog);
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
                          <th className="py-2 px-2 text-center">R_min Tubo Terreno</th>
                          <th className="py-2 px-2.5">Sigla & Cavo Formazione</th>
                          <th className="py-2 px-2 text-center">Q.tà Cavi</th>
                          <th className="py-2 px-2 text-center">Ø Cavo</th>
                          <th className="py-2 px-2 text-center">R_min Cavo</th>
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

                {/* Grafici Sezioni Pareti per TUTTI i Lati Attivi */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide block">
                    2. Grafici 2D Sezioni Pareti e Vista in Pianta (Lati Non Vuoti)
                  </span>
                  
                  <div className="space-y-6">
                    {(['sx', 'dx', 'alto', 'basso'] as const).map(side => {
                      const wallObj = activePareti.find(w => w.side === side);
                      const hasConduits = wallObj && wallObj.cavidotti.length > 0;
                      const hasEgress = activePareti.some(otherW => otherW.cavidotti.some(c => c.destinationSide === side || c.cables.some(cb => cb.destinationSide === side)));
                      
                      if (!hasConduits && !hasEgress) return null;

                      const wallComp = comp.paretiCompliance.find(wc => wc.side === side);

                      return (
                        <div key={side} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2 print:break-inside-avoid">
                          <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
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
