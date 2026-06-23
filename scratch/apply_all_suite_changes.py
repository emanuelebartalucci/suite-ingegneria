import os

# Base directory
base_dir = r"c:/Users/e.bartalucci.INGEGNO.001/Documents/Antigravity/suite-ingegneria/src/tools"

def replace_in_file(filename, target, replacement):
    path = os.path.join(base_dir, filename)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if target in content:
        content = content.replace(target, replacement)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"[{filename}] Successfully replaced.")
        return True
    else:
        print(f"[{filename}] Warning: target content not found.")
        return False

# ==================== 1. ToolCalcoliElettrici.tsx ====================
target_elettrici = """const defaultData: CalcoliElettriciData = {
  activeSubTool: 'sezione',
  sezioneCorrente: '2', // Monofase default
  sezioneTensione: '230',
  sezionePotenza: '3000',
  sezioneCaduta: '9.2', // ~4% di 230V
  sezioneLunghezza: '50',
  
  cadutaCorrente: '2',
  cadutaTensione: '230',
  cadutaPotenza: '3000',
  cadutaSezione: '2.5',
  cadutaLunghezza: '50'
};"""

replacement_elettrici = """const defaultData: CalcoliElettriciData = {
  activeSubTool: 'sezione',
  sezioneCorrente: '2', // Monofase default
  sezioneTensione: '230',
  sezionePotenza: '',
  sezioneCaduta: '9.2', // ~4% di 230V
  sezioneLunghezza: '',
  
  cadutaCorrente: '2',
  cadutaTensione: '230',
  cadutaPotenza: '',
  cadutaSezione: '2.5',
  cadutaLunghezza: ''
};"""

replace_in_file("ToolCalcoliElettrici.tsx", target_elettrici, replacement_elettrici)

# ==================== 2. ToolCarichiTermici.tsx ====================
target_termici = """    const addLoad = () => {
        const newId = loads.length > 0 ? Math.max(...loads.map(l => l.id)) + 1 : 1;
        setLoads([...loads, { id: newId, name: `Utenza ${newId}`, mode: 'power', inputVal: 300, material: 'Acciaio', DN: '50', PN: 'NORM' }]);
    };"""

replacement_termici = """    const addLoad = () => {
        const newId = loads.length > 0 ? Math.max(...loads.map(l => l.id)) + 1 : 1;
        setLoads([...loads, { id: newId, name: `Utenza ${newId}`, mode: 'power', inputVal: '', material: 'Acciaio', DN: '50', PN: 'NORM' }]);
    };"""

replace_in_file("ToolCarichiTermici.tsx", target_termici, replacement_termici)

# ==================== 3. ToolDimensionamentoGas.tsx ====================
target_gas = """  const addUtility = () => {
    const newId = `G${utilities.length + 1}`;
    setUtilities([...utilities, {
      id: newId,
      name: `Utenza ${newId}`,
      flowRate: 10,
      pOper: 1.02,
      tOper: 20,
      pMinRichiesta: 1.02,
      connectedBranchId: branches[branches.length - 1]?.id || null
    }]);
  };

  const updateUtility = (id: string, field: keyof UtilityItem, val: any) => {
    setUtilities(prev => prev.map(u => u.id === id ? { ...u, [field]: val } : u));
  };

  const removeUtility = (id: string) => {
    setUtilities(utilities.filter(u => u.id !== id));
  };

  // --- Gestione Azioni Rami ---
  const addBranch = () => {
    const defaultParent = branches[branches.length - 1]?.id || null;
    const newId = branches.length > 0 ? Math.max(...branches.map(b => b.id)) + 1 : 1;
    setBranches([...branches, {
      id: newId,
      parentId: defaultParent,
      length: 10,
      hMonte: 0,
      hValle: 0,
      material: 'Acciaio',
      DN: '50',
      PN: 'NORM',
      dIntManual: '',
      dExtManual: '',
      roughnessManual: '',
      hierarchy: 'dorsale_principale',
      nValvole: 0,
      nGomiti: 0,
      nTeeDiretto: 0,
      nTeeLaterale: 0,
      nRiduzioni: 0
    }]);
  };"""

