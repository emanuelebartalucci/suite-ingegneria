import React, { useState, useMemo } from 'react';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import {
  Plus, Trash2, ChevronDown, ChevronUp,
  Wind, Zap, CheckCircle, ArrowRight, ArrowLeft,
  Printer, GitFork, Gauge, Layers, Network
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
import { AeraulicTopologicalTree, AeraulicTreeNode } from '../components/AeraulicTopologicalTree';
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

/** Dati globali impianto */
export interface FanGlobalData {
  T_aria_C: string;                // Temperatura aria [°C]
  quota_m: string;                 // Quota impianto [m s.l.m.]
  dp_bocchetta_default_Pa: string; // Depressione standard bocchette [Pa]
  eta_ventilatore_perc: string;    // Rendimento ventilatore in % (es. 55 per 55%)
  margine_motore_perc: string;     // Margine di sicurezza potenza motore in % (es. 20%)
  taglia_IEC_installata: number | null; // Taglia motore commerciale scelta a mano [kW]
  n_titolari: number;              // Numero ventilatori titolari
  n_riserva: number;               // Numero ventilatori di riserva
}

export interface FanToolData {
  global: FanGlobalData;
  segments: AeraulicSegment[];
  specials: SpecialComponent[];
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

export const createNewSegment = (suggestedId: string, isFirst = false): AeraulicSegment => ({
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

const defaultData: FanToolData = {
  global: {
    T_aria_C: '',
    quota_m: '',
    dp_bocchetta_default_Pa: '',
    eta_ventilatore_perc: '',
    margine_motore_perc: '',
    taglia_IEC_installata: null,
    n_titolari: 1,
    n_riserva: 0,
  },
  segments: [createNewSegment('L1', true)],
  specials: [],
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
    taglia_IEC_installata: g.taglia_IEC_installata !== undefined ? g.taglia_IEC_installata : null,
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

  const rawSpecials = Array.isArray(loaded.specials) ? loaded.specials : [];
  const migratedSpecials: SpecialComponent[] = rawSpecials.map((sp: any, idx: number) => ({
    id: sp.id ? String(sp.id) : `SP${idx + 1}`,
    name: sp.name || '',
    type: sp.type || 'Scrubber',
    position: sp.position === 'segment' ? 'segment' : 'general',
    segmentId: sp.segmentId ? String(sp.segmentId) : '',
    D_interno_mm: sp.D_interno_mm !== undefined ? String(sp.D_interno_mm).replace('.', ',') : '',
    H_corpo_m: sp.H_corpo_m !== undefined ? String(sp.H_corpo_m).replace('.', ',') : '',
    H_riempimento_m: sp.H_riempimento_m !== undefined ? String(sp.H_riempimento_m).replace('.', ',') : '',
    dp_riempimento_Pa_m: sp.dp_riempimento_Pa_m !== undefined ? String(sp.dp_riempimento_Pa_m).replace('.', ',') : '',
    dp_extra_Pa: sp.dp_extra_Pa !== undefined ? String(sp.dp_extra_Pa).replace('.', ',') : '',
    dp_concentrata_Pa: sp.dp_concentrata_Pa !== undefined ? String(sp.dp_concentrata_Pa).replace('.', ',') : '',
  }));

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

// ── Componente Principale ───────────────────────────────────────────────────

export function ToolAspiratore({ projectData, setProjectData, setAppMode }: ToolAspiratorProps) {
  const [data, setData] = useState<FanToolData>(() => defaultData);
  const [openAccessoryId, setOpenAccessoryId] = useState<string | null>(null);
  const [selectedTreeSegmentId, setSelectedTreeSegmentId] = useState<string | null>(null);

  function updGlobal(field: keyof FanGlobalData, value: any) {
    setData(prev => ({ ...prev, global: { ...prev.global, [field]: value } }));
  }

  function addSegment() {
    setData(prev => {
      const nextNum = prev.segments.length + 1;
      const newId = `L${nextNum}`;
      const lastSeg = prev.segments.length > 0 ? prev.segments[prev.segments.length - 1] : null;

      // Il nuovo tratto creato diventa il tratto finale che confluisce verso il ventilatore
      const newSeg = createNewSegment(newId, false);
      newSeg.confluisceInId = ''; // Verso il Ventilatore
      if (lastSeg) {
        newSeg.type = 'junction'; // Raccoglie l'aria a monte dal tratto precedente
      }

      // Il tratto precedente ora confluisce nel nuovo tratto appena aggiunto
      const updatedSegments = prev.segments.map((s, idx) => {
        if (idx === prev.segments.length - 1) {
          return { ...s, confluisceInId: newId };
        }
        return s;
      });

      return {
        ...prev,
        segments: [...updatedSegments, newSeg]
      };
    });
  }

  function removeSegment(id: string) {
    setData(prev => ({
      ...prev,
      segments: prev.segments
        .filter(s => s.id !== id)
        .map(s => s.confluisceInId === id ? { ...s, confluisceInId: '' } : s),
      specials: prev.specials.map(sp => sp.segmentId === id ? { ...sp, segmentId: '', position: 'general' } : sp)
    }));
  }

  function updSegment(id: string, field: keyof AeraulicSegment, value: any) {
    setData(prev => ({
      ...prev,
      segments: prev.segments.map(s => {
        if (s.id !== id) return s;
        const updated = { ...s, [field]: value };
        if (field === 'material' && typeof value === 'string' && FAN_ROUGHNESS[value] !== undefined) {
          updated.roughness_mm = formatNumber(FAN_ROUGHNESS[value], 3);
        }
        return updated;
      })
    }));
  }

  function updSegmentAccessory(segId: string, accField: string, count: number) {
    setData(prev => ({
      ...prev,
      segments: prev.segments.map(s => {
        if (s.id !== segId) return s;
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
    const margine_perc = parseItalianNumber(g.margine_motore_perc) || 20;

    const rho = calcRhoAria(T_C, quota);
    const nu = calcNuAria(T_C);

    // 1. Risoluzione Portate per ciascun Tratto nella Rete ad Albero
    const flowMap: Record<string, number> = {};
    const segmentsMap = new Map(data.segments.map(s => [s.id, s]));

    function resolveFlow(segId: string, visited = new Set<string>()): number {
      if (flowMap[segId] !== undefined) return flowMap[segId];
      if (visited.has(segId)) return 0;
      visited.add(segId);

      const seg = segmentsMap.get(segId);
      if (!seg) return 0;

      if (seg.type === 'source') {
        const q = parseItalianNumber(seg.Q_custom_m3h);
        flowMap[segId] = q;
        return q;
      }

      const incoming = data.segments.filter(s => s.confluisceInId === segId);
      const totalIn = incoming.reduce((sum, inc) => sum + resolveFlow(inc.id, new Set(visited)), 0);
      flowMap[segId] = totalIn;
      return totalIn;
    }

    data.segments.forEach(s => resolveFlow(s.id));

    const totalFlow_m3h = data.segments
      .filter(s => s.type === 'source')
      .reduce((sum, s) => sum + parseItalianNumber(s.Q_custom_m3h), 0);

    // 2. Calcolo perdite di carico per ogni tratto
    const segResults = data.segments.map(seg => {
      const q = flowMap[seg.id] || 0;
      const res = calcSegmentAeraulics(seg, q, rho, nu);
      return { seg, flow_m3h: q, res };
    });
    const segResultsMap = new Map(segResults.map(r => [r.seg.id, r]));

    // 3. Calcolo perdite per ciascun componente speciale
    const specResults = data.specials.map(sp => {
      let q = totalFlow_m3h;
      if (sp.position === 'segment' && sp.segmentId) {
        q = flowMap[sp.segmentId] || 0;
      }
      const res = calcSpecialAeraulics(sp, q, rho, nu);
      return { sp, flow_m3h: q, res };
    });

    const dp_speciali_generali = specResults
      .filter(r => r.sp.position === 'general')
      .reduce((s, r) => s + r.res.dp_tot_Pa, 0);

    // 4. Tracciamento dei Percorsi da ogni Bocchetta (Source) verso Valle e identificazione Percorso Critico
    interface PathTrace {
      sourceId: string;
      sourceName: string;
      sourceFlow_m3h: number;
      segmentIds: string[];
      dp_bocchetta: number;
      dp_tratti: number;
      dp_speciali_locali: number;
      dp_tot_path: number;
    }

    const paths: PathTrace[] = [];
    const sourceSegments = data.segments.filter(s => s.type === 'source');

    sourceSegments.forEach(src => {
      const pathSegIds: string[] = [];
      let currId: string | undefined = src.id;
      const visited = new Set<string>();

      while (currId && !visited.has(currId)) {
        visited.add(currId);
        pathSegIds.push(currId);
        const segObj = segmentsMap.get(currId);
        if (!segObj || !segObj.confluisceInId) {
          break;
        }
        currId = segObj.confluisceInId;
      }

      let dp_tratti_path = 0;
      pathSegIds.forEach(sid => {
        const sr = segResultsMap.get(sid);
        if (sr) dp_tratti_path += sr.res.dp_tot_Pa;
      });

      let dp_spec_locali = 0;
      specResults.forEach(sr => {
        if (sr.sp.position === 'segment' && pathSegIds.includes(sr.sp.segmentId)) {
          dp_spec_locali += sr.res.dp_tot_Pa;
        }
      });

      const dp_bocch = parseItalianNumber(src.dp_bocchetta_Pa) || dp_bocchetta_def;
      const dp_tot = dp_bocch + dp_tratti_path + dp_spec_locali + dp_speciali_generali;

      paths.push({
        sourceId: src.id,
        sourceName: src.name || src.id,
        sourceFlow_m3h: parseItalianNumber(src.Q_custom_m3h) || 0,
        segmentIds: pathSegIds,
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

    const dp_tot_ventilatore = criticalPath ? criticalPath.dp_tot_path : 0;
    const dp_mmH2O = dp_tot_ventilatore / 9.80665;

    const criticalSegmentIds = new Set(criticalPath ? criticalPath.segmentIds : []);

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

    const taglia_IEC_effettiva = g.taglia_IEC_installata !== null && g.taglia_IEC_installata > 0
      ? g.taglia_IEC_installata
      : taglia_IEC_consigliata;

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
      const segRes = calc.segResults.find(r => r.seg.id === seg.id);
      return {
        id: seg.id,
        name: seg.name,
        type: seg.type,
        flow_m3h: segRes?.flow_m3h || 0,
        v_ms: segRes?.res.v_ms || 0,
        dp_Pa: segRes?.res.dp_tot_Pa || 0,
        D_mm: seg.D_mm,
        L_m: seg.L_m,
        confluisceInId: seg.confluisceInId,
        isCritical: calc.criticalSegmentIds.has(seg.id),
      };
    });
  }, [data.segments, calc.segResults, calc.criticalSegmentIds]);

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

          {/* Banner Guida Ingegneristica Monte -> Valle */}
          <div className="bg-gradient-to-r from-cyan-50 to-sky-50 border border-cyan-200 rounded-2xl p-4.5 text-slate-700">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-cyan-600 text-white rounded-xl flex-shrink-0 mt-0.5 shadow-sm">
                <GitFork className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-cyan-950 uppercase tracking-wide">
                  Direzione di Compilazione: Da Monte (Bocchette) verso Valle (Ventilatore)
                </h4>
                <p className="text-[11px] text-cyan-900 mt-1 leading-relaxed">
                  1. Inserisci prima le <strong>Bocchette di aspirazione</strong> (tratti di captazione sorgente con la propria portata d'aria).<br />
                  2. Inserisci poi i <strong>Collettori di confluenza</strong> a valle: il tool calcolerà in automatico la portata complessiva sommando i rami affluenti e isolerà il <strong>percorso critico</strong> che determina la prevalenza del ventilatore.
                </p>
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
                totalFlow_m3h={calc.totalFlow_m3h}
                dp_tot_ventilatore={calc.dp_tot_ventilatore}
                selectedSegmentId={selectedTreeSegmentId}
                onSelectSegment={id => setSelectedTreeSegmentId(id === selectedTreeSegmentId ? null : id)}
                fanPower_kW={calc.taglia_IEC_effettiva}
              />
            </div>
          </div>

          {/* Elenco Tratti Condotta */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <span className="p-1.5 bg-cyan-100 text-cyan-600 rounded-lg"><Wind className="w-4 h-4" /></span>
                  Configurazione Tratti Condotta ({data.segments.length} tratti)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Modifica i parametri di ciascun condotto e definisci la gerarchia di confluenza
                </p>
              </div>
              <button
                onClick={addSegment}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Aggiungi Tratto</span>
              </button>
            </div>

            <div className="space-y-5">
              {data.segments.map((seg) => {
                const segRes = calc.segResults.find(r => r.seg.id === seg.id);
                const isCritical = calc.criticalSegmentIds.has(seg.id);
                const isSelectedInTree = selectedTreeSegmentId === seg.id;
                const velocity = segRes?.res.v_ms || 0;
                
                const vOk = velocity >= 10 && velocity <= 18;
                const vWarn = (velocity >= 6 && velocity < 10) || (velocity > 18 && velocity <= 22);
                const vBad = (velocity > 0 && velocity < 6) || velocity > 22;

                const safeAccessories: DuctAccessories = seg.accessories || defaultAccessories();

                return (
                  <div
                    key={seg.id}
                    id={`segment-card-${seg.id}`}
                    className={`border rounded-2xl p-5 transition-all ${
                      isSelectedInTree
                        ? 'border-cyan-500 bg-cyan-50/40 shadow-md ring-2 ring-cyan-400'
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
                        {isCritical && (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-900 font-black text-[10px] rounded-lg border border-amber-300 flex items-center gap-1 shadow-sm">
                            <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                            PERCORSO CRITICO
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {segRes && segRes.flow_m3h > 0 && (
                          <div className="flex items-center gap-2">
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

                        {data.segments.length > 1 && (
                          <button
                            onClick={() => removeSegment(seg.id)}
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
                          onClick={() => updSegment(seg.id, 'type', 'source')}
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
                          onClick={() => updSegment(seg.id, 'type', 'junction')}
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
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Codice ID</label>
                        <input
                          type="text"
                          value={seg.id}
                          onChange={e => updSegment(seg.id, 'id', e.target.value)}
                          placeholder="es. L1"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      {/* Nome descrittivo */}
                      <div className="lg:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Nome / Descrizione</label>
                        <input
                          type="text"
                          value={seg.name}
                          onChange={e => updSegment(seg.id, 'name', e.target.value)}
                          placeholder="es. Aspirazione Bottale 1"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      {/* Gestione Portata / Confluenza */}
                      {seg.type === 'source' ? (
                        <div>
                          <ItalianNumberInput
                            label="Portata aspirata Q"
                            value={seg.Q_custom_m3h}
                            onChange={raw => updSegment(seg.id, 'Q_custom_m3h', raw)}
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
                        <select
                          value={seg.confluisceInId}
                          onChange={e => updSegment(seg.id, 'confluisceInId', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-cyan-500"
                        >
                          <option value="">🏁 Tratto Finale ➔ Verso Ventilatore / Trattamento</option>
                          {data.segments
                            .filter(other => other.id !== seg.id)
                            .map(other => (
                              <option key={other.id} value={other.id}>
                                ↳ Confluisce nel Collettore {other.id} {other.name ? `(${other.name})` : ''}
                              </option>
                            ))
                          }
                        </select>
                      </div>
                    </div>

                    {/* Parametri Geometrici Condotta */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-3 pt-3 border-t border-slate-100">
                      <div>
                        <ItalianNumberInput
                          label="Diametro interno Ø"
                          value={seg.D_mm}
                          onChange={raw => updSegment(seg.id, 'D_mm', raw)}
                          placeholder="es. 250"
                          unit="mm"
                        />
                      </div>

                      <div>
                        <ItalianNumberInput
                          label="Lunghezza lineare L"
                          value={seg.L_m}
                          onChange={raw => updSegment(seg.id, 'L_m', raw)}
                          placeholder="es. 15"
                          unit="m"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Materiale</label>
                        <select
                          value={seg.material}
                          onChange={e => updSegment(seg.id, 'material', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-cyan-500"
                        >
                          {Object.keys(FAN_ROUGHNESS).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>

                      <div>
                        <ItalianNumberInput
                          label="Scabrezza parete ε"
                          value={seg.roughness_mm}
                          onChange={raw => updSegment(seg.id, 'roughness_mm', raw)}
                          placeholder="es. 0,02"
                          unit="mm"
                        />
                      </div>
                    </div>

                    {/* Accordion Accessori (Pezzi speciali con Leq) */}
                    <div className="mt-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setOpenAccessoryId(openAccessoryId === seg.id ? null : seg.id)}
                        className="flex items-center gap-1.5 text-xs font-bold text-cyan-700 hover:text-cyan-800 cursor-pointer select-none"
                      >
                        {openAccessoryId === seg.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        <span>Accessori & Pezzi Speciali (Gomiti, Biforcazioni, Valvole...)</span>
                        {segRes && segRes.res.L_eq_tot_m > 0 && (
                          <span className="text-[10px] font-normal text-slate-500 ml-1">
                            (Leq tot = {formatNumber(segRes.res.L_eq_tot_m, 1)} m)
                          </span>
                        )}
                      </button>

                      {openAccessoryId === seg.id && (
                        <div className="mt-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl animate-fadeIn">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Numero pezzi installati:</p>
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
                                    onChange={e => updSegmentAccessory(seg.id, field, parseInt(e.target.value) || 0)}
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
              })}
            </div>
          </div>

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

                          <div className="flex items-center gap-3">
                            {specRes && (
                              <span className="text-[11px] font-bold bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-lg border border-indigo-200">
                                ΔP = {formatNumber(specRes.res.dp_tot_Pa, 1)} Pa
                              </span>
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
                Inserisci almeno una bocchetta sorgente con portata d'aria nella scheda "Rete Aeraulica" per calcolare il percorso critico e dimensionare il ventilatore.
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
              {/* Highlight Principale: Portata Totale, Prevalenza e Ramo Critico */}
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
                        Ramo Critico: <strong>{calc.criticalPath.sourceName}</strong> (ΔP max = {formatNumber(calc.criticalPath.dp_tot_path, 1)} Pa)
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
                      {formatNumber(calc.P_aria_kW, 3)} <span className="text-xs font-bold text-white/80">kW</span>
                    </p>
                    <p className="text-[10px] text-white/50">
                      all'albero ({calc.hasEta ? `η = ${formatNumber(calc.eta * 100, 0)}%` : `η = ${formatNumber(calc.eta * 100, 0)}% stima`})
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Potenza con Margine (+{calc.margine_perc}%)</p>
                    <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-0.5">
                      {formatNumber(calc.P_prog_tot_kW, 3)} <span className="text-xs font-bold text-white/80">kW</span>
                    </p>
                    <p className="text-[10px] text-emerald-300/70">potenza minima di progetto</p>
                  </div>
                </div>
              </div>

              {/* Schema Topologico della Rete nella schermata Risultati */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-sm font-black text-slate-800 mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
                  <span className="p-1.5 bg-cyan-100 text-cyan-600 rounded-lg"><Network className="w-4 h-4" /></span>
                  Mappa Topologica della Rete Aeraulica e Percorso Critico
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
                  totalFlow_m3h={calc.totalFlow_m3h}
                  dp_tot_ventilatore={calc.dp_tot_ventilatore}
                  fanPower_kW={calc.taglia_IEC_effettiva}
                />
              </div>

              {/* Bilancio Analitico del Percorso Critico */}
              {calc.criticalPath && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-sm font-black text-slate-800 mb-4 pb-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <span className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      Bilancio Perdite del Percorso Critico ({calc.criticalPath.sourceName})
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

                        <tr className="bg-cyan-600 text-white font-black text-xs">
                          <td className="py-3 px-3" colSpan={3}>Pressione Totale Ventilatore Richiesta</td>
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
                  <p className="text-[11px] text-slate-500 mb-4">
                    I rami con perdita inferiore a quella del percorso critico richiederanno una regolazione con serranda di taratura (ΔP da dissipare) per garantire la corretta ripartizione della portata.
                  </p>

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
                          const sbilancio = calc.dp_tot_ventilatore - p.dp_tot_path;

                          return (
                            <tr key={p.sourceId} className={isCrit ? 'bg-amber-50/60 font-bold' : ''}>
                              <td className="py-2.5 px-3 text-slate-800">{p.sourceName} ({p.sourceId})</td>
                              <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{p.segmentIds.join(' ➔ ')}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-800">{formatNumber(p.dp_tot_path, 1)}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-indigo-700">
                                {isCrit ? '0 (Critico)' : formatNumber(sbilancio, 1)}
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
                <h3 className="text-sm font-black text-slate-800 mb-5 pb-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    Selezione Motore Elettrico Commerciale IEC
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Standard Unificato IEC (Norma EN 60034-30)
                  </span>
                </h3>

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

                  {/* Selettore Manuale Taglia Installata */}
                  <div className="lg:col-span-2 border border-slate-200 rounded-2xl p-5 bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
                          Motore Commerciale Effettivamente Installato
                        </label>
                        {data.global.taglia_IEC_installata && (
                          <button
                            type="button"
                            onClick={() => updGlobal('taglia_IEC_installata', null)}
                            className="text-[11px] font-bold text-cyan-600 hover:underline cursor-pointer"
                          >
                            Ripristina suggerito
                          </button>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 mb-3">
                        Puoi confermare la taglia suggerita oppure selezionare una taglia commerciale superiore adottata in cantiere (es. 5,5 kW per forti margini futuri).
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
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
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl p-3">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Coefficiente di Sicurezza Effettivo</p>
                          <p className="text-base font-black text-slate-800 mt-0.5">
                            {formatNumber(calc.coeff_sicurezza_effettivo, 2)}×{' '}
                            <span className="text-[10px] font-medium text-slate-500">
                              (rispetto a {formatNumber(calc.P_singolo_teorica_kW, 3)} kW teorici)
                            </span>
                          </p>
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
                <p className="font-bold text-slate-800 text-sm">+{calc.margine_perc} %</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Configurazione Ventilatori</p>
                <p className="font-bold text-slate-800 text-sm">{data.global.n_titolari} titolari + {data.global.n_riserva} riserva</p>
              </div>
            </div>
          </PrintSection>

          {/* Sezione 2: Schema Topologico Vettoriale */}
          <PrintSection title="2. Schema Topologico Rete Aeraulica (Percorso Critico Evidenziato)">
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
                  <th className="py-1.5 px-2 text-center font-bold">Critico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {calc.segResults.map(({ seg, flow_m3h, res }) => {
                  const isCrit = calc.criticalSegmentIds.has(seg.id);
                  return (
                    <tr key={seg.id} className={isCrit ? 'bg-amber-50/50 font-semibold' : ''}>
                      <td className="py-1.5 px-2">{seg.id}</td>
                      <td className="py-1.5 px-2">{seg.name || '—'}</td>
                      <td className="py-1.5 px-2 whitespace-nowrap">{seg.confluisceInId ? `➔ ${seg.confluisceInId}` : '➔ Ventilatore'}</td>
                      <td className="py-1.5 px-2 text-right">{formatNumber(flow_m3h, 0)}</td>
                      <td className="py-1.5 px-2 text-right">{seg.D_mm}</td>
                      <td className="py-1.5 px-2 text-right">{seg.L_m}</td>
                      <td className="py-1.5 px-2 text-right">{formatNumber(res.v_ms, 2)}</td>
                      <td className="py-1.5 px-2 text-right">{formatNumber(res.dp_dist_Pa, 1)}</td>
                      <td className="py-1.5 px-2 text-right">{formatNumber(res.dp_conc_Pa, 1)}</td>
                      <td className="py-1.5 px-2 text-right font-bold">{formatNumber(res.dp_tot_Pa, 1)}</td>
                      <td className="py-1.5 px-2 text-center">{isCrit ? 'SÌ' : '—'}</td>
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

          {/* Sezione: Bilancio Percorso Critico (a tutta larghezza) */}
          <PrintSection title={`${calc.specResults.length > 0 ? '5.' : '4.'} Bilancio Percorso Critico`}>
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
                <tr className="bg-slate-100 font-bold">
                  <td className="py-2 text-slate-900">Prevalenza Totale Ventilatore Richiesta</td>
                  <td className="py-2 text-right text-slate-900 text-sm">
                    {formatNumber(calc.dp_tot_ventilatore, 1)} Pa ({formatNumber(calc.dp_mmH2O, 2)} mmH₂O)
                  </td>
                </tr>
              </tbody>
            </table>
          </PrintSection>

          {/* Sezione: Dimensionamento Ventilatore & Motore IEC (a tutta larghezza) */}
          <PrintSection title={`${calc.specResults.length > 0 ? '6.' : '5.'} Dimensionamento Ventilatore & Motore IEC`}>
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
                  <td className="py-1.5 text-slate-600">Potenza di Progetto (+{calc.margine_perc}%)</td>
                  <td className="py-1.5 text-right font-bold">{formatNumber(calc.P_prog_tot_kW, 3)} kW</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Taglia Commerciale IEC Suggerita</td>
                  <td className="py-1.5 text-right font-bold text-cyan-700">{calc.taglia_IEC_consigliata} kW</td>
                </tr>
                <tr className="bg-slate-900 text-white font-bold">
                  <td className="py-2 px-2">Motore Commerciale Adottato (per vent.)</td>
                  <td className="py-2 px-2 text-right text-sm">
                    {calc.taglia_IEC_effettiva} kW (K_sic = {formatNumber(calc.coeff_sicurezza_effettivo, 2)}×)
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
