import React, { useState, useMemo } from 'react';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Info, Zap, Droplets } from 'lucide-react';
import { PrintReport, PrintSection } from '../components/print';

interface ToolPompeFognarieProps {
  projectData: ProjectData;
  setProjectData: (data: any) => void;
  setAppMode: (mode: string) => void;
}

// Taglie motori commerciali IEC standard [kW]
const TAGLIE_IEC = [0.25, 0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3.0, 4.0, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250, 315];

function getTagliaIEC(kW: number): number {
  return TAGLIE_IEC.find(t => t >= kW) ?? TAGLIE_IEC[TAGLIE_IEC.length - 1];
}

interface PompeFognarieData {
  // Step 1 — Portate
  Q_media_m3h: string;     // Portata media in ingresso stazione [m³/h]
  Q_picco_m3h: string;     // Portata di picco in ingresso stazione [m³/h]
  Q_pompa_m3h: string;     // Portata massima sollevata dalla pompa [m³/h]
  // Step 2 — Prevalenza e pompe
  H_prevalenza_m: string;  // Prevalenza [m]
  eta_pompa: string;       // Rendimento pompe [0â€“1]
  K_maggiorativo: string;  // Coefficiente maggiorativo
  N_servizio: string;      // Numero pompe in servizio
  N_riserva: string;       // Numero pompe di riserva
  // Step 3 — Vasca (opzionale)
  showVasca: boolean;
  L_vasca_m: string;       // Lunghezza vasca [m]
  W_vasca_m: string;       // Larghezza vasca [m]
  V1_m3: string;           // Volume V1 [m³]
  V2_m3: string;           // Volume V2 [m³]
  H0_m: string;            // Altezza di guardia H0 [m]
}

const defaultData: PompeFognarieData = {
  Q_media_m3h: '',
  Q_picco_m3h: '',
  Q_pompa_m3h: '',
  H_prevalenza_m: '',
  eta_pompa: '0.70',
  K_maggiorativo: '1.30',
  N_servizio: '1',
  N_riserva: '1',
  showVasca: false,
  L_vasca_m: '',
  W_vasca_m: '',
  V1_m3: '',
  V2_m3: '',
  H0_m: '0.40',
};

function fmtKW(v: number): string {
  return v.toFixed(3);
}
function fmtN(v: number, d = 2): string {
  return v.toFixed(d);
}

