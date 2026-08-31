# Direttive Permanenti di Progetto (Suite Ingegneria)

> **ISTRUZIONE PER L'AGENTE**: Questo file viene caricato automaticamente all'inizio di OGNI nuova conversazione. Devi rispettare SEMPRE tutte le direttive riportate di seguito in ogni operazione.

---

## 🌐 1. Lingua delle Lavorazioni
- Scrivi sempre l'implementation plan, gli artefatti, i report di analisi, le notifiche Toast, i commenti nel codice e tutti i messaggi per l'utente in **lingua italiana**.

---

## 📝 2. Aggiornamento Automatico Documentazione & Changelog (OBBLIGATORIO)
Dopo ogni modifica di codice o rilascio di funzionalità, **DEVI SEMPRE AGGIORNARE AUTOMATICAMENTE** il file del registro storico:
- `File utili/Changelog_Suite_Ingegneria.md`
- Non attendere che l'utente te lo chieda esplicitamente: aggiorna il changelog come ultimo passaggio prima di completare il task.

---

## 🏷️ 3. Procedura di Versionamento Centralizzato
- **Unica Fonte di Verità**: Il numero di versione è centralizzato in `src/config/version.ts` (`APP_VERSION` e `APP_RELEASE_DATE`).
- **Footer di Stampa Automatico**: Tutte le stampe e i report generati dalla suite includono automaticamente in basso a destra la dicitura:
  $$\text{vX.X.X | Data di Stampa: GG/MM/AAAA}$$
  tramite il componente condiviso `src/components/PrintFooter.tsx`.
- **Avanzamento di Versione**: Quando si introduce una nuova versione o su richiesta dell'utente, aggiorna contestualmente `src/config/version.ts` e inserisci la nuova sezione in `File utili/Changelog_Suite_Ingegneria.md`.

---

## 🛠️ 4. Standard Grafici e Qualità del Codice
- **Coerenza Grafica**: Rispetta rigorosamente i colori di categoria (Azzurro/Brand per Idraulica, Arancione per Termica, Viola per Gas, Ambra per Elettrica) e lo stile sobrio e professionale per le stampe A4/PDF.
- **Feedback Utente**: Notifica sempre le azioni dell'utente con toast e dialoghi tramite `window.suiteUI`.
- **Salvataggio Progetti**: Ogni nuovo strumento deve integrare `ProjectHeader` e `ProjectStorage` per garantire salvataggio Cloud su Firestore e bozza locale.
- **Build Verification**: Esegui sempre `npm run build` (tramite `cmd /c npm run build`) al termine delle modifiche per garantire 0 errori di compilazione TypeScript prima di informare l'utente.
