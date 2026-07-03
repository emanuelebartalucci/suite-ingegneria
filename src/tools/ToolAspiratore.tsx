import React, { useState, useMemo } from 'react';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import {
  Plus, Trash2, ChevronDown, ChevronUp, Info,
  Wind, Zap, CheckCircle, AlertTriangle
} from 'lucide-react';
import {
  FAN_ACCESSORIES,
  FAN_ROUGHNESS,
  getLeqForDiameter,
  getTagliaIEC,
} from '../data/fanAccessories';

interface ToolAspiratorProps {
  projectData: ProjectData;
  setProjectData: (data: any) => void;
  setAppMode: (mode: string) => void;
}

// â”€â”€ Interfacce TypeScript â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Tratto di condotta aeraulica */
interface DuctSegment {
  id: number;
  name: string;
  D_mm: number;           // Diametro interno [mm]
  L_m: number;            // Lunghezza condotta [m]
  material: string;       // Materiale (lookup scabrezza)
  roughness_mm: number;   // Scabrezza Îµ [mm]
  // Accessori (conteggi)
  n_gomiti90_R15: number;
  n_gomiti90_R2: number;
  n_gomiti45: number;
  n_bif_principale: number;
  n_bif_laterale: number;
  n_rid_exp: number;
  n_rid_cont: number;
  n_valvole: number;
  n_ingresso: number;
  n_uscita: number;
}

/** Componente speciale con perdita propria (scrubber, filtro, silenziatore, ecc.) */
interface SpecialComponent {
  id: number;
  type: 'Scrubber' | 'Filtro' | 'Silenziatore' | 'Scambiatore' | 'Separatore' | 'Altro';
  name: string;
  // Per lo scrubber: perdita Darcy attraverso il corpo + perdita riempimento
  D_interno_mm: number;     // Diametro interno corpo [mm]
  H_corpo_m: number;        // Altezza (lunghezza) attraversamento [m]
  H_riempimento_m: number;  // Altezza letto di riempimento [m]
  dp_riempimento_Pa_m: number; // Perdita specifica riempimento [Pa/m]
  dp_extra_Pa: number;      // Perdita aggiuntiva fissa (demister, ugelli, ecc.) [Pa]
}

/** Dati globali impianto */
interface FanGlobalData {
  T_aria_C: number;         // Temperatura aria [°C]
  quota_m: number;          // Quota impianto [m s.l.m.]
  Q_design_m3h: number;     // Portata di progetto [m³/h]
  dp_bocchetta_Pa: number;  // Depressione max alle bocchette aspirazione [Pa]
  eta_ventilatore: number;  // Rendimento ventilatore [0â€“1]
  n_titolari: number;       // Numero ventilatori titolari
  n_riserva: number;        // Numero ventilatori di riserva
}

interface FanToolData {
  global: FanGlobalData;
  segments: DuctSegment[];
  specials: SpecialComponent[];
  activeTab: 'config' | 'tratti' | 'risultati';
  showSpecials: boolean;
}

// â”€â”€ Valori default â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let nextId = 1;
const newSegment = (): DuctSegment => ({
  id: nextId++,
  name: `Tratto ${nextId - 1}`,
  D_mm: 231,
  L_m: 10,
  material: 'PVC rigido',
  roughness_mm: FAN_ROUGHNESS['PVC rigido'],
  n_gomiti90_R15: 0,
  n_gomiti90_R2: 0,
  n_gomiti45: 0,
  n_bif_principale: 0,
  n_bif_laterale: 0,
  n_rid_exp: 0,
  n_rid_cont: 0,
  n_valvole: 0,
  n_ingresso: 0,
  n_uscita: 0,
});

const newSpecial = (): SpecialComponent => ({
  id: nextId++,
  type: 'Scrubber',
  name: 'Scrubber C1',
  D_interno_mm: 930,
  H_corpo_m: 3.7,
  H_riempimento_m: 0.8,
  dp_riempimento_Pa_m: 200,
  dp_extra_Pa: 0,
});

const defaultData: FanToolData = {
  global: {
    T_aria_C: 20,
    quota_m: 0,
    Q_design_m3h: 2000,
    dp_bocchetta_Pa: 250,
    eta_ventilatore: 0.55,
    n_titolari: 1,
    n_riserva: 0,
  },
  segments: [newSegment()],
  specials: [],
  activeTab: 'config',
  showSpecials: false,
};

// â”€â”€ Fisica / Calcoli â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** DensitÃ  aria [kg/m³] corretta per temperatura e quota */
function calcRhoAria(T_C: number, quota_m: number): number {
  const T_K = T_C + 273.15;
  const P_atm = 101325 * Math.pow(1 - quota_m / 44308, 5.256);
  return 1.293 * (273.15 / T_K) * (P_atm / 101325);
}

/** ViscositÃ  cinematica aria [m²/s] approssimata con Sutherland */
function calcNuAria(T_C: number): number {
  const T_K = T_C + 273.15;
  // Î¼_din [PaÂ·s] con Sutherland: Î¼ = Î¼0 * (T/T0)^1.5 * (T0+C)/(T+C)
  const mu0 = 1.716e-5; const T0 = 273.15; const C = 110.4;
  const mu = mu0 * Math.pow(T_K / T0, 1.5) * (T0 + C) / (T_K + C);
  const rho = calcRhoAria(T_C, 0); // per nu usiamo pressione std
  return mu / rho;
}

/** Colebrook-White iterativo — ritorna λ */
function calcLambda(Re: number, epsilon: number, D: number): number {
  if (Re < 2300) {
    return 64 / Re; // Hagen-Poiseuille laminare
  }
  let lam = 0.02; // prima approssimazione
  for (let i = 0; i < 50; i++) {
    const lam_new = 1 / Math.pow(-2 * Math.log10(epsilon / (3.7 * D) + 2.51 / (Re * Math.sqrt(lam))), 2);
    if (Math.abs(lam_new - lam) < 1e-9) return lam_new;
    lam = lam_new;
  }
  return lam;
}

