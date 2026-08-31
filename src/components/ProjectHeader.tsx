import React, { useState } from 'react';
import { IconPrinter, IconDroplets } from './Icons';
import logoImg from '../assets/Logo.png';

export interface ProjectData {
  client: string;
  author: string;
  date: string;
  notes: string;
  descriptionVerifica?: string;
  revision?: string;
}

interface ProjectHeaderProps {
  pData: ProjectData;
  setPData: (data: any) => void;
  title: string;
  setAppMode: (mode: string) => void;
  iconColor?: 'brand' | 'orange' | 'red' | 'redbrand' | 'purple';
  showPrintButton?: boolean;
  docCode?: string;
}

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({ 
  pData, 
  setPData, 
  title, 
  setAppMode, 
  iconColor = 'brand',
  showPrintButton = true,
  docCode
}) => {
    const [logoError, setLogoError] = useState<boolean>(false);
    const iconBg = iconColor === 'brand' 
      ? 'bg-brand-600' 
      : (iconColor === 'orange' 
          ? 'bg-orange-600' 
          : (iconColor === 'redbrand' 
              ? 'bg-redbrand-600' 
              : (iconColor === 'purple' 
                  ? 'bg-purple-600' 
                  : 'bg-red-600')));
    
    // Configura le classi CSS dinamiche per evitare problemi di compilazione
    const textBrandClass = iconColor === 'brand' 
      ? 'text-brand-600' 
      : (iconColor === 'orange' 
          ? 'text-orange-600' 
          : (iconColor === 'purple' 
              ? 'text-purple-650' 
              : 'text-redbrand-600'));
              
    const focusBorderClass = iconColor === 'brand' 
      ? 'focus:border-brand-500' 
      : (iconColor === 'orange' 
          ? 'focus:border-orange-500' 
          : (iconColor === 'purple' 
              ? 'focus:border-purple-500' 
              : 'focus:border-redbrand-500'));


    return (
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 mb-6 print:shadow-none print:border-none print:p-0 print:mb-2">
            {showPrintButton && (
                <div className="flex justify-end items-center mb-6 print:hidden">
                    <button onClick={() => window.print()} className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer">
                        <IconPrinter className="w-4 h-4 mr-2"/> Stampa Report
                    </button>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:flex-row print:justify-between print:items-start print:w-full print:border-b-2 print:border-slate-800 print:pb-4 print:mb-4">
                <div className="flex items-center space-x-4 flex-1 w-full print:w-full print:items-start">
                    {!logoError ? (
                        <img src={logoImg} alt="Logo" className="h-12 w-auto object-contain print:h-12" onError={() => setLogoError(true)} />
                    ) : (
                        <div className={`${iconBg} p-2 rounded-lg print:bg-slate-800 w-10 h-10`}>
                            <IconDroplets className="text-white" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        {/* Riga Superiore: Titolo Strumento a Sinistra e Codice Documento / Rev a Destra in Stampa */}
                        <div className="flex justify-between items-baseline gap-4 w-full">
                            <p className={`text-xs font-bold uppercase tracking-wider mb-1 print:text-slate-500 ${textBrandClass}`}>{title}</p>
                            
                            {/* Visualizzazione in Stampa: Codice Identificativo e subito a seguire la Revisione (sempre precompilata con Rev) */}
                            <span className="hidden print:inline-block text-[11px] font-bold text-slate-600 font-mono tracking-tight text-right shrink-0">
                                {docCode 
                                    ? `${docCode} - ${pData.revision ? (pData.revision.toUpperCase().startsWith('REV') ? pData.revision : `Rev${pData.revision}`) : 'Rev00'}`
                                    : (pData.revision ? (pData.revision.toUpperCase().startsWith('REV') ? pData.revision : `Rev${pData.revision}`) : 'Rev00')}
                            </span>
                        </div>

                        <span className="hidden print:block text-2xl md:text-3xl font-bold text-slate-900 leading-tight">{pData.client || 'Progetto Impianto'}</span>
                        <input type="text" value={pData.client} onChange={e => setPData({...pData, client: e.target.value})} className={`text-2xl md:text-3xl font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:outline-none w-full max-w-xl print:hidden ${focusBorderClass}`} placeholder="Inserisci Titolo o Cliente..."/>
                        
                        {/* Descrizione Verifica */}
                        <div className="mt-1">
                            {pData.descriptionVerifica && (
                                <span className="hidden print:block text-xs font-medium text-slate-500 italic">
                                    {pData.descriptionVerifica}
                                </span>
                            )}
                            <input 
                                type="text" 
                                value={pData.descriptionVerifica || ''} 
                                onChange={e => setPData({...pData, descriptionVerifica: e.target.value})} 
                                className={`text-xs font-medium text-slate-500 bg-transparent border-b border-transparent hover:border-slate-300 focus:outline-none w-full max-w-xl print:hidden ${focusBorderClass}`} 
                                placeholder="Descrizione Verifica (opzionale)..."
                            />
                        </div>
                    </div>
                </div>

                {/* Revisione & Codice a Schermo (Invisibile in Stampa) */}
                <div className="flex flex-col items-end w-full md:w-auto print:hidden mt-2 md:mt-0">
                    {docCode && (
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded mb-1 shadow-2xs">
                            {docCode}
                        </span>
                    )}
                    <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-slate-600 select-none">Rev.</span>
                        <input 
                            type="text" 
                            maxLength={4}
                            value={(pData.revision ?? '').replace(/^rev\.?\s*/i, '')} 
                            onChange={e => {
                                const raw = e.target.value.replace(/^rev\.?\s*/i, '').replace(/[^0-9a-zA-Z]/g, '').trim();
                                setPData({...pData, revision: raw ? `Rev${raw}` : ''});
                            }} 
                            onBlur={() => {
                                const clean = (pData.revision || '').replace(/^rev\.?\s*/i, '').trim();
                                if (!clean) {
                                    setPData({...pData, revision: 'Rev00'});
                                } else if (/^\d+$/.test(clean) && clean.length === 1) {
                                    setPData({...pData, revision: `Rev0${clean}`});
                                } else {
                                    setPData({...pData, revision: `Rev${clean}`});
                                }
                            }}
                            className={`text-center text-sm font-bold text-slate-800 bg-transparent border-b border-slate-300 focus:outline-none w-12 ${focusBorderClass}`} 
                            placeholder="00"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 print:bg-transparent print:border-none print:p-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
                    <div className="flex space-x-4">
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Progettista / Autore</label>
                            <span className="hidden print:block text-sm font-medium text-slate-700">{pData.author || '-'}</span>
                            <input type="text" value={pData.author} onChange={e => setPData({...pData, author: e.target.value})} placeholder="Tuo Nome..." className="w-full bg-transparent text-sm font-medium text-slate-700 focus:outline-none border-b border-slate-300 print:hidden" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data</label>
                            <span className="hidden print:block text-sm font-medium text-slate-700">{pData.date ? new Date(pData.date).toLocaleDateString('it-IT') : '-'}</span>
                            <input type="date" value={pData.date} onChange={e => setPData({...pData, date: e.target.value})} className="w-full bg-transparent text-sm font-medium text-slate-700 focus:outline-none border-b border-slate-300 print:hidden" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Note Tecniche</label>
                        <p className="hidden print:block text-sm text-slate-600 whitespace-pre-wrap">{pData.notes || 'Nessuna nota.'}</p>
                        <input type="text" value={pData.notes} onChange={e => setPData({...pData, notes: e.target.value})} placeholder="Inserisci note sul progetto..." className="w-full bg-transparent text-sm font-medium text-slate-700 focus:outline-none border-b border-slate-300 print:hidden" />
                    </div>
                </div>
            </div>
        </div>
    );
};
