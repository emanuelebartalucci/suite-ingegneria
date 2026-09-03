import React, { useMemo } from 'react';
import { formatNumber } from '../utils/format';

export interface AeraulicTreeNode {
  id: string;
  name: string;
  type: 'source' | 'junction';
  flow_m3h: number;
  v_ms: number;
  dp_Pa: number;
  D_mm: number | string;
  L_m: number | string;
  confluisceInId: string;
  isCritical: boolean;
}

export interface AeraulicSpecialNode {
  id: string;
  name: string;
  type: string;
  dp_Pa: number;
  position: 'general' | 'segment';
  segmentId: string;
}

export interface AeraulicTopologicalTreeProps {
  segments: AeraulicTreeNode[];
  specials?: AeraulicSpecialNode[];
  totalFlow_m3h: number;
  dp_tot_ventilatore: number;
  selectedSegmentId?: string | null;
  onSelectSegment?: (id: string) => void;
  fanPower_kW?: number;
  className?: string;
}

export const AeraulicTopologicalTree: React.FC<AeraulicTopologicalTreeProps> = ({
  segments,
  specials = [],
  totalFlow_m3h,
  dp_tot_ventilatore,
  selectedSegmentId,
  onSelectSegment,
  fanPower_kW,
  className = '',
}) => {
  // Layout ortogonale con un'unica freccia per confluenza
  const layout = useMemo(() => {
    if (!segments || segments.length === 0) {
      return { branchLines: [], busPipes: [], junctionNodes: [], entryPipes: [], nodes: [], specialBlocks: [], fanBlock: null, chimney: null, width: 800, height: 260 };
    }

    // 1. Calcolo del rank topologico di ciascun tratto (colonna orizzontale)
    const rankMap = new Map<string, number>();

    function getRank(id: string, visited = new Set<string>()): number {
      if (rankMap.has(id)) return rankMap.get(id)!;
      if (visited.has(id)) return 0;
      visited.add(id);

      const incoming = segments.filter(s => s.confluisceInId === id);
      if (incoming.length === 0) {
        rankMap.set(id, 0);
        return 0;
      }

      let maxInRank = 0;
      for (const inc of incoming) {
        maxInRank = Math.max(maxInRank, getRank(inc.id, new Set(visited)) + 1);
      }
      rankMap.set(id, maxInRank);
      return maxInRank;
    }

    segments.forEach(s => getRank(s.id));

    // Raggruppa i tratti per colonna (rank)
    const columns = new Map<number, AeraulicTreeNode[]>();
    segments.forEach(s => {
      const r = rankMap.get(s.id) || 0;
      if (!columns.has(r)) columns.set(r, []);
      columns.get(r)!.push(s);
    });

    const maxRank = Math.max(0, ...Array.from(rankMap.values()));

    // 2. Dimensioni Card e Griglia
    const CARD_W = 175;
    const CARD_H = 62;
    const ROW_GAP = 24;
    const COL_GAP = 100;
    const PADDING_LEFT = 35;
    const PADDING_TOP = 35;

    let maxRows = 0;
    columns.forEach(col => {
      maxRows = Math.max(maxRows, col.length);
    });

    const contentHeight = Math.max(maxRows * (CARD_H + ROW_GAP), 220);

    // Mappa posizioni nodi
    interface NodePos {
      id: string;
      seg: AeraulicTreeNode;
      x: number;
      y: number;
      w: number;
      h: number;
      outX: number;
      outY: number;
      inX: number;
      inY: number;
      rank: number;
    }

    const nodeMap = new Map<string, NodePos>();

    for (let r = 0; r <= maxRank; r++) {
      const colNodes = columns.get(r) || [];
      const colX = PADDING_LEFT + r * (CARD_W + COL_GAP);
      const colH = colNodes.length * CARD_H + Math.max(0, colNodes.length - 1) * ROW_GAP;
      const startY = PADDING_TOP + (contentHeight - colH) / 2;

      colNodes.forEach((seg, idx) => {
        const y = startY + idx * (CARD_H + ROW_GAP);
        nodeMap.set(seg.id, {
          id: seg.id,
          seg,
          x: colX,
          y,
          w: CARD_W,
          h: CARD_H,
          outX: colX + CARD_W,
          outY: y + CARD_H / 2,
          inX: colX,
          inY: y + CARD_H / 2,
          rank: r,
        });
      });
    }

    // 3. Posizionamento Blocchi di Trattamento e Ventilatore
    const centerY = PADDING_TOP + contentHeight / 2;
    let nextX = PADDING_LEFT + (maxRank + 1) * (CARD_W + COL_GAP);

    interface SpecialBlock {
      id: string;
      name: string;
      type: string;
      dp_Pa: number;
      x: number;
      y: number;
      w: number;
      h: number;
      inX: number;
      inY: number;
      outX: number;
      outY: number;
    }

    const specialBlocks: SpecialBlock[] = [];
    const generalSpecials = specials.filter(s => s.position === 'general');

    generalSpecials.forEach(sp => {
      const w = 120;
      const h = 62;
      const x = nextX;
      const y = centerY - h / 2;
      specialBlocks.push({
        id: sp.id,
        name: sp.name || sp.type,
        type: sp.type,
        dp_Pa: sp.dp_Pa,
        x,
        y,
        w,
        h,
        inX: x,
        inY: centerY,
        outX: x + w,
        outY: centerY,
      });
      nextX += w + 40;
    });

    // Blocco Ventilatore Industriale (V1)
    const fanW = 175;
    const fanH = 82;
    const fanX = nextX;
    const fanY = centerY - fanH / 2;
    const fanBlock = {
      x: fanX,
      y: fanY,
      w: fanW,
      h: fanH,
      inX: fanX,
      inY: centerY,
      outX: fanX + fanW,
      outY: centerY,
      totalFlow_m3h,
      dp_tot_ventilatore,
      fanPower_kW,
    };

    // 4. COSTRUZIONE CONFLUENZE A SINGOLA FRECCIA CON NODO IN EVIDENZA
    const targetGroups = new Map<string, NodePos[]>();

    segments.forEach(s => {
      const node = nodeMap.get(s.id);
      if (!node) return;

      const targetKey = s.confluisceInId ? s.confluisceInId : 'FINAL';
      if (!targetGroups.has(targetKey)) targetGroups.set(targetKey, []);
      targetGroups.get(targetKey)!.push(node);
    });

    interface BranchLine {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }

    interface BusPipe {
      busX: number;
      yMin: number;
      yMax: number;
    }

    interface JunctionNode {
      x: number;
      y: number;
      targetId: string;
    }

    interface EntryPipe {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }

    const branchLines: BranchLine[] = [];
    const busPipes: BusPipe[] = [];
    const junctionNodes: JunctionNode[] = [];
    const entryPipes: EntryPipe[] = [];

    targetGroups.forEach((sources, targetKey) => {
      let targetInX: number;
      let targetCenterY: number;

      if (targetKey === 'FINAL') {
        if (specialBlocks.length > 0) {
          targetInX = specialBlocks[0].inX;
          targetCenterY = specialBlocks[0].inY;
        } else {
          targetInX = fanBlock.inX;
          targetCenterY = fanBlock.inY;
        }
      } else {
        const targetNode = nodeMap.get(targetKey);
        if (!targetNode) return;
        targetInX = targetNode.inX;
        targetCenterY = targetNode.inY;
      }

      // X massima tra le uscite dei tratti sorgenti
      const maxSourceOutX = Math.max(...sources.map(s => s.outX));
      // Calcolo del bus di confluenza verticale a metà strada
      const busX = (maxSourceOutX + targetInX) / 2;

      // 1. Ciascun ramo esce in orizzontale alla propria quota fino al bus verticale
      sources.forEach(src => {
        branchLines.push({
          x1: src.outX,
          y1: src.outY,
          x2: busX,
          y2: src.outY,
        });
      });

      // 2. Pettine verticale se i rami arrivano da quote diverse da targetCenterY
      const allYs = [...sources.map(s => s.outY), targetCenterY];
      const yMin = Math.min(...allYs);
      const yMax = Math.max(...allYs);

      if (yMin !== yMax) {
        busPipes.push({
          busX,
          yMin,
          yMax,
        });
      }

      // 3. Nodo di confluenza centrale ben visibile (pallino sul punto d'unione)
      junctionNodes.push({
        x: busX,
        y: targetCenterY,
        targetId: targetKey,
      });

      // 4. UN'UNICA FRECCIA ORIZZONTALE che parte dal nodo di confluenza ed entra nel target
      entryPipes.push({
        x1: busX,
        y1: targetCenterY,
        x2: targetInX,
        y2: targetCenterY,
      });
    });

    // Connessioni orizzontali tra blocchi speciali e ventilatore
    for (let i = 0; i < specialBlocks.length; i++) {
      const curr = specialBlocks[i];
      const nextInX = i + 1 < specialBlocks.length ? specialBlocks[i + 1].inX : fanBlock.inX;
      const nextInY = i + 1 < specialBlocks.length ? specialBlocks[i + 1].inY : fanBlock.inY;

      entryPipes.push({
        x1: curr.outX,
        y1: curr.outY,
        x2: nextInX,
        y2: nextInY,
      });
    }

    const totalWidth = fanX + fanW + PADDING_LEFT + 25;
    const totalHeight = contentHeight + PADDING_TOP * 2;

    return {
      nodes: Array.from(nodeMap.values()),
      branchLines,
      busPipes,
      junctionNodes,
      entryPipes,
      specialBlocks,
      fanBlock,
      width: Math.max(totalWidth, 750),
      height: Math.max(totalHeight, 280),
    };
  }, [segments, specials, totalFlow_m3h, dp_tot_ventilatore, fanPower_kW]);

  if (!segments || segments.length === 0) {
    return (
      <div className="py-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
        <p className="text-xs">Nessun tratto presente per lo schema topologico.</p>
      </div>
    );
  }

  return (
    <div className={`w-full bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm print:bg-white print:border-none print:p-0 print:shadow-none ${className}`}>
      {/* Intestazione Legenda Ingegneristica Chiara con Colori Coordinati al 100% */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 text-xs text-slate-600 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-600"></span>
          <span className="font-bold uppercase tracking-wider text-[11px] text-slate-800">
            Schema Unifilare Aeraulico (Flusso da Monte a Valle)
          </span>
        </div>

        <div className="flex items-center gap-5 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1.5 bg-cyan-600 rounded-full"></span>
            <span className="text-slate-700 font-semibold">Linea Condotta / Flusso Aria</span>
          </div>
          {/* Nodo Confluenza perfettamente coordinato con i nodi dello schema */}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-600 border border-cyan-800"></span>
            <span className="text-slate-700 font-semibold">Nodo di Confluenza</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-indigo-100 border border-indigo-300"></span>
            <span className="text-slate-600 font-medium">Trattamento & Ventilatore</span>
          </div>
        </div>
      </div>

      {/* SVG Responsive: scala a piena larghezza SENZA scrollbar orizzontale */}
      <div className="w-full flex justify-center">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          style={{ width: '100%', height: 'auto' }}
          className="select-none font-sans overflow-visible"
        >
          <defs>
            {/* Unico marker freccia Cyan uniforme */}
            <marker
              id="p_arrow_cyan"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284c7" />
            </marker>
          </defs>

          {/* 1. Linee orizzontali dei singoli rami (alla loro altezza, verso il bus verticale) */}
          {layout.branchLines.map((l, idx) => (
            <line
              key={`branch-${idx}`}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke="#0284c7"
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}

          {/* 2. Pettini di Confluenza Verticali */}
          {layout.busPipes.map((bus, idx) => (
            <line
              key={`bus-${idx}`}
              x1={bus.busX}
              y1={bus.yMin}
              x2={bus.busX}
              y2={bus.yMax}
              stroke="#0284c7"
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}

          {/* 3. Nodi di Confluenza (Belli Grandi e Visibili su ogni unione) */}
          {layout.junctionNodes.map((jp, idx) => (
            <circle
              key={`junction-${idx}`}
              cx={jp.x}
              cy={jp.y}
              r="5"
              fill="#0284c7"
              stroke="#075985"
              strokeWidth="1.5"
            />
          ))}

          {/* 4. UN'UNICA FRECCIA ORIZZONTALE che parte dal nodo di confluenza verso il target */}
          {layout.entryPipes.map((p, idx) => (
            <line
              key={`entry-${idx}`}
              x1={p.x1}
              y1={p.y1}
              x2={p.x2}
              y2={p.y2}
              stroke="#0284c7"
              strokeWidth={2}
              strokeLinecap="round"
              markerEnd="url(#p_arrow_cyan)"
            />
          ))}

          {/* 5. Nodi dei Tratti Condotta (Card compatte e pulite) */}
          {layout.nodes.map(n => {
            const isSelected = selectedSegmentId === n.id;
            const isCrit = n.seg.isCritical;
            const isSource = n.seg.type === 'source';

            return (
              <g
                key={`node-${n.id}`}
                transform={`translate(${n.x}, ${n.y})`}
                onClick={() => onSelectSegment?.(n.id)}
                className="cursor-pointer transition-all"
              >
                {/* Sfondo Card */}
                <rect
                  width={n.w}
                  height={n.h}
                  rx="8"
                  ry="8"
                  fill="#ffffff"
                  stroke={isSelected ? '#0284c7' : isCrit ? '#f59e0b' : isSource ? '#cbd5e1' : '#818cf8'}
                  strokeWidth={isSelected ? 2.5 : isCrit ? 2 : 1.5}
                  filter="drop-shadow(0 2px 4px rgba(0,0,0,0.06))"
                />

                {/* Badge ID Tratto */}
                <rect
                  x="6"
                  y="6"
                  width="30"
                  height="16"
                  rx="4"
                  ry="4"
                  fill={isCrit ? '#ea580c' : isSource ? '#0284c7' : '#4f46e5'}
                />
                <text
                  x="21"
                  y="18"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="900"
                >
                  {n.id}
                </text>

                {/* Nome o Ruolo del Tratto */}
                <text
                  x="40"
                  y="18"
                  fill="#1e293b"
                  fontSize="10"
                  fontWeight="700"
                >
                  {n.seg.name
                    ? (n.seg.name.length > 13 ? `${n.seg.name.slice(0, 13)}…` : n.seg.name)
                    : (isSource ? 'Bocchetta' : 'Collettore')}
                </text>

                {/* Badge CRITICO (Solo scritta arancione sul box) */}
                {isCrit && (
                  <g transform={`translate(${n.w - 52}, 6)`}>
                    <rect width="46" height="15" rx="3" fill="#fef3c7" stroke="#f59e0b" strokeWidth="0.8" />
                    <text
                      x="23"
                      y="11"
                      textAnchor="middle"
                      fill="#b45309"
                      fontSize="7.5"
                      fontWeight="900"
                    >
                      CRITICO
                    </text>
                  </g>
                )}

                {/* Riga 2: Portata e Diametro */}
                <text x="8" y="36" fill="#64748b" fontSize="9">
                  Q: <tspan fill="#0f172a" fontWeight="700">{formatNumber(n.seg.flow_m3h, 0)}</tspan> m³/h
                  {n.seg.D_mm ? ` • Ø ${n.seg.D_mm}` : ''}
                </text>

                {/* Riga 3: Velocità aria e perdita ΔP */}
                <text x="8" y="50" fill="#64748b" fontSize="8.5">
                  v:{' '}
                  <tspan
                    fill={n.seg.v_ms >= 10 && n.seg.v_ms <= 18 ? '#16a34a' : n.seg.v_ms > 0 ? '#d97706' : '#94a3b8'}
                    fontWeight="700"
                  >
                    {formatNumber(n.seg.v_ms, 1)} m/s
                  </tspan>{' '}
                  • ΔP: {formatNumber(n.seg.dp_Pa, 0)} Pa
                </text>
              </g>
            );
          })}

          {/* 6. Blocchi Componenti Speciali (Separatore T1, Scrubber C1) */}
          {layout.specialBlocks.map(sp => (
            <g key={sp.id} transform={`translate(${sp.x}, ${sp.y})`}>
              <rect
                width={sp.w}
                height={sp.h}
                rx="8"
                ry="8"
                fill="#f8fafc"
                stroke="#6366f1"
                strokeWidth="1.5"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.06))"
              />
              <text x="10" y="18" fill="#4f46e5" fontSize="9" fontWeight="900">
                {sp.type.toUpperCase()}
              </text>
              <text x="10" y="34" fill="#1e293b" fontSize="10" fontWeight="700">
                {sp.name}
              </text>
              <text x="10" y="50" fill="#64748b" fontSize="8.5" fontWeight="600">
                ΔP: {formatNumber(sp.dp_Pa, 0)} Pa
              </text>
            </g>
          ))}

          {/* 7. Blocco Ventilatore Industriale (V1) */}
          {layout.fanBlock && (
            <g transform={`translate(${layout.fanBlock.x}, ${layout.fanBlock.y})`}>
              <rect
                width={layout.fanBlock.w}
                height={layout.fanBlock.h}
                rx="10"
                ry="10"
                fill="#ffffff"
                stroke="#0284c7"
                strokeWidth="2"
                filter="drop-shadow(0 3px 6px rgba(2,132,199,0.15))"
              />
              <circle cx="24" cy="24" r="12" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1.5" />
              <text x="24" y="28" textAnchor="middle" fill="#0284c7" fontSize="11" fontWeight="900">
                V1
              </text>

              <text x="44" y="23" fill="#0f172a" fontSize="11" fontWeight="900">
                VENTILATORE
              </text>
              <text x="44" y="35" fill="#64748b" fontSize="8.5" fontWeight="600">
                Aspiratore Industriale
              </text>

              <line x1="12" y1="44" x2={layout.fanBlock.w - 12} y2="44" stroke="#e2e8f0" strokeWidth="1" />

              <text x="12" y="58" fill="#0f172a" fontSize="9.5" fontWeight="700">
                Q: {formatNumber(layout.fanBlock.totalFlow_m3h, 0)} m³/h
              </text>
              <text x="12" y="72" fill="#ea580c" fontSize="10" fontWeight="800">
                ΔP: {formatNumber(layout.fanBlock.dp_tot_ventilatore, 0)} Pa
              </text>
              <text x={layout.fanBlock.w - 12} y="72" textAnchor="end" fill="#0284c7" fontSize="9" fontWeight="700">
                {layout.fanBlock.fanPower_kW ? `${layout.fanBlock.fanPower_kW} kW` : ''}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};

export default AeraulicTopologicalTree;
