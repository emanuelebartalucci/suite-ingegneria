import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { auth, db, isFirebaseMock } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { getLocalRegistry } from '../firebase/registrySeed';
import { Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import logoImg from '../assets/Logo.png';

export default function Login({ onLoginDemo }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const emailClean = email.toLowerCase().trim();

    if (isFirebaseMock) {
      try {
        if (isLoginMode) {
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
            setError("Email non registrata nell'anagrafica. Contatta un amministratore o registrati.");
          }
        } else {
          if (password.length < 6) {
            setError("La password deve contenere almeno 6 caratteri.");
            setLoading(false);
            return;
          }
          if (password !== confirmPassword) {
            setError("Le password inserite non coincidono.");
            setLoading(false);
            return;
          }
          const localRegistry = getLocalRegistry();
          const found = localRegistry.find(u => u.email.toLowerCase().trim() === emailClean);
          if (!found) {
            setError("Questa email non è presente nell'anagrafica dipendenti autorizzata. Contatta un amministratore.");
            setLoading(false);
            return;
          }
          setMessage("Registrazione completata con successo in locale! Ora puoi accedere.");
          setIsLoginMode(true);
        }
      } catch (err) {
        console.error(err);
        setError("Errore durante l'operazione in locale.");
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (password.length < 6) {
          setError("La password deve contenere almeno 6 caratteri.");
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError("Le password inserite non coincidono.");
          setLoading(false);
          return;
        }
        
        // Verifica se l'email esiste nell'anagrafica
        const docRef = doc(db, "anagrafica", emailClean);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          setError("La tua email non risulta nell'anagrafica aziendale. Chiedi a un amministratore di inserirla.");
          setLoading(false);
          return;
        }
        
        await createUserWithEmailAndPassword(auth, email, password);
        setMessage("Registrazione completata con successo! Ora puoi accedere.");
        setIsLoginMode(true);
      }
    } catch (err) {
      console.error(err);
      if (isLoginMode) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          setError("Credenziali non valide. Riprova.");
        } else {
          setError("Errore durante l'accesso. Controlla la connessione.");
        }
      } else {
        if (err.code === 'auth/email-already-in-use') {
          setError("Questa e-mail è già registrata.");
        } else {
          setError("Errore durante la registrazione. Riprova più tardi.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError("Inserisci prima la tua email nel campo qui sopra.");
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);

    const emailClean = email.toLowerCase().trim();

    if (isFirebaseMock) {
      try {
        const localRegistry = getLocalRegistry();
        const found = localRegistry.find(u => u.email.toLowerCase().trim() === emailClean);
        if (!found) {
          setError("Email non trovata nell'anagrafica.");
          setLoading(false);
          return;
        }
        setMessage(`Simulazione inviata! Email di ripristino password inviata a ${emailClean}`);
      } catch (err) {
        setError("Errore nella simulazione del ripristino.");
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Ti abbiamo inviato un'email per resettare la password.");
    } catch (err) {
      setError("Errore nell'invio della mail. Verifica l'indirizzo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 relative overflow-hidden font-sans">
      {/* Elementi decorativi di sfondo */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/20 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="flex-1 flex items-center justify-center w-full relative z-10">
        <div className="bg-white/80 backdrop-blur-xl p-8 sm:p-10 rounded-[2rem] shadow-2xl border border-white/50 w-full max-w-md">
          {/* Logo Aziendale */}
          <div className="flex justify-center mb-8">
            <img src={logoImg} alt="Logo" className="h-20 object-contain drop-shadow-md" onError={(e) => {
              e.target.style.display = 'none';
            }} />
          </div>
          
          <h1 className="text-2xl font-extrabold text-center text-gray-900 mb-2">
            {isLoginMode ? 'Bentornato' : 'Crea il tuo Account'}
          </h1>
          <p className="text-center text-gray-500 mb-8 text-sm">
            {isLoginMode ? 'Inserisci le tue credenziali per accedere' : 'Usa l\'email aziendale per registrarti'}
          </p>

          {/* Box Demo Locale in stile premium chiaro */}
          {isFirebaseMock && (
            <div className="bg-amber-50/85 backdrop-blur-md border border-amber-200 text-amber-800 p-4 rounded-2xl text-xs mb-6 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <span className="text-sm">💡</span>
                <span>Database Cloud non configurato</span>
              </div>
              <p className="leading-relaxed text-amber-700">
                Puoi configurare le credenziali reali nel file <code className="bg-amber-100/80 px-1.5 py-0.5 rounded font-mono text-amber-950 border border-amber-200/50">.env</code>, oppure accedere subito in locale con salvataggio sul browser:
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
                className="w-full bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-bold py-2.5 rounded-xl transition-all shadow-sm text-xs cursor-pointer text-center"
              >
                🚀 Accedi come Demo Locale
              </button>
            </div>
          )}
          
          {/* Box Errore */}
          {error && (
            <div className="bg-red-50/80 border border-red-100 text-red-600 p-4 rounded-xl text-sm mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* Box Successo */}
          {message && (
            <div className="bg-green-50/80 border border-green-100 text-green-700 p-4 rounded-xl text-sm mb-6 flex items-start gap-3">
              <div className="w-5 h-5 shrink-0 mt-0.5 flex items-center justify-center bg-green-200 rounded-full text-green-800 font-bold">✓</div>
              <p>{message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Campo Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">Email Aziendale</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="email" 
                  required 
                  placeholder="nome@azienda.it" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 border-none rounded-xl bg-gray-100/80 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Campo Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5 ml-1 pr-1">
                <label className="block text-sm font-semibold text-gray-700">Password</label>
                {isLoginMode && (
                  <button type="button" onClick={handleResetPassword} className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">
                    Password dimenticata?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="password" 
                  required 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 border-none rounded-xl bg-gray-100/80 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Conferma Password (solo registrazione) */}
            {!isLoginMode && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">Conferma Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input 
                    type="password" 
                    required 
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 border-none rounded-xl bg-gray-100/80 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
                  />
                </div>
              </div>
            )}

            {/* Bottone Submit */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-xl hover:bg-gray-800 transition-all shadow-lg flex items-center justify-center gap-2 group active:scale-[0.98]"
            >
              {loading ? 'Caricamento...' : isLoginMode ? 'Accedi' : 'Registrati'}
              {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          {/* Toggle Accedi/Registrati */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600">
              {isLoginMode ? "Non hai ancora un account?" : "Hai già un account?"}
              <button 
                onClick={() => { setIsLoginMode(!isLoginMode); setError(''); setMessage(''); setConfirmPassword(''); }} 
                className="ml-2 font-bold text-blue-600 hover:text-blue-800 transition-colors"
              >
                {isLoginMode ? "Registrati ora" : "Accedi"}
              </button>
            </p>
          </div>
        </div>
      </div>

      <footer className="text-center py-6 text-xs text-gray-400 opacity-40 select-none relative z-10">
        © {new Date().getFullYear()} - Tutti i diritti riservati
      </footer>
    </div>
  );
}