export function ToolPompeFognarie({ projectData, setProjectData, setAppMode }: ToolPompeFognarieProps) {
  const [data, setData] = useState<PompeFognarieData>(defaultData);

  function upd(field: keyof PompeFognarieData, value: string | boolean) {
    setData(prev => ({ ...prev, [field]: value }));
  }

  // â”€â”€ Calcoli principali (fedeli all'Excel, righe 1â€“17) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const results = useMemo(() => {
    const Q  = parseFloat(data.Q_pompa_m3h) || 0;
    const H  = parseFloat(data.H_prevalenza_m) || 0;
    const eta = parseFloat(data.eta_pompa) || 0;
    const K  = parseFloat(data.K_maggiorativo) || 0;
    const Ns = parseInt(data.N_servizio) || 1;
    const Nr = parseInt(data.N_riserva) || 0;

    const Q_media = parseFloat(data.Q_media_m3h) || 0;
    const Q_picco = parseFloat(data.Q_picco_m3h) || 0;

    if (Q <= 0 || H <= 0 || eta <= 0) {
      return null;
    }

    // Formula Excel: P_max = Q [m³/h] × H [m] × 9.81 / η / 3600
    const P_max_kW      = (Q * H * 9.81) / (eta * 3600);
    const P_inst_kW     = P_max_kW * K;
    const P_pompa_kW    = P_inst_kW / Ns;
    const P_globale_kW  = P_pompa_kW * (Ns + Nr);
    const taglia_IEC    = getTagliaIEC(P_pompa_kW);

    // Portata l/s
    const Q_ls = Q / 3.6;
    const Q_media_ls = Q_media / 3.6;
    const Q_picco_ls = Q_picco / 3.6;

    // Portata P1+P2 contemporaneo (stessa formula Excel: Q_pompa × 1.8)
    const Q_p1p2_m3h = Q * 1.8;
    const Q_p1p2_ogni_m3h = Q_p1p2_m3h / (Ns + Nr);

    return {
      Q_ls,
      Q_media_ls,
      Q_picco_ls,
      Q_p1p2_m3h,
      Q_p1p2_ogni_m3h,
      P_max_kW,
      P_inst_kW,
      P_pompa_kW,
      P_globale_kW,
      taglia_IEC,
      taglia_ok: taglia_IEC <= P_pompa_kW * 1.5,
      Ns,
      Nr,
    };
  }, [data]);

  // â”€â”€ Calcoli vasca (righe 19â€“53 Excel) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const vascaResults = useMemo(() => {
    if (!data.showVasca || !results) return null;

    const V1 = parseFloat(data.V1_m3) || 0;
    const V2 = parseFloat(data.V2_m3) || 0;
    const L  = parseFloat(data.L_vasca_m) || 0;
    const W  = parseFloat(data.W_vasca_m) || 0;
    const H0 = parseFloat(data.H0_m) || 0;
    const Q_media = parseFloat(data.Q_media_m3h) || 0;
    const Q_picco = parseFloat(data.Q_picco_m3h) || 0;
    const Q_pompa = parseFloat(data.Q_pompa_m3h) || 0;

    if (V1 <= 0 || L <= 0 || W <= 0 || Q_media <= 0 || Q_pompa <= 0) return null;

    const S_vasca = L * W;
    const V_tot   = V1 + V2;
    const H1      = V1 / S_vasca;
    const H2      = V2 / S_vasca;
    const H_tot   = H1 + H2 + H0;
    const V_vasca_tot = S_vasca * H_tot;

    // Funzionamento Pompa P1
    const t_rimp_V1_qm    = Q_media > 0 ? (V1 / Q_media) * 60 : null; // min
    const t_rimp_V1_qp    = Q_picco > 0 ? (V1 / Q_picco) * 60 : null;
    const t_svuot_V1_qm   = (Q_pompa - Q_media) > 0 ? (V1 / (Q_pompa - Q_media)) * 60 : null;
    const t_svuot_V1_qp   = (Q_pompa - Q_picco) > 0 ? (V1 / (Q_pompa - Q_picco)) * 60 : null;

    const ciclo_qm        = (t_rimp_V1_qm !== null && t_svuot_V1_qm !== null) ? t_rimp_V1_qm + t_svuot_V1_qm : null;
    const ciclo_qp        = (t_rimp_V1_qp !== null && t_svuot_V1_qp !== null) ? t_rimp_V1_qp + t_svuot_V1_qp : null;
    const avv_qm          = ciclo_qm && ciclo_qm > 0 ? 60 / ciclo_qm : null;
    const avv_qp          = ciclo_qp && ciclo_qp > 0 ? 60 / ciclo_qp : null;

    // Funzionamento P2 (avaria P1) con V1+V2
    const t_rimp_V12_qm   = Q_media > 0 ? (V_tot / Q_media) * 60 : null;
    const t_rimp_V12_qp   = Q_picco > 0 ? (V_tot / Q_picco) * 60 : null;
    const t_svuot_V12_qm  = (Q_pompa - Q_media) > 0 ? (V_tot / (Q_pompa - Q_media)) * 60 : null;
    const t_svuot_V12_qp  = (Q_pompa - Q_picco) > 0 ? (V_tot / (Q_pompa - Q_picco)) * 60 : null;
    const ciclo12_qm      = (t_rimp_V12_qm !== null && t_svuot_V12_qm !== null) ? t_rimp_V12_qm + t_svuot_V12_qm : null;
    const ciclo12_qp      = (t_rimp_V12_qp !== null && t_svuot_V12_qp !== null) ? t_rimp_V12_qp + t_svuot_V12_qp : null;
    const avv12_qm        = ciclo12_qm && ciclo12_qm > 0 ? 60 / ciclo12_qm : null;
    const avv12_qp        = ciclo12_qp && ciclo12_qp > 0 ? 60 / ciclo12_qp : null;

    const MAX_AVV = 10;

    return {
      S_vasca, V_tot, H1, H2, H_tot, V_vasca_tot,
      t_rimp_V1_qm, t_rimp_V1_qp, t_svuot_V1_qm, t_svuot_V1_qp,
      ciclo_qm, ciclo_qp, avv_qm, avv_qp,
      t_rimp_V12_qm, t_rimp_V12_qp, t_svuot_V12_qm, t_svuot_V12_qp,
      ciclo12_qm, ciclo12_qp, avv12_qm, avv12_qp,
      MAX_AVV,
    };
  }, [data, results]);

  const getCloudSaveData = () => ({ pompeFognarie: data });
  const handleLoadCloudProject = (loadedData: any) => {
    if (loadedData?.pompeFognarie) setData(loadedData.pompeFognarie);
  };

  // â”€â”€ Input helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const inputCls = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-400 font-semibold transition-all";
  const labelCls = "block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1";

  function AvvIndicator({ v, max }: { v: number | null; max: number }) {
    if (v === null) return <span className="text-slate-400 text-xs">—</span>;
    const ok = v <= max;
    return (
      <span className={`inline-flex items-center gap-1 font-bold text-xs px-2 py-0.5 rounded-full ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
        {ok ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
        {fmtN(v, 2)} avv/h {ok ? `≤${max} ✓` : `>${max} ✗`}
      </span>
    );
  }

  return (
    <>
    <div className="print:hidden mb-6">
      <ProjectStorage
        toolType="pompe_fognarie"
        currentData={getCloudSaveData()}
        onLoadProject={handleLoadCloudProject}
        projectInfo={projectData}
        setProjectInfo={setProjectData}
      />
    </div>

    {/* ProjectHeader — sempre visibile in stampa: gestisce logo, titolo, autore, data */}
    <ProjectHeader
      pData={projectData}
      setPData={setProjectData}
      title="Pompe di Sollevamento Fognario"
      setAppMode={setAppMode}
      docCode="M_4.4.6_E4_Term_00"
    />

    <div className="print:hidden space-y-6 pb-12">

      {/* Box formule */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 print:hidden">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-amber-800 mb-1">Formule di calcolo (fedeli al foglio Excel di riferimento)</p>
            <p className="text-[11px] text-amber-700 font-mono leading-relaxed">
              P<sub>max</sub> = Q [m³/h] × H [m] × 9.81 / η / 3600 &nbsp;|&nbsp;
              P<sub>inst</sub> = P<sub>max</sub> × K &nbsp;|&nbsp;
              P<sub>pompa</sub> = P<sub>inst</sub> / N<sub>serv</sub> &nbsp;|&nbsp;
              P<sub>glob</sub> = P<sub>pompa</sub> × (N<sub>serv</sub> + N<sub>ris</sub>)
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* â”€â”€ PANNELLO INPUT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="space-y-5">

          {/* SEZIONE 1: Portate */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Droplets className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">Carichi Idraulici di Progetto</h3>
                <p className="text-[11px] text-slate-400">Portate in ingresso e portata sollevata dalla pompa</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Portata media ingresso</label>
                <div className="relative">
                  <input type="number" min="0" step="0.1" value={data.Q_media_m3h}
                    onChange={e => upd('Q_media_m3h', e.target.value)}
                    className={inputCls} placeholder="es. 2.5" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">m³/h</span>
                </div>
                {data.Q_media_m3h && (
                  <p className="text-[10px] text-slate-400 mt-0.5 ml-1">= {fmtN(parseFloat(data.Q_media_m3h)/3.6, 3)} l/s</p>
                )}
              </div>

              <div>
                <label className={labelCls}>Portata di picco ingresso</label>
                <div className="relative">
                  <input type="number" min="0" step="0.1" value={data.Q_picco_m3h}
                    onChange={e => upd('Q_picco_m3h', e.target.value)}
                    className={inputCls} placeholder="es. 7.5" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">m³/h</span>
                </div>
                {data.Q_picco_m3h && (
                  <p className="text-[10px] text-slate-400 mt-0.5 ml-1">= {fmtN(parseFloat(data.Q_picco_m3h)/3.6, 3)} l/s</p>
                )}
              </div>

              <div>
                <label className={labelCls}>Portata max sollevata (pompa)</label>
                <div className="relative">
                  <input type="number" min="0" step="0.1" value={data.Q_pompa_m3h}
                    onChange={e => upd('Q_pompa_m3h', e.target.value)}
                    className={`${inputCls} border-blue-300 bg-blue-50 focus:ring-blue-400`} placeholder="es. 15" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-blue-500 font-bold">m³/h</span>
                </div>
                {data.Q_pompa_m3h && (
                  <p className="text-[10px] text-blue-400 mt-0.5 ml-1 font-semibold">= {fmtN(parseFloat(data.Q_pompa_m3h)/3.6, 3)} l/s</p>
                )}
              </div>
            </div>
          </div>

          {/* SEZIONE 2: Prevalenza e pompe */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
              <div className="p-2 bg-teal-100 rounded-xl">
                <Zap className="w-4 h-4 text-teal-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">Prevalenza e Dimensionamento Pompe</h3>
                <p className="text-[11px] text-slate-400">Prevalenza manometrica, rendimento e configurazione</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Prevalenza</label>
                <div className="relative">
                  <input type="number" min="0" step="0.5" value={data.H_prevalenza_m}
                    onChange={e => upd('H_prevalenza_m', e.target.value)}
                    className={`${inputCls} border-teal-300 bg-teal-50 focus:ring-teal-400`} placeholder="es. 10" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-teal-600 font-bold">m</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 ml-1">Valore dalla scheda tecnica della pompa o capitolato</p>
              </div>

              <div>
                <label className={labelCls}>Rendimento pompe η</label>
                <div className="relative">
                  <input type="number" min="0" max="1" step="0.01" value={data.eta_pompa}
                    onChange={e => upd('eta_pompa', e.target.value)}
                    className={inputCls} placeholder="es. 0.70" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                    {data.eta_pompa ? `${(parseFloat(data.eta_pompa)*100).toFixed(0)}%` : '—'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 ml-1">Tipico: 0.60÷0.80 per pompe sommerse</p>
              </div>

              <div>
                <label className={labelCls}>Coefficiente maggiorativo K</label>
                <div className="relative">
                  <input type="number" min="1" step="0.05" value={data.K_maggiorativo}
                    onChange={e => upd('K_maggiorativo', e.target.value)}
                    className={inputCls} placeholder="es. 1.30" />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 ml-1">Tipico: 1.20÷1.30</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>N. pompe servizio</label>
                  <select value={data.N_servizio} onChange={e => upd('N_servizio', e.target.value)}
                    className={inputCls}>
                    {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>N. pompe riserva</label>
                  <select value={data.N_riserva} onChange={e => upd('N_riserva', e.target.value)}
                    className={inputCls}>
                    {[0,1,2].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Badge configurazione */}
            {results && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Configurazione:</span>
                <span className="bg-slate-100 border border-slate-200 text-slate-700 font-black text-xs px-3 py-1 rounded-full">
                  {results.Ns}+{results.Nr} — {results.Ns} attive + {results.Nr} riserva
                </span>
              </div>
            )}
          </div>
        </div>

        {/* â”€â”€ PANNELLO RISULTATI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="space-y-5">
          {!results ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Droplets className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-400 mb-1">Inserisci i dati di progetto</p>
              <p className="text-xs text-slate-300 max-w-xs">Compila portata massima pompa, prevalenza e rendimento per visualizzare i risultati.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 print-section">
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
                <div className="p-2 bg-emerald-100 rounded-xl">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">Risultati Dimensionamento</h3>
                  <p className="text-[11px] text-slate-400">Potenza e taglia motore commerciale IEC</p>
                </div>
              </div>

              {/* Portate riepilogo */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                  <p className="text-[9px] font-bold text-blue-500 uppercase tracking-wide mb-1">Portata media</p>
                  <p className="text-base font-black text-blue-700">{fmtN(parseFloat(data.Q_media_m3h)||0)} <span className="text-[10px] font-normal">m³/h</span></p>
                  <p className="text-[10px] text-blue-400">{fmtN(results.Q_media_ls, 3)} l/s</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                  <p className="text-[9px] font-bold text-blue-500 uppercase tracking-wide mb-1">Portata picco</p>
                  <p className="text-base font-black text-blue-700">{fmtN(parseFloat(data.Q_picco_m3h)||0)} <span className="text-[10px] font-normal">m³/h</span></p>
                  <p className="text-[10px] text-blue-400">{fmtN(results.Q_picco_ls, 3)} l/s</p>
                </div>
                <div className="bg-teal-50 rounded-xl p-3 text-center border border-teal-200">
                  <p className="text-[9px] font-bold text-teal-600 uppercase tracking-wide mb-1">Portata pompa</p>
                  <p className="text-base font-black text-teal-700">{fmtN(parseFloat(data.Q_pompa_m3h)||0)} <span className="text-[10px] font-normal">m³/h</span></p>
                  <p className="text-[10px] text-teal-500">{fmtN(results.Q_ls, 3)} l/s</p>
                </div>
              </div>

              {/* Tabella potenze */}
              <div className="rounded-xl border border-slate-200 overflow-hidden mb-5">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-500 text-[10px] uppercase tracking-wide font-bold">
                      <th className="py-2 px-3 text-left">Grandezza</th>
                      <th className="py-2 px-3 text-right">Valore</th>
                      <th className="py-2 px-3 text-left">UnitÃ </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="even:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-slate-600 font-medium">Prevalenza manometrica</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800">{fmtN(parseFloat(data.H_prevalenza_m)||0)}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">m</td>
                    </tr>
                    <tr className="even:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-slate-600 font-medium">Rendimento pompa η</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800">{fmtN((parseFloat(data.eta_pompa)||0)*100, 0)}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">%</td>
                    </tr>
                    <tr className="even:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-slate-600 font-medium">Coefficiente maggiorativo K</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800">{fmtN(parseFloat(data.K_maggiorativo)||0, 2)}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">—</td>
                    </tr>
                    <tr className="bg-amber-50/80 border-t-2 border-amber-200">
                      <td className="py-2.5 px-3 text-amber-800 font-bold">Potenza massima calcolata</td>
                      <td className="py-2.5 px-3 text-right font-black text-amber-700">{fmtKW(results.P_max_kW)}</td>
                      <td className="py-2.5 px-3 text-amber-600 font-mono font-bold">kW</td>
                    </tr>
                    <tr className="even:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-slate-600 font-medium">Potenza installata (con K)</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800">{fmtKW(results.P_inst_kW)}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">kW</td>
                    </tr>
                    <tr className="even:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-slate-600 font-medium">Potenza installata per pompa</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800">{fmtKW(results.P_pompa_kW)}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">kW</td>
                    </tr>
                    <tr className="even:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-slate-600 font-medium">Potenza globale installata</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800">{fmtKW(results.P_globale_kW)}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">kW</td>
                    </tr>
                    <tr className="even:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-slate-600 font-medium">Portata P1+P2 contemporaneo</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800">{fmtN(results.Q_p1p2_m3h)}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">m³/h</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Taglia motore IEC — evidenza principale */}
              <div className="bg-gradient-to-br from-teal-600 to-emerald-600 rounded-2xl p-5 text-white shadow-lg">
                <p className="text-xs font-bold text-white/70 uppercase tracking-wide mb-1">Taglia motore commerciale IEC</p>
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-5xl font-black tracking-tight">{results.taglia_IEC}</span>
                    <span className="text-2xl font-bold text-white/80 ml-2">kW</span>
                  </div>
                  <div className="text-right text-xs text-white/70">
                    <p>per ogni pompa</p>
                    <p className="font-bold text-white mt-0.5">{results.taglia_IEC * (results.Ns + results.Nr)} kW totali</p>
                    <p className="text-[10px] mt-1">({results.Ns}+{results.Nr} pompe)</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/20">
                  <p className="text-[10px] text-white/60">
                    Prossima taglia IEC ≥ P<sub>per pompa</sub> ({fmtKW(results.P_pompa_kW)} kW calcolata)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Elenco pompe riepilogo (stampabile) */}
          {results && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 print-section">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Elenco Pompe</h4>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="py-2 px-3 text-left">Tipo</th>
                      <th className="py-2 px-3 text-left">ID</th>
                      <th className="py-2 px-3 text-right">Q [m³/h]</th>
                      <th className="py-2 px-3 text-right">H [m]</th>
                      <th className="py-2 px-3 text-right">P [kW]</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Array.from({ length: results.Ns }).map((_, i) => (
                      <tr key={`serv-${i}`} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3">
                          <span className="bg-emerald-100 text-emerald-700 font-bold text-[10px] px-2 py-0.5 rounded-full">Servizio</span>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600">PU-{String(i+1).padStart(2,'0')}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-800">{fmtN(parseFloat(data.Q_pompa_m3h)||0)}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-800">{fmtN(parseFloat(data.H_prevalenza_m)||0)}</td>
                        <td className="py-2 px-3 text-right font-bold text-teal-700">{fmtKW(results.P_pompa_kW)}</td>
                      </tr>
                    ))}
                    {Array.from({ length: results.Nr }).map((_, i) => (
                      <tr key={`ris-${i}`} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3">
                          <span className="bg-amber-100 text-amber-700 font-bold text-[10px] px-2 py-0.5 rounded-full">Riserva</span>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600">PU-{String(results.Ns+i+1).padStart(2,'0')}-R</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-800">{fmtN(parseFloat(data.Q_pompa_m3h)||0)}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-800">{fmtN(parseFloat(data.H_prevalenza_m)||0)}</td>
                        <td className="py-2 px-3 text-right font-bold text-teal-700">{fmtKW(results.P_pompa_kW)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* â”€â”€ SEZIONE VASCA (opzionale, toggle) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <button
          onClick={() => upd('showVasca', !data.showVasca)}
          className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors cursor-pointer print:hidden"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <Droplets className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-black text-slate-800">Dimensionamento Vasca di Accumulo</h3>
              <p className="text-[11px] text-slate-400">Volume V1/V2, quote livelli, tempi riempimento/svuotamento e avviamenti orari</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
              OPZIONALE
            </span>
            {data.showVasca
              ? <ChevronUp className="w-5 h-5 text-slate-400" />
              : <ChevronDown className="w-5 h-5 text-slate-400" />
            }
          </div>
        </button>

        {data.showVasca && (
          <div className="px-6 pb-6 border-t border-slate-100">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-5">

              {/* Input vasca */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Geometria Vasca</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Lunghezza L</label>
                    <div className="relative">
                      <input type="number" min="0" step="0.1" value={data.L_vasca_m}
                        onChange={e => upd('L_vasca_m', e.target.value)}
                        className={inputCls} placeholder="es. 2.0" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">m</span>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Larghezza W</label>
                    <div className="relative">
                      <input type="number" min="0" step="0.1" value={data.W_vasca_m}
                        onChange={e => upd('W_vasca_m', e.target.value)}
                        className={inputCls} placeholder="es. 2.0" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">m</span>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Volume V1 (pompa P1)</label>
                    <div className="relative">
                      <input type="number" min="0" step="0.1" value={data.V1_m3}
                        onChange={e => upd('V1_m3', e.target.value)}
                        className={inputCls} placeholder="es. 1.5" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">m³</span>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Volume V2 (pompa P2)</label>
                    <div className="relative">
                      <input type="number" min="0" step="0.1" value={data.V2_m3}
                        onChange={e => upd('V2_m3', e.target.value)}
                        className={inputCls} placeholder="es. 0.9" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">m³</span>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Altezza di guardia H0</label>
                    <div className="relative">
                      <input type="number" min="0" step="0.05" value={data.H0_m}
                        onChange={e => upd('H0_m', e.target.value)}
                        className={inputCls} placeholder="0.40" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">m</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Risultati vasca */}
              {!vascaResults ? (
                <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
                  <p className="text-xs text-slate-400">Compila i dati della vasca e le portate per visualizzare i risultati.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Geometria calcolata */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">Geometria Vasca</h5>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-slate-500">Superficie:</span> <strong>{fmtN(vascaResults.S_vasca, 2)} m²</strong></div>
                      <div><span className="text-slate-500">V totale:</span> <strong>{fmtN(vascaResults.V_tot, 2)} m³</strong></div>
                      <div><span className="text-slate-500">H1 (V1/S):</span> <strong>{fmtN(vascaResults.H1, 3)} m</strong></div>
                      <div><span className="text-slate-500">H2 (V2/S):</span> <strong>{fmtN(vascaResults.H2, 3)} m</strong></div>
                      <div><span className="text-slate-500">H tot:</span> <strong>{fmtN(vascaResults.H_tot, 3)} m</strong></div>
                      <div><span className="text-slate-500">V vasca tot:</span> <strong>{fmtN(vascaResults.V_vasca_tot, 2)} m³</strong></div>
                    </div>
                  </div>

                  {/* Tabella avviamenti */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                        <tr>
                          <th className="py-2 px-3 text-left">Scenario</th>
                          <th className="py-2 px-3 text-right">t riemp [min]</th>
                          <th className="py-2 px-3 text-right">t svuot [min]</th>
                          <th className="py-2 px-3 text-right">Avv/h</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr className="even:bg-slate-50/50">
                          <td className="py-2 px-3 font-medium text-slate-600">P1 — portata media</td>
                          <td className="py-2 px-3 text-right">{vascaResults.t_rimp_V1_qm !== null ? fmtN(vascaResults.t_rimp_V1_qm, 1) : '—'}</td>
                          <td className="py-2 px-3 text-right">{vascaResults.t_svuot_V1_qm !== null ? fmtN(vascaResults.t_svuot_V1_qm, 1) : '—'}</td>
                          <td className="py-2 px-3 text-right"><AvvIndicator v={vascaResults.avv_qm} max={vascaResults.MAX_AVV} /></td>
                        </tr>
                        <tr className="even:bg-slate-50/50">
                          <td className="py-2 px-3 font-medium text-slate-600">P1 — portata picco</td>
                          <td className="py-2 px-3 text-right">{vascaResults.t_rimp_V1_qp !== null ? fmtN(vascaResults.t_rimp_V1_qp, 1) : '—'}</td>
                          <td className="py-2 px-3 text-right">{vascaResults.t_svuot_V1_qp !== null ? fmtN(vascaResults.t_svuot_V1_qp, 1) : '—'}</td>
                          <td className="py-2 px-3 text-right"><AvvIndicator v={vascaResults.avv_qp} max={vascaResults.MAX_AVV} /></td>
                        </tr>
                        <tr className="even:bg-slate-50/50 border-t-2 border-amber-200">
                          <td className="py-2 px-3 font-medium text-amber-700">P2 avaria — portata media</td>
                          <td className="py-2 px-3 text-right">{vascaResults.t_rimp_V12_qm !== null ? fmtN(vascaResults.t_rimp_V12_qm, 1) : '—'}</td>
                          <td className="py-2 px-3 text-right">{vascaResults.t_svuot_V12_qm !== null ? fmtN(vascaResults.t_svuot_V12_qm, 1) : '—'}</td>
                          <td className="py-2 px-3 text-right"><AvvIndicator v={vascaResults.avv12_qm} max={vascaResults.MAX_AVV} /></td>
                        </tr>
                        <tr className="even:bg-slate-50/50">
                          <td className="py-2 px-3 font-medium text-amber-700">P2 avaria — portata picco</td>
                          <td className="py-2 px-3 text-right">{vascaResults.t_rimp_V12_qp !== null ? fmtN(vascaResults.t_rimp_V12_qp, 1) : '—'}</td>
                          <td className="py-2 px-3 text-right">{vascaResults.t_svuot_V12_qp !== null ? fmtN(vascaResults.t_svuot_V12_qp, 1) : '—'}</td>
                          <td className="py-2 px-3 text-right"><AvvIndicator v={vascaResults.avv12_qp} max={vascaResults.MAX_AVV} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-slate-400 ml-1">⚠️ Limite raccomandato: ≤ 10 avviamenti/h per motori pompe sommerse</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* ══════════════════════════════════════════════════════════════════════
        REPORT STAMPA CENTRALIZZATO
       ══════════════════════════════════════════════════════════════════════ */}
    <PrintReport className="space-y-5">
      {!results ? (
        <p className="text-sm text-slate-400 italic">Nessun risultato — inserire i dati nella scheda interattiva.</p>
      ) : (
        <>
          {/* Sezione: Dati di Progetto */}
          <PrintSection title="1. Dati di Progetto">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Portata Media (m³/h)</label>
                <span className="text-lg font-semibold text-slate-800">{data.Q_media_m3h || '—'}</span>
                <p className="text-[9px] text-slate-400">= {fmtN((parseFloat(data.Q_media_m3h)||0)/3.6, 3)} l/s</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Portata Picco (m³/h)</label>
                <span className="text-lg font-semibold text-slate-800">{data.Q_picco_m3h || '—'}</span>
                <p className="text-[9px] text-slate-400">= {fmtN((parseFloat(data.Q_picco_m3h)||0)/3.6, 3)} l/s</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Portata Pompa (m³/h)</label>
                <span className="text-lg font-semibold text-slate-800">{data.Q_pompa_m3h || '—'}</span>
                <p className="text-[9px] text-slate-400">= {fmtN(results.Q_ls, 3)} l/s</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prevalenza H (m)</label>
                <span className="text-lg font-semibold text-slate-800">{data.H_prevalenza_m || '—'}</span>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rendimento η</label>
                <span className="text-lg font-semibold text-slate-800">{fmtN((parseFloat(data.eta_pompa)||0)*100, 0)} %</span>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Coeff. Maggiorativo K</label>
                <span className="text-lg font-semibold text-slate-800">{data.K_maggiorativo || '—'}</span>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">N. Pompe Servizio</label>
                <span className="text-lg font-semibold text-slate-800">{data.N_servizio}</span>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">N. Pompe Riserva</label>
                <span className="text-lg font-semibold text-slate-800">{data.N_riserva}</span>
              </div>
            </div>
          </PrintSection>

          {/* Sezione: Risultati Dimensionamento */}
          <PrintSection title="2. Risultati Dimensionamento">
            <div className="grid grid-cols-5 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Potenza Massima</label>
                <span className="text-lg font-semibold text-slate-800">{fmtKW(results.P_max_kW)} kW</span>
                <p className="text-[9px] text-slate-400">P = Q·H·9.81/η/3600</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Potenza Installata (×K)</label>
                <span className="text-lg font-semibold text-slate-800">{fmtKW(results.P_inst_kW)} kW</span>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Potenza per Pompa (÷N)</label>
                <span className="text-lg font-semibold text-slate-800">{fmtKW(results.P_pompa_kW)} kW</span>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Potenza Globale</label>
                <span className="text-lg font-semibold text-slate-800">{fmtKW(results.P_globale_kW)} kW</span>
                <p className="text-[9px] text-slate-400">{results.Ns + results.Nr} pompe totali</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-3">
                <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider">Taglia Motore IEC</label>
                <span className="text-2xl font-black text-white">{results.taglia_IEC} kW</span>
                <p className="text-[9px] text-slate-400 mt-1">Tot: {results.taglia_IEC * (results.Ns + results.Nr)} kW</p>
              </div>
            </div>
          </PrintSection>

          {/* Sezione: Elenco Pompe */}
          <PrintSection title="3. Elenco Pompe (Servizio e Riserva)">
            <table className="w-full">
              <thead>
                <tr>
                  {['Tipo', 'Codice', 'Portata Q (m³/h)', 'Q (l/s)', 'Prevalenza H (m)', 'Potenza Motore IEC (kW)'].map(h => (
                    <th key={h} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left py-1.5 pr-6 border-b border-slate-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: results.Ns }).map((_, i) => (
                  <tr key={`ps${i}`} className="border-b border-slate-100">
                    <td className="py-1.5 pr-6 text-sm font-semibold text-slate-800">Servizio</td>
                    <td className="py-1.5 pr-6 text-sm text-slate-600 font-mono">PU-{String(i+1).padStart(2,'0')}</td>
                    <td className="py-1.5 pr-6 text-sm text-slate-800">{fmtN(parseFloat(data.Q_pompa_m3h)||0)}</td>
                    <td className="py-1.5 pr-6 text-sm text-slate-800">{fmtN(results.Q_ls, 3)}</td>
                    <td className="py-1.5 pr-6 text-sm text-slate-800">{fmtN(parseFloat(data.H_prevalenza_m)||0)}</td>
                    <td className="py-1.5 pr-6 text-sm font-bold text-slate-900">{results.taglia_IEC}</td>
                  </tr>
                ))}
                {Array.from({ length: results.Nr }).map((_, i) => (
                  <tr key={`pr${i}`} className="border-b border-slate-100">
                    <td className="py-1.5 pr-6 text-sm font-semibold text-slate-500 italic">Riserva</td>
                    <td className="py-1.5 pr-6 text-sm text-slate-500 font-mono">PU-{String(results.Ns+i+1).padStart(2,'0')}-R</td>
                    <td className="py-1.5 pr-6 text-sm text-slate-700">{fmtN(parseFloat(data.Q_pompa_m3h)||0)}</td>
                    <td className="py-1.5 pr-6 text-sm text-slate-700">{fmtN(results.Q_ls, 3)}</td>
                    <td className="py-1.5 pr-6 text-sm text-slate-700">{fmtN(parseFloat(data.H_prevalenza_m)||0)}</td>
                    <td className="py-1.5 pr-6 text-sm font-bold text-slate-600">{results.taglia_IEC}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PrintSection>

          {/* Sezione: Vasca di Accumulo (se attiva) */}
          {data.showVasca && vascaResults && (
            <PrintSection title="4. Dimensionamento Vasca di Accumulo">
              <div className="grid grid-cols-2 gap-8">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Superficie Vasca (L×W)', `${fmtN(vascaResults.S_vasca, 2)} m²`],
                    ['Volume V1 (Pompa P1)', `${data.V1_m3 || '—'} m³`],
                    ['Volume V2 (Pompa P2)', `${data.V2_m3 || '—'} m³`],
                    ['Volume Totale V1+V2', `${fmtN(vascaResults.V_tot, 2)} m³`],
                    ['Altezza H1 = V1/S', `${fmtN(vascaResults.H1, 3)} m`],
                    ['Altezza H2 = V2/S', `${fmtN(vascaResults.H2, 3)} m`],
                    ['Guardia H0', `${data.H0_m || '—'} m`],
                    ['Altezza Totale Vasca', `${fmtN(vascaResults.H_tot, 3)} m`],
                  ].map(([l, v], i) => (
                    <div key={i}>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{l}</label>
                      <span className="text-base font-semibold text-slate-800">{v}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Avviamenti Pompa</label>
                  <table className="w-full">
                    <thead>
                      <tr>
                        {['Scenario', 't Riemp. (min)', 't Svuot. (min)', 'Avv/h'].map(h => (
                          <th key={h} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left py-1.5 pr-4 border-b border-slate-200">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {([
                        ['P1 — q. media', vascaResults.t_rimp_V1_qm, vascaResults.t_svuot_V1_qm, vascaResults.avv_qm],
                        ['P1 — q. picco', vascaResults.t_rimp_V1_qp, vascaResults.t_svuot_V1_qp, vascaResults.avv_qp],
                        ['P2 avaria — q. media', vascaResults.t_rimp_V12_qm, vascaResults.t_svuot_V12_qm, vascaResults.avv12_qm],
                        ['P2 avaria — q. picco', vascaResults.t_rimp_V12_qp, vascaResults.t_svuot_V12_qp, vascaResults.avv12_qp],
                      ] as [string, number|null, number|null, number|null][]).map(([label, tr_, ts_, av], i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-1.5 pr-4 text-sm text-slate-700">{label}</td>
                          <td className="py-1.5 pr-4 text-sm text-slate-800">{tr_ !== null ? fmtN(tr_, 1) : '—'}</td>
                          <td className="py-1.5 pr-4 text-sm text-slate-800">{ts_ !== null ? fmtN(ts_, 1) : '—'}</td>
                          <td className={`py-1.5 pr-4 text-sm font-bold ${av !== null ? (av <= vascaResults.MAX_AVV ? 'text-emerald-700' : 'text-red-700') : 'text-slate-400'}`}>
                            {av !== null ? `${fmtN(av, 2)} ${av <= vascaResults.MAX_AVV ? '✓' : '✗'}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </PrintSection>
          )}
        </>
      )}
    </PrintReport>
    </>
  );
}

