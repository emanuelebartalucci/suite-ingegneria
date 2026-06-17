import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User } from 'firebase/auth';
import { auth, db, isFirebaseMock } from './firebase/config';
import { seedRegistryIfEmpty, getLocalRegistry, saveLocalRegistry } from './firebase/registrySeed';
import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import Login from './components/Login';
import { ToolProfiloIdraulico } from './tools/ToolProfiloIdraulico';
import { ToolCarichiTermici } from './tools/ToolCarichiTermici';
import { ToolDispersione } from './tools/ToolDispersione';
import { ToolVerificaLinee } from './tools/ToolVerificaLinee';
import { IconWaves, IconFlame, IconThermometer, IconArrowUp } from './components/Icons';
import logoImg from './assets/Logo.png';

export interface ProjectData {
    client: string;
    author: string;
    date: string;
    notes: string;
}

export interface RegistryMember {
    name: string;
    email: string;
    role: 'admin' | 'user';
    isSocio: boolean;
}

export interface UserProfile {
    uid: string;
    email: string | null;
    name: string;
    role: 'admin' | 'user';
    isSocio: boolean;
    isDemo: boolean;
}

export interface ToastItem {
    id: number;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
}

export interface ConfirmModalState {
    visible: boolean;
    message: string;
    title: string;
    resolve: ((value: boolean) => void) | null;
}

export interface AlertModalState {
    visible: boolean;
    message: string;
    title: string;
    resolve: (() => void) | null;
}

declare global {
    interface Window {
        suiteUI?: {
            toast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
            confirm: (message: string, title?: string) => Promise<boolean>;
            alert: (message: string, title?: string) => Promise<void>;
        };
    }
}