/** Calcolo perdite di carico per un singolo tratto [Pa] */
function calcSegmentDP(seg: DuctSegment, Q_m3h: number, rho: number, nu: number) {
  const D_m = seg.D_mm / 1000;
  const A = Math.PI * D_m * D_m / 4;
  const v = (Q_m3h / 3600) / A;
  const Re = (v * D_m) / nu;
  const lambda = calcLambda(Re, seg.roughness_mm / 1000, D_m);

  // Perdita distribuita Darcy-Weisbach
  const dp_dist = lambda * (seg.L_m / D_m) * (rho * v * v) / 2;

  // Lunghezze equivalenti accessori (interpolate per D_mm)
  const acc = FAN_ACCESSORIES;
  const leq_gomiti90_R15 = seg.n_gomiti90_R15 * getLeqForDiameter(acc[0], seg.D_mm);
  const leq_gomiti90_R2  = seg.n_gomiti90_R2  * getLeqForDiameter(acc[1], seg.D_mm);
  const leq_gomiti45     = seg.n_gomiti45     * getLeqForDiameter(acc[2], seg.D_mm);
  const leq_bif_princ    = seg.n_bif_principale * getLeqForDiameter(acc[3], seg.D_mm);
  const leq_bif_lat      = seg.n_bif_laterale * getLeqForDiameter(acc[4], seg.D_mm);
  const leq_rid_exp      = seg.n_rid_exp      * getLeqForDiameter(acc[5], seg.D_mm);
  const leq_rid_cont     = seg.n_rid_cont     * getLeqForDiameter(acc[6], seg.D_mm);
  const leq_valvole      = seg.n_valvole      * getLeqForDiameter(acc[7], seg.D_mm);
  const leq_ingresso     = seg.n_ingresso     * getLeqForDiameter(acc[8], seg.D_mm);
  const leq_uscita       = seg.n_uscita       * getLeqForDiameter(acc[9], seg.D_mm);

  const L_eq_tot = leq_gomiti90_R15 + leq_gomiti90_R2 + leq_gomiti45
    + leq_bif_princ + leq_bif_lat + leq_rid_exp + leq_rid_cont
    + leq_valvole + leq_ingresso + leq_uscita;

  const dp_conc = lambda * (L_eq_tot / D_m) * (rho * v * v) / 2;

  return {
    v_ms: v,
    Re,
    lambda,
    L_eq_tot_m: L_eq_tot,
    dp_dist_Pa: dp_dist,
    dp_conc_Pa: dp_conc,
    dp_tot_Pa: dp_dist + dp_conc,
  };
}

/** Calcolo perdite per un componente speciale [Pa] */
function calcSpecialDP(sp: SpecialComponent, Q_m3h: number, rho: number, nu: number) {
  // Perdita Darcy attraverso il corpo (come se fosse un tratto)
  const D_m = sp.D_interno_mm / 1000;
  const A = Math.PI * D_m * D_m / 4;
  const v = (Q_m3h / 3600) / A;
  const Re = (v * D_m) / nu;
  const eps_pvc = 0.02 / 1000; // scabrezza PVC di default per il corpo
  const lambda = calcLambda(Re, eps_pvc, D_m);
  const dp_darcy = lambda * (sp.H_corpo_m / D_m) * (rho * v * v) / 2;

  // Perdita del riempimento [Pa]
  const dp_riempimento = sp.dp_riempimento_Pa_m * sp.H_riempimento_m;

  // Perdita extra fissa
  const dp_extra = sp.dp_extra_Pa;

  return {
    v_ms: v,
    Re,
    lambda,
    dp_darcy_Pa: dp_darcy,
    dp_riempimento_Pa: dp_riempimento,
    dp_extra_Pa: dp_extra,
    dp_tot_Pa: dp_darcy + dp_riempimento + dp_extra,
  };
}

