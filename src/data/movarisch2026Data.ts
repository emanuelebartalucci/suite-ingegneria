/**
 * Modulo Normativo e Dataset: Algoritmo MoVaRisCh (Edizione 28 Febbraio 2026)
 * Valutazione del Rischio Chimico per la Salute dei Lavoratori (D.Lgs. 81/2008 - Titolo IX Capo I)
 */

import dpi01 from '../assets/dpi/dpi_01_guanti_chimici.png';
import dpi02 from '../assets/dpi/dpi_02_guanti_agricolo.png';
import dpi03 from '../assets/dpi/dpi_03_guanti_alimentare.png';
import dpi04 from '../assets/dpi/dpi_04_guanti_monouso.png';
import dpi05 from '../assets/dpi/dpi_05_mascherina_ffp2.png';
import dpi06 from '../assets/dpi/dpi_06_scarpe_s1p.png';
import dpi07 from '../assets/dpi/dpi_07_scarpe_impermeabili.png';
import dpi08 from '../assets/dpi/dpi_08_stivali_s5.png';
import dpi09 from '../assets/dpi/dpi_09_abbigliamento_freddo.png';
import dpi10 from '../assets/dpi/dpi_10_occhiali_laterale.png';
import dpi11 from '../assets/dpi/dpi_11_calotta_visiera.png';
import dpi12 from '../assets/dpi/dpi_12_imbracatura_sicurezza.png';
import dpi13 from '../assets/dpi/dpi_13_maschera_filtri_combinati.png';
import dpi14 from '../assets/dpi/dpi_14_elmetto_sottogola.png';
import dpi15 from '../assets/dpi/dpi_15_inserti_auricolari.png';
import dpi16 from '../assets/dpi/dpi_16_cuffie_antirumore.png';
import dpi17 from '../assets/dpi/dpi_17_indumenti_antitaglio.png';
import dpi18 from '../assets/dpi/dpi_18_gilet_catarifrangente.png';
import dpi19 from '../assets/dpi/dpi_19_rilevatore_gas.png';
import dpi20 from '../assets/dpi/dpi_20_uomo_a_terra.png';

export interface HPhraseItem {
  code: string;
  text: string;
  score: number;
  category?: string;
}

export interface DPIDefinition {
  id: string;
  name: string;
  standard: string;
  description: string;
  iconType?: string;
  imageSrc?: string;
  category?: string;
}

export interface TLVLimitItem {
  id: string;
  substance: string;
  limitValue: string; // es. "1 mg/m³", "200 ppm", "0.02 mg/m³"
  limitType?: 'TLV-TWA' | 'TLV-STEL' | 'VLEP' | 'Altro';
}

export interface ChemicalProduct {
  id: string;
  name: string;
  producer: string;
  sdsDate: string;
  activity?: string; // Attività lavorativa
  homogeneousGroup?: string; // Sottogruppo omogeneo
  
  // Frasi di Pericolo (Indice P)
  selectedHPhrases: string[]; // array di codici es. ["H314_1A", "H335"]
  customScoreP?: number | ''; // Sovrascrittura o selezione caso speciale
  
  // Campi speciali (Scheda 7)
  tlvLimits: TLVLimitItem[];
  formaldehydeDonor: 'SI' | 'NO' | 'N.A.';
  healthPreventionsText: string;
  selectedDpiIds: string[]; // array di ID DPI es. ["dpi_guanti_chimici", "dpi_occhiali_mascherina"]

  // Esposizione Inalatoria (E_inal)
  physicalState: 'solido_nebbie' | 'bassa_volatilita' | 'alta_volatilita_polveri' | 'gas';
  quantity: 'lt_01' | '01_1' | '1_10' | '10_100' | 'gt_100'; // <0.1, 0.1-1, 1-10, 10-100, >100 kg
  useType: 'sistema_chiuso' | 'inclusione_matrice' | 'uso_controllato' | 'uso_dispersivo';
  controlType: 'contenimento' | 'aspirazione' | 'segregazione' | 'ventilazione' | 'manipolazione_diretta';
  exposureTime: 'lt_15m' | '15m_2h' | '2h_4h' | '4h_6h' | 'gt_6h';
  distance: 'lt_1m' | '1_3m' | '3_5m' | '5_10m' | 'gt_10m';

  // Esposizione Cutanea (E_cute)
  skinContactLevel: 'nessuno' | 'accidentale' | 'discontinuo' | 'esteso';
  
  // Flag per indicare se il prodotto ha via cutanea attiva o inalatoria attiva
  hasInhalationRoute: boolean;
  hasSkinRoute: boolean;

  // Note aggiuntive
  notes?: string;
}

