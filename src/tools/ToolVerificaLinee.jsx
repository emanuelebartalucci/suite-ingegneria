import React, { useState, useMemo } from 'react';
import { ProjectHeader } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import TopologicalTree from '../components/TopologicalTree';
import { PIPE_CATALOG, INSULATION_CATALOG, getExternalDiameter } from '../data/pipeCatalog';
import { getEquivalentLength } from '../data/equivalentLengths';
import { 
  IconArrowUp, 
  IconPlus, 
  IconTrash, 
  IconCopy 
} from '../components/Icons';

// Risolutore iterativo Colebrook-White
function solveColebrookWhite(Re, roughnessRel) {
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
    const term = (roughnessRel / 3.71) + (2.52 / (Re * x));
    if (term <= 0) break;
    x = -2 * Math.log10(term);
  }
  return 1 / (x * x);
}

// Componente per disegnare la sezione geometrica del tubo sovrapposta al grafico del gradiente termico radiale
function SVGGradienteSovrapposto({ tratto, fluidTemp }) {
  if (!tratto || !tratto.d_int) return null;

  const ri = tratto.d_int / 2; // Raggio interno in mm
  const re = (tratto.d_ext || (tratto.d_int + 10)) / 2; // Raggio esterno in mm
  const s_iso = Number(tratto.isoThick) || 0;
  const riso = re + s_iso; // Raggio complessivo isolato in mm

  const tf = Number(fluidTemp) || 55;
  const ta = tratto.tAmb !== undefined ? Number(tratto.tAmb) : -5;
  const t_ext_tubo = tratto.t_pipe_ext !== undefined ? tratto.t_pipe_ext : tf;
  const t_s = tratto.t_surf !== undefined ? tratto.t_surf : tf;

  // Coordinate e dimensioni dell'asse cartesiano
  const originX = 45;
  const originY = 165;
  const graphWidth = 220;
  const graphHeight = 120;

  const getX = (r) => {
    return originX + (r / riso) * graphWidth;
  };

  const tMin = Math.min(tf, ta) - 5;
  const tMax = Math.max(tf, ta) + 5;
  const getY = (temp) => {
    const range = tMax - tMin || 1;
    return originY - ((temp - tMin) / range) * graphHeight;
  };

  // Raggi convertiti in pixel per il disegno dei quarti di cerchio concentrici
  const R_i_px = (ri / riso) * graphWidth;
  const R_e_px = (re / riso) * graphWidth;
  const R_iso_px = graphWidth;

  const isNoneIso = tratto.isoType === 'none';

  // Colore di riempimento dell'isolante
  let isoColor = "rgba(226, 232, 240, 0.25)"; // Grigio default
  if (tratto.isoType === 'pur') isoColor = "rgba(254, 240, 138, 0.4)"; // Giallo PUR
  if (tratto.isoType === 'rockwool') isoColor = "rgba(253, 224, 71, 0.35)"; // Lana di roccia
  if (tratto.isoType === 'rubber') isoColor = "rgba(51, 65, 85, 0.25)"; // Gomma nera

  // Calcolo dei punti logaritmici per la curva della temperatura nell'isolante
  const numPoints = 15;
  let isoPathPoints = [];
  for (let i = 0; i <= numPoints; i++) {
    const fraction = i / numPoints;
    const r = re + fraction * s_iso;
    let temp = t_ext_tubo;
    if (s_iso > 0 && Math.abs(t_ext_tubo - t_s) > 0.01) {
      temp = t_ext_tubo - (t_ext_tubo - t_s) * (Math.log(r / re) / Math.log(riso / re));
    }
    isoPathPoints.push(`${getX(r)},${getY(temp)}`);
  }
  const isoPath = `M ${isoPathPoints.join(' L ')}`;

  return (
    <svg width="100%" height="200" viewBox="0 0 300 200" className="mx-auto select-none font-sans bg-slate-900/5 border border-slate-200 rounded-xl p-2 print:h-auto print:bg-transparent print:border-none print:p-0">
      {/* 1. GEOMETRIA DEL TUBO IN SOTTOFONDO (Quarti di cerchio concentrici con origine in basso a sinistra) */}
      <g className="opacity-90">
        {/* Isolante */}
        {!isNoneIso && s_iso > 0 && (
          <path 
            d={`M ${originX} ${originY} L ${originX + R_iso_px} ${originY} A ${R_iso_px} ${R_iso_px} 0 0 0 ${originX} ${originY - R_iso_px} Z`} 
            fill={isoColor} 
            stroke="#cbd5e1" 
            strokeWidth="0.5"
          />
        )}
        
        {/* Parete metallica del tubo */}
        <path 
          d={`M ${originX} ${originY} L ${originX + R_e_px} ${originY} A ${R_e_px} ${R_e_px} 0 0 0 ${originX} ${originY - R_e_px} Z`} 
          fill={tratto.material === 'Acciaio' ? 'rgba(148, 163, 184, 0.4)' : 'rgba(71, 85, 105, 0.4)'} 
          stroke="#94a3b8" 
          strokeWidth="0.5"
        />
        
        {/* Fluido interno */}
        <path 
          d={`M ${originX} ${originY} L ${originX + R_i_px} ${originY} A ${R_i_px} ${R_i_px} 0 0 0 ${originX} ${originY - R_i_px} Z`} 
          fill="rgba(191, 219, 254, 0.65)" 
          stroke="#60a5fa" 
          strokeWidth="0.5"
        />
      </g>

      {/* 2. ASSI CARTESIANI E GRIGLIA */}
      <line x1={originX} y1={originY} x2={originX + graphWidth + 15} y2={originY} stroke="#475569" strokeWidth="1.5" />
      <line x1={originX} y1={originY - graphHeight - 10} x2={originX} y2={originY} stroke="#475569" strokeWidth="1.5" />

      {/* Tacche ed etichette Y (Temperatura) */}
      <line x1={originX - 4} y1={getY(tf)} x2={originX} y2={getY(tf)} stroke="#475569" strokeWidth="1.5" />
      <text x={originX - 7} y={getY(tf) + 3} textAnchor="end" fill="#0f172a" fontSize="8" fontWeight="bold">{tf.toFixed(0)}°C</text>

      <line x1={originX - 4} y1={getY(t_s)} x2={originX} y2={getY(t_s)} stroke="#475569" strokeWidth="1.5" />
      <text x={originX - 7} y={getY(t_s) + 3} textAnchor="end" fill="#b91c1c" fontSize="8" fontWeight="bold">{t_s.toFixed(1)}°C</text>

      <line x1={originX - 4} y1={getY(ta)} x2={originX} y2={getY(ta)} stroke="#475569" strokeWidth="1.5" />
      <text x={originX - 7} y={getY(ta) + 3} textAnchor="end" fill="#475569" fontSize="8">{ta.toFixed(0)}°C</text>

      {/* Tacche ed etichette X (Raggio in mm) */}
      <line x1={getX(ri)} y1={originY} x2={getX(ri)} y2={originY + 4} stroke="#3b82f6" strokeWidth="1.5" />
      <text x={getX(ri)} y={originY + 11} textAnchor="middle" fill="#2563eb" fontSize="7" fontWeight="bold">{ri.toFixed(0)}</text>

      <line x1={getX(re)} y1={originY} x2={getX(re)} y2={originY + 4} stroke="#475569" strokeWidth="1.5" />
      <text x={getX(re)} y={originY + 11} textAnchor="middle" fill="#475569" fontSize="7" fontWeight="bold">{re.toFixed(0)}</text>

      {!isNoneIso && s_iso > 0 && (
        <>
          <line x1={getX(riso)} y1={originY} x2={getX(riso)} y2={originY + 4} stroke="#d97706" strokeWidth="1.5" />
          <text x={getX(riso)} y={originY + 11} textAnchor="middle" fill="#d97706" fontSize="7" fontWeight="bold">{riso.toFixed(0)}</text>
        </>
      )}

      {/* Etichette assi */}
      <text x={originX + graphWidth + 12} y={originY - 3} textAnchor="end" fill="#475569" fontSize="7.5" fontWeight="bold">r (mm)</text>
      <text x={originX + 4} y={originY - graphHeight - 4} textAnchor="start" fill="#475569" fontSize="7.5" fontWeight="bold">T (°C)</text>

      {/* 3. TRACCIAMENTO GRADIENTE TERMICO (Sopra la geometria) */}
      {/* Fluido (Piatto) */}
      <line x1={getX(0)} y1={getY(tf)} x2={getX(ri)} y2={getY(tf)} stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />

      {/* Tubo (Lineare) */}
      <line x1={getX(ri)} y1={getY(tf)} x2={getX(re)} y2={getY(t_ext_tubo)} stroke="#334155" strokeWidth="2.5" />

      {/* Isolante (Logaritmica) */}
      {!isNoneIso && s_iso > 0 ? (
        <path d={isoPath} fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
      ) : null}

      {/* Convezione Esterna (Raccordo tratteggiato) */}
      <line x1={getX(riso)} y1={getY(t_s)} x2={getX(riso) + 10} y2={getY(ta)} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2,2" />

      {/* Punti caratteristici */}
      <circle cx={getX(re)} cy={getY(t_ext_tubo)} r="2" fill="#334155" />
      <circle cx={getX(riso)} cy={getY(t_s)} r="2.5" fill="#b91c1c" />

      {/* Etichette testuali delle zone */}
      <text x={originX + R_i_px / 2} y={originY - 6} textAnchor="middle" fill="#1d4ed8" fontSize="6" fontWeight="bold">Fluido</text>
      <text x={originX + R_i_px + (R_e_px - R_i_px) / 2} y={originY - 6} textAnchor="middle" fill="#334155" fontSize="6" fontWeight="bold">Tubo</text>
      {!isNoneIso && s_iso > 0 && (
        <text x={originX + R_e_px + (R_iso_px - R_e_px) / 2} y={originY - 6} textAnchor="middle" fill="#b45309" fontSize="6" fontWeight="bold">Isolante</text>
      )}
    </svg>
  );
}

