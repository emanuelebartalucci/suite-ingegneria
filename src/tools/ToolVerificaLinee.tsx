import React, { useState, useMemo } from 'react';
import logoImg from '../assets/Logo.png';
import { createPortal } from 'react-dom';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import { formatNumber } from '../utils/format';
import TopologicalTree, { TrattoNode } from '../components/TopologicalTree';
import { PIPE_CATALOG, INSULATION_CATALOG, getExternalDiameter, PipeMaterial } from '../data/pipeCatalog';
import { getEquivalentLength, EquivalentLengthPiece } from '../data/equivalentLengths';
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
  pipeCatalog?: Record<string, PipeMaterial>;
  equivalentLengths?: Record<string, EquivalentLengthPiece>;
}

export interface PerditaAggiuntiva {
  id: string;
  descrizione: string;
  valore: number | string;
  unita: 'Pa' | 'kPa' | 'bar' | 'kvs';
}

export interface ValvolaRegolazione {
  id: string;
  descrizione: string;
  kvs: number | string;
  deltaP: number | string; // in Pa internamente
  inputMode: 'kvs' | 'deltaP';
  valvolaCircuitoIds?: string[]; // sigle testuali (es. ['AB', 'BC'])
  valvola_autorita?: number;
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
  /** Pressione di inizio tratto inserita manualmente (barg) — solo per tratti dopo pompa */
  pressioneInizioTratto?: number | string;
  /** Pressione di inizio tratto effettiva o calcolata (barg) */
  pressioneInizioCalcolata?: number;

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
  
  // Campi di descrizione legacy
  valvolaDesc?: string;
  scambiatoreDesc?: string;
  altrePerditeDesc?: string;

  // --- NUOVO CAMPO FASE 1 (LISTA DINAMICA) ---
  perditeAggiuntive?: PerditaAggiuntiva[];
  valvole?: ValvolaRegolazione[];

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
  if (unit === 'bar') return formatNumber(valPa / 100000, 4);
  return formatNumber(valPa / 100, 1);
};

const getPressureUnitLabel = (unit: string): string => {
  if (unit === 'Pa') return 'Pa';
  if (unit === 'kPa') return 'kPa';
  if (unit === 'mH2O' || unit === 'm.c.a.') return 'm.c.a.';
  if (unit === 'bar') return 'bar';
  return 'mbar';
};

const getPumpPressureUnitLabel = (unit: string): string => {
  return getPressureUnitLabel(unit);
};

const convertFromBar = (valBar: number, targetUnit: string): string => {
  const valPa = valBar * 100000;
  if (targetUnit === 'Pa') return formatNumber(Math.round(valPa), 0);
  if (targetUnit === 'kPa') return formatNumber(valPa / 1000, 2);
  if (targetUnit === 'mH2O' || targetUnit === 'm.c.a.') return formatNumber(valPa / 9806.65, 1);
  if (targetUnit === 'ata') return formatNumber(valPa / 98066.5, 3);
  if (targetUnit === 'mbar') return formatNumber(valPa / 100, 1);
  return formatNumber(valBar, 4);
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
    const term = (roughnessRel / 3.71) + (2.51 * x / Re);
    if (term <= 0) break;
    x = -2 * Math.log10(term);
  }
  return 1 / (x * x);
}

// Componente per disegnare la sezione geometrica del tubo sovrapposta al grafico del gradiente termico radiale
interface SVGGradienteSovrappostoProps {
  tratto: TrattoLine;
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

function SVGGradienteSovrapposto({ tratto }: SVGGradienteSovrappostoProps) {
  if (!tratto || !tratto.d_int) return null;

  const ri = tratto.d_int / 2; // Raggio interno in mm
  const re = (tratto.d_ext || (tratto.d_int + 10)) / 2; // Raggio esterno in mm
  const s_iso = Number(tratto.isoThick) || 0;
  const riso = re + s_iso; // Raggio complessivo isolato in mm

  const tf = Number(tratto.tempLocalizzata) || 55;
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
  // Con nessun isolamento: la curva dell'aria parte dalla parete esterna (t_ext_tubo a re)
  // Con isolamento: la curva parte dalla superficie dell'isolamento (t_s a riso)
  const rStartAir = (isNoneIso || s_iso <= 0) ? re : riso;
  const tStartAir = (isNoneIso || s_iso <= 0) ? t_ext_tubo : t_s;
  const airPoints: string[] = [];
  const numAirPoints = 15;
  const rEndAir = R_max;
  for (let i = 0; i <= numAirPoints; i++) {
    const fraction = i / numAirPoints;
    const r = rStartAir + fraction * (rEndAir - rStartAir);
    const temp = ta + (tStartAir - ta) * Math.exp(-3 * fraction);
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
        
        <text x={getX((rStartAir + R_max) / 2)} y={getY(ta) - 4} textAnchor="middle" fill="#94a3b8" fontSize="7" className="italic">Aria ambiente</text>
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

export function ToolVerificaLinee({ projectData, setProjectData, setAppMode, pipeCatalog, equivalentLengths }: ToolVerificaLineeProps) {
    const catalog = pipeCatalog || PIPE_CATALOG;
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
    const [activeEditorTab, setActiveEditorTab] = useState<string>('project');
    const [pumpEfficiency, setPumpEfficiency] = useState<number>(65); // %
    const [pumpSafetyMargin, setPumpSafetyMargin] = useState<number>(15); // %
    const [pumpFlowOverride, setPumpFlowOverride] = useState<string>(''); // m³/h (vuoto = automatico)
    const [pumpConfig, setPumpConfig] = useState<string>('1+1'); // '1+1', '1+0', '2+1'
    const [pumpActiveCustom, setPumpActiveCustom] = useState<number>(1);
    const [pumpReserveCustom, setPumpReserveCustom] = useState<number>(0);
    const [pumpType, setPumpType] = useState<string>('');
    const [pumpFluidText, setPumpFluidText] = useState<string>('');
    const [datasheetLang, setDatasheetLang] = useState<'ita' | 'eng'>('ita');
    const [pumpOperatingTemp, setPumpOperatingTemp] = useState<string>('');
    const [pumpMaterials, setPumpMaterials] = useState<string>('');
    const [pumpSealType, setPumpSealType] = useState<string>('');
    const [pumpNotes, setPumpNotes] = useState<string>('');

    // Unità pressione specifica del datasheet
    const [pumpPressureUnit, setPumpPressureUnit] = useState<string>('bar');

    // Parametri manuali datasheet pompa
    const [pumpLiquidHandled, setPumpLiquidHandled] = useState<string>('');
    const [pumpDesignPressureMin, setPumpDesignPressureMin] = useState<string>('');
    const [pumpDesignTempMin, setPumpDesignTempMin] = useState<string>('');
    const [pumpCorrosive, setPumpCorrosive] = useState<string>('');
    const [pumpSuspendedSolids, setPumpSuspendedSolids] = useState<string>('');
    const [pumpMaxSolidsSize, setPumpMaxSolidsSize] = useState<string>('');
    const [pumpCorrosionAllowance, setPumpCorrosionAllowance] = useState<string>('');
    const [pumpNpshRequired, setPumpNpshRequired] = useState<string>('');
    const [pumpFlowControl, setPumpFlowControl] = useState<string>('');
    const [pumpMaxHeadShutOff, setPumpMaxHeadShutOff] = useState<string>('');

    const [pumpSuctionNozzleDn, setPumpSuctionNozzleDn] = useState<string>('');
    const [pumpSuctionNozzleRating, setPumpSuctionNozzleRating] = useState<string>('');
    const [pumpDischargeNozzleDn, setPumpDischargeNozzleDn] = useState<string>('');
    const [pumpDischargeNozzleRating, setPumpDischargeNozzleRating] = useState<string>('');
    const [pumpImpellerType, setPumpImpellerType] = useState<string>('');
    const [pumpImpellerMin, setPumpImpellerMin] = useState<string>('');
    const [pumpImpellerMax, setPumpImpellerMax] = useState<string>('');
    const [pumpImpellerRated, setPumpImpellerRated] = useState<string>('');

    const [pumpBaseplate, setPumpBaseplate] = useState<string>('');
    const [pumpCouplings, setPumpCouplings] = useState<string>('');
    const [pumpFoundationBolts, setPumpFoundationBolts] = useState<string>('');
    const [pumpFoundationPlate, setPumpFoundationPlate] = useState<string>('');
    const [pumpCouplingGuard, setPumpCouplingGuard] = useState<string>('');
    const [pumpCounterFlanges, setPumpCounterFlanges] = useState<string>('');

    const [pumpDriverType, setPumpDriverType] = useState<string>('');
    const [pumpPowerSupply, setPumpPowerSupply] = useState<string>('');
    const [pumpRpm, setPumpRpm] = useState<string>('');
    const [pumpEnclosureType, setPumpEnclosureType] = useState<string>('');
    const [pumpAutoStart, setPumpAutoStart] = useState<string>('');

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

    // Calcolo densità e viscosità dinamica basati sulla temperatura del tratto selezionato (o il primo) e sulle percentuali di glicole in acqua
    const fluidProps = useMemo(() => {
        const selTratto = tratti.find(x => x.id === selectedTrattoId) || tratti[0];
        const T = selTratto ? (Number(selTratto.tempLocalizzata) || 55) : 55;
        const xEt = (Number(glycolEtPercent) || 0) / 100;
        const xPr = (Number(glycolPrPercent) || 0) / 100;

        return computeFluidPropsAtT(T, xEt, xPr);
    }, [selectedTrattoId, tratti, glycolEtPercent, glycolPrPercent]);

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
            } else if (catalog[t.material]) {
                const dnSpecs = catalog[t.material].specs[t.DN];
                if (dnSpecs) d_int = dnSpecs[t.PN] || 50;
                roughness = catalog[t.material].roughness;
            }

            const isoType   = t.isoType || 'pur';
            const isoThick  = t.isoThick === '' ? '' : (t.isoThick !== undefined ? Number(t.isoThick) : 50);
            const isoLambda = t.isoLambda !== undefined ? Number(t.isoLambda) : 0.025;
            const tAmbVal   = t.tAmb === '' ? '' : (t.tAmb !== undefined ? Number(t.tAmb) : -5);
            const activeIsoThick = isoThick === '' ? 0 : Number(isoThick);
            const activeTAmb     = tAmbVal  === '' ? 0 : Number(tAmbVal);

            // Temperatura per questo tratto
            const T_tratto = Number(t.tempLocalizzata) || 55;
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

            const leq_valvola   = getEquivalentLength('valvola_diaframma', t.DN, equivalentLengths);
            const leq_riduzione = getEquivalentLength('riduzione', t.DN, equivalentLengths);
            const leq_curva     = getEquivalentLength('curva_d', t.DN, equivalentLengths);
            const leq_tee       = getEquivalentLength('innesto_t', t.DN, equivalentLengths);
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

            // Sincronizzazione dinamica e calcolo perdite valvole di regolazione
            const valvoleProcessate = (t.valvole || []).map(valv => {
                const flow = flow_m3h;
                let calcolatoDeltaP = Number(valv.deltaP) || 0;
                let calcolatoKvs = Number(valv.kvs) || 0;

                if (valv.inputMode === 'kvs') {
                    if (calcolatoKvs > 0) {
                        calcolatoDeltaP = Math.pow(flow / calcolatoKvs, 2) * 100000;
                    } else {
                        calcolatoDeltaP = 0;
                    }
                } else { // 'deltaP'
                    if (calcolatoDeltaP > 0 && flow > 0) {
                        calcolatoKvs = flow / Math.sqrt(calcolatoDeltaP / 100000);
                    } else {
                        calcolatoKvs = 0;
                    }
                }

                return {
                    ...valv,
                    deltaP: calcolatoDeltaP,
                    kvs: calcolatoKvs
                };
            });

            let loss_valvole_tot_Pa = 0;
            valvoleProcessate.forEach(v => {
                loss_valvole_tot_Pa += v.deltaP;
            });

            // Perdite aggiuntive generiche
            let loss_scambiatore_Pa = 0;
            let loss_altre_Pa = 0;
            let loss_aggiuntive_Pa = loss_valvole_tot_Pa;

            const items = t.perditeAggiuntive || [];
            items.forEach(item => {
                const val = Number(item.valore) || 0;
                let itemLossPa = 0;
                if (item.unita === 'kvs') {
                    if (val > 0) {
                        itemLossPa = Math.pow(flow_m3h / val, 2) * 100000;
                    }
                } else if (item.unita === 'kPa') {
                    itemLossPa = val * 1000;
                    loss_scambiatore_Pa += itemLossPa;
                } else if (item.unita === 'bar') {
                    itemLossPa = val * 100000;
                    loss_altre_Pa += itemLossPa;
                } else { // 'Pa'
                    itemLossPa = val;
                    loss_altre_Pa += itemLossPa;
                }
                loss_aggiuntive_Pa += itemLossPa;
            });

            const loss_gran_tot_Pa    = loss_tot_Pa + loss_aggiuntive_Pa;

            // Contributo geodetico (Pa): positivo = salita
            const dz = Number(t.dislivelloGeodetico) || 0;
            const contributo_geodesia_Pa = rho_locale * g * dz;

            // Calcolo termico
            let d_ext = d_int + 10;
            if (t.material && t.DN && catalog[t.material]) {
                const specs = catalog[t.material].specs[t.DN];
                if (specs) d_ext = getExternalDiameter(t.material, t.DN, specs[t.PN] || d_int);
            } else if (t.D) { d_ext = Number(t.D) + 10; }

            const r_int_m = d_int_m / 2;
            const r_ext_m = d_ext / 2000;
            const s_iso_m = activeIsoThick / 1000;
            const r_iso_m = r_ext_m + s_iso_m;
            const lp = (catalog[t.material] && catalog[t.material].lambda) || 50.0;
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
                loss_valvola_Pa: loss_valvole_tot_Pa, loss_scambiatore_Pa, loss_altre_Pa,
                loss_aggiuntive_Pa, loss_gran_tot_Pa, contributo_geodesia_Pa,
                valvole: valvoleProcessate
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
            
            const isDopoPompa = (t.tipoCondotto === 'mandata' && t.parentId !== null && byId[t.parentId]?.tipoCondotto === 'aspirazione') ||
                                (t.parentId === null && (t.tipoCondotto === 'mandata' || !t.tipoCondotto));
            
            let P_in = P0;
            if (isDopoPompa && t.pressioneInizioTratto !== '' && t.pressioneInizioTratto !== undefined) {
                P_in = Number(t.pressioneInizioTratto);
            } else {
                P_in = (t.parentId === null || !byId[t.parentId!])
                    ? P0 : (byId[t.parentId!].pressioneNodo ?? P0);
            }
            
            const delta_bar = ((t.loss_gran_tot_Pa || 0) + (t.contributo_geodesia_Pa || 0)) / 100000;
            t.pressioneNodo = P_in - delta_bar;
            t.pressioneInizioCalcolata = P_in;
        });

