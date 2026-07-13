import React, { useState, useEffect } from 'react';
import { db, isFirebaseMock } from '../firebase/config';
import { 
  fetchPipeCatalog, 
  savePipeCatalog, 
  fetchEquivalentLengths, 
  saveEquivalentLengths, 
  fetchGasEquivalentLengths, 
  saveGasEquivalentLengths, 
  fetchClimateData, 
  saveClimateData 
} from '../utils/thermodynamicDbHelper';
import { 
  fetchElectricalCables, 
  fetchElectricalContainers, 
  saveElectricalItem, 
  deleteElectricalItem 
} from '../utils/electricalDbHelper';
import { CableProduct, ContainerFamily } from '../data/electricalDatabase';
import { PipeMaterial } from '../data/pipeCatalog';
import { EquivalentLengthPiece, DN_LIST } from '../data/equivalentLengths';
import { GAS_DN_LIST } from '../data/gasEquivalentLengths';
import { ProvinceClimateData } from '../data/climateData';
import { 
  Database, 
  Layers, 
  Plus, 
  Trash2, 
  Save, 
  Download, 
  RefreshCw, 
  FileSpreadsheet, 
  Search, 
  Edit3, 
  Settings,
  ArrowLeft
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface DatabaseManagerProps {
  type: 'termo' | 'elettrico';
  setAppMode: (mode: string) => void;
  projectData: any;
}

export function DatabaseManager({ type, setAppMode, projectData }: DatabaseManagerProps) {
  const isDemoMode = isFirebaseMock || (projectData && projectData.isDemo);

  // Stato navigazione tab
  const [activeTab, setActiveTab] = useState<string>('');

  // Stati cataloghi Termoidraulici
  const [pipeCatalog, setPipeCatalog] = useState<Record<string, PipeMaterial>>({});
  const [equivalentLengths, setEquivalentLengths] = useState<Record<string, EquivalentLengthPiece>>({});
  const [gasEquivalentLengths, setGasEquivalentLengths] = useState<Record<string, Record<number, number>>>({});
  const [climateData, setClimateData] = useState<ProvinceClimateData[]>([]);

  // Stati cataloghi Elettrici
  const [cablesCatalog, setCablesCatalog] = useState<CableProduct[]>([]);
  const [containersCatalog, setContainersCatalog] = useState<ContainerFamily[]>([]);

  // Stato loading ed editing
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Stati di selezione per sottomenu Termoidraulica
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [selectedFitting, setSelectedFitting] = useState<string>('');
  const [selectedGasFitting, setSelectedGasFitting] = useState<string>('');

  // Stati per aggiunta/editing
  const [editCableId, setEditCableId] = useState<string | null>(null);
  const [editContainerId, setEditContainerId] = useState<string | null>(null);
  const [newCableName, setNewCableName] = useState<string>('');
  const [newCableDesc, setNewCableDesc] = useState<string>('');

  // Caricamento dati lazy in base al tab selezionato
  const loadTabDb = async (tab: string, force = false) => {
    setLoading(true);
    try {
      if (type === 'elettrico') {
        if (tab === 'cavi') {
          const res = await fetchElectricalCables(db, isDemoMode);
          setCablesCatalog(res);
        } else if (tab === 'contenitori') {
          const res = await fetchElectricalContainers(db, isDemoMode);
          setContainersCatalog(res);
        }
      } else {
        if (tab === 'tubi') {
          const res = await fetchPipeCatalog(db, isDemoMode);
          setPipeCatalog(res);
          if (!selectedMaterial || force) {
            setSelectedMaterial(Object.keys(res)[0] || '');
          }
        } else if (tab === 'fluidi_eq') {
          const res = await fetchEquivalentLengths(db, isDemoMode);
          setEquivalentLengths(res);
          if (!selectedFitting || force) {
            setSelectedFitting(Object.keys(res)[0] || '');
          }
        } else if (tab === 'gas_eq') {
          const res = await fetchGasEquivalentLengths(db, isDemoMode);
          setGasEquivalentLengths(res);
          if (!selectedGasFitting || force) {
            setSelectedGasFitting(Object.keys(res)[0] || '');
          }
        } else if (tab === 'climatici') {
          const res = await fetchClimateData(db, isDemoMode);
          setClimateData(res);
        }
      }
    } catch (e) {
      console.error("Errore caricamento database:", e);
      if (window.suiteUI) window.suiteUI.toast("Errore nel caricamento del database remoto", "error");
    } finally {
      setLoading(false);
    }
  };

  // Tab di default all'avvio
  useEffect(() => {
    const defaultTab = type === 'elettrico' ? 'cavi' : 'tubi';
    setActiveTab(defaultTab);
    loadTabDb(defaultTab);
  }, [type]);

  // Carica i dati quando cambia il tab
  useEffect(() => {
    if (activeTab) {
      loadTabDb(activeTab);
    }
  }, [activeTab]);

  // --- LOGICHE SALVATAGGIO TERMOIDRAULICA ---
  const handleSavePipeCatalog = async () => {
    setLoading(true);
    try {
      await savePipeCatalog(db, isDemoMode, pipeCatalog);
      if (window.suiteUI) window.suiteUI.toast("Catalogo tubi salvato con successo!", "success");
    } catch (e) {
      if (window.suiteUI) window.suiteUI.toast("Errore nel salvataggio del catalogo", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEquivalentLengths = async () => {
    setLoading(true);
    try {
      await saveEquivalentLengths(db, isDemoMode, equivalentLengths);
      if (window.suiteUI) window.suiteUI.toast("Lunghezze equivalenti salvate con successo!", "success");
    } catch (e) {
      if (window.suiteUI) window.suiteUI.toast("Errore nel salvataggio delle lunghezze equivalenti", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGasEquivalentLengths = async () => {
    setLoading(true);
    try {
      await saveGasEquivalentLengths(db, isDemoMode, gasEquivalentLengths);
      if (window.suiteUI) window.suiteUI.toast("Lunghezze equivalenti gas salvate!", "success");
    } catch (e) {
      if (window.suiteUI) window.suiteUI.toast("Errore nel salvataggio", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClimateData = async (updatedData?: ProvinceClimateData[]) => {
    setLoading(true);
    try {
      const dataToSave = updatedData || climateData;
      await saveClimateData(db, isDemoMode, dataToSave);
      if (window.suiteUI) window.suiteUI.toast("Dati climatici salvati con successo!", "success");
    } catch (e) {
      if (window.suiteUI) window.suiteUI.toast("Errore nel salvataggio dei dati climatici", "error");
    } finally {
      setLoading(false);
    }
  };

  // Aggiungi record a dati climatici
  const handleAddClimateRow = () => {
    const newCity: ProvinceClimateData = {
      regione: 'Nuova Regione',
      provincia: 'Nuova Città',
      sigla: 'XX',
      tSummer: 30,
      rhSummer: 50,
      tWinter: 0,
      rhWinter: 85
    };
    setClimateData(prev => [newCity, ...prev]);
  };

  const handleDeleteClimateRow = async (idx: number) => {
    const confirmed = await window.suiteUI?.confirm("Vuoi eliminare questa città?");
    if (!confirmed) return;
    const updated = climateData.filter((_, i) => i !== idx);
    setClimateData(updated);
    handleSaveClimateData(updated);
  };

  // --- LOGICHE SALVATAGGIO ELETTRICO ---
  const handleSaveCableToDb = async (cable: CableProduct) => {
    try {
      await saveElectricalItem(db, isDemoMode, cable);
      setEditCableId(null);
      if (window.suiteUI) window.suiteUI.toast("Cavo salvato con successo!", "success");
      loadTabDb('cavi', true);
    } catch (e) {
      if (window.suiteUI) window.suiteUI.toast("Errore nel salvataggio del cavo", "error");
    }
  };

  const handleDeleteCableFromDb = async (id: string) => {
    const confirmed = await window.suiteUI?.confirm("Vuoi eliminare definitivamente questo cavo dal database comune?");
    if (!confirmed) return;
    try {
      await deleteElectricalItem(db, isDemoMode, id, 'cavo');
      if (window.suiteUI) window.suiteUI.toast("Cavo eliminato con successo!", "success");
      loadTabDb('cavi', true);
    } catch (e) {
      if (window.suiteUI) window.suiteUI.toast("Errore nell'eliminazione", "error");
    }
  };

  const handleAddNewCableToDb = async () => {
    if (!newCableName.trim()) {
      if (window.suiteUI) window.suiteUI.alert("Inserisci un nome valido.");
      return;
    }
    const id = newCableName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newCable: CableProduct = {
      id,
      name: newCableName.trim(),
      description: newCableDesc.trim(),
      type: 'cavo',
      formations: [{ formation: '1x1.5', diameter: 3.0, weight: 0.020 }]
    };
    try {
      await saveElectricalItem(db, isDemoMode, newCable);
      setNewCableName('');
      setNewCableDesc('');
      if (window.suiteUI) window.suiteUI.toast("Nuovo cavo aggiunto!", "success");
      loadTabDb('cavi', true);
    } catch (e) {
      if (window.suiteUI) window.suiteUI.toast("Errore nella creazione", "error");
    }
  };

  // --- ESPORTAZIONE EXCEL COMPLESSIVA ---
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    if (type === 'elettrico') {
      // Foglio Cavi
      const flatCablesData: any[] = [];
      cablesCatalog.forEach(c => {
        c.formations.forEach(f => {
          flatCablesData.push({
            "Cavo": c.name,
            "Descrizione": c.description,
            "Formazione": f.formation,
            "Diametro Esterno [mm]": f.diameter,
            "Peso Lineare [kg/m]": f.weight
          });
        });
      });
      const wsCables = XLSX.utils.json_to_sheet(flatCablesData);
      XLSX.utils.book_append_sheet(wb, wsCables, "Cavi Elettrici");

      // Foglio Contenitori
      const flatContainersData: any[] = [];
      containersCatalog.forEach(fam => {
        fam.sizes.forEach(sz => {
          flatContainersData.push({
            "Famiglia": fam.name,
            "Posa": fam.installationType,
            "Sezione": fam.sectionType,
            "Codice": sz.code,
            "Etichetta": sz.label,
            "Larghezza [mm]": sz.width || "",
            "Altezza [mm]": sz.height || "",
            "Diametro Esterno [mm]": sz.outerDiameter || "",
            "Diametro Interno [mm]": sz.innerDiameter || "",
            "Peso Condotto [kg/m]": sz.weight,
            "Peso Coperchio [kg/m]": sz.coverWeight || ""
          });
        });
      });
      const wsContainers = XLSX.utils.json_to_sheet(flatContainersData);
      XLSX.utils.book_append_sheet(wb, wsContainers, "Tubi e Canali");

      XLSX.writeFile(wb, "Database_Elettrico.xlsx");
    } else {
      // Foglio Tubi & Scabrezze
      const flatPipesData: any[] = [];
      Object.keys(pipeCatalog).forEach(matName => {
        const mat = pipeCatalog[matName];
        Object.keys(mat.specs).forEach(dn => {
          const spec = mat.specs[dn];
          Object.keys(spec).forEach(pn => {
            flatPipesData.push({
              "Materiale": matName,
              "Scabrezza [mm]": mat.roughness,
              "Conducibilità [W/mK]": mat.lambda,
              "DN": dn,
              "PN/Spessore": pn,
              "Diametro Interno [mm]": spec[pn]
            });
          });
        });
      });
      const wsPipes = XLSX.utils.json_to_sheet(flatPipesData);
      XLSX.utils.book_append_sheet(wb, wsPipes, "Tubi e Scabrezze");

      // Foglio Equivalenti Fluidi
      const flatFluidEq: any[] = [];
      Object.keys(equivalentLengths).forEach(fitId => {
        const piece = equivalentLengths[fitId];
        DN_LIST.forEach(dn => {
          flatFluidEq.push({
            "Pezzo Speciale": piece.label,
            "DN": dn,
            "Lunghezza Equivalente [m]": piece.values[dn] || 0
          });
        });
      });
      const wsFluidEq = XLSX.utils.json_to_sheet(flatFluidEq);
      XLSX.utils.book_append_sheet(wb, wsFluidEq, "Lunghezze Equivalenti Fluidi");

      // Foglio Equivalenti Gas
      const flatGasEq: any[] = [];
      Object.keys(gasEquivalentLengths).forEach(fitId => {
        const values = gasEquivalentLengths[fitId];
        GAS_DN_LIST.forEach(dn => {
          flatGasEq.push({
            "Raccordo Gas": fitId,
            "DN": dn,
            "Lunghezza Equivalente [m]": values[dn] || 0
          });
        });
      });
      const wsGasEq = XLSX.utils.json_to_sheet(flatGasEq);
      XLSX.utils.book_append_sheet(wb, wsGasEq, "Lunghezze Equivalenti Gas");

      // Foglio Dati Climatici
      const wsClimate = XLSX.utils.json_to_sheet(climateData);
      XLSX.utils.book_append_sheet(wb, wsClimate, "Dati Climatici");

      XLSX.writeFile(wb, "Database_Termodinamica.xlsx");
    }
    if (window.suiteUI) window.suiteUI.toast("Database esportato con successo!", "success");
  };

  // Filtro ricerca climatici
  const filteredClimateData = climateData.filter(c => {
    const term = searchTerm.toLowerCase();
    return (c.provincia || '').toLowerCase().includes(term) ||
           (c.regione || '').toLowerCase().includes(term) ||
           (c.sigla || '').toLowerCase().includes(term);
  });

  return (
    <div className="bg-slate-100 rounded-3xl p-6 md:p-8 animate-in fade-in duration-300">
      
      {/* Header del database manager */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-slate-200">
        <div>
          <button 
            onClick={() => setAppMode('dashboard')}
            className="flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm cursor-pointer mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Torna alla Dashboard
          </button>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <span className="p-2 bg-slate-800 text-white rounded-2xl">
              <Database className="w-6 h-6" />
            </span>
            Archivio Database Centralizzato - {type === 'elettrico' ? 'Impianti Elettrici' : 'Termodinamica & Fluidi'}
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Gestisci in sicurezza le specifiche comuni utilizzate nei calcoli. Le modifiche sono istantanee per tutti gli utenti.
          </p>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => loadTabDb(activeTab, true)}
            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-350 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Aggiorna
          </button>
          <button 
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Esporta Excel
          </button>
        </div>
      </div>

      {/* Tabs Principali */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-3 text-xs">
        {type === 'elettrico' ? (
          <>
            <button 
              onClick={() => setActiveTab('cavi')}
              className={`px-4 py-2.5 font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'cavi' ? 'bg-slate-800 text-white shadow-md' : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-700'
              }`}
            >
              ⚡ Cavi Elettrici ({cablesCatalog.length})
            </button>
            <button 
              onClick={() => setActiveTab('contenitori')}
              className={`px-4 py-2.5 font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'contenitori' ? 'bg-slate-800 text-white shadow-md' : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-700'
              }`}
            >
              📦 Tubi e Canaline ({containersCatalog.reduce((acc, f) => acc + f.sizes.length, 0)})
            </button>
          </>
        ) : (
          <>
            <button 
              onClick={() => setActiveTab('tubi')}
              className={`px-4 py-2.5 font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'tubi' ? 'bg-slate-800 text-white shadow-md' : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-700'
              }`}
            >
              🌊 Tubi & Scabrezze
            </button>
            <button 
              onClick={() => setActiveTab('fluidi_eq')}
              className={`px-4 py-2.5 font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'fluidi_eq' ? 'bg-slate-800 text-white shadow-md' : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-700'
              }`}
            >
              🚰 Raccordi Fluidi (Eq.)
            </button>
            <button 
              onClick={() => setActiveTab('gas_eq')}
              className={`px-4 py-2.5 font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'gas_eq' ? 'bg-slate-800 text-white shadow-md' : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-700'
              }`}
            >
              💨 Raccordi Gas (Eq.)
            </button>
            <button 
              onClick={() => setActiveTab('climatici')}
              className={`px-4 py-2.5 font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'climatici' ? 'bg-slate-800 text-white shadow-md' : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-700'
              }`}
            >
              🌡️ Dati Climatici ({climateData.length})
            </button>
          </>
        )}
      </div>

      {/* Area Contenuto */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-450 font-bold text-xs gap-2 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <div className="w-5 h-5 border-2 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
          <span>Caricamento dal Server Cloud...</span>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* TAB: CAVI ELETRICI */}
          {activeTab === 'cavi' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row items-end gap-3 text-xs">
                <div className="flex-1 w-full font-bold">
                  <label className="block text-[9px] text-slate-400 uppercase mb-1">Nome Nuovo Cavo</label>
                  <input 
                    type="text"
                    placeholder="Es: FG16OR16 0.6/1kV"
                    value={newCableName}
                    onChange={e => setNewCableName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                  />
                </div>
                <div className="flex-2 w-full font-bold">
                  <label className="block text-[9px] text-slate-400 uppercase mb-1">Descrizione</label>
                  <input 
                    type="text"
                    placeholder="Es: Cavo multipolare per energia..."
                    value={newCableDesc}
                    onChange={e => setNewCableDesc(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                  />
                </div>
                <button 
                  onClick={handleAddNewCableToDb}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg transition-colors cursor-pointer w-full md:w-auto"
                >
                  Aggiungi
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {cablesCatalog.map(c => {
                  const isEditing = editCableId === c.id;
                  return (
                    <div key={c.id} className="border border-slate-150 rounded-2xl p-4 bg-slate-50/30 text-xs font-semibold">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <span className="font-bold text-sm text-slate-850">{c.name}</span>
                          <span className="text-[10px] text-slate-400 ml-2">({c.id})</span>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">{c.description}</p>
                        </div>
                        <div className="flex gap-1">
                          {isEditing ? (
                            <button 
                              onClick={() => handleSaveCableToDb(c)}
                              className="px-2 py-1 bg-amber-500 text-white rounded-md flex items-center gap-1 cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" /> Salva
                            </button>
                          ) : (
                            <button 
                              onClick={() => setEditCableId(c.id)}
                              className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-md cursor-pointer"
                            >
                              Edita Formazioni
                            </button>
                          )}
                          <button 
                            onClick={() => handleDeleteCableFromDb(c.id)}
                            className="px-2.5 py-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer"
                          >
                            Elimina
                          </button>
                        </div>
                      </div>

                      {isEditing && (
                        <div className="bg-white rounded-xl p-3 border border-slate-150 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {c.formations.map((f, fIdx) => (
                              <div key={fIdx} className="bg-slate-50 border border-slate-150 rounded-lg p-2.5 flex items-center gap-2">
                                <div className="flex-1">
                                  <label className="block text-[8px] text-slate-400 font-bold uppercase">Form.</label>
                                  <input 
                                    type="text" 
                                    value={f.formation} 
                                    onChange={e => {
                                      const updatedForm = [...c.formations];
                                      updatedForm[fIdx] = { ...f, formation: e.target.value };
                                      const updatedCable = { ...c, formations: updatedForm };
                                      setCablesCatalog(prev => prev.map(item => item.id === c.id ? updatedCable : item));
                                    }}
                                    className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-center font-bold"
                                  />
                                </div>
                                <div className="w-16">
                                  <label className="block text-[8px] text-slate-400 font-bold uppercase">Ø [mm]</label>
                                  <input 
                                    type="number" 
                                    step="any"
                                    value={f.diameter} 
                                    onChange={e => {
                                      const updatedForm = [...c.formations];
                                      updatedForm[fIdx] = { ...f, diameter: parseFloat(e.target.value) || 0 };
                                      const updatedCable = { ...c, formations: updatedForm };
                                      setCablesCatalog(prev => prev.map(item => item.id === c.id ? updatedCable : item));
                                    }}
                                    className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-center font-bold"
                                  />
                                </div>
                                <div className="w-16">
                                  <label className="block text-[8px] text-slate-400 font-bold uppercase">Peso kg/m</label>
                                  <input 
                                    type="number" 
                                    step="any"
                                    value={f.weight} 
                                    onChange={e => {
                                      const updatedForm = [...c.formations];
                                      updatedForm[fIdx] = { ...f, weight: parseFloat(e.target.value) || 0 };
                                      const updatedCable = { ...c, formations: updatedForm };
                                      setCablesCatalog(prev => prev.map(item => item.id === c.id ? updatedCable : item));
                                    }}
                                    className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-center font-bold"
                                  />
                                </div>
                                <button 
                                  onClick={() => {
                                    const updatedForm = c.formations.filter((_, idx) => idx !== fIdx);
                                    const updatedCable = { ...c, formations: updatedForm };
                                    setCablesCatalog(prev => prev.map(item => item.id === c.id ? updatedCable : item));
                                  }}
                                  className="text-slate-400 hover:text-rose-500 mt-3"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}

                            <button 
                              onClick={() => {
                                const updatedForm = [...c.formations, { formation: '1x2.5', diameter: 3.5, weight: 0.03 }];
                                const updatedCable = { ...c, formations: updatedForm };
                                setCablesCatalog(prev => prev.map(item => item.id === c.id ? updatedCable : item));
                              }}
                              className="border-2 border-dashed border-slate-200 rounded-lg p-3 text-center flex items-center justify-center text-slate-400 hover:border-slate-800 hover:text-slate-700 cursor-pointer font-bold"
                            >
                              + Aggiungi Formazione
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: TUBI E CANALI (ELETTRICI) */}
          {activeTab === 'contenitori' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              {containersCatalog.map(fam => {
                const isEditing = editContainerId === fam.id;
                return (
                  <div key={fam.id} className="border border-slate-150 rounded-2xl p-4 bg-slate-50/30 text-xs font-semibold">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <span className="font-bold text-sm text-slate-800">{fam.name}</span>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Codice: {fam.id} | Sezione: {fam.sectionType} | Posa: {fam.installationType}
                        </p>
                      </div>
                      <div>
                        {isEditing ? (
                          <button 
                            onClick={async () => {
                              try {
                                await saveElectricalItem(db, isDemoMode, fam);
                                setEditContainerId(null);
                                if (window.suiteUI) window.suiteUI.toast("Salvataggio completato!", "success");
                                loadTabDb('contenitori', true);
                              } catch (e) {
                                if (window.suiteUI) window.suiteUI.toast("Errore nel salvataggio", "error");
                              }
                            }}
                            className="px-3 py-1 bg-amber-500 text-white rounded-md flex items-center gap-1 cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" /> Salva
                          </button>
                        ) : (
                          <button 
                            onClick={() => setEditContainerId(fam.id)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-md cursor-pointer"
                          >
                            Edita Dimensioni
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="bg-white rounded-xl p-3 border border-slate-150 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {fam.sizes.map((sz, szIdx) => (
                            <div key={szIdx} className="bg-slate-50 border border-slate-150 rounded-lg p-2.5 flex flex-col gap-2 relative">
                              <button 
                                onClick={() => {
                                  const updatedSizes = fam.sizes.filter((_, idx) => idx !== szIdx);
                                  const updatedFam = { ...fam, sizes: updatedSizes };
                                  setContainersCatalog(prev => prev.map(item => item.id === fam.id ? updatedFam : item));
                                }}
                                className="absolute top-2 right-2 text-slate-400 hover:text-rose-500"
                              >
                                ✕
                              </button>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[8px] text-slate-400 uppercase font-bold">Codice</label>
                                  <input 
                                    type="text" 
                                    value={sz.code} 
                                    onChange={e => {
                                      const updatedSizes = [...fam.sizes];
                                      updatedSizes[szIdx] = { ...sz, code: e.target.value };
                                      const updatedFam = { ...fam, sizes: updatedSizes };
                                      setContainersCatalog(prev => prev.map(item => item.id === fam.id ? updatedFam : item));
                                    }}
                                    className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-center font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] text-slate-400 uppercase font-bold">Label</label>
                                  <input 
                                    type="text" 
                                    value={sz.label} 
                                    onChange={e => {
                                      const updatedSizes = [...fam.sizes];
                                      updatedSizes[szIdx] = { ...sz, label: e.target.value };
                                      const updatedFam = { ...fam, sizes: updatedSizes };
                                      setContainersCatalog(prev => prev.map(item => item.id === fam.id ? updatedFam : item));
                                    }}
                                    className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-center font-bold"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-1.5">
                                {fam.sectionType === 'rettangolare' ? (
                                  <>
                                    <div>
                                      <label className="block text-[7px] text-slate-400 uppercase font-bold">Largh.</label>
                                      <input 
                                        type="number" 
                                        value={sz.width || 0} 
                                        onChange={e => {
                                          const updatedSizes = [...fam.sizes];
                                          updatedSizes[szIdx] = { ...sz, width: parseFloat(e.target.value) || 0 };
                                          const updatedFam = { ...fam, sizes: updatedSizes };
                                          setContainersCatalog(prev => prev.map(item => item.id === fam.id ? updatedFam : item));
                                        }}
                                        className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 text-center font-bold"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[7px] text-slate-400 uppercase font-bold">Alt.</label>
                                      <input 
                                        type="number" 
                                        value={sz.height || 0} 
                                        onChange={e => {
                                          const updatedSizes = [...fam.sizes];
                                          updatedSizes[szIdx] = { ...sz, height: parseFloat(e.target.value) || 0 };
                                          const updatedFam = { ...fam, sizes: updatedSizes };
                                          setContainersCatalog(prev => prev.map(item => item.id === fam.id ? updatedFam : item));
                                        }}
                                        className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 text-center font-bold"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[7px] text-slate-400 uppercase font-bold">Coperc.</label>
                                      <input 
                                        type="number" 
                                        step="any"
                                        value={sz.coverWeight || 0} 
                                        onChange={e => {
                                          const updatedSizes = [...fam.sizes];
                                          updatedSizes[szIdx] = { ...sz, coverWeight: parseFloat(e.target.value) || 0 };
                                          const updatedFam = { ...fam, sizes: updatedSizes };
                                          setContainersCatalog(prev => prev.map(item => item.id === fam.id ? updatedFam : item));
                                        }}
                                        className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 text-center font-bold"
                                      />
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div>
                                      <label className="block text-[7px] text-slate-400 uppercase font-bold">Ø Est.</label>
                                      <input 
                                        type="number" 
                                        value={sz.outerDiameter || 0} 
                                        onChange={e => {
                                          const updatedSizes = [...fam.sizes];
                                          updatedSizes[szIdx] = { ...sz, outerDiameter: parseFloat(e.target.value) || 0 };
                                          const updatedFam = { ...fam, sizes: updatedSizes };
                                          setContainersCatalog(prev => prev.map(item => item.id === fam.id ? updatedFam : item));
                                        }}
                                        className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 text-center font-bold"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[7px] text-slate-400 uppercase font-bold">Ø Int.</label>
                                      <input 
                                        type="number" 
                                        value={sz.innerDiameter || 0} 
                                        onChange={e => {
                                          const updatedSizes = [...fam.sizes];
                                          updatedSizes[szIdx] = { ...sz, innerDiameter: parseFloat(e.target.value) || 0 };
                                          const updatedFam = { ...fam, sizes: updatedSizes };
                                          setContainersCatalog(prev => prev.map(item => item.id === fam.id ? updatedFam : item));
                                        }}
                                        className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 text-center font-bold"
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                              
                              <div>
                                <label className="block text-[8px] text-slate-400 uppercase font-bold">Peso Vuoto (kg/m)</label>
                                <input 
                                  type="number" 
                                  step="any"
                                  value={sz.weight} 
                                  onChange={e => {
                                    const updatedSizes = [...fam.sizes];
                                    updatedSizes[szIdx] = { ...sz, weight: parseFloat(e.target.value) || 0 };
                                    const updatedFam = { ...fam, sizes: updatedSizes };
                                    setContainersCatalog(prev => prev.map(item => item.id === fam.id ? updatedFam : item));
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-700"
                                />
                              </div>
                            </div>
                          ))}
                          
                          <button 
                            onClick={() => {
                              const updatedSizes = [...fam.sizes, { code: 'NEW_CODE', label: 'Nuova Misura', weight: 0.5, width: 100, height: 75 }];
                              const updatedFam = { ...fam, sizes: updatedSizes };
                              setContainersCatalog(prev => prev.map(item => item.id === fam.id ? updatedFam : item));
                            }}
                            className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center flex items-center justify-center text-slate-400 hover:border-slate-800 hover:text-slate-700 cursor-pointer font-bold"
                          >
                            + Aggiungi Misura
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB: TUBI & SCABREZZE (TERMOIDRAULICA) */}
          {activeTab === 'tubi' && (
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* Menu laterale materiali */}
              <div className="w-full lg:w-64 bg-white rounded-3xl p-4 border border-slate-200 shadow-sm shrink-0">
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-3">Materiali Tubazione</span>
                <div className="flex flex-col gap-1.5">
                  {Object.keys(pipeCatalog).map(matName => (
                    <button 
                      key={matName}
                      onClick={() => setSelectedMaterial(matName)}
                      className={`w-full text-left p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                        selectedMaterial === matName 
                          ? 'bg-slate-800 text-white border-slate-800' 
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {matName}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dettagli materiale selezionato */}
              {selectedMaterial && pipeCatalog[selectedMaterial] && (
                <div className="flex-1 w-full bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h3 className="text-base font-black text-slate-850">{selectedMaterial}</h3>
                    <button 
                      onClick={handleSavePipeCatalog}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" /> Salva Modifiche
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Scabrezza (mm)</label>
                      <input 
                        type="number"
                        step="any"
                        value={pipeCatalog[selectedMaterial].roughness}
                        onChange={e => {
                          const updated = { ...pipeCatalog };
                          updated[selectedMaterial].roughness = parseFloat(e.target.value) || 0;
                          setPipeCatalog(updated);
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Conducibilità Lambda (W/mK)</label>
                      <input 
                        type="number"
                        step="any"
                        value={pipeCatalog[selectedMaterial].lambda}
                        onChange={e => {
                          const updated = { ...pipeCatalog };
                          updated[selectedMaterial].lambda = parseFloat(e.target.value) || 0;
                          setPipeCatalog(updated);
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">Tabella Dimensioni (DN e Diametro Interno in mm)</span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.keys(pipeCatalog[selectedMaterial].specs).map(dn => {
                        const spec = pipeCatalog[selectedMaterial].specs[dn];
                        return (
                          <div key={dn} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 relative">
                            <button 
                              onClick={async () => {
                                const confirmed = await window.suiteUI?.confirm(`Vuoi rimuovere il DN ${dn} per questo materiale?`);
                                if (!confirmed) return;
                                const updated = { ...pipeCatalog };
                                delete updated[selectedMaterial].specs[dn];
                                setPipeCatalog(updated);
                              }}
                              className="absolute top-2 right-2 text-slate-450 hover:text-rose-600 font-bold"
                            >
                              ✕
                            </button>
                            <span className="text-xs font-bold text-slate-800 block">Diametro Nominale DN {dn}</span>
                            
                            <div className="space-y-1.5">
                              {Object.keys(spec).map(pn => (
                                <div key={pn} className="flex items-center justify-between text-[11px] gap-2">
                                  <span className="text-slate-500 font-bold shrink-0">{pn}:</span>
                                  <input 
                                    type="number"
                                    step="any"
                                    value={spec[pn]}
                                    onChange={e => {
                                      const updated = { ...pipeCatalog };
                                      updated[selectedMaterial].specs[dn][pn] = parseFloat(e.target.value) || 0;
                                      setPipeCatalog(updated);
                                    }}
                                    className="w-20 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-center font-bold text-slate-700"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      <button 
                        onClick={() => {
                          const updated = { ...pipeCatalog };
                          const newDN = String(Math.max(...Object.keys(updated[selectedMaterial].specs).map(Number)) + 5);
                          updated[selectedMaterial].specs[newDN] = { "NORM": 50 };
                          setPipeCatalog(updated);
                        }}
                        className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center flex items-center justify-center text-slate-400 hover:border-slate-800 hover:text-slate-700 cursor-pointer font-bold text-xs"
                      >
                        + Aggiungi Nuovo DN
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: EQUIVALENTI FLUIDI */}
          {activeTab === 'fluidi_eq' && (
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* Menu raccordi */}
              <div className="w-full lg:w-64 bg-white rounded-3xl p-4 border border-slate-200 shadow-sm shrink-0">
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-3">Raccordi Fluidi</span>
                <div className="flex flex-col gap-1.5">
                  {Object.keys(equivalentLengths).map(fitId => (
                    <button 
                      key={fitId}
                      onClick={() => setSelectedFitting(fitId)}
                      className={`w-full text-left p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                        selectedFitting === fitId 
                          ? 'bg-slate-800 text-white border-slate-800' 
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {equivalentLengths[fitId].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editing Valori */}
              {selectedFitting && equivalentLengths[selectedFitting] && (
                <div className="flex-1 w-full bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h3 className="text-base font-black text-slate-850">
                      Lunghezze Equivalenti: {equivalentLengths[selectedFitting].label}
                    </h3>
                    <button 
                      onClick={handleSaveEquivalentLengths}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" /> Salva Modifiche
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {DN_LIST.map(dn => (
                      <div key={dn} className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-xs font-bold">
                        <label className="block text-[9px] text-slate-400 uppercase mb-1">DN {dn}</label>
                        <input 
                          type="number"
                          step="any"
                          value={equivalentLengths[selectedFitting].values[dn] || 0}
                          onChange={e => {
                            const updated = { ...equivalentLengths };
                            updated[selectedFitting].values[dn] = parseFloat(e.target.value) || 0;
                            setEquivalentLengths(updated);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-center text-slate-700 font-bold"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: EQUIVALENTI GAS */}
          {activeTab === 'gas_eq' && (
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* Menu raccordi */}
              <div className="w-full lg:w-64 bg-white rounded-3xl p-4 border border-slate-200 shadow-sm shrink-0">
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-3">Raccordi Reti Gas</span>
                <div className="flex flex-col gap-1.5">
                  {Object.keys(gasEquivalentLengths).map(fitId => (
                    <button 
                      key={fitId}
                      onClick={() => setSelectedGasFitting(fitId)}
                      className={`w-full text-left p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                        selectedGasFitting === fitId 
                          ? 'bg-slate-800 text-white border-slate-800' 
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {fitId.toUpperCase().replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editing Valori */}
              {selectedGasFitting && gasEquivalentLengths[selectedGasFitting] && (
                <div className="flex-1 w-full bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h3 className="text-base font-black text-slate-850">
                      Equivalenti Gas: {selectedGasFitting.toUpperCase().replace(/_/g, ' ')}
                    </h3>
                    <button 
                      onClick={handleSaveGasEquivalentLengths}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" /> Salva Modifiche
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {GAS_DN_LIST.map(dn => (
                      <div key={dn} className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-xs font-bold">
                        <label className="block text-[9px] text-slate-400 uppercase mb-1">DN {dn}</label>
                        <input 
                          type="number"
                          step="any"
                          value={gasEquivalentLengths[selectedGasFitting][dn] || 0}
                          onChange={e => {
                            const updated = { ...gasEquivalentLengths };
                            updated[selectedGasFitting][dn] = parseFloat(e.target.value) || 0;
                            setGasEquivalentLengths(updated);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-center text-slate-700 font-bold"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: DATI CLIMATICI */}
          {activeTab === 'climatici' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="relative w-full sm:w-80">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input 
                    type="text" 
                    placeholder="Filtra città, regione..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-800"
                  />
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button 
                    onClick={handleAddClimateRow}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4" /> Aggiungi Città
                  </button>
                  <button 
                    onClick={() => handleSaveClimateData()}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer w-full sm:w-auto animate-pulse"
                  >
                    <Save className="w-4 h-4" /> Salva Dati Climatici
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-2xl max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-xs divide-y divide-slate-150">
                  <thead>
                    <tr className="text-slate-400 bg-slate-50 uppercase font-black text-[9px] tracking-wider">
                      <th className="p-3">Regione</th>
                      <th className="p-3">Città/Provincia</th>
                      <th className="p-3 text-center">Sigla</th>
                      <th className="p-3 text-center">T.Est Summer [°C]</th>
                      <th className="p-3 text-center">U.R. Summer [%]</th>
                      <th className="p-3 text-center">T.Est Winter [°C]</th>
                      <th className="p-3 text-center">U.R. Winter [%]</th>
                      <th className="p-3 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                    {filteredClimateData.map((city, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2">
                          <input 
                            type="text" 
                            value={city.regione} 
                            onChange={e => {
                              const updated = [...climateData];
                              updated[idx] = { ...city, regione: e.target.value };
                              setClimateData(updated);
                            }}
                            className="bg-transparent hover:bg-slate-100 focus:bg-white border-0 focus:ring-1 focus:ring-slate-300 rounded px-1 w-full"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="text" 
                            value={city.provincia} 
                            onChange={e => {
                              const updated = [...climateData];
                              updated[idx] = { ...city, provincia: e.target.value };
                              setClimateData(updated);
                            }}
                            className="bg-transparent hover:bg-slate-100 focus:bg-white border-0 focus:ring-1 focus:ring-slate-300 rounded px-1 w-full"
                          />
                        </td>
                        <td className="p-2 text-center w-16">
                          <input 
                            type="text" 
                            value={city.sigla} 
                            maxLength={2}
                            onChange={e => {
                              const updated = [...climateData];
                              updated[idx] = { ...city, sigla: e.target.value.toUpperCase() };
                              setClimateData(updated);
                            }}
                            className="bg-transparent hover:bg-slate-100 focus:bg-white border-0 focus:ring-1 focus:ring-slate-300 rounded px-1 w-full text-center"
                          />
                        </td>
                        <td className="p-2 text-center w-24">
                          <input 
                            type="number" 
                            value={city.tSummer} 
                            onChange={e => {
                              const updated = [...climateData];
                              updated[idx] = { ...city, tSummer: parseFloat(e.target.value) || 0 };
                              setClimateData(updated);
                            }}
                            className="bg-transparent hover:bg-slate-100 focus:bg-white border-0 focus:ring-1 focus:ring-slate-300 rounded px-1 w-full text-center"
                          />
                        </td>
                        <td className="p-2 text-center w-24">
                          <input 
                            type="number" 
                            value={city.rhSummer} 
                            onChange={e => {
                              const updated = [...climateData];
                              updated[idx] = { ...city, rhSummer: parseFloat(e.target.value) || 0 };
                              setClimateData(updated);
                            }}
                            className="bg-transparent hover:bg-slate-100 focus:bg-white border-0 focus:ring-1 focus:ring-slate-300 rounded px-1 w-full text-center"
                          />
                        </td>
                        <td className="p-2 text-center w-24">
                          <input 
                            type="number" 
                            value={city.tWinter} 
                            onChange={e => {
                              const updated = [...climateData];
                              updated[idx] = { ...city, tWinter: parseFloat(e.target.value) || 0 };
                              setClimateData(updated);
                            }}
                            className="bg-transparent hover:bg-slate-100 focus:bg-white border-0 focus:ring-1 focus:ring-slate-300 rounded px-1 w-full text-center"
                          />
                        </td>
                        <td className="p-2 text-center w-24">
                          <input 
                            type="number" 
                            value={city.rhWinter} 
                            onChange={e => {
                              const updated = [...climateData];
                              updated[idx] = { ...city, rhWinter: parseFloat(e.target.value) || 0 };
                              setClimateData(updated);
                            }}
                            className="bg-transparent hover:bg-slate-100 focus:bg-white border-0 focus:ring-1 focus:ring-slate-300 rounded px-1 w-full text-center"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <button 
                            onClick={() => handleDeleteClimateRow(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
