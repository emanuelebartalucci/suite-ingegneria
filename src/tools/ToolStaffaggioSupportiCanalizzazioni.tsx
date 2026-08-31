import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import { formatNumber } from '../utils/format';
import { 
  LEGRAND_SUPPORT_CATALOG, 
  findCatalogCurve, 
  CanalizationSupportCatalogEntry, 
  LoadCurvePoint 
} from '../data/supportCatalog';
import { 
  Layers, 
  Plus, 
  Trash2, 
  CheckCircle,
  XCircle,
  Scale,
  Ruler,
  Copy,
  Info
} from 'lucide-react';

interface ToolStaffaggioSupportiCanalizzazioniProps {
  projectData: ProjectData;
  setProjectData: (data: any) => void;
  setAppMode: (mode: string) => void;
  importedStaffaggioData?: {
    trattaName?: string;
    q_tot?: number; // kg/m
    height?: number; // mm
    width?: number; // mm
    serie?: 'P31+' | 'ZF31 / Cablofil';
    tipologia?: 'Canale Chiuso M/F' | 'Passerella Forata M/F' | 'Passerella a filo ZF31/Cablofil';
  } | null;
  clearImportedStaffaggioData?: () => void;
}

export interface TrattaStaffaggio {
  id: string;
  tag: string;                  // Progressivo Tratta (es. S1)
  name: string;                 // Nome Tratta
  serie: 'P31+' | 'ZF31 / Cablofil';
  tipologia: 'Canale Chiuso M/F' | 'Passerella Forata M/F' | 'Passerella a filo ZF31/Cablofil';
  altezza_mm: number;           // 25, 50, 75, 100
  larghezza_mm: number;         // 50, 75, 100, 150, 200, 300, 400, 500, 600
  q_tot_kg_m: number | '';      // Carico totale lineare (peso canale + cavi) in kg/m
  gamma: number;                // Fattore NTC 2018 (1.0, 1.3, 1.5)
  hasPiastraAllineamento: boolean; // Option Piastra allineamento per W >= 400 mm (+30%)
  d_utente_m?: number | '';     // Passo fisso manuale inserito dall'utente in m (vuoto per default)
}

interface ToolState {
  tratte: TrattaStaffaggio[];
  activeTrattaTag: string;
}

const defaultState: ToolState = {
  tratte: [
    {
      id: 'tratta_staff_1',
      tag: 'S1',
      name: 'Tratta Staffaggio 1',
      serie: 'P31+',
      tipologia: 'Canale Chiuso M/F',
      altezza_mm: 75,
      larghezza_mm: 200,
      q_tot_kg_m: 25.0,
      gamma: 1.0,
      hasPiastraAllineamento: false,
      d_utente_m: ''
    }
  ],
  activeTrattaTag: 'S1'
};

/**
 * Calcola il punto sulla curva e l'esito dello staffaggio
 */
