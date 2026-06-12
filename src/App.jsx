import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { auth, db, isFirebaseMock } from './firebase/config';
import { seedRegistryIfEmpty, getLocalRegistry, saveLocalRegistry } from './firebase/registrySeed';
import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import Login from './components/Login';
import { ToolProfiloIdraulico } from './tools/ToolProfiloIdraulico';
import { ToolCarichiTermici } from './tools/ToolCarichiTermici';
import { ToolDispersione } from './tools/ToolDispersione';
import { ToolVerificaLinee } from './tools/ToolVerificaLinee';
import { IconWaves, IconFlame, IconThermometer, IconArrowUp } from './components/Icons';


export default function App() {
    const [user, setUser] = useState(null);
    const [demoUser, setDemoUser] = useState(() => {
        const demo = sessionStorage.getItem('demo_user');
        return demo ? JSON.parse(demo) : null;
    });
    const [userProfile, setUserProfile] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [appMode, setAppMode] = useState('dashboard');
    const [prevMode, setPrevMode] = useState('dashboard');
    
    const [projectData, setProjectData] = useState({
        client: 'Progetto Impianto',
        author: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    // Stato Gestione Anagrafica (Admin)
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [registryList, setRegistryList] = useState([]);
    const [registryLoading, setRegistryLoading] = useState(false);
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [newMemberIsAdmin, setNewMemberIsAdmin] = useState(false);
    const [adminError, setAdminError] = useState('');
    const [adminSuccess, setAdminSuccess] = useState('');

    // Seed automatico dell'anagrafica al mount
    useEffect(() => {
        if (!isFirebaseMock) {
            seedRegistryIfEmpty(db);
        }
    }, []);

    // Ascolto dello stato dell'autenticazione Firebase e caricamento profilo
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                setAuthLoading(true);
                try {
                    const emailClean = currentUser.email.toLowerCase().trim();
                    const docRef = doc(db, "anagrafica", emailClean);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setUserProfile({
                            uid: currentUser.uid,
                            email: currentUser.email,
                            name: data.name,
                            role: data.role,
                            isSocio: data.isSocio || false,
                            isDemo: false
                        });
                    } else {
                        setUserProfile({
                            uid: currentUser.uid,
                            email: currentUser.email,
                            name: currentUser.email.split('@')[0],
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
                        name: currentUser.email.split('@')[0],
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
                    const du = JSON.parse(demo);
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
                const list = getLocalRegistry();
                list.sort((a, b) => a.name.localeCompare(b.name));
                setRegistryList(list);
            } else {
                const snapshot = await getDocs(collection(db, "anagrafica"));
                const list = [];
                snapshot.forEach(docSnap => {
                    list.push(docSnap.data());
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
    const handleAddMember = async (e) => {
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

        const newMember = {
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
    const handleDeleteMember = async (member) => {
        if (member.isSocio || member.email === "mcorbellini@ingegno06.it" || member.email === "aprofeti@ingegno06.it") {
            alert("Impossibile eliminare un socio fondatore.");
            return;
        }

        if (!window.confirm(`Sei sicuro di voler eliminare ${member.name} dall'anagrafica?`)) {
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
    const handleToggleRole = async (member) => {
        if (member.isSocio || member.email === "mcorbellini@ingegno06.it" || member.email === "aprofeti@ingegno06.it") {
            alert("Il ruolo dei soci fondatori non può essere modificato.");
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
                saveLocalRegistry(updated);
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
            {/* Global User Header Bar (in alto a destra) */}
            <div className="max-w-7xl mx-auto flex justify-end items-center mb-6 text-xs text-slate-500 print:hidden gap-3">
                <div>
                    Utente: <strong className="text-slate-700">{userProfile?.name || currentUser.email}</strong> {userProfile?.role === 'admin' ? <span className="text-[10px] bg-rose-500/10 text-rose-700 px-2 py-0.5 rounded-full font-bold ml-1">Admin</span> : <span className="text-[10px] bg-slate-500/10 text-slate-650 px-2 py-0.5 rounded-full font-bold ml-1">Utente</span>} {currentUser.isDemo && <span className="ml-1 text-[9px] bg-amber-500/20 text-amber-700 px-1.5 py-0.5 rounded font-bold">DEMO</span>}
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
                    onClick={() => {
                        if (window.confirm("Desideri disconnetterti dalla Suite?")) {
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

            <div className="max-w-7xl mx-auto">
                {appMode === 'dashboard' && (
                    <div className="bg-white rounded-3xl shadow-xl p-10 text-center relative overflow-hidden">
                        {/* Elementi decorativi */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50/5 rounded-full blur-2xl pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-50/5 rounded-full blur-2xl pointer-events-none"></div>

                        <img src="/Logo.png" alt="Logo" className="h-16 mx-auto mb-4 object-contain" onError={(e) => e.target.style.display='none'} />
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
                        <div className="mt-10 text-[10px] text-slate-400">Piattaforma protetta riservata all'ufficio di ingegneria.</div>
                    </div>
                )}

                {appMode === 'idraulico' && <ToolProfiloIdraulico projectData={projectData} setProjectData={setProjectData} setAppMode={setAppMode} />}
                {appMode === 'termico' && <ToolCarichiTermici projectData={projectData} setProjectData={setProjectData} setAppMode={setAppMode} />}
                {appMode === 'dispersione' && <ToolDispersione projectData={projectData} setProjectData={setProjectData} setAppMode={setAppMode} />}
                {appMode === 'verifica_linee' && <ToolVerificaLinee projectData={projectData} setProjectData={setProjectData} setAppMode={setAppMode} />}
            </div>

            {/* Footer con firma discreta, invisibile in stampa */}
            <footer className="mt-8 mb-4 text-center text-[12px] text-slate-400 font-medium tracking-wide print:hidden select-none">
                Sviluppato da E. Bartalucci
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
        </div>
    );
}
