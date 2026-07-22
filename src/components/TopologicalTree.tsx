import React, { useMemo, useEffect } from 'react';
import { formatNumber } from '../utils/format';

export interface TrattoNode {
  tag: string;
  parentId: string | null;
  hierarchy: string;
  length: number | string;
  name: string;
  velocity?: number;
  loss_tot_mbar?: number;
  // --- FASE 2 ---
  dislivelloGeodetico?: number | string;
  pressioneNodo?: number;          // pressione calcolata al nodo di arrivo (barg)
  pressioneMinimaRichiesta?: number | string; // soglia minima (barg)
  tipoCondotto?: 'aspirazione' | 'mandata';
  pressioneInizioTratto?: number;
  children?: TrattoNode[];
  da?: string;
  a?: string;
}

interface TopologicalTreeProps {
  tratti: TrattoNode[];
  activeTag?: string;
  onSelectTag?: (tag: string) => void;
  pressionePartenza?: number | string; // pressione alla radice (barg)
  mode?: 'gas' | 'electric';
}

interface MapNode extends TrattoNode {
  children: MapNode[];
}

interface VisualLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  startX?: number;
  startY?: number;
  thickness: number;
  color: string;
  tag: string;
  name: string;
  velocity?: number;
  loss?: number;
  length: number | string;
  dir: 'H' | 'V';
  // nuovi
  dislivello?: number | string;
  pressioneNodo?: number;
  pressioneMin?: number | string;
  hasAlarm?: boolean;
  tipoCondotto?: 'aspirazione' | 'mandata';
  dzX?: number;
  dzY?: number;
  dzAnchor?: "end" | "inherit" | "start" | "middle";
  pressioneInizioTratto?: number;
  da?: string;
  a?: string;
}

interface VisualLabel {
  x: number;
  y: number;
  text: string;
  title: string;
  dir: 'H' | 'V';
  anchor?: "end" | "inherit" | "start" | "middle";
  isAlarm?: boolean;
}