export function calcolaStaffaggioTratta(t: TrattaStaffaggio) {
  const curveEntry = findCatalogCurve(t.serie, t.tipologia, t.altezza_mm, t.larghezza_mm);
  if (!curveEntry) return null;

  // Carico lineare di progetto (gestisce input vuoti o 0)
  const q_tot_kg_m_num = typeof t.q_tot_kg_m === 'number' && !isNaN(t.q_tot_kg_m) ? t.q_tot_kg_m : 0;
  const q_N = q_tot_kg_m_num * 9.81; // N/m
  const q_progetto = q_N * (t.gamma || 1.0); // N/m

  // Gestione Piastra di Allineamento (+30% se W >= 400 mm e attiva)
  const isPiastraApplicata = t.hasPiastraAllineamento && t.larghezza_mm >= 400;
  const multPiastra = isPiastraApplicata ? 1.3 : 1.0;

  // Genera punti della curva modificata con eventuale incremento piastra
  const curvaModificata: LoadCurvePoint[] = curveEntry.curva_carico.map(p => ({
    distanza_mm: p.distanza_mm,
    carico_Nm: p.carico_Nm * multPiastra
  }));

  // 1. Ricerca del Passo Massimo Consigliato (X_max)
  let x_max_mm = 0;
  let outOfRangeHigh = false; // Se q_progetto supera il carico max a 1000mm
  let outOfRangeLow = false;  // Se q_progetto è inferiore al carico a 3000mm

  const minY = curvaModificata[curvaModificata.length - 1].carico_Nm;
  const maxY = curvaModificata[0].carico_Nm;

  if (q_progetto > maxY) {
    outOfRangeHigh = true;
    x_max_mm = 1000;
  } else if (q_progetto <= minY) {
    outOfRangeLow = true;
    x_max_mm = 3000;
  } else {
    // Interpolazione lineare sulla curva
    for (let i = 0; i < curvaModificata.length - 1; i++) {
      const p1 = curvaModificata[i];     // X1, Y1 (distanza minore, carico maggiore)
      const p2 = curvaModificata[i + 1]; // X2, Y2 (distanza maggiore, carico minore)

      if (p1.carico_Nm >= q_progetto && q_progetto >= p2.carico_Nm) {
        if (p1.carico_Nm === p2.carico_Nm) {
          x_max_mm = p1.distanza_mm;
        } else {
          x_max_mm = p1.distanza_mm + ((q_progetto - p1.carico_Nm) * (p2.distanza_mm - p1.distanza_mm)) / (p2.carico_Nm - p1.carico_Nm);
        }
        break;
      }
    }
  }

  const x_max_m_exact = x_max_mm / 1000;
  // Arrotondamento per difetto al primo decimale per sicurezza (es. 2.29m -> 2.2m)
  const x_max_m = Math.floor(x_max_m_exact * 10) / 10;

  // 2. Reazione sul Singolo Supporto (Carico Puntuale)
  const f_supporto_N = q_N * x_max_m;
  const f_supporto_kg = f_supporto_N / 9.81;

  // 3. Verifica a Passo Fisso Manuale (se D_utente è inserito)
  let y_amm_d_utente: number | null = null;
  let esitoPassoFisso: 'VERIFICATO' | 'NON VERIFICATO' | null = null;
  let dettaglioPassoFisso = '';

  const d_utente = typeof t.d_utente_m === 'number' && !isNaN(t.d_utente_m) && t.d_utente_m > 0 ? t.d_utente_m : null;

  if (d_utente !== null) {
    const minDist_m = curvaModificata[0].distanza_mm / 1000; // 1.0 m
    const maxDist_m = curvaModificata[curvaModificata.length - 1].distanza_mm / 1000; // 3.0 m

    if (d_utente > maxDist_m) {
      // Supera il limite massimo assoluto di norma CEI EN 61537 / Legrand (3.0 m)
      esitoPassoFisso = 'NON VERIFICATO';
      y_amm_d_utente = null;
      dettaglioPassoFisso = `NON VERIFICATO: Il passo richiesto di ${formatNumber(d_utente, 2)} m supera la campata massima ammissibile a norma CEI EN 61537 / Legrand (max ${formatNumber(maxDist_m, 1)} m).`;
    } else if (d_utente > x_max_m_exact) {
      // Supera il passo massimo calcolato per il carico di progetto
      esitoPassoFisso = 'NON VERIFICATO';
      const d_mm = d_utente * 1000;
      for (let i = 0; i < curvaModificata.length - 1; i++) {
        const p1 = curvaModificata[i];
        const p2 = curvaModificata[i + 1];
        if (d_mm >= p1.distanza_mm && d_mm <= p2.distanza_mm) {
          y_amm_d_utente = p1.carico_Nm + ((d_mm - p1.distanza_mm) * (p2.carico_Nm - p1.carico_Nm)) / (p2.distanza_mm - p1.distanza_mm);
          break;
        }
      }
      const capStr = y_amm_d_utente !== null ? ` (Portata a ${formatNumber(d_utente, 2)} m: ${formatNumber(y_amm_d_utente, 1)} N/m)` : '';
      dettaglioPassoFisso = `NON VERIFICATO: Il passo richiesto di ${formatNumber(d_utente, 2)} m supera il passo massimo ammissibile per questo carico (${formatNumber(x_max_m, 1)} m).${capStr}`;
    } else {
      // d_utente <= x_max_m_exact e <= 3.0 m
      const d_mm = d_utente * 1000;
      if (d_mm <= curvaModificata[0].distanza_mm) {
        y_amm_d_utente = curvaModificata[0].carico_Nm;
      } else {
        for (let i = 0; i < curvaModificata.length - 1; i++) {
          const p1 = curvaModificata[i];
          const p2 = curvaModificata[i + 1];
          if (d_mm >= p1.distanza_mm && d_mm <= p2.distanza_mm) {
            y_amm_d_utente = p1.carico_Nm + ((d_mm - p1.distanza_mm) * (p2.carico_Nm - p1.carico_Nm)) / (p2.distanza_mm - p1.distanza_mm);
            break;
          }
        }
      }

      if (y_amm_d_utente !== null && q_progetto <= y_amm_d_utente) {
        esitoPassoFisso = 'VERIFICATO';
        dettaglioPassoFisso = `VERIFICATO: Carico di progetto (${formatNumber(q_progetto, 1)} N/m) inferiore o uguale al limite ammissibile per il passo di ${formatNumber(d_utente, 2)} m (${formatNumber(y_amm_d_utente, 1)} N/m).`;
      } else {
        esitoPassoFisso = 'NON VERIFICATO';
        dettaglioPassoFisso = `NON VERIFICATO: Carico di progetto (${formatNumber(q_progetto, 1)} N/m) superiore al limite ammissibile per il passo di ${formatNumber(d_utente, 2)} m (${y_amm_d_utente ? formatNumber(y_amm_d_utente, 1) + ' N/m' : 'N/D'}).`;
      }
    }
  }

  // Note esplicative sullo staffaggio automatico
  let notaSpiegazione = '';
  if (outOfRangeHigh) {
    notaSpiegazione = `ATTENZIONE: Carico di progetto elevato (${formatNumber(q_progetto, 1)} N/m). Il valore supera la portata per il passo minimo di 1.0 m (${formatNumber(maxY, 1)} N/m). Ridurre il carico o la campata.`;
  } else if (outOfRangeLow) {
    notaSpiegazione = `VERIFICATO: Carico di progetto contenuto (${formatNumber(q_progetto, 1)} N/m). È possibile adottare il passo massimo raccomandato di 3.0 m.`;
  } else {
    notaSpiegazione = `VERIFICATO: Spaziatura massima consigliata tra i supporti pari a ${formatNumber(x_max_m, 1)} m per un carico di progetto di ${formatNumber(q_progetto, 1)} N/m.`;
  }

  return {
    curveEntry,
    curvaModificata,
    q_N,
    q_progetto,
    isPiastraApplicata,
    x_max_mm,
    x_max_m_exact,
    x_max_m,
    f_supporto_N,
    f_supporto_kg,
    d_utente,
    y_amm_d_utente,
    esitoPassoFisso,
    dettaglioPassoFisso,
    notaSpiegazione,
    outOfRangeHigh,
    outOfRangeLow
  };
}

