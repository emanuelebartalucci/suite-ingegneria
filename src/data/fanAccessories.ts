/**
 * Accessori aeraulici — coefficienti ζ per perdite concentrate
 * Basati sulla tabella "Lungh equivalente" del file Excel di riferimento
 * (convertita in coefficienti ζ adimensionali tramite lunghezze equivalenti standard)
 *
 * Formato: per ogni DN (diametro interno in mm), lunghezza equivalente in m di tubo dritto.
 * ζ = λ * (L_eq / D) — calcolato runtime nel tool con λ della condotta.
 */

export interface FanAccessoryRow {
  name: string;
  /** Lunghezze equivalenti [m] per DN: 100, 125, 150, 200, 250, 300, 400, 500, 630, 800, 1000 */
  leq: Record<number, number>;
}

/**
 * Diametri standard di riferimento per le lunghezze equivalenti [mm].
 * Interpolazione lineare tra i valori tabulati per diametri intermedi.
 */
export const FAN_ACCESSORY_DNS = [100, 125, 150, 200, 250, 300, 400, 500, 630, 800, 1000];

/**
 * Tabella lunghezze equivalenti accessori aeraulici [m].
 * Fonte: tabellazione standard per condotte circolari in acciaio/PVC.
 * (la tabella del file Excel copre DN 25–400 per impianti idraulici;
 *  qui è estesa ai DN tipici dell'aeraulica industriale).
 */
export const FAN_ACCESSORIES: FanAccessoryRow[] = [
  {
    name: 'Gomito 90° (R=1.5D)',
    leq: { 100: 6, 125: 7.5, 150: 9, 200: 12, 250: 15, 300: 18, 400: 24, 500: 30, 630: 38, 800: 48, 1000: 60 }
  },
  {
    name: 'Gomito 90° (R=2D)',
    leq: { 100: 1.2, 125: 1.5, 150: 1.8, 200: 2.4, 250: 3.0, 300: 3.6, 400: 4.8, 500: 6.0, 630: 7.5, 800: 9.6, 1000: 12 }
  },
  {
    name: 'Gomito 45° (R=1.5D)',
    leq: { 100: 3.0, 125: 3.75, 150: 4.5, 200: 6.0, 250: 7.5, 300: 9.0, 400: 12, 500: 15, 630: 19, 800: 24, 1000: 30 }
  },
  {
    name: 'Biforcazione (ramo principale)',
    leq: { 100: 2.0, 125: 2.5, 150: 3.0, 200: 4.0, 250: 5.0, 300: 6.0, 400: 8.0, 500: 10, 630: 12.5, 800: 16, 1000: 20 }
  },
  {
    name: 'Biforcazione (ramo laterale)',
    leq: { 100: 4.0, 125: 5.0, 150: 6.0, 200: 8.0, 250: 10, 300: 12, 400: 16, 500: 20, 630: 25, 800: 32, 1000: 40 }
  },
  {
    name: 'Riduzione (espansione progressiva)',
    leq: { 100: 2.5, 125: 3.1, 150: 3.6, 200: 4.8, 250: 6.0, 300: 7.2, 400: 9.6, 500: 12, 630: 15, 800: 19, 1000: 24 }
  },
  {
    name: 'Riduzione (contrazione brusca)',
    leq: { 100: 0.5, 125: 0.6, 150: 0.8, 200: 1.0, 250: 1.3, 300: 1.5, 400: 2.0, 500: 2.5, 630: 3.2, 800: 4.0, 1000: 5.0 }
  },
  {
    name: 'Valvola di intercettazione (aperta)',
    leq: { 100: 1.3, 125: 1.6, 150: 1.9, 200: 2.6, 250: 3.2, 300: 3.9, 400: 5.2, 500: 6.5, 630: 8.2, 800: 10.4, 1000: 13 }
  },
  {
    name: 'Ingresso a bordi vivi (dal plenum)',
    leq: { 100: 2.0, 125: 2.5, 150: 3.0, 200: 4.0, 250: 5.0, 300: 6.0, 400: 8.0, 500: 10, 630: 12.5, 800: 16, 1000: 20 }
  },
  {
    name: 'Uscita libera in ambiente',
    leq: { 100: 1.0, 125: 1.25, 150: 1.5, 200: 2.0, 250: 2.5, 300: 3.0, 400: 4.0, 500: 5.0, 630: 6.3, 800: 8.0, 1000: 10 }
  },
];

/**
 * Interpola linearmente la lunghezza equivalente per un dato diametro.
 * Se il diametro è fuori tabella, usa l'estremo più vicino.
 */
export function getLeqForDiameter(accessory: FanAccessoryRow, D_mm: number): number {
  const dns = FAN_ACCESSORY_DNS;
  if (D_mm <= dns[0]) return accessory.leq[dns[0]];
  if (D_mm >= dns[dns.length - 1]) return accessory.leq[dns[dns.length - 1]];

  // Trova i due DN che racchiudono D_mm
  for (let i = 0; i < dns.length - 1; i++) {
    if (D_mm >= dns[i] && D_mm <= dns[i + 1]) {
      const t = (D_mm - dns[i]) / (dns[i + 1] - dns[i]);
      return accessory.leq[dns[i]] * (1 - t) + accessory.leq[dns[i + 1]] * t;
    }
  }
  return accessory.leq[dns[dns.length - 1]];
}

/** Scabrezza standard [mm] per materiale condotta aeraulica */
export const FAN_ROUGHNESS: Record<string, number> = {
  'Acciaio zincato spiralato': 0.046,
  'Acciaio liscio': 0.025,
  'PVC rigido': 0.02,
  'Alluminio': 0.015,
  'Manuale': 0.046,
};

/** Taglie motori commerciali IEC [kW] (Norma IEC 60072-1 / CEI EN 60034-30-1) */
export const TAGLIE_MOTORI_IEC = [
  0.09, 0.12, 0.18, 0.25, 0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3.0, 4.0, 5.5,
  7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250, 315,
  355, 400, 450, 500,
];

export function getTagliaIEC(kW: number): number {
  return TAGLIE_MOTORI_IEC.find(t => t >= kW) ?? TAGLIE_MOTORI_IEC[TAGLIE_MOTORI_IEC.length - 1];
}
