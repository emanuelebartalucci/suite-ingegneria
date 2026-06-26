import React, { useState, useMemo, useEffect } from 'react';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import { formatNumber } from '../utils/format';
import { 
  IconWind, 
  IconTrash, 
  IconPlus, 
  IconCopy 
} from '../components/Icons';
import { Shield, Settings, Activity, Layers, Thermometer, Droplet, Plus, Trash2, ArrowRightLeft, FileSpreadsheet, Eye, ChevronRight } from 'lucide-react';

// Interfaces for our HVAC tool data structures
export interface HVACEquipment {
  id: string;
  name: string;
  power_W: number;
  quantity: number;
  usageFactor: number;
  dissipationFactor: number;
}

export interface HVACDoorLeak {
  id: string;
  type: 'singola' | 'doppia' | 'personalizzata';
  customLength?: number; // m
  customWidth?: number;  // m (default 0.002)
  customAlpha?: number;  // default 0.85
  direction: 'in' | 'out'; // in = aria entra (infiltrazione), out = aria esce (trafilamento)
  adjacentPressure_Pa: number; // pressione del locale confinante
  description: string;
  adjacentRoomId?: string; // ID del locale confinante
}

export interface HVACRoom {
  id: string;
  systemId: string;
  code: string;
  description: string;
  gmpClass: string;
  bioLevel: string;
  ricambiStd: number;
  ricambiApp: number;
  area: number;
  height: number;
  tempSummer: number;
  tempSummerTol: string;
  rhSummer: number;
  rhSummerTol: string;
  tempWinter: number;
  tempWinterTol: string;
  rhWinter: number;
  rhWinterTol: string;
  lightLoad_W_m2: number;
  peopleCount: number;
  peopleSensible_W: number;
  peopleLatent_W: number;
  externalHeatGain_W: number;  // Rientrate di calore (manual input)
  externalHeatLoss_W: number;  // Dispersioni di calore (manual input)
  pressure_Pa: number;
  equipment: HVACEquipment[];
  doors: HVACDoorLeak[];
  supplyTempSummer: number;
  supplyTempWinter: number;
  reheatZone: string; // e.g. RC-103-01
  reheatCoilUpstreamTemp: number; // T monte, default 18.2
  exhaustFlow?: number;           // Portata espulsa localmente (m³/h)
}

export interface HVACSystem {
  id: string;
  name: string;
  description: string;
  coolingPower_kW?: number; // Potenza batteria fredda UTA (kW)
  ahuExhaustFlow?: number;  // Aria espulsa direttamente in UTA (m³/h)
}

interface ToolHVACProps {
  projectData: ProjectData;
  setProjectData: (data: any) => void;
  setAppMode: (mode: string) => void;
}

// Default empty systems and rooms
const DEFAULT_SYSTEMS: HVACSystem[] = [];
const DEFAULT_ROOMS: HVACRoom[] = [];