export interface GeneralInfo {
  companyName: string;
  site: string;
  department: string;
  activity: string;
  jobRole: string; // Mansione / Sottogruppo omogeneo
  evaluator: string;
  date: string;
}

export interface RiskEvaluationResult {
  scoreP: number;
  scoreD: number; // Disponibilità
  scoreU: number; // Uso
  scoreC: number; // Compensazione
  scoreI: number; // Intensità
  distanceFactor: number; // d
  eInal: number;
  eCute: number;
  rInal: number;
  rCute: number;
  rCombined: number;
  criticalRisk: number; // Rischio critico / determinante
  riskLevel: 'irrilevante' | 'incertezza' | 'superiore_irrilevante' | 'elevato' | 'grave';
  riskColor: string;
  riskBgColor: string;
  riskBorderColor: string;
  riskBadgeLabel: string;
  riskDescription: string;
}

// -------------------------------------------------------------
// Catalogo Frasi H ed EUH (MoVaRisCh 2026)
// -------------------------------------------------------------
export const H_PHRASES_2026: HPhraseItem[] = [
  // Tossicità Acuta
  { code: 'H300_cat1', text: 'H300 (Cat. 1) - Letale se ingerito', score: 3.00, category: 'Tossicità Acuta' },
  { code: 'H300_cat2', text: 'H300 (Cat. 2) - Letale se ingerito', score: 2.50, category: 'Tossicità Acuta' },
  { code: 'H301', text: 'H301 - Tossico se ingerito', score: 2.25, category: 'Tossicità Acuta' },
  { code: 'H302', text: 'H302 - Nocivo se ingerito', score: 2.00, category: 'Tossicità Acuta' },
  { code: 'H304', text: 'H304 - Può essere letale in caso di ingestione e di penetrazione nelle vie respiratorie', score: 5.00, category: 'Aspirazione' },
  
  { code: 'H310_cat1', text: 'H310 (Cat. 1) - Letale a contatto con la pelle', score: 6.50, category: 'Tossicità Cutanea' },
  { code: 'H310_cat2', text: 'H310 (Cat. 2) - Letale a contatto con la pelle', score: 5.50, category: 'Tossicità Cutanea' },
  { code: 'H311', text: 'H311 - Tossico a contatto con la pelle', score: 4.50, category: 'Tossicità Cutanea' },
  { code: 'H312', text: 'H312 - Nocivo a contatto con la pelle', score: 3.00, category: 'Tossicità Cutanea' },

  { code: 'H330_cat1', text: 'H330 (Cat. 1) - Letale se inalato', score: 8.50, category: 'Tossicità Inalatoria' },
  { code: 'H330_cat2', text: 'H330 (Cat. 2) - Letale se inalato', score: 7.50, category: 'Tossicità Inalatoria' },
  { code: 'H331', text: 'H331 - Tossico se inalato', score: 6.00, category: 'Tossicità Inalatoria' },
  { code: 'H332', text: 'H332 - Nocivo se inalato', score: 4.50, category: 'Tossicità Inalatoria' },

  // Corrosione / Irritazione
  { code: 'H314_1A', text: 'H314 (Cat. 1A) - Provoca gravi ustioni cutanee e gravi lesioni oculari', score: 6.25, category: 'Corrosione / Irritazione' },
  { code: 'H314_1B', text: 'H314 (Cat. 1B) - Provoca gravi ustioni cutanee e gravi lesioni oculari', score: 5.75, category: 'Corrosione / Irritazione' },
  { code: 'H314_1C', text: 'H314 (Cat. 1C) - Provoca gravi ustioni cutanee e gravi lesioni oculari', score: 5.50, category: 'Corrosione / Irritazione' },
  { code: 'H314', text: 'H314 - Provoca gravi ustioni cutanee e gravi lesioni oculari (generica)', score: 6.00, category: 'Corrosione / Irritazione' },
  { code: 'H315', text: 'H315 - Provoca irritazione cutanea', score: 2.50, category: 'Corrosione / Irritazione' },
  { code: 'H318', text: 'H318 - Provoca gravi lesioni oculari', score: 4.50, category: 'Lesioni Oculari' },
  { code: 'H319', text: 'H319 - Provoca grave irritazione oculare', score: 3.00, category: 'Lesioni Oculari' },

  // Sensibilizzazione
  { code: 'H334_1A', text: 'H334 (Cat. 1A) - Può provocare sintomi allergici o asmatici o difficoltà respiratorie se inalato', score: 9.00, category: 'Sensibilizzazione Respiratoria' },
  { code: 'H334_1B', text: 'H334 (Cat. 1B) - Può provocare sintomi allergici o asmatici o difficoltà respiratorie se inalato', score: 8.00, category: 'Sensibilizzazione Respiratoria' },
  { code: 'H334', text: 'H334 - Può provocare sintomi allergici o asmatici o difficoltà respiratorie se inalato (generica)', score: 8.50, category: 'Sensibilizzazione Respiratoria' },
  { code: 'H317_1A', text: 'H317 (Cat. 1A) - Può provocare una reazione allergica cutanea', score: 6.00, category: 'Sensibilizzazione Cutanea' },
  { code: 'H317_1B', text: 'H317 (Cat. 1B) - Può provocare una reazione allergica cutanea', score: 4.50, category: 'Sensibilizzazione Cutanea' },
  { code: 'H317', text: 'H317 - Può provocare una reazione allergica cutanea (generica)', score: 5.25, category: 'Sensibilizzazione Cutanea' },

  // Tossicità Specifica per Organi Bersaglio (STOT)
  { code: 'H370', text: 'H370 - Provoca danni agli organi', score: 9.50, category: 'STOT Singola' },
  { code: 'H371', text: 'H371 - Può provocare danni agli organi', score: 8.00, category: 'STOT Singola' },
  { code: 'H335', text: 'H335 - Può irritare le vie respiratorie', score: 3.25, category: 'STOT Singola' },
  { code: 'H336', text: 'H336 - Può provocare sonnolenza o vertigini', score: 3.50, category: 'STOT Singola' },
  { code: 'H372', text: 'H372 - Provoca danni agli organi in caso di esposizione prolungata o ripetuta', score: 8.00, category: 'STOT Ripetuta' },
  { code: 'H373', text: 'H373 - Può provocare danni agli organi in caso di esposizione prolungata o ripetuta', score: 7.00, category: 'STOT Ripetuta' },

  // Effetti Cronici / CMR (Cat. 2 / Sospetti)
  { code: 'H341', text: 'H341 - Sospettato di provocare alterazioni genetiche', score: 8.00, category: 'Mutagenicità (Cat. 2)' },
  { code: 'H351', text: 'H351 - Sospettato di provocare il cancro', score: 8.00, category: 'Cancerogenicità (Cat. 2)' },
  { code: 'H361', text: 'H361 - Sospettato di nuocere alla fertilità o al feto', score: 8.00, category: 'Riproduzione (Cat. 2)' },
  { code: 'H361d', text: 'H361d - Sospettato di nuocere al feto', score: 7.50, category: 'Riproduzione (Cat. 2)' },
  { code: 'H361f', text: 'H361f - Sospettato di nuocere alla fertilità', score: 7.50, category: 'Riproduzione (Cat. 2)' },
  { code: 'H361fd', text: 'H361fd - Sospettato di nuocere alla fertilità e al feto', score: 8.00, category: 'Riproduzione (Cat. 2)' },
  { code: 'H362', text: 'H362 - Può essere nocivo per i lattanti allattati al seno', score: 6.00, category: 'Allattamento' },

  // Frasi CMR Cat. 1A/1B
  { code: 'H340', text: 'H340 - Può provocare alterazioni genetiche (Cat. 1A/1B)', score: 10.00, category: 'Mutagenicità (Cat. 1)' },
  { code: 'H350', text: 'H350 - Può provocare il cancro (Cat. 1A/1B)', score: 10.00, category: 'Cancerogenicità (Cat. 1)' },
  { code: 'H350i', text: 'H350i - Può provocare il cancro se inalato (Cat. 1A/1B)', score: 10.00, category: 'Cancerogenicità (Cat. 1)' },
  { code: 'H360', text: 'H360 - Può nuocere alla fertilità o al feto (Cat. 1A/1B)', score: 10.00, category: 'Riproduzione (Cat. 1)' },
  { code: 'H360D', text: 'H360D - Può nuocere al feto (Cat. 1A/1B)', score: 9.50, category: 'Riproduzione (Cat. 1)' },
  { code: 'H360F', text: 'H360F - Può nuocere alla fertilità (Cat. 1A/1B)', score: 9.50, category: 'Riproduzione (Cat. 1)' },
  { code: 'H360FD', text: 'H360FD - Può nuocere alla fertilità e al feto (Cat. 1A/1B)', score: 10.00, category: 'Riproduzione (Cat. 1)' },
  { code: 'H360Df', text: 'H360Df - Può nuocere al feto. Sospettato di nuocere alla fertilità', score: 9.75, category: 'Riproduzione (Cat. 1)' },

  // Nuove Frasi Interferenti Endocrini 2026
  { code: 'EUH380', text: 'EUH380 - Può interferire con il sistema endocrino negli esseri umani', score: 10.00, category: 'Interferenti Endocrini (2026)' },
  { code: 'EUH381', text: 'EUH381 - Sospettato di interferire con il sistema endocrino negli esseri umani', score: 8.00, category: 'Interferenti Endocrini (2026)' },

  // Frasi EUH Specifiche
  { code: 'EUH029', text: 'EUH029 - A contatto con l’acqua libera un gas tossico', score: 3.00, category: 'Proprietà Pericolose EUH' },
  { code: 'EUH031', text: 'EUH031 - A contatto con acidi libera gas tossico', score: 3.00, category: 'Proprietà Pericolose EUH' },
  { code: 'EUH032', text: 'EUH032 - A contatto con acidi libera gas molto tossico', score: 3.50, category: 'Proprietà Pericolose EUH' },
  { code: 'EUH066', text: 'EUH066 - L’esposizione ripetuta può provocare secchezza e screpolature della pelle', score: 2.50, category: 'Proprietà Pericolose EUH' },
  { code: 'EUH070', text: 'EUH070 - Tossico per contatto oculare', score: 6.00, category: 'Proprietà Pericolose EUH' },
  { code: 'EUH071', text: 'EUH071 - Corrosivo per le vie respiratorie', score: 6.50, category: 'Proprietà Pericolose EUH' },
  { code: 'EUH201', text: 'EUH201 - Contiene Piombo. Non utilizzare su oggetti masticabili', score: 6.00, category: 'Elementi Specifici EUH' },
  { code: 'EUH201A', text: 'EUH201A - Attenzione! Contiene Piombo', score: 6.00, category: 'Elementi Specifici EUH' },
  { code: 'EUH202', text: 'EUH202 - Cianoacrilato. Pericolo. Incolla la pelle e gli occhi in pochi secondi', score: 4.50, category: 'Elementi Specifici EUH' },
  { code: 'EUH203', text: 'EUH203 - Contiene Cromo (VI). Può provocare una reazione allergica', score: 4.50, category: 'Elementi Specifici EUH' },
  { code: 'EUH204', text: 'EUH204 - Contiene Isocianati. Può provocare una reazione allergica', score: 7.00, category: 'Elementi Specifici EUH' },
  { code: 'EUH205', text: 'EUH205 - Contiene Composti Epossidici. Può provocare una reazione allergica', score: 4.50, category: 'Elementi Specifici EUH' },
  { code: 'EUH206', text: 'EUH206 - Attenzione! Non utilizzare con altri prodotti. Possono formarsi gas pericolosi', score: 3.00, category: 'Elementi Specifici EUH' },
  { code: 'EUH207', text: 'EUH207 - Attenzione! Contiene Cadmio. Durante l’uso si sviluppano fumi pericolosi', score: 8.00, category: 'Elementi Specifici EUH' },
  { code: 'EUH208', text: 'EUH208 - Contiene sostanza sensibilizzante. Può provocare una reazione allergica', score: 4.00, category: 'Elementi Specifici EUH' },

  // Casi Speciali MoVaRisCh (Miscele non classificate / Processi)
  { code: 'SPECIAL_MISC_SCORE_GE8', text: 'Miscela non classificata contenente sostanza pericolosa con Score ≥ 8', score: 5.50, category: 'Casi Speciali Miscele' },
  { code: 'SPECIAL_MISC_INAL_GE4', text: 'Miscela non classificata con sostanza pericolosa per via inalatoria (Score < 8) o sensibilizzante 1A', score: 4.00, category: 'Casi Speciali Miscele' },
  { code: 'SPECIAL_MISC_INAL_LT4', text: 'Miscela non classificata con sostanza tossica inalatoria Cat. 4 / narcosi / irritazione o sensibilizzante 1B', score: 2.50, category: 'Casi Speciali Miscele' },
  { code: 'SPECIAL_MISC_CUT_GE3', text: 'Miscela non classificata con sostanza a soli effetti acuti cutanei/ingestione con Score ≥ 3', score: 2.25, category: 'Casi Speciali Miscele' },
  { code: 'SPECIAL_MISC_TLV', text: 'Miscela non classificata contenente sostanza con Valore Limite Professionale (TLV)', score: 2.25, category: 'Casi Speciali Miscele' },
  { code: 'SPECIAL_MISC_CUT_LT3', text: 'Miscela non classificata con sostanza a soli effetti acuti cutanei/ingestione con Score < 3', score: 1.75, category: 'Casi Speciali Miscele' },
  { code: 'SPECIAL_SOST_TLV', text: 'Sostanza pura alla quale è stato assegnato un valore limite professionale (TLV)', score: 3.00, category: 'Casi Speciali Sostanze' },
  
  // Emissioni di processo / Attività lavorative
  { code: 'SPECIAL_EMISS_INAL_GE65', text: 'Processo ad elevata emissione: agente inalatorio con Score ≥ 6.50 (es. saldatura)', score: 5.00, category: 'Processi Lavorativi' },
  { code: 'SPECIAL_EMISS_INAL_45_65', text: 'Processo ad elevata emissione: agente inalatorio con 4.50 ≤ Score < 6.50', score: 3.00, category: 'Processi Lavorativi' },
  { code: 'SPECIAL_EMISS_INAL_30_45', text: 'Processo ad elevata emissione: agente inalatorio con 3.00 ≤ Score < 4.50', score: 2.25, category: 'Processi Lavorativi' },
  { code: 'SPECIAL_EMISS_CUT_GE65', text: 'Processo ad elevata emissione: agente cutaneo con Score ≥ 6.50', score: 3.00, category: 'Processi Lavorativi' },
  
  // Valore Minimo Non Nullo per sostanze non pericolose
  { code: 'NON_PERICOLOSO_MIN', text: 'Sostanza / Miscela non pericolosa (Punteggio minimo base)', score: 1.00, category: 'Non Pericoloso' }
];

