/**
 * Configurazione centralizzata dei Codici Identificativi Documento (Qualità / SGQ)
 * per tutti i report e le stampe emesse dalla Suite Ingegneria.
 */

export const SECTION_DOC_CODES = {
  termoidraulica: 'M_4.4.6_E4_Term_00',
  elettrica: 'M_4.4.6_E5_Elet_00',
  sicurezza: 'M_4.4.6_E6_Sic_00' // Base per futuri moduli sicurezza
} as const;

export const TOOL_DOC_CODES: Record<string, string> = {
  // Sezione Termoidraulica & Fluidi
  'idraulico': SECTION_DOC_CODES.termoidraulica,
  'termico': SECTION_DOC_CODES.termoidraulica,
  'carichi_climatizzazione': SECTION_DOC_CODES.termoidraulica,
  'dispersione': SECTION_DOC_CODES.termoidraulica,
  'verifica_linee': SECTION_DOC_CODES.termoidraulica,
  'gas': SECTION_DOC_CODES.termoidraulica,
  'hvac': SECTION_DOC_CODES.termoidraulica,
  'pompe_fognarie': SECTION_DOC_CODES.termoidraulica,
  'aspiratore': SECTION_DOC_CODES.termoidraulica,
  'calcoli_vari': SECTION_DOC_CODES.termoidraulica,

  // Sezione Impianti Elettrici
  'calcoli_elettrici': SECTION_DOC_CODES.elettrica,
  'dimensionamento_canali': SECTION_DOC_CODES.elettrica,
  'dimensionamento_pozzetti': SECTION_DOC_CODES.elettrica,
  'staffaggio_supporti': SECTION_DOC_CODES.elettrica,
};

/**
 * Restituisce il codice documento associato a un tool, con fallback alla sezione.
 */
export const getDocumentCode = (toolType: string, defaultCode?: string): string => {
  return TOOL_DOC_CODES[toolType] || defaultCode || SECTION_DOC_CODES.termoidraulica;
};
