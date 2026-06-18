import React, { useMemo } from 'react';

export interface TrattoNode {
  tag: string;
  parentId: string | null;
  hierarchy: string;
  length: number | string;
  name: string;
  velocity?: number;
  loss_tot_mbar?: number;
  children?: TrattoNode[];
}

interface TopologicalTreeProps {
  tratti: TrattoNode[];
  activeTag?: string;
  onSelectTag?: (tag: string) => void;
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
}

interface VisualLabel {
  x: number;
  y: number;
  text: string;
  title: string;
  dir: 'H' | 'V';
}

export default function TopologicalTree({ tratti, activeTag, onSelectTag }: TopologicalTreeProps) {
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

    // Scala compressa per le lunghezze grafiche
    const getVisualLength = (l: number | string): number => {
      const len = Number(l) || 0;
      return 45 + Math.sqrt(len) * 15;
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

      // 3. Prossimità degli endpoint dei rami
      const minDistance = 28;
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
      const offsets = [0, 25, -25, 50, -50, 75, -75, 100, -100];

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
            // Lo schema deve andare sempre verso destra (+x), mai a sinistra
            tempEndX = startX + candidateLen;
          } else {
            const sgnX = parentEndX - parentStartX < 0 ? -1 : 1;
            tempEndX = startX + sgnX * candidateLen;
          }
        } else {
          if (parentDir === 'H') {
            if (childIndex % 2 === 1) {
              tempEndY = startY - candidateLen; // Alternando, va verso l'alto (dispari)
            } else {
              tempEndY = startY + candidateLen; // Di default, va verso il basso (pari/singolo)
            }
          } else {
            const sgnY = parentEndY - parentStartY < 0 ? -1 : 1;
            tempEndY = startY + sgnY * candidateLen;
          }
        }

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
            // Lo schema deve andare sempre verso destra (+x), mai a sinistra
            endX = startX + visualLen;
          } else {
            const sgnX = parentEndX - parentStartX < 0 ? -1 : 1;
            endX = startX + sgnX * visualLen;
          }
        } else {
          if (parentDir === 'H') {
            if (childIndex % 2 === 1) {
              endY = startY - visualLen; // Alternando, va verso l'alto (dispari)
            } else {
              endY = startY + visualLen; // Di default, va verso il basso (pari/singolo)
            }
          } else {
            const sgnY = parentEndY - parentStartY < 0 ? -1 : 1;
            endY = startY + sgnY * visualLen;
          }
        }
      }

      // Spessore e colore del tratto
      let lineThickness = 4;
      let lineColor = "#3b82f6";
      if (node.hierarchy === 'dorsale_principale') {
        lineThickness = 5;
        lineColor = "#1d4ed8"; // Blu scuro
      } else if (node.hierarchy === 'dorsale_secondaria') {
        lineThickness = 3.5;
        lineColor = "#0ea5e9"; // Celeste / Azzurro chiaro
      } else if (node.hierarchy === 'dorsale_terziaria') {
        lineThickness = 2.5;
        lineColor = "#10b981"; // Smeraldo
      } else {
        lineThickness = 1.5;
        lineColor = "#64748b"; // Ardesia per utenze
      }

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
        dir
      });

      // Posizioniamo l'etichetta di testo a metà del tratto, leggermente sfalsata
      let textX = (startX + endX) / 2;
      let textY = (startY + endY) / 2;
      if (dir === 'H') {
        textY -= 6; // Sopra
      } else {
        textX += 8; // A destra
      }

      labels.push({
        x: textX,
        y: textY,
        text: `${node.tag} (${Number(node.length).toFixed(0)}m)`,
        title: `${node.name}\nv = ${node.velocity?.toFixed(2)} m/s\n∆P = ${node.loss_tot_mbar?.toFixed(1)} mbar`,
        dir
      });

      // Ricorsione sui figli
      const sortedChildren = [...node.children].sort((a, b) => a.tag.localeCompare(b.tag));
      
      let hasStraight = false;
      let vCount = 0;

      sortedChildren.forEach((child) => {
        // Se la gerarchia del figlio è identica a quella del genitore prosegue dritto (stessa direzione 'dir'),
        // altrimenti svolta di 90 gradi.
        const desiredDir: 'H' | 'V' = child.hierarchy === node.hierarchy ? dir : (dir === 'H' ? 'V' : 'H');
        
        let actualDir = desiredDir;
        if (desiredDir === dir) {
          if (!hasStraight) {
            hasStraight = true;
          } else {
            // Se c'è già un ramo che prosegue dritto, forziamo questo a svoltare per evitare sovrapposizioni
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

    // Inizializziamo le radici. Se ci sono più radici, le separiamo in verticale.
    roots.forEach((root, idx) => {
      layoutNode(root, 40, 80 + idx * 200, 40, 80 + idx * 200, 'H', 0, 'H');
    });

    // 5. TROVIAMO I LIMITI ED APPLICHIAMO LO SHIFT PER EVITARE COORDINATE NEGATIVE
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

    // Calcoliamo lo slittamento per posizionare tutto correttamente nell'area visibile
    const padding = 40;
    const shiftX = minX < padding ? (padding - minX) : 0;
    const shiftY = minY < padding ? (padding - minY) : 0;

    lines.forEach(l => {
      l.x1 += shiftX;
      l.x2 += shiftX;
      l.y1 += shiftY;
      l.y2 += shiftY;
    });

    labels.forEach(lbl => {
      lbl.x += shiftX;
      lbl.y += shiftY;
    });

    const totalWidth = maxX - minX + 2 * padding;
    const totalHeight = maxY - minY + 2 * padding;

    return { lines, labels, totalWidth, totalHeight };
  }, [tratti]);

  if (!tratti || tratti.length === 0) {
    return (
      <div className="py-8 text-center text-slate-400 text-xs italic">
        Nessun tratto presente. Aggiungi i tratti per visualizzare lo schema topologico perpendicolare.
      </div>
    );
  }

  const { lines, labels, totalWidth, totalHeight } = svgData || { lines: [], labels: [], totalWidth: 600, totalHeight: 150 };

  return (
    <div className="w-full overflow-x-auto bg-slate-50 border border-slate-200 rounded-xl p-4 print:bg-white print:border-none print:p-0">
      <div style={{ width: '100%', minWidth: `${totalWidth}px` }} className="mx-auto print:!min-w-0 print:!w-full print:flex print:justify-center">
        <svg 
          width={totalWidth} 
          height={totalHeight} 
          viewBox={`0 0 ${totalWidth} ${totalHeight}`} 
          style={{ maxWidth: '100%', height: 'auto' }}
          className="select-none font-sans print:max-h-[250px] print:mx-auto"
        >
          {/* Definiamo i marker per le frecce terminali dei rami sottili */}
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
            </marker>
          </defs>

          {/* Disegnamo i tratti reali di fluido ortogonali */}
          {lines.map((l) => {
            const isActive = activeTag === l.tag;
            return (
              <g 
                key={l.tag} 
                className="group cursor-pointer"
                onClick={() => onSelectTag?.(l.tag)}
              >
                <title>
                  {`${l.name}\nLunghezza: ${l.length} m\nVelocità: ${l.velocity?.toFixed(2)} m/s\nPerdita: ${l.loss?.toFixed(1)} mbar`}
                </title>
                {/* Linea di hover/attiva allargata per feedback utente */}
                <line 
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke={isActive ? "rgba(249, 115, 22, 0.25)" : "rgba(59, 130, 246, 0.08)"}
                  strokeWidth={l.thickness + 8}
                  className={isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity"}
                />
                {/* Linea reale del tratto */}
                <line 
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke={isActive ? "#f97316" : l.color}
                  strokeWidth={isActive ? l.thickness + 1 : l.thickness}
                  strokeLinecap="round"
                  markerEnd={l.thickness <= 2 ? "url(#arrow)" : undefined}
                  className="transition-colors group-hover:stroke-orange-500"
                />
                {/* Nodo di giunzione all'inizio di ciascun tratto */}
                <circle 
                  cx={l.x1} 
                  cy={l.y1} 
                  r={isActive ? "5.5" : (l.thickness > 3 ? "4.5" : "3")} 
                  fill={isActive ? "#ffedd5" : "#cbd5e1"} 
                  stroke={isActive ? "#f97316" : "#475569"} 
                  strokeWidth="1.5"
                />
              </g>
            );
          })}

          {/* Disegniamo i testi informativi sopra o a lato delle linee */}
          {labels.map((lbl, index) => (
            <g key={`lbl-${index}`} className="pointer-events-none">
              <text 
                x={lbl.x} 
                y={lbl.y} 
                textAnchor={lbl.dir === 'H' ? "middle" : "start"} 
                fill="#334155" 
                fontSize="9" 
                fontWeight="bold" 
                className="bg-white/95 filter drop-shadow-sm font-semibold"
              >
                {lbl.text}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="flex gap-4 justify-center mt-3 text-[10px] text-slate-400 print:hidden">
        <div className="flex items-center gap-1.5"><span className="inline-block w-4 h-1.5 bg-[#1d4ed8]"></span> Dorsale Principale</div>
        <div className="flex items-center gap-1.5"><span className="inline-block w-4 h-1 bg-[#0ea5e9]"></span> Dorsale Secondaria</div>
        <div className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5 bg-[#10b981]"></span> Dorsale Terziaria</div>
        <div className="flex items-center gap-1.5"><span className="inline-block w-4 h-px bg-[#64748b]"></span> Tratto Terminale / Utenza</div>
      </div>
    </div>
  );
}