// -------------------------------------------------------------
// Catalogo dei 20 DPI Aziendali MoVaRisCh / Sicurezza Luoghi di Lavoro
// -------------------------------------------------------------
export const DEFAULT_DPI_CATALOG: DPIDefinition[] = [
  {
    id: 'dpi_01_guanti_chimici',
    name: 'Guanti di protezione da agenti chimici',
    standard: 'EN ISO 10819 - EN 374 - 123',
    description: '',
    imageSrc: dpi01,
    category: 'Mani'
  },
  {
    id: 'dpi_02_guanti_agricolo',
    name: 'Guanti di protezione (comparto agricolo)',
    standard: 'EN 388',
    description: '',
    imageSrc: dpi02,
    category: 'Mani'
  },
  {
    id: 'dpi_03_guanti_alimentare',
    name: 'Guanti di protezione (antitaglio per uso alimentare)',
    standard: 'EN 388',
    description: '',
    imageSrc: dpi03,
    category: 'Mani'
  },
  {
    id: 'dpi_04_guanti_monouso',
    name: 'Guanti monouso (messi in confezioni a disposizione sul carrello attrezzato)',
    standard: '',
    description: '',
    imageSrc: dpi04,
    category: 'Mani'
  },
  {
    id: 'dpi_05_mascherina_ffp2',
    name: 'Mascherine facciali per agenti chimici / polveri',
    standard: 'UNI EN 149:2009 – FFP2',
    description: '',
    imageSrc: dpi05,
    category: 'Vie Respiratorie'
  },
  {
    id: 'dpi_06_scarpe_s1p',
    name: 'Scarpe con suola antiscivolo e punta rinforzata',
    standard: 'UNI EN ISO 20345:2022 S1P',
    description: '',
    imageSrc: dpi06,
    category: 'Piedi'
  },
  {
    id: 'dpi_07_scarpe_impermeabili',
    name: 'Scarpe con suola antiscivolo, impermeabili e punta rinforzata',
    standard: 'UNI EN ISO 20345',
    description: '',
    imageSrc: dpi07,
    category: 'Piedi'
  },
  {
    id: 'dpi_08_stivali_s5',
    name: 'Stivali con suola antiscivolo e punta rinforzata',
    standard: 'UNI EN ISO 20345 - UNI EN ISO 20346 - UNI EN ISO 20347 – S5 SRC',
    description: '',
    imageSrc: dpi08,
    category: 'Piedi'
  },
  {
    id: 'dpi_09_abbigliamento_freddo',
    name: 'Abbigliamento da lavoro protettivo contro il freddo (a disposizione al di fuori delle celle frigo)',
    standard: 'EN 342',
    description: '',
    imageSrc: dpi09,
    category: 'Corpo'
  },
  {
    id: 'dpi_10_occhiali_laterale',
    name: 'Occhiali con protezione laterale',
    standard: '',
    description: '',
    imageSrc: dpi10,
    category: 'Occhi e Viso'
  },
  {
    id: 'dpi_11_calotta_visiera',
    name: 'Calotta con visiera',
    standard: '',
    description: '',
    imageSrc: dpi11,
    category: 'Occhi e Viso'
  },
  {
    id: 'dpi_12_imbracatura_sicurezza',
    name: 'Imbracatura di sicurezza con cordino di trattenuta',
    standard: 'UNI EN 361',
    description: '',
    imageSrc: dpi12,
    category: 'Anticaduta'
  },
  {
    id: 'dpi_13_maschera_filtri_combinati',
    name: 'Maschera facciale filtrante con filtri combinati (messa a disposizione all\'ingresso dei locali tecnici delle piscine)',
    standard: '',
    description: '',
    imageSrc: dpi13,
    category: 'Vie Respiratorie'
  },
  {
    id: 'dpi_14_elmetto_sottogola',
    name: 'Elmetto di protezione con sottogola',
    standard: 'EN 397',
    description: '',
    imageSrc: dpi14,
    category: 'Testa'
  },
  {
    id: 'dpi_15_inserti_auricolari',
    name: 'Inserti auricolari monouso',
    standard: 'SNR 34',
    description: '',
    imageSrc: dpi15,
    category: 'Udito'
  },
  {
    id: 'dpi_16_cuffie_antirumore',
    name: 'Cuffie antirumore',
    standard: 'SNR 27',
    description: '',
    imageSrc: dpi16,
    category: 'Udito'
  },
  {
    id: 'dpi_17_indumenti_antitaglio',
    name: 'Indumenti antitaglio (Classe 1 - Velocità catena 20 m/s)',
    standard: 'EN 381 - EN 11393-2:2019',
    description: '',
    imageSrc: dpi17,
    category: 'Corpo'
  },
  {
    id: 'dpi_18_gilet_catarifrangente',
    name: 'Gilet con inserti catarifrangenti',
    standard: '',
    description: '',
    imageSrc: dpi18,
    category: 'Corpo'
  },
  {
    id: 'dpi_19_rilevatore_gas',
    name: 'Rilevatore di gas portatile',
    standard: '',
    description: '',
    imageSrc: dpi19,
    category: 'Monitoraggio & Sicurezza'
  },
  {
    id: 'dpi_20_uomo_a_terra',
    name: 'Dispositivo di emergenza uomo a terra (Man Down)',
    standard: '',
    description: '',
    imageSrc: dpi20,
    category: 'Monitoraggio & Sicurezza'
  }
];

