import React, { useState, useMemo } from 'react';
import logoImg from '../assets/Logo.png';
import { createPortal } from 'react-dom';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import { formatNumber } from '../utils/format';
import TopologicalTree, { TrattoNode } from '../components/TopologicalTree';
import { PIPE_CATALOG, INSULATION_CATALOG, getExternalDiameter } from '../data/pipeCatalog';
import { getEquivalentLength } from '../data/equivalentLengths';
import { 
  IconArrowUp, 
  IconPlus, 
  IconTrash, 
  IconCopy 
} from '../components/Icons';

interface ToolVerificaLineeProps {
  projectData: ProjectData;
  setProjectData: (data: any) => void;
  setAppMode: (mode: string) => void;
}

interface TrattoLine {
  id: number;
  tag: string;
  name: string;
  portata: number | string;
  material: string;
  DN: string;
  PN: string;
  length: number | string;
  n_valvole: number | string;
  n_riduzioni: number | string;
  n_curve: number | string;
  n_tee: number | string;
  hierarchy: string;
  parentId: number | null;
  isoType: string;
  isoThick: number | string;
  isoLambda: number | string;
  tAmb: number | string;
  D?: number | string;
  roughness?: number | string;

  // --- NUOVI CAMPI FASE 1 ---
  /** 'aspirazione' | 'mandata' — visibile solo se collegaPompaggio è attivo */
  tipoCondotto?: 'aspirazione' | 'mandata';
  /** Temperatura specifica del tratto (°C); se vuota usa la temp. globale */
  tempLocalizzata?: number | string;
  /** Dislivello geodetico (m): quota_arrivo - quota_partenza (negativo = discesa) */
  dislivelloGeodetico?: number | string;
  /** Pressione minima richiesta al nodo di arrivo (barg) */
  pressioneMinimaRichiesta?: number | string;

  // --- NUOVI CAMPI FASE 2: perdite concentrate aggiuntive ---
  /** Metodo inserimento perdita valvola: 'diretta' (Pa) | 'kvs' (m³/h) */
  valvolaInputMode?: 'diretta' | 'kvs';
  /** Perdita diretta valvola di regolazione (Pa) */
  valvolaPerdita?: number | string;
  /** Kvs valvola di regolazione (m³/h) */
  valvolaKvs?: number | string;
  /** Tratti da includere nel calcolo del circuito per l'autorità (id[]) */
  valvolaCircuitoIds?: number[];
  /** Perdita scambiatore di calore (kPa) */
  scambiatorePerdita?: number | string;
  /** Altre perdite concentrate aggiuntive (Pa) */
  altrePerdite?: number | string;

  // Calcolati (base)
  d_int?: number;
  d_ext?: number;
  t_surf?: number;
  t_pipe_ext?: number;
  t_pipe_int?: number;
  area_m2?: number;
  velocity?: number;
  Re?: number;
  roughnessRel?: number;
  lambda?: number;
  leq_valvola?: number;
  leq_riduzione?: number;
  leq_curva?: number;
  leq_tee?: number;
  leq_tot?: number;
  loss_dist_Pa?: number;
  loss_conc_Pa?: number;
  loss_tot_Pa?: number;
  loss_tot_mbar?: number;
  loss_tot_mH2O?: number;
  // Calcolati (Fase 2)
  rho_locale?: number;          // densità calcolata con tempLocalizzata
  visc_locale?: number;         // viscosità calcolata con tempLocalizzata
  loss_valvola_Pa?: number;     // perdita valvola di reg. (Pa)
  valvola_autorita?: number;    // autorità valvola (0-1)
  loss_scambiatore_Pa?: number; // perdita scambiatore (Pa)
  loss_altre_Pa?: number;       // altre perdite (Pa)
  loss_aggiuntive_Pa?: number;  // somma perdite aggiuntive (Pa)
  loss_gran_tot_Pa?: number;    // perdita totale incluse aggiuntive + geodesia
  contributo_geodesia_Pa?: number; // contributo pressione geodetica (Pa, positivo = guadagno)
  pressioneNodo?: number;       // pressione al nodo di arrivo (barg)
}

// Helper per la formattazione e conversione della pressione
const formatPressureVal = (valPa: number, unit: string): string => {
  if (unit === 'Pa') return formatNumber(Math.round(valPa), 0);
  if (unit === 'kPa') return formatNumber(valPa / 1000, 2);
  if (unit === 'mH2O') return formatNumber(valPa / 9806.65, 3);
  return formatNumber(valPa / 100, 1);
};

const getPressureUnitLabel = (unit: string): string => {
  if (unit === 'Pa') return 'Pa';
  if (unit === 'kPa') return 'kPa';
  if (unit === 'mH2O') return 'm.c.a.';
  return 'mbar';
};

// Calcola densità e viscosità del fluido a una data temperatura e percentuali di glicole
function computeFluidPropsAtT(T: number, xEt: number, xPr: number): { rho: number; visc: number } {
    const rho_water = 1000 * (1 - ((T + 288.9414) / (508929.2 * (T + 68.12963))) * Math.pow(T - 3.9863, 2));
    const visc_water = 0.00179 / (1 + 0.0337 * T + 0.00022 * Math.pow(T, 2));
    const rho  = rho_water  + xEt*(160-0.35*T) + Math.pow(xEt,2)*30 + xPr*(105-0.4*T) + Math.pow(xPr,2)*20;
    const visc = visc_water * (1 + (2.5+0.02*T)*xEt + (10-0.05*T)*Math.pow(xEt,2) + (3.0+0.03*T)*xPr + (18-0.1*T)*Math.pow(xPr,2));
    return { rho: Number(rho.toFixed(1)), visc: Number(visc.toFixed(6)) };
}

// Risolutore iterativo Colebrook-White
function solveColebrookWhite(Re: number, roughnessRel: number): number {
  if (Re <= 0) return 0;
  if (Re <= 2300) {
    return 64 / Re;
  }
  
  // Stima iniziale tramite Haaland
  let f = 0.02;
  if (Re > 4000) {
    const temp = Math.pow((roughnessRel / 3.71), 1.11) + 6.9 / Re;
    f = 1 / Math.pow(-1.8 * Math.log10(temp), 2);
  }

  // Risoluzione a punto fisso
  let x = 1 / Math.sqrt(f);
  for (let i = 0; i < 20; i++) {
    const term = (roughnessRel / 3.71) + (2.51 / (Re * x));
    if (term <= 0) break;
    x = -2 * Math.log10(term);
  }
  return 1 / (x * x);
}

// Componente per disegnare la sezione geometrica del tubo sovrapposta al grafico del gradiente termico radiale
interface SVGGradienteSovrappostoProps {
  tratto: TrattoLine;
  fluidTemp: number | string;
}

interface YLabelItem {
  id: string;
  val: number;
  label: string;
  color: string;
  isBold: boolean;
  targetY: number;
  adjustedY?: number;
}

interface XLabelItem {
  id: string;
  label: string;
  color: string;
  targetX: number;
  adjustedX?: number;
}

