import React, { useState, useMemo } from 'react';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
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
                    
                    // Temp superficie esterna isolante e superficie esterna tubo
                    if (tFluid > tAmb) {
                        t_pipe_ext = tFluid - (calcQ_Wm / Math.PI) * (R_int + R_pipe);
                        t_surf = tAmb + calcQ_Wm / (Math.PI * (Number(alphaExt) || 7.4) * d_iso_m);
                    } else {
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
                d_int_mm: d_int_m * 1000,
                d_ext_mm: d_ext_m * 1000, 
                d_iso_mm: d_iso_m * 1000
            };
        });
    }, [lines, tAmbGlobal, tFluidGlobal, alphaInt, alphaExt]);

    const addLine = () => {
        const newId = lines.length > 0 ? Math.max(...lines.map(l => l.id)) + 1 : 1;
        const newLines = [...lines, { id: newId, name: `Tratto ${newId}`, length: 100, material: 'Acciaio', DN: '100', PN: 'NORM', isoType: 'pur', isoLambda: 0.025, isoThick: 60 }];
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

    // Componente per disegnare la Sezione Tubo 2D SVG
    const SVGSezioneTubo = ({ line }: { line: any }) => {
        if (!line || !line.d_int_mm) return null;

        const ri = line.d_int_mm / 2;
        const re = line.d_ext_mm / 2;
        const s_iso = Number(line.isoThick) || 0;
        const riso = re + s_iso;

        // Scala per fare in modo che il diametro esterno dell'isolante stia dentro i 160px (raggio max 70px)
        const scale = 70 / riso;

        const R_i_px = ri * scale;
        const R_e_px = re * scale;
        const R_iso_px = riso * scale;

        const isNoneIso = line.isoType === 'none';

        // Colori dell'isolamento a seconda del tipo
        let isoColor = "#e2e8f0"; // Grigio default
        if (line.isoType === 'pur') isoColor = "#fef08a"; // Giallo PUR
        if (line.isoType === 'rockwool') isoColor = "#fef08a"; // Lana di roccia
        if (line.isoType === 'rubber') isoColor = "#334155"; // Gomma nera

        return (
            <svg width="100%" height="160" viewBox="0 0 160 160" className="mx-auto select-none">
                <circle cx="80" cy="80" r="78" fill="none" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,3" />
                
                {/* 1. Cerchio Esterno (Isolante) */}
                {!isNoneIso && (
                    <circle cx="80" cy="80" r={R_iso_px} fill={isoColor} stroke="#e2e8f0" strokeWidth="1" />
                )}

                {/* 2. Cerchio Intermedio (Parete del Tubo) */}
                <circle cx="80" cy="80" r={R_e_px} fill={line.material === 'Acciaio' ? '#64748b' : '#1e293b'} stroke="#94a3b8" strokeWidth="1" />

                {/* 3. Cerchio Interno (Fluido Interno) */}
                <circle cx="80" cy="80" r={R_i_px} fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" />

                {/* Centro */}
                <circle cx="80" cy="80" r="2" fill="#3b82f6" />
                
                {/* Quote testuali */}
                <text x="80" y="84" textAnchor="middle" fill="#1e3a8a" fontSize="8" fontWeight="bold">Fluido</text>
            </svg>
        );
    };

    // Componente per tracciare il Grafico del Gradiente Termico Radiale SVG
    const SVGGradienteTermico = ({ line }: { line: any }) => {
        if (!line || !line.d_int_mm) return null;

        const ri = line.d_int_mm / 2;
        const re = line.d_ext_mm / 2;
        const s_iso = Number(line.isoThick) || 0;
        const riso = re + s_iso;

        const tf = Number(tFluidGlobal) || 0;
        const ta = Number(tAmbGlobal) || 0;
        const t_ext_tubo = line.t_pipe_ext || 0;
        const t_s = line.t_surf || 0;

        // Coordinate X del grafico (Raggio da 0 a R_iso)
        // Larghezza del grafico: 220px (da x=40 a x=260)
        // Altezza del grafico: 110px (da y=20 a y=130)
        const getX = (r: number) => {
            return 40 + (r / riso) * 210;
        };

        // Coordinate Y del grafico (Temperatura da tMin a tMax)
        const tMin = Math.min(tf, ta) - 5;
        const tMax = Math.max(tf, ta) + 5;
        const getY = (temp: number) => {
            const range = tMax - tMin || 1;
            return 130 - ((temp - tMin) / range) * 100;
        };

        // Calcolo punti intermedi logaritmici per la curva dell'isolante
        const numPoints = 15;
        let isoPathPoints = [];
        for (let i = 0; i <= numPoints; i++) {
            const fraction = i / numPoints;
            // Raggio corrispondente
            const r = re + fraction * s_iso;
            // Temperatura logaritmica
            let temp = t_ext_tubo;
            if (s_iso > 0 && Math.abs(t_ext_tubo - t_s) > 0.01) {
                temp = t_ext_tubo - (t_ext_tubo - t_s) * (Math.log(r / re) / Math.log(riso / re));
            }
            isoPathPoints.push(`${getX(r)},${getY(temp)}`);
        }
        const isoPath = `M ${isoPathPoints.join(' L ')}`;

        return (
            <svg width="100%" height="160" viewBox="0 0 280 160" className="mx-auto select-none font-sans">
                {/* Assi e Griglia */}
                <line x1="40" y1="130" x2="260" y2="130" stroke="#94a3b8" strokeWidth="1.5" />
                <line x1="40" y1="20" x2="40" y2="130" stroke="#94a3b8" strokeWidth="1.5" />

                {/* Trattini e scritte dell'asse Y (Temperatura) */}
                <line x1="36" y1={getY(tf)} x2="40" y2={getY(tf)} stroke="#475569" strokeWidth="1.5" />
                <text x="32" y={getY(tf) + 4} textAnchor="end" fill="#0f172a" fontSize="9" fontWeight="bold">{tf.toFixed(0)}°C</text>

                <line x1="36" y1={getY(t_s)} x2="40" y2={getY(t_s)} stroke="#475569" strokeWidth="1.5" />
                <text x="32" y={getY(t_s) + 4} textAnchor="end" fill="#b91c1c" fontSize="9" fontWeight="bold">{t_s.toFixed(1)}°C</text>

                <line x1="36" y1={getY(ta)} x2="40" y2={getY(ta)} stroke="#475569" strokeWidth="1.5" />
                <text x="32" y={getY(ta) + 4} textAnchor="end" fill="#475569" fontSize="9">{ta.toFixed(0)}°C</text>

                {/* Linee verticali divisorie delle zone geometriche */}
                {/* R_int */}
                <line x1={getX(ri)} y1="20" x2={getX(ri)} y2="130" stroke="#3b82f6" strokeWidth="1" strokeDasharray="2,2" />
                <text x={getX(ri)} y="142" textAnchor="middle" fill="#3b82f6" fontSize="8">Ø_int</text>

                {/* R_est */}
                <line x1={getX(re)} y1="20" x2={getX(re)} y2="130" stroke="#64748b" strokeWidth="1" strokeDasharray="2,2" />
                <text x={getX(re)} y="142" textAnchor="middle" fill="#64748b" fontSize="8">Ø_est</text>

                {/* R_iso */}
                {s_iso > 0 && (
                    <>
                        <line x1={getX(riso)} y1="20" x2={getX(riso)} y2="130" stroke="#eab308" strokeWidth="1" strokeDasharray="2,2" />
                        <text x={getX(riso)} y="142" textAnchor="middle" fill="#eab308" fontSize="8">Ø_iso</text>
                    </>
                )}

                {/* Curva del Gradiente Termico */}
                {/* 1. Zona Fluido (Costante a T_fluid) */}
                <line x1={getX(0)} y1={getY(tf)} x2={getX(ri)} y2={getY(tf)} stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />

                {/* 2. Zona Parete Tubo (Caduta quasi impercettibile e lineare tra R_int e R_est) */}
                <line x1={getX(ri)} y1={getY(tf)} x2={getX(re)} y2={getY(t_ext_tubo)} stroke="#475569" strokeWidth="3" />

                {/* 3. Zona Isolante (Caduta logaritmica pronunciata tra R_est e R_iso) */}
                {s_iso > 0 ? (
                    <path d={isoPath} fill="none" stroke="#d97706" strokeWidth="3" strokeLinecap="round" />
                ) : null}

                {/* 4. Convezione Esterna (Raccordo termico con l'aria ambiente) */}
                <line x1={getX(riso)} y1={getY(t_s)} x2={getX(riso) + 10} y2={getY(ta)} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2,2" />

                {/* Punti chiave evidenziati */}
                <circle cx={getX(re)} cy={getY(t_ext_tubo)} r="3" fill="#475569" />
                <circle cx={getX(riso)} cy={getY(t_s)} r="3.5" fill="#b91c1c" />

                <text x="260" y="125" textAnchor="end" fill="#64748b" fontSize="8">Raggio r</text>
            </svg>
        );
    };

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

            <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 mb-6 print:shadow-none print:border-none print:p-0">
                <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2 print:border-slate-800">
                    <h3 className="text-sm font-bold text-slate-700">Temperature e Fattori Ambientali</h3>
                    <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-redbrand-600 font-bold hover:underline print-hide">
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
                            <div className="bg-orange-50/50 p-2 rounded-lg border border-orange-200 print-hide">
                                <label className="block text-[9px] font-bold text-orange-600 uppercase mb-1">Adduttanza Interna (α₁) [W/m²K]</label>
                                <input 
                                    type="number" 
                                    value={alphaInt === '' ? '' : alphaInt} 
                                    onChange={e => setAlphaInt(e.target.value === '' ? '' : Number(e.target.value))} 
                                    className="w-full bg-transparent text-sm font-semibold text-slate-800 focus:outline-none border-b border-orange-300 focus:border-orange-500" 
                                />
                            </div>
                            <div className="bg-orange-50/50 p-2 rounded-lg border border-orange-200 print-hide">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block">
                {/* Lista e Impostazioni dei Tratti */}
                <div className="lg:col-span-2 space-y-4 print-hide">
                    <div className="flex justify-between items-center bg-slate-800 text-white p-3 rounded-xl shadow-sm">
                        <h2 className="font-semibold text-sm flex items-center"><IconThermometer className="w-4 h-4 mr-2"/> Tratti di Rete Analizzati</h2>
                    </div>
                    {processedLines.length === 0 && <div className="bg-white p-8 rounded-xl border-2 border-dashed border-slate-300 text-center text-slate-500 text-sm">Nessun tratto presente. Clicca su Aggiungi Tratto.</div>}
                    
                    {processedLines.map((line) => (
                        <div 
                            key={line.id} 
                            onClick={() => setSelectedLineId(line.id)}
                            className={`p-4 rounded-xl shadow-sm border transition-all cursor-pointer ${selectedLineId === line.id ? 'bg-white border-redbrand-500 ring-2 ring-redbrand-500/10' : 'bg-white hover:bg-slate-50/50 border-slate-200'}`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center space-x-2 w-full">
                                    <span className="text-redbrand-600">🌡️</span>
                                    <input 
                                        type="text" 
                                        value={line.name} 
                                        onChange={e => updateLine(line.id, 'name', e.target.value)} 
                                        className="font-bold text-slate-800 bg-transparent outline-none w-full border-b border-transparent hover:border-slate-300 focus:border-redbrand-500" 
                                        placeholder="Nome Tratto" 
                                    />
                                </div>
                                <div className="flex ml-2 shrink-0">
                                    <button onClick={(e)=>{ e.stopPropagation(); duplicateLine(line.id); }} className="p-1 text-slate-400 hover:bg-slate-100 hover:text-redbrand-600 rounded mr-1" title="Duplica"><IconCopy className="w-4 h-4"/></button>
                                    <button onClick={(e)=>{ e.stopPropagation(); removeLine(line.id); }} className="p-1 text-red-400 hover:bg-red-500 hover:text-white rounded" title="Elimina"><IconTrash className="w-4 h-4"/></button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="col-span-2">
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Materiale Tubo</label>
                                    <select 
                                        value={line.material} 
                                        onChange={e => updateLine(line.id, 'material', e.target.value)} 
                                        className="w-full text-xs p-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:border-redbrand-500"
                                    >
                                        {Object.keys(PIPE_CATALOG).map(m=><option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">DN</label>
                                    <select 
                                        value={line.DN} 
                                        onChange={e => updateLine(line.id, 'DN', e.target.value)} 
                                        className="w-full text-xs p-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50"
                                    >
                                        {Object.keys(PIPE_CATALOG[line.material]?.specs || {}).map(dn=><option key={dn} value={dn}>{dn}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Classe</label>
                                    <select 
                                        value={line.PN} 
                                        onChange={e => updateLine(line.id, 'PN', e.target.value)} 
                                        className="w-full text-xs p-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50"
                                    >
                                        {Object.keys(PIPE_CATALOG[line.material]?.specs[line.DN] || {}).map(pn=><option key={pn} value={pn}>{pn}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Tipo Isolante</label>
                                    <select 
                                        value={line.isoType} 
                                        onChange={e => updateLine(line.id, 'isoType', e.target.value)} 
                                        className="w-full text-xs p-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:border-redbrand-500"
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
                                <div className="bg-redbrand-50/50 border border-redbrand-100 p-1.5 rounded-lg flex flex-col justify-center text-center">
                                    <p className="text-[8px] font-bold text-redbrand-600 uppercase">Q unitario</p>
                                    <p className="font-mono font-black text-xs text-redbrand-800">{(line.calcQ_Wm || 0).toFixed(2)} W/m</p>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    <button onClick={addLine} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold shadow-sm flex items-center hover:bg-slate-700"><IconPlus className="w-4 h-4 mr-2"/> Aggiungi Tratto</button>
                </div>

                {/* Grafiche Avanzate della Sezione Selezionata */}
                <div className="lg:col-span-1 print-full-width">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sticky top-6 print:shadow-none print:border-none print:p-0">
                        <h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-200 pb-2 print:border-slate-800 print:mb-2">
                          Sezione & Gradiente Radiale
                        </h3>
                        {activeLine ? (
                            <div className="space-y-4">
                                <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 print:bg-transparent print:border-none print:p-0">
                                    <p className="text-xs font-bold text-slate-700 text-center mb-1">
                                      Tratto: <span className="text-redbrand-600">{activeLine.name}</span>
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                                        <div>Ø Int: {activeLine.d_int_mm?.toFixed(1)} mm</div>
                                        <div>Ø Est: {activeLine.d_ext_mm?.toFixed(1)} mm</div>
                                        <div>Isolante: {activeLine.isoThick} mm</div>
                                        <div className="text-red-600 font-bold">T. Sup: {activeLine.t_surf?.toFixed(1)}°C</div>
                                    </div>
                                </div>

                                <div className="border border-slate-100 rounded-xl p-2 bg-slate-50/20">
                                    <p className="text-[9px] text-slate-400 font-bold uppercase text-center mb-2">Visualizzazione Sezione Tubo</p>
                                    <SVGSezioneTubo line={activeLine} />
                                </div>

                                <div className="border border-slate-100 rounded-xl p-2 bg-slate-50/20">
                                    <p className="text-[9px] text-slate-400 font-bold uppercase text-center mb-2">Grafico Gradiente Termico (°C)</p>
                                    <SVGGradienteTermico line={activeLine} />
                                </div>
                            </div>
                        ) : (
                          <div className="py-12 text-center text-slate-400 text-sm">Aggiungi un tratto per abilitare la grafica di gradiente.</div>
                        )}
                    </div>
                </div>
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
                                <td className="py-1 font-mono">{l.d_int_mm?.toFixed(1)} / {l.d_ext_mm?.toFixed(1)}</td>
                                <td className="py-1">{INSULATION_CATALOG.find(i=>i.id===l.isoType)?.name} ({l.isoThick}mm)</td>
                                <td className="py-1 text-right font-mono">{l.length}</td>
                                <td className="py-1 text-right font-mono">{(l.calcQ_Wm || 0).toFixed(1)}</td>
                                <td className="py-1 text-right font-mono font-bold text-red-600">{(l.t_surf || 0).toFixed(1)}</td>
                                <td className="py-1 text-right font-mono font-bold">{(l.calcQ_tot_kW || 0).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                <div className="mt-8 mx-auto max-w-sm p-4 rounded-xl border-2 border-slate-800 text-center">
                    <p className="text-[10px] font-bold uppercase text-slate-600 mb-1">Totale Dispersione Rete</p>
                    <p className="text-3xl font-mono font-black">{totalLossKW.toFixed(2)} kW</p>
                </div>
            </div>

            <div className="mt-6 bg-slate-800 text-white p-4 rounded-xl flex justify-center items-center print-hide shadow-lg">
                <div className="text-center">
                    <p className="text-xs text-slate-300 uppercase font-bold tracking-wide">Dispersione Termica Totale dell'Impianto</p>
                    <p className="text-3xl font-mono font-black text-redbrand-400">{totalLossKW.toFixed(2)} <span className="text-sm font-sans font-normal text-white">kW</span></p>
                </div>
            </div>
        </div>
    );
}
