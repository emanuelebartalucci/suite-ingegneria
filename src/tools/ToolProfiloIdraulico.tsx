import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import { PIPE_CATALOG, K_PRESETS } from '../data/pipeCatalog';
import { 
  IconArrowUp, 
  IconPlus, 
  IconTrash, 
  IconWaves, 
  IconCylinder, 
  IconClose 
} from '../components/Icons';

interface ToolProfiloIdraulicoProps {
  projectData: ProjectData;
  setProjectData: (data: any) => void;
  setAppMode: (mode: string) => void;
}

interface LocalLossItem {
  id: number;
  type: string;
  val: number | string;
}

interface HydraulicElement {
  id: number;
  type: 'weir' | 'pipe' | 'channel' | 'custom';
  name: string;
  L?: number | string;
  weirType?: 'sottile' | 'spessa' | 'thompson';
  material?: string;
  DN?: string;
  PN?: string;
  D?: number | string;
  roughness?: number | string;
  localLosses?: LocalLossItem[];
  slope?: number | string;
  loss?: number | string;
  headLoss?: number;
  elevation?: number;
  totalKCalculated?: number;
}

interface ChartIdraulicoProps {
  profileData: HydraulicElement[];
  baseElev: number;
}

export function ToolProfiloIdraulico({ projectData, setProjectData, setAppMode }: ToolProfiloIdraulicoProps) {
    const [flowRate, setFlowRate] = useState<number | ''>(25);
    const [recircFactor, setRecircFactor] = useState<number | ''>(1);
    const [referenceElevation, setReferenceElevation] = useState<number | ''>(0);
    const [waterTemp, setWaterTemp] = useState<number | ''>(15);
    const [altitude, setAltitude] = useState<number | ''>(0);
    const [displayUnit, setDisplayUnit] = useState<'m' | 'cm'>('m'); 
    const [elements, setElements] = useState<HydraulicElement[]>([]);

    const profile = useMemo(() => {
        let currentElevation = Number(referenceElevation) || 0;
        const Q_m3s = ((Number(flowRate) || 0) * (Number(recircFactor) || 0)) / 3600;
        const currentTemp = Number(waterTemp) || 15;
        const g = 9.80665 - (0.00000328 * (Number(altitude) || 0));

        return elements.map((el) => {
            let headLoss = 0;
            if (el.type === 'weir') {
                if (Q_m3s > 0 && Number(el.L) > 0) {
                    if (el.weirType === 'thompson') headLoss = Math.pow(Q_m3s / ((8/15) * 0.62 * Math.sqrt(2 * g)), 2/5); 
                    else headLoss = Math.pow(Q_m3s / ((el.weirType === 'sottile' ? 0.54 : 0.384) * Number(el.L) * Math.sqrt(2 * g)), 2 / 3);
                }
            } else if (el.type === 'pipe') {
                const totalK = el.localLosses ? el.localLosses.reduce((sum, loss) => sum + (Number(loss.val) || 0), 0) : 0;
                if (Q_m3s > 0 && Number(el.D) > 0) {
                    const D = Number(el.D) / 1000;
                    const v = Q_m3s / (Math.PI * Math.pow(D / 2, 2));
                    const nu = (1.78 / (1 + 0.0337 * currentTemp + 0.000221 * Math.pow(currentTemp, 2))) * 1e-6;
                    const Re = (v * D) / nu;
                    let f = 0.02;
                    if (Re > 4000) f = 0.25 / Math.pow(Math.log10((Number(el.roughness)/1000) / (3.7 * D) + 5.74 / Math.pow(Re, 0.9)), 2);
                    else if (Re > 0) f = 64 / Re;
                    headLoss = (f * (Number(el.L) / D) + totalK) * ((v * v) / (2 * g));
                }
            } else if (el.type === 'channel') headLoss = Number(el.L) * Number(el.slope);
            else if (el.type === 'custom') headLoss = Number(el.loss) || 0;

            currentElevation += headLoss;
            return { 
              ...el, 
              headLoss, 
              elevation: currentElevation, 
              totalKCalculated: el.type === 'pipe' ? (el.localLosses ? el.localLosses.reduce((sum, l) => sum + (Number(l.val) || 0), 0) : 0) : 0 
            };
        });
    }, [elements, flowRate, recircFactor, referenceElevation, waterTemp, altitude]);

    const addElement = (type: 'weir' | 'pipe' | 'channel' | 'custom') => {
        const newId = elements.length > 0 ? Math.max(...elements.map(e => e.id)) + 1 : 1;
        let newEl: HydraulicElement = { id: newId, type, name: type === 'weir' ? 'Stramazzo (Sottile)' : type === 'pipe' ? 'Tubazione' : type === 'channel' ? 'Canale' : 'Perdita Fissa' };
        if (type === 'weir') newEl = { ...newEl, L: 1.0, weirType: 'sottile' };
        if (type === 'pipe') newEl = { ...newEl, L: 10, material: 'manuale', D: 200, roughness: 0.02, localLosses: [] };
        if (type === 'channel') newEl = { ...newEl, L: 5, slope: 0.005 };
        if (type === 'custom') newEl = { ...newEl, loss: 0.05 };
        setElements([...elements, newEl]);
    };

    const updateElement = (id: number, field: keyof HydraulicElement, value: any) => {
        setElements(prev => prev.map(e => {
            if (e.id === id) {
                let updated = { ...e, [field]: value } as HydraulicElement;
                if (field === 'weirType' && updated.name.startsWith('Stramazzo')) {
                    updated.name = `Stramazzo (${value === 'thompson' ? 'Thompson' : value === 'sottile' ? 'Parete Sottile' : 'Parete Spessa'})`;
                }
                if (e.type === 'pipe') {
                    if (field === 'material' && value !== 'manuale') {
                        const matData = PIPE_CATALOG[value];
                        const firstDN = Object.keys(matData.specs)[0];
                        const firstPN = Object.keys(matData.specs[firstDN])[0];
                        updated.DN = firstDN; updated.PN = firstPN; updated.roughness = matData.roughness; updated.D = matData.specs[firstDN][firstPN]; updated.name = `Tubo ${value} DN${firstDN}`;
                    } else if (field === 'DN' && updated.material && updated.material !== 'manuale') {
                        let pn = updated.PN || '';
                        if (!PIPE_CATALOG[updated.material].specs[value][pn]) pn = Object.keys(PIPE_CATALOG[updated.material].specs[value])[0]; 
                        updated.PN = pn; updated.D = PIPE_CATALOG[updated.material].specs[value][pn]; updated.name = `Tubo ${updated.material} DN${value}`;
                    } else if (field === 'PN' && updated.material && updated.material !== 'manuale' && updated.DN) {
                        updated.D = PIPE_CATALOG[updated.material].specs[updated.DN][value];
                    }
                }
                return updated;
            }
            return e;
        }));
    };

    const handleLocalLoss = (pipeId: number, action: 'add' | 'remove' | 'update', lossId?: number, field?: keyof LocalLossItem, value?: any) => {
        setElements(prev => prev.map(e => {
            if (e.id === pipeId) {
                let newLosses = e.localLosses || [];
                if (action === 'add') newLosses = [...newLosses, { id: Date.now(), type: 'manuale', val: 0.5 }];
                else if (action === 'remove' && lossId !== undefined) newLosses = newLosses.filter(l => l.id !== lossId);
                else if (action === 'update' && lossId !== undefined && field) {
                    newLosses = newLosses.map(l => {
                        if (l.id === lossId) {
                            let up = { ...l, [field]: value } as LocalLossItem;
                            if (field === 'type' && value !== 'manuale') up.val = Number(value);
                            if (field === 'val') up.type = 'manuale';
                            return up;
                        }
                        return l;
                    });
                }
                return { ...e, localLosses: newLosses };
            }
            return e;
        }));
    };

    const moveEl = (idx: number, dir: number) => {
        if ((idx === 0 && dir === -1) || (idx === elements.length - 1 && dir === 1)) return;
        const newEl = [...elements];
        [newEl[idx], newEl[idx + dir]] = [newEl[idx + dir], newEl[idx]];
        setElements(newEl);
    };

    const ChartIdraulico = ({ profileData, baseElev }: ChartIdraulicoProps) => {
        if (profileData.length === 0) {
            return (
                <div className="w-full h-48 mt-4 bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-center text-slate-400 print:border-none">
                    Aggiungi elementi
                </div>
            );
        }

        const reversed = [...profileData].reverse();
        
        // Costruiamo la sequenza dei punti di quota da sinistra a destra (Monte -> Valle)
        let cur = profileData.length > 0 ? (profileData[profileData.length - 1].elevation || baseElev) : baseElev;
        const dataPoints = [{ label: 'Monte', val: cur }];
        reversed.forEach((el) => {
            cur -= (el.headLoss || 0);
            dataPoints.push({ label: el.name, val: cur });
        });

        const vals = dataPoints.map(p => p.val);
        const maxVal = Math.max(...vals);
        const minVal = Math.min(...vals);
        const range = maxVal - minVal;
        
        // Autodimensionamento asse Y in base ai dati reali
        const yPad = range > 0.001 ? range * 0.15 : 0.05; 
        const yMin = minVal - yPad;
        const yMax = maxVal + yPad;
        const yRange = yMax - yMin;

        // Coordinate interne allargate per viewBox="0 0 1000 240"
        const chartHeight = 160; 
        const chartWidth = 820;  
        const paddingLeft = 90;  
        const paddingTop = 35;   
        const plotPaddingX = 75; // Distacco orizzontale dei punti dai bordi per evitare sovrapposizioni delle etichette con quota

        const getX = (idx: number) => {
            if (dataPoints.length <= 1) return paddingLeft + plotPaddingX;
            return paddingLeft + plotPaddingX + (idx / (dataPoints.length - 1)) * (chartWidth - 2 * plotPaddingX);
        };
        const getY = (val: number) => paddingTop + chartHeight - ((val - yMin) / yRange) * chartHeight;

        // Costruzione Path (Stepped Line "Before")
        let pathD = "";
        dataPoints.forEach((p, idx) => {
            const x = getX(idx);
            const y = getY(p.val);
            if (idx === 0) {
                pathD = `M ${x} ${y}`;
            } else {
                pathD += ` V ${y} H ${x}`; 
            }
        });

        // Path di riempimento azzurro sotto
        const fillY = paddingTop + chartHeight;
        const startX = getX(0);
        const endX = getX(dataPoints.length - 1);
        const fillD = `${pathD} L ${endX} ${fillY} L ${startX} ${fillY} Z`;

        // Generazione dei tick asse Y (5 livelli)
        const ticks = [];
        const tickCount = 5;
        for (let i = 0; i < tickCount; i++) {
            const val = yMin + (i / (tickCount - 1)) * yRange;
            ticks.push({ val, y: getY(val) });
        }

        return (
            <div className="w-full mt-4 bg-white border border-slate-200 rounded-lg p-2 print:border-none print:p-0 print-page-break">
                <svg 
                    viewBox="0 0 1000 240" 
                    className="w-full h-auto max-h-[240px] text-slate-500 font-sans"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    {/* Griglia orizzontale e ticks Y */}
                    {ticks.map((t, idx) => (
                        <g key={idx}>
                            <line 
                                x1={paddingLeft} 
                                y1={t.y} 
                                x2={paddingLeft + chartWidth} 
                                y2={t.y} 
                                stroke="#f8fafc" 
                                strokeWidth="1" 
                                strokeDasharray="3,3"
                            />
                            <text 
                                x={paddingLeft - 10} 
                                y={t.y + 4} 
                                textAnchor="end" 
                                fontSize="11" 
                                fill="#64748b" 
                                fontFamily="monospace"
                                fontWeight="bold"
                            >
                                {t.val.toFixed(3)} m
                            </text>
                        </g>
                    ))}

                    {/* Asse X (linea di base) */}
                    <line 
                        x1={paddingLeft} 
                        y1={fillY} 
                        x2={paddingLeft + chartWidth} 
                        y2={fillY} 
                        stroke="#cbd5e1" 
                        strokeWidth="1.2"
                    />

                    {/* Asse Y */}
                    <line 
                        x1={paddingLeft} 
                        y1={paddingTop} 
                        x2={paddingLeft} 
                        y2={fillY} 
                        stroke="#cbd5e1" 
                        strokeWidth="1.2"
                    />

                    {/* Area di riempimento sotto la linea */}
                    <path 
                        d={fillD} 
                        fill="rgba(37, 99, 235, 0.06)"
                    />

                    {/* Linea piezometrica stepped */}
                    <path 
                        d={pathD} 
                        fill="none" 
                        stroke="#2563eb" 
                        strokeWidth="2.2"
                    />

                    {/* Punti e Label */}
                    {dataPoints.map((p, idx) => {
                        const x = getX(idx);
                        const y = getY(p.val);

                        const isStart = idx === dataPoints.length - 1;
                        const isEnd = idx === 0; // Monte / arrivo è il primo nel disegno (sinistra)
                        
                        let labelText = p.label;
                        let textColor = "#475569";
                        let circleFill = "#2563eb";
                        let circleRadius = "3.5";

                        if (isEnd) {
                            // Tronchiamo il nome se è troppo lungo prima di aggiungere la quota
                            const shortLabel = p.label.length > 15 ? p.label.substring(0, 12) + '...' : p.label;
                            labelText = `${shortLabel} (${format(p.val)})`;
                            textColor = "#10b981"; // Emerald green per Monte (Arrivo)
                            circleFill = "#10b981";
                            circleRadius = "4.5";
                        } else if (isStart) {
                            // Tronchiamo il nome se è troppo lungo prima di aggiungere la quota
                            const shortLabel = p.label.length > 15 ? p.label.substring(0, 12) + '...' : p.label;
                            labelText = `${shortLabel} (${format(p.val)})`;
                            textColor = "#ea580c"; // Orange-red per Valle (Partenza)
                            circleFill = "#ea580c";
                            circleRadius = "4.5";
                        } else {
                            // Per i punti intermedi, troncamento classico del nome
                            if (labelText.length > 20) {
                                labelText = labelText.substring(0, 17) + '...';
                            }
                        }

                        return (
                            <g key={idx}>
                                <circle 
                                    cx={x} 
                                    cy={y} 
                                    r={circleRadius} 
                                    fill={circleFill} 
                                    stroke="#ffffff" 
                                    strokeWidth="1.5"
                                />
                                <text 
                                    x={x} 
                                    y={y - 10} 
                                    textAnchor="middle" 
                                    fontSize="11" 
                                    fontWeight="bold" 
                                    fill={textColor}
                                >
                                    {labelText}
                                </text>
                            </g>
                        );
                    })}
                </svg>
            </div>
        );
    };

    const format = (v: number | string) => displayUnit === 'cm' ? (Number(v)*100).toFixed(1) + ' cm' : Number(v).toFixed(3) + ' m';
    const toU = (v: number | string) => displayUnit === 'cm' ? +(Number(v)*100).toFixed(4) : v;
    const frmU = (v: number | string) => displayUnit === 'cm' ? Number(v)/100 : Number(v);

    // Funzione per caricare il progetto dal Cloud
    const handleLoadCloudProject = (data: any) => {
        if (!data) return;
        if (data.flowRate !== undefined) setFlowRate(data.flowRate);
        if (data.recircFactor !== undefined) setRecircFactor(data.recircFactor);
        if (data.referenceElevation !== undefined) setReferenceElevation(data.referenceElevation);
        if (data.waterTemp !== undefined) setWaterTemp(data.waterTemp);
        if (data.altitude !== undefined) setAltitude(data.altitude);
        if (data.elements) setElements(data.elements);
    };

    // Esporta i dati per il salvataggio
    const getCloudSaveData = () => {
        return {
            flowRate,
            recircFactor,
            referenceElevation,
            waterTemp,
            altitude,
            elements
        };
    };

    return (
        <div className="max-w-6xl mx-auto animate-fade-in">
            <ProjectHeader pData={projectData} setPData={setProjectData} title="Profilo Idraulico" setAppMode={setAppMode} iconColor="brand" />
            
            <ProjectStorage 
                toolType="idraulico"
                currentData={getCloudSaveData()}
                onLoadProject={handleLoadCloudProject}
                projectInfo={projectData}
                setProjectInfo={setProjectData}
            />

            <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 mb-6 print:shadow-none print:border-none print:p-0">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-slate-700">Dati Idraulici Base</h3>
                    <div className="print-hide flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button onClick={() => setDisplayUnit('m')} className={`px-2 py-1 rounded text-xs font-bold ${displayUnit === 'm' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500'}`}>m</button>
                        <button onClick={() => setDisplayUnit('cm')} className={`px-2 py-1 rounded text-xs font-bold ${displayUnit === 'cm' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500'}`}>cm</button>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 print:grid-cols-5 print:gap-2">
                    {[{l: 'Portata Base (m³/h)', v: flowRate, set: setFlowRate}, {l: 'Ricircolo Fanghi', v: recircFactor, set: setRecircFactor, sub: `Q. Calc: ${((Number(flowRate) || 0) * (Number(recircFactor) || 0)).toFixed(1)} m³/h`}, {l: 'Temp. Acqua (°C)', v: waterTemp, set: setWaterTemp}, {l: 'Altitudine (m s.l.m.)', v: altitude, set: setAltitude}].map((f, i) => (
                        <div key={i} className="bg-slate-50 p-3 rounded-lg border border-slate-200 print:bg-transparent print:border-none print:p-0">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{f.l}</label>
                            <input 
                                type="number" 
                                step={f.l.includes('Ricircolo') ? "0.1" : "1"} 
                                value={f.v === '' ? '' : f.v} 
                                onChange={e => f.set(e.target.value === '' ? '' : Number(e.target.value))} 
                                className="w-full bg-transparent text-lg font-semibold text-slate-800 focus:outline-none print:text-base border-b border-slate-300 print:border-none focus:border-brand-500" 
                            />
                            {f.sub && <p className="text-[9px] text-slate-400 mt-1">{f.sub}</p>}
                        </div>
                    ))}
                    <div className="bg-brand-50 p-3 rounded-lg border border-brand-200 print:bg-transparent print:border-none print:p-0">
                        <label className="block text-[10px] font-bold text-brand-600 uppercase mb-1">Quota a Valle ({displayUnit})</label>
                        <input 
                            type="number" 
                            step={displayUnit==='cm'?"1":"0.01"} 
                            value={referenceElevation === '' ? '' : toU(referenceElevation)} 
                            onChange={e => setReferenceElevation(e.target.value === '' ? '' : frmU(e.target.value))} 
                            className="w-full bg-transparent text-lg font-bold text-brand-800 focus:outline-none print:text-base border-b border-brand-300 print:border-none focus:border-brand-600" 
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-4 mb-6 print-hide">
                <div className="flex justify-between items-center bg-slate-800 text-white p-3.5 rounded-xl shadow-sm">
                    <h2 className="font-semibold text-sm flex items-center">
                        <IconArrowUp className="w-4 h-4 mr-2"/> Costruzione (da Valle a Monte)
                    </h2>
                </div>
                {elements.length === 0 && (
                    <div className="bg-white p-8 rounded-xl border-2 border-dashed border-slate-300 text-center text-slate-500 text-sm">
                        Nessun elemento presente.
                    </div>
                )}
                
                {elements.map((el, i) => (
                    <div key={el.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center space-x-2 w-full text-brand-600">
                                <div className="w-5 h-5 shrink-0">
                                  {el.type === 'weir' ? <IconWaves/> : el.type === 'pipe' ? <IconCylinder/> : el.type === 'channel' ? <div className="w-full h-full border-b-2 border-r-2 border-current transform -skew-x-12"></div> : <span className="font-bold text-lg">+</span>}
                                </div>
                                <input type="text" value={el.name} onChange={e => updateElement(el.id, 'name', e.target.value)} className="font-bold text-slate-800 bg-transparent outline-none w-full border-b border-transparent hover:border-slate-300 focus:border-brand-500" />
                            </div>
                            <div className="flex space-x-1 shrink-0">
                                <button onClick={()=>moveEl(i,-1)} className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer">↑</button>
                                <button onClick={()=>moveEl(i,1)} className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer">↓</button>
                                <button onClick={()=>setElements(elements.filter(x=>x.id!==el.id))} className="p-1 text-red-400 hover:bg-red-500 hover:text-white rounded cursor-pointer"><IconTrash className="w-4 h-4"/></button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {el.type === 'weir' && (
                                <>
                                    <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo Parete</label><select value={el.weirType} onChange={e => updateElement(el.id, 'weirType', e.target.value)} className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-sm outline-none"><option value="sottile">Sottile</option><option value="spessa">Spessa</option><option value="thompson">Thompson (A "V")</option></select></div>
                                    {el.weirType !== 'thompson' && <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Larghezza ({displayUnit})</label><input type="number" step={displayUnit==='cm'?"1":"0.1"} value={el.L === '' ? '' : toU(el.L || 0)} onChange={e => updateElement(el.id, 'L', e.target.value === '' ? '' : frmU(e.target.value))} className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-sm outline-none"/></div>}
                                </>
                            )}
                            {el.type === 'pipe' && (
                                <div className="col-span-2 md:col-span-4 bg-slate-50 p-2 rounded border border-slate-100 space-y-2">
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                        <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Lunghezza ({displayUnit})</label><input type="number" step={displayUnit==='cm'?"1":"0.5"} value={el.L === '' ? '' : toU(el.L || 0)} onChange={e => updateElement(el.id, 'L', e.target.value === '' ? '' : frmU(e.target.value))} className="w-full p-1 bg-white border border-slate-300 rounded text-sm outline-none"/></div>
                                        <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Materiale</label><select value={el.material} onChange={e => updateElement(el.id, 'material', e.target.value)} className="w-full p-1 bg-white border border-slate-300 rounded text-sm outline-none"><option value="manuale">Manuale...</option>{Object.keys(PIPE_CATALOG).map(m=><option key={m} value={m}>{m}</option>)}</select></div>
                                        {el.material !== 'manuale' ? (
                                            <>
                                                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">DN</label><select value={el.DN} onChange={e => updateElement(el.id, 'DN', e.target.value)} className="w-full p-1 bg-white border border-slate-300 rounded text-sm outline-none">{Object.keys(PIPE_CATALOG[el.material || ''].specs).map(dn=><option key={dn} value={dn}>{dn}</option>)}</select></div>
                                                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Classe</label><select value={el.PN} onChange={e => updateElement(el.id, 'PN', e.target.value)} className="w-full p-1 bg-white border border-slate-300 rounded text-sm outline-none">{Object.keys(PIPE_CATALOG[el.material || ''].specs[el.DN || '']||{}).map(pn=><option key={pn} value={pn}>{pn}</option>)}</select></div>
                                                <div><label className="block text-[10px] font-bold text-brand-500 uppercase mb-1">D. Int. (mm)</label><div className="w-full p-1 bg-brand-50 border border-brand-200 rounded text-sm text-brand-700 font-mono text-center font-bold">{Number(el.D || 0).toFixed(1)}</div></div>
                                            </>
                                        ) : (
                                            <>
                                                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">D. Int (mm)</label><input type="number" value={el.D === '' ? '' : el.D} onChange={e => updateElement(el.id, 'D', e.target.value === '' ? '' : Number(e.target.value))} className="w-full p-1 bg-white border border-slate-300 rounded text-sm outline-none"/></div>
                                                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Scabrezza</label><input type="number" step="0.01" value={el.roughness === '' ? '' : el.roughness} onChange={e => updateElement(el.id, 'roughness', e.target.value === '' ? '' : Number(e.target.value))} className="w-full p-1 bg-white border border-slate-300 rounded text-sm outline-none"/></div>
                                            </>
                                        )}
                                    </div>
                                    <div className="pt-2 border-t border-slate-200">
                                        <div className="flex items-center space-x-2 mb-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Perdite Localizzate (K)</span>
                                            <button onClick={()=>handleLocalLoss(el.id,'add')} className="px-1.5 py-0.5 bg-brand-100 text-brand-700 rounded text-[10px] font-bold cursor-pointer hover:bg-brand-200 transition-colors">+ Aggiungi</button>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {(el.localLosses||[]).map(l=>(
                                                <div key={l.id} className="flex bg-white border border-slate-300 rounded text-xs items-center">
                                                    <select value={l.type} onChange={e=>handleLocalLoss(el.id,'update',l.id,'type',e.target.value)} className="p-1 outline-none border-r border-slate-200"><option value="manuale">Manuale...</option>{K_PRESETS.map(p=><option key={p.label} value={p.value}>{p.label}</option>)}</select>
                                                    <input type="number" step="0.1" value={l.val === '' ? '' : l.val} onChange={e=>handleLocalLoss(el.id,'update',l.id,'val',e.target.value===''?'' : Number(e.target.value))} className="w-12 p-1 text-center outline-none"/>
                                                    <button onClick={()=>handleLocalLoss(el.id,'remove',l.id)} className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"><IconClose className="w-3 h-3"/></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {el.type === 'channel' && (
                                <>
                                    <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Lungh. ({displayUnit})</label><input type="number" step={displayUnit==='cm'?"1":"0.5"} value={el.L === '' ? '' : toU(el.L || 0)} onChange={e => updateElement(el.id, 'L', e.target.value === '' ? '' : frmU(e.target.value))} className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-sm outline-none"/></div>
                                    <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Pendenza</label><input type="number" step="0.001" value={el.slope === '' ? '' : el.slope} onChange={e => updateElement(el.id, 'slope', e.target.value === '' ? '' : Number(e.target.value))} className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-sm outline-none"/></div>
                                </>
                            )}
                            {el.type === 'custom' && <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Perdita ({displayUnit})</label><input type="number" step={displayUnit==='cm'?"1":"0.01"} value={el.loss === '' ? '' : toU(el.loss || 0)} onChange={e => updateElement(el.id, 'loss', e.target.value === '' ? '' : frmU(e.target.value))} className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-sm outline-none"/></div>}
                        </div>
                    </div>
                ))}
                <div className="flex flex-wrap gap-2 pt-2">
                    <button onClick={()=>addElement('weir')} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-sm font-bold shadow-sm flex items-center cursor-pointer hover:bg-blue-200 transition-colors"><span className="mr-1 font-bold">+</span> Stramazzo</button>
                    <button onClick={()=>addElement('pipe')} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded text-sm font-bold shadow-sm flex items-center cursor-pointer hover:bg-slate-300 transition-colors"><span className="mr-1 font-bold">+</span> Tubo</button>
                    <button onClick={()=>addElement('channel')} className="px-3 py-1.5 bg-teal-100 text-teal-700 rounded text-sm font-bold shadow-sm flex items-center cursor-pointer hover:bg-teal-200 transition-colors"><span className="mr-1 font-bold">+</span> Canale</button>
                    <button onClick={()=>addElement('custom')} className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded text-sm font-bold shadow-sm flex items-center cursor-pointer hover:bg-orange-200 transition-colors"><span className="mr-1 font-bold">+</span> Perdita Fissa</button>
                </div>
            </div>

            {/* Riepilogo Profilo e Grafico SVG - Posizionata in Fondo a Larghezza Intera */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 mb-6 print:shadow-none print:border-none print:p-0 print:!break-inside-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                    {/* Riepilogo (Larghezza 2/3) */}
                    <div className="md:col-span-2">
                        <h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-200 pb-2 print:border-slate-800 print:mb-2">Riepilogo Profilo</h3>
                        <div className="space-y-2 print:space-y-1">
                            <div className="flex justify-between text-xs font-semibold text-slate-500 pb-1 border-b border-dashed border-slate-200 print:border-none print:pb-0"><span>Partenza (Valle)</span><span className="font-mono">{format(referenceElevation)}</span></div>
                            {profile.map((res, i) => (
                                <div key={res.id} className="flex justify-between items-end print:border-b print:border-slate-100 print:pb-1 text-sm">
                                    <div>
                                        <p className="font-bold text-slate-700 flex items-center"><span className="bg-slate-100 rounded px-1 text-[10px] mr-1">{i + 1}</span> {res.name}</p>
                                        <p className="text-[10px] text-slate-500 ml-5">∆h = +{format(res.headLoss || 0)} {res.type==='pipe'&&(res.totalKCalculated || 0)>0&&`(K=${res.totalKCalculated?.toFixed(2)})`}</p>
                                    </div>
                                    <p className="font-mono font-bold text-brand-600 print:text-slate-900">{format(res.elevation || 0)}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Box Quota Arrivo (Larghezza 1/3) */}
                    <div className="md:col-span-1 flex items-center justify-center">
                        <div className="p-6 rounded-xl border-2 border-brand-400 bg-brand-50 text-center w-full max-w-sm print:bg-white print:border-slate-800 print:max-w-xs print:mx-auto">
                            <p className="text-[10px] font-bold text-brand-800 uppercase print:text-slate-600">Quota Arrivo Vasca (Monte)</p>
                            <p className="text-3xl font-mono font-black text-brand-600 print:text-slate-900">{profile.length>0 ? format(profile[profile.length-1].elevation || 0) : format(referenceElevation)}</p>
                        </div>
                    </div>
                </div>

                {/* Grafico SVG a Larghezza Intera */}
                <div className="mt-6 border-t border-slate-100 pt-6">
                    <ChartIdraulico profileData={profile} baseElev={Number(referenceElevation) || 0} />
                </div>
            </div>
        </div>
    );
}