/**
 * Componente Grafico SVG Interattivo e Leggero per il Diagramma dei Carichi
 */
export function StaffaggioDiagrammaSVG({
  curvaModificata,
  q_progetto,
  x_max_m,
  d_utente,
  y_amm_d_utente
}: {
  curvaModificata: LoadCurvePoint[];
  q_progetto: number;
  x_max_m: number;
  d_utente: number | null;
  y_amm_d_utente: number | null;
}) {
  const width = 680;
  const height = 310;
  const margin = { top: 40, right: 35, bottom: 50, left: 65 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const xMin = 0.8;
  const xMax = 3.2;

  const maxYInCurve = Math.max(...curvaModificata.map(p => p.carico_Nm));
  const yMax = Math.max(maxYInCurve * 1.1, q_progetto * 1.25, 400);

  const getXPixel = (dist_m: number) => margin.left + ((dist_m - xMin) / (xMax - xMin)) * plotW;
  const getYPixel = (load_Nm: number) => margin.top + plotH - (load_Nm / yMax) * plotH;

  const pointsString = curvaModificata
    .map(p => `${getXPixel(p.distanza_mm / 1000)},${getYPixel(p.carico_Nm)}`)
    .join(' L ');

  const areaString = `${getXPixel(1.0)},${getYPixel(0)} L ${pointsString} L ${getXPixel(3.0)},${getYPixel(0)} Z`;

  const qProjY = getYPixel(q_progetto);
  const xMaxX = getXPixel(x_max_m);

  const hasDUtente = d_utente !== null && d_utente >= 0.8 && d_utente <= 3.2 && y_amm_d_utente !== null;
  const dX = hasDUtente ? getXPixel(d_utente!) : 0;
  const dY = hasDUtente ? getYPixel(y_amm_d_utente!) : 0;

  // Position for Red q_progetto Badge (on top of red dashed line at left)
  const qBadgeY = qProjY - margin.top < 24 ? qProjY + 4 : qProjY - 24;

  // Staggering for X-axis projection tags (inside plot area just above axis line)
  const axisY = height - margin.bottom;
  const isCloseX = hasDUtente && Math.abs(dX - xMaxX) < 140;

  // Passo Max tag stays at axisY - 22
  const pMaxTagY = axisY - 22;
  const pMaxTagX = Math.max(margin.left + 5, Math.min(width - margin.right - 95, xMaxX - 47));

  // D_utente tag goes to axisY - 46 if close to Passo Max tag to prevent ANY overlap, else axisY - 22
  const dTagY = isCloseX ? axisY - 46 : axisY - 22;
  const dTagX = Math.max(margin.left + 5, Math.min(width - margin.right - 145, dX - 72));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full font-sans select-none drop-shadow-sm">
      <defs>
        <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid Lines */}
      {[0, 0.25, 0.5, 0.75, 1.0].map((ratio, idx) => {
        const valY = yMax * ratio;
        const yPx = getYPixel(valY);
        return (
          <g key={idx}>
            <line x1={margin.left} y1={yPx} x2={width - margin.right} y2={yPx} stroke="#e2e8f0" strokeDasharray="3,3" />
            <text x={margin.left - 8} y={yPx + 4} textAnchor="end" className="text-[10px] fill-slate-400 font-medium">
              {formatNumber(valY, 0)}
            </text>
          </g>
        );
      })}

      {[1.0, 1.5, 2.0, 2.5, 3.0].map((dist, idx) => {
        const xPx = getXPixel(dist);
        return (
          <g key={idx}>
            <line x1={xPx} y1={margin.top} x2={xPx} y2={axisY} stroke="#e2e8f0" strokeDasharray="3,3" />
            <text x={xPx} y={axisY + 18} textAnchor="middle" className="text-[11px] fill-slate-500 font-bold">
              {dist.toFixed(1)} m
            </text>
          </g>
        );
      })}

      {/* Area under curve */}
      <path d={`M ${areaString}`} fill="url(#curveGradient)" />

      {/* Catalog Load Curve */}
      <path d={`M ${pointsString}`} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {/* Point markers on catalog curve */}
      {curvaModificata.map((p, idx) => {
        const cx = getXPixel(p.distanza_mm / 1000);
        const cy = getYPixel(p.carico_Nm);
        return (
          <circle key={idx} cx={cx} cy={cy} r="4" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
        );
      })}

      {/* Linea Carico Progetto (Rosso Trattato) */}
      <line x1={margin.left} y1={qProjY} x2={width - margin.right} y2={qProjY} stroke="#e11d48" strokeWidth="2" strokeDasharray="5,5" />
      
      {/* Badge Etichetta Carico Progetto (sfondo bianco solido per evitare trasparenza su linee) */}
      <g transform={`translate(${margin.left + 10}, ${qBadgeY})`}>
        <rect x="0" y="0" width="165" height="22" rx="6" fill="#ffffff" stroke="#f43f5e" strokeWidth="1.5" />
        <text x="82.5" y="15" textAnchor="middle" className="text-[10px] fill-rose-600 font-black">
          q_progetto = {formatNumber(q_progetto, 1)} N/m
        </text>
      </g>

      {/* Punto Operativo e Proiezione Passo Max Consigliato */}
      {x_max_m >= 1.0 && x_max_m <= 3.0 && (
        <g>
          {/* Proiezione verticale tratteggiata blu verso il box Passo Max */}
          <line x1={xMaxX} y1={qProjY} x2={xMaxX} y2={pMaxTagY} stroke="#2563eb" strokeWidth="1.5" strokeDasharray="2,2" />
          <circle cx={xMaxX} cy={qProjY} r="6" fill="#2563eb" stroke="#ffffff" strokeWidth="2.5" />
          
          {/* Badge Etichetta Proiezione sopra l'asse X (dentro il grafico) */}
          <g transform={`translate(${pMaxTagX}, ${pMaxTagY})`}>
            <rect x="0" y="0" width="95" height="20" rx="5" fill="#0f172a" stroke="#ffffff" strokeWidth="1.5" />
            <text x="47.5" y="13" textAnchor="middle" className="text-[9.5px] fill-white font-black tracking-wide">
              Passo Max: {x_max_m} m
            </text>
          </g>
        </g>
      )}

      {/* Punto Operativo e Proiezione Passo Fisso Personalizzato (D_utente) */}
      {hasDUtente && (
        <g>
          {/* Proiezione verticale tratteggiata verde verso il box D_utente */}
          <line x1={dX} y1={dY} x2={dX} y2={dTagY} stroke="#10b981" strokeWidth="1.5" strokeDasharray="2,2" />
          <circle cx={dX} cy={dY} r="6" fill="#10b981" stroke="#ffffff" strokeWidth="2.5" />

          {/* Badge Etichetta Proiezione D_utente sopra l'asse X (sfalsato in altezza se vicino a Max) */}
          <g transform={`translate(${dTagX}, ${dTagY})`}>
            <rect x="0" y="0" width="144" height="20" rx="5" fill="#065f46" stroke="#ffffff" strokeWidth="1.5" />
            <text x="72" y="13" textAnchor="middle" className="text-[9.5px] fill-white font-bold">
              D = {d_utente} m ({formatNumber(y_amm_d_utente!, 0)} N/m)
            </text>
          </g>
        </g>
      )}

      {/* Axis Labels */}
      <text x={margin.left} y={margin.top - 15} textAnchor="start" className="text-[11px] fill-slate-700 font-black uppercase tracking-wider">
        Carico N/m
      </text>
      <text x={width / 2} y={height - 4} textAnchor="middle" className="text-[11px] fill-slate-700 font-black uppercase tracking-wider">
        Distanza tra i supporti (m)
      </text>
    </svg>
  );
}

