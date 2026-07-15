import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, isFirebaseMock } from '../firebase/config';
import { ProjectHeader, ProjectData } from '../components/ProjectHeader';
import ProjectStorage from '../components/ProjectStorage';
import { formatNumber } from '../utils/format';
import { 
  fetchElectricalCables, 
  fetchElectricalContainers, 
  saveElectricalItem, 
  deleteElectricalItem 
} from '../utils/electricalDbHelper';
import { 
  CableProduct, 
  ContainerFamily, 
  CableFormation, 
  ContainerSize 
} from '../data/electricalDatabase';
import { 
  Layers, 
  Plus, 
  Trash2, 
  Save, 
  Download, 
  RefreshCw, 
  Settings, 
  FileSpreadsheet, 
  AlertTriangle, 
  Info,
  CheckCircle,
  XCircle,
  Minimize2,
  Maximize2,
  Copy
} from 'lucide-react';
import * as XLSX from 'xlsx';
import TopologicalTree, { TrattoNode } from '../components/TopologicalTree';

interface ToolDimensionamentoCanaliProps {
  projectData: ProjectData;
  setProjectData: (data: any) => void;
  setAppMode: (mode: string) => void;
}

interface CavoSelezionato {
  cableId: string;        // ID del tipo cavo o 'personalizzato'
  formation: string;      // Formazione scelta, es. '3x50' o nome personalizzato
  diameter: number;       // Diametro esterno in mm
  weight: number;         // Peso in kg/m
  qty: number;            // Quantità di cavi
  compartment: 'vano1' | 'vano2' | 'cavoA' | 'cavoB'; // Destinazione per setto o linea doppia
}

interface TrattaProgetto {
  tag: string;            // ID univoco es. 'L1'
  name: string;           // Nome tratta
  parentId: string | null; // TAG della tratta a monte
  length: number | '';    // Lunghezza in metri (vuota all'inizio)
  containmentType: 'vista' | 'cavidotto' | 'tazze'; // Tipologia posa
  selectedFamilyId: string; // ID famiglia contenitore o 'personalizzato'
  selectedSizeCode: string; // Codice dimensione o 'personalizzato'
  // Dimensioni personalizzate (usate se size o family = personalizzato)
  customWidth?: number;
  customHeight?: number;
  customOuterDiameter?: number;
  customInnerDiameter?: number;
  customWeight?: number;
  customCoverWeight?: number;
  customBaseWeight?: number;
  // Opzioni  
  doubleLine: boolean;    // Linea doppia / Condotto parallelo accoppiato (deprecato)
  lineQty?: number;       // Quantità di condotti/linee in parallelo
  hasSeparator: boolean;  // Setto separatore (solo per rettangolari)
  hasCover: boolean;      // Coperchio presente (solo per metallici)
  // Cavi inseriti
  cables: CavoSelezionato[];
  da?: string;
  a?: string;
  originalTagForMap?: string; // Campo interno temporaneo usato da regenerateTratteTags
  dislivelloGeodetico?: number | string;
}

interface ToolState {
  tratte: TrattaProgetto[];
  activeTrattaTag: string;
}

export function partitionCablesAcrossLines(cables: CavoSelezionato[], lineQty: number): CavoSelezionato[][] {
  const N = lineQty || 1;
  const lines: CavoSelezionato[][] = Array.from({ length: N }, () => []);
  if (N <= 1) {
    lines[0] = [...cables];
    return lines;
  }

  // Prepariamo la lista piatta di tutti i singoli cavi
  const flatCables: { cableId: string; formation: string; diameter: number; weight: number; compartment: 'vano1' | 'vano2' | 'cavoA' | 'cavoB' }[] = [];
  cables.forEach(c => {
    for (let i = 0; i < (Number(c.qty) || 0); i++) {
      flatCables.push({
        cableId: c.cableId,
        formation: c.formation,
        diameter: c.diameter,
        weight: c.weight,
        compartment: c.compartment
      });
    }
  });

  // Ordina i cavi dal più grande al più piccolo per ottimizzare il riempimento
  flatCables.sort((a, b) => b.diameter - a.diameter);

  // Mantieni le aree cumulative per ciascuna linea
  const lineAreas = new Array(N).fill(0);

  flatCables.forEach(c => {
    // Trova la linea con la minima area cumulativa
    let minIdx = 0;
    let minArea = lineAreas[0];
    for (let i = 1; i < N; i++) {
      if (lineAreas[i] < minArea) {
        minArea = lineAreas[i];
        minIdx = i;
      }
    }

    // Aggiungi il cavo alla linea trovata
    const singleArea = Math.PI * ((c.diameter / 2) ** 2);
    lineAreas[minIdx] += singleArea;

    // Raggruppa i cavi uguali nella stessa linea per comodità di rappresentazione
    const existing = lines[minIdx].find(item => item.cableId === c.cableId && item.formation === c.formation);
    if (existing) {
      existing.qty++;
    } else {
      lines[minIdx].push({
        cableId: c.cableId,
        formation: c.formation,
        diameter: c.diameter,
        weight: c.weight,
        qty: 1,
        compartment: c.compartment
      });
    }
  });

  return lines;
}

const formatContainerSizeLabel = (
  family?: ContainerFamily,
  size?: ContainerSize,
  tratta?: TrattaProgetto
): string => {
  if (tratta && (tratta.selectedFamilyId === 'personalizzato' || tratta.selectedSizeCode === 'personalizzato')) {
    const isRect = family ? family.sectionType === 'rettangolare' : (tratta.customWidth !== undefined);
    if (isRect) {
      const h = tratta.customHeight || 0;
      const l = tratta.customWidth || 0;
      return `Personalizzato: ${h}x${l} mm (H x L)`;
    } else {
      const ext = tratta.customOuterDiameter || 0;
      const int = tratta.customInnerDiameter || 0;
      return `Personalizzato: Ø Est. ${ext} / Ø Int. ${int} mm`;
    }
  }
  if (!size) return 'Personalizzato';
  if (family && family.sectionType === 'rettangolare') {
    return `${size.height}x${size.width} mm (H x L)`;
  } else {
    const ext = size.outerDiameter || size.width || 0;
    const int = size.innerDiameter || size.height || 0;
    return `Ø Est. ${ext} / Ø Int. ${int} mm`;
  }
};

const defaultState: ToolState = {
  tratte: [
    {
      tag: 'AB',
      name: 'AB',
      parentId: null,
      length: '',
      containmentType: 'vista',
      selectedFamilyId: 'canala_met_chiusa',
      selectedSizeCode: 'R3075Z',
      doubleLine: false,
      lineQty: 1,
      hasSeparator: false,
      hasCover: false,
      cables: [],
      da: 'Cabina elettrica',
      a: 'Quadro elettrico'
    }
  ],
  activeTrattaTag: 'AB'
};

