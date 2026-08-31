import React, { useState, useMemo } from 'react';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import { formatNumber } from '../utils/format';
import { 
  Flame, 
  Snowflake, 
  Building2, 
  Plus, 
  Trash2, 
  Copy, 
  ArrowRight, 
  Check, 
  Sliders, 
  PieChart as PieChartIcon, 
  Sparkles,
  ThermometerSun,
  Layers
} from 'lucide-react';

export interface RoomItem {
  id: string;
  name: string;
  length_m: number | '';
  width_m: number | '';
  area_m2: number | '';
  height_m: number | '';
  isHeated: boolean;
  isCooled: boolean;
  servedByRoomId?: string; // ID del locale master che climatizza questo locale (se vuoto = terminale autonomo)
  notes: string;
}

export interface FloorItem {
  id: string;
  name: string;
  defaultHeight_m: number | '';
  vmcHeat_kW?: number | ''; // Potenza Batteria Calda VMC in kW
  vmcCool_kW?: number | ''; // Potenza Batteria Fredda VMC in kW
  rooms: RoomItem[];
}

interface ToolCarichiClimatizzazioneProps {
  projectData: ProjectData;
  setProjectData: (data: any) => void;
  setAppMode: (mode: string) => void;
}

const PRESETS_QP = [
  { label: 'Classe A / Nuova Costruz. (20 W/m³)', val: 20 },
  { label: 'Standard / Ristrutturato (25 W/m³)', val: 25 },
  { label: 'Non coibentato / Anni 80-90 (35 W/m³)', val: 35 },
  { label: 'Elevata dispersione / Storico (45 W/m³)', val: 45 }
];

const PRESETS_QC = [
  { label: 'Basso carico / Schermato (15 W/m³)', val: 15 },
  { label: 'Residenziale standard (20 W/m³)', val: 20 },
  { label: 'Alta insolazione / Mansarda (25 W/m³)', val: 25 },
  { label: 'Elevati apporti / Vetrate (35 W/m³)', val: 35 }
];

const createEmptyRoom = (name = ''): RoomItem => ({
  id: `r_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  name: name,
  length_m: '',
  width_m: '',
  area_m2: '',
  height_m: '',
  isHeated: true,
  isCooled: true,
  servedByRoomId: '',
  notes: ''
});

const createEmptyFloor = (name = 'Piano Terra', defaultH: number | '' = 2.7): FloorItem => ({
  id: `floor_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  name: name,
  defaultHeight_m: defaultH,
  vmcHeat_kW: '',
  vmcCool_kW: '',
  rooms: [createEmptyRoom('')]
});

