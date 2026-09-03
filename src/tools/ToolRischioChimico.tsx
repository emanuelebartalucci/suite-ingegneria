import React, { useState, useMemo } from 'react';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import { DpiIcon } from '../components/DpiIcons';
import logoImg from '../assets/Logo.png';
import { 
  ChemicalProduct, 
  GeneralInfo, 
  H_PHRASES_2026, 
  DEFAULT_DPI_CATALOG, 
  createEmptyProduct, 
  evaluateMoVaRisCh, 
  RiskEvaluationResult 
} from '../data/movarisch2026Data';
import { 
  FlaskConical, 
  Plus, 
  Trash2, 
  Copy, 
  Search, 
  AlertTriangle, 
  Info, 
  Sparkles, 
  FileSpreadsheet, 
  Layers, 
  Wind, 
  Shield, 
  ShieldCheck, 
  Activity, 
  Building, 
  BookOpen,
  Printer
} from 'lucide-react';

interface ToolRischioChimicoProps {
  projectData: ProjectData;
  setProjectData: (data: any) => void;
  setAppMode: (mode: string) => void;
}

export const formatToItalianDate = (dateVal?: string): string => {
  if (!dateVal) return '—';
  const trimmed = String(dateVal).trim();
  if (!trimmed || trimmed === '0' || trimmed.startsWith('00/01/1900')) return '—';
  // Se è YYYY-MM-DD (es. input HTML date)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-');
    return `${d}/${m}/${y}`;
  }
  // Se è DD.MM.YYYY (es. da file excel originale)
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(trimmed)) {
    const parts = trimmed.split('.');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    return `${d}/${m}/${parts[2]}`;
  }
  // Se è già DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const parts = trimmed.split('/');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    return `${d}/${m}/${parts[2]}`;
  }
  // Fallback con parsing data standard
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, '0');
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const y = parsed.getFullYear();
    return `${d}/${m}/${y}`;
  }
  return trimmed;
};