export function ToolHVAC({ projectData, setProjectData, setAppMode }: ToolHVACProps) {
  const num = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  };
  // Tabs: criteria (Locali & Criteri), flows (Portate Aria), leakage (Trafilamenti), reheat (Batterie di Post), summary (Consumi & Diametri)
  const [activeTab, setActiveTab] = useState<'criteria' | 'flows' | 'leakage' | 'reheat' | 'summary'>('criteria');
  
  // Settings/global parameters
  const [overdesignFactor, setOverdesignFactor] = useState<number | ''>(20); // % overdesign for airflows
  const [reheatOverdesignFactor, setReheatOverdesignFactor] = useState<number | ''>(20); // % overdesign for reheaters
  const [waterDeltaT, setWaterDeltaT] = useState<number | ''>(10); // °C delta T hot water
  const [defaultLighting_W_m2, setDefaultLighting_W_m2] = useState<number | ''>(20);
  
  // Project-specific systems and rooms
  const [systems, setSystems] = useState<HVACSystem[]>(DEFAULT_SYSTEMS);
  const [rooms, setRooms] = useState<HVACRoom[]>(DEFAULT_ROOMS);
  
  // UI states for editing/adding
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showEqModal, setShowEqModal] = useState<boolean>(false);
  const [eqRoomId, setEqRoomId] = useState<string | null>(null);

  // Custom modal states for adding systems & rooms
  const [showAddSystemModal, setShowAddSystemModal] = useState<boolean>(false);
  const [newSystemCode, setNewSystemCode] = useState<string>('');
  const [newSystemDesc, setNewSystemDesc] = useState<string>('');

  const [showAddRoomModal, setShowAddRoomModal] = useState<boolean>(false);
  const [addRoomSystemId, setAddRoomSystemId] = useState<string | null>(null);
  const [newRoomCode, setNewRoomCode] = useState<string>('');
  const [newRoomDesc, setNewRoomDesc] = useState<string>('');

  const selectedRoom = useMemo(() => {
    return rooms.find(r => r.id === selectedRoomId) || null;
  }, [rooms, selectedRoomId]);

  // Calculations for each room (heat loads, airflows, leakages, reheaters)
  const roomCalculations = useMemo(() => {
    return rooms.map(room => {
      const volume = Number((num(room.area) * num(room.height)).toFixed(2));
      const lightLoad = Number((num(room.area) * num(room.lightLoad_W_m2)).toFixed(1));
      const peopleSensible = num(room.peopleCount) * num(room.peopleSensible_W);
      const peopleLatent = num(room.peopleCount) * num(room.peopleLatent_W);
      const equipmentLoad = room.equipment.reduce((sum, eq) => {
        const dPower = num(eq.power_W) * num(eq.quantity) * num(eq.usageFactor) * num(eq.dissipationFactor);
        return sum + dPower;
      }, 0);
      const totalSensibleSummer = Number((lightLoad + equipmentLoad + peopleSensible + num(room.externalHeatGain_W)).toFixed(1));

      let summerThermalFlow = 0;
      if (num(room.tempSummer) > num(room.supplyTempSummer)) {
        summerThermalFlow = totalSensibleSummer * 0.86 * (1 / 0.3) * (1 / (num(room.tempSummer) - num(room.supplyTempSummer)));
      }
      let winterThermalFlow = 0;
      if (num(room.supplyTempWinter) > num(room.tempWinter)) {
        winterThermalFlow = num(room.externalHeatLoss_W) * 0.86 * (1 / 0.3) * (1 / (num(room.supplyTempWinter) - num(room.tempWinter)));
      }
      const ricambiFlow = num(room.ricambiApp) * volume;
      const maxThermalFlow = Math.max(summerThermalFlow, winterThermalFlow);
      const calculatedFlow = Math.max(maxThermalFlow, ricambiFlow);
      const adoptedFlow = Math.ceil(calculatedFlow / 10) * 10;
      const overdesignFlow = Math.ceil((adoptedFlow * (1 + num(overdesignFactor) / 100)) / 10) * 10;

      let infiltrationFlow = 0;
      let exfiltrationFlow = 0;
      room.doors.forEach(door => {
        const l = door.type === 'singola' ? 5.1 : door.type === 'doppia' ? 5.8 : (num(door.customLength) || 5.1);
        const s = num(door.customWidth) || 0.002;
        const alpha = num(door.customAlpha) || 0.85;
        
        let adjP = num(door.adjacentPressure_Pa);
        if (door.adjacentRoomId && door.adjacentRoomId !== 'esterno') {
          const adjRoom = rooms.find(r => r.id === door.adjacentRoomId);
          if (adjRoom) adjP = num(adjRoom.pressure_Pa);
        }
        const dp = num(room.pressure_Pa) - adjP;
        const flow = Math.ceil(l * s * alpha * 3600 * Math.sqrt(Math.abs(dp)));
        
        if (dp < 0) {
          infiltrationFlow += flow;
        } else {
          exfiltrationFlow += flow;
        }
      });

      const rawRipresaFlow = adoptedFlow - num(room.exhaustFlow) + infiltrationFlow - exfiltrationFlow;
      const adoptedRipresaFlow = Math.max(0, Math.ceil(rawRipresaFlow / 10) * 10);
      const overdesignRipresaFlow = Math.ceil((adoptedRipresaFlow * (1 + num(overdesignFactor) / 100)) / 10) * 10;

      let reheatPower_kcal = 0;
      if (num(room.supplyTempWinter) > num(room.reheatCoilUpstreamTemp)) {
        reheatPower_kcal = adoptedFlow * (num(room.supplyTempWinter) - num(room.reheatCoilUpstreamTemp)) * 0.3;
      }
      const reheatPower_kW = reheatPower_kcal * 0.001163;
      const reheatDesignPower_kcal = Math.round((reheatPower_kcal * (1 + num(reheatOverdesignFactor) / 100)) / 50) * 50;
      const reheatDesignPower_kW = reheatDesignPower_kcal * 0.001163;
      const waterFlowMin_lth = reheatPower_kcal / num(waterDeltaT);
      const waterFlowDesign_lth = reheatDesignPower_kcal / num(waterDeltaT);

      return {
        room, volume, lightLoad, peopleSensible, peopleLatent, equipmentLoad, totalSensibleSummer,
        summerThermalFlow, winterThermalFlow, ricambiFlow, calculatedFlow, adoptedFlow, overdesignFlow,
        infiltrationFlow, exfiltrationFlow, rawRipresaFlow, adoptedRipresaFlow, overdesignRipresaFlow,
        reheatPower_kcal, reheatPower_kW, reheatDesignPower_kcal, reheatDesignPower_kW,
        waterFlowMin_lth, waterFlowDesign_lth
      };
    });
  }, [rooms, overdesignFactor, reheatOverdesignFactor, waterDeltaT]);

  // Aggregated values per System
  const systemCalculations = useMemo(() => {
    return systems.map(sys => {
      const sysRooms = roomCalculations.filter(c => c.room.systemId === sys.id);
      
      const totalArea = sysRooms.reduce((sum, r) => sum + num(r.room.area), 0);
      const totalVolume = sysRooms.reduce((sum, r) => sum + r.volume, 0);
      const totalSensibleSummer = sysRooms.reduce((sum, r) => sum + r.totalSensibleSummer, 0);
      const totalLossesWinter = sysRooms.reduce((sum, r) => sum + num(r.room.externalHeatLoss_W), 0);

      const totalMandata = sysRooms.reduce((sum, r) => sum + r.adoptedFlow, 0);
      const totalMandataSovr = sysRooms.reduce((sum, r) => sum + r.overdesignFlow, 0);
      
      const totalRipresa = sysRooms.reduce((sum, r) => sum + r.adoptedRipresaFlow, 0);
      const totalRipresaSovr = sysRooms.reduce((sum, r) => sum + r.overdesignRipresaFlow, 0);

      const totalReheatPower_kW = sysRooms.reduce((sum, r) => sum + r.reheatPower_kW, 0);
      const totalReheatDesignPower_kW = sysRooms.reduce((sum, r) => sum + r.reheatDesignPower_kW, 0);
      const totalWaterFlow_lth = sysRooms.reduce((sum, r) => sum + r.waterFlowDesign_lth, 0);

      // Bilancio Aeraulico Globale UTA (arrotondato a 100 come in Excel)
      const totalExhaustLocal = sysRooms.reduce((sum, r) => sum + num(r.room.exhaustFlow), 0);
      const mandataProject_m3h = Math.ceil((totalMandata * (1 + num(overdesignFactor) / 100)) / 100) * 100;
      const ripresaProject_m3h = Math.ceil((totalRipresa * (1 + num(overdesignFactor) / 100)) / 100) * 100;
      const espulsioneProject_m3h = Math.ceil(((totalExhaustLocal + num(sys.ahuExhaustFlow)) * (1 + num(overdesignFactor) / 100)) / 100) * 100;
      
      // Bilancio di massa: Aria Esterna = Mandata - Ripresa + Aria Espulsa in UTA
      const ariaEsternaProject_m3h = Math.max(0, mandataProject_m3h - ripresaProject_m3h + espulsioneProject_m3h);
      const rinnovoPercent = mandataProject_m3h > 0 ? (ariaEsternaProject_m3h / mandataProject_m3h) * 100 : 0;

      // Batteria Fredda UTA (Portata H2O con salto termico 5°C: l/h = kW * 860 / 5)
      const waterFlowCold_lth = Math.ceil(num(sys.coolingPower_kW) * 860 / 5);

      return {
        system: sys,
        totalArea,
        totalVolume,
        totalSensibleSummer,
        totalLossesWinter,
        totalMandata,
        totalMandataSovr,
        totalRipresa,
        totalRipresaSovr,
        totalReheatPower_kW,
        totalReheatDesignPower_kW,
        totalWaterFlow_lth,
        totalExhaustLocal,
        mandataProject_m3h,
        ripresaProject_m3h,
        espulsioneProject_m3h,
        ariaEsternaProject_m3h,
        rinnovoPercent,
        waterFlowCold_lth
      };
    });
  }, [systems, roomCalculations, overdesignFactor]);

  // Utility summary pipe sizing (DN selection helper based on water flow)
  const getPipeSizeDN = (flow_lth: number): string => {
    if (flow_lth <= 0) return '-';
    if (flow_lth <= 350) return 'DN15';
    if (flow_lth <= 700) return 'DN20';
    if (flow_lth <= 1600) return 'DN25';
    if (flow_lth <= 3000) return 'DN32';
    if (flow_lth <= 4500) return 'DN40';
    if (flow_lth <= 8000) return 'DN50';
    if (flow_lth <= 16500) return 'DN65';
    return 'DN80';
  };

  const getValveKvs = (flow_lth: number): string => {
    if (flow_lth <= 0) return '-';
    if (flow_lth <= 250) return 'DN15, kvs 0.63';
    if (flow_lth <= 350) return 'DN15, kvs 1.0';
    if (flow_lth <= 700) return 'DN15, kvs 1.6';
    if (flow_lth <= 1600) return 'DN20, kvs 4.0';
    if (flow_lth <= 3000) return 'DN25, kvs 6.3';
    if (flow_lth <= 5000) return 'DN32, kvs 10.0';
    if (flow_lth <= 11000) return 'DN40, kvs 25.0';
    return 'DN50, kvs 40.0';
  };

  // Firestore Save & Load integration
  const handleLoadCloudProject = (data: any) => {
    if (!data) return;
    if (data.systems) setSystems(data.systems);
    if (data.rooms) setRooms(data.rooms);
    if (data.overdesignFactor !== undefined) setOverdesignFactor(data.overdesignFactor);
    if (data.reheatOverdesignFactor !== undefined) setReheatOverdesignFactor(data.reheatOverdesignFactor);
    if (data.waterDeltaT !== undefined) setWaterDeltaT(data.waterDeltaT);
    if (data.defaultLighting_W_m2 !== undefined) setDefaultLighting_W_m2(data.defaultLighting_W_m2);
    if (data.rooms && data.rooms.length > 0) {
      setSelectedRoomId(data.rooms[0].id);
    }
  };

  const getCloudSaveData = () => {
    return {
      systems,
      rooms,
      overdesignFactor,
      reheatOverdesignFactor,
      waterDeltaT,
      defaultLighting_W_m2
    };
  };

  // UI Handlers for Systems & Rooms
  const handleAddSystem = () => {
    setNewSystemCode('');
    setNewSystemDesc('');
    setShowAddSystemModal(true);
  };

  const confirmAddSystem = () => {
    const code = newSystemCode.trim();
    const suiteUI = (window as any).suiteUI;
    if (!code) {
      suiteUI?.toast("Il codice del sistema è obbligatorio!", "error");
      return;
    }
    if (systems.some(s => s.id === code)) {
      suiteUI?.toast("Questo sistema esiste già!", "error");
      return;
    }
    const newSystem: HVACSystem = { 
      id: code, 
      name: code, 
      description: newSystemDesc.trim(),
      coolingPower_kW: 0,
      ahuExhaustFlow: 0
    };
    setSystems([...systems, newSystem]);
    setShowAddSystemModal(false);
    setNewSystemCode('');
    setNewSystemDesc('');
    suiteUI?.toast("Sistema aggiunto con successo", "success");
  };

  const handleRemoveSystem = async (sysId: string) => {
    const suiteUI = (window as any).suiteUI;
    if (!suiteUI) return;
    const isConfirmed = await suiteUI.confirm(`Sei sicuro di voler eliminare il sistema ${sysId} e tutti i suoi locali associati?`, "Elimina Sistema");
    if (isConfirmed) {
      setSystems(prev => prev.filter(s => s.id !== sysId));
      setRooms(prev => prev.filter(r => r.systemId !== sysId));
      setSelectedRoomId(prev => {
        const remaining = rooms.filter(r => r.systemId !== sysId);
        return remaining[0]?.id || null;
      });
      suiteUI.toast("Sistema e locali rimossi", "info");
    }
  };

  const handleAddRoom = (sysId: string) => {
    setAddRoomSystemId(sysId);
    setNewRoomCode('');
    setNewRoomDesc('');
    setShowAddRoomModal(true);
  };

  const confirmAddRoom = () => {
    const code = newRoomCode.trim();
    const suiteUI = (window as any).suiteUI;
    if (!code) {
      suiteUI?.toast("Il codice del locale è obbligatorio!", "error");
      return;
    }
    if (!addRoomSystemId) return;

    const newId = `room-${Date.now()}`;
    const newRoom: HVACRoom = {
      id: newId,
      systemId: addRoomSystemId,
      code,
      description: newRoomDesc.trim(),
      gmpClass: 'NC',
      bioLevel: 'N.A.',
      ricambiStd: 3,
      ricambiApp: 3,
      area: 20,
      height: 3.0,
      tempSummer: 22,
      tempSummerTol: '±2',
      rhSummer: 50,
      rhSummerTol: '≤ 65,0',
      tempWinter: 22,
      tempWinterTol: '±2',
      rhWinter: 50,
      rhWinterTol: '≤ 65,0',
      lightLoad_W_m2: num(defaultLighting_W_m2),
      peopleCount: 0,
      peopleSensible_W: 100,
      peopleLatent_W: 75,
      externalHeatGain_W: 1000,
      externalHeatLoss_W: 1000,
      pressure_Pa: 0,
      equipment: [],
      doors: [],
      supplyTempSummer: 18,
      supplyTempWinter: 26,
      reheatZone: `RC-${addRoomSystemId.split('-').slice(0,2).join('-')}-01`,
      reheatCoilUpstreamTemp: 18.2,
      exhaustFlow: 0
    };

    setRooms([...rooms, newRoom]);
    setSelectedRoomId(newId);
    setShowAddRoomModal(false);
    setNewRoomCode('');
    setNewRoomDesc('');
    setAddRoomSystemId(null);
    suiteUI?.toast("Locale aggiunto con successo", "success");
  };

  const handleRemoveRoom = async (roomId: string) => {
    const suiteUI = (window as any).suiteUI;
    if (!suiteUI) return;
    const isConfirmed = await suiteUI.confirm("Sei sicuro di voler rimuovere questo locale?", "Rimuovi Locale");
    if (isConfirmed) {
      const updated = rooms.filter(r => r.id !== roomId);
      setRooms(updated);
      if (selectedRoomId === roomId) {
        setSelectedRoomId(updated[0]?.id || null);
      }
      suiteUI.toast("Locale rimosso con successo", "info");
    }
  };

  const handleDuplicateRoom = (roomToDup: HVACRoom) => {
    const newId = `room-${Date.now()}`;
    const duplicated: HVACRoom = {
      ...roomToDup,
      id: newId,
      code: roomToDup.code + " Bis",
      description: roomToDup.description + " (Copia)",
      equipment: roomToDup.equipment.map(e => ({ ...e, id: `eq-${Date.now()}-${Math.random()}` })),
      doors: roomToDup.doors.map(d => ({ ...d, id: `door-${Date.now()}-${Math.random()}` })),
      exhaustFlow: roomToDup.exhaustFlow || 0
    };
    setRooms([...rooms, duplicated]);
    setSelectedRoomId(newId);
  };

  const handleUpdateRoomField = (roomId: string, field: keyof HVACRoom, val: any) => {
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, [field]: val } : r));
  };

  const handleUpdateSystemField = (sysId: string, field: keyof HVACSystem, val: any) => {
    setSystems(prev => prev.map(s => s.id === sysId ? { ...s, [field]: val } : s));
  };

  // Equipment load helpers
  const handleAddEquipment = (roomId: string) => {
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) {
        const newEq: HVACEquipment = {
          id: `eq-${Date.now()}`,
          name: 'Nuovo Apparecchio',
          power_W: 1000,
          quantity: 1,
          usageFactor: 1.0,
          dissipationFactor: 0.15
        };
        return { ...r, equipment: [...r.equipment, newEq] };
      }
      return r;
    }));
  };

  const handleRemoveEquipment = (roomId: string, eqId: string) => {
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) {
        return { ...r, equipment: r.equipment.filter(e => e.id !== eqId) };
      }
      return r;
    }));
  };

  const handleUpdateEquipment = (roomId: string, eqId: string, field: keyof HVACEquipment, val: any) => {
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) {
        const updatedEq = r.equipment.map(e => e.id === eqId ? { ...e, [field]: val } : e);
        return { ...r, equipment: updatedEq };
      }
      return r;
    }));
  };

  // Door leakage helpers
  const handleAddDoor = (roomId: string) => {
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) {
        const newDoor: HVACDoorLeak = {
          id: `door-${Date.now()}`,
          type: 'singola',
          direction: 'in',
          adjacentPressure_Pa: 0,
          description: 'Porta standard',
          adjacentRoomId: 'esterno'
        };
        return { ...r, doors: [...r.doors, newDoor] };
      }
      return r;
    }));
  };

  const handleRemoveDoor = (roomId: string, doorId: string) => {
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) {
        return { ...r, doors: r.doors.filter(d => d.id !== doorId) };
      }
      return r;
    }));
  };

  const handleUpdateDoor = (roomId: string, doorId: string, field: keyof HVACDoorLeak, val: any) => {
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) {
        const updatedDoors = r.doors.map(d => d.id === doorId ? { ...d, [field]: val } : d);
        return { ...r, doors: updatedDoors };
      }
      return r;
    }));
  };

  const handleUpdateDoorFields = (roomId: string, doorId: string, fields: Partial<HVACDoorLeak>) => {
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) {
        const updatedDoors = r.doors.map(d => d.id === doorId ? { ...d, ...fields } : d);
        return { ...r, doors: updatedDoors };
      }
      return r;
    }));
  };

  return (
    <>
      <div className="max-w-7xl mx-auto animate-fade-in px-4 pb-12">
      {/* Title Header */}
      <ProjectHeader 
        pData={projectData} 
        setPData={setProjectData} 
        title="Dimensionamento HVAC" 
        setAppMode={setAppMode} 
        iconColor="brand" 
      />
      
      {/* Persistence / Cloud Storage */}
      <div className="print:hidden">
        <ProjectStorage 
          toolType="hvac"
          currentData={getCloudSaveData()}
          onLoadProject={handleLoadCloudProject}
          projectInfo={projectData}
          setProjectInfo={setProjectData}
        />
      </div>

      {/* Box Informativo con Formule */}
      <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 mb-5 text-xs text-slate-650 space-y-2.5 print:hidden">
        <p>
          <strong>Descrizione:</strong> Questo strumento consente di effettuare il dimensionamento aeraulico completo dei sistemi HVAC (UTA). Calcola le portate d'aria per smaltimento carichi o ricambi minimi, esegue il bilancio aeraulico dei locali considerando infiltrazioni/trafilamenti dalle porte per pressione differenziale, e calcola il carico termico e la portata d'acqua per le batterie di post-riscaldo.
        </p>
        <div className="bg-white/80 border border-amber-100 rounded-xl p-4 text-slate-600">
          <p className="font-bold text-slate-700 mb-2.5 text-[11px] uppercase tracking-wide">Formule e criteri di calcolo applicati:</p>
          <div className="space-y-3.5 pl-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span>• Portata Aria Estiva (smaltimento carichi):</span>
              <span className="font-serif font-bold text-slate-800">
                G<sub>estate</sub> = Q<sub>sens</sub> × 0.86 × (1 / 0.3) × [1 / (T<sub>locale</sub> - T<sub>imm,est</sub>)] [m³/h]
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span>• Portata Aria Invernale (dispersioni):</span>
              <span className="font-serif font-bold text-slate-800">
                G<sub>inverno</sub> = Q<sub>dispers</sub> × 0.86 × (1 / 0.3) × [1 / (T<sub>imm,inv</sub> - T<sub>locale</sub>)] [m³/h]
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span>• Portata per Ricambi d'Aria minimi:</span>
              <span className="font-serif font-bold text-slate-800">
                G<sub>ricambi</sub> = Volume × Ricambi Applicati [m³/h]
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span>• Trafilamento fessure porte per differenziale di pressione (ΔP):</span>
              <span className="font-serif font-bold text-slate-800">
                Q<sub>leak</sub> = l × s × α × 3600 × √|ΔP| [m³/h]
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span>• Equazione di bilancio aeraulico (Ripresa):</span>
              <span className="font-serif font-bold text-slate-800">
                G<sub>ripresa</sub> = G<sub>mandata</sub> + Infiltrazioni (Entranti) - Espulsioni - Trafilamenti (Uscenti)
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span>• Potenza termica Batteria Post-Riscaldo:</span>
              <span className="font-serif font-bold text-slate-800">
                P<sub>post</sub> = G<sub>mandata</sub> × (T<sub>valle</sub> - T<sub>monte</sub>) × 0.3 [kcal/h]
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Config / Parameter Controls */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-5 mb-6 print:hidden">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <Settings className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Parametri e Coefficienti Globali</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Sovradimensionamento Aria Mandata (%)
            </label>
            <input 
              type="number" 
              value={overdesignFactor} 
              onChange={e => setOverdesignFactor(e.target.value === '' ? '' : Number(e.target.value))} 
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Sovradimensionamento Batterie (%)
            </label>
            <input 
              type="number" 
              value={reheatOverdesignFactor} 
              onChange={e => setReheatOverdesignFactor(e.target.value === '' ? '' : Number(e.target.value))} 
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Salto Termico Lato Acqua (ΔT °C)
            </label>
            <input 
              type="number" 
              value={waterDeltaT} 
              onChange={e => setWaterDeltaT(e.target.value === '' ? '' : Number(e.target.value))} 
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Luci Standard (W/m²)
            </label>
            <input 
              type="number" 
              value={defaultLighting_W_m2} 
              onChange={e => setDefaultLighting_W_m2(e.target.value === '' ? '' : Number(e.target.value))} 
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Compact Global Parameters for Print */}
      <div className="hidden print:block border border-slate-200 rounded-2xl p-3.5 mb-5 text-[10px] text-slate-650 bg-slate-50/40">
        <h5 className="font-bold text-[9px] uppercase tracking-wider text-slate-500 mb-2 border-b border-slate-100 pb-1">
          Criteri di Design e Coefficienti Applicati
        </h5>
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 font-semibold">
          <div>
            <span className="text-slate-400 uppercase font-bold text-[8px] mr-1.5">Sovradimensionamento Aria:</span>
            <span className="font-mono">{overdesignFactor}%</span>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-bold text-[8px] mr-1.5">Sovradimensionamento Batterie:</span>
            <span className="font-mono">{reheatOverdesignFactor}%</span>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-bold text-[8px] mr-1.5">Salto Termico H2O (ΔT):</span>
            <span className="font-mono">{waterDeltaT}°C</span>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-bold text-[8px] mr-1.5">Carico Luci Standard:</span>
            <span className="font-mono">{defaultLighting_W_m2} W/m²</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-2 print:hidden">
        <button
          onClick={() => setActiveTab('criteria')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'criteria' 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
              : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          1. Locali e Carichi
        </button>
        <button
          onClick={() => setActiveTab('flows')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'flows' 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
              : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
          }`}
        >
          <IconWind className="w-4 h-4 shrink-0" />
          2. Portate d'Aria
        </button>
        <button
          onClick={() => setActiveTab('leakage')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'leakage' 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
              : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          3. Pressioni e Trafilamenti
        </button>
        <button
          onClick={() => setActiveTab('reheat')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'reheat' 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
              : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
          }`}
        >
          <Thermometer className="w-4 h-4" />
          4. Batterie di Post
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'summary' 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
              : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          5. Riepilogo Consumi
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="bg-slate-50 rounded-2xl min-h-[500px]">
        {/* TAB 1: Locali e Criteri di Design */}
        {activeTab === 'criteria' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block">
              {/* Left pane: Systems and Room Tree */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4 print:hidden">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Sistemi e Locali</h4>
                  <button 
                    onClick={handleAddSystem}
                    className="p-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer print:hidden"
                    title="Aggiungi Sistema UTA"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                  {systems.map(sys => {
                    const sysRooms = rooms.filter(r => r.systemId === sys.id);
                    return (
                      <div key={sys.id} className="border border-slate-150 rounded-2xl p-3 bg-slate-50/50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-black text-slate-800">{sys.id}</span>
                          <div className="flex gap-1 print:hidden">
                            <button 
                              onClick={() => handleAddRoom(sys.id)}
                              className="p-1 text-slate-600 hover:text-blue-600 hover:bg-white rounded-md transition-colors cursor-pointer print:hidden"
                              title="Aggiungi Locale"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleRemoveSystem(sys.id)}
                              className="p-1 text-slate-400 hover:text-red-650 hover:bg-white rounded-md transition-colors cursor-pointer print:hidden"
                              title="Elimina Sistema"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 italic mb-2 truncate">{sys.description}</p>
                        
                        <div className="space-y-1.5 pl-2 border-l border-slate-200">
                          {sysRooms.map(r => (
                            <div 
                              key={r.id} 
                              onClick={() => setSelectedRoomId(r.id)}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                                selectedRoomId === r.id 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-white border border-slate-100 text-slate-600 hover:border-blue-200'
                              }`}
                            >
                              <div className="truncate pr-1">
                                <span className="font-bold text-[10px] uppercase font-mono mr-1.5 opacity-90">{r.code}</span>
                                <span className="opacity-90">{r.description}</span>
                              </div>
                              <ChevronRight className="w-3 h-3 shrink-0 opacity-70" />
                            </div>
                          ))}
                          {sysRooms.length === 0 && (
                            <p className="text-[10px] text-slate-400 italic py-1">Nessun locale inserito.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {systems.length === 0 && (
                    <div className="text-center py-8 text-slate-450 italic text-xs">
                      Nessun sistema creato. Clicca su "+" in alto a destra per iniziare.
                    </div>
                  )}
                </div>
              </div>

              {/* Right pane: Room Settings and Loads */}
              {selectedRoom ? (
                <div className="lg:col-span-2 space-y-6 print:w-full">
                  {/* Room Metadata card */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-mono">{selectedRoom.code}</span>
                          <h4 className="text-sm font-black text-slate-800">{selectedRoom.description}</h4>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Associato a: <strong className="font-mono text-slate-600">{selectedRoom.systemId}</strong></p>
                      </div>
                      <div className="flex gap-2 print:hidden">
                        <button 
                          onClick={() => handleDuplicateRoom(selectedRoom)}
                          className="px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer print:hidden"
                        >
                          <IconCopy /> Duplica
                        </button>
                        <button 
                          onClick={() => handleRemoveRoom(selectedRoom.id)}
                          className="px-2.5 py-1.5 bg-red-50 text-red-650 hover:bg-red-100 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer print:hidden"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Elimina
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Codice Locale</label>
                        <input 
                          type="text" 
                          value={selectedRoom.code} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'code', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descrizione</label>
                        <input 
                          type="text" 
                          value={selectedRoom.description} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'description', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Area (m²)</label>
                        <input 
                          type="number" 
                          value={selectedRoom.area} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'area', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Altezza (m)</label>
                        <input 
                          type="number" 
                          step="0.1" 
                          value={selectedRoom.height} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'height', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Classe GMP</label>
                        <input 
                          type="text" 
                          value={selectedRoom.gmpClass} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'gmpClass', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Livello Biologico</label>
                        <input 
                          type="text" 
                          value={selectedRoom.bioLevel} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'bioLevel', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs border-t border-slate-100 pt-3 items-end">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Ricambi Std (Vol/h)</label>
                        <input 
                          type="number" 
                          value={selectedRoom.ricambiStd} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'ricambiStd', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Ricambi Appl (Vol/h)</label>
                        <input 
                          type="number" 
                          value={selectedRoom.ricambiApp} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'ricambiApp', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Espulsione Locale (m³/h)</label>
                        <input 
                          type="number" 
                          value={selectedRoom.exhaustFlow || 0} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'exhaustFlow', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">T Progetto Estate (°C)</label>
                        <input 
                          type="number" 
                          value={selectedRoom.tempSummer} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'tempSummer', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">T Progetto Inverno (°C)</label>
                        <input 
                          type="number" 
                          value={selectedRoom.tempWinter} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'tempWinter', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Heat loads editing card */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1">
                        <Activity className="w-4 h-4 text-orange-500" />
                        Carichi Termici e Parametri Sensibili
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                      {/* Standard structural heat loads */}
                      <div className="space-y-3">
                        <h5 className="font-bold text-slate-700 border-b border-slate-50 pb-1">Carichi Strutturali</h5>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">Rientrate di calore (Estate, W)</label>
                          <input 
                            type="number" 
                            value={selectedRoom.externalHeatGain_W} 
                            onChange={e => handleUpdateRoomField(selectedRoom.id, 'externalHeatGain_W', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">Dispersioni termiche (Inverno, W)</label>
                          <input 
                            type="number" 
                            value={selectedRoom.externalHeatLoss_W} 
                            onChange={e => handleUpdateRoomField(selectedRoom.id, 'externalHeatLoss_W', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">Densità Carico Luci (W/m²)</label>
                          <input 
                            type="number" 
                            value={selectedRoom.lightLoad_W_m2} 
                            onChange={e => handleUpdateRoomField(selectedRoom.id, 'lightLoad_W_m2', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* People load details */}
                      <div className="space-y-3">
                        <h5 className="font-bold text-slate-700 border-b border-slate-50 pb-1">Affollamento & Persone</h5>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">Numero Persone</label>
                          <input 
                            type="number" 
                            value={selectedRoom.peopleCount} 
                            onChange={e => handleUpdateRoomField(selectedRoom.id, 'peopleCount', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">Carico Sensibile per Persona (W)</label>
                          <input 
                            type="number" 
                            value={selectedRoom.peopleSensible_W} 
                            onChange={e => handleUpdateRoomField(selectedRoom.id, 'peopleSensible_W', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">Carico Latente per Persona (W)</label>
                          <input 
                            type="number" 
                            value={selectedRoom.peopleLatent_W} 
                            onChange={e => handleUpdateRoomField(selectedRoom.id, 'peopleLatent_W', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* Summary loads of the room */}
                      <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                        <h5 className="font-black text-slate-700 uppercase tracking-wide text-[10px]">Riepilogo Carichi Calcolati</h5>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Illuminazione:</span>
                            <span className="font-bold font-mono">{formatNumber(selectedRoom.area * selectedRoom.lightLoad_W_m2, 0)} W</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Persone (Sens/Lat):</span>
                            <span className="font-bold font-mono">
                              {selectedRoom.peopleCount * selectedRoom.peopleSensible_W} / {selectedRoom.peopleCount * selectedRoom.peopleLatent_W} W
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Apparecchiature:</span>
                            <span className="font-bold font-mono">
                              {formatNumber(selectedRoom.equipment.reduce((sum, e) => sum + e.power_W * e.quantity * e.usageFactor * e.dissipationFactor, 0), 0)} W
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-slate-200 pt-2 text-slate-800 font-bold">
                            <span>Carico Sensibile Estivo:</span>
                            <span className="font-mono text-blue-600">
                              {formatNumber(
                                (selectedRoom.area * selectedRoom.lightLoad_W_m2) +
                                (selectedRoom.peopleCount * selectedRoom.peopleSensible_W) +
                                selectedRoom.equipment.reduce((sum, e) => sum + e.power_W * e.quantity * e.usageFactor * e.dissipationFactor, 0) +
                                selectedRoom.externalHeatGain_W,
                                0
                              )} W
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Equipment dissipation details */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1">
                        <Layers className="w-4 h-4 text-purple-500" />
                        Dettaglio Carichi Apparecchiature / Equipment
                      </h4>
                      <button
                        onClick={() => handleAddEquipment(selectedRoom.id)}
                        className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer print:hidden"
                      >
                        <Plus className="w-3.5 h-3.5" /> Aggiungi Apparecchio
                      </button>
                    </div>

                    <div className="overflow-x-auto text-[11px]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-bold">
                            <th className="py-2">Nome Apparecchio</th>
                            <th className="py-2">P. Elettrica (W)</th>
                            <th className="py-2">Quantità</th>
                            <th className="py-2">Coeff. Utilizzo (%)</th>
                            <th className="py-2">Coeff. Dissipazione (%)</th>
                            <th className="py-2">Carico Dissipato (W)</th>
                            <th className="py-2 text-right print:hidden">Azioni</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRoom.equipment.map(eq => (
                            <tr key={eq.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                              <td className="py-1.5 pr-2">
                                <input
                                  type="text"
                                  value={eq.name}
                                  onChange={e => handleUpdateEquipment(selectedRoom.id, eq.id, 'name', e.target.value)}
                                  className="w-full p-1 bg-slate-50 border border-slate-150 rounded-lg"
                                />
                              </td>
                              <td className="py-1.5 pr-2 w-24">
                                <input
                                  type="number"
                                  value={eq.power_W}
                                  onChange={e => handleUpdateEquipment(selectedRoom.id, eq.id, 'power_W', e.target.value === '' ? '' : Number(e.target.value))}
                                  className="w-full p-1 bg-slate-50 border border-slate-150 rounded-lg font-mono"
                                />
                              </td>
                              <td className="py-1.5 pr-2 w-16">
                                <input
                                  type="number"
                                  value={eq.quantity}
                                  onChange={e => handleUpdateEquipment(selectedRoom.id, eq.id, 'quantity', e.target.value === '' ? '' : Number(e.target.value))}
                                  className="w-full p-1 bg-slate-50 border border-slate-150 rounded-lg font-mono"
                                />
                              </td>
                              <td className="py-1.5 pr-2 w-24">
                                <input
                                  type="number"
                                  step="0.05"
                                  value={eq.usageFactor}
                                  onChange={e => handleUpdateEquipment(selectedRoom.id, eq.id, 'usageFactor', e.target.value === '' ? '' : Number(e.target.value))}
                                  className="w-full p-1 bg-slate-50 border border-slate-150 rounded-lg font-mono"
                                />
                              </td>
                              <td className="py-1.5 pr-2 w-24">
                                <input
                                  type="number"
                                  step="0.05"
                                  value={eq.dissipationFactor}
                                  onChange={e => handleUpdateEquipment(selectedRoom.id, eq.id, 'dissipationFactor', e.target.value === '' ? '' : Number(e.target.value))}
                                  className="w-full p-1 bg-slate-50 border border-slate-150 rounded-lg font-mono"
                                />
                              </td>
                              <td className="py-1.5 font-bold font-mono text-slate-700">
                                {formatNumber(num(eq.power_W) * num(eq.quantity) * num(eq.usageFactor) * num(eq.dissipationFactor), 0)} W
                              </td>
                              <td className="py-1.5 text-right print:hidden">
                                <button
                                  onClick={() => handleRemoveEquipment(selectedRoom.id, eq.id)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer print:hidden"
                                  title="Elimina apparecchiatura"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {selectedRoom.equipment.length === 0 && (
                            <tr>
                              <td colSpan={7} className="text-center py-4 text-slate-450 italic">
                                Nessun carico apparecchiatura inserito in questo locale.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="lg:col-span-2 bg-white rounded-3xl p-8 text-center border border-slate-200 flex flex-col items-center justify-center">
                  <p className="text-slate-450 italic text-sm">Seleziona o crea un locale per iniziare.</p>
                </div>
              )}

              {/* Help Sidebar */}
              <div className="lg:col-span-1 bg-amber-50/60 border border-amber-200/60 rounded-3xl p-5 space-y-4 print:hidden self-start shadow-sm text-xs text-slate-650">
                <h5 className="font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wide text-[10px]">
                  💡 Guida: Locali & Carichi
                </h5>
                <div className="space-y-3 leading-relaxed">
                  <p>In questa sezione definisci la struttura e i setpoint del locale:</p>
                  <ul className="list-disc pl-4 space-y-1.5">
                    <li><strong>Codice & Descrizione</strong>: Identificativi del locale.</li>
                    <li><strong>Dimensioni</strong>: Area ed altezza per calcolare il volume.</li>
                    <li><strong>GMP & Bio</strong>: Classificazioni di sterilità (es. NC, Classe A, L2).</li>
                    <li><strong>Pressione Relativa (Pa)</strong>: La pressione target rispetto ai confinanti.</li>
                    <li><strong>Carichi Sensibili (W)</strong>: Apporti per luci, persone ed esterni.</li>
                    <li><strong>Apparecchiature</strong>: Carichi termici elettrici dissipati in ambiente.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Portate d'Aria */}
        {activeTab === 'flows' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block">
            <div className="lg:col-span-3 space-y-6 print:w-full">
            {systems.map(sys => {
              const sysCalcs = roomCalculations.filter(c => c.room.systemId === sys.id);
              const sysTotals = systemCalculations.find(s => s.system.id === sys.id);
              if (sysCalcs.length === 0) return null;

              return (
                <div key={sys.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                  <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                      Sistema: {sys.name} <span className="text-[10px] font-normal text-slate-400 font-sans">({sys.description})</span>
                    </h4>
                  </div>

                  <div className="overflow-x-auto text-[10px]">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px] bg-slate-50/50">
                          <th className="py-2.5 px-2">Locale</th>
                          <th className="py-2.5 px-2 font-mono">Vol. / Carichi</th>
                          <th className="py-2.5 px-2 text-center bg-blue-50/30">Estate (T.imm / Portata)</th>
                          <th className="py-2.5 px-2 text-center bg-orange-50/30">Inverno (T.imm / Portata)</th>
                          <th className="py-2.5 px-2 text-right font-mono">Ricambi (m³/h)</th>
                          <th className="py-2.5 px-2 text-right font-mono font-bold text-slate-700">Mandata (Cal/Adot/Sovr)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sysCalcs.map(c => {
                          // Warning check for supply summer temperature
                          let summerTempColor = "bg-slate-50 text-slate-800";
                          if (c.room.supplyTempSummer < 16) {
                            summerTempColor = "bg-red-100 text-red-800 font-bold";
                          } else if (c.room.supplyTempSummer < 18) {
                            summerTempColor = "bg-yellow-100 text-yellow-800 font-bold";
                          } else {
                            summerTempColor = "bg-green-100 text-green-800 font-bold";
                          }

                          return (
                            <tr key={c.room.id} className="border-b border-slate-100 hover:bg-slate-50/45 text-[10px]">
                              {/* Locale */}
                              <td className="py-3 px-2">
                                <div className="font-bold font-mono text-slate-800">{c.room.code}</div>
                                <div className="text-[9px] text-slate-400 truncate max-w-[120px]" title={c.room.description}>
                                  {c.room.description}
                                </div>
                              </td>

                              {/* Vol & Carichi */}
                              <td className="py-3 px-2 font-mono space-y-0.5">
                                <div className="text-slate-500">Vol: <span className="font-bold">{formatNumber(c.volume, 1)} m³</span></div>
                                <div className="text-blue-600">Est: <span className="font-bold">{formatNumber(c.totalSensibleSummer, 0)} W</span></div>
                                <div className="text-red-650">Inv: <span className="font-bold">{formatNumber(c.room.externalHeatLoss_W, 0)} W</span></div>
                              </td>

                              {/* Estate (T.imm / Portata) */}
                              <td className="py-2 px-2 bg-blue-50/20 text-center">
                                <div className="max-w-[70px] mx-auto mb-1">
                                  <input
                                    type="number"
                                    value={c.room.supplyTempSummer}
                                    onChange={e => handleUpdateRoomField(c.room.id, 'supplyTempSummer', e.target.value === '' ? '' : Number(e.target.value))}
                                    className={`w-full p-1 text-center rounded-lg border border-slate-200 outline-none text-[10px] ${summerTempColor}`}
                                  />
                                </div>
                                <div className="font-mono text-slate-650 text-[10px] font-bold">
                                  {formatNumber(c.summerThermalFlow, 0)} <span className="text-[8px] font-normal text-slate-400">m³/h</span>
                                </div>
                              </td>

                              {/* Inverno (T.imm / Portata) */}
                              <td className="py-2 px-2 bg-orange-50/20 text-center">
                                <div className="max-w-[70px] mx-auto mb-1">
                                  <input
                                    type="number"
                                    value={c.room.supplyTempWinter}
                                    onChange={e => handleUpdateRoomField(c.room.id, 'supplyTempWinter', e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full p-1 text-center rounded-lg border border-slate-200 bg-slate-50 text-slate-800 outline-none font-bold text-[10px]"
                                  />
                                </div>
                                <div className="font-mono text-slate-650 text-[10px] font-bold">
                                  {formatNumber(c.winterThermalFlow, 0)} <span className="text-[8px] font-normal text-slate-400">m³/h</span>
                                </div>
                              </td>

                              {/* Ricambi */}
                              <td className="py-3 px-2 font-mono text-right text-slate-500">
                                <div>{formatNumber(c.ricambiFlow, 0)} <span className="text-[8px] font-normal">m³/h</span></div>
                                <div className="text-[8px] text-slate-400">({c.room.ricambiApp} vol/h)</div>
                              </td>

                              {/* Mandata (Cal/Adot/Sovr) */}
                              <td className="py-3 px-2 font-mono text-right space-y-0.5">
                                <div className="text-slate-500 text-[9px]">Calcolata: {formatNumber(c.calculatedFlow, 0)} m³/h</div>
                                <div className="text-blue-700 font-black text-[11px]">Adottata: {formatNumber(c.room.ricambiApp > 0 ? c.room.ricambiApp * c.volume : c.adoptedFlow, 0)} m³/h</div>
                                <div className="text-slate-450 text-[9px]">Sovrad.: {formatNumber(c.overdesignFlow, 0)} m³/h</div>
                              </td>
                            </tr>
                          );
                        })}
                        {/* Totals row */}
                        {sysTotals && (
                          <tr className="bg-slate-100 font-black text-slate-800 border-t border-slate-300 text-[10px]">
                            <td className="py-3 px-2">TOTALE SISTEMA</td>
                            <td className="py-3 px-2 font-mono space-y-0.5">
                              <div>Vol: {formatNumber(sysTotals.totalVolume, 1)} m³</div>
                              <div className="text-blue-600">Est: {formatNumber(sysTotals.totalSensibleSummer, 0)} W</div>
                              <div className="text-red-650">Inv: {formatNumber(sysTotals.totalLossesWinter, 0)} W</div>
                            </td>
                            <td className="bg-blue-50/20"></td>
                            <td className="bg-orange-50/20"></td>
                            <td></td>
                            <td className="py-3 px-2 text-right font-mono space-y-0.5">
                              <div className="text-blue-800 font-black text-[11px]">Adottata: {formatNumber(sysTotals.totalMandata, 0)} m³/h</div>
                              <div className="text-slate-600 text-[9px]">Sovrad.: {formatNumber(sysTotals.totalMandataSovr, 0)} m³/h</div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            </div>
            {/* Help Sidebar */}
            <div className="lg:col-span-1 bg-amber-50/60 border border-amber-200/60 rounded-3xl p-5 space-y-4 print:hidden self-start shadow-sm text-xs text-slate-650">
              <h5 className="font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wide text-[10px]">
                💡 Guida: Portate d'Aria
              </h5>
              <div className="space-y-3 leading-relaxed">
                <p>Questa tabella mostra il calcolo delle portate di mandata (G<sub>mandata</sub>) per ciascun locale:</p>
                <ul className="list-disc pl-4 space-y-1.5">
                  <li><strong>Portata Estiva (G<sub>est</sub>)</strong>: Basata sul carico sensibile estivo.</li>
                  <li><strong>Portata Invernale (G<sub>inv</sub>)</strong>: Basata sulle dispersioni invernali.</li>
                  <li><strong>Portata Ricambi (G<sub>ric</sub>)</strong>: Ricambi igienici minimi (Vol × Ricambi).</li>
                  <li><strong>Mandata Adottata</strong>: Valore massimo tra estiva, invernale e ricambi, arrotondato ai 10 m³/h superiori.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Bilancio Pressioni e Trafilamenti */}
        {activeTab === 'leakage' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block">
              {/* Rooms panel */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4 print:hidden">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">Seleziona Locale</h4>
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {rooms.map(r => {
                    const rCalc = roomCalculations.find(c => c.room.id === r.id);
                    const balClass = r.pressure_Pa > 0 
                      ? 'bg-green-50 border-green-200 text-green-800' 
                      : r.pressure_Pa < 0 
                        ? 'bg-red-50 border-red-200 text-red-800' 
                        : 'bg-slate-50 border-slate-200 text-slate-650';

                    return (
                      <div 
                        key={r.id} 
                        onClick={() => setSelectedRoomId(r.id)}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex justify-between items-center ${
                          selectedRoomId === r.id 
                            ? 'border-blue-600 bg-blue-50/30' 
                            : 'border-slate-150 hover:border-blue-300 bg-white'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800">{r.code}</p>
                          <p className="text-[10px] text-slate-450 truncate max-w-[150px]">{r.description}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${balClass}`}>
                          {r.pressure_Pa > 0 ? `+${r.pressure_Pa}` : r.pressure_Pa} Pa
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Doors Config & Flow calculations */}
              {selectedRoom ? (
                <div className="lg:col-span-2 space-y-6 print:w-full">
                  {/* configurator */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1">
                          Configurazione Fessure Porte (Locale: {selectedRoom.code})
                        </h4>
                        <p className="text-[10px] text-slate-400">Inserisci le porte che confinano con altri ambienti per calcolare infiltrazioni d'aria.</p>
                      </div>
                      <button
                        onClick={() => handleAddDoor(selectedRoom.id)}
                        className="px-2 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer print:hidden"
                      >
                        <Plus className="w-3.5 h-3.5" /> Aggiungi Porta
                      </button>
                    </div>

                    <div className="text-[11px]">
                      <table className="w-full text-left border-collapse table-fixed">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-bold">
                            <th className="py-2 w-[35%]">Porta (Descrizione / Tipo)</th>
                            <th className="py-2 w-[30%]">Confine (Locale / Pressione)</th>
                            <th className="py-2 w-[20%]">Diff. (ΔP / Flusso)</th>
                            <th className="py-2 text-right w-[15%]">Portata</th>
                            <th className="py-2 text-right w-10 print:hidden"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRoom.doors.map(door => {
                            const isAdjacentRoom = door.adjacentRoomId && door.adjacentRoomId !== 'esterno';
                            const adjRoom = isAdjacentRoom ? rooms.find(r => r.id === door.adjacentRoomId) : null;
                            const adjPressure = adjRoom ? num(adjRoom.pressure_Pa) : num(door.adjacentPressure_Pa);
                            const dp = num(selectedRoom.pressure_Pa) - adjPressure;
                            
                            const l = door.type === 'singola' ? 5.1 : door.type === 'doppia' ? 5.8 : (num(door.customLength) || 5.1);
                            const s = num(door.customWidth) || 0.002;
                            const alpha = num(door.customAlpha) || 0.85;
                            const flow = Math.ceil(l * s * alpha * 3600 * Math.sqrt(Math.abs(dp)));

                            return (
                              <tr key={door.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                <td className="py-2.5 pr-2">
                                  <input
                                    type="text"
                                    value={door.description}
                                    onChange={e => handleUpdateDoor(selectedRoom.id, door.id, 'description', e.target.value)}
                                    className="w-full p-1 bg-slate-50 border border-slate-150 rounded-lg text-slate-800 text-[10px] mb-1"
                                    placeholder="Descrizione porta"
                                  />
                                  <select
                                    value={door.type}
                                    onChange={e => handleUpdateDoor(selectedRoom.id, door.id, 'type', e.target.value)}
                                    className="w-full p-1 bg-slate-50 border border-slate-150 rounded-lg font-semibold cursor-pointer text-slate-700 text-[10px]"
                                  >
                                    <option value="singola">Singola (0.9x2.1m, fess. 5.1m)</option>
                                    <option value="doppia">Doppia (1.6x2.1m, fess. 5.8m)</option>
                                    <option value="personalizzata">Personalizzata...</option>
                                  </select>
                                </td>
                                <td className="py-2.5 pr-2">
                                  <select
                                    value={door.adjacentRoomId || 'esterno'}
                                    onChange={e => {
                                      const val = e.target.value;
                                      const updates: any = { adjacentRoomId: val };
                                      if (val !== 'esterno') {
                                        const adj = rooms.find(r => r.id === val);
                                        if (adj) {
                                          updates.adjacentPressure_Pa = adj.pressure_Pa;
                                        }
                                      }
                                      handleUpdateDoorFields(selectedRoom.id, door.id, updates);
                                    }}
                                    className="w-full p-1 bg-slate-50 border border-slate-150 rounded-lg font-semibold cursor-pointer text-slate-700 text-[10px] mb-1"
                                  >
                                    <option value="esterno">Esterno / Altro</option>
                                    {rooms.filter(r => r.id !== selectedRoom.id).map(r => (
                                      <option key={r.id} value={r.id}>
                                        {r.code} - {r.description}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[8px] text-slate-400 font-bold uppercase shrink-0">Pres:</span>
                                    <input
                                      type="number"
                                      value={adjPressure}
                                      disabled={isAdjacentRoom}
                                      onChange={e => handleUpdateDoor(selectedRoom.id, door.id, 'adjacentPressure_Pa', e.target.value === '' ? '' : Number(e.target.value))}
                                      className={`w-12 p-0.5 border border-slate-150 rounded font-mono text-center text-[10px] ${isAdjacentRoom ? 'bg-slate-100 text-slate-500' : 'bg-slate-50 text-slate-800'}`}
                                    />
                                    <span className="text-[8px] text-slate-400 font-bold">Pa</span>
                                  </div>
                                </td>
                                <td className="py-2.5 pr-2">
                                  <div className="font-bold font-mono text-slate-700 text-[10px] mb-1">
                                    {dp > 0 ? `+${dp}` : dp} Pa
                                  </div>
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold inline-block ${
                                    dp < 0 
                                      ? 'bg-green-100 text-green-800' 
                                      : dp > 0 
                                        ? 'bg-red-100 text-red-800' 
                                        : 'bg-slate-100 text-slate-655'
                                  }`}>
                                    {dp < 0 ? 'Entra' : dp > 0 ? 'Esce' : 'No'}
                                  </span>
                                </td>
                                <td className="py-2.5 text-right font-black font-mono text-slate-800 text-[10px] pr-1">
                                  {flow} <span className="text-[8px] font-normal text-slate-400 font-sans">m³/h</span>
                                </td>
                                <td className="py-2.5 text-right print:hidden">
                                  <button
                                    onClick={() => handleRemoveDoor(selectedRoom.id, door.id)}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer print:hidden"
                                    title="Rimuovi porta"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {selectedRoom.doors.length === 0 && (
                            <tr>
                              <td colSpan={5} className="text-center py-4 text-slate-450 italic">
                                Nessuna fessura porta configurata per questo locale.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mass balance details */}
                  {(() => {
                    const rCalc = roomCalculations.find(c => c.room.id === selectedRoom.id);
                    if (!rCalc) return null;

                    return (
                      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">
                          Bilancio Aeraulico Totale Locale
                        </h4>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                          <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Mandata (In)</p>
                            <p className="text-lg font-black font-mono text-blue-700">{rCalc.adoptedFlow} <span className="text-xs font-normal">m³/h</span></p>
                          </div>
                          <div className="p-3 bg-green-50/50 rounded-2xl border border-green-150">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Infiltrazioni (In)</p>
                            <p className="text-lg font-black font-mono text-green-700">+{rCalc.infiltrationFlow} <span className="text-xs font-normal">m³/h</span></p>
                          </div>
                          <div className="p-3 bg-red-50/50 rounded-2xl border border-red-150">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Trafilamenti (Out)</p>
                            <p className="text-lg font-black font-mono text-red-750">-{rCalc.exfiltrationFlow} <span className="text-xs font-normal">m³/h</span></p>
                          </div>
                          <div className="p-3 bg-purple-50/50 rounded-2xl border border-purple-100">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Ripresa Calcolata (Out)</p>
                            <p className="text-lg font-black font-mono text-purple-700">{rCalc.adoptedRipresaFlow} <span className="text-xs font-normal">m³/h</span></p>
                          </div>
                        </div>

                        <div className="p-3 bg-amber-50 text-amber-800 rounded-2xl text-[10px] border border-amber-200">
                          <strong>Formula di Bilanciamento applicata:</strong>
                          <div className="font-mono mt-1 text-xs">
                            Ripresa = Mandata ({rCalc.adoptedFlow}) + Infiltrazioni ({rCalc.infiltrationFlow}) - Trafilamenti ({rCalc.exfiltrationFlow}) = {rCalc.rawRipresaFlow} m³/h 
                            (arrotondato a {rCalc.adoptedRipresaFlow} m³/h)
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : null}

              {/* Help Sidebar */}
              <div className="lg:col-span-1 bg-amber-50/60 border border-amber-200/60 rounded-3xl p-5 space-y-4 print:hidden self-start shadow-sm text-xs text-slate-650">
                <h5 className="font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wide text-[10px]">
                  💡 Guida: Trafilamenti
                </h5>
                <div className="space-y-3 leading-relaxed">
                  <p>In questa sezione configuri i trafilamenti d'aria attraverso le porte:</p>
                  <ul className="list-disc pl-4 space-y-1.5">
                    <li><strong>ΔP (Pa)</strong>: Pressione locale - Pressione confine. Se negativo, l'aria entra (Infiltrazione). Se positivo, l'aria esce (Trafilamento).</li>
                    <li><strong>Aria Calcolata (m³/h)</strong>: Portata passante per le fessure (2mm std) basata su perimetro porta e ΔP.</li>
                    <li><strong>Bilancio Ripresa</strong>: G<sub>ripresa</sub> = G<sub>mandata</sub> + Infiltrazioni - Espulsione - Trafilamenti.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Batterie di Post */}
        {activeTab === 'reheat' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block">
            <div className="lg:col-span-3 bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-6 print:w-full">
            <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Calcolo Dimensionamento Batterie di Post-Riscaldamento (RC)
              </h4>
            </div>

            <div className="overflow-x-auto text-[10px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px] bg-slate-50/50">
                    <th className="py-2.5 px-2">Batteria / Locale</th>
                    <th className="py-2.5 px-2 font-mono text-right">Portata Mandata (m³/h)</th>
                    <th className="py-2.5 px-2 text-center">Temp. Monte/Valle (°C)</th>
                    <th className="py-2.5 px-2 font-mono text-right text-blue-700">Potenza Cal/Proj (kW)</th>
                    <th className="py-2.5 px-2 font-mono text-right text-orange-700 font-bold">Portata H2O Min/Proj (l/h)</th>
                    <th className="py-2.5 px-2 text-center">Tubo (DN)</th>
                  </tr>
                </thead>
                <tbody>
                  {roomCalculations.map(c => {
                    const dn = getPipeSizeDN(c.waterFlowDesign_lth);
                    
                    return (
                      <tr key={c.room.id} className="border-b border-slate-100 hover:bg-slate-50/45 text-[10px]">
                        {/* Batteria / Locale */}
                        <td className="py-3 px-2 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] text-slate-400 font-bold uppercase">Zona:</span>
                            <input
                              type="text"
                              value={c.room.reheatZone}
                              onChange={e => handleUpdateRoomField(c.room.id, 'reheatZone', e.target.value)}
                              className="p-1 border border-slate-200 rounded-lg w-20 font-bold font-mono text-center bg-slate-50 text-[10px]"
                            />
                          </div>
                          <div>
                            <span className="font-bold font-mono text-slate-800">{c.room.code}</span>
                            <span className="text-[9px] text-slate-400 ml-1.5 truncate max-w-[120px] inline-block align-middle" title={c.room.description}>
                              ({c.room.description})
                            </span>
                          </div>
                        </td>

                        {/* Portata Mandata (m3/h) */}
                        <td className="py-3 px-2 font-mono text-right text-slate-700 font-semibold">
                          {formatNumber(c.adoptedFlow, 0)}
                        </td>
                        
                        {/* Temp. Monte/Valle (oC) */}
                        <td className="py-2 px-2 text-center space-y-1">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-[8px] text-slate-400 font-bold uppercase">Monte:</span>
                            <input
                              type="number"
                              step="0.1"
                              value={c.room.reheatCoilUpstreamTemp}
                              onChange={e => handleUpdateRoomField(c.room.id, 'reheatCoilUpstreamTemp', e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-16 p-1 text-center rounded-lg border border-slate-200 outline-none font-semibold font-mono text-[10px]"
                            />
                          </div>
                          <div className="text-slate-650 font-bold">
                            Valle: <span className="font-mono">{c.room.supplyTempWinter}°C</span>
                          </div>
                        </td>
                        
                        {/* Potenza Cal/Proj (kW) */}
                        <td className="py-3 px-2 font-mono text-right space-y-0.5">
                          <div className="text-slate-500 text-[9px]">Calcolata: {formatNumber(c.reheatPower_kW, 2)} kW</div>
                          <div className="text-blue-800 font-bold text-[10px]">Progetto: {formatNumber(c.reheatDesignPower_kW, 2)} kW</div>
                        </td>

                        {/* Portata H2O Min/Proj (l/h) */}
                        <td className="py-3 px-2 font-mono text-right space-y-0.5">
                          <div className="text-slate-500 text-[9px]">Min: {formatNumber(c.waterFlowMin_lth, 0)} l/h</div>
                          <div className="text-orange-700 font-bold text-[10px]">Progetto: {formatNumber(c.waterFlowDesign_lth, 0)} l/h</div>
                        </td>

                        {/* Tubo (DN) */}
                        <td className="py-3 px-2 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold font-mono text-[9px] border border-slate-200">
                            {dn}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals reheating */}
                  <tr className="bg-slate-100 font-black text-slate-800 border-t border-slate-350 text-[10px]">
                    <td className="py-3 px-2">TOTALE BATTERIE POST</td>
                    <td className="py-3 px-2 text-right font-mono">
                      {formatNumber(roomCalculations.reduce((sum, c) => sum + c.adoptedFlow, 0), 0)}
                    </td>
                    <td></td>
                    <td className="py-3 px-2 text-right font-mono space-y-0.5">
                      <div className="text-slate-500 text-[9px]">Calcolata: {formatNumber(roomCalculations.reduce((sum, c) => sum + c.reheatPower_kW, 0), 2)} kW</div>
                      <div className="text-blue-800 font-bold text-[10px]">Progetto: {formatNumber(roomCalculations.reduce((sum, c) => sum + c.reheatDesignPower_kW, 0), 2)} kW</div>
                    </td>
                    <td className="py-3 px-2 text-right font-mono space-y-0.5">
                      <div className="text-slate-500 text-[9px]">Min: {formatNumber(roomCalculations.reduce((sum, c) => sum + c.waterFlowMin_lth, 0), 0)} l/h</div>
                      <div className="text-orange-700 font-bold text-[10px]">Progetto: {formatNumber(roomCalculations.reduce((sum, c) => sum + c.waterFlowDesign_lth, 0), 0)} l/h</div>
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-amber-50 text-amber-900 text-[10px] p-3 rounded-2xl border border-amber-250">
              <strong>Equazioni e Note:</strong>
              <ul className="list-disc pl-4 space-y-1 mt-1">
                <li>Potenza Batteria ($kcal/h$) = Portata ($m^3/h$) × (T_valle - T_monte) × 0.3.</li>
                <li>Potenza di Progetto ($kW$) = Potenza Calcolata ($kW$) × (1 + Sovradimensionamento Batterie / 100).</li>
                <li>Portata Acqua ($l/h$) = Potenza di Progetto ($kcal/h$) / ΔT.</li>
              </ul>
            </div>
          </div>
          {/* Help Sidebar */}
            <div className="lg:col-span-1 bg-amber-50/60 border border-amber-200/60 rounded-3xl p-5 space-y-4 print:hidden self-start shadow-sm text-xs text-slate-650">
              <h5 className="font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wide text-[10px]">
                💡 Guida: Batterie di Post
              </h5>
              <div className="space-y-3 leading-relaxed">
                <p>Questa tabella mostra il dimensionamento delle batterie di post-riscaldamento locali per l'inverno:</p>
                <ul className="list-disc pl-4 space-y-1.5">
                  <li><strong>T. Monte Batteria</strong>: Temperatura dell'aria in ingresso.</li>
                  <li><strong>T. Valle Batteria</strong>: Temperatura di immissione invernale desiderata.</li>
                  <li><strong>Potenza di Progetto (kW)</strong>: Potenza termica comprensiva del sovradimensionamento impostato.</li>
                  <li><strong>Portata Acqua (l/h)</strong>: Calcolata sul salto termico dell'acqua (ΔT H₂O).</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Riepilogo Consumi */}
        {activeTab === 'summary' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block">
            <div className="lg:col-span-3 space-y-6 print:w-full">
            
            {/* TABELLA 1: BILANCIO AERAULICO GLOBALE DELLE UTA */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">
                Bilancio Aeraulico Globale UTA (m³/h - Portate di Progetto)
              </h4>
              <div className="overflow-x-auto text-[10px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px] bg-slate-50/50">
                      <th className="py-2.5 px-2">Sistema UTA</th>
                      <th className="py-2.5 px-2 font-mono text-right">Mandata Progetto (m³/h)</th>
                      <th className="py-2.5 px-2 font-mono text-right">Ripresa Progetto (m³/h)</th>
                      <th className="py-2.5 px-2 font-mono text-center">Espulsione in UTA (m³/h)</th>
                      <th className="py-2.5 px-2 font-mono text-right">Aria Esterna (Primaria)</th>
                      <th className="py-2.5 px-2 text-right">Percentuale Rinnovo (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemCalculations.map(s => (
                      <tr key={'ahu-air-' + s.system.id} className="border-b border-slate-100 hover:bg-slate-50/45">
                        <td className="py-2.5 px-2 font-bold font-mono">{s.system.name}</td>
                        <td className="py-2.5 px-2 font-mono text-right font-semibold text-blue-700">{formatNumber(s.mandataProject_m3h, 0)}</td>
                        <td className="py-2.5 px-2 font-mono text-right text-green-700">{formatNumber(s.ripresaProject_m3h, 0)}</td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            value={s.system.ahuExhaustFlow || 0}
                            onChange={e => handleUpdateSystemField(s.system.id, 'ahuExhaustFlow', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-20 p-1 text-center bg-slate-50 border border-slate-200 rounded-lg font-mono text-[10px] outline-none focus:border-blue-500 font-bold text-amber-800"
                          />
                        </td>
                        <td className="py-2.5 px-2 font-mono text-right font-bold text-slate-800">{formatNumber(s.ariaEsternaProject_m3h, 0)}</td>
                        <td className="py-2.5 px-2 font-mono text-right font-bold text-indigo-700">{formatNumber(s.rinnovoPercent, 1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TABELLA 2: DIMENSIONAMENTO IDRAULICO DELLE BATTERIE (RISCALDAMENTO E RAFFREDDAMENTO) */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">
                Dimensionamento Idraulico delle Batterie (UTA & Post-Riscaldo Locali)
              </h4>
              <div className="overflow-x-auto text-[10px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px] bg-slate-50/50">
                      <th className="py-2.5 px-2">Riferimento Batteria</th>
                      <th className="py-2.5 px-2">Tipo</th>
                      <th className="py-2.5 px-2 font-mono text-center">Potenza Progetto (kW)</th>
                      <th className="py-2.5 px-2 font-mono text-right">Portata H2O (l/h)</th>
                      <th className="py-2.5 px-2">Diametro Linea Tubo</th>
                      <th className="py-2.5 px-2">Valvola Regolazione Consigliata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Generazione righe per batterie fredde UTA e batterie calde di post */}
                    {systemCalculations.map(s => {
                      const dnCold = getPipeSizeDN(s.waterFlowCold_lth);
                      const valveCold = getValveKvs(s.waterFlowCold_lth);

                      // Filtriamo i locali di questa UTA per estrarre le relative batterie di post
                      const sysRoomsCalcs = roomCalculations.filter(c => c.room.systemId === s.system.id);

                      return (
                        <React.Fragment key={'ahu-hydro-' + s.system.id}>
                          {/* Riga Batteria Fredda UTA */}
                          <tr className="border-b border-slate-100 hover:bg-slate-50/45 bg-blue-50/10">
                            <td className="py-2.5 px-2 font-bold font-mono text-blue-900">{s.system.name} - Batteria Fredda</td>
                            <td className="py-2.5 px-2 text-blue-600 font-semibold">Raffred. / Deumid.</td>
                            <td className="py-2 px-2 text-center">
                              <input
                                type="number"
                                step="0.5"
                                value={s.system.coolingPower_kW || 0}
                                onChange={e => handleUpdateSystemField(s.system.id, 'coolingPower_kW', e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-16 p-1 text-center bg-slate-50 border border-slate-200 rounded-lg font-mono text-[10px] outline-none focus:border-blue-500 font-bold text-blue-800"
                              />
                            </td>
                            <td className="py-2.5 px-2 font-mono text-right text-blue-800 font-bold">{formatNumber(s.waterFlowCold_lth, 0)}</td>
                            <td className="py-2.5 px-2">
                              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold font-mono text-[9px] border border-blue-200">
                                {dnCold}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 font-semibold text-slate-650">{valveCold}</td>
                          </tr>

                          {/* Righe Batterie Post-Riscaldo Locali associati */}
                          {sysRoomsCalcs.map(c => {
                            if (c.reheatDesignPower_kW <= 0) return null;
                            const dnHot = getPipeSizeDN(c.waterFlowDesign_lth);
                            const valveHot = getValveKvs(c.waterFlowDesign_lth);
                            return (
                              <tr key={'post-' + c.room.id} className="border-b border-slate-100 hover:bg-slate-50/45">
                                <td className="py-2.5 px-2 font-mono pl-6 text-slate-700">└─ {c.room.reheatZone || 'RC-POST'} ({c.room.code})</td>
                                <td className="py-2.5 px-2 text-orange-600 font-semibold">Post-Riscaldo Caldo</td>
                                <td className="py-2.5 px-2 font-mono text-center text-slate-700">{formatNumber(c.reheatDesignPower_kW, 2)}</td>
                                <td className="py-2.5 px-2 font-mono text-right text-orange-850 font-bold">{formatNumber(c.waterFlowDesign_lth, 0)}</td>
                                <td className="py-2.5 px-2">
                                  <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-800 font-bold font-mono text-[9px] border border-orange-200">
                                    {dnHot}
                                  </span>
                                </td>
                                <td className="py-2.5 px-2 font-semibold text-slate-650">{valveHot}</td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SVG Schematic Diagrams per System */}
            {systems.map(sys => {
              const sysRooms = roomCalculations.filter(c => c.room.systemId === sys.id);
              if (sysRooms.length === 0) return null;

              const boxHeight = 80;
              const gapY = 45;
              const stepY = boxHeight + gapY; // 125
              const svgHeight = Math.max(300, sysRooms.length * stepY + 60);

              const y_ahu = (svgHeight - 100) / 2;
              const y_supply_out = y_ahu + 30;
              const y_return_in = y_ahu + 70;

              const y_first_supply = 30 + 25;
              const y_last_supply = 30 + (sysRooms.length - 1) * stepY + 25;
              const y_first_return = 30 + 55;
              const y_last_return = 30 + (sysRooms.length - 1) * stepY + 55;

                            // Collect all unique room-to-room connection pairs for this system
              const adjacentPairs: string[] = [];
              sysRooms.forEach(c1 => {
                c1.room.doors.forEach(door => {
                  if (door.adjacentRoomId && door.adjacentRoomId !== 'esterno') {
                    const r2Calc = sysRooms.find(c2 => c2.room.id === door.adjacentRoomId);
                    if (r2Calc) {
                      const pairKey = c1.room.id < r2Calc.room.id 
                        ? `${c1.room.id}-${r2Calc.room.id}` 
                        : `${r2Calc.room.id}-${c1.room.id}`;
                      if (!adjacentPairs.includes(pairKey)) {
                        adjacentPairs.push(pairKey);
                      }
                    }
                  }
                });
              });

              // Map of connection keys to slot index for each room ID to avoid overlaps
              const roomSlots: { [roomId: string]: string[] } = {};
              sysRooms.forEach(c => {
                roomSlots[c.room.id] = [];
              });
              sysRooms.forEach(c1 => {
                c1.room.doors.forEach((door, doorIdx) => {
                  if (door.adjacentRoomId && door.adjacentRoomId !== 'esterno') {
                    const r2Calc = sysRooms.find(c2 => c2.room.id === door.adjacentRoomId);
                    if (r2Calc) {
                      const idx1 = sysRooms.indexOf(c1);
                      const idx2 = sysRooms.indexOf(r2Calc);
                      const isAdjacent = Math.abs(idx1 - idx2) === 1;

                      if (!isAdjacent) {
                        const doorsToR2 = c1.room.doors.filter(d => d.adjacentRoomId === r2Calc.room.id);
                        const k = doorsToR2.indexOf(door);
                        const connectionKey = c1.room.id < r2Calc.room.id 
                          ? `${c1.room.id}-${r2Calc.room.id}-${k}`
                          : `${r2Calc.room.id}-${c1.room.id}-${k}`;
                        if (!roomSlots[c1.room.id].includes(connectionKey)) {
                          roomSlots[c1.room.id].push(connectionKey);
                        }
                        if (!roomSlots[r2Calc.room.id].includes(connectionKey)) {
                          roomSlots[r2Calc.room.id].push(connectionKey);
                        }
                      }
                    }
                  } else {
                    const exteriorKey = `exterior-${door.id}`;
                    if (!roomSlots[c1.room.id].includes(exteriorKey)) {
                      roomSlots[c1.room.id].push(exteriorKey);
                    }
                  }
                });
              });


              return (
                <div key={`schematic-card-${sys.id}`} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4 print:break-inside-avoid print:shadow-none print:border mb-6">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Schema Funzionale Impianto Aeraulico - {sys.id}
                      </h4>
                      <p className="text-[10px] text-slate-400">Diagramma delle portate (mandata/ripresa) e bilancio pressioni/trafilamenti.</p>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 font-mono text-slate-500 uppercase">
                      Schema Dinamico
                    </span>
                  </div>

                  <div className="overflow-x-auto pt-2 bg-slate-50/30 rounded-2xl border border-slate-100">
                    <svg viewBox={`0 0 920 ${svgHeight}`} className="w-full h-auto max-w-full font-sans select-none">
                      <defs>
                        <marker id="supply-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 2 L 10 5 L 0 8 z" fill="#3b82f6" />
                        </marker>
                        <marker id="return-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 2 L 10 5 L 0 8 z" fill="#10b981" />
                        </marker>
                        <marker id="leak-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 2 L 10 5 L 0 8 z" fill="#d97706" />
                        </marker>
                        <marker id="outside-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 2 L 10 5 L 0 8 z" fill="#64748b" />
                        </marker>
                      </defs>

                      {/* --- Manifold / Duct lines --- */}
                      {/* White shadows first for intersections */}
                      <path d={`M 200,${y_supply_out} H 220 V 15 H 280 V ${y_last_supply}`} fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" />
                      <path d={`M 200,${y_return_in} H 240 V ${svgHeight - 15} H 370 V ${y_first_return}`} fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" />


                      {sysRooms.map((c, idx) => {
                        const y_r = 30 + idx * stepY;
                        return (
                          <React.Fragment key={`white-shadows-${c.room.id}`}>
                            {/* White shadow covers the full line width */}
                            <line x1="280" y1={y_r + 25} x2="480" y2={y_r + 25} stroke="white" strokeWidth="6" />
                            <line x1="480" y1={y_r + 55} x2="370" y2={y_r + 55} stroke="white" strokeWidth="6" />
                          </React.Fragment>
                        );
                      })}

                      {/* Actual duct paths */}
                      {/* Supply Manifold & Main duct (routed UP around rooms to avoid overlaps) */}
                      <path d={`M 200,${y_supply_out} H 220 V 15 H 280 V ${y_last_supply}`} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
                      
                      {/* Return Manifold & Main duct (routed DOWN around rooms to avoid overlaps) */}
                      <path d={`M 200,${y_return_in} H 240 V ${svgHeight - 15} H 370 V ${y_first_return}`} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />

                      {/* Branch ducts */}
                      {sysRooms.map((c, idx) => {
                        const y_r = 30 + idx * stepY;
                        return (
                          <React.Fragment key={`duct-branches-${c.room.id}`}>
                            {/* Supply branch (ends at 475 to leave gap for arrowhead) */}
                            <line x1="280" y1={y_r + 25} x2="475" y2={y_r + 25} stroke="#3b82f6" strokeWidth="2" markerEnd="url(#supply-arrow)" />
                            <text x="295" y={y_r + 20} fill="#2563eb" fontSize="8" fontFamily="monospace" fontWeight="bold">
                              {c.adoptedFlow} m³/h
                            </text>

                            {/* Return branch (ends at 375 to leave gap for arrowhead pointing left) */}
                            <line x1="475" y1={y_r + 55} x2="375" y2={y_r + 55} stroke="#10b981" strokeWidth="2" markerEnd="url(#return-arrow)" />
                            <text x="385" y={y_r + 50} fill="#059669" fontSize="8" fontFamily="monospace" fontWeight="bold">
                              {c.adoptedRipresaFlow} m³/h
                            </text>
                          </React.Fragment>
                        );
                      })}

                      {/* --- Air Handling Unit (UTA) --- */}
                      {/* Outer box */}
                      <rect x="50" y={y_ahu} width="150" height="100" rx="12" ry="12" fill="#eff6ff" stroke="#3b82f6" strokeWidth="2" />
                      
                      {/* Filter symbol */}
                      <path d={`M 85,${y_ahu} L 90,${y_ahu+20} L 85,${y_ahu+40} L 90,${y_ahu+60} L 85,${y_ahu+80} L 90,${y_ahu+100}`} fill="none" stroke="#94a3b8" strokeWidth="1.5" />
                      
                      {/* Coils (Heating & Cooling) */}
                      <path d={`M 110,${y_ahu+20} L 115,${y_ahu+40} L 110,${y_ahu+60} L 115,${y_ahu+80}`} fill="none" stroke="#ef4444" strokeWidth="2" />
                      <path d={`M 130,${y_ahu+20} L 135,${y_ahu+40} L 130,${y_ahu+60} L 135,${y_ahu+80}`} fill="none" stroke="#3b82f6" strokeWidth="2" />
                      
                      {/* Fan */}
                      <circle cx="170" cy={y_ahu + 50} r="18" fill="#e2e8f0" stroke="#475569" strokeWidth="2" />
                      <path d={`M 170,${y_ahu+32} L 170,${y_ahu+68} M 152,${y_ahu+50} L 188,${y_ahu+50} M 157,${y_ahu+37} L 183,${y_ahu+63} M 157,${y_ahu+63} L 183,${y_ahu+37}`} stroke="#475569" strokeWidth="1.5" />
                      
                      {/* Outside Air Intake */}
                      <line x1="15" y1={y_ahu + 30} x2="44" y2={y_ahu + 30} stroke="#475569" strokeWidth="2.5" markerEnd="url(#outside-arrow)" />
                      <text x="29" y={y_ahu + 22} fontSize="8" fill="#475569" textAnchor="middle" fontWeight="bold">Esterno</text>

                      {/* Exhaust Air */}
                      <line x1="50" y1={y_ahu + 70} x2="15" y2={y_ahu + 70} stroke="#64748b" strokeWidth="2" markerEnd="url(#outside-arrow)" />
                      <text x="28" y={y_ahu + 82} fontSize="8" fill="#64748b" textAnchor="middle" fontWeight="bold">Espulsione</text>

                      {/* AHU Labels */}
                      <text x="125" y={y_ahu + 115} fontSize="10" fontWeight="bold" fill="#1e40af" textAnchor="middle">{sys.id}</text>
                      <text x="125" y={y_ahu + 128} fontSize="7" fill="#64748b" textAnchor="middle" fontStyle="italic">{sys.description}</text>

{sysRooms.map((c, idx) => {
                        const y_r = 30 + idx * stepY;
                        
                        let bgColor = "#f8fafc";
                        let strokeColor = "#cbd5e1";
                        let textColor = "#475569";
                        let barColor = "#94a3b8";
                        let pressureLabel = `${c.room.pressure_Pa} Pa`;

                        if (c.room.pressure_Pa > 0) {
                          bgColor = "#f0fdf4";
                          strokeColor = "#22c55e";
                          textColor = "#15803d";
                          barColor = "#22c55e";
                          pressureLabel = `+${c.room.pressure_Pa} Pa`;
                        } else if (c.room.pressure_Pa < 0) {
                          bgColor = "#fef2f2";
                          strokeColor = "#ef4444";
                          textColor = "#b91c1c";
                          barColor = "#ef4444";
                        }

                        const hasExhaust = num(c.room.exhaustFlow) > 0;

                        return (
                          <g key={`room-box-render-${c.room.id}`}>
                            {/* Outer box */}
                            <rect x="480" y={y_r} width="180" height="80" rx="10" ry="10" fill={bgColor} stroke={strokeColor} strokeWidth="1.5" />
                            
                            {/* Left indicator bar */}
                            <rect x="480" y={y_r} width="5" height="80" rx="2" ry="2" fill={barColor} />
                            
                            {/* Text labels */}
                            <text x="495" y={y_r + 22} fontSize="11" fontWeight="bold" fill="#1e293b">{c.room.code}</text>
                            <text x="495" y={y_r + 42} fontSize="10" fontWeight="bold" fill={textColor}>{pressureLabel}</text>
                            <text x="495" y={y_r + 62} fontSize="8" fill="#64748b">
                              {c.room.area} m² | {c.volume} m³ | {c.room.gmpClass}
                            </text>

                            {/* Local Exhaust Arrow (on the right side) if exhaustFlow > 0 */}
                            {hasExhaust && (
                              <g key={`local-exhaust-${c.room.id}`}>
                                <line 
                                  x1="660" 
                                  y1={y_r + 40} 
                                  x2="705" 
                                  y2={y_r + 40} 
                                  stroke="#ef4444" 
                                  strokeWidth="1.5" 
                                  markerEnd="url(#outside-arrow)" 
                                />
                                <text 
                                  x="682.5" 
                                  y={y_r + 34} 
                                  fill="#b91c1c" 
                                  fontSize="7.5" 
                                  fontWeight="bold" 
                                  textAnchor="middle"
                                >
                                  {c.room.exhaustFlow} m³/h
                                </text>
                                <text 
                                  x="712" 
                                  y={y_r + 43} 
                                  fill="#ef4444" 
                                  fontSize="6.5" 
                                  fontWeight="bold" 
                                  textAnchor="start"
                                >
                                  Estrazione
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      })}

                      {/* --- Door Leakages / Trafilamenti --- */}
                      {sysRooms.map((c1, idx1) => {
                        const y_r1 = 30 + idx1 * stepY;

                        return c1.room.doors.map((door, doorIdx) => {
                          const r2Calc = door.adjacentRoomId && door.adjacentRoomId !== 'esterno'
                            ? sysRooms.find(c2 => c2.room.id === door.adjacentRoomId)
                            : null;

                          // Calculate flow rate
                          const l = door.type === 'singola' ? 5.1 : door.type === 'doppia' ? 5.8 : (num(door.customLength) || 5.1);
                          const s = num(door.customWidth) || 0.002;
                          const alpha = num(door.customAlpha) || 0.85;
                          const adjPressure = r2Calc ? num(r2Calc.room.pressure_Pa) : num(door.adjacentPressure_Pa);
                          const dp = num(c1.room.pressure_Pa) - adjPressure;
                          const flow = Math.ceil(l * s * alpha * 3600 * Math.sqrt(Math.abs(dp)));

                                                                              if (r2Calc) {
                            // Only draw once to avoid duplicates (enforced by id comparison)
                            const hasMutualDoor = r2Calc.room.doors.some(d => d.adjacentRoomId === c1.room.id);
                            if (hasMutualDoor && c1.room.id >= r2Calc.room.id) return null;

                            const idx2 = sysRooms.indexOf(r2Calc);
                            const y_r2 = 30 + idx2 * stepY;

                            const dp_actual = num(c1.room.pressure_Pa) - num(r2Calc.room.pressure_Pa);

                            // Find all doors in c1 pointing to r2Calc, and find current index
                            const doorsToR2 = c1.room.doors.filter(d => d.adjacentRoomId === r2Calc.room.id);
                            const k = doorsToR2.indexOf(door);

                            const isAdjacent = Math.abs(idx1 - idx2) === 1;

                            if (isAdjacent) {
                              const upperIdx = Math.min(idx1, idx2);
                              const lowerIdx = Math.max(idx1, idx2);
                              const y_upper_bottom = 30 + upperIdx * stepY + 80;
                              const y_lower_top = 30 + lowerIdx * stepY;

                              const isC1Upper = idx1 < idx2;
                              let flowsDown = false;
                              if (dp_actual > 0) {
                                flowsDown = isC1Upper;
                              } else if (dp_actual < 0) {
                                flowsDown = !isC1Upper;
                              }

                              let y1_line = y_upper_bottom;
                              let y2_line = y_lower_top;
                              let markerStartStyle = "";
                              let markerEndStyle = "";

                              if (dp_actual === 0) {
                                y1_line = y_upper_bottom + 4;
                                y2_line = y_lower_top - 4;
                                markerStartStyle = "url(#leak-arrow)";
                                markerEndStyle = "url(#leak-arrow)";
                              } else if (flowsDown) {
                                y1_line = y_upper_bottom;
                                y2_line = y_lower_top - 4;
                                markerEndStyle = "url(#leak-arrow)";
                              } else {
                                y1_line = y_lower_top;
                                y2_line = y_upper_bottom + 4;
                                markerEndStyle = "url(#leak-arrow)";
                              }

                              // Center of the room boxes (x from 480 to 660, center is 570)
                              // Offset slightly horizontally if there are multiple doors between these consecutive rooms
                              const x_line = 570 + (k * 20 - (doorsToR2.length - 1) * 10);
                              const y_text = (y_upper_bottom + y_lower_top) / 2;

                              return (
                                <g key={`adjacent-leak-${c1.room.id}-${door.id}`}>
                                  <line 
                                    x1={x_line} 
                                    y1={y1_line} 
                                    x2={x_line} 
                                    y2={y2_line} 
                                    stroke="#d97706" 
                                    strokeWidth="1.5" 
                                    strokeDasharray="3,3" 
                                    markerStart={markerStartStyle}
                                    markerEnd={markerEndStyle} 
                                  />
                                  {/* White mask behind the text to clear space */}
                                  <rect 
                                    x={x_line - 22} 
                                    y={y_text - 5} 
                                    width="44" 
                                    height="10" 
                                    fill="white" 
                                    opacity="0.9" 
                                    rx="2" 
                                  />
                                  <text 
                                    x={x_line} 
                                    y={y_text + 2} 
                                    fill="#b45309" 
                                    fontSize="7.5" 
                                    fontFamily="monospace" 
                                    fontWeight="bold"
                                    textAnchor="middle"
                                  >
                                    {flow} m³/h
                                  </text>
                                </g>
                              );
                            } else {
                              // Non-adjacent room: loop on the right
                              const minIdx = Math.min(idx1, idx2);
                              const maxIdx = Math.max(idx1, idx2);
                              
                              // Build the list of all mathematically possible unique pairs in sysRooms
                              const uniquePairs: string[] = [];
                              for (let i = 0; i < sysRooms.length; i++) {
                                for (let j = i + 1; j < sysRooms.length; j++) {
                                  uniquePairs.push(`${i}-${j}`);
                                }
                              }
                              const pairKey = `${minIdx}-${maxIdx}`;
                              const pairIdx = uniquePairs.indexOf(pairKey);

                              // Connection keys for unique vertical slot mapping
                              const connectionKey = c1.room.id < r2Calc.room.id 
                                ? `${c1.room.id}-${r2Calc.room.id}-${k}`
                                : `${r2Calc.room.id}-${c1.room.id}-${k}`;

                              const slot1 = roomSlots[c1.room.id].indexOf(connectionKey);
                              const slot2 = roomSlots[r2Calc.room.id].indexOf(connectionKey);

                              const totalSlots1 = roomSlots[c1.room.id].length;
                              const totalSlots2 = roomSlots[r2Calc.room.id].length;
                              const spacing1 = totalSlots1 > 4 ? 8 : 12;
                              const spacing2 = totalSlots2 > 4 ? 8 : 12;

                              const y_conn1 = y_r1 + 20 + (slot1 !== -1 ? slot1 : doorIdx) * spacing1;
                              const y_conn2 = y_r2 + 20 + (slot2 !== -1 ? slot2 : 0) * spacing2;

                              // Determine flow direction (from high pressure to low pressure)
                              let y_from = y_conn1;
                              let y_to = y_conn2;
                              if (dp_actual < 0) {
                                y_from = y_conn2;
                                y_to = y_conn1;
                              }

                              // Offset to avoid line overlaps (based on unique room pairs and door indices, shifted right to x=770+)
                              const x_offset = 770 + (pairIdx !== -1 ? pairIdx * 20 : 0) + k * 8;

                              const d_path = `M 660,${y_from} H ${x_offset} V ${y_to} H 665`;

                              const isBidirectional = dp_actual === 0;

                              // Offset text position vertically based on doorIdx to avoid vertical collisions
                              const midY = (y_from + y_to) / 2;
                              const textY = midY + (k * 14 - (doorsToR2.length - 1) * 7);

                              return (
                                <g key={`adjacent-leak-${c1.room.id}-${door.id}`}>
                                  <path 
                                    d={d_path} 
                                    fill="none" 
                                    stroke="#d97706" 
                                    strokeWidth="1.5" 
                                    strokeDasharray="3,3" 
                                    markerStart={isBidirectional ? "url(#leak-arrow)" : ""}
                                    markerEnd="url(#leak-arrow)" 
                                  />
                                  {/* White mask behind the text to clear space and avoid line collisions */}
                                  <rect 
                                    x={x_offset - 22} 
                                    y={textY - 6} 
                                    width="44" 
                                    height="10" 
                                    fill="white" 
                                    opacity="0.9" 
                                    rx="2" 
                                  />
                                  <text 
                                    x={x_offset} 
                                    y={textY + 2} 
                                    fill="#b45309" 
                                    fontSize="7.5" 
                                    fontFamily="monospace" 
                                    fontWeight="bold"
                                    textAnchor="middle"
                                  >
                                    {flow} m³/h
                                  </text>
                                </g>
                              );
                            }
                          } else {
                            // Leakage to exterior/unmodeled zone
                            const exteriorKey = `exterior-${door.id}`;
                            const slot = roomSlots[c1.room.id].indexOf(exteriorKey);
                            const totalSlots = roomSlots[c1.room.id].length;
                            const spacing = totalSlots > 4 ? 8 : 12;
                            const y_line = y_r1 + 20 + (slot !== -1 ? slot : doorIdx) * spacing;

                            let x1 = 660;
                            let x2 = 710;
                            if (dp < 0) {
                              // Infiltration (flows in): starts at 710, goes to 665 (gap for arrowhead)
                              x1 = 710;
                              x2 = 665;
                            }

                            return (
                              <g key={`exterior-leak-${c1.room.id}-${door.id}`}>
                                <line x1={x1} y1={y_line} x2={x2} y2={y_line} stroke="#64748b" strokeWidth="1.2" strokeDasharray="3,3" markerEnd="url(#outside-arrow)" />
                                {/* White mask behind the text to avoid line collisions */}
                                <rect 
                                  x={670} 
                                  y={y_line - 9} 
                                  width="30" 
                                  height="8" 
                                  fill="white" 
                                  opacity="0.9" 
                                  rx="1" 
                                />
                                <text x="685" y={y_line - 3} fill="#475569" fontSize="7.5" textAnchor="middle" fontFamily="monospace">
                                  {flow} m³/h
                                </text>
                                <text x="715" y={y_line + 3} fill="#94a3b8" fontSize="7" textAnchor="start">
                                  {door.description.length > 10 ? door.description.slice(0, 10) + '..' : door.description}
                                </text>
                              </g>
                            );
                          }

                        });
                      })}
                    </svg>
                  </div>
                </div>
              );
            })}

            {/* Dettaglio Singolo Locale Summary Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">
                Dettaglio Calcoli e Dimensionamento per Singolo Locale
              </h4>
              <div className="overflow-x-auto text-[10px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px] bg-slate-50/50">
                      <th className="py-2.5 px-2">Cod. Locale</th>
                      <th className="py-2.5 px-2">Descrizione</th>
                      <th className="py-2.5 px-2">Sistema</th>
                      <th className="py-2.5 px-2 font-mono text-right">Vol (m³)</th>
                      <th className="py-2.5 px-2 text-center">Ricambi (1/h)</th>
                      <th className="py-2.5 px-2 font-mono text-right">Mandata (m³/h)</th>
                      <th className="py-2.5 px-2 font-mono text-right">Infilt. / Traf. (m³/h)</th>
                      <th className="py-2.5 px-2 font-mono text-right">Ripresa (m³/h)</th>
                      <th className="py-2.5 px-2 text-center">Pressione (Pa)</th>
                      <th className="py-2.5 px-2 font-mono text-right text-blue-800">Post (kW)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomCalculations.map(c => {
                      const netLeakage = c.infiltrationFlow - c.exfiltrationFlow;
                      const leakageText = netLeakage > 0 
                        ? `+${netLeakage}` 
                        : netLeakage < 0 
                          ? `${netLeakage}` 
                          : '0';
                      return (
                        <tr key={c.room.id} className="border-b border-slate-100 hover:bg-slate-50/45">
                          <td className="py-2.5 px-2 font-bold font-mono">{c.room.code}</td>
                          <td className="py-2.5 px-2 text-slate-600">{c.room.description || '-'}</td>
                          <td className="py-2.5 px-2 font-mono text-slate-500">{c.room.systemId}</td>
                          <td className="py-2.5 px-2 font-mono text-right">{formatNumber(c.volume, 1)}</td>
                          <td className="py-2.5 px-2 text-center font-mono">{c.room.ricambiApp}</td>
                          <td className="py-2.5 px-2 font-mono text-right">{formatNumber(c.adoptedFlow, 0)}</td>
                          <td className="py-2.5 px-2 font-mono text-right">
                            <span className={netLeakage > 0 ? 'text-orange-600' : netLeakage < 0 ? 'text-blue-600' : ''}>
                              {leakageText}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 font-mono text-right">{formatNumber(c.adoptedRipresaFlow, 0)}</td>
                          <td className="py-2.5 px-2 text-center font-mono">
                            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${c.room.pressure_Pa > 0 ? 'bg-blue-50 text-blue-700' : c.room.pressure_Pa < 0 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-500'}`}>
                              {c.room.pressure_Pa > 0 ? '+' : ''}{c.room.pressure_Pa} Pa
                            </span>
                          </td>
                          <td className="py-2.5 px-2 font-mono text-right text-blue-800 font-bold">{formatNumber(c.reheatDesignPower_kW, 2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            </div>{/* end lg:col-span-3 */}

            {/* Right column: System-level summary */}
            <div className="space-y-4">
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">
                  Riepilogo per Sistema UTA
                </h4>
                {systems.map(sys => {
                  const sc = systemCalculations.find(s => s.system.id === sys.id);
                  if (!sc) return null;
                  return (
                    <div key={sys.id} className="border border-slate-100 rounded-2xl p-3 bg-slate-50/50 space-y-2 text-xs">
                      <div className="font-black text-slate-800 font-mono text-[11px]">{sys.id}</div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-500">Portata Mandata</span>
                        <span className="font-mono font-bold">{formatNumber(sc.totalMandataSovr, 0)} m³/h</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-500">Portata Ripresa</span>
                        <span className="font-mono font-bold">{formatNumber(sc.totalRipresaSovr, 0)} m³/h</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-500">Potenza Post-Riscaldo</span>
                        <span className="font-mono font-bold text-blue-700">{formatNumber(sc.totalReheatDesignPower_kW, 2)} kW</span>
                      </div>
                    </div>
                  );
                })}
                {systems.length === 0 && (
                  <p className="text-xs text-slate-400 italic text-center py-4">Nessun sistema configurato.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>{/* end Main Tab Content */}
      </div>{/* end max-w-7xl */}

      {/* ====== Modal: Aggiungi Sistema ====== */}
      {showAddSystemModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowAddSystemModal(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md mx-4 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Plus className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-black text-slate-800">Aggiungi Nuovo Sistema UTA</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Codice Sistema <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSystemCode}
                  onChange={e => setNewSystemCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmAddSystem()}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono text-sm"
                  placeholder="es. UTA-01"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Descrizione
                </label>
                <input
                  type="text"
                  value={newSystemDesc}
                  onChange={e => setNewSystemDesc(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmAddSystem()}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 text-sm"
                  placeholder="es. Unità trattamento aria piano 1"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddSystemModal(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confirmAddSystem}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Aggiungi Sistema
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== Modal: Aggiungi Locale ====== */}
      {showAddRoomModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowAddRoomModal(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md mx-4 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Plus className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-black text-slate-800">
                Aggiungi Locale a{' '}
                <span className="font-mono text-blue-600">{addRoomSystemId}</span>
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Codice Locale <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newRoomCode}
                  onChange={e => setNewRoomCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmAddRoom()}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono text-sm"
                  placeholder="es. LOC-101"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Descrizione
                </label>
                <input
                  type="text"
                  value={newRoomDesc}
                  onChange={e => setNewRoomDesc(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmAddRoom()}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 text-sm"
                  placeholder="es. Laboratorio Analisi"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddRoomModal(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confirmAddRoom}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Aggiungi Locale
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