export function ToolVerificaLinee({ projectData, setProjectData, setAppMode }) {
    const [fluidTemp, setFluidTemp] = useState(55); // °C
    const [glycolEtPercent, setGlycolEtPercent] = useState(0); // %
    const [glycolPrPercent, setGlycolPrPercent] = useState(0); // %
    const [tratti, setTratti] = useState([]);
    const [selectedTrattoId, setSelectedTrattoId] = useState(null);

    // Calcolo densità e viscosità dinamica globali basati sulle percentuali di glicole in acqua
    const fluidProps = useMemo(() => {
        const T = Number(fluidTemp) || 55;
        const xEt = (Number(glycolEtPercent) || 0) / 100;
        const xPr = (Number(glycolPrPercent) || 0) / 100;

        // Proprietà di base dell'acqua pura alla temperatura T
        const rho_water = 1000 - 0.22 * T - 0.003 * Math.pow(T, 2);
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
        return tratti.map(t => {
            let d_int = 0;
            let roughness = 0.02;

            if (t.material === 'manuale') {
                d_int = Number(t.D) || 50;
                roughness = Number(t.roughness) || 0.02;
            } else if (PIPE_CATALOG[t.material]) {
                const dnSpecs = PIPE_CATALOG[t.material].specs[t.DN];
                if (dnSpecs) {
                    d_int = dnSpecs[t.PN] || 50;
                }
                roughness = PIPE_CATALOG[t.material].roughness;
            }

            // Parametri isolamento termico con fallback retrocompatibili
            const isoType = t.isoType || 'pur';
            const isoThick = t.isoThick === '' ? '' : (t.isoThick !== undefined ? Number(t.isoThick) : 50);
            const isoLambda = t.isoLambda !== undefined ? Number(t.isoLambda) : 0.025;
            const tAmbVal = t.tAmb === '' ? '' : (t.tAmb !== undefined ? Number(t.tAmb) : -5);

            const activeIsoThick = isoThick === '' ? 0 : Number(isoThick);
            const activeTAmb = tAmbVal === '' ? 0 : Number(tAmbVal);

            const d_int_m = d_int / 1000;
            const flow_m3h = Number(t.portata) || 0;
            const length = Number(t.length) || 0;

            // 1. Sezione Interna (m2)
            const area_m2 = (Math.PI * Math.pow(d_int_m, 2)) / 4;
            
            // 2. Velocità (m/s)
            const velocity = area_m2 > 0 ? (flow_m3h / area_m2 / 3600) : 0;

            // 3. Reynolds
            const Re = activeVisc > 0 ? (activeRho * velocity * d_int_m) / activeVisc : 0;

            // 4. Rugosità relativa
            const roughnessRel = d_int > 0 ? (roughness / d_int) : 0;

            // 5. Fattore di attrito lambda
            const lambda = solveColebrookWhite(Re, roughnessRel);

            // 6. Pezzi Speciali - Lunghezze equivalenti singole
            const leq_valvola = getEquivalentLength('valvola_diaframma', t.DN);
            const leq_riduzione = getEquivalentLength('riduzione', t.DN);
            const leq_curva = getEquivalentLength('curva_d', t.DN);
            const leq_tee = getEquivalentLength('innesto_t', t.DN);

            // Lunghezza equivalente totale dei pezzi speciali (m)
            const leq_tot_valvole = (Number(t.n_valvole) || 0) * leq_valvola;
            const leq_tot_riduzioni = (Number(t.n_riduzioni) || 0) * leq_riduzione;
            const leq_tot_curve = (Number(t.n_curve) || 0) * leq_curva;
            const leq_tot_tee = (Number(t.n_tee) || 0) * leq_tee;
            const leq_tot = leq_tot_valvole + leq_tot_riduzioni + leq_tot_curve + leq_tot_tee;

            // 7. Calcolo perdite distribuite (Pa)
            const loss_dist_Pa = d_int_m > 0 ? (lambda * (length / d_int_m) * (Math.pow(velocity, 2) / 2) * activeRho) : 0;

            // 8. Calcolo perdite concentrate (Pa)
            const loss_conc_Pa = d_int_m > 0 ? (lambda * (leq_tot / d_int_m) * (Math.pow(velocity, 2) / 2) * activeRho) : 0;

            // 9. Perdite totali (Pa, mbar, m H2O)
            const loss_tot_Pa = loss_dist_Pa + loss_conc_Pa;
            const loss_tot_mbar = loss_tot_Pa / 100;
            const loss_tot_mH2O = loss_tot_Pa / 9806.65;

            // 10. Calcolo Termico (Gradiente e Temperatura Superficiale)
            let d_ext = d_int + 10;
            if (t.material && t.DN && PIPE_CATALOG[t.material]) {
                const specs = PIPE_CATALOG[t.material].specs[t.DN];
                if (specs) {
                    const d_int_mm = specs[t.PN] || d_int;
                    d_ext = getExternalDiameter(t.material, t.DN, d_int_mm);
                }
            } else if (t.D) {
                d_ext = t.D + 10;
            }

            const r_int_m = d_int_m / 2;
            const r_ext_m = d_ext / 2000;
            const s_iso_m = activeIsoThick / 1000;
            const r_iso_m = r_ext_m + s_iso_m;

            const lambda_pipe = (PIPE_CATALOG[t.material] && PIPE_CATALOG[t.material].lambda) || 50.0;
            const T = Number(fluidTemp) || 55;

            const R_int = 1 / (1163 * d_int_m); // alphaInt = 1163
            const R_pipe = Math.log(r_ext_m / r_int_m) / (2 * lambda_pipe);
            let R_iso = 0;
            if (s_iso_m > 0 && isoLambda > 0 && isoType !== 'none') {
                R_iso = Math.log(r_iso_m / r_ext_m) / (2 * isoLambda);
            }
            const R_ext = 1 / (7.4 * (r_iso_m * 2)); // alphaExt = 7.4

            const R_tot = R_int + R_pipe + R_iso + R_ext;
            const deltaT = T - activeTAmb;
            const Q_Wm = R_tot > 0 ? (Math.PI * deltaT) / R_tot : 0;

            let t_pipe_ext = T;
            let t_surf = T;
            if (T > activeTAmb) {
                t_pipe_ext = T - (Q_Wm / Math.PI) * (R_int + R_pipe);
                t_surf = activeTAmb + Q_Wm / (Math.PI * 7.4 * (r_iso_m * 2));
            } else {
                t_pipe_ext = T + (Q_Wm / Math.PI) * (R_int + R_pipe);
                t_surf = activeTAmb - Q_Wm / (Math.PI * 7.4 * (r_iso_m * 2));
            }

            return {
                ...t,
                isoType,
                isoThick,
                isoLambda,
                tAmb: tAmbVal,
                d_int,
                d_ext,
                t_surf,
                t_pipe_ext,
                roughness,
                area_m2,
                velocity,
                Re,
                roughnessRel,
                lambda,
                leq_valvola,
                leq_riduzione,
                leq_curva,
                leq_tee,
                leq_tot,
                loss_dist_Pa,
                loss_conc_Pa,
                loss_tot_Pa,
                loss_tot_mbar,
                loss_tot_mH2O
            };
        });
    }, [tratti, activeRho, activeVisc, fluidTemp]);

    const addTratto = () => {
        const newId = tratti.length > 0 ? Math.max(...tratti.map(t => t.id)) + 1 : 1;
        setTratti([
            ...tratti, 
            { 
                id: newId, 
                tag: `L${newId}`, 
                name: `Linea Tratto ${newId}`, 
                portata: 50, 
                material: 'Acciaio', 
                DN: '100', 
                PN: 'NORM', 
                length: 50, 
                n_valvole: 0, 
                n_riduzioni: 0, 
                n_curve: 0, 
                n_tee: 0,
                hierarchy: 'dorsale_principale',
                parentId: '',
                isoType: 'pur',
                isoThick: 50,
                isoLambda: 0.025,
                tAmb: -5
            }
        ]);
    };

    const duplicateTratto = (id) => {
        const t = tratti.find(x => x.id === id);
        if (!t) return;
        const newId = tratti.length > 0 ? Math.max(...tratti.map(x => x.id)) + 1 : 1;
        setTratti([...tratti, { ...t, id: newId, tag: t.tag + "-bis", name: t.name + " (Copia)" }]);
    };

    const updateTratto = (id, field, val) => {
        setTratti(prev => prev.map(t => {
            if (t.id === id) {
                let updated = { ...t, [field]: val };
                
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

    const removeTratto = (id) => {
        setTratti(tratti.filter(t => t.id !== id));
        if (selectedTrattoId === id) setSelectedTrattoId(null);
    };

    const totalLossPa = processedTratti.reduce((s, t) => s + t.loss_tot_Pa, 0);
    const totalLossMbar = totalLossPa / 100;
    const totalLossMH2O = totalLossPa / 9806.65;

    const activeTratto = processedTratti.find(x => x.id === selectedTrattoId) || processedTratti[0];

    const handleLoadCloudProject = (data) => {
        if (!data) return;
        if (data.fluidTemp !== undefined) setFluidTemp(data.fluidTemp);
        
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

        if (data.tratti) setTratti(data.tratti);
    };

    const getCloudSaveData = () => {
        return {
            fluidTemp,
            glycolEtPercent,
            glycolPrPercent,
            tratti
        };
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

            {/* Parametri Fluidi */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 mb-6 print:shadow-none print:border-none print:p-0">
                <h3 className="text-sm font-bold text-slate-700 mb-2 border-b border-slate-100 pb-2 print:border-b print:border-slate-800 print:pb-1">
                  Proprietà del Fluido Pompato (Verifica)
                </h3>
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
                            <p className="font-mono font-bold text-brand-800 text-sm">{activeRho.toFixed(1)} kg/m³</p>
                        </div>
                        <div className="w-px h-6 bg-brand-200"></div>
                        <div>
                            <p className="text-[9px] font-bold text-brand-600 uppercase">Viscosità Dinamica</p>
                            <p className="font-mono font-bold text-brand-800 text-sm">{activeVisc.toFixed(6)} Pa·s</p>
                        </div>
                    </div>
                </div>

                {/* Visualizzazione pulita per il report di stampa */}
                <div className="hidden print:grid print:grid-cols-4 print:gap-4 print:mb-2 text-xs">
                    <div>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">Fluido Pompato</p>
                        <p className="font-semibold text-slate-800 leading-tight">
                            {glycolEtPercent === 0 && glycolPrPercent === 0 ? "Acqua Pura" : ""}
                            {glycolEtPercent > 0 && glycolPrPercent === 0 ? `Acqua + Glicole Etilenico (${glycolEtPercent}%)` : ""}
                            {glycolPrPercent > 0 && glycolEtPercent === 0 ? `Acqua + Glicole Propilenico (${glycolPrPercent}%)` : ""}
                            {glycolEtPercent > 0 && glycolPrPercent > 0 ? `Acqua + Glicole Et. (${glycolEtPercent}%) + Prop. (${glycolPrPercent}%)` : ""}
                        </p>
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">Temperatura</p>
                        <p className="font-mono font-semibold text-slate-800">{fluidTemp} °C</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">Densità Calcolata</p>
                        <p className="font-mono font-semibold text-slate-800">{activeRho.toFixed(1)} kg/m³</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">Viscosità Dinamica</p>
                        <p className="font-mono font-semibold text-slate-800">{activeVisc.toFixed(6)} Pa·s</p>
                    </div>
                </div>
            </div>

            {/* Sezione Tabella Tratti (Larghezza Intera) */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 mb-6 print:shadow-none print:border-none print:p-0">
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
                                <th className="py-2.5 px-2 print:p-1">Fluido / Q (m³/h)</th>
                                <th className="py-2.5 px-2 print:p-1">Materiale / DN / PN</th>
                                <th className="py-2.5 px-2 print:p-1">L (m)</th>
                                <th className="py-2.5 px-2 print:p-1">Pezzi Speciali (K)</th>
                                <th className="py-2.5 px-2 print:p-1">Velocità (m/s)</th>
                                <th className="py-2.5 px-2 print:p-1">Reynolds / λ</th>
                                <th className="py-2.5 px-2 print:p-1 text-right">∆P Distrib (Pa)</th>
                                <th className="py-2.5 px-2 print:p-1 text-right">∆P Conc (Pa)</th>
                                <th className="py-2.5 px-2 print:p-1 text-right">∆P Totale (mbar)</th>
                                <th className="py-2.5 px-2 print:p-1 text-right">∆P Totale (m.c.a.)</th>
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
                                    <td className="py-2 px-2 print:p-1 space-y-1">
                                        <span className="hidden print:block font-bold font-mono text-xs">{t.tag}</span>
                                        <span className="hidden print:block text-[10px] text-slate-500 leading-tight">{t.name}</span>
                                        <input 
                                            type="text" 
                                            value={t.tag} 
                                            onChange={e => updateTratto(t.id, 'tag', e.target.value)} 
                                            className="w-16 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand-500 font-bold font-mono outline-none print:hidden" 
                                        />
                                        <input 
                                            type="text" 
                                            value={t.name} 
                                            onChange={e => updateTratto(t.id, 'name', e.target.value)} 
                                            className="block w-28 text-[10px] text-slate-500 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand-500 outline-none print:hidden" 
                                        />
                                    </td>
                                    
                                    {/* Portata */}
                                    <td className="py-2 px-2 print:p-1">
                                        <span className="hidden print:inline font-bold font-mono text-xs">{t.portata} <span className="text-[9px] text-slate-400 font-sans font-normal">m³/h</span></span>
                                        <div className="print:hidden flex items-center gap-1">
                                            <input 
                                                type="number" 
                                                value={t.portata === '' ? '' : t.portata} 
                                                onChange={e => updateTratto(t.id, 'portata', e.target.value === '' ? '' : Number(e.target.value))} 
                                                className="w-12 bg-transparent border-b border-slate-300 focus:border-brand-500 outline-none font-bold" 
                                            />
                                            <span className="text-[9px] text-slate-400">m³/h</span>
                                        </div>
                                    </td>

                                    {/* Materiale / DN / PN */}
                                    <td className="py-2 px-2 print:p-1 space-y-1">
                                        <div className="hidden print:block text-[10px] font-mono leading-tight">
                                            <div>{t.material === 'manuale' ? 'Manuale' : t.material}</div>
                                            {t.material !== 'manuale' ? (
                                                <div>DN{t.DN} {t.PN !== 'NORM' ? t.PN : ''}</div>
                                            ) : (
                                                <div>Øi: {t.D} mm | sc: {t.roughness} mm</div>
                                            )}
                                        </div>
                                        <div className="print:hidden space-y-1">
                                            <select 
                                                value={t.material} 
                                                onChange={e => updateTratto(t.id, 'material', e.target.value)} 
                                                className="block text-[10px] bg-transparent outline-none border-b border-slate-200 cursor-pointer"
                                            >
                                                <option value="manuale">Manuale...</option>
                                                {Object.keys(PIPE_CATALOG).map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                            
                                            {t.material !== 'manuale' ? (
                                                <div className="flex gap-1 text-[10px]">
                                                    <select 
                                                        value={t.DN} 
                                                        onChange={e => updateTratto(t.id, 'DN', e.target.value)}
                                                        className="bg-transparent outline-none cursor-pointer"
                                                    >
                                                        {Object.keys(PIPE_CATALOG[t.material]?.specs || {}).map(dn => <option key={dn} value={dn}>DN{dn}</option>)}
                                                    </select>
                                                    <select 
                                                        value={t.PN} 
                                                        onChange={e => updateTratto(t.id, 'PN', e.target.value)}
                                                        className="bg-transparent outline-none cursor-pointer"
                                                    >
                                                        {Object.keys(PIPE_CATALOG[t.material]?.specs[t.DN] || {}).map(pn => <option key={pn} value={pn}>{pn}</option>)}
                                                    </select>
                                                </div>
                                            ) : (
                                                <div className="flex gap-1">
                                                    <input 
                                                        type="number" 
                                                        placeholder="Ø int" 
                                                        value={t.D === '' ? '' : t.D} 
                                                        onChange={e => updateTratto(t.id, 'D', e.target.value === '' ? '' : Number(e.target.value))} 
                                                        className="w-10 bg-transparent border-b border-slate-300 outline-none text-[10px]" 
                                                    />
                                                    <input 
                                                        type="number" 
                                                        placeholder="scabr" 
                                                        step="0.01" 
                                                        value={t.roughness === '' ? '' : t.roughness} 
                                                        onChange={e => updateTratto(t.id, 'roughness', e.target.value === '' ? '' : Number(e.target.value))} 
                                                        className="w-10 bg-transparent border-b border-slate-300 outline-none text-[10px]" 
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    {/* Lunghezza */}
                                    <td className="py-2 px-2 print:p-1">
                                        <span className="hidden print:inline font-bold font-mono text-xs">{t.length} <span className="text-[9px] text-slate-400 font-sans font-normal">m</span></span>
                                        <div className="print:hidden flex items-center gap-1">
                                            <input 
                                                type="number" 
                                                value={t.length === '' ? '' : t.length} 
                                                onChange={e => updateTratto(t.id, 'length', e.target.value === '' ? '' : Number(e.target.value))} 
                                                className="w-10 bg-transparent border-b border-slate-300 focus:border-brand-500 outline-none font-bold" 
                                            />
                                            <span className="text-[9px] text-slate-400">m</span>
                                        </div>
                                    </td>

                                    {/* Pezzi Speciali */}
                                    <td className="py-2 px-2 print:p-1 space-y-1 text-[10px]">
                                        <div className="hidden print:block font-mono leading-tight">
                                            { (t.n_valvole > 0 || t.n_riduzioni > 0 || t.n_curve > 0 || t.n_tee > 0) ? (
                                                <div className="grid grid-cols-2 gap-x-2 text-[8px]">
                                                    {t.n_valvole > 0 && <span>Valv: {t.n_valvole}</span>}
                                                    {t.n_riduzioni > 0 && <span>Rid: {t.n_riduzioni}</span>}
                                                    {t.n_curve > 0 && <span>Curv: {t.n_curve}</span>}
                                                    {t.n_tee > 0 && <span>Tee: {t.n_tee}</span>}
                                                </div>
                                            ) : <span className="text-slate-400">-</span> }
                                        </div>
                                        <div className="print:hidden grid grid-cols-2 gap-x-2 gap-y-1">
                                            <div className="flex items-center gap-1">
                                                <span className="text-slate-400 text-[10px]">Valv:</span>
                                                <input type="number" value={t.n_valvole === '' ? '' : t.n_valvole} onChange={e => updateTratto(t.id, 'n_valvole', e.target.value === '' ? '' : Number(e.target.value))} className="w-8 h-5 text-center bg-slate-50 border border-slate-300 rounded text-[10px] focus:border-brand-500 focus:outline-none" />
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-slate-400 text-[10px]">Rid:</span>
                                                <input type="number" value={t.n_riduzioni === '' ? '' : t.n_riduzioni} onChange={e => updateTratto(t.id, 'n_riduzioni', e.target.value === '' ? '' : Number(e.target.value))} className="w-8 h-5 text-center bg-slate-50 border border-slate-300 rounded text-[10px] focus:border-brand-500 focus:outline-none" />
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-slate-400 text-[10px]">Curv:</span>
                                                <input type="number" value={t.n_curve === '' ? '' : t.n_curve} onChange={e => updateTratto(t.id, 'n_curve', e.target.value === '' ? '' : Number(e.target.value))} className="w-8 h-5 text-center bg-slate-50 border border-slate-300 rounded text-[10px] focus:border-brand-500 focus:outline-none" />
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-slate-400 text-[10px]">Tee:</span>
                                                <input type="number" value={t.n_tee === '' ? '' : t.n_tee} onChange={e => updateTratto(t.id, 'n_tee', e.target.value === '' ? '' : Number(e.target.value))} className="w-8 h-5 text-center bg-slate-50 border border-slate-300 rounded text-[10px] focus:border-brand-500 focus:outline-none" />
                                            </div>
                                        </div>
                                        {t.leq_tot > 0 && (
                                            <div className="text-[8px] text-brand-600 font-bold">
                                              L_eq = +{t.leq_tot.toFixed(1)} m
                                            </div>
                                        )}
                                    </td>

                                    {/* Velocità */}
                                    <td className="py-2 px-2 print:p-1 font-mono text-[11px] font-bold">
                                        {t.velocity.toFixed(2)} m/s
                                    </td>

                                    {/* Reynolds e Lambda */}
                                    <td className="py-2 px-2 print:p-1 font-mono text-[10px] space-y-0.5">
                                        <div>Re: {Math.round(t.Re).toLocaleString()}</div>
                                        <div className="font-bold text-brand-600">λ: {t.lambda.toFixed(4)}</div>
                                    </td>

                                    {/* Perdite Distrib. */}
                                    <td className="py-2 px-2 print:p-1 font-mono text-right text-slate-500">
                                        {Math.round(t.loss_dist_Pa).toLocaleString()}
                                    </td>

                                    {/* Perdite Conc. */}
                                    <td className="py-2 px-2 print:p-1 font-mono text-right text-slate-500">
                                        {Math.round(t.loss_conc_Pa).toLocaleString()}
                                    </td>

                                    {/* Perdite Totali (mbar) */}
                                    <td className="py-2 px-2 print:p-1 font-mono text-right font-black text-slate-800 text-[11px]">
                                        {t.loss_tot_mbar.toFixed(1)}
                                    </td>

                                    {/* Perdite Totali (m.c.a.) */}
                                    <td className="py-2 px-2 print:p-1 font-mono text-right font-bold text-brand-600">
                                        {t.loss_tot_mH2O.toFixed(3)}
                                    </td>

                                    {/* Azioni */}
                                    <td className="py-2 px-2 print:hidden" onClick={e => e.stopPropagation()}>
                                        <div className="flex gap-0.5">
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
            {/* Sezione Dettagli Termici e Topologia (2 Colonne sotto la tabella) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 print:hidden">
                {/* Dettagli Termici di Tutti i Tratti */}
                <div className="space-y-6">
                    <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2 flex items-center justify-between">
                        <span>🌡️ Dettagli Termici dei Tratti</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono font-bold">
                            {processedTratti.length} {processedTratti.length === 1 ? 'Tratto' : 'Tratti'}
                        </span>
                    </h3>

                    {processedTratti.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 italic text-xs">
                            Aggiungi dei tratti nella tabella sopra per configurare l'isolamento e visualizzare i dettagli termici.
                        </div>
                    ) : (
                        processedTratti.map((t) => (
                            <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                                <h4 className="text-xs font-bold text-slate-800 mb-3 border-b border-slate-200 pb-2 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                                        Tratto: <span className="font-mono text-brand-650 font-black">{t.tag}</span>
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-normal truncate max-w-[200px]">
                                        {t.name}
                                    </span>
                                </h4>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <div>
                                            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200/60 font-mono">
                                                <div>Ø Int: {t.d_int?.toFixed(1)} mm</div>
                                                <div>Ø Est: {t.d_ext?.toFixed(1)} mm</div>
                                                <div className="col-span-2 text-red-650 font-bold">T. Superficie Esterna: {t.t_surf?.toFixed(1)} °C</div>
                                            </div>
                                        </div>

                                        <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo Isolamento</label>
                                                <select 
                                                    value={t.isoType} 
                                                    onChange={e => updateTratto(t.id, 'isoType', e.target.value)} 
                                                    className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-medium focus:border-brand-500 cursor-pointer"
                                                >
                                                    {INSULATION_CATALOG.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                                </select>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Spessore (mm)</label>
                                                    <input 
                                                        type="number" 
                                                        min="0"
                                                        value={t.isoThick === '' ? '' : t.isoThick} 
                                                        onChange={e => updateTratto(t.id, 'isoThick', e.target.value === '' ? '' : Number(e.target.value))} 
                                                        className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-bold text-slate-800 focus:border-brand-500 focus:outline-none" 
                                                        disabled={t.isoType === 'none'}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">T. Amb. Tratto (°C)</label>
                                                    <input 
                                                        type="number" 
                                                        value={t.tAmb === '' ? '' : t.tAmb} 
                                                        onChange={e => updateTratto(t.id, 'tAmb', e.target.value === '' ? '' : Number(e.target.value))} 
                                                        className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-bold text-slate-800 focus:border-brand-500 focus:outline-none" 
                                                    />
                                                </div>
                                            </div>

                                            {/* Configurazione schema ad albero / topologia accorpata */}
                                            <div className="border-t border-slate-200 pt-3 mt-3 grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Gerarchia</label>
                                                    <select 
                                                        value={t.hierarchy || 'dorsale_principale'} 
                                                        onChange={e => updateTratto(t.id, 'hierarchy', e.target.value)} 
                                                        className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-medium focus:border-brand-500 cursor-pointer"
                                                    >
                                                        <option value="dorsale_principale">Dorsale Principale</option>
                                                        <option value="dorsale_secondaria">Dorsale Secondaria</option>
                                                        <option value="dorsale_terziaria">Dorsale Terziaria</option>
                                                        <option value="utenza">Utenza Finale</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Diramato Da</label>
                                                    <select 
                                                        value={t.parentId || ''} 
                                                        onChange={e => updateTratto(t.id, 'parentId', e.target.value)} 
                                                        className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-medium focus:border-brand-500 cursor-pointer"
                                                    >
                                                        <option value="">Nessuno (Radice)</option>
                                                        {tratti.filter(x => x.id !== t.id).map(x => (
                                                            <option key={x.id} value={x.tag}>[{x.tag}] {x.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 flex flex-col justify-center">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase text-center mb-1">Geometria e Profilo Termico Sovrapposti</p>
                                        <SVGGradienteSovrapposto tratto={t} fluidTemp={fluidTemp} />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Rappresentazione Topologica della Rete (Albero di Distribuzione) */}
                <div className="lg:sticky lg:top-4 h-fit">
                    <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-200 flex flex-col">
                        <h3 className="text-sm font-bold text-slate-700 mb-3 border-b border-slate-100 pb-2">
                            Rappresentazione Topologica della Rete (Albero di Distribuzione)
                        </h3>
                        <div className="flex-1 flex items-center justify-center min-h-[200px]">
                            <TopologicalTree tratti={processedTratti} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Pannello Riepilogo Perdite Totali */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 print:grid-cols-3 print:gap-2 print:mb-4">
                <div className="bg-slate-800 text-white p-4 rounded-xl text-center shadow-md print:shadow-none print:border print:border-slate-200 print:text-slate-800 print:bg-slate-50 print:p-2">
                    <p className="text-xs text-slate-300 uppercase font-bold tracking-wide print:text-slate-500 print:text-[8px]">Perdite di Carico Totali (Pa)</p>
                    <p className="text-3xl font-mono font-black text-brand-400 print:text-slate-900 print:text-base">{Math.round(totalLossPa).toLocaleString()} <span className="text-sm font-sans font-normal text-white print:text-slate-900 print:text-xs">Pa</span></p>
                </div>
                <div className="bg-slate-800 text-white p-4 rounded-xl text-center shadow-md print:shadow-none print:border print:border-slate-200 print:text-slate-800 print:bg-slate-50 print:p-2">
                    <p className="text-xs text-slate-300 uppercase font-bold tracking-wide print:text-slate-500 print:text-[8px]">Perdite di Carico Totali (mbar)</p>
                    <p className="text-3xl font-mono font-black text-brand-400 print:text-slate-900 print:text-base">{totalLossMbar.toFixed(1)} <span className="text-sm font-sans font-normal text-white print:text-slate-900 print:text-xs">mbar</span></p>
                </div>
                <div className="bg-slate-800 text-white p-4 rounded-xl text-center shadow-md print:shadow-none print:border print:border-slate-200 print:text-slate-800 print:bg-slate-50 print:p-2">
                    <p className="text-xs text-slate-300 uppercase font-bold tracking-wide print:text-slate-500 print:text-[8px]">Perdite di Carico Totali (m.c.a.)</p>
                    <p className="text-3xl font-mono font-black text-brand-400 print:text-slate-900 print:text-base">{totalLossMH2O.toFixed(3)} <span className="text-sm font-sans font-normal text-white print:text-slate-900 print:text-xs">m H2O</span></p>
                </div>
            </div>

            {/* Sezione Stampa: Albero e Dettagli Termici di Tutti i Tratti */}
            <div className="hidden print:block mt-6">
                {/* Albero Topologico - Centrato e Visibile nella prima pagina */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 mb-6 break-inside-avoid print:max-w-xl print:mx-auto">
                    <h3 className="text-[10px] font-bold text-slate-800 mb-2 border-b-2 border-slate-800 pb-1 uppercase tracking-wide">
                        Topologia Rete (Albero di Distribuzione)
                    </h3>
                    <div className="w-full flex items-center justify-center p-2 print:max-h-[170px] overflow-hidden">
                        <TopologicalTree tratti={processedTratti} />
                    </div>
                </div>

                {/* Pagina successiva per i dettagli termici di ciascun tratto */}
                <div style={{ breakBefore: 'page' }}></div>

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
                                    <p><strong>Geometria:</strong> Øi {t.d_int?.toFixed(1)} mm | Øe {t.d_ext?.toFixed(1)} mm</p>
                                    <p><strong>Isolamento:</strong> {INSULATION_CATALOG.find(i => i.id === t.isoType)?.name || 'Nessuno'} ({t.isoThick} mm)</p>
                                    <p><strong>Conduttività Termica (&lambda;):</strong> {t.isoLambda} W/mK</p>
                                    <p><strong>Dati Fluido:</strong> Portata {t.portata} m³/h | Velocità {t.velocity?.toFixed(2)} m/s</p>
                                    <p><strong>Temperature:</strong> Fluido {fluidTemp} °C | Ambiente {t.tAmb} °C</p>
                                    <p className="text-red-700 font-bold text-[9px]">Temp. Sup. Esterna: {t.t_surf?.toFixed(1)} °C</p>
                                </div>
                            </div>
                            <div className="w-[180px] mx-auto mt-2 shrink-0">
                                <SVGGradienteSovrapposto tratto={t} fluidTemp={fluidTemp} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