// -------------------------------------------------------------
// MATRICI MOVARISCH 2026
// -------------------------------------------------------------

// MATRICE 1: Proprietà chimico-fisiche x Quantità in uso -> Disponibilità (D)
// 1 = Bassa, 2 = Medio/Bassa, 3 = Medio/Alta, 4 = Alta
export const MATRIX_1_D: Record<ChemicalProduct['physicalState'], Record<ChemicalProduct['quantity'], number>> = {
  solido_nebbie: {
    lt_01: 1,
    '01_1': 1,
    '1_10': 1,
    '10_100': 2,
    gt_100: 2
  },
  bassa_volatilita: {
    lt_01: 1,
    '01_1': 2,
    '1_10': 3,
    '10_100': 3,
    gt_100: 4
  },
  alta_volatilita_polveri: {
    lt_01: 1,
    '01_1': 3,
    '1_10': 3,
    '10_100': 4,
    gt_100: 4
  },
  gas: {
    lt_01: 2,
    '01_1': 3,
    '1_10': 4,
    '10_100': 4,
    gt_100: 4
  }
};

// MATRICE 2: Disponibilità (D) x Tipologia d'uso -> Indicatore d'uso (U)
// 1 = Basso, 2 = Medio, 3 = Alto
export const MATRIX_2_U: Record<number, Record<ChemicalProduct['useType'], number>> = {
  1: { sistema_chiuso: 1, inclusione_matrice: 1, uso_controllato: 1, uso_dispersivo: 2 },
  2: { sistema_chiuso: 1, inclusione_matrice: 2, uso_controllato: 2, uso_dispersivo: 3 },
  3: { sistema_chiuso: 1, inclusione_matrice: 2, uso_controllato: 3, uso_dispersivo: 3 },
  4: { sistema_chiuso: 2, inclusione_matrice: 3, uso_controllato: 3, uso_dispersivo: 3 }
};

