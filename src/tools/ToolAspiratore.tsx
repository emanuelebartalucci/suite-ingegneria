import React, { useState, useMemo } from 'react';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import {
  Plus, Trash2, ChevronDown, ChevronUp, Copy,
  Wind, Zap, CheckCircle, ArrowRight, ArrowLeft, ArrowUp, ArrowDown,
  Printer, GitFork, Gauge, Layers, Network, GripVertical,
  Info, HelpCircle, BookOpen, Lightbulb, Sliders, AlertTriangle
} from 'lucide-react';
import {
  FAN_ACCESSORIES,
  FAN_ROUGHNESS,
  getLeqForDiameter,
  getTagliaIEC,
  TAGLIE_MOTORI_IEC,
} from '../data/fanAccessories';
import { formatNumber } from '../utils/format';
import { ItalianNumberInput, parseItalianNumber } from '../components/ItalianNumberInput';
import { AeraulicTopologicalTree, AeraulicTreeNode, AeraulicChimneyNode } from '../components/AeraulicTopologicalTree';
import { PrintReport, PrintSection } from '../components/print';

interface ToolAspiratorProps {
  projectData: ProjectData;
  setProjectData: (data: any) => void;
  setAppMode: (mode: string) => void;
}

// ── Interfacce TypeScript ───────────────────────────────────────────────────

/** Accessori aeraulici per singolo tratto */
export interface DuctAccessories {
  n_gomiti90_R15: number;
  n_gomiti90_R2: number;
  n_gomiti45: number;
  n_bif_principale: number;
  n_bif_laterale: number;
  n_rid_exp: number;
  n_rid_cont: number;
  n_valvole: number;
  n_ingresso: number;
  n_uscita: number;
}

/** Tratto di condotta aeraulica nella rete ad albero */
export interface AeraulicSegment {
  uid?: string;           // Identificativo univoco interno stabile per React key
  id: string;             // Codice univoco breve (es. 'L1', 'L2', 'L10')
  name: string;           // Nome descrittivo (libero, es. 'Aspirazione Bottale 1')
  type: 'source' | 'junction'; // 'source' = bocchetta / ramo iniziale; 'junction' = confluenza / collettore a valle
  
  // Se 'source' (bocchetta a monte)
  Q_custom_m3h: string;   // Portata aspirata a monte [m³/h]
  dp_bocchetta_Pa: string; // Depressione specifica bocchetta [Pa] (se vuoto usa default globale)
  
  // Confluenza a valle: in quale tratto si innesta questo ramo? (se vuoto "" -> va al collettore finale / ventilatore)
  confluisceInId: string;
  
  // Geometria condotta
  D_mm: string;          // Diametro interno [mm]
  L_m: string;           // Lunghezza condotta [m]
  material: string;       // Materiale (lookup scabrezza)
  roughness_mm: string;  // Scabrezza ε [mm]
  
  // Accessori (conteggi pezzi speciali)
  accessories: DuctAccessories;
}

/** Componente speciale di trattamento fumi / aeraulico */
export interface SpecialComponent {
  id: string;
  name: string;
  type: 'Scrubber' | 'Separatore' | 'Filtro' | 'Silenziatore' | 'Scambiatore' | 'Altro';
  position: 'general' | 'segment'; // 'general' = d'impianto (usa Q_tot); 'segment' = su tratto locale
  segmentId: string;               // ID del tratto a cui è abbinato se position === 'segment'
  
  // Specifico per Scrubber
  D_interno_mm: string;     // Diametro interno corpo [mm]
  H_corpo_m: string;        // Altezza corpo attraversamento [m]
  H_riempimento_m: string;  // Altezza letto di riempimento [m]
  dp_riempimento_Pa_m: string; // Perdita specifica riempimento [Pa/m]
  dp_extra_Pa: string;      // Perdita aggiuntiva fissa (demister interno, ugelli, ecc.) [Pa]
  
  // Per Separatore / Filtro / Silenziatore / Scambiatore / Altro
  dp_concentrata_Pa: string; // Perdita concentrata fissa [Pa] da scheda tecnica
}

/** Camino di espulsione a valle del ventilatore (mandata verso l'atmosfera) */
export interface FanChimneyData {
  enabled: boolean;        // Se true, include la perdita del camino nella prevalenza totale
  name: string;           // Nome identificativo (es. 'Camino E1')
  D_mm: string;           // Diametro interno condotto [mm]
  H_m: string;            // Altezza / Lunghezza condotto di mandata [m]
  material: string;       // Materiale condotto camino
  roughness_mm: string;   // Scabrezza parete ε [mm]
  n_curve90: number;      // Numero curve a 90° sul condotto di espulsione
  hasSbocco: boolean;     // Perdita allo sbocco terminale in atmosfera (cappello / tronco di cono, ξ = 1.0)
  dp_manuale_Pa: string;  // Perdita di carico fissa alternativa [Pa]
}

/** Dati globali impianto */
export interface FanGlobalData {
  T_aria_C: string;                // Temperatura aria [°C]
  quota_m: string;                 // Quota impianto [m s.l.m.]
  dp_bocchetta_default_Pa: string; // Depressione standard bocchette [Pa]
  eta_ventilatore_perc: string;    // Rendimento ventilatore in % (es. 55 per 55%)
  margine_motore_perc: string;     // Margine di sicurezza potenza motore in % (es. 20%)
  motore_tipo_scelta?: 'standard' | 'custom'; // Tipo scelta motore: standard IEC o personalizzato da targa
  taglia_IEC_installata: number | null; // Taglia motore commerciale scelta a mano [kW]
  motore_custom_kW?: string;       // Potenza motore personalizzata da targa [kW] (es. 3,7 o 0,18)
  n_titolari: number;              // Numero ventilatori titolari
  n_riserva: number;               // Numero ventilatori di riserva
}

export interface FanToolData {
  global: FanGlobalData;
  segments: AeraulicSegment[];
  specials: SpecialComponent[];
  chimney: FanChimneyData;
  activeTab: 'config' | 'rete' | 'risultati';
  showSpecials: boolean;
}

// ── Inizializzazione Dati (Nessun dato a caso, campi vuoti con placeholder) ──

export const defaultAccessories = (): DuctAccessories => ({
  n_gomiti90_R15: 0,
  n_gomiti90_R2: 0,
  n_gomiti45: 0,
  n_bif_principale: 0,
  n_bif_laterale: 0,
  n_rid_exp: 0,
  n_rid_cont: 0,
  n_valvole: 0,
  n_ingresso: 0,
  n_uscita: 0,
});

export const defaultChimneyData = (): FanChimneyData => ({
  enabled: true,
  name: 'Camino di Espulsione E1',
  D_mm: '',
  H_m: '',
  material: 'Acciaio inox',
  roughness_mm: '0,050',
  n_curve90: 1,
  hasSbocco: true,
  dp_manuale_Pa: '',
});

export const createNewSegment = (suggestedId: string, isFirst = false): AeraulicSegment => ({
  uid: `seg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
  id: suggestedId,
  name: '',
  type: isFirst ? 'source' : 'source',
  Q_custom_m3h: '',
  dp_bocchetta_Pa: '',
  confluisceInId: '',
  D_mm: '',
  L_m: '',
  material: 'PVC rigido',
  roughness_mm: '0,020',
  accessories: defaultAccessories(),
});

export const createNewSpecial = (count: number): SpecialComponent => ({
  id: `SP${count}`,
  name: '',
  type: 'Scrubber',
  position: 'general',
  segmentId: '',
  D_interno_mm: '',
  H_corpo_m: '',
  H_riempimento_m: '',
  dp_riempimento_Pa_m: '',
  dp_extra_Pa: '',
  dp_concentrata_Pa: '',
});

/**
 * Calcola in modo intelligente il prossimo ID disponibile per un nuovo tratto (es. 'L8', 'L9', 'L34'),
 * analizzando tutti i codici esistenti per evitare categoricamente collisioni o duplicati.
 */
export function getNextAvailableSegmentId(segments: AeraulicSegment[], prefix = 'L'): string {
  const existingUpper = new Set(segments.map(s => s.id.trim().toUpperCase()));
  let maxNum = 0;
  segments.forEach(s => {
    const match = s.id.match(/^([A-Za-z]+)(\d+)$/);
    if (match) {
      const n = parseInt(match[2], 10);
      if (!isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }
  });

  let nextCandidate = maxNum + 1;
  while (existingUpper.has(`${prefix}${nextCandidate}`.toUpperCase())) {
    nextCandidate++;
  }
  return `${prefix}${nextCandidate}`;
}

/**
 * Verifica se l'assegnazione di candidateTargetRef come confluenza di sourceRef
 * creerebbe un ciclo infinito nella rete aeraulica.
 */
export function wouldCreateCycle(sourceRef: string, candidateTargetRef: string, segments: AeraulicSegment[]): boolean {
  if (!sourceRef || !candidateTargetRef) return false;
  if (sourceRef === candidateTargetRef) return true;

  const segByRef = new Map<string, AeraulicSegment>();
  segments.forEach(s => {
    if (s.uid) segByRef.set(s.uid, s);
    if (s.id) segByRef.set(s.id, s);
  });

  const sourceSeg = segByRef.get(sourceRef);
  const candidateSeg = segByRef.get(candidateTargetRef);
  if (!sourceSeg || !candidateSeg) return false;
  if (sourceSeg.uid && candidateSeg.uid && sourceSeg.uid === candidateSeg.uid) return true;

  let curr: AeraulicSegment | undefined = candidateSeg;
  const visited = new Set<string>();
  while (curr && curr.confluisceInId) {
    if ((sourceSeg.uid && curr.confluisceInId === sourceSeg.uid) || curr.confluisceInId === sourceSeg.id) return true;
    const currKey = curr.uid || curr.id;
    if (visited.has(currKey)) break;
    visited.add(currKey);
    curr = segByRef.get(curr.confluisceInId);
  }
  return false;
}

const defaultData: FanToolData = {
  global: {
    T_aria_C: '',
    quota_m: '',
    dp_bocchetta_default_Pa: '',
    eta_ventilatore_perc: '',
    margine_motore_perc: '',
    motore_tipo_scelta: 'standard',
    taglia_IEC_installata: null,
    motore_custom_kW: '',
    n_titolari: 1,
    n_riserva: 0,
  },
  segments: [createNewSegment('L1', true)],
  specials: [],
  chimney: defaultChimneyData(),
  activeTab: 'config',
  showSpecials: true,
};

/**
 * Normalizza e migra i dati caricati (da localStorage o Cloud Firestore)
 */
function normalizeFanData(loaded: any): FanToolData {
  if (!loaded) return defaultData;

  const g = loaded.global || {};
  const migratedGlobal: FanGlobalData = {
    T_aria_C: g.T_aria_C !== undefined ? String(g.T_aria_C).replace('.', ',') : '',
    quota_m: g.quota_m !== undefined ? String(g.quota_m).replace('.', ',') : '',
    dp_bocchetta_default_Pa: g.dp_bocchetta_default_Pa !== undefined
      ? String(g.dp_bocchetta_default_Pa).replace('.', ',')
      : (g.dp_bocchetta_Pa !== undefined ? String(g.dp_bocchetta_Pa).replace('.', ',') : ''),
    eta_ventilatore_perc: g.eta_ventilatore_perc !== undefined
      ? String(g.eta_ventilatore_perc).replace('.', ',')
      : (g.eta_ventilatore !== undefined ? String(Math.round(g.eta_ventilatore * 100)).replace('.', ',') : ''),
    margine_motore_perc: g.margine_motore_perc !== undefined ? String(g.margine_motore_perc).replace('.', ',') : '',
    motore_tipo_scelta: g.motore_tipo_scelta === 'custom' ? 'custom' : 'standard',
    taglia_IEC_installata: g.taglia_IEC_installata !== undefined ? g.taglia_IEC_installata : null,
    motore_custom_kW: g.motore_custom_kW !== undefined ? String(g.motore_custom_kW).replace('.', ',') : '',
    n_titolari: g.n_titolari || 1,
    n_riserva: g.n_riserva || 0,
  };

  const rawSegments = Array.isArray(loaded.segments) ? loaded.segments : [];
  const hasExplicitTopology = rawSegments.some((s: any) => s.confluisceInId !== undefined && s.confluisceInId !== null);

  const migratedSegments: AeraulicSegment[] = rawSegments.map((s: any, idx: number) => {
    const rawAccessories = s.accessories || {};
    const accessories: DuctAccessories = {
      n_gomiti90_R15: rawAccessories.n_gomiti90_R15 ?? s.n_gomiti90_R15 ?? 0,
      n_gomiti90_R2:  rawAccessories.n_gomiti90_R2  ?? s.n_gomiti90_R2  ?? 0,
      n_gomiti45:     rawAccessories.n_gomiti45     ?? s.n_gomiti45     ?? 0,
      n_bif_principale: rawAccessories.n_bif_principale ?? s.n_bif_principale ?? 0,
      n_bif_laterale:   rawAccessories.n_bif_laterale   ?? s.n_bif_laterale   ?? 0,
      n_rid_exp:      rawAccessories.n_rid_exp      ?? s.n_rid_exp      ?? 0,
      n_rid_cont:     rawAccessories.n_rid_cont     ?? s.n_rid_cont     ?? 0,
      n_valvole:      rawAccessories.n_valvole      ?? s.n_valvole      ?? 0,
      n_ingresso:     rawAccessories.n_ingresso     ?? s.n_ingresso     ?? 0,
      n_uscita:       rawAccessories.n_uscita       ?? s.n_uscita       ?? 0,
    };

    const currentId = s.id !== undefined ? (String(s.id).startsWith('L') ? String(s.id) : `L${s.id}`) : `L${idx + 1}`;
    
    // Se è un vecchio progetto in cascata (senza confluisceInId), il tratto 1 confluisce in 2, 2 in 3, ecc. e l'ultimo al ventilatore
    let confluisceInId = '';
    let segType: 'source' | 'junction' = 'source';
    if (hasExplicitTopology) {
      confluisceInId = s.confluisceInId ? String(s.confluisceInId) : '';
      segType = s.type === 'junction' ? 'junction' : 'source';
    } else {
      if (idx < rawSegments.length - 1) {
        const nextId = rawSegments[idx + 1]?.id !== undefined
          ? (String(rawSegments[idx + 1].id).startsWith('L') ? String(rawSegments[idx + 1].id) : `L${rawSegments[idx + 1].id}`)
          : `L${idx + 2}`;
        confluisceInId = nextId;
      } else {
        confluisceInId = ''; // L'ultimo tratto va al ventilatore
      }
      segType = idx === 0 ? 'source' : 'junction';
    }

    return {
      uid: s.uid || `seg_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
      id: currentId,
      name: s.name || '',
      type: segType,
      Q_custom_m3h: s.Q_custom_m3h !== undefined
        ? String(s.Q_custom_m3h).replace('.', ',')
        : (idx === 0 && g.Q_design_m3h !== undefined ? String(g.Q_design_m3h).replace('.', ',') : ''),
      dp_bocchetta_Pa: s.dp_bocchetta_Pa !== undefined ? String(s.dp_bocchetta_Pa).replace('.', ',') : '',
      confluisceInId,
      D_mm: s.D_mm !== undefined ? String(s.D_mm).replace('.', ',') : '',
      L_m: s.L_m !== undefined ? String(s.L_m).replace('.', ',') : '',
      material: s.material || 'PVC rigido',
      roughness_mm: s.roughness_mm !== undefined ? String(s.roughness_mm).replace('.', ',') : '0,020',
      accessories,
    };
  });

  // Migrazione trasparente di confluisceInId e segmentId da ID testuale a UID immutabile
  const idToUidMap = new Map<string, string>();
  migratedSegments.forEach(s => {
    if (s.id && s.uid) {
      idToUidMap.set(s.id.trim(), s.uid);
      idToUidMap.set(s.id.trim().toUpperCase(), s.uid);
    }
  });

  migratedSegments.forEach(s => {
    if (s.confluisceInId) {
      const targetUid = idToUidMap.get(s.confluisceInId.trim()) || idToUidMap.get(s.confluisceInId.trim().toUpperCase());
      if (targetUid) {
        s.confluisceInId = targetUid;
      }
    }
  });

  const rawSpecials = Array.isArray(loaded.specials) ? loaded.specials : [];
  const migratedSpecials: SpecialComponent[] = rawSpecials.map((sp: any, idx: number) => {
    const origSegId = sp.segmentId ? String(sp.segmentId).trim() : '';
    const targetUid = origSegId ? (idToUidMap.get(origSegId) || idToUidMap.get(origSegId.toUpperCase()) || origSegId) : '';
    return {
      id: sp.id ? String(sp.id) : `SP${idx + 1}`,
      name: sp.name || '',
      type: sp.type || 'Scrubber',
      position: sp.position === 'segment' ? 'segment' : 'general',
      segmentId: targetUid,
      D_interno_mm: sp.D_interno_mm !== undefined ? String(sp.D_interno_mm).replace('.', ',') : '',
      H_corpo_m: sp.H_corpo_m !== undefined ? String(sp.H_corpo_m).replace('.', ',') : '',
      H_riempimento_m: sp.H_riempimento_m !== undefined ? String(sp.H_riempimento_m).replace('.', ',') : '',
      dp_riempimento_Pa_m: sp.dp_riempimento_Pa_m !== undefined ? String(sp.dp_riempimento_Pa_m).replace('.', ',') : '',
      dp_extra_Pa: sp.dp_extra_Pa !== undefined ? String(sp.dp_extra_Pa).replace('.', ',') : '',
      dp_concentrata_Pa: sp.dp_concentrata_Pa !== undefined ? String(sp.dp_concentrata_Pa).replace('.', ',') : '',
    };
  });

  const rawChimney = loaded.chimney || {};
  const migratedChimney: FanChimneyData = {
    enabled: rawChimney.enabled !== undefined ? Boolean(rawChimney.enabled) : true,
    name: rawChimney.name || 'Camino di Espulsione E1',
    D_mm: rawChimney.D_mm !== undefined ? String(rawChimney.D_mm).replace('.', ',') : '',
    H_m: rawChimney.H_m !== undefined ? String(rawChimney.H_m).replace('.', ',') : '',
    material: rawChimney.material || 'Acciaio inox',
    roughness_mm: rawChimney.roughness_mm !== undefined ? String(rawChimney.roughness_mm).replace('.', ',') : '0,050',
    n_curve90: rawChimney.n_curve90 !== undefined ? Number(rawChimney.n_curve90) : 1,
    hasSbocco: rawChimney.hasSbocco !== undefined ? Boolean(rawChimney.hasSbocco) : true,
    dp_manuale_Pa: rawChimney.dp_manuale_Pa !== undefined ? String(rawChimney.dp_manuale_Pa).replace('.', ',') : '',
  };

  // Risoluzione robusta activeTab: mappa vecchi valori ('tratti') e fallback su 'config'
  let validatedTab: FanToolData['activeTab'] = 'config';
  if (loaded.activeTab === 'config' || loaded.activeTab === 'rete' || loaded.activeTab === 'risultati') {
    validatedTab = loaded.activeTab;
  } else if (loaded.activeTab === 'tratti') {
    validatedTab = 'rete';
  }

  return {
    global: migratedGlobal,
    segments: migratedSegments.length > 0 ? migratedSegments : [createNewSegment('L1', true)],
    specials: migratedSpecials,
    chimney: migratedChimney,
    activeTab: validatedTab,
    showSpecials: loaded.showSpecials !== undefined ? loaded.showSpecials : true,
  };
}

