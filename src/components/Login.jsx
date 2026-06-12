import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail 
} from 'firebase/auth';
import { auth, db, isFirebaseMock } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { getLocalRegistry } from '../firebase/registrySeed';
import { IconDroplets } from './Icons';


export default function Login({ onLoginDemo }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const emailClean = email.toLowerCase().trim();

    if (isFirebaseMock) {
      try {
        const localRegistry = getLocalRegistry();
        const member = localRegistry.find(u => u.email.toLowerCase().trim() === emailClean);
        if (member) {
          const du = {
            uid: 'demo-' + emailClean,
            email: member.email,
            name: member.name,
            role: member.role,
            isSocio: member.isSocio || false,
            isDemo: true
          };
          onLoginDemo?.(du);
        } else {
          setError('Email non registrata nell\'anagrafica. Contatta un amministratore o registrati.');
        }
      } catch (err) {
        console.error(err);
        setError('Errore durante l\'accesso in locale.');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Credenziali non valide. Riprova.');
      } else {
        setError('Errore durante l\'accesso. Controlla la connessione.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const emailClean = email.toLowerCase().trim();

    if (password.length < 6) {
      setError('La password deve contenere almeno 6 caratteri.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Le password non coincidono.');
      return;
    }

    setLoading(true);

    try {
      if (isFirebaseMock) {
        const localRegistry = getLocalRegistry();
        const found = localRegistry.find(u => u.email.toLowerCase().trim() === emailClean);
        if (!found) {
          setError('Questa email non è presente nell\'anagrafica dipendenti autorizzata. Contatta un amministratore.');
          setLoading(false);
          return;
        }
        
        setMessage('Registrazione completata con successo in locale! Ora puoi accedere.');
        setIsRegistering(false);
      } else {
        const docRef = doc(db, "anagrafica", emailClean);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          setError('Questa email non è presente nell\'anagrafica dipendenti autorizzata. Contatta un amministratore.');
          setLoading(false);
          return;
        }

        await createUserWithEmailAndPassword(auth, email, password);
        setMessage('Registrazione completata con successo! Benvenuto.');
        setIsRegistering(false);
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Questa e-mail è già registrata.');
      } else {
        setError('Errore durante la registrazione. Riprova più tardi.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (!email) {
      setError('Inserisci il tuo indirizzo email.');
      return;
    }

    const emailClean = email.toLowerCase().trim();
    setLoading(true);

    if (isFirebaseMock) {
      const localRegistry = getLocalRegistry();
      const found = localRegistry.find(u => u.email.toLowerCase().trim() === emailClean);
      if (!found) {
        setError('Email non trovata nell\'anagrafica.');
        setLoading(false);
        return;
      }
      setMessage(`Simulazione inviata! Email di ripristino password inviata a ${emailClean}`);
      setShowForgotPassword(false);
      setLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Email di ripristino password inviata! Controlla la tua casella di posta.');
      setShowForgotPassword(false);
    } catch (err) {
      console.error(err);
      setError('Errore durante l\'invio dell\'email. Verifica che l\'indirizzo sia corretto.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 relative overflow-hidden">
      {/* Elementi decorativi di sfondo sfocati */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full bg-brand-600/20 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 rounded-full bg-redbrand-600/10 blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-xl border border-slate-700 rounded-3xl shadow-2xl p-8 transition-all duration-300">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-600/30 mb-4 animate-pulse">
            <IconDroplets className="text-white w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide">Suite Ingegneria</h1>
          <p className="text-slate-400 text-xs mt-1">
            {showForgotPassword 
              ? 'Ripristina la tua password aziendale' 
              : isRegistering 
                ? 'Crea un nuovo account dipendente' 
                : 'Accedi per avviare i calcoli'}
          </p>
        </div>

        {isFirebaseMock && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-6 text-amber-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-400">
              <span className="text-sm">💡</span>
              <span>Database Cloud non configurato</span>
            </div>
            <p className="leading-relaxed">
              Puoi configurare le credenziali reali nel file <code className="bg-slate-900 px-1 py-0.5 rounded font-mono text-amber-300">.env</code> del progetto, oppure provare subito l'app in locale con salvataggi nel browser:
            </p>
            <button
              type="button"
              onClick={() => onLoginDemo?.({ 
                email: 'ebartalucci@ingegno06.it', 
                uid: 'demo-ebartalucci', 
                name: 'Bartalucci Emanuele', 
                role: 'admin', 
                isSocio: false, 
                isDemo: true 
              })}
              className="w-full mt-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 px-3 rounded-xl transition-all shadow-md text-xs cursor-pointer text-center"
            >
              🚀 Accedi come Demo Locale
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-500/15 border border-red-500/30 text-red-200 text-sm rounded-xl p-3 mb-6 flex items-start gap-2">
            <span className="font-bold shrink-0">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {message && (
          <div className="bg-green-500/15 border border-green-500/30 text-green-200 text-sm rounded-xl p-3 mb-6 flex items-start gap-2">
            <span className="font-bold shrink-0">✅</span>
            <p>{message}</p>
          </div>
        )}

        {showForgotPassword ? (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Aziendale</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-all font-mono"
                placeholder="nome.cognome@ingegno.it"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-brand-600 hover:bg-brand-500 disabled:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md shadow-brand-600/20 text-sm"
            >
              {loading ? 'Invio in corso...' : 'Invia Email di Ripristino'}
            </button>

            <div className="text-center pt-2">
              <button 
                type="button" 
                onClick={() => { setShowForgotPassword(false); setError(''); }}
                className="text-xs text-slate-400 hover:text-white transition-all font-semibold"
              >
                Torna al Login
              </button>
            </div>
          </form>
        ) : !isRegistering ? (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Aziendale</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-all font-mono"
                placeholder="nome.cognome@ingegno.it"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Password</label>
                <button 
                  type="button" 
                  onClick={() => { setShowForgotPassword(true); setError(''); }} 
                  className="text-[10px] text-brand-400 hover:text-brand-300 font-semibold"
                >
                  Password dimenticata?
                </button>
              </div>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-all font-mono"
                placeholder="••••••••"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-brand-600 hover:bg-brand-500 disabled:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md shadow-brand-600/20 text-sm"
            >
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </button>

            <div className="text-center pt-2">
              <span className="text-xs text-slate-500">Non hai un account? </span>
              <button 
                type="button" 
                onClick={() => { setIsRegistering(true); setError(''); }} 
                className="text-xs text-brand-400 hover:text-brand-300 transition-all font-bold"
              >
                Registrati ora
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Aziendale Autorizzata</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-all font-mono"
                placeholder="nome.cognome@ingegno.it"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password (min. 6 caratteri)</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-all font-mono"
                placeholder="••••••••"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Conferma Password</label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-all font-mono"
                placeholder="••••••••"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-brand-600 hover:bg-brand-500 disabled:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md shadow-brand-600/20 text-sm"
            >
              {loading ? 'Registrazione in corso...' : 'Registrati'}
            </button>

            <div className="text-center pt-2">
              <span className="text-xs text-slate-500">Hai già un account? </span>
              <button 
                type="button" 
                onClick={() => { setIsRegistering(false); setError(''); }} 
                className="text-xs text-brand-400 hover:text-brand-300 transition-all font-bold"
              >
                Accedi
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