// MATRICE 3: Indicatore d'uso (U) x Tipologia di controllo -> Indicatore di Compensazione (C)
// 1 = Basso, 2 = Medio, 3 = Alto
export const MATRIX_3_C: Record<number, Record<ChemicalProduct['controlType'], number>> = {
  1: { contenimento: 1, aspirazione: 1, segregazione: 1, ventilazione: 2, manipolazione_diretta: 2 },
  2: { contenimento: 1, aspirazione: 2, segregazione: 2, ventilazione: 3, manipolazione_diretta: 3 },
  3: { contenimento: 1, aspirazione: 2, segregazione: 3, ventilazione: 3, manipolazione_diretta: 3 }
};

// MATRICE 4: Indicatore di Compensazione (C) x Tempo di esposizione -> Sub-indice di Intensità (I)
// Valori: Bassa=1, Medio/Bassa=3, Medio/Alta=7, Alta=10
export const MATRIX_4_I: Record<number, Record<ChemicalProduct['exposureTime'], number>> = {
  1: { lt_15m: 1, '15m_2h': 1, '2h_4h': 3, '4h_6h': 3, gt_6h: 7 },
  2: { lt_15m: 1, '15m_2h': 3, '2h_4h': 7, '4h_6h': 7, gt_6h: 10 },
  3: { lt_15m: 3, '15m_2h': 7, '2h_4h': 10, '4h_6h': 10, gt_6h: 10 }
};