// ── Fisica / Calcoli Aeraulici ──────────────────────────────────────────────

/** Densità aria [kg/m³] corretta per temperatura e quota */
function calcRhoAria(T_C: number, quota_m: number): number {
  const T_K = T_C + 273.15;
  const P_atm = 101325 * Math.pow(1 - quota_m / 44308, 5.256);
  return 1.293 * (273.15 / T_K) * (P_atm / 101325);
}

/** Viscosità cinematica aria [m²/s] con equazione di Sutherland */
function calcNuAria(T_C: number): number {
  const T_K = T_C + 273.15;
  const mu0 = 1.716e-5;
  const T0 = 273.15;
  const C = 110.4;
  const mu = mu0 * Math.pow(T_K / T0, 1.5) * (T0 + C) / (T_K + C);
  const rho = calcRhoAria(T_C, 0);
  return mu / rho;
}

/** Formula di Colebrook-White iterativa per fattore d'attrito λ */
function calcLambda(Re: number, epsilon_m: number, D_m: number): number {
  if (Re <= 0 || D_m <= 0) return 0.02;
  if (Re < 2300) {
    return 64 / Re;
  }
  let lam = 0.02;
  for (let i = 0; i < 50; i++) {
    const lam_new = 1 / Math.pow(-2 * Math.log10(epsilon_m / (3.7 * D_m) + 2.51 / (Re * Math.sqrt(lam))), 2);
    if (Math.abs(lam_new - lam) < 1e-9) return lam_new;
    lam = lam_new;
  }
  return lam;
}

/** Calcolo perdite per un singolo tratto condotta [Pa] */
function calcSegmentAeraulics(seg: AeraulicSegment, Q_m3h: number, rho: number, nu: number) {
  const D_mm = parseItalianNumber(seg.D_mm);
  const L_m = parseItalianNumber(seg.L_m);
  const roughness_mm = parseItalianNumber(seg.roughness_mm) || 0.02;

  if (D_mm <= 0 || Q_m3h <= 0) {
    return {
      Q_m3h,
      v_ms: 0,
      Re: 0,
      lambda: 0,
      L_eq_tot_m: 0,
      dp_dist_Pa: 0,
      dp_conc_Pa: 0,
      dp_tot_Pa: 0,
    };
  }

  const D_m = D_mm / 1000;
  const A = Math.PI * D_m * D_m / 4;
  const v = (Q_m3h / 3600) / A;
  const Re = (v * D_m) / nu;
  const lambda = calcLambda(Re, roughness_mm / 1000, D_m);

  const dp_dist = lambda * (L_m / D_m) * (rho * v * v) / 2;

  const acc = FAN_ACCESSORIES;
  const a: any = seg.accessories || seg || {};
  const getAcc = (k: string) => Number(a[k] ?? (seg as any)[k] ?? 0);

  const leq_gomiti90_R15 = getAcc('n_gomiti90_R15') * getLeqForDiameter(acc[0], D_mm);
  const leq_gomiti90_R2  = getAcc('n_gomiti90_R2')  * getLeqForDiameter(acc[1], D_mm);
  const leq_gomiti45     = getAcc('n_gomiti45')     * getLeqForDiameter(acc[2], D_mm);
  const leq_bif_princ    = getAcc('n_bif_principale') * getLeqForDiameter(acc[3], D_mm);
  const leq_bif_lat      = getAcc('n_bif_laterale') * getLeqForDiameter(acc[4], D_mm);
  const leq_rid_exp      = getAcc('n_rid_exp')      * getLeqForDiameter(acc[5], D_mm);
  const leq_rid_cont     = getAcc('n_rid_cont')     * getLeqForDiameter(acc[6], D_mm);
  const leq_valvole      = getAcc('n_valvole')      * getLeqForDiameter(acc[7], D_mm);
  const leq_ingresso     = getAcc('n_ingresso')     * getLeqForDiameter(acc[8], D_mm);
  const leq_uscita       = getAcc('n_uscita')       * getLeqForDiameter(acc[9], D_mm);

  const L_eq_tot = leq_gomiti90_R15 + leq_gomiti90_R2 + leq_gomiti45
    + leq_bif_princ + leq_bif_lat + leq_rid_exp + leq_rid_cont
    + leq_valvole + leq_ingresso + leq_uscita;

  const dp_conc = lambda * (L_eq_tot / D_m) * (rho * v * v) / 2;

  return {
    Q_m3h,
    v_ms: v,
    Re,
    lambda,
    L_eq_tot_m: L_eq_tot,
    dp_dist_Pa: dp_dist,
    dp_conc_Pa: dp_conc,
    dp_tot_Pa: dp_dist + dp_conc,
  };
}

/** Calcolo perdite per un componente speciale [Pa] */
function calcSpecialAeraulics(sp: SpecialComponent, Q_m3h: number, rho: number, nu: number) {
  if (sp.type === 'Scrubber') {
    const D_int_mm = parseItalianNumber(sp.D_interno_mm);
    const H_corpo_m = parseItalianNumber(sp.H_corpo_m);
    const H_riemp_m = parseItalianNumber(sp.H_riempimento_m);
    const dp_riemp_Pa_m = parseItalianNumber(sp.dp_riempimento_Pa_m);
    const dp_extra_Pa = parseItalianNumber(sp.dp_extra_Pa);

    let v_ms = 0;
    let dp_darcy = 0;
    if (D_int_mm > 0 && Q_m3h > 0) {
      const D_m = D_int_mm / 1000;
      const A = Math.PI * D_m * D_m / 4;
      v_ms = (Q_m3h / 3600) / A;
      const Re = (v_ms * D_m) / nu;
      const lambda = calcLambda(Re, 0.02 / 1000, D_m);
      dp_darcy = lambda * (H_corpo_m / D_m) * (rho * v_ms * v_ms) / 2;
    }

    const dp_riempimento = dp_riemp_Pa_m * H_riemp_m;
    const dp_tot = dp_darcy + dp_riempimento + dp_extra_Pa;

    return {
      Q_m3h,
      v_ms,
      dp_darcy_Pa: dp_darcy,
      dp_riempimento_Pa: dp_riempimento,
      dp_extra_Pa,
      dp_tot_Pa: dp_tot,
    };
  } else {
    const dp_tot = parseItalianNumber(sp.dp_concentrata_Pa);
    return {
      Q_m3h,
      v_ms: 0,
      dp_darcy_Pa: 0,
      dp_riempimento_Pa: 0,
      dp_extra_Pa: 0,
      dp_tot_Pa: dp_tot,
    };
  }
}

/** Calcolo perdite di carico per il Camino di Espulsione (Mandata post-ventilatore) [Pa] */
function calcChimneyAeraulics(chim: FanChimneyData, Q_m3h: number, rho: number, nu: number) {
  if (!chim.enabled || Q_m3h <= 0) {
    return {
      Q_m3h: 0,
      v_ms: 0,
      Re: 0,
      lambda: 0,
      dp_dist_Pa: 0,
      dp_conc_Pa: 0,
      dp_tot_Pa: 0,
    };
  }

  // Perdita concentrata fissa manuale (se specificata dall'utente)
  const dp_man = parseItalianNumber(chim.dp_manuale_Pa);
  if (dp_man > 0) {
    return {
      Q_m3h,
      v_ms: 0,
      Re: 0,
      lambda: 0,
      dp_dist_Pa: 0,
      dp_conc_Pa: dp_man,
      dp_tot_Pa: dp_man,
    };
  }

  const D_mm = parseItalianNumber(chim.D_mm);
  const H_m = parseItalianNumber(chim.H_m);
  const roughness_mm = parseItalianNumber(chim.roughness_mm) || 0.05;

  if (D_mm <= 0) {
    return {
      Q_m3h,
      v_ms: 0,
      Re: 0,
      lambda: 0,
      dp_dist_Pa: 0,
      dp_conc_Pa: 0,
      dp_tot_Pa: 0,
    };
  }

  const D_m = D_mm / 1000;
  const A = Math.PI * D_m * D_m / 4;
  const v = (Q_m3h / 3600) / A;
  const Re = (v * D_m) / nu;
  const lambda = calcLambda(Re, roughness_mm / 1000, D_m);

  // Perdita distribuita lungo la canna del camino
  const dp_dist = H_m > 0 ? lambda * (H_m / D_m) * (rho * v * v) / 2 : 0;

  // Perdita concentrata: curve 90° (ξ ≈ 0.35 cad) + sbocco atmosfera / cappello (ξ = 1.0)
  const xi_curve = (chim.n_curve90 || 0) * 0.35;
  const xi_sbocco = chim.hasSbocco ? 1.0 : 0.0;
  const dp_conc = (xi_curve + xi_sbocco) * (rho * v * v) / 2;

  const dp_tot = dp_dist + dp_conc;

  return {
    Q_m3h,
    v_ms: v,
    Re,
    lambda,
    dp_dist_Pa: dp_dist,
    dp_conc_Pa: dp_conc,
    dp_tot_Pa: dp_tot,
  };
}

// ── Componente Principale ───────────────────────────────────────────────────

