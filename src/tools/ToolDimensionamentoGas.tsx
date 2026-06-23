import React, { useState, useMemo } from 'react';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import { formatNumber } from '../utils/format';
import TopologicalTree, { TrattoNode } from '../components/TopologicalTree';
import { PIPE_CATALOG, getExternalDiameter } from '../data/pipeCatalog';
import { getGasEquivalentLength, GAS_FITTINGS_PRESETS } from '../data/gasEquivalentLengths';
import { IconPlus, IconTrash, IconCopy, IconWind } from '../components/Icons';

interface ToolDimensionamentoGasProps {
  projectData: ProjectData;
  setProjectData: (data: any) => void;
  setAppMode: (mode: string) => void;
}

interface UtilityItem {
  id: string;
  name: string;
  flowRate: number | string;       // Portata Q_oper (m3/h)
  pOper: number | string;          // Pressione d'esercizio P_oper (bar a)
  tOper: number | string;          // Temperatura d'esercizio (°C)
  pMinRichiesta: number | string;  // Pressione minima richiesta al terminale (bar a)
  connectedBranchId: number | null;// ID del Ramo a cui si collega
}

interface BranchItem {
  id: number;                      // ID Ramo numerico stabile
  parentId: number | null;         // Ramo padre numerico
  length: number | string;         // Lunghezza (m)
  hMonte: number | string;         // Quota monte (m)
  hValle: number | string;         // Quota valle (m)
  material: string;                // Acciaio / PEAD / manuale
  DN: string;                      // Diametro nominale (es. 150, 160)
  PN: string;                      // Pressione nominale (es. NORM, PN10)
  dIntManual: number | string;     // Diametro interno manuale se 'manuale' (mm)
  dExtManual: number | string;     // Diametro esterno manuale se 'manuale' (mm)
  roughnessManual: number | string;// Scabrezza manuale (mm)
  hierarchy?: string;              // Gerarchia forzata della condotta
  
  // Accessori
  nValvole: number | string;
  nGomiti: number | string;
  nTeeDiretto: number | string;
  nTeeLaterale: number | string;
  nRiduzioni: number | string;
}

// Gas preset definition
interface GasPreset {
  id: string;
  name: string;
  rho0: number; // kg/m3
  mu: number;   // cP
}

const GAS_PRESETS: GasPreset[] = [
  { id: 'metano', name: 'Gas Metano (CH4)', rho0: 0.717, mu: 0.0103 },
  { id: 'azoto', name: 'Azoto (N2)', rho0: 1.25, mu: 0.0176 },
  { id: 'ossigeno', name: 'Ossigeno (O2)', rho0: 1.428, mu: 0.0213 },
  { id: 'custom', name: 'Personalizzato', rho0: 0.717, mu: 0.0103 },
];

