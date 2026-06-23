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
}

export interface HVACSystem {
  id: string;
  name: string;
  description: string;
}

interface ToolHVACProps {
  projectData: ProjectData;
  setProjectData: (data: any) => void;
  setAppMode: (mode: string) => void;
}

// Default/mock HVAC systems
const DEFAULT_SYSTEMS: HVACSystem[] = [
  { id: 'AH-102-01', name: 'AH-102-01', description: 'Macchina a parziale ricircolo - LINK CORRIDOR' },
  { id: 'AH-103-01', name: 'AH-103-01', description: 'Macchina a parziale ricircolo - MAGAZZINO BASSO' },
  { id: 'AH-104-01', name: 'AH-104-01', description: 'Macchina a tutta aria esterna - SERVIZI E LOCK' }
];

// Default/mock rooms (seeding the UI with data similar to Calcoli HVAC.xlsx)
const DEFAULT_ROOMS: HVACRoom[] = [
  {
    id: 'room-1',
    systemId: 'AH-102-01',
    code: 'E001',
    description: 'MATERIAL RECEIVING LINK CORRIDOR',
    gmpClass: 'NC',
    bioLevel: 'N.A.',
    ricambiStd: 6,
    ricambiApp: 6,
    area: 238.5,
    height: 2.7,
    tempSummer: 22,
    tempSummerTol: '≤ 25,0',
    rhSummer: 50,
    rhSummerTol: '≤ 65,0',
    tempWinter: 22,
    tempWinterTol: '≥ 15,0',
    rhWinter: 50,
    rhWinterTol: '≤ 65,0',
    lightLoad_W_m2: 20,
    peopleCount: 0,
    peopleSensible_W: 100,
    peopleLatent_W: 75,
    externalHeatGain_W: 2400,
    externalHeatLoss_W: 1800,
    pressure_Pa: 0,
    equipment: [
      { id: 'eq-1-1', name: 'Ricarica AGV', power_W: 3000, quantity: 0, usageFactor: 0.5, dissipationFactor: 0.15 },
      { id: 'eq-1-2', name: 'Motori rulliere', power_W: 1000, quantity: 4, usageFactor: 0.75, dissipationFactor: 0.15 }
    ],
    doors: [],
    supplyTempSummer: 17,
    supplyTempWinter: 25,
    reheatZone: 'RC-102-01',
    reheatCoilUpstreamTemp: 18.2
  },
  {
    id: 'room-2',
    systemId: 'AH-103-01',
    code: 'A001',
    description: 'ENTRANCE',
    gmpClass: 'NC',
    bioLevel: 'N.A.',
    ricambiStd: 3,
    ricambiApp: 3,
    area: 18.51,
    height: 5.2,
    tempSummer: 22,
    tempSummerTol: '±2',
    rhSummer: 50,
    rhSummerTol: '≤ 65,0',
    tempWinter: 22,
    tempWinterTol: '±2',
    rhWinter: 50,
    rhWinterTol: '≤ 65,0',
    lightLoad_W_m2: 20,
    peopleCount: 0,
    peopleSensible_W: 100,
    peopleLatent_W: 75,
    externalHeatGain_W: 300,
    externalHeatLoss_W: 250,
    pressure_Pa: 0,
    equipment: [],
    doors: [],
    supplyTempSummer: 18,
    supplyTempWinter: 26,
    reheatZone: 'RC-103-01',
    reheatCoilUpstreamTemp: 18.1
  },
  {
    id: 'room-3',
    systemId: 'AH-103-01',
    code: 'A002',
    description: 'HANDLING AREA',
    gmpClass: 'NC',
    bioLevel: 'N.A.',
    ricambiStd: 3,
    ricambiApp: 3,
    area: 366.14,
    height: 5.2,
    tempSummer: 22,
    tempSummerTol: '≤ 25,0',
    rhSummer: 50,
    rhSummerTol: '≤ 65,0',
    tempWinter: 22,
    tempWinterTol: '≥ 15,0',
    rhWinter: 50,
    rhWinterTol: '≤ 65,0',
    lightLoad_W_m2: 20,
    peopleCount: 10,
    peopleSensible_W: 100,
    peopleLatent_W: 75,
    externalHeatGain_W: 6500,
    externalHeatLoss_W: 4200,
    pressure_Pa: 0,
    equipment: [
      { id: 'eq-3-1', name: 'Motori rulliere', power_W: 1000, quantity: 3, usageFactor: 0.75, dissipationFactor: 0.15 },
      { id: 'eq-3-2', name: 'Wrapping machine', power_W: 2000, quantity: 1, usageFactor: 0.5, dissipationFactor: 0.15 }
    ],
    doors: [],
    supplyTempSummer: 17,
    supplyTempWinter: 26,
    reheatZone: 'RC-103-01',
    reheatCoilUpstreamTemp: 18.1
  },
  {
    id: 'room-4',
    systemId: 'AH-104-01',
    code: 'A104',
    description: 'MALE CHANGING ROOM',
    gmpClass: 'NC',
    bioLevel: 'N.A.',
    ricambiStd: 4,
    ricambiApp: 4,
    area: 18.37,
    height: 2.7,
    tempSummer: 22,
    tempSummerTol: '±2',
    rhSummer: 50,
    rhSummerTol: '≤ 65,0',
    tempWinter: 22,
    tempWinterTol: '±2',
    rhWinter: 50,
    rhWinterTol: '≤ 65,0',
    lightLoad_W_m2: 20,
    peopleCount: 5,
    peopleSensible_W: 100,
    peopleLatent_W: 75,
    externalHeatGain_W: 250,
    externalHeatLoss_W: 200,
    pressure_Pa: -5,
    equipment: [],
    doors: [
      { id: 'leak-1', type: 'singola', direction: 'in', adjacentPressure_Pa: 0, description: 'Porta verso corridoio' }
    ],
    supplyTempSummer: 22,
    supplyTempWinter: 22,
    reheatZone: 'RC-104-01',
    reheatCoilUpstreamTemp: 18.0
  }
];

