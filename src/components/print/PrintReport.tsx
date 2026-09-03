import React from 'react';

interface PrintReportProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Contenitore standard centralizzato per i report di stampa A4 / PDF della Suite Ingegneria.
 * - Nascosto a schermo (hidden), attivo solo in fase di stampa (print:block).
 * - Include distanziamento inferiore di sicurezza per non sovrapporsi al footer.
 * - Applica la tipografia sobria e professionale standard della suite.
 */
export const PrintReport: React.FC<PrintReportProps> = ({ children, className = '' }) => {
  return (
    <div className={`hidden print:block print-report space-y-6 text-slate-800 ${className}`}>
      {children}
    </div>
  );
};

export default PrintReport;