export function ToolRischioChimico({
  projectData,
  setProjectData,
  setAppMode
}: ToolRischioChimicoProps) {
  // Navigazione a Tab principale (uniformata a HVAC e altri tool)
  const [activeTab, setActiveTab] = useState<'frontespizio' | 'prodotti' | 'riepilogo'>('frontespizio');

  // Dati Frontespizio / Anagrafica Mansione
  const [generalInfo, setGeneralInfo] = useState<GeneralInfo>({
    companyName: '',
    site: '',
    department: '',
    activity: '',
    jobRole: '',
    evaluator: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Lista multi-prodotto dinamica
  const [products, setProducts] = useState<ChemicalProduct[]>([
    createEmptyProduct('')
  ]);

  // ID Prodotto Attivo (per la modifica nella scheda)
  const [activeProductId, setActiveProductId] = useState<string>(() => products[0]?.id || '');

  // Ricerca frasi H nel selettore
  const [hSearchQuery, setHSearchQuery] = useState<string>('');
  const [selectedHCategory, setSelectedHCategory] = useState<string>('all');

  // Filtro categoria DPI
  const [selectedDpiCategory, setSelectedDpiCategory] = useState<string>('all');

  // Prodotto attualmente selezionato
  const currentProduct = useMemo(() => {
    return products.find(p => p.id === activeProductId) || products[0] || null;
  }, [products, activeProductId]);

  // Valutazioni calcolate per tutti i prodotti (cacheate)
  const evaluatedProducts = useMemo(() => {
    const map = new Map<string, { product: ChemicalProduct; evaluation: RiskEvaluationResult }>();
    products.forEach(p => {
      map.set(p.id, {
        product: p,
        evaluation: evaluateMoVaRisCh(p)
      });
    });
    return map;
  }, [products]);

  // Valutazione del prodotto attivo
  const currentEvaluation = useMemo(() => {
    if (!currentProduct) return null;
    return evaluatedProducts.get(currentProduct.id)?.evaluation || evaluateMoVaRisCh(currentProduct);
  }, [currentProduct, evaluatedProducts]);

  // Livello di rischio massimo riscontrato nella mansione (per il Frontespizio)
  const maxJobRisk = useMemo(() => {
    let maxVal = -1;
    let maxEval: RiskEvaluationResult | null = null;
    products.forEach(p => {
      const ev = evaluatedProducts.get(p.id)?.evaluation || evaluateMoVaRisCh(p);
      if (ev && ev.criticalRisk > maxVal) {
        maxVal = ev.criticalRisk;
        maxEval = ev;
      }
    });
    return maxEval || (products[0] ? evaluateMoVaRisCh(products[0]) : null);
  }, [products, evaluatedProducts]);

  // Handler aggiornamento campo prodotto attivo
  const updateCurrentProduct = (field: keyof ChemicalProduct, value: any) => {
    if (!currentProduct) return;
    setProducts(prev => prev.map(p => {
      if (p.id === currentProduct.id) {
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  // Handler aggiunta nuovo prodotto
  const handleAddProduct = () => {
    const newP = createEmptyProduct('');
    setProducts(prev => [...prev, newP]);
    setActiveProductId(newP.id);
    setActiveTab('prodotti');
    window.suiteUI?.toast('Nuova scheda prodotto aggiunta', 'success');
  };

  // Handler duplicazione prodotto
  const handleDuplicateProduct = (prodToDup: ChemicalProduct) => {
    const copyP: ChemicalProduct = {
      ...JSON.parse(JSON.stringify(prodToDup)),
      id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: `${prodToDup.name} (Copia)`
    };
    setProducts(prev => [...prev, copyP]);
    setActiveProductId(copyP.id);
    window.suiteUI?.toast(`Duplicato "${copyP.name}"`, 'info');
  };

  // Handler rimozione prodotto
  const handleDeleteProduct = async (idToDelete: string) => {
    if (products.length <= 1) {
      window.suiteUI?.toast('Deve essere presente almeno un prodotto chimico nella mansione.', 'warning');
      return;
    }
    const prod = products.find(p => p.id === idToDelete);
    const ok = await window.suiteUI?.confirm(`Sei sicuro di voler eliminare "${prod?.name || 'il prodotto'}"?`);
    if (!ok) return;

    setProducts(prev => {
      const filtered = prev.filter(p => p.id !== idToDelete);
      if (activeProductId === idToDelete) {
        setActiveProductId(filtered[0]?.id || '');
      }
      return filtered;
    });
    window.suiteUI?.toast('Prodotto eliminato.', 'info');
  };

  // Gestione TLV dinamici
  const handleAddTlvRow = () => {
    if (!currentProduct) return;
    const newTlv = {
      id: `tlv_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      substance: '',
      limitValue: '',
      limitType: 'TLV-TWA' as const
    };
    updateCurrentProduct('tlvLimits', [...(currentProduct.tlvLimits || []), newTlv]);
  };

  const handleUpdateTlvRow = (tlvId: string, field: 'substance' | 'limitValue' | 'limitType', val: string) => {
    if (!currentProduct) return;
    const updated = (currentProduct.tlvLimits || []).map(item => {
      if (item.id === tlvId) {
        return { ...item, [field]: val };
      }
      return item;
    });
    updateCurrentProduct('tlvLimits', updated);
  };

  const handleDeleteTlvRow = (tlvId: string) => {
    if (!currentProduct) return;
    const updated = (currentProduct.tlvLimits || []).filter(item => item.id !== tlvId);
    updateCurrentProduct('tlvLimits', updated);
  };

  // Gestione Toggle Frasi H
  const handleToggleHPhrase = (code: string) => {
    if (!currentProduct) return;
    const currentList = currentProduct.selectedHPhrases || [];
    const exists = currentList.includes(code);
    const updated = exists 
      ? currentList.filter(c => c !== code)
      : [...currentList, code];
    updateCurrentProduct('selectedHPhrases', updated);
  };

  // Gestione Toggle DPI
  const handleToggleDPI = (dpiId: string) => {
    if (!currentProduct) return;
    const currentList = currentProduct.selectedDpiIds || [];
    const exists = currentList.includes(dpiId);
    const updated = exists
      ? currentList.filter(id => id !== dpiId)
      : [...currentList, dpiId];
    updateCurrentProduct('selectedDpiIds', updated);
  };

  // Categorie univoche per le frasi H
  const hCategories = useMemo(() => {
    const setCat = new Set<string>();
    H_PHRASES_2026.forEach(h => {
      if (h.category) setCat.add(h.category);
    });
    return Array.from(setCat);
  }, []);

  // Frasi H filtrate
  const filteredHPhrases = useMemo(() => {
    const q = hSearchQuery.toLowerCase().trim();
    return H_PHRASES_2026.filter(h => {
      const matchCat = selectedHCategory === 'all' || h.category === selectedHCategory;
      const matchQuery = !q || h.code.toLowerCase().includes(q) || h.text.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [hSearchQuery, selectedHCategory]);

  // Categorie univoche DPI
  const dpiCategories = useMemo(() => {
    const setCat = new Set<string>();
    DEFAULT_DPI_CATALOG.forEach(d => {
      if (d.category) setCat.add(d.category);
    });
    return Array.from(setCat);
  }, []);

  // Catalogo DPI filtrato per categoria
  const filteredDpiCatalog = useMemo(() => {
    if (selectedDpiCategory === 'all') return DEFAULT_DPI_CATALOG;
    return DEFAULT_DPI_CATALOG.filter(d => d.category === selectedDpiCategory);
  }, [selectedDpiCategory]);

  // Payload per salvataggio e ripristino Firestore / Bozza locale
  const storageData = useMemo(() => {
    return {
      generalInfo,
      products,
      activeProductId
    };
  }, [generalInfo, products, activeProductId]);

  const handleLoadProject = (loadedData: any) => {
    if (!loadedData) return;
    if (loadedData.generalInfo) {
      setGeneralInfo(loadedData.generalInfo);
      if (loadedData.generalInfo.companyName) {
        setProjectData(prev => ({ ...prev, client: loadedData.generalInfo.companyName }));
      }
    }
    if (Array.isArray(loadedData.products) && loadedData.products.length > 0) {
      setProducts(loadedData.products);
      setActiveProductId(loadedData.activeProductId || loadedData.products[0].id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        
        {/* 1. SEZIONE STORAGE PROGETTO: a tutta larghezza come da standard */}
        <div className="mb-4 print:hidden">
          <ProjectStorage
            toolType="rischio_chimico"
            currentData={storageData}
            onLoadProject={handleLoadProject}
            projectInfo={projectData}
            setProjectInfo={setProjectData}
          />
        </div>

        {/* 2. HEADER DI PROGETTO CON CODICE SGQ M_4.4.6_O25_Ag.Chim. */}
        <div className="print:hidden">
          <ProjectHeader
            pData={projectData}
            setPData={setProjectData}
            title="Valutazione Rischio Chimico"
            docCode="M_4.4.6_O25_Ag.Chim."
            setAppMode={setAppMode}
            iconColor="brand"
            showPrintButton={true}
            hideClientInputs={true}
          />
        </div>

        {/* 3. BOX INFORMATIVO & CRITERI NORMATIVI (MOVARISCH 2026) */}
        <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 mb-6 text-xs text-slate-700 space-y-2.5 print:hidden">
          <p className="leading-relaxed">
            <strong>Inquadramento Normativo:</strong> Questo strumento consente di effettuare la valutazione del rischio chimico per la salute dei lavoratori ai sensi del <strong>D.Lgs. 81/2008 (Titolo IX Capo I)</strong> applicando l'algoritmo ufficiale <strong>MoVaRisCh (Edizione 28 Febbraio 2026)</strong>. Il modello quantifica l'esposizione per via inalatoria (E_inal = I × d) e per via cutanea (E_cute), determinando il rischio parziale e il rischio combinato per ciascun prodotto chimico utilizzato dalla mansione.
          </p>
          <div className="bg-white/80 border border-emerald-100 rounded-xl p-3.5 text-slate-600">
            <p className="font-bold text-slate-800 mb-2 text-[11px] uppercase tracking-wide flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-emerald-600" /> Formule e criteri di calcolo MoVaRisCh 2026:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs font-mono">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-150">
                <span className="text-[10px] text-slate-400 block font-sans">Pericolosità Intrinseca:</span>
                <b>P = max(Score Frasi H/EUH)</b>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-150">
                <span className="text-[10px] text-slate-400 block font-sans">Esposizione Inalatoria:</span>
                <b>E_inal = I (D, U, C, Tempo) × d</b>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-150">
                <span className="text-[10px] text-slate-400 block font-sans">Esposizione Cutanea:</span>
                <b>E_cute = f(Uso, Contatto)</b>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-150">
                <span className="text-[10px] text-slate-400 block font-sans">Rischio Inalatorio / Cutaneo:</span>
                <b>R_inal = P × E_inal | R_cute = P × E_cute</b>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-150 col-span-1 md:col-span-2">
                <span className="text-[10px] text-slate-400 block font-sans">Rischio Combinato (MoVaRisCh 2026):</span>
                <b>R_comb = √(R_inal² + R_cute²)</b>
              </div>
            </div>
          </div>
        </div>

        {/* 4. BARRA DI NAVIGAZIONE A TAB (UNIFORMATA ALLA SUITE) */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-2 print:hidden">
          <button
            onClick={() => setActiveTab('frontespizio')}
            className={`flex flex-col items-center justify-center text-center gap-1 w-[140px] h-[72px] rounded-xl text-[11px] leading-tight font-bold transition-all cursor-pointer ${
              activeTab === 'frontespizio'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200 scale-100'
                : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
            }`}
          >
            <Building className="w-4 h-4 shrink-0" />
            <span>1. Frontespizio</span>
          </button>

          <button
            onClick={() => setActiveTab('prodotti')}
            className={`flex flex-col items-center justify-center text-center gap-1 w-[140px] h-[72px] rounded-xl text-[11px] leading-tight font-bold transition-all cursor-pointer ${
              activeTab === 'prodotti'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200 scale-100'
                : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
            }`}
          >
            <FlaskConical className="w-4 h-4 shrink-0" />
            <span>2. Schede Prodotti ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('riepilogo')}
            className={`flex flex-col items-center justify-center text-center gap-1 w-[140px] h-[72px] rounded-xl text-[11px] leading-tight font-bold transition-all cursor-pointer ${
              activeTab === 'riepilogo'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200 scale-100'
                : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>3. Tabella Riepilogo</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: FRONTESPIZIO & INQUADRAMENTO MANSIONE */}
        {/* ============================================================== */}
        {activeTab === 'frontespizio' && (
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 mb-6 print:hidden animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-6">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg"><Building className="w-4 h-4" /></span>
                  Inquadramento Aziendale e Mansione Lavorativa
                </h3>
                <p className="text-xs text-slate-400">Definisci l'azienda, la sede, il reparto e i dati di redazione del documento</p>
              </div>
              <span className="text-[11px] font-bold text-slate-400 font-mono">D.Lgs. 81/08 - Art. 223</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">Ragione Sociale Azienda</label>
                <input
                  type="text"
                  placeholder="es. ACME S.p.A."
                  value={generalInfo.companyName}
                  onChange={e => {
                    const val = e.target.value;
                    setGeneralInfo({ ...generalInfo, companyName: val });
                    setProjectData(prev => ({ ...prev, client: val }));
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">Sede / Stabilimento</label>
                <input
                  type="text"
                  placeholder="es. Stabilimento di Aprilia (LT)"
                  value={generalInfo.site}
                  onChange={e => setGeneralInfo({ ...generalInfo, site: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">Reparto / Settore (opzionale)</label>
                <input
                  type="text"
                  placeholder="es. Manutenzione / Servizi Generali"
                  value={generalInfo.department}
                  onChange={e => setGeneralInfo({ ...generalInfo, department: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">Tecnico Valutatore</label>
                <input
                  type="text"
                  placeholder="es. Ing. Mario Rossi"
                  value={generalInfo.evaluator}
                  onChange={e => setGeneralInfo({ ...generalInfo, evaluator: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">Data Valutazione</label>
                <input
                  type="date"
                  value={generalInfo.date}
                  onChange={e => setGeneralInfo({ ...generalInfo, date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setActiveTab('prodotti')}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <span>Procedi a Schede Prodotti</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: SCHEDE PRODOTTI INDIVIDUALI */}
        {/* ============================================================== */}
        {activeTab === 'prodotti' && (
          <div className="space-y-6 print:hidden animate-in fade-in duration-200">
            {/* Barra dei Prodotti (Tabs orizzontali dinamici) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {products.map((p, idx) => {
                const evalP = evaluatedProducts.get(p.id)?.evaluation;
                const isSelected = p.id === activeProductId;

                return (
                  <button
                    key={p.id}
                    onClick={() => setActiveProductId(p.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-100'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      evalP?.riskLevel === 'irrilevante' ? 'bg-emerald-500' :
                      evalP?.riskLevel === 'incertezza' ? 'bg-amber-500' :
                      evalP?.riskLevel === 'superiore_irrilevante' ? 'bg-rose-500' :
                      evalP?.riskLevel === 'elevato' ? 'bg-red-700' : 'bg-purple-600'
                    }`} />
                    <span>{idx + 1}. {p.name?.trim() || `Prodotto ${idx + 1}`}</span>
                    {evalP && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                        isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        R={evalP.criticalRisk.toFixed(1)}
                      </span>
                    )}
                  </button>
                );
              })}

              <button
                onClick={handleAddProduct}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-dashed border-emerald-300 rounded-2xl text-xs font-bold transition-all active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Nuovo Prodotto</span>
              </button>
            </div>

            {currentProduct && currentEvaluation && (
              <div className="space-y-6">
                {/* 1. Header Prodotto & Azioni Rapide */}
                <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                        <FlaskConical className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-black text-slate-800">
                          {currentProduct.name?.trim() || `Scheda Prodotto ${products.findIndex(p => p.id === currentProduct.id) + 1}`}
                        </h2>
                        <p className="text-xs text-slate-400">Compila i parametri SDS e le condizioni d'uso per il calcolo MoVaRisCh 2026</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-auto">
                      <button
                        onClick={() => handleDuplicateProduct(currentProduct)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                        title="Duplica questa scheda"
                      >
                        <Copy className="w-3.5 h-3.5" /> Duplica
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(currentProduct.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                        title="Elimina questa scheda"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Elimina
                      </button>
                    </div>
                  </div>

                  {/* 1. Dati Anagrafici, Mansione & Scheda Tecnica del Prodotto */}
                  <div className="space-y-6">
                    {/* Attività Lavorativa & Sottogruppo Omogeneo */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Attività Lavorativa
                        </label>
                        <input
                          type="text"
                          placeholder="es. Applicazione della cera con macchina lavapavimenti"
                          value={currentProduct.activity || ''}
                          onChange={e => updateCurrentProduct('activity', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Sottogruppo Omogeneo (Mansione)
                        </label>
                        <input
                          type="text"
                          placeholder="es. Addetti alle pulizie complesse"
                          value={currentProduct.homogeneousGroup || ''}
                          onChange={e => updateCurrentProduct('homogeneousGroup', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Prodotto Chimico, Produttore, Data SDS & Cessore Formaldeide */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Prodotto Chimico
                        </label>
                        <input
                          type="text"
                          placeholder="es. Longlife Diamond 10L"
                          value={currentProduct.name}
                          onChange={e => updateCurrentProduct('name', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Produttore
                        </label>
                        <input
                          type="text"
                          placeholder="es. Werner & Mertz GmbH"
                          value={currentProduct.producer}
                          onChange={e => updateCurrentProduct('producer', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Data Scheda di Sicurezza
                        </label>
                        <input
                          type="text"
                          placeholder="es. 19/02/2024"
                          value={currentProduct.sdsDate}
                          onChange={e => updateCurrentProduct('sdsDate', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Cessore di Formaldeide
                        </label>
                        <select
                          value={currentProduct.formaldehydeDonor === 'SI' ? 'SI' : 'NO'}
                          onChange={e => updateCurrentProduct('formaldehydeDonor', e.target.value as 'SI' | 'NO')}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        >
                          <option value="NO">NO</option>
                          <option value="SI">SI</option>
                        </select>
                      </div>
                    </div>

                    {/* TLV-TWA: Inserire uno spazio con aggiungi per poter mettere a mano */}
                    <div className="pt-4 border-t border-slate-100 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase">
                            TLV-TWA
                          </label>
                          <span className="text-[10px] text-slate-400">
                            Inserisci a mano la sostanza e il valore limite (es. ppm, mg/m³)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddTlvRow}
                          className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Aggiungi Limite
                        </button>
                      </div>

                      {(!currentProduct.tlvLimits || currentProduct.tlvLimits.length === 0) ? (
                        <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-xs text-slate-400">
                          Nessun valore limite TLV-TWA inserito. Clicca su "+ Aggiungi Limite" per inserirlo a mano se presente nella SDS.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {currentProduct.tlvLimits.map(tlv => (
                            <div key={tlv.id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                              <input
                                type="text"
                                placeholder="Sostanza / Principio attivo (es. Idrossido di potassio)"
                                value={tlv.substance}
                                onChange={e => handleUpdateTlvRow(tlv.id, 'substance', e.target.value)}
                                className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                              <input
                                type="text"
                                placeholder="Valore Limite (es. 1 mg/m³, 200 ppm)"
                                value={tlv.limitValue}
                                onChange={e => handleUpdateTlvRow(tlv.id, 'limitValue', e.target.value)}
                                className="w-48 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleDeleteTlvRow(tlv.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Elimina riga"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Misure di prevenzione e protezione per la salute (spazio libero) */}
                    <div className="pt-4 border-t border-slate-100">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Misure di prevenzione e protezione per la salute
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Spazio libero per inserire istruzioni operative, modalità di manipolazione, aerazione, stoccaggio sicuro, lavaggio, misure di primo soccorso..."
                        value={currentProduct.healthPreventionsText}
                        onChange={e => updateCurrentProduct('healthPreventionsText', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 leading-relaxed"
                      />
                    </div>

                    {/* DPI */}
                    <div className="pt-4 border-t border-slate-100">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase">
                            DPI (Dispositivi di Protezione Individuale)
                          </label>
                          <span className="text-[11px] text-slate-400">
                            Seleziona i DPI da utilizzare per la manipolazione del prodotto
                          </span>
                        </div>
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0 self-start sm:self-auto">
                          {currentProduct.selectedDpiIds?.length || 0} DPI Selezionati
                        </span>
                      </div>

                      {/* Filtro Rapido Categorie DPI */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-thin">
                        <button
                          type="button"
                          onClick={() => setSelectedDpiCategory('all')}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                            selectedDpiCategory === 'all'
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                          }`}
                        >
                          Tutti ({DEFAULT_DPI_CATALOG.length})
                        </button>
                        {dpiCategories.map(cat => (
                          <button
                            type="button"
                            key={cat}
                            onClick={() => setSelectedDpiCategory(cat)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                              selectedDpiCategory === cat
                                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      {/* Griglia Responsive dei DPI */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {filteredDpiCatalog.map(dpi => {
                          const isSelected = currentProduct.selectedDpiIds?.includes(dpi.id);

                          return (
                            <button
                              type="button"
                              key={dpi.id}
                              onClick={() => handleToggleDPI(dpi.id)}
                              className={`flex flex-col justify-between text-left p-2.5 rounded-2xl border transition-all cursor-pointer relative ${
                                isSelected
                                  ? 'bg-emerald-50/80 border-emerald-400 shadow-xs ring-1 ring-emerald-400'
                                  : 'bg-slate-50/60 hover:bg-slate-100 border-slate-200 opacity-85 hover:opacity-100'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-2xs overflow-hidden">
                                    {dpi.imageSrc ? (
                                      <img src={dpi.imageSrc} alt={dpi.name} className="w-full h-full object-contain" />
                                    ) : (
                                      <DpiIcon id={dpi.id} size={24} className={isSelected ? 'text-emerald-700' : 'text-slate-600'} />
                                    )}
                                  </div>
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                    isSelected ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-200 text-slate-400'
                                  }`}>
                                    {isSelected ? '✓' : '+'}
                                  </span>
                                </div>
                                <span className="text-[11px] font-bold text-slate-800 leading-tight block mb-1.5">{dpi.name}</span>
                              </div>
                              {dpi.standard && (
                                <span className="text-[9px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded inline-block self-start mt-1">
                                  {dpi.standard}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Indice di Pericolosità (P) & Frasi H/EUH 2026 */}
                <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 mb-4 gap-2">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <span className="p-1.5 bg-rose-100 text-rose-700 rounded-lg"><AlertTriangle className="w-4 h-4" /></span>
                        Valutazione della Pericolosità per la Salute (Indice P)
                      </h3>
                      <p className="text-xs text-slate-400">Seleziona le frasi H ed EUH presenti nella Sezione 2 della Scheda di Sicurezza (SDS)</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">Punteggio P Calcolato:</span>
                      <span className="px-3 py-1 bg-slate-900 text-white rounded-xl font-mono text-sm font-black shadow-xs">
                        P = {currentEvaluation.scoreP.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Frasi Selezionate */}
                  <div className="mb-4">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                      Frasi di Pericolo Attive ({currentProduct.selectedHPhrases?.length || 0})
                    </label>
                    {(!currentProduct.selectedHPhrases || currentProduct.selectedHPhrases.length === 0) ? (
                      <div className="p-3.5 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-xs text-slate-400 flex items-center gap-2">
                        <Info className="w-4 h-4 text-slate-400" />
                        <span>Nessuna frase H selezionata. Il sistema assegna il valore base non pericoloso (P = 1.00).</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {currentProduct.selectedHPhrases.map(code => {
                          const item = H_PHRASES_2026.find(h => h.code === code);
                          if (!item) return null;
                          const isMax = item.score === currentEvaluation.scoreP;

                          return (
                            <span
                              key={code}
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                isMax
                                  ? 'bg-rose-50 text-rose-800 border-rose-200 shadow-xs'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              <span className="font-mono bg-white px-1.5 py-0.5 rounded text-[11px] border border-slate-200">
                                {item.code.replace('_', ' ')}
                              </span>
                              <span className="max-w-xs truncate">{item.text.split(' - ')[1] || item.text}</span>
                              <span className="font-mono text-[10px] text-slate-400">({item.score.toFixed(2)})</span>
                              <button
                                onClick={() => handleToggleHPhrase(code)}
                                className="text-slate-400 hover:text-rose-600 transition-colors ml-1 font-bold text-sm"
                                title="Rimuovi frase"
                              >
                                ✕
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Selettore / Ricerca Frasi H */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="flex flex-col sm:flex-row items-center gap-2 mb-3">
                      <div className="relative flex-1 w-full">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Cerca frase H o parola chiave (es. H314, corrosivo, endocrino, letale)..."
                          value={hSearchQuery}
                          onChange={e => setHSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>

                      <select
                        value={selectedHCategory}
                        onChange={e => setSelectedHCategory(e.target.value)}
                        className="w-full sm:w-auto bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      >
                        <option value="all">Tutte le Categorie ({H_PHRASES_2026.length})</option>
                        {hCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Griglia rapida Frasi H */}
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                      {filteredHPhrases.slice(0, 30).map(item => {
                        const isSelected = currentProduct.selectedHPhrases?.includes(item.code);
                        return (
                          <button
                            key={item.code}
                            onClick={() => handleToggleHPhrase(item.code)}
                            className={`w-full text-left flex items-center justify-between p-2 rounded-xl text-xs transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-100/70 text-emerald-900 border border-emerald-300 font-bold'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                                isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {item.code.replace('_', ' ')}
                              </span>
                              <span className="truncate">{item.text}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono text-[10px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                                Score: {item.score.toFixed(2)}
                              </span>
                              <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs ${
                                isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'
                              }`}>
                                {isSelected ? '✓' : '+'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 3. Matrice Esposizione Inalatoria (E_inal) a tutta larghezza */}
                <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <span className="p-1.5 bg-sky-100 text-sky-700 rounded-lg"><Wind className="w-4 h-4" /></span>
                        3. Esposizione Inalatoria (E_inal)
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Valutazione per via inalatoria basata su volatilità/polverosità, quantità, tipologia d'uso, misure di controllo, tempo e distanza
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200 self-start sm:self-auto">
                      E_inal = {currentEvaluation.eInal.toFixed(2)}
                    </span>
                  </div>

                  {/* Griglia Parametri Inalatori (3 colonne su desktop) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Proprietà Chimico-Fisiche */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Proprietà Chimico-Fisiche
                      </label>
                      <select
                        value={currentProduct.physicalState}
                        onChange={e => updateCurrentProduct('physicalState', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800"
                      >
                        <option value="solido_nebbie">Solido / Nebbie / Liquido a bassissima volatilità</option>
                        <option value="bassa_volatilita">Liquido a Bassa Volatilità (Teb &gt; 150°C)</option>
                        <option value="alta_volatilita_polveri">Liquido ad Alta/Media Volatilità (Teb &le; 150°C) o Polveri Fini</option>
                        <option value="gas">Stato Gassoso / Gas compresso o liquefatto</option>
                      </select>
                    </div>

                    {/* Quantità in uso */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Quantità Giornaliera in Uso
                      </label>
                      <select
                        value={currentProduct.quantity}
                        onChange={e => updateCurrentProduct('quantity', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800"
                      >
                        <option value="lt_01">Minore di 0,1 kg / giorno (&lt; 100 g)</option>
                        <option value="01_1">Tra 0,1 e 1 kg / giorno</option>
                        <option value="1_10">Tra 1 e 10 kg / giorno</option>
                        <option value="10_100">Tra 10 e 100 kg / giorno</option>
                        <option value="gt_100">Maggiore di 100 kg / giorno</option>
                      </select>
                    </div>

                    {/* Tipologia d'uso */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Tipologia d'Uso
                      </label>
                      <select
                        value={currentProduct.useType}
                        onChange={e => updateCurrentProduct('useType', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800"
                      >
                        <option value="sistema_chiuso">Sistema Chiuso (a tenuta stagna)</option>
                        <option value="inclusione_matrice">Inclusione in Matrice (pellet, pasta)</option>
                        <option value="uso_controllato">Uso Controllato e non dispersivo</option>
                        <option value="uso_dispersivo">Uso con Dispersione Significativa</option>
                      </select>
                    </div>

                    {/* Tipologia di controllo */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Tipologia di Controllo
                      </label>
                      <select
                        value={currentProduct.controlType}
                        onChange={e => updateCurrentProduct('controlType', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800"
                      >
                        <option value="contenimento">Contenimento Completo (ciclo chiuso)</option>
                        <option value="aspirazione">Aspirazione Localizzata / Cappa (LEV)</option>
                        <option value="segregazione">Segregazione / Separazione (distanza/tempi)</option>
                        <option value="ventilazione">Diluizione / Ventilazione Generale</option>
                        <option value="manipolazione_diretta">Manipolazione Diretta (solo DPI)</option>
                      </select>
                    </div>

                    {/* Tempo di esposizione */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Tempo di Esposizione Giornaliero
                      </label>
                      <select
                        value={currentProduct.exposureTime}
                        onChange={e => updateCurrentProduct('exposureTime', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800"
                      >
                        <option value="lt_15m">&lt; 15 minuti</option>
                        <option value="15m_2h">15 min – 2 ore</option>
                        <option value="2h_4h">2 ore – 4 ore</option>
                        <option value="4h_6h">4 ore – 6 ore</option>
                        <option value="gt_6h">&gt; 6 ore</option>
                      </select>
                    </div>

                    {/* Distanza dalla sorgente */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Distanza dalla Sorgente (d)
                      </label>
                      <select
                        value={currentProduct.distance}
                        onChange={e => updateCurrentProduct('distance', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800"
                      >
                        <option value="lt_1m">&lt; 1 metro (d = 1,00)</option>
                        <option value="1_3m">1 – 3 metri (d = 0,75)</option>
                        <option value="3_5m">3 – 5 metri (d = 0,50)</option>
                        <option value="5_10m">5 – 10 metri (d = 0,25)</option>
                        <option value="gt_10m">&gt; 10 metri (d = 0,10)</option>
                      </select>
                    </div>
                  </div>

                  {/* Catena di Matrici Inalatorie */}
                  <div className="bg-sky-50/70 p-3.5 rounded-2xl border border-sky-100 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-sky-900">
                    <span>Disponibilità D: <b>{currentEvaluation.scoreD}</b></span>
                    <span>→ Uso U: <b>{currentEvaluation.scoreU}</b></span>
                    <span>→ Comp. C: <b>{currentEvaluation.scoreC}</b></span>
                    <span>→ Intensità I: <b>{currentEvaluation.scoreI}</b></span>
                    <span className="font-bold text-sky-800 bg-white/80 px-2.5 py-1 rounded-lg border border-sky-200">
                      E_inal = I × d = {currentEvaluation.scoreI} × {currentEvaluation.distance === 'lt_1m' ? '1,00' : currentEvaluation.distance === '1_3m' ? '0,75' : currentEvaluation.distance === '3_5m' ? '0,50' : currentEvaluation.distance === '5_10m' ? '0,25' : '0,10'} = {currentEvaluation.eInal.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* 4. Matrice Esposizione Cutanea (E_cute) a tutta larghezza */}
                <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <span className="p-1.5 bg-orange-100 text-orange-700 rounded-lg"><Activity className="w-4 h-4" /></span>
                        4. Esposizione Cutanea (E_cute)
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Valutazione per via cutanea basata sulla modalità d'impiego operativo e sul livello/frequenza di contatto dell'operatore
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold text-orange-700 bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-200 self-start sm:self-auto">
                      E_cute = {currentEvaluation.eCute.toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Tipologia d'Uso (Sorgente di Contatto)
                      </label>
                      <select
                        value={currentProduct.useType}
                        onChange={e => updateCurrentProduct('useType', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-800"
                      >
                        <option value="sistema_chiuso">Sistema Chiuso (nessun rilascio)</option>
                        <option value="inclusione_matrice">Inclusione in Matrice (rilascio molto limitato)</option>
                        <option value="uso_controllato">Uso Controllato e non dispersivo (operatori qualificati)</option>
                        <option value="uso_dispersivo">Uso con Dispersione Significativa (verniciatura, spruzzo)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Livello di Contatto Cutaneo
                      </label>
                      <select
                        value={currentProduct.skinContactLevel}
                        onChange={e => updateCurrentProduct('skinContactLevel', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-800"
                      >
                        <option value="nessuno">Nessun Contatto (nessun contatto cutaneo con il formulato)</option>
                        <option value="accidentale">Contatto Accidentale (&le; 1 evento al giorno per spruzzi occasionali)</option>
                        <option value="discontinuo">Contatto Discontinuo (da 2 a 10 eventi al giorno)</option>
                        <option value="esteso">Contatto Esteso (&gt; 10 eventi al giorno o immersione continua)</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-3.5 bg-orange-50/70 border border-orange-200/60 rounded-2xl text-[11px] text-orange-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="leading-relaxed">
                      La matrice cutanea correla la dispersibilità del processo operativo con la frequenza e l'estensione del contatto dell'operatore, determinando l'indice di esposizione cutanea normalizzato (1, 3, 7 o 10).
                    </p>
                    <span className="font-mono text-xs font-bold bg-white px-2.5 py-1 rounded-lg border border-orange-200 text-orange-900 shrink-0 self-start sm:self-auto">
                      Indice E_cute = {currentEvaluation.eCute}
                    </span>
                  </div>
                </div>

                {/* 5. Esito Globale del Rischio MoVaRisCh (Ed. 2026) a tutta larghezza */}
                <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                          <ShieldCheck className="w-4 h-4" />
                        </span>
                        5. Esito del Rischio MoVaRisCh (Ed. 2026)
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Sintesi combinata tra Pericolo (Score P), Esposizione Inalatoria (E_inal) ed Esposizione Cutanea (E_cute)
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        Score P = {currentEvaluation.scoreP.toFixed(2)}
                      </span>
                      <span className="text-xs font-mono font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
                        E_inal = {currentEvaluation.eInal.toFixed(2)}
                      </span>
                      <span className="text-xs font-mono font-bold text-orange-700 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200">
                        E_cute = {currentEvaluation.eCute.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Banner Principale Esito con Colore Fascia */}
                  <div className={`p-5 rounded-2xl border ${currentEvaluation.riskBgColor} ${currentEvaluation.riskBorderColor} space-y-2`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-black uppercase tracking-wider">Classificazione Finale del Rischio:</span>
                        <span className="text-sm font-black underline underline-offset-4">{currentEvaluation.riskBadgeLabel}</span>
                      </div>
                      <div className="font-mono text-2xl font-black">
                        R_finale = {currentEvaluation.criticalRisk.toFixed(2)}
                      </div>
                    </div>
                    <p className="text-xs opacity-90 leading-relaxed font-medium">
                      {currentEvaluation.riskDescription}
                    </p>
                  </div>

                  {/* 3 Colonne Dettaglio Indici Calcolati */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-sky-50/70 p-4 rounded-2xl border border-sky-200/70 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-sky-900 uppercase tracking-wider">Rischio Inalatorio</span>
                        <span className="font-mono text-[10px] font-bold text-sky-700 bg-white/80 px-2 py-0.5 rounded border border-sky-200">
                          R_inal = P × E_inal
                        </span>
                      </div>
                      <div className="font-mono text-2xl font-black text-sky-950 my-1">
                        {currentEvaluation.rInal.toFixed(2)}
                      </div>
                      <span className="text-[10px] text-sky-700 font-mono">
                        P ({currentEvaluation.scoreP.toFixed(2)}) × E_inal ({currentEvaluation.eInal.toFixed(2)})
                      </span>
                    </div>

                    <div className="bg-orange-50/70 p-4 rounded-2xl border border-orange-200/70 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-orange-900 uppercase tracking-wider">Rischio Cutaneo</span>
                        <span className="font-mono text-[10px] font-bold text-orange-700 bg-white/80 px-2 py-0.5 rounded border border-orange-200">
                          R_cute = P × E_cute
                        </span>
                      </div>
                      <div className="font-mono text-2xl font-black text-orange-950 my-1">
                        {currentEvaluation.rCute.toFixed(2)}
                      </div>
                      <span className="text-[10px] text-orange-700 font-mono">
                        P ({currentEvaluation.scoreP.toFixed(2)}) × E_cute ({currentEvaluation.eCute.toFixed(2)})
                      </span>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Rischio Combinato</span>
                        <span className="font-mono text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                          √(R_inal² + R_cute²)
                        </span>
                      </div>
                      <div className="font-mono text-2xl font-black text-slate-900 my-1">
                        {currentEvaluation.rCombined.toFixed(2)}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Composizione vettoriale inalatoria e cutanea
                      </span>
                    </div>
                  </div>

                  {/* Legenda Fasce MoVaRisCh 2026 */}
                  <div className="pt-3 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                      Fasce di Rischio MoVaRisCh (Ed. 2026):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-[10px] font-bold">
                      <div className={`p-2 rounded-xl border transition-all ${currentEvaluation.riskLevel === 'irrilevante' ? 'ring-2 ring-emerald-600 bg-emerald-100 text-emerald-900 border-emerald-400 font-black shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200 opacity-60'}`}>
                        R &lt; 15: Irrilevante
                      </div>
                      <div className={`p-2 rounded-xl border transition-all ${currentEvaluation.riskLevel === 'incertezza' ? 'ring-2 ring-amber-600 bg-amber-100 text-amber-900 border-amber-400 font-black shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200 opacity-60'}`}>
                        15 ≤ R &lt; 21: Incertezza
                      </div>
                      <div className={`p-2 rounded-xl border transition-all ${currentEvaluation.riskLevel === 'superiore_irrilevante' ? 'ring-2 ring-rose-600 bg-rose-100 text-rose-900 border-rose-400 font-black shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200 opacity-60'}`}>
                        21 ≤ R &lt; 40: Superiore
                      </div>
                      <div className={`p-2 rounded-xl border transition-all ${currentEvaluation.riskLevel === 'elevato' ? 'ring-2 ring-red-700 bg-red-100 text-red-900 border-red-400 font-black shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200 opacity-60'}`}>
                        40 ≤ R &lt; 80: Elevato
                      </div>
                      <div className={`p-2 rounded-xl border transition-all ${currentEvaluation.riskLevel === 'grave' ? 'ring-2 ring-purple-700 bg-purple-100 text-purple-900 border-purple-400 font-black shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200 opacity-60'}`}>
                        R ≥ 80: Grave
                      </div>
                    </div>
                  </div>
                </div>

                {/* Barra Navigazione Inferiore Tab 2 */}
                <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <button
                    onClick={() => setActiveTab('frontespizio')}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer"
                  >
                    <span>←</span>
                    <span>Torna a Frontespizio Mansione</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('riepilogo')}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <span>Procedi a Tabella Riepilogo</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: TABELLA DI RIEPILOGO GENERALE */}
        {/* ============================================================== */}
        {activeTab === 'riepilogo' && (
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 print:hidden space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg"><FileSpreadsheet className="w-4 h-4" /></span>
                  Quadro di Sintesi e Riepilogo Generale Prodotti
                </h3>
                <p className="text-xs text-slate-400">
                  Elenco complessivo dei prodotti chimici impiegati e matrici di calcolo MoVaRisCh (Ed. 2026)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddProduct}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Aggiungi Prodotto
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Prodotto / Produttore</th>
                    <th className="py-3 px-3">Frasi H / EUH</th>
                    <th className="py-3 px-3 text-center">Score P</th>
                    <th className="py-3 px-3">TLV-TWA</th>
                    <th className="py-3 px-3 text-center">Formaldeide</th>
                    <th className="py-3 px-3 text-center">R_inal</th>
                    <th className="py-3 px-3 text-center">R_cute</th>
                    <th className="py-3 px-3 text-center">R_combinato</th>
                    <th className="py-3 px-3 text-center">Giudizio Finale</th>
                    <th className="py-3 px-3 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {products.map((p, idx) => {
                    const evalP = evaluatedProducts.get(p.id)?.evaluation;
                    if (!evalP) return null;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800">{p.name || 'Senza nome'}</div>
                          <div className="text-[10px] text-slate-400">
                            {p.producer || 'Produttore non specificato'} {p.sdsDate ? `• SDS: ${p.sdsDate}` : ''}
                          </div>
                          {(p.homogeneousGroup || p.activity) && (
                            <div className="text-[10px] text-emerald-800 mt-0.5">
                              {p.homogeneousGroup && <span className="font-bold">{p.homogeneousGroup}</span>}
                              {p.homogeneousGroup && p.activity && <span> — </span>}
                              {p.activity && <span className="italic text-slate-600">{p.activity}</span>}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {p.selectedHPhrases?.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {p.selectedHPhrases.map(c => (
                                <span key={c} className="font-mono text-[9px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                  {c.replace('_', ' ')}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Nessuna (P=1.00)</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                          {evalP.scoreP.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-[11px]">
                          {p.tlvLimits && p.tlvLimits.length > 0 ? (
                            <div className="space-y-0.5">
                              {p.tlvLimits.map(t => (
                                <div key={t.id} className="font-mono text-[10px] text-slate-600">
                                  {t.substance ? `${t.substance}: ` : ''}{t.limitValue}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">N.D.</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            p.formaldehydeDonor === 'SI' ? 'bg-rose-100 text-rose-700' :
                            p.formaldehydeDonor === 'NO' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {p.formaldehydeDonor}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                          {evalP.rInal.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                          {evalP.rCute.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">
                          {evalP.rCombined.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-xl border ${evalP.riskBgColor || 'bg-slate-100'} ${evalP.riskBorderColor || 'border-slate-300'}`}>
                            {evalP.riskBadgeLabel ? evalP.riskBadgeLabel.split(' (')[0] : 'Valutato'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => {
                              setActiveProductId(p.id);
                              setActiveTab('prodotti');
                            }}
                            className="p-1 text-slate-400 hover:text-emerald-700 transition-colors font-bold text-xs cursor-pointer"
                            title="Apri scheda"
                          >
                            Modifica →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Barra Navigazione Inferiore Tab 3 */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={() => setActiveTab('prodotti')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                <span>←</span>
                <span>Torna a Schede Prodotti</span>
              </button>

              <button
                onClick={() => window.print()}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Stampa Report Completo (A4 / PDF)</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VISTA AUTOMATICA DI STAMPA A4 / PDF (ATTIVA SOLO IN STAMPA) */}
        {/* ============================================================== */}
        <div className="hidden print:block bg-white text-slate-900 print:m-0 print:p-0 font-sans">
          
          {/* ============================================================ */}
          {/* PAGINA 1: FRONTESPIZIO UFFICIALE (MODELLO EXCEL & SGQ) */}
          {/* ============================================================ */}
          <div 
            className="flex flex-col justify-between py-6 px-4"
            style={{ minHeight: '94vh', pageBreakAfter: 'always', breakAfter: 'page' }}
          >
            {/* 1. Header Superiore Frontespizio */}
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4 gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <img src={logoImg} alt="Logo" className="h-12 w-auto object-contain shrink-0" />
                <div className="min-w-0">
                  <span className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-wider block">
                    Sicurezza Luoghi di Lavoro
                  </span>
                </div>
              </div>
              <div className="text-right font-mono shrink-0">
                <span className="text-xs font-bold text-slate-800 bg-slate-100 border border-slate-300 px-2.5 py-1 rounded inline-block whitespace-nowrap">
                  M_4.4.6_O25_Ag.Chim.&nbsp;-&nbsp;{projectData.revision || 'Rev00'}
                </span>
                <span className="block text-[9px] text-slate-400 font-sans uppercase font-bold tracking-wider mt-1 whitespace-nowrap">
                  Documento di Qualità SGQ
                </span>
              </div>
            </div>

            {/* 2. Ragione Sociale e Sede */}
            <div className="text-center py-4 border-b border-slate-200">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Azienda / Ragione Sociale Committente
              </span>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                {generalInfo.companyName || projectData.client || 'ITALIANA SERVIZI S.P.A.'}
              </h1>
              {generalInfo.site && (
                <h2 className="text-sm font-bold text-emerald-800 uppercase tracking-wider mt-1">
                  {generalInfo.site}
                </h2>
              )}
            </div>

            {/* 3. Titolo Ufficiale dell'Allegato */}
            <div className="text-center py-6 space-y-3">
              <span className="inline-block px-4 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs uppercase tracking-wider rounded-full">
                Documento Tecnico di Valutazione dei Rischi
              </span>
              <h2 className="text-xl font-black text-slate-900 uppercase leading-snug max-w-2xl mx-auto">
                Allegato alla Valutazione del Rischio Derivante da Esposizione ad Agenti Chimici Pericolosi
              </h2>
              <p className="text-xs text-slate-600 font-medium italic">
                Ai sensi dell'art. 223 del D.Lgs. 9 aprile 2008, n. 81 e s.m.i. (Titolo IX Sostanze Pericolose - Capo I)
              </p>
              <div className="pt-2">
                <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">
                  Schede di Calcolo dei Valori di Rischio per la Salute dei Lavoratori
                </h3>
                <p className="text-xs text-emerald-700 font-bold mt-0.5">
                  Modello Algoritmico MoVaRisCh (Edizione Ufficiale 28 Febbraio 2026)
                </p>
              </div>
            </div>

            {/* 4. Riquadro Sintesi della Valutazione */}
            <div className="border border-slate-300 rounded-2xl p-4 bg-slate-50/70 space-y-3">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1.5 flex items-center justify-between">
                <span>Quadro di Sintesi della Valutazione</span>
                <span className="font-mono text-emerald-800 font-bold text-xs">{products.length} Agenti Chimici Valutati</span>
              </h4>

              {generalInfo.department && (
                <div className="text-xs">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Reparto / Settore Operativo:</span>
                  <b className="text-slate-900 text-sm">{generalInfo.department}</b>
                </div>
              )}

              {/* Rischio Massimo Riscontrato */}
              {maxJobRisk && (
                <div className={`p-3 rounded-xl border flex items-center justify-between mt-2 ${maxJobRisk.riskBgColor} ${maxJobRisk.riskBorderColor}`}>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider block">
                      Livello di Rischio Massimo Riscontrato:
                    </span>
                    <span className="text-xs font-bold">{maxJobRisk.riskBadgeLabel}</span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-base font-black">R_max = {maxJobRisk.criticalRisk.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Riquadro Tecnico Redattore & Data Emissione */}
            <div className="grid grid-cols-2 gap-4 border border-slate-300 rounded-xl p-3.5 bg-white text-xs text-center">
              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase">Tecnico Valutatore</span>
                <b className="text-slate-800 text-sm block mt-1">{generalInfo.evaluator || projectData.author || 'Tecnico Competente'}</b>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase">Data di Valutazione</span>
                <b className="text-slate-800 text-sm font-mono block mt-1">{formatToItalianDate(generalInfo.date || projectData.date)}</b>
              </div>
            </div>

            {/* 6. Note di Conformità Normativa in calce */}
            <div className="text-[9px] text-slate-500 leading-relaxed border-t border-slate-200 pt-3">
              <p>
                <strong>Note di Conformità:</strong> Il presente allegato è redatto in ottemperanza agli obblighi di valutazione del rischio chimico di cui al D.Lgs. 81/08 (Titolo IX Capo I). La metodologia di stima quantitativa applica l'algoritmo MoVaRisCh (Edizione Ufficiale 28 Febbraio 2026), considerando il fattore di pericolo intrinseco P (Regolamenti REACH e CLP), l'esposizione inalatoria (E_inal) calcolata mediante le matrici di disponibilità, uso, controllo, tempo e distanza, e l'esposizione cutanea (E_cute) determinata dalla tipologia d'uso e frequenza di contatto dell'operatore.
              </p>
            </div>
          </div>

          {/* ============================================================ */}
          {/* PAGINA 2: QUADRO DI SINTESI E TABELLA DI RIEPILOGO GENERALE */}
          {/* ============================================================ */}
          <div 
            className="py-2 space-y-3"
            style={{ pageBreakAfter: 'always', breakAfter: 'page' }}
          >
            {/* Fascia superiore: Codice SGQ posizionato in alto a destra */}
            <div className="flex justify-end items-center pb-1">
              <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded whitespace-nowrap">
                M_4.4.6_O25_Ag.Chim.&nbsp;-&nbsp;{projectData.revision || 'Rev00'}
              </span>
            </div>

            {/* Titolo di Sezione a tutta larghezza */}
            <div className="border-b border-slate-300 pb-2">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                1. Quadro di Sintesi e Tabella di Riepilogo Generale degli Agenti Chimici
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Azienda: <b>{generalInfo.companyName || projectData.client || '—'}</b>
                {generalInfo.site ? ` | Sede: ${generalInfo.site}` : ''}
                {generalInfo.department ? ` | Reparto: ${generalInfo.department}` : ''}
              </p>
            </div>

            {/* Tabella di Riepilogo */}
            <table className="w-full text-left border-collapse border border-slate-300 text-[10px]">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="p-1.5 border-r border-slate-300 text-center">#</th>
                  <th className="p-1.5 border-r border-slate-300">Nome Prodotto</th>
                  <th className="p-1.5 border-r border-slate-300">Produttore / SDS</th>
                  <th className="p-1.5 border-r border-slate-300">Frasi H / EUH</th>
                  <th className="p-1.5 border-r border-slate-300 text-center">Score P</th>
                  <th className="p-1.5 border-r border-slate-300">TLV-TWA</th>
                  <th className="p-1.5 border-r border-slate-300 text-center">Formald.</th>
                  <th className="p-1.5 border-r border-slate-300 text-center">R_inal</th>
                  <th className="p-1.5 border-r border-slate-300 text-center">R_cute</th>
                  <th className="p-1.5 border-r border-slate-300 text-center">R_comb</th>
                  <th className="p-1.5 text-center">Classificazione di Rischio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {products.map((p, idx) => {
                  const evalP = evaluatedProducts.get(p.id)?.evaluation || evaluateMoVaRisCh(p);
                  if (!evalP) return null;

                  return (
                    <tr key={p.id} className="border-b border-slate-200">
                      <td className="p-1.5 border-r border-slate-300 font-mono font-bold text-center">{idx + 1}</td>
                      <td className="p-1.5 border-r border-slate-300">
                        <div className="font-bold text-slate-900 leading-tight">{p.name || '—'}</div>
                        {(p.homogeneousGroup || p.activity) && (
                          <div className="text-[8px] text-slate-600 mt-0.5 leading-tight">
                            {p.homogeneousGroup && <span className="font-bold text-slate-800">{p.homogeneousGroup}</span>}
                            {p.homogeneousGroup && p.activity && <span> • </span>}
                            {p.activity && <span>{p.activity}</span>}
                          </div>
                        )}
                      </td>
                      <td className="p-1.5 border-r border-slate-300 text-[9px]">
                        <div>{p.producer || 'N.D.'}</div>
                        <div className="text-slate-400 font-mono">{formatToItalianDate(p.sdsDate)}</div>
                      </td>
                      <td className="p-1.5 border-r border-slate-300 font-mono text-[9px]">
                        {p.selectedHPhrases?.length > 0 ? p.selectedHPhrases.join(', ') : 'Nessuna'}
                      </td>
                      <td className="p-1.5 border-r border-slate-300 font-mono text-center font-bold">{evalP.scoreP.toFixed(2)}</td>
                      <td className="p-1.5 border-r border-slate-300 text-[9px]">
                        {p.tlvLimits && p.tlvLimits.length > 0 
                          ? p.tlvLimits.map(t => `${t.substance ? `${t.substance}: ` : ''}${t.limitValue}`).join('; ')
                          : 'N.D.'}
                      </td>
                      <td className="p-1.5 border-r border-slate-300 text-center font-bold">{p.formaldehydeDonor || 'NO'}</td>
                      <td className="p-1.5 border-r border-slate-300 font-mono text-center">{evalP.rInal.toFixed(2)}</td>
                      <td className="p-1.5 border-r border-slate-300 font-mono text-center">{evalP.rCute.toFixed(2)}</td>
                      <td className="p-1.5 border-r border-slate-300 font-mono font-bold text-center text-slate-900">{evalP.rCombined.toFixed(2)}</td>
                      <td className="p-1.5 text-center font-bold text-[9px]">
                        <span className={`inline-block px-1.5 py-0.5 rounded ${evalP.riskBgColor || 'bg-slate-100'} border ${evalP.riskBorderColor || 'border-slate-300'}`}>
                          {evalP.riskBadgeLabel ? evalP.riskBadgeLabel.split(' (')[0] : 'Valutato'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Legenda Fasce di Rischio MoVaRisCh 2026 */}
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-[9px] space-y-1.5">
              <span className="font-bold text-slate-700 uppercase tracking-wider block">Legenda Classificazione del Rischio MoVaRisCh (Ed. 2026):</span>
              <div className="grid grid-cols-5 gap-2 text-center font-bold">
                <div className="p-1 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                  R &lt; 15: Irrilevante (Verde)
                </div>
                <div className="p-1 rounded bg-amber-100 text-amber-900 border border-amber-300">
                  15 ≤ R &lt; 21: Incertezza (Arancio)
                </div>
                <div className="p-1 rounded bg-rose-100 text-rose-900 border border-rose-300">
                  21 ≤ R ≤ 40: Non Irrilevante (Rosso)
                </div>
                <div className="p-1 rounded bg-red-200 text-red-950 border border-red-400">
                  40 &lt; R ≤ 80: Rischio Elevato
                </div>
                <div className="p-1 rounded bg-purple-200 text-purple-950 border border-purple-400">
                  R &gt; 80: Grave Rischio (Viola)
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* PAGINA 3+: SCHEDE ANALITICHE DI DETTAGLIO PER SINGOLO PRODOTTO */}
          {/* ============================================================ */}
          <div className="py-2 space-y-5">
            {/* Fascia superiore: Codice SGQ posizionato in alto a destra */}
            <div className="flex justify-end items-center pb-1">
              <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded whitespace-nowrap">
                M_4.4.6_O25_Ag.Chim.&nbsp;-&nbsp;{projectData.revision || 'Rev00'}
              </span>
            </div>

            {/* Titolo di Sezione a tutta larghezza */}
            <div className="border-b border-slate-300 pb-2">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                2. Schede Analitiche di Dettaglio per Singolo Prodotto Chimico
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Azienda: <b>{generalInfo.companyName || projectData.client || '—'}</b>
                {generalInfo.site ? ` | Sede: ${generalInfo.site}` : ''}
                {generalInfo.department ? ` | Reparto: ${generalInfo.department}` : ''}
              </p>
            </div>

            {products.map((p, idx) => {
              const evalP = evaluatedProducts.get(p.id)?.evaluation || evaluateMoVaRisCh(p);
              if (!evalP) return null;

              return (
                <div 
                  key={p.id} 
                  className="border border-slate-300 rounded-xl p-4 text-xs space-y-3 bg-white"
                  style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                >
                  {/* Intestazione Scheda */}
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <div>
                      <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                        <span className="font-mono bg-slate-900 text-white px-2 py-0.5 rounded text-xs">
                          Scheda {idx + 1}
                        </span>
                        <span>{p.name || 'Prodotto senza nome'}</span>
                      </h3>
                      <div className="text-[10px] text-slate-500 mt-1 space-y-0.5">
                        <p>
                          Produttore: <b>{p.producer || 'N.D.'}</b> | Data Scheda di Sicurezza (SDS): <b>{formatToItalianDate(p.sdsDate)}</b>
                        </p>
                        {(p.homogeneousGroup || p.activity) && (
                          <p className="text-slate-700">
                            {p.homogeneousGroup && <span>Sottogruppo Omogeneo (Mansione): <b>{p.homogeneousGroup}</b></span>}
                            {p.homogeneousGroup && p.activity && <span> | </span>}
                            {p.activity && <span>Attività Lavorativa: <b>{p.activity}</b></span>}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-xs font-black px-2.5 py-1 bg-slate-100 rounded border border-slate-300 inline-block">
                        R_finale = {evalP.criticalRisk.toFixed(2)}
                      </span>
                      <span className="block text-[9px] font-bold text-slate-700 mt-0.5">
                        {evalP.riskBadgeLabel ? evalP.riskBadgeLabel.split(' (')[0] : 'Valutato'}
                      </span>
                    </div>
                  </div>

                  {/* Parametri di Calcolo MoVaRisCh */}
                  <div className="grid grid-cols-4 gap-2 text-[10px] bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <div>
                      <span className="block text-slate-500 font-bold uppercase text-[9px]">Score Pericolo (P):</span>
                      <b className="font-mono text-slate-900 text-xs">{evalP.scoreP.toFixed(2)}</b>
                    </div>
                    <div>
                      <span className="block text-slate-500 font-bold uppercase text-[9px]">Disponibilità (D):</span>
                      <b className="font-mono text-slate-900 text-xs">{evalP.scoreD}</b>
                    </div>
                    <div>
                      <span className="block text-slate-500 font-bold uppercase text-[9px]">Uso (U) / Comp. (C):</span>
                      <b className="font-mono text-slate-900 text-xs">{evalP.scoreU} / {evalP.scoreC}</b>
                    </div>
                    <div>
                      <span className="block text-slate-500 font-bold uppercase text-[9px]">Intensità (I) x Dist. (d):</span>
                      <b className="font-mono text-slate-900 text-xs">{evalP.scoreI} x {evalP.distanceFactor} = {evalP.eInal.toFixed(2)}</b>
                    </div>
                    <div>
                      <span className="block text-slate-500 font-bold uppercase text-[9px]">Esposizione Cutanea:</span>
                      <b className="font-mono text-slate-900 text-xs">E_cute = {evalP.eCute.toFixed(2)}</b>
                    </div>
                    <div>
                      <span className="block text-slate-500 font-bold uppercase text-[9px]">Rischio Inalatorio:</span>
                      <b className="font-mono text-sky-800 text-xs">R_inal = {evalP.rInal.toFixed(2)}</b>
                    </div>
                    <div>
                      <span className="block text-slate-500 font-bold uppercase text-[9px]">Rischio Cutaneo:</span>
                      <b className="font-mono text-orange-800 text-xs">R_cute = {evalP.rCute.toFixed(2)}</b>
                    </div>
                    <div>
                      <span className="block text-slate-500 font-bold uppercase text-[9px]">Cessore Formaldeide:</span>
                      <b className={`font-mono text-xs ${p.formaldehydeDonor === 'SI' ? 'text-rose-700' : 'text-slate-900'}`}>{p.formaldehydeDonor || 'NO'}</b>
                    </div>
                  </div>

                  {/* Frasi H e TLV */}
                  <div className="grid grid-cols-2 gap-3 text-[10px]">
                    <div>
                      <span className="font-bold text-slate-700 block mb-0.5">Frasi di Pericolo H ed EUH:</span>
                      <p className="text-slate-600 leading-relaxed">
                        {p.selectedHPhrases?.length > 0 
                          ? p.selectedHPhrases.map(c => {
                              const item = H_PHRASES_2026.find(h => h.code === c);
                              return item ? `${item.code.replace('_', ' ')} (${item.text ? (item.text.split(' - ')[1] || item.text) : ''})` : c;
                            }).join('; ')
                          : 'Nessuna frase di pericolo associata.'}
                      </p>
                    </div>

                    <div>
                      <span className="font-bold text-slate-700 block mb-0.5">Valori Limite di Esposizione Professionale (TLV-TWA):</span>
                      <p className="text-slate-600 leading-relaxed font-mono">
                        {p.tlvLimits?.length > 0 
                          ? p.tlvLimits.map(t => `${t.substance ? `${t.substance}: ` : ''}${t.limitValue}`).join('; ')
                          : 'Nessun valore limite presente in SDS.'}
                      </p>
                    </div>
                  </div>

                  {/* Misure di Prevenzione Sanitarie */}
                  {p.healthPreventionsText && (
                    <div className="text-[10px] border-t border-slate-200 pt-2">
                      <span className="font-bold text-slate-700 block mb-0.5">Misure di Prevenzione e Istruzioni Sanitarie:</span>
                      <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">
                        {p.healthPreventionsText}
                      </p>
                    </div>
                  )}

                  {/* DPI Prescritti - FORMATO ELENCO IN COLONNA SINGOLA A TUTTA LARGHEZZA */}
                  {p.selectedDpiIds && p.selectedDpiIds.length > 0 && (
                    <div className="text-[10px] border-t border-slate-200 pt-2.5 mt-2">
                      <span className="font-black text-slate-800 block mb-2 uppercase text-[9px] tracking-wide">
                        Dispositivi di Protezione Individuale (DPI) Obbligatori per la Manipolazione:
                      </span>
                      <div className="flex flex-col gap-2">
                        {p.selectedDpiIds.map(dpiId => {
                          const dpi = DEFAULT_DPI_CATALOG.find(d => d.id === dpiId);
                          if (!dpi) return null;
                          return (
                            <div 
                              key={dpiId} 
                              className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-lg w-full"
                              style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                            >
                              {/* Riquadro Immagine DPI ad inizio riga */}
                              <div className="w-14 h-14 shrink-0 bg-white border border-slate-300 rounded-lg flex items-center justify-center overflow-hidden shadow-2xs p-1">
                                {dpi.imageSrc ? (
                                  <img src={dpi.imageSrc} alt={dpi.name} className="w-full h-full object-contain" />
                                ) : (
                                  <DpiIcon id={dpi.id} size={28} className="w-7 h-7 text-slate-800 print:text-black" />
                                )}
                              </div>
                              {/* Dati e Norma Tecnica DPI */}
                              <div className="flex-1 min-w-0">
                                <span className="font-bold text-slate-900 text-[11px] leading-snug block">{dpi.name}</span>
                                {dpi.standard && (
                                  <span className="font-mono text-[9px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mt-1">
                                    {dpi.standard}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
