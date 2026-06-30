import React, { useState, useMemo, useEffect } from 'react';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import { formatNumber } from '../utils/format';
import { CLIMATE_DATA } from '../data/climateData';
import { 
  IconWind, 
  IconTrash, 
  IconPlus, 
  IconCopy 
} from '../components/Icons';
import { Shield, Settings, Activity, Layers, Thermometer, Droplet, Plus, Trash2, ArrowRightLeft, FileSpreadsheet, Eye, ChevronRight } from 'lucide-react';

const getPresDec = (v: any): number => {
  const numV = Number(v) || 0;
  return numV % 1 === 0 ? 0 : (numV * 10) % 1 === 0 ? 1 : 2;
};

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

export interface PeopleActivityData {
  name: string;
  loads: {
    24: { lat: number; sens: number };
    26: { lat: number; sens: number };
    27: { lat: number; sens: number };
    28: { lat: number; sens: number };
  };
}

export const peopleActivities: PeopleActivityData[] = [
  {
    name: "Impiegato d'ufficio in attività moderata",
    loads: {
      24: { lat: 60, sens: 70 },
      26: { lat: 70, sens: 60 },
      27: { lat: 80, sens: 60 },
      28: { lat: 80, sens: 50 }
    }
  },
  {
    name: "Lavoro leggero al banco",
    loads: {
      24: { lat: 130, sens: 90 },
      26: { lat: 150, sens: 70 },
      27: { lat: 160, sens: 60 },
      28: { lat: 160, sens: 60 }
    }
  },
  {
    name: "Lavoro sedentario",
    loads: {
      24: { lat: 80, sens: 80 },
      26: { lat: 90, sens: 70 },
      27: { lat: 100, sens: 60 },
      28: { lat: 100, sens: 60 }
    }
  },
  {
    name: "Seduto a riposo",
    loads: {
      24: { lat: 30, sens: 70 },
      26: { lat: 40, sens: 60 },
      27: { lat: 50, sens: 60 },
      28: { lat: 50, sens: 50 }
    }
  },
  {
    name: "Seduto, lavoro molto leggero",
    loads: {
      24: { lat: 50, sens: 70 },
      26: { lat: 50, sens: 60 },
      27: { lat: 60, sens: 60 },
      28: { lat: 60, sens: 50 }
    }
  }
];

export function getPeopleLoads(activityName: string, tempSummer: number, defaultSens: number, defaultLat: number): { sens: number; lat: number } {
  if (!activityName || activityName === 'Personalizzato') {
    return { sens: defaultSens, lat: defaultLat };
  }

  const act = peopleActivities.find(a => a.name === activityName);
  if (!act) {
    return { sens: defaultSens, lat: defaultLat };
  }

  const T_int = Math.round(tempSummer);
  
  if (T_int <= 24) {
    return { sens: act.loads[24].sens, lat: act.loads[24].lat };
  }
  if (T_int >= 28) {
    return { sens: act.loads[28].sens, lat: act.loads[28].lat };
  }
  if (T_int === 26) {
    return { sens: act.loads[26].sens, lat: act.loads[26].lat };
  }
  if (T_int === 27) {
    return { sens: act.loads[27].sens, lat: act.loads[27].lat };
  }
  
  // T_int === 25 (interpolazione lineare tra 24 e 26)
  const sens24 = act.loads[24].sens;
  const sens26 = act.loads[26].sens;
  const lat24 = act.loads[24].lat;
  const lat26 = act.loads[26].lat;
  
  return {
    sens: (sens24 + sens26) / 2,
    lat: (lat24 + lat26) / 2
  };
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
  peopleActivity?: string;
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
  adoptedFlow?: number | '';      // Portata di mandata adottata manualmente (m³/h)
  ceilingTightness?: number;      // Tenuta controsoffitto (m³/(h·m²·Pa)), default 0.5
  ceilingPressure_Pa?: number;    // Pressione controsoffitto (Pa), default 0
}

export interface HVACSystem {
  id: string;
  name: string;
  description: string;
  coolingPower_kW?: number; // Potenza batteria fredda UTA (kW)
  ahuExhaustFlow?: number;  // Aria espulsa direttamente in UTA (m³/h)
  overdesignPercent?: number; // default 20%
  freshAirPercent?: number;   // default 15%
}

export interface HVACReheatBattery {
  id: string;                  // ID univoco
  name: string;                // Riferimento batteria (es. "RC-01")
  roomIds: string[];           // IDs dei locali assegnati a questa batteria
  upstreamTempWinter: number;  // T monte inverno (°C, default 18.2)
  upstreamTempSummer: number;  // T monte estate (°C, default 13.0)
  deltaT?: number | '';        // Delta T specifico per portata acqua
  customPipeSize?: string;     // Diametro linea tubo personalizzato (override)
  customValveKvs?: string;     // Valvola consigliata personalizzata (override)
}

export interface HVACManualBattery {
  id: string;
  name: string;
  type: 'calda' | 'fredda' | 'umidificazione';
  power_kW: number | '';
  flowRate: number | '';
  flowUnit: 'l/h' | 'kg/h';
  deltaT: number | '';
  customPipeSize?: string;     // Diametro linea tubo personalizzato (override)
  customValveKvs?: string;     // Valvola consigliata personalizzata (override)
}

export interface HVACSelection {
  hvac: boolean;
  hvacSubtype: 'tutta_aria' | 'ricircolo';
  fancoils: boolean;
  recovery: boolean;
}

const PIPE_DN_OPTIONS = ['DN15', 'DN20', 'DN25', 'DN32', 'DN40', 'DN50', 'DN65', 'DN80', 'DN100', 'DN125'];