// FATTORE DISTANZA (d)
export const DISTANCE_FACTORS: Record<ChemicalProduct['distance'], number> = {
  lt_1m: 1.0,
  '1_3m': 0.75,
  '3_5m': 0.50,
  '5_10m': 0.25,
  gt_10m: 0.10
};

// MATRICE CUTANEA: Tipologia d'uso x Livello di contatto -> Esposizione Cutanea (E_cute)
// Valori: Basso=1, Medio=3, Alto=7, Molto Alto=10
export const MATRIX_SKIN_E: Record<ChemicalProduct['useType'], Record<ChemicalProduct['skinContactLevel'], number>> = {
  sistema_chiuso: { nessuno: 1, accidentale: 1, discontinuo: 3, esteso: 7 },
  inclusione_matrice: { nessuno: 1, accidentale: 3, discontinuo: 3, esteso: 7 },
  uso_controllato: { nessuno: 1, accidentale: 3, discontinuo: 7, esteso: 10 },
  uso_dispersivo: { nessuno: 1, accidentale: 7, discontinuo: 7, esteso: 10 }
};

// -------------------------------------------------------------
// FUNZIONI DI CALCOLO MOVARISCH 2026
// -------------------------------------------------------------

/**
 * Calcola il punteggio P massimo dalle frasi H/EUH selezionate
 */
