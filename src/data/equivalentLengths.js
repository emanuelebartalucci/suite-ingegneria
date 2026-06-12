// Tabella delle lunghezze equivalenti in metri di tubo in base al diametro nominale (mm)
// Ispirata alla scheda 'Lunghezze equivalenti' del foglio di calcolo aziendale.
export const DN_LIST = [15, 20, 25, 32, 40, 50, 65, 80, 100, 125, 150];

export const EQUIVALENT_LENGTHS_TABLE = {
  // Valvola a flusso avviato
  valvola_flusso: {
    label: "Valvola a flusso avviato",
    values: { 15: 1, 20: 2, 25: 4, 32: 5, 40: 7, 50: 10, 65: 14, 80: 18, 100: 22, 125: 35, 150: 45 }
  },
  // Valvola a diaframma
  valvola_diaframma: {
    label: "Valvola a diaframma",
    values: { 15: 0.5, 20: 0.8, 25: 1.2, 32: 1.5, 40: 2, 50: 3, 65: 3.5, 80: 4.5, 100: 6, 125: 8, 150: 10 },
    formula: (dn) => 0.069 * dn - 0.6766
  },
  // Saracinesca
  saracinesca: {
    label: "Saracinesca",
    values: { 15: 0.1, 20: 0.2, 25: 0.3, 32: 0.4, 40: 0.5, 50: 0.7, 65: 0.8, 80: 1, 100: 1.5, 125: 2, 150: 2.5 }
  },
  // Gomito
  gomito: {
    label: "Gomito",
    values: { 15: 0.5, 20: 1, 25: 1.5, 32: 2, 40: 2.5, 50: 3.5, 65: 4.2, 80: 5, 100: 7, 125: 10, 150: 15 }
  },
  // Curva R=d
  curva_d: {
    label: "Curva R=d",
    values: { 15: 0.1, 20: 0.2, 25: 0.3, 32: 0.4, 40: 0.5, 50: 0.6, 65: 0.8, 80: 1, 100: 1.5, 125: 2, 150: 2.5 },
    formula: (dn) => 0.0173 * dn - 0.2022
  },
  // Curva R=2d
  curva_2d: {
    label: "Curva R=2d",
    values: { 15: 0.05, 20: 0.1, 25: 0.15, 32: 0.2, 40: 0.25, 50: 0.3, 65: 0.4, 80: 0.5, 100: 0.8, 125: 1, 150: 1.5 }
  },
  // Innesto a T
  innesto_t: {
    label: "Innesto a T",
    values: { 15: 0.5, 20: 1, 25: 2, 32: 2.5, 40: 3, 50: 4, 65: 5.5, 80: 7, 100: 10, 125: 15, 150: 20 },
    formula: (dn) => 0.1363 * dn - 2.2915
  },
  // Riduzione
  riduzione: {
    label: "Riduzione",
    values: { 15: 0.1, 20: 0.3, 25: 0.5, 32: 0.6, 40: 0.7, 50: 1, 65: 1.5, 80: 2, 100: 2.5, 125: 3.5, 150: 4 },
    formula: (dn) => 0.0293 * dn - 0.3547
  }
};

/**
 * Calcola la lunghezza equivalente in metri per un dato pezzo speciale e un dato DN.
 * @param {string} type - Tipo di pezzo speciale (es. 'valvola_diaframma')
 * @param {number} dn - Diametro nominale (o indicatore) in mm
 * @returns {number} Lunghezza equivalente in metri
 */
export function getEquivalentLength(type, dn) {
  const piece = EQUIVALENT_LENGTHS_TABLE[type];
  if (!piece) return 0;

  const targetDN = Number(dn);
  
  // 1. Se il DN è direttamente presente nei valori tabulati statici
  if (piece.values[targetDN] !== undefined) {
    return piece.values[targetDN];
  }

  // 2. Se il DN è maggiore di 150 ed esiste una formula lineare
  if (targetDN > 150 && piece.formula) {
    return Number(piece.formula(targetDN).toFixed(4));
  }

  // 3. Fallback: se il DN non è presente nella lista ma è inferiore a 150, cerchiamo il DN più vicino
  if (targetDN <= 150) {
    const closestDN = DN_LIST.reduce((prev, curr) => {
      return (Math.abs(curr - targetDN) < Math.abs(prev - targetDN) ? curr : prev);
    });
    return piece.values[closestDN] || 0;
  }

  // 4. Fallback per DN > 150 senza formula (es. saracinesca, gomito): restituiamo il valore massimo a 150
  return piece.values[150] || 0;
}