// Componente di rendering 2D Canvas per la sezione
const SezioneCanvas: React.FC<{
  tratta: TrattaProgetto;
  family?: ContainerFamily;
  size?: ContainerSize;
  fillRate: number;
}> = ({ tratta, family, size, fillRate }) => {

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calcola le dimensioni reali
  const isRect = family ? family.sectionType === 'rettangolare' : (tratta.selectedFamilyId === 'personalizzato' && tratta.customWidth !== undefined);
  const width = isRect 
    ? (size?.width || tratta.customWidth || 100) 
    : 0;
  const height = isRect 
    ? (size?.height || tratta.customHeight || 75) 
    : 0;
  const outerDiameter = !isRect 
    ? (size?.outerDiameter || size?.width || tratta.customOuterDiameter || 50) 
    : 0;
  const innerDiameter = !isRect 
    ? (size?.innerDiameter || size?.height || tratta.customInnerDiameter || 42) 
    : 0;

  const darkenColor = (hex: string) => {
    const map: Record<string, string> = {
      '#f59e0b': '#9a3412',
      '#3b82f6': '#1e3a8a',
      '#10b981': '#065f46',
      '#ec4899': '#9d174d',
      '#8b5cf6': '#5b21b6',
      '#06b6d4': '#155e75',
      '#f43f5e': '#9f1239'
    };
    return map[hex] || '#111827';
  };

  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  const strokeOpenRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x, y); // start at top-left
    ctx.lineTo(x, y + h - r); // down to left corner radius start
    ctx.arcTo(x, y + h, x + r, y + h, r); // left-bottom corner
    ctx.lineTo(x + w - r, y + h); // bottom wall
    ctx.arcTo(x + w, y + h, x + w, y + h - r, r); // bottom-right corner
    ctx.lineTo(x + w, y); // right wall
    ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ripartiamo i cavi in modo bilanciato tra le N linee parallele
    const N = tratta.lineQty || (tratta.doubleLine ? 2 : 1);
    const cablesForLines = partitionCablesAcrossLines(tratta.cables || [], N);

    // Resetta canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Disegna griglia ingegneristica di sfondo
    ctx.save();
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let x = 10; x < canvas.width; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 10; y < canvas.height; y += 10) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();

    // Dimensioni canvas per disegno
    const cx = canvas.width / 2;
    const cy = canvas.height / 2 - 10; // Spostato leggermente in alto per evitare tagli dei titoli sul fondo

    const drawCableCircle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) => {
      ctx.save();
      // Drop shadow morbida del cavo
      ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 0.5;
      ctx.shadowOffsetY = 1;

      // Sfondo cavo (colore piatto e solido per isolamento realistico)
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      
      // Bordo isolamento
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Rame conduttore centrale (solo se il raggio è sufficiente)
      const coreR = r * 0.42;
      if (coreR > 1.2) {
        ctx.beginPath();
        ctx.arc(x, y, coreR, 0, 2 * Math.PI);
        // Colore marrone/rame metallico
        ctx.fillStyle = '#b45309'; 
        ctx.fill();
        ctx.strokeStyle = '#f59e0b'; // riflesso rame
        ctx.lineWidth = 0.6;
        ctx.stroke();

        // Piccolo nucleo interno scuro
        ctx.beginPath();
        ctx.arc(x, y, coreR * 0.35, 0, 2 * Math.PI);
        ctx.fillStyle = '#78350f';
        ctx.fill();
      }
      ctx.restore();
    };

    if (isRect) {
      // Disegno rettangolo (Canale)
      const cols = N === 1 ? 1 : N === 2 ? 2 : N <= 4 ? 2 : 3;
      const rows = Math.ceil(N / cols);
      
      const spaceX = width * 1.25;
      const spaceY = height * 1.25;
      
      const totalWidth = cols * width + (cols - 1) * (width * 0.25);
      const totalHeight = rows * height + (rows - 1) * (height * 0.25);
      
      const scale = Math.min((canvas.width - 100) / totalWidth, (canvas.height - 90) / totalHeight);
      
      const drawSingleChannel = (xOffset: number, yOffset: number, title: string, lineCables: CavoSelezionato[]) => {
        const wScaled = width * scale;
        const hScaled = height * scale;
        const xStart = cx - wScaled / 2 + xOffset;
        const yStart = cy - hScaled / 2 + yOffset;

        ctx.save();
        // Ombra del canale
        ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 4;

        // Disegno coperchio (se selezionato)
        if (tratta.hasCover) {
          ctx.fillStyle = '#475569'; // Grigio metallo scuro
          // Piastra superiore piatta del coperchio
          ctx.fillRect(xStart - 3, yStart - 4, wScaled + 6, 3);
          // Alette laterali che avvolgono il bordo superiore della canala
          ctx.fillRect(xStart - 3, yStart - 4, 3, 7); // Tab sinistro
          ctx.fillRect(xStart + wScaled, yStart - 4, 3, 7); // Tab destro
        }

        // Sfondo del canale (gradiente soft)
        const channelGrad = ctx.createLinearGradient(xStart, yStart, xStart, yStart + hScaled);
        channelGrad.addColorStop(0, '#ffffff');
        channelGrad.addColorStop(1, '#f8fafc');

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = Math.min(3, Math.max(1.5, 3.5 * scale * 0.8));
        ctx.fillStyle = channelGrad;

        // Disegna canale con angoli smussati per un aspetto realistico
        drawRoundedRect(ctx, xStart, yStart, wScaled, hScaled, 6);
        ctx.fill();

        if (tratta.hasCover) {
          ctx.stroke();
        } else {
          strokeOpenRoundedRect(ctx, xStart, yStart, wScaled, hScaled, 6);
        }
        ctx.restore();

        // Disegno setto separatore
        if (tratta.hasSeparator) {
          ctx.save();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = Math.max(1, 2.5 * scale * 0.8);
          ctx.setLineDash([4, 2]);
          ctx.beginPath();
          ctx.moveTo(xStart + wScaled / 2, yStart + 4);
          ctx.lineTo(xStart + wScaled / 2, yStart + hScaled - 4);
          ctx.stroke();
          ctx.restore();
          
          // Etichette Vano 1 / Vano 2
          ctx.fillStyle = '#b91c1c';
          ctx.font = `bold ${Math.max(6, 8 * scale * 0.8)}px sans-serif`;
          ctx.fillText('V1', xStart + wScaled / 4 - 5, yStart + Math.max(8, 12 * scale * 0.8));
          ctx.fillText('V2', xStart + (wScaled * 3) / 4 - 5, yStart + Math.max(8, 12 * scale * 0.8));
        }

        // Disegno cavi
        const drawCablesInCompartment = (comp: string, xMin: number, xMax: number) => {
          const compCables = lineCables.filter(c => {
            if (tratta.hasSeparator) {
              return c.compartment === comp;
            }
            return true;
          });

          const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e'];

          // Prepariamo la lista piatta di tutti i singoli cavi
          const flatCables: { diameter: number; color: string }[] = [];
          compCables.forEach((c) => {
            const originalIdx = (tratta.cables || []).findIndex(orig => orig.cableId === c.cableId && orig.formation === c.formation);
            const color = originalIdx !== -1 ? colors[originalIdx % colors.length] : colors[0];
            for (let q = 0; q < c.qty; q++) {
              flatCables.push({ diameter: c.diameter, color });
            }
          });

          // Ordina i cavi dal più grande al più piccolo per ottimizzare il riempimento
          flatCables.sort((a, b) => b.diameter - a.diameter);

          // LIMITE SICUREZZA: max 150 cavi singoli renderizzati nel canvas per prevenire freeze
          const MAX_CANVAS_CABLES = 150;
          const cablesForCanvas = flatCables.slice(0, MAX_CANVAS_CABLES);
          const cablesTooMany = flatCables.length > MAX_CANVAS_CABLES;

          // Gestione delle righe per l'impacchettamento dal basso senza buchi
          interface RowData {
            yFloor: number;
            currentWidth: number;
            maxHeight: number;
            cables: { x: number; y: number; r: number; color: string }[];
          }

          const rows: RowData[] = [
            {
              yFloor: yStart + hScaled - 4,
              currentWidth: 0,
              maxHeight: 0,
              cables: []
            }
          ];

          const maxRowWidth = xMax - xMin - 8; // Margine sinistro/destro di 4px

          cablesForCanvas.forEach(c => {
            const rScaled = (c.diameter / 2) * scale * 0.88;
            const dScaled = rScaled * 2;
            let placed = false;

            // Cerca la prima riga dal basso in cui c'è spazio sufficiente
            for (let i = 0; i < rows.length; i++) {
              const rData = rows[i];
              if (rData.currentWidth + dScaled <= maxRowWidth) {
                // Il cavo ci sta in questa riga
                const xCenter = xMin + 4 + rData.currentWidth + rScaled;
                const yCenter = rData.yFloor - rScaled;
                rData.cables.push({ x: xCenter, y: yCenter, r: rScaled, color: c.color });
                rData.currentWidth += dScaled + 2; // 2px di spazio tra cavi vicini
                rData.maxHeight = Math.max(rData.maxHeight, dScaled);
                placed = true;
                break;
              }
            }

            // Se non ci sta in nessuna riga esistente, creiamo una nuova riga superiore
            if (!placed) {
              const prevRow = rows[rows.length - 1];
              const newYFloor = prevRow.yFloor - prevRow.maxHeight - 2; // 2px di distanza verticale
              const xCenter = xMin + 4 + rScaled;
              const yCenter = newYFloor - rScaled;
              
              const newRow: RowData = {
                yFloor: newYFloor,
                currentWidth: dScaled + 2,
                maxHeight: dScaled,
                cables: [{ x: xCenter, y: yCenter, r: rScaled, color: c.color }]
              };
              rows.push(newRow);
            }
          });

          // Avviso se il numero di cavi supera il limite
          if (cablesTooMany) {
            ctx.save();
            ctx.fillStyle = 'rgba(239,68,68,0.8)';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`+${flatCables.length - MAX_CANVAS_CABLES} cavi non mostrati`, (xMin + xMax) / 2, yStart + 14);
            ctx.restore();
          }

          // Disegniamo tutti i cavi inseriti nelle righe
          rows.forEach(rData => {
            rData.cables.forEach(cable => {
              drawCableCircle(ctx, cable.x, cable.y, cable.r, cable.color);
            });
          });
        };

        if (tratta.hasSeparator) {
          drawCablesInCompartment('vano1', xStart, xStart + wScaled / 2);
          drawCablesInCompartment('vano2', xStart + wScaled / 2, xStart + wScaled);
        } else {
          drawCablesInCompartment('vano1', xStart, xStart + wScaled);
        }

        // Titolo Canale
        ctx.save();
        ctx.fillStyle = '#475569';
        const fontSize = Math.min(13, Math.max(8, 9 * scale * 0.85));
        ctx.font = `bold ${fontSize}px sans-serif`;
        const titleOffsetY = Math.min(22, Math.max(10, 12 * scale * 0.8));
        ctx.fillText(title, xStart + 2, yStart + hScaled + titleOffsetY);
        ctx.restore();
      };

      cablesForLines.forEach((lineCables, idx) => {
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        const xOffset = (c - (cols - 1) / 2) * spaceX * scale;
        const yOffset = (r - (rows - 1) / 2) * spaceY * scale;
        const label = N === 1 ? 'Sezione Canale' : `Canale ${String.fromCharCode(65 + idx)}`;
        drawSingleChannel(xOffset, yOffset, label, lineCables);
      });
    } else {
      // Disegno cerchio (Tubo/Cavidotto)
      const cols = N === 1 ? 1 : N === 2 ? 2 : N <= 4 ? 2 : 3;
      const rows = Math.ceil(N / cols);
      
      const spaceX = outerDiameter * 1.25;
      const spaceY = outerDiameter * 1.25;
      
      const totalWidth = cols * outerDiameter + (cols - 1) * (outerDiameter * 0.25);
      const totalHeight = rows * outerDiameter + (rows - 1) * (outerDiameter * 0.25);
      
      const scale = Math.min((canvas.width - 100) / totalWidth, (canvas.height - 90) / totalHeight);

      const drawSinglePipe = (xOffset: number, yOffset: number, title: string, pipeCables: CavoSelezionato[]) => {
        const outerScaled = (outerDiameter / 2) * scale;
        const innerScaled = (innerDiameter / 2) * scale;
        const px = cx + xOffset;
        const py = cy + yOffset;

        ctx.save();
        // Ombra del tubo esterno
        ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 4;

        // Tubo esterno (Grigio materiale metallico/pvc)
        ctx.beginPath();
        ctx.arc(px, py, outerScaled, 0, 2 * Math.PI);
        const outerGrad = ctx.createLinearGradient(px - outerScaled, py - outerScaled, px + outerScaled, py + outerScaled);
        outerGrad.addColorStop(0, '#94a3b8');
        outerGrad.addColorStop(1, '#475569');
        ctx.fillStyle = outerGrad;
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = Math.min(2.5, Math.max(1, 1.5 * scale * 0.8));
        ctx.stroke();

        // Interno Tubo (Vuoto interno)
        ctx.beginPath();
        ctx.arc(px, py, innerScaled, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = Math.min(3, Math.max(1.5, 2.5 * scale * 0.8));
        ctx.stroke();
        ctx.restore();

        // Disegno setto separatore nel tubo
        if (tratta.hasSeparator) {
          ctx.save();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = Math.max(1, 2.0 * scale * 0.8);
          ctx.setLineDash([4, 2]);
          ctx.beginPath();
          ctx.moveTo(px, py - innerScaled + 2);
          ctx.lineTo(px, py + innerScaled - 2);
          ctx.stroke();
          ctx.restore();
          
          // Etichette Vano 1 / Vano 2 (Disegnate all'interno e con badge di sfondo per massima leggibilità)
          ctx.save();
          ctx.font = `bold ${Math.max(6, 7 * scale * 0.8)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Vano 1
          const x1 = px - innerScaled * 0.45;
          const y1 = py - innerScaled * 0.4;
          const w1 = ctx.measureText('V1').width + 4;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(x1 - w1/2, y1 - 4, w1, 8);
          ctx.strokeStyle = '#fca5a5';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x1 - w1/2, y1 - 4, w1, 8);
          ctx.fillStyle = '#b91c1c';
          ctx.fillText('V1', x1, y1);

          // Vano 2
          const x2 = px + innerScaled * 0.45;
          const y2 = py - innerScaled * 0.4;
          const w2 = ctx.measureText('V2').width + 4;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(x2 - w2/2, y2 - 4, w2, 8);
          ctx.strokeStyle = '#fca5a5';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x2 - w2/2, y2 - 4, w2, 8);
          ctx.fillStyle = '#b91c1c';
          ctx.fillText('V2', x2, y2);
          
          ctx.restore();
        }

        // Disegno dei cavi in righe orizzontali partendo dal basso e adagiati sulla parete interna
        const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e'];
        const flatCables: { diameter: number, color: string, compartment?: string }[] = [];
        pipeCables.forEach((c) => {
          const originalIdx = (tratta.cables || []).findIndex(orig => orig.cableId === c.cableId && orig.formation === c.formation);
          const color = originalIdx !== -1 ? colors[originalIdx % colors.length] : colors[0];
          for (let q = 0; q < c.qty; q++) {
            flatCables.push({ diameter: c.diameter, color, compartment: c.compartment });
          }
        });

        // Ordina per diametro decrescente per un packing ordinato
        flatCables.sort((a, b) => b.diameter - a.diameter);

        // LIMITE SICUREZZA: max 150 cavi singoli renderizzati nel canvas
        const MAX_PIPE_CABLES = 150;
        const pipeCablesForCanvas = flatCables.slice(0, MAX_PIPE_CABLES);
        const pipeCablesTooMany = flatCables.length > MAX_PIPE_CABLES;

        // Algoritmo di Rilassamento Fisico (Verlet Physics) per adagiare i cavi sul fondo del tubo per gravità
        const iterations = 180;
        const gravity = 2.0;

        const placedCables = pipeCablesForCanvas.map((c, idx) => {
          const r = (c.diameter / 2) * scale * 0.88;
          // Sfalsa le posizioni iniziali orizzontalmente per evitare sovrapposizioni perfette
          const offsetFrac = pipeCablesForCanvas.length > 1
            ? (idx / (pipeCablesForCanvas.length - 1) - 0.5)
            : 0;
          const startX = px + offsetFrac * (innerScaled * 0.6);
          const startY = py; // Parte dal centro per facilitare l'adagiamento sul fondo
          return {
            x: startX,
            y: startY,
            r: r,
            color: c.color,
            compartment: c.compartment
          };
        });

        // Risoluzione iterativa dei vincoli di gravità, collisione e contenimento circolare
        for (let step = 0; step < iterations; step++) {
          // 1. Gravità
          placedCables.forEach(c => {
            c.y += gravity;
          });

          // Esegue la risoluzione dei vincoli per 3 volte di fila per far convergere perfettamente la fisica
          for (let sub = 0; sub < 3; sub++) {
            // 2. Repulsione mutua tra cavi per evitare sovrapposizioni (con 1px di spazio di tolleranza)
            for (let i = 0; i < placedCables.length; i++) {
              for (let j = i + 1; j < placedCables.length; j++) {
                const c1 = placedCables[i];
                const c2 = placedCables[j];

                const dx = c2.x - c1.x;
                const dy = c2.y - c1.y;
                const dist = Math.hypot(dx, dy);
                const minDist = c1.r + c2.r + 1.0; // 1px di sicurezza tra i cavi

                if (dist < minDist) {
                  const overlap = minDist - dist;
                  const nx = dist > 0.001 ? dx / dist : (Math.random() - 0.5);
                  const ny = dist > 0.001 ? dy / dist : 1;

                  c1.x -= nx * overlap * 0.5;
                  c1.y -= ny * overlap * 0.5;
                  c2.x += nx * overlap * 0.5;
                  c2.y += ny * overlap * 0.5;
                }
              }
            }

            // 3. Collisione con setto separatore verticale (se presente)
            if (tratta.hasSeparator) {
              placedCables.forEach(c => {
                if (c.compartment === 'vano1' || !c.compartment) {
                  if (c.x > px - c.r - 0.5) {
                    c.x = px - c.r - 0.5;
                  }
                } else if (c.compartment === 'vano2') {
                  if (c.x < px + c.r + 0.5) {
                    c.x = px + c.r + 0.5;
                  }
                }
              });
            }

            // 4. Vincolo interno alla circonferenza (il cavo non deve compenetrare la parete interna)
            placedCables.forEach(c => {
              const dx = c.x - px;
              const dy = c.y - py;
              const distFromCenter = Math.hypot(dx, dy);
              // Sottrae 3.5px di margine di sicurezza per evitare compenetrazioni grafiche con lo stroke del tubo
              const maxAllowedDist = innerScaled - c.r - 3.5;

              if (distFromCenter > maxAllowedDist) {
                const nx = distFromCenter > 0.001 ? dx / distFromCenter : 0;
                const ny = distFromCenter > 0.001 ? dy / distFromCenter : 1;

                c.x = px + nx * maxAllowedDist;
                c.y = py + ny * maxAllowedDist;
              }
            });
          }
        }

        // Disegna tutti i cavi posizionati
        placedCables.forEach(cable => {
          drawCableCircle(ctx, cable.x, cable.y, cable.r, cable.color);
        });

        if (pipeCablesTooMany) {
          ctx.save();
          ctx.fillStyle = 'rgba(239,68,68,0.85)';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`+${flatCables.length - MAX_PIPE_CABLES} cavi non mostrati`, px, py - innerScaled + 12);
          ctx.restore();
        }

        // Titolo (centrato rispetto al tubo per pulizia di design, con limiti di dimensione)
        ctx.save();
        ctx.fillStyle = '#475569';
        const fontSize = Math.min(13, Math.max(8, 9 * scale * 0.85));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        const titleOffsetY = Math.min(22, Math.max(12, 14 * scale * 0.8));
        ctx.fillText(title, px, py + outerScaled + titleOffsetY);
        ctx.restore();
      };

      cablesForLines.forEach((lineCables, idx) => {
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        const xOffset = (c - (cols - 1) / 2) * spaceX * scale;
        const yOffset = (r - (rows - 1) / 2) * spaceY * scale;
        const label = N === 1 ? 'Sezione Tubo' : `Tubo ${String.fromCharCode(65 + idx)}`;
        drawSinglePipe(xOffset, yOffset, label, lineCables);
      });
    }

  }, [tratta, family, size, fillRate]);

  return (
    <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col items-center relative w-full h-full min-h-[380px] justify-between">
      <div className="absolute top-5 right-5 bg-slate-900/95 text-white text-[10px] font-black px-3 py-1.5 rounded-lg shadow-sm uppercase tracking-wide">
        Riempimento: {formatNumber(fillRate, 1)}%
      </div>
      <div className="w-full flex-1 flex items-center justify-center mt-6">
        <canvas ref={canvasRef} width={480} height={320} className="w-full max-w-[480px] aspect-[3/2] rounded-2xl bg-white border border-slate-100 shadow-xs" />
      </div>
      <div className="text-[10px] text-slate-500 mt-4 text-center italic leading-relaxed px-2">
        {isRect ? "Simulazione riempimento dal basso" : "Simulazione riempimento dal basso per tubazioni"}
      </div>
    </div>
  );
};


export function calcolaComplianceGenerica(t: TrattaProgetto, containersCatalog: ContainerFamily[]) {
  if (!t) {
    return {
      verificato: true,
      dettagliVerifica: '',
      fillRate: 0,
      pesoCavi: 0,
      pesoCondottoVuoto: 0,
      pesoCoperchio: 0,
      pesoSetto: 0,
      pesoLineareTotale: 0,
      pesoTrattaComplessivo: 0,
      fillRatioVano1: 0,
      fillRatioVano2: 0,
      dCircVano1: 0,
      dCircVano2: 0
    };
  }

  const N = t.lineQty || (t.doubleLine ? 2 : 1);
  const fam = containersCatalog.find(f => f.id === t.selectedFamilyId);
  const sz = fam?.sizes.find(s => s.code === t.selectedSizeCode);
  const isRect = fam ? fam.sectionType === 'rettangolare' : (t.selectedFamilyId === 'personalizzato' && t.customWidth !== undefined);
  
  // Dimensioni fisiche
  const w = isRect ? (sz?.width || t.customWidth || 100) : 0;
  const h = isRect ? (sz?.height || t.customHeight || 75) : 0;
  const od = !isRect ? (sz?.outerDiameter || t.customOuterDiameter || 50) : 0;
  const id = !isRect ? (sz?.innerDiameter || t.customInnerDiameter || 42) : 0;

  // 1. Calcolo del Peso Lineare
  let pesoCavi = 0;
  (t.cables || []).forEach(c => {
    pesoCavi += c.weight * (Number(c.qty) || 0);
  });

  let pesoCondottoVuoto = (sz?.weight || t.customWeight || 0.5) * N;

  let pesoCoperchio = 0;
  if (isRect && t.hasCover) {
    pesoCoperchio = (sz?.coverWeight || t.customCoverWeight || 0.3) * N;
  }

  let pesoSetto = 0;
  if (t.hasSeparator) {
    pesoSetto = (isRect ? (sz?.coverWeight || t.customCoverWeight || 0.3) : 0.2) * N;
  }

  const pesoLineareTotale = pesoCavi + pesoCondottoVuoto + pesoCoperchio + pesoSetto;
  const pesoTrattaComplessivo = pesoLineareTotale * (Number(t.length) || 0);

  // 2. Partizionamento dei cavi tra le N linee
  const linePipes = partitionCablesAcrossLines(t.cables || [], N);

  // 3. Verifica dei Criteri per ciascuna linea
  const areaCanaleSingolo = isRect ? (w * h) : (id > 0 ? Math.PI * ((id / 2) ** 2) : 0);
  const areaUtileSingola = t.hasSeparator ? (areaCanaleSingolo / 2) : areaCanaleSingolo;
  // Detrazione 5% per giunzioni se N > 1
  const areaUtileEffettiva = N > 1 ? (areaUtileSingola * 0.95) : areaUtileSingola;

  let verificato = true;
  let maxFillRate = 0;
  let dettagliVerifica = '';
  let fillRatioVano1 = 0;
  let fillRatioVano2 = 0;
  let dCircVano1 = 0;
  let dCircVano2 = 0;

  if (isRect) {
    let maxFillRatioV1 = 0;
    let maxFillRatioV2 = 0;

    linePipes.forEach((cablesList) => {
      let areaC1 = 0;
      let areaC2 = 0;
      cablesList.forEach(c => {
        const areaC = Math.PI * ((c.diameter / 2) ** 2) * (Number(c.qty) || 0);
        if (t.hasSeparator && c.compartment === 'vano2') {
          areaC2 += areaC;
        } else {
          areaC1 += areaC;
        }
      });

      const fillV1 = areaUtileEffettiva > 0 ? (areaC1 / areaUtileEffettiva) : 0;
      const fillV2 = (t.hasSeparator && areaUtileEffettiva > 0) ? (areaC2 / areaUtileEffettiva) : 0;
      
      maxFillRatioV1 = Math.max(maxFillRatioV1, fillV1);
      maxFillRatioV2 = Math.max(maxFillRatioV2, fillV2);

      const lineMaxFill = Math.max(fillV1, fillV2) * 100;
      maxFillRate = Math.max(maxFillRate, lineMaxFill);

      if (lineMaxFill > 50.0) {
        verificato = false;
      }
    });

    fillRatioVano1 = maxFillRatioV1;
    fillRatioVano2 = maxFillRatioV2;

    const labelGiunzione = N > 1 ? ' (-5% giunzione)' : '';
    if (t.hasSeparator) {
      dettagliVerifica = `${N} Canali${labelGiunzione}. Riempimento max vani: Vano 1 = ${formatNumber(maxFillRatioV1 * 100, 1)}% (max 50%), Vano 2 = ${formatNumber(maxFillRatioV2 * 100, 1)}% (max 50%)`;
    } else {
      dettagliVerifica = `${N} Canali${labelGiunzione}. Riempimento max: ${formatNumber(maxFillRate, 1)}% (max 50%)`;
    }
  } else {
    // Circolare
    const calcolaDCirc = (cablesList: CavoSelezionato[]): number => {
      let nCavi = 0;
      let sumD2 = 0;
      let maxD = 0;
      let sumD = 0;

      cablesList.forEach(c => {
        const q = Number(c.qty) || 0;
        nCavi += q;
        sumD2 += (c.diameter ** 2) * q;
        sumD += c.diameter * q;
        if (c.diameter > maxD) maxD = c.diameter;
      });

      if (nCavi === 0) return 0;
      if (nCavi === 1) return maxD;
      if (nCavi === 2) {
        let diametri: number[] = [];
        cablesList.forEach(c => {
          for (let i = 0; i < (Number(c.qty) || 0); i++) diametri.push(c.diameter);
        });
        return diametri[0] + diametri[1];
      }
      return Math.max(maxD, 1.2 * Math.sqrt(sumD2));
    };

    let maxDCircV1 = 0;
    let maxDCircV2 = 0;

    linePipes.forEach((cablesList) => {
      if (t.hasSeparator) {
        const cablesA = cablesList.filter(c => c.compartment !== 'vano2');
        const cablesB = cablesList.filter(c => c.compartment === 'vano2');
        const d1 = calcolaDCirc(cablesA);
        const d2 = calcolaDCirc(cablesB);
        maxDCircV1 = Math.max(maxDCircV1, d1);
        maxDCircV2 = Math.max(maxDCircV2, d2);
        
        if (id < 1.5 * d1 || id < 1.5 * d2) {
          verificato = false;
        }
      } else {
        const d1 = calcolaDCirc(cablesList);
        maxDCircV1 = Math.max(maxDCircV1, d1);
        if (id < 1.5 * d1) {
          verificato = false;
        }
      }
    });

    dCircVano1 = maxDCircV1;
    dCircVano2 = maxDCircV2;

    // Per mostrare una percentuale indicativa di riempimento per tubazioni:
    let totalCablesArea = 0;
    (t.cables || []).forEach(c => {
      totalCablesArea += Math.PI * ((c.diameter / 2) ** 2) * (Number(c.qty) || 0);
    });
    maxFillRate = areaCanaleSingolo > 0 ? (totalCablesArea / (N * areaCanaleSingolo)) * 100 : 0;

    if (t.hasSeparator) {
      dettagliVerifica = `${N} Tubi. Diametro Interno: ${formatNumber(id, 1)} mm. Max fascio: Vano 1 = ${formatNumber(maxDCircV1, 1)} mm, Vano 2 = ${formatNumber(maxDCircV2, 1)} mm (richiesto tubo >= ${formatNumber(Math.max(maxDCircV1, maxDCircV2) * 1.5, 1)} mm)`;
    } else {
      dettagliVerifica = `${N} Tubi. Diametro Interno: ${formatNumber(id, 1)} mm. Max fascio: ${formatNumber(maxDCircV1, 1)} mm. Minimo diametro richiesto: ${formatNumber(maxDCircV1 * 1.5, 1)} mm`;
    }
  }

  return {
    pesoCavi,
    pesoCondottoVuoto,
    pesoCoperchio,
    pesoSetto,
    pesoLineareTotale,
    pesoTrattaComplessivo,
    verificato,
    dettagliVerifica,
    fillRatioVano1,
    fillRatioVano2,
    dCircVano1,
    dCircVano2,
    fillRate: maxFillRate
  };
}

export function regenerateTratteTags(
  tratte: TrattaProgetto[]
): { updatedTratte: TrattaProgetto[], tagMap: Record<string, string> } {
  if (tratte.length === 0) return { updatedTratte: [], tagMap: {} };

  // 1. Identifica le radici
  const allTags = new Set(tratte.map(t => t.tag));
  const roots = tratte.filter(t => !t.parentId || !allTags.has(t.parentId));

  // Mappa dei figli per ciascun genitore (usando i tag attuali)
  const childrenMap: Record<string, TrattaProgetto[]> = {};
  tratte.forEach(t => {
    if (t.parentId) {
      if (!childrenMap[t.parentId]) childrenMap[t.parentId] = [];
      childrenMap[t.parentId].push(t);
    }
  });

  const tagMap: Record<string, string> = {};
  const updatedTratte: TrattaProgetto[] = [];

  let nextStartCharCode = 65; // 'A'

  const processNode = (
    node: TrattaProgetto,
    startLetter: string,
    endLetter: string,
    newParentId: string | null,
    usedLetters: Set<string>
  ) => {
    const newTag = `${startLetter}${endLetter}`;
    tagMap[node.tag] = newTag;

    // Eredita la partenza (da) dall'arrivo (a) del genitore
    let childDa = node.da;
    if (newParentId) {
      const parentNode = updatedTratte.find(ut => ut.tag === newParentId);
      if (parentNode) {
        const parentA = parentNode.a || 'Destinazione generica';
        childDa = parentA === 'Destinazione generica' ? 'Partenza generica' : parentA;
      }
    } else {
      childDa = node.da || 'Cabina elettrica';
    }

    const updatedNode: TrattaProgetto = {
      ...node,
      originalTagForMap: node.tag,
      tag: newTag,
      name: newTag,
      parentId: newParentId,
      da: childDa
    };
    updatedTratte.push(updatedNode);

    // Processa i figli
    const children = childrenMap[node.tag] || [];
    // Ordiniamo i figli per preservare l'ordine originale
    children.sort((a, b) => {
      const idxA = tratte.findIndex(t => t.tag === a.tag);
      const idxB = tratte.findIndex(t => t.tag === b.tag);
      return idxA - idxB;
    });

    children.forEach(child => {
      const childStart = endLetter;
      
      let code = 65; // 'A'
      while (usedLetters.has(String.fromCharCode(code)) || String.fromCharCode(code) === childStart) {
        code++;
      }
      const childEnd = String.fromCharCode(code);
      usedLetters.add(childEnd);

      processNode(child, childStart, childEnd, newTag, usedLetters);
    });
  };

  // Processa ciascuna radice
  roots.forEach(root => {
    const usedLetters = new Set<string>();
    
    const startLetter = String.fromCharCode(nextStartCharCode);
    const endLetter = String.fromCharCode(nextStartCharCode + 1);
    
    usedLetters.add(startLetter);
    usedLetters.add(endLetter);

    processNode(root, startLetter, endLetter, null, usedLetters);

    // Trova la lettera massima usata in questo albero
    let maxCode = nextStartCharCode + 1;
    usedLetters.forEach(l => {
      const c = l.charCodeAt(0);
      if (c > maxCode) maxCode = c;
    });

    // La prossima radice inizierà 2 lettere dopo la fine di questo albero
    nextStartCharCode = maxCode + 2;
    if (nextStartCharCode > 89) { // se sfora 'Y', ricomincia
      nextStartCharCode = 65;
    }
  });

  // Ripristina l'ordinamento originale delle tratte
  const orderedResult: TrattaProgetto[] = [];
  tratte.forEach(t => {
    const found = updatedTratte.find(ut => (ut as any).originalTagForMap === t.tag);
    if (found) {
      const { originalTagForMap, ...rest } = found as any;
      orderedResult.push(rest as TrattaProgetto);
    }
  });

  updatedTratte.forEach(ut => {
    if (!orderedResult.some(o => o.tag === ut.tag)) {
      const { originalTagForMap, ...rest } = ut as any;
      orderedResult.push(rest as TrattaProgetto);
    }
  });

  return { updatedTratte: orderedResult, tagMap };
}


export function ToolDimensionamentoCanali({ projectData, setProjectData, setAppMode }: ToolDimensionamentoCanaliProps) {
  // Stati principali dello strumento
  const [state, setState] = useState<ToolState>(defaultState);
  const [activeTab, setActiveTab] = useState<'calcoli' | 'topologia' | 'database'>('calcoli');

  // Stati del catalogo (Firestore)
  const [cablesCatalog, setCablesCatalog] = useState<CableProduct[]>([]);
  const [containersCatalog, setContainersCatalog] = useState<ContainerFamily[]>([]);
  const [loadingDb, setLoadingDb] = useState<boolean>(false);
  const [dbActiveCategory, setDbActiveCategory] = useState<'cavi' | 'contenitori'>('cavi');
  
  // Cache per evitare letture Firestore duplicate nella sessione
  const [dbCacheLoaded, setDbCacheLoaded] = useState<{ cables: boolean; containers: boolean }>({
    cables: false,
    containers: false
  });

  // Stati per editing database
  const [editCableId, setEditCableId] = useState<string | null>(null);
  const [editContainerId, setEditContainerId] = useState<string | null>(null);
  const [newCableName, setNewCableName] = useState<string>('');
  const [newCableDesc, setNewCableDesc] = useState<string>('');

  // Caricamento del catalogo per il dimensionamento
  const initDbForSizing = async () => {
    try {
      const isDemoMode = isFirebaseMock || (projectData && (projectData as any).isDemo);
      const cab = await fetchElectricalCables(db, isDemoMode);
      const con = await fetchElectricalContainers(db, isDemoMode);
      setCablesCatalog(cab);
      setContainersCatalog(con);
    } catch (e) {
      console.error("Errore inizializzazione db:", e);
    }
  };

  useEffect(() => {
    initDbForSizing();
  }, [projectData]);

  // Caricamento condizionale per la scheda del database (lazy load & caching)
  const loadDatabaseCategory = async (category: 'cavi' | 'contenitori', force = false) => {
    if (!force && ((category === 'cavi' && dbCacheLoaded.cables) || (category === 'contenitori' && dbCacheLoaded.containers))) {
      // Già in cache, evita chiamata
      return;
    }

    setLoadingDb(true);
    try {
      const isDemoMode = isFirebaseMock || (projectData && (projectData as any).isDemo);
      if (category === 'cavi') {
        const cab = await fetchElectricalCables(db, isDemoMode);
        setCablesCatalog(cab);
        setDbCacheLoaded(prev => ({ ...prev, cables: true }));
      } else {
        const con = await fetchElectricalContainers(db, isDemoMode);
        setContainersCatalog(con);
        setDbCacheLoaded(prev => ({ ...prev, containers: true }));
      }
    } catch (e) {
      console.error("Errore caricamento databaseFirestore:", e);
      if (window.suiteUI) window.suiteUI.toast("Errore nel caricamento del database remoto", "error");
    } finally {
      setLoadingDb(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'database') {
      loadDatabaseCategory(dbActiveCategory);
    }
  }, [activeTab, dbActiveCategory]);

  // Gestione caricamento progetti salvati
  const handleLoadProject = (loadedData: any) => {
    if (loadedData && Array.isArray(loadedData.tratte) && loadedData.tratte.length > 0) {
      // Validazione e sanitizzazione di ogni tratta caricata
      const validatedTratte = loadedData.tratte
        .filter((t: any) => t && typeof t.tag === 'string')
        .map((t: any) => ({
          tag: t.tag,
          name: (t.name || t.tag).replace(/^Tratta\s+/i, ''),
          parentId: t.parentId || null,
          length: t.length !== undefined ? t.length : '',
          containmentType: t.containmentType || 'vista',
          selectedFamilyId: t.selectedFamilyId || 'canala_met_chiusa',
          selectedSizeCode: t.selectedSizeCode || 'R3075Z',
          doubleLine: t.doubleLine !== undefined ? !!t.doubleLine : (t.lineQty !== undefined ? Number(t.lineQty) > 1 : false),
          lineQty: t.lineQty !== undefined ? Number(t.lineQty) : (t.doubleLine ? 2 : 1),
          hasSeparator: !!t.hasSeparator,
          hasCover: !!t.hasCover,
          cables: Array.isArray(t.cables) ? t.cables : [],
          customWidth: t.customWidth,
          customHeight: t.customHeight,
          customOuterDiameter: t.customOuterDiameter,
          customInnerDiameter: t.customInnerDiameter,
          customWeight: t.customWeight,
          customCoverWeight: t.customCoverWeight,
          customBaseWeight: t.customBaseWeight,
          da: typeof t.da === 'string' && t.da ? t.da : (t.parentId === null ? 'Cabina elettrica' : 'Partenza generica'),
          a: typeof t.a === 'string' && t.a ? t.a : 'Destinazione generica'
        }));

      if (validatedTratte.length > 0) {
        const { updatedTratte: regenTratte, tagMap } = regenerateTratteTags(validatedTratte);
        const restoredActiveTag = tagMap[loadedData.activeTrattaTag] || regenTratte[0].tag;
        setState({
          tratte: regenTratte,
          activeTrattaTag: restoredActiveTag
        });
      } else {
        setState(defaultState);
      }
    } else {
      setState(defaultState);
    }
  };

  // Tratta correntemente attiva (sempre definita grazie al fallback)
  const activeTratta = useMemo(() => {
    if (!state.tratte || state.tratte.length === 0) {
      return defaultState.tratte[0];
    }
    return state.tratte.find(t => t.tag === state.activeTrattaTag) || state.tratte[0];
  }, [state.tratte, state.activeTrattaTag]);

  // Famiglia e misura selezionata per la tratta attiva
  const selectedFamily = useMemo(() => {
    if (!activeTratta) return undefined;
    return containersCatalog.find(f => f.id === activeTratta.selectedFamilyId);
  }, [containersCatalog, activeTratta]);

  const selectedSize = useMemo(() => {
    if (!selectedFamily || !activeTratta) return undefined;
    return selectedFamily.sizes.find(s => s.code === activeTratta.selectedSizeCode);
  }, [selectedFamily, activeTratta]);

  // --- LOGICHE DI CALCOLO E VERIFICA ---
  const calcoliTratta = useMemo(() => {
    return calcolaComplianceGenerica(activeTratta, containersCatalog);
  }, [activeTratta, containersCatalog]);

  // Stato globale di conformità di tutte le tratte
  const tratteCompliance = useMemo(() => {
    return state.tratte.map(t => {
      const comp = calcolaComplianceGenerica(t, containersCatalog);
      return {
        tag: t.tag,
        verificato: comp.verificato,
        fillRate: comp.fillRate
      };
    });
  }, [state.tratte, containersCatalog]);

  const trattiNodesForTree = useMemo<TrattoNode[]>(() => {
    return state.tratte.map(t => {
      const comp = tratteCompliance.find(c => c.tag === t.tag);
      return {
        tag: t.tag,
        parentId: t.parentId,
        hierarchy: 'dorsale_principale',
        length: t.length,
        name: t.name,
        pressioneNodo: comp?.fillRate || 0,
        pressioneMinimaRichiesta: 50,
        dislivelloGeodetico: t.dislivelloGeodetico || 0,
        da: t.da,
        a: t.a
      };
    });
  }, [state.tratte, tratteCompliance]);

  // Gestione aggiunta/rimozione/modifica tratte
  const handleAddTratta = () => {
    // Usa un tag temporaneo: regenerateTratteTags assegnerà il tag definitivo
    const tempTag = `TEMP_${Date.now()}`;
    const newTratta: TrattaProgetto = {
      tag: tempTag,
      name: tempTag,
      parentId: activeTratta.tag,
      length: '',
      containmentType: 'vista',
      selectedFamilyId: 'canala_met_chiusa',
      selectedSizeCode: 'R3075Z',
      doubleLine: false,
      lineQty: 1,
      hasSeparator: false,
      hasCover: false,
      cables: [],
      da: activeTratta.a || 'Quadro elettrico',
      a: 'Destinazione generica',
      dislivelloGeodetico: 0
    };
    setState(prev => {
      const newList = [...prev.tratte, newTratta];
      const { updatedTratte, tagMap } = regenerateTratteTags(newList);
      const nextActiveTag = tagMap[tempTag] || updatedTratte[updatedTratte.length - 1].tag;
      return { ...prev, tratte: updatedTratte, activeTrattaTag: nextActiveTag };
    });
    if (window.suiteUI) window.suiteUI.toast('Tratta aggiunta!', 'success');
  };

  const handleDuplicateTratta = () => {
    // Crea una copia identica ma come radice separata (parentId = null)
    const tempTag = `TEMP_DUP_${Date.now()}`;
    const duplicatedTratta: TrattaProgetto = {
      ...activeTratta,
      tag: tempTag,
      name: tempTag,
      parentId: null, // Nuova linea separata e indipendente
      cables: activeTratta.cables.map(c => ({ ...c }))
    };
    setState(prev => {
      const newList = [...prev.tratte, duplicatedTratta];
      const { updatedTratte, tagMap } = regenerateTratteTags(newList);
      const nextActiveTag = tagMap[tempTag] || updatedTratte[updatedTratte.length - 1].tag;
      return { ...prev, tratte: updatedTratte, activeTrattaTag: nextActiveTag };
    });
    if (window.suiteUI) window.suiteUI.toast('Tratta duplicata come nuova linea separata!', 'success');
  };

  const handleDeleteTratta = (tag: string) => {
    if (state.tratte.length <= 1) {
      if (window.suiteUI) window.suiteUI.alert("Impossibile eliminare l'unica tratta del progetto.");
      return;
    }
    setState(prev => {
      const deletedTratta = prev.tratte.find(t => t.tag === tag);
      const parentOfDeleted = deletedTratta?.parentId ?? null;
      const filtered = prev.tratte.filter(t => t.tag !== tag);
      // I figli della tratta eliminata scalano al genitore della tratta eliminata
      const cleaned = filtered.map(t => {
        if (t.parentId === tag) {
          return { ...t, parentId: parentOfDeleted };
        }
        return t;
      });
      const { updatedTratte, tagMap } = regenerateTratteTags(cleaned);
      // Mantieni la tratta attiva se non è quella eliminata, altrimenti vai alla prima
      const nextActive = prev.activeTrattaTag === tag
        ? updatedTratte[0]?.tag
        : (tagMap[prev.activeTrattaTag] ?? updatedTratte[0]?.tag);
      return {
        ...prev,
        tratte: updatedTratte,
        activeTrattaTag: nextActive
      };
    });
  };

  const updateTrattaField = (tag: string, field: keyof TrattaProgetto, value: any) => {
    setState(prev => {
      // Prima applica il cambio di valore
      let tempTratte = prev.tratte.map(t => {
        if (field === 'a' && t.parentId === tag) {
          const newDa = value === 'Destinazione generica' ? 'Partenza generica' : value;
          return { ...t, da: newDa };
        }
        if (t.tag === tag) {
          const nt = { ...t, [field]: value } as TrattaProgetto;
          if (field === 'selectedFamilyId') {
            const family = containersCatalog.find(f => f.id === value);
            nt.selectedSizeCode = family?.sizes[0]?.code || 'personalizzato';
            nt.containmentType = family?.installationType === 'cavidotto' ? 'cavidotto' : 'vista';
            if (family && family.sectionType === 'circolare') {
              nt.hasSeparator = false;
              nt.hasCover = false;
            }
          }
          if (field === 'lineQty') {
            nt.doubleLine = value > 1;
          }
          return nt;
        }
        return t;
      });

      // Se cambia il parentId, rigenera tutti i tag a cascata
      if (field === 'parentId') {
        const { updatedTratte, tagMap } = regenerateTratteTags(tempTratte);
        const nextActiveTag = tagMap[prev.activeTrattaTag] ?? updatedTratte[0]?.tag;
        return { ...prev, tratte: updatedTratte, activeTrattaTag: nextActiveTag };
      }

      return { ...prev, tratte: tempTratte };
    });
  };

  // Gestione Cavi della tratta attiva
  const handleAddCableToTratta = () => {
    const defaultCable = cablesCatalog[0] || { id: 'personalizzato', name: 'Personalizzato' };
    const defaultFormation = defaultCable.formations?.[0]?.formation || 'Personalizzato';
    const defaultDiameter = defaultCable.formations?.[0]?.diameter || 10;
    const defaultWeight = defaultCable.formations?.[0]?.weight || 0.15;

    const newCavo: CavoSelezionato = {
      cableId: defaultCable.id,
      formation: defaultFormation,
      diameter: defaultDiameter,
      weight: defaultWeight,
      qty: 1,
      compartment: 'vano1'
    };

    updateTrattaField(activeTratta.tag, 'cables', [...activeTratta.cables, newCavo]);
  };

  const handleUpdateCableInTratta = (idx: number, field: keyof CavoSelezionato, value: any) => {
    const updatedCables = [...activeTratta.cables];
    const cable = { ...updatedCables[idx], [field]: value } as CavoSelezionato;

    // Se cambia cableId o formation, aggiorna automaticamente diametro e peso dal catalogo
    if (field === 'cableId') {
      if (value === 'personalizzato') {
        cable.formation = 'Personalizzato';
        cable.diameter = 10;
        cable.weight = 0.15;
      } else {
        const prod = cablesCatalog.find(c => c.id === value);
        if (prod) {
          const form = prod.formations[0];
          cable.formation = form.formation;
          cable.diameter = form.diameter;
          cable.weight = form.weight;
        }
      }
    } else if (field === 'formation' && cable.cableId !== 'personalizzato') {
      const prod = cablesCatalog.find(c => c.id === cable.cableId);
      const form = prod?.formations.find(f => f.formation === value);
      if (form) {
        cable.diameter = form.diameter;
        cable.weight = form.weight;
      }
    }

    updatedCables[idx] = cable;
    updateTrattaField(activeTratta.tag, 'cables', updatedCables);
  };

  const handleDeleteCableFromTratta = (idx: number) => {
    const updatedCables = activeTratta.cables.filter((_, i) => i !== idx);
    updateTrattaField(activeTratta.tag, 'cables', updatedCables);
  };

  // --- FUNZIONALITÀ EDITING DATABASE (FIRESTORE) ---
  const handleSaveCableToDb = async (cable: CableProduct) => {
    try {
      const isDemoMode = isFirebaseMock || (projectData && (projectData as any).isDemo);
      await saveElectricalItem(db, isDemoMode, cable);
      setEditCableId(null);
      if (window.suiteUI) window.suiteUI.toast("Cavo salvato con successo!", "success");
      loadDatabaseCategory('cavi', true);
    } catch (e) {
      if (window.suiteUI) window.suiteUI.toast("Errore nel salvataggio del cavo", "error");
    }
  };

  const handleDeleteCableFromDb = async (id: string) => {
    const confirmed = await window.suiteUI?.confirm("Vuoi eliminare definitivamente questo cavo dal database comune?");
    if (!confirmed) return;

    try {
      const isDemoMode = isFirebaseMock || (projectData && (projectData as any).isDemo);
      await deleteElectricalItem(db, isDemoMode, id, 'cavo');
      if (window.suiteUI) window.suiteUI.toast("Cavo eliminato con successo!", "success");
      loadDatabaseCategory('cavi', true);
    } catch (e) {
      if (window.suiteUI) window.suiteUI.toast("Errore nell'eliminazione del cavo", "error");
    }
  };

  const handleAddNewCableToDb = async () => {
    if (!newCableName.trim()) {
      if (window.suiteUI) window.suiteUI.alert("Inserisci un nome valido per il cavo.");
      return;
    }
    const id = newCableName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newCable: CableProduct = {
      id,
      name: newCableName.trim(),
      description: newCableDesc.trim(),
      type: 'cavo',
      formations: [{ formation: '1x1.5', diameter: 3.0, weight: 0.020 }]
    };
    try {
      const isDemoMode = isFirebaseMock || (projectData && (projectData as any).isDemo);
      await saveElectricalItem(db, isDemoMode, newCable);
      setNewCableName('');
      setNewCableDesc('');
      if (window.suiteUI) window.suiteUI.toast("Nuovo cavo aggiunto!", "success");
      loadDatabaseCategory('cavi', true);
    } catch (e) {
      if (window.suiteUI) window.suiteUI.toast("Errore nella creazione del cavo", "error");
    }
  };

  // Esportazione in Excel di tutto il database
  const handleExportDatabaseExcel = () => {
    const wb = XLSX.utils.book_new();

    // Foglio Cavi
    const flatCablesData: any[] = [];
    cablesCatalog.forEach(c => {
      c.formations.forEach(f => {
        flatCablesData.push({
          "Cavo": c.name,
          "Descrizione": c.description,
          "Formazione": f.formation,
          "Diametro Esterno [mm]": f.diameter,
          "Peso Lineare [kg/m]": f.weight
        });
      });
    });
    const wsCables = XLSX.utils.json_to_sheet(flatCablesData);
    XLSX.utils.book_append_sheet(wb, wsCables, "Cavi Elettrici");

    // Foglio Contenitori
    const flatContainersData: any[] = [];
    containersCatalog.forEach(fam => {
      fam.sizes.forEach(sz => {
        flatContainersData.push({
          "Famiglia": fam.name,
          "Posa": fam.installationType,
          "Sezione": fam.sectionType,
          "Codice": sz.code,
          "Etichetta": sz.label,
          "Larghezza [mm]": sz.width || "",
          "Altezza [mm]": sz.height || "",
          "Diametro Esterno [mm]": sz.outerDiameter || "",
          "Diametro Interno [mm]": sz.innerDiameter || "",
          "Peso Condotto [kg/m]": sz.weight,
          "Peso Coperchio [kg/m]": sz.coverWeight || ""
        });
      });
    });
    const wsContainers = XLSX.utils.json_to_sheet(flatContainersData);
    XLSX.utils.book_append_sheet(wb, wsContainers, "Tubi e Canali");

    XLSX.writeFile(wb, "Database_Cavi_e_Condutture.xlsx");
    if (window.suiteUI) window.suiteUI.toast("Database esportato con successo!", "success");
  };


  return (
    <div className="bg-slate-100 rounded-3xl p-6 md:p-8 animate-in fade-in duration-300">
      {/* Intestazione del progetto standard */}
      <ProjectHeader pData={projectData} setPData={setProjectData} title="Dimensionamento Canale e Tubazioni" setAppMode={setAppMode} iconColor="amber" />

      {/* Gestione Progetti Condivisi (Full-width) */}
      <div className="print:hidden mb-6">
        <ProjectStorage 
          toolType="dimensionamento_canali" 
          currentData={state} 
          onLoadProject={handleLoadProject} 
          projectInfo={projectData} 
          setProjectInfo={setProjectData} 
        />
      </div>

      {/* Contenuto principale interattivo (nascosto in stampa) */}
      <div className="print:hidden space-y-6">
        
        {/* Sezione dello Schema Topologico (Albero di Distribuzione - Larghezza Intera) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-800">
                Schema Topologico della Rete Elettrica
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Rappresentazione grafica delle connessioni tra le varie tratte del progetto. Clicca su un tratto per configurarlo.
              </p>
            </div>
            
            {/* Pulsanti di Azione Schema */}
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleAddTratta}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                title="Aggiungi una nuova tratta collegata a quella selezionata (di default collega alla tratta attiva)"
              >
                <Plus className="w-4 h-4" /> Tratta
              </button>

              <button
                onClick={handleDuplicateTratta}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                title="Duplica la tratta selezionata con la stessa configurazione e cavi"
              >
                <Copy className="w-4 h-4" /> Duplica Tratta
              </button>
              
              {state.tratte.length > 1 && (
                <button
                  onClick={() => handleDeleteTratta(activeTratta.tag)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Elimina la tratta selezionata"
                >
                  <Trash2 className="w-4 h-4" /> Elimina Tratta
                </button>
              )}
            </div>
          </div>

          <div className="w-full flex items-center justify-center min-h-[250px] bg-slate-50/50 rounded-2xl border border-slate-150 p-4">
            <TopologicalTree 
              tratti={trattiNodesForTree} 
              activeTag={state.activeTrattaTag}
              mode="electric"
              onSelectTag={(tag) => {
                if (tag) {
                  setState(prev => ({ ...prev, activeTrattaTag: tag }));
                }
              }}
            />
          </div>

          {/* Legenda Collegamenti DA ➔ A */}
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">
              Legenda Collegamenti delle Tratte (DA ➔ A)
            </h4>
            {(() => {
              // Raggruppa le tratte per albero indipendente
              const allTags = new Set(state.tratte.map(t => t.tag));
              const roots = state.tratte.filter(t => !t.parentId || !allTags.has(t.parentId));

              const getSubtree = (rootTag: string): string[] => {
                const result: string[] = [rootTag];
                state.tratte
                  .filter(t => t.parentId === rootTag)
                  .forEach(child => result.push(...getSubtree(child.tag)));
                return result;
              };

              const trees = roots.map(r => ({
                rootTag: r.tag,
                tags: getSubtree(r.tag)
              }));

              const hasMultipleTrees = trees.length > 1;

              return trees.map((tree, treeIdx) => (
                <div key={`tree-group-${treeIdx}`}>
                  {/* Separatore e label se ci sono più linee indipendenti */}
                  {hasMultipleTrees && (
                    <div className={`flex items-center gap-3 ${treeIdx > 0 ? 'mt-8 mb-4' : 'mb-4'}`}>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">
                        Linea {treeIdx + 1}
                      </span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>
                  )}
                  {/* Card delle tratte di questo albero */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {tree.tags.map(tag => {
                      const t = state.tratte.find(tr => tr.tag === tag);
                      if (!t) return null;
                      const comp = tratteCompliance.find(c => c.tag === t.tag);
                      const isSelected = state.activeTrattaTag === t.tag;
                      return (
                        <div
                          key={t.tag}
                          onClick={() => setState(prev => ({ ...prev, activeTrattaTag: t.tag }))}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'border-amber-400 bg-amber-50/30 ring-2 ring-amber-400/20'
                              : 'border-slate-150 bg-slate-50/30 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1.5 gap-2">
                            <span className="text-xs font-black text-slate-800 truncate">
                              Tratto {t.tag}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                              comp?.verificato
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {comp?.verificato ? 'CONFORME' : 'NON CONFORME'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-650 flex flex-wrap items-center gap-1 mt-1">
                            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">{t.da || 'Partenza'}</span>
                            <span className="text-slate-400 text-[9px]">➔</span>
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold">{t.a || 'Arrivo'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Dettagli della Tratta attiva */}
        <div className="w-full space-y-6">
            
            {/* Box Dettagli Fisici Condotto */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
                <h3 className="text-base font-black text-slate-800">
                  Configurazione Tratta {activeTratta.tag}
                </h3>
                <span className="text-[11px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  CEI 64-8
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nome Tratta</label>
                  <input 
                    type="text"
                    value={activeTratta.name}
                    onChange={e => updateTrattaField(activeTratta.tag, 'name', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Lunghezza (m)</label>
                  <input 
                    type="number"
                    min="1"
                    value={activeTratta.length}
                    onChange={e => updateTrattaField(activeTratta.tag, 'length', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Dislivello +/- (m)</label>
                  <input 
                    type="number"
                    value={activeTratta.dislivelloGeodetico !== undefined ? activeTratta.dislivelloGeodetico : ''}
                    onChange={e => updateTrattaField(activeTratta.tag, 'dislivelloGeodetico', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                    placeholder="Salita + / Discesa -"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tratta a Monte</label>
                  <select 
                    value={activeTratta.parentId || ''}
                    onChange={e => updateTrattaField(activeTratta.tag, 'parentId', e.target.value || null)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="">Nessuna (Linea indipendente)</option>
                    {state.tratte.filter(t => t.tag !== activeTratta.tag).map(t => (
                      <option key={t.tag} value={t.tag}>{t.tag}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pb-4 border-b border-slate-100">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Partenza (DA)</label>
                  {activeTratta.parentId !== null ? (
                    <input 
                      type="text"
                      readOnly
                      disabled
                      value={activeTratta.da || 'Partenza generica'}
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-400 cursor-not-allowed opacity-80"
                    />
                  ) : (
                    <select 
                      value={activeTratta.da || 'Partenza generica'}
                      onChange={e => updateTrattaField(activeTratta.tag, 'da', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="Cabina elettrica">Cabina elettrica</option>
                      <option value="Contatore di energia">Contatore di energia</option>
                      <option value="Quadro elettrico">Quadro elettrico</option>
                      <option value="Scatola di derivazione">Scatola di derivazione</option>
                      <option value="Partenza generica">Partenza generica</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Arrivo (A)</label>
                  <select 
                    value={activeTratta.a || 'Destinazione generica'}
                    onChange={e => updateTrattaField(activeTratta.tag, 'a', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="Quadro elettrico">Quadro elettrico</option>
                    <option value="Motore elettrico">Motore elettrico</option>
                    <option value="Punto di derivazione">Punto di derivazione</option>
                    <option value="Strumento elettronico">Strumento elettronico</option>
                    <option value="Scatola di derivazione">Scatola di derivazione</option>
                    <option value="Destinazione generica">Destinazione generica</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo Contenimento</label>
                  <select 
                    value={activeTratta.selectedFamilyId}
                    onChange={e => updateTrattaField(activeTratta.tag, 'selectedFamilyId', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {containersCatalog.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                    <option value="personalizzato">Personalizzato (Fuori Catalogo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Dimensione</label>
                  <select 
                    value={activeTratta.selectedSizeCode}
                    onChange={e => updateTrattaField(activeTratta.tag, 'selectedSizeCode', e.target.value)}
                    disabled={activeTratta.selectedFamilyId === 'personalizzato'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
                  >
                    {selectedFamily?.sizes.map(s => (
                      <option key={s.code} value={s.code}>{formatContainerSizeLabel(selectedFamily, s)}</option>
                    ))}
                    <option value="personalizzato">Personalizzato</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 mt-4 text-xs font-semibold">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Linee in parallelo:</span>
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-xs">
                    <button
                      type="button"
                      onClick={() => {
                        const currentQty = activeTratta.lineQty || (activeTratta.doubleLine ? 2 : 1);
                        if (currentQty > 1) {
                          const nextQty = currentQty - 1;
                          updateTrattaField(activeTratta.tag, 'lineQty', nextQty);
                        }
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-650 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer font-black"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-slate-700">
                      {activeTratta.lineQty || (activeTratta.doubleLine ? 2 : 1)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const currentQty = activeTratta.lineQty || (activeTratta.doubleLine ? 2 : 1);
                        const nextQty = currentQty + 1;
                        updateTrattaField(activeTratta.tag, 'lineQty', nextQty);
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-650 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer font-black"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Opzioni addizionali a seconda del tipo */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 text-xs font-semibold space-y-3 mb-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Opzioni e Accessori</span>
                <div className="flex flex-wrap gap-6">
                  {(selectedFamily?.sectionType === 'rettangolare' || activeTratta.selectedFamilyId === 'personalizzato') && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={activeTratta.hasSeparator} 
                        onChange={e => updateTrattaField(activeTratta.tag, 'hasSeparator', e.target.checked)}
                        className="rounded border-slate-350 text-amber-500 focus:ring-amber-400"
                      />
                      <span>Aggiungi Setto Separatore</span>
                    </label>
                  )}
                  {(selectedFamily?.sectionType === 'rettangolare' || activeTratta.selectedFamilyId === 'personalizzato') && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={activeTratta.hasCover} 
                        onChange={e => updateTrattaField(activeTratta.tag, 'hasCover', e.target.checked)}
                        className="rounded border-slate-350 text-amber-500 focus:ring-amber-400"
                      />
                      <span>Aggiungi Coperchio</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Parametri Personalizzati se attivati */}
              {(activeTratta.selectedFamilyId === 'personalizzato' || activeTratta.selectedSizeCode === 'personalizzato') && (
                <div className="bg-amber-50/40 border border-amber-200/50 rounded-2xl p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="col-span-2 md:col-span-4 text-xs font-bold text-amber-800">
                    Parametri Personalizzati Conduttura
                  </div>
                  {selectedFamily?.sectionType === 'rettangolare' || activeTratta.selectedFamilyId === 'personalizzato' ? (
                    <>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Larghezza Base (mm)</label>
                        <input 
                          type="number"
                          value={activeTratta.customWidth || ''}
                          onChange={e => updateTrattaField(activeTratta.tag, 'customWidth', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Altezza (mm)</label>
                        <input 
                          type="number"
                          value={activeTratta.customHeight || ''}
                          onChange={e => updateTrattaField(activeTratta.tag, 'customHeight', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Diametro Esterno (mm)</label>
                        <input 
                          type="number"
                          value={activeTratta.customOuterDiameter || ''}
                          onChange={e => updateTrattaField(activeTratta.tag, 'customOuterDiameter', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Diametro Interno (mm)</label>
                        <input 
                          type="number"
                          value={activeTratta.customInnerDiameter || ''}
                          onChange={e => updateTrattaField(activeTratta.tag, 'customInnerDiameter', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700"
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Peso Vuoto (kg/m)</label>
                    <input 
                      type="number"
                      step="any"
                      value={activeTratta.customWeight || ''}
                      onChange={e => updateTrattaField(activeTratta.tag, 'customWeight', parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700"
                    />
                  </div>
                  {activeTratta.hasCover && (
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Peso Coperchio (kg/m)</label>
                      <input 
                        type="number"
                        step="any"
                        value={activeTratta.customCoverWeight || ''}
                        onChange={e => updateTrattaField(activeTratta.tag, 'customCoverWeight', parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Gestione Cavi all'interno della tratta */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-base font-black text-slate-800">
                  Cavi Posati nella Tratta
                </h3>
                <button 
                  onClick={handleAddCableToTratta}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Aggiungi Cavo
                </button>
              </div>

              {activeTratta.cables.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-semibold border-2 border-dashed border-slate-200 rounded-2xl">
                  Nessun cavo presente in questa tratta. Fai clic su "Aggiungi Cavo" per iniziare.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-slate-100">
                    <thead>
                      <tr className="text-slate-400 uppercase font-black tracking-wide text-[10px]">
                        <th className="py-2.5 px-2">Tipo Cavo</th>
                        <th className="py-2.5 px-2">Formazione</th>
                        <th className="py-2.5 px-2">Q.tà</th>
                        <th className="py-2.5 px-2">Diametro [mm]</th>
                        <th className="py-2.5 px-2">Peso [kg/m]</th>
                        {activeTratta.hasSeparator && (
                          <th className="py-2.5 px-2">Destinazione</th>
                        )}
                        <th className="py-2.5 px-2 text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                      {activeTratta.cables.map((cavo, idx) => {
                        const product = cablesCatalog.find(c => c.id === cavo.cableId);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-2">
                              <select 
                                value={cavo.cableId}
                                onChange={e => handleUpdateCableInTratta(idx, 'cableId', e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-lg p-1 text-[11px]"
                              >
                                {cablesCatalog.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                                <option value="personalizzato">Personalizzato</option>
                              </select>
                            </td>

                            <td className="py-2.5 px-2">
                              {cavo.cableId === 'personalizzato' ? (
                                <input 
                                  type="text"
                                  value={cavo.formation}
                                  onChange={e => handleUpdateCableInTratta(idx, 'formation', e.target.value)}
                                  className="bg-slate-50 border border-slate-200 rounded-lg p-1 text-[11px] w-24"
                                />
                              ) : (
                                <select 
                                  value={cavo.formation}
                                  onChange={e => handleUpdateCableInTratta(idx, 'formation', e.target.value)}
                                  className="bg-slate-50 border border-slate-200 rounded-lg p-1 text-[11px]"
                                >
                                  {product?.formations.map(f => (
                                    <option key={f.formation} value={f.formation}>{f.formation}</option>
                                  ))}
                                </select>
                              )}
                            </td>

                            <td className="py-2.5 px-2">
                              <input 
                                type="number"
                                min="1"
                                value={cavo.qty}
                                onChange={e => handleUpdateCableInTratta(idx, 'qty', e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
                                className="bg-slate-50 border border-slate-200 rounded-lg p-1 text-[11px] w-12 text-center"
                              />
                            </td>

                            <td className="py-2.5 px-2">
                              {cavo.cableId === 'personalizzato' ? (
                                <input 
                                  type="number"
                                  step="any"
                                  value={cavo.diameter}
                                  onChange={e => handleUpdateCableInTratta(idx, 'diameter', parseFloat(e.target.value) || 0)}
                                  className="bg-slate-50 border border-slate-200 rounded-lg p-1 text-[11px] w-16"
                                />
                              ) : (
                            <span>{formatNumber(cavo.diameter, 1)}</span>
                              )}
                            </td>

                            <td className="py-2.5 px-2">
                              {cavo.cableId === 'personalizzato' ? (
                                <input 
                                  type="number"
                                  step="any"
                                  value={cavo.weight}
                                  onChange={e => handleUpdateCableInTratta(idx, 'weight', parseFloat(e.target.value) || 0)}
                                  className="bg-slate-50 border border-slate-200 rounded-lg p-1 text-[11px] w-16"
                                />
                              ) : (
                                <span>{formatNumber(cavo.weight, 2)}</span>
                              )}
                            </td>

                             {activeTratta.hasSeparator && (
                              <td className="py-2.5 px-2">
                                <select 
                                  value={cavo.compartment}
                                  onChange={e => handleUpdateCableInTratta(idx, 'compartment', e.target.value)}
                                  className="bg-slate-50 border border-slate-200 rounded-lg p-1 text-[11px]"
                                >
                                  {selectedFamily?.sectionType === 'rettangolare' ? (
                                    <>
                                      <option value="vano1">Canale - Vano 1</option>
                                      <option value="vano2">Canale - Vano 2</option>
                                    </>
                                  ) : (
                                    <>
                                      <option value="vano1">Tubo - Vano 1</option>
                                      <option value="vano2">Tubo - Vano 2</option>
                                    </>
                                  )}
                                </select>
                              </td>
                            )}

                            <td className="py-2.5 px-2 text-right">
                              <button 
                                onClick={() => handleDeleteCableFromTratta(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Box Risultati e Visualizzazione Grafica */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Risultati Dimensionamento */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-base font-black text-slate-800 border-b border-slate-100 pb-3">
                  Esito Verifica CEI 64-8
                </h3>

                <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                  calcoliTratta.verificato 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  {calcoliTratta.verificato ? (
                    <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                  )}
                  <div>
                    <p className="font-bold text-sm">
                      {calcoliTratta.verificato ? "VERIFICATO (CONFORME)" : "NON CONFORME"}
                    </p>
                    <p className="text-[11px] mt-1 opacity-90 leading-relaxed font-semibold">
                      {calcoliTratta.dettagliVerifica}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-50 font-semibold">
                    <span className="text-slate-500">Peso Totale Cavi:</span>
                    <span className="text-slate-800">{formatNumber(calcoliTratta.pesoCavi)} kg/m</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-50 font-semibold">
                    <span className="text-slate-500">Peso Struttura (Condotto):</span>
                    <span className="text-slate-800">{formatNumber(calcoliTratta.pesoCondottoVuoto)} kg/m</span>
                  </div>
                  {activeTratta.hasCover && (
                    <div className="flex justify-between py-1.5 border-b border-slate-50 font-semibold">
                      <span className="text-slate-500">Peso Coperchio:</span>
                      <span className="text-slate-800">{formatNumber(calcoliTratta.pesoCoperchio)} kg/m</span>
                    </div>
                  )}
                  {activeTratta.hasSeparator && (
                    <div className="flex justify-between py-1.5 border-b border-slate-50 font-semibold">
                      <span className="text-slate-500">Peso Setto Separatore:</span>
                      <span className="text-slate-800">{formatNumber(calcoliTratta.pesoSetto)} kg/m</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b border-slate-100 font-black text-sm">
                    <span className="text-slate-800">Carico Totale Lineare:</span>
                    <span className="text-amber-600">{formatNumber(calcoliTratta.pesoLineareTotale)} kg/m</span>
                  </div>
                  <div className="flex justify-between py-2 font-black text-sm text-slate-800">
                    <span>Peso Totale Tratta ({formatNumber(activeTratta.length, 0)}m):</span>
                    <span>{formatNumber(calcoliTratta.pesoTrattaComplessivo)} kg</span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 rounded-xl p-3 leading-relaxed font-medium">
                  <strong>Riferimento Normativo:</strong> CEI 64-8. Nei tubi circolari il diametro interno del tubo deve essere almeno 1.5 volte il diametro del fascio di cavi. Nelle passerelle e canali rettangolari, almeno il 50% dello spazio interno utile del canale deve rimanere libero (fill ratio massimo 50%).
                </div>
              </div>

              {/* Rendering Grafico */}
              <SezioneCanvas 
                tratta={activeTratta} 
                family={selectedFamily} 
                size={selectedSize} 
                fillRate={calcoliTratta.fillRate}
              />
            </div>
          </div>
        </div>

      {/* Report di Stampa Clean & Premium (visibile solo in stampa) */}
      <div className="hidden print:block space-y-6 mt-6">
        <div>
          <h3 className="text-base font-black text-slate-800 border-b-2 border-slate-800 pb-1 uppercase tracking-wider">
            Riepilogo e Dimensionamento Condutture Elettriche
          </h3>
        </div>

        {/* Certificato di Conformità Ufficiale (CEI 64-8) */}
        <div className="bg-slate-50 border-l-4 border-slate-700 p-4 rounded-r-xl my-4 print:bg-slate-50">
          <div className="flex justify-between items-center gap-4">
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Attestato di Conformità Tecnica</span>
              <p className="text-xs text-slate-700 font-semibold leading-relaxed">
                Si attesta che il dimensionamento delle condutture elettriche, la scelta dei canali/tubazioni e il calcolo dei relativi tassi di riempimento riportati nel presente report sono stati eseguiti in piena conformità ai requisiti di sicurezza e alle prescrizioni della **Normativa CEI 64-8**.
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2 border border-slate-300 bg-white px-3 py-1.5 rounded-lg text-slate-800 font-bold">
              <span className="text-xs">📜</span>
              <span className="text-[10px] font-black uppercase tracking-wider">CEI 64-8</span>
            </div>
          </div>
        </div>

        {/* Tabella di Riepilogo delle Tratte */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-50 font-bold text-slate-700">
                <th className="py-2 px-3">Tratta</th>
                <th className="py-2 px-2 text-center">Lungh. (m)</th>
                <th className="py-2 px-2">Tipo Posa & Condotto</th>
                <th className="py-2 px-2">Cavi Installati</th>
                <th className="py-2 px-2 text-right">Peso (kg/m)</th>
                <th className="py-2 px-2 text-right">Peso Totale (kg)</th>
                <th className="py-2 px-3 text-center">Esito CEI 64-8</th>
              </tr>
            </thead>
            <tbody>
              {state.tratte.map(t => {
                const fam = containersCatalog.find(f => f.id === t.selectedFamilyId);
                const sz = fam?.sizes.find(s => s.code === t.selectedSizeCode);
                const comp = tratteCompliance.find(c => c.tag === t.tag);
                
                // Calcola pesi della tratta
                const isRect = fam ? fam.sectionType === 'rettangolare' : (t.selectedFamilyId === 'personalizzato' && t.customWidth !== undefined);
                let pesoCavi = 0;
                t.cables.forEach(c => { pesoCavi += c.weight * (Number(c.qty) || 0); });
                const N_lines = t.lineQty || (t.doubleLine ? 2 : 1);
                let pesoCondotto = (sz?.weight || t.customWeight || 0.5) * N_lines;
                let pesoCoperchio = 0;
                if (isRect && t.hasCover) {
                  pesoCoperchio = (sz?.coverWeight || t.customCoverWeight || 0.3) * N_lines;
                }
                let pesoSetto = 0;
                if (t.hasSeparator) {
                  pesoSetto = (isRect ? (sz?.coverWeight || t.customCoverWeight || 0.3) : 0.2) * N_lines;
                }
                const pesoLineare = pesoCavi + pesoCondotto + pesoCoperchio + pesoSetto;
                const pesoTot = pesoLineare * (Number(t.length) || 0);

                return (
                  <tr key={t.tag} className="border-b border-slate-200 hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      {t.name}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono">{formatNumber(t.length, 0)}</td>
                    <td className="py-2.5 px-2">
                      <div className="font-semibold text-slate-700">
                        {t.containmentType === 'vista' ? 'A vista' : t.containmentType === 'cavidotto' ? 'Interrato' : 'Tubo "tazza"'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {fam?.name} ({formatContainerSizeLabel(fam, sz, t)}) {N_lines > 1 ? `x ${N_lines} linee` : ''}
                      </div>
                    </td>
                    <td className="py-2.5 px-2">
                      {t.cables.length === 0 ? (
                        <span className="text-slate-400 italic text-[10px]">Nessun cavo</span>
                      ) : (
                        <ul className="list-disc pl-3 text-[10px] text-slate-650 space-y-0.5">
                          {t.cables.map((c, idx) => (
                            <li key={idx}>
                              {c.formation} (Ø {formatNumber(c.diameter, 1)}mm) x {formatNumber(c.qty, 0)} pz
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-semibold">{formatNumber(pesoLineare, 2)}</td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold">{formatNumber(pesoTot, 1)}</td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                        comp?.verificato ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        {comp?.verificato ? 'Conforme' : 'Non Conforme'} • {formatNumber(comp?.fillRate, 1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Rappresentazione Grafica in Stampa */}
        <div className="print:break-inside-avoid page-break-before-auto">
          <h4 className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4 uppercase tracking-wider">
            Sezioni e Riempimento dei Condotti
          </h4>
          <div className="grid grid-cols-2 gap-4">
            {state.tratte.map(t => {
              const fam = containersCatalog.find(f => f.id === t.selectedFamilyId);
              const sz = fam?.sizes.find(s => s.code === t.selectedSizeCode);
              const comp = tratteCompliance.find(c => c.tag === t.tag);
              return (
                <div key={t.tag} className="border border-slate-200 rounded-2xl p-4 bg-white flex flex-col items-center print:break-inside-avoid shadow-xs">
                  <span className="text-xs font-bold text-slate-800 mb-2">{t.name}</span>
                  <div className="scale-90 origin-top">
                    <SezioneCanvas
                      tratta={t}
                      family={fam}
                      size={sz}
                      fillRate={comp?.fillRate || 0}
                    />
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 mt-2">
                    Riempimento: {formatNumber(comp?.fillRate, 1)}% | Stato: {comp?.verificato ? 'CONFORME' : 'NON CONFORME'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Schema Topologico in Stampa */}
        <div className="print:break-inside-avoid">
          <h4 className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4 uppercase tracking-wider">
            Schema Topologico e Percorsi della Rete
          </h4>
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex flex-col items-center justify-center min-h-[250px] mb-4">
            <TopologicalTree 
              tratti={trattiNodesForTree} 
              activeTag={state.activeTrattaTag}
              mode="electric"
            />
          </div>

          <div className="mt-4">
            <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Tabella dei Collegamenti (DA ➔ A)
            </h5>
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="border-b border-slate-350 text-slate-500 text-left font-bold">
                  <th className="pb-1.5">Tratto</th>
                  <th className="pb-1.5">Partenza (DA)</th>
                  <th className="pb-1.5">Arrivo (A)</th>
                  <th className="pb-1.5 text-center">Stato</th>
                  <th className="pb-1.5 text-right">Riempimento</th>
                </tr>
              </thead>
              <tbody>
                {state.tratte.map(t => {
                  const comp = tratteCompliance.find(c => c.tag === t.tag);
                  return (
                    <tr key={t.tag} className="border-b border-slate-200">
                      <td className="py-1.5 font-bold text-slate-800">Tratto {t.tag}</td>
                      <td className="py-1.5 text-slate-650">{t.da || 'Partenza generica'}</td>
                      <td className="py-1.5 text-slate-650">{t.a || 'Destinazione generica'}</td>
                      <td className={`py-1.5 text-center font-bold ${comp?.verificato ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {comp?.verificato ? 'Conforme' : 'Non Conforme'}
                      </td>
                      <td className="py-1.5 text-right font-mono font-semibold">{formatNumber(comp?.fillRate, 1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
