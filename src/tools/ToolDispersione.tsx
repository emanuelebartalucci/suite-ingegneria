import React, { useState, useMemo } from 'react';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import { formatNumber } from '../utils/format';
import { 
  PIPE_CATALOG, 
  INSULATION_CATALOG, 
  getExternalDiameter 
} from '../data/pipeCatalog';
import { 
  IconThermometer, 
  IconCopy, 
  IconTrash, 
  IconPlus 
} from '../components/Icons';

interface ToolDispersioneProps {
  projectData: ProjectData;
  setProjectData: (data: any) => void;
  setAppMode: (mode: string) => void;
}

interface SVGGradienteSovrappostoProps {
  line: any;
  tFluidGlobal: number | '';
  tAmbGlobal: number | '';
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

function SVGGradienteSovrapposto({ line, tFluidGlobal, tAmbGlobal }: SVGGradienteSovrappostoProps) {
    if (!line || !line.d_int_mm) return null;

    const ri = line.d_int_mm / 2; // Raggio interno in mm
    const re = line.d_ext_mm / 2; // Raggio esterno in mm
    const s_iso = Number(line.isoThick) || 0;
    const riso = re + s_iso; // Raggio complessivo isolato in mm

    const tf = Number(tFluidGlobal) || 55;
    const ta = Number(tAmbGlobal) || 20;
    const t_int_tubo = line.t_pipe_int !== undefined ? line.t_pipe_int : tf;
    const t_ext_tubo = line.t_pipe_ext !== undefined ? line.t_pipe_ext : tf;
    const t_s = line.t_surf !== undefined ? line.t_surf : tf;

    // Raggio massimo da mostrare sull'asse X (estendiamo oltre l'isolamento per mostrare l'aria ambiente)
    // 1.35 * riso permette di visualizzare il gradiente convettivo nell'aria circostante
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

    const isNoneIso = line.isoType === 'none';

    // Colore di riempimento dell'isolante
    let isoColor = "rgba(226, 232, 240, 0.25)"; // Grigio default
    if (line.isoType === 'pur') isoColor = "rgba(254, 240, 138, 0.4)"; // Giallo PUR
    if (line.isoType === 'rockwool') isoColor = "rgba(253, 224, 71, 0.35)"; // Lana di roccia
    if (line.isoType === 'rubber') isoColor = "rgba(51, 65, 85, 0.25)"; // Gomma nera

    // --- RISOLUTORE SOVRAPPOSIZIONI TESTI ---
    
    // Algoritmo di distanziamento per l'asse Y
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

    // Algoritmo di distanziamento per l'asse X
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
    const r_start_conv = ri * 0.75; // la convezione inizia al 75% del raggio
    
    for (let i = 0; i <= numFluidPoints; i++) {
        const r = (r_start_conv * i) / numFluidPoints;
        fluidPoints.push(`${getX(r)},${getY(tf)}`);
    }
    
    // Curva convettiva nel fluido (da r_start_conv a ri)
    const numConvPoints = 5;
    for (let i = 1; i <= numConvPoints; i++) {
        const fraction = i / numConvPoints;
        const r = r_start_conv + fraction * (ri - r_start_conv);
        // Interpolazione cubica per uno scivolamento morbido
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

    // 4. ZONA ARIA ESTERNA (convezione esterna, decadimento esponenziale verso tAmb da riso a R_max)
    const airPoints: string[] = [];
    const numAirPoints = 15;
    const rStartAir = riso;
    const rEndAir = R_max;
    for (let i = 0; i <= numAirPoints; i++) {
        const fraction = i / numAirPoints;
        const r = rStartAir + fraction * (rEndAir - rStartAir);
        // Decadimento esponenziale: T(r) = ta + (t_s - ta) * Math.exp(-3 * fraction)
        const temp = ta + (t_s - ta) * Math.exp(-3 * fraction);
        airPoints.push(`${getX(r)},${getY(temp)}`);
    }
    const airPath = `M ${airPoints.join(' L ')}`;

    return (
        <div className="space-y-3 print:space-y-2">
            <svg width="100%" height="180" viewBox="0 0 300 180" className="mx-auto select-none font-sans bg-slate-900/5 border border-slate-200 rounded-xl p-2 print:h-auto print:bg-transparent print:border-none print:p-0">
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
                        fill={line.material === 'Acciaio' ? 'rgba(148, 163, 184, 0.4)' : 'rgba(71, 85, 105, 0.4)'} 
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

                {/* 2. GRIGLIA E ASSI CARTESIANI */}
                <line x1={originX} y1={originY} x2={originX + graphWidth} y2={originY} stroke="#94a3b8" strokeWidth="1.5" />
                <line x1={originX} y1={originY - graphHeight} x2={originX} y2={originY} stroke="#94a3b8" strokeWidth="1.5" />

                {/* Ticks e etichette dell'asse Y (Temperatura) regolati contro la sovrapposizione */}
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

                {/* Linee verticali tratteggiate di divisione geometrica ed etichette X regolate contro la sovrapposizione */}
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

                {/* Asse X (Raggio) */}
                <text x={originX + graphWidth} y={originY + 10} textAnchor="end" fill="#64748b" fontSize="7">Raggio r</text>

                {/* 3. TRACCIATO DELLA CURVA DEL GRADIENTE TERMICO SOVRAPPOSTO */}
                
                {/* Fluido interno (con caduta convettiva vicino alla parete interna) */}
                <path d={`M ${fluidPoints.join(' L ')}`} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />

                {/* Parete metallica del tubo */}
                <path d={wallPath} fill="none" stroke="#475569" strokeWidth="2.5" />

                {/* Isolante (caduta logaritmica) */}
                {!isNoneIso && s_iso > 0 ? (
                    <path d={isoPath} fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
                ) : null}

                {/* Convezione aria esterna (decadimento esponenziale verso T_amb) */}
                <path d={airPath} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2,2" strokeLinecap="round" />

                {/* Punti evidenziati sui raccordi geometrici */}
                <circle cx={getX(ri)} cy={getY(t_int_tubo)} r="2" fill="#2563eb" />
                <circle cx={getX(re)} cy={getY(t_ext_tubo)} r="2" fill={(!isNoneIso && s_iso > 0) ? "#475569" : "#b91c1c"} />
                {!isNoneIso && s_iso > 0 && (
                    <circle cx={getX(riso)} cy={getY(t_s)} r="2.5" fill="#b91c1c" />
                )}
                
                {/* Etichetta per l'aria circostante */}
                <text x={getX((riso + R_max) / 2)} y={getY(ta) - 4} textAnchor="middle" fill="#94a3b8" fontSize="7" className="italic">Aria ambiente</text>
            </svg>

            {/* Legenda orizzontale del profilo termico */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[10px] text-slate-600 font-semibold px-2 print:justify-start print:px-0">
                <div className="flex items-center space-x-1 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#2563eb' }}></span>
                    <span>Fluido ({formatNumber(tf, 0)}°C)</span>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#475569' }}></span>
                    <span>Parete ({line.material})</span>
                </div>
                {!isNoneIso && s_iso > 0 && (
                    <div className="flex items-center space-x-1 shrink-0">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#d97706' }}></span>
                        <span>Isolante ({line.isoType === 'pur' ? 'PUR' : line.isoType === 'rockwool' ? 'Lana' : 'Gomma'})</span>
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

interface DispersioneLine {
  id: number;
  name: string;
  length: number | string;
  material: string;
  DN: string;
  PN: string;
  isoType: string;
  isoLambda: number | string;
  isoThick: number | string;
  calcQ_Wm?: number;
  calcQ_tot_kW?: number;
  t_surf?: number;
  t_pipe_ext?: number;
  t_pipe_int?: number;
  d_int_mm?: number;
  d_ext_mm?: number;
  d_iso_mm?: number;
}

export function ToolDispersione({ projectData, setProjectData, setAppMode }: ToolDispersioneProps) {
    const [tAmbGlobal, setTAmbGlobal] = useState<number | ''>(-5); // °C
    const [tFluidGlobal, setTFluidGlobal] = useState<number | ''>(55); // °C
    const [alphaInt, setAlphaInt] = useState<number | ''>(1163); // W/m2K
    const [alphaExt, setAlphaExt] = useState<number | ''>(7.4); // W/m2K
    const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
    const [selectedLineId, setSelectedLineId] = useState<number | null>(null);

    const [lines, setLines] = useState<DispersioneLine[]>([]);

    const processedLines = useMemo(() => {
        return lines.map(line => {
            let calcQ_Wm = 0;
            let t_surf = 0;
            let t_pipe_ext = 0; // Temp sulla superficie esterna del tubo (sotto l'isolamento)
            let t_pipe_int = 0; // Temp sulla superficie interna del tubo
            let d_ext_m = 0;
            let d_int_m = 0;
            let d_iso_m = 0;

            const tFluid = Number(tFluidGlobal) || 0;
            const tAmb = Number(tAmbGlobal) || 0;

            // Validazione base
            if (line.material && line.DN && line.PN && PIPE_CATALOG[line.material] && PIPE_CATALOG[line.material].specs[line.DN]) {
                const d_int_mm = PIPE_CATALOG[line.material].specs[line.DN][line.PN];
                if (d_int_mm) {
                    d_int_m = d_int_mm / 1000;
                    d_ext_m = getExternalDiameter(line.material, line.DN, d_int_mm) / 1000;
                    
                    const lambda_pipe = PIPE_CATALOG[line.material].lambda;
                    const lambda_iso = Number(line.isoLambda) || 0.035;
                    const s_m = (Number(line.isoThick) || 0) / 1000;
                    d_iso_m = d_ext_m + 2 * s_m;

                    // Calcolo Resistenze Termiche [m·K/W]
                    const R_int = 1 / ((Number(alphaInt) || 1163) * d_int_m);
                    const R_pipe = Math.log(d_ext_m / d_int_m) / (2 * lambda_pipe);
                    let R_iso = 0;
                    if (s_m > 0 && lambda_iso > 0) {
                        R_iso = Math.log(d_iso_m / d_ext_m) / (2 * lambda_iso);
                    }
                    const R_ext = 1 / ((Number(alphaExt) || 7.4) * d_iso_m);

                    const R_tot = R_int + R_pipe + R_iso + R_ext;
                    const deltaT = Math.abs(tFluid - tAmb);
                    
                    // Dispersione W/m = (PI * deltaT) / R_tot
                    calcQ_Wm = (Math.PI * deltaT) / R_tot;
                    
                    // Temp superficie interna ed esterna del tubo e dell'isolante
                    if (tFluid > tAmb) {
                        t_pipe_int = tFluid - (calcQ_Wm / Math.PI) * R_int;
                        t_pipe_ext = tFluid - (calcQ_Wm / Math.PI) * (R_int + R_pipe);
                        t_surf = tAmb + calcQ_Wm / (Math.PI * (Number(alphaExt) || 7.4) * d_iso_m);
                    } else {
                        t_pipe_int = tFluid + (calcQ_Wm / Math.PI) * R_int;
                        t_pipe_ext = tFluid + (calcQ_Wm / Math.PI) * (R_int + R_pipe);
                        t_surf = tAmb - calcQ_Wm / (Math.PI * (Number(alphaExt) || 7.4) * d_iso_m); // Se l'acqua è refrigerata
                    }
                }
            }

            const calcQ_tot_kW = (calcQ_Wm * (Number(line.length) || 0)) / 1000;

            return { 
                ...line, 
                calcQ_Wm, 
                calcQ_tot_kW, 
                t_surf, 
                t_pipe_ext, 
                t_pipe_int,
                d_int_mm: d_int_m * 1000,
                d_ext_mm: d_ext_m * 1000, 
                d_iso_mm: d_iso_m * 1000
            };
        });
    }, [lines, tAmbGlobal, tFluidGlobal, alphaInt, alphaExt]);

    const addLine = () => {
        const newId = lines.length > 0 ? Math.max(...lines.map(l => l.id)) + 1 : 1;
        const newLines = [...lines, { id: newId, name: `Tratto ${newId}`, length: '', material: 'Acciaio', DN: '100', PN: 'NORM', isoType: 'pur', isoLambda: 0.025, isoThick: 60 }];
        setLines(newLines);
        setSelectedLineId(newId);
    };

    const duplicateLine = (id: number) => {
        const lineToCopy = lines.find(l => l.id === id);
        if (!lineToCopy) return;
        const newId = lines.length > 0 ? Math.max(...lines.map(l => l.id)) + 1 : 1;
        setLines([...lines, { ...lineToCopy, id: newId, name: lineToCopy.name + " (Copia)" }]);
        setSelectedLineId(newId);
    };

    const updateLine = (id: number, field: keyof DispersioneLine, val: any) => {
        setLines(prev => prev.map(l => {
            if (l.id === id) {
                let updated = { ...l, [field]: val } as DispersioneLine;
                
                if (field === 'material') {
                    const firstDN = Object.keys(PIPE_CATALOG[val].specs)[0];
                    const firstPN = Object.keys(PIPE_CATALOG[val].specs[firstDN])[0];
                    updated.DN = firstDN; updated.PN = firstPN;
                } 
                else if (field === 'DN') {
                    let currentPN = updated.PN;
                    if (!PIPE_CATALOG[updated.material].specs[val][currentPN]) {
                        currentPN = Object.keys(PIPE_CATALOG[updated.material].specs[val])[0];
                    }
                    updated.PN = currentPN;
                }
                else if (field === 'isoType') {
                    const isoDef = INSULATION_CATALOG.find(i => i.id === val);
                    if (isoDef) updated.isoLambda = isoDef.lambda;
                }
                return updated;
            }
            return l;
        }));
    };

    const removeLine = (id: number) => {
        setLines(lines.filter(l => l.id !== id));
        if (selectedLineId === id) setSelectedLineId(null);
    };

    const totalLossKW = processedLines.reduce((sum, l) => sum + (l.calcQ_tot_kW || 0), 0);

    const activeLine = processedLines.find(l => l.id === selectedLineId) || processedLines[0];

    const handleLoadCloudProject = (data: any) => {
        if (!data) return;
        if (data.tAmbGlobal !== undefined) setTAmbGlobal(data.tAmbGlobal);
        if (data.tFluidGlobal !== undefined) setTFluidGlobal(data.tFluidGlobal);
        if (data.alphaInt !== undefined) setAlphaInt(data.alphaInt);
        if (data.alphaExt !== undefined) setAlphaExt(data.alphaExt);
        if (data.lines) setLines(data.lines);
        if (data.lines && data.lines.length > 0) setSelectedLineId(data.lines[0].id);
    };

    const getCloudSaveData = () => {
        return {
            tAmbGlobal,
            tFluidGlobal,
            alphaInt,
            alphaExt,
            lines
        };
    };

    return (
        <div className="max-w-6xl mx-auto animate-fade-in">
            <ProjectHeader pData={projectData} setPData={setProjectData} title="Dispersione Tubazioni" setAppMode={setAppMode} iconColor="redbrand" />
            
            <ProjectStorage 
                toolType="dispersione"
                currentData={getCloudSaveData()}
                onLoadProject={handleLoadCloudProject}
                projectInfo={projectData}
                setProjectInfo={setProjectData}
            />

            {/* Spiegazione & Formula */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 text-xs text-slate-650 space-y-2.5 print:hidden">
              <p>
                <strong>Descrizione:</strong> Calcola le dispersioni termiche lineari totali e al metro per tubazioni coibentate o nude, determinando il gradiente di temperatura radiale radice-fluido-parete-isolante-aria e stimando la temperatura sulla superficie esterna del coibente.
              </p>
              <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-slate-600">
                <p className="font-bold text-slate-700 mb-2.5 text-[11px] uppercase tracking-wide">Formule applicate per lo scambio termico radiale:</p>
                <div className="space-y-4 pl-2 text-xs">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span>• Trasmittanza Termica Lineare (U):</span>
                    <span className="font-serif font-bold text-slate-800 flex items-center">
                      U = 
                      <span className="inline-flex flex-col items-center align-middle mx-1.5 text-center text-[10px] leading-tight">
                        <span className="border-b border-slate-400 px-1 pb-0.5">1</span>
                        <span className="px-1 pt-0.5">
                          <span className="inline-flex flex-col items-center align-middle text-[9px] leading-none">
                            <span className="border-b border-slate-400 px-0.5">1</span>
                            <span className="px-0.5">π × d<sub>int</sub> × α₁</span>
                          </span>
                          +
                          <span className="inline-flex flex-col items-center align-middle text-[9px] leading-none mx-1">
                            <span className="border-b border-slate-400 px-0.5">ln(d<sub>ext</sub>/d<sub>int</sub>)</span>
                            <span className="px-0.5">2π × λ<sub>tubo</sub></span>
                          </span>
                          +
                          <span className="inline-flex flex-col items-center align-middle text-[9px] leading-none">
                            <span className="border-b border-slate-400 px-0.5">ln(d<sub>iso</sub>/d<sub>ext</sub>)</span>
                            <span className="px-0.5">2π × λ<sub>iso</sub></span>
                          </span>
                          +
                          <span className="inline-flex flex-col items-center align-middle text-[9px] leading-none ml-1">
                            <span className="border-b border-slate-400 px-0.5">1</span>
                            <span className="px-0.5">π × d<sub>iso</sub> × α₂</span>
                          </span>
                        </span>
                      </span>
                      <span className="text-[11px] text-slate-500 font-sans font-normal ml-1"> [W/mK]</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span>• Flusso Termico Disperso al metro (q):</span>
                    <span className="font-serif font-bold text-slate-800">
                      q = U × (T<sub>fluido</sub> - T<sub>ambiente</sub>) &nbsp; [W/m]
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span>• Temperatura Superficiale Esterna (T_surf):</span>
                    <span className="font-serif font-bold text-slate-800 flex items-center">
                      T<sub>surf</sub> = T<sub>ambiente</sub> + 
                      <span className="inline-flex flex-col items-center align-middle mx-1.5 text-center text-[10px]">
                        <span className="border-b border-slate-400 px-1 pb-0.5">q</span>
                        <span className="px-1 pt-0.5">π × d<sub>iso</sub> × α₂</span>
                      </span>
                      <span className="text-[11px] text-slate-500 font-sans font-normal ml-1"> [°C]</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 mb-6 print:shadow-none print:border-none print:p-0">
                <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2 print:border-slate-800">
                    <h3 className="text-sm font-bold text-slate-700">Temperature e Fattori Ambientali</h3>
                    <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-redbrand-600 font-bold hover:underline print:hidden">
                        {showAdvanced ? 'Nascondi Avanzate' : 'Mostra Avanzate (α)'}
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:gap-2">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Temp. Fluido Interno (°C)</label>
                        <input 
                            type="number" 
                            value={tFluidGlobal === '' ? '' : tFluidGlobal} 
                            onChange={e => setTFluidGlobal(e.target.value === '' ? '' : Number(e.target.value))} 
                            className="w-full bg-slate-50 text-sm font-semibold text-slate-800 p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-redbrand-500" 
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Temp. Ambiente Esterno (°C)</label>
                        <input 
                            type="number" 
                            value={tAmbGlobal === '' ? '' : tAmbGlobal} 
                            onChange={e => setTAmbGlobal(e.target.value === '' ? '' : Number(e.target.value))} 
                            className="w-full bg-slate-50 text-sm font-semibold text-slate-800 p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-redbrand-500" 
                        />
                    </div>
                    {showAdvanced && (
                        <>
                            <div className="bg-orange-50/50 p-2 rounded-lg border border-orange-200 print:hidden">
                                <label className="block text-[9px] font-bold text-orange-600 uppercase mb-1">Adduttanza Interna (α₁) [W/m²K]</label>
                                <input 
                                    type="number" 
                                    value={alphaInt === '' ? '' : alphaInt} 
                                    onChange={e => setAlphaInt(e.target.value === '' ? '' : Number(e.target.value))} 
                                    className="w-full bg-transparent text-sm font-semibold text-slate-800 focus:outline-none border-b border-orange-300 focus:border-orange-500" 
                                />
                            </div>
                            <div className="bg-orange-50/50 p-2 rounded-lg border border-orange-200 print:hidden">
                                <label className="block text-[9px] font-bold text-orange-600 uppercase mb-1">Adduttanza Esterna (α₂) [W/m²K]</label>
                                <input 
                                    type="number" 
                                    step="0.1" 
                                    value={alphaExt === '' ? '' : alphaExt} 
                                    onChange={e => setAlphaExt(e.target.value === '' ? '' : Number(e.target.value))} 
                                    className="w-full bg-transparent text-sm font-semibold text-slate-800 focus:outline-none border-b border-orange-300 focus:border-orange-500" 
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="space-y-4 print:hidden mb-6">
                <div className="flex justify-between items-center bg-slate-800 text-white p-3 rounded-xl shadow-sm">
                    <h2 className="font-semibold text-sm flex items-center"><IconThermometer className="w-4 h-4 mr-2"/> Tratti di Rete Analizzati</h2>
                </div>
                {processedLines.length === 0 && <div className="bg-white p-8 rounded-xl border-2 border-dashed border-slate-300 text-center text-slate-500 text-sm">Nessun tratto presente. Clicca su Aggiungi Tratto.</div>}
                
                {processedLines.map((line) => (
                    <div 
                        key={line.id} 
                        onClick={() => setSelectedLineId(line.id)}
                        className={`bg-white rounded-2xl shadow-sm border p-5 transition-all cursor-pointer ${selectedLineId === line.id ? 'border-redbrand-500 ring-2 ring-redbrand-500/10 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                        <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-2">
                            <div className="flex items-center space-x-2 w-full">
                                <span className="text-redbrand-600">🌡️</span>
                                <input 
                                    type="text" 
                                    value={line.name} 
                                    onChange={e => updateLine(line.id, 'name', e.target.value)} 
                                    className="font-bold text-slate-800 bg-transparent outline-none w-full border-b border-transparent hover:border-slate-300 focus:border-redbrand-500" 
                                    placeholder="Nome Tratto" 
                                    onClick={e => e.stopPropagation()}
                                />
                            </div>
                            <div className="flex ml-2 shrink-0" onClick={e => e.stopPropagation()}>
                                <button onClick={(e)=>{ e.stopPropagation(); duplicateLine(line.id); }} className="p-1 text-slate-400 hover:bg-slate-100 hover:text-redbrand-600 rounded mr-1 cursor-pointer" title="Duplica"><IconCopy className="w-4 h-4"/></button>
                                <button onClick={(e)=>{ e.stopPropagation(); removeLine(line.id); }} className="p-1 text-red-400 hover:bg-red-500 hover:text-white rounded cursor-pointer" title="Elimina"><IconTrash className="w-4 h-4"/></button>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6" onClick={e => e.stopPropagation()}>
                            <div className="md:col-span-3 space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Materiale Tubo</label>
                                        <select 
                                            value={line.material} 
                                            onChange={e => updateLine(line.id, 'material', e.target.value)} 
                                            className="w-full text-xs p-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:border-redbrand-500 cursor-pointer"
                                        >
                                            {Object.keys(PIPE_CATALOG).map(m=><option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">DN</label>
                                        <select 
                                            value={line.DN} 
                                            onChange={e => updateLine(line.id, 'DN', e.target.value)} 
                                            className="w-full text-xs p-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 cursor-pointer"
                                        >
                                            {Object.keys(PIPE_CATALOG[line.material]?.specs || {}).map(dn=><option key={dn} value={dn}>{dn}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Classe</label>
                                        <select 
                                            value={line.PN} 
                                            onChange={e => updateLine(line.id, 'PN', e.target.value)} 
                                            className="w-full text-xs p-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 cursor-pointer"
                                        >
                                            {Object.keys(PIPE_CATALOG[line.material]?.specs[line.DN] || {}).map(pn=><option key={pn} value={pn}>{pn}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Tipo Isolante</label>
                                        <select 
                                            value={line.isoType} 
                                            onChange={e => updateLine(line.id, 'isoType', e.target.value)} 
                                            className="w-full text-xs p-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:border-redbrand-500 cursor-pointer"
                                        >
                                            {INSULATION_CATALOG.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Spessore (mm)</label>
                                        <input 
                                            type="number" 
                                            value={line.isoThick === '' ? '' : line.isoThick} 
                                            onChange={e => updateLine(line.id, 'isoThick', e.target.value === '' ? '' : Number(e.target.value))} 
                                            className="w-full text-xs p-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:border-redbrand-500 font-bold" 
                                            disabled={line.isoType==='none'}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Lunghezza (m)</label>
                                        <input 
                                            type="number" 
                                            value={line.length === '' ? '' : line.length} 
                                            onChange={e => updateLine(line.id, 'length', e.target.value === '' ? '' : Number(e.target.value))} 
                                            className="w-full text-xs p-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:border-redbrand-500 font-bold" 
                                        />
                                    </div>
                                </div>

                                <div className="bg-redbrand-50/45 border border-redbrand-100 p-3 rounded-xl flex justify-between items-center text-xs">
                                    <div>
                                        <p className="text-[8px] font-bold text-redbrand-600 uppercase">Q unitario</p>
                                        <p className="font-mono font-black text-xs text-redbrand-800">{formatNumber(line.calcQ_Wm || 0, 2)} W/m</p>
                                    </div>
                                    <div className="w-px h-6 bg-redbrand-200"></div>
                                    <div>
                                        <p className="text-[8px] font-bold text-redbrand-600 uppercase">Q totale</p>
                                        <p className="font-mono font-black text-xs text-redbrand-800">{formatNumber(line.calcQ_tot_kW || 0, 3)} kW</p>
                                    </div>
                                    <div className="w-px h-6 bg-redbrand-200"></div>
                                    <div>
                                        <p className="text-[8px] font-bold text-redbrand-600 uppercase font-sans">Øi / Øe</p>
                                        <p className="font-mono font-bold text-[11px] text-slate-700">{formatNumber(line.d_int_mm, 1)} / {formatNumber(line.d_ext_mm, 1)} mm</p>
                                    </div>
                                    <div className="w-px h-6 bg-redbrand-200"></div>
                                    <div>
                                        <p className="text-[8px] font-bold text-redbrand-600 uppercase">T. Superficie</p>
                                        <p className="font-mono font-black text-xs text-red-650">{formatNumber(line.t_surf, 1)} °C</p>
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-2 flex items-center justify-center">
                                <div className="w-full max-w-[280px]">
                                    <SVGGradienteSovrapposto line={line} tFluidGlobal={tFluidGlobal} tAmbGlobal={tAmbGlobal} />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                
                <button onClick={addLine} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold shadow-sm flex items-center hover:bg-slate-700 cursor-pointer"><IconPlus className="w-4 h-4 mr-2"/> Aggiungi Tratto</button>
            </div>

            {/* Report Stampa */}
            <div className="hidden print:block mt-6">
                <h3 className="text-sm font-bold text-slate-800 mb-2 border-b-2 border-slate-800 pb-1">Tabella Dispersioni e Dettaglio Isolamento</h3>
                <table className="w-full text-left border-collapse text-xs mt-2">
                    <thead>
                        <tr className="border-b border-slate-300">
                            <th className="py-2">Tratto</th>
                            <th className="py-2">Tubazione (DN)</th>
                            <th className="py-2">Ø Int/Est (mm)</th>
                            <th className="py-2">Isolante (sp. mm)</th>
                            <th className="py-2 text-right">Lungh. (m)</th>
                            <th className="py-2 text-right">Q Unit. (W/m)</th>
                            <th className="py-2 text-right">T. Superficie (°C)</th>
                            <th className="py-2 text-right">Q Totale (kW)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processedLines.map(l => (
                            <tr key={l.id} className="border-b border-slate-100">
                                <td className="py-1 font-bold">{l.name}</td>
                                <td className="py-1">{l.material} DN{l.DN}</td>
                                <td className="py-1 font-mono">{formatNumber(l.d_int_mm, 1)} / {formatNumber(l.d_ext_mm, 1)}</td>
                                <td className="py-1">{INSULATION_CATALOG.find(i=>i.id===l.isoType)?.name} ({l.isoThick}mm)</td>
                                <td className="py-1 text-right font-mono">{l.length}</td>
                                <td className="py-1 text-right font-mono">{formatNumber(l.calcQ_Wm || 0, 1)}</td>
                                <td className="py-1 text-right font-mono font-bold text-red-600">{formatNumber(l.t_surf || 0, 1)}</td>
                                <td className="py-1 text-right font-mono font-bold">{formatNumber(l.calcQ_tot_kW || 0, 2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Grafici di tutti i tratti stampati in griglia a 2 colonne */}
                {processedLines.length > 0 && (
                    <>
                        {processedLines.length > 2 && <div style={{ breakBefore: 'page' }}></div>}
                        <h3 className="text-[11px] font-bold text-slate-800 mb-4 uppercase tracking-wider border-b-2 border-slate-800 pb-1">
                            Dettaglio Profili Termici di Tutti i Tratti
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            {processedLines.map((l) => (
                                <div key={l.id} className="bg-white rounded-xl p-3 border border-slate-200 flex flex-col justify-between break-inside-avoid">
                                    <div>
                                        <h4 className="text-[10px] font-bold text-redbrand-700 mb-2 border-b border-slate-200 pb-1 uppercase tracking-wide flex justify-between">
                                            <span>Tratto: {l.name}</span>
                                        </h4>
                                        <div className="text-[9px] leading-snug space-y-1 text-slate-700">
                                            <p><strong>Conduttura:</strong> {l.material} DN{l.DN} {l.PN !== 'NORM' ? l.PN : ''}</p>
                                            <p><strong>Geometria:</strong> Øi {formatNumber(l.d_int_mm, 1)} mm | Øe {formatNumber(l.d_ext_mm, 1)} mm</p>
                                            <p><strong>Isolamento:</strong> {INSULATION_CATALOG.find(i=>i.id===l.isoType)?.name || 'Nessuno'} ({l.isoThick} mm)</p>
                                            <p><strong>Dati Fluido:</strong> Temp. Fluido {formatNumber(Number(tFluidGlobal) || 55, 0)} °C | Q Unitario {formatNumber(l.calcQ_Wm, 1)} W/m</p>
                                            <p><strong>Ambiente:</strong> Temp. Ambiente {formatNumber(Number(tAmbGlobal) || -5, 0)} °C</p>
                                            <p className="text-red-700 font-bold text-[9px]">Temp. Superficie: {formatNumber(l.t_surf, 1)} °C</p>
                                        </div>
                                    </div>
                                    <div className="w-[180px] mx-auto mt-2 shrink-0">
                                        <SVGGradienteSovrapposto line={l} tFluidGlobal={tFluidGlobal} tAmbGlobal={tAmbGlobal} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
                
                <div className="mt-8 mx-auto max-w-sm p-4 rounded-xl border-2 border-slate-800 text-center break-inside-avoid">
                    <p className="text-[10px] font-bold uppercase text-slate-600 mb-1">Totale Dispersione Rete</p>
                    <p className="text-3xl font-mono font-black">{formatNumber(totalLossKW, 2)} kW</p>
                </div>
            </div>

            <div className="mt-6 bg-slate-800 text-white p-4 rounded-xl flex justify-center items-center print:hidden shadow-lg">
                <div className="text-center">
                    <p className="text-xs text-slate-300 uppercase font-bold tracking-wide">La dispersione termica totale dell'impianto</p>
                    <p className="text-3xl font-mono font-black text-redbrand-400">{formatNumber(totalLossKW, 2)} <span className="text-sm font-sans font-normal text-white">kW</span></p>
                </div>
            </div>
        </div>
    );
}
