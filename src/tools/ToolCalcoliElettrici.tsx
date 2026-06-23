import React, { useState, useEffect, useMemo } from 'react';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import { formatNumber } from '../utils/format';
import { Zap, Calculator, Table, Printer } from 'lucide-react';

interface ToolCalcoliElettriciProps {
  projectData: ProjectData;
  setProjectData: (data: any) => void;
  setAppMode: (mode: string) => void;
}

interface CalcoliElettriciData {
  activeSubTool: 'sezione' | 'caduta' | 'portata_tab';
  // Sezione inputs
  sezioneCorrente: string;
  sezioneTensione: string;
  sezionePotenza: string;
  sezioneCaduta: string;
  sezioneLunghezza: string;
  // Caduta inputs
  cadutaCorrente: string;
  cadutaTensione: string;
  cadutaPotenza: string;
  cadutaSezione: string;
  cadutaLunghezza: string;
}

const defaultData: CalcoliElettriciData = {
  activeSubTool: 'sezione',
  sezioneCorrente: '2', // Monofase default
  sezioneTensione: '230',
  sezionePotenza: '',
  sezioneCaduta: '9.2', // ~4% di 230V
  sezioneLunghezza: '',
  
  cadutaCorrente: '2',
  cadutaTensione: '230',
  cadutaPotenza: '',
  cadutaSezione: '2.5',
  cadutaLunghezza: ''
};

const SEZIONI_COMMERCIALI = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150];

