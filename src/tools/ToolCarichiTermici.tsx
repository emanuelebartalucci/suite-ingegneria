import React, { useState, useMemo } from 'react';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import { formatNumber } from '../utils/format';
import { PIPE_CATALOG } from '../data/pipeCatalog';
import { 
  IconFlame, 
  IconCopy, 
  IconTrash, 
  IconPlus 
} from '../components/Icons';

interface ToolCarichiTermiciProps {
  projectData: ProjectData;
  setProjectData: (data: any) => void;
  setAppMode: (mode: string) => void;
}

interface LoadItem {
  id: number;
  name: string;
  mode: 'power' | 'flow';
  inputVal: number | string;
  material: string;
  DN: string;
  PN: string;
  calcPower_kW?: number;
  calcFlow_m3h?: number;
  calcFlow_kgh?: number;
  d_teorico_mm?: number;
  realD?: number | null;
  realVelocity?: number;
}

export function ToolCarichiTermici({ projectData, setProjectData, setAppMode }: ToolCarichiTermiciProps) {
    const [fluidType, setFluidType] = useState<string>('automatico');
    const [fluidTemp, setFluidTemp] = useState<number | ''>(55); // °C
    const [glycolEtPercent, setGlycolEtPercent] = useState<number | ''>(0); // %
    const [glycolPrPercent, setGlycolPrPercent] = useState<number | ''>(0); // %
    const [manualCp, setManualCp] = useState<number | ''>(4.187); // kJ/kg°C
    const [manualRho, setManualRho] = useState<number | ''>(1000); // kg/m³
    const [deltaT, setDeltaT] = useState<number | ''>(5); // °C
    const [vTarget, setVTarget] = useState<number | ''>(1.0); // m/s
    const [loads, setLoads] = useState<LoadItem[]>([]);

    // Calcolo automatico delle proprietà del fluido in base a tipo, temperatura e glicole
    const fluidProps = useMemo(() => {
        const T = Number(fluidTemp) || 55;
        const xEt = (Number(glycolEtPercent) || 0) / 100;
        const xPr = (Number(glycolPrPercent) || 0) / 100;

        if (fluidType === 'automatico') {
            const rho_water = 1000 * (1 - ((T + 288.9414) / (508929.2 * (T + 68.12963))) * Math.pow(T - 3.9863, 2));
            const cp_water = 4.186 + 0.0009 * T;

            const delta_rho_et = xEt * (160 - 0.35 * T) + Math.pow(xEt, 2) * 30;
            const delta_rho_pr = xPr * (105 - 0.4 * T) + Math.pow(xPr, 2) * 20;
            const rho = rho_water + delta_rho_et + delta_rho_pr;

            const delta_cp_et = -xEt * (2.1 - 0.004 * T) + Math.pow(xEt, 2) * 0.5;
            const delta_cp_pr = -xPr * (1.8 - 0.005 * T) + Math.pow(xPr, 2) * 0.4;
            const cp = cp_water + delta_cp_et + delta_cp_pr;

            return { rho: Number(rho.toFixed(1)), cp: Number(cp.toFixed(3)) };
        }
        // Per tipo 'manuale' usiamo i valori inseriti manualmente
        return { rho: Number(manualRho) || 1000, cp: Number(manualCp) || 4.187 };
    }, [fluidType, fluidTemp, glycolEtPercent, glycolPrPercent, manualCp, manualRho]);

    const activeCp = fluidProps.cp;
    const activeRho = fluidProps.rho;

    const processedLoads = useMemo(() => {
        return loads.map(load => {
            let calcPower_kW = 0, calcFlow_m3h = 0, calcFlow_kgh = 0;
            const inputValNum = Number(load.inputVal) || 0;
            
            if (load.mode === 'power') {
                calcPower_kW = inputValNum;
                calcFlow_kgh = (calcPower_kW * 3600) / (activeCp * (Number(deltaT) || 5));
                calcFlow_m3h = calcFlow_kgh / activeRho;
            } else {
                calcFlow_m3h = inputValNum;
                calcFlow_kgh = calcFlow_m3h * activeRho;
                calcPower_kW = (calcFlow_kgh * activeCp * (Number(deltaT) || 5)) / 3600;
            }

            const flow_m3s = calcFlow_m3h / 3600;
            const area_m2 = flow_m3s / (Number(vTarget) || 1.0);
            const d_teorico_mm = Math.sqrt((4 * area_m2) / Math.PI) * 1000;
            
            let realD: number | null = null, realVelocity = 0;

            if (load.material && load.DN && load.PN) {
                if (PIPE_CATALOG[load.material] && PIPE_CATALOG[load.material].specs[load.DN] && PIPE_CATALOG[load.material].specs[load.DN][load.PN]) {
                    realD = PIPE_CATALOG[load.material].specs[load.DN][load.PN];
                }
                if (realD) {
                    const realArea = Math.PI * Math.pow(realD / 2000, 2);
                    realVelocity = flow_m3s / realArea;
                }
            }

            return { ...load, calcPower_kW, calcFlow_m3h, calcFlow_kgh, d_teorico_mm, realD, realVelocity };
        });
    }, [loads, activeCp, activeRho, deltaT, vTarget]);

    const addLoad = () => {
        const newId = loads.length > 0 ? Math.max(...loads.map(l => l.id)) + 1 : 1;
        setLoads([...loads, { id: newId, name: `Utenza ${newId}`, mode: 'power', inputVal: '', material: 'Acciaio', DN: '50', PN: 'NORM' }]);
    };

    const duplicateLoad = (id: number) => {
        const loadToCopy = loads.find(l => l.id === id);
        if (!loadToCopy) return;
        const newId = loads.length > 0 ? Math.max(...loads.map(l => l.id)) + 1 : 1;
        setLoads([...loads, { ...loadToCopy, id: newId, name: loadToCopy.name + " (Copia)" }]);
    };

    const updateLoad = (id: number, field: keyof LoadItem, val: any) => {
        setLoads(prev => prev.map(l => {
            if (l.id === id) {
                let updated = { ...l, [field]: val } as LoadItem;
                
                if (field === 'material') {
                    const matData = PIPE_CATALOG[val];
                    const firstDN = Object.keys(matData.specs)[0];
                    const firstPN = Object.keys(matData.specs[firstDN])[0];
                    updated.DN = firstDN; updated.PN = firstPN;
                } 
                else if (field === 'DN') {
                    let currentPN = updated.PN;
                    if (!PIPE_CATALOG[updated.material].specs[val][currentPN]) {
                        currentPN = Object.keys(PIPE_CATALOG[updated.material].specs[val])[0];
                    }
                    updated.PN = currentPN;
                }
                return updated;
            }
            return l;
        }));
    };

    const removeLoad = (id: number) => setLoads(loads.filter(l => l.id !== id));

    const totalKW = processedLoads.reduce((s, l) => s + (l.calcPower_kW || 0), 0);
    const totalM3H = processedLoads.reduce((s, l) => s + (l.calcFlow_m3h || 0), 0);

    // Funzione per caricare il progetto dal Cloud
    const handleLoadCloudProject = (data: any) => {
        if (!data) return;
        if (data.fluidType) {
            // Retrocompatibilità: se era acqua, etilenico o propilenico lo mappiamo su 'automatico'
            if (data.fluidType === 'acqua' || data.fluidType === 'etilenico' || data.fluidType === 'propilenico') {
                setFluidType('automatico');
            } else {
                setFluidType(data.fluidType);
            }
        }
        if (data.fluidTemp !== undefined) setFluidTemp(data.fluidTemp);
        
        // Retrocompatibilità per percentuali di glicole salvate
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

        if (data.manualCp !== undefined) setManualCp(data.manualCp);
        if (data.manualRho !== undefined) setManualRho(data.manualRho);
        if (data.deltaT !== undefined) setDeltaT(data.deltaT);
        if (data.vTarget !== undefined) setVTarget(data.vTarget);
        if (data.loads) setLoads(data.loads);
    };

    // Esporta i dati correnti per il salvataggio
    const getCloudSaveData = () => {
        return {
            fluidType,
            fluidTemp,
            glycolEtPercent,
            glycolPrPercent,
            manualCp,
            manualRho,
            deltaT,
            vTarget,
            loads
        };
    };

    const renderCharts = () => {
        if (processedLoads.length === 0) return null;

        // Donut Chart calculations
        const donutSlices = (() => {
            if (totalKW === 0) return [];
            let accumulatedPercent = 0;
            const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1'];
            return processedLoads.map((load, index) => {
                const power = load.calcPower_kW || 0;
                const percent = power / totalKW;
                const strokeLength = percent * 251.2;
                const strokeOffset = accumulatedPercent * 251.2;
                accumulatedPercent += percent;
                return {
                    id: load.id,
                    name: load.name,
                    power,
                    percent: percent * 100,
                    strokeLength,
                    strokeOffset: -strokeOffset,
                    color: colors[index % colors.length]
                };
            });
        })();

        return (
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 mt-6 print:shadow-none print:border-none print:p-0 print:mt-4 print:break-inside-avoid">
                <h3 className="text-sm font-bold text-slate-700 mb-4 border-b border-slate-100 pb-2 print:border-b print:border-slate-800 print:pb-1 flex items-center gap-2">
                    <span>📊</span> Analisi Grafica della Rete
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
                    {/* Donut Chart */}
                    <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 print:bg-transparent print:border-none print:p-0 flex flex-col sm:flex-row items-center gap-4">
                        <div className="w-32 h-32 flex-shrink-0 relative">
                            {totalKW > 0 ? (
                                <svg width="128" height="128" viewBox="0 0 120 120" className="-rotate-90">
                                    {donutSlices.map((slice) => (
                                        <circle
                                            key={slice.id}
                                            cx="60"
                                            cy="60"
                                            r="40"
                                            fill="transparent"
                                            stroke={slice.color}
                                            strokeWidth="16"
                                            strokeDasharray={`${slice.strokeLength.toFixed(1)} 251.3`}
                                            strokeDashoffset={slice.strokeOffset.toFixed(1)}
                                            className="transition-all duration-300"
                                        />
                                    ))}
                                    {/* Centro bianco della ciambella */}
                                    <circle cx="60" cy="60" r="32" fill="#ffffff" />
                                </svg>
                            ) : (
                                <div className="w-full h-full rounded-full border-4 border-dashed border-slate-200 flex items-center justify-center text-[10px] text-slate-400">Nessun carico</div>
                            )}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Totale</span>
                                <span className="text-xs font-black text-slate-800 font-mono">{formatNumber(totalKW, 1)} kW</span>
                            </div>
                        </div>
                        <div className="flex-1 flex flex-col justify-center space-y-1.5 w-full max-h-32 overflow-y-auto pr-1">
                            {totalKW > 0 ? (
                                donutSlices.map((slice) => (
                                    <div key={slice.id} className="flex items-center justify-between text-[10px] text-slate-600">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: slice.color }}></span>
                                            <span className="truncate font-semibold">{slice.name}</span>
                                        </div>
                                        <span className="font-mono font-bold text-slate-700 shrink-0 ml-2">{formatNumber(slice.power, 1)} kW ({formatNumber(slice.percent, 0)}%)</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-slate-400 italic text-center">Nessuna potenza termica definita.</p>
                            )}
                        </div>
                    </div>

                    {/* Bar Chart */}
                    <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 print:bg-transparent print:border-none print:p-0 flex flex-col justify-between">
                        {/* Grafico barre SVG */}
                        <div className="w-full overflow-x-auto">
                            {processedLoads.length > 0 ? (
                                (() => {
                                    const chartWidth = 320;
                                    const leftMargin = 80;
                                    const rightMargin = 35;
                                    const barAreaWidth = chartWidth - leftMargin - rightMargin;
                                    const maxVelocity = Math.max(...processedLoads.map(l => l.realVelocity || 0), Number(vTarget) || 1.0, 2.0);
                                    const scale = barAreaWidth / maxVelocity;
                                    const targetVal = Number(vTarget) || 1.0;
                                    const targetX = leftMargin + targetVal * scale;
                                    const chartHeight = processedLoads.length * 24 + 25;

                                    return (
                                        <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="min-w-[320px]">
                                            {/* Griglia di sfondo */}
                                            {[0.5, 1.0, 1.5, 2.0].map((v) => {
                                                if (v > maxVelocity) return null;
                                                const x = leftMargin + v * scale;
                                                return (
                                                    <g key={v}>
                                                        <line x1={x} y1="10" x2={x} y2={chartHeight - 15} stroke="#e2e8f0" strokeDasharray="2 2" />
                                                        <text x={x} y={chartHeight - 4} textAnchor="middle" fontSize="7" fill="#94a3b8" className="font-mono">{formatNumber(v, 1)}</text>
                                                    </g>
                                                );
                                            })}

                                            {/* Linea Target Velocità */}
                                            <line x1={targetX} y1="10" x2={targetX} y2={chartHeight - 15} stroke="#f97316" strokeWidth="1" strokeDasharray="3 3" />
                                            <text x={targetX} y="8" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#f97316" className="font-sans">{formatNumber(targetVal, 1)} m/s</text>

                                            {/* Barre per ogni carico */}
                                            {processedLoads.map((load, idx) => {
                                                const y = 14 + idx * 24;
                                                const barW = (load.realVelocity || 0) * scale;
                                                
                                                let barColor = '#10b981'; // Verde di base
                                                if ((load.realVelocity || 0) > targetVal * 1.3) {
                                                    barColor = '#ef4444'; // Rosso (alta velocità)
                                                } else if ((load.realVelocity || 0) < 0.4) {
                                                    barColor = '#f59e0b'; // Giallo (bassa velocità)
                                                }

                                                return (
                                                    <g key={load.id}>
                                                        {/* Nome della zona */}
                                                        <text x={leftMargin - 6} y={y + 8} textAnchor="end" fontSize="8" fontWeight="bold" fill="#475569" className="font-sans">
                                                            {load.name.length > 13 ? load.name.slice(0, 11) + '..' : load.name}
                                                        </text>
                                                        {/* Slot sfondo */}
                                                        <rect x={leftMargin} y={y} width={barAreaWidth} height="10" rx="2" fill="#f1f5f9" />
                                                        {/* Barra reale */}
                                                        <rect x={leftMargin} y={y} width={Math.max(0, barW)} height="10" rx="2" fill={barColor} />
                                                        {/* Valore numerico della velocità */}
                                                        <text x={leftMargin + Math.max(0, barW) + 4} y={y + 8} fontSize="8" fontWeight="bold" fill="#334155" className="font-mono">
                                                            {formatNumber(load.realVelocity || 0, 2)} m/s
                                                        </text>
                                                    </g>
                                                );
                                            })}
                                        </svg>
                                    );
                                })()
                            ) : (
                                <p className="text-xs text-slate-400 italic text-center py-6">Aggiungi utenze per vedere il grafico delle velocità.</p>
                            )}
                        </div>
                        
                        {/* Legenda Velocità */}
                        <div className="flex gap-4 justify-center mt-3 pt-2 border-t border-slate-100 text-[8px] font-bold uppercase text-slate-500">
                             <div className="flex items-center gap-1">
                                 <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: '#f59e0b' }}></span> 
                                 <span>Bassa (&lt;0.4 m/s)</span>
                             </div>
                             <div className="flex items-center gap-1">
                                 <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: '#10b981' }}></span> 
                                 <span>Ottimale (0.4 - {formatNumber((Number(vTarget) || 1.0) * 1.3, 1)} m/s)</span>
                             </div>
                             <div className="flex items-center gap-1">
                                 <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: '#ef4444' }}></span> 
                                 <span>Alta (&gt;{formatNumber((Number(vTarget) || 1.0) * 1.3, 1)} m/s)</span>
                             </div>
                         </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-6xl mx-auto animate-fade-in">
            <ProjectHeader pData={projectData} setPData={setProjectData} title="Calcolo Carichi Termici & Reti" setAppMode={setAppMode} iconColor="orange" />
            
            <ProjectStorage 
                toolType="termico"
                currentData={getCloudSaveData()}
                onLoadProject={handleLoadCloudProject}
                projectInfo={projectData}
                setProjectInfo={setProjectData}
            />

            {/* Spiegazione & Formula */}
            <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 mb-5 text-xs text-slate-650 space-y-2.5 print:hidden">
              <p>
                <strong>Descrizione:</strong> Calcola la portata volumetrica e massica del fluido termovettore (acqua o miscele acqua-glicole) necessarie per soddisfare la potenza termica di ciascuna utenza, dimensionando il diametro interno teorico dei tubi in base alla velocità target impostata.
              </p>
              <div className="bg-white/80 border border-amber-100 rounded-xl p-4 text-slate-600">
                <p className="font-bold text-slate-700 mb-2.5 text-[11px] uppercase tracking-wide">Formule applicate:</p>
                <div className="space-y-3.5 pl-2 text-xs">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span>• Portata Massica:</span>
                    <span className="font-serif font-bold text-slate-800 flex items-center">
                      ṁ = 
                      <span className="inline-flex flex-col items-center align-middle mx-1.5 text-center text-[10px]">
                        <span className="border-b border-slate-400 px-1 pb-0.5">P</span>
                        <span className="px-1 pt-0.5">C<sub>p</sub> × ΔT</span>
                      </span>
                      <span className="text-[11px] text-slate-500 font-sans font-normal ml-1"> [kg/s]</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span>• Portata Volumetrica:</span>
                    <span className="font-serif font-bold text-slate-800 flex items-center">
                      Q = 
                      <span className="inline-flex flex-col items-center align-middle mx-1.5 text-center text-[10px]">
                        <span className="border-b border-slate-400 px-1 pb-0.5">ṁ</span>
                        <span className="px-1 pt-0.5">ρ</span>
                      </span>
                      <span className="text-[11px] text-slate-500 font-sans font-normal ml-1"> [m³/s]</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span>• Diametro Interno Teorico:</span>
                    <span className="font-serif font-bold text-slate-800 flex items-center">
                      D<sub>teo</sub> = 
                      <span className="inline-flex items-center mx-1 font-bold">
                        √<span className="border-t border-slate-800 px-1 mt-0.5">
                          <span className="inline-flex flex-col items-center align-middle text-[10px] leading-tight">
                            <span className="border-b border-slate-400 px-0.5">4 × Q</span>
                            <span className="px-0.5">π × v<sub>target</sub></span>
                          </span>
                        </span>
                      </span>
                      <span className="text-[11px] text-slate-500 font-sans font-normal ml-1"> [m]</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pannello Fluidi Dinamico (Glicole) */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 mb-6 print:shadow-none print:border-none print:p-0">
                <h3 className="text-sm font-bold text-slate-700 mb-2 border-b border-slate-100 pb-2 print:border-b print:border-slate-800 print:pb-1">
                  Parametri Fluido & Variazione di Temperatura (Glicole)
                </h3>
                <p className="text-xs text-slate-500 mb-4 print:hidden">
                  Il fluido di base è l'<strong>acqua</strong>. Le proprietà fisiche vengono ricalcolate automaticamente all'aumentare delle percentuali di glicole.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 print:grid-cols-4 print:gap-2">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo Calcolo</label>
                        <select 
                            value={fluidType} 
                            onChange={e => setFluidType(e.target.value)} 
                            className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-semibold focus:border-orange-500 cursor-pointer"
                        >
                            <option value="automatico">Automatico (Acqua)</option>
                            <option value="manuale">Manuale...</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Temp. Fluido (°C)</label>
                        <input 
                            type="number" 
                            value={fluidTemp === '' ? '' : fluidTemp} 
                            onChange={e => setFluidTemp(e.target.value === '' ? '' : Number(e.target.value))} 
                            className="w-full bg-slate-50 text-sm font-semibold text-slate-800 p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-orange-500 font-mono"
                            disabled={fluidType === 'manuale'}
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
                            className="w-full bg-slate-50 text-sm font-semibold text-slate-800 p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-orange-500 font-mono"
                            disabled={fluidType === 'manuale'}
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
                            className="w-full bg-slate-50 text-sm font-semibold text-slate-800 p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-orange-500 font-mono"
                            disabled={fluidType === 'manuale'}
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">∆T Impianto (°C)</label>
                        <input 
                            type="number" 
                            value={deltaT === '' ? '' : deltaT} 
                            onChange={e => setDeltaT(e.target.value === '' ? '' : Number(e.target.value))} 
                            className="w-full bg-slate-50 text-sm font-semibold text-slate-800 p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-orange-500 font-mono" 
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Velocità Target (m/s)</label>
                        <input 
                            type="number" 
                            step="0.1" 
                            value={vTarget === '' ? '' : vTarget} 
                            onChange={e => setVTarget(e.target.value === '' ? '' : Number(e.target.value))} 
                            className="w-full bg-slate-50 text-sm font-semibold text-slate-800 p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-orange-500 font-mono" 
                        />
                    </div>

                    {fluidType === 'manuale' ? (
                        <>
                            <div>
                                <label className="block text-[10px] font-bold text-orange-600 uppercase mb-1">Cp (kJ/kg°C) [Man]</label>
                                <input 
                                    type="number" 
                                    step="0.001" 
                                    value={manualCp === '' ? '' : manualCp} 
                                    onChange={e => setManualCp(e.target.value === '' ? '' : Number(e.target.value))} 
                                    className="w-full bg-orange-50/50 text-sm font-semibold text-slate-800 p-2 rounded-lg border border-orange-200 focus:outline-none focus:border-orange-500 font-mono" 
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-orange-600 uppercase mb-1">Densità (kg/m³) [Man]</label>
                                <input 
                                    type="number" 
                                    value={manualRho === '' ? '' : manualRho} 
                                    onChange={e => setManualRho(e.target.value === '' ? '' : Number(e.target.value))} 
                                    className="w-full bg-orange-50/50 text-sm font-semibold text-slate-800 p-2 rounded-lg border border-orange-200 focus:outline-none focus:border-orange-500 font-mono" 
                                />
                            </div>
                        </>
                    ) : (
                        <div className="col-span-2 bg-brand-50 border border-brand-100 rounded-lg p-2 flex justify-around items-center text-xs print:bg-transparent">
                            <div>
                                <p className="text-[9px] font-bold text-brand-600 uppercase">Cp Calc</p>
                                <p className="font-mono font-bold text-brand-800 text-sm">{formatNumber(activeCp, 3)} kJ/kgK</p>
                            </div>
                            <div className="w-px h-6 bg-brand-200"></div>
                            <div>
                                <p className="text-[9px] font-bold text-brand-600 uppercase">Densità Calc</p>
                                <p className="font-mono font-bold text-brand-800 text-sm">{formatNumber(activeRho, 1)} kg/m³</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Tratti di Utenza */}
            <div className="space-y-4 print-hide">
                <div className="flex justify-between items-center bg-slate-800 text-white p-3 rounded-xl shadow-sm">
                    <h2 className="font-semibold text-sm flex items-center"><IconFlame className="w-4 h-4 mr-2"/> Utenze Termiche / Frigorifere</h2>
                </div>
                {processedLoads.length === 0 && <div className="bg-white p-8 rounded-xl border-2 border-dashed border-slate-300 text-center text-slate-500 text-sm">Nessuna utenza presente. Clicca su Aggiungi Utenza.</div>}
                
                {processedLoads.map((load) => (
                    <div key={load.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
                        
                        {/* Nome e Input Dati */}
                        <div className="flex-1 space-y-3 pr-4 border-r border-slate-100">
                            <div className="flex items-center justify-between">
                                <input 
                                    type="text" 
                                    value={load.name} 
                                    onChange={e => updateLoad(load.id, 'name', e.target.value)} 
                                    className="font-bold text-lg text-slate-800 bg-transparent outline-none w-full border-b border-transparent hover:border-slate-300 focus:border-orange-500" 
                                    placeholder="Nome Utenza" 
                                />
                                <div className="flex ml-2">
                                    <button onClick={()=>duplicateLoad(load.id)} className="p-1 text-slate-400 hover:bg-slate-100 hover:text-orange-600 rounded shrink-0 mr-1" title="Duplica"><IconCopy className="w-4 h-4"/></button>
                                    <button onClick={()=>removeLoad(load.id)} className="p-1 text-red-400 hover:bg-red-500 hover:text-white rounded shrink-0" title="Elimina"><IconTrash className="w-4 h-4"/></button>
                                </div>
                            </div>

                            {/* Interruttore Noto/Calcolato */}
                            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                                <button 
                                    onClick={()=>updateLoad(load.id,'mode','power')} 
                                    className={`flex-1 text-[10px] font-bold py-1 rounded-md transition-all ${load.mode==='power'?'bg-white shadow text-orange-650':'text-slate-500'}`}
                                >
                                    Noto: kW Termici
                                </button>
                                <button 
                                    onClick={()=>updateLoad(load.id,'mode','flow')} 
                                    className={`flex-1 text-[10px] font-bold py-1 rounded-md transition-all ${load.mode==='flow'?'bg-white shadow text-orange-650':'text-slate-500'}`}
                                >
                                    Noto: Portata (m³/h)
                                </button>
                            </div>

                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                                  Valore {load.mode === 'power' ? 'Potenza (kWt)' : 'Portata (m³/h)'}
                                </label>
                                <input 
                                    type="number" 
                                    step="0.1" 
                                    value={load.inputVal === '' ? '' : load.inputVal} 
                                    onChange={e => updateLoad(load.id, 'inputVal', e.target.value === '' ? '' : Number(e.target.value))} 
                                    className="w-full text-xl font-bold bg-transparent outline-none border-b border-slate-300 focus:border-orange-500"
                                    required
                                />
                            </div>
                        </div>

                        {/* Risultato Conversione */}
                        <div className="flex-1 space-y-3 px-2">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Risultato Calcolo Termico</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-orange-50 p-2 rounded-lg border border-orange-100">
                                    <p className="text-[9px] font-bold text-orange-600 uppercase">Portata Fluido</p>
                                    <p className="font-mono font-bold text-orange-800 text-base">{formatNumber(load.calcFlow_m3h || 0, 2)} m³/h</p>
                                </div>
                                <div className="bg-orange-50 p-2 rounded-lg border border-orange-100">
                                    <p className="text-[9px] font-bold text-orange-600 uppercase">Potenza Termica</p>
                                    <p className="font-mono font-bold text-orange-800 text-base">{formatNumber(load.calcPower_kW || 0, 1)} kWt</p>
                                </div>
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 col-span-2">
                                    <p className="text-[9px] font-bold text-slate-500 uppercase">Portata Massica Equivalente</p>
                                    <p className="font-mono font-bold text-slate-700 text-sm">{formatNumber(load.calcFlow_kgh || 0, 1)} kg/h</p>
                                </div>
                            </div>
                        </div>

                        {/* Selezione Tubazione a Cascata */}
                        <div className="flex-1 space-y-3 pl-4 border-l border-slate-100">
                            <div className="flex justify-between items-center">
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dimensionamento Tubo</h4>
                              <span className="text-[9px] text-slate-400 font-mono">Ø Teorico: {formatNumber(load.d_teorico_mm, 1)} mm</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-3">
                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Materiale</label>
                                    <select 
                                        value={load.material} 
                                        onChange={e => updateLoad(load.id, 'material', e.target.value)} 
                                        className="w-full text-xs p-1.5 border border-slate-300 rounded-lg outline-none bg-slate-50"
                                    >
                                        {Object.keys(PIPE_CATALOG).map(m=><option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">DN</label>
                                    <select 
                                        value={load.DN} 
                                        onChange={e => updateLoad(load.id, 'DN', e.target.value)} 
                                        className="w-full text-xs p-1.5 border border-slate-300 rounded-lg outline-none bg-slate-50"
                                    >
                                        {Object.keys(PIPE_CATALOG[load.material]?.specs || {}).map(dn=><option key={dn} value={dn}>{dn}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">PN / Spessore</label>
                                    <select 
                                        value={load.PN} 
                                        onChange={e => updateLoad(load.id, 'PN', e.target.value)} 
                                        className="w-full text-xs p-1.5 border border-slate-300 rounded-lg outline-none bg-slate-50"
                                    >
                                        {Object.keys(PIPE_CATALOG[load.material]?.specs[load.DN] || {}).map(pn=><option key={pn} value={pn}>{pn}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            <div className={`p-2 rounded-lg border ${(load.realVelocity || 0) <= Number(vTarget) + 0.2 && (load.realVelocity || 0) >= Number(vTarget) - 0.5 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase">Selezionato</p>
                                        <p className="font-bold text-slate-800 text-base">DN {load.DN}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] text-slate-500 font-mono">Ø Int: {formatNumber(load.realD, 1)} mm</p>
                                        <p className={`text-xs font-bold ${(load.realVelocity || 0) > Number(vTarget) * 1.4 ? 'text-red-600' : 'text-orange-600'}`}>v = {formatNumber(load.realVelocity || 0, 2)} m/s</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                
                <button onClick={addLoad} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold shadow-sm flex items-center hover:bg-slate-700"><IconPlus className="w-4 h-4 mr-2"/> Aggiungi Utenza</button>
            </div>

            {/* Grafici a schermo */}
            <div className="print-hide">
                {renderCharts()}
            </div>

            {/* Tabella di Stampa Report */}
            <div className="hidden print:block mt-6">
                <h3 className="text-sm font-bold text-slate-800 mb-2 border-b-2 border-slate-800 pb-1">Distinta Utenze e Dimensionamento Tubazioni</h3>
                <div className="mb-4 text-xs bg-slate-50 p-2 rounded-lg print:p-0 print:bg-transparent">
                  <p>
                    <strong>Fluido Termovettore:</strong>{' '}
                    {fluidType === 'manuale' ? (
                        `Manuale (ρ: ${activeRho} kg/m³, c_p: ${activeCp} kJ/kg°C)`
                    ) : (
                        `Acqua ${
                            (Number(glycolEtPercent) || 0) > 0 || (Number(glycolPrPercent) || 0) > 0
                                ? `+ Glicole ${(Number(glycolEtPercent) || 0) > 0 ? `Etilenico (${glycolEtPercent}%)` : ''}${
                                      (Number(glycolEtPercent) || 0) > 0 && (Number(glycolPrPercent) || 0) > 0 ? ' / ' : ''
                                  }${(Number(glycolPrPercent) || 0) > 0 ? `Propilenico (${glycolPrPercent}%)` : ''}`
                                : 'Pura'
                        } a ${fluidTemp}°C (ρ: ${activeRho} kg/m³, c_p: ${activeCp} kJ/kg°C)`
                    )}
                    {' '}| <strong>∆T:</strong> {deltaT}°C
                  </p>
                </div>
                <table className="w-full text-left border-collapse text-xs mt-2">
                    <thead>
                        <tr className="border-b border-slate-300">
                            <th className="py-2">Utenza</th>
                            <th className="py-2">Potenza (kWt)</th>
                            <th className="py-2">Portata (m³/h)</th>
                            <th className="py-2">Mat. Tubo</th>
                            <th className="py-2">DN / PN Selez.</th>
                            <th className="py-2">Ø Int. (mm)</th>
                            <th className="py-2 text-right">Velocità (m/s)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processedLoads.map(l => (
                            <tr key={l.id} className="border-b border-slate-100">
                                <td className="py-1 font-bold">{l.name}</td>
                                <td className="py-1 font-mono">{formatNumber(l.calcPower_kW || 0, 1)}</td>
                                <td className="py-1 font-mono">{formatNumber(l.calcFlow_m3h || 0, 2)}</td>
                                <td className="py-1">{l.material}</td>
                                <td className="py-1 font-bold">DN {l.DN} - {l.PN}</td>
                                <td className="py-1 font-mono">{formatNumber(l.realD, 1)}</td>
                                <td className="py-1 text-right font-mono">{formatNumber(l.realVelocity || 0, 2)} m/s</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Grafici in stampa sotto la tabella */}
                {renderCharts()}
                
                <div className="flex gap-4 mt-8 mx-auto max-w-lg">
                    <div className="flex-1 p-3 rounded-lg border-2 border-slate-800 text-center">
                        <p className="text-[10px] font-bold uppercase text-slate-650 mb-1">Totale Potenza Termica</p>
                        <p className="text-2xl font-mono font-black">{formatNumber(totalKW, 1)} kW</p>
                    </div>
                    <div className="flex-1 p-3 rounded-lg border-2 border-slate-800 text-center">
                        <p className="text-[10px] font-bold uppercase text-slate-650 mb-1">Totale Portata Flusso</p>
                        <p className="text-2xl font-mono font-black">{formatNumber(totalM3H, 1)} m³/h</p>
                    </div>
                </div>
            </div>

            <div className="mt-6 bg-slate-800 text-white p-4 rounded-xl flex justify-around items-center print-hide shadow-lg">
                <div className="text-center">
                    <p className="text-xs text-slate-300 uppercase font-bold tracking-wide">Potenza Totale Rete</p>
                    <p className="text-2xl font-mono font-black">{formatNumber(totalKW, 1)} <span className="text-sm font-sans font-normal">kWt</span></p>
                </div>
                <div className="w-px h-10 bg-slate-600"></div>
                <div className="text-center">
                    <p className="text-xs text-slate-300 uppercase font-bold tracking-wide">Portata Totale Rete</p>
                    <p className="text-2xl font-mono font-black">{formatNumber(totalM3H, 1)} <span className="text-sm font-sans font-normal">m³/h</span></p>
                </div>
            </div>
        </div>
    );
}
