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
  ArrowLeft,
  Zap
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface DatabaseManagerProps {
  type: 'termo' | 'elettrico';
  setAppMode: (mode: string) => void;
  projectData: any;
  pipeCatalog?: Record<string, PipeMaterial>;
  equivalentLengths?: Record<string, EquivalentLengthPiece>;
  gasEquivalentLengths?: Record<string, Record<number, number>>;
  climateData?: ProvinceClimateData[];
  cablesCatalog?: CableProduct[];
  containersCatalog?: ContainerFamily[];
  onDatabaseChange?: () => void;
}

export function DatabaseManager({ 
  type, 
  setAppMode, 
  projectData,
  pipeCatalog: propPipeCatalog,
  equivalentLengths: propEquivalentLengths,
  gasEquivalentLengths: propGasEquivalentLengths,
  climateData: propClimateData,
  cablesCatalog: propCablesCatalog,
  containersCatalog: propContainersCatalog,
  onDatabaseChange
}: DatabaseManagerProps) {
  const isDemoMode = isFirebaseMock || (projectData && projectData.isDemo);

  // Stato navigazione tab
  const [activeTab, setActiveTab] = useState<string>('');

  // Stati cataloghi Termoidraulici
  const [pipeCatalog, setPipeCatalog] = useState<Record<string, PipeMaterial>>(propPipeCatalog || {});
  const [equivalentLengths, setEquivalentLengths] = useState<Record<string, EquivalentLengthPiece>>(propEquivalentLengths || {});
  const [gasEquivalentLengths, setGasEquivalentLengths] = useState<Record<string, Record<number, number>>>(propGasEquivalentLengths || {});
  const [climateData, setClimateData] = useState<ProvinceClimateData[]>(propClimateData || []);

  // Stati cataloghi Elettrici
  const [cablesCatalog, setCablesCatalog] = useState<CableProduct[]>(propCablesCatalog || []);
  const [containersCatalog, setContainersCatalog] = useState<ContainerFamily[]>(propContainersCatalog || []);

  // Cache tab per evitare interrogazioni a Firebase
  const [dbCacheLoaded, setDbCacheLoaded] = useState<Record<string, boolean>>({
    tubi: !!propPipeCatalog,
    fluidi_eq: !!propEquivalentLengths,
    gas_eq: !!propGasEquivalentLengths,
    climatici: !!propClimateData,
    cavi: !!propCablesCatalog,
    contenitori: !!propContainersCatalog
  });

  // Sync con props esterne
  useEffect(() => { if (propPipeCatalog) { setPipeCatalog(propPipeCatalog); setDbCacheLoaded(p => ({ ...p, tubi: true })); } }, [propPipeCatalog]);
  useEffect(() => { if (propEquivalentLengths) { setEquivalentLengths(propEquivalentLengths); setDbCacheLoaded(p => ({ ...p, fluidi_eq: true })); } }, [propEquivalentLengths]);
  useEffect(() => { if (propGasEquivalentLengths) { setGasEquivalentLengths(propGasEquivalentLengths); setDbCacheLoaded(p => ({ ...p, gas_eq: true })); } }, [propGasEquivalentLengths]);
  useEffect(() => { if (propClimateData) { setClimateData(propClimateData); setDbCacheLoaded(p => ({ ...p, climatici: true })); } }, [propClimateData]);
  useEffect(() => { if (propCablesCatalog) { setCablesCatalog(propCablesCatalog); setDbCacheLoaded(p => ({ ...p, cavi: true })); } }, [propCablesCatalog]);
  useEffect(() => { if (propContainersCatalog) { setContainersCatalog(propContainersCatalog); setDbCacheLoaded(p => ({ ...p, contenitori: true })); } }, [propContainersCatalog]);

  // Stato loading ed editing
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Stati di selezione per sottomenu Termoidraulica
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [selectedFitting, setSelectedFitting] = useState<string>('');
  const [selectedGasFitting, setSelectedGasFitting] = useState<string>('');
  const [newColName, setNewColName] = useState<string>('');
  const [newRowDN, setNewRowDN] = useState<string>('');

  // Stati di selezione per sottomenu Elettrica
  const [selectedCableId, setSelectedCableId] = useState<string>('');
  const [selectedContainerId, setSelectedContainerId] = useState<string>('');
  const [newCableName, setNewCableName] = useState<string>('');
  const [newCableDesc, setNewCableDesc] = useState<string>('');
  const [newContainerFamilyName, setNewContainerFamilyName] = useState<string>('');
  const [newContainerSectionType, setNewContainerSectionType] = useState<'rettangolare' | 'circolare'>('rettangolare');
  const [newContainerInstallationType, setNewContainerInstallationType] = useState<'vista' | 'cavidotto' | 'tazze'>('vista');

  // Auto-seleziona il primo elemento al caricamento
  useEffect(() => {
    if (cablesCatalog.length > 0 && !selectedCableId) {
      setSelectedCableId(cablesCatalog[0].id);
    }
  }, [cablesCatalog, selectedCableId]);

  useEffect(() => {
    if (containersCatalog.length > 0 && !selectedContainerId) {
      setSelectedContainerId(containersCatalog[0].id);
    }
  }, [containersCatalog, selectedContainerId]);

  // Caricamento dati lazy in base al tab selezionato
  const loadTabDb = async (tab: string, force = false) => {
    if (!force && dbCacheLoaded[tab]) {
      // Già in cache, evita la chiamata
      if (tab === 'tubi' && !selectedMaterial) {
        setSelectedMaterial(Object.keys(pipeCatalog)[0] || '');
      } else if (tab === 'fluidi_eq' && !selectedFitting) {
        setSelectedFitting(Object.keys(equivalentLengths)[0] || '');
      } else if (tab === 'gas_eq' && !selectedGasFitting) {
        setSelectedGasFitting(Object.keys(gasEquivalentLengths)[0] || '');
      }
      return;
    }

    setLoading(true);
    try {
      if (type === 'elettrico') {
        if (tab === 'cavi') {
          const res = await fetchElectricalCables(db, isDemoMode);
          setCablesCatalog(res);
          setDbCacheLoaded(p => ({ ...p, cavi: true }));
          if (!selectedCableId || force) {
            setSelectedCableId(res[0]?.id || '');
          }
        } else if (tab === 'contenitori') {
          const res = await fetchElectricalContainers(db, isDemoMode);
          setContainersCatalog(res);
          setDbCacheLoaded(p => ({ ...p, contenitori: true }));
          if (!selectedContainerId || force) {
            setSelectedContainerId(res[0]?.id || '');
          }
        }
      } else {
        if (tab === 'tubi') {
          const res = await fetchPipeCatalog(db, isDemoMode);
          setPipeCatalog(res);
          setDbCacheLoaded(p => ({ ...p, tubi: true }));
          if (!selectedMaterial || force) {
            setSelectedMaterial(Object.keys(res)[0] || '');
          }
        } else if (tab === 'fluidi_eq') {
          const res = await fetchEquivalentLengths(db, isDemoMode);
          setEquivalentLengths(res);
          setDbCacheLoaded(p => ({ ...p, fluidi_eq: true }));
          if (!selectedFitting || force) {
            setSelectedFitting(Object.keys(res)[0] || '');
          }
        } else if (tab === 'gas_eq') {
          const res = await fetchGasEquivalentLengths(db, isDemoMode);
          setGasEquivalentLengths(res);
          setDbCacheLoaded(p => ({ ...p, gas_eq: true }));
          if (!selectedGasFitting || force) {
            setSelectedGasFitting(Object.keys(res)[0] || '');
          }
        } else if (tab === 'climatici') {
          const res = await fetchClimateData(db, isDemoMode);
          setClimateData(res);
          setDbCacheLoaded(p => ({ ...p, climatici: true }));
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
      onDatabaseChange?.();
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
      onDatabaseChange?.();
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
      onDatabaseChange?.();
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
      onDatabaseChange?.();
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
      onDatabaseChange?.();
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
      onDatabaseChange?.();
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
      onDatabaseChange?.();
      if (window.suiteUI) window.suiteUI.toast("Nuovo cavo aggiunto!", "success");
      loadTabDb('cavi', true);
    } catch (e) {
      if (window.suiteUI) window.suiteUI.toast("Errore nella creazione", "error");
    }
  };

  const handleAddNewContainerFamily = async () => {
    if (!newContainerFamilyName.trim()) {
      if (window.suiteUI) window.suiteUI.alert("Inserisci un nome valido per la famiglia.");
      return;
    }
    const id = newContainerFamilyName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (containersCatalog.some(f => f.id === id)) {
      if (window.suiteUI) window.suiteUI.toast("Questa famiglia esiste già!", "warning");
      return;
    }
    const newFamily: ContainerFamily = {
      id,
      name: newContainerFamilyName.trim(),
      description: '',
      type: 'contenitore',
      sectionType: newContainerSectionType,
      installationType: newContainerInstallationType,
      sizes: [
        newContainerSectionType === 'rettangolare'
          ? { code: '100x75', label: '100x75 mm', weight: 0.5, width: 100, height: 75, coverWeight: 0.2 }
          : { code: 'D50', label: 'DN 50', weight: 0.4, outerDiameter: 50, innerDiameter: 46 }
      ]
    };
    try {
      await saveElectricalItem(db, isDemoMode, newFamily);
      setNewContainerFamilyName('');
      onDatabaseChange?.();
      if (window.suiteUI) window.suiteUI.toast("Nuova famiglia aggiunta con successo!", "success");
      await loadTabDb('contenitori', true);
      setSelectedContainerId(id);
    } catch (e) {
      if (window.suiteUI) window.suiteUI.toast("Errore nella creazione della famiglia", "error");
    }
  };

  const handleDeleteContainerFamily = async (id: string) => {
    const confirmed = await window.suiteUI?.confirm("Vuoi eliminare definitivamente questa famiglia di condotti dal database?");
    if (!confirmed) return;
    try {
      await deleteElectricalItem(db, isDemoMode, id, 'contenitore');
      onDatabaseChange?.();
      if (window.suiteUI) window.suiteUI.toast("Famiglia eliminata con successo!", "success");
      await loadTabDb('contenitori', true);
      setSelectedContainerId(prev => prev === id ? '' : prev);
    } catch (e) {
      if (window.suiteUI) window.suiteUI.toast("Errore nell'eliminazione", "error");
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
            <div className="flex flex-col lg:flex-row gap-6 items-start text-xs">
              {/* Menu laterale cavi */}
              <div className="w-full lg:w-64 bg-white rounded-3xl p-4 border border-slate-200 shadow-sm shrink-0 space-y-4">
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Famiglie Cavo</span>
                <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1">
                  {cablesCatalog.map(c => (
                    <div key={c.id} className="flex items-center gap-1">
                      <button 
                        onClick={() => setSelectedCableId(c.id)}
                        className={`flex-1 text-left p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer truncate ${
                          selectedCableId === c.id 
                            ? 'bg-slate-800 text-white border-slate-800' 
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {c.name}
                      </button>
                      <button
                        onClick={() => handleDeleteCableFromDb(c.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer font-bold text-xs"
                        title="Elimina famiglia cavo"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {/* Form Nuovo Cavo */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase block">Nuova Famiglia</span>
                  <input 
                    type="text"
                    placeholder="Nome cavo (es: FG16OR16)"
                    value={newCableName}
                    onChange={e => setNewCableName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-slate-800"
                  />
                  <input 
                    type="text"
                    placeholder="Descrizione breve"
                    value={newCableDesc}
                    onChange={e => setNewCableDesc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-slate-800"
                  />
                  <button 
                    onClick={handleAddNewCableToDb}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer shadow-sm border border-slate-800"
                  >
                    + Aggiungi Cavo
                  </button>
                </div>
              </div>

              {/* Dettagli cavo selezionato */}
              {selectedCableId && cablesCatalog.find(c => c.id === selectedCableId) ? (() => {
                const currentCable = cablesCatalog.find(c => c.id === selectedCableId)!;
                return (
                  <div className="flex-1 w-full bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center"><Zap className="w-4 h-4" /></span>
                        <h3 className="text-sm font-black text-slate-805">Modifica {currentCable.name}</h3>
                      </div>
                      <button 
                        onClick={() => handleSaveCableToDb(currentCable)}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow border border-slate-800"
                      >
                        <Save className="w-3.5 h-3.5" /> Salva Modifiche
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Nome Visualizzato</label>
                        <input 
                          type="text"
                          value={currentCable.name}
                          onChange={e => {
                            const updatedName = e.target.value;
                            setCablesCatalog(prev => prev.map(item => item.id === currentCable.id ? { ...item, name: updatedName } : item));
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Descrizione Cavo</label>
                        <input 
                          type="text"
                          value={currentCable.description}
                          onChange={e => {
                            const updatedDesc = e.target.value;
                            setCablesCatalog(prev => prev.map(item => item.id === currentCable.id ? { ...item, description: updatedDesc } : item));
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-slate-800"
                        />
                      </div>
                    </div>

                    {/* Tabella formazioni */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">Formazioni & Geometria Cavo</span>
                      <div className="overflow-x-auto border border-slate-150 rounded-2xl bg-white">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-150 text-[10px] text-slate-400 font-black uppercase">
                              <th className="p-3">Formazione</th>
                              <th className="p-3 text-center">Ø Esterno [mm]</th>
                              <th className="p-3 text-center">Peso Lineare [kg/m]</th>
                              <th className="p-3 text-center w-16">Azioni</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentCable.formations.map((f, fIdx) => (
                              <tr key={fIdx} className="border-b border-slate-100 hover:bg-slate-50/50">
                                <td className="p-2.5">
                                  <input 
                                    type="text" 
                                    value={f.formation} 
                                    onChange={e => {
                                      const updatedForm = [...currentCable.formations];
                                      updatedForm[fIdx] = { ...f, formation: e.target.value };
                                      setCablesCatalog(prev => prev.map(item => item.id === currentCable.id ? { ...item, formations: updatedForm } : item));
                                    }}
                                    className="w-full bg-transparent border-none font-bold text-slate-800 focus:ring-1 focus:ring-slate-800 rounded px-1 text-xs"
                                  />
                                </td>
                                <td className="p-2.5">
                                  <input 
                                    type="number" 
                                    step="any"
                                    value={f.diameter} 
                                    onChange={e => {
                                      const updatedForm = [...currentCable.formations];
                                      updatedForm[fIdx] = { ...f, diameter: parseFloat(e.target.value) || 0 };
                                      setCablesCatalog(prev => prev.map(item => item.id === currentCable.id ? { ...item, formations: updatedForm } : item));
                                    }}
                                    className="w-full bg-transparent border-none font-bold text-slate-700 text-center focus:ring-1 focus:ring-slate-800 rounded px-1 text-xs"
                                  />
                                </td>
                                <td className="p-2.5">
                                  <input 
                                    type="number" 
                                    step="any"
                                    value={f.weight} 
                                    onChange={e => {
                                      const updatedForm = [...currentCable.formations];
                                      updatedForm[fIdx] = { ...f, weight: parseFloat(e.target.value) || 0 };
                                      setCablesCatalog(prev => prev.map(item => item.id === currentCable.id ? { ...item, formations: updatedForm } : item));
                                    }}
                                    className="w-full bg-transparent border-none font-bold text-slate-700 text-center focus:ring-1 focus:ring-slate-800 rounded px-1 text-xs"
                                  />
                                </td>
                                <td className="p-2.5 text-center">
                                  <button 
                                    onClick={() => {
                                      const updatedForm = currentCable.formations.filter((_, idx) => idx !== fIdx);
                                      setCablesCatalog(prev => prev.map(item => item.id === currentCable.id ? { ...item, formations: updatedForm } : item));
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer font-bold text-xs"
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      <button 
                        onClick={() => {
                          const updatedForm = [...currentCable.formations, { formation: '1x2.5', diameter: 3.5, weight: 0.03 }];
                          setCablesCatalog(prev => prev.map(item => item.id === currentCable.id ? { ...item, formations: updatedForm } : item));
                        }}
                        className="w-full border-2 border-dashed border-slate-200 rounded-xl py-2.5 text-center flex items-center justify-center text-slate-400 hover:border-slate-800 hover:text-slate-700 cursor-pointer font-bold text-xs transition-colors"
                      >
                        + Aggiungi Riga Formazione
                      </button>
                    </div>
                  </div>
                );
              })() : (
                <div className="flex-1 w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center text-slate-400 font-bold">
                  Nessun cavo selezionato. Seleziona o aggiungi una famiglia di cavi.
                </div>
              )}
            </div>
          )}

          {/* TAB: TUBI E CANALI (ELETTRICI) */}
          {activeTab === 'contenitori' && (
            <div className="flex flex-col lg:flex-row gap-6 items-start text-xs">
              {/* Menu laterale contenitori */}
              <div className="w-full lg:w-64 bg-white rounded-3xl p-4 border border-slate-200 shadow-sm shrink-0 space-y-4">
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Famiglie Condotti</span>
                <div className="flex flex-col gap-1.5 max-h-[250px] overflow-y-auto pr-1">
                  {containersCatalog.map(fam => (
                    <div key={fam.id} className="flex items-center gap-1">
                      <button 
                        onClick={() => setSelectedContainerId(fam.id)}
                        className={`flex-1 text-left p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer truncate ${
                          selectedContainerId === fam.id 
                            ? 'bg-slate-800 text-white border-slate-800' 
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {fam.name}
                      </button>
                      <button
                        onClick={() => handleDeleteContainerFamily(fam.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer font-bold text-xs"
                        title="Elimina famiglia"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {/* Form Nuova Famiglia Condotti */}
                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                  <span className="text-[10px] font-black text-slate-400 uppercase block">Nuova Famiglia</span>
                  <input 
                    type="text"
                    placeholder="Nome (es: Tubo PVC rigido)"
                    value={newContainerFamilyName}
                    onChange={e => setNewContainerFamilyName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-slate-800"
                  />
                  <div>
                    <label className="block text-[8px] text-slate-400 font-bold uppercase mb-1">Sezione</label>
                    <select
                      value={newContainerSectionType}
                      onChange={e => setNewContainerSectionType(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-slate-800 cursor-pointer"
                    >
                      <option value="rettangolare">Rettangolare</option>
                      <option value="circolare">Circolare</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[8px] text-slate-400 font-bold uppercase mb-1">Posa Predefinita</label>
                    <select
                      value={newContainerInstallationType}
                      onChange={e => setNewContainerInstallationType(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-slate-800 cursor-pointer"
                    >
                      <option value="vista">A vista (Tubo / Canale)</option>
                      <option value="cavidotto">Interrato / In cavidotto</option>
                      <option value="tazze">Su passerella / supporti</option>
                    </select>
                  </div>
                  <button 
                    onClick={handleAddNewContainerFamily}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer shadow-sm border border-slate-800"
                  >
                    + Aggiungi Famiglia
                  </button>
                </div>
              </div>

              {/* Dettagli famiglia condotti selezionata */}
              {selectedContainerId && containersCatalog.find(f => f.id === selectedContainerId) ? (() => {
                const currentFamily = containersCatalog.find(f => f.id === selectedContainerId)!;
                const isRect = currentFamily.sectionType === 'rettangolare';
                return (
                  <div className="flex-1 w-full bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center"><Layers className="w-4 h-4" /></span>
                        <h3 className="text-sm font-black text-slate-805">Modifica {currentFamily.name}</h3>
                      </div>
                      <button 
                        onClick={async () => {
                          try {
                            setLoading(true);
                            await saveElectricalItem(db, isDemoMode, currentFamily);
                            onDatabaseChange?.();
                            if (window.suiteUI) window.suiteUI.toast("Salvataggio completato!", "success");
                            loadTabDb('contenitori', true);
                          } catch (e) {
                            if (window.suiteUI) window.suiteUI.toast("Errore nel salvataggio", "error");
                          } finally {
                            setLoading(false);
                          }
                        }}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow border border-slate-800"
                      >
                        <Save className="w-3.5 h-3.5" /> Salva Modifiche
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Nome Famiglia</label>
                        <input 
                          type="text"
                          value={currentFamily.name}
                          onChange={e => {
                            const updatedName = e.target.value;
                            setContainersCatalog(prev => prev.map(item => item.id === currentFamily.id ? { ...item, name: updatedName } : item));
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Sezione Geometria</label>
                        <span className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 block">
                          {currentFamily.sectionType.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Tipologia di Posa</label>
                        <select
                          value={currentFamily.installationType}
                          onChange={e => {
                            const updatedInstall = e.target.value;
                            setContainersCatalog(prev => prev.map(item => item.id === currentFamily.id ? { ...item, installationType: updatedInstall as any } : item));
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-slate-800 cursor-pointer"
                        >
                          <option value="vista">A vista (Tubo / Canale)</option>
                          <option value="cavidotto">Interrato / In cavidotto</option>
                          <option value="tazze">Su passerella / supporti</option>
                        </select>
                      </div>
                    </div>

                    {/* Tabella Dimensioni commerciali */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">Dimensioni Commerciali</span>
                      <div className="overflow-x-auto border border-slate-150 rounded-2xl bg-white">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-150 text-[10px] text-slate-400 font-black uppercase">
                              <th className="p-3">Codice</th>
                              <th className="p-3">Etichetta</th>
                              {isRect ? (
                                <>
                                  <th className="p-3 text-center">Largh. B [mm]</th>
                                  <th className="p-3 text-center">Alt. H [mm]</th>
                                  <th className="p-3 text-center">Peso Vuoto [kg/m]</th>
                                  <th className="p-3 text-center">Peso Cop. [kg/m]</th>
                                </>
                              ) : (
                                <>
                                  <th className="p-3 text-center">Ø Esterno [mm]</th>
                                  <th className="p-3 text-center">Ø Interno [mm]</th>
                                  <th className="p-3 text-center">Peso [kg/m]</th>
                                </>
                              )}
                              <th className="p-3 text-center w-16">Azioni</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentFamily.sizes.map((sz, szIdx) => (
                              <tr key={szIdx} className="border-b border-slate-100 hover:bg-slate-50/50">
                                <td className="p-2">
                                  <input 
                                    type="text" 
                                    value={sz.code} 
                                    onChange={e => {
                                      const updatedSizes = [...currentFamily.sizes];
                                      updatedSizes[szIdx] = { ...sz, code: e.target.value };
                                      setContainersCatalog(prev => prev.map(item => item.id === currentFamily.id ? { ...item, sizes: updatedSizes } : item));
                                    }}
                                    className="w-full bg-transparent border-none font-bold text-slate-800 focus:ring-1 focus:ring-slate-800 rounded px-1 text-xs"
                                  />
                                </td>
                                <td className="p-2">
                                  <input 
                                    type="text" 
                                    value={sz.label} 
                                    onChange={e => {
                                      const updatedSizes = [...currentFamily.sizes];
                                      updatedSizes[szIdx] = { ...sz, label: e.target.value };
                                      setContainersCatalog(prev => prev.map(item => item.id === currentFamily.id ? { ...item, sizes: updatedSizes } : item));
                                    }}
                                    className="w-full bg-transparent border-none font-bold text-slate-800 focus:ring-1 focus:ring-slate-800 rounded px-1 text-xs"
                                  />
                                </td>
                                {isRect ? (
                                  <>
                                    <td className="p-2">
                                      <input 
                                        type="number" 
                                        value={sz.width || 0} 
                                        onChange={e => {
                                          const updatedSizes = [...currentFamily.sizes];
                                          updatedSizes[szIdx] = { ...sz, width: parseFloat(e.target.value) || 0 };
                                          setContainersCatalog(prev => prev.map(item => item.id === currentFamily.id ? { ...item, sizes: updatedSizes } : item));
                                        }}
                                        className="w-full bg-transparent border-none font-bold text-slate-750 text-center focus:ring-1 focus:ring-slate-800 rounded px-1 text-xs"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input 
                                        type="number" 
                                        value={sz.height || 0} 
                                        onChange={e => {
                                          const updatedSizes = [...currentFamily.sizes];
                                          updatedSizes[szIdx] = { ...sz, height: parseFloat(e.target.value) || 0 };
                                          setContainersCatalog(prev => prev.map(item => item.id === currentFamily.id ? { ...item, sizes: updatedSizes } : item));
                                        }}
                                        className="w-full bg-transparent border-none font-bold text-slate-750 text-center focus:ring-1 focus:ring-slate-800 rounded px-1 text-xs"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input 
                                        type="number" 
                                        step="any"
                                        value={sz.weight || 0} 
                                        onChange={e => {
                                          const updatedSizes = [...currentFamily.sizes];
                                          updatedSizes[szIdx] = { ...sz, weight: parseFloat(e.target.value) || 0 };
                                          setContainersCatalog(prev => prev.map(item => item.id === currentFamily.id ? { ...item, sizes: updatedSizes } : item));
                                        }}
                                        className="w-full bg-transparent border-none font-bold text-slate-750 text-center focus:ring-1 focus:ring-slate-800 rounded px-1 text-xs"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input 
                                        type="number" 
                                        step="any"
                                        value={sz.coverWeight || 0} 
                                        onChange={e => {
                                          const updatedSizes = [...currentFamily.sizes];
                                          updatedSizes[szIdx] = { ...sz, coverWeight: parseFloat(e.target.value) || 0 };
                                          setContainersCatalog(prev => prev.map(item => item.id === currentFamily.id ? { ...item, sizes: updatedSizes } : item));
                                        }}
                                        className="w-full bg-transparent border-none font-bold text-slate-750 text-center focus:ring-1 focus:ring-slate-800 rounded px-1 text-xs"
                                      />
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="p-2">
                                      <input 
                                        type="number" 
                                        value={sz.outerDiameter || 0} 
                                        onChange={e => {
                                          const updatedSizes = [...currentFamily.sizes];
                                          updatedSizes[szIdx] = { ...sz, outerDiameter: parseFloat(e.target.value) || 0 };
                                          setContainersCatalog(prev => prev.map(item => item.id === currentFamily.id ? { ...item, sizes: updatedSizes } : item));
                                        }}
                                        className="w-full bg-transparent border-none font-bold text-slate-750 text-center focus:ring-1 focus:ring-slate-800 rounded px-1 text-xs"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input 
                                        type="number" 
                                        value={sz.innerDiameter || 0} 
                                        onChange={e => {
                                          const updatedSizes = [...currentFamily.sizes];
                                          updatedSizes[szIdx] = { ...sz, innerDiameter: parseFloat(e.target.value) || 0 };
                                          setContainersCatalog(prev => prev.map(item => item.id === currentFamily.id ? { ...item, sizes: updatedSizes } : item));
                                        }}
                                        className="w-full bg-transparent border-none font-bold text-slate-750 text-center focus:ring-1 focus:ring-slate-800 rounded px-1 text-xs"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input 
                                        type="number" 
                                        step="any"
                                        value={sz.weight || 0} 
                                        onChange={e => {
                                          const updatedSizes = [...currentFamily.sizes];
                                          updatedSizes[szIdx] = { ...sz, weight: parseFloat(e.target.value) || 0 };
                                          setContainersCatalog(prev => prev.map(item => item.id === currentFamily.id ? { ...item, sizes: updatedSizes } : item));
                                        }}
                                        className="w-full bg-transparent border-none font-bold text-slate-750 text-center focus:ring-1 focus:ring-slate-800 rounded px-1 text-xs"
                                      />
                                    </td>
                                  </>
                                )}
                                <td className="p-2 text-center">
                                  <button 
                                    onClick={() => {
                                      const updatedSizes = currentFamily.sizes.filter((_, idx) => idx !== szIdx);
                                      setContainersCatalog(prev => prev.map(item => item.id === currentFamily.id ? { ...item, sizes: updatedSizes } : item));
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer font-bold text-xs"
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      <button 
                        onClick={() => {
                          const updatedSizes = [...currentFamily.sizes, 
                            isRect 
                              ? { code: 'NEW_RECT', label: 'Nuova Misura', weight: 0.5, width: 100, height: 75, coverWeight: 0.2 }
                              : { code: 'NEW_CIRC', label: 'Nuova Misura', weight: 0.4, outerDiameter: 50, innerDiameter: 46 }
                          ];
                          setContainersCatalog(prev => prev.map(item => item.id === currentFamily.id ? { ...item, sizes: updatedSizes } : item));
                        }}
                        className="w-full border-2 border-dashed border-slate-200 rounded-xl py-2.5 text-center flex items-center justify-center text-slate-400 hover:border-slate-800 hover:text-slate-700 cursor-pointer font-bold text-xs transition-colors"
                      >
                        + Aggiungi Riga Misura
                      </button>
                    </div>
                  </div>
                );
              })() : (
                <div className="flex-1 w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center text-slate-400 font-bold">
                  Nessun condotto selezionato. Seleziona o aggiungi una famiglia di condotti.
                </div>
              )}
            </div>
          )}

          {/* TAB: TUBI & SCABREZZE (TERMOIDRAULICA) */}
          {activeTab === 'tubi' && (
            <div className="flex flex-col lg:flex-row gap-6 items-start text-xs">
              {/* Menu laterale materiali */}
              <div className="w-full lg:w-64 bg-white rounded-3xl p-4 border border-slate-200 shadow-sm shrink-0">
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-3">Materiali Tubazione</span>
                <div className="flex flex-col gap-1.5 font-bold">
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
              {selectedMaterial && pipeCatalog[selectedMaterial] && (() => {
                const currentMaterial = pipeCatalog[selectedMaterial];
                const allPNs = Array.from(new Set(
                  Object.values(currentMaterial.specs).flatMap(spec => Object.keys(spec))
                )).sort();
                
                const dns = Object.keys(currentMaterial.specs).sort((a, b) => {
                  const numA = parseFloat(a.replace(/[^0-9.]/g, '')) || 0;
                  const numB = parseFloat(b.replace(/[^0-9.]/g, '')) || 0;
                  return numA - numB;
                });

                return (
                  <div className="flex-1 w-full bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                          <Layers className="w-4 h-4" />
                        </span>
                        <h3 className="text-sm font-black text-slate-805">{selectedMaterial}</h3>
                      </div>
                      <button 
                        onClick={handleSavePipeCatalog}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow border border-slate-800"
                      >
                        <Save className="w-3.5 h-3.5" /> Salva Modifiche
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Scabrezza Equivalente (mm)</label>
                        <input 
                          type="number"
                          step="any"
                          value={currentMaterial.roughness}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setPipeCatalog(prev => ({
                              ...prev,
                              [selectedMaterial]: { ...prev[selectedMaterial], roughness: val }
                            }));
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-750 focus:outline-none focus:border-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Conducibilità Lambda (W/mK)</label>
                        <input 
                          type="number"
                          step="any"
                          value={currentMaterial.lambda}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setPipeCatalog(prev => ({
                              ...prev,
                              [selectedMaterial]: { ...prev[selectedMaterial], lambda: val }
                            }));
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-750 focus:outline-none focus:border-slate-800"
                        />
                      </div>
                    </div>

                    {/* Tabella bidimensionale */}
                    <div className="space-y-3 pt-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">
                          Tabella Diametri Interni (mm)
                        </span>
                        
                        {/* Gestione colonne e righe */}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
                            <input 
                              type="text" 
                              placeholder="Nuova Spec. (es: PN16, Sch40)" 
                              value={newColName} 
                              onChange={e => setNewColName(e.target.value)}
                              className="bg-transparent border-none text-[11px] font-semibold outline-none w-36"
                            />
                            <button 
                              onClick={() => {
                                if (!newColName.trim()) return;
                                const col = newColName.trim();
                                setPipeCatalog(prev => {
                                  const updated = { ...prev };
                                  const specs = updated[selectedMaterial].specs;
                                  Object.keys(specs).forEach(dn => {
                                    if (specs[dn][col] === undefined) {
                                      specs[dn][col] = 0;
                                    }
                                  });
                                  return updated;
                                });
                                setNewColName('');
                                if (window.suiteUI) window.suiteUI.toast(`Colonna "${col}" aggiunta. Ricorda di salvare!`, "info");
                              }}
                              className="text-slate-500 hover:text-slate-800 font-bold text-xs px-1 cursor-pointer"
                            >
                              + Colonna
                            </button>
                          </div>

                          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
                            <input 
                              type="text" 
                              placeholder="Nuovo DN (es: 65, 80)" 
                              value={newRowDN} 
                              onChange={e => setNewRowDN(e.target.value)}
                              className="bg-transparent border-none text-[11px] font-semibold outline-none w-28"
                            />
                            <button 
                              onClick={() => {
                                if (!newRowDN.trim()) return;
                                const dn = newRowDN.trim();
                                if (currentMaterial.specs[dn]) {
                                  if (window.suiteUI) window.suiteUI.toast("Questo DN esiste già!", "warning");
                                  return;
                                }
                                setPipeCatalog(prev => {
                                  const updated = { ...prev };
                                  const newSpec: Record<string, number> = {};
                                  allPNs.forEach(col => {
                                    newSpec[col] = 0;
                                  });
                                  if (allPNs.length === 0) {
                                    newSpec["NORM"] = 0;
                                  }
                                  updated[selectedMaterial].specs[dn] = newSpec;
                                  return updated;
                                });
                                setNewRowDN('');
                              }}
                              className="text-slate-500 hover:text-slate-800 font-bold text-xs px-1 cursor-pointer"
                            >
                              + DN
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto border border-slate-150 rounded-2xl bg-white">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-150 text-[10px] text-slate-400 font-black uppercase">
                              <th className="p-3 text-center border-r border-slate-150 w-24">DN (Riga)</th>
                              {allPNs.map(pn => (
                                <th key={pn} className="p-3 text-center border-r border-slate-150 group min-w-[100px]">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <input 
                                      type="text" 
                                      defaultValue={pn}
                                      onBlur={e => {
                                        const newPn = e.target.value.trim();
                                        if (newPn && newPn !== pn) {
                                          setPipeCatalog(prev => {
                                            const updated = { ...prev };
                                            const specs = updated[selectedMaterial].specs;
                                            Object.keys(specs).forEach(dn => {
                                              if (specs[dn][pn] !== undefined) {
                                                specs[dn][newPn] = specs[dn][pn];
                                                delete specs[dn][pn];
                                              }
                                            });
                                            return updated;
                                          });
                                        }
                                      }}
                                      className="bg-transparent border-none text-center font-black w-14 focus:ring-1 focus:ring-slate-800 rounded text-[10px] text-slate-650"
                                      title="Modifica nome specifica"
                                    />
                                    <button 
                                      onClick={async () => {
                                        const confirmed = await window.suiteUI?.confirm(`Vuoi eliminare la colonna di specifica "${pn}" e tutti i diametri correlati?`);
                                        if (!confirmed) return;
                                        setPipeCatalog(prev => {
                                          const updated = { ...prev };
                                          Object.keys(updated[selectedMaterial].specs).forEach(dn => {
                                            delete updated[selectedMaterial].specs[dn][pn];
                                          });
                                          return updated;
                                        });
                                      }}
                                      className="text-slate-350 hover:text-rose-500 text-[9px] font-bold cursor-pointer"
                                      title="Elimina specifica"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </th>
                              ))}
                              <th className="p-3 text-center w-16">Azioni</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dns.map(dn => {
                              const spec = currentMaterial.specs[dn];
                              return (
                                <tr key={dn} className="border-b border-slate-100 hover:bg-slate-50/50">
                                  <td className="p-2 border-r border-slate-150 text-center font-bold">
                                    <input 
                                      type="text" 
                                      defaultValue={dn}
                                      onBlur={e => {
                                        const newDN = e.target.value.trim();
                                        if (newDN && newDN !== dn) {
                                          if (currentMaterial.specs[newDN]) {
                                            if (window.suiteUI) window.suiteUI.toast("DN duplicato!", "warning");
                                            e.target.value = dn;
                                            return;
                                          }
                                          setPipeCatalog(prev => {
                                            const updated = { ...prev };
                                            updated[selectedMaterial].specs[newDN] = updated[selectedMaterial].specs[dn];
                                            delete updated[selectedMaterial].specs[dn];
                                            return updated;
                                          });
                                        }
                                      }}
                                      className="bg-transparent border-none text-center font-bold w-12 text-slate-800 focus:ring-1 focus:ring-slate-800 rounded"
                                    />
                                  </td>

                                  {allPNs.map(pn => (
                                    <td key={pn} className="p-1 border-r border-slate-150 text-center">
                                      {spec[pn] !== undefined ? (
                                        <input 
                                          type="number"
                                          step="any"
                                          value={spec[pn]}
                                          onChange={e => {
                                            const val = parseFloat(e.target.value) || 0;
                                            setPipeCatalog(prev => {
                                              const updated = { ...prev };
                                              updated[selectedMaterial].specs[dn][pn] = val;
                                              return updated;
                                            });
                                          }}
                                          className="w-16 bg-transparent border-none text-center font-bold text-slate-700 focus:ring-1 focus:ring-slate-800 rounded"
                                        />
                                      ) : (
                                        <button
                                          onClick={() => {
                                            setPipeCatalog(prev => {
                                              const updated = { ...prev };
                                              updated[selectedMaterial].specs[dn][pn] = 0;
                                              return updated;
                                            });
                                          }}
                                          className="text-slate-350 hover:text-slate-700 italic font-medium cursor-pointer"
                                        >
                                          + Aggiungi
                                        </button>
                                      )}
                                    </td>
                                  ))}

                                  <td className="p-2 text-center">
                                    <button 
                                      onClick={async () => {
                                        const confirmed = await window.suiteUI?.confirm(`Vuoi rimuovere interamente la riga DN ${dn} per questo materiale?`);
                                        if (!confirmed) return;
                                        setPipeCatalog(prev => {
                                          const updated = { ...prev };
                                          delete updated[selectedMaterial].specs[dn];
                                          return updated;
                                        });
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer font-bold text-xs"
                                    >
                                      ✕
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
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