export function ToolAspiratore({ projectData, setProjectData, setAppMode }: ToolAspiratorProps) {
  const [data, setData] = useState<FanToolData>(() => defaultData);
  const [collapsedAccessoryIds, setCollapsedAccessoryIds] = useState<Record<string, boolean>>({});
  const [selectedSegmentUid, setSelectedSegmentUid] = useState<string | null>(null);
  const [segmentsViewMode, setSegmentsViewMode] = useState<'focused' | 'all'>('focused');
  const [showOverviewTable, setShowOverviewTable] = useState<boolean>(false);

  const [draggedSegmentIndex, setDraggedSegmentIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: 'before' | 'after' } | null>(null);

  /**
   * Calcola la posizione di atterraggio (before o after) in modo naturale ed ergonomico.
   * - Se l'utente trascina verso il vicino destro immediato (targetIdx === sourceIdx + 1),
   *   l'unica intenzione possibile è posizionarlo DOPO quel vicino (scambio di 1 posto a destra).
   * - Se trascina verso il vicino sinistro immediato (targetIdx === sourceIdx - 1),
   *   l'unica intenzione possibile è posizionarlo PRIMA di quel vicino (scambio di 1 posto a sinistra).
   * - Per salti ampi (2 o più posizioni), la prima metà (sinistra/alto) assegna 'before', la seconda 'after'.
   */
  function computeDropTarget(
    sourceIdx: number,
    targetIdx: number,
    isFirstHalf: boolean
  ): { index: number; position: 'before' | 'after' } | null {
    if (sourceIdx === targetIdx || sourceIdx < 0 || targetIdx < 0) return null;
    if (targetIdx === sourceIdx + 1) {
      return { index: targetIdx, position: 'after' };
    }
    if (targetIdx === sourceIdx - 1) {
      return { index: targetIdx, position: 'before' };
    }
    return { index: targetIdx, position: isFirstHalf ? 'before' : 'after' };
  }

  function dropSegmentAt(sourceIdx: number, targetIdx: number, position: 'before' | 'after') {
    if (sourceIdx === targetIdx || sourceIdx < 0 || targetIdx < 0) return;
    setData(prev => {
      if (sourceIdx >= prev.segments.length || targetIdx >= prev.segments.length) return prev;
      const list = [...prev.segments];
      const targetKey = prev.segments[targetIdx]?.uid || prev.segments[targetIdx]?.id;
      const [moved] = list.splice(sourceIdx, 1);
      if (!moved) return prev;

      const newTargetIdx = list.findIndex(s => (s.uid && s.uid === targetKey) || s.id === targetKey);
      if (newTargetIdx === -1) {
        list.push(moved);
      } else {
        const insertIdx = position === 'before' ? newTargetIdx : newTargetIdx + 1;
        list.splice(insertIdx, 0, moved);
      }
      return { ...prev, segments: list };
    });
  }

  function toggleAccessoryCollapse(segId: string) {
    setCollapsedAccessoryIds(prev => ({ ...prev, [segId]: !prev[segId] }));
  }

  function updGlobal(field: keyof FanGlobalData, value: any) {
    setData(prev => ({ ...prev, global: { ...prev.global, [field]: value } }));
  }

  function updChimney(field: keyof FanChimneyData, value: any) {
    setData(prev => {
      const updated = { ...prev.chimney, [field]: value };
      if (field === 'material' && typeof value === 'string' && FAN_ROUGHNESS[value] !== undefined) {
        updated.roughness_mm = formatNumber(FAN_ROUGHNESS[value], 3);
      }
      return { ...prev, chimney: updated };
    });
  }

  function addSegment() {
    const newId = getNextAvailableSegmentId(data.segments);
    const newSeg = createNewSegment(newId, false);
    newSeg.confluisceInId = ''; // Verso il Ventilatore

    setData(prev => {
      const lastSeg = prev.segments.length > 0 ? prev.segments[prev.segments.length - 1] : null;
      if (lastSeg) {
        newSeg.type = 'junction'; // Raccoglie l'aria a monte dal tratto precedente
      }

      // Il tratto precedente ora confluisce nel nuovo tratto appena aggiunto (tramite UID stabile)
      const updatedSegments = prev.segments.map((s, idx) => {
        if (idx === prev.segments.length - 1) {
          return { ...s, confluisceInId: newSeg.uid };
        }
        return s;
      });

      return {
        ...prev,
        segments: [...updatedSegments, newSeg]
      };
    });
    setSelectedSegmentUid(newSeg.uid);
  }

  function addBranchToCollector(collectorRef: string) {
    const targetCol = data.segments.find(s => (s.uid && s.uid === collectorRef) || s.id === collectorRef);
    if (!targetCol) return;
    const newId = getNextAvailableSegmentId(data.segments);
    const newSeg = createNewSegment(newId, false);
    newSeg.type = 'source';
    newSeg.confluisceInId = targetCol.uid; // Collega stabilmente all'UID del collettore!
    setData(prev => ({
      ...prev,
      segments: [...prev.segments, newSeg]
    }));
    setSelectedSegmentUid(newSeg.uid);
  }

  function duplicateSegment(segUid: string) {
    const srcSeg = data.segments.find(s => (s.uid && s.uid === segUid) || s.id === segUid);
    if (!srcSeg) return;
    const newId = getNextAvailableSegmentId(data.segments);
    const newSeg: AeraulicSegment = {
      ...srcSeg,
      uid: `seg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      id: newId,
      name: srcSeg.name ? `${srcSeg.name} (Copia)` : '',
      confluisceInId: srcSeg.confluisceInId,
      accessories: { ...(srcSeg.accessories || defaultAccessories()) },
    };
    setData(prev => ({
      ...prev,
      segments: [...prev.segments, newSeg],
    }));
    setSelectedSegmentUid(newSeg.uid);
  }

  function removeSegment(segUid: string) {
    const targetSeg = data.segments.find(s => (s.uid && s.uid === segUid) || s.id === segUid);
    if (!targetSeg) return;
    const targetId = targetSeg.id;
    const targetUid = targetSeg.uid;

    setData(prev => {
      const remaining = prev.segments.filter(s => (s.uid && s.uid !== targetUid) && s.id !== segUid);
      return {
        ...prev,
        segments: remaining.map(s => {
          if (s.confluisceInId === targetUid || s.confluisceInId === targetId) {
            return { ...s, confluisceInId: '' };
          }
          return s;
        }),
        specials: prev.specials.map(sp => {
          if (sp.segmentId === targetUid || sp.segmentId === targetId) {
            return { ...sp, segmentId: '', position: 'general' };
          }
          return sp;
        })
      };
    });

    const remaining = data.segments.filter(s => (s.uid && s.uid !== targetUid) && s.id !== segUid);
    if (remaining.length > 0) {
      setSelectedSegmentUid(remaining[0].uid);
    } else {
      setSelectedSegmentUid(null);
    }
  }

  function moveSpecial(index: number, direction: 'up' | 'down') {
    setData(prev => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.specials.length) return prev;
      const updated = [...prev.specials];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return { ...prev, specials: updated };
    });
  }

  function updSegment(segUid: string, field: keyof AeraulicSegment, value: any) {
    setData(prev => ({
      ...prev,
      segments: prev.segments.map(s => {
        if ((s.uid && s.uid !== segUid) || (!s.uid && s.id !== segUid)) return s;
        const updated = { ...s, [field]: value };
        if (field === 'material' && typeof value === 'string' && FAN_ROUGHNESS[value] !== undefined) {
          updated.roughness_mm = formatNumber(FAN_ROUGHNESS[value], 3);
        }
        return updated;
      })
    }));
  }

  function updSegmentId(segUid: string, newId: string) {
    setData(prev => ({
      ...prev,
      segments: prev.segments.map(s => {
        if ((s.uid && s.uid === segUid) || (!s.uid && s.id === segUid)) {
          return { ...s, id: newId };
        }
        return s;
      })
    }));
  }

  function updSegmentAccessory(segUid: string, accField: string, count: number) {
    setData(prev => ({
      ...prev,
      segments: prev.segments.map(s => {
        if ((s.uid && s.uid !== segUid) || (!s.uid && s.id !== segUid)) return s;
        const currentAcc = s.accessories || defaultAccessories();
        return {
          ...s,
          accessories: {
            ...currentAcc,
            [accField]: Math.max(0, count)
          }
        };
      })
    }));
  }

  function addSpecial() {
    setData(prev => ({
      ...prev,
      specials: [...prev.specials, createNewSpecial(prev.specials.length + 1)]
    }));
  }

  function removeSpecial(id: string) {
    setData(prev => ({
      ...prev,
      specials: prev.specials.filter(sp => sp.id !== id)
    }));
  }

  function updSpecial(id: string, field: keyof SpecialComponent, value: any) {
    setData(prev => ({
      ...prev,
      specials: prev.specials.map(sp => sp.id !== id ? sp : { ...sp, [field]: value })
    }));
  }

  // ── Risoluzione della Rete Aeraulica e Calcoli (useMemo) ───────────────────

  const calc = useMemo(() => {
    const g = data.global;
    const hasT = g.T_aria_C.trim() !== '';
    const hasQuota = g.quota_m.trim() !== '';
    const hasEta = g.eta_ventilatore_perc.trim() !== '';
    const hasMargine = g.margine_motore_perc.trim() !== '';

    const T_C = parseItalianNumber(g.T_aria_C) || 20;
    const quota = parseItalianNumber(g.quota_m) || 0;
    const dp_bocchetta_def = parseItalianNumber(g.dp_bocchetta_default_Pa) || 250;
    const eta_perc = parseItalianNumber(g.eta_ventilatore_perc) || 55;
    const eta = Math.max(0.1, Math.min(1.0, eta_perc / 100));

    // Gestione esatta del margine: se l'utente ha inserito 0, il margine è 0%! Se vuoto, 0%
    const margine_perc = hasMargine ? (parseItalianNumber(g.margine_motore_perc) || 0) : 0;

    const rho = calcRhoAria(T_C, quota);
    const nu = calcNuAria(T_C);

    // 1. Risoluzione Portate per ciascun Tratto nella Rete ad Albero
    const flowMap: Record<string, number> = {};
    const segByRef = new Map<string, AeraulicSegment>();
    data.segments.forEach(s => {
      if (s.uid) segByRef.set(s.uid, s);
      if (s.id) segByRef.set(s.id, s);
    });

    function resolveFlow(segRef: string, visited = new Set<string>()): number {
      if (!segRef) return 0;
      const seg = segByRef.get(segRef);
      if (!seg) return 0;
      const primaryKey = seg.uid || seg.id;

      if (flowMap[primaryKey] !== undefined) return flowMap[primaryKey];
      if (visited.has(primaryKey)) return 0;
      visited.add(primaryKey);

      if (seg.type === 'source') {
        const q = parseItalianNumber(seg.Q_custom_m3h);
        flowMap[primaryKey] = q;
        if (seg.id) flowMap[seg.id] = q;
        return q;
      }

      const incoming = data.segments.filter(s => {
        if (!s.confluisceInId) return false;
        return (seg.uid && s.confluisceInId === seg.uid) || s.confluisceInId === seg.id;
      });

      const totalIn = incoming.reduce((sum, inc) => sum + resolveFlow(inc.uid || inc.id, new Set(visited)), 0);
      flowMap[primaryKey] = totalIn;
      if (seg.id) flowMap[seg.id] = totalIn;
      return totalIn;
    }

    data.segments.forEach(s => resolveFlow(s.uid || s.id));

    const totalFlow_m3h = data.segments
      .filter(s => s.type === 'source')
      .reduce((sum, s) => sum + parseItalianNumber(s.Q_custom_m3h), 0);

    // 2. Calcolo perdite di carico per ogni tratto
    const segResults = data.segments.map(seg => {
      const q = flowMap[seg.uid || seg.id] || (seg.id ? flowMap[seg.id] : 0) || 0;
      const res = calcSegmentAeraulics(seg, q, rho, nu);
      return { seg, flow_m3h: q, res };
    });
    const segResultsMap = new Map<string, typeof segResults[0]>();
    segResults.forEach(r => {
      if (r.seg.uid) segResultsMap.set(r.seg.uid, r);
      if (r.seg.id) segResultsMap.set(r.seg.id, r);
    });

    // 3. Calcolo perdite per ciascun componente speciale di trattamento
    const specResults = data.specials.map(sp => {
      let q = totalFlow_m3h;
      if (sp.position === 'segment' && sp.segmentId) {
        const targetSeg = segByRef.get(sp.segmentId);
        if (targetSeg) {
          q = flowMap[targetSeg.uid || targetSeg.id] || (targetSeg.id ? flowMap[targetSeg.id] : 0) || 0;
        }
      }
      const res = calcSpecialAeraulics(sp, q, rho, nu);
      return { sp, flow_m3h: q, res };
    });

    const dp_speciali_generali = specResults
      .filter(r => r.sp.position === 'general')
      .reduce((s, r) => s + r.res.dp_tot_Pa, 0);

    // 4. Tracciamento dei Percorsi da ogni Bocchetta (Source) verso Valle e identificazione Percorso Più Sfavorevole
    interface PathTrace {
      sourceId: string;
      sourceName: string;
      sourceFlow_m3h: number;
      segmentIds: string[];
      segmentUids: string[];
      dp_bocchetta: number;
      dp_tratti: number;
      dp_speciali_locali: number;
      dp_tot_path: number;
    }

    const paths: PathTrace[] = [];
    const sourceSegments = data.segments.filter(s => s.type === 'source');

    sourceSegments.forEach(src => {
      const pathSegIds: string[] = [];
      const pathSegUids: string[] = [];
      let currSeg: AeraulicSegment | null = src;
      const visited = new Set<string>();

      while (currSeg && !visited.has(currSeg.uid || currSeg.id)) {
        visited.add(currSeg.uid || currSeg.id);
        pathSegIds.push(currSeg.id);
        pathSegUids.push(currSeg.uid || currSeg.id);
        if (!currSeg.confluisceInId) break;
        currSeg = segByRef.get(currSeg.confluisceInId) || null;
      }

      let dp_tratti_path = 0;
      pathSegUids.forEach(ref => {
        const sr = segResultsMap.get(ref);
        if (sr) dp_tratti_path += sr.res.dp_tot_Pa;
      });

      let dp_spec_locali = 0;
      specResults.forEach(sr => {
        if (sr.sp.position === 'segment' && sr.sp.segmentId) {
          const targetSeg = segByRef.get(sr.sp.segmentId);
          const targetKey = targetSeg ? (targetSeg.uid || targetSeg.id) : sr.sp.segmentId;
          if (pathSegUids.includes(targetKey)) {
            dp_spec_locali += sr.res.dp_tot_Pa;
          }
        }
      });

      const dp_bocch = parseItalianNumber(src.dp_bocchetta_Pa) || dp_bocchetta_def;
      const dp_tot = dp_bocch + dp_tratti_path + dp_spec_locali + dp_speciali_generali;

      paths.push({
        sourceId: src.id,
        sourceName: src.name || src.id,
        sourceFlow_m3h: parseItalianNumber(src.Q_custom_m3h) || 0,
        segmentIds: pathSegIds,
        segmentUids: pathSegUids,
        dp_bocchetta: dp_bocch,
        dp_tratti: dp_tratti_path,
        dp_speciali_locali: dp_spec_locali,
        dp_tot_path: dp_tot,
      });
    });

    let criticalPath: PathTrace | null = null;
    if (paths.length > 0) {
      criticalPath = paths.reduce((max, p) => p.dp_tot_path > max.dp_tot_path ? p : max, paths[0]);
    }

    const dp_sfavorevole_aspirazione = criticalPath ? criticalPath.dp_tot_path : 0;

    // Calcolo perdite del Camino di Espulsione (Mandata a valle del ventilatore)
    const chimneyRes = calcChimneyAeraulics(data.chimney, totalFlow_m3h, rho, nu);

    // Prevalenza Totale Ventilatore = Depressione aspirazione ramo sfavorevole + Contropressione mandata camino
    const dp_tot_ventilatore = dp_sfavorevole_aspirazione + chimneyRes.dp_tot_Pa;
    const dp_mmH2O = dp_tot_ventilatore / 9.80665;

    const criticalSegmentIds = new Set<string>();
    if (criticalPath) {
      criticalPath.segmentIds.forEach(id => criticalSegmentIds.add(id));
      criticalPath.segmentUids.forEach(uid => criticalSegmentIds.add(uid));
    }

    // 5. Dimensionamento Potenza Ventilatore & Motore Elettrico
    const Q_m3s = totalFlow_m3h / 3600;
    const P_aria_W = eta > 0 ? (Q_m3s * dp_tot_ventilatore) / eta : 0;
    const P_aria_kW = P_aria_W / 1000;

    const P_prog_tot_kW = P_aria_kW * (1 + margine_perc / 100);

    const n_tit = Math.max(1, g.n_titolari);
    const n_ris = Math.max(0, g.n_riserva);
    const P_singolo_teorica_kW = P_aria_kW / n_tit;
    const P_singolo_prog_kW = P_prog_tot_kW / n_tit;

    const taglia_IEC_consigliata = getTagliaIEC(P_singolo_prog_kW);

    const isCustomMotor = g.motore_tipo_scelta === 'custom';
    const parsedCustomkW = isCustomMotor ? parseItalianNumber(g.motore_custom_kW || '') : 0;

    let taglia_IEC_effettiva: number;
    let isCustomEffettivo = false;

    if (isCustomMotor && parsedCustomkW > 0) {
      taglia_IEC_effettiva = parsedCustomkW;
      isCustomEffettivo = true;
    } else if (g.taglia_IEC_installata !== null && g.taglia_IEC_installata > 0) {
      taglia_IEC_effettiva = g.taglia_IEC_installata;
    } else {
      taglia_IEC_effettiva = taglia_IEC_consigliata;
    }

    const P_tot_installata_kW = taglia_IEC_effettiva * (n_tit + n_ris);
    const coeff_sicurezza_effettivo = P_singolo_teorica_kW > 0
      ? (taglia_IEC_effettiva / P_singolo_teorica_kW)
      : 1;

    return {
      rho, nu,
      totalFlow_m3h,
      Q_m3s,
      flowMap,
      segResults,
      specResults,
      dp_speciali_generali,
      chimneyRes,
      dp_sfavorevole_aspirazione,
      paths,
      criticalPath,
      criticalSegmentIds,
      dp_tot_ventilatore,
      dp_mmH2O,
      P_aria_kW,
      P_prog_tot_kW,
      P_singolo_teorica_kW,
      P_singolo_prog_kW,
      taglia_IEC_consigliata,
      taglia_IEC_effettiva,
      isCustomMotor: isCustomEffettivo,
      P_tot_installata_kW,
      coeff_sicurezza_effettivo,
      eta,
      margine_perc,
      hasEta,
      hasT,
      hasQuota,
      hasMargine,
    };
  }, [data]);

  // Nodi formattati per lo Schema Topologico
  const treeNodes: AeraulicTreeNode[] = useMemo(() => {
    return data.segments.map(seg => {
      const segRes = calc.segResults.find(r => (r.seg.uid && seg.uid) ? r.seg.uid === seg.uid : r.seg.id === seg.id);
      return {
        uid: seg.uid,
        id: seg.id,
        name: seg.name,
        type: seg.type,
        flow_m3h: segRes?.flow_m3h || 0,
        v_ms: segRes?.res.v_ms || 0,
        dp_Pa: segRes?.res.dp_tot_Pa || 0,
        D_mm: seg.D_mm,
        L_m: seg.L_m,
        confluisceInId: seg.confluisceInId,
        isCritical: (seg.uid && calc.criticalSegmentIds.has(seg.uid)) || calc.criticalSegmentIds.has(seg.id),
      };
    });
  }, [data.segments, calc.segResults, calc.criticalSegmentIds]);

  const chimneyNode: AeraulicChimneyNode | undefined = useMemo(() => {
    if (!data.chimney?.enabled) return undefined;
    return {
      enabled: true,
      name: data.chimney.name || 'Camino E1',
      D_mm: data.chimney.D_mm,
      H_m: data.chimney.H_m,
      dp_Pa: calc.chimneyRes.dp_tot_Pa,
      v_ms: calc.chimneyRes.v_ms,
    };
  }, [data.chimney, calc.chimneyRes]);

  // ── Cloud save/load & Normalizzazione ───────────────────────────────────────
  const getCloudSaveData = () => ({ aspiratore: data });
  const handleLoadCloudProject = (loadedData: any) => {
    if (loadedData?.aspiratore) {
      const normalized = normalizeFanData(loadedData.aspiratore);
      // Requisito: mostra subito la Fase 1 (Configurazione & Aria) con i dati inseriti
      setData({
        ...normalized,
        activeTab: 'config',
      });
    }
  };

  // Garantisce che un tab valido sia SEMPRE attivo (fallback su 'config')
  const currentTab = (data.activeTab === 'rete' || data.activeTab === 'risultati') ? data.activeTab : 'config';

  const tabs: { key: FanToolData['activeTab']; step: number; label: string; icon: React.ReactNode }[] = [
    { key: 'config', step: 1, label: 'Configurazione & Aria', icon: <Wind className="w-4 h-4" /> },
    { key: 'rete', step: 2, label: 'Rete Aeraulica & Trattamento', icon: <GitFork className="w-4 h-4" /> },
    { key: 'risultati', step: 3, label: 'Risultati & Ventilatore', icon: <Gauge className="w-4 h-4" /> },
  ];

  return (
    <>
    {/* Gestore salvataggi Progetto */}
    <div className="print:hidden mb-6">
      <ProjectStorage
        toolType="aspiratore"
        currentData={getCloudSaveData()}
        onLoadProject={handleLoadCloudProject}
        projectInfo={projectData}
        setProjectInfo={setProjectData}
      />
    </div>

    {/* ProjectHeader sempre visibile a video e in stampa con codice documento */}
    <ProjectHeader
      pData={projectData}
      setPData={setProjectData}
      title="Aspiratore / Ventilatore Industriale"
      setAppMode={setAppMode}
      docCode="M_4.4.6_E4_Term_00"
    />

    <div className="print:hidden space-y-6 pb-12">

      {/* Stepper Navigation a 3 schede */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {tabs.map(t => {
            const isActive = currentTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setData(prev => ({ ...prev, activeTab: t.key }))}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  isActive
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/25'
                    : 'bg-slate-50 hover:bg-cyan-50 text-slate-600 hover:text-cyan-700 border border-slate-100'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                  isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}>
                  {t.step}
                </div>
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-wider opacity-70">Fase {t.step}</p>
                  <p className="text-xs font-bold leading-none">{t.label}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: CONFIGURAZIONE & CONDIZIONI ARIA
         ══════════════════════════════════════════════════════════════════════ */}
      {currentTab === 'config' && (
        <div className="space-y-6">
          {/* Box Informativo: Guida alla Compilazione dei Parametri di Progetto */}
          <div className="bg-gradient-to-r from-sky-50 via-cyan-50 to-slate-50 border border-cyan-200/80 rounded-2xl p-4.5 text-xs text-slate-700 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-cyan-600 text-white rounded-xl flex-shrink-0 shadow-sm mt-0.5">
                <Info className="w-4 h-4" />
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-black text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                    Guida alla Compilazione: Parametri Ambientali & Specifiche Ventilatore
                  </h4>
                  <span className="text-[10px] font-bold text-cyan-700 bg-cyan-100/70 px-2 py-0.5 rounded-md border border-cyan-200">
                    Standard UNI EN ISO 5801 & ICAO
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Questa prima fase definisce le condizioni termo-igrometriche dell'aria aspirata e le caratteristiche operative del gruppo di ventilazione. Le impostazioni determinano la densità effettiva del fluido e la potenza richiesta all'albero:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                  <div className="bg-white/95 p-3 rounded-xl border border-cyan-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-cyan-800 uppercase block mb-1">Temperatura & Quota:</span>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      Calcolano la densità reale <span className="font-mono font-bold text-slate-700">ρ [kg/m³]</span>. Con aria calda o ad alta quota il fluido è più rarefatto: la portata volumetrica [m³/h] resta invariata, ma calano la prevalenza e la potenza assorbita.
                    </p>
                  </div>
                  <div className="bg-white/95 p-3 rounded-xl border border-cyan-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-cyan-800 uppercase block mb-1">Depressione Bocchette:</span>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      Depressione statica minima necessaria all'imbocco per creare la velocità di cattura dei fumi. <span className="font-semibold text-slate-700">150–250 Pa</span> per cappe aspiranti aperte; <span className="font-semibold text-slate-700">250–400 Pa</span> per bottali e macchinari chiusi.
                    </p>
                  </div>
                  <div className="bg-white/95 p-3 rounded-xl border border-cyan-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-cyan-800 uppercase block mb-1">Rendimento Ventilatore η:</span>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      Efficienza pneumatica complessiva. Ventilatori centrifughi a pale rovesce (rendimento elevato): <span className="font-semibold text-slate-700">60–75%</span>; ventilatori industriali standard a pale avanti o radiali: <span className="font-semibold text-slate-700">50–55%</span>.
                    </p>
                  </div>
                  <div className="bg-white/95 p-3 rounded-xl border border-cyan-100 shadow-2xs">
                    <span className="text-[10px] font-bold text-cyan-800 uppercase block mb-1">Margine Motore & Titolari:</span>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      Ricarico di sicurezza (es. +15% o +20%) per sporcamento filtri o future estensioni. L'architettura N+R (titolari + riserva) assicura continuità di servizio in caso di avaria.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-black text-slate-800 mb-5 pb-3 border-b border-slate-100 flex items-center gap-2">
              <span className="p-1.5 bg-cyan-100 text-cyan-600 rounded-lg"><Wind className="w-4 h-4" /></span>
              Parametri Ambientali e Specifiche Ventilatore
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <ItalianNumberInput
                  label="Temperatura aria ambiente"
                  value={data.global.T_aria_C}
                  onChange={raw => updGlobal('T_aria_C', raw)}
                  placeholder="es. 20"
                  unit="°C"
                  allowNegative={true}
                />
                <p className="text-[10px] text-slate-400 mt-1 ml-1">Tipico: 15 ÷ 25 °C per aria ambiente standard</p>
              </div>

              <div>
                <ItalianNumberInput
                  label="Quota impianto"
                  value={data.global.quota_m}
                  onChange={raw => updGlobal('quota_m', raw)}
                  placeholder="es. 0"
                  unit="m s.l.m."
                />
                <p className="text-[10px] text-slate-400 mt-1 ml-1">Influisce sulla pressione barometrica e densità</p>
              </div>

              <div>
                <ItalianNumberInput
                  label="Depressione standard alle bocchette"
                  value={data.global.dp_bocchetta_default_Pa}
                  onChange={raw => updGlobal('dp_bocchetta_default_Pa', raw)}
                  placeholder="es. 250"
                  unit="Pa"
                />
                <p className="text-[10px] text-slate-400 mt-1 ml-1">Depressione minima richiesta per la cattura fumi</p>
              </div>

              <div>
                <ItalianNumberInput
                  label="Rendimento ventilatore η"
                  value={data.global.eta_ventilatore_perc}
                  onChange={raw => updGlobal('eta_ventilatore_perc', raw)}
                  placeholder="es. 55"
                  unit="%"
                />
                <p className="text-[10px] text-slate-400 mt-1 ml-1">Tipico: 50% ÷ 75% per ventilatori centrifughi</p>
              </div>

              <div>
                <ItalianNumberInput
                  label="Margine di sicurezza potenza motore"
                  value={data.global.margine_motore_perc}
                  onChange={raw => updGlobal('margine_motore_perc', raw)}
                  placeholder="es. 20"
                  unit="%"
                />
                <p className="text-[10px] text-slate-400 mt-1 ml-1">Sovradimensionamento per future estensioni o perdite</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Ventilatori titolari
                  </label>
                  <select
                    value={data.global.n_titolari}
                    onChange={e => updGlobal('n_titolari', parseInt(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-400/20"
                  >
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} in servizio</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Di riserva
                  </label>
                  <select
                    value={data.global.n_riserva}
                    onChange={e => updGlobal('n_riserva', parseInt(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-400/20"
                  >
                    {[0, 1, 2].map(n => <option key={n} value={n}>{n} riserva</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Riepilogo proprietà fisiche aria */}
            {calc && (
              <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Densità aria ρ</p>
                  <p className="text-sm font-black text-slate-800 mt-0.5">
                    {calc.hasT ? (
                      <>{formatNumber(calc.rho, 4)} <span className="text-[10px] font-normal text-slate-500">kg/m³</span></>
                    ) : (
                      <span className="text-slate-400 font-medium text-xs">— (std: {formatNumber(calc.rho, 4)})</span>
                    )}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Viscosità cinematica ν</p>
                  <p className="text-sm font-black text-slate-800 mt-0.5">
                    {calc.hasT ? (
                      <>{formatNumber(calc.nu * 1e6, 2)} <span className="text-[10px] font-normal text-slate-500">×10⁻⁶ m²/s</span></>
                    ) : (
                      <span className="text-slate-400 font-medium text-xs">— (std: {formatNumber(calc.nu * 1e6, 2)})</span>
                    )}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Configurazione</p>
                  <p className="text-sm font-black text-cyan-700 mt-0.5">{data.global.n_titolari}+{data.global.n_riserva} <span className="text-[10px] font-normal text-slate-500">ventilatori</span></p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Rendimento scelto</p>
                  <p className="text-sm font-black text-slate-800 mt-0.5">
                    {calc.hasEta ? (
                      <>{data.global.eta_ventilatore_perc} <span className="text-[10px] font-normal text-slate-500">%</span></>
                    ) : (
                      <span className="text-slate-400 font-medium text-xs">— Non specificato</span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Barra di Navigazione inferiore Tab 1 */}
          <div className="flex justify-end">
            <button
              onClick={() => setData(prev => ({ ...prev, activeTab: 'rete' }))}
              className="flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-cyan-500/25 cursor-pointer active:scale-95"
            >
              <span>Procedi a Rete Aeraulica & Trattamento</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: RETE AERAULICA (ALBERO DA MONTE A VALLE) & COMPONENTI
         ══════════════════════════════════════════════════════════════════════ */}
      {currentTab === 'rete' && (
        <div className="space-y-6">

          {/* Box Informativo: Guida alla Progettazione della Rete Aeraulica & Criteri di Velocità */}
          <div className="bg-gradient-to-r from-sky-50 via-cyan-50 to-slate-50 border border-cyan-200/80 rounded-2xl p-4.5 text-xs text-slate-700 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-cyan-600 text-white rounded-xl flex-shrink-0 shadow-sm mt-0.5">
                <Network className="w-4 h-4" />
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-black text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                    Guida alla Progettazione: Rete ad Albero da Monte a Valle
                  </h4>
                  <span className="text-[10px] font-bold text-cyan-700 bg-cyan-100/70 px-2 py-0.5 rounded-md border border-cyan-200">
                    Modellazione Topologica & Bilancio Prevalenze
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  L'impianto aeraulico è una rete ramificata convergente: ciascun ramo parte da una <strong>Bocchetta di Captazione</strong> e si unisce ai <strong>Collettori di Confluenza</strong> fino al ventilatore. Il software calcola in automatico le portate affluenti e isola il <strong>percorso più sfavorevole</strong> che impone la prevalenza totale:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                  <div className="bg-white/95 p-3 rounded-xl border border-emerald-200 shadow-2xs">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[10px] uppercase mb-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      10 ÷ 18 m/s: Velocità Ottimale
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      Range raccomandato per fumi e vapori industriali. Assicura il trascinamento continuo evitando depositi nelle tubazioni orizzontali, con perdite di carico e rumorosità contenute.
                    </p>
                  </div>
                  <div className="bg-white/95 p-3 rounded-xl border border-amber-200 shadow-2xs">
                    <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[10px] uppercase mb-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      &lt; 10 m/s: Rischio Deposito / Condensa
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      Condotta sovradimensionata: l'aria rallenta provocando potenziale sedimentazione di polveri, ristagni di condensa e maggiori costi di canalizzazione. Si suggerisce di ridurre il diametro Ø.
                    </p>
                  </div>
                  <div className="bg-white/95 p-3 rounded-xl border border-red-200 shadow-2xs">
                    <div className="flex items-center gap-1.5 text-red-800 font-bold text-[10px] uppercase mb-1">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      &gt; 20 m/s: Alta Perdita & Sibilo
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      Condotta sottodimensionata: le perdite di carico aumentano quadraticamente con la velocità (ΔP ∝ v²), richiedendo motori molto più potenti e generando rumorosità molesta.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SCHEMA TOPOLOGICO GRAFICO DELLA RETE AERAULICA */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-cyan-100 text-cyan-700 rounded-lg">
                  <Network className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">Schema Topologico Rete Aeraulica</h3>
                  <p className="text-[11px] text-slate-400">Rappresentazione grafica istantanea del flusso dalle bocchette al ventilatore</p>
                </div>
              </div>
            </div>

            <div className="animate-fadeIn">
              <AeraulicTopologicalTree
                segments={treeNodes}
                specials={calc.specResults.map(r => ({
                  id: r.sp.id,
                  name: r.sp.name,
                  type: r.sp.type,
                  dp_Pa: r.res.dp_tot_Pa,
                  position: r.sp.position,
                  segmentId: r.sp.segmentId,
                }))}
                chimney={chimneyNode}
                totalFlow_m3h={calc.totalFlow_m3h}
                dp_tot_ventilatore={calc.dp_tot_ventilatore}
                selectedSegmentId={selectedSegmentUid}
                onSelectSegment={ref => {
                  const found = data.segments.find(s => (s.uid && s.uid === ref) || s.id === ref);
                  if (found) setSelectedSegmentUid(found.uid);
                }}
                fanPower_kW={calc.taglia_IEC_effettiva}
              />
            </div>
          </div>

          {/* Elenco e Gestione Tratti Condotta (Master-Detail Focus) */}
          {(() => {
            const activeSegment = (selectedSegmentUid && data.segments.find(s => s.uid === selectedSegmentUid))
              ? data.segments.find(s => s.uid === selectedSegmentUid)!
              : data.segments[0] || null;
            const activeIndex = activeSegment ? data.segments.findIndex(s => s.uid === activeSegment.uid) : -1;
            const prevSegment = activeIndex > 0 ? data.segments[activeIndex - 1] : null;
            const nextSegment = activeIndex >= 0 && activeIndex < data.segments.length - 1 ? data.segments[activeIndex + 1] : null;

            function renderSegmentCard(seg: AeraulicSegment, isSingleFocus = false) {
              const segUid = seg.uid || seg.id;
              const segRes = calc.segResults.find(r => (r.seg.uid && seg.uid) ? r.seg.uid === seg.uid : r.seg.id === seg.id);
              const isCritical = (seg.uid && calc.criticalSegmentIds.has(seg.uid)) || calc.criticalSegmentIds.has(seg.id);
              const isSelectedInTree = (seg.uid && selectedSegmentUid === seg.uid) || selectedSegmentUid === seg.id;
              const velocity = segRes?.res.v_ms || 0;
              
              const vOk = velocity >= 10 && velocity <= 18;
              const vWarn = (velocity >= 6 && velocity < 10) || (velocity > 18 && velocity <= 22);
              const vBad = (velocity > 0 && velocity < 6) || velocity > 22;

              const safeAccessories: DuctAccessories = seg.accessories || defaultAccessories();
              const isDuplicateId = data.segments.filter(s => s.id.trim().toUpperCase() === seg.id.trim().toUpperCase()).length > 1;

              return (
                <div
                  key={segUid}
                  id={`segment-card-${seg.id}`}
                  className={`border rounded-2xl p-5 transition-all ${
                    isSelectedInTree || isSingleFocus
                      ? 'border-cyan-500 bg-white shadow-md ring-2 ring-cyan-400/30'
                      : isCritical
                      ? 'border-amber-300 bg-amber-50/20 shadow-sm ring-1 ring-amber-300/60'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {/* Intestazione del Tratto */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="px-3 py-1 bg-slate-800 text-white font-black text-xs rounded-lg tracking-wide shadow-sm">
                        {seg.id}
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
                        seg.type === 'source' ? 'bg-cyan-50 text-cyan-800 border-cyan-200' : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                      }`}>
                        {seg.type === 'source' ? '📍 Bocchetta di Captazione' : '🔀 Collettore di Confluenza'}
                      </span>
                      {isCritical && (
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 font-black text-[10px] rounded-md border border-amber-300 flex items-center gap-1 shadow-sm">
                          <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                          PIÙ SFAVOREVOLE
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {segRes && segRes.flow_m3h > 0 && (
                        <div className="flex items-center gap-2 mr-2">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                            vOk ? 'bg-emerald-100 text-emerald-800' :
                            vWarn ? 'bg-amber-100 text-amber-800' :
                            vBad ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            v = {formatNumber(velocity, 2)} m/s
                          </span>
                          <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                            ΔP = {formatNumber(segRes.res.dp_tot_Pa, 1)} Pa
                          </span>
                        </div>
                      )}

                      {seg.type === 'junction' && (
                        <button
                          type="button"
                          onClick={() => addBranchToCollector(seg.id)}
                          title={`Aggiungi nuova bocchetta che confluisce direttamente in ${seg.id}`}
                          className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Aggiungi Ramo</span>
                        </button>
                      )}


                      <button
                        type="button"
                        onClick={() => duplicateSegment(segUid)}
                        title="Duplica questo tratto (clona geometria, accessori e confluenza)"
                        className="w-7 h-7 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {data.segments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSegment(segUid)}
                          title="Elimina questo tratto"
                          className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* SELETTORE RUOLO FUNZIONALE: Bocchetta vs Collettore */}
                  <div className="mb-4">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                      Ruolo Funzionale del Tratto:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => updSegment(segUid, 'type', 'source')}
                        className={`flex items-start gap-2.5 p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          seg.type === 'source'
                            ? 'bg-cyan-50/90 border-cyan-500 ring-2 ring-cyan-400/25 text-cyan-950 shadow-sm'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg flex-shrink-0 ${
                          seg.type === 'source' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-white text-slate-400 border border-slate-200'
                        }`}>
                          <Wind className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-black leading-tight">📍 Bocchetta di Captazione (Inizio Ramo)</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                            Punto iniziale dove si aspira l'aria. Inserisci la portata di processo Q [m³/h] da estrarre.
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => updSegment(segUid, 'type', 'junction')}
                        className={`flex items-start gap-2.5 p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          seg.type === 'junction'
                            ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-400/25 text-indigo-950 shadow-sm'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg flex-shrink-0 ${
                          seg.type === 'junction' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-400 border border-slate-200'
                        }`}>
                          <GitFork className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-black leading-tight">🔀 Collettore di Confluenza (Unione Rami)</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                            Condotto che raccoglie l'aria da altri rami a monte. La portata viene calcolata sommando i rami affluenti.
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Griglia Campi Principali */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
                    {/* ID Tratto */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Codice tratta</label>
                        {isDuplicateId && (
                          <span className="text-[9px] font-black text-amber-600 uppercase tracking-tight">⚠️ Duplicato</span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={seg.id}
                        onChange={e => updSegmentId(segUid, e.target.value)}
                        placeholder="es. L1"
                        className={`w-full bg-white border rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none transition-colors ${
                          isDuplicateId ? 'border-amber-400 focus:border-amber-500 bg-amber-50/30 ring-1 ring-amber-300' : 'border-slate-200 focus:border-cyan-500'
                        }`}
                      />
                    </div>

                    {/* Utenza / Macchinario Collegato (Opzionale) */}
                    <div className="lg:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                        Utenza / Macchinario Collegato <span className="text-slate-400 font-normal lowercase">(opzionale)</span>
                      </label>
                      <input
                        type="text"
                        value={seg.name || ''}
                        onChange={e => updSegment(segUid, 'name', e.target.value)}
                        placeholder="es. Bottale B1, Cappa 1..."
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    {/* Gestione Portata / Confluenza */}
                    {seg.type === 'source' ? (
                      <div>
                        <ItalianNumberInput
                          label="Portata aspirata Q"
                          value={seg.Q_custom_m3h}
                          onChange={raw => updSegment(segUid, 'Q_custom_m3h', raw)}
                          placeholder="es. 4.000"
                          unit="m³/h"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-700 uppercase tracking-wide mb-1">Portata a Monte</label>
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs font-bold text-indigo-900">
                          {formatNumber(segRes?.flow_m3h || 0, 0)} m³/h
                        </div>
                      </div>
                    )}

                    {/* Confluisce in (Destinazione a Valle) */}
                    <div className="lg:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                        Dove scarica l'aria questo condotto?
                      </label>
                      {(() => {
                        const currentTarget = data.segments.find(s => (s.uid && s.uid === seg.confluisceInId) || s.id === seg.confluisceInId);
                        const selectedVal = currentTarget ? (currentTarget.uid || currentTarget.id) : (seg.confluisceInId || '');

                        // Mostra solo Collettori ('junction'), escludendo se stesso e rami che formerebbero cicli
                        const availableCollectors = data.segments.filter(other => {
                          const isSelf = (other.uid && seg.uid) ? other.uid === seg.uid : other.id === seg.id;
                          if (isSelf) return false;
                          const isCurrent = currentTarget ? (other.uid === currentTarget.uid || other.id === currentTarget.id) : false;
                          const isCollector = other.type === 'junction' || isCurrent;
                          if (!isCollector) return false;
                          if (wouldCreateCycle(seg.uid || seg.id, other.uid || other.id, data.segments)) return false;
                          return true;
                        });

                        return (
                          <select
                            value={selectedVal}
                            onChange={e => updSegment(segUid, 'confluisceInId', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-cyan-500"
                          >
                            <option value="">🏁 Tratto Finale ➔ Verso Ventilatore / Trattamento</option>
                            {availableCollectors.length === 0 ? (
                              <option value="" disabled className="text-slate-400">
                                (Nessun altro collettore presente nella rete)
                              </option>
                            ) : (
                              availableCollectors.map(other => {
                                const optVal = other.uid || other.id;
                                return (
                                  <option key={optVal} value={optVal}>
                                    ↳ Confluisce nel Collettore {other.id} {other.name ? `(${other.name})` : ''}
                                  </option>
                                );
                              })
                            )}
                          </select>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Parametri Geometrici Condotta */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-3 pt-3 border-t border-slate-100">
                    <div>
                      <ItalianNumberInput
                        label="Diametro interno Ø"
                        value={seg.D_mm}
                        onChange={raw => updSegment(segUid, 'D_mm', raw)}
                        placeholder="es. 250"
                        unit="mm"
                      />
                    </div>

                    <div>
                      <ItalianNumberInput
                        label="Lunghezza lineare L"
                        value={seg.L_m}
                        onChange={raw => updSegment(segUid, 'L_m', raw)}
                        placeholder="es. 15"
                        unit="m"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Materiale</label>
                      <select
                        value={seg.material}
                        onChange={e => updSegment(segUid, 'material', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-cyan-500"
                      >
                        {Object.keys(FAN_ROUGHNESS).map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>

                    <div>
                      <ItalianNumberInput
                        label="Scabrezza parete ε"
                        value={seg.roughness_mm}
                        onChange={raw => updSegment(segUid, 'roughness_mm', raw)}
                        placeholder="es. 0,02"
                        unit="mm"
                      />
                    </div>
                  </div>

                  {/* Accessori e Pezzi Speciali */}
                  <div className="mt-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <button
                        type="button"
                        onClick={() => toggleAccessoryCollapse(segUid)}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-cyan-700 cursor-pointer select-none"
                      >
                        {collapsedAccessoryIds[segUid] ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-cyan-600" />}
                        <span>Accessori & Raccordi di Linea (Gomiti, Biforcazioni, Riduzioni...)</span>
                      </button>

                      {segRes && segRes.res.L_eq_tot_m > 0 ? (
                        <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200">
                          Leq tot = {formatNumber(segRes.res.L_eq_tot_m, 1)} m (ΔP = {formatNumber(segRes.res.dp_conc_Pa, 1)} Pa)
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Nessun accessorio (Leq = 0 m)</span>
                      )}
                    </div>

                    {!collapsedAccessoryIds[segUid] && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Quantità pezzi speciali montati:</p>
                        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
                          {[
                            { field: 'n_gomiti90_R15' as const, label: 'Gomito 90° R1.5' },
                            { field: 'n_gomiti90_R2'  as const, label: 'Gomito 90° R2' },
                            { field: 'n_gomiti45'     as const, label: 'Gomito 45°' },
                            { field: 'n_bif_principale' as const, label: 'Bif. princ.' },
                            { field: 'n_bif_laterale' as const, label: 'Bif. lat.' },
                            { field: 'n_rid_exp'      as const, label: 'Rid. espans.' },
                            { field: 'n_rid_cont'     as const, label: 'Rid. contr.' },
                            { field: 'n_valvole'      as const, label: 'Valvole' },
                            { field: 'n_ingresso'     as const, label: 'Ingressi' },
                            { field: 'n_uscita'       as const, label: 'Uscite' },
                          ].map(({ field, label }) => {
                            const val = safeAccessories[field] || 0;

                            return (
                              <div key={field}>
                                <label className="block text-[9px] font-bold text-slate-500 mb-0.5 truncate" title={label}>{label}</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={val === 0 ? '' : val}
                                  onChange={e => updSegmentAccessory(segUid, field, parseInt(e.target.value) || 0)}
                                  placeholder="0"
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center font-bold text-slate-800 focus:outline-none focus:border-cyan-500"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 flex-wrap gap-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                      <span className="p-1.5 bg-cyan-100 text-cyan-600 rounded-lg"><Wind className="w-4 h-4" /></span>
                      Configurazione Tratti Condotta ({data.segments.length} tratti)
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Modifica i parametri del condotto selezionato o usa la navigazione rapida tra rami
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Toggle Vista: Focalizzata vs Tutte le Tratte */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                      <button
                        type="button"
                        onClick={() => setSegmentsViewMode('focused')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                          segmentsViewMode === 'focused' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Tratta Attiva
                      </button>
                      <button
                        type="button"
                        onClick={() => setSegmentsViewMode('all')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                          segmentsViewMode === 'all' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Tutte le Tratte ({data.segments.length})
                      </button>
                    </div>

                    <button
                      onClick={addSegment}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Aggiungi Tratto</span>
                    </button>
                  </div>
                </div>

                {/* Navigatore Rapido a Pillole (attivo in modalità focalizzata) */}
                {segmentsViewMode === 'focused' && data.segments.length > 0 && (
                  <div className="mb-4 pb-3 border-b border-slate-100 flex items-center gap-2 justify-between flex-wrap">
                    <div
                      className="flex items-center gap-2 overflow-x-auto pb-2 pt-7 max-w-full scrollbar-thin"
                      onDragOver={e => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={e => {
                        e.preventDefault();
                        if (draggedSegmentIndex !== null && dropTarget) {
                          dropSegmentAt(draggedSegmentIndex, dropTarget.index, dropTarget.position);
                        }
                        setDraggedSegmentIndex(null);
                        setDropTarget(null);
                      }}
                    >
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mr-1 select-none whitespace-nowrap">
                        Tratta:
                      </span>
                      {data.segments.map((s, idx) => {
                        const isAct = activeSegment ? (s.uid === activeSegment.uid) : false;
                        const isCrit = (s.uid && calc.criticalSegmentIds.has(s.uid)) || calc.criticalSegmentIds.has(s.id);
                        const isDragging = draggedSegmentIndex === idx;

                        const isNoOp = draggedSegmentIndex === null || draggedSegmentIndex === idx;
                        const showBeforeIndicator = dropTarget?.index === idx && dropTarget?.position === 'before' && !isNoOp;
                        const showAfterIndicator = dropTarget?.index === idx && dropTarget?.position === 'after' && !isNoOp;

                        return (
                          <div
                            key={s.uid || s.id}
                            className="relative flex items-center shrink-0"
                          >
                            {/* Indicatore visivo PRIMA della pillola (absolute: nessun layout shift) */}
                            {showBeforeIndicator && (
                              <div className="absolute -left-1.5 top-0 bottom-0 w-1 bg-cyan-500 rounded-full shadow-lg shadow-cyan-500/50 z-30 pointer-events-none animate-pulse">
                                <div className="absolute -top-1 -left-1 w-3 h-3 bg-cyan-500 rounded-full" />
                                <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-cyan-500 rounded-full" />
                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-cyan-700 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                                  Prima di {s.id}
                                </span>
                              </div>
                            )}

                            <button
                              type="button"
                              draggable
                              onDragStart={e => {
                                e.dataTransfer.setData('text/plain', String(idx));
                                e.dataTransfer.effectAllowed = 'move';
                                setDraggedSegmentIndex(idx);
                              }}
                              onDragOver={e => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                if (draggedSegmentIndex === null) return;
                                const rect = e.currentTarget.getBoundingClientRect();
                                const isLeftHalf = (e.clientX - rect.left) < rect.width / 2;
                                const target = computeDropTarget(draggedSegmentIndex, idx, isLeftHalf);
                                if (target && (!dropTarget || dropTarget.index !== target.index || dropTarget.position !== target.position)) {
                                  setDropTarget(target);
                                }
                              }}
                              onDrop={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (draggedSegmentIndex !== null) {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const isLeftHalf = (e.clientX - rect.left) < rect.width / 2;
                                  const target = computeDropTarget(draggedSegmentIndex, idx, isLeftHalf) || dropTarget;
                                  if (target) {
                                    dropSegmentAt(draggedSegmentIndex, target.index, target.position);
                                  }
                                }
                                setDraggedSegmentIndex(null);
                                setDropTarget(null);
                              }}
                              onDragEnd={() => {
                                setDraggedSegmentIndex(null);
                                setDropTarget(null);
                              }}
                              onClick={() => setSelectedSegmentUid(s.uid)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-grab active:cursor-grabbing whitespace-nowrap select-none ${
                                isDragging ? 'opacity-30 scale-95 ring-2 ring-dashed ring-cyan-400' : ''
                              } ${
                                isAct
                                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20 ring-2 ring-cyan-500 scale-105'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              } ${
                                showBeforeIndicator || showAfterIndicator ? 'ring-2 ring-cyan-400' : ''
                              }`}
                            >
                              <GripVertical className={`w-3.5 h-3.5 -ml-1 text-slate-400 group-hover:text-slate-600 transition-colors ${
                                isAct ? 'text-cyan-200 group-hover:text-white' : ''
                              }`} />
                              <span className="font-black">{s.id}</span>
                              <span className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                                isAct ? 'bg-cyan-700 text-cyan-100' : 'bg-slate-200 text-slate-600'
                              }`}>
                                {s.type === 'source' ? 'Bocchetta' : 'Collettore'}
                              </span>
                              {isCrit && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
                            </button>

                            {/* Indicatore visivo DOPO la pillola (absolute: nessun layout shift) */}
                            {showAfterIndicator && (
                              <div className="absolute -right-1.5 top-0 bottom-0 w-1 bg-cyan-500 rounded-full shadow-lg shadow-cyan-500/50 z-30 pointer-events-none animate-pulse">
                                <div className="absolute -top-1 -left-1 w-3 h-3 bg-cyan-500 rounded-full" />
                                <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-cyan-500 rounded-full" />
                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-cyan-700 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                                  Dopo {s.id}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Drop Zone finale per posizionare in fondo */}
                      {draggedSegmentIndex !== null && (
                        <div
                          onDragOver={e => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (draggedSegmentIndex === data.segments.length - 1) return;
                            if (!dropTarget || dropTarget.index !== data.segments.length - 1 || dropTarget.position !== 'after') {
                              setDropTarget({ index: data.segments.length - 1, position: 'after' });
                            }
                          }}
                          onDrop={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (draggedSegmentIndex !== null && draggedSegmentIndex !== data.segments.length - 1) {
                              dropSegmentAt(draggedSegmentIndex, data.segments.length - 1, 'after');
                            }
                            setDraggedSegmentIndex(null);
                            setDropTarget(null);
                          }}
                          className={`px-3 py-1.5 rounded-xl border-2 border-dashed transition-all flex items-center gap-1 text-xs font-bold whitespace-nowrap cursor-pointer select-none shrink-0 ${
                            dropTarget?.index === data.segments.length - 1 && dropTarget?.position === 'after'
                              ? 'border-cyan-500 bg-cyan-100 text-cyan-800 scale-105 shadow-md ring-2 ring-cyan-400'
                              : 'border-slate-300 bg-slate-50 text-slate-400 hover:border-slate-400'
                          }`}
                        >
                          <span>+ In fondo</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        type="button"
                        disabled={!prevSegment}
                        onClick={() => prevSegment && setSelectedSegmentUid(prevSegment.uid)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title={prevSegment ? `Vai a ${prevSegment.id}` : 'Nessuna tratta precedente'}
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Prec.</span>
                      </button>
                      <button
                        type="button"
                        disabled={!nextSegment}
                        onClick={() => nextSegment && setSelectedSegmentUid(nextSegment.uid)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title={nextSegment ? `Vai a ${nextSegment.id}` : 'Nessuna tratta successiva'}
                      >
                        <span className="hidden sm:inline">Succ.</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Visualizzazione delle Tratte */}
                {data.segments.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                    <Wind className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-semibold mb-3">Nessuna tratta condotta presente nell'impianto.</p>
                    <button
                      onClick={addSegment}
                      className="px-4 py-2 bg-cyan-600 text-white font-bold text-xs rounded-xl hover:bg-cyan-700 transition-all cursor-pointer"
                    >
                      Aggiungi Prima Tratta
                    </button>
                  </div>
                ) : segmentsViewMode === 'focused' ? (
                  <div>
                    {activeSegment && renderSegmentCard(activeSegment, true)}

                    {/* Vista d'Insieme a Tabella Collassabile */}
                    <div className="mt-5 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                      <div
                        onClick={() => setShowOverviewTable(!showOverviewTable)}
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 shadow-sm">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-slate-800">
                              Vista d'Insieme di Tutte le Tratte ({data.segments.length} condotte)
                            </h4>
                            <p className="text-[10px] text-slate-500">
                              Tabella riepilogativa dell'intero impianto con navigazione e modifica con un clic
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-2.5 py-1 rounded-lg">
                            {showOverviewTable ? 'Nascondi Tabella' : 'Mostra Tabella'}
                          </span>
                          {showOverviewTable ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </div>
                      </div>

                      {showOverviewTable && (
                        <div className="p-4 pt-0 overflow-x-auto">
                          <table className="w-full text-left text-xs bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <thead className="bg-slate-100/80 text-slate-700 text-[10px] uppercase font-black border-b border-slate-200">
                              <tr>
                                <th className="p-2.5">ID</th>
                                <th className="p-2.5">Ruolo</th>
                                <th className="p-2.5">Utenza</th>
                                <th className="p-2.5">Confluenza</th>
                                <th className="p-2.5">Q [m³/h]</th>
                                <th className="p-2.5">Ø [mm]</th>
                                <th className="p-2.5">L [m]</th>
                                <th className="p-2.5">v [m/s]</th>
                                <th className="p-2.5">ΔP [Pa]</th>
                                <th className="p-2.5 text-right">Azioni</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {data.segments.map((seg, sIdx) => {
                                const isAct = activeSegment ? (seg.uid === activeSegment.uid) : false;
                                const res = calc.segResults.find(r => (r.seg.uid && seg.uid) ? r.seg.uid === seg.uid : r.seg.id === seg.id);
                                const vel = res?.res.v_ms || 0;
                                const vOk = vel >= 10 && vel <= 18;
                                const isRowDragging = draggedSegmentIndex === sIdx;
                                const isNoOpRow = draggedSegmentIndex === null || draggedSegmentIndex === sIdx;
                                const isRowBefore = dropTarget?.index === sIdx && dropTarget?.position === 'before' && !isNoOpRow;
                                const isRowAfter = dropTarget?.index === sIdx && dropTarget?.position === 'after' && !isNoOpRow;

                                return (
                                  <tr
                                    key={seg.uid || seg.id}
                                    draggable
                                    onDragStart={e => {
                                      setDraggedSegmentIndex(sIdx);
                                      e.dataTransfer.setData('text/plain', String(sIdx));
                                      e.dataTransfer.effectAllowed = 'move';
                                    }}
                                    onDragOver={e => {
                                      e.preventDefault();
                                      e.dataTransfer.dropEffect = 'move';
                                      if (draggedSegmentIndex === null) return;
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const isTopHalf = (e.clientY - rect.top) < rect.height / 2;
                                      const target = computeDropTarget(draggedSegmentIndex, sIdx, isTopHalf);
                                      if (target && (!dropTarget || dropTarget.index !== target.index || dropTarget.position !== target.position)) {
                                        setDropTarget(target);
                                      }
                                    }}
                                    onDrop={e => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (draggedSegmentIndex !== null) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const isTopHalf = (e.clientY - rect.top) < rect.height / 2;
                                        const target = computeDropTarget(draggedSegmentIndex, sIdx, isTopHalf) || dropTarget;
                                        if (target) {
                                          dropSegmentAt(draggedSegmentIndex, target.index, target.position);
                                        }
                                      }
                                      setDraggedSegmentIndex(null);
                                      setDropTarget(null);
                                    }}
                                    onDragEnd={() => {
                                      setDraggedSegmentIndex(null);
                                      setDropTarget(null);
                                    }}
                                    onClick={() => setSelectedSegmentUid(seg.uid)}
                                    className={`cursor-pointer transition-colors ${
                                      isRowDragging ? 'opacity-25 bg-slate-100' : ''
                                    } ${
                                      isRowBefore ? 'border-t-4 border-t-cyan-500 bg-cyan-50/70' : ''
                                    } ${
                                      isRowAfter ? 'border-b-4 border-b-cyan-500 bg-cyan-50/70' : ''
                                    } ${
                                      isAct ? 'bg-cyan-50/70 font-semibold' : 'hover:bg-slate-50'
                                    }`}
                                  >
                                    <td className="p-2.5 flex items-center gap-1.5">
                                      <GripVertical className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing" />
                                      <span className={`px-2 py-0.5 rounded font-black text-xs ${
                                        isAct ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-white'
                                      }`}>
                                        {seg.id}
                                      </span>
                                    </td>
                                    <td className="p-2.5">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                        seg.type === 'source' ? 'bg-cyan-100 text-cyan-800' : 'bg-indigo-100 text-indigo-800'
                                      }`}>
                                        {seg.type === 'source' ? 'Bocchetta' : 'Collettore'}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-slate-600 font-medium">{seg.name || '—'}</td>
                                    <td className="p-2.5 font-bold text-slate-700 whitespace-nowrap">
                                      {(() => {
                                        const target = data.segments.find(s => (s.uid && s.uid === seg.confluisceInId) || s.id === seg.confluisceInId);
                                        return target ? `➔ ${target.id}` : (seg.confluisceInId ? `➔ ${seg.confluisceInId}` : '➔ Ventilatore');
                                      })()}
                                    </td>
                                    <td className="p-2.5 font-bold text-slate-900">{formatNumber(res?.flow_m3h || 0, 0)}</td>
                                    <td className="p-2.5 text-slate-700">{seg.D_mm ? `Ø ${seg.D_mm}` : '—'}</td>
                                    <td className="p-2.5 text-slate-700">{seg.L_m ? `${seg.L_m} m` : '—'}</td>
                                    <td className="p-2.5">
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                        vOk ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                      }`}>
                                        {formatNumber(vel, 1)}
                                      </span>
                                    </td>
                                    <td className="p-2.5 font-bold text-amber-900">{formatNumber(res?.res.dp_tot_Pa || 0, 1)}</td>
                                    <td className="p-2.5 text-right space-x-1 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                      {data.segments.length > 1 && (
                                        <>
                                          <button
                                            type="button"
                                            disabled={sIdx === 0}
                                            onClick={() => dropSegmentAt(sIdx, sIdx - 1, 'before')}
                                            title="Sposta su"
                                            className="p-1 hover:bg-slate-200 disabled:opacity-25 disabled:cursor-not-allowed text-slate-600 rounded transition-colors cursor-pointer"
                                          >
                                            <ArrowUp className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            disabled={sIdx === data.segments.length - 1}
                                            onClick={() => dropSegmentAt(sIdx, sIdx + 1, 'after')}
                                            title="Sposta giù"
                                            className="p-1 hover:bg-slate-200 disabled:opacity-25 disabled:cursor-not-allowed text-slate-600 rounded transition-colors cursor-pointer"
                                          >
                                            <ArrowDown className="w-3.5 h-3.5" />
                                          </button>
                                        </>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => duplicateSegment(seg.uid || seg.id)}
                                        title="Duplica"
                                        className="p-1 hover:bg-cyan-100 text-cyan-700 rounded transition-colors cursor-pointer"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                      {data.segments.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => removeSegment(seg.uid || seg.id)}
                                          title="Elimina"
                                          className="p-1 hover:bg-red-100 text-red-600 rounded transition-colors cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {data.segments.map(seg => renderSegmentCard(seg, false))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Componenti Speciali di Trattamento Fumi (Scrubber, Separatori, Filtri) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-xl text-indigo-700">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800">
                      Componenti Speciali di Trattamento ({data.specials.length})
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Scrubber ad umido, separatori di gocce (demister), filtri, silenziatori
                    </p>
                  </div>
                </div>

                <button
                  onClick={addSpecial}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Aggiungi Componente</span>
                </button>
              </div>

              {data.specials.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <p className="text-xs">Nessun componente speciale inserito. Se l'impianto include uno scrubber, un separatore di gocce o un filtro, clicca su "Aggiungi Componente".</p>
                </div>
              ) : (
                <div className="space-y-4 mt-5">
                  {data.specials.map((sp, idx) => {
                    const specRes = calc.specResults.find(r => r.sp.id === sp.id);

                    return (
                      <div key={sp.id} className="border border-indigo-200 rounded-2xl p-4.5 bg-indigo-50/20">
                        <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-indigo-100 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-indigo-700 text-white font-black text-xs rounded-lg">
                              {sp.type}
                            </span>
                            <span className="text-xs font-bold text-indigo-900">
                              {sp.name || `Componente ${idx + 1}`}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {specRes && (
                              <span className="text-[11px] font-bold bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-lg border border-indigo-200">
                                ΔP = {formatNumber(specRes.res.dp_tot_Pa, 1)} Pa
                              </span>
                            )}

                            {data.specials.length > 1 && (
                              <div className="flex items-center bg-white border border-indigo-200 rounded-lg p-0.5 shadow-sm">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => moveSpecial(idx, 'up')}
                                  title="Sposta a monte nel flusso dell'aria"
                                  className="p-1 rounded hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed text-indigo-700 transition-colors cursor-pointer"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === data.specials.length - 1}
                                  onClick={() => moveSpecial(idx, 'down')}
                                  title="Sposta a valle nel flusso dell'aria"
                                  className="p-1 rounded hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed text-indigo-700 transition-colors cursor-pointer"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            <button
                              onClick={() => removeSpecial(sp.id)}
                              className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Riferimenti Generali Componente */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-3.5">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Tipologia</label>
                            <select
                              value={sp.type}
                              onChange={e => updSpecial(sp.id, 'type', e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                            >
                              <option value="Scrubber">Scrubber ad umido</option>
                              <option value="Separatore">Separatore di gocce (Demister)</option>
                              <option value="Filtro">Filtro fumi / polveri</option>
                              <option value="Silenziatore">Silenziatore acustico</option>
                              <option value="Scambiatore">Scambiatore termico</option>
                              <option value="Altro">Altro componente</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Nome Componente</label>
                            <input
                              type="text"
                              value={sp.name}
                              onChange={e => updSpecial(sp.id, 'name', e.target.value)}
                              placeholder="es. Scrubber C1 o Separatore T1"
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Posizionamento</label>
                            <select
                              value={sp.position === 'segment' ? sp.segmentId : 'general'}
                              onChange={e => {
                                const v = e.target.value;
                                if (v === 'general') {
                                  updSpecial(sp.id, 'position', 'general');
                                  updSpecial(sp.id, 'segmentId', '');
                                } else {
                                  updSpecial(sp.id, 'position', 'segment');
                                  updSpecial(sp.id, 'segmentId', v);
                                }
                              }}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                            >
                              <option value="general">🏢 Generale d'impianto (tutta la portata Q_tot)</option>
                              {data.segments.map(s => (
                                <option key={s.id} value={s.id}>
                                  ↳ Locale sul tratto {s.id} {s.name ? `(${s.name})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Campi Differenziati: Se Scrubber vs Se Altri */}
                        {sp.type === 'Scrubber' ? (
                          <div className="p-3.5 bg-white rounded-xl border border-indigo-100">
                            <p className="text-[10px] font-black text-indigo-900 uppercase tracking-wide mb-2.5">
                              Parametri fisici Scrubber (Calcolo Darcy corpo + Letto di Riempimento):
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                              <ItalianNumberInput
                                label="Ø interno corpo"
                                value={sp.D_interno_mm}
                                onChange={raw => updSpecial(sp.id, 'D_interno_mm', raw)}
                                placeholder="es. 930"
                                unit="mm"
                              />
                              <ItalianNumberInput
                                label="H attraversamento"
                                value={sp.H_corpo_m}
                                onChange={raw => updSpecial(sp.id, 'H_corpo_m', raw)}
                                placeholder="es. 3,7"
                                unit="m"
                              />
                              <ItalianNumberInput
                                label="H letto riempimento"
                                value={sp.H_riempimento_m}
                                onChange={raw => updSpecial(sp.id, 'H_riempimento_m', raw)}
                                placeholder="es. 0,8"
                                unit="m"
                              />
                              <ItalianNumberInput
                                label="ΔP spec. riempimento"
                                value={sp.dp_riempimento_Pa_m}
                                onChange={raw => updSpecial(sp.id, 'dp_riempimento_Pa_m', raw)}
                                placeholder="es. 200"
                                unit="Pa/m"
                              />
                              <ItalianNumberInput
                                label="ΔP extra (ugelli/demister)"
                                value={sp.dp_extra_Pa}
                                onChange={raw => updSpecial(sp.id, 'dp_extra_Pa', raw)}
                                placeholder="es. 50"
                                unit="Pa"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="p-3.5 bg-white rounded-xl border border-indigo-100">
                            <div className="max-w-xs">
                              <ItalianNumberInput
                                label={`Perdita di carico fissa ΔP per ${sp.type}`}
                                value={sp.dp_concentrata_Pa}
                                onChange={raw => updSpecial(sp.id, 'dp_concentrata_Pa', raw)}
                                placeholder="es. 150"
                                unit="Pa"
                              />
                              <p className="text-[10px] text-slate-400 mt-1">Dato di targa fornito dal costruttore del componente</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              CAMINO DI ESPULSIONE (MANDATA POST-VENTILATORE IN ATMOSFERA)
             ═══════════════════════════════════════════════════════════════════ */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-xl text-emerald-700">
                    <Wind className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                      <span>Camino di Espulsione / Mandata</span>
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full border border-emerald-300">
                        Post-Ventilatore
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Condotta a valle del ventilatore verso lo sbocco in atmosfera (portata totale: {formatNumber(calc.totalFlow_m3h, 0)} m³/h)
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={data.chimney.enabled}
                    onChange={e => updChimney('enabled', e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Includi Perdite Camino nel Ventilatore</span>
                </label>
              </div>

              {data.chimney.enabled ? (
                <div className="mt-5 space-y-4">
                  {/* Box Informativo Camino */}
                  <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs text-slate-700 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-emerald-700 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="font-bold text-emerald-950 text-[11px]">
                        Perché calcolare la contropressione del camino post-ventilatore?
                      </p>
                      <p className="text-[10px] text-slate-600 leading-relaxed">
                        Il ventilatore non lavora a scarico libero: deve vincere sia la depressione a monte (aspirazione delle bocchette e perdite dei filtri) sia la <strong>contropressione positiva di mandata a valle</strong> dovuta all'attrito lungo la canna del camino e all'energia cinetica dissipata allo sbocco terminale in atmosfera (cappello antivento o tronco di cono, con perdita cinetica standard <span className="font-mono font-bold text-slate-700">ξ = 1,0</span>).
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50/30 border border-emerald-200/80 rounded-2xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                      {/* Nome Camino */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Sigla / Nome</label>
                        <input
                          type="text"
                          value={data.chimney.name}
                          onChange={e => updChimney('name', e.target.value)}
                          placeholder="es. Camino E1"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      {/* Diametro interno */}
                      <div>
                        <ItalianNumberInput
                          label="Diametro interno Ø"
                          value={data.chimney.D_mm}
                          onChange={raw => updChimney('D_mm', raw)}
                          placeholder="es. 350"
                          unit="mm"
                        />
                      </div>

                      {/* Altezza / Lunghezza */}
                      <div>
                        <ItalianNumberInput
                          label="Altezza / Sviluppo H"
                          value={data.chimney.H_m}
                          onChange={raw => updChimney('H_m', raw)}
                          placeholder="es. 12"
                          unit="m"
                        />
                      </div>

                      {/* Materiale */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Materiale</label>
                        <select
                          value={data.chimney.material}
                          onChange={e => updChimney('material', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                        >
                          {Object.keys(FAN_ROUGHNESS).map(mat => (
                            <option key={mat} value={mat}>{mat}</option>
                          ))}
                        </select>
                      </div>

                      {/* Scabrezza */}
                      <div>
                        <ItalianNumberInput
                          label="Scabrezza ε"
                          value={data.chimney.roughness_mm}
                          onChange={raw => updChimney('roughness_mm', raw)}
                          placeholder="es. 0,050"
                          unit="mm"
                        />
                      </div>
                    </div>

                    {/* Raccordi e perdite concentrate del camino */}
                    <div className="mt-4 pt-3 border-t border-emerald-100 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Curve a 90° su espulsione
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={data.chimney.n_curve90 || ''}
                          onChange={e => updChimney('n_curve90', parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none mt-4">
                          <input
                            type="checkbox"
                            checked={data.chimney.hasSbocco}
                            onChange={e => updChimney('hasSbocco', e.target.checked)}
                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span>Sbocco terminale in atmosfera (ξ = 1.0)</span>
                        </label>
                        <p className="text-[10px] text-slate-400 ml-6">Perdita cinetica allo sbocco o cappello antivento</p>
                      </div>

                      <div>
                        <ItalianNumberInput
                          label="Oppure ΔP fissa manuale"
                          value={data.chimney.dp_manuale_Pa}
                          onChange={raw => updChimney('dp_manuale_Pa', raw)}
                          placeholder="es. 120"
                          unit="Pa"
                        />
                        <p className="text-[10px] text-slate-400 mt-0.5">Se impostata, sovrascrive il calcolo continuo</p>
                      </div>
                    </div>

                    {/* Riepilogo Fluidodinamico Camino */}
                    {calc.chimneyRes.dp_tot_Pa > 0 && (
                      <div className="mt-4 pt-3 border-t border-emerald-200/80 flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                            calc.chimneyRes.v_ms >= 8 && calc.chimneyRes.v_ms <= 16
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            Velocità fumi: {formatNumber(calc.chimneyRes.v_ms, 2)} m/s
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {calc.chimneyRes.dp_dist_Pa > 0 && `(Distribuita: ${formatNumber(calc.chimneyRes.dp_dist_Pa, 1)} Pa + Concentrata: ${formatNumber(calc.chimneyRes.dp_conc_Pa, 1)} Pa)`}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] font-bold text-slate-500 mr-2">Contropressione Mandata Camino:</span>
                          <span className="text-sm font-black text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-300">
                            ΔP = {formatNumber(calc.chimneyRes.dp_tot_Pa, 1)} Pa ({formatNumber(calc.chimneyRes.dp_tot_Pa / 9.80665, 2)} mmH₂O)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400">
                  <p className="text-xs">Camino disattivato: la mandata del ventilatore è considerata a scarico libero senza contropressione.</p>
                </div>
              )}
            </div>
          </div>

          {/* Barra di Navigazione inferiore Tab 2 */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setData(prev => ({ ...prev, activeTab: 'config' }))}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Torna a Configurazione</span>
            </button>

            <button
              onClick={() => setData(prev => ({ ...prev, activeTab: 'risultati' }))}
              className="flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-cyan-500/25 cursor-pointer active:scale-95"
            >
              <span>Calcola & Vai ai Risultati</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: RISULTATI & DIMENSIONAMENTO VENTILATORE
         ══════════════════════════════════════════════════════════════════════ */}
      {currentTab === 'risultati' && (
        <div className="space-y-6">
          {!calc || calc.totalFlow_m3h <= 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
              <Wind className="w-12 h-12 text-slate-300 mx-auto mb-3 animate-pulse" />
              <h4 className="text-sm font-black text-slate-700 mb-1">Nessuna portata rilevata</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Inserisci almeno una bocchetta sorgente con portata d'aria nella scheda "Rete Aeraulica" per calcolare il percorso più sfavorevole e dimensionare il ventilatore.
              </p>
              <button
                onClick={() => setData(prev => ({ ...prev, activeTab: 'rete' }))}
                className="mt-4 px-4 py-2 bg-cyan-600 text-white text-xs font-bold rounded-xl shadow cursor-pointer"
              >
                Vai a Rete Aeraulica
              </button>
            </div>
          ) : (
            <>
              {/* Box Informativo: Come Interpretare i Risultati & Criteri di Dimensionamento */}
              <div className="bg-gradient-to-r from-sky-50 via-cyan-50 to-slate-50 border border-cyan-200/80 rounded-2xl p-4.5 text-xs text-slate-700 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-cyan-600 text-white rounded-xl flex-shrink-0 shadow-sm mt-0.5">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="font-black text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                        Guida ai Risultati: Principio del Ramo Più Sfavorevole & Bilancio di Pressione
                      </h4>
                      <span className="text-[10px] font-bold text-cyan-700 bg-cyan-100/70 px-2 py-0.5 rounded-md border border-cyan-200">
                        Fisica dei Sistemi Aeraulici
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      In una rete aeraulica le condotte operano in parallelo unendosi nei collettori. Pertanto, la <strong>Prevalenza Totale richiesta al Ventilatore</strong> non è la somma di tutte le perdite della rete, ma è determinata esclusivamente dal percorso con la resistenza fluidodinamica maggiore (ramo sfavorito):
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                      <div className="bg-white/95 p-3 rounded-xl border border-cyan-100 shadow-2xs">
                        <span className="text-[10px] font-bold text-cyan-800 uppercase block mb-1">Ramo Più Sfavorevole:</span>
                        <p className="text-[10px] text-slate-500 leading-snug">
                          È il cammino continuo (dalla bocchetta d'inizio al ventilatore) che cumula la perdita di carico più elevata. Tutti gli altri rami hanno perdite inferiori.
                        </p>
                      </div>
                      <div className="bg-white/95 p-3 rounded-xl border border-cyan-100 shadow-2xs">
                        <span className="text-[10px] font-bold text-cyan-800 uppercase block mb-1">Formula Prevalenza Totale:</span>
                        <p className="text-[10px] text-slate-500 leading-snug font-mono">
                          <b>ΔP_tot = ΔP_sfavorevole + ΔP_speciali + ΔP_camino</b><br />
                          <span className="font-sans text-slate-400">Somma depressione di captazione, perdite nei condotti, scrubber/filtri e contropressione di mandata.</span>
                        </p>
                      </div>
                      <div className="bg-white/95 p-3 rounded-xl border border-cyan-100 shadow-2xs">
                        <span className="text-[10px] font-bold text-cyan-800 uppercase block mb-1">Unità di Misura (Pa vs mmH₂O):</span>
                        <p className="text-[10px] text-slate-500 leading-snug">
                          1 mmH₂O ≈ 9,81 Pa. I valori sono convertiti in automatico per agevolare il confronto con i diagrammi caratteristici (Q-H) dei cataloghi costruttori.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Highlight Principale: Portata Totale, Prevalenza e Ramo Più Sfavorevole */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <span className="p-2 bg-cyan-500 text-white rounded-xl">
                      <Gauge className="w-5 h-5" />
                    </span>
                    <div>
                      <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Esito Dimensionamento</p>
                      <h3 className="text-base font-black text-white">Prestazioni Richieste al Ventilatore Industriale</h3>
                    </div>
                  </div>

                  {calc.criticalPath && (
                    <div className="flex items-center gap-2 bg-amber-400/20 border border-amber-400/40 px-3 py-1.5 rounded-xl">
                      <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="text-xs font-bold text-amber-200">
                        Ramo Più Sfavorevole: <strong>{calc.criticalPath.sourceName}</strong> (ΔP max = {formatNumber(calc.criticalPath.dp_tot_path, 1)} Pa)
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                  <div>
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Portata Totale Impianto</p>
                    <p className="text-2xl sm:text-3xl font-black text-white mt-0.5">
                      {formatNumber(calc.totalFlow_m3h, 0)} <span className="text-xs font-bold text-cyan-400">m³/h</span>
                    </p>
                    <p className="text-[10px] text-white/50">= {formatNumber(calc.Q_m3s, 3)} m³/s</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Pressione Totale Richiesta</p>
                    <p className="text-2xl sm:text-3xl font-black text-cyan-300 mt-0.5">
                      {formatNumber(calc.dp_tot_ventilatore, 1)} <span className="text-xs font-bold text-white/80">Pa</span>
                    </p>
                    <p className="text-[10px] text-white/50">= {formatNumber(calc.dp_mmH2O, 2)} mmH₂O</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Potenza Teorica Aria</p>
                    <p className="text-2xl sm:text-3xl font-black text-white mt-0.5">
                      {formatNumber(calc.P_aria_kW, 2)} <span className="text-xs font-bold text-cyan-400">kW</span>
                    </p>
                    <p className="text-[10px] text-white/50">all'albero (η = {Math.round(calc.eta * 100)}%)</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Motore Elettrico Adottato</p>
                    <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-0.5">
                      {calc.taglia_IEC_effettiva} <span className="text-xs font-bold text-white/80">kW</span>
                    </p>
                    <p className="text-[10px] text-white/50">Taglia commerciale IEC</p>
                  </div>
                </div>
              </div>

              {/* Schema Topologico a video in Fase 3 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-sm font-black text-slate-800 mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
                  <span className="p-1.5 bg-cyan-100 text-cyan-600 rounded-lg"><Network className="w-4 h-4" /></span>
                  Mappa Topologica della Rete Aeraulica e Percorso Più Sfavorevole
                </h3>
                <AeraulicTopologicalTree
                  segments={treeNodes}
                  specials={calc.specResults.map(r => ({
                    id: r.sp.id,
                    name: r.sp.name,
                    type: r.sp.type,
                    dp_Pa: r.res.dp_tot_Pa,
                    position: r.sp.position,
                    segmentId: r.sp.segmentId,
                  }))}
                  chimney={chimneyNode}
                  totalFlow_m3h={calc.totalFlow_m3h}
                  dp_tot_ventilatore={calc.dp_tot_ventilatore}
                  fanPower_kW={calc.taglia_IEC_effettiva}
                />
              </div>

              {/* Bilancio Analitico del Percorso Più Sfavorevole */}
              {calc.criticalPath && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-sm font-black text-slate-800 mb-4 pb-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <span className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      Bilancio Perdite del Percorso Più Sfavorevole ({calc.criticalPath.sourceName})
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">
                      Questo ramo determina la prevalenza del ventilatore
                    </span>
                  </h3>

                  <div className="rounded-xl border border-slate-200 overflow-hidden mb-4">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                        <tr>
                          <th className="py-2 px-3 text-left">Elemento Aeraulico</th>
                          <th className="py-2 px-3 text-left">Tipo</th>
                          <th className="py-2 px-3 text-right">Portata [m³/h]</th>
                          <th className="py-2 px-3 text-right">ΔP [Pa]</th>
                          <th className="py-2 px-3 text-right">ΔP [mmH₂O]</th>
                          <th className="py-2 px-3 text-right">% su Totale</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr className="bg-slate-50/50">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">Depressione bocchetta di captazione</td>
                          <td className="py-2.5 px-3 text-slate-500">Bocchetta iniziale ({calc.criticalPath.sourceName})</td>
                          <td className="py-2.5 px-3 text-right font-bold text-cyan-700">
                            {formatNumber(calc.criticalPath.sourceFlow_m3h, 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800">{formatNumber(calc.criticalPath.dp_bocchetta, 1)}</td>
                          <td className="py-2.5 px-3 text-right text-slate-500">{formatNumber(calc.criticalPath.dp_bocchetta / 9.80665, 2)}</td>
                          <td className="py-2.5 px-3 text-right text-slate-500">
                            {formatNumber((calc.criticalPath.dp_bocchetta / calc.dp_tot_ventilatore) * 100, 1)}%
                          </td>
                        </tr>

                        {calc.criticalPath.segmentIds.map(sid => {
                          const sr = calc.segResults.find(r => r.seg.id === sid);
                          if (!sr) return null;
                          return (
                            <tr key={sid} className="hover:bg-cyan-50/30">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                Tratto {sr.seg.id} {sr.seg.name ? `— ${sr.seg.name}` : ''}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500">
                                Condotta Ø {sr.seg.D_mm} mm (L = {sr.seg.L_m} m)
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-700 font-medium">{formatNumber(sr.flow_m3h, 0)}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-800">{formatNumber(sr.res.dp_tot_Pa, 1)}</td>
                              <td className="py-2.5 px-3 text-right text-slate-500">{formatNumber(sr.res.dp_tot_Pa / 9.80665, 2)}</td>
                              <td className="py-2.5 px-3 text-right text-slate-500">
                                {formatNumber((sr.res.dp_tot_Pa / calc.dp_tot_ventilatore) * 100, 1)}%
                              </td>
                            </tr>
                          );
                        })}

                        {calc.specResults
                          .filter(sr => sr.sp.position === 'segment' && calc.criticalPath?.segmentIds.includes(sr.sp.segmentId))
                          .map(sr => (
                            <tr key={sr.sp.id} className="bg-indigo-50/40">
                              <td className="py-2.5 px-3 font-semibold text-indigo-900">{sr.sp.name || sr.sp.type}</td>
                              <td className="py-2.5 px-3 text-indigo-600">Speciale su tratto {sr.sp.segmentId}</td>
                              <td className="py-2.5 px-3 text-right text-slate-700">{formatNumber(sr.flow_m3h, 0)}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-indigo-900">{formatNumber(sr.res.dp_tot_Pa, 1)}</td>
                              <td className="py-2.5 px-3 text-right text-slate-500">{formatNumber(sr.res.dp_tot_Pa / 9.80665, 2)}</td>
                              <td className="py-2.5 px-3 text-right text-slate-500">
                                {formatNumber((sr.res.dp_tot_Pa / calc.dp_tot_ventilatore) * 100, 1)}%
                              </td>
                            </tr>
                          ))}

                        {calc.specResults
                          .filter(sr => sr.sp.position === 'general')
                          .map(sr => (
                            <tr key={sr.sp.id} className="bg-indigo-50/70">
                              <td className="py-2.5 px-3 font-semibold text-indigo-900">{sr.sp.name || sr.sp.type}</td>
                              <td className="py-2.5 px-3 text-indigo-600">Centrale d'impianto (Q_tot)</td>
                              <td className="py-2.5 px-3 text-right text-slate-700">{formatNumber(sr.flow_m3h, 0)}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-indigo-900">{formatNumber(sr.res.dp_tot_Pa, 1)}</td>
                              <td className="py-2.5 px-3 text-right text-slate-500">{formatNumber(sr.res.dp_tot_Pa / 9.80665, 2)}</td>
                              <td className="py-2.5 px-3 text-right text-slate-500">
                                {formatNumber((sr.res.dp_tot_Pa / calc.dp_tot_ventilatore) * 100, 1)}%
                              </td>
                            </tr>
                          ))}

                        {/* Riga Camino di Espulsione a valle del ventilatore */}
                        {data.chimney?.enabled && calc.chimneyRes.dp_tot_Pa > 0 && (
                          <tr className="bg-emerald-50/70 font-semibold text-emerald-950">
                            <td className="py-2.5 px-3">
                              {data.chimney.name || 'Camino di Espulsione E1'}
                            </td>
                            <td className="py-2.5 px-3 text-emerald-700 font-normal">
                              Mandata atmosferica Ø {data.chimney.D_mm || '—'} mm (H = {data.chimney.H_m || '—'} m)
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-700">{formatNumber(calc.totalFlow_m3h, 0)}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-900">{formatNumber(calc.chimneyRes.dp_tot_Pa, 1)}</td>
                            <td className="py-2.5 px-3 text-right text-slate-500">{formatNumber(calc.chimneyRes.dp_tot_Pa / 9.80665, 2)}</td>
                            <td className="py-2.5 px-3 text-right text-slate-500">
                              {formatNumber((calc.chimneyRes.dp_tot_Pa / calc.dp_tot_ventilatore) * 100, 1)}%
                            </td>
                          </tr>
                        )}

                        <tr className="bg-cyan-600 text-white font-black text-xs">
                          <td className="py-3 px-3" colSpan={3}>Prevalenza Totale Ventilatore Richiesta</td>
                          <td className="py-3 px-3 text-right text-sm">{formatNumber(calc.dp_tot_ventilatore, 1)}</td>
                          <td className="py-3 px-3 text-right text-sm">{formatNumber(calc.dp_mmH2O, 2)}</td>
                          <td className="py-3 px-3 text-right">100%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Bilanciamento di tutti i rami e confronto percorsi */}
              {calc.paths.length > 1 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-sm font-black text-slate-800 mb-3 pb-2 border-b border-slate-100 flex items-center gap-2">
                    <GitFork className="w-4 h-4 text-cyan-600" />
                    Bilanciamento Rami di Aspirazione (Taratura Serrande)
                  </h3>

                  {/* Box Informativo Taratura Serrande */}
                  <div className="mb-4 p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
                    <Sliders className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="font-bold text-amber-950 text-[11px]">
                        Perché e come si effettua la taratura delle serrande di regolazione?
                      </p>
                      <p className="text-[10px] text-amber-900 leading-relaxed">
                        L'aria segue naturalmente la via di minor resistenza: i rami più vicini al ventilatore o a diametro generoso tenderebbero ad aspirare portate eccessive, "rubando" aria e lasciando scoperte le bocchette più lontane. 
                        La colonna <strong>"ΔP Serranda da Tarare"</strong> quantifica la caduta di pressione che la serranda a iride o a farfalla deve dissipare chiudendosi parzialmente, pareggiando la resistenza del ramo più sfavorevole e garantendo le portate esatte di progetto su tutti i punti di cattura.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                        <tr>
                          <th className="py-2 px-3 text-left">Bocchetta di Partenza</th>
                          <th className="py-2 px-3 text-left">Tratti Attraversati</th>
                          <th className="py-2 px-3 text-right">ΔP Totale Ramo [Pa]</th>
                          <th className="py-2 px-3 text-right">ΔP Serranda da Tarare [Pa]</th>
                          <th className="py-2 px-3 text-center">Stato</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {calc.paths.map(p => {
                          const isCrit = p.sourceId === calc.criticalPath?.sourceId;
                          const sbilancio = (calc.criticalPath?.dp_tot_path || 0) - p.dp_tot_path;

                          return (
                            <tr key={p.sourceId} className={isCrit ? 'bg-amber-50/60 font-bold' : ''}>
                              <td className="py-2.5 px-3 text-slate-800">{p.sourceName} ({p.sourceId})</td>
                              <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{p.segmentIds.join(' ➔ ')}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-800">{formatNumber(p.dp_tot_path, 1)}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-indigo-700">
                                {isCrit ? '0 (Sfavorito)' : formatNumber(sbilancio, 1)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {isCrit ? (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold text-[10px] rounded-full border border-amber-300">
                                    Ramo Più Sfavorito
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-medium text-[10px] rounded-full">
                                    Da Tarare
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Box Motore Elettrico IEC & Selezione Taglia Commerciale */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-sm font-black text-slate-800 mb-4 pb-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    Selezione Motore Elettrico Commerciale IEC
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Standard Unificato IEC (Norma EN 60034-30)
                  </span>
                </h3>

                {/* Box Informativo Scelta Motore IEC */}
                <div className="mb-5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-start gap-2.5">
                  <Lightbulb className="w-4 h-4 text-cyan-700 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900 text-[11px]">
                      Criterio di Calcolo e Scelta della Taglia Motore Normalizzata IEC
                    </p>
                    <p className="text-[10px] text-slate-600 leading-relaxed">
                      La potenza teorica assorbita all'albero è espressa da <span className="font-mono font-bold text-slate-800">P_aria = (Q × ΔP) / (3600 × 1000 × η) [kW]</span>. 
                      Applicando il margine di sicurezza impostato (+{calc.margine_perc}%) si ricava la potenza minima di progetto, in base alla quale il software seleziona automaticamente la taglia commerciale normalizzata IEC immediatamente superiore (es. 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15 kW...). È sempre possibile forzare manualmente una taglia diversa tramite il selettore sottostante.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Card Taglia IEC Raccomandata */}
                  <div className="bg-gradient-to-br from-cyan-600 to-sky-700 rounded-2xl p-5 text-white shadow-lg flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1">
                        Taglia Commerciale Suggerita (con margine +{calc.margine_perc}%)
                      </p>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-5xl font-black">{calc.taglia_IEC_consigliata}</span>
                        <span className="text-xl font-bold text-cyan-200">kW</span>
                      </div>
                      <p className="text-xs text-white/80 mt-2">
                        Per singolo ventilatore titolare ({formatNumber(calc.P_singolo_prog_kW, 3)} kW calcolati)
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/20 text-[11px] text-white/70">
                      Totale installato ({data.global.n_titolari + data.global.n_riserva} ventilatori):{' '}
                      <strong className="text-white">
                        {formatNumber(calc.taglia_IEC_consigliata * (data.global.n_titolari + data.global.n_riserva), 2)} kW
                      </strong>
                    </div>
                  </div>

                  {/* Selettore Manuale Taglia Installata (Standard IEC vs Personalizzato/Targa) */}
                  <div className="lg:col-span-2 border border-slate-200 rounded-2xl p-5 bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
                          Motore Commerciale Effettivamente Installato
                        </label>
                        {(data.global.taglia_IEC_installata !== null || data.global.motore_tipo_scelta === 'custom') && (
                          <button
                            type="button"
                            onClick={() => {
                              setData(prev => ({
                                ...prev,
                                global: {
                                  ...prev.global,
                                  motore_tipo_scelta: 'standard',
                                  taglia_IEC_installata: null,
                                  motore_custom_kW: '',
                                },
                              }));
                            }}
                            className="text-[11px] font-bold text-cyan-600 hover:underline cursor-pointer"
                          >
                            Ripristina suggerito
                          </button>
                        )}
                      </div>

                      {/* Switch di modalità: Standard IEC vs Personalizzato da Targa */}
                      <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl mb-3 max-w-md">
                        <button
                          type="button"
                          onClick={() => updGlobal('motore_tipo_scelta', 'standard')}
                          className={`flex-1 py-1 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            (data.global.motore_tipo_scelta || 'standard') === 'standard'
                              ? 'bg-white text-slate-800 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Standard IEC (Normalizzato)
                        </button>
                        <button
                          type="button"
                          onClick={() => updGlobal('motore_tipo_scelta', 'custom')}
                          className={`flex-1 py-1 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            data.global.motore_tipo_scelta === 'custom'
                              ? 'bg-white text-cyan-800 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          ⚙️ Personalizzato / Da Targa
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          {(data.global.motore_tipo_scelta || 'standard') === 'standard' ? (
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Taglia a Catalogo IEC
                              </label>
                              <select
                                value={data.global.taglia_IEC_installata ?? calc.taglia_IEC_consigliata}
                                onChange={e => updGlobal('taglia_IEC_installata', parseFloat(e.target.value) || null)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-cyan-500 cursor-pointer"
                              >
                                {TAGLIE_MOTORI_IEC.map(kw => (
                                  <option key={kw} value={kw}>
                                    Motore IEC: {kw} kW {kw === calc.taglia_IEC_consigliata ? '(Suggerito)' : ''}
                                  </option>
                                ))}
                              </select>
                              <p className="text-[10px] text-slate-400 mt-1">
                                Serie unificata IEC 60072-1 / CEI EN 60034-30-1
                              </p>
                            </div>
                          ) : (
                            <div>
                              <ItalianNumberInput
                                label="Potenza Nominale da Targa [kW]"
                                value={data.global.motore_custom_kW || ''}
                                onChange={val => updGlobal('motore_custom_kW', val)}
                                unit="kW"
                                placeholder="es. 3,7 o 0,18"
                              />
                              <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                                Motori NEMA (es. 5 HP = 3,7 kW), Dahlander, motori EC o fuori standard
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                              Coefficiente di Sicurezza Effettivo
                            </p>
                            <p className={`text-base font-black mt-0.5 ${calc.coeff_sicurezza_effettivo < 1 ? 'text-rose-600' : 'text-slate-800'}`}>
                              {formatNumber(calc.coeff_sicurezza_effettivo, 2)}×{' '}
                              <span className="text-[10px] font-medium text-slate-500">
                                (rispetto a {formatNumber(calc.P_singolo_teorica_kW, 3)} kW teorici)
                              </span>
                            </p>
                          </div>
                          {calc.coeff_sicurezza_effettivo < 1 && (
                            <p className="text-[10px] font-bold text-rose-600 mt-1">
                              ⚠️ Attenzione: taglia inferiore alla potenza teorica dell'aria!
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                      <span>Totale motori installati ({data.global.n_titolari + data.global.n_riserva}):</span>
                      <strong className="text-slate-800 text-sm">
                        {formatNumber(calc.P_tot_installata_kW, 2)} kW complessivi
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Barra di Navigazione inferiore Tab 3 */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setData(prev => ({ ...prev, activeTab: 'rete' }))}
                  className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer active:scale-95"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Modifica Rete Aeraulica</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  <span>Stampa Relazione Tecnica A4</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>

    {/* ══════════════════════════════════════════════════════════════════════
        REPORT DI STAMPA A4 PROFESSIONALE (print:block)
       ══════════════════════════════════════════════════════════════════════ */}
    <PrintReport>
      {!calc || calc.totalFlow_m3h <= 0 ? (
        <p className="text-sm text-slate-400 italic">Nessun risultato disponibile per la stampa. Compilare la scheda interattiva.</p>
      ) : (
        <>
          {/* Sezione 1: Parametri Impianto & Condizioni Aria */}
          <PrintSection title="1. Configurazione Impianto & Condizioni Ambientali">
            <div className="grid grid-cols-4 gap-4 text-xs">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Temperatura Aria</p>
                <p className="font-bold text-slate-800 text-sm">{formatNumber(parseItalianNumber(data.global.T_aria_C) || 20, 1)} °C</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Quota Impianto</p>
                <p className="font-bold text-slate-800 text-sm">{formatNumber(parseItalianNumber(data.global.quota_m) || 0, 0)} m s.l.m.</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Densità Aria ρ</p>
                <p className="font-bold text-slate-800 text-sm">{formatNumber(calc.rho, 4)} kg/m³</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Viscosità Cin. ν</p>
                <p className="font-bold text-slate-800 text-sm">{formatNumber(calc.nu * 1e6, 2)}×10⁻⁶ m²/s</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Depress. Bocchette</p>
                <p className="font-bold text-slate-800 text-sm">{formatNumber(parseItalianNumber(data.global.dp_bocchetta_default_Pa) || 250, 0)} Pa</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Rendimento Ventilatore η</p>
                <p className="font-bold text-slate-800 text-sm">
                  {calc.hasEta ? `${formatNumber(calc.eta * 100, 0)} %` : '— (Non specificato, stima 55%)'}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Margine Sicurezza</p>
                <p className="font-bold text-slate-800 text-sm">
                  {calc.margine_perc > 0 ? `+${calc.margine_perc} %` : '0 % (Nessun margine)'}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Configurazione Ventilatori</p>
                <p className="font-bold text-slate-800 text-sm">{data.global.n_titolari} titolari + {data.global.n_riserva} riserva</p>
              </div>
            </div>
          </PrintSection>

          {/* Sezione 2: Schema Topologico Vettoriale */}
          <PrintSection title="2. Schema Topologico Rete Aeraulica (Ramo Più Sfavorevole Evidenziato)">
            <div className="border border-slate-300 rounded-xl overflow-hidden p-2 bg-white">
              <AeraulicTopologicalTree
                segments={treeNodes}
                specials={calc.specResults.map(r => ({
                  id: r.sp.id,
                  name: r.sp.name,
                  type: r.sp.type,
                  dp_Pa: r.res.dp_tot_Pa,
                  position: r.sp.position,
                  segmentId: r.sp.segmentId,
                }))}
                chimney={chimneyNode}
                totalFlow_m3h={calc.totalFlow_m3h}
                dp_tot_ventilatore={calc.dp_tot_ventilatore}
                fanPower_kW={calc.taglia_IEC_effettiva}
              />
            </div>
          </PrintSection>

          {/* Sezione 3: Tabella Rete Aeraulica Tratti */}
          <PrintSection title="3. Tratti di Condotta Aeraulica (Rete ad Albero da Monte a Valle)">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-50">
                  <th className="py-1.5 px-2 text-left font-bold">ID</th>
                  <th className="py-1.5 px-2 text-left font-bold">Descrizione</th>
                  <th className="py-1.5 px-2 text-left font-bold whitespace-nowrap">Confluenza</th>
                  <th className="py-1.5 px-2 text-right font-bold">Portata [m³/h]</th>
                  <th className="py-1.5 px-2 text-right font-bold">Ø [mm]</th>
                  <th className="py-1.5 px-2 text-right font-bold">L [m]</th>
                  <th className="py-1.5 px-2 text-right font-bold">Velocità [m/s]</th>
                  <th className="py-1.5 px-2 text-right font-bold">ΔP distr. [Pa]</th>
                  <th className="py-1.5 px-2 text-right font-bold">ΔP conc. [Pa]</th>
                  <th className="py-1.5 px-2 text-right font-bold">ΔP tot [Pa]</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {calc.segResults.map(({ seg, flow_m3h, res }) => {
                  const isCrit = calc.criticalSegmentIds.has(seg.id);
                  return (
                    <tr key={seg.uid || seg.id} className={isCrit ? 'bg-amber-50/50 font-semibold' : ''}>
                      <td className="py-1.5 px-2">{seg.id}</td>
                      <td className="py-1.5 px-2">{seg.name || '—'}</td>
                      <td className="py-1.5 px-2 whitespace-nowrap">
                        {(() => {
                          const target = data.segments.find(s => (s.uid && s.uid === seg.confluisceInId) || s.id === seg.confluisceInId);
                          return target ? `➔ ${target.id}` : (seg.confluisceInId ? `➔ ${seg.confluisceInId}` : '➔ Ventilatore');
                        })()}
                      </td>
                      <td className="py-1.5 px-2 text-right">{formatNumber(flow_m3h, 0)}</td>
                      <td className="py-1.5 px-2 text-right">{seg.D_mm}</td>
                      <td className="py-1.5 px-2 text-right">{seg.L_m}</td>
                      <td className="py-1.5 px-2 text-right">{formatNumber(res.v_ms, 2)}</td>
                      <td className="py-1.5 px-2 text-right">{formatNumber(res.dp_dist_Pa, 1)}</td>
                      <td className="py-1.5 px-2 text-right">{formatNumber(res.dp_conc_Pa, 1)}</td>
                      <td className="py-1.5 px-2 text-right font-bold">{formatNumber(res.dp_tot_Pa, 1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </PrintSection>

          {/* Sezione 4: Componenti Speciali (se presenti) */}
          {calc.specResults.length > 0 && (
            <PrintSection title="4. Componenti Speciali di Trattamento Fumi">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-50">
                    <th className="py-1.5 px-2 text-left font-bold">Componente</th>
                    <th className="py-1.5 px-2 text-left font-bold">Tipologia</th>
                    <th className="py-1.5 px-2 text-left font-bold">Posizionamento</th>
                    <th className="py-1.5 px-2 text-right font-bold">Portata [m³/h]</th>
                    <th className="py-1.5 px-2 text-right font-bold">Dettagli / Corpo</th>
                    <th className="py-1.5 px-2 text-right font-bold">ΔP [Pa]</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {calc.specResults.map(({ sp, flow_m3h, res }) => (
                    <tr key={sp.id}>
                      <td className="py-1.5 px-2 font-semibold">{sp.name || sp.id}</td>
                      <td className="py-1.5 px-2">{sp.type}</td>
                      <td className="py-1.5 px-2">
                        {sp.position === 'general' ? "Centrale d'impianto" : `Su tratto ${sp.segmentId}`}
                      </td>
                      <td className="py-1.5 px-2 text-right">{formatNumber(flow_m3h, 0)}</td>
                      <td className="py-1.5 px-2 text-right text-slate-600">
                        {sp.type === 'Scrubber'
                          ? `Ø ${sp.D_interno_mm} mm | H ${sp.H_corpo_m} m | H_riemp ${sp.H_riempimento_m} m`
                          : 'Perdita concentrata fissa'}
                      </td>
                      <td className="py-1.5 px-2 text-right font-bold">{formatNumber(res.dp_tot_Pa, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PrintSection>
          )}

          {/* Sezione: Bilancio Percorso Più Sfavorevole (a tutta larghezza) */}
          <PrintSection title={`${calc.specResults.length > 0 ? '5.' : '4.'} Bilancio Percorso Più Sfavorevole`}>
            <table className="w-full text-[11px] border-collapse">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">
                    Bocchetta iniziale ({calc.criticalPath?.sourceName})
                  </td>
                  <td className="py-1.5 text-right font-bold">
                    {formatNumber(calc.criticalPath?.dp_bocchetta || 0, 1)} Pa
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Perdite tratti condotta sul percorso</td>
                  <td className="py-1.5 text-right font-bold">
                    {formatNumber(calc.criticalPath?.dp_tratti || 0, 1)} Pa
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Componenti speciali locali percorso</td>
                  <td className="py-1.5 text-right font-bold">
                    {formatNumber(calc.criticalPath?.dp_speciali_locali || 0, 1)} Pa
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Componenti speciali centrali (Scrubber/altri)</td>
                  <td className="py-1.5 text-right font-bold">
                    {formatNumber(calc.dp_speciali_generali, 1)} Pa
                  </td>
                </tr>
                {data.chimney?.enabled && calc.chimneyRes.dp_tot_Pa > 0 && (
                  <tr className="border-b border-slate-200 bg-emerald-50/50">
                    <td className="py-1.5 text-slate-700 font-medium">
                      {data.chimney.name || 'Camino di Espulsione E1'} (Mandata Atmosferica)
                    </td>
                    <td className="py-1.5 text-right font-bold text-emerald-800">
                      {formatNumber(calc.chimneyRes.dp_tot_Pa, 1)} Pa
                    </td>
                  </tr>
                )}
                <tr className="bg-slate-100 font-bold">
                  <td className="py-2 text-slate-900">Prevalenza Totale Ventilatore Richiesta</td>
                  <td className="py-2 text-right text-slate-900 text-sm">
                    {formatNumber(calc.dp_tot_ventilatore, 1)} Pa ({formatNumber(calc.dp_mmH2O, 2)} mmH₂O)
                  </td>
                </tr>
              </tbody>
            </table>
          </PrintSection>

          {/* Sezione: Dimensionamento Ventilatore & Motore Elettrico (a tutta larghezza) */}
          <PrintSection title={`${calc.specResults.length > 0 ? '6.' : '5.'} Dimensionamento Ventilatore & Motore Elettrico`}>
            <table className="w-full text-[11px] border-collapse">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Portata Totale Impianto Q</td>
                  <td className="py-1.5 text-right font-bold">{formatNumber(calc.totalFlow_m3h, 0)} m³/h</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Prevalenza Totale Ventilatore</td>
                  <td className="py-1.5 text-right font-bold">{formatNumber(calc.dp_tot_ventilatore, 1)} Pa</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Potenza Teorica Aria (all'albero)</td>
                  <td className="py-1.5 text-right font-bold">{formatNumber(calc.P_aria_kW, 3)} kW</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">
                    Potenza di Progetto ({calc.margine_perc > 0 ? `+${calc.margine_perc}%` : 'Margine 0%'})
                  </td>
                  <td className="py-1.5 text-right font-bold">{formatNumber(calc.P_prog_tot_kW, 3)} kW</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Taglia Commerciale IEC Suggerita</td>
                  <td className="py-1.5 text-right font-bold text-cyan-700">{calc.taglia_IEC_consigliata} kW</td>
                </tr>
                <tr className="bg-slate-900 text-white font-bold">
                  <td className="py-2 px-2">Motore Commerciale Adottato (per vent.)</td>
                  <td className="py-2 px-2 text-right text-sm">
                    {calc.taglia_IEC_effettiva} kW {calc.isCustomMotor ? '(Da Targa / Speciale)' : '(Norm. IEC)'} (K_sic = {formatNumber(calc.coeff_sicurezza_effettivo, 2)}×)
                  </td>
                </tr>
              </tbody>
            </table>
          </PrintSection>
        </>
      )}
    </PrintReport>
    </>
  );
}
export default ToolAspiratore;