        // ---- PASSATA 3: autorità valvole ----
        tratti.forEach(t => {
            const tp = byId[t.id];
            if (!tp || !tp.valvole || tp.valvole.length === 0) return;
            
            tp.valvole = tp.valvole.map(valv => {
                if (!valv.valvolaCircuitoIds || valv.valvolaCircuitoIds.length === 0 || !valv.deltaP) {
                    return { ...valv, valvola_autorita: undefined };
                }
                
                let lc = 0;
                valv.valvolaCircuitoIds.forEach(tag => {
                    const trattoCircuito = Object.values(byId).find(x => x.tag === tag);
                    if (trattoCircuito) {
                        lc += (trattoCircuito.loss_gran_tot_Pa || 0);
                    }
                });
                
                const lossValvPa = Number(valv.deltaP) || 0;
                const autorita = lossValvPa / (lossValvPa + lc);
                
                return {
                    ...valv,
                    valvola_autorita: Number(autorita.toFixed(4))
                };
            });

            // Imposta valvola_autorita legacy sul tratto per compatibilità, usando la prima valvola con autorità
            const primaConAutorita = tp.valvole.find(v => v.valvola_autorita !== undefined);
            tp.valvola_autorita = primaConAutorita ? primaConAutorita.valvola_autorita : undefined;
        });

