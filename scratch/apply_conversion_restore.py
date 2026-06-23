import os

file_path = r"c:/Users/e.bartalucci.INGEGNO.001/Documents/Antigravity/suite-ingegneria/src/tools/ToolCalcoliVari.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Interface replacement
target_interface = """  // Conversione U.M.
  convCategory: 'pressione' | 'temperatura' | 'portata' | 'lunghezza';"""

replacement_interface = """  // Conversione U.M.
  convCategory: 'pressione' | 'temperatura' | 'portata' | 'lunghezza' | 'potenza' | 'superficie' | 'energia' | 'velocita' | 'volume' | 'densita' | 'accelerazione' | 'forza_massa' | 'angolo';"""

if target_interface in content:
    content = content.replace(target_interface, replacement_interface)
    print("Interface replaced successfully.")
else:
    print("Error: target_interface not found.")

# 2. UNITS_FACTORS and CATEGORY_LABELS
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

if target_factors in content:
    content = content.replace(target_factors, replacement_factors)
    print("Factors replaced successfully.")
else:
    print("Error: target_factors not found.")

# 3. useEffect
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

if target_useeffect in content:
    content = content.replace(target_useeffect, replacement_useeffect)
    print("useEffect replaced successfully.")
else:
    print("Error: target_useeffect not found.")

# 4. Explanatory box description
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

# Wait, let's check if it is text-slate-650 in the actual file! We saw it was text-slate-650. Let's verify:
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

if target_box_650 in content:
    content = content.replace(target_box_650, replacement_box)
    print("Explanatory box replaced successfully.")
elif target_box in content:
    content = content.replace(target_box, replacement_box)
    print("Explanatory box (655) replaced successfully.")
else:
    print("Warning: Explanatory box target not found. Checking close substring...")

# 5. Category Button List
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

if target_buttons in content:
    content = content.replace(target_buttons, replacement_buttons)
    print("Buttons replaced successfully.")
else:
    print("Error: target_buttons not found.")

# 6. Dropdown selects - we read from the file we just created since it contains exactly the dropdown part!
step_5118_file = r"C:\Users\e.bartalucci.INGEGNO.001\Documents\Antigravity\suite-ingegneria\scratch\step_5118.txt"
with open(step_5118_file, 'r', encoding='utf-8') as f_5118:
    replacement_selects = f_5118.read()

# Let's locate the target selects block
target_selects_start = '                  <div className="grid grid-cols-2 gap-4">\n                    <div>\n                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 ml-1">Da Unità</label>'
target_selects_end = '</select>\n                    </div>\n                  </div>\n                </div>'

idx_start = content.find(target_selects_start)
if idx_start != -1:
    idx_end = content.find(target_selects_end, idx_start)
    if idx_end != -1:
        full_target_selects = content[idx_start:idx_end + len(target_selects_end)]
        content = content.replace(full_target_selects, replacement_selects)
        print("Dropdown selects replaced successfully.")
    else:
        print("Error: target_selects_end not found.")
else:
    print("Error: target_selects_start not found.")

# 7. Print summary block category label
target_summary = """                    <div><strong>Categoria:</strong></div>
                    <div className="capitalize">{data.convCategory}</div>"""

replacement_summary = """                    <div><strong>Categoria:</strong></div>
                    <div>{CATEGORY_LABELS[data.convCategory] || data.convCategory}</div>"""

if target_summary in content:
    content = content.replace(target_summary, replacement_summary)
    print("Print summary block replaced successfully.")
else:
    print("Warning: target_summary not found. Checking if already using CATEGORY_LABELS...")

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("ToolCalcoliVari.tsx updated with all categories.")