export default function App() {
    const [user, setUser] = useState<User | null>(null);
    const [demoUser, setDemoUser] = useState<UserProfile | null>(() => {
        const demo = sessionStorage.getItem('demo_user');
        return demo ? JSON.parse(demo) : null;
    });
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [authLoading, setAuthLoading] = useState<boolean>(true);
    const [appMode, setAppMode] = useState<string>('dashboard');
    const [prevMode, setPrevMode] = useState<string>('dashboard');
    
    const [projectData, setProjectData] = useState<ProjectData>({
        client: 'Progetto Impianto',
        author: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    // Stato Gestione Anagrafica (Admin)
    const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
    const [registryList, setRegistryList] = useState<RegistryMember[]>([]);
    const [registryLoading, setRegistryLoading] = useState<boolean>(false);
    const [newMemberName, setNewMemberName] = useState<string>('');
    const [newMemberEmail, setNewMemberEmail] = useState<string>('');
    const [newMemberIsAdmin, setNewMemberIsAdmin] = useState<boolean>(false);
    const [adminError, setAdminError] = useState<string>('');
    const [adminSuccess, setAdminSuccess] = useState<string>('');

    // Stati per notifiche e pop-up moderni
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({ visible: false, message: '', title: '', resolve: null });
    const [alertModal, setAlertModal] = useState<AlertModalState>({ visible: false, message: '', title: '', resolve: null });

    // Seed automatico dell'anagrafica dopo il login (evita errore di autorizzazione a sessione non attiva)
    useEffect(() => {
        if (!isFirebaseMock && user) {
            seedRegistryIfEmpty(db);
        }
    }, [user]);

    // Registrazione delle funzioni globali di notifica e popup
    useEffect(() => {
        window.suiteUI = {
            toast: (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
                const id = Date.now() + Math.random();
                setToasts(prev => [...prev, { id, message, type }]);
                setTimeout(() => {
                    setToasts(prev => prev.filter(t => t.id !== id));
                }, 3500);
            },
            confirm: (message: string, title = 'Conferma') => {
                return new Promise<boolean>((resolve) => {
                    setConfirmModal({ visible: true, message, title, resolve });
                });
            },
            alert: (message: string, title = 'Attenzione') => {
                return new Promise<void>((resolve) => {
                    setAlertModal({ visible: true, message, title, resolve });
                });
            }
        };
        return () => {
            if (window.suiteUI) delete window.suiteUI;
        };
    }, []);

    // Ascolto dello stato dell'autenticazione Firebase e caricamento profilo
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                setAuthLoading(true);
                try {
                    const emailClean = (currentUser.email || '').toLowerCase().trim();
                    const docRef = doc(db, "anagrafica", emailClean);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setUserProfile({
                            uid: currentUser.uid,
                            email: currentUser.email,
                            name: data.name,
                            role: data.role as 'admin' | 'user',
                            isSocio: data.isSocio || false,
                            isDemo: false
                        });
                    } else {
                        setUserProfile({
                            uid: currentUser.uid,
                            email: currentUser.email,
                            name: currentUser.email ? currentUser.email.split('@')[0] : 'user',
                            role: 'user',
                            isSocio: false,
                            isDemo: false
                        });
                    }
                } catch (err) {
                    console.error("Errore nel recupero del profilo:", err);
                    setUserProfile({
                        uid: currentUser.uid,
                        email: currentUser.email,
                        name: currentUser.email ? currentUser.email.split('@')[0] : 'user',
                        role: 'user',
                        isSocio: false,
                        isDemo: false
                    });
                } finally {
                    setAuthLoading(false);
                }
            } else {
                const demo = sessionStorage.getItem('demo_user');
                if (demo) {
                    const du = JSON.parse(demo) as UserProfile;
                    setDemoUser(du);
                    setUserProfile(du);
                } else {
                    setDemoUser(null);
                    setUserProfile(null);
                }
                setAuthLoading(false);
            }
            if (!currentUser && !sessionStorage.getItem('demo_user')) {
                setAppMode('dashboard'); // Resetta il router alla disconnessione
            }
        });
        return unsubscribe;
    }, []);

    // Isolamento e reset dati progetto al cambio strumento
    useEffect(() => {
        if (appMode !== 'dashboard' && appMode !== prevMode) {
            setProjectData({
                client: '',
                author: userProfile?.name || '',
                date: new Date().toISOString().split('T')[0],
                notes: ''
            });
            setPrevMode(appMode);
        }
    }, [appMode, prevMode, userProfile]);

    // Prefill autore non appena il profilo utente è caricato
    useEffect(() => {
        if (userProfile?.name && !projectData.author) {
            setProjectData(prev => ({
                ...prev,
                author: userProfile.name
            }));
        }
    }, [userProfile]);

    // Caricamento dei membri dell'anagrafica
    const fetchRegistry = async () => {
        setRegistryLoading(true);
        setAdminError('');
        try {
            const isDemoMode = isFirebaseMock || (userProfile && userProfile.isDemo);
            if (isDemoMode) {
                const list = getLocalRegistry() as RegistryMember[];
                list.sort((a, b) => a.name.localeCompare(b.name));
                setRegistryList(list);
            } else {
                const snapshot = await getDocs(collection(db, "anagrafica"));
                const list: RegistryMember[] = [];
                snapshot.forEach(docSnap => {
                    list.push(docSnap.data() as RegistryMember);
                });
                list.sort((a, b) => a.name.localeCompare(b.name));
                setRegistryList(list);
            }
        } catch (err) {
            console.error("Errore nel recupero dell'anagrafica:", err);
            setAdminError("Errore nel caricamento dell'anagrafica.");
        } finally {
            setRegistryLoading(false);
        }
    };

    // Auto-fetch quando la modale admin si apre
    useEffect(() => {
        if (showAdminModal) {
            fetchRegistry();
            setAdminError('');
            setAdminSuccess('');
        }
    }, [showAdminModal]);

    // Inserimento nuovo dipendente
    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        setAdminError('');
        setAdminSuccess('');

        const name = newMemberName.trim();
        const emailVal = newMemberEmail.trim().toLowerCase();
        
        if (!name || !emailVal) {
            setAdminError("Nome e Email aziendale sono obbligatori.");
            return;
        }

        const exists = registryList.some(u => u.email.toLowerCase().trim() === emailVal);
        if (exists) {
            setAdminError("Questo indirizzo email è già registrato nell'anagrafica.");
            return;
        }

        const newMember: RegistryMember = {
            name,
            email: emailVal,
            role: newMemberIsAdmin ? 'admin' : 'user',
            isSocio: false
        };

        try {
            const isDemoMode = isFirebaseMock || (userProfile && userProfile.isDemo);
            if (isDemoMode) {
                const updated = [...registryList, newMember];
                saveLocalRegistry(updated);
                setAdminSuccess("Nuovo dipendente aggiunto con successo in locale.");
                await fetchRegistry();
            } else {
                await setDoc(doc(db, "anagrafica", emailVal), newMember);
                setAdminSuccess("Nuovo dipendente aggiunto con successo nel database.");
                await fetchRegistry();
            }
            setNewMemberName('');
            setNewMemberEmail('');
            setNewMemberIsAdmin(false);
        } catch (err) {
            console.error("Errore nell'aggiungere dipendente:", err);
            setAdminError("Impossibile salvare il dipendente.");
        }
    };

    // Eliminazione dipendente con Socio Guard
    const handleDeleteMember = async (member: RegistryMember) => {
        if (!window.suiteUI) return;
        if (member.isSocio || member.email === "mcorbellini@ingegno06.it" || member.email === "aprofeti@ingegno06.it") {
            await window.suiteUI.alert("Impossibile eliminare un socio fondatore.", "Operazione non consentita");
            return;
        }

        const confirmed = await window.suiteUI.confirm(`Sei sicuro di voler eliminare ${member.name} dall'anagrafica?`, "Conferma eliminazione");
        if (!confirmed) {
            return;
        }

        setAdminError('');
        setAdminSuccess('');

        try {
            const isDemoMode = isFirebaseMock || (userProfile && userProfile.isDemo);
            if (isDemoMode) {
                const updated = registryList.filter(u => u.email.toLowerCase().trim() !== member.email.toLowerCase().trim());
                saveLocalRegistry(updated);
                setAdminSuccess("Dipendente rimosso con successo in locale.");
                await fetchRegistry();
            } else {
                await deleteDoc(doc(db, "anagrafica", member.email.toLowerCase().trim()));
                setAdminSuccess("Dipendente rimosso con successo dal database.");
                await fetchRegistry();
            }
        } catch (err) {
            console.error("Errore nell'eliminare dipendente:", err);
            setAdminError("Impossibile eliminare il dipendente.");
        }
    };

    // Cambio ruolo dipendente (Toggle Admin/User) con Socio Guard
    const handleToggleRole = async (member: RegistryMember) => {
        if (!window.suiteUI) return;
        if (member.isSocio || member.email === "mcorbellini@ingegno06.it" || member.email === "aprofeti@ingegno06.it") {
            await window.suiteUI.alert("Il ruolo dei soci fondatori non può essere modificato.", "Operazione non consentita");
            return;
        }

        const newRole = member.role === 'admin' ? 'user' : 'admin';
        setAdminError('');
        setAdminSuccess('');

        try {
            const isDemoMode = isFirebaseMock || (userProfile && userProfile.isDemo);
            if (isDemoMode) {
                const updated = registryList.map(u => {
                    if (u.email.toLowerCase().trim() === member.email.toLowerCase().trim()) {
                        return { ...u, role: newRole };
                    }
                    return u;
                });
                saveLocalRegistry(updated as any);
                setAdminSuccess(`Ruolo di ${member.name} aggiornato con successo in locale.`);
                await fetchRegistry();
            } else {
                await updateDoc(doc(db, "anagrafica", member.email.toLowerCase().trim()), {
                    role: newRole
                });
                setAdminSuccess(`Ruolo di ${member.name} aggiornato con successo nel database.`);
                await fetchRegistry();
            }
        } catch (err) {
            console.error("Errore nell'aggiornare ruolo:", err);
            setAdminError("Impossibile aggiornare il ruolo del dipendente.");
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-sans">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-sm font-semibold tracking-wide text-slate-400">Verifica credenziali in corso...</p>
                </div>
            </div>
        );
    }

    const currentUser = user || demoUser;

    // Se l'utente non è autenticato, mostra obbligatoriamente la schermata di Login
    if (!currentUser) {
        return <Login onLoginDemo={(du) => {
            sessionStorage.setItem('demo_user', JSON.stringify(du));
            setDemoUser(du);
        }} />;
    }

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
            {/* Global User Header Bar (in alto a sinistra/destra) */}
            <div className="max-w-7xl mx-auto flex justify-between items-center mb-6 text-xs text-slate-500 print:hidden gap-3">
                {/* Sinistra: Pulsante Menù Principale (visibile solo se fuori dalla dashboard) */}
                <div>
                    {appMode !== 'dashboard' ? (
                        <button 
                            onClick={() => setAppMode('dashboard')}
                            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-300 shadow-sm cursor-pointer transition-colors flex items-center gap-1.5 font-bold"
                        >
                            <svg className="w-3.5 h-3.5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            Menu Principale
                        </button>
                    ) : <div />}
                </div>

                {/* Destra: Utente e pulsanti di gestione/logout */}
                <div className="flex items-center gap-3">
                    <div>
                        Utente: <strong className="text-slate-700">{userProfile?.name || currentUser.email}</strong> {userProfile?.role === 'admin' ? <span className="text-[10px] bg-rose-500/10 text-rose-700 px-2 py-0.5 rounded-full font-bold ml-1">Admin</span> : <span className="text-[10px] bg-slate-500/10 text-slate-650 px-2 py-0.5 rounded-full font-bold ml-1">Utente</span>} {userProfile?.isDemo && <span className="ml-1 text-[9px] bg-amber-500/20 text-amber-700 px-1.5 py-0.5 rounded font-bold">DEMO</span>}
                    </div>
                    {userProfile?.role === 'admin' && (
                        <button
                            onClick={() => setShowAdminModal(true)}
                            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-300 shadow-sm cursor-pointer transition-colors flex items-center justify-center font-bold text-xs gap-1"
                            title="Gestione Anagrafica Dipendenti"
                        >
                            <span>⚙️</span> Gestione
                        </button>
                    )}
                    <button 
                        onClick={async () => {
                            if (!window.suiteUI) return;
                            const confirmed = await window.suiteUI.confirm("Desideri disconnetterti dalla Suite?", "Disconnessione");
                            if (confirmed) {
                                sessionStorage.removeItem('demo_user');
                                setDemoUser(null);
                                auth.signOut();
                                window.location.reload();
                            }
                        }}
                        className="px-3.5 py-1.5 bg-white hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors border border-slate-300 shadow-sm cursor-pointer"
                    >
                        Disconnetti
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto">
                {appMode === 'dashboard' && (
                    <div className="bg-white rounded-3xl shadow-xl p-10 text-center relative overflow-hidden">
                        {/* Elementi decorativi */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50/5 rounded-full blur-2xl pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-50/5 rounded-full blur-2xl pointer-events-none"></div>

                        <img src={logoImg} alt="Logo" className="h-16 mx-auto mb-4 object-contain" onError={(e) => { (e.target as HTMLElement).style.display='none' }} />
                        <h1 className="text-3xl font-black text-slate-800 mb-2">Suite Ingegneria</h1>
                        <p className="text-slate-500 mb-10 text-sm max-w-lg mx-auto">
                            Strumenti professionali di dimensionamento e calcolo per reti idrauliche e termotecniche aziendali.
                        </p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                            {/* 1. Profilo Idraulico */}
                            <button onClick={() => setAppMode('idraulico')} className="group flex flex-col items-center p-5 bg-slate-50 border-2 border-slate-200 rounded-2xl hover:border-brand-500 hover:bg-brand-50 transition-all text-left cursor-pointer">
                                <div className="w-14 h-14 bg-blue-100 text-brand-600 p-3.5 rounded-full mb-4 group-hover:scale-110 transition-transform"><IconWaves /></div>
                                <h2 className="text-sm font-bold text-slate-800 mb-1.5 text-center w-full">Profilo Idraulico</h2>
                                <p className="text-[11px] text-slate-500 text-center leading-relaxed">Perdite di carico, scabrezza e quote piezometriche.</p>
                            </button>

                            {/* 2. Carichi Termici */}
                            <button onClick={() => setAppMode('termico')} className="group flex flex-col items-center p-5 bg-slate-50 border-2 border-slate-200 rounded-2xl hover:border-orange-500 hover:bg-orange-50 transition-all text-left cursor-pointer">
                                <div className="w-14 h-14 bg-orange-100 text-orange-600 p-3.5 rounded-full mb-4 group-hover:scale-110 transition-transform"><IconFlame /></div>
                                <h2 className="text-sm font-bold text-slate-800 mb-1.5 text-center w-full">Carichi Termici</h2>
                                <p className="text-[11px] text-slate-500 text-center leading-relaxed">Portate, miscele glicole, calcolo Cp/ρ e tubi commerciali.</p>
                            </button>

                            {/* 3. Dispersioni */}
                            <button onClick={() => setAppMode('dispersione')} className="group flex flex-col items-center p-5 bg-slate-50 border-2 border-slate-200 rounded-2xl hover:border-redbrand-500 hover:bg-redbrand-50 transition-all text-left cursor-pointer">
                                <div className="w-14 h-14 bg-redbrand-100 text-redbrand-600 p-3.5 rounded-full mb-4 group-hover:scale-110 transition-transform"><IconThermometer /></div>
                                <h2 className="text-sm font-bold text-slate-800 mb-1.5 text-center w-full">Dispersioni</h2>
                                <p className="text-[11px] text-slate-500 text-center leading-relaxed">Isolamento termico, sezione 2D e curva gradiente radiale.</p>
                            </button>

                            {/* 4. Verifica Perdita Linee */}
                            <button onClick={() => setAppMode('verifica_linee')} className="group flex flex-col items-center p-5 bg-slate-50 border-2 border-slate-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left cursor-pointer">
                                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 p-3.5 rounded-full mb-4 group-hover:scale-110 transition-transform"><IconArrowUp /></div>
                                <h2 className="text-sm font-bold text-slate-800 mb-1.5 text-center w-full">Verifica Perdita Linee</h2>
                                <p className="text-[11px] text-slate-500 text-center leading-relaxed">Calcolo delle perdite di carico delle condutture, con accessori e albero di distribuzione.</p>
                            </button>
                        </div>
                    </div>
                )}

                {appMode === 'idraulico' && <ToolProfiloIdraulico projectData={projectData} setProjectData={setProjectData} setAppMode={setAppMode} />}
                {appMode === 'termico' && <ToolCarichiTermici projectData={projectData} setProjectData={setProjectData} setAppMode={setAppMode} />}
                {appMode === 'dispersione' && <ToolDispersione projectData={projectData} setProjectData={setProjectData} setAppMode={setAppMode} />}
                {appMode === 'verifica_linee' && <ToolVerificaLinee projectData={projectData} setProjectData={setProjectData} setAppMode={setAppMode} />}
            </div>

            {/* Footer con firma discreta, invisibile in stampa */}
            <footer className="mt-8 mb-4 text-center text-[12px] text-slate-400 opacity-50 font-medium tracking-wide print:hidden select-none">
                Sviluppato da Emanuele Bartalucci
            </footer>

            {/* ADMIN MODAL */}
            {showAdminModal && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md transition-all">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up text-left">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
                                    <span>⚙️</span> Gestione Anagrafica Dipendenti
                                </h3>
                                <p className="text-slate-400 text-xs mt-1">
                                    Aggiungi, elimina e imposta i permessi degli utenti della Suite
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowAdminModal(false)}
                                className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {adminError && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-700 text-xs font-semibold rounded-2xl p-4 flex items-center gap-2">
                                    <span>⚠️</span> {adminError}
                                </div>
                            )}
                            {adminSuccess && (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs font-semibold rounded-2xl p-4 flex items-center gap-2">
                                    <span>✅</span> {adminSuccess}
                                </div>
                            )}

                            {/* Form Nuovo Dipendente */}
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4">Aggiungi Nuovo Dipendente</h4>
                                <form onSubmit={handleAddMember} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Cognome Nome</label>
                                        <input
                                            type="text"
                                            placeholder="es. Rossi Mario"
                                            value={newMemberName}
                                            onChange={e => setNewMemberName(e.target.value)}
                                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-brand-500 font-sans"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email Aziendale</label>
                                        <input
                                            type="email"
                                            placeholder="es. mrossi@ingegno06.it"
                                            value={newMemberEmail}
                                            onChange={e => setNewMemberEmail(e.target.value)}
                                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-brand-500 font-mono"
                                            required
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2 py-2">
                                            <input
                                                type="checkbox"
                                                id="newAdminCheckbox"
                                                checked={newMemberIsAdmin}
                                                onChange={e => setNewMemberIsAdmin(e.target.checked)}
                                                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 cursor-pointer"
                                            />
                                            <label htmlFor="newAdminCheckbox" className="text-xs font-semibold text-slate-700 cursor-pointer">
                                                Amministratore
                                            </label>
                                        </div>
                                        <button
                                            type="submit"
                                            className="bg-brand-600 hover:bg-brand-500 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-md shadow-brand-600/10 cursor-pointer transition-colors"
                                        >
                                            Aggiungi
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Lista Dipendenti */}
                            <div>
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Elenco Registrati ({registryList.length})</h4>
                                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                    {registryLoading ? (
                                        <div className="p-8 text-center text-slate-400 text-xs">Caricamento anagrafica in corso...</div>
                                    ) : (
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                    <th className="py-3 px-4">Nominativo</th>
                                                    <th className="py-3 px-4">Email</th>
                                                    <th className="py-3 px-4 text-center">Amministratore</th>
                                                    <th className="py-3 px-4 text-right">Azioni</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-xs">
                                                {registryList.map((m) => {
                                                    const isSocio = m.isSocio || m.email === "mcorbellini@ingegno06.it" || m.email === "aprofeti@ingegno06.it";
                                                    return (
                                                        <tr key={m.email} className="hover:bg-slate-50/50">
                                                            <td className="py-3.5 px-4 font-bold text-slate-800">{m.name}</td>
                                                            <td className="py-3.5 px-4 font-mono text-slate-500">{m.email}</td>
                                                            <td className="py-3.5 px-4 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={m.role === 'admin'}
                                                                    disabled={isSocio}
                                                                    onChange={() => handleToggleRole(m)}
                                                                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 cursor-pointer disabled:cursor-not-allowed"
                                                                />
                                                            </td>
                                                            <td className="py-3.5 px-4 text-right">
                                                                {isSocio ? (
                                                                    <span className="text-[9px] bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full font-bold border border-slate-200 select-none">
                                                                        SOCIO
                                                                    </span>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleDeleteMember(m)}
                                                                        className="px-2.5 py-1 bg-red-50 hover:bg-red-650 text-red-500 hover:text-white rounded-lg text-[10px] font-bold border border-red-200 hover:border-red-650 transition-all cursor-pointer"
                                                                    >
                                                                        Elimina
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 text-right">
                            <button
                                onClick={() => setShowAdminModal(false)}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-650 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Chiudi
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* TOAST NOTIFICATIONS */}
            {createPortal(
                <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
                    {toasts.map(t => (
                        <div 
                            key={t.id} 
                            className={`pointer-events-auto shadow-lg rounded-2xl border p-4 bg-white/95 backdrop-blur-md flex items-start gap-3 transition-all duration-350 animate-slide-in ${
                                t.type === 'success' ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800' :
                                t.type === 'error' ? 'bg-rose-50/90 border-rose-200 text-rose-800' :
                                t.type === 'warning' ? 'bg-amber-50/90 border-amber-200 text-amber-850' :
                                'bg-sky-50/90 border-sky-200 text-sky-850'
                            }`}
                        >
                            {t.type === 'success' && (
                                <svg className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                            {t.type === 'error' && (
                                <svg className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                            {t.type === 'warning' && (
                                <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            )}
                            {t.type === 'info' && (
                                <svg className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                            <div className="text-xs font-semibold leading-relaxed flex-1 pr-2">
                                {t.message}
                            </div>
                            <button 
                                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                                className="text-slate-400 hover:text-slate-650 shrink-0 cursor-pointer p-0.5 hover:bg-slate-100 rounded-md transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>,
                document.body
            )}

            {/* CUSTOM CONFIRM MODAL */}
            {confirmModal.visible && confirmModal.resolve && createPortal(
                <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md transition-all">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 animate-scale-up text-left font-sans">
                        <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                            <span>❓</span> {confirmModal.title}
                        </h3>
                        <p className="text-slate-500 text-xs mt-3 leading-relaxed">
                            {confirmModal.message}
                        </p>
                        <div className="flex justify-end gap-2.5 mt-6">
                            <button 
                                onClick={() => {
                                    if (confirmModal.resolve) confirmModal.resolve(false);
                                    setConfirmModal({ visible: false, message: '', title: '', resolve: null });
                                }}
                                className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
                            >
                                Annulla
                            </button>
                            <button 
                                onClick={() => {
                                    if (confirmModal.resolve) confirmModal.resolve(true);
                                    setConfirmModal({ visible: false, message: '', title: '', resolve: null });
                                }}
                                className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow transition-all cursor-pointer"
                            >
                                Conferma
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* CUSTOM ALERT MODAL */}
            {alertModal.visible && alertModal.resolve && createPortal(
                <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md transition-all">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 animate-scale-up text-left font-sans">
                        <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                            <span className="text-amber-500">⚠️</span> {alertModal.title}
                        </h3>
                        <p className="text-slate-500 text-xs mt-3 leading-relaxed">
                            {alertModal.message}
                        </p>
                        <div className="flex justify-end mt-6">
                            <button 
                                onClick={() => {
                                    if (alertModal.resolve) alertModal.resolve();
                                    setAlertModal({ visible: false, message: '', title: '', resolve: null });
                                }}
                                className="px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-xl shadow transition-all cursor-pointer"
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
