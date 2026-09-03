import React from 'react';

interface DpiIconProps {
  id: string;
  className?: string;
  size?: number;
}

export const DpiIcon: React.FC<DpiIconProps> = ({ id, className = 'w-6 h-6', size = 24 }) => {
  switch (id) {
    // 1. Guanti di Protezione Chimica
    case 'dpi_guanti_chimici':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v4" />
          <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v6" />
          <path d="M10 10.5V5a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
          <path d="M6 13a2 2 0 0 0-2 2v2a6 6 0 0 0 6 6h4a6 6 0 0 0 6-6v-6a2 2 0 0 0-2-2h-2" />
          <path d="M6 18h12" strokeDasharray="1.5 1.5" />
        </svg>
      );

    // 2. Occhiali a Mascherina a Tenuta
    case 'dpi_occhiali_mascherina':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M3 10c0-2.2 1.8-4 4-4h10c2.2 0 4 1.8 4 4v2c0 3-2.5 5.5-5.5 5.5-2 0-3.5-1-4.5-2.5-1 1.5-2.5 2.5-4.5 2.5C3.5 17.5 1 15 1 12v-2c0-1.1.9-2 2-2z" />
          <circle cx="7.5" cy="11.5" r="2.5" />
          <circle cx="16.5" cy="11.5" r="2.5" />
          <path d="M10 11.5h4" />
          <path d="M1 11h2M21 11h2" />
        </svg>
      );

    // 3. Schermo / Visiera Facciale
    case 'dpi_schermo_facciale':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M5 4h14a2 2 0 0 1 2 2v1H3V6a2 2 0 0 1 2-2z" />
          <path d="M4 7v6c0 5 3.5 8 8 9s8-4 8-9V7" />
          <circle cx="9" cy="11" r="1" fill="currentColor" />
          <circle cx="15" cy="11" r="1" fill="currentColor" />
          <path d="M10 15h4" />
        </svg>
      );

    // 4. Semimaschera con Filtri Combinati
    case 'dpi_semimaschera_filtri':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M12 4c-3 0-5 3.5-6 6-1 2.5-1 6 0 8 1 2 4 3 6 3s5-1 6-3c1-2 1-5.5 0-8-1-2.5-3-6-6-6z" />
          <circle cx="12" cy="15" r="2" />
          {/* Filtri laterali ABEK */}
          <rect x="1" y="10" width="4" height="6" rx="1.5" />
          <rect x="19" y="10" width="4" height="6" rx="1.5" />
          <path d="M5 13h1M18 13h1" />
        </svg>
      );

    // 5. Facciale Filtrante Monouso FFP2 / FFP3
    case 'dpi_facciale_filtrante_ffp':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M12 5L4 10v3c0 4 3.5 7 8 8s8-4 8-8v-3L12 5z" />
          <circle cx="12" cy="13" r="2" />
          <path d="M4 10l-2 2M20 10l2 2" />
          <path d="M4 14l-2 2M20 14l2 2" />
        </svg>
      );

    // 6. Tuta di Protezione Chimica
    case 'dpi_tuta_chimica':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M9 3h6l2 4 4 2-2 4-2-1v9H7v-9l-2 1-2-4 4-2 2-4z" />
          <circle cx="12" cy="2.5" r="1.5" />
          <path d="M12 7v10" />
          <path d="M10 21h4" />
        </svg>
      );

    // 7. Grembiule Impermeabile Pesante
    case 'dpi_grembiule_chimico':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M9 3h6v3l3 4-2 2-1-1v10H9V11l-1 1-2-2 3-4V3z" />
          <path d="M10 3a2 2 0 0 1 4 0" />
          <line x1="8" y1="14" x2="16" y2="14" strokeDasharray="2 2" />
        </svg>
      );

    // 8. Calzature di Sicurezza S3/S5
    case 'dpi_calzature_sicurezza':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M4 4h6v9l5 1c2.5.5 5 2 5 5v2H2v-5c0-4 1.5-8 2-12z" />
          <path d="M2 19h18" strokeWidth="2.5" />
          <path d="M15 14l2-4" />
        </svg>
      );

    // 9. Otoprotettori (Cuffie / Inserti)
    case 'dpi_otoprotettori':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M3 14h1a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3H3v8z" />
          <path d="M21 14h-1a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h1v8z" />
          <path d="M4 6a8 8 0 0 1 16 0" />
          <rect x="2" y="10" width="3" height="7" rx="1.5" />
          <rect x="19" y="10" width="3" height="7" rx="1.5" />
        </svg>
      );

    // 10. Autorespiratore / Maschera Pieno Facciale
    case 'dpi_autorespiratore':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          {/* Bombola ossigeno + maschera pieno facciale */}
          <rect x="2" y="5" width="5" height="14" rx="2.5" />
          <path d="M4.5 2v3M3 7h4" />
          <path d="M7 12h3c2 0 3 1 3 3v2" />
          <circle cx="17" cy="11" r="5" />
          <path d="M14.5 10a2.5 2.5 0 0 1 5 0" />
          <circle cx="17" cy="13.5" r="1.5" />
        </svg>
      );

    default:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
  }
};
