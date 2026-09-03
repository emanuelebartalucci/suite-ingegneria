import React from 'react';

interface PrintSectionProps {
  title?: string;
  subtitle?: string;
  forceNewPage?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Blocco di sezione standard per i report di stampa.
 * - Impedisce che il contenuto venga spaccato a metà dal salto pagina (break-inside: avoid).
 * - Se non c'è spazio a sufficienza in fondo alla pagina, il browser sposta automaticamente
 *   l'intera sezione all'inizio della pagina successiva.
 * - Permette di forzare l'inizio su pagina nuova con orceNewPage={true}.
 */
export const PrintSection: React.FC<PrintSectionProps> = ({
  title,
  subtitle,
  forceNewPage = false,
  children,
  className = '',
}) => {
  return (
    <div
      className={`print-section ${forceNewPage ? 'print-force-break' : ''} ${className}`}
      style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
    >
      {title && (
        <div className="pb-1.5 mb-3 border-b-2 border-slate-800">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

export default PrintSection;
