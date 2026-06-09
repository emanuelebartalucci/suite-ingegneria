import React, { useState, useMemo } from 'react';
import { ProjectHeader } from '../components/ProjectHeader';
import { PIPE_CATALOG, getExternalDiameter } from '../data/pipeCatalog';
import { 
  IconFlame, 
  IconCopy, 
  IconTrash, 
  IconPlus, 
  IconThermometer 
} from '../components/Icons';

export function ToolCarichiTermici({ projectData, setProjectData, setAppMode }) {
    const [cp, setCp] = useState(4.187); // kJ/kg°C
    const [rho, setRho] = useState(1000); // kg/m³
    const [deltaT, setDeltaT] = useState(5); // °C
    const [vTarget, setVTarget] = useState(1.0); // m/s
    
    const [loads, setLoads] = useState([]);

    const processedLoads = useMemo(() => {
        return loads.map(load => {
            let calcPower_kW = 0, calcFlow_m3h = 0, calcFlow_kgh = 0;
            
            if (load.mode === 'power') {
                calcPower_kW = Number(load.inputVal) || 0;
                calcFlow_kgh = (calcPower_kW * 3600) / (cp * deltaT);
                calcFlow_m3h = calcFlow_kgh / rho;
            } else {
                calcFlow_m3h = Number(load.inputVal) || 0;
                calcFlow_kgh = calcFlow_m3h * rho;
                calcPower_kW = (calcFlow_kgh * cp * deltaT) / 3600;
            }

            const flow_m3s = calcFlow_m3h / 3600;
            const area_m2 = flow_m3s / vTarget;
            const d_teorico_mm = Math.sqrt((4 * area_m2) / Math.PI) * 1000;
            
            let realD = null, realVelocity = 0;

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
    }, [loads, cp, rho, deltaT, vTarget]);

    const addLoad = () => {
        const newId = loads.length > 0 ? Math.max(...loads.map(l => l.id)) + 1 : 1;
        setLoads([...loads, { id: newId, name: `Utenza ${newId}`, mode: 'power', inputVal: 300, material: 'Acciaio', DN: '50', PN: 'NORM' }]);
    };

    const duplicateLoad = (id) => {
        const loadToCopy = loads.find(l => l.id === id);
        if (!loadToCopy) return;
        const newId = loads.length > 0 ? Math.max(...loads.map(l => l.id)) + 1 : 1;
        setLoads([...loads, { ...loadToCopy, id: newId, name: loadToCopy.name + " (Copia)" }]);
    };

    const updateLoad = (id, field, val) => {
        setLoads(prev => prev.map(l => {
            if (l.id === id) {
                let updated = { ...l, [field]: val };
                
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

    const removeLoad = (id) => setLoads(loads.filter(l => l.id !== id));

    const totalKW = processedLoads.reduce((s, l) => s + l.calcPower_kW, 0);
    const totalM3H = processedLoads.reduce((s, l) => s + l.calcFlow_m3h, 0);

    return (
        <div className="max-w-6xl mx-auto">
            <ProjectHeader pData={projectData} setPData={setProjectData} title="Calcolo Carichi Termici & Reti" setAppMode={setAppMode} iconColor="orange" />
            
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 mb-6 print:shadow-none print:border-none print:p-0">
                <h3 className="text-sm font-bold text-slate-700 mb-4 print:border-b print:border-slate-800 print:pb-1">Parametri Acqua / Fluido Termovettore</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:gap-2">
                    {[{l: 'Calore Specifico (kJ/kg°C)', v: cp, set: setCp, step: "0.001"}, {l: 'Densità (kg/m³)', v: rho, set: setRho, step: "1"}, {l: '∆T Dimensionamento (°C)', v: deltaT, set: setDeltaT, step: "1"}, {l: 'Velocità Target Tubi (m/s)', v: vTarget, set: setVTarget, step: "0.1"}].map((f, i) => (
                        <div key={i} className="bg-slate-50 p-3 rounded-lg border border-slate-200 print:bg-transparent print:border-none print:p-0">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{f.l}</label>
                            <input type="number" step={f.step} value={f.v} onChange={e => f.set(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-transparent text-lg font-semibold text-slate-800 focus:outline-none print:text-base border-b border-slate-300 print:border-none focus:border-orange-500" />
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-4 print-hide">
                <div className="flex justify-between items-center bg-slate-800 text-white p-3 rounded-xl shadow-sm">
                    <h2 className="font-semibold text-sm flex items-center"><IconFlame className="w-4 h-4 mr-2"/> Utenze Termiche / Frigorifere</h2>
                </div>
                {processedLoads.length === 0 && <div className="bg-white p-8 rounded-xl border-2 border-dashed border-slate-300 text-center text-slate-500 text-sm">Nessuna utenza presente. Clicca su Aggiungi.</div>}
                
                {processedLoads.map((load) => (
                    <div key={load.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
                        
                        <div className="flex-1 space-y-3 pr-4 border-r border-slate-100">
                            <div className="flex items-center justify-between">
                                <input type="text" value={load.name} onChange={e => updateLoad(load.id, 'name', e.target.value)} className="font-bold text-lg text-slate-800 bg-transparent outline-none w-full border-b border-transparent hover:border-slate-300 focus:border-orange-500" placeholder="Nome Utenza" />
                                <div className="flex ml-2">
                                    <button onClick={()=>duplicateLoad(load.id)} className="p-1 text-slate-400 hover:bg-slate-100 hover:text-orange-600 rounded shrink-0 mr-1" title="Duplica"><IconCopy className="w-4 h-4"/></button>
                                    <button onClick={()=>removeLoad(load.id)} className="p-1 text-red-400 hover:bg-red-500 hover:text-white rounded shrink-0" title="Elimina"><IconTrash className="w-4 h-4"/></button>
                                </div>
                            </div>
                            <div className="flex items-center bg-slate-100 p-1 rounded">
                                <button onClick={()=>updateLoad(load.id,'mode','power')} className={`flex-1 text-xs font-bold py-1.5 rounded ${load.mode==='power'?'bg-white shadow text-orange-600':'text-slate-500'}`}>So i kWt</button>
                                <button onClick={()=>updateLoad(load.id,'mode','flow')} className={`flex-1 text-xs font-bold py-1.5 rounded ${load.mode==='flow'?'bg-white shadow text-orange-600':'text-slate-500'}`}>So la Portata</button>
                            </div>
                            <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Dato Noto ({load.mode === 'power' ? 'kW termici' : 'm³/h'})</label>
                                <input type="number" step="0.1" value={load.inputVal} onChange={e => updateLoad(load.id, 'inputVal', e.target.value===''?'' : Number(e.target.value))} className="w-full text-xl font-bold bg-transparent outline-none border-b border-slate-300 focus:border-orange-500"/>
                            </div>
                        </div>

                        <div className="flex-1 space-y-3 px-2">
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase">Risultato Conversione</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-orange-50 p-2 rounded border border-orange-100">
                                    <p className="text-[10px] font-bold text-orange-600 uppercase">Portata (m³/h)</p>
                                    <p className="font-mono font-bold text-orange-800">{load.calcFlow_m3h.toFixed(2)}</p>
                                </div>
                                <div className="bg-orange-50 p-2 rounded border border-orange-100">
                                    <p className="text-[10px] font-bold text-orange-600 uppercase">Potenza (kWt)</p>
                                    <p className="font-mono font-bold text-orange-800">{load.calcPower_kW.toFixed(1)}</p>
                                </div>
                                <div className="bg-slate-50 p-2 rounded border border-slate-100 col-span-2">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">Portata Massica (kg/h)</p>
                                    <p className="font-mono font-bold text-slate-700">{load.calcFlow_kgh.toFixed(1)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 space-y-3 pl-4 border-l border-slate-100">
                            <div className="flex justify-between items-center"><h4 className="text-[11px] font-bold text-slate-400 uppercase">Selezione Tubazione</h4><span className="text-[10px] text-slate-400">Ø Teorico: {load.d_teorico_mm?.toFixed(1)} mm</span></div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-3">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Materiale</label>
                                    <select value={load.material} onChange={e => updateLoad(load.id, 'material', e.target.value)} className="w-full text-xs p-1.5 border border-slate-300 rounded outline-none bg-slate-50">
                                        {Object.keys(PIPE_CATALOG).map(m=><option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">DN</label>
                                    <select value={load.DN} onChange={e => updateLoad(load.id, 'DN', e.target.value)} className="w-full text-xs p-1.5 border border-slate-300 rounded outline-none bg-slate-50">
                                        {Object.keys(PIPE_CATALOG[load.material].specs).map(dn=><option key={dn} value={dn}>{dn}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Classe</label>
                                    <select value={load.PN} onChange={e => updateLoad(load.id, 'PN', e.target.value)} className="w-full text-xs p-1.5 border border-slate-300 rounded outline-none bg-slate-50">
                                        {Object.keys(PIPE_CATALOG[load.material].specs[load.DN]||{}).map(pn=><option key={pn} value={pn}>{pn}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            <div className={`p-2 rounded border ${load.realVelocity <= vTarget + 0.2 && load.realVelocity >= vTarget - 0.5 ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">Tubo Selezionato</p>
                                        <p className="font-bold text-orange-800 text-lg">DN {load.DN}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-500">Int: {load.realD?.toFixed(1)} mm</p>
                                        <p className={`text-xs font-bold ${load.realVelocity > vTarget * 1.5 ? 'text-red-600' : 'text-orange-600'}`}>v = {load.realVelocity.toFixed(2)} m/s</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                
                <button onClick={addLoad} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold shadow-sm flex items-center hover:bg-slate-700"><IconPlus className="w-4 h-4 mr-2"/> Aggiungi Utenza</button>
            </div>

            <div className="hidden print:block mt-6">
                <h3 className="text-sm font-bold text-slate-800 mb-2 border-b-2 border-slate-800 pb-1">Distinta Utenze e Dimensionamento Tubazioni</h3>
                <table className="w-full text-left border-collapse text-xs mt-2">
                    <thead>
                        <tr className="border-b border-slate-300">
                            <th className="py-2">Utenza</th>
                            <th className="py-2">Potenza (kWt)</th>
                            <th className="py-2">Portata (m³/h)</th>
                            <th className="py-2">Mat. Tubo</th>
                            <th className="py-2">DN / PN Selez.</th>
                            <th className="py-2 text-right">Velocità (m/s)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processedLoads.map(l => (
                            <tr key={l.id} className="border-b border-slate-100">
                                <td className="py-1 font-bold">{l.name}</td>
                                <td className="py-1 font-mono">{l.calcPower_kW.toFixed(1)}</td>
                                <td className="py-1 font-mono">{l.calcFlow_m3h.toFixed(2)}</td>
                                <td className="py-1">{l.material}</td>
                                <td className="py-1 font-bold">DN {l.DN} - {l.PN}</td>
                                <td className="py-1 text-right font-mono">{l.realVelocity.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                <div className="flex gap-4 mt-8 mx-auto max-w-lg">
                    <div className="flex-1 p-3 rounded-lg border-2 border-slate-800 text-center">
                        <p className="text-[10px] font-bold uppercase text-slate-600 mb-1">Totale Potenza Termica</p>
                        <p className="text-2xl font-mono font-black">{totalKW.toFixed(1)} kW</p>
                    </div>
                    <div className="flex-1 p-3 rounded-lg border-2 border-slate-800 text-center">
                        <p className="text-[10px] font-bold uppercase text-slate-600 mb-1">Totale Portata Flusso</p>
                        <p className="text-2xl font-mono font-black">{totalM3H.toFixed(1)} m³/h</p>
                    </div>
                </div>
            </div>

            <div className="mt-6 bg-slate-800 text-white p-4 rounded-xl flex justify-around items-center print-hide shadow-lg">
                <div className="text-center">
                    <p className="text-xs text-slate-300 uppercase font-bold tracking-wide">Potenza Totale Rete</p>
                    <p className="text-2xl font-mono font-black">{totalKW.toFixed(1)} <span className="text-sm font-sans font-normal">kWt</span></p>
                </div>
                <div className="w-px h-10 bg-slate-600"></div>
                <div className="text-center">
                    <p className="text-xs text-slate-300 uppercase font-bold tracking-wide">Portata Totale Rete</p>
                    <p className="text-2xl font-mono font-black">{totalM3H.toFixed(1)} <span className="text-sm font-sans font-normal">m³/h</span></p>
                </div>
            </div>
        </div>
    );
}