export function ToolCarichiClimatizzazione({ 
  projectData, 
  setProjectData, 
  setAppMode 
}: ToolCarichiClimatizzazioneProps) {
  // Parametri di calcolo globali
  const [qpSpecific, setQpSpecific] = useState<number | ''>(25); // W/m3
  const [qcSpecific, setQcSpecific] = useState<number | ''>(20); // W/m3

  // Batteria Recuperatore / VMC Centralizzata Fabbricato (opzionale se non distribuita per piano)
  const [centralVmcHeat_kW, setCentralVmcHeat_kW] = useState<number | ''>('');
  const [centralVmcCool_kW, setCentralVmcCool_kW] = useState<number | ''>('');

  // Tab di visualizzazione grafici a schermo
  const [chartSeason, setChartSeason] = useState<'termico' | 'frigo'>('termico');

  // Modale esportazione verso carichi termici
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportMode, setExportMode] = useState<'floors' | 'rooms'>('floors');
  const [exportSeason, setExportSeason] = useState<'heating' | 'cooling'>('heating');

  // Struttura piani e stanze iniziale completamente vuota
  const [floors, setFloors] = useState<FloorItem[]>([
    {
      id: 'floor_1',
      name: 'Piano Terra',
      defaultHeight_m: 2.7,
      vmcHeat_kW: '',
      vmcCool_kW: '',
      rooms: [
        {
          id: 'r_init_1',
          name: '',
          length_m: '',
          width_m: '',
          area_m2: '',
          height_m: '',
          isHeated: true,
          isCooled: true,
          servedByRoomId: '',
          notes: ''
        }
      ]
    }
  ]);

  // Calcoli processati per piani e stanze
  const processedData = useMemo(() => {
    const qp = Number(qpSpecific) || 0;
    const qc = Number(qcSpecific) || 0;

    let buildingArea = 0;
    let buildingVol = 0;
    let buildingRoomsQp_W = 0;
    let buildingRoomsQc_W = 0;
    let floorTotalVmcHeat_kW = 0;
    let floorTotalVmcCool_kW = 0;

    const processedFloors = floors.map(floor => {
      const floorDefaultH = Number(floor.defaultHeight_m) > 0 ? Number(floor.defaultHeight_m) : 2.7;
      let floorArea = 0;
      let floorVol = 0;
      let floorRoomsQp_W = 0;
      let floorRoomsQc_W = 0;

      // Passaggio 1: Calcolo geometrico e carichi propri del locale
      const initialRooms = floor.rooms.map(room => {
        let area = 0;
        if (room.area_m2 !== '' && Number(room.area_m2) > 0) {
          area = Number(room.area_m2);
        } else if (Number(room.length_m) > 0 && Number(room.width_m) > 0) {
          area = Number(room.length_m) * Number(room.width_m);
        }

        const effectiveH = Number(room.height_m) > 0 ? Number(room.height_m) : floorDefaultH;
        const volume = area * effectiveH;

        const roomQp_W = room.isHeated ? volume * qp : 0;
        const roomQc_W = room.isCooled ? volume * qc : 0;
        const btuH_heat = roomQp_W * 3.412142;
        const btuH_cool = roomQc_W * 3.412142;

        floorArea += area;
        floorVol += volume;
        floorRoomsQp_W += roomQp_W;
        floorRoomsQc_W += roomQc_W;

        return {
          ...room,
          computedArea: area,
          effectiveH,
          volume,
          qp_W: roomQp_W,
          qc_W: roomQc_W,
          btuH_heat,
          btuH_cool
        };
      });

      // Passaggio 2: Accoppiamento Master / Satellite per il calcolo del terminale consigliato
      const processedRooms = initialRooms.map(room => {
        const masterRoom = initialRooms.find(r => r.id === room.servedByRoomId && r.id !== room.id);
        const isSatellite = !!masterRoom && !!room.isCooled;

        if (isSatellite) {
          return {
            ...room,
            isSatellite: true,
            masterRoomId: masterRoom.id,
            masterRoomName: masterRoom.name || 'Locale adiacente',
            satelliteRooms: [],
            satelliteQc_W: 0,
            terminalQc_W: 0,
            splitBtu: '-',
            splitKw: '-'
          };
        }

        // È locale autonomo o master: trova eventuali satelliti associati a questo locale
        const satellites = initialRooms.filter(r => r.servedByRoomId === room.id && r.id !== room.id && r.isCooled);
        const satelliteQc_W = satellites.reduce((acc, s) => acc + s.qc_W, 0);
        const terminalQc_W = (room.isCooled ? room.qc_W : 0) + satelliteQc_W;

        let splitBtu = '-';
        let splitKw = '';
        if (terminalQc_W > 0) {
          if (terminalQc_W <= 2200) { splitBtu = '7.000 BTU/h'; splitKw = '2,0 kW'; }
          else if (terminalQc_W <= 2900) { splitBtu = '9.000 BTU/h'; splitKw = '2,5 kW'; }
          else if (terminalQc_W <= 4000) { splitBtu = '12.000 BTU/h'; splitKw = '3,5 kW'; }
          else if (terminalQc_W <= 5800) { splitBtu = '18.000 BTU/h'; splitKw = '5,0 kW'; }
          else { splitBtu = '24.000+ BTU/h'; splitKw = '7,0+ kW'; }
        }

        return {
          ...room,
          isSatellite: false,
          masterRoomId: undefined,
          masterRoomName: undefined,
          satelliteRooms: satellites.map(s => ({
            id: s.id,
            name: s.name || 'Locale adiacente',
            qc_W: s.qc_W,
            qc_kW: s.qc_W / 1000
          })),
          satelliteQc_W,
          terminalQc_W,
          splitBtu,
          splitKw
        };
      });

      // Potenze delle batterie VMC del piano
      const floorVmcHeat_kW = Number(floor.vmcHeat_kW) > 0 ? Number(floor.vmcHeat_kW) : 0;
      const floorVmcCool_kW = Number(floor.vmcCool_kW) > 0 ? Number(floor.vmcCool_kW) : 0;
      const floorVmcHeat_W = floorVmcHeat_kW * 1000;
      const floorVmcCool_W = floorVmcCool_kW * 1000;

      const floorTotalQp_W = floorRoomsQp_W + floorVmcHeat_W;
      const floorTotalQc_W = floorRoomsQc_W + floorVmcCool_W;
      const floorTotalQp_kW = floorTotalQp_W / 1000;
      const floorTotalQc_kW = floorTotalQc_W / 1000;

      buildingArea += floorArea;
      buildingVol += floorVol;
      buildingRoomsQp_W += floorRoomsQp_W;
      buildingRoomsQc_W += floorRoomsQc_W;
      floorTotalVmcHeat_kW += floorVmcHeat_kW;
      floorTotalVmcCool_kW += floorVmcCool_kW;

      return {
        ...floor,
        rooms: processedRooms,
        totalArea: floorArea,
        totalVol: floorVol,
        roomsQp_W: floorRoomsQp_W,
        roomsQc_W: floorRoomsQc_W,
        roomsQp_kW: floorRoomsQp_W / 1000,
        roomsQc_kW: floorRoomsQc_W / 1000,
        vmcHeat_kW: floor.vmcHeat_kW ?? '',
        vmcCool_kW: floor.vmcCool_kW ?? '',
        vmcHeat_W: floorVmcHeat_W,
        vmcCool_W: floorVmcCool_W,
        hasVmc: floorVmcHeat_kW > 0 || floorVmcCool_kW > 0,
        totalQp_W: floorTotalQp_W,
        totalQc_W: floorTotalQc_W,
        totalQp_kW: floorTotalQp_kW,
        totalQc_kW: floorTotalQc_kW
      };
    });

    const centralHeat_kW = Number(centralVmcHeat_kW) > 0 ? Number(centralVmcHeat_kW) : 0;
    const centralCool_kW = Number(centralVmcCool_kW) > 0 ? Number(centralVmcCool_kW) : 0;
    const totalBuildingVmcHeat_kW = floorTotalVmcHeat_kW + centralHeat_kW;
    const totalBuildingVmcCool_kW = floorTotalVmcCool_kW + centralCool_kW;

    const buildingTotalQp_W = buildingRoomsQp_W + (totalBuildingVmcHeat_kW * 1000);
    const buildingTotalQc_W = buildingRoomsQc_W + (totalBuildingVmcCool_kW * 1000);
    const buildingTotalQp_kW = buildingTotalQp_W / 1000;
    const buildingTotalQc_kW = buildingTotalQc_W / 1000;

    return {
      floors: processedFloors,
      building: {
        totalArea: buildingArea,
        totalVol: buildingVol,
        roomsQp_W: buildingRoomsQp_W,
        roomsQc_W: buildingRoomsQc_W,
        roomsQp_kW: buildingRoomsQp_W / 1000,
        roomsQc_kW: buildingRoomsQc_W / 1000,
        floorVmcHeat_kW: floorTotalVmcHeat_kW,
        floorVmcCool_kW: floorTotalVmcCool_kW,
        centralVmcHeat_kW: centralHeat_kW,
        centralVmcCool_kW: centralCool_kW,
        totalVmcHeat_kW: totalBuildingVmcHeat_kW,
        totalVmcCool_kW: totalBuildingVmcCool_kW,
        hasFloorVmc: floorTotalVmcHeat_kW > 0 || floorTotalVmcCool_kW > 0,
        hasCentralVmc: centralHeat_kW > 0 || centralCool_kW > 0,
        hasVmc: totalBuildingVmcHeat_kW > 0 || totalBuildingVmcCool_kW > 0,
        totalQp_W: buildingTotalQp_W,
        totalQc_W: buildingTotalQc_W,
        totalQp_kW: buildingTotalQp_kW,
        totalQc_kW: buildingTotalQc_kW,
        totalBtuH_heat: buildingTotalQp_W * 3.412142,
        totalBtuH_cool: buildingTotalQc_W * 3.412142
      }
    };
  }, [floors, qpSpecific, qcSpecific, centralVmcHeat_kW, centralVmcCool_kW]);

  // Gestione Piani
  const addFloor = () => {
    const num = floors.length + 1;
    const newFloor = createEmptyFloor(`Piano ${num}`, 2.7);
    setFloors([...floors, newFloor]);
  };

  const duplicateFloor = (floorId: string) => {
    const floorToCopy = floors.find(f => f.id === floorId);
    if (!floorToCopy) return;
    const newFloor: FloorItem = {
      ...floorToCopy,
      id: `floor_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: `${floorToCopy.name} (Copia)`,
      rooms: floorToCopy.rooms.map(r => ({
        ...r,
        id: `r_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      }))
    };
    setFloors([...floors, newFloor]);
  };

  const removeFloor = (floorId: string) => {
    if (floors.length <= 1) {
      window.suiteUI?.alert('È necessario mantenere almeno un piano nell\'edificio.', 'Attenzione');
      return;
    }
    setFloors(floors.filter(f => f.id !== floorId));
  };

  const updateFloor = (floorId: string, field: keyof FloorItem, val: any) => {
    setFloors(floors.map(f => {
      if (f.id === floorId) {
        return { ...f, [field]: val };
      }
      return f;
    }));
  };

  // Gestione Stanze
  const addRoom = (floorId: string) => {
    setFloors(floors.map(f => {
      if (f.id === floorId) {
        const newRoom = createEmptyRoom('');
        return { ...f, rooms: [...f.rooms, newRoom] };
      }
      return f;
    }));
  };

  const duplicateRoom = (floorId: string, roomId: string) => {
    setFloors(floors.map(f => {
      if (f.id === floorId) {
        const rIndex = f.rooms.findIndex(r => r.id === roomId);
        if (rIndex === -1) return f;
        const target = f.rooms[rIndex];
        const newRoom: RoomItem = {
          ...target,
          id: `r_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: target.name ? `${target.name} (Copia)` : ''
        };
        const newRooms = [...f.rooms];
        newRooms.splice(rIndex + 1, 0, newRoom);
        return { ...f, rooms: newRooms };
      }
      return f;
    }));
  };

  const removeRoom = (floorId: string, roomId: string) => {
    setFloors(floors.map(f => {
      if (f.id === floorId) {
        if (f.rooms.length <= 1) {
          window.suiteUI?.toast('Ogni piano deve avere almeno un locale.', 'warning');
          return f;
        }
        return { ...f, rooms: f.rooms.filter(r => r.id !== roomId) };
      }
      return f;
    }));
  };

  const updateRoom = (floorId: string, roomId: string, field: keyof RoomItem, val: any) => {
    setFloors(prevFloors => prevFloors.map(f => {
      if (f.id === floorId) {
        return {
          ...f,
          rooms: f.rooms.map(r => {
            if (r.id === roomId) {
              const updated = { ...r, [field]: val };

              // Sincronizzazione automatica tra Lati (lunghezza x larghezza) e Superficie
              if (field === 'length_m' || field === 'width_m') {
                const l = field === 'length_m' ? (val === '' ? '' : Number(val)) : (r.length_m === '' ? '' : Number(r.length_m));
                const w = field === 'width_m' ? (val === '' ? '' : Number(val)) : (r.width_m === '' ? '' : Number(r.width_m));
                if (typeof l === 'number' && l > 0 && typeof w === 'number' && w > 0) {
                  updated.area_m2 = Number((l * w).toFixed(2));
                }
              } else if (field === 'area_m2') {
                const numArea = val === '' ? '' : Number(val);
                const expectedArea = (Number(r.length_m) || 0) * (Number(r.width_m) || 0);
                if (numArea !== '' && Math.abs(Number(numArea) - expectedArea) > 0.01) {
                  updated.length_m = '';
                  updated.width_m = '';
                }
              }
              return updated;
            }
            return r;
          })
        };
      }
      return f;
    }));
  };

  // Integrazione salvataggio su Cloud Firestore
  const handleLoadCloudProject = (data: any) => {
    if (!data) return;
    if (data.qpSpecific !== undefined) setQpSpecific(data.qpSpecific);
    if (data.qcSpecific !== undefined) setQcSpecific(data.qcSpecific);
    if (data.centralVmcHeat_kW !== undefined) setCentralVmcHeat_kW(data.centralVmcHeat_kW);
    if (data.centralVmcCool_kW !== undefined) setCentralVmcCool_kW(data.centralVmcCool_kW);
    if (data.floors && Array.isArray(data.floors)) {
      setFloors(data.floors);
    }
  };

  const getCloudSaveData = () => {
    return {
      qpSpecific,
      qcSpecific,
      centralVmcHeat_kW,
      centralVmcCool_kW,
      floors
    };
  };

  // Esportazione verso Tool Carichi Termici & Reti
  const handleTransferToCarichiTermici = () => {
    let transferLoads: Array<{
      id: number;
      name: string;
      mode: 'power';
      inputVal: number;
      material: string;
      DN: string;
      PN: string;
    }> = [];

    if (exportMode === 'floors') {
      transferLoads = processedData.floors
        .filter(floor => (exportSeason === 'heating' ? floor.totalQp_W : floor.totalQc_W) > 0)
        .map((floor, idx) => {
          const power_kW = exportSeason === 'heating' ? floor.totalQp_kW : floor.totalQc_kW;
          return {
            id: idx + 1,
            name: `${floor.name} (${exportSeason === 'heating' ? 'Riscaldamento' : 'Raffrescamento'})`,
            mode: 'power',
            inputVal: Number(power_kW.toFixed(2)),
            material: 'Acciaio',
            DN: '25',
            PN: 'NORM'
          };
        });

      // Se presente batteria VMC centralizzata, esporta come utenza di centrale
      const centralVmc_kW = exportSeason === 'heating' ? processedData.building.centralVmcHeat_kW : processedData.building.centralVmcCool_kW;
      if (centralVmc_kW > 0) {
        transferLoads.push({
          id: transferLoads.length + 1,
          name: `Batteria VMC Centralizzata Fabbricato (${exportSeason === 'heating' ? 'Riscaldamento' : 'Raffrescamento'})`,
          mode: 'power',
          inputVal: Number(centralVmc_kW.toFixed(2)),
          material: 'Acciaio',
          DN: '25',
          PN: 'NORM'
        });
      }
    } else {
      let currentId = 1;
      processedData.floors.forEach(floor => {
        floor.rooms.forEach(room => {
          if (exportSeason === 'cooling') {
            // Se il locale è satellite di un'altra stanza, il suo carico è già inglobato nel master
            if (room.isSatellite) return;
            const power_W = room.terminalQc_W;
            if (power_W > 0) {
              const roomDisplayName = room.name ? room.name : `Locale ${currentId}`;
              const satSuffix = room.satelliteRooms && room.satelliteRooms.length > 0
                ? ` (incl. ${room.satelliteRooms.map(s => s.name).join(', ')})`
                : '';
              transferLoads.push({
                id: currentId++,
                name: `${roomDisplayName}${satSuffix} (${floor.name})`,
                mode: 'power',
                inputVal: Number((power_W / 1000).toFixed(2)),
                material: 'Multistrato',
                DN: '16',
                PN: 'NORM'
              });
            }
          } else {
            const power_W = room.qp_W;
            if (power_W > 0) {
              const roomDisplayName = room.name ? room.name : `Locale ${currentId}`;
              transferLoads.push({
                id: currentId++,
                name: `${roomDisplayName} (${floor.name})`,
                mode: 'power',
                inputVal: Number((power_W / 1000).toFixed(2)),
                material: 'Multistrato',
                DN: '16',
                PN: 'NORM'
              });
            }
          }
        });

        // Se presente batteria VMC al piano, esporta anche il relativo carico
        const vmcPower_kW = exportSeason === 'heating' ? Number(floor.vmcHeat_kW) : Number(floor.vmcCool_kW);
        if (vmcPower_kW > 0) {
          transferLoads.push({
            id: currentId++,
            name: `Batteria VMC (${floor.name})`,
            mode: 'power',
            inputVal: Number(vmcPower_kW.toFixed(2)),
            material: 'Acciaio',
            DN: '20',
            PN: 'NORM'
          });
        }
      });

      // Se presente batteria VMC centralizzata, esporta anche per la modalità stanze
      const centralVmc_kW = exportSeason === 'heating' ? processedData.building.centralVmcHeat_kW : processedData.building.centralVmcCool_kW;
      if (centralVmc_kW > 0) {
        transferLoads.push({
          id: currentId++,
          name: `Batteria VMC Centralizzata Fabbricato`,
          mode: 'power',
          inputVal: Number(centralVmc_kW.toFixed(2)),
          material: 'Acciaio',
          DN: '25',
          PN: 'NORM'
        });
      }
    }

    if (transferLoads.length === 0) {
      window.suiteUI?.alert('Nessun carico utile da esportare. Inserisci prima le dimensioni dei locali riscaldati o raffrescati.', 'Attenzione');
      return;
    }

    try {
      sessionStorage.setItem('pending_import_carichi_termici', JSON.stringify({
        loads: transferLoads,
        source: 'Carichi Climatizzazione Ambienti',
        timestamp: Date.now()
      }));
      window.suiteUI?.toast(`${transferLoads.length} utenze trasferite con successo a Carichi Termici & Reti!`, 'success');
      setShowExportModal(false);
      setAppMode('termico');
    } catch (e) {
      console.error('Errore nel salvataggio dei carichi esportati:', e);
      window.suiteUI?.toast('Errore durante il trasferimento dei dati.', 'error');
    }
  };

  // Rendering Grafici SVG per Piano
  const renderCharts = (isPrintView = false, forcedSeason?: 'termico' | 'frigo') => {
    const activeSeason = isPrintView && forcedSeason ? forcedSeason : chartSeason;
    const isHeat = activeSeason === 'termico';
    const activeColor = isHeat ? '#ea580c' : '#0284c7';
    const totalVal_kW = isHeat ? processedData.building.totalQp_kW : processedData.building.totalQc_kW;

    const dataItems = processedData.floors.map(floor => ({
      label: floor.name,
      kW: isHeat ? floor.totalQp_kW : floor.totalQc_kW,
      area: floor.totalArea
    }));

    const colors = isHeat 
      ? ['#f97316', '#ea580c', '#c2410c', '#fb923c', '#fdba74', '#b45309']
      : ['#0284c7', '#0369a1', '#075985', '#38bdf8', '#7dd3fc', '#0e7490'];

    let accumulatedPercent = 0;
    const donutSlices = dataItems.map((item, idx) => {
      const val = item.kW || 0;
      const percent = totalVal_kW > 0 ? (val / totalVal_kW) : 0;
      const strokeLength = percent * 251.2;
      const strokeOffset = accumulatedPercent * 251.2;
      accumulatedPercent += percent;
      return {
        ...item,
        percent: percent * 100,
        strokeLength,
        strokeOffset: -strokeOffset,
        color: colors[idx % colors.length]
      };
    });

    const titleText = isPrintView 
      ? (isHeat ? 'Ripartizione Riscaldamento Invernale (Qp)' : 'Ripartizione Raffrescamento Estivo (Qc)')
      : 'Ripartizione Carichi per Piano';

    return (
      <div className={`bg-white rounded-2xl shadow-sm p-6 border border-slate-200 mt-4 ${isPrintView ? 'print:shadow-none print:border print:border-slate-300 print:p-3 print:mt-2 print:break-inside-avoid' : 'print:hidden'}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4 print:pb-1.5 print:mb-2">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 print:text-xs">
            {isHeat ? <Flame className="w-4 h-4 text-orange-600 shrink-0" /> : <Snowflake className="w-4 h-4 text-sky-600 shrink-0" />}
            <span>{titleText}</span>
          </h3>

          {!isPrintView && (
            <div className="flex items-center gap-2 print:hidden">
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setChartSeason('termico')}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    isHeat ? 'bg-white shadow text-orange-650 font-bold' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Riscaldamento</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChartSeason('frigo')}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    !isHeat ? 'bg-white shadow text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Snowflake className="w-3.5 h-3.5" />
                  <span>Raffrescamento</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center print:grid-cols-2 print:gap-3">
          {/* Ciambella Donut */}
          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 flex flex-col sm:flex-row items-center gap-4 print:border-slate-200 print:bg-white print:p-2">
            <div className="w-36 h-36 flex-shrink-0 relative print:w-24 print:h-24">
              {totalVal_kW > 0 ? (
                <svg width="100%" height="100%" viewBox="0 0 120 120" className="-rotate-90">
                  {donutSlices.map((slice, i) => (
                    <circle
                      key={i}
                      cx="60"
                      cy="60"
                      r="40"
                      fill="transparent"
                      stroke={slice.color}
                      strokeWidth="16"
                      strokeDasharray={`${slice.strokeLength.toFixed(1)} 251.3`}
                      strokeDashoffset={slice.strokeOffset.toFixed(1)}
                      className="transition-all duration-300"
                    />
                  ))}
                  <circle cx="60" cy="60" r="32" fill="#ffffff" />
                </svg>
              ) : (
                <div className="w-full h-full rounded-full border-4 border-dashed border-slate-200 flex items-center justify-center text-[10px] text-slate-400">
                  Nessun carico
                </div>
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 print:text-[6px]">
                  {isHeat ? 'Tot. Termico' : 'Tot. Frigo'}
                </span>
                <span className="text-xs font-black text-slate-800 font-mono print:text-[9px]">
                  {formatNumber(totalVal_kW, 2)} kW
                </span>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-center space-y-1.5 w-full max-h-36 overflow-y-auto pr-1 print:max-h-none print:overflow-visible print:space-y-1">
              {totalVal_kW > 0 ? (
                donutSlices.map((slice, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] text-slate-600 print:text-[9px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0 print:w-2 print:h-2" style={{ backgroundColor: slice.color }}></span>
                      <span className="truncate font-semibold text-slate-700">{slice.label}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-800 shrink-0 ml-2 whitespace-nowrap">
                      {formatNumber(slice.kW, 2)} kW ({formatNumber(slice.percent, 0)}%)
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-4">Nessun dato disponibile.</p>
              )}
            </div>
          </div>

          {/* Riepilogo a Barre */}
          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-3 print:border-slate-200 print:bg-white print:p-2">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider print:text-[9px]">
              Dettaglio Potenza Richiesta ({isHeat ? 'Riscaldamento Qp' : 'Raffrescamento Qc'})
            </h4>
            <div className="space-y-2.5 max-h-36 overflow-y-auto pr-1 print:max-h-none print:overflow-visible print:space-y-1.5">
              {totalVal_kW > 0 ? (
                dataItems.map((item, idx) => {
                  const percent = totalVal_kW > 0 ? (item.kW / totalVal_kW) * 100 : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold print:text-[9px]">
                        <span className="text-slate-700">{item.label}</span>
                        <span className="font-mono text-slate-900 font-bold whitespace-nowrap">
                          {formatNumber(item.kW, 2)} kW <span className="text-[10px] text-slate-400 font-normal print:text-[8px]">({formatNumber(item.kW * 3412.142, 0)} BTU/h)</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden print:h-1.5">
                        <div 
                          className="h-full rounded-full transition-all duration-300" 
                          style={{ width: `${Math.min(100, Math.max(0, percent))}%`, backgroundColor: activeColor }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-4">Nessun carico disponibile da mostrare.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-12">
      {/* Cloud & Local Storage */}
      <div className="mb-6 print:hidden">
        <ProjectStorage 
          toolType="carichi_climatizzazione"
          currentData={getCloudSaveData()}
          onLoadProject={handleLoadCloudProject}
          projectInfo={projectData}
          setProjectInfo={setProjectData}
        />
      </div>

      <ProjectHeader 
        pData={projectData} 
        setPData={setProjectData} 
        title="Calcolo Carichi Climatizzazione Ambienti" 
        setAppMode={setAppMode} 
        iconColor="orange" 
        docCode="M_4.4.6_E4_Term_00"
      />

      {/* ========================================================================= */}
      {/* VISTA A SCHERMO (PRINT:HIDDEN)                                           */}
      {/* ========================================================================= */}
      <div className="print:hidden">
        {/* Box Spiegazione e Formule Metodologiche con Unità di Misura esplicite */}
        <div className="bg-sky-50/60 border border-sky-200/60 rounded-2xl p-4 mb-6 text-xs text-slate-650 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <ThermometerSun className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800 text-sm mb-1">
                Metodo di Calcolo Volumetrico per Impianti Termici & Frigoriferi
              </p>
              <p className="leading-relaxed">
                Puoi aggiungere e rinominare i <strong>piani dell'edificio</strong> a piacimento. Per ciascun locale inserisci i due lati (<strong className="text-slate-800">m × m</strong>) per calcolare in automatico la superficie, 
                oppure digita direttamente i <strong className="text-slate-800">m²</strong>. 
                Il tool calcola la potenza termica invernale (<strong className="text-orange-650">Q<sub>p</sub></strong>) 
                e frigorifera estiva (<strong className="text-sky-600">Q<sub>c</sub></strong>) in <strong>W</strong>, <strong>kW</strong> e <strong>BTU/h</strong> per ogni stanza, piano e per l'intero fabbricato.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white/80 border border-sky-100 rounded-xl p-3 text-slate-700">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">1. Superficie & Volume:</span>
              <p className="font-mono text-xs font-bold text-slate-800">S = Lato₁ [m] × Lato₂ [m] = [m²]</p>
              <p className="font-mono text-[11px] text-slate-600">V = Superficie [m²] × Altezza [m] = [m³]</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600">2. Potenza Riscaldamento (Inverno):</span>
              <p className="font-mono text-xs font-bold text-orange-800">Q<sub>p</sub> = V [m³] × q<sub>p</sub> [W/m³] = [W]</p>
              <p className="font-mono text-[11px] text-orange-700">P [kW] = Q<sub>p</sub> / 1.000 | 1 W = 3,412 BTU/h</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600">3. Potenza Raffrescamento (Estate):</span>
              <p className="font-mono text-xs font-bold text-sky-800">Q<sub>c</sub> = V [m³] × q<sub>c</sub> [W/m³] = [W]</p>
              <p className="font-mono text-[11px] text-sky-700">P [kW] = Q<sub>c</sub> / 1.000 | 1 W = 3,412 BTU/h</p>
            </div>
          </div>
        </div>

        {/* Parametri Globali di Progetto */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 mb-6">
          <h3 className="text-sm font-bold text-slate-800 mb-2 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-orange-650" />
            <span>Coefficienti Termo-Frigoriferi di Progetto (W/m³)</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Coefficiente Termico Qp */}
            <div className="bg-orange-50/40 border border-orange-200/60 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-600 shrink-0" />
                  <span className="uppercase tracking-wide">Potenza Termica Specifica</span>
                  <span className="font-mono text-orange-700 font-semibold tracking-normal lowercase normal-case">(q<sub>p</sub>)</span>
                </label>
                <div className="flex items-center gap-1">
                  <input 
                    type="number"
                    step="1"
                    min="5"
                    max="100"
                    value={qpSpecific === '' ? '' : qpSpecific}
                    onChange={e => setQpSpecific(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-20 bg-white font-mono font-black text-center text-orange-850 p-1.5 rounded-lg border border-orange-300 focus:outline-none focus:border-orange-500 text-sm shadow-sm"
                  />
                  <span className="text-xs font-bold text-orange-800">W/m³</span>
                </div>
              </div>

              {/* Presets Qp */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Preset Rapidi Riscaldamento:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESETS_QP.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setQpSpecific(p.val)}
                      className={`text-[11px] text-left p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                        qpSpecific === p.val 
                          ? 'bg-orange-600 text-white font-bold border-orange-600 shadow-sm' 
                          : 'bg-white text-slate-700 border-orange-100 hover:bg-orange-100/50'
                      }`}
                    >
                      <span className="truncate">{p.label.split('(')[0]}</span>
                      <span className="font-mono text-[10px] ml-1 opacity-90">{p.val} W</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Coefficiente Frigorifero Qc */}
            <div className="bg-sky-50/40 border border-sky-200/60 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                  <Snowflake className="w-4 h-4 text-sky-600 shrink-0" />
                  <span className="uppercase tracking-wide">Potenza Frigorifera Specifica</span>
                  <span className="font-mono text-sky-700 font-semibold tracking-normal lowercase normal-case">(q<sub>c</sub>)</span>
                </label>
                <div className="flex items-center gap-1">
                  <input 
                    type="number"
                    step="1"
                    min="5"
                    max="100"
                    value={qcSpecific === '' ? '' : qcSpecific}
                    onChange={e => setQcSpecific(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-20 bg-white font-mono font-black text-center text-sky-850 p-1.5 rounded-lg border border-sky-300 focus:outline-none focus:border-sky-500 text-sm shadow-sm"
                  />
                  <span className="text-xs font-bold text-sky-800">W/m³</span>
                </div>
              </div>

              {/* Presets Qc */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Preset Rapidi Raffrescamento:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESETS_QC.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setQcSpecific(p.val)}
                      className={`text-[11px] text-left p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                        qcSpecific === p.val 
                          ? 'bg-sky-600 text-white font-bold border-sky-600 shadow-sm' 
                          : 'bg-white text-slate-700 border-sky-100 hover:bg-sky-100/50'
                      }`}
                    >
                      <span className="truncate">{p.label.split('(')[0]}</span>
                      <span className="font-mono text-[10px] ml-1 opacity-90">{p.val} W</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Batteria Centralizzata Fabbricato (VMC / UTA) - Posizionata nei Dati Iniziali */}
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-200 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-50 rounded-xl border border-amber-200/60 text-sm">💨</span>
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span>Batteria Recuperatore / VMC Centralizzata Fabbricato</span>
                  <span className="text-[10px] text-slate-400 font-normal">(Opzionale)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Compila qui se l'edificio dispone di un'unica unità VMC/UTA per tutto il fabbricato. Se compilata, disattiva automaticamente le batterie sui singoli piani.
                </p>
              </div>
            </div>
            {processedData.building.hasCentralVmc && (
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px] border border-amber-200 self-start sm:self-auto flex items-center gap-1">
                <span>✓</span>
                <span>VMC Centralizzata Attiva</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Batteria Calda Centralizzata */}
            <div className="bg-orange-50/40 border border-orange-200/60 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-orange-950 block">Batteria Calda (kW)</span>
                  <span className="text-[10px] text-slate-500">Post-Riscaldamento Aria Fabbricato</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-orange-300 shadow-2xs">
                <input 
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="0,0"
                  value={centralVmcHeat_kW === '' ? '' : centralVmcHeat_kW}
                  onChange={e => setCentralVmcHeat_kW(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-16 font-mono font-bold text-sm text-orange-900 text-center outline-none bg-transparent"
                  title="Potenza della batteria calda centralizzata in kW"
                />
                <span className="text-xs font-bold text-orange-600">kW</span>
              </div>
            </div>

            {/* Batteria Fredda Centralizzata */}
            <div className="bg-sky-50/40 border border-sky-200/60 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-sky-100 rounded-lg text-sky-600">
                  <Snowflake className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-sky-950 block">Batteria Fredda (kW)</span>
                  <span className="text-[10px] text-slate-500">Post-Raffrescamento / Deumidificazione</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-sky-300 shadow-2xs">
                <input 
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="0,0"
                  value={centralVmcCool_kW === '' ? '' : centralVmcCool_kW}
                  onChange={e => setCentralVmcCool_kW(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-16 font-mono font-bold text-sm text-sky-900 text-center outline-none bg-transparent"
                  title="Potenza della batteria fredda centralizzata in kW"
                />
                <span className="text-xs font-bold text-sky-600">kW</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sezione Piani e Ambienti */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 text-white p-4 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2.5">
              <Building2 className="w-5 h-5 text-orange-400" />
              <div>
                <h2 className="font-bold text-base">Piani & Ambienti dell'Edificio</h2>
                <p className="text-xs text-slate-400">Aggiungi e rinomina i piani a piacimento, inserisci i locali e calcola i carichi stanza per stanza</p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={addFloor}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 w-full sm:w-auto justify-center"
              >
                <Plus className="w-4 h-4" />
                <span>Aggiungi Piano</span>
              </button>
            </div>
          </div>

          {/* Elenco dei Piani */}
          {processedData.floors.map((floor) => (
            <div key={floor.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all">
              {/* Header del Piano */}
              <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-1">
                  <Layers className="w-5 h-5 text-orange-600 shrink-0" />
                  <input 
                    type="text"
                    value={floor.name}
                    onChange={e => updateFloor(floor.id, 'name', e.target.value)}
                    className="font-bold text-base text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-orange-500 outline-none px-1 flex-1 max-w-sm"
                    placeholder="Nome Piano (es. Piano Terra, Mansarda...)"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">H. Default Piano:</span>
                    <input 
                      type="number"
                      step="0.05"
                      min="1"
                      max="10"
                      value={floor.defaultHeight_m === '' ? '' : floor.defaultHeight_m}
                      onChange={e => updateFloor(floor.id, 'defaultHeight_m', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-16 font-mono font-bold text-xs text-slate-800 bg-slate-50 p-1 rounded border border-slate-300 text-center outline-none focus:border-orange-500"
                    />
                    <span className="text-xs text-slate-400 font-semibold">m</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button 
                      type="button"
                      onClick={() => duplicateFloor(floor.id)}
                      className="p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Duplica Piano"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => removeFloor(floor.id)}
                      className="p-2 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="Elimina Piano"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Barra Batteria Recuperatore / VMC del Piano (Visibile solo se NON è attiva la VMC Centralizzata) */}
              {!processedData.building.hasCentralVmc && (
                <div className="bg-slate-100/70 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">💨</span>
                    <div>
                      <span className="font-bold text-slate-800">Recuperatore di Calore / VMC con Batteria</span>
                      <span className="text-[10px] text-slate-500 block">Potenza aria primaria di rinnovo per {floor.name} (opzionale)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-orange-200 shadow-2xs">
                      <Flame className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                      <span className="text-[10px] font-bold text-orange-950">Batt. Calda:</span>
                      <input 
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="0,0"
                        value={floor.vmcHeat_kW === '' ? '' : floor.vmcHeat_kW}
                        onChange={e => updateFloor(floor.id, 'vmcHeat_kW', e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-16 font-mono font-bold text-orange-900 text-center outline-none bg-transparent"
                        title="Potenza della batteria calda del recuperatore/VMC in kW"
                      />
                      <span className="text-[10px] font-bold text-orange-600">kW</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-sky-200 shadow-2xs">
                      <Snowflake className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span className="text-[10px] font-bold text-sky-950">Batt. Fredda:</span>
                      <input 
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="0,0"
                        value={floor.vmcCool_kW === '' ? '' : floor.vmcCool_kW}
                        onChange={e => updateFloor(floor.id, 'vmcCool_kW', e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-16 font-mono font-bold text-sky-900 text-center outline-none bg-transparent"
                        title="Potenza della batteria fredda del recuperatore/VMC in kW"
                      />
                      <span className="text-[10px] font-bold text-sky-600">kW</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabella Stanze del Piano */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-3 min-w-[180px]">Ambiente / Locale</th>
                      <th className="py-3 px-1.5 text-center w-16" title="Lunghezza / Lato 1 in metri">Lato 1 (m)</th>
                      <th className="py-3 px-1.5 text-center w-16" title="Larghezza / Lato 2 in metri">Lato 2 (m)</th>
                      <th className="py-3 px-2 text-center w-20" title="Superficie utile in m² (calcolata da Lato 1 x Lato 2 oppure inserita direttamente)">Sup. (m²)</th>
                      <th className="py-3 px-2 text-center w-16" title="Altezza utile in metri (se vuota usa l'altezza del piano)">Alt. (m)</th>
                      <th className="py-3 px-2 text-center w-20" title="Volume in metri cubi (Sup. x Alt.)">Vol. (m³)</th>
                      <th className="py-3 px-2 text-center w-20" title="Attiva/Disattiva Riscaldamento e Raffrescamento">Risc. / Raffr.</th>
                      <th className="py-3 px-3 text-right min-w-[110px]" title="Potenza termica richiesta per riscaldamento invernale">Pot. Termica Qp</th>
                      <th className="py-3 px-3 text-right min-w-[110px]" title="Potenza frigorifera richiesta per raffrescamento estivo">Pot. Frigo Qc</th>
                      <th className="py-3 px-2 min-w-[150px]">Taglia terminale Consigliata</th>
                      <th className="py-3 px-2 text-center w-14">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {floor.rooms.map((room) => (
                      <tr key={room.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Nome Stanza (libero ed editabile a piacere) */}
                        <td className="py-2.5 px-3">
                          <input 
                            type="text"
                            value={room.name}
                            onChange={e => updateRoom(floor.id, room.id, 'name', e.target.value)}
                            className="w-full font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-orange-500 outline-none py-0.5 text-xs placeholder:text-slate-300"
                            placeholder="Nome locale..."
                          />
                        </td>

                        {/* Lato 1 (m) */}
                        <td className="py-2.5 px-1.5 text-center">
                          <input 
                            type="number"
                            step="0.05"
                            min="0"
                            placeholder="L1"
                            value={room.length_m === '' ? '' : room.length_m}
                            onChange={e => updateRoom(floor.id, room.id, 'length_m', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-14 font-mono text-slate-700 bg-slate-50/70 border border-slate-200 rounded p-1 text-center outline-none focus:border-orange-500 focus:bg-white text-xs placeholder:text-slate-300"
                            title="Lato 1 (m) - es. Lunghezza stanza"
                          />
                        </td>

                        {/* Lato 2 (m) */}
                        <td className="py-2.5 px-1.5 text-center">
                          <input 
                            type="number"
                            step="0.05"
                            min="0"
                            placeholder="L2"
                            value={room.width_m === '' ? '' : room.width_m}
                            onChange={e => updateRoom(floor.id, room.id, 'width_m', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-14 font-mono text-slate-700 bg-slate-50/70 border border-slate-200 rounded p-1 text-center outline-none focus:border-orange-500 focus:bg-white text-xs placeholder:text-slate-300"
                            title="Lato 2 (m) - es. Larghezza stanza"
                          />
                        </td>

                        {/* Superficie (m²) */}
                        <td className="py-2.5 px-2 text-center">
                          <input 
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="m²"
                            value={room.area_m2 === '' ? '' : room.area_m2}
                            onChange={e => updateRoom(floor.id, room.id, 'area_m2', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-16 font-mono font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded p-1 text-center outline-none focus:border-orange-500 focus:bg-white text-xs placeholder:text-slate-300"
                            title="Superficie in m² (calcolata in automatico se inseriti i due lati o inseribile manualmente)"
                          />
                        </td>

                        {/* Altezza (m) */}
                        <td className="py-2.5 px-2 text-center">
                          <input 
                            type="number"
                            step="0.05"
                            placeholder={formatNumber(Number(floor.defaultHeight_m) || 2.7, 2)}
                            value={room.height_m === '' ? '' : room.height_m}
                            onChange={e => updateRoom(floor.id, room.id, 'height_m', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-14 font-mono text-slate-600 bg-slate-50/50 border border-slate-200 rounded p-1 text-center outline-none focus:border-orange-500 focus:bg-white text-xs"
                            title="Lascia vuoto per usare l'altezza di default del piano"
                          />
                        </td>

                        {/* Volume Calcolato (m³) */}
                        <td className="py-2.5 px-2 text-center font-mono font-semibold text-slate-650">
                          {room.volume > 0 ? `${formatNumber(room.volume, 1)} m³` : '-'}
                        </td>

                        {/* Toggle Riscaldato / Raffrescato */}
                        <td className="py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateRoom(floor.id, room.id, 'isHeated', !room.isHeated)}
                              className={`p-1 rounded-md transition-all cursor-pointer ${
                                room.isHeated 
                                  ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' 
                                  : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                              }`}
                              title={room.isHeated ? 'Riscaldato: SÌ (attivo)' : 'Riscaldato: NO (disattivato)'}
                            >
                              <Flame className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => updateRoom(floor.id, room.id, 'isCooled', !room.isCooled)}
                              className={`p-1 rounded-md transition-all cursor-pointer ${
                                room.isCooled 
                                  ? 'bg-sky-100 text-sky-700 hover:bg-sky-200' 
                                  : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                              }`}
                              title={room.isCooled ? 'Raffrescato: SÌ (attivo)' : 'Raffrescato: NO (disattivato)'}
                            >
                              <Snowflake className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        {/* Potenza Termica Qp */}
                        <td className="py-2.5 px-3 text-right">
                          {room.isHeated && room.qp_W > 0 ? (
                            <div>
                              <span className="font-mono font-bold text-orange-850 text-xs whitespace-nowrap">
                                {formatNumber(room.qp_W, 0)} W
                              </span>
                              <span className="block text-[10px] text-slate-400 font-mono whitespace-nowrap">
                                ({formatNumber(room.qp_W / 1000, 2)} kW)
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono italic">0 W</span>
                          )}
                        </td>

                        {/* Potenza Frigo Qc */}
                        <td className="py-2.5 px-3 text-right">
                          {room.isCooled && room.qc_W > 0 ? (
                            <div>
                              <span className="font-mono font-bold text-sky-850 text-xs whitespace-nowrap">
                                {formatNumber(room.qc_W, 0)} W
                              </span>
                              <span className="block text-[10px] text-slate-400 font-mono whitespace-nowrap">
                                ({formatNumber(room.qc_W / 1000, 2)} kW)
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono italic">0 W</span>
                          )}
                        </td>

                        {/* Taglia Terminale Suggerita (prima kW poi BTU/h) con Associazione Master / Satellite */}
                        <td className="py-2.5 px-2">
                          {room.isCooled && room.qc_W > 0 ? (
                            <div className="space-y-1">
                              {room.isSatellite ? (
                                <div className="inline-flex flex-col items-start px-2 py-1 rounded-md bg-amber-50 text-amber-900 text-[10px] font-bold border border-amber-200/80">
                                  <span className="flex items-center gap-1">
                                    <span>🔗</span>
                                    <span>Servito da {room.masterRoomName}</span>
                                  </span>
                                  <span className="text-[9px] text-amber-700 font-normal">
                                    ({formatNumber(room.qc_W, 0)} W trasferiti)
                                  </span>
                                </div>
                              ) : (
                                <div>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 text-[10px] font-bold border border-sky-100 whitespace-nowrap">
                                    <Sparkles className="w-3 h-3 text-sky-500 shrink-0" />
                                    <span>{room.splitKw} <span className="text-slate-500 font-normal">({room.splitBtu})</span></span>
                                  </span>
                                  {room.satelliteRooms && room.satelliteRooms.length > 0 && (
                                    <div className="mt-0.5 text-[9px] text-sky-900 bg-sky-100/60 rounded px-1.5 py-0.5 border border-sky-200/60 leading-tight">
                                      <span className="font-bold">🔗 incl. </span>
                                      {room.satelliteRooms.map((s, idx) => (
                                        <span key={s.id || idx}>
                                          {s.name} (+{formatNumber(s.qc_W, 0)} W)
                                          {idx < room.satelliteRooms.length - 1 ? ', ' : ''}
                                        </span>
                                      ))}
                                      <span className="block font-bold text-[8.5px] text-sky-950 mt-0.5">
                                        (Tot. carico: {formatNumber(room.terminalQc_W, 0)} W)
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Selettore associazione terminale */}
                              {floor.rooms.length > 1 && (
                                <div>
                                  <select
                                    value={room.servedByRoomId || ''}
                                    onChange={e => updateRoom(floor.id, room.id, 'servedByRoomId', e.target.value)}
                                    className="w-full max-w-[170px] text-[9.5px] font-medium bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 outline-none focus:border-orange-500 cursor-pointer"
                                    title="Seleziona se questo locale dispone di un proprio terminale o se è climatizzato da un'altra stanza adiacente"
                                  >
                                    <option value="">⚡ Terminale autonomo</option>
                                    {floor.rooms
                                      .filter(other => other.id !== room.id)
                                      .map(other => (
                                        <option key={other.id} value={other.id}>
                                          🔗 Climatizzato da {other.name || 'Altro locale'}
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300 italic">-</span>
                          )}
                        </td>

                        {/* Azioni su riga */}
                        <td className="py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => duplicateRoom(floor.id, room.id)}
                              className="p-1 text-slate-400 hover:text-orange-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Duplica Locale"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeRoom(floor.id, room.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Elimina Locale"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {/* Subtotale Piano */}
                  <tfoot>
                    {floor.hasVmc && (
                      <>
                        {/* Riga Subtotale Ambienti */}
                        <tr className="bg-slate-50/70 border-t border-slate-200 text-slate-700 text-xs">
                          <td className="py-2 px-3 uppercase text-[9px] font-bold text-slate-500" colSpan={3}>
                            Subtotale Ambienti {floor.name}
                          </td>
                          <td className="py-2 px-2 text-center font-mono text-xs whitespace-nowrap">
                            {formatNumber(floor.totalArea, 1)} m²
                          </td>
                          <td className="py-2 px-2 text-center text-slate-400 text-xs">-</td>
                          <td className="py-2 px-2 text-center font-mono text-xs text-slate-700 whitespace-nowrap">
                            {formatNumber(floor.totalVol, 1)} m³
                          </td>
                          <td className="py-2 px-2 text-center text-slate-400 text-xs">-</td>
                          <td className="py-2 px-3 text-right font-mono text-orange-700 text-xs whitespace-nowrap">
                            {formatNumber(floor.roomsQp_W, 0)} W
                            <span className="block text-[10px] text-orange-850 font-bold">({formatNumber(floor.roomsQp_kW, 2)} kW)</span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-sky-700 text-xs whitespace-nowrap">
                            {formatNumber(floor.roomsQc_W, 0)} W
                            <span className="block text-[10px] text-sky-850 font-bold">({formatNumber(floor.roomsQc_kW, 2)} kW)</span>
                          </td>
                          <td className="py-2 px-2" colSpan={2}></td>
                        </tr>

                        {/* Riga Batteria VMC */}
                        <tr className="bg-amber-50/40 border-t border-amber-200/50 text-slate-800 text-xs">
                          <td className="py-2 px-3 text-[10px] font-bold text-amber-900" colSpan={7}>
                            💨 Batteria Recuperatore / VMC (Aria Primaria)
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-orange-800 font-bold text-xs whitespace-nowrap">
                            {formatNumber(Number(floor.vmcHeat_kW) || 0, 2)} kW
                            <span className="block text-[9px] text-slate-500 font-normal">({formatNumber(floor.vmcHeat_W, 0)} W)</span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-sky-800 font-bold text-xs whitespace-nowrap">
                            {formatNumber(Number(floor.vmcCool_kW) || 0, 2)} kW
                            <span className="block text-[9px] text-slate-500 font-normal">({formatNumber(floor.vmcCool_W, 0)} W)</span>
                          </td>
                          <td className="py-2 px-2" colSpan={2}></td>
                        </tr>
                      </>
                    )}

                    {/* Riga TOTALE PIANO */}
                    <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300 text-slate-900">
                      <td className="py-2.5 px-3 uppercase text-[10px] tracking-wider text-slate-700" colSpan={3}>
                        TOTALE {floor.name} {floor.hasVmc ? '(Ambienti + VMC)' : ''}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-xs whitespace-nowrap">
                        {formatNumber(floor.totalArea, 1)} m²
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-400 text-xs">-</td>
                      <td className="py-2.5 px-2 text-center font-mono text-xs text-slate-700 whitespace-nowrap">
                        {formatNumber(floor.totalVol, 1)} m³
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-400 text-xs">-</td>
                      <td className="py-2.5 px-3 text-right font-mono text-orange-800 text-xs whitespace-nowrap">
                        {formatNumber(floor.totalQp_W, 0)} W
                        <span className="block text-[11px] text-orange-950 font-black">({formatNumber(floor.totalQp_kW, 2)} kW)</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-sky-800 text-xs whitespace-nowrap">
                        {formatNumber(floor.totalQc_W, 0)} W
                        <span className="block text-[11px] text-sky-950 font-black">({formatNumber(floor.totalQc_kW, 2)} kW)</span>
                      </td>
                      <td className="py-2.5 px-2" colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Footer Piano con pulsante aggiungi stanza */}
              <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => addRoom(floor.id)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-orange-600" />
                  <span>Aggiungi Locale a {floor.name}</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* RIEPILOGO GENERALE PER PIANO & CENTRALE TERMICA (A SCHERMO) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {/* Card Tabella Riepilogo Piani */}
          <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-orange-650" />
                <span>Riepilogo Piani dell'Edificio</span>
              </h3>
              <span className="text-xs text-slate-400 font-semibold">
                {processedData.floors.length} {processedData.floors.length === 1 ? 'Livello' : 'Livelli'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[9px] tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-3">Piano / Livello</th>
                    <th className="py-2.5 px-2 text-center">N° Locali</th>
                    <th className="py-2.5 px-2 text-center">Sup. (m²)</th>
                    <th className="py-2.5 px-2 text-center">Vol. (m³)</th>
                    <th className="py-2.5 px-3 text-right">Pot. Caldo (Qp)</th>
                    <th className="py-2.5 px-3 text-right">Pot. Freddo (Qc)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processedData.floors.map((floor, idx) => (
                    <tr key={floor.id || idx} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-bold text-slate-800 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-orange-600 shrink-0" />
                        <div>
                          <span>{floor.name}</span>
                          {floor.hasVmc && (
                            <span className="block text-[9px] font-normal text-amber-700">💨 VMC attiva (+{formatNumber(Number(floor.vmcHeat_kW) || 0, 1)} / +{formatNumber(Number(floor.vmcCool_kW) || 0, 1)} kW)</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-600 font-semibold">
                        {floor.rooms.length}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-semibold text-slate-800 whitespace-nowrap">
                        {formatNumber(floor.totalArea, 1)}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-slate-600 whitespace-nowrap">
                        {formatNumber(floor.totalVol, 1)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-orange-850 whitespace-nowrap">
                        {formatNumber(floor.totalQp_kW, 2)} kW
                        {floor.hasVmc && (
                          <span className="block text-[9px] text-slate-400 font-normal">Amb: {formatNumber(floor.roomsQp_kW, 2)} kW</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-850 whitespace-nowrap">
                        {formatNumber(floor.totalQc_kW, 2)} kW
                        {floor.hasVmc && (
                          <span className="block text-[9px] text-slate-400 font-normal">Amb: {formatNumber(floor.roomsQc_kW, 2)} kW</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card Totale Fabbricato / Centrale Termica */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white rounded-2xl shadow-lg p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2.5 mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                  Totale Complessivo Fabbricato
                </span>
                <Building2 className="w-4 h-4 text-slate-400" />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/50">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Superficie Totale</span>
                  <span className="font-mono text-base font-bold text-white whitespace-nowrap">
                    {formatNumber(processedData.building.totalArea, 1)} m²
                  </span>
                </div>

                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/50">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Volume Totale</span>
                  <span className="font-mono text-base font-bold text-white whitespace-nowrap">
                    {formatNumber(processedData.building.totalVol, 1)} m³
                  </span>
                </div>
              </div>

              {processedData.building.hasVmc && (
                <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-2.5 mb-3 text-[10px] text-amber-200/90 flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1">
                    <span>💨</span>
                    <span>{processedData.building.hasCentralVmc ? 'VMC Centralizzata:' : 'Batterie VMC Piani:'}</span>
                  </span>
                  <span className="font-mono font-bold text-amber-300">
                    +{formatNumber(processedData.building.totalVmcHeat_kW, 2)} kW (Caldo) | +{formatNumber(processedData.building.totalVmcCool_kW, 2)} kW (Freddo)
                  </span>
                </div>
              )}

              <div className="space-y-3">
                {/* Box Riscaldamento */}
                <div className="bg-gradient-to-r from-orange-950/40 to-orange-900/20 border border-orange-500/30 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-orange-600/30 rounded-lg text-orange-400">
                      <Flame className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-orange-300 block">Potenza Termica (Qp)</span>
                      <span className="text-[9px] text-slate-400 font-mono whitespace-nowrap">
                        {formatNumber(processedData.building.totalQp_W, 0)} W
                        {processedData.building.hasVmc && (
                          <span className="block text-[8.5px] text-slate-400">
                            Amb: {formatNumber(processedData.building.roomsQp_kW, 2)} kW
                            {processedData.building.hasFloorVmc && ` | Piani: +${formatNumber(processedData.building.floorVmcHeat_kW, 2)} kW`}
                            {processedData.building.hasCentralVmc && ` | Centr: +${formatNumber(processedData.building.centralVmcHeat_kW, 2)} kW`}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="text-right font-mono whitespace-nowrap">
                    <span className="text-lg font-black text-orange-400">
                      {formatNumber(processedData.building.totalQp_kW, 2)}
                    </span>
                    <span className="text-xs text-orange-300 ml-1 font-bold">kW</span>
                  </div>
                </div>

                {/* Box Raffrescamento */}
                <div className="bg-gradient-to-r from-sky-950/40 to-sky-900/20 border border-sky-500/30 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-sky-600/30 rounded-lg text-sky-400">
                      <Snowflake className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-sky-300 block">Potenza Frigorifera (Qc)</span>
                      <span className="text-[9px] text-slate-400 font-mono whitespace-nowrap">
                        {formatNumber(processedData.building.totalBtuH_cool, 0)} BTU/h
                        {processedData.building.hasVmc && (
                          <span className="block text-[8.5px] text-slate-400">
                            Amb: {formatNumber(processedData.building.roomsQc_kW, 2)} kW
                            {processedData.building.hasFloorVmc && ` | Piani: +${formatNumber(processedData.building.floorVmcCool_kW, 2)} kW`}
                            {processedData.building.hasCentralVmc && ` | Centr: +${formatNumber(processedData.building.centralVmcCool_kW, 2)} kW`}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="text-right font-mono whitespace-nowrap">
                    <span className="text-lg font-black text-sky-400">
                      {formatNumber(processedData.building.totalQc_kW, 2)}
                    </span>
                    <span className="text-xs text-sky-300 ml-1 font-bold">kW</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pulsante Trasferisci a Carichi Termici */}
            <div className="pt-2 border-t border-slate-700/60">
              <button
                type="button"
                onClick={() => setShowExportModal(true)}
                className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Invia a Dimensionamento Tubazioni</span>
              </button>
            </div>
          </div>
        </div>

        {/* Grafici a schermo */}
        {renderCharts(false)}
      </div>

      {/* ========================================================================= */}
      {/* VISTA DI STAMPA RELAZIONE TECNICA (HIDDEN PRINT:BLOCK)                    */}
      {/* ========================================================================= */}
      <div className="hidden print:block text-slate-900 space-y-6">
        
        {/* Quadro Parametri di Progetto Stampa */}
        <div className="border-2 border-slate-300 rounded-lg p-3 bg-slate-50/50 text-xs break-inside-avoid">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="border-r border-slate-300 pr-2">
              <span className="text-[9px] text-slate-500 uppercase block font-bold">Potenza Termica Specifica</span>
              <span className="font-mono font-bold text-sm text-slate-900">{qpSpecific} W/m³</span>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-[9px] text-slate-500 uppercase block font-bold">Potenza Frigorifera Specifica</span>
              <span className="font-mono font-bold text-sm text-slate-900">{qcSpecific} W/m³</span>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-[9px] text-slate-500 uppercase block font-bold">Numero Piani / Livelli</span>
              <span className="font-mono font-bold text-sm text-slate-900">{processedData.floors.length}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 uppercase block font-bold">Totale Ambienti</span>
              <span className="font-mono font-bold text-sm text-slate-900">
                {processedData.floors.reduce((acc, f) => acc + f.rooms.length, 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Dettaglio Ambienti per ogni Piano in Stampa */}
        {processedData.floors.map((floor, fIdx) => (
          <div key={floor.id || fIdx} className="break-inside-avoid mb-6">
            
            {/* Header del Piano in Stampa */}
            <div className="flex items-center justify-between bg-slate-100 border border-slate-400 px-3 py-1.5 rounded-t-lg">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs uppercase tracking-wide text-slate-900">{floor.name}</span>
                <span className="text-[10px] text-slate-600 font-medium">(H. utile: {formatNumber(Number(floor.defaultHeight_m) || 2.7, 2)} m)</span>
              </div>
              <div className="text-[10px] font-mono text-slate-700 font-semibold space-x-3">
                <span>Sup: <strong>{formatNumber(floor.totalArea, 2)} m²</strong></span>
                <span>Vol: <strong>{formatNumber(floor.totalVol, 1)} m³</strong></span>
              </div>
            </div>

            {/* Tabella con griglia strutturata solida */}
            <table className="w-full text-left border-collapse text-[10px] border-x border-b border-slate-400">
              <thead>
                <tr className="bg-slate-200/80 border-b border-slate-400 font-bold uppercase text-slate-800 text-[9px]">
                  <th className="py-2 px-2 border-r border-slate-300">Ambiente / Locale</th>
                  <th className="py-2 px-2 text-center border-r border-slate-300 w-24">Dimensioni (m)</th>
                  <th className="py-2 px-2 text-center border-r border-slate-300 w-16">Sup. (m²)</th>
                  <th className="py-2 px-1.5 text-center border-r border-slate-300 w-12">Alt. (m)</th>
                  <th className="py-2 px-2 text-center border-r border-slate-300 w-16">Vol. (m³)</th>
                  <th className="py-2 px-1.5 text-center border-r border-slate-300 w-16">Servizio</th>
                  <th className="py-2 px-2 text-right border-r border-slate-300 w-24">Pot. Termica Qp</th>
                  <th className="py-2 px-2 text-right border-r border-slate-300 w-24">Pot. Frigo Qc</th>
                  <th className="py-2 px-2 text-center w-32">Taglia terminale Consigliata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {floor.rooms.map((room, rIdx) => {
                  // Formattazione dimensioni
                  const hasL1 = room.length_m !== '' && Number(room.length_m) > 0;
                  const hasL2 = room.width_m !== '' && Number(room.width_m) > 0;
                  const dimText = hasL1 && hasL2 
                    ? `${formatNumber(Number(room.length_m), 2)} × ${formatNumber(Number(room.width_m), 2)}`
                    : (room.area_m2 ? 'Sup. diretta' : '-');

                  return (
                    <tr key={room.id || rIdx} className="even:bg-slate-50/60">
                      {/* Nome Locale */}
                      <td className="py-1.5 px-2 font-bold text-slate-900 border-r border-slate-200">
                        {room.name || `Locale ${rIdx + 1}`}
                      </td>

                      {/* Dimensioni (L1 x L2) */}
                      <td className="py-1.5 px-2 text-center font-mono text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {dimText}
                      </td>

                      {/* Superficie (m²) */}
                      <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        {formatNumber(room.computedArea, 2)}
                      </td>

                      {/* Altezza (m) */}
                      <td className="py-1.5 px-1.5 text-center font-mono text-slate-600 border-r border-slate-200 whitespace-nowrap">
                        {formatNumber(room.effectiveH, 2)}
                      </td>

                      {/* Volume (m³) */}
                      <td className="py-1.5 px-2 text-center font-mono text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {formatNumber(room.volume, 1)}
                      </td>

                      {/* Servizio (Riscaldamento / Raffrescamento) */}
                      <td className="py-1.5 px-1.5 text-center text-[9px] border-r border-slate-200 whitespace-nowrap">
                        {room.isHeated && room.isCooled ? (
                          <span className="font-semibold text-slate-800">Caldo + Freddo</span>
                        ) : room.isHeated ? (
                          <span className="font-semibold text-orange-800">Solo Caldo</span>
                        ) : room.isCooled ? (
                          <span className="font-semibold text-sky-800">Solo Freddo</span>
                        ) : (
                          <span className="text-slate-400 italic">Non clim.</span>
                        )}
                      </td>

                      {/* Potenza Termica Qp (organizzata su 2 righe pulite e mai spezzate) */}
                      <td className="py-1.5 px-2 text-right font-mono border-r border-slate-200 whitespace-nowrap">
                        {room.isHeated && room.qp_W > 0 ? (
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">
                              {formatNumber(room.qp_W / 1000, 2)} kW
                            </span>
                            <span className="text-[9px] text-slate-500 block leading-tight">
                              ({formatNumber(room.qp_W, 0)} W)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 italic">0 W</span>
                        )}
                      </td>

                      {/* Potenza Frigo Qc (organizzata su 2 righe pulite e mai spezzate) */}
                      <td className="py-1.5 px-2 text-right font-mono border-r border-slate-200 whitespace-nowrap">
                        {room.isCooled && room.qc_W > 0 ? (
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">
                              {formatNumber(room.qc_W / 1000, 2)} kW
                            </span>
                            <span className="text-[9px] text-slate-500 block leading-tight">
                              ({formatNumber(room.qc_W, 0)} W)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 italic">0 W</span>
                        )}
                      </td>

                      {/* Taglia Terminale (organizzata su 2 righe pulite: prima kW poi BTU/h) */}
                      <td className="py-1.5 px-2 text-center whitespace-nowrap">
                        {room.isCooled && room.qc_W > 0 ? (
                          room.isSatellite ? (
                            <div>
                              <span className="font-bold text-amber-900 block text-[9px] leading-tight">
                                Servito da {room.masterRoomName}
                              </span>
                              <span className="text-[8px] text-slate-500 block leading-tight font-normal">
                                ({formatNumber(room.qc_W, 0)} W coperti)
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="font-bold text-slate-800 block leading-tight">
                                {room.splitKw}
                              </span>
                              <span className="text-[9px] text-slate-500 block leading-tight">
                                ({room.splitBtu})
                              </span>
                              {room.satelliteRooms && room.satelliteRooms.length > 0 && (
                                <span className="text-[8px] text-sky-850 block leading-tight font-semibold">
                                  incl. {room.satelliteRooms.map(s => s.name).join(', ')}
                                </span>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-slate-300 italic">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* RIGA SUBTOTALE PIANO IN STAMPA */}
              <tfoot>
                {floor.hasVmc && (
                  <>
                    {/* Subtotale Ambienti */}
                    <tr className="border-t border-slate-300 bg-slate-50 text-slate-700 text-[9px]">
                      <td className="py-1.5 px-2 uppercase font-bold border-r border-slate-300">
                        Subtotale Ambienti {floor.name}
                      </td>
                      <td className="py-1.5 px-2 text-center border-r border-slate-300 text-slate-400">-</td>
                      <td className="py-1.5 px-2 text-center font-mono border-r border-slate-300 whitespace-nowrap">
                        {formatNumber(floor.totalArea, 2)} m²
                      </td>
                      <td className="py-1.5 px-1.5 text-center border-r border-slate-300 text-slate-400">-</td>
                      <td className="py-1.5 px-2 text-center font-mono border-r border-slate-300 whitespace-nowrap">
                        {formatNumber(floor.totalVol, 1)} m³
                      </td>
                      <td className="py-1.5 px-1.5 text-center border-r border-slate-300 text-slate-400">-</td>
                      <td className="py-1.5 px-2 text-right font-mono border-r border-slate-300 whitespace-nowrap">
                        <span className="font-bold text-slate-800 block leading-tight">
                          {formatNumber(floor.roomsQp_kW, 2)} kW
                        </span>
                        <span className="text-[8px] text-slate-500 block leading-tight font-normal">
                          ({formatNumber(floor.roomsQp_W, 0)} W)
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono border-r border-slate-300 whitespace-nowrap">
                        <span className="font-bold text-slate-800 block leading-tight">
                          {formatNumber(floor.roomsQc_kW, 2)} kW
                        </span>
                        <span className="text-[8px] text-slate-500 block leading-tight font-normal">
                          ({formatNumber(floor.roomsQc_W, 0)} W)
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-center text-slate-400">-</td>
                    </tr>

                    {/* Riga Batteria VMC */}
                    <tr className="border-t border-amber-200 bg-amber-50/50 text-slate-800 text-[9px]">
                      <td className="py-1.5 px-2 font-bold text-amber-900 border-r border-slate-300" colSpan={6}>
                        💨 Batteria Recuperatore / VMC (Aria Primaria)
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-orange-900 border-r border-slate-300 whitespace-nowrap">
                        {formatNumber(Number(floor.vmcHeat_kW) || 0, 2)} kW
                        <span className="text-[8px] text-slate-500 block font-normal">({formatNumber(floor.vmcHeat_W, 0)} W)</span>
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-sky-900 border-r border-slate-300 whitespace-nowrap">
                        {formatNumber(Number(floor.vmcCool_kW) || 0, 2)} kW
                        <span className="text-[8px] text-slate-500 block font-normal">({formatNumber(floor.vmcCool_W, 0)} W)</span>
                      </td>
                      <td className="py-1.5 px-2 text-center text-slate-400">-</td>
                    </tr>
                  </>
                )}

                {/* TOTALE PIANO */}
                <tr className="border-t-2 border-slate-400 bg-slate-100 font-bold text-slate-900">
                  <td className="py-2 px-2 uppercase text-[9px] border-r border-slate-300">
                    TOTALE {floor.name} {floor.hasVmc ? '(Ambienti + VMC)' : ''}
                  </td>
                  <td className="py-2 px-2 text-center border-r border-slate-300 text-slate-400">-</td>
                  <td className="py-2 px-2 text-center font-mono border-r border-slate-300 whitespace-nowrap">
                    {formatNumber(floor.totalArea, 2)} m²
                  </td>
                  <td className="py-2 px-1.5 text-center border-r border-slate-300 text-slate-400">-</td>
                  <td className="py-2 px-2 text-center font-mono border-r border-slate-300 whitespace-nowrap">
                    {formatNumber(floor.totalVol, 1)} m³
                  </td>
                  <td className="py-2 px-1.5 text-center border-r border-slate-300 text-slate-400">-</td>
                  <td className="py-2 px-2 text-right font-mono border-r border-slate-300 whitespace-nowrap">
                    <span className="font-black text-slate-900 block leading-tight">
                      {formatNumber(floor.totalQp_kW, 2)} kW
                    </span>
                    <span className="text-[9px] text-slate-600 block leading-tight font-normal">
                      ({formatNumber(floor.totalQp_W, 0)} W)
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right font-mono border-r border-slate-300 whitespace-nowrap">
                    <span className="font-black text-slate-900 block leading-tight">
                      {formatNumber(floor.totalQc_kW, 2)} kW
                    </span>
                    <span className="text-[9px] text-slate-600 block leading-tight font-normal">
                      ({formatNumber(floor.totalQc_W, 0)} W)
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center text-slate-400">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}

        {/* Tabella Riepilogo Generale Piani Edificio in Stampa */}
        <div className="break-inside-avoid mt-6">
          <div className="bg-slate-800 text-white px-3 py-1.5 rounded-t-lg">
            <h4 className="font-bold text-xs uppercase tracking-wide">
              Riepilogo Generale Piani dell'Edificio
            </h4>
          </div>
          <table className="w-full text-left border-collapse text-[10px] border-x border-b border-slate-400">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-400 font-bold uppercase text-slate-700 text-[9px]">
                <th className="py-2 px-3 border-r border-slate-300">Piano / Livello</th>
                <th className="py-2 px-2 text-center border-r border-slate-300 w-24">N° Ambienti</th>
                <th className="py-2 px-2 text-center border-r border-slate-300 w-28">Superficie (m²)</th>
                <th className="py-2 px-2 text-center border-r border-slate-300 w-28">Volume (m³)</th>
                <th className="py-2 px-3 text-right border-r border-slate-300 w-36">Potenza Termica Qp</th>
                <th className="py-2 px-3 text-right w-36">Potenza Frigo Qc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {processedData.floors.map((floor, idx) => (
                <tr key={floor.id || idx} className="even:bg-slate-50/50">
                  <td className="py-2 px-3 font-bold border-r border-slate-200">
                    <div>
                      <span>{floor.name}</span>
                      {floor.hasVmc && (
                        <span className="block text-[8.5px] font-normal text-amber-800">💨 VMC: +{formatNumber(Number(floor.vmcHeat_kW) || 0, 1)} / +{formatNumber(Number(floor.vmcCool_kW) || 0, 1)} kW</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center font-mono border-r border-slate-200">{floor.rooms.length}</td>
                  <td className="py-2 px-2 text-center font-mono font-semibold border-r border-slate-200 whitespace-nowrap">{formatNumber(floor.totalArea, 2)} m²</td>
                  <td className="py-2 px-2 text-center font-mono border-r border-slate-200 whitespace-nowrap">{formatNumber(floor.totalVol, 1)} m³</td>
                  <td className="py-2 px-3 text-right font-mono font-bold border-r border-slate-200 whitespace-nowrap">
                    {formatNumber(floor.totalQp_kW, 2)} kW <span className="font-normal text-slate-500 text-[9px]">({formatNumber(floor.totalQp_W, 0)} W)</span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap">
                    {formatNumber(floor.totalQc_kW, 2)} kW <span className="font-normal text-slate-500 text-[9px]">({formatNumber(floor.totalQc_W, 0)} W)</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-800 bg-slate-200 font-black text-slate-900 text-[10px]">
                <td className="py-2 px-3 uppercase border-r border-slate-300">TOTALE COMPLESSIVO</td>
                <td className="py-2 px-2 text-center font-mono border-r border-slate-300">
                  {processedData.floors.reduce((acc, f) => acc + f.rooms.length, 0)}
                </td>
                <td className="py-2 px-2 text-center font-mono border-r border-slate-300 whitespace-nowrap">
                  {formatNumber(processedData.building.totalArea, 2)} m²
                </td>
                <td className="py-2 px-2 text-center font-mono border-r border-slate-300 whitespace-nowrap">
                  {formatNumber(processedData.building.totalVol, 1)} m³
                </td>
                <td className="py-2 px-3 text-right font-mono font-black border-r border-slate-300 whitespace-nowrap">
                  {formatNumber(processedData.building.totalQp_kW, 2)} kW
                </td>
                <td className="py-2 px-3 text-right font-mono font-black whitespace-nowrap">
                  {formatNumber(processedData.building.totalQc_kW, 2)} kW
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Quadro Finale Centrale Termica in Stampa */}
        <div className="break-inside-avoid mt-6 border-2 border-slate-800 rounded-xl p-4 bg-slate-50">
          <h4 className="font-black text-xs uppercase tracking-widest text-slate-800 mb-3 text-center border-b border-slate-300 pb-2">
            Bilancio Termo-Frigorifero Complessivo del Fabbricato
          </h4>
          <div className="grid grid-cols-2 gap-4 text-center">
            {/* Blocco Termico Invernale */}
            <div className="border border-slate-300 p-3 rounded-lg bg-white shadow-2xs text-left">
              <span className="text-[10px] font-bold uppercase text-slate-600 block mb-2 text-center">
                Potenza Termica di Progetto (Riscaldamento Invernale)
              </span>
              
              {processedData.building.hasVmc && (
                <div className="space-y-1 mb-2.5 pb-2 border-b border-slate-200 text-[10px] text-slate-700">
                  <div className="flex justify-between font-mono">
                    <span>• Carico Ambienti:</span>
                    <strong>{formatNumber(processedData.building.roomsQp_kW, 2)} kW</strong>
                  </div>
                  {processedData.building.hasFloorVmc && (
                    <div className="flex justify-between font-mono text-orange-850">
                      <span>• Batterie VMC di Piano:</span>
                      <strong>+{formatNumber(processedData.building.floorVmcHeat_kW, 2)} kW</strong>
                    </div>
                  )}
                  {processedData.building.hasCentralVmc && (
                    <div className="flex justify-between font-mono text-orange-850">
                      <span>• Batteria VMC Centralizzata:</span>
                      <strong>+{formatNumber(processedData.building.centralVmcHeat_kW, 2)} kW</strong>
                    </div>
                  )}
                </div>
              )}

              <div className="text-center">
                <span className="text-2xl font-black font-mono text-slate-900 block whitespace-nowrap">
                  {formatNumber(processedData.building.totalQp_kW, 2)} kW
                </span>
                <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                  ({formatNumber(processedData.building.totalQp_W, 0)} W)
                </span>
              </div>
            </div>

            {/* Blocco Frigorifero Estivo */}
            <div className="border border-slate-300 p-3 rounded-lg bg-white shadow-2xs text-left">
              <span className="text-[10px] font-bold uppercase text-slate-600 block mb-2 text-center">
                Potenza Frigorifera di Progetto (Raffrescamento Estivo)
              </span>

              {processedData.building.hasVmc && (
                <div className="space-y-1 mb-2.5 pb-2 border-b border-slate-200 text-[10px] text-slate-700">
                  <div className="flex justify-between font-mono">
                    <span>• Carico Ambienti:</span>
                    <strong>{formatNumber(processedData.building.roomsQc_kW, 2)} kW</strong>
                  </div>
                  {processedData.building.hasFloorVmc && (
                    <div className="flex justify-between font-mono text-sky-850">
                      <span>• Batterie VMC di Piano:</span>
                      <strong>+{formatNumber(processedData.building.floorVmcCool_kW, 2)} kW</strong>
                    </div>
                  )}
                  {processedData.building.hasCentralVmc && (
                    <div className="flex justify-between font-mono text-sky-850">
                      <span>• Batteria VMC Centralizzata:</span>
                      <strong>+{formatNumber(processedData.building.centralVmcCool_kW, 2)} kW</strong>
                    </div>
                  )}
                </div>
              )}

              <div className="text-center">
                <span className="text-2xl font-black font-mono text-slate-900 block whitespace-nowrap">
                  {formatNumber(processedData.building.totalQc_kW, 2)} kW
                </span>
                <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                  ({formatNumber(processedData.building.totalBtuH_cool, 0)} BTU/h)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Grafici in Stampa (Sia Riscaldamento che Raffrescamento) */}
        <div className="break-inside-avoid space-y-4 pt-2">
          {renderCharts(true, 'termico')}
          {renderCharts(true, 'frigo')}
        </div>
      </div>

      {/* MODALE DI TRASFERIMENTO VERSO CARICHI TERMICI */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-orange-600" />
                Trasferisci a Carichi Termici & Reti
              </h3>
              <button 
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Puoi inviare le potenze termiche calcolate direttamente nel tool <strong>Carichi Termici & Reti</strong> per dimensionare tubi, portate d'acqua/glicole e velocità idrauliche.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  1. Stagione da Trasferire:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportSeason('heating')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      exportSeason === 'heating'
                        ? 'bg-orange-50 border-orange-500 text-orange-850 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Flame className="w-4 h-4 text-orange-600" />
                    <span>Riscaldamento (Qp)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportSeason('cooling')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      exportSeason === 'cooling'
                        ? 'bg-sky-50 border-sky-500 text-sky-850 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Snowflake className="w-4 h-4 text-sky-600" />
                    <span>Raffrescamento (Qc)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  2. Modalità di Aggregazione:
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                    <input 
                      type="radio" 
                      name="exportMode" 
                      checked={exportMode === 'floors'} 
                      onChange={() => setExportMode('floors')} 
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span className="font-semibold text-slate-700">
                      Raggruppa per Piano (es. Piano Terra, Piano Primo)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                    <input 
                      type="radio" 
                      name="exportMode" 
                      checked={exportMode === 'rooms'} 
                      onChange={() => setExportMode('rooms')} 
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span className="font-semibold text-slate-700">
                      Esporta ogni singola Stanza come utenza idronica separata
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleTransferToCarichiTermici}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Conferma e Apri Tool Reti</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
