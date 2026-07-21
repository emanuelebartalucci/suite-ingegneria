import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, isFirebaseMock } from '../firebase/config';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import { formatNumber } from '../utils/format';
import { fetchElectricalCables, getCableColor } from '../utils/electricalDbHelper';
import { CableProduct, CAVIDOTTI_DOPPIA_PARETE, POZZETTI_CLS_PRESETS, PozzettoClsPreset, CavidottoDoppiaParete } from '../data/electricalDatabase';
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
}

export interface GruppoCavidotto {
  id: string;
  dn: number;                  // DN nominale (es. 50, 63, 90, 110, 125, 160, 200)
  outerDiameter: number;       // OD (mm)
  innerDiameter: number;       // ID (mm)
  bendingFactor: number;       // default 8
  qty: number;                 // numero di tubi paralleli
  cables: CavoSelezionatoPozzetto[];
  destinationSide?: 'sx' | 'dx' | 'alto' | 'basso';
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
        // Forza tipi e array se mancanti
        return {
          id: existing.id || `parete_${side}_${Date.now()}`,
          side,
          label: existing.label || labels[side],
          destinationSide: existing.destinationSide,
          cavidotti: Array.isArray(existing.cavidotti) ? existing.cavidotti : []
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
      destinationSide: defaultCables.length > 0 ? 'dx' : undefined,
      cavidotti: defaultCables.length > 0 ? [
        {
          id: `cond_mig_${Date.now()}`,
          dn: 90,
          outerDiameter: 110,
          innerDiameter: 92,
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
  const paretiCompliance = pareti.map(w => {
    const wallArea = (w.side === 'sx' || w.side === 'dx') ? innerL * innerH : innerB * innerH;
    let conduitsOuterArea = 0;
    let wallMaxRMin = 0;
    let wallMaxRMinName = '';

    // Raccoglie sia i cavidotti in ingresso su questa parete,
    // sia i cavidotti in uscita da altre pareti che escono da questa
    const ingressCavidotti = w.cavidotti;
    const egressCavidotti: typeof ingressCavidotti = [];
    pareti.forEach(otherW => {
      otherW.cavidotti.forEach(otherCond => {
        if (otherW.side !== w.side && otherCond.destinationSide === w.side) {
          egressCavidotti.push(otherCond);
        }
      });
    });

    const allCavidotti = [...ingressCavidotti, ...egressCavidotti];

    allCavidotti.forEach(cond => {
      // Sezione esterna del cavidotto in cm^2
      const dExtCm = cond.outerDiameter / 10;
      const condOuterSec = (Math.PI * Math.pow(dExtCm / 2, 2)) * cond.qty;
      conduitsOuterArea += condOuterSec;



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

    const fillRate = wallArea > 0 ? (conduitsOuterArea / wallArea) * 100 : 0;
    
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
      conduitsOuterArea,
      fillRate,
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

  // 4. Volume Occupato Cavi (V_c) in cm^3 (con maggiorazione scorta)
  const volumeCaviSenzaScorta = a_tot * l_passaggio;
  const maggiorazioneScorta = volumeCaviSenzaScorta * (p.scortaPct / 100);
  const volumeCaviConScorta = volumeCaviSenzaScorta + maggiorazioneScorta;

  // 5. Grado di riempimento volumetrico complessivo (%)
  const fillRate = volumePozzetto > 0 ? (volumeCaviConScorta / volumePozzetto) * 100 : 0;

  // 6. Raggio Minimo di Curvatura (basato su curva a 90°, quindi R_min e non 2*R_min)
  const maxRMinCm = globalMaxRMin / 10; // mm -> cm
  const spaceRequired = 1.0 * maxRMinCm; // cm (limite fisico reale per curva 90°)
  const dimMin = p.shape === 'rettangolare' ? Math.min(innerB, innerL) : innerB;

  const bendingRadiusOk = dimMin >= spaceRequired;
  const bendingRadiusClose = dimMin >= spaceRequired && dimMin < 1.25 * maxRMinCm;

  // 7. Verifica Fill Rate delle Pareti (soglia CEI 40%)
  const worstWall = paretiCompliance.reduce((prev, curr) => curr.fillRate > prev.fillRate ? curr : prev, paretiCompliance[0]);

  // 8. Esito finale
  let esito: 'verificato' | 'attenzione' | 'rosso' = 'verificato';
  let dettagliVerifica = '';

  if (fillRate > 25 || !bendingRadiusOk || worstWall.fillRate > 40) {
    esito = 'rosso';
    if (worstWall.fillRate > 40) {
      dettagliVerifica = `NON CONFORME: Sovraccarico sulla parete ${worstWall.label} (${formatNumber(worstWall.fillRate, 1)}% > 40% max consentito per posa corrugati).`;
    } else if (fillRate > 25 && !bendingRadiusOk) {
      dettagliVerifica = `NON CONFORME: Riempimento volumetrico critico (${formatNumber(fillRate, 1)}% > 25%) e spazio di curvatura insufficiente. Elemento limitante: ${maxRMinCableName}. Richiesto: ${formatNumber(spaceRequired, 1)} cm, Interno netto pozzetto: ${formatNumber(dimMin, 1)} cm.`;
    } else if (fillRate > 25) {
      dettagliVerifica = `NON CONFORME: Tasso di riempimento volumetrico globale critico (${formatNumber(fillRate, 1)}% > 25% max).`;
    } else {
      dettagliVerifica = `NON CONFORME: Spazio di curvatura insufficiente per la piegatura a 90°. Elemento limitante: ${maxRMinCableName}. Spazio minimo richiesto: ${formatNumber(spaceRequired, 1)} cm, Interno utile pozzetto: ${formatNumber(dimMin, 1)} cm.`;
    }
  } else if (fillRate > 15 || bendingRadiusClose || worstWall.fillRate > 25) {
    esito = 'attenzione';
    if (worstWall.fillRate > 25) {
      dettagliVerifica = `ATTENZIONE: Riempimento elevato sulla parete ${worstWall.label} (${formatNumber(worstWall.fillRate, 1)}% > 25%).`;
    } else if (fillRate > 15 && bendingRadiusClose) {
      dettagliVerifica = `ATTENZIONE: Riempimento elevato (${formatNumber(fillRate, 1)}% > 15%) e spazio di curvatura al limite per la piegatura a 90°. Elemento limitante: ${maxRMinCableName}. Spazio minimo richiesto: ${formatNumber(spaceRequired, 1)} cm (consigliato >= ${formatNumber(1.25 * maxRMinCm, 1)} cm), Interno utile: ${formatNumber(dimMin, 1)} cm.`;
    } else if (fillRate > 15) {
      dettagliVerifica = `ATTENZIONE: Grado di riempimento volumetrico globale elevato (${formatNumber(fillRate, 1)}% > 15%).`;
    } else {
      dettagliVerifica = `ATTENZIONE: Spazio di curvatura al limite per la piegatura a 90°. Elemento limitante: ${maxRMinCableName}. Spazio minimo richiesto: ${formatNumber(spaceRequired, 1)} cm (consigliato >= ${formatNumber(1.25 * maxRMinCm, 1)} cm), Interno utile: ${formatNumber(dimMin, 1)} cm.`;
    }
  } else {
    esito = 'verificato';
    dettagliVerifica = `VERIFICATO: Riempimento volumetrico ottimale (${formatNumber(fillRate, 1)}% <= 15%), riempimento pareti conforme ed elemento limitante verificato per la posa (${maxRMinCableName} con ${formatNumber(dimMin, 1)} cm >= richiesto ${formatNumber(spaceRequired, 1)} cm).`;
  }

  return {
    volumePozzetto,
    a_tot,
    l_passaggio,
    volumeCaviSenzaScorta,
    maggiorazioneScorta,
    volumeCaviConScorta,
    fillRate,
    riempimentoPct: fillRate,
    maxRMin: globalMaxRMin,
    maxRMinCm,
    spaceRequired,
    dimMin,
    bendingRadiusOk,
    bendingRadiusClose,
    esito,
    dettagliVerifica,
    maxRMinCableName,
    pesoTotCaviLineare,
    dMax,
    paretiCompliance,
    worstWallFillRate: worstWall.fillRate,
    innerB,
    innerL,
    innerH
  };
}

const PozzettoGraficaDettaglio: React.FC<{
  pozzetto: PozzettoProgetto;
  compliance: any;
  cablesCatalog: CableProduct[];
}> = ({ pozzetto, compliance, cablesCatalog }) => {
  const [activeWallSide, setActiveWallSide] = useState<'sx' | 'dx' | 'alto' | 'basso'>('sx');
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

    const maxDim = isRect ? Math.max(B, L) : D;
    const scale = Math.min((360 - 80) / maxDim, (280 - 80) / maxDim);

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
      drawDimensionLine(ctx, xStartExt, yStartExt, xStartExt + wExtScaled, yStartExt, `${B} cm (Est)`, -30, false);
      drawDimensionLine(ctx, xStartExt, yStartExt, xStartExt, yStartExt + hExtScaled, `${L} cm (Est)`, -30, true);
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
      
      // Calcola larghezza totale occupata dai corrugati per centrarli sulla parete
      const totalWidth = w.cavidotti.reduce((acc, c) => acc + (c.outerDiameter/10) * scale * c.qty, 0);
      let currentOffset = -totalWidth / 2;

      w.cavidotti.forEach(cond => {
        const dExtScaled = (cond.outerDiameter / 10) * scale;
        
        for (let q = 0; q < cond.qty; q++) {
          ctx.save();
          ctx.fillStyle = 'rgba(59, 130, 246, 0.85)'; // Blu Cavidotto
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 0.8;

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
            // Righe corrugate
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 0.5;
            for (let ox = 0; ox < Math.abs(rw); ox += 3) {
              ctx.beginPath();
              ctx.moveTo(rx + (rw < 0 ? -ox : ox), ry);
              ctx.lineTo(rx + (rw < 0 ? -ox : ox), ry + rh);
              ctx.stroke();
            }
          } else {
            rx = coords.x + currentOffset;
            rw = dExtScaled;
            rh = coords.dy;
            ctx.fillRect(rx, ry, rw, rh);
            ctx.strokeRect(rx, ry, rw, rh);
            // Righe corrugate
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 0.5;
            for (let oy = 0; oy < Math.abs(rh); oy += 3) {
              ctx.beginPath();
              ctx.moveTo(rx, ry + (rh < 0 ? -oy : oy));
              ctx.lineTo(rx + rw, ry + (rh < 0 ? -oy : oy));
              ctx.stroke();
            }
          }
          ctx.restore();
          // Se c'è una curva/destinazione, traccia i cavi passanti
          if (cond.destinationSide && cond.destinationSide !== w.side) {
            const destCoords = sideCoords[cond.destinationSide];
            
            // Coord d'inizio e fine curva
            const startX = w.side === 'sx' || w.side === 'dx' ? coords.x : coords.x + currentOffset + dExtScaled/2;
            const startY = w.side === 'sx' || w.side === 'dx' ? coords.y + currentOffset + dExtScaled/2 : coords.y;
            
            let endX = destCoords.x;
            let endY = destCoords.y;

            // Calcola le coordinate del tubo di uscita sulla parete di destinazione
            let erx = destCoords.x;
            let ery = destCoords.y;
            let erw = 0;
            let erh = 0;

            if (cond.destinationSide === 'sx' || cond.destinationSide === 'dx') {
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

            // Disegna il tubo di uscita corrispondente
            ctx.save();
            ctx.fillStyle = 'rgba(59, 130, 246, 0.85)'; // Blu Cavidotto
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 0.8;
            ctx.fillRect(erx, ery, erw, erh);
            ctx.strokeRect(erx, ery, erw, erh);
            // Righe corrugate per il tubo di uscita
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 0.5;
            if (cond.destinationSide === 'sx' || cond.destinationSide === 'dx') {
              for (let ox = 0; ox < Math.abs(erw); ox += 3) {
                ctx.beginPath();
                ctx.moveTo(erx + (erw < 0 ? -ox : ox), ery);
                ctx.lineTo(erx + (erw < 0 ? -ox : ox), ery + erh);
                ctx.stroke();
              }
            } else {
              for (let oy = 0; oy < Math.abs(erh); oy += 3) {
                ctx.beginPath();
                ctx.moveTo(erx, ery + (erh < 0 ? -oy : oy));
                ctx.lineTo(erx + erw, ery + (erh < 0 ? -oy : oy));
                ctx.stroke();
              }
            }
            ctx.restore();

            // Disegna i cavi passanti all'interno con curve Bezier
            cond.cables.forEach((c, cIdx) => {
              ctx.save();
              ctx.strokeStyle = getCableColor(c.cableId);
              ctx.lineWidth = Math.max(1.2, (c.diameter/10) * scale * 0.45);
              ctx.beginPath();
              ctx.moveTo(startX, startY);

              // Control point all'angolo corrispondente
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
            });
          }

          currentOffset += dExtScaled;
        }
      });
    });

    const url = canvas.toDataURL('image/png');
    setImgUrlPianta(url);
  }, [pozzetto, compliance, activeWallSide]);

  // 2. Render Sezione Parete (Skyline packing dei corrugati)
  useEffect(() => {
    const canvas = canvasSezioneRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, 360, 280);

    const pad = 25;
    const wallW = (activeWallSide === 'sx' || activeWallSide === 'dx') ? innerL : innerB;
    const wallH = innerH;

    const scale = Math.min((360 - 2 * pad) / wallW, (280 - 2 * pad) / wallH);
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
    drawDimensionLine(ctx, xStart, yStart, xStart + wScaled, yStart, `${formatNumber(wallW, 0)} cm`, -15, false);
    drawDimensionLine(ctx, xStart, yStart, xStart, yStart + hScaled, `${formatNumber(wallH, 0)} cm`, -15, true);

    const pareti = ensurePozzettoPareti(pozzetto);
    const activeWall = pareti.find(w => w.side === activeWallSide);
    
    const ingressCavidotti = activeWall ? activeWall.cavidotti : [];
    const egressCavidotti: typeof ingressCavidotti = [];
    pareti.forEach(w => {
      w.cavidotti.forEach(cond => {
        if (w.side !== activeWallSide && cond.destinationSide === activeWallSide) {
          egressCavidotti.push(cond);
        }
      });
    });

    const allCavidotti = [...ingressCavidotti, ...egressCavidotti];

    if (allCavidotti.length > 0) {
      // Distribuiamo i cavidotti in file ordinate partendo dal basso
      let curX = xStart;
      let curY = yStart + hScaled;
      let rowHeight = 0;

      allCavidotti.forEach(cond => {
        const rExtScaled = ((cond.outerDiameter / 10) / 2) * scale;
        const dExtScaled = rExtScaled * 2;
        const rIntScaled = ((cond.innerDiameter / 10) / 2) * scale;

        for (let q = 0; q < cond.qty; q++) {
          // Va accapo se esce dalla parete
          if (curX + dExtScaled > xStart + wScaled) {
            curX = xStart;
            curY -= rowHeight + 3;
            rowHeight = 0;
          }

          const cx = curX + rExtScaled;
          const cy = curY - rExtScaled;

          // Disegna Cavidotto (Corrugato)
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, rExtScaled, 0, 2 * Math.PI);
          ctx.fillStyle = '#3b82f6'; // Blu
          ctx.fill();
          ctx.strokeStyle = '#1d4ed8';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Interno Cavidotto
          ctx.beginPath();
          ctx.arc(cx, cy, rIntScaled, 0, 2 * Math.PI);
          ctx.fillStyle = '#ffffff'; // Bianco
          ctx.fill();
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 0.8;
          ctx.stroke();
          ctx.restore();

          // Disegna i cavi all'interno del corrugato (Concentric ring packing)
          if (cond.cables.length > 0) {
            const flatCables: string[] = [];
            cond.cables.forEach(c => {
              for (let i = 0; i < c.qty; i++) {
                flatCables.push(getCableColor(c.cableId));
              }
            });

            // Disegna i cavi disposti a spirale nel centro del tubo
            flatCables.forEach((color, idx) => {
              const cRadius = (1.5 * scale); // raggio cavi ridotto in scala per entrare
              const angle = idx * 1.4;
              const radius = Math.min(rIntScaled - cRadius - 1, (idx * 0.9 + 1.2) * scale);
              const ccx = cx + Math.cos(angle) * radius;
              const ccy = cy + Math.sin(angle) * radius;

              ctx.save();
              ctx.beginPath();
              ctx.arc(ccx, ccy, cRadius, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
              ctx.strokeStyle = 'rgba(0,0,0,0.4)';
              ctx.lineWidth = 0.5;
              ctx.stroke();
              ctx.restore();
            });
          }

          curX += dExtScaled + 4;
          rowHeight = Math.max(rowHeight, dExtScaled);
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
      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
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
        <div className="flex gap-2">
          <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black px-2.5 py-1 rounded-lg">
            Riempimento Globale: {formatNumber(compliance?.fillRate || 0, 1)}%
          </span>
          <span className="bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-black px-2.5 py-1 rounded-lg">
            Riempimento Parete {activeWallSide.toUpperCase()}: {formatNumber(activeWallComp?.fillRate || 0, 1)}%
          </span>
        </div>
      </div>

      {/* Viste Affiancate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        
        {/* Vista Pianta */}
        <div className="flex flex-col justify-between items-center bg-slate-50/50 border border-slate-100 rounded-2xl p-4 relative">
          <span className="absolute top-3 left-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">VISTA IN PIANTA (Dall'alto)</span>
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
        <div className="flex flex-col justify-between items-center bg-slate-50/50 border border-slate-100 rounded-2xl p-4 relative">
          <span className="absolute top-3 left-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">SEZIONE PARETE {activeWallSide.toUpperCase()}</span>
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
  importedCables,
  clearImportedCables
}: ToolDimensionamentoPozzettiElettriciProps) {

  const [state, setState] = useState<ToolState>(defaultState);
  const [cablesCatalog, setCablesCatalog] = useState<CableProduct[]>(propCablesCatalog || []);
  const [loadingDb, setLoadingDb] = useState<boolean>(false);
  const [configWallSide, setConfigWallSide] = useState<'sx' | 'dx' | 'alto' | 'basso'>('sx');

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
          const name = `Pozzetto da Canala`;
          
          let importedConduits: GruppoCavidotto[] = [];
          if (payloadConduit) {
            importedConduits = [{
              id: `cond_${Date.now()}`,
              dn: payloadConduit.outerDiameter || 90, // Mappiamo DN sul diametro esterno di provenienza
              outerDiameter: payloadConduit.outerDiameter || 110,
              innerDiameter: payloadConduit.innerDiameter || 92,
              bendingFactor: 8,
              qty: 1,
              destinationSide: 'dx',
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
            // Default DN90
            importedConduits = [{
              id: `cond_default_${Date.now()}`,
              dn: 90,
              outerDiameter: 110,
              innerDiameter: 92,
              bendingFactor: 8,
              qty: 1,
              destinationSide: 'dx',
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

  // Gestione pareti/cavidotti/cavi
  const handleAddCavidotto = (side: 'sx' | 'dx' | 'alto' | 'basso') => {
    const newCond: GruppoCavidotto = {
      id: `cond_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      dn: 90,
      outerDiameter: 110,
      innerDiameter: 92,
      bendingFactor: 8,
      qty: 1,
      cables: [],
      destinationSide: side === 'sx' ? 'dx' : side === 'dx' ? 'sx' : side === 'alto' ? 'basso' : 'alto'
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

  const handleUpdateCavidotto = (side: 'sx' | 'dx' | 'alto' | 'basso', condId: string, field: keyof GruppoCavidotto, value: any) => {
    const updatedPareti = activePozzetto.pareti.map(w => {
      if (w.side === side) {
        return {
          ...w,
          cavidotti: w.cavidotti.map(c => {
            if (c.id === condId) {
              const updatedCond = { ...c, [field]: value } as GruppoCavidotto;
              
              if (field === 'dn') {
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
                        value={activePozzetto.baseB}
                        onChange={e => updatePozzettoField(activePozzetto.tag, 'baseB', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-50 disabled:opacity-60 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Lunghezza L (cm)</label>
                      <input
                        type="number"
                        min="1"
                        disabled={activePozzetto.presetSize !== 'custom'}
                        value={activePozzetto.lengthL}
                        onChange={e => updatePozzettoField(activePozzetto.tag, 'lengthL', parseFloat(e.target.value) || 0)}
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
                      value={activePozzetto.diameterD}
                      onChange={e => updatePozzettoField(activePozzetto.tag, 'diameterD', parseFloat(e.target.value) || 0)}
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
                    value={activePozzetto.depthH}
                    onChange={e => updatePozzettoField(activePozzetto.tag, 'depthH', parseFloat(e.target.value) || 0)}
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
                    {/* Elenco Cavidotti */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-slate-700 uppercase tracking-wide">Cavidotti / Corrugati ({w.cavidotti.length})</span>
                        <button
                          type="button"
                          onClick={() => handleAddCavidotto(configWallSide)}
                          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Cavidotto
                        </button>
                      </div>

                      {w.cavidotti.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400 font-semibold border-2 border-dashed border-slate-200 rounded-2xl">
                          Nessun cavidotto installato su questa parete. Clicca su "+ Cavidotto".
                        </div>
                      ) : (
                        w.cavidotti.map((cond, condIdx) => (
                          <div key={cond.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                            {/* Dati Cavidotto */}
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-xs font-black text-slate-700">Cavidotto #{condIdx + 1}</span>
                                
                                {/* Diametro DN */}
                                <div>
                                  <select
                                    value={cond.dn}
                                    onChange={e => handleUpdateCavidotto(configWallSide, cond.id, 'dn', parseInt(e.target.value))}
                                    className="bg-white border border-slate-200 rounded-lg p-1 text-[11px] font-bold text-slate-700"
                                  >
                                    <option value="50">DN 50 (Est: 63, Int: 50 mm)</option>
                                    <option value="63">DN 63 (Est: 75, Int: 63 mm)</option>
                                    <option value="90">DN 90 (Est: 110, Int: 92 mm)</option>
                                    <option value="110">DN 110 (Est: 125, Int: 105 mm)</option>
                                    <option value="125">DN 125 (Est: 140, Int: 125 mm)</option>
                                    <option value="160">DN 160 (Est: 180, Int: 160 mm)</option>
                                    <option value="200">DN 200 (Est: 200, Int: 170 mm)</option>
                                  </select>
                                </div>

                                {/* Qty */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">Tubi:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={cond.qty}
                                    onChange={e => handleUpdateCavidotto(configWallSide, cond.id, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                                    className="bg-white border border-slate-200 rounded-lg p-1 text-[11px] w-12 text-center"
                                  />
                                </div>

                                {/* Bending Factor */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">k Raggio:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={cond.bendingFactor}
                                    onChange={e => handleUpdateCavidotto(configWallSide, cond.id, 'bendingFactor', Math.max(1, parseInt(e.target.value) || 8))}
                                    className="bg-white border border-slate-200 rounded-lg p-1 text-[11px] w-12 text-center"
                                  />
                                  <span className="text-[10px] text-slate-400 font-bold">xDN ({cond.bendingFactor * cond.dn} mm)</span>
                                </div>

                                {/* Tratta di Uscita */}
                                <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">Uscita:</span>
                                  <select
                                    value={cond.destinationSide || ''}
                                    onChange={e => handleUpdateCavidotto(configWallSide, cond.id, 'destinationSide', e.target.value ? e.target.value as any : undefined)}
                                    className="bg-white border border-slate-200 rounded-lg p-1 text-[11px] font-bold text-slate-700"
                                  >
                                    <option value="">Termina</option>
                                    <option value="sx" disabled={configWallSide === 'sx'}>SX</option>
                                    <option value="dx" disabled={configWallSide === 'dx'}>DX</option>
                                    <option value="alto" disabled={configWallSide === 'alto'}>ALTO</option>
                                    <option value="basso" disabled={configWallSide === 'basso'}>BASSO</option>
                                  </select>
                                </div>
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
                                <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 p-2 shadow-2xs">
                                  <table className="w-full text-left text-[11px] divide-y divide-slate-100">
                                    <thead>
                                      <tr className="text-slate-400 uppercase font-black tracking-wide text-[9px]">
                                        <th className="py-2 px-1">Sigla</th>
                                        <th className="py-2 px-1">Cavo</th>
                                        <th className="py-2 px-1">Formazione</th>
                                        <th className="py-2 px-1 text-center">Q.tà</th>
                                        <th className="py-2 px-1 text-center">Ø [mm]</th>
                                        <th className="py-2 px-1 text-center">R_min</th>
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

                                        return (
                                          <tr key={cIdx} className="hover:bg-slate-50/50">
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
                              )}
                            </div>
                          </div>
                        ))
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
                let totalCablesQty = 0;
                activePareti.forEach(w => {
                  w.cavidotti.forEach(cond => {
                    totalCablesQty += cond.cables.length;
                  });
                });

                return (
                  <tr key={pozz.tag} className="border-b border-slate-200">
                    <td className="py-3 px-3 font-bold text-slate-800">{pozz.name}</td>
                    <td className="py-3 px-2">
                      <div className="font-semibold">
                        {pozz.shape === 'rettangolare' ? 'Rettangolare' : 'Cilindrico'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {pozz.shape === 'rettangolare' 
                          ? `${pozz.baseB}x${pozz.lengthL}x${pozz.depthH}` 
                          : `Ø ${pozz.diameterD}x${pozz.depthH}`}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right font-mono font-semibold">
                      {formatNumber(calc.volumePozzetto / 1000, 1)} L
                    </td>
                    <td className="py-3 px-2">
                      {totalCablesQty === 0 ? (
                        <span className="text-slate-400 italic text-[10px]">Vuoto</span>
                      ) : (
                        <div className="space-y-2">
                          {activePareti.map(w => {
                            if (w.cavidotti.length === 0) return null;
                            return (
                              <div key={w.side} className="border-b border-slate-100 last:border-0 pb-1 last:pb-0">
                                <span className="text-[9px] font-black text-indigo-700 uppercase block">{w.label}</span>
                                {w.cavidotti.map((cond, condIdx) => (
                                  <div key={cond.id} className="pl-1 mt-0.5">
                                    <span className="text-[9px] font-bold text-slate-500">Cavidotto #{condIdx + 1} (DN {cond.dn} x {cond.qty} tubi - R_min cavidotto: {(cond.bendingFactor || 8) * cond.dn} mm) {cond.destinationSide && `→ Uscita: ${cond.destinationSide.toUpperCase()}`}:</span>
                                    <div className="pl-2 space-y-0.5">
                                      {cond.cables.map((c, cIdx) => {
                                        const prod = cablesCatalog.find(p => p.id === c.cableId);
                                        const name = c.cableId === 'personalizzato' ? 'Cavo Personalizzato' : (prod?.name || c.cableId);
                                        let bendingFactor = 12;
                                        if (c.cableId === 'personalizzato') bendingFactor = c.customBendingFactor || 12;
                                        else bendingFactor = prod?.raggioCurvaturaMinFattore || 12;

                                        return (
                                          <div key={cIdx} className="text-[10px] leading-tight text-slate-650 flex flex-wrap gap-x-2">
                                            <span>[{c.sigla}] <strong>{name}</strong> ({c.formation})</span>
                                            <span>Q.tà: <strong>{c.qty}</strong></span>
                                            <span>Ø: <strong>{formatNumber(c.diameter, 1)} mm</strong></span>
                                            <span>R_min: <strong>{bendingFactor * c.diameter} mm</strong></span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right font-mono">
                      <div><strong>{formatNumber(calc.volumeCaviConScorta / 1000, 2)} L</strong></div>
                      <div className="text-[10px] text-slate-500">Scorta: +{pozz.scortaPct}%</div>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        calc.esito === 'verificato' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                        calc.esito === 'attenzione' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                        'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        {calc.esito === 'verificato' ? 'Idoneo' : calc.esito === 'attenzione' ? 'Attenzione' : 'Non Idoneo'} • {formatNumber(calc.fillRate, 1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="print:break-before-page w-full">
          <h4 className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4 uppercase tracking-wider">
            Rappresentazione Sezioni e Piante Pozzetti
          </h4>
          <div className="space-y-8">
            {state.pozzetti.map(p => {
              const comp = calcolaCompliancePozzetto(p, cablesCatalog);
              if (!comp) return null;
              return (
                <div key={p.tag} className="border border-slate-200 rounded-2xl p-4 bg-white flex flex-col items-center print:break-inside-avoid">
                  <span className="text-xs font-bold text-slate-800 mb-2">{p.name}</span>
                  <div className="w-full max-w-2xl">
                    <PozzettoGraficaDettaglio
                      pozzetto={p}
                      compliance={comp}
                      cablesCatalog={cablesCatalog}
                    />
                  </div>
                  <div className="text-[10px] font-bold text-slate-550 mt-2">
                    Riempimento Pareti: {comp.paretiCompliance.map(wc => `${wc.side.toUpperCase()}: ${formatNumber(wc.fillRate, 1)}%`).join(' | ')}
                  </div>
                </div>
              );
            })}
          </div>
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
            <div className="shrink-0 flex items-center gap-2 border border-slate-350 bg-slate-50 px-3 py-1.5 rounded-lg text-slate-800 font-bold">
              <span className="text-xs">📜</span>
              <span className="text-[10px] font-black uppercase tracking-wider">Verifica Raggi da PDF</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
