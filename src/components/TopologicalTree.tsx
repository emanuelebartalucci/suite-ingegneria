import React, { useMemo, useEffect } from 'react';

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
}

interface TopologicalTreeProps {
  tratti: TrattoNode[];
  activeTag?: string;
  onSelectTag?: (tag: string) => void;
  pressionePartenza?: number | string; // pressione alla radice (barg)
}

interface MapNode extends TrattoNode {
  children: MapNode[];
}

interface VisualLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
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
}

interface VisualLabel {
  x: number;
  y: number;
  text: string;
  title: string;
  dir: 'H' | 'V';
  anchor?: "end" | "inherit" | "start" | "middle";
}

export default function TopologicalTree({ tratti, activeTag, onSelectTag, pressionePartenza = 0 }: TopologicalTreeProps) {
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

    const checkCollision = (
      x1: number, y1: number, x2: number, y2: number,
      placedLines: VisualLine[]
    ): boolean => {
      const minX1 = Math.min(x1, x2);
      const maxX1 = Math.max(x1, x2);
      const minY1 = Math.min(y1, y2);
      const maxY1 = Math.max(y1, y2);
      const isH1 = (y1 === y2);

      // 1. Evitamento allineamento parallelo sulle quote
      if (isH1) {
        for (const line of placedLines) {
          if (Math.abs(x2 - line.x1) < 15 && !(x2 === line.x1 && y2 === line.y1)) {
            return true;
          }
          if (Math.abs(x2 - line.x2) < 15 && !(x2 === line.x2 && y2 === line.y2)) {
            return true;
          }
        }
      } else {
        for (const line of placedLines) {
          if (Math.abs(y2 - line.y1) < 15 && !(x2 === line.x1 && y2 === line.y1)) {
            return true;
          }
          if (Math.abs(y2 - line.y2) < 15 && !(x2 === line.x2 && y2 === line.y2)) {
            return true;
          }
        }
      }

      // 2. Controllo intersezioni o contatti lungo i segmenti
      for (const line of placedLines) {
        const minX2 = Math.min(line.x1, line.x2);
        const maxX2 = Math.max(line.x1, line.x2);
        const minY2 = Math.min(line.y1, line.y2);
        const maxY2 = Math.max(line.y1, line.y2);
        const isH2 = (line.y1 === line.y2);

        let intersectsOrTouches = false;
        let touchX = -1;
        let touchY = -1;

        if (isH1 && isH2) {
          if (y1 === line.y1) {
            const overlapStart = Math.max(minX1, minX2);
            const overlapEnd = Math.min(maxX1, maxX2);
            if (overlapStart <= overlapEnd) {
              intersectsOrTouches = true;
              touchX = overlapStart;
              touchY = y1;
            }
          }
        } else if (!isH1 && !isH2) {
          if (x1 === line.x1) {
            const overlapStart = Math.max(minY1, minY2);
            const overlapEnd = Math.min(maxY1, maxY2);
            if (overlapStart <= overlapEnd) {
              intersectsOrTouches = true;
              touchX = x1;
              touchY = overlapStart;
            }
          }
        } else {
          const hY = isH1 ? y1 : line.y1;
          const hMinX = isH1 ? minX1 : minX2;
          const hMaxX = isH1 ? maxX1 : maxX2;

          const vX = isH1 ? line.x1 : x1;
          const vMinY = isH1 ? minY2 : minY1;
          const vMaxY = isH1 ? maxY2 : maxY1;

          if (vX >= hMinX && vX <= hMaxX && hY >= vMinY && hY <= vMaxY) {
            intersectsOrTouches = true;
            touchX = vX;
            touchY = hY;
          }
        }

        if (intersectsOrTouches) {
          const isStartTouchOnly = (touchX === x1 && touchY === y1);
          if (!isStartTouchOnly) {
            return true;
          }
          if (isH1 && isH2 && y1 === line.y1) {
            const overlapStart = Math.max(minX1, minX2);
            const overlapEnd = Math.min(maxX1, maxX2);
            if (overlapEnd - overlapStart > 1) {
              return true;
            }
          }
          if (!isH1 && !isH2 && x1 === line.x1) {
            const overlapStart = Math.max(minY1, minY2);
            const overlapEnd = Math.min(maxY1, maxY2);
            if (overlapEnd - overlapStart > 1) {
              return true;
            }
          }
        }
      }

      // 3. Prossimità degli endpoint dei rami (aumentato il minimo)
      const minDistance = 50;
      for (const line of placedLines) {
        const dStart = Math.hypot(x2 - line.x1, y2 - line.y1);
        if (dStart < minDistance && !(x2 === line.x1 && y2 === line.y1)) {
          return true;
        }
        const dEnd = Math.hypot(x2 - line.x2, y2 - line.y2);
        if (dEnd < minDistance && !(x2 === line.x2 && y2 === line.y2)) {
          return true;
        }
      }

      return false;
    };

    // Algoritmo ricorsivo per posizionare i nodi in modo ortogonale perpendicolare
    const layoutNode = (
      node: MapNode, 
      parentStartX: number, 
      parentStartY: number, 
      parentEndX: number, 
      parentEndY: number, 
      parentDir: 'H' | 'V', 
      childIndex: number,
      intendedDir: 'H' | 'V'
    ): void => {
      const visualLen = getVisualLength(node.length);
      const startX = parentEndX;
      const startY = parentEndY;

      let dir = intendedDir;

      let endX = startX;
      let endY = startY;

      let collision = true;
      let attempts = 0;
      const offsets = [0, 45, -45, 90, -90, 135, -135, 180, -180];

      const dz = Number(node.dislivelloGeodetico) || 0;
      const deltaY_quota = -dz * 8; // 8px per metro di dislivello reale

      while (collision && attempts < offsets.length) {
        const candidateLen = visualLen + offsets[attempts];
        if (candidateLen < 15) {
          attempts++;
          continue;
        }

        let tempEndX = startX;
        let tempEndY = startY;

        if (dir === 'H') {
          if (parentDir === 'V') {
            tempEndX = startX + candidateLen;
          } else {
            const sgnX = parentEndX - parentStartX < 0 ? -1 : 1;
            tempEndX = startX + sgnX * candidateLen;
          }
        } else {
          if (parentDir === 'H') {
            if (childIndex % 2 === 1) {
              tempEndY = startY - candidateLen;
            } else {
              tempEndY = startY + candidateLen;
            }
          } else {
            const sgnY = parentEndY - parentStartY < 0 ? -1 : 1;
            tempEndY = startY + sgnY * candidateLen;
          }
        }

        tempEndY += deltaY_quota;

        if (!checkCollision(startX, startY, tempEndX, tempEndY, lines)) {
          collision = false;
          endX = tempEndX;
          endY = tempEndY;
        } else {
          attempts++;
        }
      }

      if (collision) {
        if (dir === 'H') {
          if (parentDir === 'V') {
            endX = startX + visualLen;
          } else {
            const sgnX = parentEndX - parentStartX < 0 ? -1 : 1;
            endX = startX + sgnX * visualLen;
          }
        } else {
          if (parentDir === 'H') {
            if (childIndex % 2 === 1) {
              endY = startY - visualLen;
            } else {
              endY = startY + visualLen;
            }
          } else {
            const sgnY = parentEndY - parentStartY < 0 ? -1 : 1;
            endY = startY + sgnY * visualLen;
          }
        }
        endY += deltaY_quota;
      }

      // Spessore e colore del tratto
      let lineThickness = 4;
      let lineColor = "#3b82f6";
      const isAsp = node.tipoCondotto === 'aspirazione';

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

      const pNodo = node.pressioneNodo;
      const pMin = Number(node.pressioneMinimaRichiesta) || 0;
      const hasAlarm = pNodo !== undefined && pNodo < pMin;

      // Calcolo dell'angolo e dei vettori per il posizionamento ortogonale ed evitamento delle collisioni delle etichette
      const dx_val = endX - startX;
      const dy_val = endY - startY;
      const angle = Math.atan2(dy_val, dx_val);

      // Classifica l'angolo della condotta per distribuire i testi ed evitare sovrapposizioni reciproche
      // angle è in radianti (da -PI a PI)
      let labelFraction = 0.5;
      let dzFraction = 0.5;

      if (angle < -0.2 && angle > -1.3) {
        // Linea inclinata verso l'alto (es. BC): sposta l'etichetta verso l'inizio, il dz verso la fine
        labelFraction = 0.33;
        dzFraction = 0.67;
      } else if (angle > 0.2 && angle < 1.3) {
        // Linea inclinata verso il basso (es. CD): sposta l'etichetta verso la fine, il dz verso l'inizio
        labelFraction = 0.67;
        dzFraction = 0.33;
      } else if (Math.abs(angle) >= 1.3) {
        // Linea quasi verticale (es. CF): posiziona l'etichetta in basso (75%) e la quota geodetica in alto (25%) per evitare le diagonali in alto
        labelFraction = 0.75;
        dzFraction = 0.25;
      }

      const midX_label = startX + dx_val * labelFraction;
      const midY_label = startY + dy_val * labelFraction;

      const midX_dz = startX + dx_val * dzFraction;
      const midY_dz = startY + dy_val * dzFraction;

      // Vettore perpendicolare unitario (punta a sinistra/sopra rispetto alla direzione della linea)
      const px = -Math.sin(angle);
      const py = Math.cos(angle);

      // Shifta l'etichetta del tratto perpendicolarmente per non sovrapporsi al tubo (sopra/destra)
      const offsetDist = 13;
      const textX = midX_label - px * offsetDist;
      const textY = midY_label - py * offsetDist;

      // textAnchor intelligente basato sull'orientamento di -px
      let textAnchor: "end" | "inherit" | "start" | "middle" = 'middle';
      if (-px < -0.3) textAnchor = 'end';
      else if (-px > 0.3) textAnchor = 'start';

      // Shifta la quota geodetica nella direzione opposta (sotto/sinistra)
      const dzX = midX_dz + px * offsetDist;
      const dzY = midY_dz + py * offsetDist;
      let dzAnchor: "end" | "inherit" | "start" | "middle" = 'middle';
      if (px < -0.3) dzAnchor = 'end';
      else if (px > 0.3) dzAnchor = 'start';

      // Aggiungiamo la linea reale del tratto di tubo
      lines.push({
        x1: startX,
        y1: startY,
        x2: endX,
        y2: endY,
        thickness: lineThickness,
        color: lineColor,
        tag: node.tag,
        name: node.name,
        velocity: node.velocity,
        loss: node.loss_tot_mbar,
        length: node.length,
        dir,
        dislivello: dz !== 0 ? dz : undefined,
        pressioneNodo: pNodo,
        pressioneMin: pMin,
        hasAlarm,
        tipoCondotto: node.tipoCondotto || 'mandata',
        dzX: dz !== 0 ? dzX : undefined,
        dzY: dz !== 0 ? dzY : undefined,
        dzAnchor: dz !== 0 ? dzAnchor : undefined,
        pressioneInizioTratto: node.pressioneInizioTratto,
      });

      // Label principale: TAG + lunghezza
      labels.push({
        x: textX,
        y: textY,
        text: `${node.tag} (${Number(node.length).toFixed(0)}m)`,
        title: `${node.name}\nv = ${node.velocity?.toFixed(2)} m/s\n∆P = ${node.loss_tot_mbar?.toFixed(1)} mbar\n∆z = ${dz >= 0 ? '+' : ''}${dz} m\nP_nodo = ${pNodo !== undefined ? pNodo.toFixed(3) : '—'} barg`,
        dir,
        anchor: textAnchor
      });

      // Ricorsione sui figli
      const sortedChildren = [...node.children].sort((a, b) => a.tag.localeCompare(b.tag));
      
      let hasStraight = false;
      let vCount = 0;

      sortedChildren.forEach((child) => {
        const desiredDir: 'H' | 'V' = child.hierarchy === node.hierarchy ? dir : (dir === 'H' ? 'V' : 'H');
        
        let actualDir = desiredDir;
        if (desiredDir === dir) {
          if (!hasStraight) {
            hasStraight = true;
          } else {
            actualDir = dir === 'H' ? 'V' : 'H';
          }
        }

        let childIndex = 0;
        if (actualDir === 'V') {
          childIndex = vCount;
          vCount++;
        }

        layoutNode(child, startX, startY, endX, endY, dir, childIndex, actualDir);
      });
    };

    // Inizializziamo le radici
    roots.forEach((root, idx) => {
      layoutNode(root, 40, 80 + idx * 200, 40, 80 + idx * 200, 'H', 0, 'H');
    });

    // TROVIAMO I LIMITI ED APPLICHIAMO LO SHIFT
    let minX = 40;
    let maxX = 40;
    let minY = 40;
    let maxY = 40;

    lines.forEach(l => {
      minX = Math.min(minX, l.x1, l.x2);
      maxX = Math.max(maxX, l.x1, l.x2);
      minY = Math.min(minY, l.y1, l.y2);
      maxY = Math.max(maxY, l.y1, l.y2);
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
                <text x={l.x1} y={l.y1 - 12} textAnchor="middle" fill="#1e293b" fontSize="8" fontWeight="bold">
                  {Number(pressionePartenza).toFixed(2)} barg
                </text>
                <text x={l.x1} y={l.y1 - 3} textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">P₀</text>
              </g>
            ));
          })()}

          {/* Disegnamo i tratti reali di fluido ortogonali */}
          {lines.map((l) => {
            const isActive = activeTag === l.tag;
            const dz = Number(l.dislivello) || 0;
            const dzLabel = dz !== 0 ? (dz > 0 ? `↑${dz}m` : `↓${Math.abs(dz)}m`) : null;

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
                  {`${l.name}\nLunghezza: ${l.length} m\nVelocità: ${l.velocity?.toFixed(2)} m/s\nPerdita: ${l.loss?.toFixed(1)} mbar\n∆z: ${dz >= 0 ? '+' : ''}${dz} m\nP_nodo: ${l.pressioneNodo !== undefined ? l.pressioneNodo.toFixed(3) : '—'} barg`}
                </title>
                {/* Linea di hover/attiva */}
                <line 
                  x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                  stroke={isActive ? "rgba(34, 197, 94, 0.3)" : "rgba(59, 130, 246, 0.08)"}
                  strokeWidth={l.thickness + 8}
                  className={`topo-highlight-line ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity"}`}
                />
                {/* Linea reale */}
                <line 
                  x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                  stroke={isActive ? "#22c55e" : l.color}
                  strokeWidth={isActive ? l.thickness + 1 : l.thickness}
                  strokeLinecap="round"
                  markerEnd={l.thickness <= 2 ? "url(#arrow)" : undefined}
                  className={`transition-colors group-hover:stroke-green-500 ${
                    l.color === "#1d4ed8" ? "topo-line-dorsale-principale" :
                    l.color === "#0ea5e9" ? "topo-line-dorsale-secondaria" :
                    l.color === "#10b981" ? "topo-line-dorsale-terziaria" : "topo-line-utenza"
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
                        ⚠ P&lt;min
                      </text>
                      <text
                        x={alarmX}
                        y={alarmY}
                        textAnchor={anchor}
                        fill="#ef4444"
                        fontSize="7.5"
                        fontWeight="bold"
                      >
                        ⚠ P&lt;min
                      </text>
                    </g>
                  );
                })()}

                {/* Etichetta pressione al nodo di arrivo con outline e spostata per non sovrapporsi */}
                {l.pressioneNodo !== undefined && (() => {
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
                        {l.pressioneNodo.toFixed(2)} barg
                      </text>
                      <text
                        x={labelX}
                        y={labelY}
                        textAnchor={anchor}
                        fill={l.hasAlarm ? "#ef4444" : "#475569"}
                        fontSize="7.5"
                        fontWeight="600"
                      >
                        {l.pressioneNodo.toFixed(2)} barg
                      </text>
                    </g>
                  );
                })()}
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
                      {pStart.toFixed(2)} barg
                    </text>
                    <text 
                      x={labelX} 
                      y={labelY} 
                      textAnchor="middle" 
                      fill="#1d4ed8" 
                      fontSize="7.5" 
                      fontWeight="bold"
                    >
                      {pStart.toFixed(2)} barg
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Testi informativi */}
          {labels.map((lbl, index) => (
            <g key={`lbl-${index}`} className="pointer-events-none">
              {/* Outline per leggibilità */}
              <text 
                x={lbl.x} y={lbl.y} 
                textAnchor={lbl.anchor || (lbl.dir === 'H' ? "middle" : "start")} 
                fill="white" 
                stroke="white"
                strokeWidth="2.5"
                strokeLinejoin="round"
                fontSize="9" 
                fontWeight="bold" 
                className="font-semibold"
              >
                {lbl.text}
              </text>
              {/* Testo reale */}
              <text 
                x={lbl.x} y={lbl.y} 
                textAnchor={lbl.anchor || (lbl.dir === 'H' ? "middle" : "start")} 
                fill="#334155" 
                fontSize="9" 
                fontWeight="bold" 
                className="font-semibold"
              >
                {lbl.text}
              </text>
            </g>
          ))}
        </svg>
      <div className="flex flex-wrap gap-4 justify-center mt-3 text-[10px] text-slate-400 print:hidden">
        <div className="flex items-center gap-1.5"><span className="inline-block w-4 h-1.5 bg-[#1d4ed8]"></span> Dorsale Principale (Mandata)</div>
        <div className="flex items-center gap-1.5"><span className="inline-block w-4 h-1.5 bg-[#ea580c]"></span> Dorsale Principale (Aspirazione)</div>
        <div className="flex items-center gap-1.5"><span className="inline-block w-4 h-1 bg-[#0ea5e9]"></span> Dorsale Secondaria (Mandata)</div>
        <div className="flex items-center gap-1.5"><span className="inline-block w-4 h-1 bg-[#f97316]"></span> Dorsale Secondaria (Aspirazione)</div>
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-white border border-[#1e293b] font-bold text-[9px] inline-flex items-center justify-center leading-none">P</span> Pompa</div>
        <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-red-400 border-2 border-red-500"></span> Pressione &lt; Minima</div>
        <div className="flex items-center gap-1.5"><span className="text-orange-500 font-bold">↑</span><span className="text-cyan-600 font-bold">↓</span> Dislivello (m)</div>
      </div>
    </div>
  );
}
