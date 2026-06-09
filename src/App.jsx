import React, { useState } from 'react';
import { ToolProfiloIdraulico } from './tools/ToolProfiloIdraulico';
import { ToolCarichiTermici } from './tools/ToolCarichiTermici';
import { ToolDispersione } from './tools/ToolDispersione';
import { IconWaves, IconFlame, IconThermometer } from './components/Icons';

export default function App() {
    const [appMode, setAppMode] = useState('dashboard');
    
    const [projectData, setProjectData] = useState({
        client: 'Progetto Impianto',
        author: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    if (appMode === 'dashboard') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-100">
                <div className="max-w-3xl w-full bg-white rounded-3xl shadow-xl p-10 text-center">
                    <img src="/Logo.png" alt="Logo" className="h-20 mx-auto mb-6 object-contain" onError={(e) => e.target.style.display='none'} />
                    <h1 className="text-3xl font-black text-slate-800 mb-2">Suite Ingegneria</h1>
                    <p className="text-slate-500 mb-10">Seleziona lo strumento di calcolo per avviare il dimensionamento.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <button onClick={() => setAppMode('idraulico')} className="group flex flex-col items-center p-6 bg-slate-50 border-2 border-slate-200 rounded-2xl hover:border-brand-500 hover:bg-brand-50 transition-all text-left">
                            <div className="w-16 h-16 bg-blue-100 text-brand-600 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform"><IconWaves /></div>
                            <h2 className="text-lg font-bold text-slate-800 mb-2 text-center w-full">Profilo Idraulico</h2>
                            <p className="text-xs text-slate-500 text-center">Perdite di carico, scabrezza e salti piezometrici.</p>
                        </button>

                        <button onClick={() => setAppMode('termico')} className="group flex flex-col items-center p-6 bg-slate-50 border-2 border-slate-200 rounded-2xl hover:border-orange-500 hover:bg-orange-50 transition-all text-left">
                            <div className="w-16 h-16 bg-orange-100 text-orange-600 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform"><IconFlame /></div>
                            <h2 className="text-lg font-bold text-slate-800 mb-2 text-center w-full">Carichi Termici</h2>
                            <p className="text-xs text-slate-500 text-center">Calcolo portate da kWt e ricerca auto-tubazione.</p>
                        </button>

                        <button onClick={() => setAppMode('dispersione')} className="group flex flex-col items-center p-6 bg-slate-50 border-2 border-slate-200 rounded-2xl hover:border-redbrand-500 hover:bg-redbrand-50 transition-all text-left">
                            <div className="w-16 h-16 bg-redbrand-100 text-redbrand-600 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform"><IconThermometer /></div>
                            <h2 className="text-lg font-bold text-slate-800 mb-2 text-center w-full">Dispersioni</h2>
                            <p className="text-xs text-slate-500 text-center">Isolamento tubazioni, scambio termico e temp. superficiale.</p>
                        </button>
                    </div>
                    <div className="mt-8 text-xs text-slate-400">Progettato per reti di distribuzione fluidi.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            {appMode === 'idraulico' && <ToolProfiloIdraulico projectData={projectData} setProjectData={setProjectData} setAppMode={setAppMode} />}
            {appMode === 'termico' && <ToolCarichiTermici projectData={projectData} setProjectData={setProjectData} setAppMode={setAppMode} />}
            {appMode === 'dispersione' && <ToolDispersione projectData={projectData} setProjectData={setProjectData} setAppMode={setAppMode} />}
        </div>
    );
}