        return Object.values(byId);
    }, [tratti, glycolEtPercent, glycolPrPercent, computedBranchTags, pressionePartenza]);


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

        // Calcolo NPSH disponibile e pressione monte pompa (inlet)
        const p_inlet_gauge = suctionBoundaries.length > 0 
            ? Math.min(...suctionBoundaries.map(t => t.pressioneNodo ?? P0)) 
            : P0;

        // Perdita totale circuito (bar)
        const delta_P_circuito = max_suction_loss + max_delivery_loss;

        // Margine di sicurezza e prevalenza richiesta
        const safety_margin_val = (Number(pumpSafetyMargin) || 0) / 100;
        let prevalenza_richiesta_bar = delta_P_circuito * (1 + safety_margin_val);

        // Prevalenza richiesta per soddisfare le pressioni minime dei terminali
        // P_nodo_i = P_partenza + P_boost - loss_path_i >= P_min_i => P_boost >= P_min_i - P_nodo_i (senza boost)
        const max_terminal_boost = processedTratti.length > 0
            ? Math.max(0, ...processedTratti.map(t => (Number(t.pressioneMinimaRichiesta) || 0) - (t.pressioneNodo ?? 0)))
            : 0;

        // Allineamento prevalenza: la prevalenza della pompa deve coprire l'aumento richiesto dai terminali se superiore
        if (max_terminal_boost > 0) {
            const terminal_boost_with_safety = max_terminal_boost * (1 + safety_margin_val);
            if (terminal_boost_with_safety > prevalenza_richiesta_bar) {
                prevalenza_richiesta_bar = terminal_boost_with_safety;
            }
        }

        // Sovrascrittura della prevalenza in caso di impostazione manuale della pressione a valle (pressioneInizioTratto)
        const deliveryStarts = processedTratti.filter(t => 
            t.tipoCondotto === 'mandata' && 
            (t.parentId === null || byId[t.parentId]?.tipoCondotto === 'aspirazione')
        );
        const manualStartBranch = deliveryStarts.find(t => t.pressioneInizioTratto !== '' && t.pressioneInizioTratto !== undefined);
        if (manualStartBranch) {
            const p_outlet_gauge = Number(manualStartBranch.pressioneInizioTratto) || 0;
            prevalenza_richiesta_bar = (p_outlet_gauge - p_inlet_gauge) * (1 + safety_margin_val);
        }

        let worstSuctionBranch = suctionBoundaries.find(t => t.pressioneNodo === p_inlet_gauge);
        const T_pump = worstSuctionBranch && worstSuctionBranch.tempLocalizzata !== '' && worstSuctionBranch.tempLocalizzata !== undefined
            ? Number(worstSuctionBranch.tempLocalizzata)
            : 55;

        const fluidProps = computeFluidPropsAtT(T_pump, xEt_glob, xPr_glob);
        const rho_pump = fluidProps.rho;
        const visc_pump = fluidProps.visc;

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
            safety_factor,
            visc_pump
        };
    }, [processedTratti, glycolEtPercent, glycolPrPercent, pressionePartenza, pumpEfficiency, pumpSafetyMargin, pumpFlowOverride]);



    const addTratto = () => {
        const defaultParent = tratti[tratti.length - 1]?.id || null;
        const parent = defaultParent ? tratti.find(x => x.id === defaultParent) : null;
        const newId = tratti.length > 0 ? Math.max(...tratti.map(t => t.id)) + 1 : 1;
        
        const newTratto: TrattoLine = { 
            id: newId, 
            tag: `L${newId}`, 
            name: `Linea Tratto ${newId}`, 
            portata: parent ? parent.portata : '', 
            material: parent ? parent.material : Object.keys(catalog)[0], 
            DN: parent ? parent.DN : Object.keys(catalog[Object.keys(catalog)[0]].specs)[0], 
            PN: parent ? parent.PN : Object.keys(catalog[Object.keys(catalog)[0]].specs[Object.keys(catalog[Object.keys(catalog)[0]].specs)[0]])[0], 
            length: '', 
            n_valvole: 0, 
            n_riduzioni: 0, 
            n_curve: 0, 
            n_tee: 0,
            hierarchy: parent ? parent.hierarchy : 'dorsale_principale',
            parentId: defaultParent,
            isoType: parent ? parent.isoType : 'pur',
            isoThick: parent ? parent.isoThick : 50,
            isoLambda: parent ? parent.isoLambda : 0.025,
            tAmb: parent ? parent.tAmb : -5,
            // Fase 1
            tipoCondotto: parent ? parent.tipoCondotto : 'mandata',
            tempLocalizzata: parent ? (parent.tempLocalizzata !== '' && parent.tempLocalizzata !== undefined ? parent.tempLocalizzata : 55) : 55,
            dislivelloGeodetico: '',
            pressioneMinimaRichiesta: 0,
            pressioneInizioTratto: '',
            // Fase 2
            valvolaInputMode: 'diretta',
            valvolaPerdita: '',
            valvolaKvs: '',
            valvolaCircuitoIds: [],
            scambiatorePerdita: '',
            altrePerdite: '',
            perditeAggiuntive: [],
            valvole: [],
        };

        if (parent && parent.material === 'manuale') {
            newTratto.D = parent.D;
            newTratto.roughness = parent.roughness;
        }

        setTratti([
            ...tratti, 
            newTratto
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
                
                if (field === 'parentId' && val !== null) {
                    const parent = prev.find(p => p.id === val);
                    if (parent) {
                        updated.material = parent.material;
                        updated.portata = parent.portata;
                        updated.DN = parent.DN;
                        updated.PN = parent.PN;
                        updated.tAmb = parent.tAmb;
                        updated.hierarchy = parent.hierarchy;
                        updated.isoType = parent.isoType;
                        updated.isoThick = parent.isoThick;
                        updated.isoLambda = parent.isoLambda;
                        updated.tempLocalizzata = parent.tempLocalizzata;
                        if (parent.material === 'manuale') {
                            updated.D = parent.D;
                            updated.roughness = parent.roughness;
                        }
                    }
                }

                if (field === 'isoType') {
                    const matched = INSULATION_CATALOG.find(i => i.id === val);
                    updated.isoLambda = matched ? matched.lambda : 0.025;
                }

                if (field === 'portata') {
                    const newFlow = val === '' ? 0 : Number(val);
                    if (updated.valvole && updated.valvole.length > 0) {
                        updated.valvole = updated.valvole.map(v => {
                            let updatedValv = { ...v };
                            if (v.inputMode === 'kvs') {
                                const kvsVal = Number(v.kvs) || 0;
                                if (kvsVal > 0) {
                                    updatedValv.deltaP = Math.pow(newFlow / kvsVal, 2) * 100000;
                                } else {
                                    updatedValv.deltaP = 0;
                                }
                            } else { // 'deltaP'
                                const dpPa = Number(v.deltaP) || 0;
                                if (dpPa > 0 && newFlow > 0) {
                                    updatedValv.kvs = newFlow / Math.sqrt(dpPa / 100000);
                                } else {
                                    updatedValv.kvs = 0;
                                }
                            }
                            return updatedValv;
                        });
                    }
                }
                
                if (field === 'material' && val !== 'manuale') {
                    const firstDN = Object.keys(catalog[val].specs)[0];
                    const firstPN = Object.keys(catalog[val].specs[firstDN])[0];
                    updated.DN = firstDN; updated.PN = firstPN;
                }
                else if (field === 'DN' && updated.material !== 'manuale') {
                    let currentPN = updated.PN;
                    if (!catalog[updated.material].specs[val][currentPN]) {
                        currentPN = Object.keys(catalog[updated.material].specs[val])[0];
                    }
                    updated.PN = currentPN;
                }
                return updated;
            }
            return t;
        }));
    };

    const updateValvola = (trattoId: number, valvolaId: string, field: keyof ValvolaRegolazione, val: any) => {
        setTratti(prev => prev.map(t => {
            if (t.id === trattoId) {
                const currentValvole = t.valvole || [];
                const updatedValvole = currentValvole.map(v => {
                    if (v.id === valvolaId) {
                        let updated = { ...v, [field]: val } as ValvolaRegolazione;
                        const flow = Number(t.portata) || 0;

                        if (field === 'deltaP') {
                            let valPa = Number(val) || 0;
                            // Converti dall'unità di visualizzazione corrente a Pa internamente
                            if (pressureUnit === 'kPa') valPa = valPa * 1000;
                            else if (pressureUnit === 'bar') valPa = valPa * 100000;
                            else if (pressureUnit === 'mH2O') valPa = valPa * 9806.65;
                            else if (pressureUnit === 'mbar') valPa = valPa * 100;

                            updated.deltaP = valPa;
                            updated.inputMode = 'deltaP';

                            if (valPa > 0 && flow > 0) {
                                updated.kvs = flow / Math.sqrt(valPa / 100000);
                            } else {
                                updated.kvs = 0;
                            }
                        }
                        else if (field === 'kvs') {
                            const kvsVal = Number(val) || 0;
                            updated.kvs = val;
                            updated.inputMode = 'kvs';

                            if (kvsVal > 0) {
                                updated.deltaP = Math.pow(flow / kvsVal, 2) * 100000;
                            } else {
                                updated.deltaP = 0;
                            }
                        }

                        return updated;
                    }
                    return v;
                });
                return { ...t, valvole: updatedValvole };
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
    const totalLossConcPa = processedTratti.reduce((s, t) => s + (t.loss_conc_Pa || 0) + (t.loss_aggiuntive_Pa || 0), 0);
    const totalLossPa = totalLossDistPa + totalLossConcPa;

    const activeTratto = processedTratti.find(x => x.id === selectedTrattoId) || processedTratti[0];

    const handleLoadCloudProject = (data: any) => {
        if (!data) return;
        const legacyFluidTemp = data.fluidTemp !== undefined ? data.fluidTemp : 55;
        if (data.pressureUnit !== undefined) setPressureUnit(data.pressureUnit);
        // Nuovi campi globali Fase 1 (retrocompatibili: default se assenti)
        if (data.collegaPompaggio !== undefined) setCollegaPompaggio(data.collegaPompaggio);
        else setCollegaPompaggio(false);
        if (data.pressionePartenza !== undefined) setPressionePartenza(data.pressionePartenza);
        else setPressionePartenza(0);

        if (data.pumpEfficiency !== undefined) setPumpEfficiency(data.pumpEfficiency);
        if (data.pumpSafetyMargin !== undefined) setPumpSafetyMargin(data.pumpSafetyMargin);
        if (data.pumpFlowOverride !== undefined) setPumpFlowOverride(data.pumpFlowOverride);
        if (data.pumpConfig !== undefined) setPumpConfig(data.pumpConfig);
        if (data.pumpActiveCustom !== undefined) setPumpActiveCustom(data.pumpActiveCustom);
        else setPumpActiveCustom(1);
        if (data.pumpReserveCustom !== undefined) setPumpReserveCustom(data.pumpReserveCustom);
        else setPumpReserveCustom(0);
        if (data.pumpType !== undefined) setPumpType(data.pumpType);
        if (data.pumpFluidText !== undefined) setPumpFluidText(data.pumpFluidText);
        else setPumpFluidText('');
        if (data.pumpPressureUnit !== undefined) setPumpPressureUnit(data.pumpPressureUnit);
        else setPumpPressureUnit('bar');
        const cleanDash = (val: any) => {
            if (typeof val === 'string' && (val.trim() === '--' || val.trim() === '---')) return '';
            return val ?? '';
        };
        if (data.pumpLiquidHandled !== undefined) setPumpLiquidHandled(data.pumpLiquidHandled);
        if (data.pumpDesignPressureMin !== undefined) setPumpDesignPressureMin(data.pumpDesignPressureMin);
        if (data.pumpDesignTempMin !== undefined) setPumpDesignTempMin(data.pumpDesignTempMin);
        if (data.pumpCorrosive !== undefined) setPumpCorrosive(data.pumpCorrosive);
        if (data.pumpSuspendedSolids !== undefined) setPumpSuspendedSolids(cleanDash(data.pumpSuspendedSolids));
        if (data.pumpMaxSolidsSize !== undefined) setPumpMaxSolidsSize(cleanDash(data.pumpMaxSolidsSize));
        if (data.pumpCorrosionAllowance !== undefined) setPumpCorrosionAllowance(cleanDash(data.pumpCorrosionAllowance));
        if (data.pumpNpshRequired !== undefined) setPumpNpshRequired(data.pumpNpshRequired);
        if (data.pumpFlowControl !== undefined) setPumpFlowControl(data.pumpFlowControl);
        if (data.pumpMaxHeadShutOff !== undefined) setPumpMaxHeadShutOff(cleanDash(data.pumpMaxHeadShutOff));
        if (data.pumpSuctionNozzleDn !== undefined) setPumpSuctionNozzleDn(data.pumpSuctionNozzleDn);
        if (data.pumpSuctionNozzleRating !== undefined) setPumpSuctionNozzleRating(data.pumpSuctionNozzleRating);
        if (data.pumpDischargeNozzleDn !== undefined) setPumpDischargeNozzleDn(data.pumpDischargeNozzleDn);
        if (data.pumpDischargeNozzleRating !== undefined) setPumpDischargeNozzleRating(data.pumpDischargeNozzleRating);
        if (data.pumpImpellerType !== undefined) setPumpImpellerType(data.pumpImpellerType);
        if (data.pumpImpellerMin !== undefined) setPumpImpellerMin(cleanDash(data.pumpImpellerMin));
        if (data.pumpImpellerMax !== undefined) setPumpImpellerMax(cleanDash(data.pumpImpellerMax));
        if (data.pumpImpellerRated !== undefined) setPumpImpellerRated(cleanDash(data.pumpImpellerRated));
        if (data.pumpBaseplate !== undefined) setPumpBaseplate(data.pumpBaseplate);
        if (data.pumpCouplings !== undefined) setPumpCouplings(data.pumpCouplings);
        if (data.pumpFoundationBolts !== undefined) setPumpFoundationBolts(data.pumpFoundationBolts);
        if (data.pumpFoundationPlate !== undefined) setPumpFoundationPlate(data.pumpFoundationPlate);
        if (data.pumpCouplingGuard !== undefined) setPumpCouplingGuard(data.pumpCouplingGuard);
        if (data.pumpCounterFlanges !== undefined) setPumpCounterFlanges(data.pumpCounterFlanges);
        if (data.pumpDriverType !== undefined) setPumpDriverType(data.pumpDriverType);
        if (data.pumpPowerSupply !== undefined) setPumpPowerSupply(data.pumpPowerSupply);
        if (data.pumpRpm !== undefined) setPumpRpm(data.pumpRpm);
        if (data.pumpEnclosureType !== undefined) setPumpEnclosureType(data.pumpEnclosureType);
        if (data.pumpAutoStart !== undefined) setPumpAutoStart(data.pumpAutoStart);
        if (data.datasheetLang !== undefined) setDatasheetLang(data.datasheetLang);
        else setDatasheetLang('ita');
        if (data.pumpOperatingTemp !== undefined) setPumpOperatingTemp(data.pumpOperatingTemp);
        else setPumpOperatingTemp('');
        if (data.pumpMaterials !== undefined) setPumpMaterials(data.pumpMaterials);
        else setPumpMaterials('');
        if (data.pumpSealType !== undefined) setPumpSealType(data.pumpSealType);
        else setPumpSealType('');
        if (data.pumpNotes !== undefined) setPumpNotes(data.pumpNotes);
        else setPumpNotes('');
        
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
                
                let perditeAggiuntive: PerditaAggiuntiva[] = t.perditeAggiuntive || [];
                if (perditeAggiuntive.length === 0) {
                    if ((t.valvolaPerdita !== undefined && t.valvolaPerdita !== '') || (t.valvolaKvs !== undefined && t.valvolaKvs !== '')) {
                        perditeAggiuntive.push({
                            id: 'legacy-valvola-' + Math.random().toString(36).substr(2, 9),
                            descrizione: t.valvolaDesc || 'Valvola di Regolazione',
                            valore: t.valvolaInputMode === 'kvs' ? (t.valvolaKvs ?? '') : (t.valvolaPerdita ?? ''),
                            unita: t.valvolaInputMode === 'kvs' ? 'kvs' : 'Pa'
                        });
                    }
                    if (t.scambiatorePerdita !== undefined && t.scambiatorePerdita !== '') {
                        perditeAggiuntive.push({
                            id: 'legacy-scambiatore-' + Math.random().toString(36).substr(2, 9),
                            descrizione: t.scambiatoreDesc || 'Scambiatore di Calore',
                            valore: t.scambiatorePerdita,
                            unita: 'kPa'
                        });
                    }
                    if (t.altrePerdite !== undefined && t.altrePerdite !== '') {
                        perditeAggiuntive.push({
                            id: 'legacy-altre-' + Math.random().toString(36).substr(2, 9),
                            descrizione: t.altrePerditeDesc || 'Altre Perdite',
                            valore: t.altrePerdite,
                            unita: 'Pa'
                        });
                    }
                }

                let valvole: ValvolaRegolazione[] = t.valvole || [];
                if (valvole.length === 0) {
                    if ((t.valvolaPerdita !== undefined && t.valvolaPerdita !== '') || (t.valvolaKvs !== undefined && t.valvolaKvs !== '')) {
                        const vecchiCircuitoIds = (t.valvolaCircuitoIds || []).map((x: any) => String(x));
                        valvole.push({
                            id: 'valvola-legacy-' + Math.random().toString(36).substr(2, 9),
                            descrizione: t.valvolaDesc || 'Valvola di Regolazione',
                            kvs: t.valvolaKvs ?? '',
                            deltaP: t.valvolaPerdita ?? '',
                            inputMode: t.valvolaInputMode === 'kvs' ? 'kvs' : 'deltaP',
                            valvolaCircuitoIds: vecchiCircuitoIds
                        });
                    }
                }

                return {
                    ...t,
                    id: newId,
                    parentId: newParentId,
                    // Retrocompatibilità Fase 1
                    tipoCondotto:             t.tipoCondotto             ?? 'mandata',
                    tempLocalizzata:          (t.tempLocalizzata !== '' && t.tempLocalizzata !== undefined) ? t.tempLocalizzata : legacyFluidTemp,
                    dislivelloGeodetico:      t.dislivelloGeodetico      ?? '',
                    pressioneMinimaRichiesta: t.pressioneMinimaRichiesta ?? 0,
                    pressioneInizioTratto:    t.pressioneInizioTratto    ?? '',
                    // Retrocompatibilità Fase 2
                    valvolaInputMode:         t.valvolaInputMode         ?? 'diretta',
                    valvolaPerdita:           t.valvolaPerdita           ?? '',
                    valvolaKvs:               t.valvolaKvs               ?? '',
                    valvolaCircuitoIds:       t.valvolaCircuitoIds       ?? [],
                    scambiatorePerdita:       t.scambiatorePerdita       ?? '',
                    altrePerdite:             t.altrePerdite             ?? '',
                    valvolaDesc:              t.valvolaDesc              ?? '',
                    scambiatoreDesc:          t.scambiatoreDesc          ?? '',
                    altrePerditeDesc:         t.altrePerditeDesc         ?? '',
                    perditeAggiuntive:        perditeAggiuntive,
                    valvole:                  valvole
                };
            });
        }
        setTratti(loadedTratti);
        setSelectedTrattoId(null);
    };

    const getCloudSaveData = () => {
        const legacyFluidTemp = tratti[0]?.tempLocalizzata !== '' && tratti[0]?.tempLocalizzata !== undefined ? Number(tratti[0].tempLocalizzata) : 55;
        return {
            fluidTemp: legacyFluidTemp,
            glycolEtPercent,
            glycolPrPercent,
            tratti,
            pressureUnit,
            // Nuovi campi globali Fase 1
            collegaPompaggio,
            pressionePartenza,
            
            // Parametri Datasheet Pompa
            pumpEfficiency,
            pumpSafetyMargin,
            pumpFlowOverride,
            pumpConfig,
            pumpActiveCustom,
            pumpReserveCustom,
            pumpType,
            pumpFluidText,
            pumpPressureUnit,
            pumpLiquidHandled,
            pumpDesignPressureMin,
            pumpDesignTempMin,
            pumpCorrosive,
            pumpSuspendedSolids,
            pumpMaxSolidsSize,
            pumpCorrosionAllowance,
            pumpNpshRequired,
            pumpFlowControl,
            pumpMaxHeadShutOff,
            pumpSuctionNozzleDn,
            pumpSuctionNozzleRating,
            pumpDischargeNozzleDn,
            pumpDischargeNozzleRating,
            pumpImpellerType,
            pumpImpellerMin,
            pumpImpellerMax,
            pumpImpellerRated,
            pumpBaseplate,
            pumpCouplings,
            pumpFoundationBolts,
            pumpFoundationPlate,
            pumpCouplingGuard,
            pumpCounterFlanges,
            pumpDriverType,
            pumpPowerSupply,
            pumpRpm,
            pumpEnclosureType,
            pumpAutoStart,
            datasheetLang,
            pumpOperatingTemp,
            pumpMaterials,
            pumpSealType,
            pumpNotes
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
                tipoCondotto: t.tipoCondotto,
                pressioneInizioTratto: t.pressioneInizioCalcolata,
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
                        {['mbar', 'bar', 'Pa', 'kPa', 'mH2O'].map((unit) => (
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center print:hidden">
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
                <div className="hidden print:grid print:grid-cols-3 print:gap-4 print:mb-2 text-xs">
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
                                <th className="py-2.5 px-2 print:p-1">Portata</th>
                                <th className="py-2.5 px-2 print:p-1">Temperatura</th>
                                <th className="py-2.5 px-2 print:p-1">Delta Quota</th>
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
                                        <span className="font-bold font-mono text-xs text-slate-800">{t.portata !== '' ? `${t.portata} m³/h` : '-'}</span>
                                    </td>
                                    
                                    {/* Temperatura */}
                                    <td className="py-2.5 px-2 print:p-1 font-mono text-xs text-slate-800">
                                        <span className="font-bold text-slate-800">{t.tempLocalizzata || 55} °C</span>
                                    </td>
                                    
                                    {/* Delta Quota */}
                                    <td className="py-2.5 px-2 print:p-1 font-mono text-xs text-slate-800">
                                        {t.dislivelloGeodetico !== '' && t.dislivelloGeodetico !== undefined && Number(t.dislivelloGeodetico) !== 0 ? (
                                            <span className={Number(t.dislivelloGeodetico) > 0 ? 'text-orange-600 font-bold' : 'text-teal-600 font-bold'}>
                                                {Number(t.dislivelloGeodetico) > 0 ? '+' : ''}{t.dislivelloGeodetico} m
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">0 m</span>
                                        )}
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
                                        {formatPressureVal((t.loss_conc_Pa || 0) + (t.loss_aggiuntive_Pa || 0), pressureUnit)}
                                    </td>

                                    {/* Perdite Totali */}
                                    <td className="py-2.5 px-2 print:p-1 font-mono text-right font-black text-slate-800 text-[11px]">
                                        {formatPressureVal(t.loss_gran_tot_Pa || 0, pressureUnit)}
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
                                                    {Object.keys(catalog).map(m => <option key={m} value={m}>{m}</option>)}
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
                                                        {Object.keys(catalog[activeTratto.material]?.specs || {}).map(dn => <option key={dn} value={dn}>DN{dn}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">PN</label>
                                                    <select 
                                                        value={activeTratto.PN} 
                                                        onChange={e => updateTratto(activeTratto.id, 'PN', e.target.value)} 
                                                        className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-semibold text-slate-800 focus:border-brand-500 focus:outline-none cursor-pointer"
                                                    >
                                                        {Object.keys(catalog[activeTratto.material]?.specs[activeTratto.DN] || {}).map(pn => <option key={pn} value={pn}>{pn}</option>)}
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
                                                    Temp. Fluido Tratto (°C)
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    value={activeTratto.tempLocalizzata === '' || activeTratto.tempLocalizzata === undefined ? '' : activeTratto.tempLocalizzata}
                                                    onChange={e => updateTratto(activeTratto.id, 'tempLocalizzata', e.target.value === '' ? '' : Number(e.target.value))}
                                                    placeholder="55"
                                                    className="w-full text-xs p-1.5 border border-indigo-200 rounded bg-white font-bold text-slate-800 focus:border-indigo-400 focus:outline-none placeholder:text-slate-300 placeholder:font-normal"
                                                />
                                                <p className="text-[8px] text-slate-400 mt-0.5 leading-tight">Valore predefinito: 55°C</p>
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

                                        {/* Pressione di Inizio Tratto Manuale — solo per tratti dopo pompa */}
                                        {(() => {
                                            const isDopoPompa = (activeTratto.tipoCondotto === 'mandata' && activeTratto.parentId !== null && processedTratti.find(x => x.id === activeTratto.parentId)?.tipoCondotto === 'aspirazione') ||
                                                                (activeTratto.parentId === null && (activeTratto.tipoCondotto === 'mandata' || !activeTratto.tipoCondotto));
                                            if (!isDopoPompa) return null;
                                            return (
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                                                        Pressione di Inizio Tratto (barg)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={activeTratto.pressioneInizioTratto === '' || activeTratto.pressioneInizioTratto === undefined ? '' : activeTratto.pressioneInizioTratto}
                                                        onChange={e => updateTratto(activeTratto.id, 'pressioneInizioTratto', e.target.value === '' ? '' : Number(e.target.value))}
                                                        placeholder={`Globale (${formatNumber(pressionePartenza, 2)} barg)`}
                                                        className="w-full text-xs p-1.5 border border-indigo-200 rounded bg-white font-bold text-slate-800 focus:border-indigo-400 focus:outline-none placeholder:text-slate-300 placeholder:font-normal"
                                                    />
                                                    <p className="text-[8px] text-slate-400 mt-0.5 leading-tight">Imposta la pressione iniziale manuale per questo tratto situato subito dopo la pompa</p>
                                                </div>
                                            );
                                        })()}

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

                                    {/* Sotto-sezione 3c: Perdite Concentrate Aggiuntive Dinamiche */}
                                    <div className="bg-violet-50/60 p-4 rounded-xl border border-violet-100 space-y-3">
                                        <h5 className="text-[9px] font-black text-violet-500 uppercase tracking-wider flex justify-between items-center">
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 bg-violet-400 rounded-full"></span>
                                                3c. Perdite Concentrate Aggiuntive
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const current = activeTratto.perditeAggiuntive || [];
                                                    const newLoss = {
                                                        id: Math.random().toString(36).substr(2, 9),
                                                        descrizione: '',
                                                        valore: '',
                                                        unita: 'Pa' as const
                                                    };
                                                    updateTratto(activeTratto.id, 'perditeAggiuntive', [...current, newLoss]);
                                                }}
                                                className="px-2 py-1 bg-violet-600 text-white rounded text-[8px] font-bold hover:bg-violet-700 cursor-pointer transition-all"
                                            >
                                                + Aggiungi Perdita
                                            </button>
                                        </h5>

                                        <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                                            {(!activeTratto.perditeAggiuntive || activeTratto.perditeAggiuntive.length === 0) ? (
                                                <p className="text-[9px] text-slate-400 italic text-center py-2">Nessuna perdita aggiuntiva inserita.</p>
                                            ) : (
                                                activeTratto.perditeAggiuntive.map((item, idx) => {
                                                    const isKvs = item.unita === 'kvs';
                                                    return (
                                                        <div key={item.id} className="bg-white p-2.5 rounded-lg border border-violet-200/50 space-y-2 relative shadow-sm">
                                                            <div className="flex items-center justify-between gap-1">
                                                                <span className="text-[8px] font-bold text-violet-600">Voce #{idx + 1}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const current = activeTratto.perditeAggiuntive || [];
                                                                        updateTratto(activeTratto.id, 'perditeAggiuntive', current.filter(x => x.id !== item.id));
                                                                    }}
                                                                    className="text-red-500 hover:text-red-700 text-[9px] font-bold cursor-pointer"
                                                                    title="Rimuovi perdita"
                                                                >
                                                                    Elimina
                                                                </button>
                                                            </div>
                                                            
                                                            <div className="grid grid-cols-1 gap-1.5">
                                                                <div>
                                                                    <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Descrizione</label>
                                                                    <input 
                                                                        type="text"
                                                                        value={item.descrizione}
                                                                        onChange={e => {
                                                                            const current = activeTratto.perditeAggiuntive || [];
                                                                            updateTratto(activeTratto.id, 'perditeAggiuntive', current.map(x => x.id === item.id ? { ...x, descrizione: e.target.value } : x));
                                                                        }}
                                                                        placeholder="es. Filtro a rete, Scambiatore, ecc."
                                                                        className="w-full text-xs p-1 border border-slate-200 rounded focus:border-violet-400 focus:outline-none"
                                                                    />
                                                                </div>
                                                                
                                                                <div className="grid grid-cols-2 gap-1.5">
                                                                    <div>
                                                                        <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Valore</label>
                                                                        <input 
                                                                            type="number"
                                                                            step="any"
                                                                            value={item.valore}
                                                                            onChange={e => {
                                                                                const current = activeTratto.perditeAggiuntive || [];
                                                                                updateTratto(activeTratto.id, 'perditeAggiuntive', current.map(x => x.id === item.id ? { ...x, valore: e.target.value === '' ? '' : Number(e.target.value) } : x));
                                                                            }}
                                                                            placeholder="0"
                                                                            className="w-full text-xs p-1 border border-slate-200 rounded font-bold text-slate-800 focus:border-violet-400 focus:outline-none font-mono"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Unità</label>
                                                                        <select
                                                                            value={item.unita}
                                                                            onChange={e => {
                                                                                const current = activeTratto.perditeAggiuntive || [];
                                                                                updateTratto(activeTratto.id, 'perditeAggiuntive', current.map(x => x.id === item.id ? { ...x, unita: e.target.value as any } : x));
                                                                            }}
                                                                            className="w-full text-xs p-1 border border-slate-200 rounded bg-white font-semibold text-slate-700 focus:border-violet-400 focus:outline-none cursor-pointer"
                                                                        >
                                                                            <option value="Pa">Pa</option>
                                                                            <option value="kPa">kPa</option>
                                                                            <option value="bar">bar</option>
                                                                            <option value="kvs">Kvs (m³/h)</option>
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Logica speciale KVS (Calcolo ΔP e Autorità) */}
                                                            {isKvs && (
                                                                <div className="bg-violet-50 p-2 rounded border border-violet-100 space-y-1.5 text-[8px] font-mono text-violet-850">
                                                                    {(() => {
                                                                        const kvs = Number(item.valore) || 0;
                                                                        const q = Number(activeTratto.portata) || 0;
                                                                        if (kvs <= 0 || q <= 0) return null;
                                                                        const dp = Math.pow(q / kvs, 2); // in bar
                                                                        return (
                                                                            <div>
                                                                                ΔP = ({formatNumber(q, 2)}/{formatNumber(kvs, 2)})² = <strong>{formatNumber(dp, 4)} bar</strong> = <strong>{formatNumber(dp * 100, 2)} kPa</strong>
                                                                            </div>
                                                                        );
                                                                    })()}

                                                                    {(() => {
                                                                        const a = activeTratto.valvola_autorita;
                                                                        if (a === undefined || isNaN(a)) return null;
                                                                        const realPct = a * 100;
                                                                        const bad = a < 0.25 || a > 0.50;
                                                                        return (
                                                                            <div className={`rounded px-1 py-0.5 font-bold ${bad ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                                                {bad ? '⚠' : '✓'} Autorità: {formatNumber(realPct, 1)}%
                                                                                {a < 0.25 && <span className="font-normal ml-1">(min 25%)</span>}
                                                                                {a > 0.50 && <span className="font-normal ml-1">(max 50%)</span>}
                                                                            </div>
                                                                        );
                                                                    })()}

                                                                    <div className="space-y-0.5">
                                                                        <span className="block font-bold text-slate-500 uppercase tracking-wide">Tratti circuito per autorità:</span>
                                                                        <div className="max-h-20 overflow-y-auto bg-white p-1 rounded border border-violet-200/50">
                                                                            {processedTratti.filter(pt => pt.id !== activeTratto.id).map(pt => (
                                                                                <label key={pt.id} className="flex items-center gap-1 cursor-pointer">
                                                                                    <input 
                                                                                        type="checkbox"
                                                                                        checked={(activeTratto.valvolaCircuitoIds || []).includes(pt.id)}
                                                                                        onChange={e => {
                                                                                            const ids = activeTratto.valvolaCircuitoIds || [];
                                                                                            updateTratto(activeTratto.id, 'valvolaCircuitoIds',
                                                                                                e.target.checked ? [...ids, pt.id] : ids.filter((x: number) => x !== pt.id)
                                                                                            );
                                                                                        }}
                                                                                        className="accent-violet-500 w-2.5 h-2.5 animate-none"
                                                                                    />
                                                                                    <span className="text-[7.5px] text-slate-600 font-sans">{pt.tag} – {pt.name}</span>
                                                                                </label>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>

                                        {(activeTratto.loss_aggiuntive_Pa || 0) > 0 && (
                                            <div className="bg-violet-600 text-white rounded px-2 py-1 text-[9px] font-bold text-center">
                                                Σ Aggiuntive: {formatPressureVal(activeTratto.loss_aggiuntive_Pa || 0, pressureUnit)} {getPressureUnitLabel(pressureUnit)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Sotto-sezione 3d: Valvole di Regolazione */}
                                    <div className="bg-brand-50/60 p-4 rounded-xl border border-brand-100 space-y-3">
                                        <h5 className="text-[9px] font-black text-brand-600 uppercase tracking-wider flex justify-between items-center font-sans">
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 bg-brand-500 rounded-full"></span>
                                                3d. Valvole di Regolazione
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const current = activeTratto.valvole || [];
                                                    const newValvola = {
                                                        id: 'valvola-' + Math.random().toString(36).substr(2, 9),
                                                        descrizione: '',
                                                        kvs: '',
                                                        deltaP: '',
                                                        inputMode: 'kvs',
                                                        valvolaCircuitoIds: []
                                                    };
                                                    updateTratto(activeTratto.id, 'valvole', [...current, newValvola]);
                                                }}
                                                className="px-2 py-1 bg-brand-600 text-white rounded text-[8px] font-bold hover:bg-brand-700 cursor-pointer transition-all animate-none"
                                            >
                                                + Aggiungi Valvola
                                            </button>
                                        </h5>

                                        <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                                            {(!activeTratto.valvole || activeTratto.valvole.length === 0) ? (
                                                <p className="text-[9px] text-slate-400 italic text-center py-2">Nessuna valvola di regolazione inserita.</p>
                                            ) : (
                                                activeTratto.valvole.map((valvola, idx) => {
                                                    const isKvsMode = valvola.inputMode === 'kvs';
                                                    
                                                    // Converti deltaP interno (Pa) per la visualizzazione
                                                    const getDispVal = (dpPa: any) => {
                                                        const val = Number(dpPa) || 0;
                                                        if (val === 0) return '';
                                                        if (pressureUnit === 'kPa') return Number((val / 1000).toFixed(4));
                                                        if (pressureUnit === 'bar') return Number((val / 100000).toFixed(6));
                                                        if (pressureUnit === 'mH2O') return Number((val / 9806.65).toFixed(4));
                                                        if (pressureUnit === 'mbar') return Number((val / 100).toFixed(2));
                                                        return val;
                                                    };

                                                    return (
                                                        <div key={valvola.id} className="bg-white p-2.5 rounded-lg border border-brand-200/50 space-y-2 relative shadow-sm">
                                                            <div className="flex items-center justify-between gap-1">
                                                                <span className="text-[8px] font-bold text-brand-600">Valvola #{idx + 1}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const current = activeTratto.valvole || [];
                                                                        updateTratto(activeTratto.id, 'valvole', current.filter((x: any) => x.id !== valvola.id));
                                                                    }}
                                                                    className="text-red-500 hover:text-red-700 text-[9px] font-bold cursor-pointer"
                                                                    title="Rimuovi valvola"
                                                                >
                                                                    Elimina
                                                                </button>
                                                            </div>

                                                            <div>
                                                                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Descrizione</label>
                                                                <input 
                                                                    type="text"
                                                                    value={valvola.descrizione}
                                                                    onChange={e => {
                                                                        const current = activeTratto.valvole || [];
                                                                        updateTratto(activeTratto.id, 'valvole', current.map((x: any) => x.id === valvola.id ? { ...x, descrizione: e.target.value } : x));
                                                                    }}
                                                                    placeholder="es. Valvola controllo mandata, ecc."
                                                                    className="w-full text-xs p-1 border border-slate-200 rounded focus:border-brand-400 focus:outline-none"
                                                                />
                                                            </div>

                                                            {/* Tab Selettore Mode */}
                                                            <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        updateValvola(activeTratto.id, valvola.id, 'kvs', valvola.kvs || 0);
                                                                    }}
                                                                    className={`flex-1 text-center py-1 text-[8px] font-bold rounded-md transition-all cursor-pointer ${
                                                                        isKvsMode 
                                                                            ? 'bg-white text-brand-700 shadow-sm' 
                                                                            : 'text-slate-500 hover:text-slate-800'
                                                                    }`}
                                                                >
                                                                    Kvs (m³/h)
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const dispVal = getDispVal(valvola.deltaP);
                                                                        updateValvola(activeTratto.id, valvola.id, 'deltaP', dispVal || 0);
                                                                    }}
                                                                    className={`flex-1 text-center py-1 text-[8px] font-bold rounded-md transition-all cursor-pointer ${
                                                                        !isKvsMode 
                                                                            ? 'bg-white text-brand-700 shadow-sm' 
                                                                            : 'text-slate-500 hover:text-slate-800'
                                                                    }`}
                                                                >
                                                                    ΔP Diretta ({getPressureUnitLabel(pressureUnit)})
                                                                </button>
                                                            </div>

                                                            {/* Input Valore Principale */}
                                                            <div>
                                                                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">
                                                                    {isKvsMode ? 'Kvs (m³/h)' : `Perdita Valvola (${getPressureUnitLabel(pressureUnit)})`}
                                                                </label>
                                                                <input 
                                                                    type="number"
                                                                    step="any"
                                                                    value={isKvsMode ? valvola.kvs : getDispVal(valvola.deltaP)}
                                                                    onChange={e => {
                                                                        const field = isKvsMode ? 'kvs' : 'deltaP';
                                                                        updateValvola(activeTratto.id, valvola.id, field, e.target.value);
                                                                    }}
                                                                    placeholder="0"
                                                                    className="w-full text-xs p-1 border border-slate-200 rounded font-bold text-slate-800 focus:border-brand-400 focus:outline-none font-mono"
                                                                />
                                                            </div>

                                                            {/* Risultato Sincronizzato & Autorità */}
                                                            <div className="bg-slate-50 p-2 rounded border border-slate-100 space-y-1.5 text-[8px] font-mono text-slate-700">
                                                                <div>
                                                                    {isKvsMode ? (
                                                                        <span>
                                                                            ΔP Calcolato: <strong>{formatPressureVal(Number(valvola.deltaP) || 0, pressureUnit)} {getPressureUnitLabel(pressureUnit)}</strong>
                                                                        </span>
                                                                    ) : (
                                                                        <span>
                                                                            Kvs Calcolato: <strong>{valvola.kvs ? formatNumber(valvola.kvs, 3) : '—'} m³/h</strong>
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {valvola.valvola_autorita !== undefined && !isNaN(valvola.valvola_autorita) && (() => {
                                                                    const a = valvola.valvola_autorita;
                                                                    const realPct = a * 100;
                                                                    const bad = a < 0.25 || a > 0.50;
                                                                    return (
                                                                        <div className={`rounded px-1 py-0.5 font-bold ${bad ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                                            {bad ? '⚠' : '✓'} Autorità: {formatNumber(realPct, 1)}%
                                                                            {a < 0.25 && <span className="font-normal ml-1">(min 25%)</span>}
                                                                            {a > 0.50 && <span className="font-normal ml-1">(max 50%)</span>}
                                                                        </div>
                                                                    );
                                                                })()}

                                                                <div className="space-y-0.5">
                                                                    <span className="block font-bold text-slate-500 uppercase tracking-wide">Tratti circuito per autorità:</span>
                                                                    <div className="max-h-20 overflow-y-auto bg-white p-1 rounded border border-brand-200/30">
                                                                        {processedTratti.map(pt => (
                                                                            <label key={pt.id} className="flex items-center gap-1 cursor-pointer">
                                                                                <input 
                                                                                    type="checkbox"
                                                                                    checked={(valvola.valvolaCircuitoIds || []).includes(pt.tag)}
                                                                                    onChange={e => {
                                                                                        const currentTags = valvola.valvolaCircuitoIds || [];
                                                                                        const updated = e.target.checked 
                                                                                            ? [...currentTags, pt.tag] 
                                                                                            : currentTags.filter((x: any) => x !== pt.tag);
                                                                                        updateValvola(activeTratto.id, valvola.id, 'valvolaCircuitoIds', updated);
                                                                                    }}
                                                                                    className="accent-brand-500 w-2.5 h-2.5 animate-none"
                                                                                />
                                                                                <span className="text-[7.5px] text-slate-600 font-sans">{pt.tag} – {pt.name}</span>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
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
                                                <div className="text-violet-600">
                                                    <div>∆P Aggiuntive: {formatPressureVal(activeTratto.loss_aggiuntive_Pa || 0, pressureUnit)} {getPressureUnitLabel(pressureUnit)}</div>
                                                    <div className="pl-2 text-[8px] text-violet-500 font-sans list-none space-y-0.5">
                                                        {(activeTratto.valvole || []).map((v, i) => {
                                                            const dpVal = Number(v.deltaP) || 0;
                                                            if (dpVal <= 0) return null;
                                                            return (
                                                                <div key={v.id || i} className="text-brand-600 font-semibold">
                                                                    • [Valvola] {v.descrizione || 'Regolazione'}: {formatPressureVal(dpVal, pressureUnit)} {getPressureUnitLabel(pressureUnit)} {v.kvs ? `(Kvs: ${formatNumber(v.kvs, 2)})` : ''}
                                                                </div>
                                                            );
                                                         })}
                                                         {(activeTratto.perditeAggiuntive || []).map((item, i) => {
                                                             const val = Number(item.valore) || 0;
                                                             if (val <= 0) return null;
                                                             return (
                                                                 <div key={item.id || i}>
                                                                     • {item.descrizione || 'Perdita'}: {formatNumber(item.valore, 2)} {item.unita}
                                                                 </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
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
                                            const pIniz = activeTratto.pressioneInizioCalcolata;
                                            const alarm = pNodo < pMin;
                                            return (
                                                <div className="border-t pt-1.5 mt-1 space-y-0.5 font-sans">
                                                    {pIniz !== undefined && (
                                                        <div className="text-slate-650">P inizio tratto: <strong>{formatNumber(pIniz, 3)} barg</strong></div>
                                                    )}
                                                    <div className={`font-bold ${ alarm ? 'text-red-600 bg-red-50 rounded px-1' : 'text-emerald-700' }`}>
                                                        P nodo arrivo: {formatNumber(pNodo, 3)} barg
                                                        {alarm && <span className="ml-1 text-[8px]">⚠ &lt; min ({formatNumber(pMin, 3)} barg)</span>}
                                                     </div>
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
                                            <SVGGradienteSovrapposto tratto={activeTratto} />
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
                                if (!tag) {
                                    setSelectedTrattoId(null);
                                    return;
                                }
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
                const totalDz         = processedTratti.reduce((s, t) => s + (Number(t.dislivelloGeodetico) || 0), 0);
                const totalGranTotPa  = processedTratti.reduce((s, t) => s + (t.loss_gran_tot_Pa  || 0), 0);
                const totalGeodesPa   = Math.abs(totalDz) < 0.001 ? 0 : processedTratti.reduce((s, t) => s + (t.contributo_geodesia_Pa || 0), 0);
                const totalAggiuntPa  = processedTratti.reduce((s, t) => s + (t.loss_aggiuntive_Pa  || 0), 0);
                const P0_val          = Number(pressionePartenza) || 0;
                const pIniziali       = processedTratti.map(t => t.pressioneInizioCalcolata).filter((p): p is number => p !== undefined && p !== null);
                const pFinali         = processedTratti.map(t => t.pressioneNodo).filter((p): p is number => p !== undefined && p !== null);
                const pNodi           = [P0_val, ...pIniziali, ...pFinali];
                const pMin            = pFinali.length > 0 ? Math.min(...pFinali) : (pNodi.length > 0 ? Math.min(...pNodi) : undefined);
                const pMax            = pNodi.length > 0 ? Math.max(...pNodi) : undefined;
                const alarmCount      = processedTratti.filter(t =>
                    t.pressioneNodo !== undefined &&
                    (Number(t.pressioneMinimaRichiesta) || 0) > 0 &&
                    t.pressioneNodo < (Number(t.pressioneMinimaRichiesta) || 0)
                ).length;
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
                                <p className="text-lg font-mono font-black text-cyan-400">{formatPressureVal(totalGranTotPa, pressureUnit)}</p>
                                <p className="text-[8px] text-slate-500">{getPressureUnitLabel(pressureUnit)}</p>
                            </div>
                            {/* Contributo geodetico totale */}
                            <div className="bg-slate-700/60 rounded-xl p-3 text-center">
                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">Contributo Geodetico</p>
                                <p className={`text-lg font-mono font-black ${ totalGeodesPa > 0 ? 'text-orange-400' : totalGeodesPa < 0 ? 'text-teal-400' : 'text-slate-400' }`}>
                                    {totalGeodesPa >= 0 ? '+' : ''}{formatPressureVal(totalGeodesPa, pressureUnit)}
                                </p>
                                <p className="text-[8px] text-slate-500">{getPressureUnitLabel(pressureUnit)} | Σ Δz = {totalDz >= 0 ? '+' : ''}{formatNumber(totalDz, 1)} m</p>
                            </div>
                            {/* Pressione min nel circuito */}
                            <div className={`rounded-xl p-3 text-center ${ alarmCount > 0 ? 'bg-red-900/60 border border-red-500/40' : 'bg-slate-700/60' }`}>
                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">P Min Circuito</p>
                                <p className={`text-lg font-mono font-black ${ alarmCount > 0 ? 'text-red-400' : 'text-emerald-400' }`}>
                                    {pMin !== undefined ? `${formatNumber(pMin, 3)} bar` : '—'}
                                </p>
                                {alarmCount > 0 && <p className="text-[8px] text-red-400 font-bold">⚠ {alarmCount} nodo/i sotto minima</p>}
                            </div>
                            {/* Pressione partenza vs arrivo massima perdita */}
                            <div className="bg-slate-700/60 rounded-xl p-3 text-center">
                                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">P Max Nodi</p>
                                <p className="text-lg font-mono font-black text-slate-200">
                                    {pMax !== undefined ? `${formatNumber(pMax, 3)} bar` : '—'}
                                </p>
                                <p className="text-[8px] text-slate-500">P partenza: {formatNumber(pressionePartenza, 2)} bar</p>
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
                                    onClick={() => {
                                        setActiveEditorTab('project');
                                        setShowPumpDatasheet(true);
                                    }}
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
                                    <p><strong>Temperature:</strong> Fluido {t.tempLocalizzata || 55} °C | Ambiente {t.tAmb} °C</p>
                                    {t.dislivelloGeodetico !== '' && t.dislivelloGeodetico !== undefined && Number(t.dislivelloGeodetico) !== 0 ? (
                                        <p><strong>Delta Quota:</strong> {Number(t.dislivelloGeodetico) > 0 ? '+' : ''}{formatNumber(t.dislivelloGeodetico, 1)} m</p>
                                    ) : null}
                                    {t.pressioneInizioCalcolata !== undefined && (
                                        <p><strong>Pressione Inizio:</strong> {formatNumber(t.pressioneInizioCalcolata, 2)} barg</p>
                                    )}
                                    {t.pressioneNodo !== undefined && (
                                        <p><strong>Pressione Nodo Arrivo:</strong> {formatNumber(t.pressioneNodo, 2)} barg</p>
                                    )}
                                    {((t.valvole && t.valvole.length > 0) || (t.perditeAggiuntive && t.perditeAggiuntive.length > 0)) ? (
                                        <div>
                                            <strong>Perdite Aggiuntive & Valvole:</strong>
                                            <ul className="list-disc pl-3 text-[8px] mt-0.5">
                                                {(t.valvole || []).map((v, i) => {
                                                    const dpVal = Number(v.deltaP) || 0;
                                                    return (
                                                        <li key={v.id || i}>
                                                            [Valvola] {v.descrizione || 'Regolazione'}: {formatPressureVal(dpVal, pressureUnit)} {getPressureUnitLabel(pressureUnit)} {v.kvs ? `(Kvs: ${formatNumber(v.kvs, 2)})` : ''}
                                                        </li>
                                                    );
                                                })}
                                                {(t.perditeAggiuntive || []).map((item, i) => (
                                                    <li key={item.id || i}>{item.descrizione || 'Perdita'}: {item.valore} {item.unita}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : null}
                                    <p className="text-red-700 font-bold text-[9px]">Temp. Sup. Esterna: {formatNumber(t.t_surf, 1)} °C</p>
                                </div>
                            </div>
                            <div className="w-[180px] mx-auto mt-2 shrink-0">
                                <SVGGradienteSovrapposto tratto={t} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal per il Datasheet del Gruppo di Pompaggio (Fase 4) */}
            {showPumpDatasheet && createPortal(
                <div id="print-datasheet-root" className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:static print:bg-white print:backdrop-blur-none">
                    <style dangerouslySetInnerHTML={{__html: `
                        /* Stili per l'anteprima a schermo */
                        #datasheet-print-area {
                            background-color: white !important;
                            color: #1e293b !important; /* slate-800 */
                            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                            font-size: 12px !important;
                        }
                        #datasheet-print-area table {
                            font-size: 11px !important;
                            line-height: 1.35 !important;
                            border-collapse: collapse !important;
                            width: 100% !important;
                        }
                        #datasheet-print-area table td {
                            padding: 4.5px 7px !important;
                        }
                        #datasheet-print-area h4 {
                            font-size: 12.5px !important;
                            margin-top: 10px !important;
                            margin-bottom: 4px !important;
                            font-weight: 800 !important;
                        }
                        
                        /* Stili dedicati per la stampa A4 */
                        @media print {
                            @page {
                                size: A4 portrait;
                                margin: 8mm 10mm;
                            }
                            html, body {
                                height: auto !important;
                                overflow: visible !important;
                                background: white !important;
                                color: black !important;
                            }
                            body > :not(#print-datasheet-root) {
                                display: none !important;
                            }
                            #print-datasheet-root {
                                display: block !important;
                                position: static !important;
                                width: 100% !important;
                                height: auto !important;
                                background: white !important;
                                padding: 0 !important;
                                margin: 0 !important;
                            }
                            .print-editor-sidebar {
                                display: none !important;
                            }
                            #print-datasheet-root .print-main-content {
                                width: 100% !important;
                                max-width: none !important;
                                padding: 0 !important;
                                margin: 0 !important;
                            }
                            #datasheet-print-area {
                                border: none !important;
                                box-shadow: none !important;
                                padding: 0 !important;
                                margin: 0 !important;
                                font-size: 12.5px !important;
                                width: 100% !important;
                                max-width: none !important;
                            }
                            #datasheet-print-area table {
                                font-size: 11.5px !important;
                                line-height: 1.35 !important;
                            }
                            #datasheet-print-area table td {
                                padding: 4.5px 8px !important;
                                border-bottom: 1px solid #cbd5e1 !important; /* slate-300 in print */
                            }
                            #datasheet-print-area h4 {
                                font-size: 12.5px !important;
                                margin-top: 10px !important;
                                margin-bottom: 5px !important;
                            }
                        }
                    `}} />
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:border-none print:rounded-none print:w-full print:max-w-none print:static flex flex-col h-[90vh] print:h-auto">
                        
                        {/* Header Modal */}
                        <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0 print:hidden">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-brand-400"></span>
                                <h4 className="text-sm font-bold tracking-wide uppercase">Scheda Tecnica / Datasheet Gruppo Pompaggio</h4>
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

                        {/* Corpo Split: Editor (sinistra) e Scheda Tecnica (destra) */}
                        <div className="flex flex-1 overflow-hidden print:overflow-visible print:block">
                            
                            {/* Editor Parametri - Colonna Sinistra (Nascondibile in Stampa) */}
                            <div className="w-[320px] bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 print-editor-sidebar print:hidden">
                                {/* Navigazione Tab Editor */}
                                <div className="grid grid-cols-5 border-b border-slate-200 bg-slate-100 text-[8px] leading-tight font-extrabold text-center text-slate-500 uppercase">
                                    <button 
                                        onClick={() => setActiveEditorTab('project')}
                                        className={`py-2 border-r border-slate-200 cursor-pointer ${activeEditorTab === 'project' ? 'bg-white text-brand-600 font-extrabold border-b-2 border-b-brand-500' : 'hover:bg-slate-50'}`}
                                        title="Unità e Generali"
                                    >
                                        Dati<br/>Generali
                                    </button>
                                    <button 
                                        onClick={() => setActiveEditorTab('process')}
                                        className={`py-2 border-r border-slate-200 cursor-pointer ${activeEditorTab === 'process' ? 'bg-white text-brand-600 font-extrabold border-b-2 border-b-brand-500' : 'hover:bg-slate-50'}`}
                                        title="Condizioni Operative"
                                    >
                                        Condiz.<br/>Operative
                                    </button>
                                    <button 
                                        onClick={() => setActiveEditorTab('equipment')}
                                        className={`py-2 border-r border-slate-200 cursor-pointer ${activeEditorTab === 'equipment' ? 'bg-white text-brand-600 font-extrabold border-b-2 border-b-brand-500' : 'hover:bg-slate-50'}`}
                                        title="Caratteristiche Pompa"
                                    >
                                        Dati<br/>Pompa
                                    </button>
                                    <button 
                                        onClick={() => setActiveEditorTab('accessories')}
                                        className={`py-2 border-r border-slate-200 cursor-pointer ${activeEditorTab === 'accessories' ? 'bg-white text-brand-600 font-extrabold border-b-2 border-b-brand-500' : 'hover:bg-slate-50'}`}
                                        title="Accessori e Giunti"
                                    >
                                        Giunti &<br/>Accessori
                                    </button>
                                    <button 
                                        onClick={() => setActiveEditorTab('driver')}
                                        className={`py-2 cursor-pointer ${activeEditorTab === 'driver' ? 'bg-white text-brand-600 font-extrabold border-b-2 border-b-brand-500' : 'hover:bg-slate-50'}`}
                                        title="Motore Elettrico"
                                    >
                                        Motore<br/>Driver
                                    </button>
                                </div>

                                {/* Contenuto Form Editor */}
                                <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
                                    
                                    {/* TAB 1: PARAMETRI GENERALI */}
                                    {activeEditorTab === 'project' && (
                                        <div className="space-y-3">
                                            <h5 className="font-bold text-slate-700 uppercase text-[9px] border-b pb-1.5 mb-2">Parametri Principali & Unità</h5>
                                            
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Unità Pressione Datasheet</label>
                                                <select
                                                    value={pumpPressureUnit}
                                                    onChange={e => setPumpPressureUnit(e.target.value)}
                                                    className="w-full p-2 border border-slate-300 rounded bg-white font-semibold text-slate-800 focus:border-brand-500 focus:outline-none cursor-pointer"
                                                >
                                                    <option value="bar">bar</option>
                                                    <option value="ata">ata (atmosfere assolute)</option>
                                                    <option value="kPa">kPa</option>
                                                    <option value="mbar">mbar</option>
                                                    <option value="m.c.a.">m.c.a. (metri colonna acqua)</option>
                                                </select>
                                            </div>

                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                                    <label>Rendimento Pompa (η)</label>
                                                    <span className="text-brand-600">{pumpEfficiency}%</span>
                                                </div>
                                                <input 
                                                    type="range" min="10" max="95" value={pumpEfficiency}
                                                    onChange={e => setPumpEfficiency(Number(e.target.value))}
                                                    className="w-full h-1 bg-slate-200 rounded appearance-none cursor-pointer accent-brand-500"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                                    <label>Margine Sicurezza Prevalenza</label>
                                                    <span className="text-brand-600">+{pumpSafetyMargin}%</span>
                                                </div>
                                                <input 
                                                    type="range" min="0" max="50" value={pumpSafetyMargin}
                                                    onChange={e => setPumpSafetyMargin(Number(e.target.value))}
                                                    className="w-full h-1 bg-slate-200 rounded appearance-none cursor-pointer accent-brand-500"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Portata di Progetto (m³/h)</label>
                                                <input 
                                                    type="number" placeholder={`Auto: ${formatNumber(pumpSizing.q_pump_nom, 2)}`}
                                                    value={pumpFlowOverride} onChange={e => setPumpFlowOverride(e.target.value)}
                                                    className="w-full p-2 border border-slate-300 rounded bg-white font-semibold text-slate-800 focus:border-brand-500 focus:outline-none"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Configurazione Pompe</label>
                                                <select
                                                    value={pumpConfig} onChange={e => setPumpConfig(e.target.value)}
                                                    className="w-full p-2 border border-slate-300 rounded bg-white font-semibold text-slate-800 focus:border-brand-500 focus:outline-none cursor-pointer"
                                                >
                                                    <option value="1+0">1 Attiva (Senza riserva)</option>
                                                    <option value="1+1">1 Attiva + 1 Riserva (1+1)</option>
                                                    <option value="2+0">2 Attive senza riserva (2+0)</option>
                                                    <option value="2+1">2 Attive + 1 Riserva (2+1)</option>
                                                    <option value="3+0">3 Attive senza riserva (3+0)</option>
                                                    <option value="3+1">3 Attive + 1 Riserva (3+1)</option>
                                                    <option value="custom">Personalizza...</option>
                                                </select>
                                                {pumpConfig === 'custom' && (
                                                    <div className="grid grid-cols-2 gap-2 bg-slate-100 p-2 mt-2 rounded border border-slate-200">
                                                        <div className="space-y-1">
                                                            <label className="block text-[9px] font-bold text-slate-500 uppercase">Attive</label>
                                                            <input 
                                                                type="number" min="1" value={pumpActiveCustom}
                                                                onChange={e => setPumpActiveCustom(Math.max(1, Number(e.target.value) || 1))}
                                                                className="w-full p-1.5 border border-slate-300 bg-white rounded text-slate-800 focus:border-brand-500 focus:outline-none font-mono"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="block text-[9px] font-bold text-slate-500 uppercase">Riserva</label>
                                                            <input 
                                                                type="number" min="0" value={pumpReserveCustom}
                                                                onChange={e => setPumpReserveCustom(Math.max(0, Number(e.target.value) || 0))}
                                                                className="w-full p-1.5 border border-slate-300 bg-white rounded text-slate-800 focus:border-brand-500 focus:outline-none font-mono"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Fluido Circuito (Personalizzato)</label>
                                                <input 
                                                    type="text" placeholder={`${Number(glycolEtPercent) > 0 ? `Etilenico (${glycolEtPercent}%)` : Number(glycolPrPercent) > 0 ? `Propilenico (${glycolPrPercent}%)` : 'Acqua Pura'} a ${formatNumber(pumpSizing.T_pump, 1)}°C`}
                                                    value={pumpFluidText} onChange={e => setPumpFluidText(e.target.value)}
                                                    className="w-full p-2 border border-slate-300 rounded font-semibold text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Tipo Pompa</label>
                                                <input 
                                                    type="text" value={pumpType} onChange={e => setPumpType(e.target.value)}
                                                    className="w-full p-2 border border-slate-300 rounded font-semibold text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Note / Notes</label>
                                                <textarea 
                                                    rows={4}
                                                    value={pumpNotes} onChange={e => setPumpNotes(e.target.value)}
                                                    className="w-full p-2 border border-slate-300 rounded font-medium text-slate-850 focus:border-brand-500 focus:outline-none bg-white text-xs"
                                                    placeholder="Note o specifiche aggiuntive (es. collaudi, verniciatura...)"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 2: CONDIZIONI OPERATIVE */}
                                    {activeEditorTab === 'process' && (
                                        <div className="space-y-3">
                                            <h5 className="font-bold text-slate-700 uppercase text-[9px] border-b pb-1.5 mb-2">Operating Conditions</h5>
                                            
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Fluido Gestito (Liquid Handled)</label>
                                                <input 
                                                    type="text" value={pumpLiquidHandled} onChange={e => setPumpLiquidHandled(e.target.value)}
                                                    className="w-full p-1.5 border border-slate-300 rounded font-medium text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Temperatura di Esercizio (°C)</label>
                                                <input 
                                                    type="text" 
                                                    placeholder={`Auto: ${formatNumber(pumpSizing.T_pump, 1)}`}
                                                    value={pumpOperatingTemp} 
                                                    onChange={e => setPumpOperatingTemp(e.target.value)}
                                                    className="w-full p-1.5 border border-slate-300 rounded font-semibold text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase">Design Press Min (bar)</label>
                                                    <input 
                                                        type="text" value={pumpDesignPressureMin} onChange={e => setPumpDesignPressureMin(e.target.value)}
                                                        className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase">Design Temp Min (°C)</label>
                                                    <input 
                                                        type="text" value={pumpDesignTempMin} onChange={e => setPumpDesignTempMin(e.target.value)}
                                                        className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Elementi Corrosivi</label>
                                                <select
                                                    value={pumpCorrosive} onChange={e => setPumpCorrosive(e.target.value)}
                                                    className="w-full p-1.5 border border-slate-300 rounded bg-white text-slate-800 focus:border-brand-500 focus:outline-none cursor-pointer"
                                                >
                                                    <option value="">— Seleziona —</option>
                                                    <option value="No">No (Inerte)</option>
                                                    <option value="Sì">Sì</option>
                                                </select>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Solidi Sospesi (% wt)</label>
                                                <input 
                                                    type="text" value={pumpSuspendedSolids} onChange={e => setPumpSuspendedSolids(e.target.value)}
                                                    className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase">Dim. Solidi Max (mm)</label>
                                                    <input 
                                                        type="text" value={pumpMaxSolidsSize} onChange={e => setPumpMaxSolidsSize(e.target.value)}
                                                        className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase">Corrosion Allowance (mm)</label>
                                                    <input 
                                                        type="text" value={pumpCorrosionAllowance} onChange={e => setPumpCorrosionAllowance(e.target.value)}
                                                        className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">NPSH Richiesto (NPSHr - m)</label>
                                                <input 
                                                    type="text" value={pumpNpshRequired} onChange={e => setPumpNpshRequired(e.target.value)}
                                                    className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none font-bold text-brand-650 bg-white"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Controllo Portata (Flow Control)</label>
                                                <select
                                                    value={pumpFlowControl} onChange={e => setPumpFlowControl(e.target.value)}
                                                    className="w-full p-1.5 border border-slate-300 rounded bg-white text-slate-800 focus:border-brand-500 focus:outline-none cursor-pointer"
                                                >
                                                    <option value="">— Seleziona —</option>
                                                    <option value="Automatico">Automatico (Inverter VSD)</option>
                                                    <option value="Manuale">Manuale (Valvola a globo)</option>
                                                    <option value="Bypass">Bypass</option>
                                                </select>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Prevalenza a Bocca Chiusa (Shut-off - m)</label>
                                                <input 
                                                    type="text" value={pumpMaxHeadShutOff} onChange={e => setPumpMaxHeadShutOff(e.target.value)}
                                                    className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 3: CARATTERISTICHE APPARECCHIATURA */}
                                    {activeEditorTab === 'equipment' && (
                                        <div className="space-y-3">
                                            <h5 className="font-bold text-slate-700 uppercase text-[9px] border-b pb-1.5 mb-2">Equipment Characteristics</h5>
                                            
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Materiali parti a contatto con il liquido</label>
                                                <input 
                                                    type="text" value={pumpMaterials} onChange={e => setPumpMaterials(e.target.value)}
                                                    className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white font-medium"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Tipo di tenuta (Seal type)</label>
                                                <input 
                                                    type="text" value={pumpSealType} onChange={e => setPumpSealType(e.target.value)}
                                                    className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white font-medium"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase">Nozzle Asp. DN</label>
                                                    <input 
                                                        type="text" value={pumpSuctionNozzleDn} onChange={e => setPumpSuctionNozzleDn(e.target.value)}
                                                        className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase">Nozzle Asp. Rating</label>
                                                    <input 
                                                        type="text" value={pumpSuctionNozzleRating} onChange={e => setPumpSuctionNozzleRating(e.target.value)}
                                                        className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase">Nozzle Mand. DN</label>
                                                    <input 
                                                        type="text" value={pumpDischargeNozzleDn} onChange={e => setPumpDischargeNozzleDn(e.target.value)}
                                                        className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase">Nozzle Mand. Rating</label>
                                                    <input 
                                                        type="text" value={pumpDischargeNozzleRating} onChange={e => setPumpDischargeNozzleRating(e.target.value)}
                                                        className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Tipo Girante (Impeller Type)</label>
                                                <input 
                                                    type="text" value={pumpImpellerType} onChange={e => setPumpImpellerType(e.target.value)}
                                                    className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                />
                                            </div>

                                            <div className="grid grid-cols-3 gap-1">
                                                <div className="space-y-1">
                                                    <label className="block text-[8px] font-bold text-slate-500 uppercase">Girante Min (mm)</label>
                                                    <input 
                                                        type="text" value={pumpImpellerMin} onChange={e => setPumpImpellerMin(e.target.value)}
                                                        className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="block text-[8px] font-bold text-slate-500 uppercase">Girante Nom (mm)</label>
                                                    <input 
                                                        type="text" value={pumpImpellerRated} onChange={e => setPumpImpellerRated(e.target.value)}
                                                        className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="block text-[8px] font-bold text-slate-500 uppercase">Girante Max (mm)</label>
                                                    <input 
                                                        type="text" value={pumpImpellerMax} onChange={e => setPumpImpellerMax(e.target.value)}
                                                        className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 4: ACCESSORI */}
                                    {activeEditorTab === 'accessories' && (
                                        <div className="space-y-3">
                                            <h5 className="font-bold text-slate-700 uppercase text-[9px] border-b pb-1.5 mb-2">Accessories</h5>
                                            
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Basamento (Baseplate)</label>
                                                <input 
                                                    type="text" value={pumpBaseplate} onChange={e => setPumpBaseplate(e.target.value)}
                                                    className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Giunti d'Accoppiamento (Couplings)</label>
                                                <input 
                                                    type="text" value={pumpCouplings} onChange={e => setPumpCouplings(e.target.value)}
                                                    className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Tirafondi Fondazione (Foundation Bolts)</label>
                                                <input 
                                                    type="text" value={pumpFoundationBolts} onChange={e => setPumpFoundationBolts(e.target.value)}
                                                    className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Contropiastra (Foundation Plate)</label>
                                                <input 
                                                    type="text" value={pumpFoundationPlate} onChange={e => setPumpFoundationPlate(e.target.value)}
                                                    className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Riparo Giunto (Coupling Guard)</label>
                                                <input 
                                                    type="text" value={pumpCouplingGuard} onChange={e => setPumpCouplingGuard(e.target.value)}
                                                    className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Controflange (Counter Flanges)</label>
                                                <input 
                                                    type="text" value={pumpCounterFlanges} onChange={e => setPumpCounterFlanges(e.target.value)}
                                                    className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 5: MOTORE ELETTRICO */}
                                    {activeEditorTab === 'driver' && (
                                        <div className="space-y-3">
                                            <h5 className="font-bold text-slate-700 uppercase text-[9px] border-b pb-1.5 mb-2">Driver Characteristics</h5>
                                            
                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Tipo Driver (Motore)</label>
                                                <input 
                                                    type="text" value={pumpDriverType} onChange={e => setPumpDriverType(e.target.value)}
                                                    className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Alimentazione Elettrica (Supply)</label>
                                                <input 
                                                    type="text" value={pumpPowerSupply} onChange={e => setPumpPowerSupply(e.target.value)}
                                                    className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase">Giri Motore (rpm)</label>
                                                    <input 
                                                        type="text" value={pumpRpm} onChange={e => setPumpRpm(e.target.value)}
                                                        className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="block text-[9px] font-bold text-slate-500 uppercase">Grado Protezione (Enclosure)</label>
                                                    <input 
                                                        type="text" value={pumpEnclosureType} onChange={e => setPumpEnclosureType(e.target.value)}
                                                        className="w-full p-1.5 border border-slate-300 rounded text-slate-800 focus:border-brand-500 focus:outline-none bg-white"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Avviamento Automatico</label>
                                                <select
                                                    value={pumpAutoStart} onChange={e => setPumpAutoStart(e.target.value)}
                                                    className="w-full p-1.5 border border-slate-300 rounded bg-white text-slate-800 focus:border-brand-500 focus:outline-none cursor-pointer"
                                                >
                                                    <option value="">— Seleziona —</option>
                                                    <option value="Sì">Sì</option>
                                                    <option value="No">No</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Scheda Tecnica Stampabile - Colonna Destra (100% in Stampa) */}
                            <div className="flex-1 p-6 overflow-y-auto bg-slate-100 print:bg-white print:p-0 print:overflow-visible print-main-content">
                                <div id="datasheet-print-area" className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 max-w-4xl mx-auto text-slate-800 font-sans print:shadow-none print:border-none print:p-0 print:rounded-none print:w-full print:max-w-none">
                                    
                                    {/* Intestazione del Documento */}
                                    <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-5">
                                        <img src={logoImg} alt="Ingegno" className="h-12 object-contain" />
                                        <div className="text-right">
                                            <h2 className="text-xl font-extrabold text-slate-955 uppercase tracking-wider">
                                                {datasheetLang === 'eng' ? "PUMP DATASHEET" : "SCHEDA TECNICA POMPA"}
                                            </h2>
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                                                {datasheetLang === 'eng' ? "ELECTRIC PUMP SPECIFICATION" : "SPECIFICA ELETTROPOMPA"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Calcolo e Estrazione Variabili */}
                                    {(() => {
                                        const q_oper = pumpSizing.q_pump_nom;
                                        const q_rated = pumpFlowOverride === '' ? q_oper : (Number(pumpFlowOverride) || q_oper);
                                        const T_pump = pumpSizing.T_pump;
                                        
                                        // Worst paths DN e velocità
                                        const suctionTratti = processedTratti.filter(t => t.tipoCondotto === 'aspirazione');
                                        const suctionDn = suctionTratti.length > 0 ? `DN ${suctionTratti[suctionTratti.length - 1].DN}` : '—';
                                        const suctionVel = suctionTratti.length > 0 ? `${formatNumber(suctionTratti[suctionTratti.length - 1].velocity || 0, 2)} m/s` : '—';

                                        const dischargeTratti = processedTratti.filter(t => t.tipoCondotto === 'mandata');
                                        const dischargeDn = dischargeTratti.length > 0 ? `DN ${dischargeTratti[0].DN}` : '—';
                                        const dischargeVel = dischargeTratti.length > 0 ? `${formatNumber(dischargeTratti[0].velocity || 0, 2)} m/s` : '—';

                                        // Ricalcolo proprietà alla temperatura del datasheet per consistenza fisica
                                        const T_datasheet = pumpOperatingTemp !== '' ? (Number(pumpOperatingTemp) || T_pump) : T_pump;
                                        const xEt_glob = (Number(glycolEtPercent) || 0) / 100;
                                        const xPr_glob = (Number(glycolPrPercent) || 0) / 100;
                                        const datasheetFluidProps = computeFluidPropsAtT(T_datasheet, xEt_glob, xPr_glob);
                                        const rho_datasheet = datasheetFluidProps.rho;
                                        const visc_datasheet = datasheetFluidProps.visc;

                                        const getVaporPressureForDatasheet = (temp: number) => {
                                            const A = 5.20389;
                                            const B = 1733.926;
                                            const C = 233.426;
                                            return Math.pow(10, A - B / (temp + C));
                                        };
                                        const p_vap_datasheet_bar = getVaporPressureForDatasheet(T_datasheet);

                                        // NPSHa in metri ricalcolato per il datasheet
                                        const npsha = Math.max(0, (pumpSizing.p_inlet_gauge + 1.01325 - p_vap_datasheet_bar) * 100000 / (rho_datasheet * 9.80665));
                                        
                                        // Pressioni calcolate in bar (da convertire nell'unità scelta)
                                        const p_suc_bar = pumpSizing.p_inlet_gauge + 1.01325; // ass
                                        const p_dis_bar = p_suc_bar + pumpSizing.prevalenza_richiesta_bar; // ass
                                        const p_vap_bar = p_vap_datasheet_bar; // ass
                                        const diff_p_bar = pumpSizing.prevalenza_richiesta_bar;

                                        const isEng = datasheetLang === 'eng';
                                        const tD = {
                                            title: isEng ? "PUMP DATASHEET" : "SCHEDA TECNICA POMPA",
                                            client: isEng ? "Client:" : "Committente:",
                                            author: isEng ? "Designer:" : "Progettista:",
                                            fluidCircuit: isEng ? "Heat Transfer Fluid:" : "Circuito Termovettore:",
                                            pumpType: isEng ? "Pump Type:" : "Tipo Pompa:",
                                            
                                            sec1Title: isEng ? "OPERATING CONDITIONS" : "CONDIZIONI OPERATIVE",
                                            sec1Sub: isEng ? "Values in" : "Valori in",
                                            
                                            liquidHandled: isEng ? "Liquid handled:" : "Liquido processato:",
                                            suctionTemp: isEng ? "Suction temperature:" : "Temperatura aspirazione:",
                                            density: isEng ? "Density (Suction temp.):" : "Densità (Temp. aspiraz.):",
                                            viscosity: isEng ? "Viscosity (Suction temp.):" : "Viscosità (Temp. aspiraz.):",
                                            ratedFlow: isEng ? "Rated flow:" : "Portata di progetto:",
                                            suctionPress: isEng ? "Suction pressure:" : "Pressione aspirazione:",
                                            dischargePress: isEng ? "Discharge pressure:" : "Pressione mandata:",
                                            vaporPress: isEng ? "Vapor pressure (Operating cond.):" : "Tensione vap. (cond. Oper.):",
                                            headMca: isEng ? "Head:" : "Prevalenza:",
                                            npsha: isEng ? "N.P.S.H. available:" : "N.P.S.H. disponibile:",
                                            npshr: isEng ? "N.P.S.H. required:" : "N.P.S.H. richiesto:",
                                            flowControl: isEng ? "Flow control:" : "Regolazione portata:",
                                            designPressTemp: isEng ? "Design Pressure / Temp:" : "Pressione / Temp. di progetto:",
                                            corrosive: isEng ? "Corrosive characteristics:" : "Caratter. corrosive:",
                                            suspendedSolids: isEng ? "Suspended solids:" : "Solidi in sospensione:",
                                            
                                            sec2Title: isEng ? "PUMP CHARACTERISTICS" : "CARATTERISTICHE TECNICHE POMPA",
                                            maxPress: isEng ? "Maximum allowable pressure:" : "Pressione massima ammissibile:",
                                            tempRange: isEng ? "Liquid temperature range:" : "Campo di temperature liquido:",
                                            materials: isEng ? "Materials in contact with liquid:" : "Materiali parti a contatto con il liquido:",
                                            sealType: isEng ? "Seal type:" : "Tipo di tenuta:",
                                            suctionLine: isEng ? "Suction line size:" : "Sez. aspiraz. impianto:",
                                            suctionNozzle: isEng ? "Suction nozzle size:" : "Sez. aspiraz. pompa:",
                                            suctionVel: isEng ? "Suction velocity:" : "Velocità aspirazione:",
                                            dischargeLine: isEng ? "Discharge line size:" : "Sez. mandata impianto:",
                                            dischargeNozzle: isEng ? "Discharge nozzle size:" : "Sez. mandata pompa:",
                                            dischargeVel: isEng ? "Discharge velocity:" : "Velocità mandata:",
                                            impellerType: isEng ? "Impeller type:" : "Tipo girante:",
                                            impellerDiam: isEng ? "Impeller diameter:" : "Diametro girante:",
                                            
                                            sec3Title: isEng ? "ACCESSORIES" : "ACCESSORI",
                                            baseplate: isEng ? "Baseplate:" : "Basamento:",
                                            coupling: isEng ? "Coupling:" : "Giunto:",
                                            bolts: isEng ? "Foundation bolts:" : "Bulloni per basamento:",
                                            guard: isEng ? "Coupling guard:" : "Protezione giunto:",
                                            flanges: isEng ? "Counter flanges:" : "Controflange:",
                                            plate: isEng ? "Foundation plate:" : "Contropiastra:",
                                            
                                            sec4Title: isEng ? "MOTOR CHARACTERISTICS" : "CARATTERISTICHE TECNICHE MOTORE",
                                            driverType: isEng ? "Driver Type:" : "Tipo Driver:",
                                            powerSupply: isEng ? "Power supply:" : "Alimentazione:",
                                            rpm: isEng ? "Rotational speed:" : "Velocità rotazione:",
                                            enclosure: isEng ? "Enclosure protection:" : "Grado protezione:",
                                            autoStart: isEng ? "Auto start:" : "Avv. automatico:",
                                            shaftPower: isEng ? "Absorbed power:" : "Potenza assorbita:",
                                            instPower: isEng ? "Installed power:" : "Potenza installata:",
                                            couplingType: isEng ? "Coupling type:" : "Accoppiamento:",
                                            serviceConfig: isEng ? "Service configuration:" : "Configurazione di Servizio:"
                                        };

                                        const translateSelectValue = (val: string) => {
                                            if (val === 'Yes' || val === 'Sì') return isEng ? 'Yes' : 'Sì';
                                            if (val === 'No') return isEng ? 'No' : 'No';
                                            if (!isEng) return val;
                                            if (val === 'Automatico' || val === 'Automatico (Inverter VSD)') return 'Automatic (VSD Inverter)';
                                            if (val === 'Manuale' || val === 'Manuale (Valvola a globo)') return 'Manual (Globe valve)';
                                            if (val === 'Bypass') return 'Bypass';
                                            if (val === 'Basamento') return 'Baseplate';
                                            if (val === 'Giunto elastico') return 'Elastic coupling';
                                            if (val === 'Inclusi') return 'Included';
                                            if (val === 'Fornite sciolte') return 'Supplied loose';
                                            if (val === 'Motore Elettrico TEFC') return 'Electric Motor TEFC';
                                            return val;
                                        };

                                        return (
                                            <div className="space-y-3">
                                                
                                                {/* Informazioni Progetto */}
                                                <div className="grid grid-cols-4 gap-3 bg-slate-50 border border-slate-350 p-4 rounded-xl text-xs print:bg-white print:border-slate-400 mb-4">
                                                    <div>
                                                        <strong className="text-slate-500 uppercase block text-[9px] tracking-wide mb-0.5">{tD.client}</strong>
                                                        <span className="font-bold text-slate-900">{projectData.client || '—'}</span>
                                                    </div>
                                                    <div>
                                                        <strong className="text-slate-500 uppercase block text-[9px] tracking-wide mb-0.5">{tD.author}</strong>
                                                        <span className="font-bold text-slate-900">{projectData.author || '—'}</span>
                                                    </div>
                                                    <div>
                                                        <strong className="text-slate-500 uppercase block text-[9px] tracking-wide mb-0.5">{tD.fluidCircuit}</strong>
                                                        <span className="font-bold text-slate-900">
                                                            {pumpFluidText || `${Number(glycolEtPercent) > 0 ? (isEng ? `Ethylene` : `Etilenico`) + ` (${glycolEtPercent}%)` : Number(glycolPrPercent) > 0 ? (isEng ? `Propylene` : `Propilenico`) + ` (${glycolPrPercent}%)` : (isEng ? 'Pure Water' : 'Acqua Pura')} ${isEng ? 'at' : 'a'} ${formatNumber(T_pump, 1)}°C`}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <strong className="text-slate-500 uppercase block text-[9px] tracking-wide mb-0.5">{tD.pumpType}</strong>
                                                        <span className="font-bold text-slate-900">{pumpType || '—'}</span>
                                                    </div>
                                                </div>

                                                {/* SEZIONE 1: OPERATING CONDITIONS & PUMP CHARACTERISTICS */}
                                                <div className="grid grid-cols-2 gap-4 items-start print-no-break">
                                                    
                                                    {/* COLONNA SINISTRA: CONDIZIONI OPERATIVE */}
                                                    <div>
                                                        <h4 className="text-[10px] font-black bg-slate-800 text-white px-2 py-1 uppercase tracking-wider mb-1 flex justify-between">
                                                            <span>{tD.sec1Title}</span>
                                                            <span className="font-mono text-[8px] normal-case text-slate-300">{tD.sec1Sub} [{getPumpPressureUnitLabel(pumpPressureUnit)}]</span>
                                                        </h4>
                                                        <table className="w-full text-[9px] border border-slate-200 border-collapse print:border-slate-300">
                                                            <tbody>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.liquidHandled}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{pumpLiquidHandled || '—'}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.suctionTemp}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{pumpOperatingTemp !== '' ? pumpOperatingTemp : formatNumber(T_pump, 1)} °C</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.density}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{formatNumber(rho_datasheet, 1)} kg/m³</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.viscosity}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{formatNumber(visc_datasheet * 1000, 3)} cP</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.ratedFlow}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-brand-700">{formatNumber(q_rated, 2)} m³/h</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.headMca}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-brand-700">{formatNumber(diff_p_bar * 10.197, 1)} {isEng ? 'm' : 'm'}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.suctionPress}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{convertFromBar(p_suc_bar, pumpPressureUnit)} {getPumpPressureUnitLabel(pumpPressureUnit)} a</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.dischargePress}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{convertFromBar(p_dis_bar, pumpPressureUnit)} {getPumpPressureUnitLabel(pumpPressureUnit)} a</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.vaporPress}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{convertFromBar(p_vap_bar, pumpPressureUnit)} {getPumpPressureUnitLabel(pumpPressureUnit)} a</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.npsha}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-violet-800">{formatNumber(npsha, 1)} m</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.npshr}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-brand-800">{pumpNpshRequired !== '' ? formatNumber(Number(pumpNpshRequired), 1) + ' m' : '—'}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.designPressTemp}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">
                                                                        {(!pumpDesignPressureMin && !pumpDesignTempMin)
                                                                            ? '—'
                                                                            : `${pumpDesignPressureMin || '—'} barg / ${pumpDesignTempMin || '—'} °C`
                                                                        }
                                                                    </td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.corrosive}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{translateSelectValue(pumpCorrosive) || '—'}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.suspendedSolids}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">
                                                                        {(!pumpSuspendedSolids && !pumpMaxSolidsSize && !pumpCorrosionAllowance)
                                                                            ? '—'
                                                                            : `${pumpSuspendedSolids || '—'} % wt | ${pumpMaxSolidsSize || '—'} mm | ${pumpCorrosionAllowance || '—'} mm`
                                                                        }
                                                                    </td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.flowControl}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{translateSelectValue(pumpFlowControl) || '—'}</td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    
                                                    {/* COLONNA DESTRA: CARATTERISTICHE COSTUTTIVE POMPA */}
                                                    <div>
                                                        <h4 className="text-[10px] font-black bg-slate-800 text-white px-2 py-1 uppercase tracking-wider mb-1">
                                                            {tD.sec2Title}
                                                        </h4>
                                                        <table className="w-full text-[9px] border border-slate-200 border-collapse print:border-slate-300">
                                                            <tbody>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.maxPress}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{pumpDesignPressureMin ? `${pumpDesignPressureMin} barg` : '—'}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.tempRange}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{pumpDesignTempMin ? `${pumpDesignTempMin} °C` : '—'}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.materials}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{translateSelectValue(pumpMaterials) || '—'}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.sealType}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{translateSelectValue(pumpSealType) || '—'}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.suctionLine}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{suctionDn}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.suctionNozzle}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{pumpSuctionNozzleDn ? `DN ${pumpSuctionNozzleDn}` : '—'} {pumpSuctionNozzleRating ? `(${pumpSuctionNozzleRating})` : ''}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.suctionVel}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{suctionVel}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.dischargeLine}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{dischargeDn}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.dischargeNozzle}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{pumpDischargeNozzleDn ? `DN ${pumpDischargeNozzleDn}` : '—'} {pumpDischargeNozzleRating ? `(${pumpDischargeNozzleRating})` : ''}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.dischargeVel}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{dischargeVel}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.impellerType}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{translateSelectValue(pumpImpellerType) || '—'}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="px-3 py-1 font-semibold text-slate-600">{tD.impellerDiam}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">
                                                                        {(!pumpImpellerMin && !pumpImpellerRated && !pumpImpellerMax)
                                                                            ? '—'
                                                                            : `${pumpImpellerMin || '—'} mm / ${pumpImpellerRated || '—'} mm / ${pumpImpellerMax || '—'} mm`
                                                                        }
                                                                    </td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>

                                                {/* SEZIONE 2: ACCESSORIES & MOTOR CHARACTERISTICS */}
                                                <div className="grid grid-cols-2 gap-4 items-start print-no-break">
                                                    
                                                    {/* COLONNA SINISTRA: ACCESSORI */}
                                                    <div>
                                                        <h4 className="text-[10px] font-black bg-slate-800 text-white px-2 py-1 uppercase tracking-wider mb-1">
                                                            {tD.sec3Title}
                                                        </h4>
                                                        <table className="w-full text-[9px] border border-slate-200 border-collapse print:border-slate-300">
                                                            <tbody>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-650 w-1/2">{tD.baseplate}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{translateSelectValue(pumpBaseplate) || '—'}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-650">{tD.coupling}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{translateSelectValue(pumpCouplings) || '—'}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-650">{tD.bolts}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{translateSelectValue(pumpFoundationBolts) || '—'}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-650">{tD.guard}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{translateSelectValue(pumpCouplingGuard) || '—'}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-650">{tD.flanges}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{translateSelectValue(pumpCounterFlanges) || '—'}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="px-3 py-1 font-semibold text-slate-650">{tD.plate}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{translateSelectValue(pumpFoundationPlate) || '—'}</td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    {/* COLONNA DESTRA: MOTOR CHARACTERISTICS */}
                                                    <div>
                                                        <h4 className="text-[10px] font-black bg-slate-800 text-white px-2 py-1 uppercase tracking-wider mb-1">
                                                            {tD.sec4Title}
                                                        </h4>
                                                        <table className="w-full text-[9px] border border-slate-200 border-collapse print:border-slate-300">
                                                            <tbody>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-650 w-1/2">{tD.driverType}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{translateSelectValue(pumpDriverType) || '—'}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-650">{tD.powerSupply}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{translateSelectValue(pumpPowerSupply) || '—'}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-650">{tD.rpm}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{pumpRpm ? `${pumpRpm} rpm` : '—'}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-650">{tD.enclosure}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{pumpEnclosureType || '—'}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-650">{tD.autoStart}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{translateSelectValue(pumpAutoStart) || '—'}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-650">{tD.shaftPower}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800">{formatNumber(pumpSizing.p_shaft, 3)} kW {isEng ? `(at η = ${pumpEfficiency}%)` : `(a η = ${pumpEfficiency}%)`}</td>
                                                                </tr>
                                                                <tr className="border-b border-slate-100 print:border-slate-300">
                                                                    <td className="px-3 py-1 font-semibold text-slate-650">{tD.instPower}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-brand-900">{formatNumber(pumpSizing.p_motor_std, 2)} kW</td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="px-3 py-1 font-semibold text-slate-650">{tD.serviceConfig}</td>
                                                                    <td className="px-3 py-1 text-right font-bold text-slate-800 uppercase">
                                                                        {pumpConfig === 'custom' ? (isEng ? `${pumpActiveCustom} Active + ${pumpReserveCustom} Reserve` : `${pumpActiveCustom} + ${pumpReserveCustom}`) : 
                                                                        pumpConfig === '1+0' ? (isEng ? '1 Active' : '1 Pompa') : 
                                                                        pumpConfig === '1+1' ? (isEng ? '1 Active + 1 Reserve' : '1 + 1') : 
                                                                        pumpConfig === '2+0' ? (isEng ? '2 Active' : '2 Pompe') : 
                                                                        pumpConfig === '2+1' ? (isEng ? '2 Active + 1 Reserve' : '2 + 1') : 
                                                                        pumpConfig === '3+0' ? (isEng ? '3 Active' : '3 Pompe') : 
                                                                        pumpConfig === '3+1' ? (isEng ? '3 Active + 1 Reserve' : '3 + 1') : 
                                                                        pumpConfig}
                                                                    </td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>

                                                {/* SEZIONE 5: NOTE */}
                                                <div className="border border-slate-200 print:border-slate-350 rounded-lg p-2.5 mt-2.5 print-no-break bg-slate-50/30 print:bg-white text-left">
                                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                                        {isEng ? "Notes:" : "Note:"}
                                                    </h4>
                                                    <div className="text-[11px] leading-relaxed text-slate-800 font-medium whitespace-pre-wrap min-h-[40px]">
                                                        {pumpNotes || (isEng ? "No additional notes." : "Nessuna nota aggiuntiva.")}
                                                    </div>
                                                </div>

                                            </div>
                                        );
                                    })()}

                                </div>
                            </div>

                        </div>

                        {/* Footer del Modal (Pulsante di Stampa) */}
                        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 print:hidden">
                            <div className="flex items-center space-x-2">
                                <label className="text-xs font-bold text-slate-600 uppercase">Lingua Documento:</label>
                                <select
                                    value={datasheetLang}
                                    onChange={e => setDatasheetLang(e.target.value as 'ita' | 'eng')}
                                    className="p-1.5 border border-slate-300 rounded bg-white text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                                >
                                    <option value="ita">Italiano (ITA)</option>
                                    <option value="eng">English (ENG)</option>
                                </select>
                            </div>
                            <div className="flex gap-3">
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
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                    </svg>
                                    Stampa Datasheet
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
