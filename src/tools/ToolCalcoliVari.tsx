import React, { useState, useEffect, useMemo } from 'react';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import { Scale, Ruler, Database, Wind, Printer, Waves, Clock, Droplet } from 'lucide-react';
import { BEAM_CATALOG } from '../data/beamCatalog';
import { PIPE_CATALOG, getExternalDiameter } from '../data/pipeCatalog';
import { formatNumber } from '../utils/format';

interface ToolCalcoliVariProps {
  projectData: ProjectData;
  setProjectData: (data: any) => void;
  setAppMode: (mode: string) => void;
}

interface CalcoliVariData {
  activeSubTool: 'conversione' | 'appoggi' | 'volume' | 'portata_sez_vel' | 'foronomia' | 'svuotamento' | 'pelo_libero' | 'travi';
  
  // Conversione U.M.
  convCategory: 'pressione' | 'temperatura' | 'portata' | 'lunghezza' | 'potenza' | 'superficie' | 'energia' | 'velocita' | 'volume' | 'densita' | 'accelerazione' | 'forza_massa' | 'angolo';
  convValSorgente: string;
  convUnitSorgente: string;
  convUnitDestinazione: string;
  
  // Distanza Appoggi
  appoggiMateriale: 'Acciaio' | 'Rame' | 'PVC' | 'PVC EN' | 'PE100' | 'PEAD' | 'PRFV' | 'Ghisa' | 'Cemento';
  appoggiUsaCatalog: boolean;
  appoggiDN: string;
  appoggiPN: string;
  appoggiDEst: string;
  appoggiSpessore: string;
  appoggiPFluido: string; // kg/m
  appoggiPIsolante: string; // kg/m
  appoggiLimiteFreccia: string; // mm
  
  // Volume Serbatoi
  volumeTipo: 'cilindrico' | 'sferico';
  volumeDiametro: string;
  volumeLunghezza: string;
  volumeAltezzaLiq: string;
  
  // Portata - Sezione - Velocità
  psvQ: string; // m3/h
  psvD: string; // mm
  psvV: string; // m/s

  // Foronomia
  foroTipo: 'circolare' | 'rettangolare' | 'tubo_interno' | 'tubo_esterno' | 'stramazzo_grossa' | 'stramazzo_sottile';
  fcQ: string; // m3/s
  fcH: string; // m
  fcD: string; // m
  
  frQ: string; // m3/s
  frH1: string; // m
  frH2: string; // m
  frB: string; // m
  
  sgQ: string; // m3/s
  sgB: string; // m
  sgH: string; // m
  
  ssQ: string; // m3/s
  ssB: string; // m
  ssH: string; // m (h)
  ssP: string; // m (p)

  // Svuotamento Serbatoio
  svTipo: 'cilindrico_vert' | 'cilindrico_oriz' | 'sferico';
  svD: string; // m
  svOrificeD: string; // d (m)
  svH: string; // H (m)
  svL: string; // L (m)
  svT: string; // T (s)

  // Condotte a pelo libero (Fase 3)
  plTipo: 'circolare' | 'rettangolare' | 'khafagi_venturi';
  plcD: string;      // diametro (m)
  plcGrado: string;  // grado riempimento (%)
  plcI: string;      // pendenza (m/m)
  plcKs: string;     // scabrezza Strickler
  plcQ: string;      // portata (m3/s)
  plrB: string;      // ruscello: larghezza canale b (m)
  plrH: string;      // ruscello: altezza battente h (m)
  plrI: string;      // ruscello: pendenza p (m/m)
  plrC: string;      // ruscello: scabrezza Bazin c
  plrQ: string;      // ruscello: portata Q (m3/s)
  pkvB: string;      // larghezza (m)
  pkvH: string;      // altezza misurata (m)
  pkvQ: string;      // portata (m3/s)

  // Dimensionamento Travi (Fase 4)
  traviTipo: 'incastrata_concentrato' | 'appoggiata_concentrato' | 'doppio_incastrata_concentrato' | 'incastrata_distribuito' | 'appoggiata_distribuito' | 'doppio_incastrata_distribuito';
  traviL: string;    // lunghezza trave L (m)
  traviL1: string;   // distanza carico L1 (m)
  traviP: string;    // carico concentrato P (kg)
  traviq: string;    // carico distribuito q (kg/m)
  traviSigma: string; // tensione ammissibile (kg/cm2)
}

const defaultData: CalcoliVariData = {
  activeSubTool: 'conversione',
  
  convCategory: 'pressione',
  convValSorgente: '1',
  convUnitSorgente: 'bar',
  convUnitDestinazione: 'kPa',
  
  appoggiMateriale: 'Acciaio',
  appoggiUsaCatalog: true,
  appoggiDN: '100',
  appoggiPN: 'NORM',
  appoggiDEst: '114.3',
  appoggiSpessore: '3.6',
  appoggiPFluido: '0',
  appoggiPIsolante: '0',
  appoggiLimiteFreccia: '2.5',
  
  volumeTipo: 'cilindrico',
  volumeDiametro: '',
  volumeLunghezza: '',
  volumeAltezzaLiq: '',
  
  psvQ: '',
  psvD: '',
  psvV: '',

  // Foronomia default
  foroTipo: 'circolare',
  fcQ: '',
  fcH: '',
  fcD: '',
  
  frQ: '',
  frH1: '',
  frH2: '',
  frB: '',
  
  sgQ: '',
  sgB: '',
  sgH: '',
  
  ssQ: '',
  ssB: '',
  ssH: '',
  ssP: '',

  // Svuotamento default
  svTipo: 'cilindrico_vert',
  svD: '',
  svOrificeD: '',
  svH: '',
  svL: '',
  svT: '',

  // Condotte a pelo libero default
  plTipo: 'circolare',
  plcD: '',
  plcGrado: '50',
  plcI: '0.01',
  plcKs: '70',
  plcQ: '',
  plrB: '',
  plrH: '',
  plrI: '0.01',
  plrC: '0.30',
  plrQ: '',
  pkvB: '',
  pkvH: '',
  pkvQ: '',

  // Dimensionamento Travi default
  traviTipo: 'incastrata_concentrato',
  traviL: '',
  traviL1: '',
  traviP: '',
  traviq: '',
  traviSigma: '1600'
};

// Coefficienti per le conversioni (valori normalizzati rispetto all'unità base)
const UNITS_FACTORS = {
  pressione: {
    base: 'Pa',
    factors: {
      Pa: 1,
      kPa: 1000,
      MPa: 1000000,
      bar: 100000,
      mbar: 100,
      atm: 101325,
      mH2O: 9806.65,
      psi: 6894.757
    }
  },
  portata: {
    base: 'm3_s',
    factors: {
      m3_s: 1,
      m3_h: 1 / 3600,
      l_min: 1 / 60000,
      l_s: 0.001,
      gpm: 0.0000630901964
    }
  },
  lunghezza: {
    base: 'm',
    factors: {
      m: 1,
      mm: 0.001,
      cm: 0.01,
      km: 1000,
      in: 0.0254,
      ft: 0.3048,
      yd: 0.9144,
      mi: 1609.344
    }
  },
  potenza: {
    base: 'W',
    factors: {
      W: 1,
      kW: 1000,
      MW: 1000000,
      cv: 735.49875,
      hp: 745.69987,
      kcal_h: 1.163,
      btu_h: 0.293071
    }
  },
  superficie: {
    base: 'm2',
    factors: {
      m2: 1,
      mm2: 0.000001,
      cm2: 0.0001,
      km2: 1000000,
      he: 10000,
      are: 100,
      in2: 0.00064516,
      ft2: 0.09290304,
      ac: 4046.8564224
    }
  },
  energia: {
    base: 'J',
    factors: {
      J: 1,
      kJ: 1000,
      MJ: 1000000,
      GJ: 1000000000,
      cal: 4.1868,
      kcal: 4186.8,
      Wh: 3600,
      kWh: 3600000,
      MWh: 3600000000,
      btu: 1055.056,
      kgm: 9.80665
    }
  },
  velocita: {
    base: 'm_s',
    factors: {
      m_s: 1,
      km_h: 1 / 3.6,
      mph: 0.44704,
      kn: 0.514444,
      ft_s: 0.3048
    }
  },
  volume: {
    base: 'm3',
    factors: {
      m3: 1,
      dm3: 0.001,
      cm3: 0.000001,
      mm3: 0.000000001,
      in3: 0.000016387064,
      ft3: 0.028316846592,
      gal_us: 0.003785411784,
      gal_uk: 0.00454609
    }
  },
  densita: {
    base: 'kg_m3',
    factors: {
      kg_m3: 1,
      g_cm3: 1000,
      lb_ft3: 16.018463,
      lb_in3: 27679.904
    }
  },
  accelerazione: {
    base: 'm_s2',
    factors: {
      m_s2: 1,
      g: 9.80665,
      cm_s2: 0.01,
      ft_s2: 0.3048
    }
  },
  forza_massa: {
    base: 'N',
    factors: {
      N: 1,
      kN: 1000,
      daN: 10,
      kgf: 9.80665,
      t: 9806.65,
      g: 0.00980665,
      lbf: 4.448222,
      oz: 0.2780139
    }
  },
  angolo: {
    base: 'rad',
    factors: {
      rad: 1,
      deg: Math.PI / 180,
      grad: Math.PI / 200,
      arcmin: Math.PI / 10800,
      arcsec: Math.PI / 648000
    }
  }
};

const CATEGORY_LABELS: Record<string, string> = {
  pressione: 'Pressione',
  temperatura: 'Temperatura',
  portata: 'Portata',
  lunghezza: 'Lunghezza',
  potenza: 'Potenza',
  superficie: 'Superficie',
  energia: 'Energia',
  velocita: 'Velocità',
  volume: 'Volume',
  densita: 'Densità',
  accelerazione: 'Accelerazione',
  forza_massa: 'Forza · Massa',
  angolo: 'Angolo'
};

const MATERIAL_PROPERTIES = {
  'Acciaio': { name: 'Acciaio', E: 210000, sigma: 140, rho: 7850 },
  'Rame': { name: 'Rame', E: 132000, sigma: 70, rho: 8960 },
  'PVC': { name: 'PVC', E: 3000, sigma: 10, rho: 1400 },
  'PVC EN': { name: 'PVC EN', E: 3000, sigma: 10, rho: 1400 },
  'PE100': { name: 'PE100 (PE-HD)', E: 1000, sigma: 5.0, rho: 950 },
  'PEAD': { name: 'PEAD', E: 900, sigma: 4.5, rho: 950 },
  'PRFV': { name: 'PRFV (Vetroresina)', E: 20000, sigma: 50, rho: 1800 },
  'Ghisa': { name: 'Ghisa', E: 100000, sigma: 120, rho: 7200 },
  'Cemento': { name: 'Cemento', E: 30000, sigma: 2.0, rho: 2400 }
};