const VALVE_KVS_OPTIONS = [
  'DN15, kvs 0.63',
  'DN15, kvs 1.0',
  'DN15, kvs 1.6',
  'DN20, kvs 4.0',
  'DN25, kvs 6.3',
  'DN32, kvs 10.0',
  'DN40, kvs 25.0',
  'DN50, kvs 40.0'
];

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
  
  // Scelta Impianti selezionati
  const [selectedOptions, setSelectedOptions] = useState<HVACSelection>({
    hvac: true, // true per default per retrocompatibilità
    hvacSubtype: 'tutta_aria',
    fancoils: false,
    recovery: false
  });

  // Tabs: config (Configurazione), criteria (Locali & Criteri), flows (Portate Aria), leakage (Trafilamenti), hvacFlowSummary (Riepilogo Portate HVAC), freshAirCheck (Check Aria Rinnovo), reheat (Batterie di Post), summary (Consumi & Diametri), fancoils (Fancoil/Split), recovery (Recuperatori)
  const [activeTab, setActiveTab] = useState<'config' | 'criteria' | 'flows' | 'leakage' | 'hvacFlowSummary' | 'freshAirCheck' | 'reheat' | 'summary' | 'fancoils' | 'recovery'>('config');

  // Nuovi stati per Check Aria di Rinnovo (EN 16798-1)
  const [expectationLevel, setExpectationLevel] = useState<'alto' | 'medio' | 'moderato' | 'basso'>('medio');
  const [pollutionCategory, setPollutionCategory] = useState<'very_low' | 'low' | 'non_low'>('low');

  // Stato per le batterie di post-riscaldo (Tab 6)
  const [reheatBatteries, setReheatBatteries] = useState<HVACReheatBattery[]>([]);
  const [manualBatteries, setManualBatteries] = useState<HVACManualBattery[]>([]);
  
  // Settings/global parameters
  const [overdesignFactor, setOverdesignFactor] = useState<number | ''>(20); // % overdesign for airflows
  const [reheatOverdesignFactor, setReheatOverdesignFactor] = useState<number | ''>(20); // % overdesign for reheaters
  const [waterDeltaT, setWaterDeltaT] = useState<number | ''>(10); // °C delta T hot water
  const [defaultLighting_W_m2, setDefaultLighting_W_m2] = useState<number | ''>(20);
  
  // Condizioni esterne e località geografica
  const [location, setLocation] = useState<string>('Roma');
  const [extTempSummer, setExtTempSummer] = useState<number | ''>(34);
  const [extRhSummer, setExtRhSummer] = useState<number | ''>(45);
  const [extTempWinter, setExtTempWinter] = useState<number | ''>(0);
  const [extRhWinter, setExtRhWinter] = useState<number | ''>(85);
  
  // Project-specific systems and rooms
  const [systems, setSystems] = useState<HVACSystem[]>(DEFAULT_SYSTEMS);
  const [rooms, setRooms] = useState<HVACRoom[]>(DEFAULT_ROOMS);

  // Sincronizza il tab attivo quando le opzioni selezionate cambiano
  useEffect(() => {
    if (activeTab === 'criteria' || activeTab === 'flows' || activeTab === 'leakage' || activeTab === 'reheat' || activeTab === 'summary') {
      if (!selectedOptions.hvac) {
        setActiveTab('config');
      }
    } else if (activeTab === 'fancoils') {
      if (!selectedOptions.fancoils) {
        setActiveTab('config');
      }
    } else if (activeTab === 'recovery') {
      if (!selectedOptions.recovery) {
        setActiveTab('config');
      }
    }
  }, [selectedOptions, activeTab]);

  const handleToggleOption = (option: 'hvac' | 'fancoils' | 'recovery') => {
    setSelectedOptions(prev => {
      const next = { ...prev };
      if (option === 'hvac') {
        next.hvac = !prev.hvac;
        if (next.hvac) {
          next.fancoils = false;
          next.recovery = false;
        }
      } else if (option === 'fancoils') {
        next.fancoils = !prev.fancoils;
        if (next.fancoils) {
          next.hvac = false;
        }
      } else if (option === 'recovery') {
        next.recovery = !prev.recovery;
        if (next.recovery) {
          next.hvac = false;
        }
      }
      return next;
    });
  };
  
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
      const activity = room.peopleActivity || 'Personalizzato';
      const loads = getPeopleLoads(activity, num(room.tempSummer), num(room.peopleSensible_W), num(room.peopleLatent_W));
      const peopleSensible = num(room.peopleCount) * loads.sens;
      const peopleLatent = num(room.peopleCount) * loads.lat;
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
      const defaultAdopted = Math.ceil(calculatedFlow / 10) * 10;
      const adoptedFlow = (room.adoptedFlow !== undefined && room.adoptedFlow !== null && room.adoptedFlow !== '')
        ? num(room.adoptedFlow)
        : defaultAdopted;
      const overdesignFlow = Math.ceil((adoptedFlow * (1 + num(overdesignFactor) / 100)) / 10) * 10;

      let infiltrationFlow = 0;
      let exfiltrationFlow = 0;
      room.doors.forEach(door => {
        const l = door.type === 'singola' ? 5.1 : door.type === 'doppia' ? 5.8 : (num(door.customLength) || 5.1);
        const s = (door.type === 'singola' || door.type === 'doppia') ? 0.002 : (num(door.customWidth) || 2) * 0.001;
        const alpha = num(door.customAlpha) || 0.85;
        
        let adjP = num(door.adjacentPressure_Pa);
        if (door.adjacentRoomId && door.adjacentRoomId !== 'esterno' && door.adjacentRoomId !== 'altro') {
          const adjRoom = rooms.find(r => r.id === door.adjacentRoomId);
          if (adjRoom) adjP = num(adjRoom.pressure_Pa);
        } else if (door.adjacentRoomId === 'esterno') {
          adjP = 0;
        }
        const dp = num(room.pressure_Pa) - adjP;
        const flow = Math.ceil(l * s * alpha * 3600 * Math.sqrt(Math.abs(dp)));
        
        if (dp < 0) {
          infiltrationFlow += flow;
        } else {
          exfiltrationFlow += flow;
        }
      });

      // Calcolo trafilamento controsoffitto
      const ceilingDp = num(room.pressure_Pa) - num(room.ceilingPressure_Pa || 0);
      const ceilingRawFlow = num(room.ceilingTightness ?? 0.5) * ceilingDp * num(room.area);
      let ceilingFlow = 0;
      if (ceilingRawFlow !== 0) {
        const sign = Math.sign(ceilingRawFlow);
        ceilingFlow = Math.round(Math.abs(ceilingRawFlow) / 10) * 10 * sign;
      }

      if (ceilingFlow < 0) {
        infiltrationFlow += Math.abs(ceilingFlow);
      } else {
        exfiltrationFlow += ceilingFlow;
      }

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

  // 1. Calcoli specifici per le batterie di post-riscaldo (Tab 6)
  const batteryCalculations = useMemo(() => {
    return reheatBatteries.map(b => {
      // Trova i locali assegnati a questa batteria
      const assignedRooms = rooms.filter(r => b.roomIds.includes(r.id));
      const sysCalcs = roomCalculations.filter(c => b.roomIds.includes(c.room.id));
      
      // Estrae le temperature uniche di valle per inverno ed estate
      const uniqueValleWinter = Array.from(new Set(assignedRooms.map(r => num(r.supplyTempWinter))));
      const uniqueValleSummer = Array.from(new Set(assignedRooms.map(r => num(r.supplyTempSummer))));
      
      // Estrae i sistemi unici a cui appartengono i locali
      const uniqueSystems = Array.from(new Set(assignedRooms.map(r => r.systemId)));
      
      const hasValleWinterConflict = uniqueValleWinter.length > 1;
      const hasValleSummerConflict = uniqueValleSummer.length > 1;
      const hasSystemConflict = uniqueSystems.length > 1;
      const hasConflict = hasValleWinterConflict || hasValleSummerConflict || hasSystemConflict;
      
      const tValleWinter = uniqueValleWinter.length > 0 ? uniqueValleWinter[0] : 0;
      const tValleSummer = uniqueValleSummer.length > 0 ? uniqueValleSummer[0] : 0;
      
      // Calcola la portata d'aria totale di mandata (somma dei locali)
      const totalFlow = sysCalcs.reduce((sum, c) => {
        const adopted = (c.room.adoptedFlow !== undefined && c.room.adoptedFlow !== null && c.room.adoptedFlow !== '')
          ? num(c.room.adoptedFlow)
          : Math.ceil(c.calculatedFlow / 10) * 10;
        return sum + adopted;
      }, 0);
      
      // Ricava il sovradimensionamento del sistema associato (prende la prima stanza)
      let S_sys = 20;
      if (assignedRooms.length > 0) {
        const firstRoomSystemId = assignedRooms[0].systemId;
        const system = systems.find(s => s.id === firstRoomSystemId);
        if (system) {
          S_sys = system.overdesignPercent !== undefined ? num(system.overdesignPercent) : 20;
        }
      }
      
      // Potenza Invernale
      let kcal_w = 0;
      if (tValleWinter > num(b.upstreamTempWinter)) {
        kcal_w = totalFlow * (tValleWinter - num(b.upstreamTempWinter)) * 0.3;
      }
      const kW_w = kcal_w * 0.001163;
      const designKcal_w = Math.round((kcal_w * (1 + S_sys / 100)) / 50) * 50;
      const designKW_w = designKcal_w * 0.001163;
      
      // Potenza Estiva
      let kcal_s = 0;
      if (tValleSummer > num(b.upstreamTempSummer)) {
        kcal_s = totalFlow * (tValleSummer - num(b.upstreamTempSummer)) * 0.3;
      }
      const kW_s = kcal_s * 0.001163;
      const designKcal_s = Math.round((kcal_s * (1 + S_sys / 100)) / 50) * 50;
      const designKW_s = designKcal_s * 0.001163;
      
      // Potenza Finale (il picco massimo tra inverno ed estate)
      const finalDesignKW = Math.max(designKW_w, designKW_s);
      const finalDesignKcal = Math.max(designKcal_w, designKcal_s);
      
      return {
        battery: b,
        assignedRooms,
        sysCalcs,
        tValleWinter,
        tValleSummer,
        totalFlow,
        S_sys,
        hasValleWinterConflict,
        hasValleSummerConflict,
        hasSystemConflict,
        hasConflict,
        kcal_w,
        kW_w,
        designKcal_w,
        designKW_w,
        kcal_s,
        kW_s,
        designKcal_s,
        designKW_s,
        finalDesignKW,
        finalDesignKcal,
        systemId: assignedRooms.length > 0 ? assignedRooms[0].systemId : null
      };
    });
  }, [reheatBatteries, rooms, roomCalculations, systems]);

  // 2. Aggregated values per System
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

      // Trova le batterie di questo sistema
      const sysBatteries = batteryCalculations.filter(b => b.systemId === sys.id);
      
      const totalReheatPower_kW = sysBatteries.reduce((sum, b) => sum + b.kW_w, 0);
      const totalReheatDesignPower_kW = sysBatteries.reduce((sum, b) => sum + b.finalDesignKW, 0);
      const totalWaterFlow_lth = sysBatteries.reduce((sum, b) => sum + (b.finalDesignKcal / num(waterDeltaT)), 0);

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

      // --- NUOVI CALCOLI PER TAB 4 (Riepilogo Portate HVAC) ---
      const S = sys.overdesignPercent !== undefined ? num(sys.overdesignPercent) : 20;
      const Pfresh = sys.freshAirPercent !== undefined ? num(sys.freshAirPercent) : 15;

      const Q_mandata = Math.ceil((totalMandata * (1 + S / 100)) / 100) * 100;
      const Q_ripresa = Math.ceil((totalRipresa * (1 + S / 100)) / 100) * 100;
      const Q_localExhaust = Math.ceil((totalExhaustLocal * (1 + S / 100)) / 100) * 100;

      let Q_ariaEsterna = 0;
      let Q_espulsaHvac = 0;

      if (selectedOptions.hvacSubtype === 'tutta_aria') {
        Q_ariaEsterna = Q_mandata;
        Q_espulsaHvac = Q_ripresa;
      } else {
        const Q_ext_perc = Q_mandata * (Pfresh / 100);
        const rawAriaEsterna = Math.max(Q_ext_perc, Q_mandata - Q_ripresa);
        Q_ariaEsterna = Math.ceil(rawAriaEsterna / 100) * 100;
        
        const rawEspulsaHvac = Math.max(0, Q_ariaEsterna - (Q_mandata - Q_ripresa));
        Q_espulsaHvac = Math.ceil(rawEspulsaHvac / 100) * 100;
      }

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
        waterFlowCold_lth,
        S,
        Pfresh,
        Q_mandata,
        Q_ripresa,
        Q_localExhaust,
        Q_ariaEsterna,
        Q_espulsaHvac
      };
    });
  }, [systems, roomCalculations, overdesignFactor, selectedOptions, batteryCalculations, waterDeltaT]);

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
    if (data.selectedOptions) {
      setSelectedOptions(data.selectedOptions);
    } else {
      // Retrocompatibilità per vecchi salvataggi: se ci sono già locali o sistemi, assumiamo HVAC attivo
      setSelectedOptions({
        hvac: (data.systems && data.systems.length > 0) || (data.rooms && data.rooms.length > 0),
        hvacSubtype: 'ricircolo',
        fancoils: false,
        recovery: false
      });
    }
    if (data.location !== undefined) setLocation(data.location);
    if (data.extTempSummer !== undefined) setExtTempSummer(data.extTempSummer);
    if (data.extRhSummer !== undefined) setExtRhSummer(data.extRhSummer);
    if (data.extTempWinter !== undefined) setExtTempWinter(data.extTempWinter);
    if (data.extRhWinter !== undefined) setExtRhWinter(data.extRhWinter);
    if (data.expectationLevel !== undefined) setExpectationLevel(data.expectationLevel);
    if (data.pollutionCategory !== undefined) setPollutionCategory(data.pollutionCategory);
    if (data.reheatBatteries) {
      setReheatBatteries(data.reheatBatteries);
    } else {
      setReheatBatteries([]);
    }
    if (data.manualBatteries) {
      setManualBatteries(data.manualBatteries);
    } else {
      setManualBatteries([]);
    }
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
      defaultLighting_W_m2,
      selectedOptions,
      location,
      extTempSummer,
      extRhSummer,
      extTempWinter,
      extRhWinter,
      expectationLevel,
      pollutionCategory,
      reheatBatteries,
      manualBatteries
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
      ahuExhaustFlow: 0,
      overdesignPercent: 20,
      freshAirPercent: 15
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
      peopleActivity: 'Personalizzato',
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
      exhaustFlow: 0,
      adoptedFlow: '',
      ceilingTightness: 0.5,
      ceilingPressure_Pa: 0
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
      exhaustFlow: roomToDup.exhaustFlow || 0,
      adoptedFlow: roomToDup.adoptedFlow || '',
      ceilingTightness: roomToDup.ceilingTightness ?? 0.5,
      ceilingPressure_Pa: roomToDup.ceilingPressure_Pa ?? 0
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

  // Reheat batteries helpers
  const handleAddReheatBattery = () => {
    const newBattery: HVACReheatBattery = {
      id: `rb-${Date.now()}`,
      name: 'RC-' + (reheatBatteries.length + 1),
      roomIds: [],
      upstreamTempWinter: 18.2,
      upstreamTempSummer: 13.0,
      deltaT: 5
    };
    setReheatBatteries([...reheatBatteries, newBattery]);
  };

  const handleRemoveReheatBattery = (batteryId: string) => {
    setReheatBatteries(prev => prev.filter(b => b.id !== batteryId));
  };

  const handleUpdateBatteryField = (batteryId: string, field: keyof HVACReheatBattery, val: any) => {
    setReheatBatteries(prev => prev.map(b => b.id === batteryId ? { ...b, [field]: val } : b));
  };

  const handleAssignRoomToBattery = (batteryId: string, roomId: string) => {
    setReheatBatteries(prev => prev.map(b => {
      if (b.id === batteryId) {
        if (!b.roomIds.includes(roomId)) {
          return { ...b, roomIds: [...b.roomIds, roomId] };
        }
      } else {
        if (b.roomIds.includes(roomId)) {
          return { ...b, roomIds: b.roomIds.filter(id => id !== roomId) };
        }
      }
      return b;
    }));
  };

  const handleUnassignRoomFromBattery = (batteryId: string, roomId: string) => {
    setReheatBatteries(prev => prev.map(b => b.id === batteryId ? { ...b, roomIds: b.roomIds.filter(id => id !== roomId) } : b));
  };

  const handleAddManualBattery = () => {
    const newBattery: HVACManualBattery = {
      id: `mb-${Date.now()}`,
      name: 'Batteria ' + (manualBatteries.length + 1),
      type: 'calda',
      power_kW: 0,
      flowRate: 0,
      flowUnit: 'l/h',
      deltaT: 5
    };
    setManualBatteries([...manualBatteries, newBattery]);
  };

  const handleRemoveManualBattery = (id: string) => {
    setManualBatteries(prev => prev.filter(b => b.id !== id));
  };

  const handleUpdateManualBatteryField = (id: string, field: keyof HVACManualBattery, val: any) => {
    setManualBatteries(prev => prev.map(b => b.id === id ? { ...b, [field]: val } : b));
  };

  return (
    <>
      <div className="max-w-7xl mx-auto animate-fade-in px-4 pb-12">
      {/* Title Header */}
      <ProjectHeader 
        pData={projectData} 
        setPData={setProjectData} 
        title="Dimensionamento Impianto di Climatizzazione" 
        setAppMode={setAppMode} 
        iconColor="brand" 
        showPrintButton={activeTab === 'summary' || activeTab === 'hvacFlowSummary' || activeTab === 'freshAirCheck' || activeTab === 'reheat'}
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
                G<sub>ripresa</sub> = G<sub>mandata</sub> + Infiltrazioni (Entranti) - Aspirazioni Localizzate - Trafilamenti (Uscenti)
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



      {/* Compact Global Parameters for Print */}
      {selectedOptions.hvac && (
        <div className="hidden print:block border border-slate-200 rounded-2xl p-3.5 mb-5 text-[10px] text-slate-650 bg-slate-50/40">
          <h5 className="font-bold text-[9px] uppercase tracking-wider text-slate-500 mb-2 border-b border-slate-100 pb-1">
            Località e Condizioni Climatiche Esterne di Progetto
          </h5>
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 font-semibold">
            <div>
              <span className="text-slate-400 uppercase font-bold text-[8px] mr-1.5">Località:</span>
              <span className="font-sans">{location}</span>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-bold text-[8px] mr-1.5">Estate Esterna:</span>
              <span className="font-mono">{formatNumber(extTempSummer, 0)}°C / {formatNumber(extRhSummer, 0)}% UR</span>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-bold text-[8px] mr-1.5">Inverno Esterno:</span>
              <span className="font-mono">{formatNumber(extTempWinter, 0)}°C / {formatNumber(extRhWinter, 0)}% UR</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-2 print:hidden">
        <button
          onClick={() => setActiveTab('config')}
          className={`flex flex-col items-center justify-center text-center gap-1 w-[120px] h-[72px] rounded-xl text-[11px] leading-tight font-bold transition-all cursor-pointer ${
            activeTab === 'config' 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
              : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
          }`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span>Configurazione</span>
        </button>

        {selectedOptions.hvac && (
          <>
            <button
              onClick={() => setActiveTab('criteria')}
              className={`flex flex-col items-center justify-center text-center gap-1 w-[120px] h-[72px] rounded-xl text-[11px] leading-tight font-bold transition-all cursor-pointer ${
                activeTab === 'criteria' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                  : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>1. Locali e Carichi</span>
            </button>
            <button
              onClick={() => setActiveTab('flows')}
              className={`flex flex-col items-center justify-center text-center gap-1 w-[120px] h-[72px] rounded-xl text-[11px] leading-tight font-bold transition-all cursor-pointer ${
                activeTab === 'flows' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                  : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
              }`}
            >
              <IconWind className="w-4 h-4 shrink-0" />
              <span>2. Portate d'Aria</span>
            </button>
            <button
              onClick={() => setActiveTab('leakage')}
              className={`flex flex-col items-center justify-center text-center gap-1 w-[120px] h-[72px] rounded-xl text-[11px] leading-tight font-bold transition-all cursor-pointer ${
                activeTab === 'leakage' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                  : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4 shrink-0" />
              <span>3. Pressioni e Trafilamenti</span>
            </button>
            <button
              onClick={() => setActiveTab('hvacFlowSummary')}
              className={`flex flex-col items-center justify-center text-center gap-1 w-[120px] h-[72px] rounded-xl text-[11px] leading-tight font-bold transition-all cursor-pointer ${
                activeTab === 'hvacFlowSummary' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                  : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
              }`}
            >
              <Activity className="w-4 h-4 shrink-0" />
              <span>4. Riepilogo Portate HVAC</span>
            </button>
            <button
              onClick={() => setActiveTab('freshAirCheck')}
              className={`flex flex-col items-center justify-center text-center gap-1 w-[120px] h-[72px] rounded-xl text-[11px] leading-tight font-bold transition-all cursor-pointer ${
                activeTab === 'freshAirCheck' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                  : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>5. Check Aria di Rinnovo</span>
            </button>
            <button
              onClick={() => setActiveTab('reheat')}
              className={`flex flex-col items-center justify-center text-center gap-1 w-[120px] h-[72px] rounded-xl text-[11px] leading-tight font-bold transition-all cursor-pointer ${
                activeTab === 'reheat' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                  : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
              }`}
            >
              <Thermometer className="w-4 h-4 shrink-0" />
              <span>6. Batterie di Post</span>
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex flex-col items-center justify-center text-center gap-1 w-[120px] h-[72px] rounded-xl text-[11px] leading-tight font-bold transition-all cursor-pointer ${
                activeTab === 'summary' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                  : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>7. Riepilogo Consumi</span>
            </button>
          </>
        )}

        {selectedOptions.fancoils && (
          <button
            onClick={() => setActiveTab('fancoils')}
            className={`flex flex-col items-center justify-center text-center gap-1 w-[120px] h-[72px] rounded-xl text-[11px] leading-tight font-bold transition-all cursor-pointer ${
              activeTab === 'fancoils' 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
            }`}
          >
            <Thermometer className="w-4 h-4 shrink-0" />
            <span>Ventilconvettori & Split</span>
          </button>
        )}

        {selectedOptions.recovery && (
          <button
      onClick={() => setActiveTab('recovery')}
      className={`flex flex-col items-center justify-center text-center gap-1 w-[120px] h-[72px] rounded-xl text-[11px] leading-tight font-bold transition-all cursor-pointer ${
        activeTab === 'recovery' 
          ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
          : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
      }`}
    >
      <ArrowRightLeft className="w-4 h-4 shrink-0" />
      <span>Recuperatori di Calore</span>
    </button>
        )}
      </div>

      {/* Main Tab Content */}
      <div className="bg-slate-50 rounded-2xl min-h-[500px]">
        {/* CONFIGURATION TAB */}
        {activeTab === 'config' && (
          <div className="p-6 space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600 animate-spin-slow" />
                Configurazione Impianti da Inserire
              </h3>
              <p className="text-xs text-slate-500 max-w-2xl">
                Seleziona i sistemi e i componenti che costituiscono l'impianto di climatizzazione del progetto. I moduli di calcolo correlati si sbloccheranno di conseguenza.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                {/* CARD 1: HVAC */}
                <div 
                  onClick={() => handleToggleOption('hvac')}
                  className={`group relative flex flex-col p-5 bg-white border-2 rounded-2xl cursor-pointer transition-all hover:shadow-md ${
                    selectedOptions.hvac 
                      ? 'border-blue-500 bg-blue-50/10 shadow-sm shadow-blue-50' 
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-3 rounded-xl transition-colors ${selectedOptions.hvac ? 'bg-blue-100 text-blue-650' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                      <IconWind className="w-6 h-6 shrink-0" />
                    </div>
                    <input 
                      type="checkbox"
                      checked={selectedOptions.hvac}
                      onChange={() => {}} // Gestito da onClick della card
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">HVAC (UTA)</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
                    Dimensionamento aeraulico completo dei sistemi HVAC. Include bilanci di portata UTA, trafilamenti dalle fessure delle porte per pressione differenziale e batterie di post-riscaldo.
                  </p>
                  
                  {/* Sotto-opzioni HVAC (mostrate solo se selezionato) */}
                  {selectedOptions.hvac && (
                    <div 
                      onClick={(e) => e.stopPropagation()} // Previene il toggle della card principale
                      className="mt-auto pt-3 border-t border-slate-100 space-y-2 text-[11px] text-slate-700 font-semibold"
                    >
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tipologia di Sistema</span>
                      <label className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors">
                        <input 
                          type="radio"
                          name="hvacSubtype"
                          checked={selectedOptions.hvacSubtype === 'tutta_aria'}
                          onChange={() => setSelectedOptions(prev => ({ ...prev, hvacSubtype: 'tutta_aria' }))}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>A tutta aria esterna</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors">
                        <input 
                          type="radio"
                          name="hvacSubtype"
                          checked={selectedOptions.hvacSubtype === 'ricircolo'}
                          onChange={() => setSelectedOptions(prev => ({ ...prev, hvacSubtype: 'ricircolo' }))}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>A parziale ricircolo</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* CARD 2: Ventilconvettori */}
                <div 
                  onClick={() => handleToggleOption('fancoils')}
                  className={`group relative flex flex-col p-5 bg-white border-2 rounded-2xl cursor-pointer transition-all hover:shadow-md ${
                    selectedOptions.fancoils 
                      ? 'border-blue-500 bg-blue-50/10 shadow-sm shadow-blue-50' 
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-3 rounded-xl transition-colors ${selectedOptions.fancoils ? 'bg-blue-100 text-blue-650' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                      <Thermometer className="w-6 h-6 shrink-0" />
                    </div>
                    <input 
                      type="checkbox"
                      checked={selectedOptions.fancoils}
                      onChange={() => {}} // Gestito da onClick
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">Ventilconvettori, Split, Aerotermi</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Sistemi di climatizzazione locale (idronici ed espansione diretta). Include il calcolo delle potenze termiche sensibili e latenti e la selezione delle taglie per i locali di progetto.
                  </p>
                </div>

                {/* CARD 3: Recuperatori */}
                <div 
                  onClick={() => handleToggleOption('recovery')}
                  className={`group relative flex flex-col p-5 bg-white border-2 rounded-2xl cursor-pointer transition-all hover:shadow-md ${
                    selectedOptions.recovery 
                      ? 'border-blue-500 bg-blue-50/10 shadow-sm shadow-blue-50' 
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-3 rounded-xl transition-colors ${selectedOptions.recovery ? 'bg-blue-100 text-blue-650' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                      <ArrowRightLeft className="w-6 h-6 shrink-0" />
                    </div>
                    <input 
                      type="checkbox"
                      checked={selectedOptions.recovery}
                      onChange={() => {}} // Gestito da onClick
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">Recuperatori di Calore</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Unità di ventilazione meccanica con recupero termico dell'aria espulsa. Calcolo dei flussi d'aria di rinnovo, efficienza di recupero energetico e bilancio dei canali di ripresa ed immissione.
                  </p>
                </div>
              </div>

              {/* Informative alert based on selection */}
              <div className="mt-4 p-4 bg-slate-50 border border-slate-150 rounded-2xl text-[11px] text-slate-600 flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  {selectedOptions.hvac && "I moduli di calcolo per il dimensionamento HVAC (UTA) sono abilitati. Le altre opzioni rimangono escluse."}
                  {!selectedOptions.hvac && !selectedOptions.fancoils && !selectedOptions.recovery && "Nessun impianto selezionato. Abilita un'opzione per sbloccare i relativi moduli."}
                  {selectedOptions.fancoils && selectedOptions.recovery && "Moduli di Ventilconvettori & Split e Recuperatori di Calore abilitati simultaneamente."}
                  {selectedOptions.fancoils && !selectedOptions.recovery && "Modulo Ventilconvettori, Split, Aerotermi abilitato."}
                  {selectedOptions.recovery && !selectedOptions.fancoils && "Modulo Recuperatori di Calore abilitato."}
                </span>
              </div>
            </div>

            {/* Global Config / Parameter Controls */}
            {selectedOptions.hvac && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-5 mt-6 print:hidden">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                  <Settings className="w-5 h-5 text-blue-600 animate-spin-slow" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Località e Condizioni Climatiche Esterne di Progetto</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Località di Installazione
                    </label>
                    <select 
                      value={location} 
                      onChange={e => {
                        const val = e.target.value;
                        setLocation(val);
                        if (val !== 'custom') {
                          const found = CLIMATE_DATA.find(p => p.provincia === val);
                          if (found) {
                            setExtTempSummer(found.tSummer);
                            setExtRhSummer(found.rhSummer);
                            setExtTempWinter(found.tWinter);
                            setExtRhWinter(found.rhWinter);
                          }
                        }
                      }} 
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 cursor-pointer"
                    >
                      <option value="custom">Personalizzata...</option>
                      {[...CLIMATE_DATA].sort((a, b) => a.provincia.localeCompare(b.provincia)).map(p => (
                        <option key={p.sigla} value={p.provincia}>{p.provincia} ({p.sigla})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Temp. Esterna Estate (°C)
                    </label>
                    <input 
                      type="number" 
                      value={extTempSummer} 
                      onChange={e => {
                        setExtTempSummer(e.target.value === '' ? '' : Number(e.target.value));
                        setLocation('custom');
                      }} 
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      UR% Esterna Estate (%)
                    </label>
                    <input 
                      type="number" 
                      value={extRhSummer} 
                      onChange={e => {
                        setExtRhSummer(e.target.value === '' ? '' : Number(e.target.value));
                        setLocation('custom');
                      }} 
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Temp. Esterna Inverno (°C)
                    </label>
                    <input 
                      type="number" 
                      value={extTempWinter} 
                      onChange={e => {
                        setExtTempWinter(e.target.value === '' ? '' : Number(e.target.value));
                        setLocation('custom');
                      }} 
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      UR% Esterna Inverno (%)
                    </label>
                    <input 
                      type="number" 
                      value={extRhWinter} 
                      onChange={e => {
                        setExtRhWinter(e.target.value === '' ? '' : Number(e.target.value));
                        setLocation('custom');
                      }} 
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FANCOILS TAB PLACEHOLDER */}
        {activeTab === 'fancoils' && (
          <div className="p-6 space-y-6">
            <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm text-center max-w-2xl mx-auto my-12 space-y-6">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <Thermometer className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-800">Ventilconvettori, Split, Aerotermi</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  Questo modulo consentirà di effettuare il dimensionamento di ventilconvettori, split ed aerotermi, con il calcolo del fabbisogno termico sensibile e latente dei locali e la selezione automatica delle taglie commerciali dei terminali.
                </p>
              </div>
              <div className="bg-amber-50/70 border border-amber-200/60 rounded-2xl p-4 text-[11px] text-slate-600 text-left max-w-md mx-auto">
                <p className="font-bold text-amber-900 mb-1">🛠️ Sviluppo Modulo:</p>
                In questa sezione integreremo la definizione dei carichi termici estivi/invernali locali e il dimensionamento idronico o a fluido refrigerante per i terminali di zona.
              </div>
            </div>
          </div>
        )}

        {/* RECOVERY TAB PLACEHOLDER */}
        {activeTab === 'recovery' && (
          <div className="p-6 space-y-6">
            <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm text-center max-w-2xl mx-auto my-12 space-y-6">
              <div className="w-16 h-16 bg-blue-50 text-blue-650 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <ArrowRightLeft className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-800">Recuperatori di Calore</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  Questo modulo consentirà di calcolare i flussi d'aria di rinnovo con recupero termico, definendo l'efficienza energetica del recuperatore (sensibile/latente) e bilanciando le portate di immissione ed espulsione.
                </p>
              </div>
              <div className="bg-amber-50/70 border border-amber-200/60 rounded-2xl p-4 text-[11px] text-slate-650 text-left max-w-md mx-auto">
                <p className="font-bold text-amber-900 mb-1">🛠️ Sviluppo Modulo:</p>
                In questa sezione integreremo il calcolo del rendimento termico, il bilancio energetico dell'aria esterna immessa e il pre-trattamento termico in recuperatore.
              </div>
            </div>
          </div>
        )}

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
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Area <span className="normal-case">(m²)</span></label>
                        <input 
                          type="number" 
                          value={selectedRoom.area} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'area', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Altezza <span className="normal-case">(m)</span></label>
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

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-xs border-t border-slate-100 pt-3 items-end">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">N. min. ricambi (Vol/h)</label>
                        <input 
                          type="number" 
                          value={selectedRoom.ricambiApp} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'ricambiApp', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Pressione relativa (Pa)</label>
                        <input 
                          type="number" 
                          step="any"
                          value={selectedRoom.pressure_Pa} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'pressure_Pa', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                        />
                      </div>

                      {/* Estate */}
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
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Range T Estate (°C)</label>
                        <input 
                          type="text" 
                          value={selectedRoom.tempSummerTol || ''} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'tempSummerTol', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                          placeholder="±2"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">UR Progetto Estate (%)</label>
                        <input 
                          type="number" 
                          value={selectedRoom.rhSummer} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'rhSummer', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Range UR Estate (%)</label>
                        <input 
                          type="text" 
                          value={selectedRoom.rhSummerTol || ''} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'rhSummerTol', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                          placeholder="≤ 65"
                        />
                      </div>

                      {/* Inverno */}
                      <div className="hidden lg:block"></div>
                      <div className="hidden lg:block"></div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">T Progetto Inverno (°C)</label>
                        <input 
                          type="number" 
                          value={selectedRoom.tempWinter} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'tempWinter', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Range T Inverno (°C)</label>
                        <input 
                          type="text" 
                          value={selectedRoom.tempWinterTol || ''} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'tempWinterTol', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                          placeholder="±2"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">UR Progetto Inverno (%)</label>
                        <input 
                          type="number" 
                          value={selectedRoom.rhWinter} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'rhWinter', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Range UR Inverno (%)</label>
                        <input 
                          type="text" 
                          value={selectedRoom.rhWinterTol || ''} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'rhWinterTol', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                          placeholder="≤ 65"
                        />
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
                          <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                            <th className="py-2.5 pr-4 min-w-[160px]">Nome Apparecchio</th>
                            <th className="py-2.5 pr-4 w-28">P. Elettrica (W)</th>
                            <th className="py-2.5 pr-4 w-20">Quantità</th>
                            <th className="py-2.5 pr-4 w-44">Coeff. Utilizzo (da 0 a 1)</th>
                            <th className="py-2.5 pr-4 w-48">Coeff. Dissipazione (da 0 a 1)</th>
                            <th className="py-2.5 pr-4 w-32">Carico Dissipato (W)</th>
                            <th className="py-2.5 w-14 text-right print:hidden">Azioni</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRoom.equipment.map(eq => (
                            <tr key={eq.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <td className="py-2.5 pr-4 min-w-[160px]">
                                <input
                                  type="text"
                                  value={eq.name}
                                  onChange={e => handleUpdateEquipment(selectedRoom.id, eq.id, 'name', e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl outline-none transition-all text-slate-800 shadow-sm font-semibold"
                                />
                              </td>
                              <td className="py-2.5 pr-4 w-28">
                                <input
                                  type="number"
                                  min={0}
                                  value={eq.power_W}
                                  onChange={e => handleUpdateEquipment(selectedRoom.id, eq.id, 'power_W', e.target.value === '' ? '' : Number(e.target.value))}
                                  onBlur={e => {
                                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                                    handleUpdateEquipment(selectedRoom.id, eq.id, 'power_W', Math.max(0, val));
                                  }}
                                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl outline-none transition-all font-mono text-slate-800 shadow-sm font-semibold"
                                />
                              </td>
                              <td className="py-2.5 pr-4 w-20">
                                <input
                                  type="number"
                                  min={0}
                                  value={eq.quantity}
                                  onChange={e => handleUpdateEquipment(selectedRoom.id, eq.id, 'quantity', e.target.value === '' ? '' : Number(e.target.value))}
                                  onBlur={e => {
                                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                                    handleUpdateEquipment(selectedRoom.id, eq.id, 'quantity', Math.max(0, val));
                                  }}
                                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl outline-none transition-all font-mono text-slate-800 shadow-sm font-semibold"
                                />
                              </td>
                              <td className="py-2.5 pr-4 w-44">
                                <input
                                  type="number"
                                  min={0}
                                  max={1}
                                  step="0.05"
                                  value={eq.usageFactor}
                                  onChange={e => handleUpdateEquipment(selectedRoom.id, eq.id, 'usageFactor', e.target.value === '' ? '' : Number(e.target.value))}
                                  onBlur={e => {
                                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                                    handleUpdateEquipment(selectedRoom.id, eq.id, 'usageFactor', Math.max(0, Math.min(1, val)));
                                  }}
                                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl outline-none transition-all font-mono text-slate-800 shadow-sm font-semibold"
                                />
                              </td>
                              <td className="py-2.5 pr-4 w-48">
                                <input
                                  type="number"
                                  min={0}
                                  max={1}
                                  step="0.05"
                                  value={eq.dissipationFactor}
                                  onChange={e => handleUpdateEquipment(selectedRoom.id, eq.id, 'dissipationFactor', e.target.value === '' ? '' : Number(e.target.value))}
                                  onBlur={e => {
                                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                                    handleUpdateEquipment(selectedRoom.id, eq.id, 'dissipationFactor', Math.max(0, Math.min(1, val)));
                                  }}
                                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl outline-none transition-all font-mono text-slate-800 shadow-sm font-semibold"
                                />
                              </td>
                              <td className="py-2.5 pr-4 w-32 font-bold font-mono text-slate-700 text-sm">
                                {formatNumber(num(eq.power_W) * num(eq.quantity) * num(eq.usageFactor) * num(eq.dissipationFactor), 0)} W
                              </td>
                              <td className="py-2.5 w-14 text-right print:hidden">
                                <button
                                  onClick={() => handleRemoveEquipment(selectedRoom.id, eq.id)}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer print:hidden"
                                  title="Elimina apparecchiatura"
                                >
                                  <Trash2 className="w-4 h-4" />
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

{/* Heat loads editing card */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1">
                        <Activity className="w-4 h-4 text-orange-500" />
                        Carichi Termici e Parametri Sensibili
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
                      {/* Carichi termici esterni */}
                      <div className="space-y-3">
                        <h5 className="font-bold text-slate-700 border-b border-slate-50 pb-1">Carichi termici esterni</h5>
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
                      </div>

                      {/* Illuminazione */}
                      <div className="space-y-3">
                        <h5 className="font-bold text-slate-700 border-b border-slate-50 pb-1">Illuminazione</h5>
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

                      {/* Affollamento & Persone */}
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
                          <label className="block text-[10px] text-slate-500 mb-1">Attività Persone</label>
                          <select
                            value={selectedRoom.peopleActivity || 'Personalizzato'}
                            onChange={e => handleUpdateRoomField(selectedRoom.id, 'peopleActivity', e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:border-blue-500 text-[11px] text-slate-700 cursor-pointer"
                          >
                            <option value="Personalizzato">Personalizzato...</option>
                            {peopleActivities.map(act => (
                              <option key={act.name} value={act.name}>{act.name}</option>
                            ))}
                          </select>
                        </div>
                        {(() => {
                          const currentActivity = selectedRoom.peopleActivity || 'Personalizzato';
                          const calculatedLoads = getPeopleLoads(
                            currentActivity,
                            num(selectedRoom.tempSummer),
                            num(selectedRoom.peopleSensible_W),
                            num(selectedRoom.peopleLatent_W)
                          );
                          const isCustom = currentActivity === 'Personalizzato';
                          return (
                            <>
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-1">
                                  Carico Sensibile per Persona (W)
                                </label>
                                <input 
                                  type="number" 
                                  value={calculatedLoads.sens} 
                                  disabled={!isCustom}
                                  onChange={e => handleUpdateRoomField(selectedRoom.id, 'peopleSensible_W', e.target.value === '' ? '' : Number(e.target.value))}
                                  className={`w-full p-2 border rounded-xl font-mono focus:border-blue-500 outline-none ${!isCustom ? 'bg-slate-100 text-slate-500 border-slate-150 cursor-not-allowed font-semibold' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-1">
                                  Carico Latente per Persona (W)
                                </label>
                                <input 
                                  type="number" 
                                  value={calculatedLoads.lat} 
                                  disabled={!isCustom}
                                  onChange={e => handleUpdateRoomField(selectedRoom.id, 'peopleLatent_W', e.target.value === '' ? '' : Number(e.target.value))}
                                  className={`w-full p-2 border rounded-xl font-mono focus:border-blue-500 outline-none ${!isCustom ? 'bg-slate-100 text-slate-500 border-slate-150 cursor-not-allowed font-semibold' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                                />
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Riepilogo Carichi Calcolati */}
                    {(() => {
                      const rCalc = roomCalculations.find(c => c.room.id === selectedRoom.id);
                      if (!rCalc) return null;
                      return (
                        <div className="bg-slate-50/70 border border-slate-150 rounded-2xl p-4 mt-2 space-y-3">
                          <h5 className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">Riepilogo Carichi Calcolati</h5>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3 text-xs">
                            <div className="bg-white p-2.5 rounded-xl border border-slate-150/65 shadow-sm space-y-1 min-w-0">
                              <span className="text-[8px] sm:text-[9px] text-slate-450 block font-bold uppercase tracking-tighter break-words leading-tight">
                                Illuminazione
                              </span>
                              <span className="text-xs font-black font-mono text-slate-800 block truncate">{formatNumber(rCalc.lightLoad, 0)} W</span>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-slate-150/65 shadow-sm space-y-1 min-w-0">
                              <span className="text-[8px] sm:text-[9px] text-slate-450 block font-bold uppercase tracking-tighter break-words leading-tight">
                                Persone (Sens / Lat)
                              </span>
                              <span className="text-xs font-black font-mono text-slate-800 block truncate">
                                {formatNumber(rCalc.peopleSensible, 0)} / {formatNumber(rCalc.peopleLatent, 0)} W
                              </span>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-slate-150/65 shadow-sm space-y-1 min-w-0">
                              <span className="text-[8px] sm:text-[9px] text-slate-450 block font-bold uppercase tracking-tighter break-words leading-tight">
                                Apparecchiature
                              </span>
                              <span className="text-xs font-black font-mono text-slate-800 block truncate">{formatNumber(rCalc.equipmentLoad, 0)} W</span>
                            </div>
                            <div className="bg-blue-50/60 p-2.5 rounded-xl border border-blue-150/65 shadow-sm space-y-1 min-w-0">
                              <span className="text-[8px] sm:text-[9px] text-blue-500 block font-bold uppercase tracking-tighter break-words leading-tight">
                                Carico Sensibile Estivo
                              </span>
                              <span className="text-xs font-black font-mono text-blue-700 block truncate">{formatNumber(rCalc.totalSensibleSummer, 0)} W</span>
                            </div>
                            <div className="bg-teal-50/60 p-2.5 rounded-xl border border-teal-150/65 shadow-sm space-y-1 min-w-0">
                              <span className="text-[8px] sm:text-[9px] text-teal-600 block font-bold uppercase tracking-tighter break-words leading-tight">
                                Carico Latente Estivo
                              </span>
                              <span className="text-xs font-black font-mono text-teal-700 block truncate">{formatNumber(rCalc.peopleLatent, 0)} W</span>
                            </div>
                            <div className="bg-orange-50/60 p-2.5 rounded-xl border border-orange-150/65 shadow-sm space-y-1 min-w-0">
                              <span className="text-[8px] sm:text-[9px] text-orange-600 block font-bold uppercase tracking-tighter break-words leading-tight">
                                Dispersione Invernale
                              </span>
                              <span className="text-xs font-black font-mono text-orange-700 block truncate">{formatNumber(rCalc.room.externalHeatLoss_W, 0)} W</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
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
                    <li><strong>Codice & Descrizione</strong>: Identificativo e destinazione d’uso del locale.</li>
                    <li><strong>Dimensioni</strong>: Area ed altezza per calcolare il volume.</li>
                    <li><strong>Classe GMP</strong>: Classe farmaceutica di contaminazione ambientale (A, B, C, D, CNC, NC, altro).</li>
                    <li><strong>Livello biologico</strong>: Livello di biosicurezza (BSL1/BSL2/BSL3/BSL4).</li>
                    <li><strong>Pressione relativa</strong>: Pressione ambientale relativa all’esterno.</li>
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
                          <th className="py-2.5 px-2 text-right font-mono">Ricambi (N. / Portata)</th>
                          <th className="py-2.5 px-2 text-right font-mono">Asp. Localizzate (m³/h)</th>
                          <th className="py-2.5 px-2 text-right font-mono font-bold text-slate-700">Mandata (Calcolata / Adottata)</th>
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
                                <div className="flex justify-end mb-1">
                                  <span className="px-1.5 py-0.5 text-[9px] bg-indigo-50 text-indigo-800 border border-indigo-200 rounded font-bold">
                                    {formatNumber(c.room.ricambiApp, c.room.ricambiApp % 1 === 0 ? 0 : 1)}
                                  </span>
                                </div>
                                <div>{formatNumber(c.ricambiFlow, 0)} <span className="text-[8px] font-normal text-slate-400">m³/h</span></div>
                              </td>

                              {/* Asp. Localizzate */}
                              <td className="py-3 px-2 font-mono text-right text-slate-500">
                                <div className="flex items-center justify-end gap-1">
                                  <input
                                    type="number"
                                    min={0}
                                    value={c.room.exhaustFlow ?? 0}
                                    onChange={e => handleUpdateRoomField(c.room.id, 'exhaustFlow', e.target.value === '' ? '' : Number(e.target.value))}
                                    onBlur={e => {
                                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                                      handleUpdateRoomField(c.room.id, 'exhaustFlow', Math.max(0, val));
                                    }}
                                    className="w-16 p-0.5 text-right font-mono text-[10px] rounded border border-slate-200 bg-slate-50 text-slate-800 outline-none transition-all focus:border-red-400 focus:bg-white"
                                  />
                                  <span className="text-[8px] text-slate-400 font-normal">m³/h</span>
                                </div>
                              </td>

                              {/* Mandata (Calcolata / Adottata) */}
                              <td className="py-3 px-2 font-mono text-right space-y-0.5">
                                <div className="text-slate-500 text-[9px]">Calcolata: {formatNumber(c.calculatedFlow, 0)} m³/h</div>
                                {(() => {
                                  const isManualAdopted = c.room.adoptedFlow !== undefined && c.room.adoptedFlow !== null && c.room.adoptedFlow !== '';
                                  const currentAdopted = isManualAdopted ? Number(c.room.adoptedFlow) : Math.ceil(c.calculatedFlow / 10) * 10;
                                  const isUndercalced = currentAdopted < c.calculatedFlow;
                                  return (
                                    <>
                                      <div className="flex items-center justify-end gap-1">
                                        <input
                                          type="number"
                                          placeholder={String(Math.ceil(c.calculatedFlow / 10) * 10)}
                                          value={c.room.adoptedFlow ?? ''}
                                          onChange={e => handleUpdateRoomField(c.room.id, 'adoptedFlow', e.target.value === '' ? '' : Number(e.target.value))}
                                          onBlur={e => {
                                            if (e.target.value !== '') {
                                              const val = Math.max(0, Number(e.target.value));
                                              handleUpdateRoomField(c.room.id, 'adoptedFlow', val);
                                            }
                                          }}
                                          className={`w-16 p-0.5 text-right font-mono font-bold text-[10px] rounded border outline-none transition-all ${
                                            isUndercalced 
                                              ? 'border-red-400 bg-red-50 text-red-700 focus:border-red-500' 
                                              : isManualAdopted 
                                                ? 'border-blue-300 bg-blue-50/50 text-blue-700 focus:border-blue-500' 
                                                : 'border-slate-200 bg-slate-50 text-slate-450 focus:border-blue-400 focus:bg-white'
                                          }`}
                                        />
                                        <span className="text-[8px] text-slate-450 font-normal">m³/h</span>
                                      </div>
                                      {isUndercalced && (
                                        <div className="text-red-500 text-[8px] font-bold mt-0.5">⚠️ &lt; di Calcolata</div>
                                      )}
                                    </>
                                  );
                                })()}
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
                            <td className="py-3 px-2 text-right font-mono text-slate-500 font-bold">
                              {formatNumber(sysTotals.totalExhaustLocal, 0)} m³/h
                            </td>
                            <td className="py-3 px-2 text-right font-mono">
                              <div className="text-blue-800 font-black text-[11px]">Adottata: {formatNumber(sysTotals.totalMandata, 0)} m³/h</div>
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
                  <li><strong>Portata Ricambi (G<sub>ric</sub>)</strong>: Basata sul numero minimo di ricambi orari.</li>
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
                          {r.pressure_Pa > 0 ? '+' : ''}{formatNumber(r.pressure_Pa, getPresDec(r.pressure_Pa))} Pa
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
                          Configurazione Tenuta Aria Locale (Locale: {selectedRoom.code})
                        </h4>
                        <p className="text-[10px] text-slate-400">Inserisci i parametri del controsoffitto e le porte confinanti per calcolare infiltrazioni e trafilamenti.</p>
                      </div>
                      <button
                        onClick={() => handleAddDoor(selectedRoom.id)}
                        className="px-2 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer print:hidden"
                      >
                        <Plus className="w-3.5 h-3.5" /> Aggiungi Porta
                      </button>
                    </div>

                    {/* Parametri Controsoffitto */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-150 space-y-3 mb-4">
                      <h5 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" /> Tenuta e Pressione Controsoffitto
                      </h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 mb-1">Tenuta (Ct - m³/h·m²·Pa)</label>
                          <input 
                            type="number" 
                            step="0.1"
                            min={0}
                            value={selectedRoom.ceilingTightness ?? 0.5} 
                            onChange={e => handleUpdateRoomField(selectedRoom.id, 'ceilingTightness', e.target.value === '' ? '' : Number(e.target.value))}
                            onBlur={e => {
                              const val = e.target.value === '' ? 0.5 : Number(e.target.value);
                              handleUpdateRoomField(selectedRoom.id, 'ceilingTightness', Math.max(0, val));
                            }}
                            className="w-full p-2 bg-white border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 mb-1">Pressione Contros. (Pc - Pa)</label>
                          <input 
                            type="number" 
                            step="any"
                            value={selectedRoom.ceilingPressure_Pa ?? 0} 
                            onChange={e => handleUpdateRoomField(selectedRoom.id, 'ceilingPressure_Pa', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full p-2 bg-white border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono text-xs"
                          />
                        </div>
                      </div>
                      {(() => {
                        const rCalc = roomCalculations.find(c => c.room.id === selectedRoom.id);
                        if (!rCalc) return null;
                        const ceilingDp = num(selectedRoom.pressure_Pa) - num(selectedRoom.ceilingPressure_Pa || 0);
                        const ceilingRawFlow = num(selectedRoom.ceilingTightness ?? 0.5) * ceilingDp * num(selectedRoom.area);
                        let ceilingFlow = 0;
                        if (ceilingRawFlow !== 0) {
                          const sign = Math.sign(ceilingRawFlow);
                          ceilingFlow = Math.round(Math.abs(ceilingRawFlow) / 10) * 10 * sign;
                        }
                        return (
                          <div className="text-[10px] text-slate-500 font-semibold flex items-center justify-between border-t border-slate-200 pt-2 mt-1">
                            <span>Perdita Controsoffitto Calcolata:</span>
                            <span className={`font-mono font-bold ${ceilingFlow > 0 ? 'text-red-600' : ceilingFlow < 0 ? 'text-green-600' : 'text-slate-500'}`}>
                              {ceilingFlow > 0 ? `+${ceilingFlow}` : ceilingFlow} m³/h
                            </span>
                          </div>
                        );
                      })()}
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
                            const isAdjacentRoom = door.adjacentRoomId && door.adjacentRoomId !== 'esterno' && door.adjacentRoomId !== 'altro';
                            const isEsterno = door.adjacentRoomId === 'esterno' || !door.adjacentRoomId;
                            const isAltro = door.adjacentRoomId === 'altro';

                            const adjRoom = isAdjacentRoom ? rooms.find(r => r.id === door.adjacentRoomId) : null;
                            const adjPressure = adjRoom 
                              ? num(adjRoom.pressure_Pa) 
                              : isEsterno 
                                ? 0 
                                : num(door.adjacentPressure_Pa);
                            const dp = num(selectedRoom.pressure_Pa) - adjPressure;
                            
                            const l = door.type === 'singola' ? 5.1 : door.type === 'doppia' ? 5.8 : (num(door.customLength) || 5.1);
                            const s = (door.type === 'singola' || door.type === 'doppia') ? 0.002 : (num(door.customWidth) || 2) * 0.001;
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
                                    <option value="singola">Singola (0.9x2.1m, perimetro 5.1m, spessore 2mm)</option>
                                    <option value="doppia">Doppia (1.6x2.1m, perimetro 5.8m, spessore 2mm)</option>
                                    <option value="personalizzata">Personalizzata...</option>
                                  </select>
                                  {door.type === 'personalizzata' && (
                                    <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                                      <div>
                                        <label className="block text-[8px] font-bold text-slate-400 uppercase">Perimetro fess. <span className="normal-case">(m)</span></label>
                                        <input
                                          type="number"
                                          step="0.1"
                                          placeholder="5.1"
                                          value={door.customLength ?? ''}
                                          onChange={e => handleUpdateDoor(selectedRoom.id, door.id, 'customLength', e.target.value === '' ? '' : Number(e.target.value))}
                                          className="w-full p-0.5 border border-slate-150 rounded text-slate-800 text-[9px] font-mono"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[8px] font-bold text-slate-400 uppercase">Spessore fess. <span className="normal-case">(mm)</span></label>
                                        <input
                                          type="number"
                                          step="0.1"
                                          placeholder="2"
                                          value={door.customWidth ?? ''}
                                          onChange={e => handleUpdateDoor(selectedRoom.id, door.id, 'customWidth', e.target.value === '' ? '' : Number(e.target.value))}
                                          className="w-full p-0.5 border border-slate-150 rounded text-slate-800 text-[9px] font-mono"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 pr-2">
                                  <select
                                    value={door.adjacentRoomId || 'esterno'}
                                    onChange={e => {
                                      const val = e.target.value;
                                      const updates: any = { adjacentRoomId: val };
                                      if (val === 'esterno') {
                                        updates.adjacentPressure_Pa = 0;
                                      } else if (val !== 'altro') {
                                        const adj = rooms.find(r => r.id === val);
                                        if (adj) {
                                          updates.adjacentPressure_Pa = adj.pressure_Pa;
                                        }
                                      }
                                      handleUpdateDoorFields(selectedRoom.id, door.id, updates);
                                    }}
                                    className="w-full p-1 bg-slate-50 border border-slate-150 rounded-lg font-semibold cursor-pointer text-slate-700 text-[10px] mb-1"
                                  >
                                    <option value="esterno">Esterno</option>
                                    <option value="altro">Altro</option>
                                    {rooms.filter(r => r.id !== selectedRoom.id).map(r => (
                                      <option key={r.id} value={r.id}>
                                        {r.code} - {r.description}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[8px] text-slate-400 font-bold uppercase shrink-0">Pressione confine:</span>
                                    <input
                                      type="number"
                                      step="any"
                                      value={isAdjacentRoom ? adjPressure : isEsterno ? 0 : door.adjacentPressure_Pa}
                                      disabled={isAdjacentRoom || isEsterno}
                                      onChange={e => handleUpdateDoor(selectedRoom.id, door.id, 'adjacentPressure_Pa', e.target.value === '' ? '' : Number(e.target.value))}
                                      className={`w-12 p-0.5 border border-slate-150 rounded font-mono text-center text-[10px] ${
                                        (isAdjacentRoom || isEsterno) ? 'bg-slate-100 text-slate-500' : 'bg-slate-50 text-slate-800'
                                      }`}
                                    />
                                    <span className="text-[8px] text-slate-400 font-bold">Pa</span>
                                  </div>
                                </td>
                                <td className="py-2.5 pr-2">
                                  <div className="font-bold font-mono text-slate-700 text-[10px] mb-1">
                                    {dp > 0 ? '+' : ''}{formatNumber(dp, getPresDec(dp))} Pa
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
                        
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
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
                          <div className="p-3 bg-rose-50/50 rounded-2xl border border-rose-150">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Asp. Locale (Out)</p>
                            <p className="text-lg font-black font-mono text-rose-700">-{num(rCalc.room.exhaustFlow)} <span className="text-xs font-normal">m³/h</span></p>
                          </div>
                          {(() => {
                            const isAlarm = rCalc.rawRipresaFlow < 0;
                            const isWarning = rCalc.rawRipresaFlow === 0;
                            
                            let boxBg = "bg-purple-50/50 border-purple-100";
                            let textCol = "text-purple-700";
                            let badge = null;
                            
                            if (isAlarm) {
                              boxBg = "bg-red-50 border-red-200 animate-pulse";
                              textCol = "text-red-750 font-bold";
                              badge = (
                                <div className="text-[8px] bg-red-600 text-white font-extrabold uppercase px-1 py-0.5 rounded mt-1.5 inline-block">
                                  Critico (Riparare bilancio!)
                                </div>
                              );
                            } else if (isWarning) {
                              boxBg = "bg-amber-50 border-amber-200";
                              textCol = "text-amber-700";
                              badge = (
                                <div className="text-[8px] bg-amber-500 text-white font-bold uppercase px-1 py-0.5 rounded mt-1.5 inline-block">
                                  Warning (Aria neutra)
                                </div>
                              );
                            }
                            
                            return (
                              <div className={`p-3 rounded-2xl border ${boxBg}`}>
                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Ripresa Calcolata (Out)</p>
                                <p className={`text-lg font-black font-mono ${textCol}`}>
                                  {isAlarm ? rCalc.rawRipresaFlow : rCalc.adoptedRipresaFlow} <span className="text-xs font-normal">m³/h</span>
                                </p>
                                {badge}
                              </div>
                            );
                          })()}
                        </div>

                        <div className="p-3 bg-amber-50 text-amber-800 rounded-2xl text-[10px] border border-amber-200">
                          <strong>Formula di Bilanciamento applicata:</strong>
                          <div className="font-mono mt-1 text-xs">
                            Ripresa = Mandata ({rCalc.adoptedFlow}) + Infiltrazioni ({rCalc.infiltrationFlow}) - Trafilamenti ({rCalc.exfiltrationFlow}) - Aspirazioni Localizzate ({num(rCalc.room.exhaustFlow)}) = {rCalc.rawRipresaFlow} m³/h 
                            (arrotondato a {rCalc.adoptedRipresaFlow} m³/h)
                          </div>
                          {rCalc.rawRipresaFlow < 0 && (
                            <div className="text-[9px] text-red-600 font-bold mt-1.5 flex items-center gap-1">
                              <span>🚨</span> Il valore di ripresa calcolato è negativo. Questo errore di bilanciamento (portata espulsa superiore a immissione + infiltrazioni) non è acceptable per il locale!
                            </div>
                          )}
                          {rCalc.rawRipresaFlow === 0 && (
                            <div className="text-[9px] text-amber-600 font-bold mt-1.5 flex items-center gap-1">
                              <span>⚠️</span> La ripresa del locale è a 0 m³/h (immissione + infiltrazioni = espulsione + trafilamenti).
                            </div>
                          )}
                          <div className="text-[9px] text-slate-400 mt-1 italic">(Infiltrazioni e Trafilamenti includono i flussi delle porte e del controsoffitto)</div>
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
                  <p>In questa sezione configuri i trafilamenti d'aria attraverso il controsoffitto e le fessure delle porte:</p>
                    <ul className="list-disc pl-4 space-y-1.5">
                      <li><strong>Trafilamento Controsoffitto</strong>: Calcolato con formula lineare (da Excel) in base all'area del locale (A), al coefficiente di tenuta del controsoffitto (Ct) e al delta P tra locale e plenum (P_locale - Pc):
                        <div className="font-mono text-[9px] mt-1 bg-amber-100/50 p-1 rounded text-amber-900">
                          Flusso = Ct &times; (P_locale - Pc) &times; A
                        </div>
                        Il valore viene arrotondato ai 10 m³/h (mantenendo lo stesso segno del differenziale).
                      </li>
                      <li><strong>Pressione Confine</strong>: Rappresenta la pressione dell'ambiente adiacente. Per l'<strong>Esterno</strong> è fissa a 0 Pa, per un <strong>Locale</strong> esistente assume il valore impostato nella scheda "Locali e Carichi", mentre per <strong>Altro</strong> viene inserita manualmente qui.</li>
                      <li><strong>Differenza di Pressione (&Delta;P)</strong>: Calcolata come differenza algebrica tra la pressione del locale in oggetto (impostata nella scheda "Locali e Carichi") e la pressione del confine:
                        <div className="font-mono text-[9px] mt-1 bg-amber-100/50 p-1 rounded text-amber-900">
                          &Delta;P = P_locale - P_confine
                        </div>
                      </li>
                      <li><strong>Flusso Aeraulico</strong>:
                        <ul className="list-circle pl-4 mt-1 space-y-0.5">
                          <li>Se <strong>&Delta;P &lt; 0</strong>: flusso <strong>entrante</strong> (Infiltrazione)</li>
                          <li>Se <strong>&Delta;P &gt; 0</strong>: flusso <strong>uscente</strong> (Trafilamento)</li>
                          <li>Se <strong>&Delta;P = 0</strong>: flusso <strong>nullo</strong></li>
                        </ul>
                      </li>
                      <li><strong>Aria Calcolata (m³/h)</strong>: Portata passante per le fessure (std 2mm) in base al perimetro fessura (L) e alla radice di |&Delta;P| (cioè &radic;|&Delta;P|).</li>
                    </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Riepilogo Portate HVAC */}
        {activeTab === 'hvacFlowSummary' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block">
            <div className="lg:col-span-3 space-y-6 print:w-full">
            {systemCalculations.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center text-slate-500">
                Nessun sistema HVAC configurato. Aggiungi un sistema nel tab "Configurazione" per procedere.
              </div>
            ) : (
              <div className="space-y-6">
                {systemCalculations.map(s => {
                  const sys = s.system;
                  const isRecirc = selectedOptions.hvacSubtype === 'ricircolo';

                  return (
                    <div key={sys.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
                      {/* Header */}
                      <div className="border-b border-slate-100 pb-3 flex flex-wrap justify-between items-center gap-4">
                        <div>
                          <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-blue-600"></span>
                            Sistema: {sys.name}
                          </h4>
                          <p className="text-xs text-slate-400 mt-0.5">{sys.description || 'Nessuna descrizione'}</p>
                        </div>
                        <div className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold text-slate-650 uppercase">
                          Tipo: {isRecirc ? 'Parziale Ricircolo' : 'Tutta Aria Esterna'}
                        </div>
                      </div>

                      {/* Configuration Inputs Card */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50/65 rounded-2xl border border-slate-100/80">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Sovradimensionamento del sistema (%)
                          </label>
                          <span className="hidden print:inline font-mono font-bold text-slate-800 text-xs">
                            {sys.overdesignPercent !== undefined ? sys.overdesignPercent : 20}%
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={sys.overdesignPercent !== undefined ? sys.overdesignPercent : 20}
                            onChange={e => handleUpdateSystemField(sys.id, 'overdesignPercent', e.target.value === '' ? '' : Number(e.target.value))}
                            onBlur={e => {
                              const val = e.target.value === '' ? 20 : Math.max(0, Math.min(100, Number(e.target.value)));
                              handleUpdateSystemField(sys.id, 'overdesignPercent', val);
                            }}
                            className="print:hidden w-full p-2 bg-white border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                          />
                          <p className="print:hidden text-[9px] text-slate-400 mt-1">Margine di sicurezza applicato alle portate nominali di mandata e ripresa.</p>
                        </div>

                        {isRecirc && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Percentuale Aria Esterna (Fresh Air %)
                            </label>
                            <span className="hidden print:inline font-mono font-bold text-slate-800 text-xs">
                              {sys.freshAirPercent !== undefined ? sys.freshAirPercent : 15}%
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={sys.freshAirPercent !== undefined ? sys.freshAirPercent : 15}
                              onChange={e => handleUpdateSystemField(sys.id, 'freshAirPercent', e.target.value === '' ? '' : Number(e.target.value))}
                              onBlur={e => {
                                const val = e.target.value === '' ? 15 : Math.max(0, Math.min(100, Number(e.target.value)));
                                handleUpdateSystemField(sys.id, 'freshAirPercent', val);
                              }}
                              className="print:hidden w-full p-2 bg-white border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                            />
                            <p className="print:hidden text-[9px] text-slate-400 mt-1">Quota minima di aria fresca esterna garantita per il ricircolo.</p>
                          </div>
                        )}
                      </div>

                      {/* Flow Values Nominal Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Mandata */}
                        <div className="p-4 bg-blue-50/40 rounded-2xl border border-blue-100">
                          <p className="text-[9px] text-blue-600 uppercase font-black tracking-wider mb-1">Mandata Nominale</p>
                          <p className="text-xl font-black font-mono text-blue-700">
                            {s.Q_mandata} <span className="text-xs font-normal">m³/h</span>
                          </p>
                          <p className="text-[9px] text-slate-400 mt-2">Mandata totale + sovradimensionamento ({s.S}%), arrotondato a 100.</p>
                        </div>

                        {/* Ripresa */}
                        <div className="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-100">
                          <p className="text-[9px] text-emerald-600 uppercase font-black tracking-wider mb-1">Ripresa Nominale</p>
                          <p className="text-xl font-black font-mono text-emerald-700">
                            {s.Q_ripresa} <span className="text-xs font-normal">m³/h</span>
                          </p>
                          <p className="text-[9px] text-slate-400 mt-2">Ripresa totale + sovradimensionamento ({s.S}%), arrotondato a 100.</p>
                        </div>

                        {/* Aria Esterna */}
                        <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100">
                          <p className="text-[9px] text-indigo-600 uppercase font-black tracking-wider mb-1">Aria Esterna (Rinnovo)</p>
                          <p className="text-xl font-black font-mono text-indigo-700">
                            {s.Q_ariaEsterna} <span className="text-xs font-normal">m³/h</span>
                          </p>
                          <p className="text-[9px] text-slate-400 mt-2">
                            {isRecirc 
                              ? `Maggiore tra il ${s.Pfresh}% della mandata e il bilancio aeraulico locale.` 
                              : 'Pari al 100% della mandata (sistema a tutta aria esterna).'}
                          </p>
                        </div>

                        {/* Aria Espulsa HVAC */}
                        <div className="p-4 bg-orange-50/40 rounded-2xl border border-orange-100">
                          <p className="text-[9px] text-orange-600 uppercase font-black tracking-wider mb-1">Aria Espulsa da HVAC</p>
                          <p className="text-xl font-black font-mono text-orange-700">
                            {s.Q_espulsaHvac} <span className="text-xs font-normal">m³/h</span>
                          </p>
                          <p className="text-[9px] text-slate-400 mt-2">Portata espulsa dall'UTA per bilanciare l'immissione di aria esterna.</p>
                        </div>

                        {/* Estrazioni Localizzate */}
                        <div className="p-4 bg-rose-50/40 rounded-2xl border border-rose-100">
                          <p className="text-[9px] text-rose-600 uppercase font-black tracking-wider mb-1">Espulsione Estrazioni</p>
                          <p className="text-xl font-black font-mono text-rose-700">
                            {s.Q_localExhaust} <span className="text-xs font-normal">m³/h</span>
                          </p>
                          <p className="text-[9px] text-slate-400 mt-2">Somma delle estrazioni localizzate dei locali ({s.S}% incl.), arrotondato a 100.</p>
                        </div>
                      </div>

                      {/* Mass Balance Check Box */}
                      <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-[10px] space-y-2">
                        <div className="font-bold text-slate-800 uppercase text-[9px] tracking-wider">
                          ⚖️ Verifica Bilancio di Massa dell'Unità di Trattamento Aria (UTA)
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                          <div className="p-2 bg-white rounded-lg border border-slate-100">
                            <span className="text-slate-500 text-[10px] block uppercase font-bold">Flussi in Ingresso in UTA</span>
                            <div className="mt-1 text-slate-800">
                              Aria Esterna ({s.Q_ariaEsterna}) + Ripresa ({s.Q_ripresa}) = <span className="font-black text-blue-600">{s.Q_ariaEsterna + s.Q_ripresa} m³/h</span>
                            </div>
                          </div>
                          <div className="p-2 bg-white rounded-lg border border-slate-100">
                            <span className="text-slate-500 text-[10px] block uppercase font-bold">Flussi in Uscita da UTA</span>
                            <div className="mt-1 text-slate-800">
                              Mandata ({s.Q_mandata}) + Espulsione HVAC ({s.Q_espulsaHvac}) = <span className="font-black text-emerald-600">{s.Q_mandata + s.Q_espulsaHvac} m³/h</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-[9px] text-slate-400 italic mt-1">
                          {s.Q_ariaEsterna + s.Q_ripresa === s.Q_mandata + s.Q_espulsaHvac 
                            ? '✅ Bilancio di massa UTA perfettamente verificato (0 m³/h di disavanzo).' 
                            : '⚠️ Lieve scostamento nel bilancio dovuto all\'arrotondamento separato dei singoli flussi.'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
            {/* Help Sidebar */}
            <div className="lg:col-span-1 bg-amber-50/60 border border-amber-200/60 rounded-3xl p-5 space-y-4 print:hidden self-start shadow-sm text-xs text-slate-655 leading-relaxed">
              <h5 className="font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wide text-[10px]">
                💡 Guida: Portate HVAC
              </h5>
              <p>In questa scheda configuri e verifichi le portate nominali delle UTA del progetto:</p>
              <ul className="list-disc pl-4 space-y-2">
                <li><strong>Sovradimensionamento</strong>: Margine applicato alle portate nominali calcolate per coprire le perdite d'aria dei canali e variazioni d'esercizio (default 20%).</li>
                <li><strong>Aria Esterna (UTA)</strong>:
                  <ul className="list-circle pl-4 mt-0.5 space-y-0.5">
                    <li>In <em>Tutta Aria Esterna</em>: coincide con la mandata.</li>
                    <li>In <em>Parziale Ricircolo</em>: è la portata minima protettiva, pari al massimo tra la percentuale impostata (default 15%) e il fabbisogno di compensazione dei locali.</li>
                  </ul>
                </li>
                <li><strong>Aria Espulsa HVAC</strong>: Portata espulsa dall'UTA per bilanciare l'ingresso di aria esterna in eccesso.</li>
                <li><strong>Arrotondamento</strong>: Tutti i flussi nominali sono arrotondati ai <strong>100 m³/h superiori</strong> come da prassi per il dimensionamento delle macchine.</li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 5: Check Aria di Rinnovo */}
        {activeTab === 'freshAirCheck' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block">
            <div className="lg:col-span-3 space-y-6 print:w-full">
            {/* Top Controls Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Parametri Normativi di Riferimento (EN 16798-1:2019)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Livello di Aspettativa (Qualità dell'Aria IAQ)
                  </label>
                  <span className="hidden print:inline font-bold text-slate-800 text-xs">
                    {expectationLevel === 'alto' ? 'Alto (Categoria I - 36 m³/h per persona)' :
                     expectationLevel === 'medio' ? 'Medio / Normale (Categoria II - 25.2 m³/h per persona)' :
                     expectationLevel === 'moderato' ? 'Moderato (Categoria III - 14.4 m³/h per persona)' :
                     'Basso (Categoria IV - 9 m³/h per persona)'}
                  </span>
                  <select
                    value={expectationLevel}
                    onChange={e => setExpectationLevel(e.target.value as any)}
                    className="print:hidden w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="alto">Alto (Categoria I - 36 m³/h per persona)</option>
                    <option value="medio">Medio / Normale (Categoria II - 25.2 m³/h per persona)</option>
                    <option value="moderato">Moderato (Categoria III - 14.4 m³/h per persona)</option>
                    <option value="basso">Basso (Categoria IV - 9 m³/h per persona)</option>
                  </select>
                  <p className="print:hidden text-[9px] text-slate-455 mt-1">
                    Determina il tasso d'aria esterna specifico per occupante (q_p). Il valore predefinito è Medio / Normale.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Categoria Inquinamento dell'Edificio (Edificio emissioni)
                  </label>
                  <span className="hidden print:inline font-bold text-slate-800 text-xs">
                    {pollutionCategory === 'very_low' ? 'Bassissimo Inquinamento (Materiali a bassissima emissione - Very Low-Polluting)' :
                     pollutionCategory === 'low' ? 'Basso Inquinamento (Standard - Low-Polluting)' :
                     'Non a Basso Inquinamento (Edifici standard / storici - Non-Low-Polluting)'}
                  </span>
                  <select
                    value={pollutionCategory}
                    onChange={e => setPollutionCategory(e.target.value as any)}
                    className="print:hidden w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="very_low">Bassissimo Inquinamento (Materiali a bassissima emissione - Very Low-Polluting)</option>
                    <option value="low">Basso Inquinamento (Standard - Low-Polluting)</option>
                    <option value="non_low">Non a Basso Inquinamento (Edifici standard / storici - Non-Low-Polluting)</option>
                  </select>
                  <p className="print:hidden text-[9px] text-slate-455 mt-1">
                    Determina la portata specifica legata alle emissioni dei materiali per unità di superficie (q_B).
                  </p>
                </div>
              </div>
            </div>

            {/* Systems loop */}
            {systemCalculations.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center text-slate-500">
                Nessun sistema HVAC configurato. Aggiungi un sistema nel tab "Configurazione" per procedere.
              </div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  // Lookup values directly in m³/h from UNI EN 16798-1 Excel
                  const qp_table = { alto: 36, medio: 25.2, moderato: 14.4, basso: 9 };
                  const qB_table = {
                    very_low: { alto: 1.8, medio: 1.26, moderato: 0.72, basso: 0.36 },
                    low: { alto: 3.6, medio: 2.52, moderato: 1.44, basso: 0.72 },
                    non_low: { alto: 7.2, medio: 5.04, moderato: 2.88, basso: 1.44 }
                  };
                  
                  const qp = qp_table[expectationLevel] || 25.2;
                  const qB = qB_table[pollutionCategory]?.[expectationLevel] || 2.52;

                  let totalRoomsChecked = 0;

                  const renderedSystems = systems.map(sys => {
                    const sysCalcs = roomCalculations.filter(c => c.room.systemId === sys.id && num(c.room.peopleCount) > 0);
                    if (sysCalcs.length === 0) return null;
                    
                    totalRoomsChecked += sysCalcs.length;

                    return (
                      <div key={sys.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                        <div className="border-b border-slate-100 pb-2">
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
                                <th className="py-2.5 px-2 text-right font-mono">Superficie (m²)</th>
                                <th className="py-2.5 px-2 text-right font-mono">N. Persone</th>
                                <th className="py-2.5 px-2 text-center">Fattori q_p / q_B</th>
                                <th className="py-2.5 px-2 text-right font-mono bg-blue-50/30">Minimo Normativo (m³/h)</th>
                                <th className="py-2.5 px-2 text-right font-mono bg-indigo-50/30">Rinnovo Progetto (m³/h)</th>
                                <th className="py-2.5 px-2 text-center">Stato Verifica</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sysCalcs.map(c => {
                                const N = num(c.room.peopleCount);
                                const A = num(c.room.area);
                                // Portata minima normata (m3/h) = N * qp + A * qB (dati gia in m3/h da Excel)
                                const rawMin = N * qp + A * qB;
                                const minFreshAir = Math.round(rawMin);
                                
                                // Portata progetto = mandata calcolata prima del sovradimensionamento
                                const freshAirProj = Math.round(c.calculatedFlow);
                                
                                const isDeficient = freshAirProj < minFreshAir;

                                return (
                                  <tr key={c.room.id} className="border-b border-slate-100 hover:bg-slate-50/45 text-[10px]">
                                    <td className="py-3 px-2">
                                      <div className="font-bold font-mono text-slate-800">{c.room.code}</div>
                                      <div className="text-[9px] text-slate-400 truncate max-w-[120px]" title={c.room.description}>
                                        {c.room.description}
                                      </div>
                                    </td>
                                    <td className="py-3 px-2 font-mono text-right">{formatNumber(A, 1)} m²</td>
                                    <td className="py-3 px-2 font-mono text-right font-bold text-slate-700">{N}</td>
                                    <td className="py-3 px-2 text-center text-slate-500 font-sans">
                                      {qp} m³/h·p | {qB} m³/h·m²
                                    </td>
                                    <td className="py-3 px-2 font-mono text-right font-bold text-blue-700 bg-blue-50/15">
                                      {minFreshAir} m³/h
                                    </td>
                                    <td className="py-3 px-2 font-mono text-right font-bold text-indigo-700 bg-indigo-50/15">
                                      {freshAirProj} m³/h
                                    </td>
                                    <td className="py-3 px-2 text-center whitespace-nowrap">
                                      {isDeficient ? (
                                        <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-red-100 text-red-800 border border-red-200 animate-pulse whitespace-nowrap">
                                          🚨 Non Accettabile
                                        </span>
                                      ) : (
                                        <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-green-100 text-green-800 border border-green-200 whitespace-nowrap">
                                          ✅ Conforme
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  });

                  if (totalRoomsChecked === 0) {
                    return (
                      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center text-slate-500">
                        Nessun locale con presenza di personale (Persone &gt; 0) configurato per i sistemi.
                      </div>
                    );
                  }

                  return renderedSystems;
                })()}
              </div>
            )}

            </div>
            {/* Help Sidebar */}
            <div className="lg:col-span-1 bg-amber-50/60 border border-amber-200/60 rounded-3xl p-5 space-y-4 print:hidden self-start shadow-sm text-xs text-slate-655 leading-relaxed">
              <h5 className="font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wide text-[10px]">
                💡 Guida: Rinnovo EN 16798-1
              </h5>
              <p>In questa scheda esegui la verifica di conformità dell'apporto di aria esterna in accordo alla norma EN 16798-1:2019:</p>
              <ul className="list-disc pl-4 space-y-2">
                <li><strong>Filtro Locali</strong>: Vengono controllati esclusivamente i locali con personale attivo (occupazione &gt; 0).</li>
                <li><strong>Formula di Calcolo</strong>:
                  <div className="font-serif font-bold text-[9.5px] text-slate-800 bg-white/70 p-1.5 rounded-lg border border-amber-100 text-center my-1.5">
                    Q<sub>min</sub> = [ (N × q<sub>p</sub>) + (A × q<sub>B</sub>) ] [m³/h]
                  </div>
                </li>
                <li><strong>Tasso per persona (q_p)</strong>: Portata per diluire l'anidride carbonica e gli inquinanti umani (da 9 a 36 m³/h·p).</li>
                <li><strong>Tasso edificio (q_B)</strong>: Portata per m² per diluire i COV emessi dai materiali dell'edificio in base al livello emissivo (da 0.36 a 7.2 m³/h·m²).</li>
                <li><strong>Conformità</strong>: Se la portata d'aria di progetto del locale (mandata pura prima del sovradimensionamento) è inferiore a Q_min, si attiva la notifica <strong>🚨 Non Accettabile</strong>.</li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 6: Batterie di Post */}
        {activeTab === 'reheat' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block">
            <div className="lg:col-span-3 bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-6 print:w-full">
              <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Calcolo Dimensionamento Batterie di Post-Riscaldamento (RC)
                </h4>
                <button
                  onClick={handleAddReheatBattery}
                  className="print:hidden px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Aggiungi Batteria
                </button>
              </div>

              <div className="overflow-x-auto text-[10px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[8px] bg-slate-50/50">
                      <th className="py-2.5 px-2">Batteria / Locale</th>
                      <th className="py-2.5 px-2 text-right font-mono">Portata Mandata (m³/h)</th>
                      <th className="py-2.5 px-2 text-center bg-blue-50/20">Inverno Temp. (Monte/Valle)</th>
                      <th className="py-2.5 px-2 text-right font-mono bg-blue-50/20">Inverno Potenza (Cal/Proj)</th>
                      <th className="py-2.5 px-2 text-center bg-orange-50/20">Estate Temp. (Monte/Valle)</th>
                      <th className="py-2.5 px-2 text-right font-mono bg-orange-50/20">Estate Potenza (Cal/Proj)</th>
                      <th className="py-2.5 px-2 text-center bg-slate-100 font-bold">Potenza Progetto (kW)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reheatBatteries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold italic bg-slate-50/30">
                          Nessuna batteria di post-riscaldo configurata. Fai clic su "+ Aggiungi Batteria" per iniziare.
                        </td>
                      </tr>
                    ) : (
                      batteryCalculations.map(bc => {
                        const b = bc.battery;
                        const freeRooms = rooms.filter(r => !reheatBatteries.some(batt => batt.roomIds.includes(r.id)));
                        
                        return (
                          <React.Fragment key={b.id}>
                            {/* Riga Batteria */}
                            <tr className={"border-b border-slate-200 hover:bg-slate-100/50 " + (bc.hasConflict ? "bg-red-50/60 text-red-900 border-red-200" : "bg-slate-50/70")}>
                              <td className="py-3 px-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="hidden print:inline font-black font-mono text-xs text-slate-800">
                                    {b.name}
                                  </span>
                                  <input
                                    type="text"
                                    value={b.name}
                                    onChange={e => handleUpdateBatteryField(b.id, 'name', e.target.value)}
                                    className="print:hidden p-1 border border-slate-300 rounded-lg w-24 font-black font-mono text-center bg-white text-xs text-slate-800 outline-none focus:border-blue-500"
                                    title="Riferimento batteria"
                                  />
                                  
                                  <select
                                    onChange={e => {
                                      if (e.target.value) {
                                        handleAssignRoomToBattery(b.id, e.target.value);
                                        e.target.value = '';
                                      }
                                    }}
                                    className="print:hidden p-1 border border-slate-250 bg-white rounded-lg text-[9px] font-semibold text-slate-655 outline-none focus:border-blue-500 max-w-[120px]"
                                    defaultValue=""
                                  >
                                    <option value="" disabled>+ Aggiungi Locale</option>
                                    {freeRooms.map(r => (
                                      <option key={r.id} value={r.id}>
                                        {r.code} ({r.description || 'Senza nome'})
                                      </option>
                                    ))}
                                  </select>

                                  <button
                                    onClick={() => handleRemoveReheatBattery(b.id)}
                                    className="print:hidden p-1 hover:bg-red-100 text-red-500 rounded transition-colors"
                                    title="Elimina questa batteria"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                
                                {bc.hasConflict && (
                                  <div className="text-[8px] text-red-650 font-black uppercase mt-1 animate-pulse space-y-0.5">
                                    {bc.hasValleWinterConflict && <div>🚨 ALARM: T. Valle Inverno non uniforme!</div>}
                                    {bc.hasValleSummerConflict && <div>🚨 ALARM: T. Valle Estate non uniforme!</div>}
                                    {bc.hasSystemConflict && <div>🚨 ALARM: Locali appartenenti a sistemi diversi!</div>}
                                  </div>
                                )}
                              </td>

                              <td className="py-3 px-2 font-mono text-right text-slate-800 font-black text-xs">
                                {formatNumber(bc.totalFlow, 0)}
                              </td>

                              {/* Inverno - Temp. Monte/Valle */}
                              <td className="py-2.5 px-2 bg-blue-50/10 text-center space-y-1">
                                <div className="flex items-center justify-center gap-1">
                                  <span className="text-[8px] text-slate-400 font-bold uppercase">Monte:</span>
                                  <span className="hidden print:inline font-mono font-bold text-slate-800 text-[10px]">
                                    {formatNumber(b.upstreamTempWinter, 1)} °C
                                  </span>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={b.upstreamTempWinter}
                                    onChange={e => handleUpdateBatteryField(b.id, 'upstreamTempWinter', e.target.value === '' ? '' : Number(e.target.value))}
                                    onBlur={e => {
                                      const val = e.target.value === '' ? 18.2 : Number(e.target.value);
                                      handleUpdateBatteryField(b.id, 'upstreamTempWinter', val);
                                    }}
                                    className="print:hidden w-14 p-0.5 text-center rounded bg-white border border-slate-200 font-semibold font-mono text-[9px] outline-none focus:border-blue-500"
                                  />
                                </div>
                                <div className="text-[9px] text-slate-650 font-bold">
                                  Valle: <span className="font-mono">{bc.hasValleWinterConflict ? 'Disomogenea' : (formatNumber(bc.tValleWinter, 1) + '°C')}</span>
                                </div>
                              </td>

                              {/* Inverno - Potenza Cal/Proj */}
                              <td className="py-2.5 px-2 bg-blue-50/10 font-mono text-right space-y-0.5">
                                <div className="text-slate-500 text-[8px]">Cal: {formatNumber(bc.kW_w, 2)} kW</div>
                                <div className="text-blue-800 font-bold text-[9px]">Proj: {formatNumber(bc.designKW_w, 2)} kW</div>
                              </td>

                              {/* Estate - Temp. Monte/Valle */}
                              <td className="py-2.5 px-2 bg-orange-50/10 text-center space-y-1">
                                <div className="flex items-center justify-center gap-1">
                                  <span className="text-[8px] text-slate-400 font-bold uppercase">Monte:</span>
                                  <span className="hidden print:inline font-mono font-bold text-slate-800 text-[10px]">
                                    {formatNumber(b.upstreamTempSummer, 1)} °C
                                  </span>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={b.upstreamTempSummer}
                                    onChange={e => handleUpdateBatteryField(b.id, 'upstreamTempSummer', e.target.value === '' ? '' : Number(e.target.value))}
                                    onBlur={e => {
                                      const val = e.target.value === '' ? 13.0 : Number(e.target.value);
                                      handleUpdateBatteryField(b.id, 'upstreamTempSummer', val);
                                    }}
                                    className="print:hidden w-14 p-0.5 text-center rounded bg-white border border-slate-200 font-semibold font-mono text-[9px] outline-none focus:border-blue-500"
                                  />
                                </div>
                                <div className="text-[9px] text-slate-650 font-bold">
                                  Valle: <span className="font-mono">{bc.hasValleSummerConflict ? 'Disomogenea' : (formatNumber(bc.tValleSummer, 1) + '°C')}</span>
                                </div>
                              </td>

                              {/* Estate - Potenza Cal/Proj */}
                              <td className="py-2.5 px-2 bg-orange-50/10 font-mono text-right space-y-0.5">
                                <div className="text-slate-500 text-[8px]">Cal: {formatNumber(bc.kW_s, 2)} kW</div>
                                <div className="text-orange-700 font-bold text-[9px]">Proj: {formatNumber(bc.designKW_s, 2)} kW</div>
                              </td>

                              {/* Potenza Progetto Batteria Finale (MAX) */}
                              <td className="py-2.5 px-2 bg-slate-100 font-mono text-center">
                                <div className="font-black text-[11px] text-slate-800">
                                  {formatNumber(bc.finalDesignKW, 2)} kW
                                </div>
                                <div className="text-[8px] text-slate-450 mt-0.5 font-bold">
                                  {bc.designKW_w >= bc.designKW_s ? 'Max: Inverno' : 'Max: Estate'}
                                </div>
                              </td>
                            </tr>

                            {/* Stanze incluse */}
                            {bc.assignedRooms.map(r => {
                              const rCalc = bc.sysCalcs.find(c => c.room.id === r.id);
                              if (!rCalc) return null;
                              
                              const adoptedFlow = (r.adoptedFlow !== undefined && r.adoptedFlow !== null && r.adoptedFlow !== '')
                                ? num(r.adoptedFlow)
                                : Math.ceil(rCalc.calculatedFlow / 10) * 10;

                              return (
                                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/30 text-[9px] bg-slate-50/15">
                                  <td className="py-2 px-2 pl-8 flex items-center justify-between gap-2">
                                    <div className="font-semibold text-slate-600">
                                      └─ {r.code} <span className="text-slate-450 font-normal">({r.description || 'Senza nome'})</span>
                                    </div>
                                    <button
                                      onClick={() => handleUnassignRoomFromBattery(b.id, r.id)}
                                      className="print:hidden text-slate-400 hover:text-red-500 font-bold px-1 transition-colors text-xs"
                                      title="Rimuovi questo locale"
                                    >
                                      &times;
                                    </button>
                                  </td>
                                  
                                  <td className="py-2 px-2 font-mono text-right text-slate-500">
                                    {formatNumber(adoptedFlow, 0)}
                                  </td>

                                  <td className="py-2 px-2 text-center text-slate-500 bg-blue-50/5">
                                    Valle: {formatNumber(r.supplyTempWinter, 1)}°C
                                  </td>
                                  <td className="bg-blue-50/5"></td>

                                  <td className="py-2 px-2 text-center text-slate-500 bg-orange-50/5">
                                    Valle: {formatNumber(r.supplyTempSummer, 1)}°C
                                  </td>
                                  <td className="bg-orange-50/5"></td>

                                  <td className="bg-slate-50/10"></td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })
                    )}

                    {/* Riga Totale */}
                    {reheatBatteries.length > 0 && (
                      <tr className="bg-slate-200/80 font-black text-slate-800 border-t border-slate-350 text-[10px]">
                        <td className="py-3 px-2">TOTALE COMPLESSIVO BATTERIE</td>
                        <td className="py-3 px-2 text-right font-mono font-black text-xs">
                          {formatNumber(batteryCalculations.reduce((sum, bc) => sum + bc.totalFlow, 0), 0)}
                        </td>
                        <td className="bg-blue-50/10"></td>
                        <td className="py-3 px-2 text-right font-mono bg-blue-50/10 space-y-0.5">
                          <div className="text-slate-500 text-[8px]">Cal: {formatNumber(batteryCalculations.reduce((sum, bc) => sum + bc.kW_w, 0), 2)} kW</div>
                          <div className="text-blue-800 font-bold text-[9px]">Proj: {formatNumber(batteryCalculations.reduce((sum, bc) => sum + bc.designKW_w, 0), 2)} kW</div>
                        </td>
                        <td className="bg-orange-50/10"></td>
                        <td className="py-3 px-2 text-right font-mono bg-orange-50/10 space-y-0.5">
                          <div className="text-slate-500 text-[8px]">Cal: {formatNumber(batteryCalculations.reduce((sum, bc) => sum + bc.kW_s, 0), 2)} kW</div>
                          <div className="text-orange-700 font-bold text-[9px]">Proj: {formatNumber(batteryCalculations.reduce((sum, bc) => sum + bc.designKW_s, 0), 2)} kW</div>
                        </td>
                        <td className="py-3 px-2 text-center bg-slate-200">
                          <div className="font-black text-[11px] text-slate-800">
                            {formatNumber(batteryCalculations.reduce((sum, bc) => sum + bc.finalDesignKW, 0), 2)} kW
                          </div>
                          <div className="text-[8px] text-slate-550 font-bold">Sum(Max)</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="print:hidden bg-amber-50 text-amber-900 text-[10px] p-3 rounded-2xl border border-amber-250/60 leading-relaxed">
                <strong>Equazioni e Note:</strong>
                <ul className="list-disc pl-4 space-y-1 mt-1">
                  <li><strong>Potenza di Post-Riscaldo ($kcal/h$)</strong> = Portata Aria ($m^3/h$) × (T_valle - T_monte) × 0.3.</li>
                  <li><strong>Portata Acqua ($l/h$)</strong> = Potenza ($kW$) × 860 / Delta T.</li>
                  <li>La potenza finale di progetto di ciascuna batteria di post-riscaldo è presa come la <strong>maggiore delle due potenze di progetto</strong> calcolate per la stagione invernale e per la stagione estiva.</li>
                  <li>Il sovradimensionamento viene prelevato in automatico dal fattore specificato per ciascun sistema nel tab *4. Riepilogo Portate HVAC*.</li>
                  <li><strong>Nota sui Diametri e Valvole (di primo tentativo):</strong> I diametri della linea tubo e i Kvs delle valvole consigliati sono indicativi (di primo tentativo) e devono essere verificati e confermati con le perdite di carico effettive della rete di distribuzione idronica.</li>
                </ul>
              </div>
            </div>
            {/* Help Sidebar e widget locali non assegnati */}
            <div className="lg:col-span-1 bg-slate-50 border border-slate-200/80 rounded-3xl p-5 space-y-5 print:hidden self-start shadow-sm text-xs text-slate-655">
              {/* Widget Locali Liberi */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[9px] flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full"></span>
                  Locali Liberi ({rooms.filter(r => !reheatBatteries.some(b => b.roomIds.includes(r.id))).length})
                </h5>
                <p className="text-[10px] text-slate-400">
                  Stanze che non sono ancora collegate a nessuna batteria di post-riscaldo:
                </p>
                <div className="max-h-[160px] overflow-y-auto pr-1 space-y-1 text-[10px] font-mono">
                  {rooms.filter(r => !reheatBatteries.some(b => b.roomIds.includes(r.id))).length === 0 ? (
                    <div className="text-slate-455 italic text-[10px] py-1">Tutti i locali sono assegnati!</div>
                  ) : (
                    rooms.filter(r => !reheatBatteries.some(b => b.roomIds.includes(r.id))).map(r => (
                      <div key={r.id} className="p-1.5 bg-slate-50 rounded border border-slate-200 flex justify-between items-center">
                        <span className="font-bold text-slate-700">{r.code}</span>
                        <span className="text-[8px] text-slate-450 truncate max-w-[80px]" title={r.description}>
                          {r.description || 'Senza descr.'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Guida standard */}
              <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-100 shadow-sm space-y-3 text-slate-655 leading-relaxed">
                <h5 className="font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wide text-[10px]">
                  💡 Guida: Batterie di Post
                </h5>
                <p>
                  Questa tabella mostra il dimensionamento delle batterie di post-riscaldamento locali per l'inverno e l'estate:
                </p>
                <ul className="list-disc pl-4 space-y-2">
                  <li><strong>T. Monte Batteria</strong>: Temperatura dell'aria in ingresso alla batteria (inserita manualmente, default 18.2°C in inverno e 13.0°C in estate).</li>
                  <li><strong>T. Valle Batteria</strong>: Temperatura di immissione nei locali serviti in condizioni estive/invernali (letta in automatico dai locali assegnati).</li>
                  <li><strong>Potenza di Progetto (kW)</strong>: Potenza termica comprensiva del sovradimensionamento impostato.</li>
                  <li><strong>Potenza Finale della Batteria</strong>: Determinata come il valore massimo (Max) tra la potenza di progetto invernale ed estiva.</li>
                  <li><strong>Vincolo di Accorpamento</strong>: I locali associati alla stessa batteria devono appartenere allo stesso sistema HVAC e avere le stesse temperature di immissione estiva/invernale.</li>
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
                      <th className="py-2.5 px-2 font-mono text-right">Espulsione in UTA (m³/h)</th>
                      <th className="py-2.5 px-2 font-mono text-right">Estrazioni Localizzate (m³/h)</th>
                      <th className="py-2.5 px-2 font-mono text-right">Aria Esterna (Primaria)</th>
                      <th className="py-2.5 px-2 text-right">Percentuale Rinnovo (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemCalculations.map(s => (
                      <tr key={'ahu-air-' + s.system.id} className="border-b border-slate-100 hover:bg-slate-50/45">
                        <td className="py-2.5 px-2 font-bold font-mono">{s.system.name}</td>
                        <td className="py-2.5 px-2 font-mono text-right font-semibold text-blue-700">{formatNumber(s.Q_mandata, 0)}</td>
                        <td className="py-2.5 px-2 font-mono text-right text-green-700">{formatNumber(s.Q_ripresa, 0)}</td>
                        <td className="py-2.5 px-2 font-mono text-right text-orange-700">{formatNumber(s.Q_espulsaHvac, 0)}</td>
                        <td className="py-2.5 px-2 font-mono text-right text-rose-700">{formatNumber(s.Q_localExhaust, 0)}</td>
                        <td className="py-2.5 px-2 font-mono text-right font-bold text-slate-800">{formatNumber(s.Q_ariaEsterna, 0)}</td>
                        <td className="py-2.5 px-2 font-mono text-right font-bold text-indigo-700">{formatNumber(s.rinnovoPercent, 1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TABELLA 2: DIMENSIONAMENTO IDRAULICO DELLE BATTERIE (UTA & POST-RISCALDO LOCALI) */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Dimensionamento Idraulico delle Batterie (UTA & Post-Riscaldo Locali)
                </h4>
                <button
                  onClick={handleAddManualBattery}
                  className="print:hidden px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Aggiungi Batteria Manuale
                </button>
              </div>

              <div className="overflow-x-auto text-[10px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px] bg-slate-50/50">
                      <th className="py-2.5 px-2">Riferimento Batteria</th>
                      <th className="py-2.5 px-2">Tipo</th>
                      <th className="py-2.5 px-2 font-mono text-center">Potenza Progetto (kW)</th>
                      <th className="py-2.5 px-2 font-mono text-center">Delta T (°C)</th>
                      <th className="py-2.5 px-2 font-mono text-right">Portata H2O / Fluido</th>
                      <th className="py-2.5 px-2">Diametro Linea Tubo (di primo tentativo)</th>
                      <th className="py-2.5 px-2">Valvola <span className="print:hidden">Consigliata</span> (di primo tentativo)</th>
                      <th className="py-2.5 px-2 text-center print:hidden">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Generazione righe per batterie di post-riscaldo (automatiche) */}
                    {batteryCalculations.map(bc => {
                      if (bc.finalDesignKW <= 0) return null;
                      
                      const dT = bc.battery.deltaT !== undefined && bc.battery.deltaT !== '' ? num(bc.battery.deltaT) : 5;
                      const hasValidDT = bc.battery.deltaT !== undefined && bc.battery.deltaT !== '' && num(bc.battery.deltaT) > 0;
                      
                      const bWaterFlow = hasValidDT ? (bc.finalDesignKW * 860) / dT : 0;
                      const dnHotCalcolato = hasValidDT ? getPipeSizeDN(bWaterFlow) : '-';
                      const valveHotCalcolata = hasValidDT ? getValveKvs(bWaterFlow) : '-';
                      const roomCodes = bc.assignedRooms.map(r => r.code).join(', ');
                      
                      const dnHotFinal = bc.battery.customPipeSize || dnHotCalcolato;
                      const valveHotFinal = bc.battery.customValveKvs || valveHotCalcolata;
                      
                      return (
                        <tr key={'post-' + bc.battery.id} className="border-b border-slate-100 hover:bg-slate-50/45">
                          <td className="py-2.5 px-2 font-mono text-slate-700 font-semibold" title={"Locali: " + roomCodes}>
                            {bc.battery.name} ({roomCodes || 'Nessun locale'})
                          </td>
                          <td className="py-2.5 px-2 text-orange-655 font-bold text-[10px]">Post-Riscaldo Caldo</td>
                          <td className="py-2.5 px-2 font-mono text-center text-slate-700 font-bold">{formatNumber(bc.finalDesignKW, 2)}</td>
                          <td className="py-2 px-2 text-center">
                            <span className="hidden print:inline font-mono font-bold text-slate-800">
                              {dT} °C
                            </span>
                            <input
                              type="number"
                              min={0.1}
                              step="0.5"
                              value={bc.battery.deltaT !== undefined ? bc.battery.deltaT : 5}
                              onChange={e => {
                                const val = e.target.value === '' ? '' : Number(e.target.value);
                                handleUpdateBatteryField(bc.battery.id, 'deltaT', val);
                              }}
                              className="print:hidden w-16 p-1 text-center bg-slate-50 border border-slate-200 rounded-lg font-mono text-[10px] outline-none focus:border-blue-500 font-bold text-slate-800"
                            />
                          </td>
                          <td className="py-2.5 px-2 font-mono text-right text-orange-850 font-bold">
                            {hasValidDT ? formatNumber(bWaterFlow, 0) + ' l/h' : '-'}
                          </td>
                          
                          {/* Diametro Tubo (Select Override) */}
                          <td className="py-2 px-2">
                            <span className="hidden print:inline font-mono font-bold text-slate-850">
                              {hasValidDT ? dnHotFinal : '-'}
                            </span>
                            <select
                              value={bc.battery.customPipeSize || 'auto'}
                              onChange={e => {
                                const val = e.target.value === 'auto' ? undefined : e.target.value;
                                handleUpdateBatteryField(bc.battery.id, 'customPipeSize', val);
                              }}
                              className="print:hidden w-full p-1 bg-slate-50 border border-slate-200 rounded-lg text-[9px] font-bold outline-none focus:border-blue-500 text-slate-700"
                              disabled={!hasValidDT}
                            >
                              <option value="auto">
                                {hasValidDT ? `Consigliato (${dnHotCalcolato})` : '-'}
                              </option>
                              {hasValidDT && PIPE_DN_OPTIONS.map(dn => (
                                <option key={dn} value={dn}>{dn}</option>
                              ))}
                            </select>
                          </td>
                          
                          {/* Valvola Consigliata (Select Override) */}
                          <td className="py-2 px-2">
                            <span className="hidden print:inline font-mono font-bold text-slate-850">
                              {hasValidDT ? valveHotFinal : '-'}
                            </span>
                            <select
                              value={bc.battery.customValveKvs || 'auto'}
                              onChange={e => {
                                const val = e.target.value === 'auto' ? undefined : e.target.value;
                                handleUpdateBatteryField(bc.battery.id, 'customValveKvs', val);
                              }}
                              className="print:hidden w-full p-1 bg-slate-50 border border-slate-200 rounded-lg text-[9px] font-bold outline-none focus:border-blue-500 text-slate-700"
                              disabled={!hasValidDT}
                            >
                              <option value="auto">
                                {hasValidDT ? `Consigliata (${valveHotCalcolata})` : '-'}
                              </option>
                              {hasValidDT && VALVE_KVS_OPTIONS.map(v => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </td>
                          
                          <td className="py-2.5 px-2 text-center text-slate-400 font-semibold italic text-[9px] bg-slate-50/50 print:hidden">
                            Auto (Tab 6)
                          </td>
                        </tr>
                      );
                    })}

                    {/* Generazione righe per batterie manuali */}
                    {manualBatteries.map(mb => {
                      const isUmid = mb.type === 'umidificazione';
                      const dT = mb.deltaT !== undefined && mb.deltaT !== '' ? num(mb.deltaT) : 5;
                      const hasValidDT = !isUmid && mb.deltaT !== undefined && mb.deltaT !== '' && num(mb.deltaT) > 0;
                      
                      const p_kW = num(mb.power_kW);
                      const calculatedFlow = hasValidDT ? (p_kW * 860) / dT : 0;
                      const dnCalcolato = hasValidDT ? getPipeSizeDN(calculatedFlow) : '-';
                      const valveCalcolata = hasValidDT ? getValveKvs(calculatedFlow) : '-';
                      
                      const dnFinal = mb.customPipeSize || dnCalcolato;
                      const valveFinal = mb.customValveKvs || valveCalcolata;
                      
                      return (
                        <tr key={'manual-' + mb.id} className="border-b border-slate-100 hover:bg-slate-50/45 bg-slate-50/20">
                          {/* Riferimento Batteria */}
                          <td className="py-2 px-2">
                            <span className="hidden print:inline font-bold text-slate-700">{mb.name}</span>
                            <input
                              type="text"
                              value={mb.name}
                              onChange={e => handleUpdateManualBatteryField(mb.id, 'name', e.target.value)}
                              className="print:hidden w-full p-1 bg-white border border-slate-200 rounded-lg font-bold text-[10px] outline-none focus:border-blue-500 text-slate-700"
                              placeholder="es. Batteria Calda UTA"
                            />
                          </td>
                          
                          {/* Tipo */}
                          <td className="py-2 px-2">
                            <span className="hidden print:inline-block text-[10px] font-bold text-slate-700">
                              {mb.type === 'calda' ? 'Riscald. Calda' : mb.type === 'fredda' ? 'Raffred. Fredda' : 'Umidificazione'}
                            </span>
                            <select
                              value={mb.type}
                              onChange={e => handleUpdateManualBatteryField(mb.id, 'type', e.target.value as any)}
                              className="print:hidden p-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-blue-500 text-slate-700"
                            >
                              <option value="calda">Riscald. Calda</option>
                              <option value="fredda">Raffred. Fredda</option>
                              <option value="umidificazione">Umidificazione</option>
                            </select>
                          </td>
                          
                          {/* Potenza Progetto (kW) */}
                          <td className="py-2 px-2 text-center">
                            <span className="hidden print:inline font-mono font-bold text-slate-800">
                              {isUmid ? '-' : mb.power_kW !== '' ? formatNumber(mb.power_kW, 2) + ' kW' : '-'}
                            </span>
                            {isUmid ? (
                              <span className="print:hidden text-slate-400 font-bold">-</span>
                            ) : (
                              <input
                                type="number"
                                step="0.5"
                                value={mb.power_kW}
                                onChange={e => handleUpdateManualBatteryField(mb.id, 'power_kW', e.target.value === '' ? '' : Number(e.target.value))}
                                className="print:hidden w-16 p-1 text-center bg-white border border-slate-200 rounded-lg font-mono text-[10px] outline-none focus:border-blue-500 font-bold text-slate-800"
                                placeholder="kW"
                              />
                            )}
                          </td>
                          
                          {/* Delta T */}
                          <td className="py-2 px-2 text-center">
                            <span className="hidden print:inline font-mono font-bold text-slate-800">
                              {isUmid ? '-' : dT + ' °C'}
                            </span>
                            {isUmid ? (
                              <span className="print:hidden text-slate-400 font-bold">-</span>
                            ) : (
                              <input
                                type="number"
                                min={0.1}
                                step="0.5"
                                value={mb.deltaT}
                                onChange={e => handleUpdateManualBatteryField(mb.id, 'deltaT', e.target.value === '' ? '' : Number(e.target.value))}
                                className="print:hidden w-16 p-1 text-center bg-white border border-slate-200 rounded-lg font-mono text-[10px] outline-none focus:border-blue-500 font-bold text-slate-800"
                              />
                            )}
                          </td>
                          
                          {/* Portata H2O / Fluido */}
                          <td className="py-2 px-2 text-right">
                            {isUmid ? (
                              <>
                                <span className="hidden print:inline font-mono font-bold text-slate-850">
                                  {mb.flowRate !== '' ? formatNumber(mb.flowRate, 1) + ' ' + mb.flowUnit : '-'}
                                </span>
                                <div className="print:hidden flex items-center justify-end gap-1">
                                  <input
                                    type="number"
                                    step="0.5"
                                    value={mb.flowRate}
                                    onChange={e => handleUpdateManualBatteryField(mb.id, 'flowRate', e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-14 p-1 text-center bg-white border border-slate-200 rounded-lg font-mono text-[10px] outline-none focus:border-blue-500 font-bold text-slate-800"
                                    placeholder="Valore"
                                    disabled={!isUmid}
                                  />
                                  <select
                                    value={mb.flowUnit}
                                    onChange={e => handleUpdateManualBatteryField(mb.id, 'flowUnit', e.target.value as any)}
                                    className="p-1 bg-white border border-slate-200 rounded-lg text-[9px] font-bold outline-none focus:border-blue-500 text-slate-600"
                                    disabled={!isUmid}
                                  >
                                    <option value="l/h">l/h</option>
                                    <option value="kg/h">kg/h</option>
                                  </select>
                                </div>
                              </>
                            ) : (
                              <span className="font-mono font-bold text-slate-700">
                                {hasValidDT ? formatNumber(calculatedFlow, 0) + ' l/h' : '-'}
                              </span>
                            )}
                          </td>
                          
                          {/* Diametro Tubo (Select Override) */}
                          <td className="py-2 px-2">
                            <span className="hidden print:inline font-mono font-bold text-slate-850">
                              {isUmid ? '-' : hasValidDT ? dnFinal : '-'}
                            </span>
                            <select
                              value={mb.customPipeSize || 'auto'}
                              onChange={e => {
                                const val = e.target.value === 'auto' ? undefined : e.target.value;
                                handleUpdateManualBatteryField(mb.id, 'customPipeSize', val);
                              }}
                              className="print:hidden w-full p-1 bg-white border border-slate-200 rounded-lg text-[9px] font-bold outline-none focus:border-blue-500 text-slate-700"
                              disabled={isUmid || !hasValidDT}
                            >
                              <option value="auto">
                                {isUmid ? '-' : hasValidDT ? `Consigliato (&quot;${dnCalcolato}&quot;)` : '-'}
                              </option>
                              {!isUmid && hasValidDT && PIPE_DN_OPTIONS.map(dn => (
                                <option key={dn} value={dn}>{dn}</option>
                              ))}
                            </select>
                          </td>
                          
                          {/* Valvola (Select Override) */}
                          <td className="py-2 px-2">
                            <span className="hidden print:inline font-mono font-bold text-slate-850">
                              {isUmid ? '-' : hasValidDT ? valveFinal : '-'}
                            </span>
                            <select
                              value={mb.customValveKvs || 'auto'}
                              onChange={e => {
                                const val = e.target.value === 'auto' ? undefined : e.target.value;
                                handleUpdateManualBatteryField(mb.id, 'customValveKvs', val);
                              }}
                              className="print:hidden w-full p-1 bg-white border border-slate-200 rounded-lg text-[9px] font-bold outline-none focus:border-blue-500 text-slate-700"
                              disabled={isUmid || !hasValidDT}
                            >
                              <option value="auto">
                                {isUmid ? '-' : hasValidDT ? `Consigliata (&quot;${valveCalcolata}&quot;)` : '-'}
                              </option>
                              {!isUmid && hasValidDT && VALVE_KVS_OPTIONS.map(v => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </td>
                          
                          {/* Azioni */}
                          <td className="py-2 px-2 text-center print:hidden">
                            <button
                              onClick={() => handleRemoveManualBattery(mb.id)}
                              className="p-1 hover:bg-red-50 text-red-500 rounded transition-colors cursor-pointer"
                              title="Elimina questa batteria"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {batteryCalculations.filter(bc => bc.finalDesignKW > 0).length === 0 && manualBatteries.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 font-semibold italic bg-slate-50/30">
                          Nessuna batteria presente. Fai clic su "Aggiungi Batteria Manuale" per iniziare.
                        </td>
                      </tr>
                    )}
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
                  if (door.adjacentRoomId && door.adjacentRoomId !== 'esterno' && door.adjacentRoomId !== 'altro') {
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
                  if (door.adjacentRoomId && door.adjacentRoomId !== 'esterno' && door.adjacentRoomId !== 'altro') {
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
                            {c.rawRipresaFlow < 0 ? (
                              <g>
                                <line x1="475" y1={y_r + 55} x2="375" y2={y_r + 55} stroke="#ef4444" strokeWidth="2" strokeDasharray="3,3" markerEnd="url(#return-arrow)" />
                                <text x="385" y={y_r + 50} fill="#b91c1c" fontSize="8" fontFamily="monospace" fontWeight="black">
                                  🚨 {c.rawRipresaFlow} m³/h
                                </text>
                              </g>
                            ) : c.rawRipresaFlow === 0 ? (
                              <g>
                                <line x1="475" y1={y_r + 55} x2="375" y2={y_r + 55} stroke="#f59e0b" strokeWidth="2" markerEnd="url(#return-arrow)" />
                                <text x="385" y={y_r + 50} fill="#d97706" fontSize="8" fontFamily="monospace" fontWeight="bold">
                                  ⚠️ 0 m³/h
                                </text>
                              </g>
                            ) : (
                              <g>
                                <line x1="475" y1={y_r + 55} x2="375" y2={y_r + 55} stroke="#10b981" strokeWidth="2" markerEnd="url(#return-arrow)" />
                                <text x="385" y={y_r + 50} fill="#059669" fontSize="8" fontFamily="monospace" fontWeight="bold">
                                  {c.adoptedRipresaFlow} m³/h
                                </text>
                              </g>
                            )}
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
                        let pressureLabel = `${formatNumber(c.room.pressure_Pa, getPresDec(c.room.pressure_Pa))} Pa`;

                        if (c.room.pressure_Pa > 0) {
                          bgColor = "#f0fdf4";
                          strokeColor = "#22c55e";
                          textColor = "#15803d";
                          barColor = "#22c55e";
                          pressureLabel = `+${formatNumber(c.room.pressure_Pa, getPresDec(c.room.pressure_Pa))} Pa`;
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
                              {formatNumber(c.room.area, 1)} m² | {formatNumber(c.volume, 1)} m³ | {c.room.gmpClass}
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
                          const r2Calc = door.adjacentRoomId && door.adjacentRoomId !== 'esterno' && door.adjacentRoomId !== 'altro'
                            ? sysRooms.find(c2 => c2.room.id === door.adjacentRoomId)
                            : null;

                          // Calculate flow rate
                          const l = door.type === 'singola' ? 5.1 : door.type === 'doppia' ? 5.8 : (num(door.customLength) || 5.1);
                          const s = (door.type === 'singola' || door.type === 'doppia') ? 0.002 : (num(door.customWidth) || 2) * 0.001;
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
                          <td className="py-2.5 px-2 text-center font-mono">{formatNumber(c.room.ricambiApp, c.room.ricambiApp % 1 === 0 ? 0 : 1)}</td>
                          <td className="py-2.5 px-2 font-mono text-right">{formatNumber(c.adoptedFlow, 0)}</td>
                          <td className="py-2.5 px-2 font-mono text-right">
                            <span className={netLeakage > 0 ? 'text-orange-600' : netLeakage < 0 ? 'text-blue-600' : ''}>
                              {leakageText}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 font-mono text-right">
                            {c.rawRipresaFlow < 0 ? (
                              <span className="text-red-650 font-bold inline-flex items-center gap-1" title="Critico: Ripresa < 0 (Valore non accettabile!)">
                                <span>🚨</span> {c.rawRipresaFlow} m³/h
                              </span>
                            ) : c.rawRipresaFlow === 0 ? (
                              <span className="text-amber-600 font-semibold inline-flex items-center gap-1" title="Warning: Ripresa a 0 m³/h">
                                <span>⚠️</span> 0 m³/h
                              </span>
                            ) : (
                              formatNumber(c.adoptedRipresaFlow, 0) + ' m³/h'
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono">
                            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${c.room.pressure_Pa > 0 ? 'bg-blue-50 text-blue-700' : c.room.pressure_Pa < 0 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-500'}`}>
                              {c.room.pressure_Pa > 0 ? '+' : ''}{formatNumber(c.room.pressure_Pa, getPresDec(c.room.pressure_Pa))} Pa
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
