// Configurazione centralizzata versione per Suite Ingegneria
export const APP_VERSION = "v1.0.2";
export const APP_RELEASE_DATE = "31/08/2026";
export const APP_NAME = "Suite Ingegneria";

/**
 * Restituisce la data corrente formattata per la stampa (es. "31/08/2026")
 */
export const getPrintDateString = (): string => {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Restituisce la stringa standard per il piè di pagina dei report stampati:
 * "v1.0.1 | Data di Stampa: GG/MM/AAAA"
 */
export const getPrintFooterText = (): string => {
  return `${APP_VERSION} | Data di Stampa: ${getPrintDateString()}`;
};
