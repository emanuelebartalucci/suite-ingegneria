import React from 'react';

interface IconProps {
  className?: string;
}

export const IconDroplets: React.FC<IconProps> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>
  </svg>
);

export const IconArrowUp: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="19" x2="12" y2="5"/>
    <polyline points="5 12 12 5 19 12"/>
  </svg>
);

export const IconPlus: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

export const IconTrash: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    <line x1="10" y1="11" x2="10" y2="17"/>
    <line x1="14" y1="11" x2="14" y2="17"/>
  </svg>
);

export const IconWaves: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M2 6c.6 0 1.2-.2 1.7-.6l2-1.5c1-.8 2.4-.8 3.4 0l2 1.5c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6l2-1.5c1-.8 2.4-.8 3.4 0l2 1.5c.5.4 1.1.6 1.7.6"/>
    <path d="M2 12c.6 0 1.2-.2 1.7-.6l2-1.5c1-.8 2.4-.8 3.4 0l2 1.5c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6l2-1.5c1-.8 2.4-.8 3.4 0l2 1.5c.5.4 1.1.6 1.7.6"/>
    <path d="M2 18c.6 0 1.2-.2 1.7-.6l2-1.5c1-.8 2.4-.8 3.4 0l2 1.5c.5.4 1.1.6 1.7.6s1.2-.2 1.7-.6l2-1.5c1-.8 2.4-.8 3.4 0l2 1.5c.5.4 1.1.6 1.7.6"/>
  </svg>
);

export const IconCylinder: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
  </svg>
);

export const IconPrinter: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="6 9 6 2 18 2 18 9"/>
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
    <rect x="6" y="14" width="12" height="8"/>
  </svg>
);

export const IconInfo: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

export const IconClose: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

export const IconHome: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

export const IconFlame: React.FC<IconProps> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
  </svg>
);

export const IconCopy: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

export const IconThermometer: React.FC<IconProps> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
  </svg>
);

export const IconWind: React.FC<IconProps> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>
  </svg>
);

/**
 * Simbolo P&ID pompa centrifuga di sollevamento fognario (a tutto campo 0-24):
 * Corpo pompa circolare generoso (ISO 10628 / DIN / ISA-5.1), girante a triangolo
 * con campitura semitrasparente, mandata verticale con freccia dinamica,
 * aspirazione laterale flangiata e piede di appoggio a fondo vasca.
 */
export const IconPump: React.FC<IconProps> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Grande corpo pompa circolare P&ID */}
    <circle cx="11" cy="13" r="8" />
    {/* Girante P&ID interna a triangolo proporzionata */}
    <polygon points="7,8.5 7,17.5 16,13" fill="currentColor" fillOpacity="0.25" />
    {/* Condotto di mandata tangenziale che sale fino in cima */}
    <line x1="19" y1="13" x2="19" y2="2" />
    {/* Freccia di mandata verso l'alto netta e visibile */}
    <polyline points="15.5 5.5 19 2 22.5 5.5" />
    {/* Condotto di aspirazione laterale / sommerso con flangia */}
    <line x1="3" y1="13" x2="1" y2="13" />
    <line x1="1" y1="10" x2="1" y2="16" />
    {/* Piede di appoggio alla base vasca */}
    <line x1="11" y1="21" x2="11" y2="23" />
    <line x1="7" y1="23" x2="15" y2="23" />
  </svg>
);

/**
 * Ventilatore centrifugo industriale / aspiratore a chiocciola (a tutto campo 0-24):
 * Cassa voluta a spirale ad espansione continua con bocca di mandata tangenziale
 * flangiata superiore, bocca di aspirazione circolare centrale e girante a pale centrifughe.
 */
export const IconBlower: React.FC<IconProps> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Cassa a chiocciola industriale (voluta centrifuga) a tutto campo */}
    <path d="M12 4C6.5 4 2 8.5 2 14C2 19 6 22 11.5 22C17 22 20.5 18 20.5 13V2H15.5V5.5" />
    {/* Flangia di mandata superiore */}
    <line x1="14" y1="2" x2="22" y2="2" />
    {/* Bocca di aspirazione circolare centrale generosa */}
    <circle cx="11" cy="14" r="5" />
    {/* Mozzo centrale */}
    <circle cx="11" cy="14" r="1.5" fill="currentColor" />
    {/* Pale centrifughe industriali (4 pale ricurve a forte dinamismo) */}
    <path d="M11 12.5C11 10 12.8 8.8 14.5 9" />
    <path d="M12.5 14C15 14 16.2 15.5 16 17" />
    <path d="M11 15.5C11 18 9.2 19.2 7.5 19" />
    <path d="M9.5 14C7 14 5.8 12.5 6 11" />
  </svg>
);

export const IconImpeller: React.FC<IconProps> = IconBlower;