export function ToolStaffaggioSupportiCanalizzazioni({
  projectData,
  setProjectData,
  setAppMode,
  importedStaffaggioData,
  clearImportedStaffaggioData
}: ToolStaffaggioSupportiCanalizzazioniProps) {
  const [state, setState] = useState<ToolState>(defaultState);

  // Gestione dati importati da Tool 1 (con timer 150ms per essere eseguito DOPO il ripristino bozza di ProjectStorage a 80ms)
  useEffect(() => {
    if (importedStaffaggioData) {
      const timer = setTimeout(() => {
        const q_tot = importedStaffaggioData.q_tot !== undefined ? importedStaffaggioData.q_tot : 20.0;
        const h = importedStaffaggioData.height || 75;
        const w = importedStaffaggioData.width || 200;
        const name = importedStaffaggioData.trattaName 
          ? `Staffaggio - ${importedStaffaggioData.trattaName}` 
          : `Tratta Importata ${state.tratte.length + 1}`;

        setState(prev => {
          const isInitialDefault = prev.tratte.length === 1 && (prev.tratte[0].id === 'tratta_staff_1' || prev.tratte[0].tag === 'S1');
          const importedTag = isInitialDefault ? 'S1' : `S${prev.tratte.length + 1}`;

          const importedTratta: TrattaStaffaggio = {
            id: isInitialDefault ? prev.tratte[0].id : `tratta_staff_${Date.now()}`,
            tag: importedTag,
            name,
            serie: importedStaffaggioData.serie || 'P31+',
            tipologia: importedStaffaggioData.tipologia || 'Canale Chiuso M/F',
            altezza_mm: [25, 50, 75, 100].includes(h) ? h : 75,
            larghezza_mm: [50, 75, 100, 150, 200, 300, 400, 500, 600].includes(w) ? w : 200,
            q_tot_kg_m: Math.max(0.1, parseFloat(q_tot.toFixed(2))),
            gamma: 1.0,
            hasPiastraAllineamento: w >= 400,
            d_utente_m: ''
          };

          const updatedTratte = isInitialDefault 
            ? [importedTratta] 
            : [...prev.tratte.filter(t => t.name !== name), importedTratta];

          const newState = {
            tratte: updatedTratte,
            activeTrattaTag: importedTag
          };

          // Aggiorna subito anche la bozza in localStorage per evitare sovrascritture ritardate
          try {
            const draft = {
              currentProjectId: null,
              currentProjectName: name,
              projectInfo: projectData,
              currentData: newState
            };
            localStorage.setItem('draft_staffaggio_supporti', JSON.stringify(draft));
          } catch (e) {}

          return newState;
        });

        if (window.suiteUI) {
          window.suiteUI.toast(`Tratta "${name}" (${importedStaffaggioData.q_tot} kg/m) importata con successo!`, 'success');
        }

        if (clearImportedStaffaggioData) {
          clearImportedStaffaggioData();
        }
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [importedStaffaggioData]);

  const handleLoadProject = (loadedData: any) => {
    if (loadedData && Array.isArray(loadedData.tratte) && loadedData.tratte.length > 0) {
      setState({
        tratte: loadedData.tratte,
        activeTrattaTag: loadedData.tratte[0].tag
      });
    } else {
      setState(defaultState);
    }
  };

  const activeTratta = useMemo(() => {
    return state.tratte.find(t => t.tag === state.activeTrattaTag) || state.tratte[0];
  }, [state.tratte, state.activeTrattaTag]);

  const activeCalc = useMemo(() => {
    if (!activeTratta) return null;
    return calcolaStaffaggioTratta(activeTratta);
  }, [activeTratta]);

  // Gestione aggiunta/rimozione/duplicazione tratte
  const handleAddTratta = () => {
    const newIndex = state.tratte.length + 1;
    const newTag = `S${newIndex}`;
    const newTratta: TrattaStaffaggio = {
      id: `tratta_staff_${Date.now()}`,
      tag: newTag,
      name: `Tratta Staffaggio ${newIndex}`,
      serie: 'P31+',
      tipologia: 'Canale Chiuso M/F',
      altezza_mm: 75,
      larghezza_mm: 200,
      q_tot_kg_m: 25.0,
      gamma: 1.0,
      hasPiastraAllineamento: false,
      d_utente_m: ''
    };
    setState(prev => ({
      tratte: [...prev.tratte, newTratta],
      activeTrattaTag: newTag
    }));
  };

  const handleDuplicateTratta = () => {
    if (!activeTratta) return;
    const newIndex = state.tratte.length + 1;
    const newTag = `S${newIndex}`;
    const newTratta: TrattaStaffaggio = {
      ...activeTratta,
      id: `tratta_staff_${Date.now()}`,
      tag: newTag,
      name: `${activeTratta.name} (Copia)`
    };
    setState(prev => ({
      tratte: [...prev.tratte, newTratta],
      activeTrattaTag: newTag
    }));
  };

  const handleRemoveTratta = (tag: string) => {
    if (state.tratte.length <= 1) {
      if (window.suiteUI) window.suiteUI.toast("Impossibile eliminare l'unica tratta presente.", "warning");
      return;
    }
    setState(prev => {
      const filtered = prev.tratte.filter(t => t.tag !== tag);
      return {
        tratte: filtered,
        activeTrattaTag: filtered[0].tag
      };
    });
  };

  const handleUpdateActiveTratta = (field: keyof TrattaStaffaggio, value: any) => {
    setState(prev => ({
      ...prev,
      tratte: prev.tratte.map(t => {
        if (t.tag !== prev.activeTrattaTag) return t;
        return { ...t, [field]: value };
      })
    }));
  };

  return (
    <div className="bg-slate-100 rounded-3xl p-6 md:p-8 animate-in fade-in duration-300">
      {/* Project Storage bar (IDENTICA a Pozzetti e Riempimento Canali) */}
      <div className="print:hidden mb-6">
        <ProjectStorage 
          toolType="staffaggio_supporti" 
          currentData={state} 
          onLoadProject={handleLoadProject} 
          projectInfo={projectData} 
          setProjectInfo={setProjectData} 
        />
      </div>

      {/* Intestazione del Progetto */}
      <ProjectHeader
        title="Staffaggio e Supporti Canalizzazioni"
        pData={projectData}
        setPData={setProjectData}
        setAppMode={setAppMode}
        iconColor="purple"
        docCode="M_4.4.6_E5_Elet_00"
      />

      {/* Spiegazione & Formule */}
      <div className="bg-purple-50/50 border border-purple-200/50 rounded-2xl p-4 mb-5 text-xs text-slate-650 space-y-2.5 print:hidden">
        <p>
          <strong>Descrizione:</strong> Determina il passo massimo di staffaggio (distanza massima tra i supporti) e la carica totale agente sulle staffe secondo le norme CEI EN 61537 e le tabelle di carico SWL per canalizzazioni metalliche Legrand P31+.
        </p>
        <div className="bg-white/80 border border-purple-100 rounded-xl p-4 text-slate-600">
          <p className="font-bold text-slate-700 mb-2.5 text-[11px] uppercase tracking-wide">Formule e Criteri di Dimensionamento:</p>
          <div className="space-y-3 pl-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span>• Interasse Massimo tra i Supporti:</span>
              <span className="font-serif font-bold text-slate-800 flex items-center">
                d<sub>max</sub> = f(q<sub>tot</sub>, Serie Canale, W, H)
                <span className="text-[11px] text-slate-500 font-sans font-normal ml-2">(Tipico: 1.5 m ÷ 3.0 m secondo curve SWL CEI EN 61537)</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span>• Forza Peso Agente su Singolo Supporto:</span>
              <span className="font-serif font-bold text-slate-800 flex items-center">
                F<sub>staffa</sub> = q<sub>tot</sub> × γ<sub>sicurezza</sub> × d<sub>interasse</sub>
                <span className="text-[11px] text-slate-500 font-sans font-normal ml-1">[kg]</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span>• Piastra di Allineamento / Giunzione:</span>
              <span className="font-serif font-bold text-slate-800 flex items-center">
                Raccomandata per larghezze W ≥ 400 mm
                <span className="text-[11px] text-slate-500 font-sans font-normal ml-2">o con giunti in campata per garantire rigidità alla flessione</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="print:hidden space-y-6">
        {/* Scheda Gestione Tratte Multi-progetto */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-800">
                Tratte Canalizzazione e Staffaggio
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Seleziona, aggiungi o duplica le tratte del progetto. Clicca su una scheda per configurarla.
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleAddTratta}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Tratta
              </button>
              <button 
                onClick={handleDuplicateTratta}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-150 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                <Copy className="w-4 h-4" /> Duplica
              </button>
              {state.tratte.length > 1 && (
                <button 
                  onClick={() => handleRemoveTratta(activeTratta.tag)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Rimuovi
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {state.tratte.map(t => {
              const calc = calcolaStaffaggioTratta(t);
              const isSelected = t.tag === state.activeTrattaTag;
              const isOk = calc && (!calc.esitoPassoFisso || calc.esitoPassoFisso === 'VERIFICATO') && !calc.outOfRangeHigh;
              return (
                <div
                  key={t.tag}
                  onClick={() => setState(prev => ({ ...prev, activeTrattaTag: t.tag }))}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-purple-400 bg-purple-50/30 ring-2 ring-purple-400/20'
                      : 'border-slate-150 bg-slate-50/30 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-black text-slate-800 truncate">
                      {t.name} ({t.tag})
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                      isOk ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {isOk ? 'VERIFICATO' : 'NON VERIFICATO'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold space-y-0.5">
                    <div>Serie: {t.serie} - {t.altezza_mm}x{t.larghezza_mm} mm</div>
                    <div>Carico: <strong className="text-slate-700">{t.q_tot_kg_m || 0} kg/m</strong></div>
                    <div>Passo Max: <strong className="text-purple-700 font-bold">{calc ? calc.x_max_m : 0} m</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Pannello Input Sinistro */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-purple-600" />
                  Parametri Canalizzazione & Carichi
                </h3>
                <span className="text-xs font-bold px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full">
                  {activeTratta.tag}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome Tratta</label>
                  <input
                    type="text"
                    value={activeTratta.name}
                    onChange={e => handleUpdateActiveTratta('name', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Serie Catalogo</label>
                    <select
                      value={activeTratta.serie}
                      onChange={e => handleUpdateActiveTratta('serie', e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                      <option value="P31+">P31+ (Legrand)</option>
                      <option value="ZF31 / Cablofil">ZF31 / Cablofil</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tipologia</label>
                    <select
                      value={activeTratta.tipologia}
                      onChange={e => handleUpdateActiveTratta('tipologia', e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                      <option value="Canale Chiuso M/F">Canale Chiuso M/F</option>
                      <option value="Passerella Forata M/F">Passerella Forata M/F</option>
                      <option value="Passerella a filo ZF31/Cablofil">Passerella a filo ZF31/Cablofil</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Altezza H (mm)</label>
                    <select
                      value={activeTratta.altezza_mm}
                      onChange={e => handleUpdateActiveTratta('altezza_mm', parseInt(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                      <option value={25}>25 mm</option>
                      <option value={50}>50 mm</option>
                      <option value={75}>75 mm</option>
                      <option value={100}>100 mm</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Larghezza W (mm)</label>
                    <select
                      value={activeTratta.larghezza_mm}
                      onChange={e => handleUpdateActiveTratta('larghezza_mm', parseInt(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                      {[50, 75, 100, 150, 200, 300, 400, 500, 600].map(w => (
                        <option key={w} value={w}>{w} mm</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Carico Lineare */}
                <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-black text-purple-950">
                      Carico Totale Lineare q_tot (kg/m)
                    </label>
                    <span className="text-[10px] text-purple-700 font-bold">Canale + Cavi</span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    placeholder="Es. 25.0"
                    value={activeTratta.q_tot_kg_m ?? ''}
                    onChange={e => handleUpdateActiveTratta('q_tot_kg_m', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full bg-white border border-purple-200 rounded-xl px-3 py-2 text-sm font-black text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <div className="text-[11px] text-slate-500 font-medium">
                    Convertito in forza peso: <strong className="text-slate-800">{formatNumber((typeof activeTratta.q_tot_kg_m === 'number' ? activeTratta.q_tot_kg_m : 0) * 9.81, 1)} N/m</strong>
                  </div>
                </div>

                {/* Fattore NTC 2018 & Piastra Allineamento */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Fattore Sicurezza NTC (γ)</label>
                    <select
                      value={activeTratta.gamma}
                      onChange={e => handleUpdateActiveTratta('gamma', parseFloat(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    >
                      <option value={1.0}>γ = 1.0 (Standard CEI EN 61537)</option>
                      <option value={1.3}>γ = 1.3 (Ambito Sismico / Dinamico - NTC cap. 7.2.4)</option>
                      <option value={1.5}>γ = 1.5 (Stati Limite SLS / SLU - NTC Tab. 2.6.I)</option>
                    </select>

                    {/* Nota esplicativa dinamica per il Fattore NTC */}
                    <div className="mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-600 font-medium leading-relaxed flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                      <span>
                        {activeTratta.gamma === 1.0 && "γ = 1.0: Carico nominale di laboratorio senza maggiorazioni (Standard CEI EN 61537)."}
                        {activeTratta.gamma === 1.3 && "γ = 1.3: Maggiorazione sismica/dinamica del +30% per impianti ed elementi non strutturali (NTC 2018 cap. 7.2.4)."}
                        {activeTratta.gamma === 1.5 && "γ = 1.5: Coefficiente di sicurezza precauzionale completo per combinazioni di carico agli Stati Limite SLS/SLU (NTC 2018 Tab. 2.6.I)."}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all ${
                      activeTratta.larghezza_mm >= 400 
                        ? 'bg-purple-50/40 border-purple-200 cursor-pointer' 
                        : 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                    }`}>
                      <input
                        type="checkbox"
                        checked={activeTratta.hasPiastraAllineamento}
                        onChange={e => handleUpdateActiveTratta('hasPiastraAllineamento', e.target.checked)}
                        disabled={activeTratta.larghezza_mm < 400}
                        className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 mt-0.5 shrink-0"
                      />
                      <div className="text-[11px] leading-tight space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-800">Piastra Allineamento Inferiore</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full">
                            +30% Portata (W ≥ 400 mm)
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-normal leading-relaxed">
                          Per larghezze W ≥ 400 mm, l'installazione della piastra inferiore di allineamento sul giunto assicura la continuità flessionale ed incrementa la portata ammissibile del +30% (Prescrizioni Legrand P31+).
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Distanza Manuale per Verifica a Passo Fisso */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Verifica Passo Fisso Personalizzato D_utente (metri)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="5.0"
                    placeholder="Es. 2.5 m (Opzionale - lascia vuoto se non richiesto)"
                    value={activeTratta.d_utente_m ?? ''}
                    onChange={e => handleUpdateActiveTratta('d_utente_m', e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <span className="text-[10px] text-slate-400 block font-medium">
                    Opzionale. Inserisci una distanza fissa in metri se vuoi verificare se un interasse specifico rispetta la portata.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Pannello Risultati Destro */}
          <div className="lg:col-span-7 space-y-6">
            {activeCalc && (
              <>
                {/* Risultato Principale - Passo Consigliato */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-purple-650 block">
                        Esito Staffaggio & Supporti
                      </span>
                      <h2 className="text-xl font-black text-slate-900 mt-1">
                        {activeTratta.name} ({activeTratta.serie} {activeTratta.altezza_mm}x{activeTratta.larghezza_mm})
                      </h2>
                    </div>

                    <span className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                      activeCalc.outOfRangeHigh 
                        ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}>
                      {activeCalc.outOfRangeHigh ? (
                        <>
                          <XCircle className="w-4 h-4 text-rose-600" />
                          NON VERIFICATO
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          VERIFICATO
                        </>
                      )}
                    </span>
                  </div>

                  {/* Cards metriche principali */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    {/* Metric 1: Passo Max */}
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-150 p-4 rounded-2xl space-y-1">
                      <span className="text-[10px] font-black text-purple-800 uppercase tracking-wider block">
                        Passo Max Staffaggio
                      </span>
                      <div className="text-2xl font-black text-purple-950">
                        {formatNumber(activeCalc.x_max_m, 1)} m
                      </div>
                      <span className="text-[10px] text-purple-700 font-semibold block">
                        (Arrotondato per difetto)
                      </span>
                    </div>

                    {/* Metric 2: Reazione N */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                        Forza Singolo Supporto (N)
                      </span>
                      <div className="text-2xl font-black text-slate-800">
                        {formatNumber(activeCalc.f_supporto_N, 0)} N
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium block">
                        Reazione d'appoggio vincolare
                      </span>
                    </div>

                    {/* Metric 3: Reazione kg */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                        Carico Puntuale (kg)
                      </span>
                      <div className="text-2xl font-black text-slate-800">
                        {formatNumber(activeCalc.f_supporto_kg, 1)} kg
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium block">
                        Gra gravante sul tassello
                      </span>
                    </div>
                  </div>

                  {/* Dettagli Spiegazione */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium leading-relaxed">
                    <strong>Dettaglio Calcolo:</strong> {activeCalc.notaSpiegazione}
                    {activeCalc.isPiastraApplicata && (
                      <div className="mt-1 text-purple-800 font-bold">
                        • Piastra di allineamento attiva: Portata ammissibile incrementata del +30%.
                      </div>
                    )}
                  </div>

                  {/* Box Verifica Passo Fisso Manuale */}
                  {activeCalc.esitoPassoFisso && (
                    <div className={`p-4 rounded-2xl border ${
                      activeCalc.esitoPassoFisso === 'VERIFICATO' 
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' 
                        : 'bg-rose-50/70 border-rose-200 text-rose-900'
                    }`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                          {activeCalc.esitoPassoFisso === 'VERIFICATO' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-600" />
                          )}
                          Esito Verifica Passo Fisso (D = {formatNumber(activeCalc.d_utente!, 2)} m)
                        </span>
                        <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                          activeCalc.esitoPassoFisso === 'VERIFICATO'
                            ? 'bg-emerald-200 text-emerald-900'
                            : 'bg-rose-200 text-rose-900'
                        }`}>
                          {activeCalc.esitoPassoFisso}
                        </span>
                      </div>
                      <p className="text-xs font-medium leading-relaxed">
                        {activeCalc.dettaglioPassoFisso}
                      </p>
                    </div>
                  )}
                </div>

                {/* Grafico Curva di Carico SVG Interattivo */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Ruler className="w-4 h-4 text-purple-600" />
                    Diagramma del Carico Ammissibile (Legrand CEI EN 61537)
                  </h3>

                  <div className="h-72 w-full">
                    <StaffaggioDiagrammaSVG
                      curvaModificata={activeCalc.curvaModificata}
                      q_progetto={activeCalc.q_progetto}
                      x_max_m={activeCalc.x_max_m}
                      d_utente={activeCalc.d_utente}
                      y_amm_d_utente={activeCalc.y_amm_d_utente}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Report di Stampa PDF / Clean Print Section */}
      <div className="hidden print:block space-y-6 mt-6">
        <div className="w-full">
          <h3 className="text-base font-black text-slate-800 border-b-2 border-slate-800 pb-1 uppercase tracking-wider">
            Report di Calcolo Staffaggio e Supporti Canalizzazioni
          </h3>

          <table className="w-full text-left border-collapse text-xs mt-6">
            <thead>
              <tr className="border-b border-slate-400 bg-slate-100 font-bold text-slate-800">
                <th className="py-2 px-2">Tratta</th>
                <th className="py-2 px-2">Serie & Geometria</th>
                <th className="py-2 px-2 text-right">Carico q_tot (kg/m)</th>
                <th className="py-2 px-2 text-right">Carico Progetto (N/m)</th>
                <th className="py-2 px-2 text-center">Passo Max (m)</th>
                <th className="py-2 px-2 text-right">Forza Supporto</th>
                <th className="py-2 px-2 text-center">Esito Passo Fisso</th>
              </tr>
            </thead>
            <tbody>
              {state.tratte.map(t => {
                const calc = calcolaStaffaggioTratta(t);
                if (!calc) return null;
                return (
                  <tr key={t.tag} className="border-b border-slate-200">
                    <td className="py-2.5 px-2 font-bold text-slate-900">{t.name} ({t.tag})</td>
                    <td className="py-2.5 px-2 text-[11px]">
                      <div>{t.serie} - {t.tipologia}</div>
                      <div className="text-slate-500 font-mono">{t.altezza_mm}x{t.larghezza_mm} mm</div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold">{formatNumber(typeof t.q_tot_kg_m === 'number' ? t.q_tot_kg_m : 0, 1)} kg/m</td>
                    <td className="py-2.5 px-2 text-right font-mono">{formatNumber(calc.q_progetto, 1)} N/m</td>
                    <td className="py-2.5 px-2 text-center font-bold text-purple-900">{formatNumber(calc.x_max_m, 1)} m</td>
                    <td className="py-2.5 px-2 text-right font-mono text-[11px]">
                      <div><strong>{formatNumber(calc.f_supporto_N, 0)} N</strong></div>
                      <div className="text-slate-500">({formatNumber(calc.f_supporto_kg, 1)} kg)</div>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {calc.esitoPassoFisso ? (
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          calc.esitoPassoFisso === 'VERIFICATO' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {calc.esitoPassoFisso} (D={t.d_utente_m}m)
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[10px]">Non specificato</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

          {/* Diagrammi dei carichi ammissibili per la stampa */}
          <div className="print:break-inside-avoid space-y-4 mt-8">
            <h4 className="text-xs font-bold text-slate-800 border-b border-slate-300 pb-1.5 uppercase tracking-wider">
              Diagrammi del Carico Ammissibile (Legrand CEI EN 61537)
            </h4>
            <div className="space-y-6">
              {state.tratte.map(t => {
                const calc = calcolaStaffaggioTratta(t);
                if (!calc) return null;
                return (
                  <div key={t.tag} className="border border-slate-300 rounded-2xl p-4 bg-white space-y-2 print:break-inside-avoid shadow-xs">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <span className="text-xs font-black text-slate-900">
                        Tratta: {t.name} ({t.tag}) — {t.serie} ({t.tipologia}) {t.altezza_mm}x{t.larghezza_mm} mm
                      </span>
                      <span className="text-[10px] font-black text-purple-900 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
                        Passo Max: {calc.x_max_m} m | Carico: {formatNumber(calc.q_progetto, 1)} N/m
                      </span>
                    </div>
                    <div className="h-52 w-full pt-1">
                      <StaffaggioDiagrammaSVG
                        curvaModificata={calc.curvaModificata}
                        q_progetto={calc.q_progetto}
                        x_max_m={calc.x_max_m}
                        d_utente={calc.d_utente}
                        y_amm_d_utente={calc.y_amm_d_utente}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        {/* Attestato di conformità stampa */}
        <div className="pt-4 border-t-2 border-slate-300 print:break-inside-avoid mt-8 bg-white">
          <div className="flex justify-between items-center gap-4">
            <div className="space-y-1 flex-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">
                Attestato di Calcolo Staffaggio CEI EN 61537 / NTC 2018
              </span>
              <p className="text-[10px] text-slate-600 font-medium leading-relaxed italic">
                Si attesta che la verifica della distanza massima tra i supporti e il calcolo delle reazioni vincolari concentrate per le canalizzazioni elettriche del presente report sono stati svolti in conformità ai test di carico ammissibile stabiliti dalla norma CEI EN 61537 ed ai diagrammi tecnici ufficiali forniti dal costruttore (Legrand).
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2 border border-emerald-300 bg-emerald-50 px-3.5 py-2 rounded-xl text-emerald-900 font-bold shadow-xs">
              <span className="text-sm">🛡️</span>
              <div className="text-left">
                <span className="text-[10px] font-black uppercase tracking-wider block leading-none">CONFORME CEI EN 61537 / NTC 2018</span>
                <span className="text-[8px] font-bold text-emerald-700 block mt-0.5">Calcolo di Portata & Staffaggio Certificato</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