function SVGGradienteSovrapposto({ tratto, fluidTemp }: SVGGradienteSovrappostoProps) {
  if (!tratto || !tratto.d_int) return null;

  const ri = tratto.d_int / 2; // Raggio interno in mm
  const re = (tratto.d_ext || (tratto.d_int + 10)) / 2; // Raggio esterno in mm
  const s_iso = Number(tratto.isoThick) || 0;
  const riso = re + s_iso; // Raggio complessivo isolato in mm

  const tf = Number(fluidTemp) || 55;
  const ta = tratto.tAmb !== undefined ? Number(tratto.tAmb) : -5;
  const t_int_tubo = tratto.t_pipe_int !== undefined ? tratto.t_pipe_int : tf;
  const t_ext_tubo = tratto.t_pipe_ext !== undefined ? tratto.t_pipe_ext : tf;
  const t_s = tratto.t_surf !== undefined ? tratto.t_surf : tf;

  // Raggio massimo da mostrare sull'asse X (estendiamo oltre l'isolamento per mostrare l'aria ambiente)
  const R_max = riso * 1.35;

  // Coordinate e dimensioni dell'asse cartesiano
  const originX = 45;
  const originY = 145;
  const graphWidth = 220;
  const graphHeight = 110;

  const getX = (r: number) => {
    return originX + (r / R_max) * graphWidth;
  };

  const tMin = Math.min(tf, ta) - 5;
  const tMax = Math.max(tf, ta) + 5;
  const getY = (temp: number) => {
    const range = tMax - tMin || 1;
    return originY - ((temp - tMin) / range) * graphHeight;
  };

  // Raggi convertiti in pixel per il disegno dei quarti di cerchio concentrici
  const R_i_px = (ri / R_max) * graphWidth;
  const R_e_px = (re / R_max) * graphWidth;
  const R_iso_px = (riso / R_max) * graphWidth;

  const isNoneIso = tratto.isoType === 'none';

  // Colore di riempimento dell'isolante
  let isoColor = "rgba(226, 232, 240, 0.25)"; // Grigio default
  if (tratto.isoType === 'pur') isoColor = "rgba(254, 240, 138, 0.4)"; // Giallo PUR
  if (tratto.isoType === 'rockwool') isoColor = "rgba(253, 224, 71, 0.35)"; // Lana di roccia
  if (tratto.isoType === 'rubber') isoColor = "rgba(51, 65, 85, 0.25)"; // Gomma nera

  // --- RISOLUTORE SOVRAPPOSIZIONI TESTI ---
  const adjustYLabels = (y1: number, y2: number, y3: number, minSpace = 10): [number, number, number] => {
    let ay1 = y1;
    let ay2 = y2;
    let ay3 = y3;
    if (ay2 - ay1 < minSpace) {
      const overlap = minSpace - (ay2 - ay1);
      ay1 -= overlap / 2;
      ay2 += overlap / 2;
    }
    if (ay3 - ay2 < minSpace) {
      const overlap = minSpace - (ay3 - ay2);
      ay2 -= overlap / 2;
      ay3 += overlap / 2;
      if (ay2 - ay1 < minSpace) {
        ay1 = ay2 - minSpace;
      }
    }
    return [ay1, ay2, ay3];
  };

  const adjustXLabels = (x1: number, x2: number, x3: number | null, minSpace = 28): [number, number, number | null] => {
    let ax1 = x1;
    let ax2 = x2;
    if (x3 === null) {
      if (ax2 - ax1 < minSpace) {
        const overlap = minSpace - (ax2 - ax1);
        ax1 -= overlap / 2;
        ax2 += overlap / 2;
      }
      return [ax1, ax2, null];
    } else {
      let ax3 = x3;
      if (ax2 - ax1 < minSpace) {
        const overlap = minSpace - (ax2 - ax1);
        ax1 -= overlap / 2;
        ax2 += overlap / 2;
      }
      if (ax3 - ax2 < minSpace) {
        const overlap = minSpace - (ax3 - ax2);
        ax2 -= overlap / 2;
        ax3 += overlap / 2;
        if (ax2 - ax1 < minSpace) {
          ax1 = ax2 - minSpace;
        }
      }
      return [ax1, ax2, ax3];
    }
  };

  // Configurazione etichette asse Y
  const yLabelsData: YLabelItem[] = [
    { id: 'tf', val: tf, label: `${formatNumber(tf, 0)}°C`, color: '#2563eb', isBold: true, targetY: getY(tf) },
    { id: 'ts', val: t_s, label: `${formatNumber(t_s, 1)}°C`, color: '#b91c1c', isBold: true, targetY: getY(t_s) },
    { id: 'ta', val: ta, label: `${formatNumber(ta, 0)}°C`, color: '#475569', isBold: false, targetY: getY(ta) }
  ];
  yLabelsData.sort((a, b) => a.targetY - b.targetY);
  const [yA_adj, yB_adj, yC_adj] = adjustYLabels(yLabelsData[0].targetY, yLabelsData[1].targetY, yLabelsData[2].targetY, 10);
  yLabelsData[0].adjustedY = yA_adj;
  yLabelsData[1].adjustedY = yB_adj;
  yLabelsData[2].adjustedY = yC_adj;

  // Configurazione etichette asse X
  const showIsoX = !isNoneIso && s_iso > 0;
  const xLabelsData: XLabelItem[] = [
    { id: 'ri', label: 'Ø_int', color: '#2563eb', targetX: getX(ri) },
    { id: 're', label: 'Ø_est', color: '#475569', targetX: getX(re) }
  ];
  if (showIsoX) {
    xLabelsData.push({ id: 'riso', label: 'Ø_iso', color: '#d97706', targetX: getX(riso) });
  }
  const [xA_adj, xB_adj, xC_adj] = adjustXLabels(xLabelsData[0].targetX, xLabelsData[1].targetX, showIsoX ? xLabelsData[2].targetX : null, 28);
  xLabelsData[0].adjustedX = xA_adj;
  xLabelsData[1].adjustedX = xB_adj;
  if (showIsoX && xC_adj !== null) {
    xLabelsData[2].adjustedX = xC_adj;
  }

  // --- PUNTI DELLA CURVA DI TEMPERATURA ---
  
  // 1. ZONA FLUIDO (costante a tf, ma con caduta convettiva vicino alla parete)
  const fluidPoints: string[] = [];
  const numFluidPoints = 10;
  const r_start_conv = ri * 0.75;
  for (let i = 0; i <= numFluidPoints; i++) {
    const r = (r_start_conv * i) / numFluidPoints;
    fluidPoints.push(`${getX(r)},${getY(tf)}`);
  }
  const numConvPoints = 5;
  for (let i = 1; i <= numConvPoints; i++) {
    const fraction = i / numConvPoints;
    const r = r_start_conv + fraction * (ri - r_start_conv);
    const t = fraction;
    const temp = tf + (t_int_tubo - tf) * (3 * t*t - 2 * t*t*t);
    fluidPoints.push(`${getX(r)},${getY(temp)}`);
  }

  // 2. ZONA PARETE TUBO (lineare tra ri e re)
  const wallPath = `M ${getX(ri)},${getY(t_int_tubo)} L ${getX(re)},${getY(t_ext_tubo)}`;

  // 3. ZONA ISOLANTE (caduta logaritmica pronunciata tra re e riso)
  const isoPoints: string[] = [];
  const numIsoPoints = 15;
  for (let i = 0; i <= numIsoPoints; i++) {
    const fraction = i / numIsoPoints;
    const r = re + fraction * s_iso;
    let temp = t_ext_tubo;
    if (s_iso > 0 && Math.abs(t_ext_tubo - t_s) > 0.01) {
      temp = t_ext_tubo - (t_ext_tubo - t_s) * (Math.log(r / re) / Math.log(riso / re));
    }
    isoPoints.push(`${getX(r)},${getY(temp)}`);
  }
  const isoPath = `M ${isoPoints.join(' L ')}`;

  // 4. ZONA ARIA ESTERNA (convezione esterna, decadimento esponenziale verso tAmb)
  const airPoints: string[] = [];
  const numAirPoints = 15;
  const rStartAir = riso;
  const rEndAir = R_max;
  for (let i = 0; i <= numAirPoints; i++) {
    const fraction = i / numAirPoints;
    const r = rStartAir + fraction * (rEndAir - rStartAir);
    const temp = ta + (t_s - ta) * Math.exp(-3 * fraction);
    airPoints.push(`${getX(r)},${getY(temp)}`);
  }
  const airPath = `M ${airPoints.join(' L ')}`;

  return (
    <div className="space-y-3 print:space-y-2">
      <svg width="100%" height="180" viewBox="0 0 300 180" className="mx-auto select-none font-sans bg-slate-900/5 border border-slate-200 rounded-xl p-2 print:h-auto print:bg-transparent print:border-none print:p-0">
        {/* 1. GEOMETRIA DEL TUBO IN SOTTOFONDO */}
        <g className="opacity-90">
          {!isNoneIso && s_iso > 0 && (
            <path 
              d={`M ${originX} ${originY} L ${originX + R_iso_px} ${originY} A ${R_iso_px} ${R_iso_px} 0 0 0 ${originX} ${originY - R_iso_px} Z`} 
              fill={isoColor} 
              stroke="#cbd5e1" 
              strokeWidth="0.5"
            />
          )}
          
          <path 
            d={`M ${originX} ${originY} L ${originX + R_e_px} ${originY} A ${R_e_px} ${R_e_px} 0 0 0 ${originX} ${originY - R_e_px} Z`} 
            fill={['Acciaio al Carbonio','Acciaio INOX 304-316','Acciaio Zincato','Ghisa'].includes(tratto.material) ? 'rgba(148, 163, 184, 0.4)' : 'rgba(71, 85, 105, 0.4)'} 
            stroke="#94a3b8" 
            strokeWidth="0.5"
          />
          
          <path 
            d={`M ${originX} ${originY} L ${originX + R_i_px} ${originY} A ${R_i_px} ${R_i_px} 0 0 0 ${originX} ${originY - R_i_px} Z`} 
            fill="rgba(191, 219, 254, 0.65)" 
            stroke="#60a5fa" 
            strokeWidth="0.5"
          />
        </g>

        {/* 2. GRIGLIA E ASSI CARTESIANI */}
        <line x1={originX} y1={originY} x2={originX + graphWidth} y2={originY} stroke="#94a3b8" strokeWidth="1.5" />
        <line x1={originX} y1={originY - graphHeight} x2={originX} y2={originY} stroke="#94a3b8" strokeWidth="1.5" />

        {/* Ticks e etichette dell'asse Y */}
        {yLabelsData.map((item) => {
          const needsLeaderLine = Math.abs(item.targetY - (item.adjustedY ?? item.targetY)) > 1.5;
          return (
            <g key={item.id}>
              <line x1={originX - 4} y1={item.targetY} x2={originX} y2={item.targetY} stroke="#475569" strokeWidth="1" />
              {needsLeaderLine && (
                <polyline 
                  points={`${originX - 4},${item.targetY} ${originX - 8},${item.adjustedY}`} 
                  fill="none" 
                  stroke={item.color} 
                  strokeWidth="0.5" 
                  strokeDasharray="1,1"
                />
              )}
              <text 
                x={needsLeaderLine ? originX - 10 : originX - 8} 
                y={(item.adjustedY ?? item.targetY) + 3} 
                textAnchor="end" 
                fill={item.color} 
                fontSize="8" 
                fontWeight={item.isBold ? 'bold' : 'normal'}
              >
                {item.label}
              </text>
            </g>
          );
        })}

        {/* Ticks e etichette dell'asse X */}
        {xLabelsData.map((item) => {
          const needsLeaderLine = Math.abs(item.targetX - (item.adjustedX ?? item.targetX)) > 1.5;
          return (
            <g key={item.id}>
              <line 
                x1={item.targetX} 
                y1={originY - graphHeight} 
                x2={item.targetX} 
                y2={originY} 
                stroke={item.color} 
                strokeWidth="0.75" 
                strokeDasharray="1.5,1.5" 
              />
              {needsLeaderLine ? (
                <polyline 
                  points={`${item.targetX},${originY} ${item.targetX},${originY + 4} ${item.adjustedX},${originY + 8}`}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="0.5"
                  strokeDasharray="1,1"
                />
              ) : (
                <line 
                  x1={item.targetX} 
                  y1={originY} 
                  x2={item.targetX} 
                  y2={originY + 4} 
                  stroke={item.color} 
                  strokeWidth="0.5" 
                />
              )}
              <text 
                x={item.adjustedX ?? item.targetX} 
                y={originY + (needsLeaderLine ? 16 : 12)} 
                textAnchor="middle" 
                fill={item.color} 
                fontSize="7" 
                fontWeight="semibold"
              >
                {item.label}
              </text>
            </g>
          );
        })}

        <text x={originX + graphWidth} y={originY + 10} textAnchor="end" fill="#64748b" fontSize="7">Raggio r</text>

        {/* 3. TRACCIATO DELLA CURVA */}
        <path d={`M ${fluidPoints.join(' L ')}`} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
        <path d={wallPath} fill="none" stroke="#475569" strokeWidth="2.5" />
        {!isNoneIso && s_iso > 0 ? (
          <path d={isoPath} fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
        ) : null}
        <path d={airPath} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2,2" strokeLinecap="round" />

        <circle cx={getX(ri)} cy={getY(t_int_tubo)} r="2" fill="#2563eb" />
        <circle cx={getX(re)} cy={getY(t_ext_tubo)} r="2" fill={(!isNoneIso && s_iso > 0) ? "#475569" : "#b91c1c"} />
        {!isNoneIso && s_iso > 0 && (
          <circle cx={getX(riso)} cy={getY(t_s)} r="2.5" fill="#b91c1c" />
        )}
        
        <text x={getX((riso + R_max) / 2)} y={getY(ta) - 4} textAnchor="middle" fill="#94a3b8" fontSize="7" className="italic">Aria ambiente</text>
      </svg>

      {/* Legenda orizzontale */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[10px] text-slate-600 font-semibold px-2 print:justify-start print:px-0">
        <div className="flex items-center space-x-1 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#2563eb' }}></span>
          <span>Fluido ({formatNumber(tf, 0)}°C)</span>
        </div>
        <div className="flex items-center space-x-1 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#475569' }}></span>
          <span>Parete ({tratto.material})</span>
        </div>
        {!isNoneIso && s_iso > 0 && (
          <div className="flex items-center space-x-1 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#d97706' }}></span>
            <span>Isolante ({tratto.isoType === 'pur' ? 'PUR' : tratto.isoType === 'rockwool' ? 'Lana' : 'Gomma'})</span>
          </div>
        )}
        <div className="flex items-center space-x-1 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#b91c1c' }}></span>
          <span>Superficie ({formatNumber(t_s, 1)}°C)</span>
        </div>
        <div className="flex items-center space-x-1 shrink-0">
          <span className="w-2.5 h-0.5 border-t border-dashed border-slate-400 inline-block"></span>
          <span className="text-slate-400 italic">Aria Ambiente ({formatNumber(ta, 0)}°C)</span>
        </div>
      </div>
    </div>
  );
}

export function ToolVerificaLinee({ projectData, setProjectData, setAppMode }: ToolVerificaLineeProps) {
    const [fluidTemp, setFluidTemp] = useState<number | ''>(55); // °C
    const [glycolEtPercent, setGlycolEtPercent] = useState<number | ''>(0); // %
    const [glycolPrPercent, setGlycolPrPercent] = useState<number | ''>(0); // %
    const [tratti, setTratti] = useState<TrattoLine[]>([]);
    const [selectedTrattoId, setSelectedTrattoId] = useState<number | null>(null);
    const [pressureUnit, setPressureUnit] = useState<string>('mbar');

    // --- NUOVI STATI GLOBALI FASE 1 ---
    /** Se true, abilita il campo "Tipo Condotto" (Aspirazione/Mandata) su ogni tratto */
    const [collegaPompaggio, setCollegaPompaggio] = useState<boolean>(false);
    /** Pressione di partenza alla radice del circuito (barg) */
    const [pressionePartenza, setPressionePartenza] = useState<number | ''>(0);

    // --- NUOVI STATI FASE 3: DATASHEET POMPAGGIO ---
    const [showPumpDatasheet, setShowPumpDatasheet] = useState<boolean>(false);
    const [pumpEfficiency, setPumpEfficiency] = useState<number>(65); // %
    const [pumpSafetyMargin, setPumpSafetyMargin] = useState<number>(10); // %
    const [pumpFlowOverride, setPumpFlowOverride] = useState<string>(''); // m³/h (vuoto = automatico)
    const [pumpConfig, setPumpConfig] = useState<string>('1+1'); // '1+1', '1+0', '2+1'
    const [pumpType, setPumpType] = useState<string>('in-line'); // 'in-line', 'basamento', 'monoblocco'

    const computedBranchTags = useMemo(() => {
        const tags: Record<number, string> = {};
        
        // Nodi radice (senza parentId)
        const roots = tratti.filter(t => t.parentId === null);
        
        // Mappa dei figli
        const childrenMap: Record<number, TrattoLine[]> = {};
        tratti.forEach(t => {
            if (t.parentId !== null) {
                if (!childrenMap[t.parentId]) {
                    childrenMap[t.parentId] = [];
                }
                childrenMap[t.parentId].push(t);
            }
        });

        // Ordine stabile dei rami e figli
        Object.keys(childrenMap).forEach(key => {
            childrenMap[Number(key)].sort((a, b) => a.id - b.id);
        });
        roots.sort((a, b) => a.id - b.id);

        let letterIndex = 0;
        const getNextLetter = (): string => {
            const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const index = letterIndex + 1;
            letterIndex++;
            
            if (index < alphabet.length) {
                return alphabet[index];
            } else {
                const firstChar = alphabet[Math.floor(index / alphabet.length) - 1];
                const secondChar = alphabet[index % alphabet.length];
                return firstChar + secondChar;
            }
        };

        const dfs = (tratto: TrattoLine, parentEndLetter: string) => {
            const startLetter = parentEndLetter;
            const endLetter = getNextLetter();
            tags[tratto.id] = startLetter + endLetter;

            const children = childrenMap[tratto.id] || [];
            children.forEach(child => {
                dfs(child, endLetter);
            });
        };

        roots.forEach(root => {
            dfs(root, 'A');
        });

        // Gestione rami isolati o orfani
        const visited = new Set<number>(Object.keys(tags).map(Number));
        tratti.forEach(t => {
            if (!visited.has(t.id)) {
                dfs(t, 'A');
            }
        });

        return tags;
    }, [tratti]);

    // Calcolo densità e viscosità dinamica globali basati sulle percentuali di glicole in acqua
    const fluidProps = useMemo(() => {
        const T = Number(fluidTemp) || 55;
        const xEt = (Number(glycolEtPercent) || 0) / 100;
        const xPr = (Number(glycolPrPercent) || 0) / 100;

        // Proprietà di base dell'acqua pura alla temperatura T
        const rho_water = 1000 * (1 - ((T + 288.9414) / (508929.2 * (T + 68.12963))) * Math.pow(T - 3.9863, 2));
        const visc_water = 0.00179 / (1 + 0.0337 * T + 0.00022 * Math.pow(T, 2));

        // Incrementi di densità dovuti ai due glicoli
        const delta_rho_et = xEt * (160 - 0.35 * T) + Math.pow(xEt, 2) * 30;
        const delta_rho_pr = xPr * (105 - 0.4 * T) + Math.pow(xPr, 2) * 20;
        const rho = rho_water + delta_rho_et + delta_rho_pr;

        // Incremento di viscosità dovuto ai due glicoli
        const mult_et = (2.5 + 0.02 * T) * xEt + (10 - 0.05 * T) * Math.pow(xEt, 2);
        const mult_pr = (3.0 + 0.03 * T) * xPr + (18 - 0.1 * T) * Math.pow(xPr, 2);
        const visc = visc_water * (1 + mult_et + mult_pr);

        return { rho: Number(rho.toFixed(1)), visc: Number(visc.toFixed(6)) };
    }, [fluidTemp, glycolEtPercent, glycolPrPercent]);

    const activeRho = fluidProps.rho;
    const activeVisc = fluidProps.visc;

    const processedTratti = useMemo(() => {
        const g = 9.80665;
        const xEt_glob = (Number(glycolEtPercent) || 0) / 100;
        const xPr_glob = (Number(glycolPrPercent) || 0) / 100;

        // ---- PASSATA 1: calcolo per ogni tratto ----
        const byId: Record<number, TrattoLine> = {};

        tratti.forEach(t => {
            let d_int = 0;
            let roughness = 0.02;

            if (t.material === 'manuale') {
                d_int = Number(t.D) || 50;
                roughness = Number(t.roughness) || 0.02;
            } else if (PIPE_CATALOG[t.material]) {
                const dnSpecs = PIPE_CATALOG[t.material].specs[t.DN];
                if (dnSpecs) d_int = dnSpecs[t.PN] || 50;
                roughness = PIPE_CATALOG[t.material].roughness;
            }

            const isoType   = t.isoType || 'pur';
            const isoThick  = t.isoThick === '' ? '' : (t.isoThick !== undefined ? Number(t.isoThick) : 50);
            const isoLambda = t.isoLambda !== undefined ? Number(t.isoLambda) : 0.025;
            const tAmbVal   = t.tAmb === '' ? '' : (t.tAmb !== undefined ? Number(t.tAmb) : -5);
            const activeIsoThick = isoThick === '' ? 0 : Number(isoThick);
            const activeTAmb     = tAmbVal  === '' ? 0 : Number(tAmbVal);

            // Temperatura per questo tratto
            const hasTempLocale = t.tempLocalizzata !== '' && t.tempLocalizzata !== undefined;
            const T_tratto = hasTempLocale ? Number(t.tempLocalizzata) : (Number(fluidTemp) || 55);
            const lf = computeFluidPropsAtT(T_tratto, xEt_glob, xPr_glob);
            const rho_locale  = lf.rho;
            const visc_locale = lf.visc;

            const d_int_m  = d_int / 1000;
            const flow_m3h = Number(t.portata) || 0;
            const length   = Number(t.length)  || 0;

            const area_m2  = (Math.PI * Math.pow(d_int_m, 2)) / 4;
            const velocity = area_m2 > 0 ? (flow_m3h / area_m2 / 3600) : 0;
            const Re           = visc_locale > 0 ? (rho_locale * velocity * d_int_m) / visc_locale : 0;
            const roughnessRel = d_int > 0 ? (roughness / d_int) : 0;
            const lambda       = solveColebrookWhite(Re, roughnessRel);

            const leq_valvola   = getEquivalentLength('valvola_diaframma', t.DN);
            const leq_riduzione = getEquivalentLength('riduzione', t.DN);
            const leq_curva     = getEquivalentLength('curva_d', t.DN);
            const leq_tee       = getEquivalentLength('innesto_t', t.DN);
            const leq_tot = (Number(t.n_valvole)  || 0) * leq_valvola
                          + (Number(t.n_riduzioni) || 0) * leq_riduzione
                          + (Number(t.n_curve)     || 0) * leq_curva
                          + (Number(t.n_tee)       || 0) * leq_tee;

            const loss_dist_Pa = d_int_m > 0
                ? lambda*(length  /d_int_m)*(Math.pow(velocity,2)/2)*rho_locale : 0;
            const loss_conc_Pa = d_int_m > 0
                ? lambda*(leq_tot /d_int_m)*(Math.pow(velocity,2)/2)*rho_locale : 0;
            const loss_tot_Pa   = loss_dist_Pa + loss_conc_Pa;
            const loss_tot_mbar = loss_tot_Pa / 100;
            const loss_tot_mH2O = loss_tot_Pa / 9806.65;

            // Perdite aggiuntive
            let loss_valvola_Pa = 0;
            if (t.valvolaInputMode === 'kvs') {
                const kvs = Number(t.valvolaKvs) || 0;
                if (kvs > 0) loss_valvola_Pa = Math.pow(flow_m3h / kvs, 2) * 100000;
            } else {
                loss_valvola_Pa = Number(t.valvolaPerdita) || 0;
            }
            const loss_scambiatore_Pa = (Number(t.scambiatorePerdita) || 0) * 1000;
            const loss_altre_Pa       = Number(t.altrePerdite) || 0;
            const loss_aggiuntive_Pa  = loss_valvola_Pa + loss_scambiatore_Pa + loss_altre_Pa;
            const loss_gran_tot_Pa    = loss_tot_Pa + loss_aggiuntive_Pa;

            // Contributo geodetico (Pa): positivo = salita
            const dz = Number(t.dislivelloGeodetico) || 0;
            const contributo_geodesia_Pa = rho_locale * g * dz;

            // Calcolo termico
            let d_ext = d_int + 10;
            if (t.material && t.DN && PIPE_CATALOG[t.material]) {
                const specs = PIPE_CATALOG[t.material].specs[t.DN];
                if (specs) d_ext = getExternalDiameter(t.material, t.DN, specs[t.PN] || d_int);
            } else if (t.D) { d_ext = Number(t.D) + 10; }

            const r_int_m = d_int_m / 2;
            const r_ext_m = d_ext / 2000;
            const s_iso_m = activeIsoThick / 1000;
            const r_iso_m = r_ext_m + s_iso_m;
            const lp = (PIPE_CATALOG[t.material] && PIPE_CATALOG[t.material].lambda) || 50.0;
            const R_int  = d_int_m > 0 ? 1/(1163*d_int_m) : 0;
            const R_pipe = r_int_m > 0 ? Math.log(r_ext_m/r_int_m)/(2*lp) : 0;
            let R_iso = 0;
            if (s_iso_m > 0 && isoLambda > 0 && isoType !== 'none')
                R_iso = Math.log(r_iso_m/r_ext_m)/(2*isoLambda);
            const R_ext = 1/(7.4*(r_iso_m*2));
            const R_tot = R_int + R_pipe + R_iso + R_ext;
            const dT_th = Math.abs(T_tratto - activeTAmb);
            const Q_Wm  = R_tot > 0 ? (Math.PI*dT_th)/R_tot : 0;
            let t_pipe_int = T_tratto, t_pipe_ext = T_tratto, t_surf = T_tratto;
            if (T_tratto > activeTAmb) {
                t_pipe_int = T_tratto - (Q_Wm/Math.PI)*R_int;
                t_pipe_ext = T_tratto - (Q_Wm/Math.PI)*(R_int+R_pipe);
                t_surf     = activeTAmb + Q_Wm/(Math.PI*7.4*(r_iso_m*2));
            } else {
                t_pipe_int = T_tratto + (Q_Wm/Math.PI)*R_int;
                t_pipe_ext = T_tratto + (Q_Wm/Math.PI)*(R_int+R_pipe);
                t_surf     = activeTAmb - Q_Wm/(Math.PI*7.4*(r_iso_m*2));
            }

            byId[t.id] = {
                ...t,
                tag: computedBranchTags[t.id] || `L${t.id}`,
                isoType, isoThick, isoLambda, tAmb: tAmbVal,
                d_int, d_ext, t_surf, t_pipe_ext, t_pipe_int,
                roughness, area_m2, velocity, Re, roughnessRel, lambda,
                leq_valvola, leq_riduzione, leq_curva, leq_tee, leq_tot,
                loss_dist_Pa, loss_conc_Pa, loss_tot_Pa, loss_tot_mbar, loss_tot_mH2O,
                rho_locale, visc_locale,
                loss_valvola_Pa, loss_scambiatore_Pa, loss_altre_Pa,
                loss_aggiuntive_Pa, loss_gran_tot_Pa, contributo_geodesia_Pa,
            } as TrattoLine;
        });

        // ---- PASSATA 2: propagazione pressione nodale (BFS) ----
        const P0 = Number(pressionePartenza) || 0;
        const ordered: number[] = [];
        const seen = new Set<number>();
        const bfsQueue = [...tratti.filter(t => t.parentId === null).map(t => t.id)];
        while (bfsQueue.length > 0) {
            const cur = bfsQueue.shift()!;
            if (seen.has(cur)) continue;
            seen.add(cur); ordered.push(cur);
            tratti.filter(t => t.parentId === cur).forEach(c => bfsQueue.push(c.id));
        }
        tratti.forEach(t => { if (!seen.has(t.id)) ordered.push(t.id); });

        ordered.forEach(id => {
            const t = byId[id];
            if (!t) return;
            const P_in = (t.parentId === null || !byId[t.parentId!])
                ? P0 : (byId[t.parentId!].pressioneNodo ?? P0);
            const delta_bar = ((t.loss_gran_tot_Pa || 0) + (t.contributo_geodesia_Pa || 0)) / 100000;
            t.pressioneNodo = P_in - delta_bar;
        });

        // ---- PASSATA 3: autorità valvola ----
        tratti.forEach(t => {
            const tp = byId[t.id];
            if (!tp || !tp.valvolaCircuitoIds?.length || !tp.loss_valvola_Pa) { if (tp) tp.valvola_autorita = undefined; return; }
            let lc = 0;
            tp.valvolaCircuitoIds.forEach(cid => { lc += (byId[cid]?.loss_gran_tot_Pa || 0); });
            tp.valvola_autorita = tp.loss_valvola_Pa / (tp.loss_valvola_Pa + lc);
        });

        return Object.values(byId);
    }, [tratti, fluidTemp, glycolEtPercent, glycolPrPercent, computedBranchTags, pressionePartenza]);


    // --- CALCOLI DI DIMENSIONAMENTO GRUPPO DI POMPAGGIO (FASE 3) ---
    const pumpSizing = useMemo(() => {
        const g = 9.80665;
        const xEt_glob = (Number(glycolEtPercent) || 0) / 100;
        const xPr_glob = (Number(glycolPrPercent) || 0) / 100;
        const P0 = Number(pressionePartenza) || 0;

        // Mappa comoda per ricercare i tratti per ID
        const byId: Record<number, TrattoLine> = {};
        processedTratti.forEach(t => {
            byId[t.id] = t;
        });

        // Rilevamento confini di aspirazione (tratti di aspirazione senza figli di aspirazione)
        const suctionBoundaries = processedTratti.filter(t => 
            t.tipoCondotto === 'aspirazione' && 
            !processedTratti.some(child => child.parentId === t.id && child.tipoCondotto === 'aspirazione')
        );

        // Rilevamento confini di mandata (tratti di mandata il cui genitore è nullo o di aspirazione)
        const deliveryBoundaries = processedTratti.filter(t => 
            t.tipoCondotto === 'mandata' && 
            (t.parentId === null || byId[t.parentId]?.tipoCondotto === 'aspirazione')
        );

        // Portate totali
        const q_asp_tot = suctionBoundaries.reduce((sum, t) => sum + (Number(t.portata) || 0), 0);
        const q_man_tot = deliveryBoundaries.reduce((sum, t) => sum + (Number(t.portata) || 0), 0);
        const q_pump_nom = pumpFlowOverride !== '' ? (Number(pumpFlowOverride) || 0) : Math.max(q_asp_tot, q_man_tot);

        // Perdite lato aspirazione (bar)
        // La perdita cumulativa dall'origine all'ingresso della pompa è P0 - P_nodo per ciascun confine di aspirazione
        const max_suction_loss = suctionBoundaries.length > 0 
            ? Math.max(0, ...suctionBoundaries.map(t => P0 - (t.pressioneNodo ?? P0))) 
            : 0;

        // Perdite lato mandata (bar)
        // Dobbiamo calcolare la perdita cumulata lungo i percorsi di mandata a partire dall'uscita della pompa
        const deliveryCumLosses: Record<number, number> = {}; // in Pa
        const getDeliveryCumLoss = (id: number): number => {
            if (deliveryCumLosses[id] !== undefined) return deliveryCumLosses[id];
            const t = byId[id];
            if (!t || t.tipoCondotto !== 'mandata') return 0;
            const ownLoss = (t.loss_gran_tot_Pa || 0) + (t.contributo_geodesia_Pa || 0);
            if (t.parentId === null || byId[t.parentId]?.tipoCondotto === 'aspirazione') {
                deliveryCumLosses[id] = ownLoss;
            } else {
                deliveryCumLosses[id] = ownLoss + getDeliveryCumLoss(t.parentId);
            }
            return deliveryCumLosses[id];
        };

        const max_delivery_loss_Pa = processedTratti.filter(t => t.tipoCondotto === 'mandata').length > 0
            ? Math.max(0, ...processedTratti.filter(t => t.tipoCondotto === 'mandata').map(t => getDeliveryCumLoss(t.id)))
            : 0;
        const max_delivery_loss = max_delivery_loss_Pa / 100000; // bar

        // Perdita totale circuito (bar)
        const delta_P_circuito = max_suction_loss + max_delivery_loss;

        // Margine di sicurezza e prevalenza richiesta
        const safety_margin_val = (Number(pumpSafetyMargin) || 0) / 100;
        const prevalenza_richiesta_bar = delta_P_circuito * (1 + safety_margin_val);

        // Prevalenza richiesta per soddisfare le pressioni minime dei terminali
        // P_nodo_i = P_partenza + P_boost - loss_path_i >= P_min_i => P_boost >= P_min_i - P_nodo_i (senza boost)
        const max_terminal_boost = processedTratti.length > 0
            ? Math.max(0, ...processedTratti.map(t => (Number(t.pressioneMinimaRichiesta) || 0) - (t.pressioneNodo ?? 0)))
            : 0;

        // Calcolo NPSH disponibile
        const p_inlet_gauge = suctionBoundaries.length > 0 
            ? Math.min(...suctionBoundaries.map(t => t.pressioneNodo ?? P0)) 
            : P0;
        
        let worstSuctionBranch = suctionBoundaries.find(t => t.pressioneNodo === p_inlet_gauge);
        const T_pump = worstSuctionBranch && worstSuctionBranch.tempLocalizzata !== '' && worstSuctionBranch.tempLocalizzata !== undefined
            ? Number(worstSuctionBranch.tempLocalizzata)
            : (Number(fluidTemp) || 55);

        const rho_pump = computeFluidPropsAtT(T_pump, xEt_glob, xPr_glob).rho;

        // Antoine per P vapore acqua (bar ass)
        const getVaporPressure = (temp: number) => {
            const A = 5.20389;
            const B = 1733.926;
            const C = 233.426;
            return Math.pow(10, A - B / (temp + C));
        };
        const pv_bar = getVaporPressure(T_pump);
        const npsh_a = Math.max(0, (p_inlet_gauge + 1.01325 - pv_bar) * 100000 / (rho_pump * g));

        // Potenze
        const p_idraulica = (q_pump_nom * (prevalenza_richiesta_bar)) / 36; // kW
        const eff_val = (Number(pumpEfficiency) || 65) / 100;
        const p_shaft = p_idraulica / eff_val; // kW

        // Potenza motore consigliata e taglia standard
        const safety_factor = p_shaft <= 1.5 ? 1.3 : p_shaft <= 15 ? 1.2 : 1.15;
        const p_motor_rec = p_shaft * safety_factor;

        const STANDARD_MOTORS = [
            0.09, 0.12, 0.18, 0.25, 0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3.0, 4.0, 5.5, 7.5, 
            11.0, 15.0, 18.5, 22.0, 30.0, 37.0, 45.0, 55.0, 75.0, 90.0, 110.0
        ];
        const p_motor_std = STANDARD_MOTORS.find(sz => sz >= p_motor_rec) || STANDARD_MOTORS[STANDARD_MOTORS.length - 1];

        return {
            suctionBoundaries,
            deliveryBoundaries,
            q_asp_tot,
            q_man_tot,
            q_pump_nom,
            max_suction_loss,
            max_delivery_loss,
            delta_P_circuito,
            prevalenza_richiesta_bar,
            max_terminal_boost,
            p_inlet_gauge,
            T_pump,
            rho_pump,
            pv_bar,
            npsh_a,
            p_idraulica,
            p_shaft,
            p_motor_rec,
            p_motor_std,
            safety_factor
        };
    }, [processedTratti, fluidTemp, glycolEtPercent, glycolPrPercent, pressionePartenza, pumpEfficiency, pumpSafetyMargin, pumpFlowOverride]);



    const addTratto = () => {
        const defaultParent = tratti[tratti.length - 1]?.id || null;
        const newId = tratti.length > 0 ? Math.max(...tratti.map(t => t.id)) + 1 : 1;
        setTratti([
            ...tratti, 
            { 
                id: newId, 
                tag: `L${newId}`, 
                name: `Linea Tratto ${newId}`, 
                portata: '', 
                material: Object.keys(PIPE_CATALOG)[0], 
                DN: Object.keys(PIPE_CATALOG[Object.keys(PIPE_CATALOG)[0]].specs)[0], 
                PN: Object.keys(PIPE_CATALOG[Object.keys(PIPE_CATALOG)[0]].specs[Object.keys(PIPE_CATALOG[Object.keys(PIPE_CATALOG)[0]].specs)[0]])[0], 
                length: '', 
                n_valvole: 0, 
                n_riduzioni: 0, 
                n_curve: 0, 
                n_tee: 0,
                hierarchy: 'dorsale_principale',
                parentId: defaultParent,
                isoType: 'pur',
                isoThick: 50,
                isoLambda: 0.025,
                tAmb: -5,
                // Fase 1
                tipoCondotto: 'mandata',
                tempLocalizzata: '',
                dislivelloGeodetico: '',
                pressioneMinimaRichiesta: 0,
                // Fase 2
                valvolaInputMode: 'diretta',
                valvolaPerdita: '',
                valvolaKvs: '',
                valvolaCircuitoIds: [],
                scambiatorePerdita: '',
                altrePerdite: '',
            }
        ]);
    };

    const duplicateTratto = (id: number) => {
        const t = tratti.find(x => x.id === id);
        if (!t) return;
        const newId = tratti.length > 0 ? Math.max(...tratti.map(x => x.id)) + 1 : 1;
        setTratti([...tratti, { ...t, id: newId, tag: t.tag + "-bis", name: t.name + " (Copia)" }]);
    };

    const updateTratto = (id: number, field: keyof TrattoLine, val: any) => {
        setTratti(prev => prev.map(t => {
            if (t.id === id) {
                let updated = { ...t, [field]: val } as TrattoLine;
                
                if (field === 'material' && val !== 'manuale') {
                    const firstDN = Object.keys(PIPE_CATALOG[val].specs)[0];
                    const firstPN = Object.keys(PIPE_CATALOG[val].specs[firstDN])[0];
                    updated.DN = firstDN; updated.PN = firstPN;
                }
                else if (field === 'DN' && updated.material !== 'manuale') {
                    let currentPN = updated.PN;
                    if (!PIPE_CATALOG[updated.material].specs[val][currentPN]) {
                        currentPN = Object.keys(PIPE_CATALOG[updated.material].specs[val])[0];
                    }
                    updated.PN = currentPN;
                }
                return updated;
            }
            return t;
        }));
    };

    const removeTratto = (id: number) => {
        setTratti(tratti.filter(t => t.id !== id).map(t => {
            if (t.parentId === id) {
                const deletedTratto = tratti.find(x => x.id === id);
                return { ...t, parentId: deletedTratto ? deletedTratto.parentId : null };
            }
            return t;
        }));
        if (selectedTrattoId === id) setSelectedTrattoId(null);
    };

    const totalLossDistPa = processedTratti.reduce((s, t) => s + (t.loss_dist_Pa || 0), 0);
    const totalLossConcPa = processedTratti.reduce((s, t) => s + (t.loss_conc_Pa || 0), 0);
    const totalLossPa = totalLossDistPa + totalLossConcPa;

    const activeTratto = processedTratti.find(x => x.id === selectedTrattoId) || processedTratti[0];

    const handleLoadCloudProject = (data: any) => {
        if (!data) return;
        if (data.fluidTemp !== undefined) setFluidTemp(data.fluidTemp);
        if (data.pressureUnit !== undefined) setPressureUnit(data.pressureUnit);
        // Nuovi campi globali Fase 1 (retrocompatibili: default se assenti)
        if (data.collegaPompaggio !== undefined) setCollegaPompaggio(data.collegaPompaggio);
        else setCollegaPompaggio(false);
        if (data.pressionePartenza !== undefined) setPressionePartenza(data.pressionePartenza);
        else setPressionePartenza(0);
        
        // Supporto retrocompatibilità: mappa i vecchi campi fluidType e glycolPercent sui nuovi stati separati
        if (data.glycolEtPercent !== undefined) {
            setGlycolEtPercent(data.glycolEtPercent);
        } else if (data.glycolPercent !== undefined && data.fluidType === 'etilenico') {
            setGlycolEtPercent(data.glycolPercent);
        } else {
            setGlycolEtPercent(0);
        }

        if (data.glycolPrPercent !== undefined) {
            setGlycolPrPercent(data.glycolPrPercent);
        } else if (data.glycolPercent !== undefined && data.fluidType === 'propilenico') {
            setGlycolPrPercent(data.glycolPercent);
        } else {
            setGlycolPrPercent(0);
        }

        let loadedTratti = data.tratti || [];
        if (loadedTratti.length > 0) {
            const tagToIdMap = new Map<string, number>();
            const originalIdToNewIdMap = new Map<any, number>();
            
            loadedTratti.forEach((t: any, index: number) => {
                const oldId = t.id;
                const newId = typeof oldId === 'number' ? oldId : (index + 1);
                originalIdToNewIdMap.set(oldId, newId);
                if (t.tag) {
                    tagToIdMap.set(t.tag, newId);
                }
            });

            loadedTratti = loadedTratti.map((t: any) => {
                const newId = originalIdToNewIdMap.get(t.id)!;
                let newParentId: number | null = null;

                if (t.parentId !== undefined && t.parentId !== null && t.parentId !== '') {
                    if (typeof t.parentId === 'number') {
                        newParentId = originalIdToNewIdMap.get(t.parentId) ?? t.parentId;
                    } else if (typeof t.parentId === 'string') {
                        if (tagToIdMap.has(t.parentId)) {
                            newParentId = tagToIdMap.get(t.parentId)!;
                        } else {
                            const numericParent = Number(t.parentId);
                            if (!isNaN(numericParent) && numericParent > 0) {
                                newParentId = originalIdToNewIdMap.get(numericParent) ?? numericParent;
                            }
                        }
                    }
                }
                
                return {
                    ...t,
                    id: newId,
                    parentId: newParentId,
                    // Retrocompatibilità Fase 1
                    tipoCondotto:             t.tipoCondotto             ?? 'mandata',
                    tempLocalizzata:          t.tempLocalizzata          ?? '',
                    dislivelloGeodetico:      t.dislivelloGeodetico      ?? '',
                    pressioneMinimaRichiesta: t.pressioneMinimaRichiesta ?? 0,
                    // Retrocompatibilità Fase 2
                    valvolaInputMode:         t.valvolaInputMode         ?? 'diretta',
                    valvolaPerdita:           t.valvolaPerdita           ?? '',
                    valvolaKvs:               t.valvolaKvs               ?? '',
                    valvolaCircuitoIds:       t.valvolaCircuitoIds       ?? [],
                    scambiatorePerdita:       t.scambiatorePerdita       ?? '',
                    altrePerdite:             t.altrePerdite             ?? '',
                };
            });
        }
        setTratti(loadedTratti);
        setSelectedTrattoId(null);
    };

    const getCloudSaveData = () => {
        return {
            fluidTemp,
            glycolEtPercent,
            glycolPrPercent,
            tratti,
            pressureUnit,
            // Nuovi campi globali Fase 1
            collegaPompaggio,
            pressionePartenza,
        };
    };

    const trattiNodesForTree = useMemo(() => {
        const getTrattoDepth = (tratto: any): number => {
            let depth = 0;
            let current = tratto;
            while (current.parentId !== null) {
                const parent = tratti.find(t => t.id === current.parentId);
                if (!parent || parent.id === current.id) break;
                depth++;
                current = parent;
            }
            return depth;
        };

        return processedTratti.map(t => {
            let hierarchy = t.hierarchy;
            if (!hierarchy) {
                const depth = getTrattoDepth(t);
                const hasChildren = tratti.some(x => x.parentId === t.id);
                if (!hasChildren) {
                    hierarchy = 'utenza';
                } else if (depth === 1) {
                    hierarchy = 'dorsale_secondaria';
                } else if (depth >= 2) {
                    hierarchy = 'dorsale_terziaria';
                } else {
                    hierarchy = 'dorsale_principale';
                }
            }

            const tagText = `${computedBranchTags[t.id] || `L${t.id}`}${t.name ? ` ➔ [${t.name}]` : ''}`;

            return {
                tag: computedBranchTags[t.id] || `L${t.id}`,
                parentId: t.parentId !== null ? (computedBranchTags[t.parentId] || null) : null,
                hierarchy,
                length: t.length,
                name: tagText,
                velocity: t.velocity,
                loss_tot_mbar: t.loss_tot_mbar,
                // Fase 2
                dislivelloGeodetico: t.dislivelloGeodetico,
                pressioneNodo: t.pressioneNodo,
                pressioneMinimaRichiesta: t.pressioneMinimaRichiesta,
            } as TrattoNode;
        });
    }, [processedTratti, tratti, computedBranchTags]);

    const getEligibleParents = (trattoId: number) => {
        const descendants = new Set<number>([trattoId]);
        let added = true;
        while (added) {
            added = false;
            for (const t of tratti) {
                if (t.parentId !== null && descendants.has(t.parentId) && !descendants.has(t.id)) {
                    descendants.add(t.id);
                    added = true;
                }
            }
        }
        return tratti.filter(t => t.id !== trattoId && !descendants.has(t.id));
    };

    return (
        <div className="max-w-7xl mx-auto animate-fade-in text-slate-800">
            <ProjectHeader pData={projectData} setPData={setProjectData} title="Verifica Perdite di Carico Linee" setAppMode={setAppMode} iconColor="brand" />

            <ProjectStorage 
                toolType="verifica_linee"
                currentData={getCloudSaveData()}
                onLoadProject={handleLoadCloudProject}
                projectInfo={projectData}
                setProjectInfo={setProjectData}
            />

            {/* Spiegazione & Formula */}
            <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 mb-5 text-xs text-slate-650 space-y-2.5 print:hidden">
              <p>
                <strong>Descrizione:</strong> Esegue il calcolo e la verifica idraulica e termica delle linee di tubazione per liquidi (acqua o miscele acqua-glicole), determinando le perdite di carico distribuite (Darcy-Weisbach) e concentrate (metodo delle lunghezze equivalenti degli accessori) e tracciando lo schema topologico ad albero.
              </p>
              <div className="bg-white/80 border border-amber-100 rounded-xl p-4 text-slate-600">
                <p className="font-bold text-slate-700 mb-2.5 text-[11px] uppercase tracking-wide">Formule applicate per il moto dei liquidi:</p>
                <div className="space-y-4 pl-2 text-xs">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span>• Numero di Reynolds (Re):</span>
                    <span className="font-serif font-bold text-slate-800 flex items-center">
                      Re = 
                      <span className="inline-flex flex-col items-center align-middle mx-1.5 text-center text-[10px]">
                        <span className="border-b border-slate-400 px-1 pb-0.5">ρ × v × D<sub>int</sub></span>
                        <span className="px-1 pt-0.5">μ</span>
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span>• Coefficiente d'Attrito (Colebrook-White):</span>
                    <span className="font-serif font-bold text-slate-800 flex items-center">
                      <span className="inline-flex flex-col items-center align-middle mx-1 text-center text-[10px] leading-tight">
                        <span className="border-b border-slate-400 px-0.5">1</span>
                        <span className="px-0.5">√λ</span>
                      </span>
                      = -2 log<sub>10</sub> 
                      <span className="inline-flex items-center ml-1">
                        (
                        <span className="inline-flex flex-col items-center align-middle text-[10px] leading-tight">
                          <span className="border-b border-slate-400 px-0.5">ε</span>
                          <span className="px-0.5">3.71 × D<sub>int</sub></span>
                        </span>
                        +
                        <span className="inline-flex flex-col items-center align-middle text-[10px] leading-tight mx-1">
                          <span className="border-b border-slate-400 px-0.5">2.51</span>
                          <span className="px-0.5">Re × √λ</span>
                        </span>
                        )
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span>• Perdite Distribuite Darcy-Weisbach (J):</span>
                    <span className="font-serif font-bold text-slate-800 flex items-center">
                      J = λ × 
                      <span className="inline-flex flex-col items-center align-middle mx-1.5 text-center text-[10px]">
                        <span className="border-b border-slate-400 px-1 pb-0.5">L</span>
                        <span className="px-1 pt-0.5">D<sub>int</sub></span>
                      </span>
                      × 
                      <span className="inline-flex flex-col items-center align-middle mx-1.5 text-center text-[10px]">
                        <span className="border-b border-slate-400 px-1 pb-0.5">v²</span>
                        <span className="px-1 pt-0.5">2g</span>
                      </span>
                      <span className="text-[11px] text-slate-500 font-sans font-normal ml-1"> [m.c.a./m]</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== PARAMETRI GLOBALI FASE 1: Pompaggio & Pressione di Partenza ===== */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-6 overflow-hidden print:hidden">
                <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-700">
                    <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse"></div>
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Configurazione Radice Circuito</h3>
                </div>
                <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
                    {/* Toggle Collegamento Pompaggio */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            Collegamento Gruppo di Pompaggio
                        </label>
                        <div
                            onClick={() => setCollegaPompaggio(v => !v)}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                                collegaPompaggio
                                    ? 'bg-brand-50 border-brand-300 ring-1 ring-brand-200'
                                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            {/* Pill toggle */}
                            <div className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                                collegaPompaggio ? 'bg-brand-500' : 'bg-slate-300'
                            }`}>
                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                    collegaPompaggio ? 'translate-x-5' : 'translate-x-0'
                                }`}></span>
                            </div>
                            <div>
                                <p className={`text-xs font-bold leading-tight ${
                                    collegaPompaggio ? 'text-brand-700' : 'text-slate-600'
                                }`}>
                                    {collegaPompaggio ? 'Attivo' : 'Non attivo'}
                                </p>
                                <p className="text-[9px] text-slate-400 leading-tight mt-0.5">
                                    {collegaPompaggio
                                        ? 'Campo "Tipo Condotto" visibile su ogni tratto'
                                        : 'Abilita per collegare al gruppo di pompaggio'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Pressione di Partenza */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            Pressione di Partenza (barg)
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                step="0.1"
                                value={pressionePartenza === '' ? '' : pressionePartenza}
                                onChange={e => setPressionePartenza(e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full bg-slate-50 text-sm font-bold font-mono text-slate-800 p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200"
                                placeholder="0"
                            />
                            <span className="text-xs font-bold text-slate-400 shrink-0">barg</span>
                        </div>
                        <p className="text-[9px] text-slate-400 leading-tight">
                            Pressione disponibile all'inizio del circuito — usata nella Fase 3 per il calcolo nodale.
                        </p>
                    </div>

                    {/* Riepilogo info stato */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-1.5 text-[10px] text-slate-600">
                        <p className="font-black text-slate-400 uppercase tracking-wider text-[9px] mb-1">Stato Corrente</p>
                        <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                collegaPompaggio ? 'bg-green-500' : 'bg-slate-300'
                            }`}></span>
                            <span>Pompaggio: <strong>{collegaPompaggio ? 'Collegato' : 'Non collegato'}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0"></span>
                            <span>P. partenza: <strong className="font-mono">{pressionePartenza === '' ? '—' : `${pressionePartenza} barg`}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0"></span>
                            <span>Glicole globale: <strong>{(Number(glycolEtPercent)||0) > 0 ? `Et. ${glycolEtPercent}%` : (Number(glycolPrPercent)||0) > 0 ? `Pr. ${glycolPrPercent}%` : 'Acqua pura'}</strong></span>
                        </div>
                    </div>
                </div>

                {/* Box Informativo Radice (Fase 3) */}
                <div className="mt-2 mx-6 mb-6 p-4 bg-amber-50/50 border border-amber-200/60 rounded-xl space-y-2 text-xs text-slate-650 print:hidden">
                    <h5 className="font-bold text-amber-950 flex items-center gap-1.5 uppercase tracking-wide text-[9px] mb-1">
                        💡 Guida: Configurazione Rete & Fluido
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 leading-relaxed">
                        <p><strong>Pressione di Partenza:</strong> Definisce la pressione iniziale a monte della rete (ingresso radice). Tutte le pressioni successive vengono calcolate a partire da questo valore sottraendo le perdite e aggiungendo i dislivelli geodetici.</p>
                        <p><strong>Proprietà del Fluido:</strong> La densità e la viscosità dinamica del fluido dipendono dalla miscela di glicole. Il tool calcola queste proprietà dinamicamente per ogni singolo tratto in base alla sua temperatura localizzata.</p>
                        <p><strong>Collegamento Gruppo Pompaggio:</strong> Abilita la selezione della sezione ("Aspirazione" o "Mandata") per ciascun tratto per generare automaticamente il datasheet di dimensionamento della pompa a fondo pagina.</p>
                    </div>
                </div>
            </div>

            {/* Parametri Fluidi */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 mb-6 print:shadow-none print:border-none print:p-0">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2 print:border-b print:border-slate-800 print:pb-1">
                    <h3 className="text-sm font-bold text-slate-700">
                      Proprietà del Fluido Pompato (Verifica)
                    </h3>
                    <div className="print:hidden flex bg-slate-100 p-1 rounded-lg border border-slate-200 gap-1 items-center shrink-0">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider px-1">Unità Pressione:</span>
                        {['mbar', 'Pa', 'kPa', 'mH2O'].map((unit) => (
                            <button 
                                key={unit}
                                onClick={() => setPressureUnit(unit)}
                                className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${pressureUnit === unit ? 'bg-white shadow-sm text-brand-650' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                {unit === 'mH2O' ? 'm.c.a.' : unit}
                            </button>
                        ))}
                    </div>
                </div>
                <p className="text-xs text-slate-500 mb-4 print:hidden">
                  Il fluido di base è l'<strong>acqua</strong>. Le proprietà fisiche vengono ricalcolate automaticamente all'aumentare delle percentuali di glicole.
                </p>
                {/* Visualizzazione a schermo */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center print:hidden">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Temperatura (°C)</label>
                        <input 
                            type="number" 
                            value={fluidTemp === '' ? '' : fluidTemp} 
                            onChange={e => setFluidTemp(e.target.value === '' ? '' : Number(e.target.value))} 
                            className="w-full bg-slate-50 text-sm font-semibold text-slate-800 p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-brand-500 font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Glicole Etilenico (%)</label>
                        <input 
                            type="number" 
                            min="0" 
                            max="100" 
                            value={glycolEtPercent === '' ? '' : glycolEtPercent} 
                            onChange={e => {
                                const val = e.target.value === '' ? '' : Math.max(0, Math.min(100, Number(e.target.value)));
                                setGlycolEtPercent(val);
                            }} 
                            className="w-full bg-slate-50 text-sm font-semibold text-slate-800 p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-brand-500 font-mono"
                            placeholder="0"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Glicole Propilenico (%)</label>
                        <input 
                            type="number" 
                            min="0" 
                            max="100" 
                            value={glycolPrPercent === '' ? '' : glycolPrPercent} 
                            onChange={e => {
                                const val = e.target.value === '' ? '' : Math.max(0, Math.min(100, Number(e.target.value)));
                                setGlycolPrPercent(val);
                            }} 
                            className="w-full bg-slate-50 text-sm font-semibold text-slate-800 p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-brand-500 font-mono"
                            placeholder="0"
                        />
                    </div>

                    <div className="col-span-2 bg-brand-50 border border-brand-100 rounded-lg p-3 flex justify-around items-center text-xs">
                        <div>
                            <p className="text-[9px] font-bold text-brand-600 uppercase">Densità Calcolata</p>
                            <p className="font-mono font-bold text-brand-800 text-sm">{formatNumber(activeRho, 1)} kg/m³</p>
                        </div>
                        <div className="w-px h-6 bg-brand-200"></div>
                        <div>
                            <p className="text-[9px] font-bold text-brand-600 uppercase">Viscosità Dinamica</p>
                            <p className="font-mono font-bold text-brand-800 text-sm">{formatNumber(activeVisc, 6)} Pa·s</p>
                        </div>
                    </div>
                </div>

                {/* Visualizzazione pulita per il report di stampa */}
                <div className="hidden print:grid print:grid-cols-4 print:gap-4 print:mb-2 text-xs">
                    <div>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">Fluido Pompato</p>
                        <p className="font-semibold text-slate-800 leading-tight">
                            {glycolEtPercent === 0 && glycolPrPercent === 0 ? "Acqua Pura" : ""}
                            {(Number(glycolEtPercent) || 0) > 0 && glycolPrPercent === 0 ? `Acqua + Glicole Etilenico (${glycolEtPercent}%)` : ""}
                            {(Number(glycolPrPercent) || 0) > 0 && glycolEtPercent === 0 ? `Acqua + Glicole Propilenico (${glycolPrPercent}%)` : ""}
                            {(Number(glycolEtPercent) || 0) > 0 && (Number(glycolPrPercent) || 0) > 0 ? `Acqua + Glicole Et. (${glycolEtPercent}%) + Prop. (${glycolPrPercent}%)` : ""}
                        </p>
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">Temperatura</p>
                        <p className="font-mono font-semibold text-slate-800">{fluidTemp} °C</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">Densità Calcolata</p>
                        <p className="font-mono font-semibold text-slate-800">{formatNumber(activeRho, 1)} kg/m³</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">Viscosità Dinamica</p>
                        <p className="font-mono font-semibold text-slate-800">{formatNumber(activeVisc, 6)} Pa·s</p>
                    </div>
                </div>
            </div>

            {/* Sezione Tabella Tratti (Larghezza Intera) */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 mb-6 print:shadow-none print:border-none print:p-0 print:!break-inside-auto">
                <div className="flex justify-between items-center mb-4 print:hidden">
                    <h2 className="font-bold text-sm text-slate-800 flex items-center"><IconArrowUp className="w-4 h-4 mr-2"/> Tabella Verifica Perdite di Carico</h2>
                    <button onClick={addTratto} className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm flex items-center hover:bg-slate-700 cursor-pointer">
                        <IconPlus className="w-3.5 h-3.5 mr-1.5"/> Aggiungi Tratto
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs table-auto min-w-[1000px] print:min-w-full">
                        <thead>
                            <tr className="border-b border-slate-300 bg-slate-50 text-slate-600 uppercase text-[9px] font-bold tracking-wider">
                                <th className="py-2.5 px-2 print:p-1">TAG / Nome</th>
                                <th className="py-2.5 px-2 print:p-1">Genitore</th>
                                <th className="py-2.5 px-2 print:p-1">Gerarchia</th>
                                <th className="py-2.5 px-2 print:p-1">Fluido / Q (m³/h)</th>
                                <th className="py-2.5 px-2 print:p-1">Materiale / DN / PN</th>
                                <th className="py-2.5 px-2 print:p-1">L (m)</th>
                                <th className="py-2.5 px-2 print:p-1">Pezzi Speciali (K)</th>
                                <th className="py-2.5 px-2 print:p-1">Velocità (m/s)</th>
                                <th className="py-2.5 px-2 print:p-1">Reynolds / λ</th>
                                <th className="py-2.5 px-2 print:p-1 text-right">∆P Distrib ({getPressureUnitLabel(pressureUnit)})</th>
                                <th className="py-2.5 px-2 print:p-1 text-right">∆P Conc ({getPressureUnitLabel(pressureUnit)})</th>
                                <th className="py-2.5 px-2 print:p-1 text-right">∆P Totale ({getPressureUnitLabel(pressureUnit)})</th>
                                <th className="py-2.5 px-2 print:hidden">Azioni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedTratti.map((t) => (
                                <tr 
                                    key={t.id} 
                                    onClick={() => setSelectedTrattoId(t.id)}
                                    className={`border-b border-slate-100 hover:bg-slate-50/40 cursor-pointer transition-all ${activeTratto?.id === t.id ? 'bg-brand-50/40 font-semibold border-l-4 border-l-brand-600' : ''}`}
                                >
                                    {/* TAG e Nome */}
                                    <td className="py-2.5 px-2 print:p-1 space-y-0.5">
                                        <span className="font-bold font-mono text-xs text-slate-800">{t.tag}</span>
                                        <span className="block text-[10px] text-slate-500 leading-tight">{t.name || '-'}</span>
                                    </td>
                                    
                                    {/* Genitore */}
                                    <td className="py-1 px-2" onClick={e => e.stopPropagation()}>
                                        <select
                                            value={t.parentId || ''}
                                            onChange={e => updateTratto(t.id, 'parentId', e.target.value ? Number(e.target.value) : null)}
                                            className="bg-transparent font-semibold text-slate-750 focus:outline-none cursor-pointer print:hidden text-xs"
                                        >
                                            <option value="">Nessuno (Radice)</option>
                                            {getEligibleParents(t.id).map(p => (
                                                <option key={p.id} value={p.id}>{computedBranchTags[p.id] || `L${p.id}`}</option>
                                            ))}
                                        </select>
                                        <span className="hidden print:inline font-semibold">
                                            {t.parentId ? computedBranchTags[t.parentId] || `L${t.parentId}` : 'Radice'}
                                        </span>
                                    </td>

                                    {/* Gerarchia */}
                                    <td className="py-1 px-2" onClick={e => e.stopPropagation()}>
                                        <select
                                            value={t.hierarchy || 'dorsale_principale'}
                                            onChange={e => updateTratto(t.id, 'hierarchy', e.target.value)}
                                            className="bg-transparent font-semibold text-slate-750 focus:outline-none cursor-pointer print:hidden text-xs"
                                        >
                                            <option value="dorsale_principale">Principale</option>
                                            <option value="dorsale_secondaria">Secondaria</option>
                                            <option value="dorsale_terziaria">Terziaria</option>
                                            <option value="utenza">Utenza</option>
                                        </select>
                                        <span className="hidden print:inline">
                                            {t.hierarchy === 'dorsale_principale' && 'Principale'}
                                            {t.hierarchy === 'dorsale_secondaria' && 'Secondaria'}
                                            {t.hierarchy === 'dorsale_terziaria' && 'Terziaria'}
                                            {t.hierarchy === 'utenza' && 'Utenza'}
                                        </span>
                                    </td>
                                    
                                    {/* Portata */}
                                    <td className="py-2.5 px-2 print:p-1">
                                        <span className="font-bold font-mono text-xs text-slate-800">{t.portata} <span className="text-[9px] text-slate-400 font-sans font-normal">m³/h</span></span>
                                    </td>
                                    
                                    {/* Materiale / DN / PN */}
                                    <td className="py-2.5 px-2 print:p-1">
                                        <div className="text-[10px] font-mono leading-tight">
                                            <div className="font-semibold text-slate-700">{t.material === 'manuale' ? 'Manuale' : t.material}</div>
                                            {t.material !== 'manuale' ? (
                                                <div className="text-slate-500 text-[9px]">DN{t.DN} {t.PN !== 'NORM' ? t.PN : ''}</div>
                                            ) : (
                                                <div className="text-slate-500 text-[9px]">Øi: {t.D} mm | sc: {t.roughness} mm</div>
                                            )}
                                        </div>
                                    </td>
                                    
                                    {/* Lunghezza */}
                                    <td className="py-2.5 px-2 print:p-1">
                                        <span className="font-bold font-mono text-xs text-slate-800">{t.length} <span className="text-[9px] text-slate-400 font-sans font-normal">m</span></span>
                                    </td>

                                    {/* Pezzi Speciali */}
                                    <td className="py-2.5 px-2 print:p-1 space-y-0.5 text-[9px] font-mono text-slate-600">
                                        { (Number(t.n_valvole) > 0 || Number(t.n_riduzioni) > 0 || Number(t.n_curve) > 0 || Number(t.n_tee) > 0) ? (
                                            <div className="grid grid-cols-2 gap-x-2 text-[8px] leading-tight">
                                                {Number(t.n_valvole) > 0 && <span>Valv: {t.n_valvole}</span>}
                                                {Number(t.n_riduzioni) > 0 && <span>Rid: {t.n_riduzioni}</span>}
                                                {Number(t.n_curve) > 0 && <span>Curv: {t.n_curve}</span>}
                                                {Number(t.n_tee) > 0 && <span>Tee: {t.n_tee}</span>}
                                            </div>
                                        ) : <span className="text-slate-400">-</span> }
                                        {t.leq_tot && t.leq_tot > 0 ? (
                                            <div className="text-[8px] text-brand-600 font-bold mt-0.5">
                                              L_eq = +{formatNumber(t.leq_tot, 1)} m
                                            </div>
                                        ) : null}
                                    </td>

                                    {/* Velocità */}
                                    <td className="py-2.5 px-2 print:p-1 font-mono text-[11px] font-bold">
                                        {formatNumber(t.velocity || 0, 2)} m/s
                                    </td>

                                    {/* Reynolds e Lambda */}
                                    <td className="py-2.5 px-2 print:p-1 font-mono text-[10px] space-y-0.5">
                                        <div>Re: {Math.round(t.Re || 0).toLocaleString()}</div>
                                        <div className="font-bold text-brand-600">λ: {formatNumber(t.lambda || 0, 4)}</div>
                                    </td>

                                    {/* Perdite Distrib. */}
                                    <td className="py-2.5 px-2 print:p-1 font-mono text-right text-slate-500">
                                        {formatPressureVal(t.loss_dist_Pa || 0, pressureUnit)}
                                    </td>

                                    {/* Perdite Conc. */}
                                    <td className="py-2.5 px-2 print:p-1 font-mono text-right text-slate-500">
                                        {formatPressureVal(t.loss_conc_Pa || 0, pressureUnit)}
                                    </td>

                                    {/* Perdite Totali */}
                                    <td className="py-2.5 px-2 print:p-1 font-mono text-right font-black text-slate-800 text-[11px]">
                                        {formatPressureVal(t.loss_tot_Pa || 0, pressureUnit)}
                                    </td>

                                    {/* Azioni */}
                                    <td className="py-2.5 px-2 print:hidden text-right" onClick={e => e.stopPropagation()}>
                                        <div className="flex gap-0.5 justify-end">
                                            <button onClick={()=>duplicateTratto(t.id)} className="p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-600 rounded cursor-pointer" title="Duplica"><IconCopy className="w-3.5 h-3.5"/></button>
                                            <button onClick={()=>removeTratto(t.id)} className="p-1 text-red-400 hover:bg-red-500 hover:text-white rounded cursor-pointer" title="Elimina"><IconTrash className="w-3.5 h-3.5"/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Sezione Dettagli Termici e Topologia (Layout verticale a larghezza intera) */}
            <div className="space-y-6 mb-6 print:hidden">
                {/* Dettagli Termici del Tratto Selezionato */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2 flex items-center justify-between">
                        <span>🌡️ Dettagli ed Isolamento Termico Tratto</span>
                        {activeTratto && (
                            <span className="text-xs font-mono bg-brand-100 text-brand-700 px-2 py-0.5 rounded-md font-black">
                                Tratto {activeTratto.tag}
                            </span>
                        )}
                    </h3>

                    {processedTratti.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 italic text-xs">
                            Aggiungi dei tratti nella tabella sopra per iniziare.
                        </div>
                    ) : activeTratto ? (
                        <div 
                            id={`tratto-card-${activeTratto.id}`}
                            className="bg-white rounded-2xl shadow-sm border p-6 border-brand-500 ring-2 ring-brand-500/10 shadow-md space-y-6"
                        >
                            {/* Titolo e Nome */}
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse"></span>
                                    Configurazione Tratto: <span className="font-mono text-brand-650 font-black">{activeTratto.tag}</span>
                                </h4>
                                <div className="text-xs text-slate-500 font-semibold bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                                    {activeTratto.name || 'Senza Nome'}
                                </div>
                            </div>

                            {/* Contenuto dell'editor a 3 Colonne */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Colonna 1: Dati Generali & Geometria + Pezzi Speciali */}
                                <div className="space-y-4">
                                    <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                                        <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-wider">1. Dati Generali & Geometria</h5>

                                        {/* Tipo Condotto — visibile solo se collegaPompaggio è attivo */}
                                        {collegaPompaggio && (
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                                                    Tipo Condotto
                                                </label>
                                                <select
                                                    value={activeTratto.tipoCondotto || 'mandata'}
                                                    onChange={e => updateTratto(activeTratto.id, 'tipoCondotto', e.target.value as 'aspirazione' | 'mandata')}
                                                    className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-semibold text-slate-800 focus:border-brand-500 focus:outline-none cursor-pointer"
                                                >
                                                    <option value="mandata">Mandata</option>
                                                    <option value="aspirazione">Aspirazione</option>
                                                </select>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2.5">
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Nome Tratto</label>
                                                <input 
                                                    type="text" 
                                                    value={activeTratto.name} 
                                                    onChange={e => updateTratto(activeTratto.id, 'name', e.target.value)} 
                                                    className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-semibold text-slate-800 focus:border-brand-500 focus:outline-none" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Portata Q (m³/h)</label>
                                                <input 
                                                    type="number" 
                                                    value={activeTratto.portata === '' ? '' : activeTratto.portata} 
                                                    onChange={e => updateTratto(activeTratto.id, 'portata', e.target.value === '' ? '' : Number(e.target.value))} 
                                                    className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-bold text-slate-800 focus:border-brand-500 focus:outline-none" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Lunghezza L (m)</label>
                                                <input 
                                                    type="number" 
                                                    value={activeTratto.length === '' ? '' : activeTratto.length} 
                                                    onChange={e => updateTratto(activeTratto.id, 'length', e.target.value === '' ? '' : Number(e.target.value))} 
                                                    className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-bold text-slate-800 focus:border-brand-500 focus:outline-none" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Materiale</label>
                                                <select 
                                                    value={activeTratto.material} 
                                                    onChange={e => updateTratto(activeTratto.id, 'material', e.target.value)} 
                                                    className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-semibold text-slate-800 focus:border-brand-500 focus:outline-none cursor-pointer"
                                                >
                                                    <option value="manuale">Manuale...</option>
                                                    {Object.keys(PIPE_CATALOG).map(m => <option key={m} value={m}>{m}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        {activeTratto.material !== 'manuale' ? (
                                            <div className="grid grid-cols-2 gap-2.5">
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">DN</label>
                                                    <select 
                                                        value={activeTratto.DN} 
                                                        onChange={e => updateTratto(activeTratto.id, 'DN', e.target.value)} 
                                                        className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-semibold text-slate-800 focus:border-brand-500 focus:outline-none cursor-pointer"
                                                    >
                                                        {Object.keys(PIPE_CATALOG[activeTratto.material]?.specs || {}).map(dn => <option key={dn} value={dn}>DN{dn}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">PN</label>
                                                    <select 
                                                        value={activeTratto.PN} 
                                                        onChange={e => updateTratto(activeTratto.id, 'PN', e.target.value)} 
                                                        className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-semibold text-slate-800 focus:border-brand-500 focus:outline-none cursor-pointer"
                                                    >
                                                        {Object.keys(PIPE_CATALOG[activeTratto.material]?.specs[activeTratto.DN] || {}).map(pn => <option key={pn} value={pn}>{pn}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-2.5">
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Ø Int. (mm)</label>
                                                    <input 
                                                        type="number" 
                                                        value={activeTratto.D === '' ? '' : activeTratto.D} 
                                                        onChange={e => updateTratto(activeTratto.id, 'D', e.target.value === '' ? '' : Number(e.target.value))} 
                                                        className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-bold text-slate-800 focus:border-brand-500 focus:outline-none" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Scabrezza (mm)</label>
                                                    <input 
                                                        type="number" 
                                                        step="0.01" 
                                                        value={activeTratto.roughness === '' ? '' : activeTratto.roughness} 
                                                        onChange={e => updateTratto(activeTratto.id, 'roughness', e.target.value === '' ? '' : Number(e.target.value))} 
                                                        className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-bold text-slate-800 focus:border-brand-500 focus:outline-none" 
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                                        <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex justify-between items-center">
                                            <span>2. Pezzi Speciali & Accessori (K)</span>
                                            {activeTratto.leq_tot && activeTratto.leq_tot > 0 ? <span className="text-[8px] text-brand-600 font-bold font-mono">L_eq = +{formatNumber(activeTratto.leq_tot, 1)} m</span> : null}
                                        </h5>
                                        <div className="grid grid-cols-4 gap-2">
                                            <div>
                                                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1 text-center">Valvole</label>
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    value={activeTratto.n_valvole === '' ? '' : activeTratto.n_valvole} 
                                                    onChange={e => updateTratto(activeTratto.id, 'n_valvole', e.target.value === '' ? '' : Number(e.target.value))} 
                                                    className="w-full text-xs p-1 bg-white border border-slate-300 rounded font-bold text-slate-800 focus:border-brand-500 focus:outline-none text-center" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1 text-center">Riduzioni</label>
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    value={activeTratto.n_riduzioni === '' ? '' : activeTratto.n_riduzioni} 
                                                    onChange={e => updateTratto(activeTratto.id, 'n_riduzioni', e.target.value === '' ? '' : Number(e.target.value))} 
                                                    className="w-full text-xs p-1 bg-white border border-slate-300 rounded font-bold text-slate-800 focus:border-brand-500 focus:outline-none text-center" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1 text-center">Curve</label>
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    value={activeTratto.n_curve === '' ? '' : activeTratto.n_curve} 
                                                    onChange={e => updateTratto(activeTratto.id, 'n_curve', e.target.value === '' ? '' : Number(e.target.value))} 
                                                    className="w-full text-xs p-1 bg-white border border-slate-300 rounded font-bold text-slate-800 focus:border-brand-500 focus:outline-none text-center" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1 text-center">Tee</label>
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    value={activeTratto.n_tee === '' ? '' : activeTratto.n_tee} 
                                                    onChange={e => updateTratto(activeTratto.id, 'n_tee', e.target.value === '' ? '' : Number(e.target.value))} 
                                                    className="w-full text-xs p-1 bg-white border border-slate-300 rounded font-bold text-slate-800 focus:border-brand-500 focus:outline-none text-center" 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sotto-sezione: Idraulica Avanzata (Fase 1 — solo campi, nessun calcolo) */}
                                    <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 space-y-3">
                                        <h5 className="text-[9px] font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>
                                            3b. Idraulica Avanzata (Geodesia & Pressioni)
                                        </h5>

                                        <div className="grid grid-cols-2 gap-2.5">
                                            {/* Temperatura Localizzata */}
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                                                    Temp. Tratto (°C)
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    value={activeTratto.tempLocalizzata === '' || activeTratto.tempLocalizzata === undefined ? '' : activeTratto.tempLocalizzata}
                                                    onChange={e => updateTratto(activeTratto.id, 'tempLocalizzata', e.target.value === '' ? '' : Number(e.target.value))}
                                                    placeholder={`Globale (${fluidTemp}°C)`}
                                                    className="w-full text-xs p-1.5 border border-indigo-200 rounded bg-white font-bold text-slate-800 focus:border-indigo-400 focus:outline-none placeholder:text-slate-300 placeholder:font-normal"
                                                />
                                                <p className="text-[8px] text-slate-400 mt-0.5 leading-tight">Lascia vuoto per usare la temperatura globale</p>
                                            </div>

                                            {/* Dislivello Geodetico */}
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                                                    Dislivello (m)
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={activeTratto.dislivelloGeodetico === '' || activeTratto.dislivelloGeodetico === undefined ? '' : activeTratto.dislivelloGeodetico}
                                                    onChange={e => updateTratto(activeTratto.id, 'dislivelloGeodetico', e.target.value === '' ? '' : Number(e.target.value))}
                                                    placeholder="0"
                                                    className="w-full text-xs p-1.5 border border-indigo-200 rounded bg-white font-bold text-slate-800 focus:border-indigo-400 focus:outline-none placeholder:text-slate-300 placeholder:font-normal"
                                                />
                                                <p className="text-[8px] text-slate-400 mt-0.5 leading-tight">Quota arrivo − quota partenza (neg. = discesa)</p>
                                            </div>
                                        </div>

                                        {/* Pressione Minima Richiesta */}
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                                                Pressione Minima Richiesta (barg)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={activeTratto.pressioneMinimaRichiesta === '' || activeTratto.pressioneMinimaRichiesta === undefined ? '' : activeTratto.pressioneMinimaRichiesta}
                                                onChange={e => updateTratto(activeTratto.id, 'pressioneMinimaRichiesta', e.target.value === '' ? '' : Number(e.target.value))}
                                                placeholder="0"
                                                className="w-full text-xs p-1.5 border border-indigo-200 rounded bg-white font-bold text-slate-800 focus:border-indigo-400 focus:outline-none placeholder:text-slate-300 placeholder:font-normal"
                                            />
                                            <p className="text-[8px] text-slate-400 mt-0.5 leading-tight">Soglia minima di pressione al nodo di arrivo del tratto</p>
                                        </div>

                                        {/* Badge riepilogativi (sola lettura — i valori salvati) */}
                                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-indigo-100">
                                            {(activeTratto.dislivelloGeodetico !== '' && activeTratto.dislivelloGeodetico !== undefined) && (
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full font-mono ${
                                                    Number(activeTratto.dislivelloGeodetico) > 0
                                                        ? 'bg-orange-100 text-orange-700'
                                                        : Number(activeTratto.dislivelloGeodetico) < 0
                                                        ? 'bg-teal-100 text-teal-700'
                                                        : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    Δz = {Number(activeTratto.dislivelloGeodetico) > 0 ? '+' : ''}{activeTratto.dislivelloGeodetico} m
                                                </span>
                                            )}
                                            {collegaPompaggio && (
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                                    activeTratto.tipoCondotto === 'aspirazione'
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {activeTratto.tipoCondotto === 'aspirazione' ? '⬆ Aspirazione' : '⬇ Mandata'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Sotto-sezione 3c: Perdite Concentrate Aggiuntive */}
                                    <div className="bg-violet-50/60 p-4 rounded-xl border border-violet-100 space-y-3">
                                        <h5 className="text-[9px] font-black text-violet-500 uppercase tracking-wider flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full"></span>
                                            3c. Perdite Concentrate Aggiuntive
                                        </h5>

                                        {/* A) Valvola di Regolazione */}
                                        <div className="space-y-1.5">
                                            <p className="text-[8px] font-bold text-slate-500 uppercase">A) Valvola di Regolazione</p>
                                            <div className="flex gap-1.5">
                                                <button onClick={() => updateTratto(activeTratto.id, 'valvolaInputMode', 'diretta')}
                                                    className={`flex-1 text-[8px] font-bold py-1 px-2 rounded border transition-all ${
                                                        (activeTratto.valvolaInputMode ?? 'diretta') === 'diretta'
                                                            ? 'bg-violet-500 text-white border-violet-500' : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300'}`}>
                                                    ΔP Diretta (Pa)
                                                </button>
                                                <button onClick={() => updateTratto(activeTratto.id, 'valvolaInputMode', 'kvs')}
                                                    className={`flex-1 text-[8px] font-bold py-1 px-2 rounded border transition-all ${
                                                        (activeTratto.valvolaInputMode ?? 'diretta') === 'kvs'
                                                            ? 'bg-violet-500 text-white border-violet-500' : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300'}`}>
                                                    Kvs (m³/h)
                                                </button>
                                            </div>
                                            {(activeTratto.valvolaInputMode ?? 'diretta') === 'diretta' ? (
                                                <div>
                                                    <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Perdita valvola (Pa)</label>
                                                    <input type="number" step="1" min="0"
                                                        value={activeTratto.valvolaPerdita === '' || activeTratto.valvolaPerdita === undefined ? '' : activeTratto.valvolaPerdita}
                                                        onChange={e => updateTratto(activeTratto.id, 'valvolaPerdita', e.target.value === '' ? '' : Number(e.target.value))}
                                                        placeholder="0"
                                                        className="w-full text-xs p-1.5 border border-violet-200 rounded bg-white font-bold text-slate-800 focus:border-violet-400 focus:outline-none"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    <div>
                                                        <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Kvs (m³/h)</label>
                                                        <input type="number" step="0.01" min="0"
                                                            value={activeTratto.valvolaKvs === '' || activeTratto.valvolaKvs === undefined ? '' : activeTratto.valvolaKvs}
                                                            onChange={e => updateTratto(activeTratto.id, 'valvolaKvs', e.target.value === '' ? '' : Number(e.target.value))}
                                                            placeholder="es. 2.5"
                                                            className="w-full text-xs p-1.5 border border-violet-200 rounded bg-white font-bold text-slate-800 focus:border-violet-400 focus:outline-none"
                                                        />
                                                    </div>
                                                    {/* Preview ΔP da Kvs */}
                                                    {(() => {
                                                        const kvs = Number(activeTratto.valvolaKvs) || 0;
                                                        const q   = Number(activeTratto.portata)    || 0;
                                                        if (kvs <= 0 || q <= 0) return null;
                                                        const dp = Math.pow(q / kvs, 2);
                                                        return (
                                                            <div className="bg-violet-100 rounded px-2 py-1 text-[8px] font-mono text-violet-800">
                                                                ΔP = ({q.toFixed(2)}/{kvs})² = <strong>{dp.toFixed(4)} bar</strong> = <strong>{(dp * 100).toFixed(2)} kPa</strong>
                                                            </div>
                                                        );
                                                    })()}
                                                    {/* Autorità */}
                                                    {(() => {
                                                        const a = activeTratto.valvola_autorita;
                                                        if (a === undefined || isNaN(a)) return null;
                                                        const pct = a * 100;
                                                        const bad = a < 0.25 || a > 0.50;
                                                        return (
                                                            <div className={`rounded px-2 py-1 text-[8px] font-bold ${bad ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                                {bad ? '⚠' : '✓'} Autorità: {pct.toFixed(1)}%
                                                                {a < 0.25 && <span className="font-normal ml-1">(min 25%)</span>}
                                                                {a > 0.50 && <span className="font-normal ml-1">(max 50%)</span>}
                                                            </div>
                                                        );
                                                    })()}
                                                    {/* Tratti circuito per autorità */}
                                                    <div>
                                                        <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Tratti circuito (per autorità)</label>
                                                        <div className="space-y-0.5 max-h-20 overflow-y-auto">
                                                            {processedTratti.filter(pt => pt.id !== activeTratto.id).map(pt => (
                                                                <label key={pt.id} className="flex items-center gap-1.5 cursor-pointer">
                                                                    <input type="checkbox"
                                                                        checked={(activeTratto.valvolaCircuitoIds || []).includes(pt.id)}
                                                                        onChange={e => {
                                                                            const ids = activeTratto.valvolaCircuitoIds || [];
                                                                            updateTratto(activeTratto.id, 'valvolaCircuitoIds',
                                                                                e.target.checked ? [...ids, pt.id] : ids.filter((x: number) => x !== pt.id)
                                                                            );
                                                                        }}
                                                                        className="accent-violet-500"
                                                                    />
                                                                    <span className="text-[8px] text-slate-600">{pt.tag} – {pt.name}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* B) Scambiatore */}
                                        <div className="space-y-1">
                                            <p className="text-[8px] font-bold text-slate-500 uppercase">B) Scambiatore di Calore</p>
                                            <input type="number" step="0.1" min="0"
                                                value={activeTratto.scambiatorePerdita === '' || activeTratto.scambiatorePerdita === undefined ? '' : activeTratto.scambiatorePerdita}
                                                onChange={e => updateTratto(activeTratto.id, 'scambiatorePerdita', e.target.value === '' ? '' : Number(e.target.value))}
                                                placeholder="0"
                                                className="w-full text-xs p-1.5 border border-violet-200 rounded bg-white font-bold text-slate-800 focus:border-violet-400 focus:outline-none"
                                            />
                                            <p className="text-[7.5px] text-slate-400 leading-tight">Perdita in kPa (max consigliato 30 kPa)</p>
                                            {(() => {
                                                const s = Number(activeTratto.scambiatorePerdita) || 0;
                                                if (s > 50) return <div className="bg-red-100 text-red-700 text-[8px] font-bold rounded px-2 py-1">🔴 {s} kPa &gt; 50 kPa — Troppo alta!</div>;
                                                if (s > 30) return <div className="bg-amber-100 text-amber-700 text-[8px] font-bold rounded px-2 py-1">⚠ {s} kPa — Elevata, max consigliato 30 kPa</div>;
                                                return null;
                                            })()}
                                        </div>

                                        {/* C) Altre perdite */}
                                        <div className="space-y-1">
                                            <p className="text-[8px] font-bold text-slate-500 uppercase">C) Altre Perdite (Pa)</p>
                                            <input type="number" step="1" min="0"
                                                value={activeTratto.altrePerdite === '' || activeTratto.altrePerdite === undefined ? '' : activeTratto.altrePerdite}
                                                onChange={e => updateTratto(activeTratto.id, 'altrePerdite', e.target.value === '' ? '' : Number(e.target.value))}
                                                placeholder="0"
                                                className="w-full text-xs p-1.5 border border-violet-200 rounded bg-white font-bold text-slate-800 focus:border-violet-400 focus:outline-none"
                                            />
                                        </div>

                                        {(activeTratto.loss_aggiuntive_Pa || 0) > 0 && (
                                            <div className="bg-violet-600 text-white rounded px-2 py-1 text-[9px] font-bold text-center">
                                                Σ Aggiuntive: {formatPressureVal(activeTratto.loss_aggiuntive_Pa || 0, pressureUnit)} {getPressureUnitLabel(pressureUnit)}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Colonna 2: Ambiente & Isolamento + Riepilogo Calcoli */}
                                <div className="space-y-4">
                                    <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                                        <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-wider">3. Ambiente & Isolamento</h5>
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Tipo Isolamento</label>
                                            <select 
                                                value={activeTratto.isoType} 
                                                onChange={e => updateTratto(activeTratto.id, 'isoType', e.target.value)} 
                                                className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-semibold text-slate-800 focus:border-brand-500 focus:outline-none cursor-pointer"
                                            >
                                                {INSULATION_CATALOG.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Spessore (mm)</label>
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    value={activeTratto.isoThick === '' ? '' : activeTratto.isoThick} 
                                                    onChange={e => updateTratto(activeTratto.id, 'isoThick', e.target.value === '' ? '' : Number(e.target.value))} 
                                                    className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-bold text-slate-800 focus:border-brand-500 focus:outline-none" 
                                                    disabled={activeTratto.isoType === 'none'}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">T. Amb. Tratto (°C)</label>
                                                <input 
                                                    type="number" 
                                                    value={activeTratto.tAmb === '' ? '' : activeTratto.tAmb} 
                                                    onChange={e => updateTratto(activeTratto.id, 'tAmb', e.target.value === '' ? '' : Number(e.target.value))} 
                                                    className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-bold text-slate-800 focus:border-brand-500 focus:outline-none" 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/60 space-y-2 text-[10px] font-mono leading-relaxed text-slate-650">
                                        <h6 className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-sans mb-2 border-b border-slate-200 pb-1 flex justify-between items-center">
                                            <span>Riepilogo Calcoli</span>
                                            <span className="text-[8px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-sans uppercase">Output</span>
                                        </h6>
                                        <div>Øi / Øe: <strong>{formatNumber(activeTratto.d_int, 1)} / {formatNumber(activeTratto.d_ext, 1)} mm</strong></div>
                                        <div>Velocità: <strong>{formatNumber(activeTratto.velocity, 2)} m/s</strong></div>
                                        <div>Reynolds: <strong>{Math.round(activeTratto.Re || 0).toLocaleString()}</strong></div>
                                        <div>ρ locale: <strong>{formatNumber(activeTratto.rho_locale, 1)} kg/m³</strong>{activeTratto.tempLocalizzata !== '' && activeTratto.tempLocalizzata !== undefined && <span className="text-indigo-500 ml-1">(T={activeTratto.tempLocalizzata}°C)</span>}</div>
                                        <div className="text-red-600 font-bold">T. Sup. Est.: {formatNumber(activeTratto.t_surf, 1)} °C</div>
                                        <div className="border-t border-slate-200/80 pt-1 mt-1 space-y-0.5">
                                            <div>∆P Distribuita: {formatPressureVal(activeTratto.loss_dist_Pa || 0, pressureUnit)} {getPressureUnitLabel(pressureUnit)}</div>
                                            <div>∆P Conc. (pezzi): {formatPressureVal(activeTratto.loss_conc_Pa || 0, pressureUnit)} {getPressureUnitLabel(pressureUnit)}</div>
                                            {(activeTratto.loss_aggiuntive_Pa || 0) > 0 && (
                                                <div className="text-violet-600">∆P Aggiuntive: {formatPressureVal(activeTratto.loss_aggiuntive_Pa || 0, pressureUnit)} {getPressureUnitLabel(pressureUnit)}</div>
                                            )}
                                            {(() => {
                                                const geo = activeTratto.contributo_geodesia_Pa || 0;
                                                if (geo === 0) return null;
                                                return (
                                                    <div className={geo > 0 ? 'text-orange-600' : 'text-teal-600'}>
                                                        ΔP Geodesia (Δz={Number(activeTratto.dislivelloGeodetico) >= 0 ? '+' : ''}{activeTratto.dislivelloGeodetico}m):
                                                        {geo > 0 ? ' +' : ' '}{formatPressureVal(Math.abs(geo), pressureUnit)} {getPressureUnitLabel(pressureUnit)} {geo > 0 ? '(salita)' : '(discesa)'}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <div className="font-bold text-brand-600 border-t border-slate-200/80 pt-1.5 mt-1">∆P Gran Totale: {formatPressureVal((activeTratto.loss_gran_tot_Pa || 0) + (activeTratto.contributo_geodesia_Pa || 0), pressureUnit)} {getPressureUnitLabel(pressureUnit)}</div>
                                        {activeTratto.pressioneNodo !== undefined && (() => {
                                            const pMin = Number(activeTratto.pressioneMinimaRichiesta) || 0;
                                            const pNodo = activeTratto.pressioneNodo!;
                                            const alarm = pNodo < pMin;
                                            return (
                                                <div className={`font-bold border-t pt-1.5 mt-1 ${ alarm ? 'text-red-600 bg-red-50 rounded px-1' : 'text-emerald-700' }`}>
                                                    P nodo arrivo: {pNodo.toFixed(3)} barg
                                                    {alarm && <span className="ml-1 text-[8px]">⚠ &lt; min ({pMin} barg)</span>}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Colonna 3: Grafico del Profilo Termico Radiale */}
                                <div className="bg-slate-50/30 p-4 rounded-xl border border-slate-200/50 flex flex-col justify-between">
                                    <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5 mb-2">4. Profilo Termico Radiale</h5>
                                    <div className="flex-1 flex items-center justify-center min-h-[220px]">
                                        <div className="w-full max-w-[320px]">
                                            <SVGGradienteSovrapposto tratto={activeTratto} fluidTemp={fluidTemp} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Box Informativo Tratto (Fase 3) */}
                            <div className="mt-6 p-4 bg-amber-50/50 border border-amber-200/60 rounded-xl space-y-2 text-xs text-slate-650 print:hidden">
                                <h5 className="font-bold text-amber-950 flex items-center gap-1.5 uppercase tracking-wide text-[9px] mb-1">
                                    💡 Guida: Parametri del Tratto & Calcoli Termici
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 leading-relaxed">
                                    <p><strong>Geometria & Pezzi Speciali:</strong> Seleziona il materiale e il diametro nominale (DN) dal catalogo integrato. Imposta la rugosità per calcolare il moto turbolento e inserisci la quantità di valvole, curve e tee per includere le perdite localizzate equivalenti.</p>
                                    <p><strong>Perdite Concentrate Aggiuntive:</strong> Consente di inserire perdite extra dovute a scambiatori (in kPa, con allarmi per perdite eccessive), valvole di regolazione (calcolandone l'autorità fluidodinamica a partire dal Kvs) o altri elementi.</p>
                                    <p><strong>Isolamento Termico:</strong> Il grafico calcola il gradiente termico radiale dal fluido all'aria esterna. Visualizza la temperatura superficiale esterna per verificare il rischio di condensa superficiale o perdite energetiche.</p>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Rappresentazione Topologica della Rete (Albero di Distribuzione - Larghezza Intera) */}
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 flex flex-col">
                    <h3 className="text-sm font-bold text-slate-700 mb-4 border-b border-slate-150 pb-2">
                        Rappresentazione Topologica della Rete (Albero di Distribuzione)
                    </h3>
                    <div className="w-full flex items-center justify-center min-h-[250px]">
                        <TopologicalTree 
                            tratti={trattiNodesForTree} 
                            activeTag={selectedTrattoId ? computedBranchTags[selectedTrattoId] : undefined}
                            pressionePartenza={pressionePartenza}
                            onSelectTag={(tag) => {
                                const foundId = Object.keys(computedBranchTags).find(key => computedBranchTags[Number(key)] === tag);
                                if (foundId) {
                                    const numId = Number(foundId);
                                    setSelectedTrattoId(numId);
                                    setTimeout(() => {
                                        const element = document.getElementById(`tratto-card-${numId}`);
                                        if (element) {
                                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }
                                    }, 100);
                                }
                            }}
                        />
                    </div>
                    
                    {/* Box Informativo Topologia (Fase 3) */}
                    <div className="mt-4 p-4 bg-amber-50/50 border border-amber-200/60 rounded-xl space-y-2 text-xs text-slate-650 print:hidden">
                        <h5 className="font-bold text-amber-950 flex items-center gap-1.5 uppercase tracking-wide text-[9px] mb-1">
                            💡 Guida: Schema Topologico & Monitoraggio Pressioni
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 leading-relaxed">
                            <p><strong>Propagazione delle Pressioni:</strong> L'albero calcola ricorsivamente la pressione in ogni nodo a partire dalla radice. Cliccando su qualsiasi nodo dello schema, la tabella evidenzierà automaticamente il tratto corrispondente per una rapida modifica dei parametri.</p>
                            <p><strong>Allarmi & Allerta Pressione:</strong> Un cerchio rosso con icona ⚠️ indica che la pressione finale sul nodo è inferiore alla pressione minima richiesta impostata per quel tratto, segnalando la necessità di aumentare la pressione di partenza o di inserire un gruppo di pompaggio.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* === RIEPILOGO GLOBALE (Fase 2) === */}
            {(() => {
                const totalGranTotPa  = processedTratti.reduce((s, t) => s + (t.loss_gran_tot_Pa  || 0), 0);
                const totalGeodesPa   = processedTratti.reduce((s, t) => s + (t.contributo_geodesia_Pa || 0), 0);
                const totalAggiuntPa  = processedTratti.reduce((s, t) => s + (t.loss_aggiuntive_Pa  || 0), 0);
                const pNodi           = processedTratti.map(t => t.pressioneNodo).filter((p): p is number => p !== undefined);
                const pMin            = pNodi.length > 0 ? Math.min(...pNodi) : undefined;
                const pMax            = pNodi.length > 0 ? Math.max(...pNodi) : undefined;
                const alarmCount      = processedTratti.filter(t =>
                    t.pressioneNodo !== undefined &&
                    (Number(t.pressioneMinimaRichiesta) || 0) > 0 &&
                    t.pressioneNodo < (Number(t.pressioneMinimaRichiesta) || 0)
                ).length;
                const totalDz         = processedTratti.reduce((s, t) => s + (Number(t.dislivelloGeodetico) || 0), 0);
                return (
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-lg p-6 border border-slate-700 mb-6 print:hidden">
                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 bg-brand-400 rounded-full"></span>
                            Riepilogo Globale Circuito
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {/* Perdita idraulica gran totale */}
                            <div className="bg-slate-700/60 rounded-xl p-3 text-center">
                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">Perdita Idraul. Totale</p>
                                <p className="text-lg font-mono font-black text-brand-400">{formatPressureVal(totalGranTotPa, pressureUnit)}</p>
                                <p className="text-[8px] text-slate-500">{getPressureUnitLabel(pressureUnit)}</p>
                            </div>
                            {/* Contributo geodetico totale */}
                            <div className="bg-slate-700/60 rounded-xl p-3 text-center">
                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">Contributo Geodetico</p>
                                <p className={`text-lg font-mono font-black ${ totalGeodesPa > 0 ? 'text-orange-400' : totalGeodesPa < 0 ? 'text-teal-400' : 'text-slate-400' }`}>
                                    {totalGeodesPa >= 0 ? '+' : ''}{formatPressureVal(totalGeodesPa, pressureUnit)}
                                </p>
                                <p className="text-[8px] text-slate-500">{getPressureUnitLabel(pressureUnit)} | Σ Δz = {totalDz >= 0 ? '+' : ''}{totalDz.toFixed(1)} m</p>
                            </div>
                            {/* Pressione min nel circuito */}
                            <div className={`rounded-xl p-3 text-center ${ alarmCount > 0 ? 'bg-red-900/60 border border-red-500/40' : 'bg-slate-700/60' }`}>
                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">P Min Circuito</p>
                                <p className={`text-lg font-mono font-black ${ alarmCount > 0 ? 'text-red-400' : 'text-emerald-400' }`}>
                                    {pMin !== undefined ? `${pMin.toFixed(3)} bar` : '—'}
                                </p>
                                {alarmCount > 0 && <p className="text-[8px] text-red-400 font-bold">⚠ {alarmCount} nodo/i sotto minima</p>}
                            </div>
                            {/* Pressione partenza vs arrivo massima perdita */}
                            <div className="bg-slate-700/60 rounded-xl p-3 text-center">
                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">P Max Nodi</p>
                                <p className="text-lg font-mono font-black text-slate-200">
                                    {pMax !== undefined ? `${pMax.toFixed(3)} bar` : '—'}
                                </p>
                                <p className="text-[8px] text-slate-500">P partenza: {Number(pressionePartenza).toFixed(2)} bar</p>
                            </div>
                        </div>
                        {/* Barra perdite aggiuntive */}
                        {totalAggiuntPa > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-700 flex flex-wrap gap-3 text-[9px]">
                                <span className="text-slate-400">Perdite aggiuntive totali:</span>
                                <span className="text-violet-400 font-bold">{formatPressureVal(totalAggiuntPa, pressureUnit)} {getPressureUnitLabel(pressureUnit)}</span>
                            </div>
                        )}

                        {/* Sezione Azioni Gruppo di Pompaggio (Fase 3) */}
                        {collegaPompaggio && (
                            <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center flex-wrap gap-3">
                                <div className="text-[10px] text-slate-400 flex items-center gap-2">
                                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span>Collegamento Gruppo di Pompaggio attivo</span>
                                </div>
                                <button
                                    onClick={() => setShowPumpDatasheet(true)}
                                    className="bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-600 hover:to-indigo-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-lg hover:shadow-brand-500/20 transform hover:-translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Genera Datasheet Pompaggio
                                </button>
                            </div>
                        )}
                    </div>

                );
            })()}

            {/* Pannello Riepilogo Perdite Totali (classico) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 print:grid-cols-3 print:gap-2 print:mb-4">
                <div className="bg-slate-800 text-white p-4 rounded-xl text-center shadow-md print:shadow-none print:border print:border-slate-200 print:text-slate-800 print:bg-slate-50 print:p-2">
                    <p className="text-xs text-slate-300 uppercase font-bold tracking-wide print:text-slate-500 print:text-[8px]">Perdite Distribuite Totali</p>
                    <p className="text-2xl font-mono font-black text-brand-400 print:text-slate-900 print:text-base">{formatPressureVal(totalLossDistPa, pressureUnit)} <span className="text-xs font-sans font-normal text-white print:text-slate-900">{getPressureUnitLabel(pressureUnit)}</span></p>
                </div>
                <div className="bg-slate-800 text-white p-4 rounded-xl text-center shadow-md print:shadow-none print:border print:border-slate-200 print:text-slate-800 print:bg-slate-50 print:p-2">
                    <p className="text-xs text-slate-300 uppercase font-bold tracking-wide print:text-slate-500 print:text-[8px]">Perdite Concentrate Totali</p>
                    <p className="text-2xl font-mono font-black text-brand-400 print:text-slate-900 print:text-base">{formatPressureVal(totalLossConcPa, pressureUnit)} <span className="text-xs font-sans font-normal text-white print:text-slate-900">{getPressureUnitLabel(pressureUnit)}</span></p>
                </div>
                <div className="bg-slate-800 text-white p-4 rounded-xl text-center shadow-md print:shadow-none print:border print:border-slate-200 print:text-slate-800 print:bg-slate-50 print:p-2">
                    <p className="text-xs text-slate-300 uppercase font-bold tracking-wide print:text-slate-500 print:text-[8px]">Perdite di Carico Totali</p>
                    <p className="text-3xl font-mono font-black text-brand-400 print:text-slate-900 print:text-base">{formatPressureVal(totalLossPa, pressureUnit)} <span className="text-sm font-sans font-normal text-white print:text-slate-900 print:text-xs">{getPressureUnitLabel(pressureUnit)}</span></p>
                </div>
            </div>

            {/* Sezione Stampa: Albero e Dettagli Termici di Tutti i Tratti */}
            <div className="hidden print:block mt-6">
                {/* Albero Topologico - Centrato e Visibile nella prima pagina */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 mb-6 break-inside-avoid print:w-full print:border-none print:p-0">
                    <h3 className="text-[10px] font-bold text-slate-800 mb-2 border-b-2 border-slate-800 pb-1 uppercase tracking-wide">
                        Topologia Rete (Albero di Distribuzione)
                    </h3>
                    <div className="w-full flex items-center justify-center p-0 print:h-auto print:overflow-visible">
                        <TopologicalTree 
                            tratti={trattiNodesForTree} 
                            activeTag={selectedTrattoId ? computedBranchTags[selectedTrattoId] : undefined}
                            pressionePartenza={pressionePartenza}
                        />
                    </div>
                </div>

                {/* Pagina successiva per i dettagli termici di ciascun tratto */}
                {processedTratti.length > 2 && <div style={{ breakBefore: 'page' }}></div>}

                <h3 className="text-[11px] font-bold text-slate-800 mb-4 uppercase tracking-wider border-b-2 border-slate-800 pb-1">
                    Dettagli Termici e Geometrici dei Tratti
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                    {processedTratti.map((t) => (
                        <div key={t.id} className="bg-white rounded-xl p-3 border border-slate-200 flex flex-col justify-between break-inside-avoid">
                            <div>
                                <h4 className="text-[10px] font-bold text-brand-700 mb-2 border-b border-slate-200 pb-1 uppercase tracking-wide flex justify-between">
                                    <span>Tratto: {t.tag}</span>
                                    <span className="text-[8px] text-slate-500 font-normal normal-case">{t.name}</span>
                                </h4>
                                <div className="text-[9px] leading-snug space-y-1 text-slate-700">
                                    <p><strong>Conduttura:</strong> {t.material === 'manuale' ? 'Manuale' : t.material} DN{t.DN} {t.PN !== 'NORM' ? t.PN : ''}</p>
                                    <p><strong>Geometria:</strong> Øi {formatNumber(t.d_int, 1)} mm | Øe {formatNumber(t.d_ext, 1)} mm</p>
                                    <p><strong>Isolamento:</strong> {INSULATION_CATALOG.find(i => i.id === t.isoType)?.name || 'Nessuno'} ({t.isoThick} mm)</p>
                                    <p><strong>Conduttività Termica (&lambda;):</strong> {t.isoLambda} W/mK</p>
                                    <p><strong>Dati Fluido:</strong> Portata {formatNumber(t.portata, 2)} m³/h | Velocità {formatNumber(t.velocity, 2)} m/s</p>
                                    <p><strong>Temperature:</strong> Fluido {fluidTemp} °C | Ambiente {t.tAmb} °C</p>
                                    <p className="text-red-700 font-bold text-[9px]">Temp. Sup. Esterna: {formatNumber(t.t_surf, 1)} °C</p>
                                </div>
                            </div>
                            <div className="w-[180px] mx-auto mt-2 shrink-0">
                                <SVGGradienteSovrapposto tratto={t} fluidTemp={fluidTemp} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal per il Datasheet del Gruppo di Pompaggio (Fase 3) */}
            {showPumpDatasheet && createPortal(
                <div id="print-datasheet-root" className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:static print:bg-white print:backdrop-blur-none">
                    <style dangerouslySetInnerHTML={{__html: `
                        @media print {
                            @page {
                                size: A4 portrait;
                                margin: 8mm 12mm;
                            }
                            html, body {
                                height: auto !important;
                                overflow: visible !important;
                                background: white !important;
                            }
                            body > :not(#print-datasheet-root) {
                                display: none !important;
                            }
                            #print-datasheet-root {
                                display: block !important;
                                position: relative !important;
                                width: 100% !important;
                                height: auto !important;
                                background: white !important;
                                color: black !important;
                                padding: 0 !important;
                                margin: 0 !important;
                            }
                            /* Compressione layout per farlo stare in 1 pagina */
                            #print-datasheet-root .p-6, 
                            #print-datasheet-root .p-8, 
                            #print-datasheet-root .md\\:p-8 {
                                padding: 0px !important;
                            }
                            #print-datasheet-root .space-y-6 > * + * {
                                margin-top: 10px !important;
                            }
                            #print-datasheet-root .space-y-4 > * + * {
                                margin-top: 6px !important;
                            }
                            #print-datasheet-root table th, 
                            #print-datasheet-root table td {
                                padding-top: 2px !important;
                                padding-bottom: 2px !important;
                                padding-left: 6px !important;
                                padding-right: 6px !important;
                                font-size: 9px !important;
                            }
                            #print-datasheet-root .pt-12 {
                                padding-top: 10px !important;
                            }
                            #print-datasheet-root .h-12 {
                                height: 20px !important;
                            }
                            #print-datasheet-root .mb-4 {
                                margin-bottom: 4px !important;
                            }
                            #print-datasheet-root .pb-4 {
                                padding-bottom: 4px !important;
                            }
                            #print-datasheet-root .text-2xl {
                                font-size: 1.15rem !important;
                            }
                            #print-datasheet-root .grid-cols-2 {
                                gap: 6px !important;
                            }
                            /* Distanziamento per evitare tagli in alto */
                            #print-datasheet-root > div {
                                margin-top: 6mm !important;
                                padding: 2px !important;
                            }
                        }
                    `}} />
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:border-none print:rounded-none print:w-full print:max-w-none print:static">
                        
                        {/* Header Modal */}
                        <div className="bg-slate-900 text-white p-4 flex justify-between items-center print:hidden">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-brand-400"></span>
                                <h4 className="text-sm font-bold tracking-wide uppercase">Datasheet Dimensionamento Gruppo Pompaggio</h4>
                            </div>
                            <button
                                onClick={() => setShowPumpDatasheet(false)}
                                className="text-slate-400 hover:text-white transition-colors p-1 cursor-pointer"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Contenuto principale del Datasheet */}
                        <div className="p-6 md:p-8 space-y-6 max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0">
                            
                            {/* Intestazione di Stampa con Logo */}
                             <div className="hidden print:flex items-center justify-between border-b border-slate-300 pb-3 mb-4">
                                 <img src={logoImg} alt="Ingegno" className="h-10 object-contain" />
                                 <div className="text-right">
                                     <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Scheda Tecnica di Dimensionamento</h2>
                                     <p className="text-xs text-slate-500 uppercase tracking-wider">Gruppo di Pompaggio</p>
                                 </div>
                             </div>

                            {/* Info Progetto */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs print:bg-white print:border-slate-300">
                                <div>
                                    <span className="text-slate-400 font-semibold block uppercase text-[9px] print:text-slate-600">Cliente</span>
                                    <span className="text-slate-800 font-bold">{projectData.client || '—'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-semibold block uppercase text-[9px] print:text-slate-600">Autore</span>
                                    <span className="text-slate-800 font-bold">{projectData.author || '—'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-semibold block uppercase text-[9px] print:text-slate-600">Data</span>
                                    <span className="text-slate-800 font-bold">{projectData.date || '—'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-semibold block uppercase text-[9px] print:text-slate-600">Fluido Circuito</span>
                                    <span className="text-slate-800 font-bold">
                                        {Number(glycolEtPercent) > 0 ? `Etilenico (${glycolEtPercent}%)` : Number(glycolPrPercent) > 0 ? `Propilenico (${glycolPrPercent}%)` : 'Acqua Pura'} 
                                        {` @ ${fluidTemp}°C`}
                                    </span>
                                </div>
                                {/* Parametri di Progetto visibili anche in stampa */}
                                <div className="border-t border-slate-200/60 pt-2 col-span-2 md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <span className="text-slate-400 font-semibold block uppercase text-[9px] print:text-slate-600">Rendimento Pompa (η)</span>
                                        <span className="text-slate-800 font-bold">{pumpEfficiency}%</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-semibold block uppercase text-[9px] print:text-slate-600">Margine Sicurezza Prevalenza</span>
                                        <span className="text-slate-800 font-bold">+{pumpSafetyMargin}%</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-semibold block uppercase text-[9px] print:text-slate-600">Configurazione Pompe</span>
                                        <span className="text-slate-800 font-bold uppercase">{pumpConfig === '1+0' ? '1 Attiva' : pumpConfig === '1+1' ? '1 Attiva + 1 Riserva' : pumpConfig === '2+1' ? '2 Attive + 1 Riserva' : pumpConfig === '3+1' ? '3 Attive + 1 Riserva' : pumpConfig}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-semibold block uppercase text-[9px] print:text-slate-600">Tipo Pompa</span>
                                        <span className="text-slate-800 font-bold capitalize">{pumpType}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Layout a Colonne: Input (sinistra) e Risultati (destra) */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:grid-cols-1 print:gap-4">
                                
                                {/* Colonna Sinistra: Parametri Modificabili */}
                                <div className="space-y-4 lg:col-span-1 print:hidden">
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-4">
                                        <h5 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide border-b pb-2">Parametri di Progetto</h5>
                                        
                                        {/* Efficienza Pompa */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                                <label>Rendimento Pompa (η)</label>
                                                <span className="text-brand-600">{pumpEfficiency}%</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="10" 
                                                max="95" 
                                                value={pumpEfficiency}
                                                onChange={e => setPumpEfficiency(Number(e.target.value))}
                                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-500"
                                            />
                                            <p className="text-[9px] text-slate-400 leading-snug">
                                                Efficienza idraulica e meccanica della pompa. È usata per calcolare la potenza all'albero (assorbita): <code className="bg-slate-100 px-1 rounded font-mono">P_asse = P_idr / η</code>.
                                            </p>
                                        </div>

                                        {/* Margine Sicurezza */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                                <label>Margine Sicurezza Prevalenza</label>
                                                <span className="text-brand-600">+{pumpSafetyMargin}%</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="50" 
                                                value={pumpSafetyMargin}
                                                onChange={e => setPumpSafetyMargin(Number(e.target.value))}
                                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-500"
                                            />
                                            <p className="text-[9px] text-slate-400 leading-snug">
                                                Incremento percentuale applicato alle perdite di carico calcolate per compensare invecchiamento e incrostazioni delle condotte: <code className="bg-slate-100 px-1 rounded font-mono">H_prog = ΔP * (1 + Margine/100)</code>.
                                            </p>
                                        </div>

                                        {/* Portata Override */}
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                                Portata di Progetto (m³/h)
                                            </label>
                                            <input 
                                                type="number"
                                                placeholder={`Auto: ${pumpSizing.q_pump_nom.toFixed(2)} m³/h`}
                                                value={pumpFlowOverride}
                                                onChange={e => setPumpFlowOverride(e.target.value)}
                                                className="w-full text-xs p-2 border border-slate-300 rounded font-semibold text-slate-800 focus:border-brand-500 focus:outline-none"
                                            />
                                            <span className="text-[8px] text-slate-400 block">
                                                Lascia vuoto per calcolo automatico (Max tra Asp. e Mand.)
                                            </span>
                                        </div>

                                        {/* Configurazione Pompe */}
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                                Configurazione Pompe
                                            </label>
                                            <select
                                                value={pumpConfig}
                                                onChange={e => setPumpConfig(e.target.value)}
                                                className="w-full text-xs p-2 border border-slate-300 rounded bg-white font-semibold text-slate-800 focus:border-brand-500 focus:outline-none cursor-pointer"
                                            >
                                                <option value="1+0">1 Attiva (Senza riserva)</option>
                                                <option value="1+1">1 Attiva + 1 Riserva (1+1)</option>
                                                <option value="2+1">2 Attive + 1 Riserva (2+1)</option>
                                                <option value="3+1">3 Attive + 1 Riserva (3+1)</option>
                                            </select>
                                        </div>

                                        {/* Tipo Installazione */}
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                                Tipo Pompa
                                            </label>
                                            <select
                                                value={pumpType}
                                                onChange={e => setPumpType(e.target.value)}
                                                className="w-full text-xs p-2 border border-slate-300 rounded bg-white font-semibold text-slate-800 focus:border-brand-500 focus:outline-none cursor-pointer"
                                            >
                                                <option value="in-line">In-line monocellulare</option>
                                                <option value="basamento">Accoppiata a giunto (Basamento)</option>
                                                <option value="monoblocco">Monoblocco / Centrifuga ad asse orizzontale</option>
                                                <option value="verticale">Pluricellulare Verticale</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Colonna Destra (2/3): Risultati Calcoli e Dati Pump */}
                                <div className="lg:col-span-2 space-y-6 print:w-full">
                                    
                                    {/* Grid Risultati Principali */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-800 flex flex-col justify-between print:bg-white print:border-slate-300 print:text-slate-800">
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block print:text-slate-500">Portata di Progetto (Q)</span>
                                            <span className="text-2xl font-mono font-black text-brand-400 mt-2 print:text-slate-900">
                                                {formatNumber(pumpSizing.q_pump_nom, 2)} <span className="text-xs font-sans font-normal text-white print:text-slate-900">m³/h</span>
                                            </span>
                                            <span className="text-[9px] text-slate-500 mt-1 print:text-slate-600">({formatNumber(pumpSizing.q_pump_nom / 3.6, 3)} l/s)</span>
                                        </div>

                                        <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-800 flex flex-col justify-between print:bg-white print:border-slate-300 print:text-slate-800">
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block print:text-slate-500">Prevalenza Totale Richiesta (H)</span>
                                            <span className="text-2xl font-mono font-black text-brand-400 mt-2 print:text-slate-900">
                                                {formatNumber(pumpSizing.prevalenza_richiesta_bar, 3)} <span className="text-xs font-sans font-normal text-white print:text-slate-900">bar</span>
                                            </span>
                                            <span className="text-[9px] text-slate-500 mt-1 print:text-slate-600">
                                                ({formatNumber(pumpSizing.prevalenza_richiesta_bar * 10.197, 2)} m.c.a. | {formatNumber(pumpSizing.prevalenza_richiesta_bar * 100, 1)} kPa)
                                            </span>
                                        </div>
                                    </div>

                                    {/* Dettagli Idraulici e Geodesia */}
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:border-slate-300">
                                        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 print:bg-white print:border-slate-300">
                                            <h6 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Dettagli dei percorsi peggiori</h6>
                                        </div>
                                        <table className="w-full text-xs text-left border-collapse">
                                            <tbody>
                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                    <th className="px-4 py-2 font-semibold text-slate-500 uppercase text-[9px] w-2/5 print:text-slate-600">Lato Aspirazione (Worst-path)</th>
                                                    <td className="px-4 py-2 font-medium text-slate-800">
                                                        {formatNumber(pumpSizing.max_suction_loss, 3)} bar 
                                                        <span className="text-slate-400 text-[10px] ml-1 print:text-slate-600">
                                                            ({formatNumber(pumpSizing.max_suction_loss * 10.197, 2)} m.c.a. perdite idrauliche + dislivello)
                                                        </span>
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                    <th className="px-4 py-2 font-semibold text-slate-500 uppercase text-[9px] print:text-slate-600">Lato Mandata (Worst-path)</th>
                                                    <td className="px-4 py-2 font-medium text-slate-800">
                                                        {formatNumber(pumpSizing.max_delivery_loss, 3)} bar 
                                                        <span className="text-slate-400 text-[10px] ml-1 print:text-slate-600">
                                                            ({formatNumber(pumpSizing.max_delivery_loss * 10.197, 2)} m.c.a. perdite idrauliche + dislivello)
                                                        </span>
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-slate-100 bg-slate-50/40 print:border-slate-300 print:bg-white">
                                                    <th className="px-4 py-2 font-semibold text-slate-500 uppercase text-[9px] print:text-slate-600">Somma Perdite Idrauliche (ΔP)</th>
                                                    <td className="px-4 py-2 font-bold text-slate-900">
                                                        {formatNumber(pumpSizing.delta_P_circuito, 3)} bar
                                                        <span className="text-slate-400 font-normal text-[10px] ml-1 print:text-slate-600">
                                                            ({formatNumber(pumpSizing.delta_P_circuito * 10.197, 2)} m.c.a.)
                                                        </span>
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                    <th className="px-4 py-2 font-semibold text-slate-500 uppercase text-[9px] print:text-slate-600">Aumento Prevalenza Richiesto dai Terminali</th>
                                                    <td className="px-4 py-2 font-medium text-slate-800">
                                                        {pumpSizing.max_terminal_boost > 0 ? (
                                                            <span className="text-amber-600 font-bold">
                                                                {formatNumber(pumpSizing.max_terminal_boost, 3)} bar
                                                                <span className="font-normal text-[10px] text-slate-500 ml-1 print:text-slate-600">
                                                                    (Necessario per vincere il gap di pressione sul nodo più sfavorito)
                                                                </span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-emerald-600">Soddisfatta (0.000 bar)</span>
                                                        )}
                                                    </td>
                                                </tr>
                                                <tr className="bg-violet-50/30 print:bg-white print:border-b print:border-slate-300">
                                                    <th className="px-4 py-2 font-semibold text-violet-700 uppercase text-[9px] print:text-slate-600">NPSH Disponibile (NPSHa)</th>
                                                    <td className="px-4 py-2 font-bold text-violet-800 print:text-slate-900">
                                                        {formatNumber(pumpSizing.npsh_a, 2)} m
                                                        <span className="text-violet-500 font-normal text-[9px] ml-2 print:text-slate-600">
                                                            (Calcolato a P_inlet = {formatNumber(pumpSizing.p_inlet_gauge, 3)} bar g, T = {formatNumber(pumpSizing.T_pump, 1)}°C, P_vapore = {formatNumber(pumpSizing.pv_bar, 3)} bar a)
                                                        </span>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Dati Motorizzazione e Potenze */}
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:border-slate-300">
                                        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 print:bg-white print:border-slate-300">
                                            <h6 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Dimensionamento Potenza e Motore Elettrico</h6>
                                        </div>
                                        <table className="w-full text-xs text-left border-collapse">
                                            <tbody>
                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                    <th className="px-4 py-2 font-semibold text-slate-500 uppercase text-[9px] w-2/5 print:text-slate-600">Potenza Idraulica (P_idr)</th>
                                                    <td className="px-4 py-2 font-mono font-medium text-slate-800">{formatNumber(pumpSizing.p_idraulica, 3)} kW</td>
                                                </tr>
                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                    <th className="px-4 py-2 font-semibold text-slate-500 uppercase text-[9px] print:text-slate-600">Potenza Assorbita all'Asse (P_asse)</th>
                                                    <td className="px-4 py-2 font-mono font-bold text-slate-900">
                                                        {formatNumber(pumpSizing.p_shaft, 3)} kW
                                                        <span className="text-slate-400 font-sans font-normal text-[9px] ml-2 print:text-slate-600">(Rendimento pompa: {pumpEfficiency}%)</span>
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                    <th className="px-4 py-2 font-semibold text-slate-500 uppercase text-[9px] print:text-slate-600">Potenza Consigliata (con coeff. sicurezza)</th>
                                                    <td className="px-4 py-2 font-mono font-medium text-slate-800">
                                                        {formatNumber(pumpSizing.p_motor_rec, 3)} kW
                                                        <span className="text-slate-400 font-sans font-normal text-[9px] ml-2 print:text-slate-600">(Coefficiente applicato: x{pumpSizing.safety_factor})</span>
                                                    </td>
                                                </tr>
                                                <tr className="bg-brand-50/30 print:bg-white print:border-b print:border-slate-300">
                                                    <th className="px-4 py-2 font-semibold text-brand-700 uppercase text-[9px] print:text-slate-600">Taglia Motore Standard consigliata</th>
                                                    <td className="px-4 py-2 font-mono font-black text-brand-800 text-sm print:text-slate-900">
                                                        {formatNumber(pumpSizing.p_motor_std, 2)} kW
                                                        <span className="text-brand-600 font-sans font-normal text-[9px] ml-2 print:text-slate-600">
                                                            (Standard IEC / NEMA)
                                                        </span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <th className="px-4 py-2 font-semibold text-slate-500 uppercase text-[9px] print:text-slate-600">Configurazione di Servizio</th>
                                                    <td className="px-4 py-2 font-medium text-slate-800 uppercase text-[10px]">
                                                        {pumpConfig === '1+0' ? '1 Pompa in funzione' : 
                                                         pumpConfig === '1+1' ? '1 Pompa in funzione + 1 in riserva' : 
                                                         pumpConfig === '2+1' ? '2 Pompe in funzione + 1 in riserva' : 
                                                         `${pumpConfig.split('+')[0]} Pompe in funzione + ${pumpConfig.split('+')[1]} in riserva`}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Note di Calcolo */}
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-[9px] leading-relaxed text-slate-600 print:bg-white print:border-slate-300 print:text-slate-700">
                                        <p className="font-bold uppercase text-[8px] text-slate-500 mb-1 print:text-slate-700">Note e Linee Guida:</p>
                                        <ul className="list-disc pl-4 space-y-1">
                                            <li>L'NPSH disponibile (NPSHa) deve essere superiore all'NPSH richiesto (NPSHr) fornito dal costruttore della pompa selezionata di almeno 0.5 metri per prevenire la cavitazione.</li>
                                            <li>La potenza elettrica standard consigliata è calcolata includendo margini di sicurezza normativi a seconda della taglia per assorbire variazioni di punto di lavoro o fluttuazioni di viscosità.</li>
                                            <li>I calcoli si riferiscono al fluido termovettore selezionato in base alla temperatura locale nella sezione di aspirazione.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer del Modal (Pulsante di Stampa) */}
                        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end gap-3 print:hidden">
                            <button
                                onClick={() => setShowPumpDatasheet(false)}
                                className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
                            >
                                Chiudi
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-lg hover:shadow-brand-500/20 transform hover:-translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                Stampa Datasheet
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>

    );
}