export function ToolDimensionamentoGas({
  projectData,
  setProjectData,
  setAppMode
}: ToolDimensionamentoGasProps) {
  // --- Parametri Generali ---
  const [gasType, setGasType] = useState<string>('metano');
  const [customRho0, setCustomRho0] = useState<number | string>(0.717);
  const [customMu, setCustomMu] = useState<number | string>(0.0103);
  const [pStartContatore, setPStartContatore] = useState<number>(1.022); // bar a
  const [tEsercizio, setTEsercizio] = useState<number>(20); // °C
  const [eqLengthMethod, setEqLengthMethod] = useState<'analitico' | 'tabellare'>('analitico');

  // --- Liste Utenze e Rami ---
  const [utilities, setUtilities] = useState<UtilityItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);

  // Stato UI per il ramo attualmente selezionato/dettagli
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

  // --- Risoluzione Proprietà Fisiche Gas ---
  const activeGasProps = useMemo(() => {
    const preset = GAS_PRESETS.find(p => p.id === gasType);
    if (gasType === 'custom') {
      return {
        rho0: Number(customRho0) || 0.717,
        mu: Number(customMu) || 0.0103
      };
    }
    return {
      rho0: preset?.rho0 || 0.717,
      mu: preset?.mu || 0.0103
    };
  }, [gasType, customRho0, customMu]);

  // Risoluzione Colebrook-White
  const solveColebrook = (Re: number, relRoughness: number): number => {
    if (Re <= 0) return 0;
    if (Re <= 2300) return 64 / Re;
    
    let f = 0.02;
    if (Re > 4000) {
      const temp = Math.pow(relRoughness / 3.71, 1.11) + 6.9 / Re;
      f = 1 / Math.pow(-1.8 * Math.log10(temp), 2);
    }
    
    let x = 1 / Math.sqrt(f);
    for (let i = 0; i < 20; i++) {
      const term = relRoughness / 3.71 + 2.51 / (Re * x);
      if (term <= 0) break;
      x = -2 * Math.log10(term);
    }
    return 1 / (x * x);
  };

  // --- Nomenclatura Automatica dei Rami (Topological Letter Tags) ---
  const computedBranchTags = useMemo(() => {
    const tags: Record<number, string> = {};
    
    // Nodi radice (senza parentId)
    const roots = branches.filter(b => b.parentId === null);
    
    // Mappa dei figli
    const childrenMap: Record<number, BranchItem[]> = {};
    branches.forEach(b => {
      if (b.parentId !== null) {
        if (!childrenMap[b.parentId]) {
          childrenMap[b.parentId] = [];
        }
        childrenMap[b.parentId].push(b);
      }
    });

    // Ordine stabile dei rami e figli
    Object.keys(childrenMap).forEach(key => {
      childrenMap[Number(key)].sort((a, b) => a.id - b.id);
    });
    roots.sort((a, b) => a.id - b.id);

    let letterIndex = 0;
    const getNextLetter = (): string => {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const index = letterIndex + 1; // iniziamo da B per il primo nodo di fine
      letterIndex++;
      
      if (index < alphabet.length) {
        return alphabet[index];
      } else {
        const firstChar = alphabet[Math.floor(index / alphabet.length) - 1];
        const secondChar = alphabet[index % alphabet.length];
        return firstChar + secondChar;
      }
    };

    const dfs = (branch: BranchItem, parentEndLetter: string) => {
      const startLetter = parentEndLetter;
      const endLetter = getNextLetter();
      tags[branch.id] = startLetter + endLetter;

      const children = childrenMap[branch.id] || [];
      children.forEach(child => {
        dfs(child, endLetter);
      });
    };

    roots.forEach(root => {
      dfs(root, 'A');
    });

    // Gestione rami isolati o orfani
    const visited = new Set<number>(Object.keys(tags).map(Number));
    branches.forEach(b => {
      if (!visited.has(b.id)) {
        dfs(b, 'A');
      }
    });

    return tags;
  }, [branches]);

  // --- Risoluzione e Calcolo Rete ---
  const processedNetwork = useMemo(() => {
    const { rho0, mu } = activeGasProps;
    const To = 273.15;
    const Po = 1.013;
    const g = 9.81;
    const z0 = 1;
    const z = 1;
    const tEsercizioK = tEsercizio + 273.15;

    // 1. Calcolo Portata Accumulata per Ramo
    const getBranchAccumQN = (bId: number): number => {
      // Trova ricorsivamente tutti i discendenti
      const descendants = new Set<number>([bId]);
      let added = true;
      while (added) {
        added = false;
        for (const b of branches) {
          if (b.parentId !== null && descendants.has(b.parentId) && !descendants.has(b.id)) {
            descendants.add(b.id);
            added = true;
          }
        }
      }

      // Somma le portate normalizzate di tutte le utenze collegate
      let sumQN = 0;
      utilities.forEach(u => {
        if (u.connectedBranchId !== null && descendants.has(u.connectedBranchId)) {
          const qOper = Number(u.flowRate) || 0;
          const pOper = Number(u.pOper) || pStartContatore;
          const tOperVal = Number(u.tOper) !== undefined ? Number(u.tOper) : tEsercizio;
          // Q_N = (Q_oper / 60) * (P_oper / P0) * (T0 / (T_oper + 273.15))
          const qN = (qOper / 60) * (pOper / Po) * (To / (tOperVal + 273.15));
          sumQN += qN;
        }
      });
      return sumQN * 60; // QN in Nm3/min
    };

    // 2. Risolutore Topologico
    const results: Record<number, any> = {};
    const visited = new Set<number>();

    const calculateBranch = (b: BranchItem, pStartBar: number) => {
      if (visited.has(b.id)) return;
      visited.add(b.id);

      const qN_min = getBranchAccumQN(b.id); // Nm3/min
      const qN_s = qN_min / 60;              // Nm3/s
      const qMass_min = rho0 * qN_min;       // kg/min

      // Diametri e Scabrezza
      let dInt = 0;
      let dExt = 0;
      let roughness = 0.05;

      if (b.material === 'manuale') {
        dInt = Number(b.dIntManual) || 50;
        dExt = Number(b.dExtManual) || 60;
        roughness = Number(b.roughnessManual) || 0.1;
      } else if (PIPE_CATALOG[b.material]) {
        roughness = PIPE_CATALOG[b.material].roughness;
        const matSpecs = PIPE_CATALOG[b.material].specs[b.DN];
        if (matSpecs) {
          dInt = matSpecs[b.PN] || Number(b.DN);
          dExt = getExternalDiameter(b.material, b.DN, dInt);
        } else {
          dInt = Number(b.DN);
          dExt = dInt + 10;
        }
      }

      const dIntM = dInt / 1000;
      const areaM2 = (Math.PI * Math.pow(dIntM, 2)) / 4;

      // Geodetic corrections
      const hMonteVal = Number(b.hMonte) || 0;
      const hValleVal = Number(b.hValle) || 0;
      const S = 1.96e-5 * (hValleVal - hMonteVal) * rho0 * To * g * z0 / (tEsercizioK * z * Po);
      const X = S < 0 ? 1 : Math.exp(-S);
      const W = X === 1 ? 1 : (1 - Math.exp(-S)) / S;

      // Reynolds
      const Re = dIntM > 0 ? (1272.96 * rho0 * qN_s) / (dIntM * mu) : 0;
      const roughnessRel = dInt > 0 ? roughness / dInt : 0;
      const lambda = solveColebrook(Re, roughnessRel);

      // Rt coefficient
      const Rt = dIntM > 0 
        ? (1.68e-5 * rho0 * lambda * tEsercizioK * z * Po / (To * Math.pow(dIntM, 5))) * W 
        : 0;

      // Pressione iniziale in kg/cm2
      const pStartKg = pStartBar * 1.02;

      // Distributed Pressure Drop
      const lengthVal = Number(b.length) || 0;
      const pDistFinalKg2 = X * Math.pow(pStartKg, 2) - lengthVal * Rt * Math.pow(qN_s, 2);
      let isChoked = pDistFinalKg2 <= 0;
      const pDistFinalKg = !isChoked ? Math.sqrt(pDistFinalKg2) : 0;
      const deltaPDistBar = (pStartKg - pDistFinalKg) / 1.02;

      // Concentrated Pressure Drop
      let lEq = 0;
      const nV = Number(b.nValvole) || 0;
      const nG = Number(b.nGomiti) || 0;
      const nTD = Number(b.nTeeDiretto) || 0;
      const nTL = Number(b.nTeeLaterale) || 0;
      const nR = Number(b.nRiduzioni) || 0;

      if (eqLengthMethod === 'analitico') {
        const kTot = nV * 10 + nG * 1.5 + nTD * 0.9 + nTL * 2.0 + nR * 0.35;
        lEq = lambda > 0 ? (kTot * dIntM) / lambda : 0;
      } else {
        lEq = nV * getGasEquivalentLength('valvola_sfera', dInt) +
              nG * getGasEquivalentLength('angolo_90', dInt) +
              nTD * getGasEquivalentLength('tee_diretto', dInt) +
              nTL * getGasEquivalentLength('tee_laterale', dInt) +
              nR * getGasEquivalentLength('nipplo_riduzione', dInt);
      }

      const pConcFinalKg2 = Math.pow(pStartKg, 2) - lEq * Rt * Math.pow(qN_s, 2);
      if (pConcFinalKg2 <= 0) isChoked = true;
      const pConcFinalKg = pConcFinalKg2 > 0 ? Math.sqrt(pConcFinalKg2) : 0;
      const deltaPConcBar = (pStartKg - pConcFinalKg) / 1.02;

      // Final pressure
      const pFinalBar = isChoked ? 0 : pStartBar - (deltaPDistBar + deltaPConcBar);
      const pFinalMbarGauge = (pFinalBar - 1) * 1000;

      // Max velocity at node final pressure
      const vMax = (areaM2 > 0 && pFinalBar > 0)
        ? (Po * qN_s * tEsercizioK) / (To * pFinalBar * areaM2)
        : 0;

      // Trova le utenze direttamente collegate
      const connectedUtenze = utilities.filter(u => u.connectedBranchId === b.id);
      const utenzeLabel = connectedUtenze.map(u => `${u.id} (${u.name})`).join(', ') || 'Nessuna';

      // Stato di verifica
      let status: 'ok' | 'warning' | 'error' = 'ok';
      let message = 'Verificato';

      if (isChoked) {
        status = 'error';
        message = 'DIAMETRO INSUFFICIENTE';
      } else if (vMax > 15) {
        status = 'warning';
        message = 'VELOCITÀ ECCESSIVA (>15 m/s)';
      } else {
        const descendants = new Set<number>([b.id]);
        let added = true;
        while (added) {
          added = false;
          for (const otherB of branches) {
            if (otherB.parentId !== null && descendants.has(otherB.parentId) && !descendants.has(otherB.id)) {
              descendants.add(otherB.id);
              added = true;
            }
          }
        }

        const faultyUt = utilities.find(u => 
          u.connectedBranchId !== null && descendants.has(u.connectedBranchId) && pFinalBar < (Number(u.pMinRichiesta) || 0)
        );
        if (faultyUt) {
          status = 'warning';
          message = `P BASSA PER ${faultyUt.id}`;
        }
      }

      results[b.id] = {
        ...b,
        dInt,
        dExt,
        areaM2,
        roughness,
        qN_min,
        qMass_min,
        S,
        X,
        W,
        Re,
        roughnessRel,
        lambda,
        Rt,
        pStartBar,
        pStartKg,
        deltaPDistBar,
        lEq,
        deltaPConcBar,
        pFinalBar,
        pFinalMbarGauge,
        vMax,
        utenzeLabel,
        status,
        message,
        isChoked
      };
    };

    // Ordina e calcola ricorsivamente partendo dalle radici
    const roots = branches.filter(b => b.parentId === null);
    
    const processQueue = (parentId: number, currentPressure: number) => {
      const children = branches.filter(b => b.parentId === parentId);
      children.forEach(child => {
        calculateBranch(child, currentPressure);
        const childRes = results[child.id];
        if (childRes) {
          processQueue(child.id, childRes.pFinalBar);
        }
      });
    };

    roots.forEach(root => {
      calculateBranch(root, pStartContatore);
      const rootRes = results[root.id];
      if (rootRes) {
        processQueue(root.id, rootRes.pFinalBar);
      }
    });

    branches.forEach(b => {
      if (!visited.has(b.id)) {
        calculateBranch(b, pStartContatore);
      }
    });

    return results;
  }, [branches, utilities, gasType, customRho0, customMu, pStartContatore, tEsercizio, eqLengthMethod]);

  // --- Lista Rami Processati per Grafico e Tabelle ---
  const processedBranchesList = useMemo(() => {
    return branches.map(b => processedNetwork[b.id] || { ...b });
  }, [branches, processedNetwork]);

  // --- Eredità Profondità per Schema Albero ---
  const treeNodes = useMemo(() => {
    const getBranchDepth = (branch: any): number => {
      let depth = 0;
      let current = branch;
      while (current.parentId !== null) {
        const parent = branches.find(b => b.id === current.parentId);
        if (!parent || parent.id === current.id) break;
        depth++;
        current = parent;
      }
      return depth;
    };

    return processedBranchesList.map(b => {
      let hierarchy = b.hierarchy;
      if (!hierarchy) {
        const depth = getBranchDepth(b);
        const hasChildren = branches.some(x => x.parentId === b.id);
        if (!hasChildren) {
          hierarchy = 'utenza';
        } else if (depth === 1) {
          hierarchy = 'dorsale_secondaria';
        } else if (depth >= 2) {
          hierarchy = 'dorsale_terziaria';
        } else {
          hierarchy = 'dorsale_principale';
        }
      }

      // Troviamo le utenze collegate a questo ramo specifico
      const connectedUts = utilities.filter(u => u.connectedBranchId === b.id);
      const utSuffix = connectedUts.length > 0 ? ` ➔ [${connectedUts.map(u => u.id).join(', ')}]` : '';
      const tagText = `${computedBranchTags[b.id] || `R${b.id}`}${utSuffix}`;

      return {
        tag: computedBranchTags[b.id] || `R${b.id}`,
        parentId: b.parentId !== null ? (computedBranchTags[b.parentId] || null) : null,
        hierarchy,
        length: b.length,
        name: tagText,
        velocity: b.vMax,
        loss_tot_mbar: (b.deltaPDistBar + b.deltaPConcBar) * 1000
      } as TrattoNode;
    });
  }, [processedBranchesList, branches, computedBranchTags, utilities]);

  // --- Gestione Azioni Utenze ---
  const addUtility = () => {
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
  };

  const updateBranch = (id: number, field: keyof BranchItem, val: any) => {
    setBranches(prev => prev.map(b => {
      if (b.id === id) {
        const updated = { ...b, [field]: val } as BranchItem;
        
        if (field === 'material' && val !== 'manuale' && PIPE_CATALOG[val]) {
          const firstDN = Object.keys(PIPE_CATALOG[val].specs)[0];
          const firstPN = Object.keys(PIPE_CATALOG[val].specs[firstDN])[0];
          updated.DN = firstDN;
          updated.PN = firstPN;
        } else if (field === 'DN' && updated.material !== 'manuale' && PIPE_CATALOG[updated.material]) {
          let currentPN = updated.PN;
          if (!PIPE_CATALOG[updated.material].specs[val][currentPN]) {
            currentPN = Object.keys(PIPE_CATALOG[updated.material].specs[val])[0];
          }
          updated.PN = currentPN;
        }
        return updated;
      }
      return b;
    }));
  };

  const removeBranch = (id: number) => {
    setBranches(branches.filter(b => b.id !== id).map(b => {
      if (b.parentId === id) {
        const deletedBranch = branches.find(x => x.id === id);
        return { ...b, parentId: deletedBranch ? deletedBranch.parentId : null };
      }
      return b;
    }));
    setUtilities(prev => prev.map(u => u.connectedBranchId === id ? { ...u, connectedBranchId: null } : u));
    if (selectedBranchId === id) setSelectedBranchId(null);
  };

  const duplicateBranch = (id: number) => {
    const b = branches.find(x => x.id === id);
    if (!b) return;
    const newId = Math.max(...branches.map(x => x.id)) + 1;
    setBranches([...branches, { ...b, id: newId }]);
  };

  // --- Caricamento e Salvataggio Cloud/Locale ---
  const handleLoadCloudProject = (data: any) => {
    if (!data) return;
    if (data.gasType !== undefined) setGasType(data.gasType);
    if (data.customRho0 !== undefined) setCustomRho0(data.customRho0);
    if (data.customMu !== undefined) setCustomMu(data.customMu);
    if (data.pStartContatore !== undefined) setPStartContatore(data.pStartContatore);
    if (data.tEsercizio !== undefined) setTEsercizio(data.tEsercizio);
    if (data.eqLengthMethod !== undefined) setEqLengthMethod(data.eqLengthMethod);
    
    // Migrazione dati da vecchi salvataggi cloud (string IDs) a nuovi salvataggi (numeric IDs)
    let loadedBranches = data.branches || [];
    let loadedUtilities = data.utilities || [];
    
    if (loadedBranches.length > 0 && typeof loadedBranches[0].id === 'string') {
      const branchMap = new Map<string, number>();
      let nextId = 1;
      
      // Assegniamo gli ID numerici stabili
      loadedBranches.forEach((b: any) => {
        branchMap.set(b.id, nextId++);
      });

      loadedBranches = loadedBranches.map((b: any) => {
        const numId = branchMap.get(b.id)!;
        const numParentId = b.parentId ? (branchMap.get(b.parentId) || null) : null;
        return { ...b, id: numId, parentId: numParentId };
      });

      loadedUtilities = loadedUtilities.map((u: any) => {
        const numBranchId = u.connectedBranchId ? (branchMap.get(u.connectedBranchId) || null) : null;
        return { ...u, connectedBranchId: numBranchId };
      });
    }

    setUtilities(loadedUtilities);
    setBranches(loadedBranches);
    setSelectedBranchId(null);
  };

  const getCloudSaveData = () => {
    return {
      gasType,
      customRho0,
      customMu,
      pStartContatore,
      tEsercizio,
      eqLengthMethod,
      utilities,
      branches
    };
  };

  // --- Filtri per evitare Loop di Parenting ---
  const getEligibleParents = (branchId: number) => {
    const descendants = new Set<number>([branchId]);
    let added = true;
    while (added) {
      added = false;
      for (const b of branches) {
        if (b.parentId !== null && descendants.has(b.parentId) && !descendants.has(b.id)) {
          descendants.add(b.id);
          added = true;
        }
      }
    }
    return branches.filter(b => b.id !== branchId && !descendants.has(b.id));
  };

  const selectedBranchFull = processedBranchesList.find(x => x.id === selectedBranchId);

  const getAccessoryLabelSuffix = (type: string, kValue: number) => {
    if (!selectedBranchFull) return '';
    if (eqLengthMethod === 'analitico') {
      return ` (K = ${kValue})`;
    } else {
      const dIntVal = selectedBranchFull.dInt || 50;
      const eqLen = getGasEquivalentLength(type, dIntVal);
      return ` (da tab: ${formatNumber(eqLen, 1)}m)`;
    }
  };

  const MiniEquivalentTable = () => {
    if (!selectedBranchFull || eqLengthMethod !== 'tabellare') return null;
    const currentDN = selectedBranchFull.material === 'manuale' ? 'Manuale' : `DN ${selectedBranchFull.DN}`;
    
    return (
      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-[10px] text-slate-650 animate-fade-in mt-3 print:hidden">
        <div className="font-bold text-slate-700 flex justify-between border-b border-slate-200 pb-1">
          <span>Consulta Valori Tabella ({currentDN})</span>
          <span className="text-[9px] text-purple-650 font-semibold uppercase">Metri Equivalenti per 1 Pz</span>
        </div>
        <table className="w-full text-left font-mono text-[9px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase">
              <th className="py-0.5">Raccordo</th>
              <th className="py-0.5 text-right">Valore (m)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 hover:bg-slate-100/50">
              <td className="py-0.5">Valvola a sfera</td>
              <td className="py-0.5 text-right font-bold">{formatNumber(getGasEquivalentLength('valvola_sfera', selectedBranchFull.dInt), 1)} m</td>
            </tr>
            <tr className="border-b border-slate-100 hover:bg-slate-100/50">
              <td className="py-0.5">Gomito 90°</td>
              <td className="py-0.5 text-right font-bold">{formatNumber(getGasEquivalentLength('angolo_90', selectedBranchFull.dInt), 1)} m</td>
            </tr>
            <tr className="border-b border-slate-100 hover:bg-slate-100/50">
              <td className="py-0.5">T pass. diretto</td>
              <td className="py-0.5 text-right font-bold">{formatNumber(getGasEquivalentLength('tee_diretto', selectedBranchFull.dInt), 1)} m</td>
            </tr>
            <tr className="border-b border-slate-100 hover:bg-slate-100/50">
              <td className="py-0.5">T pass. laterale</td>
              <td className="py-0.5 text-right font-bold">{formatNumber(getGasEquivalentLength('tee_laterale', selectedBranchFull.dInt), 1)} m</td>
            </tr>
            <tr className="hover:bg-slate-100/50">
              <td className="py-0.5">Riduzione/Nipplo</td>
              <td className="py-0.5 text-right font-bold">{formatNumber(getGasEquivalentLength('nipplo_riduzione', selectedBranchFull.dInt), 1)} m</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in text-slate-800 pb-12">
      <ProjectHeader pData={projectData} setPData={setProjectData} title="Dimensionamento e Verifica Rete Gas" setAppMode={setAppMode} iconColor="purple" />

      <ProjectStorage 
        toolType="gas"
        currentData={getCloudSaveData()}
        onLoadProject={handleLoadCloudProject}
        projectInfo={projectData}
        setProjectInfo={setProjectData}
      />

      {/* Spiegazione & Formula */}
      <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 mb-5 text-xs text-slate-650 space-y-2.5 print:hidden">
        <p>
          <strong>Descrizione:</strong> Esegue il dimensionamento e la verifica delle reti di condotte per fluidi comprimibili (Gas Metano, Azoto, Ossigeno o fluidi personalizzati), determinando la caduta di pressione e calcolando le perdite concentrate tramite coefficienti di forma analitici (K) o lunghezze equivalenti tabellari del catalogo commerciale.
        </p>
        <div className="bg-white/80 border border-amber-100 rounded-xl p-4 text-slate-600">
          <p className="font-bold text-slate-700 mb-2.5 text-[11px] uppercase tracking-wide">Formule applicate per il moto del gas comprimibile:</p>
          <div className="space-y-4 pl-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span>• Numero di Reynolds:</span>
              <span className="font-serif font-bold text-slate-800 flex items-center">
                Re = 
                <span className="inline-flex flex-col items-center align-middle mx-1.5 text-center text-[10px]">
                  <span className="border-b border-slate-400 px-1 pb-0.5">ρ × v × D<sub>int</sub></span>
                  <span className="px-1 pt-0.5">μ</span>
                </span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span>• Coefficiente d'Attrito (Colebrook-White):</span>
              <span className="font-serif font-bold text-slate-800 flex items-center">
                <span className="inline-flex flex-col items-center align-middle mx-1 text-center text-[10px] leading-tight">
                  <span className="border-b border-slate-400 px-0.5">1</span>
                  <span className="px-0.5">√λ</span>
                </span>
                = -2 log<sub>10</sub> 
                <span className="inline-flex items-center ml-1">
                  (
                  <span className="inline-flex flex-col items-center align-middle text-[10px] leading-tight">
                    <span className="border-b border-slate-400 px-0.5">ε</span>
                    <span className="px-0.5">3.71 × D<sub>int</sub></span>
                  </span>
                  +
                  <span className="inline-flex flex-col items-center align-middle text-[10px] leading-tight mx-1">
                    <span className="border-b border-slate-400 px-0.5">2.51</span>
                    <span className="px-0.5">Re × √λ</span>
                  </span>
                  )
                </span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span>• Perdite di Carico Distribuite (Comprimibile):</span>
              <span className="font-serif font-bold text-slate-800 flex items-center">
                P₁² - P₂² = λ × 
                <span className="inline-flex flex-col items-center align-middle mx-1.5 text-center text-[10px]">
                  <span className="border-b border-slate-400 px-1 pb-0.5">L</span>
                  <span className="px-1 pt-0.5">D<sub>int</sub></span>
                </span>
                × ρ₀ × P₀ × v₀²
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PARAMETRI GENERALI */}
      <div className="bg-white rounded-2xl shadow-sm p-6 md:pb-9 border border-slate-200 mb-6 print:shadow-none print:border-none print:p-0 print:mb-4 animate-slide-in">
        <h3 className="text-sm font-bold text-slate-700 border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
          <IconWind className="w-4 h-4 text-purple-600 animate-pulse" /> Parametri Generali dell'Impianto Gas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end print:flex print:flex-wrap print:gap-x-6 print:gap-y-2 print:text-xs">
          <div className="print:flex print:items-center print:gap-1.5">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 print:mb-0 print:after:content-[':']">Fluido</label>
            <select
              value={gasType}
              onChange={e => setGasType(e.target.value)}
              className="w-full bg-slate-50 text-sm font-semibold text-slate-800 p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer print:hidden"
            >
              {GAS_PRESETS.map(preset => (
                <option key={preset.id} value={preset.id}>{preset.name}</option>
              ))}
            </select>
            <span className="hidden print:inline text-sm font-semibold text-slate-800">
              {GAS_PRESETS.find(p => p.id === gasType)?.name || gasType}
            </span>
          </div>
 
          {gasType === 'custom' && (
            <>
              <div className="print:flex print:items-center print:gap-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 print:mb-0 print:after:content-[':']">Densità ρ0</label>
                <input 
                  type="number" 
                  step="0.001"
                  value={customRho0}
                  onChange={e => setCustomRho0(e.target.value)}
                  className="w-full bg-slate-50 text-sm font-semibold text-slate-800 p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-purple-500 font-mono print:hidden"
                />
                <span className="hidden print:inline text-sm font-semibold text-slate-800 font-mono">
                  {customRho0} kg/m³
                </span>
              </div>
              <div className="print:flex print:items-center print:gap-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 print:mb-0 print:after:content-[':']">Viscosità μ</label>
                <input 
                  type="number" 
                  step="0.0001"
                  value={customMu}
                  onChange={e => setCustomMu(e.target.value)}
                  className="w-full bg-slate-50 text-sm font-semibold text-slate-800 p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-purple-500 font-mono print:hidden"
                />
                <span className="hidden print:inline text-sm font-semibold text-slate-800 font-mono">
                  {customMu} cP
                </span>
              </div>
            </>
          )}
 
          <div className="print:flex print:items-center print:gap-1.5">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 print:mb-0 print:after:content-[':']">Pressione Inizio</label>
            <input 
              type="number" 
              step="0.001"
              value={pStartContatore}
              onChange={e => setPStartContatore(Number(e.target.value))}
              className="w-full bg-slate-50 text-sm font-semibold text-slate-800 p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-purple-500 font-mono print:hidden"
            />
            <span className="hidden print:inline text-sm font-semibold text-slate-800 font-mono">
              {pStartContatore} bar a
            </span>
          </div>
 
          <div className="print:flex print:items-center print:gap-1.5">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 print:mb-0 print:after:content-[':']">Temperatura T</label>
            <input 
              type="number" 
              value={tEsercizio}
              onChange={e => setTEsercizio(Number(e.target.value))}
              className="w-full bg-slate-50 text-sm font-semibold text-slate-800 p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-purple-500 font-mono print:hidden"
            />
            <span className="hidden print:inline text-sm font-semibold text-slate-800 font-mono">
              {tEsercizio} °C
            </span>
          </div>
 
          <div className="relative print:flex print:items-center print:gap-1.5">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 print:mb-0 print:after:content-[':']">Lunghezza Equivalente</label>
            <select
              value={eqLengthMethod}
              onChange={e => setEqLengthMethod(e.target.value as any)}
              className="w-full bg-slate-50 text-sm font-semibold text-slate-800 p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer print:hidden"
            >
              <option value="analitico">Formula Analitica (K)</option>
              <option value="tabellare">Tabella Perdite Concentrate</option>
            </select>
            <span className="hidden print:inline text-sm font-semibold text-slate-800">
              {eqLengthMethod === 'analitico' ? 'Formula Analitica (K)' : 'Tabella Perdite Concentrate'}
            </span>
            <p className="md:absolute md:left-0 md:top-full mt-1.5 md:mt-2 text-[9px] text-slate-400 leading-tight print:hidden w-full">
              {eqLengthMethod === 'analitico' 
                ? 'Usa i coeff. locali K (es. gomito = 1.5) calcolando Leq = K*d/λ (più preciso).' 
                : 'Usa i metri equivalenti fissi da tabella catalogo in base al DN (standard pratico).'}
            </p>
          </div>
        </div>
      </div>

      {/* SEZIONE CONFIGURAZIONE (RAMI E UTENZE) - NASCOSTA IN STAMPA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 print:hidden">
        {/* COMPILAZIONE ALBERO RAMI */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6 border border-slate-200 animate-slide-in">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-4">
            <h3 className="text-sm font-bold text-slate-700">Configurazione Condotte (Rami Rete)</h3>
            <button 
              onClick={addBranch}
              className="p-1 px-2.5 bg-purple-50 hover:bg-purple-100 text-purple-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <IconPlus className="w-3.5 h-3.5" /> Aggiungi Ramo
            </button>
          </div>
          
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="py-2 pr-1">Ramo</th>
                  <th className="py-2 px-1">Genitore</th>
                  <th className="py-2 px-1">L (m)</th>
                  <th className="py-2 px-1">Quota M/V</th>
                  <th className="py-2 px-1">Materiale</th>
                  <th className="py-2 px-1">DN / PN</th>
                  <th className="py-2 px-1 text-center">Accessori</th>
                  <th className="py-2 pl-1 text-right">Azione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {branches.map(b => (
                  <tr 
                    key={b.id} 
                    className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${selectedBranchId === b.id ? 'bg-purple-50/20 border-l-2 border-purple-500' : ''}`}
                    onClick={() => setSelectedBranchId(b.id)}
                  >
                    <td className="py-2 pr-1 font-black font-mono text-purple-700 select-none">
                      {computedBranchTags[b.id] || `R${b.id}`}
                    </td>
                    <td className="py-1 px-1">
                      <select
                        value={b.parentId || ''}
                        onChange={e => updateBranch(b.id, 'parentId', e.target.value ? Number(e.target.value) : null)}
                        className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer"
                        onClick={e => e.stopPropagation()}
                      >
                        <option value="">Nessuno (Radice)</option>
                        {getEligibleParents(b.id).map(p => (
                          <option key={p.id} value={p.id}>{computedBranchTags[p.id] || `R${p.id}`}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 px-1">
                      <input 
                        type="number" 
                        value={b.length} 
                        onChange={e => updateBranch(b.id, 'length', e.target.value)} 
                        className="bg-transparent font-mono text-slate-700 w-12 focus:outline-none border-b border-transparent focus:border-purple-300"
                        onClick={e => e.stopPropagation()}
                      />
                    </td>
                    <td className="py-1 px-1 text-slate-600 font-mono">
                      <div className="flex items-center gap-0.5">
                        <input 
                          type="number" 
                          placeholder="M" 
                          value={b.hMonte} 
                          onChange={e => updateBranch(b.id, 'hMonte', e.target.value)} 
                          className="bg-transparent text-slate-700 w-8 focus:outline-none text-center"
                          onClick={e => e.stopPropagation()}
                        />
                        <span>/</span>
                        <input 
                          type="number" 
                          placeholder="V" 
                          value={b.hValle} 
                          onChange={e => updateBranch(b.id, 'hValle', e.target.value)} 
                          className="bg-transparent text-slate-700 w-8 focus:outline-none text-center"
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    </td>
                    <td className="py-1 px-1">
                      <select
                        value={b.material}
                        onChange={e => updateBranch(b.id, 'material', e.target.value)}
                        className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer"
                        onClick={e => e.stopPropagation()}
                      >
                        <option value="Acciaio">Acciaio</option>
                        <option value="PEAD">PEAD</option>
                        <option value="manuale">Manuale...</option>
                      </select>
                    </td>
                    <td className="py-1 px-1">
                      {b.material === 'manuale' ? (
                        <span className="text-[10px] text-slate-400 font-medium italic">Manuale (modifica a destra)</span>
                      ) : (
                        <div className="flex gap-1">
                          <select
                            value={b.DN}
                            onChange={e => updateBranch(b.id, 'DN', e.target.value)}
                            className="bg-transparent font-mono text-slate-700 focus:outline-none cursor-pointer"
                            onClick={e => e.stopPropagation()}
                          >
                            {Object.keys(PIPE_CATALOG[b.material]?.specs || {}).map(dn => (
                              <option key={dn} value={dn}>DN{dn}</option>
                            ))}
                          </select>
                          <select
                            value={b.PN}
                            onChange={e => updateBranch(b.id, 'PN', e.target.value)}
                            className="bg-transparent font-mono text-slate-700 focus:outline-none cursor-pointer"
                            onClick={e => e.stopPropagation()}
                          >
                            {Object.keys(PIPE_CATALOG[b.material]?.specs[b.DN] || {}).map(pn => (
                              <option key={pn} value={pn}>{pn}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </td>
                    <td className="py-1 px-1 text-center font-mono font-bold text-slate-500">
                      {Number(b.nValvole) + Number(b.nGomiti) + Number(b.nTeeDiretto) + Number(b.nTeeLaterale) + Number(b.nRiduzioni)}
                    </td>
                    <td className="py-2 pl-1 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={() => duplicateBranch(b.id)}
                          className="p-1 hover:bg-slate-100 text-slate-500 rounded-md transition-colors cursor-pointer"
                          title="Duplica ramo"
                        >
                          <IconCopy className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => removeBranch(b.id)}
                          className="p-1 hover:bg-red-50 text-red-500 rounded-md transition-colors cursor-pointer"
                          title="Elimina ramo"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TABELLA UTENZE */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm p-6 border border-slate-200 animate-slide-in">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-4">
            <h3 className="text-sm font-bold text-slate-700">Utenze Terminali</h3>
            <button 
              onClick={addUtility}
              className="p-1 px-2.5 bg-purple-50 hover:bg-purple-100 text-purple-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <IconPlus className="w-3.5 h-3.5" /> Aggiungi
            </button>
          </div>
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="py-2 pr-1">ID</th>
                  <th className="py-2 px-1">Nome / Descriz.</th>
                  <th className="py-2 px-1">Q (m³/h)</th>
                  <th className="py-2 px-1">Pmin (bar a)</th>
                  <th className="py-2 px-1">Ramo</th>
                  <th className="py-2 pl-1 text-right">Azione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {utilities.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="py-2 pr-1 font-bold font-mono text-slate-650">{u.id}</td>
                    <td className="py-1 px-1">
                      <input 
                        type="text" 
                        value={u.name} 
                        onChange={e => updateUtility(u.id, 'name', e.target.value)} 
                        className="bg-transparent font-medium text-slate-700 w-full focus:outline-none border-b border-transparent focus:border-purple-300"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input 
                        type="number" 
                        value={u.flowRate} 
                        onChange={e => updateUtility(u.id, 'flowRate', e.target.value)} 
                        className="bg-transparent font-mono text-slate-700 w-16 focus:outline-none border-b border-transparent focus:border-purple-300"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <input 
                        type="number" 
                        step="0.01"
                        value={u.pMinRichiesta} 
                        onChange={e => updateUtility(u.id, 'pMinRichiesta', e.target.value)} 
                        className="bg-transparent font-mono text-slate-700 w-12 focus:outline-none border-b border-transparent focus:border-purple-300"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <select
                        value={u.connectedBranchId || ''}
                        onChange={e => updateUtility(u.id, 'connectedBranchId', e.target.value ? Number(e.target.value) : null)}
                        className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer text-xs"
                      >
                        <option value="">Raccordo...</option>
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>{computedBranchTags[b.id] || `R${b.id}`}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pl-1 text-right">
                      <button 
                        onClick={() => removeUtility(u.id)}
                        className="p-1 hover:bg-red-50 text-red-500 rounded-md transition-colors cursor-pointer"
                        title="Elimina utenza"
                      >
                        <IconTrash className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SCHEMA RETE TOPOLOGICO E PANNELLO DETTAGLIO RAMO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 print:block">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6 border border-slate-200 print:shadow-none print:border-none print:p-0 animate-slide-in">
          <h3 className="text-sm font-bold text-slate-700 border-b border-slate-100 pb-2 mb-4">
            Schema Topologico Rete
          </h3>
          <TopologicalTree 
            tratti={treeNodes} 
            activeTag={selectedBranchId ? computedBranchTags[selectedBranchId] : undefined}
            onSelectTag={(tag) => {
              const foundId = Object.keys(computedBranchTags).find(key => computedBranchTags[Number(key)] === tag);
              if (foundId) {
                setSelectedBranchId(Number(foundId));
              }
            }}
          />
        </div>

        {/* DETTAGLI DEL RAMO SELEZIONATO */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm p-6 border border-slate-200 print:hidden animate-slide-in">
          <h3 className="text-sm font-bold text-slate-700 border-b border-slate-100 pb-2 mb-4">
            Accessori e Dettagli: {selectedBranchId ? `Ramo ${computedBranchTags[selectedBranchId] || selectedBranchId}` : 'Seleziona un Ramo'}
          </h3>
          
          {selectedBranchFull ? (
            <div className="space-y-4">
              {/* Gerarchia Condotta */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 space-y-2 text-xs">
                <div className="font-bold text-slate-600 mb-1">Proprietà Linea</div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Gerarchia Condotta / Tipo</label>
                  <select
                    value={selectedBranchFull.hierarchy || ''}
                    onChange={e => updateBranch(selectedBranchFull.id, 'hierarchy', e.target.value)}
                    className="w-full bg-white p-2 rounded border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-purple-500"
                  >
                    <option value="dorsale_principale">Dorsale Principale (Blu scuro, spessa)</option>
                    <option value="dorsale_secondaria">Dorsale Secondaria (Blu, media)</option>
                    <option value="dorsale_terziaria">Dorsale Terziaria (Smeraldo, sottile)</option>
                    <option value="utenza">Tratto Terminale / Utenza (Grigia, sottilissima)</option>
                  </select>
                </div>
              </div>

              {selectedBranchFull.material === 'manuale' && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 space-y-2 text-xs">
                  <div className="font-bold text-slate-600 mb-1">Dati Tubo Manuale</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">D interno (mm)</label>
                      <input 
                        type="number" 
                        value={selectedBranchFull.dIntManual}
                        onChange={e => updateBranch(selectedBranchFull.id, 'dIntManual', e.target.value)}
                        className="w-full bg-white text-xs p-1.5 rounded border border-slate-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">D esterno (mm)</label>
                      <input 
                        type="number" 
                        value={selectedBranchFull.dExtManual}
                        onChange={e => updateBranch(selectedBranchFull.id, 'dExtManual', e.target.value)}
                        className="w-full bg-white text-xs p-1.5 rounded border border-slate-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Scabrezza ε (mm)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={selectedBranchFull.roughnessManual}
                        onChange={e => updateBranch(selectedBranchFull.id, 'roughnessManual', e.target.value)}
                        className="w-full bg-white text-xs p-1.5 rounded border border-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Contatori Accessori */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 space-y-2.5 text-xs">
                <div className="font-bold text-slate-600 mb-1">Pezzi Speciali ed Accessori</div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Valvole a Sfera{getAccessoryLabelSuffix('valvola_sfera', 10)}</label>
                    <input 
                      type="number" 
                      value={selectedBranchFull.nValvole} 
                      onChange={e => updateBranch(selectedBranchFull.id, 'nValvole', e.target.value)}
                      className="w-full bg-white p-2 rounded border border-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Gomiti (Angolo 90°){getAccessoryLabelSuffix('angolo_90', 1.5)}</label>
                    <input 
                      type="number" 
                      value={selectedBranchFull.nGomiti} 
                      onChange={e => updateBranch(selectedBranchFull.id, 'nGomiti', e.target.value)}
                      className="w-full bg-white p-2 rounded border border-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">T Passaggio Diretto{getAccessoryLabelSuffix('tee_diretto', 0.9)}</label>
                    <input 
                      type="number" 
                      value={selectedBranchFull.nTeeDiretto} 
                      onChange={e => updateBranch(selectedBranchFull.id, 'nTeeDiretto', e.target.value)}
                      className="w-full bg-white p-2 rounded border border-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">T Passaggio Laterale{getAccessoryLabelSuffix('tee_laterale', 2.0)}</label>
                    <input 
                      type="number" 
                      value={selectedBranchFull.nTeeLaterale} 
                      onChange={e => updateBranch(selectedBranchFull.id, 'nTeeLaterale', e.target.value)}
                      className="w-full bg-white p-2 rounded border border-slate-200 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Nippli di Riduzione{getAccessoryLabelSuffix('nipplo_riduzione', 0.35)}</label>
                  <input 
                    type="number" 
                    value={selectedBranchFull.nRiduzioni} 
                    onChange={e => updateBranch(selectedBranchFull.id, 'nRiduzioni', e.target.value)}
                    className="w-full bg-white p-2 rounded border border-slate-200 text-xs"
                  />
                </div>
                
                <MiniEquivalentTable />
              </div>

              {/* Risultati Calcoli Intermedi del Ramo */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-2 text-xs animate-fade-in">
                <div className="font-bold text-slate-700 mb-1 border-b border-slate-200 pb-1">Dati Calcolati Ramo</div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Portata normale QN:</span>
                  <span className="font-semibold text-slate-800">{formatNumber(selectedBranchFull.qN_min, 3)} Nm³/min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Portata massica:</span>
                  <span className="font-semibold text-slate-800">{formatNumber(selectedBranchFull.qMass_min, 3)} kg/min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Velocità di picco:</span>
                  <span className="font-semibold text-slate-800">{formatNumber(selectedBranchFull.vMax, 2)} m/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Numero di Reynolds:</span>
                  <span className="font-semibold text-slate-800">{Math.round(selectedBranchFull.Re || 0).toLocaleString('it-IT')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Coeff. attrito λ:</span>
                  <span className="font-semibold text-slate-800 font-mono">{formatNumber(selectedBranchFull.lambda, 4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lunghezza equival. Leq:</span>
                  <span className="font-semibold text-slate-800">{formatNumber(selectedBranchFull.lEq, 2)} m</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 mt-1 font-bold">
                  <span className="text-slate-700">Pressione inizio:</span>
                  <span className="text-slate-800 font-mono">{formatNumber(selectedBranchFull.pStartBar, 3)} bar a</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-slate-700">Pressione fine nodo:</span>
                  <span className={`${selectedBranchFull.status === 'ok' ? 'text-emerald-600' : 'text-orange-650'} font-mono`}>
                    {formatNumber(selectedBranchFull.pFinalBar, 3)} bar a ({formatNumber(selectedBranchFull.pFinalMbarGauge, 1)} mbar)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs italic">
              Seleziona una riga nella tabella a sinistra per configurare gli accessori ed esaminare i calcoli di dettaglio del ramo.
            </div>
          )}
        </div>
      </div>

      {/* REPORT COMPLETO DI DIMENSIONAMENTO E VERIFICA */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 print:shadow-none print:border-none print:p-0 print:!break-inside-auto animate-slide-in">
        <h3 className="text-sm font-bold text-slate-700 border-b border-slate-100 pb-2 mb-4">
          Report di Dimensionamento e Verifica Linee Rete
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                <th className="py-2.5 pr-1">Ramo</th>
                <th className="py-2.5 px-1">Pres. Iniz. (bar a)</th>
                <th className="py-2.5 px-1">Dislivello (m)</th>
                <th className="py-2.5 px-1">Portata QN (Nm³/min)</th>
                <th className="py-2.5 px-1">Tubo (DE/Int)</th>
                <th className="py-2.5 px-1 font-mono">Re</th>
                <th className="py-2.5 px-1">Attrito λ</th>
                <th className="py-2.5 px-1 text-right">∆P distr (bar)</th>
                <th className="py-2.5 px-1 text-right">∆P conc (bar)</th>
                <th className="py-2.5 px-1 text-right font-bold text-slate-650">P fine (bar a)</th>
                <th className="py-2.5 px-1 text-right font-bold">Vmax (m/s)</th>
                <th className="py-2.5 px-1 pl-3">Utenza collegata</th>
                <th className="py-2.5 pl-1 text-center">Esito</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {processedBranchesList.map(b => {
                const statusClasses = b.status === 'ok' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : b.status === 'warning'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-red-50 text-red-700 border border-red-200';

                return (
                  <tr key={b.id} className="hover:bg-slate-50/50">
                    <td className="py-2 pr-1 font-bold font-mono text-purple-700">{computedBranchTags[b.id] || b.id}</td>
                    <td className="py-2 px-1 font-mono text-slate-600">{formatNumber(b.pStartBar, 3)}</td>
                    <td className="py-2 px-1 font-mono text-slate-600">{(Number(b.hValle) || 0) - (Number(b.hMonte) || 0)}</td>
                    <td className="py-2 px-1 font-mono text-slate-800 font-semibold">{formatNumber(b.qN_min, 3)}</td>
                    <td className="py-2 px-1 text-slate-600 font-medium">
                      {b.material === 'manuale' 
                        ? `Manuale (Ø ${b.dInt}mm)` 
                        : `${b.material} DE${b.dExt} (DN${b.DN})`}
                    </td>
                    <td className="py-2 px-1 font-mono text-slate-500">{Math.round(b.Re || 0).toLocaleString('it-IT')}</td>
                    <td className="py-2 px-1 font-mono text-slate-500">{formatNumber(b.lambda, 4)}</td>
                    <td className="py-2 px-1 text-right font-mono text-slate-650">{formatNumber(b.deltaPDistBar, 5)}</td>
                    <td className="py-2 px-1 text-right font-mono text-slate-650">{formatNumber(b.deltaPConcBar, 5)}</td>
                    <td className="py-2 px-1 text-right font-mono font-bold text-slate-700">{formatNumber(b.pFinalBar, 3)}</td>
                    <td className="py-2 px-1 text-right font-mono font-bold text-slate-855">{formatNumber(b.vMax, 2)}</td>
                    <td className="py-2 px-1 pl-3 text-slate-500 truncate max-w-[150px]" title={b.utenzeLabel}>{b.utenzeLabel}</td>
                    <td className="py-2 pl-1 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${statusClasses}`} title={b.message}>
                        {b.status === 'ok' ? 'Verificato' : b.status === 'warning' ? 'critico' : 'inadeguato'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
