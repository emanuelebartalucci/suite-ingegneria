// Tabella delle lunghezze equivalenti in metri di tubo per condotte a gas (metano, azoto, ossigeno)
// Ispirata alla scheda 'Perdite concentrate' del foglio di calcolo aziendale.
export const GAS_DN_LIST: number[] = [10, 15, 20, 25, 40, 50, 80, 100, 125, 200, 250, 300, 400];

export const GAS_EQUIVALENT_LENGTHS: Record<string, Record<number, number>> = {
  valvola_sfera: { 10: 0.2, 15: 0.2, 20: 0.3, 25: 0.3, 40: 0.5, 50: 0.6, 80: 1.0, 100: 1.3, 125: 1.6, 200: 1.9, 250: 2.9, 300: 3.9, 400: 5.2 },
  valvola_diaframma: { 10: 0.6, 15: 0.9, 20: 1.2, 25: 1.5, 40: 2.5, 50: 3.0, 80: 4.5, 100: 6.0, 125: 8.0, 200: 10.0 },
  valvola_squadra: { 10: 1.5, 15: 2.3, 20: 3.0, 25: 4.0, 40: 6.0, 50: 7.0, 80: 12.0, 100: 15.0, 125: 18.0, 200: 22.0, 250: 33.0 },
  valvola_otturatore: { 10: 3.0, 15: 4.5, 20: 6.0, 25: 7.5, 40: 12.0, 50: 15.0, 80: 24.0, 100: 30.0, 125: 38.0, 200: 45.0, 250: 60.0 },
  valvola_ritegno_farfalla: { 10: 0.8, 15: 1.2, 20: 1.6, 25: 2.0, 40: 3.2, 50: 4.0, 80: 6.4, 100: 8.0, 125: 10.0, 200: 12.0, 250: 18.0, 300: 24.0, 400: 32.0 },
  gomito_2d: { 10: 0.2, 15: 0.2, 20: 0.3, 25: 0.3, 40: 0.5, 50: 0.6, 80: 1.0, 100: 1.2, 125: 1.5, 200: 1.8, 250: 2.7, 300: 3.6, 400: 4.8 },
  gomito_d: { 10: 0.2, 15: 0.2, 20: 0.3, 25: 0.4, 40: 0.6, 50: 0.8, 80: 1.3, 100: 1.6, 125: 2.0, 200: 2.4, 250: 3.6, 300: 4.8, 400: 6.4 },
  angolo_90: { 10: 0.6, 15: 0.9, 20: 1.2, 25: 1.5, 40: 2.4, 50: 3.0, 80: 4.5, 100: 6.0, 125: 7.5, 200: 9.0, 250: 13.5, 300: 18.0, 400: 24.0 },
  tee_diretto: { 10: 0.1, 15: 0.1, 20: 0.2, 25: 0.3, 40: 0.4, 50: 1.0, 80: 1.6, 100: 2.0, 125: 2.5, 200: 3.0, 250: 4.5, 300: 6.0, 400: 8.0 },
  tee_laterale: { 10: 0.6, 15: 0.9, 20: 1.2, 25: 1.5, 40: 2.4, 50: 3.0, 80: 4.8, 100: 6.0, 125: 7.5, 200: 9.0, 250: 13.5, 300: 18.0, 400: 24.0 },
  nipplo_riduzione: { 10: 0.2, 15: 0.3, 20: 0.4, 25: 0.5, 40: 0.7, 50: 1.0, 80: 2.0, 100: 2.5, 125: 3.1, 200: 3.6, 250: 5.6, 300: 7.2, 400: 9.6 }
};

export interface GasFittingPreset {
  value: string;
  label: string;
}

export const GAS_FITTINGS_PRESETS: GasFittingPreset[] = [
  { value: "valvola_sfera", label: "Valvola a sfera" },
  { value: "valvola_diaframma", label: "Valvola a diaframma" },
  { value: "valvola_squadra", label: "Valvola a squadra" },
  { value: "valvola_otturatore", label: "Valvola a otturatore" },
  { value: "valvola_ritegno_farfalla", label: "Valvola di ritegno a farfalla" },
  { value: "gomito_2d", label: "Gomito R = 2d" },
  { value: "gomito_d", label: "Gomito R = d" },
  { value: "angolo_90", label: "Angolo 90°" },
  { value: "tee_diretto", label: "Raccordo a T con passaggio diretto" },
  { value: "tee_laterale", label: "Raccordo a T con passaggio laterale" },
  { value: "nipplo_riduzione", label: "Nipplo di riduzione" }
];

/**
 * Recupera la lunghezza equivalente in metri per un tipo di raccordi ed un dato diametro (mm)
 */
export function getGasEquivalentLength(type: string, dn: number | string): number {
  const pieceValues = GAS_EQUIVALENT_LENGTHS[type];
  if (!pieceValues) return 0;

  const targetDN = Number(dn);
  if (pieceValues[targetDN] !== undefined) {
    return pieceValues[targetDN];
  }

  // Fallback: cerca il DN più vicino
  const closestDN = GAS_DN_LIST.reduce((prev, curr) => {
    return (Math.abs(curr - targetDN) < Math.abs(prev - targetDN) ? curr : prev);
  });
  return pieceValues[closestDN] || 0;
}