export function ToolCalcoliVari({ projectData, setProjectData, setAppMode }: ToolCalcoliVariProps) {
  const [data, setData] = useState<CalcoliVariData>(defaultData);

  const traviLVal = parseFloat(data.traviL) || 0;
  const traviL1Val = parseFloat(data.traviL1) || 0;
  const traviPVal = parseFloat(data.traviP) || 0;
  const traviqVal = parseFloat(data.traviq) || 0;
  const traviSigmaVal = parseFloat(data.traviSigma) || 1600;

  const handleLoadProject = (loadedData: any) => {
    if (loadedData) {
      setData({ ...defaultData, ...loadedData });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const updateField = (field: keyof CalcoliVariData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  // 1. Logica Conversione Unità di Misura
  const conversionResult = useMemo(() => {
    const val = parseFloat(data.convValSorgente);
    if (isNaN(val)) return 0;
    
    const cat = data.convCategory;
    const fromUnit = data.convUnitSorgente;
    const toUnit = data.convUnitDestinazione;
    
    if (cat === 'temperatura') {
      // Conversione manuale temperatura
      if (fromUnit === toUnit) return val;
      let tempC = val;
      if (fromUnit === 'F') tempC = (val - 32) / 1.8;
      if (fromUnit === 'K') tempC = val - 273.15;
      
      if (toUnit === 'C') return tempC;
      if (toUnit === 'F') return tempC * 1.8 + 32;
      if (toUnit === 'K') return tempC + 273.15;
      return 0;
    }
    
    // Altre categorie con coefficienti lineari
    const catData = UNITS_FACTORS[cat as keyof typeof UNITS_FACTORS];
    if (!catData) return 0;
    
    const factorFrom = catData.factors[fromUnit as keyof typeof catData.factors] || 1;
    const factorTo = catData.factors[toUnit as keyof typeof catData.factors] || 1;
    
    // Converti in unità base poi in destinazione
    const valBase = val * factorFrom;
    return valBase / factorTo;
  }, [data.convCategory, data.convValSorgente, data.convUnitSorgente, data.convUnitDestinazione]);

  // Reset delle unità di misura al cambio di categoria
  useEffect(() => {
    if (data.convCategory === 'pressione') {
      setData(prev => ({ ...prev, convUnitSorgente: 'bar', convUnitDestinazione: 'kPa' }));
    } else if (data.convCategory === 'temperatura') {
      setData(prev => ({ ...prev, convUnitSorgente: 'C', convUnitDestinazione: 'F' }));
    } else if (data.convCategory === 'portata') {
      setData(prev => ({ ...prev, convUnitSorgente: 'm3_h', convUnitDestinazione: 'l_s' }));
    } else if (data.convCategory === 'lunghezza') {
      setData(prev => ({ ...prev, convUnitSorgente: 'm', convUnitDestinazione: 'in' }));
    } else if (data.convCategory === 'potenza') {
      setData(prev => ({ ...prev, convUnitSorgente: 'kW', convUnitDestinazione: 'cv' }));
    } else if (data.convCategory === 'superficie') {
      setData(prev => ({ ...prev, convUnitSorgente: 'm2', convUnitDestinazione: 'cm2' }));
    } else if (data.convCategory === 'energia') {
      setData(prev => ({ ...prev, convUnitSorgente: 'kJ', convUnitDestinazione: 'kcal' }));
    } else if (data.convCategory === 'velocita') {
      setData(prev => ({ ...prev, convUnitSorgente: 'm_s', convUnitDestinazione: 'km_h' }));
    } else if (data.convCategory === 'volume') {
      setData(prev => ({ ...prev, convUnitSorgente: 'm3', convUnitDestinazione: 'dm3' }));
    } else if (data.convCategory === 'densita') {
      setData(prev => ({ ...prev, convUnitSorgente: 'kg_m3', convUnitDestinazione: 'g_cm3' }));
    } else if (data.convCategory === 'accelerazione') {
      setData(prev => ({ ...prev, convUnitSorgente: 'm_s2', convUnitDestinazione: 'g' }));
    } else if (data.convCategory === 'forza_massa') {
      setData(prev => ({ ...prev, convUnitSorgente: 'kgf', convUnitDestinazione: 'N' }));
    } else if (data.convCategory === 'angolo') {
      setData(prev => ({ ...prev, convUnitSorgente: 'deg', convUnitDestinazione: 'rad' }));
    }
  }, [data.convCategory]);

  // 2. Logica Calcolo Distanza Appoggi
  const appoggiResults = useMemo(() => {
    const mat = MATERIAL_PROPERTIES[data.appoggiMateriale];
    const dEst = parseFloat(data.appoggiDEst) || 0;
    const spessore = parseFloat(data.appoggiSpessore) || 0;
    const pFluido = parseFloat(data.appoggiPFluido) || 0;
    const pIsolante = parseFloat(data.appoggiPIsolante) || 0;
    const limFreccia = parseFloat(data.appoggiLimiteFreccia) || 2.5;
    
    if (dEst <= 0 || spessore <= 0 || dEst <= 2 * spessore) {
      return { distTensione: 0, distFreccia: 0, distConsigliata: 0, pesoTubo: 0, pesoTot: 0 };
    }
    
    // Raggi in metri
    const rEst = dEst / 2 / 1000;
    const rInt = (dEst - 2 * spessore) / 2 / 1000;
    
    // Area del metallo in m2
    const areaMetallo = Math.PI * (Math.pow(rEst, 2) - Math.pow(rInt, 2));
    const pesoTubo = areaMetallo * mat.rho; // kg/m
    const pesoTotMass = pesoTubo + pFluido + pIsolante; // kg/m
    const caricoTotLinear = pesoTotMass * 9.80665; // N/m
    
    // Momento di inerzia I (m4) e Modulo di resistenza Z (m3)
    const I = (Math.PI / 64) * (Math.pow(dEst/1000, 4) - Math.pow((dEst - 2 * spessore)/1000, 4));
    const Z = (Math.PI / 32) * ((Math.pow(dEst/1000, 4) - Math.pow((dEst - 2 * spessore)/1000, 4)) / (dEst/1000));
    
    // Distanza massima per sforzo di flessione (Tensione ammessa in Pa = mat.sigma * 1e6)
    const sigmaPa = mat.sigma * 1000000;
    const distTensione = Math.sqrt((8 * sigmaPa * Z) / caricoTotLinear);
    
    // Distanza massima per freccia elastica (E in Pa = mat.E * 1e6)
    const EPa = mat.E * 1000000;
    const yMax = limFreccia / 1000; // in metri
    const distFreccia = Math.pow((384 * EPa * I * yMax) / (5 * caricoTotLinear), 0.25);
    
    const distConsigliata = Math.min(distTensione, distFreccia);
    
    return {
      distTensione,
      distFreccia,
      distConsigliata,
      pesoTubo,
      pesoTot: pesoTotMass
    };
  }, [data.appoggiMateriale, data.appoggiDEst, data.appoggiSpessore, data.appoggiPFluido, data.appoggiPIsolante, data.appoggiLimiteFreccia]);

  // 3. Logica Calcolo Volume Serbatoio
  const volumeResult = useMemo(() => {
    const diametro = parseFloat(data.volumeDiametro) || 0;
    const altezzaLiq = parseFloat(data.volumeAltezzaLiq) || 0;
    const lunghezza = parseFloat(data.volumeLunghezza) || 0;
    
    if (diametro <= 0 || altezzaLiq <= 0) return { volumeM3: 0, volumeLitri: 0, volumePerc: 0 };
    
    const r = diametro / 2;
    const h = Math.min(altezzaLiq, diametro); // cap al diametro massimo
    
    let volM3 = 0;
    let capTotM3 = 0;
    
    if (data.volumeTipo === 'cilindrico') {
      if (lunghezza <= 0) return { volumeM3: 0, volumeLitri: 0, volumePerc: 0 };
      capTotM3 = Math.PI * Math.pow(r, 2) * lunghezza;
      
      if (h >= diametro) {
        volM3 = capTotM3;
      } else {
        const theta = 2 * Math.acos((r - h) / r);
        const areaSeg = 0.5 * Math.pow(r, 2) * (theta - Math.sin(theta));
        volM3 = areaSeg * lunghezza;
      }
    } else {
      // Sferico
      capTotM3 = (4 / 3) * Math.PI * Math.pow(r, 3);
      if (h >= diametro) {
        volM3 = capTotM3;
      } else {
        volM3 = (Math.PI * Math.pow(h, 2) * (3 * r - h)) / 3;
      }
    }
    
    const volumeLitri = volM3 * 1000;
    const volumePerc = (volM3 / capTotM3) * 100;
    
    return {
      volumeM3: volM3,
      volumeLitri,
      volumePerc
    };
  }, [data.volumeTipo, data.volumeDiametro, data.volumeLunghezza, data.volumeAltezzaLiq]);

  // 4. Logica Portata - Sezione - Velocità (Incognita Libera)
  const psvResults = useMemo(() => {
    const qStr = data.psvQ.trim();
    const dStr = data.psvD.trim();
    const vStr = data.psvV.trim();
    
    let qVal = parseFloat(qStr) || 0;
    let dVal = parseFloat(dStr) || 0;
    let vVal = parseFloat(vStr) || 0;
    
    const countEmpty = (qStr === '' ? 1 : 0) + (dStr === '' ? 1 : 0) + (vStr === '' ? 1 : 0);
    
    let computedQ = qVal;
    let computedD = dVal;
    let computedV = vVal;
    let activeIncognita: 'Q' | 'd' | 'v' | 'invalid' = 'invalid';
    
    if (countEmpty === 1) {
      if (qStr === '') {
        activeIncognita = 'Q';
        computedQ = vVal * Math.pow(dVal, 2) * 0.002827433;
      } else if (dStr === '') {
        activeIncognita = 'd';
        if (vVal > 0) {
          computedD = Math.sqrt(qVal / (vVal * 0.002827433));
        }
      } else if (vStr === '') {
        activeIncognita = 'v';
        if (dVal > 0) {
          computedV = qVal / (Math.pow(dVal, 2) * 0.002827433);
        }
      }
    }
    
    return {
      computedQ,
      computedD,
      computedV,
      activeIncognita
    };
  }, [data.psvQ, data.psvD, data.psvV]);

  // 5. Logica Foronomia (Fase 2)
  const foronomiaResults = useMemo(() => {
    const g = 9.806;
    let mu = 0.61;
    let cv = 0.98;

    if (data.foroTipo === 'tubo_interno') {
      mu = 0.50;
      cv = 0.98;
    } else if (data.foroTipo === 'tubo_esterno') {
      mu = 0.82;
      cv = 0.82;
    }

    // --- CIRCOLARE / TUBI ADDIZIONALI ---
    const fcQVal = parseFloat(data.fcQ) || 0;
    const fcHVal = parseFloat(data.fcH) || 0;
    const fcDVal = parseFloat(data.fcD) || 0;
    
    let computedFcQ = fcQVal;
    let computedFcD = fcDVal;
    let computedFcH = fcHVal;
    let computedFcV = 0;
    let fcIncognita: 'Q' | 'D' | 'h' | 'invalid' = 'invalid';
    
    if (data.foroTipo === 'circolare' || data.foroTipo === 'tubo_interno' || data.foroTipo === 'tubo_esterno') {
      const qStr = data.fcQ.trim();
      const hStr = data.fcH.trim();
      const dStr = data.fcD.trim();
      const countEmpty = (qStr === '' ? 1 : 0) + (hStr === '' ? 1 : 0) + (dStr === '' ? 1 : 0);
      
      if (countEmpty === 1) {
        if (qStr === '') {
          fcIncognita = 'Q';
          if (fcHVal >= 0 && fcDVal > 0) {
            const area = (Math.PI * Math.pow(fcDVal, 2)) / 4;
            computedFcQ = mu * area * Math.sqrt(2 * g * fcHVal);
          }
        } else if (dStr === '') {
          fcIncognita = 'D';
          if (fcHVal > 0 && fcQVal > 0) {
            const term = (4 * fcQVal) / (mu * Math.PI * Math.sqrt(2 * g * fcHVal));
            if (term >= 0) computedFcD = Math.sqrt(term);
          }
        } else if (hStr === '') {
          fcIncognita = 'h';
          if (fcQVal > 0 && fcDVal > 0) {
            const area = (Math.PI * Math.pow(fcDVal, 2)) / 4;
            computedFcH = Math.pow(fcQVal / (mu * area), 2) / (2 * g);
          }
        }
      }
      computedFcV = cv * Math.sqrt(2 * g * computedFcH);
    }

    // --- RETTANGOLARE ---
    const frQVal = parseFloat(data.frQ) || 0;
    const frH1Val = parseFloat(data.frH1) || 0;
    const frH2Val = parseFloat(data.frH2) || 0;
    const frBVal = parseFloat(data.frB) || 0;
    
    let computedFrQ = frQVal;
    let computedFrB = frBVal;
    let computedFrH1 = frH1Val;
    let computedFrH2 = frH2Val;
    let frIncognita: 'Q' | 'b' | 'h1' | 'h2' | 'invalid' = 'invalid';
    
    if (data.foroTipo === 'rettangolare') {
      const qStr = data.frQ.trim();
      const h1Str = data.frH1.trim();
      const h2Str = data.frH2.trim();
      const bStr = data.frB.trim();
      const countEmpty = (qStr === '' ? 1 : 0) + (h1Str === '' ? 1 : 0) + (h2Str === '' ? 1 : 0) + (bStr === '' ? 1 : 0);
      
      if (countEmpty === 1) {
        if (qStr === '') {
          frIncognita = 'Q';
          if (frBVal > 0 && frH2Val >= frH1Val && frH1Val >= 0) {
            computedFrQ = mu * (2 / 3) * frBVal * Math.sqrt(2 * g) * (Math.pow(frH2Val, 1.5) - Math.pow(frH1Val, 1.5));
          }
        } else if (bStr === '') {
          frIncognita = 'b';
          const diff = Math.pow(frH2Val, 1.5) - Math.pow(frH1Val, 1.5);
          if (diff > 0 && frQVal > 0) {
            computedFrB = frQVal / (mu * (2 / 3) * Math.sqrt(2 * g) * diff);
          }
        } else if (h1Str === '') {
          frIncognita = 'h1';
          if (frBVal > 0 && frQVal > 0 && frH2Val > 0) {
            const val = Math.pow(frH2Val, 1.5) - frQVal / (mu * (2 / 3) * frBVal * Math.sqrt(2 * g));
            if (val >= 0) {
              computedFrH1 = Math.pow(val, 1 / 1.5);
            } else {
              frIncognita = 'invalid';
            }
          }
        } else if (h2Str === '') {
          frIncognita = 'h2';
          if (frBVal > 0 && frQVal > 0 && frH1Val >= 0) {
            const val = Math.pow(frH1Val, 1.5) + frQVal / (mu * (2 / 3) * frBVal * Math.sqrt(2 * g));
            computedFrH2 = Math.pow(val, 1 / 1.5);
          }
        }
      }
    }

    // --- STRAMAZZO PARETE GROSSA ---
    const sgQVal = parseFloat(data.sgQ) || 0;
    const sgBVal = parseFloat(data.sgB) || 0;
    const sgHVal = parseFloat(data.sgH) || 0;
    
    let computedSgQ = sgQVal;
    let computedSgB = sgBVal;
    let computedSgH = sgHVal;
    let computedSgHv = 0;
    let sgIncognita: 'Q' | 'b' | 'H' | 'invalid' = 'invalid';
    
    if (data.foroTipo === 'stramazzo_grossa') {
      const qStr = data.sgQ.trim();
      const bStr = data.sgB.trim();
      const hStr = data.sgH.trim();
      const countEmpty = (qStr === '' ? 1 : 0) + (bStr === '' ? 1 : 0) + (hStr === '' ? 1 : 0);
      
      if (countEmpty === 1) {
        if (qStr === '') {
          sgIncognita = 'Q';
          if (sgBVal > 0 && sgHVal > 0) {
            computedSgQ = 1.705 * sgBVal * Math.pow(sgHVal, 1.5);
          }
        } else if (bStr === '') {
          sgIncognita = 'b';
          if (sgHVal > 0 && sgQVal > 0) {
            computedSgB = sgQVal / (1.705 * Math.pow(sgHVal, 1.5));
          }
        } else if (hStr === '') {
          sgIncognita = 'H';
          if (sgBVal > 0 && sgQVal > 0) {
            computedSgH = Math.pow(sgQVal / (1.705 * sgBVal), 2 / 3);
          }
        }
      }
      computedSgHv = (2 / 3) * computedSgH;
    }

    // --- STRAMAZZO PARETE SOTTILE (BAZIN) ---
    const ssQVal = parseFloat(data.ssQ) || 0;
    const ssBVal = parseFloat(data.ssB) || 0;
    const ssHVal = parseFloat(data.ssH) || 0;
    const ssPVal = parseFloat(data.ssP) || 0;
    
    let computedSsQ = ssQVal;
    let computedSsB = ssBVal;
    let ssIncognita: 'Q' | 'b' | 'invalid' = 'invalid';
    let computedSsMu = 0;
    
    if (data.foroTipo === 'stramazzo_sottile') {
      const qStr = data.ssQ.trim();
      const bStr = data.ssB.trim();
      const countEmpty = (qStr === '' ? 1 : 0) + (bStr === '' ? 1 : 0);
      
      if (!isNaN(ssHVal) && ssHVal > 0 && !isNaN(ssPVal) && ssPVal > 0) {
        const totalH = ssHVal + ssPVal;
        computedSsMu = (0.405 + 0.003 / ssHVal) * (1 + 0.55 * Math.pow(ssHVal, 2) / Math.pow(totalH, 2));
        
        if (countEmpty === 1) {
          if (qStr === '') {
            ssIncognita = 'Q';
            if (ssBVal > 0) {
              computedSsQ = computedSsMu * ssBVal * Math.sqrt(2 * g) * Math.pow(ssHVal, 1.5);
            }
          } else if (bStr === '') {
            ssIncognita = 'b';
            if (ssQVal > 0) {
              computedSsB = ssQVal / (computedSsMu * Math.sqrt(2 * g) * Math.pow(ssHVal, 1.5));
            }
          }
        }
      }
    }

    return {
      computedFcQ, computedFcD, computedFcH, computedFcV, fcIncognita,
      computedFrQ, computedFrB, computedFrH1, computedFrH2, frIncognita,
      computedSgQ, computedSgB, computedSgH, computedSgHv, sgIncognita,
      computedSsQ, computedSsB, ssIncognita, computedSsMu
    };
  }, [data.foroTipo, data.fcQ, data.fcH, data.fcD, data.frQ, data.frH1, data.frH2, data.frB, data.sgQ, data.sgB, data.sgH, data.ssQ, data.ssB, data.ssH, data.ssP]);

  // 6. Logica Svuotamento Serbatoio (Fase 2)
  const svuotamentoResults = useMemo(() => {
    const C = 0.553114;
    const svDVal = parseFloat(data.svD) || 0;
    const svOrificeDVal = parseFloat(data.svOrificeD) || 0;
    const svHVal = parseFloat(data.svH) || 0;
    const svLVal = parseFloat(data.svL) || 0;
    const svTVal = parseFloat(data.svT) || 0;
    
    let computedD = svDVal;
    let computedOrificeD = svOrificeDVal;
    let computedH = svHVal;
    let computedL = svLVal;
    let computedT = svTVal;
    let svIncognita: 'D' | 'd' | 'H' | 'L' | 'T' | 'invalid' = 'invalid';
    
    const dStr = data.svD.trim();
    const orificeDStr = data.svOrificeD.trim();
    const hStr = data.svH.trim();
    const lStr = data.svL.trim();
    const tStr = data.svT.trim();
    
    if (data.svTipo === 'cilindrico_vert') {
      const countEmpty = (dStr === '' ? 1 : 0) + (orificeDStr === '' ? 1 : 0) + (hStr === '' ? 1 : 0) + (tStr === '' ? 1 : 0);
      if (countEmpty === 1) {
        if (tStr === '') {
          svIncognita = 'T';
          if (svOrificeDVal > 0 && svDVal > 0 && svHVal >= 0) {
            computedT = C * (Math.pow(svDVal, 2) * Math.sqrt(svHVal)) / Math.pow(svOrificeDVal, 2);
          }
        } else if (dStr === '') {
          svIncognita = 'D';
          if (svOrificeDVal > 0 && svTVal > 0 && svHVal > 0) {
            computedD = svOrificeDVal * Math.sqrt(svTVal / (C * Math.sqrt(svHVal)));
          }
        } else if (orificeDStr === '') {
          svIncognita = 'd';
          if (svDVal > 0 && svTVal > 0 && svHVal > 0) {
            computedOrificeD = svDVal * Math.sqrt((C * Math.sqrt(svHVal)) / svTVal);
          }
        } else if (hStr === '') {
          svIncognita = 'H';
          if (svDVal > 0 && svOrificeDVal > 0 && svTVal > 0) {
            computedH = Math.pow((svTVal * Math.pow(svOrificeDVal, 2)) / (C * Math.pow(svDVal, 2)), 2);
          }
        }
      }
    } else if (data.svTipo === 'sferico') {
      const countEmpty = (dStr === '' ? 1 : 0) + (orificeDStr === '' ? 1 : 0) + (hStr === '' ? 1 : 0) + (tStr === '' ? 1 : 0);
      if (countEmpty === 1) {
        if (tStr === '') {
          svIncognita = 'T';
          if (svOrificeDVal > 0 && svDVal > 0 && svHVal >= 0) {
            computedT = (2 * C * Math.pow(svHVal, 1.5) / Math.pow(svOrificeDVal, 2)) * ((2 / 3) * svDVal - (2 / 5) * svHVal);
          }
        } else if (dStr === '') {
          svIncognita = 'D';
          if (svOrificeDVal > 0 && svTVal > 0 && svHVal > 0) {
            computedD = 0.6 * svHVal + (0.75 * svTVal * Math.pow(svOrificeDVal, 2)) / (C * Math.pow(svHVal, 1.5));
          }
        } else if (orificeDStr === '') {
          svIncognita = 'd';
          if (svDVal > 0 && svTVal > 0 && svHVal > 0) {
            const term = (2 * C * Math.pow(svHVal, 1.5) / svTVal) * ((2 / 3) * svDVal - (2 / 5) * svHVal);
            if (term >= 0) computedOrificeD = Math.sqrt(term);
          }
        } else if (hStr === '') {
          svIncognita = 'H';
          if (svDVal > 0 && svOrificeDVal > 0 && svTVal > 0) {
            let low = 0.0001;
            let high = svDVal;
            const target = svTVal * Math.pow(svOrificeDVal, 2) / (2 * C);
            const f = (val: number) => Math.pow(val, 1.5) * ((2 / 3) * svDVal - (2 / 5) * val) - target;
            if (f(low) * f(high) <= 0) {
              for (let i = 0; i < 50; i++) {
                const mid = (low + high) / 2;
                if (f(mid) > 0) {
                  high = mid;
                } else {
                  low = mid;
                }
              }
              computedH = (low + high) / 2;
            } else {
              svIncognita = 'invalid';
            }
          }
        }
      }
    } else if (data.svTipo === 'cilindrico_oriz') {
      const countEmpty = (dStr === '' ? 1 : 0) + (orificeDStr === '' ? 1 : 0) + (hStr === '' ? 1 : 0) + (lStr === '' ? 1 : 0) + (tStr === '' ? 1 : 0);
      if (countEmpty === 1) {
        if (tStr === '') {
          svIncognita = 'T';
          if (svOrificeDVal > 0 && svDVal > 0 && svHVal >= 0 && svLVal > 0) {
            const term = Math.pow(svDVal, 1.5) - Math.pow(svDVal - svHVal, 1.5);
            computedT = (8 * C * svLVal * term) / (3 * Math.PI * Math.pow(svOrificeDVal, 2));
          }
        } else if (lStr === '') {
          svIncognita = 'L';
          if (svOrificeDVal > 0 && svDVal > 0 && svHVal >= 0 && svTVal > 0) {
            const term = Math.pow(svDVal, 1.5) - Math.pow(svDVal - svHVal, 1.5);
            if (term > 0) {
              computedL = (3 * Math.PI * Math.pow(svOrificeDVal, 2) * svTVal) / (8 * C * term);
            }
          }
        } else if (orificeDStr === '') {
          svIncognita = 'd';
          if (svDVal > 0 && svHVal >= 0 && svLVal > 0 && svTVal > 0) {
            const term = Math.pow(svDVal, 1.5) - Math.pow(svDVal - svHVal, 1.5);
            const val = (8 * C * svLVal * term) / (3 * Math.PI * svTVal);
            if (val >= 0) computedOrificeD = Math.sqrt(val);
          }
        } else if (hStr === '') {
          svIncognita = 'H';
          if (svDVal > 0 && svOrificeDVal > 0 && svLVal > 0 && svTVal > 0) {
            const factor = (3 * Math.PI * Math.pow(svOrificeDVal, 2) * svTVal) / (8 * C * svLVal);
            const val = Math.pow(svDVal, 1.5) - factor;
            if (val >= 0) {
              computedH = svDVal - Math.pow(val, 2 / 3);
            } else {
              svIncognita = 'invalid';
            }
          }
        } else if (dStr === '') {
          svIncognita = 'D';
          if (svOrificeDVal > 0 && svHVal > 0 && svLVal > 0 && svTVal > 0) {
            let low = svHVal;
            let high = 100 * svHVal;
            const target = (3 * Math.PI * Math.pow(svOrificeDVal, 2) * svTVal) / (8 * C * svLVal);
            const f = (val: number) => Math.pow(val, 1.5) - Math.pow(val - svHVal, 1.5) - target;
            if (f(low) * f(high) <= 0) {
              for (let i = 0; i < 50; i++) {
                const mid = (low + high) / 2;
                if (f(mid) > 0) {
                  high = mid;
                } else {
                  low = mid;
                }
              }
              computedD = (low + high) / 2;
            } else {
              svIncognita = 'invalid';
            }
          }
        }
      }
    }
    
    return {
      computedD,
      computedOrificeD,
      computedH,
      computedL,
      computedT,
      svIncognita
    };
  }, [data.svTipo, data.svD, data.svOrificeD, data.svH, data.svL, data.svT]);

  // 7. Logica Condotte a Pelo Libero (Fase 3)
  const peloLiberoResults = useMemo(() => {
    // --- CIRCOLARE ---
    const plcDVal = parseFloat(data.plcD) || 0;
    const plcGradoVal = parseFloat(data.plcGrado) || 0;
    const plcIVal = parseFloat(data.plcI) || 0;
    const plcKsVal = parseFloat(data.plcKs) || 0;
    const plcQVal = parseFloat(data.plcQ) || 0;

    let computedPlcD = plcDVal;
    let computedPlcGrado = plcGradoVal;
    let computedPlcI = plcIVal;
    let computedPlcKs = plcKsVal;
    let computedPlcQ = plcQVal;
    let computedPlcV = 0;
    let plcIncognita: 'Q' | 'D' | 'grado' | 'i' | 'Ks' | 'invalid' = 'invalid';
    let plcErrorMessage = '';

    const getAlpha = (g: number) => Math.acos(1 - g / 50);
    const getAreaFact = (g: number) => {
      const a = getAlpha(g);
      return (2 * a - Math.sin(2 * a)) / 8;
    };
    const getRhFact = (g: number) => {
      const a = getAlpha(g);
      return (2 * a - Math.sin(2 * a)) / (8 * a);
    };

    if (data.plTipo === 'circolare') {
      const dStr = data.plcD.trim();
      const gradoStr = data.plcGrado.trim();
      const iStr = data.plcI.trim();
      const ksStr = data.plcKs.trim();
      const qStr = data.plcQ.trim();
      const countEmpty = (dStr === '' ? 1 : 0) + (gradoStr === '' ? 1 : 0) + (iStr === '' ? 1 : 0) + (ksStr === '' ? 1 : 0) + (qStr === '' ? 1 : 0);

      if (countEmpty === 1) {
        if (qStr === '') {
          plcIncognita = 'Q';
          if (plcDVal > 0 && plcGradoVal > 0 && plcGradoVal <= 100 && plcIVal > 0 && plcKsVal > 0) {
            const a = getAlpha(plcGradoVal);
            const area = (Math.pow(plcDVal, 2) / 8) * (2 * a - Math.sin(2 * a));
            const perimeter = plcDVal * a;
            const Rh = area / perimeter;
            computedPlcQ = plcKsVal * Math.pow(Rh, 2/3) * Math.pow(plcIVal, 0.5) * area;
            computedPlcV = plcKsVal * Math.pow(Rh, 2/3) * Math.pow(plcIVal, 0.5);
          } else {
            plcErrorMessage = 'Verificare che tutti gli input siano maggiori di zero e il grado sia <= 100%';
            plcIncognita = 'invalid';
          }
        } else if (ksStr === '') {
          plcIncognita = 'Ks';
          if (plcDVal > 0 && plcGradoVal > 0 && plcGradoVal <= 100 && plcIVal > 0 && plcQVal > 0) {
            const a = getAlpha(plcGradoVal);
            const area = (Math.pow(plcDVal, 2) / 8) * (2 * a - Math.sin(2 * a));
            const perimeter = plcDVal * a;
            const Rh = area / perimeter;
            computedPlcKs = plcQVal / (Math.pow(Rh, 2/3) * Math.pow(plcIVal, 0.5) * area);
            computedPlcV = computedPlcKs * Math.pow(Rh, 2/3) * Math.pow(plcIVal, 0.5);
          } else {
            plcErrorMessage = 'Verificare che tutti gli input siano maggiori di zero e il grado sia <= 100%';
            plcIncognita = 'invalid';
          }
        } else if (iStr === '') {
          plcIncognita = 'i';
          if (plcDVal > 0 && plcGradoVal > 0 && plcGradoVal <= 100 && plcKsVal > 0 && plcQVal > 0) {
            const a = getAlpha(plcGradoVal);
            const area = (Math.pow(plcDVal, 2) / 8) * (2 * a - Math.sin(2 * a));
            const perimeter = plcDVal * a;
            const Rh = area / perimeter;
            computedPlcI = Math.pow(plcQVal / (plcKsVal * Math.pow(Rh, 2/3) * area), 2);
            computedPlcV = plcKsVal * Math.pow(Rh, 2/3) * Math.pow(computedPlcI, 0.5);
          } else {
            plcErrorMessage = 'Verificare che tutti gli input siano maggiori di zero e il grado sia <= 100%';
            plcIncognita = 'invalid';
          }
        } else if (dStr === '') {
          plcIncognita = 'D';
          if (plcGradoVal > 0 && plcGradoVal <= 100 && plcIVal > 0 && plcKsVal > 0 && plcQVal > 0) {
            const fA = getAreaFact(plcGradoVal);
            const fR = getRhFact(plcGradoVal);
            computedPlcD = Math.pow(plcQVal / (plcKsVal * Math.pow(plcIVal, 0.5) * Math.pow(fR, 2/3) * fA), 3/8);
            const a = getAlpha(plcGradoVal);
            const area = (Math.pow(computedPlcD, 2) / 8) * (2 * a - Math.sin(2 * a));
            const perimeter = computedPlcD * a;
            const Rh = area / perimeter;
            computedPlcV = plcKsVal * Math.pow(Rh, 2/3) * Math.pow(plcIVal, 0.5);
          } else {
            plcErrorMessage = 'Verificare che tutti gli input siano maggiori di zero e il grado sia <= 100%';
            plcIncognita = 'invalid';
          }
        } else if (gradoStr === '') {
          plcIncognita = 'grado';
          if (plcDVal > 0 && plcIVal > 0 && plcKsVal > 0 && plcQVal > 0) {
            const maxGrado = 93.8;
            const aMax = getAlpha(maxGrado);
            const areaMax = (Math.pow(plcDVal, 2) / 8) * (2 * aMax - Math.sin(2 * aMax));
            const perimMax = plcDVal * aMax;
            const RhMax = areaMax / perimMax;
            const QMax = plcKsVal * Math.pow(RhMax, 2/3) * Math.pow(plcIVal, 0.5) * areaMax;

            if (plcQVal > QMax) {
              plcErrorMessage = `La portata inserita (${formatNumber(plcQVal, 4)} m³/s) supera la capacità idraulica a pelo libero max della condotta (${formatNumber(QMax, 4)} m³/s al 93.8% di riempimento).`;
              plcIncognita = 'invalid';
            } else {
              let low = 0.01;
              let high = maxGrado;
              const f = (g: number) => {
                const a = getAlpha(g);
                const area = (Math.pow(plcDVal, 2) / 8) * (2 * a - Math.sin(2 * a));
                const perim = plcDVal * a;
                const Rh = area / perim;
                return plcKsVal * Math.pow(Rh, 2/3) * Math.pow(plcIVal, 0.5) * area - plcQVal;
              };
              for (let step = 0; step < 50; step++) {
                const mid = (low + high) / 2;
                if (f(mid) > 0) {
                  high = mid;
                } else {
                  low = mid;
                }
              }
              computedPlcGrado = (low + high) / 2;
              const a = getAlpha(computedPlcGrado);
              const area = (Math.pow(plcDVal, 2) / 8) * (2 * a - Math.sin(2 * a));
              const perim = plcDVal * a;
              const Rh = area / perim;
              computedPlcV = plcKsVal * Math.pow(Rh, 2/3) * Math.pow(plcIVal, 0.5);
            }
          } else {
            plcErrorMessage = 'Verificare che tutti gli input siano maggiori di zero';
            plcIncognita = 'invalid';
          }
        }
      }
    }

    // --- CANALE RETTANGOLARE (RUSCELLO) ---
    const plrBVal = parseFloat(data.plrB) || 0;
    const plrHVal = parseFloat(data.plrH) || 0;
    const plrIVal = parseFloat(data.plrI) || 0;
    const plrCVal = parseFloat(data.plrC) || 0;

    let computedPlrQ = 0;
    let computedPlrV = 0;
    let plrErrorMessage = '';
    let plrArea = 0;
    let plrPerimeter = 0;
    let plrRh = 0;
    let plrChi = 0;

    if (data.plTipo === 'rettangolare') {
      if (plrBVal > 0 && plrHVal > 0 && plrIVal >= 0 && plrCVal >= 0) {
        plrArea = plrBVal * plrHVal;
        plrPerimeter = plrBVal + 2 * plrHVal;
        plrRh = plrArea / plrPerimeter;
        const sqrtRh = Math.sqrt(plrRh);
        if (sqrtRh > 0) {
          plrChi = 87 / (1 + plrCVal / sqrtRh);
          computedPlrQ = plrChi * plrArea * Math.sqrt(plrRh * plrIVal);
          computedPlrV = plrChi * Math.sqrt(plrRh * plrIVal);
        } else {
          plrErrorMessage = 'Raggio idraulico non valido';
        }
      } else {
        plrErrorMessage = 'Verificare che tutti gli input siano maggiori di zero';
      }
    }

    // --- KHAFAGI-VENTURI ---
    const pkvBVal = parseFloat(data.pkvB) || 0;
    const pkvHVal = parseFloat(data.pkvH) || 0;
    const pkvQVal = parseFloat(data.pkvQ) || 0;

    let computedPkvB = pkvBVal;
    let computedPkvH = pkvHVal;
    let computedPkvQ = pkvQVal;
    let pkvIncognita: 'Q' | 'B' | 'h' | 'invalid' = 'invalid';
    let pkvErrorMessage = '';

    if (data.plTipo === 'khafagi_venturi') {
      const bStr = data.pkvB.trim();
      const hStr = data.pkvH.trim();
      const qStr = data.pkvQ.trim();
      const countEmpty = (bStr === '' ? 1 : 0) + (hStr === '' ? 1 : 0) + (qStr === '' ? 1 : 0);

      if (countEmpty === 1) {
        if (qStr === '') {
          pkvIncognita = 'Q';
          if (pkvBVal > 0 && pkvHVal > 0) {
            computedPkvQ = 0.6976 * pkvBVal * Math.pow(pkvHVal, 1.5) + 0.091 * Math.pow(pkvHVal, 2.5);
          } else {
            pkvErrorMessage = 'Verificare che tutti gli input siano maggiori di zero';
            pkvIncognita = 'invalid';
          }
        } else if (bStr === '') {
          pkvIncognita = 'B';
          if (pkvHVal > 0 && pkvQVal > 0) {
            const term = 0.091 * Math.pow(pkvHVal, 2.5);
            if (pkvQVal > term) {
              computedPkvB = (pkvQVal - term) / (0.6976 * Math.pow(pkvHVal, 1.5));
            } else {
              pkvErrorMessage = 'Portata troppo piccola per il carico h inserito (la portata di fondo del canale senza strozzatura supera la portata totale)';
              pkvIncognita = 'invalid';
            }
          } else {
            pkvErrorMessage = 'Verificare che tutti gli input siano maggiori di zero';
            pkvIncognita = 'invalid';
          }
        } else if (hStr === '') {
          pkvIncognita = 'h';
          if (pkvBVal > 0 && pkvQVal > 0) {
            let low = 0.0001;
            let high = 10.0;
            const f = (valH: number) => 0.6976 * pkvBVal * Math.pow(valH, 1.5) + 0.091 * Math.pow(valH, 2.5) - pkvQVal;
            if (f(low) * f(high) <= 0) {
              for (let step = 0; step < 50; step++) {
                const mid = (low + high) / 2;
                if (f(mid) > 0) {
                  high = mid;
                } else {
                  low = mid;
                }
              }
              computedPkvH = (low + high) / 2;
            } else {
              pkvErrorMessage = 'Nessuna soluzione trovata nell\'intervallo di carico h (0 - 10m). La portata inserita potrebbe essere troppo elevata.';
              pkvIncognita = 'invalid';
            }
          } else {
            pkvErrorMessage = 'Verificare che tutti gli input siano maggiori di zero';
            pkvIncognita = 'invalid';
          }
        }
      }
    }

    return {
      computedPlcD, computedPlcGrado, computedPlcI, computedPlcKs, computedPlcQ, computedPlcV, plcIncognita, plcErrorMessage,
      computedPlrQ, computedPlrV, plrErrorMessage, plrArea, plrPerimeter, plrRh, plrChi,
      computedPkvB, computedPkvH, computedPkvQ, pkvIncognita, pkvErrorMessage
    };
  }, [data.plTipo, data.plcD, data.plcGrado, data.plcI, data.plcKs, data.plcQ, data.plrB, data.plrH, data.plrI, data.plrC, data.plrQ, data.pkvB, data.pkvH, data.pkvQ]);

  // 8. Logica Dimensionamento Travi (Fase 4)
  const beamSizingResults = useMemo(() => {
    const L = parseFloat(data.traviL) || 0;
    const L1 = parseFloat(data.traviL1) || 0;
    const P = parseFloat(data.traviP) || 0;
    const q = parseFloat(data.traviq) || 0;
    const sigma = parseFloat(data.traviSigma) || 1600;

    let Mmax = 0; // kg*m
    let Wmin = 0; // cm3
    let error = '';

    if (L <= 0) {
      error = 'La lunghezza della trave deve essere maggiore di zero.';
    } else if (sigma <= 0) {
      error = 'La tensione ammissibile deve essere maggiore di zero.';
    } else {
      const tipo = data.traviTipo;
      if (tipo === 'incastrata_concentrato') {
        if (P < 0) error = 'Il carico P non può essere negativo.';
        else {
          Mmax = P * L;
        }
      } else if (tipo === 'appoggiata_concentrato') {
        if (P < 0) error = 'Il carico P non può essere negativo.';
        else if (L1 < 0 || L1 > L) {
          error = 'La distanza L1 deve essere compresa tra 0 e la lunghezza della trave L.';
        } else {
          Mmax = (P * L1 * (L - L1)) / L;
        }
      } else if (tipo === 'doppio_incastrata_concentrato') {
        if (P < 0) error = 'Il carico P non può essere negativo.';
        else if (L1 < 0 || L1 > L) {
          error = 'La distanza L1 deve essere compresa tra 0 e la lunghezza della trave L.';
        } else {
          const a = Math.min(L1, L - L1);
          const b = Math.max(L1, L - L1);
          Mmax = (P * a * b * b) / (L * L);
        }
      } else if (tipo === 'incastrata_distribuito') {
        if (q < 0) error = 'Il carico distribuito q non può essere negativo.';
        else {
          Mmax = (q * L * L) / 2;
        }
      } else if (tipo === 'appoggiata_distribuito') {
        if (q < 0) error = 'Il carico distribuito q non può essere negativo.';
        else {
          Mmax = (q * L * L) / 8;
        }
      } else if (tipo === 'doppio_incastrata_distribuito') {
        if (q < 0) error = 'Il carico distribuito q non può essere negativo.';
        else {
          Mmax = (q * L * L) / 12;
        }
      }

      if (!error) {
        Wmin = (Mmax * 100) / sigma;
      }
    }

    // Ricerca dei profili commerciali ideali
    const families = ['ipe', 'hea', 'heb', 'hem', 'upn', 't', 'l', 'tubo_quadro', 'tubo_rettang', 'tubo_circ'];
    const selectedProfiles: Record<string, { name: string; w: number | string }> = {};

    families.forEach(fam => {
      if (error || Wmin <= 0) {
        selectedProfiles[fam] = { name: '-', w: '-' };
        return;
      }

      const list = BEAM_CATALOG[fam] || [];
      const match = list.find(p => p.w >= Wmin);
      if (match) {
        selectedProfiles[fam] = { name: match.name, w: match.w };
      } else {
        selectedProfiles[fam] = { name: '-', w: '-' };
      }
    });

    return {
      Mmax,
      Wmin,
      selectedProfiles,
      error
    };
  }, [data.traviTipo, data.traviL, data.traviL1, data.traviP, data.traviq, data.traviSigma]);

  return (
    <div className="bg-slate-100 rounded-3xl p-6 md:p-8 animate-in fade-in duration-300">
      {/* Header dello strumento */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-slate-200 print:hidden">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <span className="p-2 bg-blue-100 text-brand-600 rounded-2xl"><Scale className="w-6 h-6" /></span>
            Calcoli Rapidi & Utilità
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Conversioni di misura veloci, distanza sostegni condotte e volumi geometrici fluidi
          </p>
        </div>
        <div className="flex gap-2">
          <ProjectStorage 
            toolType="calcoli_vari" 
            currentData={data} 
            onLoadProject={handleLoadProject} 
            projectInfo={projectData} 
            setProjectInfo={setProjectData} 
          />
        </div>
      </div>
      {/* Intestazione del progetto standard */}
      <ProjectHeader pData={projectData} setPData={setProjectData} title="Calcoli Rapidi & Utilità" setAppMode={setAppMode} iconColor="brand" />

      {/* Contenitore Principale a due colonne */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Colonna Sinistra: Sidebar (Invisibile in stampa) */}
        <div className="w-full md:w-64 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm shrink-0 print:hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Seleziona Utilità</p>
          </div>
          <div className="flex flex-col divide-y divide-slate-100">
            <button
              onClick={() => updateField('activeSubTool', 'conversione')}
              className={`w-full text-left p-4 text-xs font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                data.activeSubTool === 'conversione' 
                  ? 'bg-blue-500/10 text-blue-700 border-l-4 border-blue-500' 
                  : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Scale className="w-4 h-4 mr-1 text-slate-500" />
              <span>Conversione Unità</span>
            </button>
            <button
              onClick={() => updateField('activeSubTool', 'appoggi')}
              className={`w-full text-left p-4 text-xs font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                data.activeSubTool === 'appoggi' 
                  ? 'bg-blue-500/10 text-blue-700 border-l-4 border-blue-500' 
                  : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Ruler className="w-4 h-4 mr-1 text-slate-500" />
              <span>Distanza Appoggi Tubi</span>
            </button>
            <button
              onClick={() => updateField('activeSubTool', 'volume')}
              className={`w-full text-left p-4 text-xs font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                data.activeSubTool === 'volume' 
                  ? 'bg-blue-500/10 text-blue-700 border-l-4 border-blue-500' 
                  : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Database className="w-4 h-4 mr-1 text-slate-500" />
              <span>Volume Serbatoi</span>
            </button>
            <button
              onClick={() => updateField('activeSubTool', 'portata_sez_vel')}
              className={`w-full text-left p-4 text-xs font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                data.activeSubTool === 'portata_sez_vel' 
                  ? 'bg-blue-500/10 text-blue-700 border-l-4 border-blue-500' 
                  : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Wind className="w-4 h-4 mr-1 text-slate-500" />
              <span>Portata-Sezione-Velocità</span>
            </button>
            <button
              onClick={() => updateField('activeSubTool', 'foronomia')}
              className={`w-full text-left p-4 text-xs font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                data.activeSubTool === 'foronomia' 
                  ? 'bg-blue-500/10 text-blue-700 border-l-4 border-blue-500' 
                  : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Waves className="w-4 h-4 mr-1 text-slate-500" />
              <span>Foronomia (Luci & Stramazzi)</span>
            </button>
            <button
              onClick={() => updateField('activeSubTool', 'svuotamento')}
              className={`w-full text-left p-4 text-xs font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                data.activeSubTool === 'svuotamento' 
                  ? 'bg-blue-500/10 text-blue-700 border-l-4 border-blue-500' 
                  : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Clock className="w-4 h-4 mr-1 text-slate-500" />
              <span>Tempo Svuotamento</span>
            </button>
             <button
              onClick={() => updateField('activeSubTool', 'pelo_libero')}
              className={`w-full text-left p-4 text-xs font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                data.activeSubTool === 'pelo_libero' 
                  ? 'bg-blue-500/10 text-blue-700 border-l-4 border-blue-500' 
                  : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Droplet className="w-4 h-4 mr-1 text-slate-500" />
              <span>Condotte a Pelo Libero</span>
            </button>
            <button
              onClick={() => updateField('activeSubTool', 'travi')}
              className={`w-full text-left p-4 text-xs font-bold flex items-center gap-3 transition-colors cursor-pointer ${
                data.activeSubTool === 'travi' 
                  ? 'bg-blue-500/10 text-blue-700 border-l-4 border-blue-500' 
                  : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Ruler className="w-4 h-4 mr-1 text-slate-500" />
              <span>Dimensionamento Travi</span>
            </button>
          </div>
        </div>

        {/* Colonna Destra: Area del calcolo */}
        <div className="flex-1 w-full">
          
          {/* 1. Conversione Unità di Misura */}
          {data.activeSubTool === 'conversione' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0">
              <h3 className="text-base font-black text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <span className="p-1 bg-blue-100 text-brand-600 rounded-lg"><Scale className="w-4 h-4" /></span>
                Convertitore di Unità di Misura
              </h3>
              
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 text-xs text-slate-650 space-y-2.5 print:hidden">
                <p><strong>Descrizione:</strong> Converte in tempo reale valori tra diverse unità di misura fisiche (Pressione, Temperatura, Portata, Lunghezza, Potenza, Superficie, Energia, Velocità, Volume, Densità, Accelerazione, Forza/Massa, Angolo) basate sugli standard scientifici internazionali.</p>
                <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-slate-600">
                  <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Formule di conversione applicate:</p>
                  <div className="space-y-3 font-serif pl-2">
                    <div className="flex items-center gap-1.5 text-sm">
                      <span>• Lineare (Pressione, Portata, Lunghezza, Potenza, ecc.):</span>
                      <span className="font-bold text-slate-800">V<sub>dest</sub> = V<sub>sorg</sub> ×</span>
                      <span className="inline-flex flex-col items-center align-middle mx-1 text-xs">
                        <span className="border-b border-slate-400 px-2 pb-0.5 text-center font-bold">F<sub>sorg</sub></span>
                        <span className="px-2 pt-0.5 text-center font-bold">F<sub>dest</sub></span>
                      </span>
                    </div>
                    <div className="text-sm">
                      • Temperatura: 
                      <span className="font-bold text-slate-800 ml-2">T<sub>°F</sub> = T<sub>°C</sub> × 1.8 + 32</span>
                      <span className="mx-2">|</span>
                      <span className="font-bold text-slate-800">T<sub>K</sub> = T<sub>°C</sub> + 273.15</span>
                    </div>
                  </div>
                  <p className="text-slate-400 text-[9px] mt-3 italic font-sans border-t border-slate-100 pt-2">* Dove F rappresenta il fattore di conversione lineare rispetto all'unità base del Sistema Internazionale (SI).</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
                {/* Inputs */}
                <div className="space-y-4 print:hidden">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Categoria di Misura</label>
                    <div className="flex flex-wrap gap-1.5">
                      <button 
                        onClick={() => updateField('convCategory', 'pressione')}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${data.convCategory === 'pressione' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        Pressione
                      </button>
                      <button 
                        onClick={() => updateField('convCategory', 'temperatura')}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${data.convCategory === 'temperatura' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        Temperatura
                      </button>
                      <button 
                        onClick={() => updateField('convCategory', 'portata')}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${data.convCategory === 'portata' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        Portata
                      </button>
                      <button 
                        onClick={() => updateField('convCategory', 'lunghezza')}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${data.convCategory === 'lunghezza' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        Lunghezza
                      </button>
                      <button 
                        onClick={() => updateField('convCategory', 'potenza')}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${data.convCategory === 'potenza' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        Potenza
                      </button>
                      <button 
                        onClick={() => updateField('convCategory', 'superficie')}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${data.convCategory === 'superficie' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        Superficie
                      </button>
                      <button 
                        onClick={() => updateField('convCategory', 'energia')}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${data.convCategory === 'energia' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        Energia
                      </button>
                      <button 
                        onClick={() => updateField('convCategory', 'velocita')}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${data.convCategory === 'velocita' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        Velocità
                      </button>
                      <button 
                        onClick={() => updateField('convCategory', 'volume')}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${data.convCategory === 'volume' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        Volume
                      </button>
                      <button 
                        onClick={() => updateField('convCategory', 'densita')}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${data.convCategory === 'densita' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        Densità
                      </button>
                      <button 
                        onClick={() => updateField('convCategory', 'accelerazione')}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${data.convCategory === 'accelerazione' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        Accelerazione
                      </button>
                      <button 
                        onClick={() => updateField('convCategory', 'forza_massa')}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${data.convCategory === 'forza_massa' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        Forza · Massa
                      </button>
                      <button 
                        onClick={() => updateField('convCategory', 'angolo')}
                        className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${data.convCategory === 'angolo' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        Angolo
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Valore da Convertire</label>
                    <input 
                      type="number"
                      step="any"
                      value={data.convValSorgente}
                      onChange={e => updateField('convValSorgente', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Da Unità</label>
                      <select
                        value={data.convUnitSorgente}
                        onChange={e => updateField('convUnitSorgente', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        {data.convCategory === 'pressione' && (
                          <>
                            <option value="bar">bar</option>
                            <option value="mbar">mbar</option>
                            <option value="Pa">Pa</option>
                            <option value="kPa">kPa</option>
                            <option value="MPa">MPa</option>
                            <option value="atm">atm</option>
                            <option value="mH2O">m H₂O</option>
                            <option value="psi">psi</option>
                          </>
                        )}
                        {data.convCategory === 'temperatura' && (
                          <>
                            <option value="C">°C</option>
                            <option value="F">°F</option>
                            <option value="K">K</option>
                          </>
                        )}
                        {data.convCategory === 'portata' && (
                          <>
                            <option value="m3_h">m³/h</option>
                            <option value="l_min">l/min</option>
                            <option value="l_s">l/s</option>
                            <option value="m3_s">m³/s</option>
                            <option value="gpm">gpm (USA)</option>
                          </>
                        )}
                        {data.convCategory === 'lunghezza' && (
                          <>
                            <option value="m">m</option>
                            <option value="mm">mm</option>
                            <option value="cm">cm</option>
                            <option value="km">km</option>
                            <option value="in">in (pollici)</option>
                            <option value="ft">ft (piedi)</option>
                            <option value="yd">yd (iarde)</option>
                            <option value="mi">mi (miglia)</option>
                          </>
                        )}
                        {data.convCategory === 'potenza' && (
                          <>
                            <option value="W">W</option>
                            <option value="kW">kW</option>
                            <option value="MW">MW</option>
                            <option value="cv">cv (Cavalli metrici)</option>
                            <option value="hp">hp (Horsepower)</option>
                            <option value="kcal_h">kcal/h</option>
                            <option value="btu_h">BTU/h</option>
                          </>
                        )}
                        {data.convCategory === 'superficie' && (
                          <>
                            <option value="m2">m²</option>
                            <option value="mm2">mm²</option>
                            <option value="cm2">cm²</option>
                            <option value="km2">km²</option>
                            <option value="he">he (ettari)</option>
                            <option value="are">are</option>
                            <option value="in2">in² (pollici²)</option>
                            <option value="ft2">ft² (piedi²)</option>
                            <option value="ac">ac (acri)</option>
                          </>
                        )}
                        {data.convCategory === 'energia' && (
                          <>
                            <option value="J">J</option>
                            <option value="kJ">kJ</option>
                            <option value="MJ">MJ</option>
                            <option value="GJ">GJ</option>
                            <option value="cal">cal</option>
                            <option value="kcal">kcal</option>
                            <option value="Wh">Wh</option>
                            <option value="kWh">kWh</option>
                            <option value="MWh">MWh</option>
                            <option value="btu">BTU</option>
                            <option value="kgm">kg·m (chilogrammetri)</option>
                          </>
                        )}
                        {data.convCategory === 'velocita' && (
                          <>
                            <option value="m_s">m/s</option>
                            <option value="km_h">km/h</option>
                            <option value="mph">mph (miglia/h)</option>
                            <option value="kn">kn (nodi)</option>
                            <option value="ft_s">ft/s (piedi/s)</option>
                          </>
                        )}
                        {data.convCategory === 'volume' && (
                          <>
                            <option value="m3">m³</option>
                            <option value="dm3">dm³ (litri)</option>
                            <option value="cm3">cm³ (ml)</option>
                            <option value="mm3">mm³</option>
                            <option value="in3">in³ (pollici³)</option>
                            <option value="ft3">ft³ (piedi³)</option>
                            <option value="gal_us">gal (USA)</option>
                            <option value="gal_uk">gal (UK)</option>
                          </>
                        )}
                        {data.convCategory === 'densita' && (
                          <>
                            <option value="kg_m3">kg/m³</option>
                            <option value="g_cm3">g/cm³ (kg/l)</option>
                            <option value="lb_ft3">lb/ft³</option>
                            <option value="lb_in3">lb/in³</option>
                          </>
                        )}
                        {data.convCategory === 'accelerazione' && (
                          <>
                            <option value="m_s2">m/s²</option>
                            <option value="g">g (gravità stand.)</option>
                            <option value="cm_s2">cm/s² (Gal)</option>
                            <option value="ft_s2">ft/s²</option>
                          </>
                        )}
                        {data.convCategory === 'forza_massa' && (
                          <>
                            <option value="N">Newton (N)</option>
                            <option value="kN">Kilonewton (kN)</option>
                            <option value="daN">Decanewton (daN)</option>
                            <option value="kgf">Chilogrammo (kg / kgf)</option>
                            <option value="t">Tonnellata (t / tf)</option>
                            <option value="g">Grammo (g / gf)</option>
                            <option value="lbf">Libbra (lb / lbf)</option>
                            <option value="oz">Oncia (oz)</option>
                          </>
                        )}
                        {data.convCategory === 'angolo' && (
                          <>
                            <option value="deg">deg (gradi °)</option>
                            <option value="rad">rad (radianti)</option>
                            <option value="grad">grad (gon / centesimali)</option>
                            <option value="arcmin">arcmin (primi ')</option>
                            <option value="arcsec">arcsec (secondi ")</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">A Unità</label>
                      <select
                        value={data.convUnitDestinazione}
                        onChange={e => updateField('convUnitDestinazione', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        {data.convCategory === 'pressione' && (
                          <>
                            <option value="bar">bar</option>
                            <option value="mbar">mbar</option>
                            <option value="Pa">Pa</option>
                            <option value="kPa">kPa</option>
                            <option value="MPa">MPa</option>
                            <option value="atm">atm</option>
                            <option value="mH2O">m H₂O</option>
                            <option value="psi">psi</option>
                          </>
                        )}
                        {data.convCategory === 'temperatura' && (
                          <>
                            <option value="C">°C</option>
                            <option value="F">°F</option>
                            <option value="K">K</option>
                          </>
                        )}
                        {data.convCategory === 'portata' && (
                          <>
                            <option value="m3_h">m³/h</option>
                            <option value="l_min">l/min</option>
                            <option value="l_s">l/s</option>
                            <option value="m3_s">m³/s</option>
                            <option value="gpm">gpm (USA)</option>
                          </>
                        )}
                        {data.convCategory === 'lunghezza' && (
                          <>
                            <option value="m">m</option>
                            <option value="mm">mm</option>
                            <option value="cm">cm</option>
                            <option value="km">km</option>
                            <option value="in">in (pollici)</option>
                            <option value="ft">ft (piedi)</option>
                            <option value="yd">yd (iarde)</option>
                            <option value="mi">mi (miglia)</option>
                          </>
                        )}
                        {data.convCategory === 'potenza' && (
                          <>
                            <option value="W">W</option>
                            <option value="kW">kW</option>
                            <option value="MW">MW</option>
                            <option value="cv">cv (Cavalli metrici)</option>
                            <option value="hp">hp (Horsepower)</option>
                            <option value="kcal_h">kcal/h</option>
                            <option value="btu_h">BTU/h</option>
                          </>
                        )}
                        {data.convCategory === 'superficie' && (
                          <>
                            <option value="m2">m²</option>
                            <option value="mm2">mm²</option>
                            <option value="cm2">cm²</option>
                            <option value="km2">km²</option>
                            <option value="he">he (ettari)</option>
                            <option value="are">are</option>
                            <option value="in2">in² (pollici²)</option>
                            <option value="ft2">ft² (piedi²)</option>
                            <option value="ac">ac (acri)</option>
                          </>
                        )}
                        {data.convCategory === 'energia' && (
                          <>
                            <option value="J">J</option>
                            <option value="kJ">kJ</option>
                            <option value="MJ">MJ</option>
                            <option value="GJ">GJ</option>
                            <option value="cal">cal</option>
                            <option value="kcal">kcal</option>
                            <option value="Wh">Wh</option>
                            <option value="kWh">kWh</option>
                            <option value="MWh">MWh</option>
                            <option value="btu">BTU</option>
                            <option value="kgm">kg·m (chilogrammetri)</option>
                          </>
                        )}
                        {data.convCategory === 'velocita' && (
                          <>
                            <option value="m_s">m/s</option>
                            <option value="km_h">km/h</option>
                            <option value="mph">mph (miglia/h)</option>
                            <option value="kn">kn (nodi)</option>
                            <option value="ft_s">ft/s (piedi/s)</option>
                          </>
                        )}
                        {data.convCategory === 'volume' && (
                          <>
                            <option value="m3">m³</option>
                            <option value="dm3">dm³ (litri)</option>
                            <option value="cm3">cm³ (ml)</option>
                            <option value="mm3">mm³</option>
                            <option value="in3">in³ (pollici³)</option>
                            <option value="ft3">ft³ (piedi³)</option>
                            <option value="gal_us">gal (USA)</option>
                            <option value="gal_uk">gal (UK)</option>
                          </>
                        )}
                        {data.convCategory === 'densita' && (
                          <>
                            <option value="kg_m3">kg/m³</option>
                            <option value="g_cm3">g/cm³ (kg/l)</option>
                            <option value="lb_ft3">lb/ft³</option>
                            <option value="lb_in3">lb/in³</option>
                          </>
                        )}
                        {data.convCategory === 'accelerazione' && (
                          <>
                            <option value="m_s2">m/s²</option>
                            <option value="g">g (gravità stand.)</option>
                            <option value="cm_s2">cm/s² (Gal)</option>
                            <option value="ft_s2">ft/s²</option>
                          </>
                        )}
                        {data.convCategory === 'forza_massa' && (
                          <>
                            <option value="N">Newton (N)</option>
                            <option value="kN">Kilonewton (kN)</option>
                            <option value="daN">Decanewton (daN)</option>
                            <option value="kgf">Chilogrammo (kg / kgf)</option>
                            <option value="t">Tonnellata (t / tf)</option>
                            <option value="g">Grammo (g / gf)</option>
                            <option value="lbf">Libbra (lb / lbf)</option>
                            <option value="oz">Oncia (oz)</option>
                          </>
                        )}
                        {data.convCategory === 'angolo' && (
                          <>
                            <option value="deg">deg (gradi °)</option>
                            <option value="rad">rad (radianti)</option>
                            <option value="grad">grad (gon / centesimali)</option>
                            <option value="arcmin">arcmin (primi ')</option>
                            <option value="arcsec">arcsec (secondi ")</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Tabella di riepilogo in stampa (sostituisce gli input) */}
                <div className="hidden print:block border border-slate-200 rounded-2xl p-4 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b pb-1 mb-2">Dati di Ingresso</p>
                  <div className="grid grid-cols-2 gap-y-1.5 text-[11px] text-slate-650">
                    <div><strong>Categoria:</strong></div>
                    <div>{CATEGORY_LABELS[data.convCategory] || data.convCategory}</div>
                    <div><strong>Valore inserito:</strong></div>
                    <div>{formatNumber(data.convValSorgente, 4)} {data.convUnitSorgente}</div>
                  </div>
                </div>

                {/* Risultato */}
                <div className="bg-blue-50/50 border border-blue-200/60 rounded-3xl p-6 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider mb-4 border-b border-blue-200 pb-1.5">Valore Convertito</p>
                    
                    <div className="space-y-2">
                      <p className="text-slate-500 text-[10px] uppercase font-bold">Valore Convertito</p>
                      <p className="text-4xl font-mono font-black text-brand-600 break-words">
                        {conversionResult.toLocaleString('it-IT', { maximumFractionDigits: 5 })}
                      </p>
                      <span className="inline-block text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold">
                        {data.convUnitDestinazione}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-blue-200/50 text-[10px] text-slate-400 italic">
                    * Nota: Fattori di calcolo allineati con gli standard internazionali di conversione scientifica (SI).
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Distanza Appoggi Condotte Sospese */}
          {data.activeSubTool === 'appoggi' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0">
              <h3 className="text-base font-black text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <span className="p-1 bg-blue-100 text-brand-600 rounded-lg"><Ruler className="w-4 h-4" /></span>
                Distanza Appoggi Tubazioni Sospese
              </h3>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 text-xs text-slate-650 space-y-2.5 print:hidden">
                <p><strong>Descrizione:</strong> Calcola la spaziatura massima consigliata tra i sostegni di una condotta sospesa. Esegue una doppia verifica strutturale: limita la freccia elastica (inflessione) e controlla che lo sforzo di flessione massimo non superi la tensione ammissibile del materiale.</p>
                <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-slate-600">
                  <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Formule strutturali applicate (Trave appoggiata con carico uniformemente distribuito):</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 font-serif pl-2 text-sm">
                    <div className="flex items-center gap-1.5">
                      <span>• Inerzia:</span>
                      <span className="font-bold text-slate-800">I =</span>
                      <span className="inline-flex flex-col items-center align-middle mx-1 text-xs">
                        <span className="border-b border-slate-400 px-1.5 pb-0.5 text-center font-bold">π</span>
                        <span className="px-1.5 pt-0.5 text-center font-bold">64</span>
                      </span>
                      <span>× (d<sub>est</sub><sup>4</sup> - d<sub>int</sub><sup>4</sup>)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span>• Resistenza flessione:</span>
                      <span className="font-bold text-slate-800">Z =</span>
                      <span className="inline-flex flex-col items-center align-middle mx-1 text-xs">
                        <span className="border-b border-slate-400 px-1.5 pb-0.5 text-center font-bold">π</span>
                        <span className="px-1.5 pt-0.5 text-center font-bold">32</span>
                      </span>
                      <span>×</span>
                      <span className="inline-flex flex-col items-center align-middle mx-1 text-xs">
                        <span className="border-b border-slate-400 px-1.5 pb-0.5 text-center font-bold">d<sub>est</sub><sup>4</sup> - d<sub>int</sub><sup>4</sup></span>
                        <span className="px-1.5 pt-0.5 text-center font-bold">d<sub>est</sub></span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 col-span-1 md:col-span-2">
                      <span>• Distanza limite freccia:</span>
                      <span className="font-bold text-slate-800">L<sub>freccia</sub> = <sup>4</sup>√</span>
                      <span className="border-l border-t border-slate-400 pl-1.5 pt-0.5 inline-flex flex-col items-center align-middle text-xs">
                        <span className="border-b border-slate-400 px-2 pb-0.5 text-center font-bold">384 × E × I × y<sub>max</sub></span>
                        <span className="px-2 pt-0.5 text-center font-bold">5 × w<sub>tot</sub></span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 col-span-1 md:col-span-2">
                      <span>• Distanza limite tensione:</span>
                      <span className="font-bold text-slate-800">L<sub>tensione</sub> = √</span>
                      <span className="border-l border-t border-slate-400 pl-1.5 pt-0.5 inline-flex flex-col items-center align-middle text-xs">
                        <span className="border-b border-slate-400 px-2 pb-0.5 text-center font-bold">8 × σ<sub>amm</sub> × Z</span>
                        <span className="px-2 pt-0.5 text-center font-bold">w<sub>tot</sub></span>
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] font-bold text-slate-700 mt-3 pt-2 border-t border-slate-100 font-serif pl-2">
                    L<sub>consigliata</sub> = min ( L<sub>freccia</sub> , L<sub>tensione</sub> )
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2">
                {/* Inputs */}
                <div className="space-y-4 print:hidden">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Materiale Condotto</label>
                      <select
                        value={data.appoggiMateriale}
                        onChange={e => {
                          const mat = e.target.value as any;
                          const inCatalog = !!PIPE_CATALOG[mat];
                          setData(prev => {
                            const updated = {
                              ...prev,
                              appoggiMateriale: mat,
                              appoggiUsaCatalog: inCatalog
                            };
                            if (inCatalog) {
                              const specs = PIPE_CATALOG[mat].specs;
                              const dnList = Object.keys(specs);
                              if (dnList.length > 0) {
                                const dn = dnList[0];
                                const pnList = Object.keys(specs[dn]);
                                if (pnList.length > 0) {
                                  const pn = pnList[0];
                                  updated.appoggiDN = dn;
                                  updated.appoggiPN = pn;
                                  
                                  const dIntMm = specs[dn][pn];
                                  const dExtMm = getExternalDiameter(mat, dn, dIntMm);
                                  const spessoreMm = (dExtMm - dIntMm) / 2;
                                  
                                  updated.appoggiDEst = dExtMm.toFixed(1);
                                  updated.appoggiSpessore = spessoreMm.toFixed(1);
                                }
                              }
                            }
                            return updated;
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        {Object.entries(MATERIAL_PROPERTIES).map(([key, mat]) => (
                          <option key={key} value={key}>{mat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Limite Freccia Ammessa (mm)</label>
                      <input 
                        type="number"
                        step="any"
                        value={data.appoggiLimiteFreccia}
                        onChange={e => updateField('appoggiLimiteFreccia', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  </div>

                  {!!PIPE_CATALOG[data.appoggiMateriale] && (
                    <div className="flex items-center gap-2 mb-2 ml-1">
                      <input
                        type="checkbox"
                        id="appoggiUsaCatalog"
                        checked={data.appoggiUsaCatalog}
                        onChange={e => {
                          const val = e.target.checked;
                          setData(prev => {
                            const updated = { ...prev, appoggiUsaCatalog: val };
                            if (val) {
                              const mat = prev.appoggiMateriale;
                              const specs = PIPE_CATALOG[mat].specs;
                              const dn = prev.appoggiDN || Object.keys(specs)[0];
                              const pn = prev.appoggiPN || Object.keys(specs[dn] || {})[0];
                              
                              if (specs[dn] && specs[dn][pn]) {
                                const dIntMm = specs[dn][pn];
                                const dExtMm = getExternalDiameter(mat, dn, dIntMm);
                                const spessoreMm = (dExtMm - dIntMm) / 2;
                                updated.appoggiDN = dn;
                                updated.appoggiPN = pn;
                                updated.appoggiDEst = dExtMm.toFixed(1);
                                updated.appoggiSpessore = spessoreMm.toFixed(1);
                              }
                            }
                            return updated;
                          });
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="appoggiUsaCatalog" className="text-xs font-bold text-slate-650 cursor-pointer">
                        Usa dimensioni standard da catalogo (DN/PN)
                      </label>
                    </div>
                  )}

                  {data.appoggiUsaCatalog && PIPE_CATALOG[data.appoggiMateriale] ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Diametro Nominale (DN)</label>
                        <select
                          value={data.appoggiDN}
                          onChange={e => {
                            const dn = e.target.value;
                            setData(prev => {
                              const mat = prev.appoggiMateriale;
                              const specs = PIPE_CATALOG[mat].specs;
                              let pn = prev.appoggiPN;
                              if (!specs[dn] || !specs[dn][pn]) {
                                pn = Object.keys(specs[dn] || {})[0] || '';
                              }
                              
                              const dIntMm = specs[dn][pn];
                              const dExtMm = getExternalDiameter(mat, dn, dIntMm);
                              const spessoreMm = (dExtMm - dIntMm) / 2;
                              
                              return {
                                ...prev,
                                appoggiDN: dn,
                                appoggiPN: pn,
                                appoggiDEst: dExtMm.toFixed(1),
                                appoggiSpessore: spessoreMm.toFixed(1)
                              };
                            });
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                          {Object.keys(PIPE_CATALOG[data.appoggiMateriale].specs).map(dn => (
                            <option key={dn} value={dn}>DN {dn}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">PN / SDR</label>
                        <select
                          value={data.appoggiPN}
                          onChange={e => {
                            const pn = e.target.value;
                            setData(prev => {
                              const mat = prev.appoggiMateriale;
                              const specs = PIPE_CATALOG[mat].specs;
                              const dn = prev.appoggiDN;
                              
                              const dIntMm = specs[dn][pn];
                              const dExtMm = getExternalDiameter(mat, dn, dIntMm);
                              const spessoreMm = (dExtMm - dIntMm) / 2;
                              
                              return {
                                ...prev,
                                appoggiPN: pn,
                                appoggiDEst: dExtMm.toFixed(1),
                                appoggiSpessore: spessoreMm.toFixed(1)
                              };
                            });
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                          {Object.keys(PIPE_CATALOG[data.appoggiMateriale].specs[data.appoggiDN] || {}).map(pn => (
                            <option key={pn} value={pn}>{pn}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Ø Esterno Tubazione (mm)</label>
                        <input 
                          type="number"
                          step="any"
                          value={data.appoggiDEst}
                          onChange={e => updateField('appoggiDEst', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Spessore Parete Tubo (mm)</label>
                        <input 
                          type="number"
                          step="any"
                          value={data.appoggiSpessore}
                          onChange={e => updateField('appoggiSpessore', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase ml-1">Peso Fluido Interno (kg/m)</label>
                        {parseFloat(data.appoggiDEst) > 0 && parseFloat(data.appoggiSpessore) > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const dEst = parseFloat(data.appoggiDEst) || 0;
                              const spessore = parseFloat(data.appoggiSpessore) || 0;
                              const dInt = dEst - 2 * spessore;
                              if (dInt > 0) {
                                const rIntM = dInt / 2 / 1000;
                                const pesoAcqua = Math.PI * Math.pow(rIntM, 2) * 1000;
                                updateField('appoggiPFluido', pesoAcqua.toFixed(2));
                              }
                            }}
                            className="text-[9px] font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer bg-blue-50 px-1.5 py-0.5 rounded-lg border border-blue-200"
                          >
                            Set Acqua: {(() => {
                              const dEst = parseFloat(data.appoggiDEst) || 0;
                              const spessore = parseFloat(data.appoggiSpessore) || 0;
                              const dInt = dEst - 2 * spessore;
                              if (dInt <= 0) return '0.00';
                              const rIntM = dInt / 2 / 1000;
                              return (Math.PI * Math.pow(rIntM, 2) * 1000).toFixed(2);
                            })()} kg/m
                          </button>
                        )}
                      </div>
                      <input 
                        type="number"
                        step="any"
                        value={data.appoggiPFluido}
                        onChange={e => updateField('appoggiPFluido', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Peso Isolamento Esterno (kg/m)</label>
                      <input 
                        type="number"
                        step="any"
                        value={data.appoggiPIsolante}
                        onChange={e => updateField('appoggiPIsolante', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Tabella di riepilogo in stampa (sostituisce gli input) */}
                <div className="hidden print:block border border-slate-200 rounded-2xl p-4 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b pb-1 mb-2">Dati di Ingresso</p>
                  <div className="grid grid-cols-2 gap-y-1.5 text-[11px] text-slate-650">
                    <div><strong>Materiale:</strong></div>
                    <div className="capitalize">{data.appoggiMateriale}</div>
                    <div><strong>Geometria Tubo:</strong></div>
                    <div>Øe {formatNumber(data.appoggiDEst, 1)} mm | sp. {formatNumber(data.appoggiSpessore, 1)} mm</div>
                    <div><strong>Massa Fluido:</strong></div>
                    <div>{formatNumber(data.appoggiPFluido, 2)} kg/m</div>
                    <div><strong>Massa Isolante:</strong></div>
                    <div>{formatNumber(data.appoggiPIsolante, 2)} kg/m</div>
                    <div><strong>Limite Freccia:</strong></div>
                    <div>{formatNumber(data.appoggiLimiteFreccia, 1)} mm</div>
                  </div>
                </div>

                {/* Risultati */}
                <div className="bg-blue-50/50 border border-blue-200/60 rounded-3xl p-6 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider mb-4 border-b border-blue-200 pb-1.5">Distanza Massima Appoggi</p>
                    
                    <div className="space-y-4">
                      <div>
                        <p className="text-slate-500 text-[10px] uppercase font-bold">L Consigliata (Spaziatura Massima)</p>
                        <p className="text-4xl font-mono font-black text-blue-700">
                          {formatNumber(appoggiResults.distConsigliata, 3)} <span className="text-base font-sans font-normal text-slate-450">m</span>
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs text-slate-600 border-t border-blue-200/40 pt-4">
                        <div>
                          <p className="text-slate-400 text-[9px] uppercase font-bold">Limite Flessione</p>
                          <p className="font-mono font-bold">{formatNumber(appoggiResults.distTensione, 3)} m</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-[9px] uppercase font-bold">Limite Freccia</p>
                          <p className="font-mono font-bold">{formatNumber(appoggiResults.distFreccia, 3)} m</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-blue-200/50 text-[10.5px] text-slate-550 space-y-1">
                    <p><strong>Massa condotto vuoto:</strong> {formatNumber(appoggiResults.pesoTubo, 2)} kg/m</p>
                    <p><strong>Massa totale gravante:</strong> {formatNumber(appoggiResults.pesoTot, 2)} kg/m</p>
                    <p className="text-[9px] text-slate-450 leading-normal pt-2 italic print:hidden">
                      * Nota: Il calcolo considera la trave appoggiata agli estremi con carico distribuito ($w$).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Volume Liquido Serbatoio */}
          {data.activeSubTool === 'volume' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0">
              <h3 className="text-base font-black text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <span className="p-1 bg-blue-100 text-brand-600 rounded-lg"><Database className="w-4 h-4" /></span>
                Volume Liquido in Serbatoio
              </h3>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 text-xs text-slate-650 space-y-2.5 print:hidden">
                <p><strong>Descrizione:</strong> Calcola il volume effettivo occupato dal liquido all'interno di serbatoi a riempimento parziale, per geometrie cilindriche orizzontali e sferiche.</p>
                <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-slate-600">
                  <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Formule geometriche applicate:</p>
                  <div className="space-y-3 font-serif pl-2 text-sm">
                    <div>
                      <p className="font-bold text-slate-800 mb-1.5">• Cilindrico orizzontale (teste piatte, raggio r = D/2):</p>
                      <div className="pl-4 space-y-2">
                        <div className="flex items-center gap-1">
                          <span>Angolo sotteso:</span>
                          <span className="font-bold text-slate-800">θ = 2 × arccos</span>
                          <span className="inline-flex items-center align-middle text-xs mx-1">
                            <span>(</span>
                            <span className="inline-flex flex-col items-center align-middle mx-1 text-[10px]">
                              <span className="border-b border-slate-400 px-1.5 pb-0.5 text-center font-bold">r - h</span>
                              <span className="px-1.5 pt-0.5 text-center font-bold">r</span>
                            </span>
                            <span>)</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>Area segmento circolare:</span>
                          <span className="font-bold text-slate-800">A<sub>seg</sub> =</span>
                          <span className="inline-flex flex-col items-center align-middle mx-1 text-xs">
                            <span className="border-b border-slate-400 px-1.5 pb-0.5 text-center font-bold">r²</span>
                            <span className="px-1.5 pt-0.5 text-center font-bold">2</span>
                          </span>
                          <span>× (θ - sin θ)</span>
                        </div>
                        <p>Volume liquido: <span className="font-bold text-slate-800">Volume = A<sub>seg</sub> × Lunghezza</span></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-800">• Serbatoio Sferico:</span>
                      <span className="font-bold text-slate-800 ml-2">Volume =</span>
                      <span className="inline-flex flex-col items-center align-middle mx-1 text-xs">
                        <span className="border-b border-slate-400 px-1.5 pb-0.5 text-center font-bold">π × h²</span>
                        <span className="px-1.5 pt-0.5 text-center font-bold">3</span>
                      </span>
                      <span>×</span>
                      <span className="inline-flex items-center align-middle text-xs mx-1">
                        <span>(</span>
                        <span className="inline-flex flex-col items-center align-middle mx-1 text-[10px]">
                          <span className="border-b border-slate-400 px-1.5 pb-0.5 text-center font-bold">3 × D</span>
                          <span className="px-1.5 pt-0.5 text-center font-bold">2</span>
                        </span>
                        <span>- h)</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
                {/* Inputs */}
                <div className="space-y-4 print:hidden">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Geometria Serbatoio</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateField('volumeTipo', 'cilindrico')}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${data.volumeTipo === 'cilindrico' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-650 border-slate-200 hover:bg-slate-100'}`}
                      >
                        Cilindrico Orizzontale
                      </button>
                      <button
                        onClick={() => updateField('volumeTipo', 'sferico')}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${data.volumeTipo === 'sferico' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-650 border-slate-200 hover:bg-slate-100'}`}
                      >
                        Sferico
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Diametro Serbatoio (m)</label>
                      <input 
                        type="number"
                        step="any"
                        value={data.volumeDiametro}
                        onChange={e => updateField('volumeDiametro', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Altezza Liquido (m)</label>
                      <input 
                        type="number"
                        step="any"
                        value={data.volumeAltezzaLiq}
                        onChange={e => updateField('volumeAltezzaLiq', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  </div>

                  {data.volumeTipo === 'cilindrico' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Lunghezza Serbatoio (m)</label>
                      <input 
                        type="number"
                        step="any"
                        value={data.volumeLunghezza}
                        onChange={e => updateField('volumeLunghezza', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  )}
                </div>

                {/* Tabella di riepilogo in stampa (sostituisce gli input) */}
                <div className="hidden print:block border border-slate-200 rounded-2xl p-4 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b pb-1 mb-2">Dati di Ingresso</p>
                  <div className="grid grid-cols-2 gap-y-1.5 text-[11px] text-slate-650">
                    <div><strong>Tipo Serbatoio:</strong></div>
                    <div className="capitalize">{data.volumeTipo === 'cilindrico' ? 'Cilindrico Orizzontale' : 'Sferico'}</div>
                    <div><strong>Diametro:</strong></div>
                    <div>{formatNumber(data.volumeDiametro, 2)} m</div>
                    {data.volumeTipo === 'cilindrico' && (
                      <>
                        <div><strong>Lunghezza:</strong></div>
                        <div>{formatNumber(data.volumeLunghezza, 2)} m</div>
                      </>
                    )}
                    <div><strong>Altezza Liquido:</strong></div>
                    <div>{formatNumber(data.volumeAltezzaLiq, 2)} m</div>
                  </div>
                </div>

                {/* Risultati */}
                <div className="bg-blue-50/50 border border-blue-200/60 rounded-3xl p-6 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider mb-4 border-b border-blue-200 pb-1.5">Volume del Liquido</p>
                    
                    <div className="space-y-4">
                      <div>
                        <p className="text-slate-500 text-[10px] uppercase font-bold">Volume Effettivo</p>
                        <p className="text-3xl font-mono font-black text-slate-800">
                          {formatNumber(volumeResult.volumeM3, 3)} <span className="text-sm font-sans font-normal text-slate-450">m³</span>
                        </p>
                        <p className="text-2xl font-mono font-black text-blue-700 mt-1">
                          {formatNumber(volumeResult.volumeLitri, 1)} <span className="text-xs font-sans font-normal text-slate-450">litri</span>
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-500 text-[10px] uppercase font-bold">Riempimento Percentuale</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(volumeResult.volumePerc, 100)}%` }}></div>
                          </div>
                          <span className="font-mono font-bold text-xs text-slate-700">{formatNumber(volumeResult.volumePerc, 1)} %</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-blue-200/50 text-[9.5px] text-slate-400 italic">
                    * Nota: Il calcolo per serbatoi cilindrici orizzontali adotta l'equazione dell'area del segmento circolare per teste piatte.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. Portata - Sezione - Velocità */}
          {data.activeSubTool === 'portata_sez_vel' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0">
              <h3 className="text-base font-black text-slate-800 border-b border-slate-100 pb-3 mb-2 flex items-center gap-2">
                <span className="p-1 bg-blue-100 text-brand-600 rounded-lg"><Wind className="w-4 h-4" /></span>
                Portata - Sezione - Velocità
              </h3>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4 text-xs text-slate-650 space-y-2.5 print:hidden">
                <p><strong>Descrizione:</strong> Risolve l'equazione di continuità per condotte a sezione circolare piena. Inserendo due parametri qualsiasi, lo strumento calcola automaticamente il terzo parametro mancante (incognita libera).</p>
                <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-slate-600">
                  <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Equazione di continuità applicata:</p>
                  <div className="space-y-3 font-serif pl-2 text-sm">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>• Equazione fondamentale:</span>
                      <span className="font-bold text-slate-800">Q = v × A × 3600</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>• Area della sezione circolare:</span>
                      <span className="font-bold text-slate-800">A =</span>
                      <span className="inline-flex flex-col items-center align-middle mx-1 text-xs">
                        <span className="border-b border-slate-400 px-1.5 pb-0.5 text-center font-bold">π × d²</span>
                        <span className="px-1.5 pt-0.5 text-center font-bold">4 × 10<sup>6</sup></span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>• Formula pratica integrata:</span>
                      <span className="font-bold text-brand-600 bg-brand-50/50 px-2 py-0.5 rounded border border-brand-100">Q = v × d² × 0.002827433</span>
                    </div>
                  </div>
                  <p className="text-slate-400 text-[9px] mt-3 italic font-sans border-t border-slate-100 pt-2">* Unità di misura impiegate: Q = Portata [m³/h], d = Diametro interno [mm], v = Velocità [m/s].</p>
                </div>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed mb-5 print:hidden">
                Risolutore a <strong>incognita libera</strong>: inserisci due valori conosciuti e **lascia vuota** la casella del valore che desideri calcolare.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
                {/* Inputs */}
                <div className="space-y-4 print:hidden">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Portata Q (m³/h)</label>
                    <input 
                      type="number"
                      step="any"
                      placeholder="Lascia vuoto per calcolare"
                      value={data.psvQ}
                      onChange={e => updateField('psvQ', e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.psvQ === '' ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    />
                    {data.psvQ === '' && <span className="text-[9px] text-amber-700 font-bold ml-1">Incognita da calcolare</span>}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Diametro Interno d (mm)</label>
                    <input 
                      type="number"
                      step="any"
                      placeholder="Lascia vuoto per calcolare"
                      value={data.psvD}
                      onChange={e => updateField('psvD', e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.psvD === '' ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    />
                    {data.psvD === '' && <span className="text-[9px] text-amber-700 font-bold ml-1">Incognita da calcolare</span>}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Velocità v (m/s)</label>
                    <input 
                      type="number"
                      step="any"
                      placeholder="Lascia vuoto per calcolare"
                      value={data.psvV}
                      onChange={e => updateField('psvV', e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.psvV === '' ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    />
                    {data.psvV === '' && <span className="text-[9px] text-amber-700 font-bold ml-1">Incognita da calcolare</span>}
                  </div>
                </div>

                {/* Tabella di riepilogo in stampa (sostituisce gli input) */}
                <div className="hidden print:block border border-slate-200 rounded-2xl p-4 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b pb-1 mb-2">Dati di Ingresso</p>
                  <div className="grid grid-cols-2 gap-y-1.5 text-[11px] text-slate-650">
                    <div><strong>Portata Q:</strong></div>
                    <div>{data.psvQ !== '' ? `${formatNumber(data.psvQ, 2)} m³/h` : 'INCOGNITA'}</div>
                    <div><strong>Diametro Interno d:</strong></div>
                    <div>{data.psvD !== '' ? `${formatNumber(data.psvD, 1)} mm` : 'INCOGNITA'}</div>
                    <div><strong>Velocità v:</strong></div>
                    <div>{data.psvV !== '' ? `${formatNumber(data.psvV, 2)} m/s` : 'INCOGNITA'}</div>
                  </div>
                </div>

                {/* Risultati */}
                <div className="bg-blue-50/50 border border-blue-200/60 rounded-3xl p-6 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider mb-4 border-b border-blue-200 pb-1.5">Risoluzione Equazione Continuità</p>
                    
                    <div className="space-y-4">
                      <div>
                        <p className="text-slate-400 text-[10px] uppercase font-bold">Portata Risultante (Q)</p>
                        <p className={`text-2xl font-mono font-black ${psvResults.activeIncognita === 'Q' ? 'text-blue-700' : 'text-slate-800'}`}>
                          {formatNumber(psvResults.computedQ, 3)} <span className="text-xs font-sans font-normal text-slate-450">m³/h</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[10px] uppercase font-bold">Diametro Interno Risultante (d)</p>
                        <p className={`text-2xl font-mono font-black ${psvResults.activeIncognita === 'd' ? 'text-blue-700' : 'text-slate-800'}`}>
                          {formatNumber(psvResults.computedD, 2)} <span className="text-xs font-sans font-normal text-slate-450">mm</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[10px] uppercase font-bold">Velocità Risultante (v)</p>
                        <p className={`text-2xl font-mono font-black ${psvResults.activeIncognita === 'v' ? 'text-blue-700' : 'text-slate-800'}`}>
                          {formatNumber(psvResults.computedV, 3)} <span className="text-xs font-sans font-normal text-slate-450">m/s</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-blue-200/50 text-[10px] text-slate-400 leading-normal">
                    {psvResults.activeIncognita === 'invalid' ? (
                      <span className="text-red-500 font-bold">⚠️ Si prega di lasciare vuoto esattamente uno dei tre campi per effettuare il calcolo.</span>
                    ) : (
                      <span>Risoluzione effettuata per incognita: <strong>{psvResults.activeIncognita}</strong></span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. Foronomia */}
          {data.activeSubTool === 'foronomia' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 animate-in fade-in duration-200">
              <h3 className="text-base font-black text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <span className="p-1 bg-blue-100 text-brand-600 rounded-lg"><Waves className="w-4 h-4" /></span>
                Calcoli di Foronomia (Luci & Stramazzi)
              </h3>

              {/* Sub-tabs per tipologia di luce */}
              <div className="flex flex-wrap gap-1.5 mb-5 print:hidden">
                {[
                  { id: 'circolare', label: 'Luce Circolare' },
                  { id: 'rettangolare', label: 'Luce Rettangolare' },
                  { id: 'tubo_interno', label: 'Tubo Addiz. Interno' },
                  { id: 'tubo_esterno', label: 'Tubo Addiz. Esterno' },
                  { id: 'stramazzo_grossa', label: 'Stramazzo p. Grossa' },
                  { id: 'stramazzo_sottile', label: 'Stramazzo p. Sottile (Bazin)' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => updateField('foroTipo', tab.id as any)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      data.foroTipo === tab.id 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Spiegazione & Formula (invisibile in stampa) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 text-xs text-slate-650 space-y-2.5 print:hidden">
                {data.foroTipo === 'circolare' && (
                  <>
                    <p><strong>Descrizione:</strong> Calcola la portata effluente da una luce circolare a spigolo vivo completamente sommersa, o ricava il battente/diametro necessario (incognita libera).</p>
                    <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-slate-600">
                      <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Equazioni di efflusso applicate:</p>
                      <div className="space-y-3 font-serif pl-2">
                        <div className="flex items-center gap-1 text-sm">
                          <span className="font-bold text-slate-800">Q = μ × A × √<span className="border-t border-slate-400 px-0.5">2 × g × h</span></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-sans">
                          <span>dove: &nbsp; A = </span>
                          <span className="inline-flex flex-col items-center align-middle mx-1 text-[10px] font-serif">
                            <span className="border-b border-slate-400 px-1 pb-0.5 text-center font-bold">π × D²</span>
                            <span className="px-1 pt-0.5 text-center font-bold">4</span>
                          </span>
                          <span className="ml-2">| &nbsp; μ = 0.61 (contrazione) &nbsp; | &nbsp; g = 9.806 m/s²</span>
                        </div>
                        <div className="text-xs text-slate-500 font-sans border-t border-slate-100 pt-2">
                          • Velocità effluente: <span className="font-mono font-bold text-slate-755">v = c<sub>v</sub> × √<span className="border-t border-slate-400 px-0.5 font-serif">2 × g × h</span></span> con c<sub>v</sub> = 0.98.
                        </div>
                      </div>
                    </div>
                  </>
                )}
                {data.foroTipo === 'tubo_interno' && (
                  <>
                    <p><strong>Descrizione:</strong> Calcola la portata effluente da una luce circolare con tubo addizionale interno (Borda) completamente sommersa, o ricava il battente/diametro necessario (incognita libera).</p>
                    <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-slate-600">
                      <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Equazioni di efflusso applicate:</p>
                      <div className="space-y-3 font-serif pl-2">
                        <div className="flex items-center gap-1 text-sm">
                          <span className="font-bold text-slate-800">Q = μ × A × √<span className="border-t border-slate-400 px-0.5">2 × g × h</span></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-sans">
                          <span>dove: &nbsp; A = </span>
                          <span className="inline-flex flex-col items-center align-middle mx-1 text-[10px] font-serif">
                            <span className="border-b border-slate-400 px-1 pb-0.5 text-center font-bold">π × D²</span>
                            <span className="px-1 pt-0.5 text-center font-bold">4</span>
                          </span>
                          <span className="ml-2">| &nbsp; μ = 0.50 (contrazione massima) &nbsp; | &nbsp; g = 9.806 m/s²</span>
                        </div>
                        <div className="text-xs text-slate-500 font-sans border-t border-slate-100 pt-2">
                          • Velocità effluente: <span className="font-mono font-bold text-slate-755">v = c<sub>v</sub> × √<span className="border-t border-slate-400 px-0.5 font-serif">2 × g × h</span></span> con c<sub>v</sub> = 0.98.
                        </div>
                      </div>
                    </div>
                  </>
                )}
                {data.foroTipo === 'tubo_esterno' && (
                  <>
                    <p><strong>Descrizione:</strong> Calcola la portata effluente da una luce circolare con tubo addizionale esterno (lunghezza &gt; 2 diametri), o ricava il battente/diametro necessario (incognita libera).</p>
                    <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-slate-600">
                      <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Equazioni di efflusso applicate:</p>
                      <div className="space-y-3 font-serif pl-2">
                        <div className="flex items-center gap-1 text-sm">
                          <span className="font-bold text-slate-800">Q = μ × A × √<span className="border-t border-slate-400 px-0.5">2 × g × h</span></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-sans">
                          <span>dove: &nbsp; A = </span>
                          <span className="inline-flex flex-col items-center align-middle mx-1 text-[10px] font-serif">
                            <span className="border-b border-slate-400 px-1 pb-0.5 text-center font-bold">π × D²</span>
                            <span className="px-1 pt-0.5 text-center font-bold">4</span>
                          </span>
                          <span className="ml-2">| &nbsp; μ = 0.82 (riattacco della vena) &nbsp; | &nbsp; g = 9.806 m/s²</span>
                        </div>
                        <div className="text-xs text-slate-500 font-sans border-t border-slate-100 pt-2">
                          • Velocità effluente: <span className="font-mono font-bold text-slate-755">v = c<sub>v</sub> × √<span className="border-t border-slate-400 px-0.5 font-serif">2 × g × h</span></span> con c<sub>v</sub> = 0.82.
                        </div>
                      </div>
                    </div>
                  </>
                )}
                {data.foroTipo === 'rettangolare' && (
                  <>
                    <p><strong>Descrizione:</strong> Calcola il deflusso attraverso luci a battente rettangolari di grandi dimensioni verticali, dove il carico idraulico varia sensibilmente lungo la sezione.</p>
                    <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-slate-600">
                      <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Equazione di efflusso (rettangolo grande):</p>
                      <div className="space-y-3 font-serif pl-2">
                        <div className="flex items-center gap-1 text-sm">
                          <span className="font-bold text-slate-800">Q = μ × </span>
                          <span className="inline-flex flex-col items-center align-middle mx-1 text-xs">
                            <span className="border-b border-slate-400 px-1 pb-0.5 text-center font-bold">2</span>
                            <span className="px-1 pt-0.5 text-center font-bold">3</span>
                          </span>
                          <span className="font-bold text-slate-800">× b × √<span className="border-t border-slate-400 px-0.5">2 × g</span> × (h₂<sup>1.5</sup> - h₁<sup>1.5</sup>)</span>
                        </div>
                        <p className="text-[10px] text-slate-450 font-sans leading-normal border-t border-slate-100 pt-2">* Con μ = 0.61 coefficiente di efflusso, b larghezza luce, h₁ battente superiore, h₂ battente inferiore.</p>
                      </div>
                    </div>
                  </>
                )}
                {data.foroTipo === 'stramazzo_grossa' && (
                  <>
                    <p><strong>Descrizione:</strong> Calcola il deflusso sopra una bocca a stramazzo a parete grossa (soglia larga), in condizioni di carico indisturbato a monte.</p>
                    <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-slate-600">
                      <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Equazione dello stramazzo a parete grossa:</p>
                      <div className="space-y-3 font-serif pl-2">
                        <div className="flex items-center gap-1 text-sm">
                          <span className="font-bold text-slate-800">Q = 1.705 × b × H<sup>1.5</sup></span>
                        </div>
                        <p className="text-[10px] text-slate-450 font-sans leading-normal border-t border-slate-100 pt-2">* Dove H è l'altezza del fluido indisturbato a monte della soglia. Valido per 2 H ≤ L ≤ 12 H (con L lunghezza della soglia nel senso del moto).</p>
                      </div>
                    </div>
                  </>
                )}
                {data.foroTipo === 'stramazzo_sottile' && (
                  <>
                    <p><strong>Descrizione:</strong> Calcola la portata effluente da uno stramazzo in parete sottile (o stramazzo Bazin) senza contrazione laterale.</p>
                    <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-slate-600">
                      <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Equazione dello stramazzo Bazin:</p>
                      <div className="space-y-3 font-serif pl-2">
                        <div className="flex items-center gap-1 text-sm">
                          <span className="font-bold text-slate-800">Q = μ × b × √<span className="border-t border-slate-400 px-0.5">2 × g</span> × h<sup>1.5</sup></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-sans">
                          <span>con: &nbsp; μ = (0.405 + </span>
                          <span className="inline-flex flex-col items-center align-middle mx-0.5 text-[10px] font-serif">
                            <span className="border-b border-slate-400 px-1 pb-0.5 text-center font-bold">0.003</span>
                            <span className="px-1 pt-0.5 text-center font-bold">h</span>
                          </span>
                          <span>) × [ 1 + 0.55 × (</span>
                          <span className="inline-flex flex-col items-center align-middle mx-0.5 text-[10px] font-serif">
                            <span className="border-b border-slate-400 px-1 pb-0.5 text-center font-bold">h</span>
                            <span className="px-1 pt-0.5 text-center font-bold">h + p</span>
                          </span>
                          <span>)² ]</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
                {/* Inputs */}
                <div className="space-y-4 print:hidden">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Dati di Calcolo (lascia vuota l'incognita)</p>
                  
                  {(data.foroTipo === 'circolare' || data.foroTipo === 'tubo_interno' || data.foroTipo === 'tubo_esterno') && (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Portata Q (m³/s)</label>
                        <input 
                          type="number" step="any" placeholder="Lascia vuoto per calcolare"
                          value={data.fcQ} onChange={e => updateField('fcQ', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.fcQ === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Carico Baricentrico h (m)</label>
                        <input 
                          type="number" step="any" placeholder="Lascia vuoto per calcolare"
                          value={data.fcH} onChange={e => updateField('fcH', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.fcH === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Diametro Luce D (m)</label>
                        <input 
                          type="number" step="any" placeholder="Lascia vuoto per calcolare"
                          value={data.fcD} onChange={e => updateField('fcD', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.fcD === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        />
                      </div>
                    </>
                  )}

                  {data.foroTipo === 'rettangolare' && (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Portata Q (m³/s)</label>
                        <input 
                          type="number" step="any" placeholder="Lascia vuoto per calcolare"
                          value={data.frQ} onChange={e => updateField('frQ', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.frQ === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Battente Superiore h₁ (m)</label>
                        <input 
                          type="number" step="any" placeholder="Lascia vuoto per calcolare"
                          value={data.frH1} onChange={e => updateField('frH1', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.frH1 === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Battente Inferiore h₂ (m)</label>
                        <input 
                          type="number" step="any" placeholder="Lascia vuoto per calcolare"
                          value={data.frH2} onChange={e => updateField('frH2', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.frH2 === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Larghezza Luce b (m)</label>
                        <input 
                          type="number" step="any" placeholder="Lascia vuoto per calcolare"
                          value={data.frB} onChange={e => updateField('frB', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.frB === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        />
                      </div>
                    </>
                  )}

                  {data.foroTipo === 'stramazzo_grossa' && (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Portata Q (m³/s)</label>
                        <input 
                          type="number" step="any" placeholder="Lascia vuoto per calcolare"
                          value={data.sgQ} onChange={e => updateField('sgQ', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.sgQ === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Larghezza Soglia b (m)</label>
                        <input 
                          type="number" step="any" placeholder="Lascia vuoto per calcolare"
                          value={data.sgB} onChange={e => updateField('sgB', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.sgB === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Carico Idraulico a Monte H (m)</label>
                        <input 
                          type="number" step="any" placeholder="Lascia vuoto per calcolare"
                          value={data.sgH} onChange={e => updateField('sgH', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.sgH === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        />
                      </div>
                    </>
                  )}

                  {data.foroTipo === 'stramazzo_sottile' && (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Portata Q (m³/s)</label>
                        <input 
                          type="number" step="any" placeholder="Lascia vuoto per calcolare"
                          value={data.ssQ} onChange={e => updateField('ssQ', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.ssQ === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Larghezza Soglia b (m)</label>
                        <input 
                          type="number" step="any" placeholder="Lascia vuoto per calcolare"
                          value={data.ssB} onChange={e => updateField('ssB', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.ssB === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">* Battente sopra la soglia h (m)</label>
                        <input 
                          type="number" step="any" 
                          value={data.ssH} onChange={e => updateField('ssH', e.target.value)}
                          className="w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50 border-slate-200 text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">* Altezza della soglia dal fondo p (m)</label>
                        <input 
                          type="number" step="any" 
                          value={data.ssP} onChange={e => updateField('ssP', e.target.value)}
                          className="w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50 border-slate-200 text-slate-700"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Tabella di riepilogo in stampa */}
                <div className="hidden print:block border border-slate-200 rounded-2xl p-4 space-y-2 text-[11px] w-full">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b pb-1 mb-2">Dati di Ingresso</p>
                  <div className="grid grid-cols-2 gap-y-1.5 text-slate-650">
                    <div><strong>Tipologia luce:</strong></div>
                    <div className="capitalize">{data.foroTipo.replace(/_/g, ' ')}</div>
                    {(data.foroTipo === 'circolare' || data.foroTipo === 'tubo_interno' || data.foroTipo === 'tubo_esterno') && (
                      <>
                        <div><strong>Portata Q:</strong></div>
                        <div>{data.fcQ !== '' ? `${formatNumber(data.fcQ, 4)} m³/s` : `INCOGNITA (Calcolato: ${formatNumber(foronomiaResults.computedFcQ, 4)} m³/s)`}</div>
                        <div><strong>Carico h:</strong></div>
                        <div>{data.fcH !== '' ? `${formatNumber(data.fcH, 3)} m` : `INCOGNITA (Calcolato: ${formatNumber(foronomiaResults.computedFcH, 3)} m)`}</div>
                        <div><strong>Diametro D:</strong></div>
                        <div>{data.fcD !== '' ? `${formatNumber(data.fcD, 3)} m` : `INCOGNITA (Calcolato: ${formatNumber(foronomiaResults.computedFcD, 3)} m)`}</div>
                      </>
                    )}
                    {data.foroTipo === 'rettangolare' && (
                      <>
                        <div><strong>Portata Q:</strong></div>
                        <div>{data.frQ !== '' ? `${formatNumber(data.frQ, 4)} m³/s` : `INCOGNITA (Calcolato: ${formatNumber(foronomiaResults.computedFrQ, 4)} m³/s)`}</div>
                        <div><strong>Battente sup. h₁:</strong></div>
                        <div>{data.frH1 !== '' ? `${formatNumber(data.frH1, 3)} m` : `INCOGNITA (Calcolato: ${formatNumber(foronomiaResults.computedFrH1, 3)} m)`}</div>
                        <div><strong>Battente inf. h₂:</strong></div>
                        <div>{data.frH2 !== '' ? `${formatNumber(data.frH2, 3)} m` : `INCOGNITA (Calcolato: ${formatNumber(foronomiaResults.computedFrH2, 3)} m)`}</div>
                        <div><strong>Larghezza b:</strong></div>
                        <div>{data.frB !== '' ? `${formatNumber(data.frB, 3)} m` : `INCOGNITA (Calcolato: ${formatNumber(foronomiaResults.computedFrB, 3)} m)`}</div>
                      </>
                    )}
                    {data.foroTipo === 'stramazzo_grossa' && (
                      <>
                        <div><strong>Portata Q:</strong></div>
                        <div>{data.sgQ !== '' ? `${formatNumber(data.sgQ, 4)} m³/s` : `INCOGNITA (Calcolato: ${formatNumber(foronomiaResults.computedSgQ, 4)} m³/s)`}</div>
                        <div><strong>Larghezza b:</strong></div>
                        <div>{data.sgB !== '' ? `${formatNumber(data.sgB, 3)} m` : `INCOGNITA (Calcolato: ${formatNumber(foronomiaResults.computedSgB, 3)} m)`}</div>
                        <div><strong>Carico monte H:</strong></div>
                        <div>{data.sgH !== '' ? `${formatNumber(data.sgH, 3)} m` : `INCOGNITA (Calcolato: ${formatNumber(foronomiaResults.computedSgH, 3)} m)`}</div>
                      </>
                    )}
                    {data.foroTipo === 'stramazzo_sottile' && (
                      <>
                        <div><strong>Portata Q:</strong></div>
                        <div>{data.ssQ !== '' ? `${formatNumber(data.ssQ, 4)} m³/s` : `INCOGNITA (Calcolato: ${formatNumber(foronomiaResults.computedSsQ, 4)} m³/s)`}</div>
                        <div><strong>Larghezza b:</strong></div>
                        <div>{data.ssB !== '' ? `${formatNumber(data.ssB, 3)} m` : `INCOGNITA (Calcolato: ${formatNumber(foronomiaResults.computedSsB, 3)} m)`}</div>
                        <div><strong>Battente h:</strong></div>
                        <div>{formatNumber(data.ssH, 3)} m</div>
                        <div><strong>Altezza p:</strong></div>
                        <div>{formatNumber(data.ssP, 3)} m</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Risultato / Output */}
                <div className="bg-blue-50/50 border border-blue-200/60 rounded-3xl p-6 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider mb-4 border-b border-blue-200 pb-1.5 font-sans">Risultati di Efflusso</p>
                    
                    {(data.foroTipo === 'circolare' || data.foroTipo === 'tubo_interno' || data.foroTipo === 'tubo_esterno') && (
                      <div className="space-y-4">
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Portata (Q)</p>
                          <p className={`text-2xl font-mono font-black ${foronomiaResults.fcIncognita === 'Q' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(foronomiaResults.computedFcQ, 4)} <span className="text-xs font-sans font-normal text-slate-450">m³/s</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Diametro (D)</p>
                          <p className={`text-2xl font-mono font-black ${foronomiaResults.fcIncognita === 'D' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(foronomiaResults.computedFcD, 3)} <span className="text-xs font-sans font-normal text-slate-450">m</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Carico Baricentrico (h)</p>
                          <p className={`text-2xl font-mono font-black ${foronomiaResults.fcIncognita === 'h' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(foronomiaResults.computedFcH, 3)} <span className="text-xs font-sans font-normal text-slate-450">m</span>
                          </p>
                        </div>
                        <div className="border-t border-blue-200/35 pt-3 text-[11px] text-slate-650 leading-relaxed">
                          <strong>Velocità vena contratta v:</strong> {formatNumber(foronomiaResults.computedFcV, 3)} m/s
                        </div>
                      </div>
                    )}

                    {data.foroTipo === 'rettangolare' && (
                      <div className="space-y-4">
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Portata (Q)</p>
                          <p className={`text-2xl font-mono font-black ${foronomiaResults.frIncognita === 'Q' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(foronomiaResults.computedFrQ, 4)} <span className="text-xs font-sans font-normal text-slate-450">m³/s</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Larghezza Luce (b)</p>
                          <p className={`text-2xl font-mono font-black ${foronomiaResults.frIncognita === 'b' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(foronomiaResults.computedFrB, 3)} <span className="text-xs font-sans font-normal text-slate-450">m</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Battente superiore (h₁)</p>
                          <p className={`text-2xl font-mono font-black ${foronomiaResults.frIncognita === 'h1' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(foronomiaResults.computedFrH1, 3)} <span className="text-xs font-sans font-normal text-slate-450">m</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Battente inferiore (h₂)</p>
                          <p className={`text-2xl font-mono font-black ${foronomiaResults.frIncognita === 'h2' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(foronomiaResults.computedFrH2, 3)} <span className="text-xs font-sans font-normal text-slate-450">m</span>
                          </p>
                        </div>
                      </div>
                    )}

                    {data.foroTipo === 'stramazzo_grossa' && (
                      <div className="space-y-4">
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Portata (Q)</p>
                          <p className={`text-2xl font-mono font-black ${foronomiaResults.sgIncognita === 'Q' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(foronomiaResults.computedSgQ, 4)} <span className="text-xs font-sans font-normal text-slate-450">m³/s</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Larghezza Soglia (b)</p>
                          <p className={`text-2xl font-mono font-black ${foronomiaResults.sgIncognita === 'b' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(foronomiaResults.computedSgB, 3)} <span className="text-xs font-sans font-normal text-slate-450">m</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Carico Idraulico Monte (H)</p>
                          <p className={`text-2xl font-mono font-black ${foronomiaResults.sgIncognita === 'H' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(foronomiaResults.computedSgH, 3)} <span className="text-xs font-sans font-normal text-slate-450">m</span>
                          </p>
                        </div>
                        <div className="border-t border-blue-200/35 pt-3 text-[11px] text-slate-650 leading-relaxed">
                          <strong>Altezza vena fluida h (2/3 H):</strong> {formatNumber(foronomiaResults.computedSgHv, 3)} m
                        </div>
                      </div>
                    )}

                    {data.foroTipo === 'stramazzo_sottile' && (
                      <div className="space-y-4">
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Portata (Q)</p>
                          <p className={`text-2xl font-mono font-black ${foronomiaResults.ssIncognita === 'Q' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(foronomiaResults.computedSsQ, 4)} <span className="text-xs font-sans font-normal text-slate-450">m³/s</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Larghezza Soglia (b)</p>
                          <p className={`text-2xl font-mono font-black ${foronomiaResults.ssIncognita === 'b' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(foronomiaResults.computedSsB, 3)} <span className="text-xs font-sans font-normal text-slate-450">m</span>
                          </p>
                        </div>
                        <div className="border-t border-blue-200/35 pt-3 text-[11px] text-slate-650 space-y-1.5">
                          <div><strong>Coefficiente efflusso Bazin (μ):</strong> {formatNumber(foronomiaResults.computedSsMu, 4)}</div>
                          <div><strong>Carico monte totale H (h+p):</strong> {formatNumber(parseFloat(data.ssH) + parseFloat(data.ssP), 3)} m</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-blue-200/50 text-[10px] text-slate-400 leading-normal font-sans">
                    {(data.foroTipo === 'circolare' || data.foroTipo === 'tubo_interno' || data.foroTipo === 'tubo_esterno') && foronomiaResults.fcIncognita === 'invalid' && <span className="text-red-500 font-bold">⚠️ Lascia vuoto esattamente un campo tra Q, h, D.</span>}
                    {(data.foroTipo === 'circolare' || data.foroTipo === 'tubo_interno' || data.foroTipo === 'tubo_esterno') && foronomiaResults.fcIncognita !== 'invalid' && <span>Risoluzione effettuata per incognita: <strong>{foronomiaResults.fcIncognita}</strong></span>}

                    {data.foroTipo === 'rettangolare' && foronomiaResults.frIncognita === 'invalid' && <span className="text-red-500 font-bold">⚠️ Lascia vuoto esattamente un campo tra Q, h₁, h₂, b.</span>}
                    {data.foroTipo === 'rettangolare' && foronomiaResults.frIncognita !== 'invalid' && <span>Risoluzione effettuata per incognita: <strong>{foronomiaResults.frIncognita}</strong></span>}

                    {data.foroTipo === 'stramazzo_grossa' && foronomiaResults.sgIncognita === 'invalid' && <span className="text-red-500 font-bold">⚠️ Lascia vuoto esattamente un campo tra Q, b, H.</span>}
                    {data.foroTipo === 'stramazzo_grossa' && foronomiaResults.sgIncognita !== 'invalid' && <span>Risoluzione effettuata per incognita: <strong>{foronomiaResults.sgIncognita}</strong></span>}

                    {data.foroTipo === 'stramazzo_sottile' && foronomiaResults.ssIncognita === 'invalid' && <span className="text-red-500 font-bold">⚠️ Lascia vuoto solo Q o b. h e p sono necessari.</span>}
                    {data.foroTipo === 'stramazzo_sottile' && foronomiaResults.ssIncognita !== 'invalid' && <span>Risoluzione effettuata per incognita: <strong>{foronomiaResults.ssIncognita}</strong></span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 6. Tempo di Svuotamento Serbatoio */}
          {data.activeSubTool === 'svuotamento' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 animate-in fade-in duration-200">
              <h3 className="text-base font-black text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <span className="p-1 bg-blue-100 text-brand-600 rounded-lg"><Clock className="w-4 h-4" /></span>
                Tempo di Svuotamento Serbatoio
              </h3>

              {/* Sub-tabs per tipologia serbatoio */}
              <div className="flex flex-wrap gap-1.5 mb-5 print:hidden">
                {[
                  { id: 'cilindrico_vert', label: 'Cilindrico Verticale' },
                  { id: 'cilindrico_oriz', label: 'Cilindrico Orizzontale' },
                  { id: 'sferico', label: 'Sferico' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => updateField('svTipo', tab.id as any)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      data.svTipo === tab.id 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Spiegazione & Formula */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 text-xs text-slate-650 space-y-2.5 print:hidden">
                {data.svTipo === 'cilindrico_vert' && (
                  <>
                    <p><strong>Descrizione:</strong> Calcola il tempo di svuotamento gravitazionale completo per un serbatoio cilindrico verticale a fondo piatto, o ricava uno dei parametri dimensionali (incognita libera).</p>
                    <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-slate-600">
                      <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Formula di Torricelli (Cilindro Verticale):</p>
                      <div className="space-y-3 font-serif pl-2">
                        <div className="flex items-center gap-1 text-sm">
                          <span className="font-bold text-slate-800">T = 0.553114 × </span>
                          <span className="inline-flex flex-col items-center align-middle mx-1 text-xs">
                            <span className="border-b border-slate-400 px-1.5 pb-0.5 text-center font-bold">D² × √<span className="border-t border-slate-400 px-0.5">H</span></span>
                            <span className="px-1.5 pt-0.5 text-center font-bold">d²</span>
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-455 font-sans leading-normal border-t border-slate-100 pt-2">* T in secondi, D diametro serbatoio [m], H altezza acqua iniziale [m], d diametro foro [m]. Basata su coefficiente di efflusso contrazione μ ≈ 0.816.</p>
                      </div>
                    </div>
                  </>
                )}
                {data.svTipo === 'cilindrico_oriz' && (
                  <>
                    <p><strong>Descrizione:</strong> Calcola il tempo di svuotamento di un serbatoio cilindrico orizzontale a fondo circolare e teste piatte (estensione premium).</p>
                    <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-slate-600">
                      <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Equazione analitica integrata (Cilindro Orizzontale):</p>
                      <div className="space-y-3 font-serif pl-2">
                        <div className="flex items-center gap-1 text-sm">
                          <span className="font-bold text-slate-800">T = </span>
                          <span className="inline-flex flex-col items-center align-middle mx-1 text-xs">
                            <span className="border-b border-slate-400 px-1.5 pb-0.5 text-center font-bold">8 × 0.553114 × L × ( D<sup>1.5</sup> - (D - H)<sup>1.5</sup> )</span>
                            <span className="px-1.5 pt-0.5 text-center font-bold">3 × π × d²</span>
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-455 font-sans leading-normal border-t border-slate-100 pt-2">* L rappresenta la lunghezza del cilindro [m]. Valido per svuotamento totale partendo da H.</p>
                      </div>
                    </div>
                  </>
                )}
                {data.svTipo === 'sferico' && (
                  <>
                    <p><strong>Descrizione:</strong> Calcola il tempo di svuotamento di un serbatoio sferico a riempimento parziale con foro sul fondo (estensione premium).</p>
                    <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-slate-600">
                      <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Equazione analitica integrata (Serbatoio Sferico):</p>
                      <div className="space-y-3 font-serif pl-2">
                        <div className="flex items-center gap-1 text-sm">
                          <span className="font-bold text-slate-800">T = </span>
                          <span className="inline-flex flex-col items-center align-middle mx-1 text-xs">
                            <span className="border-b border-slate-400 px-1.5 pb-0.5 text-center font-bold">2 × 0.553114 × H<sup>1.5</sup></span>
                            <span className="px-1.5 pt-0.5 text-center font-bold">d²</span>
                          </span>
                          <span className="font-bold text-slate-800">× ( </span>
                          <span className="inline-flex flex-col items-center align-middle mx-1 text-xs">
                            <span className="border-b border-slate-400 px-1.5 pb-0.5 text-center font-bold">2</span>
                            <span className="px-1.5 pt-0.5 text-center font-bold">3</span>
                          </span>
                          <span className="font-bold text-slate-800">D - </span>
                          <span className="inline-flex flex-col items-center align-middle mx-1 text-xs">
                            <span className="border-b border-slate-400 px-1.5 pb-0.5 text-center font-bold">2</span>
                            <span className="px-1.5 pt-0.5 text-center font-bold">5</span>
                          </span>
                          <span className="font-bold text-slate-800">H )</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
                {/* Inputs */}
                <div className="space-y-4 print:hidden">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Dati di Calcolo (lascia vuota l'incognita)</p>
                  
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Diametro Serbatoio D (m)</label>
                    <input 
                      type="number" step="any" placeholder="Lascia vuoto per calcolare"
                      value={data.svD} onChange={e => updateField('svD', e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.svD === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Diametro Foro Scarico d (m)</label>
                    <input 
                      type="number" step="any" placeholder="Lascia vuoto per calcolare (es. 0.05 per 50mm)"
                      value={data.svOrificeD} onChange={e => updateField('svOrificeD', e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.svOrificeD === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Altezza Iniziale Acqua H (m)</label>
                    <input 
                      type="number" step="any" placeholder="Lascia vuoto per calcolare"
                      value={data.svH} onChange={e => updateField('svH', e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.svH === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    />
                  </div>

                  {data.svTipo === 'cilindrico_oriz' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Lunghezza Serbatoio L (m)</label>
                      <input 
                        type="number" step="any" placeholder="Lascia vuoto per calcolare"
                        value={data.svL} onChange={e => updateField('svL', e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.svL === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Tempo di Svuotamento T (s)</label>
                    <input 
                      type="number" step="any" placeholder="Lascia vuoto per calcolare"
                      value={data.svT} onChange={e => updateField('svT', e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.svT === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    />
                  </div>
                </div>

                {/* Tabella di riepilogo in stampa */}
                <div className="hidden print:block border border-slate-200 rounded-2xl p-4 space-y-2 text-[11px] w-full">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b pb-1 mb-2 font-sans">Dati di Ingresso</p>
                  <div className="grid grid-cols-2 gap-y-1.5 text-slate-650">
                    <div><strong>Geometria serbatoio:</strong></div>
                    <div className="capitalize">{data.svTipo.replace('_', ' ')}</div>
                    <div><strong>Diametro serbatoio D:</strong></div>
                    <div>{data.svD !== '' ? `${formatNumber(data.svD, 2)} m` : `INCOGNITA (Calcolato: ${formatNumber(svuotamentoResults.computedD, 3)} m)`}</div>
                    <div><strong>Foro scarico d:</strong></div>
                    <div>{data.svOrificeD !== '' ? `${formatNumber(parseFloat(data.svOrificeD)*1000, 0)} mm` : `INCOGNITA (Calcolato: ${formatNumber(svuotamentoResults.computedOrificeD*1000, 1)} mm)`}</div>
                    <div><strong>Altezza acqua H:</strong></div>
                    <div>{data.svH !== '' ? `${formatNumber(data.svH, 2)} m` : `INCOGNITA (Calcolato: ${formatNumber(svuotamentoResults.computedH, 3)} m)`}</div>
                    {data.svTipo === 'cilindrico_oriz' && (
                      <>
                        <div><strong>Lunghezza L:</strong></div>
                        <div>{data.svL !== '' ? `${formatNumber(data.svL, 2)} m` : `INCOGNITA (Calcolato: ${formatNumber(svuotamentoResults.computedL, 3)} m)`}</div>
                      </>
                    )}
                    <div><strong>Tempo svuotamento T:</strong></div>
                    <div>{data.svT !== '' ? `${formatNumber(data.svT, 1)} s` : `INCOGNITA (Calcolato: ${formatNumber(svuotamentoResults.computedT, 1)} s)`}</div>
                  </div>
                </div>

                {/* Risultato / Output */}
                <div className="bg-blue-50/50 border border-blue-200/60 rounded-3xl p-6 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider mb-4 border-b border-blue-200 pb-1.5 font-sans">Risoluzione Svuotamento</p>
                    
                    <div className="space-y-4">
                      <div>
                        <p className="text-slate-500 text-[10px] uppercase font-bold">Tempo di Svuotamento (T)</p>
                        <p className={`text-2xl font-mono font-black ${svuotamentoResults.svIncognita === 'T' ? 'text-blue-700' : 'text-slate-800'}`}>
                          {formatNumber(svuotamentoResults.computedT, 1)} <span className="text-xs font-sans font-normal text-slate-450">s</span>
                        </p>
                        <p className="text-xs text-slate-500 font-mono">
                          ≈ {formatNumber(svuotamentoResults.computedT / 60, 2)} minuti
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-500 text-[10px] uppercase font-bold">Diametro Serbatoio (D)</p>
                        <p className={`text-2xl font-mono font-black ${svuotamentoResults.svIncognita === 'D' ? 'text-blue-700' : 'text-slate-800'}`}>
                          {formatNumber(svuotamentoResults.computedD, 3)} <span className="text-xs font-sans font-normal text-slate-450">m</span>
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-500 text-[10px] uppercase font-bold">Foro di Scarico (d)</p>
                        <p className={`text-2xl font-mono font-black ${svuotamentoResults.svIncognita === 'd' ? 'text-blue-700' : 'text-slate-800'}`}>
                          {formatNumber(svuotamentoResults.computedOrificeD * 1000, 1)} <span className="text-xs font-sans font-normal text-slate-450">mm</span>
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-500 text-[10px] uppercase font-bold">Livello Acqua Iniziale (H)</p>
                        <p className={`text-2xl font-mono font-black ${svuotamentoResults.svIncognita === 'H' ? 'text-blue-700' : 'text-slate-800'}`}>
                          {formatNumber(svuotamentoResults.computedH, 3)} <span className="text-xs font-sans font-normal text-slate-450">m</span>
                        </p>
                      </div>

                      {data.svTipo === 'cilindrico_oriz' && (
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Lunghezza Cilindro (L)</p>
                          <p className={`text-2xl font-mono font-black ${svuotamentoResults.svIncognita === 'L' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(svuotamentoResults.computedL, 3)} <span className="text-xs font-sans font-normal text-slate-450">m</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-blue-200/50 text-[10px] text-slate-400 leading-normal font-sans">
                    {svuotamentoResults.svIncognita === 'invalid' ? (
                      <span className="text-red-500 font-bold">⚠️ Errore: Assicurati di lasciare vuota esattamente una casella con valori fisicamente plausibili.</span>
                    ) : (
                      <span>Risoluzione effettuata per incognita: <strong>{svuotamentoResults.svIncognita === 'd' ? 'd (Ø foro)' : svuotamentoResults.svIncognita}</strong></span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 7. Condotte a Pelo Libero (Fase 3) */}
          {data.activeSubTool === 'pelo_libero' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 animate-in fade-in duration-200">
              <h3 className="text-base font-black text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <span className="p-1 bg-blue-100 text-brand-600 rounded-lg"><Droplet className="w-4 h-4" /></span>
                Calcolo Condotte a Pelo Libero
              </h3>

              {/* Sub-tabs per tipologia */}
              <div className="flex flex-wrap gap-1.5 mb-5 print:hidden">
                {[
                  { id: 'circolare', label: 'Condotta Circolare (Gauckler-Strickler)' },
                  { id: 'rettangolare', label: 'Canale Rettangolare (Chézy-Bazin)' },
                  { id: 'khafagi_venturi', label: 'Canale Khafagi-Venturi' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => updateField('plTipo', tab.id as any)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      data.plTipo === tab.id 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Spiegazione & Formula */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 text-xs text-slate-650 space-y-2.5 print:hidden">
                {data.plTipo === 'circolare' && (
                  <>
                    <p><strong>Descrizione:</strong> Calcola la portata e la velocità in una condotta circolare parzialmente riempita (fognatura a gravità), o determina uno dei parametri geometrici/scabrezza ad incognita libera.</p>
                    <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-slate-600">
                      <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Equazione di Gauckler-Strickler:</p>
                      <div className="space-y-3 font-serif pl-2">
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="font-bold text-slate-800">Q = K<sub>s</sub> × R<sub>h</sub><sup>2/3</sup> × √<span className="border-t border-slate-400 px-0.5">i</span> × A</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans leading-normal border-t border-slate-100 pt-2 space-y-1">
                          <p>* <strong>Q:</strong> Portata [m³/s], <strong>K<sub>s</sub>:</strong> Coefficiente di Strickler [m¹/³/s], <strong>i:</strong> Pendenza [m/m].</p>
                          <p>* <strong>A:</strong> Area bagnata [m²], <strong>R<sub>h</sub>:</strong> Raggio idraulico [m] (Area / Perimetro bagnato).</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                {data.plTipo === 'rettangolare' && (
                  <>
                    <p><strong>Descrizione:</strong> Calcola la portata e la velocità in un canale rettangolare a pelo libero (o corso d'acqua/ruscello) utilizzando le formule di Chézy e Bazin.</p>
                    <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-slate-600">
                      <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Formule applicate (Chézy-Bazin):</p>
                      <div className="space-y-3 font-serif pl-2">
                        <div className="flex flex-col gap-2 text-sm">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-800">Q = χ × A × √<span className="border-t border-slate-400 px-0.5">R<sub>h</sub> × i</span></span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-sans">
                            <span>con coefficiente di Chézy (Bazin): &nbsp; χ = </span>
                            <span className="inline-flex flex-col items-center align-middle mx-1 text-[11px] font-serif">
                              <span className="border-b border-slate-400 px-2 pb-0.5 text-center font-bold">87</span>
                              <span className="px-2 pt-0.5 text-center font-bold">1 + c / √<span className="border-t border-slate-400 px-0.5 font-serif">R<sub>h</sub></span></span>
                            </span>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans leading-normal border-t border-slate-100 pt-2 space-y-1">
                          <p>* <strong>Q:</strong> Portata [m³/s], <strong>b:</strong> Larghezza canale [m], <strong>h:</strong> Altezza acqua [m].</p>
                          <p>* <strong>i:</strong> Pendenza [m/m], <strong>c:</strong> Parametro di scabrezza di Bazin [m<sup>1/2</sup>].</p>
                          <p>* <strong>A:</strong> Area bagnata (b × h) [m²], <strong>R<sub>h</sub>:</strong> Raggio idraulico [m] (A / (b + 2h)).</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                {data.plTipo === 'khafagi_venturi' && (
                  <>
                    <p><strong>Descrizione:</strong> Calcola la portata passante in un canale di misura Khafagi-Venturi secondo la taratura del laboratorio dell'Università di Stoccarda.</p>
                    <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-slate-600">
                      <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Formula di Stoccarda:</p>
                      <div className="space-y-3 font-serif pl-2">
                        <div className="flex flex-col gap-1.5 text-sm">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-800">Q = b × 1.744 × h<sup>1.5</sup> + 0.091 × h<sup>2.5</sup></span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-800">b = 0.4 × B</span>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans leading-normal border-t border-slate-100 pt-2">
                          <p>* <strong>Q:</strong> Portata [m³/s], <strong>B:</strong> Larghezza canale [m], <strong>h:</strong> Altezza misurata a monte [m].</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
                {/* Inputs */}
                <div className="space-y-4 print:hidden">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Dati di Calcolo (lascia vuota l'incognita)</p>
                  
                  {data.plTipo === 'circolare' && (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Diametro Interno Condotta D (m)</label>
                        <input 
                          type="number" step="any" placeholder="Lascia vuoto per calcolare"
                          value={data.plcD} onChange={e => updateField('plcD', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.plcD === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Grado di Riempimento % (0.01 - 100)</label>
                        <input 
                          type="number" step="any" placeholder="Lascia vuoto per calcolare (es. 50 per metà condotta)"
                          value={data.plcGrado} onChange={e => updateField('plcGrado', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.plcGrado === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Pendenza Canale i (m/m)</label>
                        <input 
                          type="number" step="any" placeholder="Lascia vuoto per calcolare (es. 0.01 per 1%)"
                          value={data.plcI} onChange={e => updateField('plcI', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.plcI === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Coeff. Scabrezza Strickler Ks (m¹/³/s)</label>
                        <input 
                          type="number" step="any" placeholder="Lascia vuoto per calcolare (es. 70-80 per plastica)"
                          value={data.plcKs} onChange={e => updateField('plcKs', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.plcKs === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Portata Condotta Q (m³/s)</label>
                        <input 
                          type="number" step="any" placeholder="Lascia vuoto per calcolare"
                          value={data.plcQ} onChange={e => updateField('plcQ', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.plcQ === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        />
                      </div>
                    </>
                  )}

                  {data.plTipo === 'rettangolare' && (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Larghezza Canale b (m)</label>
                        <input 
                          type="number" step="any" placeholder="es. 1.0"
                          value={data.plrB} onChange={e => updateField('plrB', e.target.value)}
                          className="w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50 border-slate-200 text-slate-700"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Altezza Acqua h (m)</label>
                        <input 
                          type="number" step="any" placeholder="es. 0.03"
                          value={data.plrH} onChange={e => updateField('plrH', e.target.value)}
                          className="w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50 border-slate-200 text-slate-700"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Pendenza Canale p (m/m)</label>
                        <input 
                          type="number" step="any" placeholder="es. 0.01 per 1%"
                          value={data.plrI} onChange={e => updateField('plrI', e.target.value)}
                          className="w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50 border-slate-200 text-slate-700"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Scabrezza Bazin c</label>
                        <input 
                          type="number" step="any" placeholder="es. 0.30"
                          value={data.plrC} onChange={e => updateField('plrC', e.target.value)}
                          className="w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50 border-slate-200 text-slate-700"
                        />
                        <div className="flex flex-wrap gap-1 mt-1.5 ml-0.5">
                          {[
                            { val: '0.05', label: 'Plastica' },
                            { val: '0.10', label: 'Cem. Liscio' },
                            { val: '0.15', label: 'Muratura Reg.' },
                            { val: '0.30', label: 'Ciottoli' },
                            { val: '0.35', label: 'Cem. Degradato' }
                          ].map(item => (
                            <button
                              key={item.val}
                              type="button"
                              onClick={() => updateField('plrC', item.val)}
                              className={`px-1.5 py-0.5 text-[9px] font-bold rounded-lg border transition-all cursor-pointer ${
                                data.plrC === item.val
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {data.plTipo === 'khafagi_venturi' && (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Larghezza Canale B (m)</label>
                        <input 
                          type="number" step="any" placeholder="Lascia vuoto per calcolare"
                          value={data.pkvB} onChange={e => updateField('pkvB', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.pkvB === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Altezza Misurata a Monte h (m)</label>
                        <input 
                          type="number" step="any" placeholder="Lascia vuoto per calcolare"
                          value={data.pkvH} onChange={e => updateField('pkvH', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.pkvH === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Portata Calcolata Q (m³/s)</label>
                        <input 
                          type="number" step="any" placeholder="Lascia vuoto per calcolare"
                          value={data.pkvQ} onChange={e => updateField('pkvQ', e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 ${data.pkvQ === '' ? 'bg-amber-50 border-amber-300 font-bold text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Tabella di riepilogo in stampa */}
                <div className="hidden print:block border border-slate-200 rounded-2xl p-4 space-y-2 text-[11px] w-full">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b pb-1 mb-2 font-sans">Dati di Ingresso e Risultati</p>
                  
                  {data.plTipo === 'circolare' && (
                    <div className="grid grid-cols-2 gap-y-1.5 text-slate-650">
                      <div><strong>Tipo di Calcolo:</strong></div>
                      <div>Condotta Circolare (Strickler)</div>
                      
                      <div><strong>Diametro D:</strong></div>
                      <div>{data.plcD !== '' ? `${formatNumber(data.plcD, 3)} m` : `INCOGNITA (Calcolato: ${formatNumber(peloLiberoResults.computedPlcD, 3)} m)`}</div>
                      
                      <div><strong>Grado Riempimento:</strong></div>
                      <div>{data.plcGrado !== '' ? `${formatNumber(data.plcGrado, 1)} %` : `INCOGNITA (Calcolato: ${formatNumber(peloLiberoResults.computedPlcGrado, 1)} %)`}</div>
                      
                      <div><strong>Pendenza i:</strong></div>
                      <div>{data.plcI !== '' ? `${formatNumber(data.plcI, 5)} m/m` : `INCOGNITA (Calcolato: ${formatNumber(peloLiberoResults.computedPlcI, 5)} m/m)`}</div>
                      
                      <div><strong>Coeff. Strickler Ks:</strong></div>
                      <div>{data.plcKs !== '' ? `${formatNumber(data.plcKs, 1)}` : `INCOGNITA (Calcolato: ${formatNumber(peloLiberoResults.computedPlcKs, 1)})`}</div>

                      <div><strong>Portata Q:</strong></div>
                      <div>{data.plcQ !== '' ? `${formatNumber(data.plcQ, 4)} m³/s` : `INCOGNITA (Calcolato: ${formatNumber(peloLiberoResults.computedPlcQ, 4)} m³/s)`}</div>

                      <div><strong>Velocità V:</strong></div>
                      <div>{formatNumber(peloLiberoResults.computedPlcV, 3)} m/s</div>
                    </div>
                  )}

                  {data.plTipo === 'rettangolare' && (
                    <div className="grid grid-cols-2 gap-y-1.5 text-slate-650">
                      <div><strong>Tipo di Calcolo:</strong></div>
                      <div>Canale Rettangolare (Bazin)</div>
                      
                      <div><strong>Larghezza b:</strong></div>
                      <div>{formatNumber(parseFloat(data.plrB) || 0, 3)} m</div>
                      
                      <div><strong>Altezza h:</strong></div>
                      <div>{formatNumber(parseFloat(data.plrH) || 0, 3)} m</div>
                      
                      <div><strong>Pendenza p:</strong></div>
                      <div>{formatNumber(parseFloat(data.plrI) || 0, 5)} m/m</div>
                      
                      <div><strong>Scabrezza Bazin c:</strong></div>
                      <div>{formatNumber(parseFloat(data.plrC) || 0, 2)}</div>

                      <div><strong>Portata Q:</strong></div>
                      <div>{formatNumber(peloLiberoResults.computedPlrQ, 4)} m³/s (≈ {formatNumber(peloLiberoResults.computedPlrQ * 1000, 2)} l/s)</div>

                      <div><strong>Velocità V:</strong></div>
                      <div>{formatNumber(peloLiberoResults.computedPlrV, 3)} m/s</div>

                      <div><strong>Raggio Idraulico Rh:</strong></div>
                      <div>{formatNumber(peloLiberoResults.plrRh, 4)} m</div>

                      <div><strong>Coeff. Chézy χ:</strong></div>
                      <div>{formatNumber(peloLiberoResults.plrChi, 2)}</div>
                    </div>
                  )}

                  {data.plTipo === 'khafagi_venturi' && (
                    <div className="grid grid-cols-2 gap-y-1.5 text-slate-650">
                      <div><strong>Tipo di Calcolo:</strong></div>
                      <div>Canale Khafagi-Venturi (Stoccarda)</div>

                      <div><strong>Larghezza B:</strong></div>
                      <div>{data.pkvB !== '' ? `${formatNumber(data.pkvB, 3)} m` : `INCOGNITA (Calcolato: ${formatNumber(peloLiberoResults.computedPkvB, 3)} m)`}</div>

                      <div><strong>Carico h:</strong></div>
                      <div>{data.pkvH !== '' ? `${formatNumber(data.pkvH, 3)} m` : `INCOGNITA (Calcolato: ${formatNumber(peloLiberoResults.computedPkvH, 3)} m)`}</div>

                      <div><strong>Portata Q:</strong></div>
                      <div>{data.pkvQ !== '' ? `${formatNumber(data.pkvQ, 4)} m³/s` : `INCOGNITA (Calcolato: ${formatNumber(peloLiberoResults.computedPkvQ, 4)} m³/s)`}</div>
                    </div>
                  )}
                </div>

                {/* Risultato / Output */}
                <div className="bg-blue-50/50 border border-blue-200/60 rounded-3xl p-6 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider mb-4 border-b border-blue-200 pb-1.5 font-sans">Risoluzione Idraulica</p>
                    
                    {data.plTipo === 'circolare' && (
                      <div className="space-y-4">
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Portata (Q)</p>
                          <p className={`text-2xl font-mono font-black ${peloLiberoResults.plcIncognita === 'Q' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(peloLiberoResults.computedPlcQ, 4)} <span className="text-xs font-sans font-normal text-slate-450">m³/s</span>
                          </p>
                        </div>

                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Diametro (D)</p>
                          <p className={`text-2xl font-mono font-black ${peloLiberoResults.plcIncognita === 'D' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(peloLiberoResults.computedPlcD, 3)} <span className="text-xs font-sans font-normal text-slate-450">m</span>
                          </p>
                        </div>

                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Grado Riempimento (w)</p>
                          <p className={`text-2xl font-mono font-black ${peloLiberoResults.plcIncognita === 'grado' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(peloLiberoResults.computedPlcGrado, 1)} <span className="text-xs font-sans font-normal text-slate-450">%</span>
                          </p>
                        </div>

                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Pendenza (i)</p>
                          <p className={`text-2xl font-mono font-black ${peloLiberoResults.plcIncognita === 'i' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(peloLiberoResults.computedPlcI, 5)} <span className="text-xs font-sans font-normal text-slate-450">m/m</span>
                          </p>
                        </div>

                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Scabrezza (Ks)</p>
                          <p className={`text-2xl font-mono font-black ${peloLiberoResults.plcIncognita === 'Ks' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(peloLiberoResults.computedPlcKs, 1)} <span className="text-xs font-sans font-normal text-slate-450">m¹/³/s</span>
                          </p>
                        </div>

                        <div className="border-t border-blue-200/35 pt-3 text-[11px] text-slate-655 leading-relaxed">
                          <strong>Velocità del flusso (V):</strong> {formatNumber(peloLiberoResults.computedPlcV, 3)} m/s
                        </div>
                      </div>
                    )}

                    {data.plTipo === 'rettangolare' && (
                      <div className="space-y-4">
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Portata (Q)</p>
                          <p className="text-2xl font-mono font-black text-slate-800">
                            {formatNumber(peloLiberoResults.computedPlrQ, 4)} <span className="text-xs font-sans font-normal text-slate-450">m³/s</span>
                          </p>
                          <p className="text-xs text-slate-500 font-mono">
                            ≈ {formatNumber(peloLiberoResults.computedPlrQ * 1000, 2)} l/s
                          </p>
                          <p className="text-xs text-slate-550 font-mono">
                            ≈ {formatNumber(peloLiberoResults.computedPlrQ * 3600, 1)} m³/h
                          </p>
                        </div>

                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Velocità del flusso (V)</p>
                          <p className="text-2xl font-mono font-black text-slate-800">
                            {formatNumber(peloLiberoResults.computedPlrV, 3)} <span className="text-xs font-sans font-normal text-slate-450">m/s</span>
                          </p>
                        </div>

                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Raggio Idraulico (R<sub>h</sub>)</p>
                          <p className="text-2xl font-mono font-black text-slate-800">
                            {formatNumber(peloLiberoResults.plrRh, 4)} <span className="text-xs font-sans font-normal text-slate-450">m</span>
                          </p>
                        </div>

                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Coeff. di Chézy (χ)</p>
                          <p className="text-2xl font-mono font-black text-slate-800">
                            {formatNumber(peloLiberoResults.plrChi, 2)}
                          </p>
                        </div>

                        <div className="border-t border-blue-200/35 pt-3 text-[11px] text-slate-655 leading-relaxed space-y-1">
                          <div><strong>Area bagnata (A):</strong> {formatNumber(peloLiberoResults.plrArea, 4)} m²</div>
                          <div><strong>Perimetro bagnato (P):</strong> {formatNumber(peloLiberoResults.plrPerimeter, 3)} m</div>
                        </div>
                      </div>
                    )}

                    {data.plTipo === 'khafagi_venturi' && (
                      <div className="space-y-4">
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Portata (Q)</p>
                          <p className={`text-2xl font-mono font-black ${peloLiberoResults.pkvIncognita === 'Q' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(peloLiberoResults.computedPkvQ, 4)} <span className="text-xs font-sans font-normal text-slate-450">m³/s</span>
                          </p>
                          <p className="text-xs text-slate-500 font-mono">
                            ≈ {formatNumber(peloLiberoResults.computedPkvQ * 3600, 1)} m³/h
                          </p>
                        </div>

                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Larghezza Canale (B)</p>
                          <p className={`text-2xl font-mono font-black ${peloLiberoResults.pkvIncognita === 'B' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(peloLiberoResults.computedPkvB, 3)} <span className="text-xs font-sans font-normal text-slate-450">m</span>
                          </p>
                        </div>

                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-bold">Altezza Misurata a Monte (h)</p>
                          <p className={`text-2xl font-mono font-black ${peloLiberoResults.pkvIncognita === 'h' ? 'text-blue-700' : 'text-slate-800'}`}>
                            {formatNumber(peloLiberoResults.computedPkvH, 3)} <span className="text-xs font-sans font-normal text-slate-450">m</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-blue-200/50 text-[10px] text-slate-400 leading-normal font-sans">
                    {data.plTipo === 'circolare' && (
                      peloLiberoResults.plcErrorMessage ? (
                        <span className="text-red-500 font-bold">⚠️ {peloLiberoResults.plcErrorMessage}</span>
                      ) : peloLiberoResults.plcIncognita === 'invalid' ? (
                        <span className="text-red-500 font-bold">⚠️ Lascia vuoto esattamente un campo tra Q, D, Grado, i, Ks.</span>
                      ) : (
                        <span>Risoluzione effettuata per incognita: <strong>{peloLiberoResults.plcIncognita}</strong></span>
                      )
                    )}

                    {data.plTipo === 'rettangolare' && (
                      peloLiberoResults.plrErrorMessage ? (
                        <span className="text-red-500 font-bold">⚠️ {peloLiberoResults.plrErrorMessage}</span>
                      ) : (
                        <span>Calcolo diretto di portata e velocità eseguito con successo.</span>
                      )
                    )}

                    {data.plTipo === 'khafagi_venturi' && (
                      peloLiberoResults.pkvErrorMessage ? (
                        <span className="text-red-500 font-bold">⚠️ {peloLiberoResults.pkvErrorMessage}</span>
                      ) : peloLiberoResults.pkvIncognita === 'invalid' ? (
                        <span className="text-red-500 font-bold">⚠️ Lascia vuoto esattamente un campo tra Q, B, h.</span>
                      ) : (
                        <span>Risoluzione effettuata per incognita: <strong>{peloLiberoResults.pkvIncognita}</strong></span>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 8. Dimensionamento Travi (Fase 4) */}
          {data.activeSubTool === 'travi' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 animate-in fade-in duration-200">
              <h3 className="text-base font-black text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <span className="p-1 bg-blue-100 text-brand-600 rounded-lg"><Ruler className="w-4 h-4" /></span>
                Dimensionamento Travi (Calcoli Statici)
              </h3>

              {/* Sub-tabs per tipologia di schema statico */}
              <div className="flex flex-wrap gap-1.5 mb-5 print:hidden">
                {[
                  { id: 'incastrata_concentrato', label: 'Trave Incastrata - Carico Concentrato' },
                  { id: 'appoggiata_concentrato', label: 'Trave Appoggiata - Carico Concentrato' },
                  { id: 'doppio_incastrata_concentrato', label: 'Trave Doppiamente Incastrata - Carico Concentrato' },
                  { id: 'incastrata_distribuito', label: 'Trave Incastrata - Carico Distribuito' },
                  { id: 'appoggiata_distribuito', label: 'Trave Appoggiata - Carico Distribuito' },
                  { id: 'doppio_incastrata_distribuito', label: 'Trave Doppiamente Incastrata - Carico Distribuito' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => updateField('traviTipo', tab.id as any)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      data.traviTipo === tab.id 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Spiegazione & Formula con stile matematico elegante */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 text-xs text-slate-650 space-y-2.5 print:hidden">
                <p>
                  <strong>Descrizione:</strong> Calcola il momento flettente massimo (M<sub>max</sub>) e il modulo di resistenza minimo (W<sub>min</sub>) necessari per la trave in base al vincolo e al carico, e suggerisce il profilo commerciale più piccolo che garantisce la resistenza strutturale.
                </p>
                
                <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-slate-600">
                  <p className="font-bold text-slate-700 mb-2.5 text-[11px] uppercase tracking-wide">Formule di verifica stabilità applicate:</p>
                  <div className="space-y-4 pl-2">
                    {/* Formula momento */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
                      <span>• Momento Flettente Massimo:</span>
                      {data.traviTipo === 'incastrata_concentrato' && (
                        <span className="font-serif font-bold text-slate-800">
                          M<sub>max</sub> = P × L
                        </span>
                      )}
                      {data.traviTipo === 'appoggiata_concentrato' && (
                        <span className="font-serif font-bold text-slate-800 flex items-center">
                          M<sub>max</sub> = 
                          <span className="inline-flex flex-col items-center align-middle mx-1.5 text-center text-xs">
                            <span className="border-b border-slate-400 px-1 pb-0.5 font-bold">P × L<sub>1</sub> × L<sub>2</sub></span>
                            <span className="px-1 pt-0.5 font-bold">L</span>
                          </span>
                          <span className="text-xs text-slate-400 font-sans font-normal ml-2"> (dove L<sub>2</sub> = L - L<sub>1</sub>)</span>
                        </span>
                      )}
                      {data.traviTipo === 'doppio_incastrata_concentrato' && (
                        <span className="font-serif font-bold text-slate-800 flex items-center">
                          M<sub>max</sub> = 
                          <span className="inline-flex flex-col items-center align-middle mx-1.5 text-center text-xs">
                            <span className="border-b border-slate-400 px-1 pb-0.5 font-bold">P × a × b²</span>
                            <span className="px-1 pt-0.5 font-bold">L²</span>
                          </span>
                          <span className="text-xs text-slate-400 font-sans font-normal ml-2"> (dove a ≤ b sono le distanze dagli appoggi, a + b = L)</span>
                        </span>
                      )}
                      {data.traviTipo === 'incastrata_distribuito' && (
                        <span className="font-serif font-bold text-slate-800 flex items-center">
                          M<sub>max</sub> = 
                          <span className="inline-flex flex-col items-center align-middle mx-1.5 text-center text-xs">
                            <span className="border-b border-slate-400 px-1 pb-0.5 font-bold">q × L²</span>
                            <span className="px-1 pt-0.5 font-bold">2</span>
                          </span>
                        </span>
                      )}
                      {data.traviTipo === 'appoggiata_distribuito' && (
                        <span className="font-serif font-bold text-slate-800 flex items-center">
                          M<sub>max</sub> = 
                          <span className="inline-flex flex-col items-center align-middle mx-1.5 text-center text-xs">
                            <span className="border-b border-slate-400 px-1 pb-0.5 font-bold">q × L²</span>
                            <span className="px-1 pt-0.5 font-bold">8</span>
                          </span>
                        </span>
                      )}
                      {data.traviTipo === 'doppio_incastrata_distribuito' && (
                        <span className="font-serif font-bold text-slate-800 flex items-center">
                          M<sub>max</sub> = 
                          <span className="inline-flex flex-col items-center align-middle mx-1.5 text-center text-xs">
                            <span className="border-b border-slate-400 px-1 pb-0.5 font-bold">q × L²</span>
                            <span className="px-1 pt-0.5 font-bold">12</span>
                          </span>
                        </span>
                      )}
                    </div>
                    {/* Formula modulo */}
                    <div className="flex items-center gap-x-2 text-sm border-t border-slate-100 pt-2.5">
                      <span>• Modulo di Resistenza Minimo Richiesto:</span>
                      <span className="font-serif font-bold text-slate-800 flex items-center">
                        W<sub>min</sub> = 
                        <span className="inline-flex flex-col items-center align-middle mx-1.5 text-center text-xs">
                          <span className="border-b border-slate-400 px-1 pb-0.5 font-bold">M<sub>max</sub> × 100</span>
                          <span className="px-1 pt-0.5 font-bold">σ</span>
                        </span>
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-400 text-[9px] mt-3.5 italic border-t border-slate-100 pt-2">
                    * Il fattore 100 converte il momento M<sub>max</sub> da kg·m a kg·cm per uniformare l'unità con la tensione ammissibile σ in kg/cm².
                  </p>
                </div>
              </div>

              {/* Form di calcolo */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Inputs (lg:col-span-2) */}
                <div className="lg:col-span-2 bg-slate-50/50 border border-slate-200/60 rounded-3xl p-6 print:bg-white print:p-0 print:border-none">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-4 border-b border-slate-200/50 pb-2 print:hidden">Dati di Calcolo</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Luce della trave (L)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={data.traviL}
                          onChange={(e) => updateField('traviL', e.target.value)}
                          placeholder="es. 4.0"
                          className="w-full bg-white border border-slate-200 rounded-xl pl-3 pr-10 py-2 text-xs focus:outline-none focus:border-blue-500 font-mono"
                        />
                        <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-bold">m</span>
                      </div>
                    </div>

                    {(data.traviTipo === 'appoggiata_concentrato' || data.traviTipo === 'doppio_incastrata_concentrato') && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Distanza del carico dall'appoggio sinistro (L1)</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={data.traviL1}
                            onChange={(e) => updateField('traviL1', e.target.value)}
                            placeholder="es. 2.0"
                            className="w-full bg-white border border-slate-200 rounded-xl pl-3 pr-10 py-2 text-xs focus:outline-none focus:border-blue-500 font-mono"
                          />
                          <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-bold">m</span>
                        </div>
                      </div>
                    )}

                    {(data.traviTipo === 'incastrata_concentrato' || data.traviTipo === 'appoggiata_concentrato' || data.traviTipo === 'doppio_incastrata_concentrato') ? (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Carico concentrato (P)</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="1"
                            value={data.traviP}
                            onChange={(e) => updateField('traviP', e.target.value)}
                            placeholder="es. 1000"
                            className="w-full bg-white border border-slate-200 rounded-xl pl-3 pr-10 py-2 text-xs focus:outline-none focus:border-blue-500 font-mono"
                          />
                          <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-bold">kg</span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Carico uniformemente distribuito (q)</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            value={data.traviq}
                            onChange={(e) => updateField('traviq', e.target.value)}
                            placeholder="es. 1000"
                            className="w-full bg-white border border-slate-200 rounded-xl pl-3 pr-12 py-2 text-xs focus:outline-none focus:border-blue-500 font-mono"
                          />
                          <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-bold">kg/m</span>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Tensione ammissibile del materiale (σ)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="10"
                          value={data.traviSigma}
                          onChange={(e) => updateField('traviSigma', e.target.value)}
                          placeholder="es. 1600"
                          className="w-full bg-white border border-slate-200 rounded-xl pl-3 pr-16 py-2 text-xs focus:outline-none focus:border-blue-500 font-mono"
                        />
                        <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-bold">kg/cm²</span>
                      </div>
                      <div className="flex gap-1.5 mt-1.5 print:hidden">
                        <button
                          type="button"
                          onClick={() => updateField('traviSigma', '1600')}
                          className={`px-2 py-1 text-[9px] font-bold rounded-lg border transition-all cursor-pointer ${
                            data.traviSigma === '1600' 
                              ? 'bg-blue-100 text-blue-700 border-blue-300' 
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          S235 (1600)
                        </button>
                        <button
                          type="button"
                          onClick={() => updateField('traviSigma', '1900')}
                          className={`px-2 py-1 text-[9px] font-bold rounded-lg border transition-all cursor-pointer ${
                            data.traviSigma === '1900' 
                              ? 'bg-blue-100 text-blue-700 border-blue-300' 
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          S275 (1900)
                        </button>
                        <button
                          type="button"
                          onClick={() => updateField('traviSigma', '2400')}
                          className={`px-2 py-1 text-[9px] font-bold rounded-lg border transition-all cursor-pointer ${
                            data.traviSigma === '2400' 
                              ? 'bg-blue-100 text-blue-700 border-blue-300' 
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          S355 (2400)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Schema statico riepilogativo per stampa */}
                  <div className="hidden print:block mt-6 border-t border-slate-200 pt-4">
                    <h5 className="text-[10px] font-black text-slate-700 uppercase tracking-wider mb-2">Parametri della Trave</h5>
                    <div className="grid grid-cols-2 gap-y-1.5 text-xs text-slate-600">
                      <div><strong>Schema statico:</strong></div>
                      <div className="capitalize">{data.traviTipo.replace(/_/g, ' ')}</div>

                      <div><strong>Luce trave L:</strong></div>
                      <div>{formatNumber(traviLVal, 2)} m</div>

                      {(data.traviTipo === 'appoggiata_concentrato' || data.traviTipo === 'doppio_incastrata_concentrato') && (
                        <>
                          <div><strong>Distanza carico L1:</strong></div>
                          <div>{formatNumber(traviL1Val, 2)} m</div>
                        </>
                      )}

                      {(data.traviTipo === 'incastrata_concentrato' || data.traviTipo === 'appoggiata_concentrato' || data.traviTipo === 'doppio_incastrata_concentrato') ? (
                        <>
                          <div><strong>Carico concentrato P:</strong></div>
                          <div>{formatNumber(traviPVal, 0)} kg</div>
                        </>
                      ) : (
                        <>
                          <div><strong>Carico distribuito q:</strong></div>
                          <div>{formatNumber(traviqVal, 1)} kg/m</div>
                        </>
                      )}

                      <div><strong>Tensione amm. σ:</strong></div>
                      <div>{formatNumber(traviSigmaVal, 0)} kg/cm²</div>
                    </div>
                  </div>
                </div>

                {/* Risultato / Output (lg:col-span-1) */}
                <div className="bg-blue-50/50 border border-blue-200/60 rounded-3xl p-6 flex flex-col justify-between h-full">
                  <div>
                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider mb-4 border-b border-blue-200 pb-1.5 font-sans">Risoluzione Statica</p>
                    
                    <div className="space-y-4">
                      <div>
                        <p className="text-slate-500 text-[10px] uppercase font-bold">Momento Flettente Max (M<sub>max</sub>)</p>
                        <p className="text-2xl font-mono font-black text-slate-800">
                          {formatNumber(beamSizingResults.Mmax, 1)} <span className="text-xs font-sans font-normal text-slate-450">kg·m</span>
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-500 text-[10px] uppercase font-bold">Modulo Resistenza Min (W<sub>min</sub>)</p>
                        <p className="text-2xl font-mono font-black text-blue-700">
                          {formatNumber(beamSizingResults.Wmin, 1)} <span className="text-xs font-sans font-normal text-slate-450">cm³</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-blue-200/50 text-[10px] text-slate-400 leading-normal font-sans">
                    {beamSizingResults.error ? (
                      <span className="text-red-500 font-bold">⚠️ {beamSizingResults.error}</span>
                    ) : (
                      <span>Verifica eseguita secondo il metodo delle tensioni ammissibili.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Sezione Profilati Suggeriti */}
              <div className="mt-8 border-t border-slate-200 pt-6">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3 ml-1">Profilati Commerciali Suggeriti</h4>
                <p className="text-slate-500 text-xs mb-4 ml-1 print:hidden">
                  Dimensione minima disponibile dei comuni profilati in acciaio commerciale atta a soddisfare la condizione di resistenza flessionale W<sub>max</sub> ≥ W<sub>min</sub> (approssimata per eccesso).
                </p>

                <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm bg-white print:border-none print:shadow-none">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-bold text-slate-550 uppercase border-b border-slate-200">
                        <th className="p-3">Caratteristica</th>
                        <th className="p-3 text-center">IPE</th>
                        <th className="p-3 text-center">HEA</th>
                        <th className="p-3 text-center">HEB</th>
                        <th className="p-3 text-center">HEM</th>
                        <th className="p-3 text-center">UPN</th>
                        <th className="p-3 text-center">T</th>
                        <th className="p-3 text-center">L (uguali)</th>
                        <th className="p-3 text-center">Tubo Quadro</th>
                        <th className="p-3 text-center">Tubo Rettang.</th>
                        <th className="p-3 text-center">Tubo Circol.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono text-xs">
                      <tr>
                        <td className="p-3 font-sans font-bold text-slate-600 bg-slate-50/50">Profilo</td>
                        <td className="p-3 text-center text-slate-800 font-bold">{beamSizingResults.selectedProfiles.ipe.name}</td>
                        <td className="p-3 text-center text-slate-800 font-bold">{beamSizingResults.selectedProfiles.hea.name}</td>
                        <td className="p-3 text-center text-slate-800 font-bold">{beamSizingResults.selectedProfiles.heb.name}</td>
                        <td className="p-3 text-center text-slate-800 font-bold">{beamSizingResults.selectedProfiles.hem.name}</td>
                        <td className="p-3 text-center text-slate-800 font-bold">{beamSizingResults.selectedProfiles.upn.name}</td>
                        <td className="p-3 text-center text-slate-800 font-bold">{beamSizingResults.selectedProfiles.t.name}</td>
                        <td className="p-3 text-center text-slate-800 font-bold">{beamSizingResults.selectedProfiles.l.name}</td>
                        <td className="p-3 text-center text-slate-800 font-bold">{beamSizingResults.selectedProfiles.tubo_quadro.name}</td>
                        <td className="p-3 text-center text-slate-800 font-bold">{beamSizingResults.selectedProfiles.tubo_rettang.name}</td>
                        <td className="p-3 text-center text-slate-800 font-bold">{beamSizingResults.selectedProfiles.tubo_circ.name}</td>
                      </tr>
                      <tr className="bg-slate-50/20">
                        <td className="p-3 font-sans font-bold text-slate-600 bg-slate-50/50">W<sub>max</sub> [cm³]</td>
                        <td className="p-3 text-center text-slate-500">{typeof beamSizingResults.selectedProfiles.ipe.w === 'number' ? formatNumber(beamSizingResults.selectedProfiles.ipe.w, 2) : '-'}</td>
                        <td className="p-3 text-center text-slate-500">{typeof beamSizingResults.selectedProfiles.hea.w === 'number' ? formatNumber(beamSizingResults.selectedProfiles.hea.w, 2) : '-'}</td>
                        <td className="p-3 text-center text-slate-500">{typeof beamSizingResults.selectedProfiles.heb.w === 'number' ? formatNumber(beamSizingResults.selectedProfiles.heb.w, 2) : '-'}</td>
                        <td className="p-3 text-center text-slate-500">{typeof beamSizingResults.selectedProfiles.hem.w === 'number' ? formatNumber(beamSizingResults.selectedProfiles.hem.w, 2) : '-'}</td>
                        <td className="p-3 text-center text-slate-500">{typeof beamSizingResults.selectedProfiles.upn.w === 'number' ? formatNumber(beamSizingResults.selectedProfiles.upn.w, 2) : '-'}</td>
                        <td className="p-3 text-center text-slate-500">{typeof beamSizingResults.selectedProfiles.t.w === 'number' ? formatNumber(beamSizingResults.selectedProfiles.t.w, 2) : '-'}</td>
                        <td className="p-3 text-center text-slate-500">{typeof beamSizingResults.selectedProfiles.l.w === 'number' ? formatNumber(beamSizingResults.selectedProfiles.l.w, 2) : '-'}</td>
                        <td className="p-3 text-center text-slate-500">{typeof beamSizingResults.selectedProfiles.tubo_quadro.w === 'number' ? formatNumber(beamSizingResults.selectedProfiles.tubo_quadro.w, 2) : '-'}</td>
                        <td className="p-3 text-center text-slate-500">{typeof beamSizingResults.selectedProfiles.tubo_rettang.w === 'number' ? formatNumber(beamSizingResults.selectedProfiles.tubo_rettang.w, 2) : '-'}</td>
                        <td className="p-3 text-center text-slate-500">{typeof beamSizingResults.selectedProfiles.tubo_circ.w === 'number' ? formatNumber(beamSizingResults.selectedProfiles.tubo_circ.w, 2) : '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 bg-slate-50 rounded-2xl p-4 text-xs text-slate-500 print:hidden space-y-1">
                  <p>• <strong>W<sub>max</sub>:</strong> Modulo di resistenza effettivo del profilato suggerito rispetto all'asse principale più resistente.</p>
                  <p>• I valori indicati con "-" denotano che non sono presenti profilati idonei di quella famiglia nel catalogo standard o che le sollecitazioni superano la portata massima della serie.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
