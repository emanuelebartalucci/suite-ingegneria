import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy 
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { IconCopy } from './Icons';
import { ProjectData } from './ProjectHeader';
import { Search, Trash2, Copy, FolderOpen } from 'lucide-react';


interface Project {
  id: string;
  name: string;
  toolType: string;
  client: string;
  author: string;
  date: string;
  notes: string;
  data: any;
  updatedAt: string;
}

interface ProjectStorageProps {
  toolType: string;
  currentData: any;
  onLoadProject: (data: any) => void;
  projectInfo: ProjectData;
  setProjectInfo: (info: any) => void;
}

export default function ProjectStorage({ 
  toolType, 
  currentData, 
  onLoadProject, 
  projectInfo, 
  setProjectInfo 
}: ProjectStorageProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectName, setCurrentProjectName] = useState<string>('');
  const [saveName, setSaveName] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [user, setUser] = useState<any>(null);
  const [draftLoaded, setDraftLoaded] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const isResettingRef = useRef<boolean>(false);


  // 1. Carica la bozza all'avvio (con delay per superare i reset di App.tsx al cambio strumento)
  useEffect(() => {
    isResettingRef.current = false;
    const timer = setTimeout(() => {
      const draftStr = localStorage.getItem(`draft_${toolType}`);
      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr);
          if (draft && draft.currentData) {
            // Verifica base: se currentData esiste ma non ha un formato valido, scarta la bozza
            const data = draft.currentData;
            if (data && (Array.isArray(data.tratte) ? data.tratte.length === 0 : false)) {
              console.warn('Bozza locale scartata: dati inconsistenti (tratte vuote)');
              localStorage.removeItem(`draft_${toolType}`);
              setDraftLoaded(true);
              return;
            }

            if (draft.currentProjectId) {
              setCurrentProjectId(draft.currentProjectId);
            }
            if (draft.currentProjectName) {
              setCurrentProjectName(draft.currentProjectName);
            }
            if (draft.projectInfo) {
              setProjectInfo(draft.projectInfo);
            }
            onLoadProject(draft.currentData);
            (window as any).suiteUI?.toast("Bozza locale ripristinata!", "info");
          }
        } catch (e) {
          console.error("Errore nel ripristino della bozza locale, bozza eliminata:", e);
          localStorage.removeItem(`draft_${toolType}`);
        }
      }
      setDraftLoaded(true);
    }, 80);

    return () => clearTimeout(timer);
  }, [toolType]);

  // 2. Salva la bozza locale con debounce (800ms) ad ogni modifica
  useEffect(() => {
    if (!draftLoaded || isResettingRef.current) return;

    const timer = setTimeout(() => {
      const draft = {
        currentProjectId,
        currentProjectName,
        projectInfo,
        currentData
      };
      try {
        const serialized = JSON.stringify(draft);
        localStorage.setItem(`draft_${toolType}`, serialized);
      } catch (e) {
        console.error("Errore nel salvataggio della bozza locale:", e);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [currentData, projectInfo, currentProjectId, currentProjectName, draftLoaded, toolType]);

  const handleNewCalculation = async () => {
    const confirmed = await (window as any).suiteUI?.confirm(
      "Vuoi avviare un nuovo calcolo? Tutti i dati correnti non salvati andranno persi.",
      "Nuovo Calcolo"
    );
    if (!confirmed) return;

    try {
      isResettingRef.current = true;
      localStorage.removeItem(`draft_${toolType}`);
      // Memorizziamo il toolType per aprirlo dopo il reload
      sessionStorage.setItem('reload_to_tool', toolType);
      // Ricarica per azzerare lo stato di React in modo pulito e sicuro per tutti gli strumenti
      window.location.reload();
    } catch (e) {
      console.error("Errore durante l'azzeramento del calcolo:", e);
    }
  };

  useEffect(() => {
    // Sottoscrizione allo stato dell'utente
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u) {
        setUser(u);
        fetchProjects(u);
      } else {
        const demo = sessionStorage.getItem('demo_user');
        if (demo) {
          const du = JSON.parse(demo);
          setUser(du);
          fetchProjects(du);
        } else {
          setUser(null);
          setProjects([]);
        }
      }
    });
    return unsubscribe;
  }, [toolType]);

  const fetchProjects = async (u: any) => {
    if (!u) return;
    setLoading(true);
    try {
      if (u.isDemo) {
        const localProjectsStr = localStorage.getItem(`demo_projects_shared_${toolType}`);
        let localProjects = localProjectsStr ? JSON.parse(localProjectsStr) : [];
        
        // Recupera ed unisci eventuali vecchi progetti demo personali
        const oldProjectsStr = localStorage.getItem(`demo_projects_${toolType}`);
        if (oldProjectsStr) {
          try {
            const oldProjects = JSON.parse(oldProjectsStr);
            if (Array.isArray(oldProjects)) {
              let updated = false;
              oldProjects.forEach(op => {
                if (!localProjects.some((p: any) => p.id === op.id)) {
                  localProjects.push(op);
                  updated = true;
                }
              });
              if (updated) {
                localStorage.setItem(`demo_projects_shared_${toolType}`, JSON.stringify(localProjects));
              }
              localStorage.removeItem(`demo_projects_${toolType}`);
            }
          } catch (e) {
            console.error("Errore migrazione vecchi progetti demo:", e);
          }
        }
        
        setProjects(localProjects);
      } else {
        const list: Project[] = [];
        let sharedSuccess = false;
        
        // 1. Interroga la collezione centralizzata radice "shared_projects"
        try {
          const qShared = query(
            collection(db, 'shared_projects'),
            where("toolType", "==", toolType)
          );
          const sharedSnapshot = await getDocs(qShared);
          sharedSnapshot.forEach((docSnapshot) => {
            list.push({ id: docSnapshot.id, ...docSnapshot.data(), isShared: true } as Project);
          });
          sharedSuccess = true;
        } catch (e) {
          console.warn("Errore lettura shared_projects (ignorabile, uso fallback personale):", e);
        }

        // 2. Interroga la vecchia collezione personale "users/${u.uid}/projects"
        const personalProjects: Project[] = [];
        try {
          const qPersonal = query(
            collection(db, `users/${u.uid}/projects`),
            where("toolType", "==", toolType)
          );
          const personalSnapshot = await getDocs(qPersonal);
          personalSnapshot.forEach((docSnapshot) => {
            const p = { id: docSnapshot.id, ...docSnapshot.data(), isShared: false } as Project;
            personalProjects.push(p);
            if (!list.some(oldP => oldP.id === docSnapshot.id)) {
              list.push(p);
            }
          });
        } catch (e) {
          console.warn("Errore o assenza vecchia collezione personale (ignorabile):", e);
        }

        // 3. Auto-migrazione silente a shared_projects (se la lettura comune funziona ed esistono progetti personali)
        if (sharedSuccess && personalProjects.length > 0) {
          let migratedCount = 0;
          for (const p of personalProjects) {
            // Evita di migrare se esiste già un progetto condiviso con lo stesso nome o ID
            const alreadyShared = list.some(oldP => oldP.isShared && (oldP.name === p.name || oldP.id === p.id));
            if (!alreadyShared) {
              try {
                await addDoc(collection(db, 'shared_projects'), {
                  name: p.name,
                  toolType: p.toolType,
                  client: p.client || '',
                  author: p.author || '',
                  date: p.date || new Date().toISOString().split('T')[0],
                  notes: p.notes || '',
                  data: p.data,
                  updatedAt: p.updatedAt || new Date().toISOString()
                });
                migratedCount++;
                
                // Rimuovi la copia personale migrata con successo
                try {
                  await deleteDoc(doc(db, `users/${u.uid}/projects`, p.id));
                } catch (delErr) {
                  console.warn("Impossibile eliminare copia personale migrata:", delErr);
                }
              } catch (migrateErr) {
                console.error(`Errore durante la migrazione silente del progetto "${p.name}":`, migrateErr);
              }
            } else {
              // Se esiste già una copia condivisa con lo stesso nome, eliminiamo quella personale ridondante
              try {
                await deleteDoc(doc(db, `users/${u.uid}/projects`, p.id));
              } catch (delErr) {
                console.warn("Impossibile eliminare copia personale ridondante:", delErr);
              }
            }
          }
          if (migratedCount > 0) {
            console.log(`Auto-migrati ${migratedCount} progetti personali in shared_projects.`);
            // Ricarica la lista per includere i progetti appena migrati
            try {
              const qShared = query(collection(db, 'shared_projects'), where("toolType", "==", toolType));
              const sharedSnapshot = await getDocs(qShared);
              const updatedList: Project[] = [];
              sharedSnapshot.forEach((docSnapshot) => {
                updatedList.push({ id: docSnapshot.id, ...docSnapshot.data(), isShared: true } as Project);
              });
              // Aggiungi eventuali rimanenti personali non migrati
              personalProjects.forEach((p) => {
                if (!updatedList.some(oldP => oldP.name === p.name || oldP.id === p.id)) {
                  updatedList.push(p);
                }
              });
              list.length = 0;
              list.push(...updatedList);
            } catch (e) {
              console.error(e);
            }
          }
        }

        // Ordinamento in memoria per data decrescente
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setProjects(list);
      }
    } catch (err) {
      console.error("Errore nel recupero dei progetti:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !saveName.trim()) return;

    setLoading(true);
    try {
      const newProject: Partial<Project> = {
        name: saveName.trim(),
        toolType,
        client: projectInfo.client || '',
        author: projectInfo.author || '',
        date: projectInfo.date || new Date().toISOString().split('T')[0],
        notes: projectInfo.notes || '',
        data: currentData,
        updatedAt: new Date().toISOString()
      };

      if (user.isDemo) {
        newProject.id = `demo-${Date.now()}`;
        const localProjectsStr = localStorage.getItem(`demo_projects_shared_${toolType}`);
        const localProjects = localProjectsStr ? JSON.parse(localProjectsStr) : [];
        localProjects.unshift(newProject);
        localStorage.setItem(`demo_projects_shared_${toolType}`, JSON.stringify(localProjects));
        
        setCurrentProjectId(newProject.id);
        setCurrentProjectName(saveName.trim());
        setSaveName('');
        setProjects(localProjects);
        (window as any).suiteUI?.toast("Progetto salvato in locale (Demo)!", "success");
      } else {
        // Salva nella collezione comune a tutti, ma se fallisce per permessi, salva in quella personale!
        try {
          const docRef = await addDoc(collection(db, 'shared_projects'), newProject);
          setCurrentProjectId(docRef.id);
          setCurrentProjectName(saveName.trim());
          setSaveName('');
          await fetchProjects(user);
          (window as any).suiteUI?.toast("Progetto salvato nel Cloud comune!", "success");
        } catch (sharedErr) {
          console.warn("Errore salvataggio in shared_projects, uso fallback personale:", sharedErr);
          try {
            const docRef = await addDoc(collection(db, `users/${user.uid}/projects`), newProject);
            setCurrentProjectId(docRef.id);
            setCurrentProjectName(saveName.trim());
            setSaveName('');
            await fetchProjects(user);
            (window as any).suiteUI?.toast("Progetto salvato nel tuo archivio personale!", "success");
          } catch (personalErr) {
            console.error("Errore salvataggio personale:", personalErr);
            throw personalErr;
          }
        }
      }
    } catch (err) {
      console.error("Errore durante il salvataggio:", err);
      (window as any).suiteUI?.toast("Errore durante il salvataggio del progetto.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOverwrite = async () => {
    if (!user || !currentProjectId) return;

    setLoading(true);
    try {
      if (user.isDemo) {
        const localProjectsStr = localStorage.getItem(`demo_projects_shared_${toolType}`);
        const localProjects = localProjectsStr ? JSON.parse(localProjectsStr) : [];
        const updatedProjects = localProjects.map((p: Project) => {
          if (p.id === currentProjectId) {
            return {
              ...p,
              client: projectInfo.client || '',
              author: projectInfo.author || '',
              date: projectInfo.date || new Date().toISOString().split('T')[0],
              notes: projectInfo.notes || '',
              data: currentData,
              updatedAt: new Date().toISOString()
            };
          }
          return p;
        });
        localStorage.setItem(`demo_projects_shared_${toolType}`, JSON.stringify(updatedProjects));
        setProjects(updatedProjects);
        (window as any).suiteUI?.toast(`Progetto "${currentProjectName}" aggiornato in locale!`, "success");
      } else {
        // Aggiorna nella collezione comune shared_projects, e se fallisce o era personale, aggiorna in quella personale!
        try {
          const docRef = doc(db, 'shared_projects', currentProjectId);
          await updateDoc(docRef, {
            client: projectInfo.client || '',
            author: projectInfo.author || '',
            date: projectInfo.date || new Date().toISOString().split('T')[0],
            notes: projectInfo.notes || '',
            data: currentData,
            updatedAt: new Date().toISOString()
          });
          await fetchProjects(user);
          (window as any).suiteUI?.toast(`Progetto "${currentProjectName}" aggiornato con successo!`, "success");
        } catch (sharedErr) {
          console.warn("Errore aggiornamento in shared_projects, uso fallback personale:", sharedErr);
          try {
            const docRef = doc(db, `users/${user.uid}/projects`, currentProjectId);
            await updateDoc(docRef, {
              client: projectInfo.client || '',
              author: projectInfo.author || '',
              date: projectInfo.date || new Date().toISOString().split('T')[0],
              notes: projectInfo.notes || '',
              data: currentData,
              updatedAt: new Date().toISOString()
            });
            await fetchProjects(user);
            (window as any).suiteUI?.toast(`Progetto "${currentProjectName}" aggiornato nell'archivio personale!`, "success");
          } catch (personalErr) {
            console.error("Errore aggiornamento personale:", personalErr);
            throw personalErr;
          }
        }
      }
    } catch (err) {
      console.error("Errore durante l'aggiornamento:", err);
      (window as any).suiteUI?.toast("Errore durante l'aggiornamento del progetto.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = (p: Project) => {
    setCurrentProjectId(p.id);
    setCurrentProjectName(p.name);
    
    // Carica i dati nel tool
    onLoadProject(p.data);
    
    // Aggiorna le info del progetto globali
    setProjectInfo({
      client: p.client,
      author: p.author,
      date: p.date,
      notes: p.notes
    });
    
    setShowModal(false);
    (window as any).suiteUI?.toast(`Progetto "${p.name}" caricato correttamente.`, "info");
  };

  const handleDelete = async (projectId: string, name: string) => {
    const confirmed = await (window as any).suiteUI?.confirm(`Sei sicuro di voler eliminare definitivamente il progetto comune "${name}"?`, "Elimina progetto");
    if (!user || !confirmed) return;

    setLoading(true);
    try {
      if (user.isDemo) {
        const localProjectsStr = localStorage.getItem(`demo_projects_shared_${toolType}`);
        const localProjects = localProjectsStr ? JSON.parse(localProjectsStr) : [];
        const filtered = localProjects.filter((p: Project) => p.id !== projectId);
        localStorage.setItem(`demo_projects_shared_${toolType}`, JSON.stringify(filtered));
        
        if (currentProjectId === projectId) {
          setCurrentProjectId(null);
          setCurrentProjectName('');
        }
        setProjects(filtered);
      } else {
        // Elimina dalla collezione comune shared_projects
        try {
          await deleteDoc(doc(db, 'shared_projects', projectId));
        } catch (e) {
          console.warn("Errore eliminazione da shared_projects:", e);
        }
        // Elimina anche dalla vecchia collezione personale per sicurezza
        try {
          await deleteDoc(doc(db, `users/${user.uid}/projects`, projectId));
        } catch (e) {
          console.warn("Errore eliminazione da users/uid/projects (ignorabile):", e);
        }
        if (currentProjectId === projectId) {
          setCurrentProjectId(null);
          setCurrentProjectName('');
        }
        await fetchProjects(user);
      }
      (window as any).suiteUI?.toast(`Progetto "${name}" eliminato con successo.`, "info");
    } catch (err) {
      console.error("Errore durante l'eliminazione:", err);
      (window as any).suiteUI?.toast("Impossibile eliminare il progetto.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUseAsModel = (p: Project) => {
    // Clona: carica i dati ma resetta ID per creare un nuovo salvataggio
    setCurrentProjectId(null);
    setCurrentProjectName('');
    
    onLoadProject(p.data);
    
    setProjectInfo({
      client: p.client + " (Copia)",
      author: user?.name || p.author,
      date: new Date().toISOString().split('T')[0],
      notes: p.notes
    });
    
    setShowModal(false);
    (window as any).suiteUI?.toast("Progetto clonato! Puoi modificarlo e salvarlo con un nuovo nome.", "info");
  };

  // Filtro client side dei progetti storici
  const filteredProjects = projects.filter(p => {
    const term = searchTerm.toLowerCase();
    return (p.name || '').toLowerCase().includes(term) ||
           (p.client || '').toLowerCase().includes(term) ||
           (p.author || '').toLowerCase().includes(term) ||
           (p.notes || '').toLowerCase().includes(term);
  });

  return (
    <div className="bg-slate-800 text-white rounded-xl p-4 shadow-md border border-slate-700 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
      <div className="flex items-center gap-2">
        <span className="text-base">💾</span>
        <div className="text-sm font-bold">Gestione Progetti Condivisi</div>
      </div>

      <div className="flex flex-wrap gap-2">
        {currentProjectId ? (
          <>
            <span className="inline-flex items-center px-3 py-1.5 bg-brand-600/20 text-brand-400 rounded-lg text-xs font-semibold border border-brand-500/30">
              📁 {currentProjectName}
            </span>
            <button 
              onClick={handleOverwrite} 
              disabled={loading}
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-lg shadow transition-colors cursor-pointer"
            >
              💾 Salva
            </button>
          </>
        ) : (
          <form onSubmit={handleSaveNew} className="flex gap-2 w-full md:w-auto">
            <input 
              type="text" 
              placeholder="Nome nuovo calcolo..." 
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-500"
              required
            />
            <button 
              type="submit" 
              disabled={loading}
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-lg shadow transition-colors shrink-0 cursor-pointer"
            >
              💾 Salva
            </button>
          </form>
        )}

        <button 
          onClick={handleNewCalculation}
          className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-650 text-white text-xs font-bold rounded-lg transition-colors border border-slate-600 cursor-pointer"
          title="Azzera e avvia un nuovo calcolo"
        >
          🆕 Nuovo
        </button>
        <button 
          onClick={() => { setShowModal(true); if (user) fetchProjects(user); }}
          className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-650 text-white text-xs font-bold rounded-lg transition-colors border border-slate-600 cursor-pointer"
        >
          Apri Storico ({projects.length})
        </button>
      </div>

      {/* MODALE STORICO PROGETTI */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md transition-all">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-left font-sans">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-lg text-slate-800">
                {toolType === 'idraulico' && 'Archivio condiviso: Profilo idraulico'}
                {toolType === 'termico' && 'Archivio condiviso: Carichi termici'}
                {toolType === 'dispersione' && 'Archivio condiviso: Dispersioni'}
                {toolType === 'verifica_linee' && 'Archivio condiviso: Verifica linee'}
                {toolType === 'gas' && 'Archivio condiviso: Dimensionamento Gas'}
                {toolType === 'dimensionamento_canali' && 'Archivio condiviso: Dimensionamento Canale/Tubi'}
                {!['idraulico', 'termico', 'dispersione', 'verifica_linee', 'gas', 'dimensionamento_canali'].includes(toolType) && 'Archivio Condiviso Calcoli'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              
              {/* Barra di Ricerca */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input 
                  type="text" 
                  placeholder="Cerca per nome progetto, cliente o progettista..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>

              {loading && projects.length === 0 ? (
                <div className="text-center py-8 text-slate-455 text-xs font-bold">Caricamento storico in corso...</div>
              ) : projects.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">Nessun progetto salvato in archivio.</div>
              ) : filteredProjects.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">Nessun risultato corrispondente ai criteri di ricerca.</div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 rounded-2xl max-h-[50vh] overflow-y-auto">
                  <table className="w-full text-left text-xs divide-y divide-slate-150">
                    <thead>
                      <tr className="text-slate-400 bg-slate-50 uppercase font-black text-[9px] tracking-wider">
                        <th className="p-3">Nome Progetto</th>
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Progettista</th>
                        <th className="p-3 text-center">Ultima Modifica</th>
                        <th className="p-3">Note</th>
                        <th className="p-3 text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                      {filteredProjects.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-slate-850">{p.name}</td>
                          <td className="p-3">{p.client || 'N/D'}</td>
                          <td className="p-3">{p.author || 'N/D'}</td>
                          <td className="p-3 text-center text-slate-500 font-normal">
                            {new Date(p.updatedAt).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-slate-500 italic max-w-[120px] truncate" title={p.notes}>
                            {p.notes || '-'}
                          </td>
                          <td className="p-3 text-right space-x-1 shrink-0 whitespace-nowrap">
                            <button 
                              onClick={() => handleLoad(p)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg transition-colors cursor-pointer text-[10px]"
                            >
                              Carica
                            </button>
                            <button 
                              onClick={() => handleUseAsModel(p)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition-colors cursor-pointer text-[10px]"
                              title="Copia progetto come modello"
                            >
                              Copia
                            </button>
                            <button 
                              onClick={() => handleDelete(p.id, p.name)}
                              className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer inline-flex items-center align-middle"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 text-right">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-650 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

