export interface LoadCurvePoint {
  distanza_mm: number; // Distanza tra i supporti in mm (es. 1000, 1250, 1500...)
  carico_Nm: number;    // Carico massimo ammissibile in N/m
}

export interface CanalizationSupportCatalogEntry {
  id: string;
  produttore: string;
  serie: 'P31+' | 'ZF31 / Cablofil';
  tipologia: 'Canale Chiuso M/F' | 'Passerella Forata M/F' | 'Passerella a filo ZF31/Cablofil';
  altezza_mm: number;
  larghezza_mm: number;
  note_piastra?: string;
  curva_carico: LoadCurvePoint[];
}

const DISTANZE_STANDARD_MM = [1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000];

function makePoints(loads: number[]): LoadCurvePoint[] {
  return DISTANZE_STANDARD_MM.map((d, idx) => ({
    distanza_mm: d,
    carico_Nm: loads[idx]
  }));
}

export const LEGRAND_SUPPORT_CATALOG: CanalizationSupportCatalogEntry[] = [
  // --- H50 CANALE CHIUSO M/F ---
  {
    id: 'p31_chiuso_50x50',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 50,
    larghezza_mm: 50,
    curva_carico: makePoints([410, 350, 300, 250, 200, 160, 120, 80, 40])
  },
  {
    id: 'p31_chiuso_50x75',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 50,
    larghezza_mm: 75,
    curva_carico: makePoints([430, 370, 320, 270, 210, 170, 130, 90, 50])
  },
  {
    id: 'p31_chiuso_50x100',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 50,
    larghezza_mm: 100,
    curva_carico: makePoints([450, 390, 340, 290, 230, 190, 150, 110, 70])
  },
  {
    id: 'p31_chiuso_50x150',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 50,
    larghezza_mm: 150,
    curva_carico: makePoints([470, 410, 360, 300, 250, 200, 160, 120, 80])
  },
  {
    id: 'p31_chiuso_50x200',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 50,
    larghezza_mm: 200,
    curva_carico: makePoints([890, 760, 600, 480, 370, 300, 240, 180, 130])
  },
  {
    id: 'p31_chiuso_50x300',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 50,
    larghezza_mm: 300,
    curva_carico: makePoints([930, 790, 620, 500, 400, 330, 270, 210, 160])
  },
  {
    id: 'p31_chiuso_50x400',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 50,
    larghezza_mm: 400,
    note_piastra: 'Incremento +30% applicabile se piastra allineamento presente su W>=400mm',
    curva_carico: makePoints([1420, 1200, 1000, 820, 650, 530, 420, 320, 200])
  },
  {
    id: 'p31_chiuso_50x500',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 50,
    larghezza_mm: 500,
    note_piastra: 'Incremento +30% applicabile se piastra allineamento presente su W>=400mm',
    curva_carico: makePoints([1480, 1250, 1040, 860, 680, 550, 440, 340, 220])
  },
  {
    id: 'p31_chiuso_50x600',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 50,
    larghezza_mm: 600,
    note_piastra: 'Incremento +30% applicabile se piastra allineamento presente su W>=400mm',
    curva_carico: makePoints([1520, 1280, 1080, 890, 700, 570, 460, 360, 240])
  },

  // --- H75 CANALE CHIUSO M/F ---
  {
    id: 'p31_chiuso_75x75',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 75,
    larghezza_mm: 75,
    curva_carico: makePoints([800, 640, 500, 380, 300, 230, 180, 130, 90])
  },
  {
    id: 'p31_chiuso_75x100',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 75,
    larghezza_mm: 100,
    curva_carico: makePoints([850, 680, 530, 410, 320, 250, 200, 150, 100])
  },
  {
    id: 'p31_chiuso_75x150',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 75,
    larghezza_mm: 150,
    curva_carico: makePoints([1000, 800, 650, 500, 380, 300, 230, 170, 110])
  },
  {
    id: 'p31_chiuso_75x200',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 75,
    larghezza_mm: 200,
    curva_carico: makePoints([1400, 1120, 900, 700, 550, 420, 320, 230, 160])
  },
  {
    id: 'p31_chiuso_75x300',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 75,
    larghezza_mm: 300,
    curva_carico: makePoints([1500, 1200, 950, 750, 600, 460, 360, 270, 200])
  },
  {
    id: 'p31_chiuso_75x400',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 75,
    larghezza_mm: 400,
    note_piastra: 'Incremento +30% applicabile se piastra allineamento presente su W>=400mm',
    curva_carico: makePoints([1800, 1480, 1200, 960, 780, 610, 470, 350, 240])
  },
  {
    id: 'p31_chiuso_75x500',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 75,
    larghezza_mm: 500,
    note_piastra: 'Incremento +30% applicabile se piastra allineamento presente su W>=400mm',
    curva_carico: makePoints([1900, 1550, 1250, 1000, 800, 630, 490, 370, 260])
  },
  {
    id: 'p31_chiuso_75x600',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 75,
    larghezza_mm: 600,
    note_piastra: 'Incremento +30% applicabile se piastra allineamento presente su W>=400mm',
    curva_carico: makePoints([2000, 1620, 1350, 1050, 820, 650, 500, 390, 280])
  },

  // --- H50 PASSERELLA FORATA M/F ---
  {
    id: 'p31_forata_50x50',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 50,
    larghezza_mm: 50,
    curva_carico: makePoints([400, 340, 290, 240, 200, 150, 110, 70, 30])
  },
  {
    id: 'p31_forata_50x75',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 50,
    larghezza_mm: 75,
    curva_carico: makePoints([420, 360, 310, 260, 200, 160, 120, 80, 40])
  },
  {
    id: 'p31_forata_50x100',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 50,
    larghezza_mm: 100,
    curva_carico: makePoints([440, 380, 330, 280, 220, 180, 140, 100, 60])
  },
  {
    id: 'p31_forata_50x150',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 50,
    larghezza_mm: 150,
    curva_carico: makePoints([460, 400, 350, 290, 240, 190, 150, 110, 70])
  },
  {
    id: 'p31_forata_50x200',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 50,
    larghezza_mm: 200,
    curva_carico: makePoints([850, 720, 570, 450, 350, 280, 220, 160, 110])
  },
  {
    id: 'p31_forata_50x300',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 50,
    larghezza_mm: 300,
    curva_carico: makePoints([900, 760, 590, 480, 380, 310, 250, 190, 140])
  },
  {
    id: 'p31_forata_50x400',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 50,
    larghezza_mm: 400,
    note_piastra: 'Incremento +30% applicabile se piastra allineamento presente su W>=400mm',
    curva_carico: makePoints([1350, 1140, 950, 780, 620, 500, 390, 300, 180])
  },
  {
    id: 'p31_forata_50x500',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 50,
    larghezza_mm: 500,
    note_piastra: 'Incremento +30% applicabile se piastra allineamento presente su W>=400mm',
    curva_carico: makePoints([1400, 1180, 980, 810, 645, 520, 410, 320, 200])
  },
  {
    id: 'p31_forata_50x600',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 50,
    larghezza_mm: 600,
    note_piastra: 'Incremento +30% applicabile se piastra allineamento presente su W>=400mm',
    curva_carico: makePoints([1450, 1220, 1020, 840, 660, 540, 430, 335, 215])
  },

  // --- H75 PASSERELLA FORATA M/F ---
  {
    id: 'p31_forata_75x75',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 75,
    larghezza_mm: 75,
    curva_carico: makePoints([750, 600, 470, 350, 270, 210, 160, 110, 70])
  },
  {
    id: 'p31_forata_75x100',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 75,
    larghezza_mm: 100,
    curva_carico: makePoints([800, 640, 500, 380, 300, 230, 180, 130, 90])
  },
  {
    id: 'p31_forata_75x150',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 75,
    larghezza_mm: 150,
    curva_carico: makePoints([950, 760, 610, 470, 350, 280, 210, 150, 100])
  },
  {
    id: 'p31_forata_75x200',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 75,
    larghezza_mm: 200,
    curva_carico: makePoints([1320, 1050, 840, 650, 500, 390, 290, 210, 140])
  },
  {
    id: 'p31_forata_75x300',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 75,
    larghezza_mm: 300,
    curva_carico: makePoints([1420, 1130, 890, 700, 560, 430, 330, 240, 180])
  },
  {
    id: 'p31_forata_75x400',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 75,
    larghezza_mm: 400,
    note_piastra: 'Incremento +30% applicabile se piastra allineamento presente su W>=400mm',
    curva_carico: makePoints([1700, 1390, 1120, 900, 730, 570, 440, 320, 220])
  },
  {
    id: 'p31_forata_75x500',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 75,
    larghezza_mm: 500,
    note_piastra: 'Incremento +30% applicabile se piastra allineamento presente su W>=400mm',
    curva_carico: makePoints([1800, 1460, 1170, 940, 750, 590, 460, 340, 240])
  },
  {
    id: 'p31_forata_75x600',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 75,
    larghezza_mm: 600,
    note_piastra: 'Incremento +30% applicabile se piastra allineamento presente su W>=400mm',
    curva_carico: makePoints([1900, 1530, 1260, 980, 770, 610, 470, 360, 260])
  },

  // --- H25 PASSERELLA FORATA ---
  {
    id: 'p31_forata_25x50',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 25,
    larghezza_mm: 50,
    curva_carico: makePoints([320, 270, 220, 170, 130, 90, 60, 30, 15])
  },
  {
    id: 'p31_forata_25x100',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 25,
    larghezza_mm: 100,
    curva_carico: makePoints([380, 320, 270, 210, 160, 120, 80, 50, 25])
  },
  {
    id: 'p31_forata_25x200',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 25,
    larghezza_mm: 200,
    curva_carico: makePoints([480, 400, 340, 270, 210, 160, 110, 70, 35])
  },
  {
    id: 'p31_forata_25x300',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 25,
    larghezza_mm: 300,
    curva_carico: makePoints([550, 460, 380, 300, 230, 180, 130, 85, 45])
  },
  {
    id: 'p31_forata_25x400',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 25,
    larghezza_mm: 400,
    curva_carico: makePoints([600, 500, 420, 330, 250, 195, 145, 95, 50])
  },
  {
    id: 'p31_forata_25x500',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Passerella Forata M/F',
    altezza_mm: 25,
    larghezza_mm: 500,
    curva_carico: makePoints([640, 530, 440, 350, 265, 205, 155, 105, 55])
  },

  // --- H100 CANALE CHIUSO M/F ---
  {
    id: 'p31_chiuso_100x100',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 100,
    larghezza_mm: 100,
    curva_carico: makePoints([1100, 890, 710, 550, 430, 330, 250, 180, 120])
  },
  {
    id: 'p31_chiuso_100x150',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 100,
    larghezza_mm: 150,
    curva_carico: makePoints([1300, 1050, 830, 650, 510, 390, 300, 220, 150])
  },
  {
    id: 'p31_chiuso_100x200',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 100,
    larghezza_mm: 200,
    curva_carico: makePoints([1650, 1350, 1080, 840, 660, 510, 390, 290, 200])
  },
  {
    id: 'p31_chiuso_100x300',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 100,
    larghezza_mm: 300,
    curva_carico: makePoints([1900, 1540, 1220, 960, 750, 580, 440, 330, 230])
  },
  {
    id: 'p31_chiuso_100x400',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 100,
    larghezza_mm: 400,
    note_piastra: 'Incremento +30% applicabile se piastra allineamento presente su W>=400mm',
    curva_carico: makePoints([2300, 1880, 1500, 1180, 920, 720, 550, 410, 290])
  },
  {
    id: 'p31_chiuso_100x500',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 100,
    larghezza_mm: 500,
    note_piastra: 'Incremento +30% applicabile se piastra allineamento presente su W>=400mm',
    curva_carico: makePoints([2450, 1990, 1590, 1250, 970, 760, 580, 440, 310])
  },
  {
    id: 'p31_chiuso_100x600',
    produttore: 'Legrand',
    serie: 'P31+',
    tipologia: 'Canale Chiuso M/F',
    altezza_mm: 100,
    larghezza_mm: 600,
    note_piastra: 'Incremento +30% applicabile se piastra allineamento presente su W>=400mm',
    curva_carico: makePoints([2550, 2070, 1650, 1290, 1000, 790, 610, 460, 330])
  },

  // --- PASSERELLA A FILO ZF31 / CABLOFIL (H50 & H100) ---
  {
    id: 'zf31_filo_50x100',
    produttore: 'Legrand',
    serie: 'ZF31 / Cablofil',
    tipologia: 'Passerella a filo ZF31/Cablofil',
    altezza_mm: 50,
    larghezza_mm: 100,
    curva_carico: makePoints([400, 330, 270, 210, 160, 120, 90, 60, 35])
  },
  {
    id: 'zf31_filo_50x200',
    produttore: 'Legrand',
    serie: 'ZF31 / Cablofil',
    tipologia: 'Passerella a filo ZF31/Cablofil',
    altezza_mm: 50,
    larghezza_mm: 200,
    curva_carico: makePoints([650, 530, 420, 320, 240, 180, 130, 90, 55])
  },
  {
    id: 'zf31_filo_50x300',
    produttore: 'Legrand',
    serie: 'ZF31 / Cablofil',
    tipologia: 'Passerella a filo ZF31/Cablofil',
    altezza_mm: 50,
    larghezza_mm: 300,
    curva_carico: makePoints([850, 680, 540, 410, 310, 230, 170, 120, 75])
  },
  {
    id: 'zf31_filo_50x400',
    produttore: 'Legrand',
    serie: 'ZF31 / Cablofil',
    tipologia: 'Passerella a filo ZF31/Cablofil',
    altezza_mm: 50,
    larghezza_mm: 400,
    curva_carico: makePoints([1050, 840, 660, 500, 380, 280, 210, 150, 95])
  },
  {
    id: 'zf31_filo_100x200',
    produttore: 'Legrand',
    serie: 'ZF31 / Cablofil',
    tipologia: 'Passerella a filo ZF31/Cablofil',
    altezza_mm: 100,
    larghezza_mm: 200,
    curva_carico: makePoints([1200, 970, 770, 590, 450, 340, 250, 180, 115])
  },
  {
    id: 'zf31_filo_100x300',
    produttore: 'Legrand',
    serie: 'ZF31 / Cablofil',
    tipologia: 'Passerella a filo ZF31/Cablofil',
    altezza_mm: 100,
    larghezza_mm: 300,
    curva_carico: makePoints([1450, 1160, 920, 700, 530, 400, 300, 215, 140])
  },
  {
    id: 'zf31_filo_100x400',
    produttore: 'Legrand',
    serie: 'ZF31 / Cablofil',
    tipologia: 'Passerella a filo ZF31/Cablofil',
    altezza_mm: 100,
    larghezza_mm: 400,
    curva_carico: makePoints([1650, 1320, 1040, 790, 600, 450, 340, 245, 160])
  },
  {
    id: 'zf31_filo_100x600',
    produttore: 'Legrand',
    serie: 'ZF31 / Cablofil',
    tipologia: 'Passerella a filo ZF31/Cablofil',
    altezza_mm: 100,
    larghezza_mm: 600,
    curva_carico: makePoints([1950, 1560, 1230, 930, 700, 530, 400, 285, 185])
  }
];

export function findCatalogCurve(
  serie: string,
  tipologia: string,
  altezza: number,
  larghezza: number
): CanalizationSupportCatalogEntry | null {
  const match = LEGRAND_SUPPORT_CATALOG.find(entry => 
    entry.serie === serie &&
    entry.tipologia === tipologia &&
    entry.altezza_mm === altezza &&
    entry.larghezza_mm === larghezza
  );

  if (match) return match;

  // Fallback: cerca la misura più vicina per la stessa tipologia ed altezza
  const sameFamily = LEGRAND_SUPPORT_CATALOG.filter(entry => 
    entry.serie === serie &&
    entry.tipologia === tipologia &&
    entry.altezza_mm === altezza
  );

  if (sameFamily.length > 0) {
    // Ordina per vicinanza di larghezza
    sameFamily.sort((a, b) => Math.abs(a.larghezza_mm - larghezza) - Math.abs(b.larghezza_mm - larghezza));
    return sameFamily[0];
  }

  // Fallback generale: prima curva disponibile per la serie
  const fallbackSerie = LEGRAND_SUPPORT_CATALOG.find(entry => entry.serie === serie);
  return fallbackSerie || LEGRAND_SUPPORT_CATALOG[0];
}