export function ToolCalcoliElettrici({ projectData, setProjectData, setAppMode }: ToolCalcoliElettriciProps) {
  const [data, setData] = useState<CalcoliElettriciData>(defaultData);

  // Calcolo dei risultati per "Sezione Cavi"
  const sezioneResults = useMemo(() => {
    const tensione = parseFloat(data.sezioneTensione) || 0;
    const potenza = parseFloat(data.sezionePotenza) || 0;
    const caduta = parseFloat(data.sezioneCaduta) || 0;
    const lunghezza = parseFloat(data.sezioneLunghezza) || 0;
    const tipologia = data.sezioneCorrente;

    if (tensione <= 0 || potenza <= 0 || caduta <= 0 || lunghezza <= 0) {
      return { sezioneTeorica: 0, sezioneCommerciale: 0, corrente: 0 };
    }

    let resistenza = 0;
    let sezioneTeorica = 0;
    let corrente = 0;
    const cosPhi = 0.9;

    if (tipologia === '1') {
      // Continua
      corrente = potenza / tensione;
      resistenza = (caduta / (2 * potenza)) * tensione;
      sezioneTeorica = 0.0178 * (lunghezza / resistenza);
    } else if (tipologia === '2') {
      // Monofase
      corrente = potenza / (tensione * cosPhi);
      resistenza = (caduta / (2 * potenza)) * tensione;
      sezioneTeorica = 0.0178 * (lunghezza / resistenza);
    } else if (tipologia === '3') {
      // Trifase
      corrente = potenza / (tensione * cosPhi * Math.sqrt(3));
      resistenza = (caduta * tensione) / potenza;
      sezioneTeorica = 0.0178 * (lunghezza / resistenza);
    }

    // Trova la sezione commerciale successiva o uguale
    const sezioneCommerciale = SEZIONI_COMMERCIALI.find(s => s >= sezioneTeorica) || SEZIONI_COMMERCIALI[SEZIONI_COMMERCIALI.length - 1];

    return {
      sezioneTeorica,
      sezioneCommerciale,
      corrente
    };
  }, [data.sezioneTensione, data.sezionePotenza, data.sezioneCaduta, data.sezioneLunghezza, data.sezioneCorrente]);

  // Calcolo dei risultati per "Caduta di Tensione"
  const cadutaResults = useMemo(() => {
    const tensione = parseFloat(data.cadutaTensione) || 0;
    const potenza = parseFloat(data.cadutaPotenza) || 0;
    const sezione = parseFloat(data.cadutaSezione) || 0.01;
    const lunghezza = parseFloat(data.cadutaLunghezza) || 0;
    const tipologia = data.cadutaCorrente;

    if (tensione <= 0 || potenza <= 0 || sezione <= 0 || lunghezza <= 0) {
      return { cadutaVolt: 0, cadutaPerc: 0, corrente: 0 };
    }

    const resistenza = 0.0178 * (lunghezza / sezione);
    let cadutaVolt = 0;
    let corrente = 0;
    const cosPhi = 0.9;

    if (tipologia === '1') {
      // Continua
      corrente = potenza / tensione;
      cadutaVolt = 2 * resistenza * corrente;
    } else if (tipologia === '2') {
      // Monofase
      corrente = potenza / (tensione * cosPhi);
      cadutaVolt = 2 * resistenza * corrente * cosPhi;
    } else if (tipologia === '3') {
      // Trifase
      corrente = potenza / (tensione * cosPhi * Math.sqrt(3));
      cadutaVolt = Math.sqrt(3) * corrente * cosPhi * resistenza;
    }

    const cadutaPerc = (cadutaVolt / tensione) * 100;

    return {
      cadutaVolt,
      cadutaPerc,
      corrente
    };
  }, [data.cadutaTensione, data.cadutaPotenza, data.cadutaSezione, data.cadutaLunghezza, data.cadutaCorrente]);

  // Integrazione ProjectStorage
  const handleLoadProject = (loadedData: any) => {
    if (loadedData) {
      setData({ ...defaultData, ...loadedData });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const updateField = (field: keyof CalcoliElettriciData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="bg-slate-100 rounded-3xl p-6 md:p-8 animate-in fade-in duration-300">
      {/* Header dello strumento */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-slate-200 print:hidden">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <span className="p-2 bg-amber-100 text-amber-600 rounded-2xl"><Zap className="w-6 h-6" /></span>
            Calcoli Elettrici Rapidi
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Dimensionamento cavi BT in rame e verifica della caduta di tensione percentuale
          </p>
        </div>
        <div className="flex gap-2">
          <ProjectStorage 
            toolType="calcoli_elettrici" 
            currentData={data} 
            onLoadProject={handleLoadProject} 
            projectInfo={projectData} 
            setProjectInfo={setProjectData} 
          />
        </div>
      </div>

      {/* Intestazione del progetto standard */}
      <ProjectHeader pData={projectData} setPData={setProjectData} title="Calcoli Elettrici Rapidi" setAppMode={setAppMode} iconColor="orange" />

      {/* Contenitore Principale a due colonne */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Colonna Sinistra: Sidebar di selezione (Invisibile in stampa) */}
        <div className="w-full md:w-64 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm shrink-0 print:hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Seleziona Calcolo</p>
          </div>
          <div className="flex flex-col divide-y divide-slate-100">
            <button
              onClick={() => updateField('activeSubTool', 'sezione')}
              className={`w-full text-left p-4 text-xs font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                data.activeSubTool === 'sezione' 
                  ? 'bg-amber-500/10 text-amber-700 border-l-4 border-amber-500' 
                  : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Calculator className="w-4 h-4 mr-1" />
              <span>Dimensionamento Sezione</span>
            </button>
            <button
              onClick={() => updateField('activeSubTool', 'caduta')}
              className={`w-full text-left p-4 text-xs font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                data.activeSubTool === 'caduta' 
                  ? 'bg-amber-500/10 text-amber-700 border-l-4 border-amber-500' 
                  : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Zap className="w-4 h-4 mr-1" />
              <span>Caduta di Tensione</span>
            </button>
            <button
              onClick={() => updateField('activeSubTool', 'portata_tab')}
              className={`w-full text-left p-4 text-xs font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                data.activeSubTool === 'portata_tab' 
                  ? 'bg-amber-500/10 text-amber-700 border-l-4 border-amber-500' 
                  : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Table className="w-4 h-4 mr-1" />
              <span>Tabella Portata Cavi BT</span>
            </button>
          </div>
        </div>

        {/* Colonna Destra: Modulo di Calcolo attivo */}
        <div className="flex-1 w-full">
          {/* 1. Dimensionamento Sezione Cavi */}
          {data.activeSubTool === 'sezione' && (
            <div className="space-y-6">
              {/* Box Calcolo (Schermo) */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0">
                <h3 className="text-base font-black text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                  <span className="p-1 bg-amber-100 text-amber-600 rounded-lg"><Calculator className="w-4 h-4" /></span>
                  Calcolo Sezione Conduttori
                </h3>

                <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 mb-5 text-xs text-slate-650 space-y-2.5 print:hidden">
                  <p><strong>Descrizione:</strong> Calcola la sezione minima teorica dei conduttori in rame (resistività ρ = 0.0178 Ω·mm²/m a 20°C) necessaria per limitare la caduta di tensione entro la soglia desiderata, proponendo la sezione commerciale standard più idonea.</p>
                  <div className="bg-white/80 border border-amber-100 rounded-xl p-4 text-slate-600">
                    <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Formule di calcolo della sezione:</p>
                    <div className="space-y-3 font-serif pl-2 text-sm">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>• Corrente Continua o Alternata Monofase (cos φ = 0.9):</span>
                        <span className="font-bold text-slate-800">S =</span>
                        <span className="inline-flex flex-col items-center align-middle mx-1 text-xs">
                          <span className="border-b border-slate-400 px-1.5 pb-0.5 text-center font-bold">2 × ρ × L × W</span>
                          <span className="px-1.5 pt-0.5 text-center font-bold">V × ΔV<sub>amm</sub></span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>• Alternata Trifase (cos φ = 0.9):</span>
                        <span className="font-bold text-slate-800">S =</span>
                        <span className="inline-flex flex-col items-center align-middle mx-1 text-xs">
                          <span className="border-b border-slate-400 px-1.5 pb-0.5 text-center font-bold">ρ × L × W</span>
                          <span className="px-1.5 pt-0.5 text-center font-bold">V × ΔV<sub>amm</sub></span>
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-400 text-[9px] mt-3 italic font-sans border-t border-slate-100 pt-2">* Legenda: S = Sezione [mm²], L = Lunghezza [m], W = Potenza [W], V = Tensione [V], ΔV<sub>amm</sub> = Caduta ammessa [V].</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
                  {/* Campi di input */}
                  <div className="space-y-4 print:hidden">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Corrente Alimentazione</label>
                      <select 
                        value={data.sezioneCorrente}
                        onChange={e => updateField('sezioneCorrente', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      >
                        <option value="1">Corrente Continua (CC)</option>
                        <option value="2">Alternata Monofase (AC)</option>
                        <option value="3">Alternata Trifase (AC)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Tensione (V)</label>
                        <input 
                          type="number"
                          step="any"
                          value={data.sezioneTensione}
                          onChange={e => updateField('sezioneTensione', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Potenza (W)</label>
                        <input 
                          type="number"
                          step="any"
                          value={data.sezionePotenza}
                          onChange={e => updateField('sezionePotenza', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Caduta Ammessa (V)</label>
                        <input 
                          type="number"
                          step="any"
                          value={data.sezioneCaduta}
                          onChange={e => updateField('sezioneCaduta', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Lunghezza Linea (m)</label>
                        <input 
                          type="number"
                          step="any"
                          value={data.sezioneLunghezza}
                          onChange={e => updateField('sezioneLunghezza', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tabella di riepilogo in stampa (sostituisce gli input) */}
                  <div className="hidden print:block border border-slate-200 rounded-2xl p-4 space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b pb-1 mb-2">Dati di Ingresso</p>
                    <div className="grid grid-cols-2 gap-y-1.5 text-[11px] text-slate-650">
                      <div><strong>Tipo Corrente:</strong></div>
                      <div>{data.sezioneCorrente === '1' ? 'Continua' : data.sezioneCorrente === '2' ? 'Monofase' : 'Trifase'}</div>
                      <div><strong>Tensione:</strong></div>
                      <div>{formatNumber(data.sezioneTensione, 0)} V</div>
                      <div><strong>Potenza Apparecchio:</strong></div>
                      <div>{formatNumber(data.sezionePotenza, 0)} W</div>
                      <div><strong>Caduta di Tensione Limite:</strong></div>
                      <div>{formatNumber(data.sezioneCaduta, 1)} V</div>
                      <div><strong>Lunghezza Condotta:</strong></div>
                      <div>{formatNumber(data.sezioneLunghezza, 1)} m</div>
                    </div>
                  </div>

                  {/* Box Risultati */}
                  <div className="bg-amber-50/50 border border-amber-200/60 rounded-3xl p-6 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-4 border-b border-amber-200 pb-1.5">Risultati di Dimensionamento</p>
                      
                      <div className="space-y-4">
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Sezione Teorica Calcolata</p>
                          <p className="text-3xl font-mono font-black text-slate-800">{formatNumber(sezioneResults.sezioneTeorica, 3)} <span className="text-sm font-sans font-normal text-slate-450">mm²</span></p>
                        </div>

                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Sezione Commerciale Consigliata</p>
                          <p className="text-4xl font-mono font-black text-amber-600">{formatNumber(sezioneResults.sezioneCommerciale, 1)} <span className="text-base font-sans font-normal text-slate-450">mm²</span></p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-amber-200/50 text-[11px] text-slate-600 space-y-1">
                      <p><strong>Corrente di impiego (Ib):</strong> {formatNumber(sezioneResults.corrente, 2)} A</p>
                      <p><strong>Costante di resistività rame:</strong> 0.0178 Ω·mm²/m</p>
                      <p className="text-[10px] text-slate-400 leading-normal mt-2 italic print:hidden">
                        * Nota: Il calcolo è basato sulla formula della resistenza a incognita libera del rame a 20°C con fattore di potenza cosφ = 0.9 per i calcoli in alternata.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Caduta di Tensione */}
          {data.activeSubTool === 'caduta' && (
            <div className="space-y-6">
              {/* Box Calcolo (Schermo) */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0">
                <h3 className="text-base font-black text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                  <span className="p-1 bg-amber-100 text-amber-600 rounded-lg"><Zap className="w-4 h-4" /></span>
                  Verifica Caduta di Tensione
                </h3>

                <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 mb-5 text-xs text-slate-655 space-y-2.5 print:hidden">
                  <p><strong>Descrizione:</strong> Verifica la caduta di tensione (in Volt ed in percentuale) generata lungo una linea elettrica in rame a sezione nota, confrontando il risultato con il limite consigliato del 4% per gli impianti terminali.</p>
                  <div className="bg-white/80 border border-amber-100 rounded-xl p-4 text-slate-600">
                    <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Formule della caduta di tensione:</p>
                    <div className="space-y-3 font-serif pl-2 text-sm">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>• Corrente Continua:</span>
                        <span className="font-bold text-slate-800">ΔV = 2 ×</span>
                        <span className="inline-flex items-center align-middle text-xs mx-1">
                          <span>(</span>
                          <span className="inline-flex flex-col items-center align-middle mx-1 text-[10px]">
                            <span className="border-b border-slate-400 px-1.5 pb-0.5 text-center font-bold">ρ × L</span>
                            <span className="px-1.5 pt-0.5 text-center font-bold">S</span>
                          </span>
                          <span>)</span>
                        </span>
                        <span>× I</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>• Alternata Monofase:</span>
                        <span className="font-bold text-slate-800">ΔV = 2 ×</span>
                        <span className="inline-flex items-center align-middle text-xs mx-1">
                          <span>(</span>
                          <span className="inline-flex flex-col items-center align-middle mx-1 text-[10px]">
                            <span className="border-b border-slate-400 px-1.5 pb-0.5 text-center font-bold">ρ × L</span>
                            <span className="px-1.5 pt-0.5 text-center font-bold">S</span>
                          </span>
                          <span>)</span>
                        </span>
                        <span>× I × cos φ</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>• Alternata Trifase:</span>
                        <span className="font-bold text-slate-800">ΔV = √3 ×</span>
                        <span className="inline-flex items-center align-middle text-xs mx-1">
                          <span>(</span>
                          <span className="inline-flex flex-col items-center align-middle mx-1 text-[10px]">
                            <span className="border-b border-slate-400 px-1.5 pb-0.5 text-center font-bold">ρ × L</span>
                            <span className="px-1.5 pt-0.5 text-center font-bold">S</span>
                          </span>
                          <span>)</span>
                        </span>
                        <span>× I × cos φ</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>• Caduta percentuale:</span>
                        <span className="font-bold text-slate-800">ΔV% =</span>
                        <span className="inline-flex flex-col items-center align-middle mx-1 text-xs">
                          <span className="border-b border-slate-400 px-1.5 pb-0.5 text-center font-bold">ΔV</span>
                          <span className="px-1.5 pt-0.5 text-center font-bold">V</span>
                        </span>
                        <span>× 100</span>
                      </div>
                    </div>
                    <p className="text-slate-400 text-[9px] mt-3 italic font-sans border-t border-slate-100 pt-2">* Con: ρ = 0.0178 Ω·mm²/m (Rame), cos φ = 0.9 (Fattore di potenza stimato in alternata).</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
                  {/* Campi di input */}
                  <div className="space-y-4 print:hidden">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Corrente Alimentazione</label>
                      <select 
                        value={data.cadutaCorrente}
                        onChange={e => updateField('cadutaCorrente', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      >
                        <option value="1">Corrente Continua (CC)</option>
                        <option value="2">Alternata Monofase (AC)</option>
                        <option value="3">Alternata Trifase (AC)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Tensione (V)</label>
                        <input 
                          type="number"
                          step="any"
                          value={data.cadutaTensione}
                          onChange={e => updateField('cadutaTensione', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Potenza (W)</label>
                        <input 
                          type="number"
                          step="any"
                          value={data.cadutaPotenza}
                          onChange={e => updateField('cadutaPotenza', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Sezione Cavo (mm²)</label>
                        <select
                          value={data.cadutaSezione}
                          onChange={e => updateField('cadutaSezione', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                          {SEZIONI_COMMERCIALI.map(s => (
                            <option key={s} value={s}>{s} mm²</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Lunghezza Linea (m)</label>
                        <input 
                          type="number"
                          step="any"
                          value={data.cadutaLunghezza}
                          onChange={e => updateField('cadutaLunghezza', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tabella di riepilogo in stampa (sostituisce gli input) */}
                  <div className="hidden print:block border border-slate-200 rounded-2xl p-4 space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b pb-1 mb-2">Dati di Ingresso</p>
                    <div className="grid grid-cols-2 gap-y-1.5 text-[11px] text-slate-650">
                      <div><strong>Tipo Corrente:</strong></div>
                      <div>{data.cadutaCorrente === '1' ? 'Continua' : data.cadutaCorrente === '2' ? 'Monofase' : 'Trifase'}</div>
                      <div><strong>Tensione:</strong></div>
                      <div>{formatNumber(data.cadutaTensione, 0)} V</div>
                      <div><strong>Potenza Apparecchio:</strong></div>
                      <div>{formatNumber(data.cadutaPotenza, 0)} W</div>
                      <div><strong>Sezione Tubo/Cavo:</strong></div>
                      <div>{formatNumber(data.cadutaSezione, 1)} mm²</div>
                      <div><strong>Lunghezza Condotta:</strong></div>
                      <div>{formatNumber(data.cadutaLunghezza, 1)} m</div>
                    </div>
                  </div>

                  {/* Box Risultati */}
                  <div className="bg-amber-50/50 border border-amber-200/60 rounded-3xl p-6 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-4 border-b border-amber-200 pb-1.5">Risultati di Verifica</p>
                      
                      <div className="space-y-4">
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Caduta di Tensione Totale</p>
                          <p className="text-3xl font-mono font-black text-slate-800">{formatNumber(cadutaResults.cadutaVolt, 2)} <span className="text-sm font-sans font-normal text-slate-450">V</span></p>
                        </div>

                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Caduta di Tensione Percentuale</p>
                          <p className={`text-4xl font-mono font-black ${cadutaResults.cadutaPerc > 4 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatNumber(cadutaResults.cadutaPerc, 2)} %
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-amber-200/50 text-[11px] text-slate-600 space-y-1">
                      <p><strong>Corrente calcolata (Ib):</strong> {formatNumber(cadutaResults.corrente, 2)} A</p>
                      <p><strong>Stato verifica (Limite 4%):</strong> {cadutaResults.cadutaPerc <= 4 ? (
                        <span className="text-emerald-600 font-bold">✓ OK (Normativo)</span>
                      ) : (
                        <span className="text-red-650 font-bold">⚠️ ECCESSIVA (Consigliato sezione superiore)</span>
                      )}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Tabella Portata Cavi BT */}
          {data.activeSubTool === 'portata_tab' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
              <div>
                <h3 className="text-base font-black text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                  <span className="p-1 bg-amber-100 text-amber-600 rounded-lg"><Table className="w-4 h-4" /></span>
                  Portate Standard Conduttori in Rame BT
                </h3>

                <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 mb-5 text-xs text-slate-650 space-y-2.5 print:hidden">
                  <p><strong>Descrizione:</strong> Elenca la portata termica nominale di corrente (Iz) per conduttori in rame isolati in PVC o gomma, secondo le norme UNEL 35011-72 e IEC 60364-5-52, in base al numero di conduttori attivi e al tipo di posa.</p>
                  <div className="bg-white/80 border border-amber-100 rounded-xl p-4 text-slate-600">
                    <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Riferimenti normativi e fattori di correzione:</p>
                    <div className="space-y-3 font-serif pl-2 text-sm">
                      <div>• Posa in aria/tubazione: Tabella UNEL 35011-72 / CEI UNEL 35024 (conduttori in rame isolati in PVC a 70°C o gomma a 90°C).</div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>• Posa interrata: applicare il coefficiente correttivo di riduzione</span>
                        <span className="font-bold text-amber-600 bg-amber-50/50 px-2 py-0.5 rounded border border-amber-100">I<sub>z,corr</sub> = I<sub>z</sub> × 0.8</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sezione Unipolari */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">1. Conduttori Unipolari in Tubo (UNEL 35011-72)</p>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 text-[10px] uppercase">
                        <th className="py-2.5 px-4">Sezione [mm²]</th>
                        <th className="py-2.5 px-4 text-center">2 Conduttori Attivi</th>
                        <th className="py-2.5 px-4 text-center">3 Conduttori Attivi</th>
                        <th className="py-2.5 px-4 text-center">4 Conduttori Attivi</th>
                        <th className="py-2.5 px-4 text-center">6 Conduttori Attivi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono font-medium text-slate-700">
                      <tr>
                        <td className="py-2 px-4 font-bold font-sans">1.5</td>
                        <td className="py-2 px-4 text-center">17.5 A</td>
                        <td className="py-2 px-4 text-center">15.5 A</td>
                        <td className="py-2 px-4 text-center">14.0 A</td>
                        <td className="py-2 px-4 text-center">12.0 A</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-bold font-sans">2.5</td>
                        <td className="py-2 px-4 text-center">24.0 A</td>
                        <td className="py-2 px-4 text-center">21.0 A</td>
                        <td className="py-2 px-4 text-center">19.0 A</td>
                        <td className="py-2 px-4 text-center">16.5 A</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-bold font-sans">4.0</td>
                        <td className="py-2 px-4 text-center">32.0 A</td>
                        <td className="py-2 px-4 text-center">28.0 A</td>
                        <td className="py-2 px-4 text-center">25.0 A</td>
                        <td className="py-2 px-4 text-center">22.0 A</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-bold font-sans">6.0</td>
                        <td className="py-2 px-4 text-center">41.0 A</td>
                        <td className="py-2 px-4 text-center">36.0 A</td>
                        <td className="py-2 px-4 text-center">32.0 A</td>
                        <td className="py-2 px-4 text-center">28.0 A</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-bold font-sans">10.0</td>
                        <td className="py-2 px-4 text-center">57.0 A</td>
                        <td className="py-2 px-4 text-center">50.0 A</td>
                        <td className="py-2 px-4 text-center">44.0 A</td>
                        <td className="py-2 px-4 text-center">39.0 A</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-bold font-sans">16.0</td>
                        <td className="py-2 px-4 text-center">76.0 A</td>
                        <td className="py-2 px-4 text-center">68.0 A</td>
                        <td className="py-2 px-4 text-center">59.0 A</td>
                        <td className="py-2 px-4 text-center">52.5 A</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-bold font-sans">25.0</td>
                        <td className="py-2 px-4 text-center">101.0 A</td>
                        <td className="py-2 px-4 text-center">89.0 A</td>
                        <td className="py-2 px-4 text-center">75.0 A</td>
                        <td className="py-2 px-4 text-center">70.0 A</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-bold font-sans">35.0</td>
                        <td className="py-2 px-4 text-center">125.0 A</td>
                        <td className="py-2 px-4 text-center">111.0 A</td>
                        <td className="py-2 px-4 text-center">97.0 A</td>
                        <td className="py-2 px-4 text-center">86.0 A</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sezione Multipolari */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">2. Conduttori Multipolari in Aria (PVC / Gomma)</p>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 text-[10px] uppercase">
                        <th className="py-2.5 px-4" rowSpan={2}>Sezione [mm²]</th>
                        <th className="py-2.5 px-4 text-center" colSpan={3}>Posa in PVC / Gomma Comune</th>
                        <th className="py-2.5 px-4 text-center" colSpan={3}>Posa in Polietilene / Gomma G5</th>
                      </tr>
                      <tr className="bg-slate-50/50 border-b border-slate-200 font-bold text-slate-450 text-[9px] uppercase">
                        <th className="py-1 px-4 text-center">Bipolare</th>
                        <th className="py-1 px-4 text-center">Tripolare</th>
                        <th className="py-1 px-4 text-center">Tetrapolare</th>
                        <th className="py-1 px-4 text-center">Bipolare</th>
                        <th className="py-1 px-4 text-center">Tripolare</th>
                        <th className="py-1 px-4 text-center">Tetrapolare</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono font-medium text-slate-700">
                      <tr>
                        <td className="py-2 px-4 font-bold font-sans">1.5</td>
                        <td className="py-2 px-4 text-center">19.5 A</td>
                        <td className="py-2 px-4 text-center">17.5 A</td>
                        <td className="py-2 px-4 text-center">15.5 A</td>
                        <td className="py-2 px-4 text-center">24.0 A</td>
                        <td className="py-2 px-4 text-center">22.0 A</td>
                        <td className="py-2 px-4 text-center">19.5 A</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-bold font-sans">2.5</td>
                        <td className="py-2 px-4 text-center">26.0 A</td>
                        <td className="py-2 px-4 text-center">24.0 A</td>
                        <td className="py-2 px-4 text-center">21.0 A</td>
                        <td className="py-2 px-4 text-center">33.0 A</td>
                        <td className="py-2 px-4 text-center">30.0 A</td>
                        <td className="py-2 px-4 text-center">26.0 A</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-bold font-sans">4.0</td>
                        <td className="py-2 px-4 text-center">35.0 A</td>
                        <td className="py-2 px-4 text-center">32.0 A</td>
                        <td className="py-2 px-4 text-center">28.0 A</td>
                        <td className="py-2 px-4 text-center">45.0 A</td>
                        <td className="py-2 px-4 text-center">40.0 A</td>
                        <td className="py-2 px-4 text-center">35.0 A</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-bold font-sans">6.0</td>
                        <td className="py-2 px-4 text-center">46.0 A</td>
                        <td className="py-2 px-4 text-center">41.0 A</td>
                        <td className="py-2 px-4 text-center">36.0 A</td>
                        <td className="py-2 px-4 text-center">58.0 A</td>
                        <td className="py-2 px-4 text-center">52.0 A</td>
                        <td className="py-2 px-4 text-center">46.0 A</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-bold font-sans">10.0</td>
                        <td className="py-2 px-4 text-center">63.0 A</td>
                        <td className="py-2 px-4 text-center">57.0 A</td>
                        <td className="py-2 px-4 text-center">50.0 A</td>
                        <td className="py-2 px-4 text-center">80.0 A</td>
                        <td className="py-2 px-4 text-center">71.0 A</td>
                        <td className="py-2 px-4 text-center">63.0 A</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-bold font-sans">16.0</td>
                        <td className="py-2 px-4 text-center">85.0 A</td>
                        <td className="py-2 px-4 text-center">76.0 A</td>
                        <td className="py-2 px-4 text-center">68.0 A</td>
                        <td className="py-2 px-4 text-center">107.0 A</td>
                        <td className="py-2 px-4 text-center">96.0 A</td>
                        <td className="py-2 px-4 text-center">85.0 A</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-bold font-sans">25.0</td>
                        <td className="py-2 px-4 text-center">112.0 A</td>
                        <td className="py-2 px-4 text-center">101.0 A</td>
                        <td className="py-2 px-4 text-center">89.0 A</td>
                        <td className="py-2 px-4 text-center">142.0 A</td>
                        <td className="py-2 px-4 text-center">127.0 A</td>
                        <td className="py-2 px-4 text-center">112.0 A</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-slate-400 italic leading-relaxed">
                  * Nota: Per cavi interrati in tubazioni, cunicoli non ventilati o cassette, applicare il coefficiente di correzione K1 = 0,8 sulla portata nominale della tabella.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