replacement_gas = """  const addUtility = () => {
    const newId = `G${utilities.length + 1}`;
    setUtilities([...utilities, {
      id: newId,
      name: `Utenza ${newId}`,
      flowRate: '',
      pOper: 1.02,
      tOper: 20,
      pMinRichiesta: 1.02,
      connectedBranchId: branches[branches.length - 1]?.id || null
    }]);
  };

  const updateUtility = (id: string, field: keyof UtilityItem, val: any) => {
    setUtilities(prev => prev.map(u => u.id === id ? { ...u, [field]: val } : u));
  };

  const removeUtility = (id: string) => {
    setUtilities(utilities.filter(u => u.id !== id));
  };

  // --- Gestione Azioni Rami ---
  const addBranch = () => {
    const defaultParent = branches[branches.length - 1]?.id || null;
    const newId = branches.length > 0 ? Math.max(...branches.map(b => b.id)) + 1 : 1;
    setBranches([...branches, {
      id: newId,
      parentId: defaultParent,
      length: '',
      hMonte: 0,
      hValle: 0,
      material: 'Acciaio',
      DN: '50',
      PN: 'NORM',
      dIntManual: '',
      dExtManual: '',
      roughnessManual: '',
      hierarchy: 'dorsale_principale',
      nValvole: 0,
      nGomiti: 0,
      nTeeDiretto: 0,
      nTeeLaterale: 0,
      nRiduzioni: 0
    }]);
  };"""

replace_in_file("ToolDimensionamentoGas.tsx", target_gas, replacement_gas)

# ==================== 4. ToolDispersione.tsx ====================
target_dispersione = """    const addLine = () => {
        const newId = lines.length > 0 ? Math.max(...lines.map(l => l.id)) + 1 : 1;
        const newLines = [...lines, { id: newId, name: `Tratto ${newId}`, length: 100, material: 'Acciaio', DN: '100', PN: 'NORM', isoType: 'pur', isoLambda: 0.025, isoThick: 60 }];
        setLines(newLines);
        setSelectedLineId(newId);
    };"""

replacement_dispersione = """    const addLine = () => {
        const newId = lines.length > 0 ? Math.max(...lines.map(l => l.id)) + 1 : 1;
        const newLines = [...lines, { id: newId, name: `Tratto ${newId}`, length: '', material: 'Acciaio', DN: '100', PN: 'NORM', isoType: 'pur', isoLambda: 0.025, isoThick: 60 }];
        setLines(newLines);
        setSelectedLineId(newId);
    };"""

replace_in_file("ToolDispersione.tsx", target_dispersione, replacement_dispersione)

# ==================== 5. ToolProfiloIdraulico.tsx ====================
target_idraulico_flow = "    const [flowRate, setFlowRate] = useState<number | ''>(25);"
replacement_idraulico_flow = "    const [flowRate, setFlowRate] = useState<number | ''>('');"
replace_in_file("ToolProfiloIdraulico.tsx", target_idraulico_flow, replacement_idraulico_flow)

target_idraulico_element = """    const addElement = (type: 'weir' | 'pipe' | 'channel' | 'custom') => {
        const newId = elements.length > 0 ? Math.max(...elements.map(e => e.id)) + 1 : 1;
        let newEl: HydraulicElement = { id: newId, type, name: type === 'weir' ? 'Stramazzo (Sottile)' : type === 'pipe' ? 'Tubazione' : type === 'channel' ? 'Canale' : 'Perdita Fissa' };
        if (type === 'weir') newEl = { ...newEl, L: 1.0, weirType: 'sottile' };
        if (type === 'pipe') newEl = { ...newEl, L: 10, material: 'manuale', D: 200, roughness: 0.02, localLosses: [] };
        if (type === 'channel') newEl = { ...newEl, L: 5, slope: 0.005 };
        if (type === 'custom') newEl = { ...newEl, loss: 0.05 };
        setElements([...elements, newEl]);
    };"""

