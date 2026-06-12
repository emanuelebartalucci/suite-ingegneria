import React, { useMemo } from 'react';

export default function TopologicalTree({ tratti }) {
  const svgData = useMemo(() => {
    if (!tratti || tratti.length === 0) return null;

    // 1. Costruiamo una mappa dei tratti indicizzata per il TAG
    const trattiMap = {};
    tratti.forEach(t => {
      trattiMap[t.tag] = { ...t, children: [] };
    });

    // 2. Colleghiamo i figli ai genitori
    const roots = [];
    tratti.forEach(t => {
      const parentTag = t.parentId;
      if (parentTag && trattiMap[parentTag]) {
        trattiMap[parentTag].children.push(trattiMap[t.tag]);
      } else {
        roots.push(trattiMap[t.tag]);
      }
    });

    // Scala compressa per le lunghezze grafiche
    const getVisualLength = (l) => {
      const len = Number(l) || 0;
      return 45 + Math.sqrt(len) * 15;
    };

    const lines = [];
    const labels = [];

    // Algoritmo ricorsivo per posizionare i nodi in modo ortogonale perpendicolare
    const layoutNode = (node, parentStartX, parentStartY, parentEndX, parentEndY, parentDir, childIndex) => {
      const visualLen = getVisualLength(node.length);
      const startX = parentEndX;
      const startY = parentEndY;

      // Determiniamo la direzione del tratto corrente:
      // - principale -> H (Orizzontale)
      // - secondaria -> V (Verticale)
      // - terziaria -> H (Orizzontale)
      // - utenza -> V (Verticale)
      let dir = 'H';
      if (node.hierarchy === 'dorsale_principale') {
        dir = 'H';
      } else if (node.hierarchy === 'dorsale_secondaria') {
        dir = 'V';
      } else if (node.hierarchy === 'dorsale_terziaria') {
        dir = 'H';
      } else {
        dir = 'V'; // utenza o altri rami terminali
      }

      let endX = startX;
      let endY = startY;

      if (dir === 'H') {
        // Se il genitore era verticale, i figli orizzontali si sdoppiano a sinistra e destra
        if (parentDir === 'V') {
          if (childIndex % 2 === 0) {
            endX = startX - visualLen; // Sinistra
          } else {
            endX = startX + visualLen; // Destra
          }
        } else {
          endX = startX + visualLen; // Destra default
        }
      } else {
        // Se il genitore era orizzontale, i figli verticali si alternano in basso e in alto (default in basso)
        if (parentDir === 'H') {
          if (childIndex % 2 === 0) {
            endY = startY + visualLen; // Basso
          } else {
            endY = startY - visualLen; // Alto
          }
        } else {
          endY = startY + visualLen; // Basso default
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
        lineColor = "#2563eb"; // Blu
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
      
      // Contatori per distribuire i figli orizzontali e verticali separatamente
      let hCount = 0;
      let vCount = 0;

      sortedChildren.forEach(child => {
        let childDir = 'H';
        if (child.hierarchy === 'dorsale_secondaria' || child.hierarchy === 'utenza') {
          childDir = 'V';
        }

        if (childDir === 'H') {
          layoutNode(child, startX, startY, endX, endY, dir, hCount);
          hCount++;
        } else {
          layoutNode(child, startX, startY, endX, endY, dir, vCount);
          vCount++;
        }
      });
    };

    // Inizializziamo le radici. Se ci sono più radici, le separiamo in verticale.
    roots.forEach((root, idx) => {
      layoutNode(root, 40, 80 + idx * 200, 40, 80 + idx * 200, 'H', 0);
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
      <div style={{ width: '100%', minWidth: `${totalWidth}px` }} className="mx-auto print:!min-w-0">
        <svg 
          width="100%" 
          height={totalHeight} 
          viewBox={`0 0 ${totalWidth} ${totalHeight}`} 
          className="select-none font-sans print:h-auto print:max-h-[165px] print:w-auto print:mx-auto"
        >
          {/* Definiamo i marker per le frecce terminali dei rami sottili */}
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
            </marker>
          </defs>

          {/* Disegnamo i tratti reali di fluido ortogonali */}
          {lines.map((l) => (
            <g key={l.tag} className="group cursor-pointer">
              <title>
                {`${l.name}\nLunghezza: ${l.length} m\nVelocità: ${l.velocity?.toFixed(2)} m/s\nPerdita: ${l.loss?.toFixed(1)} mbar`}
              </title>
              {/* Linea di hover allargata per feedback utente */}
              <line 
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke="rgba(59, 130, 246, 0.08)"
                strokeWidth={l.thickness + 6}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              />
              {/* Linea reale del tratto */}
              <line 
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke={l.color}
                strokeWidth={l.thickness}
                strokeLinecap="round"
                markerEnd={l.thickness <= 2 ? "url(#arrow)" : undefined}
                className="transition-colors group-hover:stroke-orange-500"
              />
              {/* Nodo di giunzione all'inizio di ciascun tratto */}
              <circle 
                cx={l.x1} 
                cy={l.y1} 
                r={l.thickness > 3 ? "4.5" : "3"} 
                fill="#cbd5e1" 
                stroke="#475569" 
                strokeWidth="1.5"
              />
            </g>
          ))}

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
        <div className="flex items-center gap-1.5"><span className="inline-block w-4 h-1.5 bg-[#1d4ed8]"></span> Dorsale Principale (H)</div>
        <div className="flex items-center gap-1.5"><span className="inline-block w-4 h-1 bg-[#2563eb]"></span> Dorsale Secondaria (V)</div>
        <div className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5 bg-[#10b981]"></span> Dorsale Terziaria (H)</div>
        <div className="flex items-center gap-1.5"><span className="inline-block w-4 h-px bg-[#64748b]"></span> Utenza / Terminale (V)</div>
      </div>
    </div>
  );
}
