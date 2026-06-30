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
          console.error("Errore nel ripristino della bozza locale:", e);
        }
      }
      setDraftLoaded(true);
    }, 80);

    return () => clearTimeout(timer);
  }, [toolType]);

  // 2. Salva la bozza locale ad ogni digitazione/modifica
  useEffect(() => {
    if (!draftLoaded || isResettingRef.current) return;

    const draft = {
      currentProjectId,
      currentProjectName,
      projectInfo,
      currentData
    };
    try {
      localStorage.setItem(`draft_${toolType}`, JSON.stringify(draft));
    } catch (e) {
      console.error("Errore nel salvataggio della bozza locale:", e);
    }
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
        const localProjectsStr = localStorage.getItem(`demo_projects_${toolType}`);
        const localProjects = localProjectsStr ? JSON.parse(localProjectsStr) : [];
        setProjects(localProjects);
      } else {
        const q = query(
          collection(db, `users/${u.uid}/projects`),
          where("toolType", "==", toolType)
        );
        const querySnapshot = await getDocs(q);
        const list: Project[] = [];
        querySnapshot.forEach((docSnapshot) => {
          list.push({ id: docSnapshot.id, ...docSnapshot.data() } as Project);
        });
        // Ordinamento in memoria per data decrescente (evita l'obbligo di creare un indice composito su Firestore)
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
        const localProjectsStr = localStorage.getItem(`demo_projects_${toolType}`);
        const localProjects = localProjectsStr ? JSON.parse(localProjectsStr) : [];
        localProjects.unshift(newProject);
        localStorage.setItem(`demo_projects_${toolType}`, JSON.stringify(localProjects));
        
        setCurrentProjectId(newProject.id);
        setCurrentProjectName(saveName.trim());
        setSaveName('');
        setProjects(localProjects);
        (window as any).suiteUI?.toast("Progetto salvato in locale (Modalità Demo)!", "success");
      } else {
        const docRef = await addDoc(collection(db, `users/${user.uid}/projects`), newProject);
        setCurrentProjectId(docRef.id);
        setCurrentProjectName(saveName.trim());
        setSaveName('');
        await fetchProjects(user);
        (window as any).suiteUI?.toast("Progetto salvato con successo nel Cloud!", "success");
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
        const localProjectsStr = localStorage.getItem(`demo_projects_${toolType}`);
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
        localStorage.setItem(`demo_projects_${toolType}`, JSON.stringify(updatedProjects));
        setProjects(updatedProjects);
        (window as any).suiteUI?.toast(`Progetto "${currentProjectName}" aggiornato in locale!`, "success");
      } else {
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
        (window as any).suiteUI?.toast(`Progetto "${currentProjectName}" aggiornato con successo!`, "success");
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
  };

  const handleDelete = async (projectId: string, name: string) => {
    const confirmed = await (window as any).suiteUI?.confirm(`Sei sicuro di voler eliminare definitivamente il progetto "${name}"?`, "Elimina progetto");
    if (!user || !confirmed) return;

    setLoading(true);
    try {
      if (user.isDemo) {
        const localProjectsStr = localStorage.getItem(`demo_projects_${toolType}`);
        const localProjects = localProjectsStr ? JSON.parse(localProjectsStr) : [];
        const filtered = localProjects.filter((p: Project) => p.id !== projectId);
        localStorage.setItem(`demo_projects_${toolType}`, JSON.stringify(filtered));
        
        if (currentProjectId === projectId) {
          setCurrentProjectId(null);
          setCurrentProjectName('');
        }
        setProjects(filtered);
      } else {
        await deleteDoc(doc(db, `users/${user.uid}/projects`, projectId));
        if (currentProjectId === projectId) {
          setCurrentProjectId(null);
          setCurrentProjectName('');
        }
        await fetchProjects(user);
      }
    } catch (err) {
      console.error("Errore durante l'eliminazione:", err);
      (window as any).suiteUI?.toast("Impossibile eliminare il progetto.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUseAsModel = (p: Project) => {
    // Carica i dati ma imposta projectId a null per forzare un nuovo salvataggio
    setCurrentProjectId(null);
    setCurrentProjectName('');
    
    onLoadProject(p.data);
    
    setProjectInfo({
      client: p.client + " (Copia)",
      author: p.author,
      date: new Date().toISOString().split('T')[0],
      notes: p.notes
    });
    
    setShowModal(false);
    (window as any).suiteUI?.toast("Progetto caricato come modello! Puoi modificarlo e salvarlo con un nuovo nome.", "info");
  };

  return (
    <div className="bg-slate-800 text-white rounded-xl p-4 shadow-md border border-slate-700 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
      <div className="flex items-center gap-2">
        <span className="text-base">💾</span>
        <div className="text-sm font-bold">Gestione Progetti</div>
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
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-left font-sans">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-lg text-slate-800">
                {toolType === 'idraulico' && 'Archivio profilo idraulico'}
                {toolType === 'termico' && 'Archivio Carichi termici'}
                {toolType === 'dispersione' && 'Archivio Dispersioni'}
                {toolType === 'verifica_linee' && 'Archivio Verifica linee'}
                {toolType === 'gas' && 'Archivio Dimensionamento Gas'}
                {!['idraulico', 'termico', 'dispersione', 'verifica_linee', 'gas'].includes(toolType) && 'Archivio Calcoli'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {loading && projects.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">Caricamento storico in corso...</div>
              ) : projects.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">Nessun progetto salvato per questo strumento.</div>
              ) : (
                projects.map((p) => (
                  <div key={p.id} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{p.name}</span>
                        <span className="text-[10px] bg-slate-200 text-slate-650 px-1.5 py-0.5 rounded font-mono">
                          {new Date(p.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        <strong>Cliente:</strong> {p.client || 'N/D'} | <strong>Autore:</strong> {p.author || 'N/D'}
                      </p>
                      {p.notes && <p className="text-[10px] text-slate-400 italic mt-1 truncate max-w-md">{p.notes}</p>}
                    </div>

                    <div className="flex gap-1 shrink-0 w-full sm:w-auto">
                      <button 
                        onClick={() => handleLoad(p)}
                        className="flex-1 sm:flex-initial px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        Carica
                      </button>
                      <button 
                        onClick={() => handleUseAsModel(p)}
                        className="flex-1 sm:flex-initial px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        title="Usa come Modello (Clona)"
                      >
                        <IconCopy className="w-3.5 h-3.5"/> Modello
                      </button>
                      <button 
                        onClick={() => handleDelete(p.id, p.name)}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-650 text-red-500 hover:text-white text-xs font-bold rounded-xl transition-colors border border-red-200 hover:border-red-600 cursor-pointer"
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                ))
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
