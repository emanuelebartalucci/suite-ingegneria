import React, { useState, useEffect } from 'react';
import { getPrintFooterText } from '../config/version';

/**
 * Componente Piè di Pagina per la Stampa.
 * Visibile esclusivamente in fase di stampa (@media print) e posizionato
 * nativamente in basso a destra su ciascun foglio stampato / PDF (@page @bottom-right).
 */
export const PrintFooter: React.FC = () => {
  const [printText, setPrintText] = useState<string>('');

  useEffect(() => {
    // Aggiorna la dicitura al momento dell'apertura del dialogo di stampa
    const handleBeforePrint = () => {
      setPrintText(getPrintFooterText());
    };

    // Inizializza
    setPrintText(getPrintFooterText());

    window.addEventListener('beforeprint', handleBeforePrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
    };
  }, []);

  const footerText = printText || getPrintFooterText();

  return (
    <style>{`
      @media print {
        @page {
          @bottom-right {
            content: "${footerText}";
            font-size: 8px;
            font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
            color: #64748b;
            font-weight: 500;
          }
        }
      }
    `}</style>
  );
};

export default PrintFooter;
