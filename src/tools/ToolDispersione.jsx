import React, { useState, useMemo } from 'react';
import { ProjectHeader } from '../components/ProjectHeader';
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

export function ToolDispersione({ projectData, setProjectData, setAppMode }) {
    const [tAmbGlobal, setTAmbGlobal] = useState(-5); // °C
    const [tFluidGlobal, setTFluidGlobal] = useState(55); // °C
    const [alphaInt, setAlphaInt] = useState(1163); // W/m2K (ex 1000 kcal/hm2°C)
    const [alphaExt, setAlphaExt] = useState(7.4); // W/m2K (ex 6.4 kcal/hm2°C)
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [lines, setLines] = useState([]);

    const processedLines = useMemo(() => {
        return lines.map(line => {
            let calcQ_Wm = 0;
            let t_surf = 0;
            let d_ext_m = 0;
            let d_int_m = 0;

            // Validazione base
            if (line.material && line.DN && line.PN && PIPE_CATALOG[line.material] && PIPE_CATALOG[line.material].specs[line.DN]) {
                const d_int_mm = PIPE_CATALOG[line.material].specs[line.DN][line.PN];
                if (d_int_mm) {
                    d_int_m = d_int_mm / 1000;
                    d_ext_m = getExternalDiameter(line.material, line.DN, d_int_mm) / 1000;
                    
                    const lambda_pipe = PIPE_CATALOG[line.material].lambda;
                    const lambda_iso = line.isoLambda;
                    const s_m = line.isoThick / 1000;
                    const d_iso_m = d_ext_m + 2 * s_m;

                    // Calcolo Resistenze Termiche [m·K/W]
                    const R_int = 1 / (alphaInt * d_int_m);
                    const R_pipe = Math.log(d_ext_m / d_int_m) / (2 * lambda_pipe);
                    let R_iso = 0;
                    if (s_m > 0 && lambda_iso > 0) {
                        R_iso = Math.log(d_iso_m / d_ext_m) / (2 * lambda_iso);
                    }
                    const R_ext = 1 / (alphaExt * d_iso_m);

                    const R_tot = R_int + R_pipe + R_iso + R_ext;
                    const deltaT = Math.abs(tFluidGlobal - tAmbGlobal); // Manteniamo la dispersione in valore assoluto (positiva)
                    
                    // Dispersione W/m = (PI * deltaT) / R_tot
                    calcQ_Wm = (Math.PI * deltaT) / R_tot;
                    
                    // Temp superficie esterna
                    if (tFluidGlobal > tAmbGlobal) {
                        t_surf = tAmbGlobal + calcQ_Wm / (Math.PI * alphaExt * d_iso_m);
                    } else {
                        t_surf = tAmbGlobal - calcQ_Wm / (Math.PI * alphaExt * d_iso_m); // Se l'acqua è refrigerata
                    }
                }
            }

            const calcQ_tot_kW = (calcQ_Wm * line.length) / 1000;

            return { ...line, calcQ_Wm, calcQ_tot_kW, t_surf, d_ext_mm: d_ext_m*1000 };
        });
    }, [lines, tAmbGlobal, tFluidGlobal, alphaInt, alphaExt]);

    const addLine = () => {
        const newId = lines.length > 0 ? Math.max(...lines.map(l => l.id)) + 1 : 1;
        setLines([...lines, { id: newId, name: `Tratto ${newId}`, length: 100, material: 'Acciaio', DN: '100', PN: 'NORM', isoType: 'pur', isoLambda: 0.025, isoThick: 60 }]);
    };

    const duplicateLine = (id) => {
        const lineToCopy = lines.find(l => l.id === id);
        if (!lineToCopy) return;
        const newId = lines.length > 0 ? Math.max(...lines.map(l => l.id)) + 1 : 1;
        setLines([...lines, { ...lineToCopy, id: newId, name: lineToCopy.name + " (Copia)" }]);
    };

    const updateLine = (id, field, val) => {
        setLines(prev => prev.map(l => {
            if (l.id === id) {
                let updated = { ...l, [field]: val };
                
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

    const removeLine = (id) => setLines(lines.filter(l => l.id !== id));

    const totalLossKW = processedLines.reduce((sum, l) => sum + l.calcQ_tot_kW, 0);

    return (
        <div className="max-w-6xl mx-auto">
            <ProjectHeader pData={projectData} setPData={setProjectData} title="Dispersione Tubazioni" setAppMode={setAppMode} iconColor="redbrand" />
            
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 mb-6 print:shadow-none print:border-none print:p-0">
                <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2 print:border-slate-800">
                    <h3 className="text-sm font-bold text-slate-700">Temperature e Fattori Ambientali</h3>
                    <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-redbrand-600 font-bold hover:underline print-hide">
                        {showAdvanced ? 'Nascondi Avanzate' : 'Mostra Avanzate (α)'}
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:gap-2">
                    {[{l: 'Temp. Fluido Interno (°C)', v: tFluidGlobal, set: setTFluidGlobal, step: "1"}, {l: 'Temp. Ambiente Esterno (°C)', v: tAmbGlobal, set: setTAmbGlobal, step: "1"}].map((f, i) => (
                        <div key={i} className="bg-slate-50 p-3 rounded-lg border border-slate-200 print:bg-transparent print:border-none print:p-0">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{f.l}</label>
                            <input type="number" step={f.step} value={f.v} onChange={e => f.set(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-transparent text-lg font-semibold text-slate-800 focus:outline-none print:text-base border-b border-slate-300 print:border-none focus:border-redbrand-500" />
                        </div>
                    ))}
                    {showAdvanced && (
                        <>
                            <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 print-hide">
                                <label className="block text-[10px] font-bold text-orange-600 uppercase mb-1">Adduttanza Interna (α₁) [W/m²K]</label>
                                <input type="number" value={alphaInt} onChange={e => setAlphaInt(Number(e.target.value))} className="w-full bg-transparent text-lg font-semibold text-slate-800 focus:outline-none border-b border-orange-300 focus:border-orange-500" />
                            </div>
                            <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 print-hide">
                                <label className="block text-[10px] font-bold text-orange-600 uppercase mb-1">Adduttanza Esterna (α₂) [W/m²K]</label>
                                <input type="number" step="0.1" value={alphaExt} onChange={e => setAlphaExt(Number(e.target.value))} className="w-full bg-transparent text-lg font-semibold text-slate-800 focus:outline-none border-b border-orange-300 focus:border-orange-500" />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Tratti di Tubazione */}
            <div className="space-y-4 print-hide">
                <div className="flex justify-between items-center bg-slate-800 text-white p-3 rounded-xl shadow-sm">
                    <h2 className="font-semibold text-sm flex items-center"><IconThermometer className="w-4 h-4 mr-2"/> Tratti di Rete Analizzati</h2>
                </div>
                {processedLines.length === 0 && <div className="bg-white p-8 rounded-xl border-2 border-dashed border-slate-300 text-center text-slate-500 text-sm">Nessun tratto presente. Clicca su Aggiungi.</div>}
                
                {processedLines.map((line) => (
                    <div key={line.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
                        
                        {/* Info Linea e Geometria Base */}
                        <div className="flex-1 space-y-3 pr-4 border-r border-slate-100">
                            <div className="flex items-center justify-between">
                                <input type="text" value={line.name} onChange={e => updateLine(line.id, 'name', e.target.value)} className="font-bold text-lg text-slate-800 bg-transparent outline-none w-full border-b border-transparent hover:border-slate-300 focus:border-redbrand-500" placeholder="Nome Tratto" />
                                <div className="flex ml-2">
                                    <button onClick={()=>duplicateLine(line.id)} className="p-1 text-slate-400 hover:bg-slate-100 hover:text-redbrand-600 rounded shrink-0 mr-1" title="Duplica"><IconCopy className="w-4 h-4"/></button>
                                    <button onClick={()=>removeLine(line.id)} className="p-1 text-red-400 hover:bg-red-500 hover:text-white rounded shrink-0" title="Elimina"><IconTrash className="w-4 h-4"/></button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Materiale Tubo</label>
                                    <select value={line.material} onChange={e => updateLine(line.id, 'material', e.target.value)} className="w-full text-xs p-1.5 border border-slate-300 rounded outline-none bg-slate-50 focus:border-redbrand-500">
                                        {Object.keys(PIPE_CATALOG).map(m=><option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">DN</label>
                                    <select value={line.DN} onChange={e => updateLine(line.id, 'DN', e.target.value)} className="w-full text-xs p-1.5 border border-slate-300 rounded outline-none bg-slate-50">
                                        {Object.keys(PIPE_CATALOG[line.material].specs).map(dn=><option key={dn} value={dn}>{dn}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Classe</label>
                                    <select value={line.PN} onChange={e => updateLine(line.id, 'PN', e.target.value)} className="w-full text-xs p-1.5 border border-slate-300 rounded outline-none bg-slate-50">
                                        {Object.keys(PIPE_CATALOG[line.material].specs[line.DN]||{}).map(pn=><option key={pn} value={pn}>{pn}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="bg-slate-50 p-2 rounded border border-slate-200 mt-2">
                                <div className="flex justify-between text-[10px] text-slate-500">
                                    <span>Ø Int: {PIPE_CATALOG[line.material].specs[line.DN]?.[line.PN]?.toFixed(1)} mm</span>
                                    <span>Ø Est stimato: <strong className="text-slate-700">{line.d_ext_mm?.toFixed(1)} mm</strong></span>
                                </div>
                            </div>
                        </div>

                        {/* Isolamento e Lunghezza */}
                        <div className="flex-1 space-y-3 px-2 border-r border-slate-100">
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase">Isolamento e Posa</h4>
                            
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo Isolante</label>
                                <select value={line.isoType} onChange={e => updateLine(line.id, 'isoType', e.target.value)} className="w-full text-xs p-1.5 border border-slate-300 rounded outline-none bg-slate-50 focus:border-redbrand-500">
                                    {INSULATION_CATALOG.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Spessore (mm)</label>
                                    <input type="number" step="1" value={line.isoThick} onChange={e => updateLine(line.id, 'isoThick', e.target.value===''?0 : Number(e.target.value))} className="w-full text-sm font-bold bg-transparent outline-none border-b border-slate-300 focus:border-redbrand-500" disabled={line.isoType==='none'}/>
                                </div>
                                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">λ isolante (W/mK)</label>
                                    <input type="number" step="0.001" value={line.isoLambda} onChange={e => updateLine(line.id, 'isoLambda', e.target.value===''?0 : Number(e.target.value))} className="w-full text-sm font-bold bg-transparent outline-none border-b border-slate-300 focus:border-redbrand-500" disabled={line.isoType!=='custom'}/>
                                </div>
                            </div>
                            <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Lunghezza Tratto (m)</label>
                                <input type="number" step="1" value={line.length} onChange={e => updateLine(line.id, 'length', e.target.value===''?0 : Number(e.target.value))} className="w-full text-lg font-bold text-slate-700 bg-transparent outline-none border-b border-slate-300 focus:border-redbrand-500"/>
                            </div>
                        </div>

                        {/* Risultato */}
                        <div className="flex-1 space-y-3 pl-4">
                            <div className="flex justify-between items-center"><h4 className="text-[11px] font-bold text-slate-400 uppercase">Perdite Termiche</h4></div>
                            
                            <div className="bg-redbrand-50 p-3 rounded-lg border border-redbrand-200">
                                <p className="text-[10px] font-bold text-redbrand-600 uppercase mb-1">Dispersione Unitaria (W/m)</p>
                                <p className="font-mono font-black text-2xl text-redbrand-800">{line.calcQ_Wm.toFixed(2)}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">Totale Tratto (kW)</p>
                                    <p className="font-mono font-bold text-slate-800">{line.calcQ_tot_kW.toFixed(2)}</p>
                                </div>
                                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">T. Superficie (°C)</p>
                                    <p className="font-mono font-bold text-slate-800">{line.t_surf.toFixed(1)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                
                <button onClick={addLine} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold shadow-sm flex items-center hover:bg-slate-700"><IconPlus className="w-4 h-4 mr-2"/> Aggiungi Tratto</button>
            </div>

            {/* Report Stampa */}
            <div className="hidden print:block mt-6">
                <h3 className="text-sm font-bold text-slate-800 mb-2 border-b-2 border-slate-800 pb-1">Tabella Dispersioni per Tratto</h3>
                <table className="w-full text-left border-collapse text-xs mt-2">
                    <thead>
                        <tr className="border-b border-slate-300">
                            <th className="py-2">Tratto</th>
                            <th className="py-2">Tubazione (DN)</th>
                            <th className="py-2">Isolante (sp. mm)</th>
                            <th className="py-2 text-right">Lungh. (m)</th>
                            <th className="py-2 text-right">Q Unit. (W/m)</th>
                            <th className="py-2 text-right">Q Totale (kW)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processedLines.map(l => (
                            <tr key={l.id} className="border-b border-slate-100">
                                <td className="py-1 font-bold">{l.name}</td>
                                <td className="py-1">{l.material} DN{l.DN}</td>
                                <td className="py-1">{INSULATION_CATALOG.find(i=>i.id===l.isoType)?.name} ({l.isoThick}mm)</td>
                                <td className="py-1 text-right font-mono">{l.length}</td>
                                <td className="py-1 text-right font-mono">{l.calcQ_Wm.toFixed(1)}</td>
                                <td className="py-1 text-right font-mono font-bold">{l.calcQ_tot_kW.toFixed(2)}</td>
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