export function calculateScoreP(selectedCodes: string[], customScore?: number | ''): number {
  if (customScore !== undefined && customScore !== '' && !isNaN(Number(customScore))) {
    return Number(customScore);
  }
  if (!selectedCodes || selectedCodes.length === 0) {
    return 1.0; // Punteggio base non pericoloso
  }
  let maxScore = 1.0;
  for (const code of selectedCodes) {
    const found = H_PHRASES_2026.find(p => p.code === code);
    if (found && found.score > maxScore) {
      maxScore = found.score;
    }
  }
  return maxScore;
}

/**
 * Esegue la valutazione completa MoVaRisCh 2026 per un prodotto chimico
 */
export function evaluateMoVaRisCh(product: ChemicalProduct): RiskEvaluationResult {
  const scoreP = calculateScoreP(product.selectedHPhrases, product.customScoreP);
  
  // Calcolo Inalatorio
  const scoreD = MATRIX_1_D[product.physicalState]?.[product.quantity] ?? 1;
  const scoreU = MATRIX_2_U[scoreD]?.[product.useType] ?? 1;
  const scoreC = MATRIX_3_C[scoreU]?.[product.controlType] ?? 1;
  const scoreI = MATRIX_4_I[scoreC]?.[product.exposureTime] ?? 1;
  const distanceFactor = DISTANCE_FACTORS[product.distance] ?? 1.0;
  
  const rawEInal = scoreI * distanceFactor;
  const eInal = product.hasInhalationRoute ? Math.round(rawEInal * 100) / 100 : 0;
  
  // Calcolo Cutaneo
  const rawECute = MATRIX_SKIN_E[product.useType]?.[product.skinContactLevel] ?? 1;
  const eCute = product.hasSkinRoute ? rawECute : 0;

  // Rischi parziali
  const rInal = product.hasInhalationRoute ? Math.round(scoreP * eInal * 100) / 100 : 0;
  const rCute = product.hasSkinRoute ? Math.round(scoreP * eCute * 100) / 100 : 0;

  // Rischio combinato (o critico se una sola via)
  let rCombined = 0;
  if (product.hasInhalationRoute && product.hasSkinRoute) {
    rCombined = Math.round(Math.sqrt(Math.pow(rInal, 2) + Math.pow(rCute, 2)) * 100) / 100;
  } else if (product.hasInhalationRoute) {
    rCombined = rInal;
  } else if (product.hasSkinRoute) {
    rCombined = rCute;
  } else {
    rCombined = 0;
  }

  const criticalRisk = rCombined;

  // Attribuzione Fascia di Rischio MoVaRisCh 2026
  let riskLevel: RiskEvaluationResult['riskLevel'] = 'irrilevante';
  let riskColor = '#10b981'; // Smeraldo / Verde
  let riskBgColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
  let riskBorderColor = 'border-emerald-500';
  let riskBadgeLabel = 'Rischio Irrilevante per la Salute (Zona Verde)';
  let riskDescription = 'Il rischio è moderato/irrilevante per la salute. Si applicano le misure generali di tutela di cui all\'art. 224 comma 1 D.Lgs. 81/08.';

  if (criticalRisk >= 0.1 && criticalRisk < 15) {
    riskLevel = 'irrilevante';
    riskColor = '#10b981';
    riskBgColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
    riskBorderColor = 'border-emerald-500';
    riskBadgeLabel = 'Rischio Irrilevante per la Salute (Zona Verde)';
    riskDescription = 'Rischio chimico per la salute irrilevante. Idoneo per il mantenimento delle condizioni operative ordinarie con consultazione del Medico Competente.';
  } else if (criticalRisk >= 15 && criticalRisk < 21) {
    riskLevel = 'incertezza';
    riskColor = '#f59e0b'; // Ambra / Arancio
    riskBgColor = 'bg-amber-50 text-amber-800 border-amber-300';
    riskBorderColor = 'border-amber-500';
    riskBadgeLabel = 'Intervallo di Incertezza (Zona Arancione)';
    riskDescription = 'Intervallo di incertezza. È necessario procedere a monitoraggio approfondito o implementare misure preventive integrative per ricondurre il rischio a irrilevante.';
  } else if (criticalRisk >= 21 && criticalRisk <= 40) {
    riskLevel = 'superiore_irrilevante';
    riskColor = '#ef4444'; // Rosso
    riskBgColor = 'bg-rose-50 text-rose-800 border-rose-300';
    riskBorderColor = 'border-rose-500';
    riskBadgeLabel = 'Superiore al Rischio Irrilevante (Zona Rossa)';
    riskDescription = 'Rischio non irrilevante per la salute. Obbligo di applicazione delle misure specifiche di prevenzione e protezione ex art. 225 e sorveglianza sanitaria ex art. 229 D.Lgs. 81/08.';
  } else if (criticalRisk > 40 && criticalRisk <= 80) {
    riskLevel = 'elevato';
    riskColor = '#b91c1c'; // Rosso Scuro
    riskBgColor = 'bg-red-100 text-red-900 border-red-400';
    riskBorderColor = 'border-red-700';
    riskBadgeLabel = 'Zona di Rischio Elevato (Zona Rosso Scuro)';
    riskDescription = 'Zona di rischio chimico elevato. Richiede immediata rivalutazione delle misure tecniche di contenimento, aspirazione localizzata e DPI di III categoria.';
  } else if (criticalRisk > 80) {
    riskLevel = 'grave';
    riskColor = '#7c3aed'; // Viola scuro
    riskBgColor = 'bg-purple-100 text-purple-900 border-purple-400';
    riskBorderColor = 'border-purple-700';
    riskBadgeLabel = 'Zona di Grave Rischio (Zona Viola)';
    riskDescription = 'Zona di grave rischio per la salute dei lavoratori. È prioritario l\'intervento di bonifica tecnica, isolamento o sostituzione dell\'agente chimico.';
  }

  return {
    scoreP,
    scoreD,
    scoreU,
    scoreC,
    scoreI,
    distanceFactor,
    eInal,
    eCute,
    rInal,
    rCute,
    rCombined,
    criticalRisk,
    riskLevel,
    riskColor,
    riskBgColor,
    riskBorderColor,
    riskBadgeLabel,
    riskDescription
  };
}

/**
 * Crea un nuovo prodotto chimico con valori predefiniti
 */
export function createEmptyProduct(name = ''): ChemicalProduct {
  return {
    id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: name,
    producer: '',
    sdsDate: '',
    activity: '',
    homogeneousGroup: '',
    selectedHPhrases: [],
    customScoreP: '',
    tlvLimits: [],
    formaldehydeDonor: 'NO',
    healthPreventionsText: '',
    selectedDpiIds: [],
    physicalState: 'solido_nebbie',      // 1ª opzione: Solido / Nebbie / Liquido a bassissima volatilità
    quantity: 'lt_01',                  // 1ª opzione: Minore di 0,1 kg / giorno (< 100 g)
    useType: 'sistema_chiuso',          // 1ª opzione: Sistema Chiuso
    controlType: 'contenimento',        // 1ª opzione: Contenimento Completo
    exposureTime: 'lt_15m',             // 1ª opzione: < 15 minuti
    distance: 'lt_1m',                  // 1ª opzione: < 1 metro (d = 1,00)
    skinContactLevel: 'nessuno',        // 1ª opzione: Nessun Contatto
    hasInhalationRoute: true,
    hasSkinRoute: true,
    notes: ''
  };
}