replacement_idraulico_element = """    const addElement = (type: 'weir' | 'pipe' | 'channel' | 'custom') => {
        const newId = elements.length > 0 ? Math.max(...elements.map(e => e.id)) + 1 : 1;
        let newEl: HydraulicElement = { id: newId, type, name: type === 'weir' ? 'Stramazzo (Sottile)' : type === 'pipe' ? 'Tubazione' : type === 'channel' ? 'Canale' : 'Perdita Fissa' };
        if (type === 'weir') newEl = { ...newEl, L: '', weirType: 'sottile' };
        if (type === 'pipe') newEl = { ...newEl, L: '', material: 'manuale', D: '', roughness: 0.02, localLosses: [] };
        if (type === 'channel') newEl = { ...newEl, L: '', slope: 0.005 };
        if (type === 'custom') newEl = { ...newEl, loss: '' };
        setElements([...elements, newEl]);
    };"""

replace_in_file("ToolProfiloIdraulico.tsx", target_idraulico_element, replacement_idraulico_element)

# ==================== 6. ToolVerificaLinee.tsx ====================
target_linee = """    const addTratto = () => {
        const defaultParent = tratti[tratti.length - 1]?.id || null;
        const newId = tratti.length > 0 ? Math.max(...tratti.map(t => t.id)) + 1 : 1;
        setTratti([
            ...tratti, 
            { 
                id: newId, 
                tag: `L${newId}`, 
                name: `Linea Tratto ${newId}`, 
                portata: 50, 
                material: 'Acciaio', 
                DN: '100', 
                PN: 'NORM', 
                length: 50, 
                n_valvole: 0, 
                n_riduzioni: 0, 
                n_curve: 0, 
                n_tee: 0,
                hierarchy: 'dorsale_principale',
                parentId: defaultParent,
                isoType: 'pur',
                isoThick: 50,
                isoLambda: 0.025,
                tAmb: -5
            }
        ]);
    };"""

replacement_linee = """    const addTratto = () => {
        const defaultParent = tratti[tratti.length - 1]?.id || null;
        const newId = tratti.length > 0 ? Math.max(...tratti.map(t => t.id)) + 1 : 1;
        setTratti([
            ...tratti, 
            { 
                id: newId, 
                tag: `L${newId}`, 
                name: `Linea Tratto ${newId}`, 
                portata: '', 
                material: 'Acciaio', 
                DN: '100', 
                PN: 'NORM', 
                length: '', 
                n_valvole: 0, 
                n_riduzioni: 0, 
                n_curve: 0, 
                n_tee: 0,
                hierarchy: 'dorsale_principale',
                parentId: defaultParent,
                isoType: 'pur',
                isoThick: 50,
                isoLambda: 0.025,
                tAmb: -5
            }
        ]);
    };"""

replace_in_file("ToolVerificaLinee.tsx", target_linee, replacement_linee)

# ==================== 7. ToolCalcoliVari.tsx (Cleanup & Restore Conversions) ====================

vari_path = os.path.join(base_dir, "ToolCalcoliVari.tsx")
with open(vari_path, 'r', encoding='utf-8') as f:
    vari_content = f.read()

# A. Svuotamento default
target_vari_defaults = """const defaultData: CalcoliVariData = {
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
  volumeDiametro: '2',
  volumeLunghezza: '5',
  volumeAltezzaLiq: '1.2',
  
  psvQ: '15',
  psvD: '50',
  psvV: '',

  // Foronomia default
  foroTipo: 'circolare',
  fcQ: '',
  fcH: '1.5',
  fcD: '0.2',
  
  frQ: '',
  frH1: '1.0',
  frH2: '2.0',
  frB: '0.5',
  
  sgQ: '',
  sgB: '1.0',
  sgH: '0.5',
  
  ssQ: '',
  ssB: '1.0',
  ssH: '0.3',
  ssP: '0.5',

  // Svuotamento default
  svTipo: 'cilindrico_vert',
  svD: '2.0',
  svOrificeD: '0.05',
  svH: '1.5',
  svL: '4.0',
  svT: '',

  // Condotte a pelo libero default
  plTipo: 'circolare',
  plcD: '0.5',
  plcGrado: '50',
  plcI: '0.01',
  plcKs: '70',
  plcQ: '',
  plrB: '1.0',
  plrH: '0.03',
  plrI: '0.01',
  plrC: '0.30',
  plrQ: '',
  pkvB: '1.0',
  pkvH: '0.5',
  pkvQ: '',

  // Dimensionamento Travi default
  traviTipo: 'incastrata_concentrato',
  traviL: '4',
  traviL1: '2',
  traviP: '1000',
  traviq: '1000',
  traviSigma: '1600'
};"""

