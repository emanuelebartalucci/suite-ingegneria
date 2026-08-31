import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getPrintFooterText } from '../config/version';

/**
 * Componente Piè di Pagina per la Stampa.
 * Visibile esclusivamente in fase di stampa (@media print) e posizionato
 * in basso a destra su ciascun foglio stampato / PDF.
 */
export const PrintFooter: React.FC = () => {
  const [printText, setPrintText] = useState<string>('');

  useEffect(() => {
    // Aggiorna l'orario al momento dell'apertura del dialogo di stampa
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

  return createPortal(
    <div 
      className="hidden print:block pointer-events-none z-[99999]"
      style={{
        position: 'fixed',
        bottom: '0.1cm',
        right: '0.2cm',
        fontSize: '7.5pt',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
        color: '#64748b',
        lineHeight: '1.2'
      }}
    >
      <span>{printText || getPrintFooterText()}</span>
    </div>,
    document.body
  );
};

export default PrintFooter;