export default function TopologicalTree({ tratti, activeTag, onSelectTag, pressionePartenza = 0, mode = 'gas' }: TopologicalTreeProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSelectTag?.("");
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSelectTag]);

  const svgData = useMemo(() => {
    if (!tratti || tratti.length === 0) return null;

    // 1. Costruiamo una mappa dei tratti indicizzata per il TAG
    const trattiMap: Record<string, MapNode> = {};
    tratti.forEach(t => {
      trattiMap[t.tag] = { ...t, children: [] } as MapNode;
    });

    // 2. Colleghiamo i figli ai genitori
    const roots: MapNode[] = [];
    tratti.forEach(t => {
      const parentTag = t.parentId;
      if (parentTag && trattiMap[parentTag]) {
        trattiMap[parentTag].children.push(trattiMap[t.tag]);
      } else {
        roots.push(trattiMap[t.tag]);
      }
    });

    // Compressione logaritmica/radice quadrata limitata per mantenere il viewBox compatto differenziando tratti corti/lunghi
    const getVisualLength = (l: number | string): number => {
      const len = Number(l) || 0;
      return 90 + Math.min(110, Math.sqrt(len) * 11);
    };

    const lines: VisualLine[] = [];
    const labels: VisualLabel[] = [];

    // Mappa delle posizioni Y ordinate senza sovrapposizioni
    const childYMap = new Map<string, number>();
    let currentY = 60;
    const rowGap = 72; // Spaziatura ampia (72px) per permettere 3 righe trasparenti di testo senza alcuna sovrapposizione

    const assignYPositions = (node: MapNode): number => {
      if (!node.children || node.children.length === 0) {
        const y = currentY;
        currentY += rowGap;
        childYMap.set(node.tag, y);
        return y;
      }
      const sortedChildren = [...node.children].sort((a, b) => a.tag.localeCompare(b.tag));
      const childYs: number[] = [];
      sortedChildren.forEach(child => {
        childYs.push(assignYPositions(child));
      });
      const minY = childYs[0];
      const maxY = childYs[childYs.length - 1];
      const nodeY = (minY + maxY) / 2;
      childYMap.set(node.tag, nodeY);
      return nodeY;
    };

    roots.forEach(root => {
      assignYPositions(root);
      currentY += 30; // Spazio extra tra radici diverse
    });

    const visited = new Set<string>();

    const layoutSubtree = (
      node: MapNode,
      originX: number,
      originY: number,
      nodeY: number
    ): void => {
      if (!node || visited.has(node.tag)) return;
      visited.add(node.tag);

      const visualLen = getVisualLength(node.length);
      const dz = Number(node.dislivelloGeodetico) || 0;

      // Pendenza visiva immediatamente riconoscibile per il dislivello: salita (dz > 0) inclinata in alto, discesa (dz < 0) in basso
      const slopeY = dz !== 0 ? Math.max(-12, Math.min(12, -dz * 4)) : 0;

      const startX = originX;
      const startY = nodeY;
      const endX = startX + visualLen;
      const endY = nodeY + slopeY;

      // Spessore e colore del tratto
      let lineThickness = 4;
      let lineColor = "#3b82f6";
      const isAsp = node.tipoCondotto === 'aspirazione';

      if (mode === 'electric') {
        lineThickness = 4;
        lineColor = "#3b82f6";
      } else {
        if (node.hierarchy === 'dorsale_principale') {
          lineThickness = 5;
          lineColor = isAsp ? "#ea580c" : "#1d4ed8";
        } else if (node.hierarchy === 'dorsale_secondaria') {
          lineThickness = 3.5;
          lineColor = isAsp ? "#f97316" : "#0ea5e9";
        } else if (node.hierarchy === 'dorsale_terziaria') {
          lineThickness = 2.5;
          lineColor = isAsp ? "#fb923c" : "#10b981";
        } else {
          lineThickness = 1.5;
          lineColor = isAsp ? "#d97706" : "#64748b";
        }
      }

      const pNodo = node.pressioneNodo;
      const pMin = Number(node.pressioneMinimaRichiesta) || 0;
      const hasAlarm = mode === 'electric' 
        ? (pNodo !== undefined && pNodo > (pMin || 50)) 
        : (pNodo !== undefined && pNodo < pMin);

      // Calcolo orientamento e vettori perpendicolari alla linea
      const dx_val = endX - startX;
      const dy_val = endY - startY;
      const lineLen = Math.hypot(dx_val, dy_val) || 1;
      
      const nx = -dy_val / lineLen;
      const ny = dx_val / lineLen;

      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;

      // Label TAG + lunghezza (Riga 1 - SOPRA il tubo)
      const textX = midX - nx * 13;
      const textY = midY - ny * 13;

      // Label Riempimento % (Riga 2 - SOTTO il tubo)
      const fillX = midX + nx * 13;
      const fillY = midY + ny * 13;

      // Label Dislivello (Riga 3 - SOTTO il riempimento)
      const dzX = midX + nx * 24;
      const dzY = midY + ny * 24;

      // Aggiungiamo la linea reale del tratto
      lines.push({
        x1: originX,
        y1: originY,
        startX,
        startY,
        x2: endX,
        y2: endY,
        thickness: lineThickness,
        color: lineColor,
        tag: node.tag,
        name: node.name,
        velocity: node.velocity,
        loss: node.loss_tot_mbar,
        length: node.length,
        dir: slopeY === 0 ? 'H' : 'V',
        dislivello: dz !== 0 ? dz : undefined,
        pressioneNodo: pNodo,
        pressioneMin: pMin,
        hasAlarm,
        tipoCondotto: node.tipoCondotto || 'mandata',
        pressioneInizioTratto: node.pressioneInizioTratto,
        da: node.da,
        a: node.a
      });

      // Label principale (TAG + lunghezza) SOPRA la linea (Riga 1)
      labels.push({
        x: textX,
        y: textY,
        text: `${node.tag} (${formatNumber(node.length, 2).replace(',00', '')}m)`,
        title: mode === 'electric' 
          ? `${node.name} (${node.tag})\nPercorso: ${node.da || 'Partenza generica'} ➔ ${node.a || 'Utenza generica'}\nLunghezza: ${formatNumber(node.length, 1)} m\nRiempimento: ${pNodo !== undefined ? formatNumber(pNodo, 1) : '—'}%\nDislivello: ${dz >= 0 ? '+' : ''}${formatNumber(dz, 1)} m`
          : `${node.name}\nv = ${formatNumber(node.velocity, 2)} m/s\n∆P = ${formatNumber(node.loss_tot_mbar, 1)} mbar\n∆z = ${dz >= 0 ? '+' : ''}${formatNumber(dz, 1)} m\nP_nodo = ${pNodo !== undefined ? formatNumber(pNodo, 3) : '—'} barg`,
        dir: 'H',
        anchor: 'middle'
      });

      // Label di riempimento (%) SOTTO la linea (Riga 2)
      if (mode === 'electric' && pNodo !== undefined) {
        labels.push({
          x: fillX,
          y: fillY,
          text: `Riempimento: ${formatNumber(pNodo, 1)}%`,
          title: `${node.name}\nLunghezza: ${formatNumber(node.length, 1)} m\nRiempimento: ${formatNumber(pNodo, 1)}%`,
          dir: 'H',
          anchor: 'middle',
          isAlarm: hasAlarm
        });
      }

      // Label Dislivello (dz) SOTTO la scritta Riempimento (Riga 3)
      if (dz !== 0) {
        const dzText = `${dz > 0 ? '↑' : '↓'} Dislivello: ${dz >= 0 ? '+' : ''}${formatNumber(dz, 1)}m`;
        labels.push({
          x: dzX,
          y: dzY,
          text: dzText,
          title: `Dislivello geodetico: ${dz >= 0 ? '+' : ''}${formatNumber(dz, 1)} m`,
          dir: 'H',
          anchor: 'middle',
          isAlarm: false,
          isDz: true,
          dzValue: dz
        } as any);
      }

      // Ricorsione sui figli: allineiamo il centro dei figli all'endpoint EFFETTIVO (endX, endY) del nodo padre!
      const sortedChildren = [...node.children].sort((a, b) => a.tag.localeCompare(b.tag));
      if (sortedChildren.length > 0) {
        const firstChildBaseY = childYMap.get(sortedChildren[0].tag) ?? endY;
        const lastChildBaseY = childYMap.get(sortedChildren[sortedChildren.length - 1].tag) ?? endY;
        const childrenCenterY = (firstChildBaseY + lastChildBaseY) / 2;
        const yShift = endY - childrenCenterY;

        sortedChildren.forEach(child => {
          const baseChildY = childYMap.get(child.tag) ?? endY;
          const childY = baseChildY + yShift;
          layoutSubtree(child, endX, endY, childY);
        });
      }
    };

    // Inizializziamo le radici
    roots.forEach((root) => {
      const rootY = childYMap.get(root.tag) ?? 80;
      layoutSubtree(root, 40, rootY, rootY);
    });

    // TROVIAMO I LIMITI ED APPLICHIAMO LO SHIFT
    let minX = 40;
    let maxX = 40;
    let minY = 40;
    let maxY = 40;

    lines.forEach(l => {
      const sx = l.startX ?? l.x1;
      const sy = l.startY ?? l.y1;
      minX = Math.min(minX, l.x1, l.x2, sx);
      maxX = Math.max(maxX, l.x1, l.x2, sx);
      minY = Math.min(minY, l.y1, l.y2, sy);
      maxY = Math.max(maxY, l.y1, l.y2, sy);
    });

    const padding = 50;
    const rawWidth = maxX - minX + 2 * padding;
    const rawHeight = maxY - minY + 2 * padding;

    // Definiamo una dimensione minima del viewBox più ampia per evitare compressioni e accavallamenti
    const viewBoxWidth = Math.max(rawWidth, 800);
    const viewBoxHeight = Math.max(rawHeight, 350);

    // Lo shift compensa sia i limiti minimi che la centratura del disegno nel viewBox più grande
    const shiftX = (minX < padding ? (padding - minX) : 0) + (viewBoxWidth - rawWidth) / 2;
    const shiftY = (minY < padding ? (padding - minY) : 0) + (viewBoxHeight - rawHeight) / 2;

    lines.forEach(l => {
      l.x1 += shiftX;
      l.x2 += shiftX;
      l.y1 += shiftY;
      l.y2 += shiftY;
      if (l.startX !== undefined && l.startY !== undefined) {
        l.startX += shiftX;
        l.startY += shiftY;
      }
      if (l.dzX !== undefined && l.dzY !== undefined) {
        l.dzX += shiftX;
        l.dzY += shiftY;
      }
    });

    labels.forEach(lbl => {
      lbl.x += shiftX;
      lbl.y += shiftY;
    });

    const pumpLocations: { x: number; y: number }[] = [];
    lines.forEach(l1 => {
      if (l1.tipoCondotto === 'aspirazione') {
        const hasMandataChild = lines.some(l2 => l2.tipoCondotto === 'mandata' && Math.abs(l2.x1 - l1.x2) < 0.1 && Math.abs(l2.y1 - l1.y2) < 0.1);
        if (hasMandataChild) {
          pumpLocations.push({ x: l1.x2, y: l1.y2 });
        }
      }
    });

    return { lines, labels, pumpLocations, totalWidth: viewBoxWidth, totalHeight: viewBoxHeight };
  }, [tratti]);

  if (!tratti || tratti.length === 0) {
    return (
      <div className="py-8 text-center text-slate-400 text-xs italic">
        Nessun tratto presente. Aggiungi i tratti per visualizzare lo schema topologico perpendicolare.
      </div>
    );
  }

  const { lines, labels, pumpLocations, totalWidth, totalHeight } = svgData || { lines: [], labels: [], pumpLocations: [], totalWidth: 600, totalHeight: 150 };

  return (
    <div 
      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 print:bg-white print:border-none print:p-0 flex flex-col justify-center items-center gap-4 overflow-hidden cursor-default"
      onClick={() => onSelectTag?.("")}
    >
      <svg 
        viewBox={`0 0 ${totalWidth} ${totalHeight}`} 
        style={{ width: '100%', height: 'auto', maxWidth: `${totalWidth}px` }}
        className="select-none font-sans print:max-h-[250px] mx-auto block"
      >
          <style>{`
            @media print {
              .topo-highlight-line { display: none !important; }
              .topo-line-electric           { stroke: #3b82f6 !important; stroke-width: 4px !important; }
              .topo-line-dorsale-principale { stroke: #1d4ed8 !important; stroke-width: 5px !important; }
              .topo-line-dorsale-secondaria { stroke: #0ea5e9 !important; stroke-width: 3.5px !important; }
              .topo-line-dorsale-terziaria  { stroke: #10b981 !important; stroke-width: 2.5px !important; }
              .topo-line-utenza              { stroke: #64748b !important; stroke-width: 1.5px !important; }
              .topo-circle-node { fill: #cbd5e1 !important; stroke: #475569 !important; }
              .topo-circle-thick { r: 4.5px !important; }
              .topo-circle-thin  { r: 3px !important; }
            }
          `}</style>

          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
            </marker>
          </defs>

          {/* Nodo radice (sorgente / pompa) */}
          {lines.length > 0 && (() => {
            // Troviamo tutti i punti di partenza radice (non endpoint di altri)
            const endPoints = new Set(lines.map(l => `${l.x2},${l.y2}`));
            const rootLines = lines.filter(l => !endPoints.has(`${l.x1},${l.y1}`));
            return rootLines.map((l, i) => (
              <g key={`root-node-${i}`}>
                {/* Cerchio radice con indicazione pressione partenza */}
                <circle cx={l.x1} cy={l.y1} r="7" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
                {mode !== 'electric' && (
                  <text x={l.x1} y={l.y1 - 12} textAnchor="middle" fill="#1e293b" fontSize="8" fontWeight="bold">
                    {`${formatNumber(pressionePartenza, 2)} barg`}
                  </text>
                )}
                <text x={l.x1} y={l.y1 - 3} textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">
                  {mode === 'electric' ? "" : "P₀"}
                </text>
              </g>
            ));
          })()}

          {/* Disegnamo i tratti reali di fluido */}
          {lines.map((l) => {
            const isActive = activeTag === l.tag;
            const dz = Number(l.dislivello) || 0;
            const dzLabel = dz !== 0 ? (dz > 0 ? `↑${dz}m` : `↓${Math.abs(dz)}m`) : null;
            const hasJunction = l.startX !== undefined && l.startY !== undefined && (l.startX !== l.x1 || l.startY !== l.y1);
            const pathD = hasJunction ? `M ${l.x1} ${l.y1} L ${l.startX} ${l.startY} L ${l.x2} ${l.y2}` : `M ${l.x1} ${l.y1} L ${l.x2} ${l.y2}`;

            return (
              <g 
                key={l.tag} 
                className="group cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isActive) {
                    onSelectTag?.("");
                  } else {
                    onSelectTag?.(l.tag);
                  }
                }}
              >
                <title>
                  {mode === 'electric' 
                    ? `${l.name} (${l.tag})\nPercorso: ${l.da || 'Partenza generica'} ➔ ${l.a || 'Utenza generica'}\nLunghezza: ${formatNumber(l.length, 1)} m\nDislivello: ${dz >= 0 ? '+' : ''}${formatNumber(dz, 1)} m\nRiempimento: ${l.pressioneNodo !== undefined ? formatNumber(l.pressioneNodo, 1) : '—'}%` 
                    : `${l.name}\nLunghezza: ${formatNumber(l.length, 1)} m\nVelocità: ${formatNumber(l.velocity, 2)} m/s\nPerdita: ${formatNumber(l.loss, 1)} mbar\n∆z: ${dz >= 0 ? '+' : ''}${formatNumber(dz, 1)} m\nP_nodo: ${l.pressioneNodo !== undefined ? formatNumber(l.pressioneNodo, 3) : '—'} barg`}
                </title>
                {/* Linea di hover/attiva */}
                <path 
                  d={pathD}
                  fill="none"
                  stroke={isActive ? "rgba(34, 197, 94, 0.3)" : "rgba(59, 130, 246, 0.08)"}
                  strokeWidth={l.thickness + 8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`topo-highlight-line ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity"}`}
                />
                {/* Linea reale */}
                <path 
                  d={pathD}
                  fill="none"
                  stroke={isActive ? "#22c55e" : l.color}
                  strokeWidth={isActive ? l.thickness + 1 : l.thickness}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd={l.thickness <= 2 ? "url(#arrow)" : undefined}
                  className={`transition-colors group-hover:stroke-green-500 ${
                    mode === 'electric' ? "topo-line-electric" : (
                      l.color === "#1d4ed8" ? "topo-line-dorsale-principale" :
                      l.color === "#0ea5e9" ? "topo-line-dorsale-secondaria" :
                      l.color === "#10b981" ? "topo-line-dorsale-terziaria" : "topo-line-utenza"
                    )
                  }`}
                />

                {/* Badge Δz sul segmento */}
                {dzLabel && l.dzX !== undefined && l.dzY !== undefined && (
                  <g className="pointer-events-none">
                    <text
                      x={l.dzX}
                      y={l.dzY}
                      textAnchor={l.dzAnchor || "middle"}
                      fill="white"
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      fontSize="7.5"
                      fontWeight="bold"
                    >
                      {dzLabel}
                    </text>
                    <text
                      x={l.dzX}
                      y={l.dzY}
                      textAnchor={l.dzAnchor || "middle"}
                      fill={dz > 0 ? "#ea580c" : "#0891b2"}
                      fontSize="7.5"
                      fontWeight="bold"
                    >
                      {dzLabel}
                    </text>
                  </g>
                )}

                {/* Nodo di giunzione (cerchio) con allarme pressione */}
                <circle 
                  cx={l.x1} cy={l.y1} 
                  r={isActive ? "5.5" : (l.thickness > 3 ? "4.5" : "3")} 
                  fill={isActive ? "#dcfce7" : "#cbd5e1"} 
                  stroke={isActive ? "#22c55e" : "#475569"} 
                  strokeWidth="1.5"
                  className={`topo-circle-node ${l.thickness > 3 ? "topo-circle-thick" : "topo-circle-thin"}`}
                />

                {/* Nodo di arrivo (endpoint) con pressione e allarme */}
                <circle 
                  cx={l.x2} cy={l.y2} 
                  r={l.hasAlarm ? "6" : (l.thickness > 3 ? "4.5" : "3")} 
                  fill={l.hasAlarm ? "#fef2f2" : (isActive ? "#dcfce7" : "#e2e8f0")}
                  stroke={l.hasAlarm ? "#ef4444" : (isActive ? "#22c55e" : "#64748b")} 
                  strokeWidth={l.hasAlarm ? "2" : "1.5"}
                />
                {/* Allarme pressione: punto rosso + etichetta spostata per evitare sovrapposizioni */}
                {l.hasAlarm && (() => {
                  const hasPumpAtEnd = pumpLocations.some(p => Math.abs(p.x - l.x2) < 0.1 && Math.abs(p.y - l.y2) < 0.1);
                  let alarmX = l.x2;
                  let alarmY = l.y2;
                  let anchor: "end" | "inherit" | "start" | "middle" = "middle";
                  
                  if (hasPumpAtEnd) {
                    alarmX = l.x2 - 12;
                    alarmY = l.y2 + 4;
                    anchor = "end";
                  } else {
                    if (l.dir === 'H') {
                      alarmX = l.x2 + 8;
                      alarmY = l.y2 - 8;
                      anchor = "start";
                    } else {
                      alarmX = l.x2 + 8;
                      alarmY = l.y2 + 10;
                      anchor = "start";
                    }
                  }
                  
                  return (
                    <g>
                      <circle cx={l.x2} cy={l.y2} r="3" fill="#ef4444" opacity="0.8" />
                      <text
                        x={alarmX}
                        y={alarmY}
                        textAnchor={anchor}
                        fill="white"
                        stroke="white"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        fontSize="7.5"
                        fontWeight="bold"
                      >
                        {mode === 'electric' ? "⚠ >50%" : "⚠ P<min"}
                      </text>
                      <text
                        x={alarmX}
                        y={alarmY}
                        textAnchor={anchor}
                        fill="#ef4444"
                        fontSize="7.5"
                        fontWeight="bold"
                      >
                        {mode === 'electric' ? "⚠ >50%" : "⚠ P<min"}
                      </text>
                    </g>
                  );
                })()}

                {/* Etichetta pressione al nodo di arrivo con outline e spostata per non sovrapporsi */}
                {l.pressioneNodo !== undefined && (() => {
                  if (mode === 'electric') return null;
                  const hasPumpAtEnd = pumpLocations.some(p => Math.abs(p.x - l.x2) < 0.1 && Math.abs(p.y - l.y2) < 0.1);
                  let labelX = l.x2;
                  let labelY = l.y2;
                  let anchor: "end" | "inherit" | "start" | "middle" = "middle";
                  
                  if (hasPumpAtEnd) {
                    labelX = l.x2 - 12;
                    labelY = l.y2 + 14;
                    anchor = "end";
                  } else {
                    if (l.dir === 'H') {
                      labelX = l.x2 + 8;
                      labelY = l.y2 + (l.hasAlarm ? -18 : -8);
                      anchor = "start";
                    } else {
                      labelX = l.x2 + 8;
                      labelY = l.y2 + (l.hasAlarm ? 20 : 10);
                      anchor = "start";
                    }
                  }
                  
                  return (
                    <g>
                      <text
                        x={labelX}
                        y={labelY}
                        textAnchor={anchor}
                        fill="white"
                        stroke="white"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        fontSize="7.5"
                        fontWeight="600"
                      >
                        {`${formatNumber(l.pressioneNodo, 2)} barg`}
                      </text>
                      <text
                        x={labelX}
                        y={labelY}
                        textAnchor={anchor}
                        fill={l.hasAlarm ? "#ef4444" : "#475569"}
                        fontSize="7.5"
                        fontWeight="600"
                      >
                        {`${formatNumber(l.pressioneNodo, 2)} barg`}
                      </text>
                    </g>
                  );
                })()}
              </g>
            );
          })}

          {/* Strato Superiore: Tratta Selezionata Attiva (Renderizzata SOPRA a tutte le altre linee) */}
          {lines.filter(l => activeTag === l.tag).map(l => {
            const hasJunction = l.startX !== undefined && l.startY !== undefined && (l.startX !== l.x1 || l.startY !== l.y1);
            const pathD = hasJunction ? `M ${l.x1} ${l.y1} L ${l.startX} ${l.startY} L ${l.x2} ${l.y2}` : `M ${l.x1} ${l.y1} L ${l.x2} ${l.y2}`;
            return (
              <g key={`active-layer-${l.tag}`} className="pointer-events-none">
                {/* Glow verde esterno di selezione */}
                <path 
                  d={pathD}
                  fill="none"
                  stroke="rgba(34, 197, 94, 0.4)"
                  strokeWidth={l.thickness + 10}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Linea verde reale selezionata */}
                <path 
                  d={pathD}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={l.thickness + 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Cerchio del nodo di origine */}
                <circle 
                  cx={l.x1} cy={l.y1} 
                  r="5.5" 
                  fill="#dcfce7" 
                  stroke="#22c55e" 
                  strokeWidth="2"
                />
                {/* Cerchio del nodo di arrivo */}
                <circle 
                  cx={l.x2} cy={l.y2} 
                  r="6.5" 
                  fill="#dcfce7" 
                  stroke="#22c55e" 
                  strokeWidth="2.5"
                />
              </g>
            );
          })}

          {/* Simbolo Pompa nei punti di transizione */}
          {pumpLocations.map((p, i) => {
            const childLine = lines.find(l => Math.abs(l.x1 - p.x) < 0.1 && Math.abs(l.y1 - p.y) < 0.1 && l.tipoCondotto === 'mandata');
            const pStart = childLine?.pressioneInizioTratto;
            
            // Calcoliamo la direzione per l'offset dell'etichetta pressione della pompa
            let dx = 1;
            let dy = 0.5;
            if (childLine) {
              const len = Math.hypot(childLine.x2 - childLine.x1, childLine.y2 - childLine.y1);
              if (len > 0) {
                dx = (childLine.x2 - childLine.x1) / len;
                dy = (childLine.y2 - childLine.y1) / len;
              }
            }
            
            // Posiziona il testo a distanza 22px lungo la linea, shiftato perpendicolarmente di 11px per non sovrapporsi
            const dist = 22;
            const perpOffset = 11;
            const labelX = p.x + dx * dist - dy * perpOffset;
            const labelY = p.y + dy * dist + dx * perpOffset;
            
            return (
              <g key={`pump-${i}`}>
                <title>Gruppo di Pompaggio (Transizione Aspirazione ➔ Mandata)</title>
                <circle cx={p.x} cy={p.y} r="9" fill="white" stroke="#1e293b" strokeWidth="1.8" />
                <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fill="#1e293b" fontSize="9" fontWeight="black" fontFamily="sans-serif">P</text>
                
                {pStart !== undefined && (
                  <g>
                    <text 
                      x={labelX} 
                      y={labelY} 
                      textAnchor="middle" 
                      fill="white" 
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      fontSize="7.5" 
                      fontWeight="bold"
                    >
                      {formatNumber(pStart, 2)} barg
                    </text>
                    <text 
                      x={labelX} 
                      y={labelY} 
                      textAnchor="middle" 
                      fill="#1d4ed8" 
                      fontSize="7.5" 
                      fontWeight="bold"
                    >
                      {formatNumber(pStart, 2)} barg
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Testi informativi */}
          {labels.map((lbl, index) => {
            const isDz = (lbl as any).isDz;
            const dzVal = (lbl as any).dzValue;
            const textColor = isDz ? (dzVal > 0 ? "#ea580c" : "#0891b2") : (lbl.isAlarm ? "#ef4444" : "#334155");
            const fontSize = isDz ? "8" : "9";

            return (
              <g key={`lbl-${index}`} className="pointer-events-none">
                {/* Outline per leggibilità */}
                <text 
                  x={lbl.x} y={lbl.y} 
                  textAnchor={lbl.anchor || (lbl.dir === 'H' ? "middle" : "start")} 
                  fill="white" 
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  fontSize={fontSize} 
                  fontWeight="bold" 
                  className="font-semibold"
                >
                  {lbl.text}
                </text>
                {/* Testo reale */}
                <text 
                  x={lbl.x} y={lbl.y} 
                  textAnchor={lbl.anchor || (lbl.dir === 'H' ? "middle" : "start")} 
                  fill={textColor} 
                  fontSize={fontSize} 
                  fontWeight="bold" 
                  className="font-semibold"
                >
                  {lbl.text}
                </text>
              </g>
            );
          })}
        </svg>
      {mode === 'electric' ? (
        <div className="flex flex-wrap gap-4 justify-center mt-3 text-[10px] text-slate-500 font-semibold print:hidden">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-1 bg-[#3b82f6]"></span> Canale / Tubazione
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-red-400 border-2 border-red-500"></span> Riempimento &gt; 50% (Allarme)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-orange-500 font-bold">↑</span><span className="text-cyan-600 font-bold">↓</span> Dislivello (m)
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 justify-center mt-3 text-[10px] text-slate-400 print:hidden">
          <div className="flex items-center gap-1.5"><span className="inline-block w-4 h-1.5 bg-[#1d4ed8]"></span> Dorsale Principale (Mandata)</div>
          <div className="flex items-center gap-1.5"><span className="inline-block w-4 h-1.5 bg-[#ea580c]"></span> Dorsale Principale (Aspirazione)</div>
          <div className="flex items-center gap-1.5"><span className="inline-block w-4 h-1 bg-[#0ea5e9]"></span> Dorsale Secondaria (Mandata)</div>
          <div className="flex items-center gap-1.5"><span className="inline-block w-4 h-1 bg-[#f97316]"></span> Dorsale Secondaria (Aspirazione)</div>
          <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-white border border-[#1e293b] font-bold text-[9px] inline-flex items-center justify-center leading-none">P</span> Pompa</div>
          <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-red-400 border-2 border-red-500"></span> Pressione &lt; Minima</div>
          <div className="flex items-center gap-1.5"><span className="text-orange-500 font-bold">↑</span><span className="text-cyan-600 font-bold">↓</span> Dislivello (m)</div>
        </div>
      )}
    </div>
  );
}