replacement_vari_defaults = """const defaultData: CalcoliVariData = {
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
};"""

if target_vari_defaults in vari_content:
    vari_content = vari_content.replace(target_vari_defaults, replacement_vari_defaults)
    print("[ToolCalcoliVari.tsx] Defaults cleaned successfully.")
else:
    print("[ToolCalcoliVari.tsx] Warning: target_vari_defaults not found.")

# B. Interface replacement
target_interface = """  // Conversione U.M.
  convCategory: 'pressione' | 'temperatura' | 'portata' | 'lunghezza';"""

replacement_interface = """  // Conversione U.M.
  convCategory: 'pressione' | 'temperatura' | 'portata' | 'lunghezza' | 'potenza' | 'superficie' | 'energia' | 'velocita' | 'volume' | 'densita' | 'accelerazione' | 'forza_massa' | 'angolo';"""

if target_interface in vari_content:
    vari_content = vari_content.replace(target_interface, replacement_interface)
    print("[ToolCalcoliVari.tsx] Interface updated.")
else:
    print("[ToolCalcoliVari.tsx] Warning: target_interface not found.")

# C. UNITS_FACTORS and CATEGORY_LABELS
target_factors = """const UNITS_FACTORS = {
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
      l_s: 0.001,
      l_min: 1 / 60000,
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
  }
};"""

replacement_factors = """const UNITS_FACTORS = {
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
};"""

if target_factors in vari_content:
    vari_content = vari_content.replace(target_factors, replacement_factors)
    print("[ToolCalcoliVari.tsx] Factors and labels updated.")
else:
    print("[ToolCalcoliVari.tsx] Warning: target_factors not found.")

# D. useEffect reset
target_useeffect = """  // Reset delle unità di misura al cambio di categoria
  useEffect(() => {
    if (data.convCategory === 'pressione') {
      setData(prev => ({ ...prev, convUnitSorgente: 'bar', convUnitDestinazione: 'kPa' }));
    } else if (data.convCategory === 'temperatura') {
      setData(prev => ({ ...prev, convUnitSorgente: 'C', convUnitDestinazione: 'F' }));
    } else if (data.convCategory === 'portata') {
      setData(prev => ({ ...prev, convUnitSorgente: 'm3_h', convUnitDestinazione: 'l_s' }));
    } else if (data.convCategory === 'lunghezza') {
      setData(prev => ({ ...prev, convUnitSorgente: 'm', convUnitDestinazione: 'in' }));
    }
  }, [data.convCategory]);"""

replacement_useeffect = """  // Reset delle unità di misura al cambio di categoria
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
  }, [data.convCategory]);"""

if target_useeffect in vari_content:
    vari_content = vari_content.replace(target_useeffect, replacement_useeffect)
    print("[ToolCalcoliVari.tsx] useEffect updated.")
else:
    print("[ToolCalcoliVari.tsx] Warning: target_useeffect not found.")

# E. Explanatory box description
target_box = """              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 text-xs text-slate-655 space-y-2.5 print:hidden">
                <p><strong>Descrizione:</strong> Converte in tempo reale valori tra diverse unità di misura fisiche (Pressione, Temperatura, Portata volumetrica e Lunghezza) basate sugli standard scientifici internazionali.</p>
                <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-slate-600">
                  <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Formule di conversione applicate:</p>
                  <div className="space-y-3 font-serif pl-2">
                    <div className="flex items-center gap-1.5 text-sm">
                      <span>• Lineare (Pressione, Portata, Lunghezza):</span>
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
              </div>"""