// â”€â”€ Componente principale â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function ToolAspiratore({ projectData, setProjectData, setAppMode }: ToolAspiratorProps) {
  const [data, setData] = useState<FanToolData>(defaultData);

  function updGlobal(field: keyof FanGlobalData, value: number) {
    setData(prev => ({ ...prev, global: { ...prev.global, [field]: value } }));
  }

  function addSegment() {
    setData(prev => ({ ...prev, segments: [...prev.segments, newSegment()] }));
  }

  function removeSegment(id: number) {
    setData(prev => ({ ...prev, segments: prev.segments.filter(s => s.id !== id) }));
  }

  function updSegment(id: number, field: keyof DuctSegment, value: any) {
    setData(prev => ({
      ...prev,
      segments: prev.segments.map(s => {
        if (s.id !== id) return s;
        const updated = { ...s, [field]: value };
        // auto-aggiorna scabrezza se cambio materiale
        if (field === 'material' && typeof value === 'string' && FAN_ROUGHNESS[value] !== undefined) {
          updated.roughness_mm = FAN_ROUGHNESS[value];
        }
        return updated;
      })
    }));
  }

  function addSpecial() {
    setData(prev => ({ ...prev, specials: [...prev.specials, newSpecial()] }));
  }

  function removeSpecial(id: number) {
    setData(prev => ({ ...prev, specials: prev.specials.filter(s => s.id !== id) }));
  }

  function updSpecial(id: number, field: keyof SpecialComponent, value: any) {
    setData(prev => ({
      ...prev,
      specials: prev.specials.map(s => s.id !== id ? s : { ...s, [field]: value })
    }));
  }

  // â”€â”€ Calcoli principali (useMemo) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const calc = useMemo(() => {
    const g = data.global;
    if (g.Q_design_m3h <= 0) return null;

    const rho = calcRhoAria(g.T_aria_C, g.quota_m);
    const nu  = calcNuAria(g.T_aria_C);

    // Tratti condotta
    const segResults = data.segments.map(seg =>
      ({ seg, res: calcSegmentDP(seg, g.Q_design_m3h, rho, nu) })
    );

    // Componenti speciali
    const specResults = data.specials.map(sp =>
      ({ sp, res: calcSpecialDP(sp, g.Q_design_m3h, rho, nu) })
    );

    const dp_tratti   = segResults.reduce((s, r) => s + r.res.dp_tot_Pa, 0);
    const dp_speciali = specResults.reduce((s, r) => s + r.res.dp_tot_Pa, 0);
    const dp_impianto = dp_tratti + dp_speciali;

    // Pressione totale ventilatore (come da Excel)
    const dp_asp   = g.dp_bocchetta_Pa + dp_impianto;
    const dp_tot   = dp_asp; // lato mandata incluso nei tratti

    // Potenza ventilatore: P = Q [m³/s] × Î”P [Pa] / η_vent
    const Q_m3s    = g.Q_design_m3h / 3600;
    const P_aria_W = Q_m3s * dp_tot / g.eta_ventilatore;
    const P_aria_kW = P_aria_W / 1000;
    const P_ogni_vent_W = g.n_titolari > 0 ? (g.Q_design_m3h / g.n_titolari / 3600 * dp_tot / g.eta_ventilatore) : 0;
    const P_ogni_vent_kW = P_ogni_vent_W / 1000;
    const P_totale_W = (g.n_titolari + g.n_riserva) * P_ogni_vent_W;
    const P_totale_kW = P_totale_W / 1000;

    const taglia_IEC = getTagliaIEC(P_ogni_vent_kW);
    const dp_mmH2O = dp_tot / 9.80665; // conversione Pa â†’ mmH2O

    return {
      rho, nu,
      segResults,
      specResults,
      dp_tratti,
      dp_speciali,
      dp_impianto,
      dp_bocchetta: g.dp_bocchetta_Pa,
      dp_tot,
      dp_mmH2O,
      Q_m3s,
      P_ogni_vent_W,
      P_ogni_vent_kW,
      P_totale_W,
      P_totale_kW,
      P_aria_kW,
      taglia_IEC,
    };
  }, [data]);

  // â”€â”€ Cloud save/load â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const getCloudSaveData = () => ({ aspiratore: data });
  const handleLoadCloudProject = (loadedData: any) => {
    if (loadedData?.aspiratore) setData(loadedData.aspiratore);
  };

  // â”€â”€ Helpers UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const inputCls = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 font-semibold transition-all";
  const labelCls = "block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1";
  const numInput = (val: number, onChange: (v: number) => void, placeholder = '', step = 'any', min = '0') => (
    <input type="number" min={min} step={step}
      value={val === 0 ? '' : val}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className={inputCls} placeholder={placeholder} />
  );

  const tabs: { key: FanToolData['activeTab']; label: string; icon: React.ReactNode }[] = [
    { key: 'config',    label: 'Configurazione',  icon: <Wind className="w-3.5 h-3.5" /> },
    { key: 'tratti',   label: 'Tratti & Accessori', icon: <Zap className="w-3.5 h-3.5" /> },
    { key: 'risultati',label: 'Risultati',        icon: <CheckCircle className="w-3.5 h-3.5" /> },
  ];

  return (
    <>
    {/* ProjectHeader — sempre visibile in stampa: gestisce logo, titolo, autore, data */}
    <ProjectHeader
      pData={projectData}
      setPData={setProjectData}
      title="Aspiratore / Ventilatore Industriale"
      setAppMode={setAppMode}
    />

    <div className="print:hidden space-y-6 pb-12">
      <ProjectStorage
        toolType="aspiratore"
        currentData={getCloudSaveData()}
        onLoadProject={handleLoadCloudProject}
        projectInfo={projectData}
        setProjectInfo={setProjectData}
      />

      {/* Box formule */}
      <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-4 print:hidden">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-cyan-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-cyan-800 mb-1">Formule di calcolo (Darcy-Weisbach + Colebrook-White iterativo per aria)</p>
            <p className="text-[11px] text-cyan-700 font-mono leading-relaxed">
              Ï = 1.293 × (273.15/T<sub>K</sub>) × (P<sub>atm</sub>/101325) &nbsp;|&nbsp;
              Î”P<sub>dist</sub> = λÂ·(L/D)Â·ÏÂ·v²/2 &nbsp;|&nbsp;
              Î”P<sub>conc</sub> = λÂ·(L<sub>eq</sub>/D)Â·ÏÂ·v²/2 &nbsp;|&nbsp;
              P<sub>vent</sub> = Q<sub>m³/s</sub>Â·Î”P<sub>tot</sub>/η
            </p>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 print:hidden flex-wrap">
        {tabs.map(t => (
          <button key={t.key}
            onClick={() => setData(prev => ({ ...prev, activeTab: t.key }))}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer ${
              data.activeTab === t.key
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/20'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-cyan-50 hover:border-cyan-300'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* â•â• TAB 1: CONFIGURAZIONE â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {data.activeTab === 'config' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-sm font-black text-slate-800 mb-5 pb-3 border-b border-slate-100 flex items-center gap-2">
            <span className="p-1.5 bg-cyan-100 text-cyan-600 rounded-lg"><Wind className="w-4 h-4" /></span>
            Dati Generali Impianto
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

            <div>
              <label className={labelCls}>Temperatura aria</label>
              <div className="relative">
                {numInput(data.global.T_aria_C, v => updGlobal('T_aria_C', v), '20', '1', '-20')}
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">°C</span>
              </div>
              {calc && <p className="text-[10px] text-slate-400 mt-0.5 ml-1">Ï = {calc.rho.toFixed(4)} kg/m³</p>}
            </div>

            <div>
              <label className={labelCls}>Quota impianto</label>
              <div className="relative">
                {numInput(data.global.quota_m, v => updGlobal('quota_m', v), '0', '10')}
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">m s.l.m.</span>
              </div>
            </div>

            <div>
              <label className={labelCls}>Portata di progetto</label>
              <div className="relative">
                {numInput(data.global.Q_design_m3h, v => updGlobal('Q_design_m3h', v), '2000', '10')}
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-cyan-600 font-bold">m³/h</span>
              </div>
              {data.global.Q_design_m3h > 0 && (
                <p className="text-[10px] text-slate-400 mt-0.5 ml-1">= {(data.global.Q_design_m3h/3600).toFixed(4)} m³/s</p>
              )}
            </div>

            <div>
              <label className={labelCls}>Depressione alle bocchette</label>
              <div className="relative">
                {numInput(data.global.dp_bocchetta_Pa, v => updGlobal('dp_bocchetta_Pa', v), '250', '10')}
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">Pa</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 ml-1">Depressione max alle bocchette aspirazione (dai dati di progetto)</p>
            </div>

            <div>
              <label className={labelCls}>Rendimento ventilatore η</label>
              <div className="relative">
                {numInput(data.global.eta_ventilatore, v => updGlobal('eta_ventilatore', v), '0.55', '0.01')}
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                  {(data.global.eta_ventilatore * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 ml-1">Tipico: 0.50÷0.75 per ventilatori centrifughi</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Ventilatori titolari</label>
                <select value={data.global.n_titolari}
                  onChange={e => updGlobal('n_titolari', parseInt(e.target.value))}
                  className={inputCls}>
                  {[1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Di riserva</label>
                <select value={data.global.n_riserva}
                  onChange={e => updGlobal('n_riserva', parseInt(e.target.value))}
                  className={inputCls}>
                  {[0,1,2].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Riepilogo fisico */}
          {calc && (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'DensitÃ  aria Ï', val: calc.rho.toFixed(4), unit: 'kg/m³' },
                { label: 'ViscositÃ  cin. ν', val: (calc.nu * 1e6).toFixed(2), unit: '×10â»â¶ m²/s' },
                { label: 'Portata volumetrica', val: calc.Q_m3s.toFixed(4), unit: 'm³/s' },
                { label: 'Configurazione', val: `${data.global.n_titolari}+${data.global.n_riserva}`, unit: 'ventilatori' },
              ].map(({ label, val, unit }) => (
                <div key={label} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
                  <p className="text-sm font-black text-slate-800">{val} <span className="text-[10px] font-normal text-slate-500">{unit}</span></p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* â•â• TAB 2: TRATTI & COMPONENTI SPECIALI â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {data.activeTab === 'tratti' && (
        <div className="space-y-5">

          {/* Tratti condotta */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <span className="p-1.5 bg-cyan-100 text-cyan-600 rounded-lg"><Wind className="w-4 h-4" /></span>
                Tratti Condotta (in serie)
              </h3>
              <button onClick={addSegment}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer shadow-sm">
                <Plus className="w-3.5 h-3.5" /> Aggiungi Tratto
              </button>
            </div>

            <div className="space-y-4">
              {data.segments.map((seg, idx) => (
                <div key={seg.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-cyan-700 bg-cyan-100 px-2 py-0.5 rounded-full">
                      Tratto {idx + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      {calc && calc.segResults[idx] && (() => {
                        const v = calc.segResults[idx].res.v_ms;
                        const ok = v >= 5 && v <= 20;
                        const warn = v < 5 || v > 20;
                        return (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${ok ? 'bg-emerald-100 text-emerald-700' : warn ? 'bg-amber-100 text-amber-700' : ''}`}>
                            {ok ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                            v = {v.toFixed(2)} m/s
                          </span>
                        );
                      })()}
                      {calc && calc.segResults[idx] && (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                          Î”P = {calc.segResults[idx].res.dp_tot_Pa.toFixed(1)} Pa
                        </span>
                      )}
                      {data.segments.length > 1 && (
                        <button onClick={() => removeSegment(seg.id)}
                          className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center cursor-pointer transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="lg:col-span-2">
                      <label className={labelCls}>Nome tratto</label>
                      <input type="text" value={seg.name}
                        onChange={e => updSegment(seg.id, 'name', e.target.value)}
                        className={inputCls} placeholder="es. L1" />
                    </div>
                    <div>
                      <label className={labelCls}>Ã˜ interno</label>
                      <div className="relative">
                        <input type="number" min="10" step="1" value={seg.D_mm || ''}
                          onChange={e => updSegment(seg.id, 'D_mm', parseFloat(e.target.value) || 0)}
                          className={inputCls} placeholder="231" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold">mm</span>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Lunghezza</label>
                      <div className="relative">
                        <input type="number" min="0" step="0.5" value={seg.L_m || ''}
                          onChange={e => updSegment(seg.id, 'L_m', parseFloat(e.target.value) || 0)}
                          className={inputCls} placeholder="10" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold">m</span>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Materiale</label>
                      <select value={seg.material}
                        onChange={e => updSegment(seg.id, 'material', e.target.value)}
                        className={inputCls}>
                        {Object.keys(FAN_ROUGHNESS).map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Scabrezza Îµ</label>
                      <div className="relative">
                        <input type="number" min="0" step="0.001" value={seg.roughness_mm || ''}
                          onChange={e => updSegment(seg.id, 'roughness_mm', parseFloat(e.target.value) || 0)}
                          className={inputCls} placeholder="0.02" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold">mm</span>
                      </div>
                    </div>
                  </div>

                  {/* Accessori */}
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Accessori (numero pezzi)</p>
                    <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-2">
                      {[
                        { field: 'n_gomiti90_R15' as const, label: 'Gomito 90° R1.5' },
                        { field: 'n_gomiti90_R2'  as const, label: 'Gomito 90° R2' },
                        { field: 'n_gomiti45'     as const, label: 'Gomito 45°' },
                        { field: 'n_bif_principale' as const, label: 'Bif. princ.' },
                        { field: 'n_bif_laterale' as const, label: 'Bif. lat.' },
                        { field: 'n_rid_exp'      as const, label: 'Rid. espans.' },
                        { field: 'n_rid_cont'     as const, label: 'Rid. contr.' },
                        { field: 'n_valvole'      as const, label: 'Valvole' },
                        { field: 'n_ingresso'     as const, label: 'Ingressi' },
                        { field: 'n_uscita'       as const, label: 'Uscite' },
                      ].map(({ field, label }) => (
                        <div key={field}>
                          <label className="block text-[9px] font-bold text-slate-400 mb-0.5 truncate">{label}</label>
                          <input type="number" min="0" step="1" value={seg[field] || ''}
                            onChange={e => updSegment(seg.id, field, parseInt(e.target.value) || 0)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                            placeholder="0" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mini-riepilogo tratto */}
                  {calc && calc.segResults[idx] && (() => {
                    const r = calc.segResults[idx].res;
                    return (
                      <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2 text-[10px]">
                        {[
                          { l: 'VelocitÃ ', v: r.v_ms.toFixed(2), u: 'm/s' },
                          { l: 'Reynolds', v: Math.round(r.Re).toLocaleString(), u: '' },
                          { l: 'λ', v: r.lambda.toFixed(4), u: '' },
                          { l: 'L_eq acc.', v: r.L_eq_tot_m.toFixed(2), u: 'm' },
                          { l: 'Î”P dist.', v: r.dp_dist_Pa.toFixed(1), u: 'Pa' },
                          { l: 'Î”P conc.', v: r.dp_conc_Pa.toFixed(1), u: 'Pa' },
                        ].map(({ l, v, u }) => (
                          <div key={l} className="bg-white rounded-lg p-1.5 border border-slate-100 text-center">
                            <span className="text-slate-400 block">{l}</span>
                            <strong className="text-slate-700">{v}</strong>
                            {u && <span className="text-slate-400 ml-0.5">{u}</span>}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>

          {/* Componenti speciali (scrubber, filtri, ecc.) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <button onClick={() => setData(prev => ({ ...prev, showSpecials: !prev.showSpecials }))}
              className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Wind className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-black text-slate-800">Componenti Speciali</h3>
                  <p className="text-[11px] text-slate-400">Scrubber, filtri, silenziatori, separatori — perdita Darcy + perdita riempimento</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {data.specials.length > 0 && (
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                    {data.specials.length} componente{data.specials.length > 1 ? 'i' : ''}
                  </span>
                )}
                {data.showSpecials ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </div>
            </button>

            {data.showSpecials && (
              <div className="px-6 pb-6 border-t border-slate-100">
                <div className="flex justify-end mt-4 mb-4">
                  <button onClick={addSpecial}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer shadow-sm">
                    <Plus className="w-3.5 h-3.5" /> Aggiungi Componente
                  </button>
                </div>

                <div className="space-y-4">
                  {data.specials.length === 0 && (
                    <p className="text-center text-slate-400 text-xs py-4">Nessun componente speciale. Clicca "Aggiungi" per inserire uno scrubber, filtro, ecc.</p>
                  )}
                  {data.specials.map((sp, idx) => (
                    <div key={sp.id} className="border border-indigo-200 rounded-xl p-4 bg-indigo-50/30">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                          Comp. {idx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          {calc && calc.specResults[idx] && (
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                              Î”P = {calc.specResults[idx].res.dp_tot_Pa.toFixed(1)} Pa
                            </span>
                          )}
                          <button onClick={() => removeSpecial(sp.id)}
                            className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center cursor-pointer transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div>
                          <label className={labelCls}>Tipo</label>
                          <select value={sp.type}
                            onChange={e => updSpecial(sp.id, 'type', e.target.value)}
                            className={inputCls}>
                            {['Scrubber', 'Filtro', 'Silenziatore', 'Scambiatore', 'Separatore', 'Altro'].map(t =>
                              <option key={t} value={t}>{t}</option>
                            )}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Nome</label>
                          <input type="text" value={sp.name}
                            onChange={e => updSpecial(sp.id, 'name', e.target.value)}
                            className={inputCls} placeholder="es. Scrubber C1" />
                        </div>
                        <div>
                          <label className={labelCls}>Ã˜ interno corpo</label>
                          <div className="relative">
                            <input type="number" min="0" step="10" value={sp.D_interno_mm || ''}
                              onChange={e => updSpecial(sp.id, 'D_interno_mm', parseFloat(e.target.value) || 0)}
                              className={inputCls} placeholder="930" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold">mm</span>
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>H attraversamento</label>
                          <div className="relative">
                            <input type="number" min="0" step="0.1" value={sp.H_corpo_m || ''}
                              onChange={e => updSpecial(sp.id, 'H_corpo_m', parseFloat(e.target.value) || 0)}
                              className={inputCls} placeholder="3.7" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold">m</span>
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>H riempimento</label>
                          <div className="relative">
                            <input type="number" min="0" step="0.05" value={sp.H_riempimento_m || ''}
                              onChange={e => updSpecial(sp.id, 'H_riempimento_m', parseFloat(e.target.value) || 0)}
                              className={inputCls} placeholder="0.8" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold">m</span>
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Perd. specifica riempit.</label>
                          <div className="relative">
                            <input type="number" min="0" step="10" value={sp.dp_riempimento_Pa_m || ''}
                              onChange={e => updSpecial(sp.id, 'dp_riempimento_Pa_m', parseFloat(e.target.value) || 0)}
                              className={inputCls} placeholder="200" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold">Pa/m</span>
                          </div>
                        </div>
                        <div className="sm:col-span-3 lg:col-span-2">
                          <label className={labelCls}>Perdita extra fissa (demister, ugelli, ecc.)</label>
                          <div className="relative">
                            <input type="number" min="0" step="10" value={sp.dp_extra_Pa || ''}
                              onChange={e => updSpecial(sp.id, 'dp_extra_Pa', parseFloat(e.target.value) || 0)}
                              className={inputCls} placeholder="0" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold">Pa</span>
                          </div>
                        </div>
                      </div>

                      {/* Mini-riepilogo componente speciale */}
                      {calc && calc.specResults[idx] && (() => {
                        const r = calc.specResults[idx].res;
                        return (
                          <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px]">
                            {[
                              { l: 'Vel. corpo', v: r.v_ms.toFixed(2), u: 'm/s' },
                              { l: 'Î”P Darcy', v: r.dp_darcy_Pa.toFixed(1), u: 'Pa' },
                              { l: 'Î”P riempit.', v: r.dp_riempimento_Pa.toFixed(1), u: 'Pa' },
                              { l: 'Î”P extra', v: r.dp_extra_Pa.toFixed(1), u: 'Pa' },
                              { l: 'Î”P totale', v: r.dp_tot_Pa.toFixed(1), u: 'Pa' },
                            ].map(({ l, v, u }) => (
                              <div key={l} className="bg-white rounded-lg p-1.5 border border-indigo-100 text-center">
                                <span className="text-slate-400 block">{l}</span>
                                <strong className="text-indigo-700">{v}</strong>
                                {u && <span className="text-slate-400 ml-0.5">{u}</span>}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* â•â• TAB 3: RISULTATI â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {data.activeTab === 'risultati' && (
        <div className="space-y-5">
          {!calc ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center">
              <Wind className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-400">Inserisci la portata di progetto per visualizzare i risultati.</p>
            </div>
          ) : (
            <>
              {/* Tabella riepilogo perdite */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 print-section">
                <h3 className="text-sm font-black text-slate-800 mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
                  <span className="p-1.5 bg-cyan-100 text-cyan-600 rounded-lg"><Zap className="w-4 h-4" /></span>
                  Bilancio Perdite di Carico
                </h3>

                <div className="rounded-xl border border-slate-200 overflow-hidden mb-4">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      <tr>
                        <th className="py-2 px-3 text-left">Elemento</th>
                        <th className="py-2 px-3 text-right">Î”P [Pa]</th>
                        <th className="py-2 px-3 text-right">Î”P [mmHâ‚‚O]</th>
                        <th className="py-2 px-3 text-right">% del totale</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {calc.segResults.map(({ seg, res }, i) => (
                        <tr key={seg.id} className="even:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-medium text-slate-600">{seg.name || `Tratto ${i+1}`}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800">{res.dp_tot_Pa.toFixed(1)}</td>
                          <td className="py-2.5 px-3 text-right text-slate-500">{(res.dp_tot_Pa / 9.80665).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right text-slate-500">
                            {calc.dp_impianto > 0 ? ((res.dp_tot_Pa / calc.dp_impianto) * 100).toFixed(1) : '—'}%
                          </td>
                        </tr>
                      ))}
                      {calc.specResults.map(({ sp, res }) => (
                        <tr key={sp.id} className="even:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-medium text-indigo-600">{sp.name} ({sp.type})</td>
                          <td className="py-2.5 px-3 text-right font-bold text-indigo-800">{res.dp_tot_Pa.toFixed(1)}</td>
                          <td className="py-2.5 px-3 text-right text-slate-500">{(res.dp_tot_Pa / 9.80665).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right text-slate-500">
                            {calc.dp_impianto > 0 ? ((res.dp_tot_Pa / calc.dp_impianto) * 100).toFixed(1) : '—'}%
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-amber-50 border-t-2 border-amber-200 font-bold">
                        <td className="py-2.5 px-3 text-amber-800">Subtotale impianto</td>
                        <td className="py-2.5 px-3 text-right text-amber-700">{calc.dp_impianto.toFixed(1)}</td>
                        <td className="py-2.5 px-3 text-right text-amber-600">{(calc.dp_impianto / 9.80665).toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right text-amber-600">100%</td>
                      </tr>
                      <tr className="bg-slate-100">
                        <td className="py-2.5 px-3 text-slate-600 font-medium">Depressione bocchette</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">{calc.dp_bocchetta.toFixed(1)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-500">{(calc.dp_bocchetta / 9.80665).toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-500">—</td>
                      </tr>
                      <tr className="bg-cyan-600 text-white font-black">
                        <td className="py-3 px-3">Pressione Totale Ventilatore</td>
                        <td className="py-3 px-3 text-right text-lg">{calc.dp_tot.toFixed(1)}</td>
                        <td className="py-3 px-3 text-right">{calc.dp_mmH2O.toFixed(2)}</td>
                        <td className="py-3 px-3 text-right text-cyan-200">—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dimensionamento ventilatore */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 print-section">
                <h3 className="text-sm font-black text-slate-800 mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><CheckCircle className="w-4 h-4" /></span>
                  Dimensionamento Ventilatore
                </h3>

                <div className="rounded-xl border border-slate-200 overflow-hidden mb-5">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      <tr>
                        <th className="py-2 px-3 text-left">Grandezza</th>
                        <th className="py-2 px-3 text-right">Valore</th>
                        <th className="py-2 px-3 text-left">UnitÃ </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        { l: 'Portata totale impianto', v: data.global.Q_design_m3h.toFixed(0), u: 'm³/h' },
                        { l: 'Pressione totale', v: calc.dp_tot.toFixed(1), u: 'Pa' },
                        { l: 'Pressione totale', v: calc.dp_mmH2O.toFixed(2), u: 'mmHâ‚‚O' },
                        { l: 'Rendimento ventilatore η', v: (data.global.eta_ventilatore * 100).toFixed(0), u: '%' },
                        { l: 'N. ventilatori titolari', v: data.global.n_titolari.toString(), u: '' },
                        { l: 'Portata per ventilatore', v: (data.global.Q_design_m3h / data.global.n_titolari).toFixed(0), u: 'm³/h' },
                        { l: 'Potenza per ventilatore', v: (calc.P_ogni_vent_W).toFixed(1), u: 'W' },
                        { l: 'Potenza per ventilatore', v: calc.P_ogni_vent_kW.toFixed(3), u: 'kW' },
                        { l: 'Potenza totale installata', v: calc.P_totale_W.toFixed(1), u: 'W' },
                      ].map(({ l, v, u }) => (
                        <tr key={l+u} className="even:bg-slate-50/50">
                          <td className="py-2.5 px-3 text-slate-600 font-medium">{l}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800">{v}</td>
                          <td className="py-2.5 px-3 text-slate-400 font-mono">{u}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Taglia IEC — evidenza */}
                <div className="bg-gradient-to-br from-cyan-600 to-sky-600 rounded-2xl p-5 text-white shadow-lg">
                  <p className="text-xs font-bold text-white/70 uppercase tracking-wide mb-1">Taglia motore commerciale IEC — per ventilatore</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-5xl font-black tracking-tight">{calc.taglia_IEC}</span>
                      <span className="text-2xl font-bold text-white/80 ml-2">kW</span>
                    </div>
                    <div className="text-right text-xs text-white/70">
                      <p>× {data.global.n_titolari + data.global.n_riserva} ventilatori installati</p>
                      <p className="font-bold text-white mt-0.5">{calc.taglia_IEC * (data.global.n_titolari + data.global.n_riserva)} kW totali</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/20 text-[10px] text-white/60">
                    Prossima taglia IEC ≥ P<sub>per ventilatore</sub> ({calc.P_ogni_vent_kW.toFixed(3)} kW calcolata)
                  </div>
                </div>

                {/* Validazione con Excel di riferimento */}
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 mb-1">ðŸ“‹ Dati di riferimento Excel (Dim impianto STATO PROGETTO_rev00.xls)</p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Q=2000 m³/h Â· Î”P<sub>tot</sub>=2768.5 Pa (282.3 mmHâ‚‚O) Â· η=55% Â· P<sub>vent</sub>=2796 W
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>

    {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â• REPORT STAMPA â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
    {/* Visibile solo in stampa — il logo e le info progetto vengono dal ProjectHeader sopra */}
    <div className="hidden print:block space-y-5">

      {!calc ? (
        <p className="text-sm text-slate-400 italic">Nessun risultato — inserire la portata di progetto nella scheda interattiva.</p>
      ) : (
        <>
          {/* Sezione: Configurazione Impianto */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3 pb-1 border-b border-slate-300">Configurazione Impianto</h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Temperatura Aria</label>
                <span className="text-lg font-semibold text-slate-800">{data.global.T_aria_C} °C</span>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quota Impianto</label>
                <span className="text-lg font-semibold text-slate-800">{data.global.quota_m} m s.l.m.</span>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Portata di Progetto Q</label>
                <span className="text-lg font-semibold text-slate-800">{data.global.Q_design_m3h} m³/h</span>
                <p className="text-[9px] text-slate-400">= {calc.Q_m3s.toFixed(4)} m³/s</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Depress. Bocchette</label>
                <span className="text-lg font-semibold text-slate-800">{data.global.dp_bocchetta_Pa} Pa</span>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rendimento Ventilatore η</label>
                <span className="text-lg font-semibold text-slate-800">{(data.global.eta_ventilatore*100).toFixed(0)} %</span>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conf. Ventilatori</label>
                <span className="text-lg font-semibold text-slate-800">{data.global.n_titolari}+{data.global.n_riserva}</span>
                <p className="text-[9px] text-slate-400">titolari + riserva</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">DensitÃ  Ï Aria</label>
                <span className="text-lg font-semibold text-slate-800">{calc.rho.toFixed(4)} kg/m³</span>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">ViscositÃ  ν Aria</label>
                <span className="text-lg font-semibold text-slate-800">{(calc.nu*1e6).toFixed(3)}×10â»â¶ m²/s</span>
              </div>
            </div>
          </div>

          {/* Sezione: Tratti Condotta */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3 pb-1 border-b border-slate-300">Tratti Condotta</h3>
            <table className="w-full">
              <thead>
                <tr>
                  {['Ã˜ Condotta', 'Lungh. L', 'Materiale', 'VelocitÃ  v', 'Reynolds', 'λ', 'Lâ‚‘áµ  acc.', 'Î”P distr.', 'Î”P conc.', 'Î”P tot.'].map(h => (
                    <th key={h} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right py-1.5 pr-3 border-b border-slate-200 first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calc.segResults.map(({ seg, res }, i) => (
                  <tr key={seg.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3 text-sm font-semibold text-slate-800">{seg.name}</td>
                    <td className="py-1.5 pr-3 text-sm text-right text-slate-700">{seg.D_mm} mm</td>
                    <td className="py-1.5 pr-3 text-sm text-right text-slate-700">{seg.L_m} m</td>
                    <td className="py-1.5 pr-3 text-sm text-right text-slate-500">{seg.material}</td>
                    <td className={`py-1.5 pr-3 text-sm text-right font-bold ${(res.v_ms < 5 || res.v_ms > 20) ? 'text-red-600' : 'text-emerald-700'}`}>{res.v_ms.toFixed(2)} m/s</td>
                    <td className="py-1.5 pr-3 text-sm text-right text-slate-700">{Math.round(res.Re).toLocaleString('it-IT')}</td>
                    <td className="py-1.5 pr-3 text-sm text-right text-slate-700">{res.lambda.toFixed(4)}</td>
                    <td className="py-1.5 pr-3 text-sm text-right text-slate-600">{res.L_eq_tot_m.toFixed(2)} m</td>
                    <td className="py-1.5 pr-3 text-sm text-right text-slate-700">{res.dp_dist_Pa.toFixed(1)} Pa</td>
                    <td className="py-1.5 pr-3 text-sm text-right text-slate-700">{res.dp_conc_Pa.toFixed(1)} Pa</td>
                    <td className="py-1.5 pr-3 text-sm text-right font-bold text-slate-900">{res.dp_tot_Pa.toFixed(1)} Pa</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sezione: Componenti Speciali (se presenti) */}
          {calc.specResults.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3 pb-1 border-b border-slate-300">Componenti Speciali</h3>
              <table className="w-full">
                <thead>
                  <tr>
                    {['Componente', 'Tipo', 'Ã˜ int.', 'H corpo', 'H riemp.', 'Î”P riemp./m', 'VelocitÃ  v', 'Î”P Darcy', 'Î”P riemp.', 'Î”P extra', 'Î”P tot.'].map(h => (
                      <th key={h} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right py-1.5 pr-3 border-b border-slate-200 first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calc.specResults.map(({ sp, res }) => (
                    <tr key={sp.id} className="border-b border-slate-100">
                      <td className="py-1.5 pr-3 text-sm font-semibold text-slate-800">{sp.name}</td>
                      <td className="py-1.5 pr-3 text-sm text-right text-slate-500">{sp.type}</td>
                      <td className="py-1.5 pr-3 text-sm text-right text-slate-700">{sp.D_interno_mm} mm</td>
                      <td className="py-1.5 pr-3 text-sm text-right text-slate-700">{sp.H_corpo_m} m</td>
                      <td className="py-1.5 pr-3 text-sm text-right text-slate-700">{sp.H_riempimento_m} m</td>
                      <td className="py-1.5 pr-3 text-sm text-right text-slate-700">{sp.dp_riempimento_Pa_m} Pa/m</td>
                      <td className="py-1.5 pr-3 text-sm text-right font-bold text-slate-800">{res.v_ms.toFixed(2)} m/s</td>
                      <td className="py-1.5 pr-3 text-sm text-right text-slate-700">{res.dp_darcy_Pa.toFixed(1)} Pa</td>
                      <td className="py-1.5 pr-3 text-sm text-right text-slate-700">{res.dp_riempimento_Pa.toFixed(1)} Pa</td>
                      <td className="py-1.5 pr-3 text-sm text-right text-slate-700">{res.dp_extra_Pa.toFixed(1)} Pa</td>
                      <td className="py-1.5 pr-3 text-sm text-right font-bold text-slate-900">{res.dp_tot_Pa.toFixed(1)} Pa</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Sezione: Bilancio + Dimensionamento (due colonne) */}
          <div className="grid grid-cols-2 gap-8">

            {/* Bilancio Perdite */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3 pb-1 border-b border-slate-300">Bilancio Perdite di Carico</h3>
              <table className="w-full">
                <thead>
                  <tr>
                    {['Elemento', 'Î”P (Pa)', 'Î”P (mmHâ‚‚O)', '%'].map(h => (
                      <th key={h} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right py-1.5 pr-3 border-b border-slate-200 first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calc.segResults.map(({ seg, res }) => (
                    <tr key={seg.id} className="border-b border-slate-100">
                      <td className="py-1.5 pr-3 text-sm text-slate-700">{seg.name}</td>
                      <td className="py-1.5 pr-3 text-sm text-right text-slate-800">{res.dp_tot_Pa.toFixed(1)}</td>
                      <td className="py-1.5 pr-3 text-sm text-right text-slate-600">{(res.dp_tot_Pa/9.80665).toFixed(2)}</td>
                      <td className="py-1.5 pr-3 text-sm text-right text-slate-500">{calc.dp_impianto>0 ? ((res.dp_tot_Pa/calc.dp_impianto)*100).toFixed(0) : '—'}%</td>
                    </tr>
                  ))}
                  {calc.specResults.map(({ sp, res }) => (
                    <tr key={sp.id} className="border-b border-slate-100">
                      <td className="py-1.5 pr-3 text-sm text-slate-600 italic">{sp.name}</td>
                      <td className="py-1.5 pr-3 text-sm text-right text-slate-800">{res.dp_tot_Pa.toFixed(1)}</td>
                      <td className="py-1.5 pr-3 text-sm text-right text-slate-600">{(res.dp_tot_Pa/9.80665).toFixed(2)}</td>
                      <td className="py-1.5 pr-3 text-sm text-right text-slate-500">{calc.dp_impianto>0 ? ((res.dp_tot_Pa/calc.dp_impianto)*100).toFixed(0) : '—'}%</td>
                    </tr>
                  ))}
                  <tr className="border-b-2 border-slate-300 font-bold">
                    <td className="py-1.5 pr-3 text-sm text-slate-800">Subtotale impianto</td>
                    <td className="py-1.5 pr-3 text-sm text-right text-slate-900">{calc.dp_impianto.toFixed(1)}</td>
                    <td className="py-1.5 pr-3 text-sm text-right text-slate-700">{(calc.dp_impianto/9.80665).toFixed(2)}</td>
                    <td className="py-1.5 pr-3 text-sm text-right text-slate-600">100%</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 pr-3 text-sm text-slate-600">Depress. bocchette asp.</td>
                    <td className="py-1.5 pr-3 text-sm text-right text-slate-700">{calc.dp_bocchetta.toFixed(1)}</td>
                    <td className="py-1.5 pr-3 text-sm text-right text-slate-500">{(calc.dp_bocchetta/9.80665).toFixed(2)}</td>
                    <td className="py-1.5 pr-3 text-sm text-right text-slate-400">—</td>
                  </tr>
                  <tr className="bg-slate-800">
                    <td className="py-2 pr-3 text-sm font-bold text-white rounded-bl-lg">Pressione Totale Ventilatore</td>
                    <td className="py-2 pr-3 text-sm text-right font-black text-white text-base">{calc.dp_tot.toFixed(1)}</td>
                    <td className="py-2 pr-3 text-sm text-right font-bold text-slate-300">{calc.dp_mmH2O.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-sm text-right text-slate-400 rounded-br-lg">—</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Dimensionamento Ventilatore */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3 pb-1 border-b border-slate-300">Dimensionamento Ventilatore</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Portata Totale</label>
                  <span className="text-lg font-semibold text-slate-800">{data.global.Q_design_m3h.toFixed(0)} m³/h</span>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pressione Totale</label>
                  <span className="text-lg font-semibold text-slate-800">{calc.dp_tot.toFixed(1)} Pa</span>
                  <p className="text-[9px] text-slate-400">{calc.dp_mmH2O.toFixed(2)} mmHâ‚‚O</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">N. Titolari</label>
                  <span className="text-lg font-semibold text-slate-800">{data.global.n_titolari}</span>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Portata per Ventilatore</label>
                  <span className="text-lg font-semibold text-slate-800">{(data.global.Q_design_m3h/data.global.n_titolari).toFixed(0)} m³/h</span>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Potenza per Ventilatore</label>
                  <span className="text-lg font-semibold text-slate-800">{calc.P_ogni_vent_W.toFixed(0)} W</span>
                  <p className="text-[9px] text-slate-400">{calc.P_ogni_vent_kW.toFixed(3)} kW</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Potenza Totale</label>
                  <span className="text-lg font-semibold text-slate-800">{calc.P_totale_kW.toFixed(3)} kW</span>
                </div>
                <div className="col-span-2 bg-slate-800 rounded-lg p-3">
                  <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider">Taglia Motore IEC (per ventilatore)</label>
                  <span className="text-2xl font-black text-white">{calc.taglia_IEC} kW</span>
                  <p className="text-[9px] text-slate-400 mt-1">Tot installato ({data.global.n_titolari+data.global.n_riserva} ventilatori): {calc.taglia_IEC*(data.global.n_titolari+data.global.n_riserva)} kW</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
    </>
  );
}