export function ToolHVAC({ projectData, setProjectData, setAppMode }: ToolHVACProps) {
  // Tabs: criteria (Locali & Criteri), flows (Portate Aria), leakage (Trafilamenti), reheat (Batterie di Post), summary (Consumi & Diametri)
  const [activeTab, setActiveTab] = useState<'criteria' | 'flows' | 'leakage' | 'reheat' | 'summary'>('criteria');
  
  // Settings/global parameters
  const [overdesignFactor, setOverdesignFactor] = useState<number>(20); // % overdesign for airflows
  const [reheatOverdesignFactor, setReheatOverdesignFactor] = useState<number>(20); // % overdesign for reheaters
  const [waterDeltaT, setWaterDeltaT] = useState<number>(10); // °C delta T hot water
  const [defaultLighting_W_m2, setDefaultLighting_W_m2] = useState<number>(20);
  
  // Project-specific systems and rooms
  const [systems, setSystems] = useState<HVACSystem[]>(DEFAULT_SYSTEMS);
  const [rooms, setRooms] = useState<HVACRoom[]>(DEFAULT_ROOMS);
  
  // UI states for editing/adding
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(rooms[0]?.id || null);
  const [showEqModal, setShowEqModal] = useState<boolean>(false);
  const [eqRoomId, setEqRoomId] = useState<string | null>(null);

  const selectedRoom = useMemo(() => {
    return rooms.find(r => r.id === selectedRoomId) || null;
  }, [rooms, selectedRoomId]);

  // Calculations for each room (heat loads, airflows, leakages, reheaters)
  const roomCalculations = useMemo(() => {
    return rooms.map(room => {
      // 1. Volumes
      const volume = Number((room.area * room.height).toFixed(2));
      
      // 2. Heat loads
      const lightLoad = Number((room.area * room.lightLoad_W_m2).toFixed(1));
      const peopleSensible = room.peopleCount * room.peopleSensible_W;
      const peopleLatent = room.peopleCount * room.peopleLatent_W;
      
      const equipmentLoad = room.equipment.reduce((sum, eq) => {
        const dPower = eq.power_W * eq.quantity * eq.usageFactor * eq.dissipationFactor;
        return sum + dPower;
      }, 0);

      const totalSensibleSummer = Number((lightLoad + equipmentLoad + peopleSensible + room.externalHeatGain_W).toFixed(1));

      // 3. Air flows
      // Summer thermal airflow: Q_sens * 0.86 * (1/0.3) * (1 / (T_room - T_supply_summer))
      // 0.86 * (1/0.3) = 2.8666...
      let summerThermalFlow = 0;
      if (room.tempSummer > room.supplyTempSummer) {
        summerThermalFlow = totalSensibleSummer * 0.86 * (1 / 0.3) * (1 / (room.tempSummer - room.supplyTempSummer));
      }

      // Winter thermal airflow: Q_dispers * 0.86 * (1/0.3) * (1 / (T_supply_winter - T_room))
      let winterThermalFlow = 0;
      if (room.supplyTempWinter > room.tempWinter) {
        winterThermalFlow = room.externalHeatLoss_W * 0.86 * (1 / 0.3) * (1 / (room.supplyTempWinter - room.tempWinter));
      }

      const ricambiFlow = room.ricambiApp * volume;
      const maxThermalFlow = Math.max(summerThermalFlow, winterThermalFlow);
      const calculatedFlow = Math.max(maxThermalFlow, ricambiFlow);
      
      // Adopted: round up to nearest 10
      const adoptedFlow = Math.ceil(calculatedFlow / 10) * 10;
      
      // Overdesign: adopted * (1 + overdesignFactor / 100) rounded to nearest 10
      const overdesignFlow = Math.ceil((adoptedFlow * (1 + overdesignFactor / 100)) / 10) * 10;

      // 4. Infiltrations & Trafilamenti (leakage)
      // Q_leak = l * s * alpha * 3600 * sqrt(abs(DP))
      let infiltrationFlow = 0; // air entering the room (positive contribution)
      let exfiltrationFlow = 0; // air leaving the room (negative contribution)

      room.doors.forEach(door => {
        const l = door.type === 'singola' ? 5.1 : door.type === 'doppia' ? 5.8 : (door.customLength || 5.1);
        const s = door.customWidth || 0.002;
        const alpha = door.customAlpha || 0.85;
        const dp = room.pressure_Pa - door.adjacentPressure_Pa;

        // flow in m3/h
        const flow = Math.ceil(l * s * alpha * 3600 * Math.sqrt(Math.abs(dp)));
        
        if (dp < 0) {
          // Room pressure is lower, air flows IN
          infiltrationFlow += flow;
        } else {
          // Room pressure is higher, air flows OUT
          exfiltrationFlow += flow;
        }
      });

      // 5. Ripresa Flow
      // Ripresa = Mandata (adoptedFlow) - Espulsione (0 for now or custom) + Infiltrazioni - Trafilamenti
      const rawRipresaFlow = adoptedFlow + infiltrationFlow - exfiltrationFlow;
      const adoptedRipresaFlow = Math.max(0, Math.ceil(rawRipresaFlow / 10) * 10);
      const overdesignRipresaFlow = Math.ceil((adoptedRipresaFlow * (1 + overdesignFactor / 100)) / 10) * 10;

      // 6. Reheater Calculations (Batteria di Post)
      // Power = adoptedFlow * (T_supply_winter - T_upstream) * 0.3 (kcal/h)
      let reheatPower_kcal = 0;
      if (room.supplyTempWinter > room.reheatCoilUpstreamTemp) {
        reheatPower_kcal = adoptedFlow * (room.supplyTempWinter - room.reheatCoilUpstreamTemp) * 0.3;
      }
      const reheatPower_kW = reheatPower_kcal * 0.001163; // 1 kcal/h = 0.001163 kW

      // Reheat Design Power (with overdesign factor) rounded to nearest 50 kcal/h
      const reheatDesignPower_kcal = Math.ceil((reheatPower_kcal * (1 + reheatOverdesignFactor / 100)) / 50) * 50;
      const reheatDesignPower_kW = reheatDesignPower_kcal * 0.001163;

      // Water flow (lt/h) = reheatPower_kcal / deltaT
      const waterFlowMin_lth = reheatPower_kcal / waterDeltaT;
      const waterFlowDesign_lth = reheatDesignPower_kcal / waterDeltaT;

      return {
        room,
        volume,
        lightLoad,
        peopleSensible,
        peopleLatent,
        equipmentLoad,
        totalSensibleSummer,
        summerThermalFlow,
        winterThermalFlow,
        ricambiFlow,
        calculatedFlow,
        adoptedFlow,
        overdesignFlow,
        infiltrationFlow,
        exfiltrationFlow,
        rawRipresaFlow,
        adoptedRipresaFlow,
        overdesignRipresaFlow,
        reheatPower_kcal,
        reheatPower_kW,
        reheatDesignPower_kcal,
        reheatDesignPower_kW,
        waterFlowMin_lth,
        waterFlowDesign_lth
      };
    });
  }, [rooms, overdesignFactor, reheatOverdesignFactor, waterDeltaT]);

  // Aggregated values per System
  const systemCalculations = useMemo(() => {
    return systems.map(sys => {
      const sysRooms = roomCalculations.filter(c => c.room.systemId === sys.id);
      
      const totalArea = sysRooms.reduce((sum, r) => sum + r.room.area, 0);
      const totalVolume = sysRooms.reduce((sum, r) => sum + r.volume, 0);
      const totalSensibleSummer = sysRooms.reduce((sum, r) => sum + r.totalSensibleSummer, 0);
      const totalLossesWinter = sysRooms.reduce((sum, r) => sum + r.room.externalHeatLoss_W, 0);

      const totalMandata = sysRooms.reduce((sum, r) => sum + r.adoptedFlow, 0);
      const totalMandataSovr = sysRooms.reduce((sum, r) => sum + r.overdesignFlow, 0);
      
      const totalRipresa = sysRooms.reduce((sum, r) => sum + r.adoptedRipresaFlow, 0);
      const totalRipresaSovr = sysRooms.reduce((sum, r) => sum + r.overdesignRipresaFlow, 0);

      const totalReheatPower_kW = sysRooms.reduce((sum, r) => sum + r.reheatPower_kW, 0);
      const totalReheatDesignPower_kW = sysRooms.reduce((sum, r) => sum + r.reheatDesignPower_kW, 0);
      const totalWaterFlow_lth = sysRooms.reduce((sum, r) => sum + r.waterFlowDesign_lth, 0);

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
        totalWaterFlow_lth
      };
    });
  }, [systems, roomCalculations]);

  // Utility summary pipe sizing (DN selection helper based on water flow)
  const getPipeSizeDN = (flow_lth: number): string => {
    if (flow_lth <= 0) return '-';
    if (flow_lth < 1000) return 'DN20';
    if (flow_lth < 2000) return 'DN25';
    if (flow_lth < 3500) return 'DN32';
    if (flow_lth < 5500) return 'DN40';
    if (flow_lth < 9000) return 'DN50';
    if (flow_lth < 15000) return 'DN65';
    return 'DN80';
  };

  const getValveKvs = (flow_lth: number): string => {
    if (flow_lth <= 0) return '-';
    if (flow_lth < 800) return 'DN15, kvs 0.63';
    if (flow_lth < 1500) return 'DN15, kvs 1.6';
    if (flow_lth < 3000) return 'DN20, kvs 4.0';
    if (flow_lth < 6000) return 'DN25, kvs 6.3';
    if (flow_lth < 10000) return 'DN32, kvs 10.0';
    if (flow_lth < 20000) return 'DN40, kvs 25.0';
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
    const code = prompt("Inserisci il codice del sistema (es. AH-105-01):");
    if (!code) return;
    if (systems.some(s => s.id === code)) {
      alert("Questo sistema esiste già!");
      return;
    }
    const desc = prompt("Inserisci una descrizione per il sistema:");
    const newSystem: HVACSystem = { id: code, name: code, description: desc || '' };
    setSystems([...systems, newSystem]);
  };

  const handleRemoveSystem = (sysId: string) => {
    if (confirm(`Sei sicuro di voler eliminare il sistema ${sysId} e tutti i suoi locali associati?`)) {
      setSystems(systems.filter(s => s.id !== sysId));
      setRooms(rooms.filter(r => r.systemId !== sysId));
      if (selectedRoom?.systemId === sysId) {
        setSelectedRoomId(rooms.find(r => r.systemId !== sysId)?.id || null);
      }
    }
  };

  const handleAddRoom = (sysId: string) => {
    const code = prompt("Inserisci il codice del locale (es. A108):");
    if (!code) return;
    const desc = prompt("Inserisci la descrizione del locale (es. STORAGE):");
    const newId = `room-${Date.now()}`;
    const newRoom: HVACRoom = {
      id: newId,
      systemId: sysId,
      code,
      description: desc || '',
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
      lightLoad_W_m2: defaultLighting_W_m2,
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
      reheatZone: `RC-${sysId.split('-').slice(0,2).join('-')}-01`,
      reheatCoilUpstreamTemp: 18.2
    };

    setRooms([...rooms, newRoom]);
    setSelectedRoomId(newId);
  };

  const handleRemoveRoom = (roomId: string) => {
    if (confirm("Sei sicuro di voler rimuovere questo locale?")) {
      const updated = rooms.filter(r => r.id !== roomId);
      setRooms(updated);
      if (selectedRoomId === roomId) {
        setSelectedRoomId(updated[0]?.id || null);
      }
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
      doors: roomToDup.doors.map(d => ({ ...d, id: `door-${Date.now()}-${Math.random()}` }))
    };
    setRooms([...rooms, duplicated]);
    setSelectedRoomId(newId);
  };

  const handleUpdateRoomField = (roomId: string, field: keyof HVACRoom, val: any) => {
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, [field]: val } : r));
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
          description: 'Porta standard'
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

  return (
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
      <ProjectStorage 
        toolType="hvac"
        currentData={getCloudSaveData()}
        onLoadProject={handleLoadCloudProject}
        projectInfo={projectData}
        setProjectInfo={setProjectData}
      />

      {/* Global Config / Parameter Controls */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-5 mb-6">
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
              onChange={e => setOverdesignFactor(Number(e.target.value))} 
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
              onChange={e => setReheatOverdesignFactor(Number(e.target.value))} 
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
              onChange={e => setWaterDeltaT(Number(e.target.value))} 
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
              onChange={e => setDefaultLighting_W_m2(Number(e.target.value))} 
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-2">
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
          <IconWind />
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left pane: Systems and Room Tree */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Sistemi e Locali</h4>
                  <button 
                    onClick={handleAddSystem}
                    className="p-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
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
                          <div className="flex gap-1">
                            <button 
                              onClick={() => handleAddRoom(sys.id)}
                              className="p-1 text-slate-600 hover:text-blue-600 hover:bg-white rounded-md transition-colors cursor-pointer"
                              title="Aggiungi Locale"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleRemoveSystem(sys.id)}
                              className="p-1 text-slate-400 hover:text-red-650 hover:bg-white rounded-md transition-colors cursor-pointer"
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
                </div>
              </div>

              {/* Right pane: Room Settings and Loads */}
              {selectedRoom ? (
                <div className="lg:col-span-2 space-y-6">
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
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleDuplicateRoom(selectedRoom)}
                          className="px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <IconCopy /> Duplica
                        </button>
                        <button 
                          onClick={() => handleRemoveRoom(selectedRoom.id)}
                          className="px-2.5 py-1.5 bg-red-50 text-red-650 hover:bg-red-100 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Elimina
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
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

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs border-t border-slate-100 pt-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Area (m²)</label>
                        <input 
                          type="number" 
                          value={selectedRoom.area} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'area', Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Altezza (m)</label>
                        <input 
                          type="number" 
                          step="0.1" 
                          value={selectedRoom.height} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'height', Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Volume (m³)</label>
                        <div className="w-full p-2 bg-slate-100 border border-transparent rounded-xl font-bold font-mono text-slate-600">
                          {formatNumber(selectedRoom.area * selectedRoom.height, 2)}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pressione Relativa (Pa)</label>
                        <input 
                          type="number" 
                          value={selectedRoom.pressure_Pa} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'pressure_Pa', Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs border-t border-slate-100 pt-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Ricambi Std (Vol/h)</label>
                        <input 
                          type="number" 
                          value={selectedRoom.ricambiStd} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'ricambiStd', Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Ricambi Appl (Vol/h)</label>
                        <input 
                          type="number" 
                          value={selectedRoom.ricambiApp} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'ricambiApp', Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">T Progetto Estate (°C)</label>
                        <input 
                          type="number" 
                          value={selectedRoom.tempSummer} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'tempSummer', Number(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">T Progetto Inverno (°C)</label>
                        <input 
                          type="number" 
                          value={selectedRoom.tempWinter} 
                          onChange={e => handleUpdateRoomField(selectedRoom.id, 'tempWinter', Number(e.target.value))}
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
                            onChange={e => handleUpdateRoomField(selectedRoom.id, 'externalHeatGain_W', Number(e.target.value))}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">Dispersioni termiche (Inverno, W)</label>
                          <input 
                            type="number" 
                            value={selectedRoom.externalHeatLoss_W} 
                            onChange={e => handleUpdateRoomField(selectedRoom.id, 'externalHeatLoss_W', Number(e.target.value))}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">Densità Carico Luci (W/m²)</label>
                          <input 
                            type="number" 
                            value={selectedRoom.lightLoad_W_m2} 
                            onChange={e => handleUpdateRoomField(selectedRoom.id, 'lightLoad_W_m2', Number(e.target.value))}
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
                            onChange={e => handleUpdateRoomField(selectedRoom.id, 'peopleCount', Number(e.target.value))}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">Carico Sensibile per Persona (W)</label>
                          <input 
                            type="number" 
                            value={selectedRoom.peopleSensible_W} 
                            onChange={e => handleUpdateRoomField(selectedRoom.id, 'peopleSensible_W', Number(e.target.value))}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">Carico Latente per Persona (W)</label>
                          <input 
                            type="number" 
                            value={selectedRoom.peopleLatent_W} 
                            onChange={e => handleUpdateRoomField(selectedRoom.id, 'peopleLatent_W', Number(e.target.value))}
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
                        className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
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
                            <th className="py-2 text-right">Azioni</th>
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
                                  onChange={e => handleUpdateEquipment(selectedRoom.id, eq.id, 'power_W', Number(e.target.value))}
                                  className="w-full p-1 bg-slate-50 border border-slate-150 rounded-lg font-mono"
                                />
                              </td>
                              <td className="py-1.5 pr-2 w-16">
                                <input
                                  type="number"
                                  value={eq.quantity}
                                  onChange={e => handleUpdateEquipment(selectedRoom.id, eq.id, 'quantity', Number(e.target.value))}
                                  className="w-full p-1 bg-slate-50 border border-slate-150 rounded-lg font-mono"
                                />
                              </td>
                              <td className="py-1.5 pr-2 w-24">
                                <input
                                  type="number"
                                  step="0.05"
                                  value={eq.usageFactor}
                                  onChange={e => handleUpdateEquipment(selectedRoom.id, eq.id, 'usageFactor', Number(e.target.value))}
                                  className="w-full p-1 bg-slate-50 border border-slate-150 rounded-lg font-mono"
                                />
                              </td>
                              <td className="py-1.5 pr-2 w-24">
                                <input
                                  type="number"
                                  step="0.05"
                                  value={eq.dissipationFactor}
                                  onChange={e => handleUpdateEquipment(selectedRoom.id, eq.id, 'dissipationFactor', Number(e.target.value))}
                                  className="w-full p-1 bg-slate-50 border border-slate-150 rounded-lg font-mono"
                                />
                              </td>
                              <td className="py-1.5 font-bold font-mono text-slate-700">
                                {formatNumber(eq.power_W * eq.quantity * eq.usageFactor * eq.dissipationFactor, 0)} W
                              </td>
                              <td className="py-1.5 text-right">
                                <button
                                  onClick={() => handleRemoveEquipment(selectedRoom.id, eq.id)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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
            </div>
          </div>
        )}

        {/* TAB 2: Portate d'Aria */}
        {activeTab === 'flows' && (
          <div className="space-y-6">
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
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px] bg-slate-50/50">
                          <th className="py-2.5 px-2">Cod. Locale</th>
                          <th className="py-2.5 px-2">Descrizione</th>
                          <th className="py-2.5 px-2 font-mono">Vol (m³)</th>
                          <th className="py-2.5 px-2 font-mono text-blue-600">Carico (W)</th>
                          <th className="py-2.5 px-2 font-mono text-red-600">Disp (W)</th>
                          <th className="py-2.5 px-2 text-center bg-blue-50/30">T.Imm Est (°C)</th>
                          <th className="py-2.5 px-2 font-mono text-right bg-blue-50/30">Min Est (m³/h)</th>
                          <th className="py-2.5 px-2 text-center bg-orange-50/30">T.Imm Inv (°C)</th>
                          <th className="py-2.5 px-2 font-mono text-right bg-orange-50/30">Min Inv (m³/h)</th>
                          <th className="py-2.5 px-2 font-mono text-right">Ricambi (m³/h)</th>
                          <th className="py-2.5 px-2 font-mono text-right font-bold text-slate-700">Calcolata (m³/h)</th>
                          <th className="py-2.5 px-2 font-mono text-right font-bold text-blue-700">Adottata (m³/h)</th>
                          <th className="py-2.5 px-2 font-mono text-right text-slate-500">Sovrad. (m³/h)</th>
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
                            <tr key={c.room.id} className="border-b border-slate-100 hover:bg-slate-50/45">
                              <td className="py-2 px-2 font-bold font-mono">{c.room.code}</td>
                              <td className="py-2 px-2 max-w-[150px] truncate">{c.room.description}</td>
                              <td className="py-2 px-2 font-mono text-slate-500">{formatNumber(c.volume, 1)}</td>
                              <td className="py-2 px-2 font-mono text-blue-600 font-bold">{formatNumber(c.totalSensibleSummer, 0)}</td>
                              <td className="py-2 px-2 font-mono text-red-650">{formatNumber(c.room.externalHeatLoss_W, 0)}</td>
                              
                              {/* Summer Supply Temp input */}
                              <td className="py-1 px-1 w-20 text-center bg-blue-50/30">
                                <input
                                  type="number"
                                  value={c.room.supplyTempSummer}
                                  onChange={e => handleUpdateRoomField(c.room.id, 'supplyTempSummer', Number(e.target.value))}
                                  className={`w-full p-1 text-center rounded-lg border border-slate-200 outline-none ${summerTempColor}`}
                                />
                              </td>
                              <td className="py-2 px-2 font-mono text-right text-slate-650 bg-blue-50/30">
                                {formatNumber(c.summerThermalFlow, 0)}
                              </td>

                              {/* Winter Supply Temp input */}
                              <td className="py-1 px-1 w-20 text-center bg-orange-50/30">
                                <input
                                  type="number"
                                  value={c.room.supplyTempWinter}
                                  onChange={e => handleUpdateRoomField(c.room.id, 'supplyTempWinter', Number(e.target.value))}
                                  className="w-full p-1 text-center rounded-lg border border-slate-200 bg-slate-50 text-slate-800 outline-none font-bold"
                                />
                              </td>
                              <td className="py-2 px-2 font-mono text-right text-slate-650 bg-orange-50/30">
                                {formatNumber(c.winterThermalFlow, 0)}
                              </td>

                              <td className="py-2 px-2 font-mono text-right text-slate-500">{formatNumber(c.ricambiFlow, 0)}</td>
                              <td className="py-2 px-2 font-mono text-right font-bold text-slate-700">{formatNumber(c.calculatedFlow, 0)}</td>
                              
                              {/* Adopted input (can override or defaults to auto math.max rounded) */}
                              <td className="py-1 px-1 w-24">
                                <input
                                  type="number"
                                  value={c.room.ricambiApp > 0 ? c.room.ricambiApp * c.volume : c.adoptedFlow}
                                  readOnly
                                  className="w-full p-1 text-right rounded-lg bg-blue-50 text-blue-800 font-bold font-mono outline-none border border-transparent"
                                />
                              </td>
                              
                              <td className="py-2 px-2 font-mono text-right text-slate-500">{formatNumber(c.overdesignFlow, 0)}</td>
                            </tr>
                          );
                        })}
                        {/* Totals row */}
                        {sysTotals && (
                          <tr className="bg-slate-100 font-black text-slate-800 border-t border-slate-300">
                            <td colSpan={2} className="py-2.5 px-2">TOTALE SISTEMA</td>
                            <td className="py-2.5 px-2 font-mono">{formatNumber(sysTotals.totalVolume, 1)}</td>
                            <td className="py-2.5 px-2 font-mono text-blue-600">{formatNumber(sysTotals.totalSensibleSummer, 0)}</td>
                            <td className="py-2.5 px-2 font-mono text-red-650">{formatNumber(sysTotals.totalLossesWinter, 0)}</td>
                            <td colSpan={2} className="bg-blue-50/30"></td>
                            <td colSpan={2} className="bg-orange-50/30"></td>
                            <td className="py-2.5 px-2 text-right font-mono"></td>
                            <td className="py-2.5 px-2 text-right font-mono"></td>
                            <td className="py-2.5 px-2 text-right font-mono text-blue-800 font-black">{formatNumber(sysTotals.totalMandata, 0)}</td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-600">{formatNumber(sysTotals.totalMandataSovr, 0)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: Bilancio Pressioni e Trafilamenti */}
        {activeTab === 'leakage' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Rooms panel */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
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
                <div className="lg:col-span-2 space-y-6">
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
                        className="px-2 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Aggiungi Porta
                      </button>
                    </div>

                    <div className="overflow-x-auto text-[11px]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-bold">
                            <th className="py-2">Descrizione/Tag</th>
                            <th className="py-2">Tipo Porta</th>
                            <th className="py-2 font-mono">P. Confine (Pa)</th>
                            <th className="py-2 font-mono">ΔP (Pa)</th>
                            <th className="py-2">Flusso</th>
                            <th className="py-2 text-right">Aria Calcolata (m³/h)</th>
                            <th className="py-2 text-right">Azioni</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRoom.doors.map(door => {
                            const dp = selectedRoom.pressure_Pa - door.adjacentPressure_Pa;
                            const l = door.type === 'singola' ? 5.1 : door.type === 'doppia' ? 5.8 : (door.customLength || 5.1);
                            const s = door.customWidth || 0.002;
                            const alpha = door.customAlpha || 0.85;
                            const flow = Math.ceil(l * s * alpha * 3600 * Math.sqrt(Math.abs(dp)));

                            return (
                              <tr key={door.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                <td className="py-1.5 pr-2">
                                  <input
                                    type="text"
                                    value={door.description}
                                    onChange={e => handleUpdateDoor(selectedRoom.id, door.id, 'description', e.target.value)}
                                    className="w-full p-1 bg-slate-50 border border-slate-150 rounded-lg"
                                  />
                                </td>
                                <td className="py-1.5 pr-2">
                                  <select
                                    value={door.type}
                                    onChange={e => handleUpdateDoor(selectedRoom.id, door.id, 'type', e.target.value)}
                                    className="p-1 bg-slate-50 border border-slate-150 rounded-lg font-semibold cursor-pointer"
                                  >
                                    <option value="singola">Singola (0.9x2.1m, fess. 5.1m)</option>
                                    <option value="doppia">Doppia (1.6x2.1m, fess. 5.8m)</option>
                                    <option value="personalizzata">Personalizzata...</option>
                                  </select>
                                </td>
                                <td className="py-1.5 pr-2 w-20">
                                  <input
                                    type="number"
                                    value={door.adjacentPressure_Pa}
                                    onChange={e => handleUpdateDoor(selectedRoom.id, door.id, 'adjacentPressure_Pa', Number(e.target.value))}
                                    className="w-full p-1 bg-slate-50 border border-slate-150 rounded-lg font-mono"
                                  />
                                </td>
                                <td className="py-1.5 font-bold font-mono text-slate-700">
                                  {dp > 0 ? `+${dp}` : dp} Pa
                                </td>
                                <td className="py-1.5 font-semibold">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] ${
                                    dp < 0 
                                      ? 'bg-green-150 text-green-800' 
                                      : dp > 0 
                                        ? 'bg-red-150 text-red-800' 
                                        : 'bg-slate-100 text-slate-655'
                                  }`}>
                                    {dp < 0 ? 'Entrante (Infiltr.)' : dp > 0 ? 'Uscente (Trafil.)' : 'Nessuno'}
                                  </span>
                                </td>
                                <td className="py-1.5 text-right font-bold font-mono text-slate-800">
                                  {flow} m³/h
                                </td>
                                <td className="py-1.5 text-right">
                                  <button
                                    onClick={() => handleRemoveDoor(selectedRoom.id, door.id)}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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
                              <td colSpan={7} className="text-center py-4 text-slate-450 italic">
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
            </div>
          </div>
        )}

        {/* TAB 4: Batterie di Post */}
        {activeTab === 'reheat' && (
          <div className="space-y-6 bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
            <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Calcolo Dimensionamento Batterie di Post-Riscaldamento (RC)
              </h4>
            </div>

            <div className="overflow-x-auto text-[10px]">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px] bg-slate-50/50">
                    <th className="py-2 px-2">Cod. Batteria (Zona)</th>
                    <th className="py-2 px-2">Cod. Locale</th>
                    <th className="py-2 px-2">Descrizione locale</th>
                    <th className="py-2 px-2 font-mono text-right">Portata Mandata (m³/h)</th>
                    <th className="py-2 px-2 text-center">T. Monte Batteria (°C)</th>
                    <th className="py-2 px-2 text-center">T. Valle Batteria (°C)</th>
                    <th className="py-2 px-2 font-mono text-right text-blue-700">Potenza Calcolata (kW)</th>
                    <th className="py-2 px-2 font-mono text-right text-blue-800">Potenza Progetto (kW)</th>
                    <th className="py-2 px-2 font-mono text-right text-orange-600">Portata H2O Min (l/h)</th>
                    <th className="py-2 px-2 font-mono text-right text-orange-700 font-bold">Portata H2O Progetto (l/h)</th>
                    <th className="py-2 px-2 text-center">Tubo Consigliato (DN)</th>
                  </tr>
                </thead>
                <tbody>
                  {roomCalculations.map(c => {
                    const dn = getPipeSizeDN(c.waterFlowDesign_lth);
                    
                    return (
                      <tr key={c.room.id} className="border-b border-slate-100 hover:bg-slate-50/45">
                        <td className="py-2.5 px-2 font-bold font-mono">
                          <input
                            type="text"
                            value={c.room.reheatZone}
                            onChange={e => handleUpdateRoomField(c.room.id, 'reheatZone', e.target.value)}
                            className="p-1 border border-slate-200 rounded-lg w-20 font-bold font-mono text-center bg-slate-50"
                          />
                        </td>
                        <td className="py-2.5 px-2 font-bold font-mono text-slate-700">{c.room.code}</td>
                        <td className="py-2.5 px-2 truncate max-w-[150px]">{c.room.description}</td>
                        <td className="py-2.5 px-2 font-mono text-right">{formatNumber(c.adoptedFlow, 0)}</td>
                        
                        {/* Upstream temp input */}
                        <td className="py-1 px-1 w-24 text-center">
                          <input
                            type="number"
                            step="0.1"
                            value={c.room.reheatCoilUpstreamTemp}
                            onChange={e => handleUpdateRoomField(c.room.id, 'reheatCoilUpstreamTemp', Number(e.target.value))}
                            className="w-full p-1 text-center rounded-lg border border-slate-200 outline-none font-semibold font-mono"
                          />
                        </td>
                        
                        {/* Downstream temp (equals Winter Supply Temp) */}
                        <td className="py-2.5 px-2 text-center font-bold text-slate-700">{c.room.supplyTempWinter}°C</td>
                        
                        <td className="py-2.5 px-2 font-mono text-right text-blue-700">{formatNumber(c.reheatPower_kW, 2)}</td>
                        <td className="py-2.5 px-2 font-mono text-right text-blue-800 font-bold">{formatNumber(c.reheatDesignPower_kW, 2)}</td>
                        <td className="py-2.5 px-2 font-mono text-right text-slate-500">{formatNumber(c.waterFlowMin_lth, 0)}</td>
                        <td className="py-2.5 px-2 font-mono text-right text-orange-700 font-black">{formatNumber(c.waterFlowDesign_lth, 0)}</td>
                        <td className="py-2.5 px-2 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold font-mono text-[9px] border border-slate-200">
                            {dn}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals reheating */}
                  <tr className="bg-slate-100 font-black text-slate-800 border-t border-slate-350">
                    <td colSpan={3} className="py-2.5 px-2">TOTALE BATTERIE POST</td>
                    <td className="py-2.5 px-2 text-right font-mono">
                      {formatNumber(roomCalculations.reduce((sum, c) => sum + c.adoptedFlow, 0), 0)}
                    </td>
                    <td colSpan={2}></td>
                    <td className="py-2.5 px-2 text-right font-mono text-blue-700">
                      {formatNumber(roomCalculations.reduce((sum, c) => sum + c.reheatPower_kW, 0), 2)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-blue-800">
                      {formatNumber(roomCalculations.reduce((sum, c) => sum + c.reheatDesignPower_kW, 0), 2)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-500">
                      {formatNumber(roomCalculations.reduce((sum, c) => sum + c.waterFlowMin_lth, 0), 0)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-orange-700">
                      {formatNumber(roomCalculations.reduce((sum, c) => sum + c.waterFlowDesign_lth, 0), 0)}
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
        )}

        {/* TAB 5: Riepilogo Consumi */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            {/* System aggregate summary card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">
                Consumi Totali e Dimensionamento Linee per Impianto (UTA)
              </h4>

              <div className="overflow-x-auto text-[10px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px] bg-slate-50/50">
                      <th className="py-2.5 px-2">Sistema UTA</th>
                      <th className="py-2.5 px-2 font-mono text-right">Mandata Adottata (m³/h)</th>
                      <th className="py-2.5 px-2 font-mono text-right">Ripresa Adottata (m³/h)</th>
                      <th className="py-2.5 px-2 font-mono text-right">Potenza Post Calore (kW)</th>
                      <th className="py-2.5 px-2 font-mono text-right">Portata H2O Post Calore (l/h)</th>
                      <th className="py-2.5 px-2">Diametro Linea Acqua (DN)</th>
                      <th className="py-2.5 px-2">Valvola Regolazione Consigliata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemCalculations.map(s => {
                      const dn = getPipeSizeDN(s.totalWaterFlow_lth);
                      const valve = getValveKvs(s.totalWaterFlow_lth);
                      return (
                        <tr key={s.system.id} className="border-b border-slate-100 hover:bg-slate-50/45">
                          <td className="py-2.5 px-2 font-bold font-mono">{s.system.name}</td>
                          <td className="py-2.5 px-2 font-mono text-right">{formatNumber(s.totalMandata, 0)}</td>
                          <td className="py-2.5 px-2 font-mono text-right">{formatNumber(s.totalRipresa, 0)}</td>
                          <td className="py-2.5 px-2 font-mono text-right text-blue-700">{formatNumber(s.totalReheatDesignPower_kW, 2)}</td>
                          <td className="py-2.5 px-2 font-mono text-right text-orange-700 font-bold">{formatNumber(s.totalWaterFlow_lth, 0)}</td>
                          <td className="py-2.5 px-2">
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold font-mono text-[9px] border border-blue-200">
                              {dn}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 font-semibold text-slate-650">{valve}</td>
                        </tr>
                      );
                    })}
                    {/* Grand totals */}
                    <tr className="bg-slate-150 font-black text-slate-800 border-t border-slate-400">
                      <td className="py-3 px-2">TOTALE IMPIANTI</td>
                      <td className="py-3 px-2 font-mono text-right">
                        {formatNumber(systemCalculations.reduce((sum, s) => sum + s.totalMandata, 0), 0)}
                      </td>
                      <td className="py-3 px-2 font-mono text-right">
                        {formatNumber(systemCalculations.reduce((sum, s) => sum + s.totalRipresa, 0), 0)}
                      </td>
                      <td className="py-3 px-2 font-mono text-right text-blue-800">
                        {formatNumber(systemCalculations.reduce((sum, s) => sum + s.totalReheatDesignPower_kW, 0), 2)}
                      </td>
                      <td className="py-3 px-2 font-mono text-right text-orange-850 font-black">
                        {formatNumber(systemCalculations.reduce((sum, s) => sum + s.totalWaterFlow_lth, 0), 0)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Print Friendly Project summary Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">
                Generatore di Report di Progetto
              </h4>
              <p className="text-xs text-slate-500">Puoi stampare questo report o salvarlo in PDF. Vengono inclusi i criteri di design, le portate d'aria adottate e i bilanci dei consumi energetici di tutte le stanze.</p>
              <div>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  🖨️ Stampa / Salva in PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