# Let's check for both 650 and 655 in target
target_box_650 = """              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 text-xs text-slate-650 space-y-2.5 print:hidden">
                <p><strong>Descrizione:</strong> Converte in tempo reale valori tra diverse unità di misura fisiche (Pressione, Temperatura, Portata volumetrica e Lunghezza) basate sugli standard scientifici internazionali.</p>
                <div className="bg-white border border-slate-200/60 rounded-xl p-4 text-slate-600">
                  <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">Formule di conversione applicate:</p>
                  <div className="space-y-3 font-serif pl-2">
                    <div className="flex items-center gap-1.5 text-sm">
                      <span>• Lineare (Pressione, Portata, Lunghezza):</span>
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
              </div>"""

replacement_box = """              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 text-xs text-slate-650 space-y-2.5 print:hidden">
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
              </div>"""

if target_box_650 in vari_content:
    vari_content = vari_content.replace(target_box_650, replacement_box)
    print("[ToolCalcoliVari.tsx] Explanatory box (650) replaced.")
elif target_box in vari_content:
    vari_content = vari_content.replace(target_box, replacement_box)
    print("[ToolCalcoliVari.tsx] Explanatory box (655) replaced.")
else:
    print("[ToolCalcoliVari.tsx] Warning: Explanatory box not found.")

# F. Category Button List
target_buttons = """                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Categoria di Misura</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => updateField('convCategory', 'pressione')}
                        className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all ${data.convCategory === 'pressione' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        Pressione
                      </button>
                      <button 
                        onClick={() => updateField('convCategory', 'temperatura')}
                        className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all ${data.convCategory === 'temperatura' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        Temperatura
                      </button>
                      <button 
                        onClick={() => updateField('convCategory', 'portata')}
                        className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all ${data.convCategory === 'portata' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        Portata Vol.
                      </button>
                      <button 
                        onClick={() => updateField('convCategory', 'lunghezza')}
                        className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all ${data.convCategory === 'lunghezza' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        Lunghezza
                      </button>
                    </div>
                  </div>"""

replacement_buttons = """                  <div>
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
                  </div>"""

if target_buttons in vari_content:
    vari_content = vari_content.replace(target_buttons, replacement_buttons)
    print("[ToolCalcoliVari.tsx] Buttons updated.")
else:
    print("[ToolCalcoliVari.tsx] Warning: target_buttons not found.")

# G. Selects and Print Summary category block replacement
# Let's locate the target selects and print summary block
target_selects_start = '                  <div className="grid grid-cols-2 gap-4">\n                    <div>\n                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Da Unità</label>'

# We search for the exact matching end point including Categoria row
target_selects_end = """                {/* Tabella di riepilogo in stampa (sostituisce gli input) */}
                <div className="hidden print:block border border-slate-200 rounded-2xl p-4 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b pb-1 mb-2">Dati di Ingresso</p>
                  <div className="grid grid-cols-2 gap-y-1.5 text-[11px] text-slate-650">
                    <div><strong>Categoria:</strong></div>
                    <div className="capitalize">{data.convCategory}</div>"""

step_5118_file = r"C:\Users\e.bartalucci.INGEGNO.001\Documents\Antigravity\suite-ingegneria\scratch\step_5118.txt"
with open(step_5118_file, 'r', encoding='utf-8') as f_5118:
    replacement_selects = f_5118.read()

idx_start = vari_content.find(target_selects_start)
if idx_start != -1:
    idx_end = vari_content.find(target_selects_end, idx_start)
    if idx_end != -1:
        full_target_selects = vari_content[idx_start:idx_end + len(target_selects_end)]
        vari_content = vari_content.replace(full_target_selects, replacement_selects)
        print("[ToolCalcoliVari.tsx] Dropdown selects and print block replaced.")
    else:
        print("[ToolCalcoliVari.tsx] Error: target_selects_end not found.")
else:
    print("[ToolCalcoliVari.tsx] Error: target_selects_start not found.")

# Write back
with open(vari_path, 'w', encoding='utf-8') as f:
    f.write(vari_content)

print("[ToolCalcoliVari.tsx] All conversion features applied successfully.")
