import React, { useId, useMemo, useRef, useState } from 'react';
import { formatNumber } from '../utils/format';
import { ZoomIn, ZoomOut, Maximize2, Move } from 'lucide-react';

export interface AeraulicTreeNode {
  uid?: string;
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

export interface AeraulicChimneyNode {
  enabled: boolean;
  name?: string;
  D_mm: number | string;
  H_m: number | string;
  dp_Pa: number;
  v_ms: number;
}

export interface AeraulicTopologicalTreeProps {
  segments: AeraulicTreeNode[];
  specials?: AeraulicSpecialNode[];
  chimney?: AeraulicChimneyNode;
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
  chimney,
  totalFlow_m3h,
  dp_tot_ventilatore,
  selectedSegmentId,
  onSelectSegment,
  fanPower_kW,
  className = '',
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panStateRef = useRef<{
    isDown: boolean;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    moved: boolean;
  }>({
    isDown: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
    moved: false,
  });

  const rawId = useId();
  const treeUid = rawId.replace(/[^a-zA-Z0-9]/g, '_');
  const arrowCyanId = `p_arrow_cyan_${treeUid}`;
  const arrowEmeraldId = `p_arrow_emerald_${treeUid}`;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Solo pulsante principale (sinistro) o tocco singolo
    if (e.button !== 0) return;
    const container = containerRef.current;
    if (!container) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    panStateRef.current = {
      isDown: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
      moved: false,
    };
    setIsPanning(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panStateRef.current.isDown) return;
    const container = containerRef.current;
    if (!container) return;

    const dx = e.clientX - panStateRef.current.startX;
    const dy = e.clientY - panStateRef.current.startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      panStateRef.current.moved = true;
    }

    container.scrollLeft = panStateRef.current.scrollLeft - dx;
    container.scrollTop = panStateRef.current.scrollTop - dy;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panStateRef.current.isDown) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    panStateRef.current.isDown = false;
    setIsPanning(false);
  };

  const handlePointerCancel = () => {
    panStateRef.current.isDown = false;
    setIsPanning(false);
  };

  // Calcolo del layout topologico (ortogonale, con right-alignment ed eventuale U-turn a 2 corsie)
  const layout = useMemo(() => {
    if (!segments || segments.length === 0) {
      return {
        branchLines: [],
        busPipes: [],
        junctionNodes: [],
        entryPipes: [],
        nodes: [],
        specialBlocks: [],
        fanBlock: null,
        chimneyBlock: null,
        uTurnPath: null,
        isULayout: false,
        width: 800,
        height: 260,
      };
    }

    // Helper per identificare in modo univoco e stabile ciascun nodo
    const segKey = (s: AeraulicTreeNode) => s.uid || s.id;
    const findNodeByRef = (ref: string): AeraulicTreeNode | undefined => {
      if (!ref) return undefined;
      return segments.find(s => (s.uid && s.uid === ref) || s.id === ref);
    };

    // 1. Calcolo del rank topologico di ciascun tratto (colonna orizzontale)
    // Passo 1A: Calcolo del rank iniziale (forward rank da monte a valle)
    const forwardRankMap = new Map<string, number>();

    function getForwardRank(key: string, visited = new Set<string>()): number {
      if (forwardRankMap.has(key)) return forwardRankMap.get(key)!;
      if (visited.has(key)) return 0;
      visited.add(key);

      const currNode = segments.find(s => segKey(s) === key);
      if (!currNode) return 0;

      const incoming = segments.filter(s => {
        if (!s.confluisceInId) return false;
        const target = findNodeByRef(s.confluisceInId);
        return target && segKey(target) === key;
      });

      if (incoming.length === 0) {
        forwardRankMap.set(key, 0);
        return 0;
      }

      let maxInRank = 0;
      for (const inc of incoming) {
        maxInRank = Math.max(maxInRank, getForwardRank(segKey(inc), new Set(visited)) + 1);
      }
      forwardRankMap.set(key, maxInRank);
      return maxInRank;
    }

    segments.forEach(s => getForwardRank(segKey(s)));

    // Passo 1B: Right-Alignment (allineamento a destra delle bocchette/rami)
    // Se un tratto confluisce in un target a colonna K, il tratto sorgente viene posizionato
    // immediatamente a sinistra del collettore (colonna targetRank - 1), eliminando sovrapposizioni
    // e attraversamenti di colonne intermedie.
    const rankMap = new Map<string, number>(forwardRankMap);
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 10) {
      changed = false;
      iterations++;
      for (const s of segments) {
        if (s.confluisceInId) {
          const target = findNodeByRef(s.confluisceInId);
          if (target) {
            const targetRank = rankMap.get(segKey(target));
            if (targetRank !== undefined) {
              const idealRank = targetRank - 1;
              const currentRank = rankMap.get(segKey(s)) || 0;
              if (idealRank > currentRank) {
                rankMap.set(segKey(s), idealRank);
                changed = true;
              }
            }
          }
        }
      }
    }

    // Raggruppa i tratti per colonna (rank) e ordina all'interno di ciascuna colonna
    const columns = new Map<number, AeraulicTreeNode[]>();
    segments.forEach(s => {
      const r = rankMap.get(segKey(s)) || 0;
      if (!columns.has(r)) columns.set(r, []);
      columns.get(r)!.push(s);
    });

    const maxRank = Math.max(0, ...Array.from(rankMap.values()));

    // Ordinamento all'interno di ciascuna colonna (Barycenter Ordering da valle a monte)
    // 1. Ordina la colonna finale (maxRank) per codice numerico
    const lastCol = columns.get(maxRank) || [];
    lastCol.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

    // 2. Procedi a ritroso da maxRank - 1 a 0 ordinando le sorgenti in base all'indice del loro collettore target
    for (let r = maxRank - 1; r >= 0; r--) {
      const colNodes = columns.get(r) || [];
      colNodes.sort((a, b) => {
        const targetA = findNodeByRef(a.confluisceInId);
        const targetB = findNodeByRef(b.confluisceInId);

        const targetRankA = targetA ? (rankMap.get(segKey(targetA)) ?? 999) : 999;
        const targetRankB = targetB ? (rankMap.get(segKey(targetB)) ?? 999) : 999;

        const targetColA = columns.get(targetRankA) || [];
        const targetColB = columns.get(targetRankB) || [];

        const targetIdxA = targetA ? targetColA.findIndex(n => segKey(n) === segKey(targetA)) : 999;
        const targetIdxB = targetB ? targetColB.findIndex(n => segKey(n) === segKey(targetB)) : 999;

        if (targetIdxA !== targetIdxB) {
          return targetIdxA - targetIdxB;
        }

        // A parità di target (o se entrambi finali), ordina per codice ID progressivo
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      });
    }
    const generalSpecials = specials.filter(s => s.position === 'general');
    const hasSpecialsOrChimney = generalSpecials.length > 0 || (chimney && chimney.enabled);

    // Attivazione automatica del layout a 2 corsie con U-Turn:
    // Attivo per reti con 3+ colonne o con speciali/camino e 2+ colonne
    const isULayout = maxRank >= 3 || (hasSpecialsOrChimney && maxRank >= 2);

    // 2. Dimensioni Card e Griglia
    const CARD_W = 180;
    const CARD_H = 62;
    const ROW_GAP = 24;
    const COL_GAP = 90;
    const PADDING_LEFT = 35;
    const PADDING_TOP = 35;

    let maxRows = 0;
    columns.forEach(col => {
      maxRows = Math.max(maxRows, col.length);
    });

    const contentHeightTop = Math.max(maxRows * (CARD_H + ROW_GAP), 180);

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
      const startY = PADDING_TOP + (contentHeightTop - colH) / 2;

      colNodes.forEach((seg, idx) => {
        const y = startY + idx * (CARD_H + ROW_GAP);
        const pos: NodePos = {
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
        };
        nodeMap.set(segKey(seg), pos);
        if (seg.id) nodeMap.set(seg.id, pos);
      });
    }

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
    const specialBlocks: SpecialBlock[] = [];
    let fanBlock: any = null;
    let chimneyBlock: any = null;
    let uTurnPath: string | null = null;
    let totalWidth = 800;
    let totalHeight = 300;

    // Raggruppa i nodi per target
    const targetGroups = new Map<string, NodePos[]>();
    segments.forEach(s => {
      const node = nodeMap.get(segKey(s)) || nodeMap.get(s.id);
      if (!node) return;
      let targetKey = 'FINAL';
      if (s.confluisceInId) {
        const targetNode = findNodeByRef(s.confluisceInId);
        if (targetNode) {
          targetKey = segKey(targetNode);
        }
      }
      if (!targetGroups.has(targetKey)) targetGroups.set(targetKey, []);
      targetGroups.get(targetKey)!.push(node);
    });

    // 3. Collega i rami interni della rete (target !== 'FINAL')
    targetGroups.forEach((sources, targetKey) => {
      if (targetKey === 'FINAL') return;

      const targetNode = nodeMap.get(targetKey);
      if (!targetNode) return;
      const targetInX = targetNode.inX;
      const targetCenterY = targetNode.inY;

      // Scaglionamento orizzontale: se ci sono più target distinti nella stessa colonna
      // che ricevono rami da monte, ciascuno riceve una propria ascissa busX dedicata
      const targetCol = targetNode.rank;
      const siblingTargets = Array.from(targetGroups.keys())
        .filter(k => k !== 'FINAL')
        .map(k => nodeMap.get(k))
        .filter((n): n is NodePos => !!n && n.rank === targetCol)
        .sort((a, b) => a.y - b.y);

      const targetIdxInRank = siblingTargets.findIndex(n => (n.seg.uid && n.seg.uid === targetKey) || n.id === targetKey);
      const totalSiblings = siblingTargets.length;

      const maxSourceOutX = Math.max(...sources.map(s => s.outX));
      const midX = (maxSourceOutX + targetInX) / 2;

      let busX = midX;
      if (totalSiblings > 1 && targetIdxInRank !== -1) {
        // Scagliona le dorsali verticali distanziandole di 24px per evitare qualsiasi sovrapposizione visiva
        const step = 24;
        const offset = (targetIdxInRank - (totalSiblings - 1) / 2) * step;
        busX = Math.round(midX + offset);
      }

      if (sources.length === 1) {
        const src = sources[0];
        if (Math.abs(src.outY - targetCenterY) < 1) {
          entryPipes.push({
            x1: src.outX,
            y1: src.outY,
            x2: targetInX,
            y2: targetCenterY,
          });
        } else {
          branchLines.push({
            x1: src.outX,
            y1: src.outY,
            x2: busX,
            y2: src.outY,
          });
          busPipes.push({
            busX,
            yMin: Math.min(src.outY, targetCenterY),
            yMax: Math.max(src.outY, targetCenterY),
          });
          entryPipes.push({
            x1: busX,
            y1: targetCenterY,
            x2: targetInX,
            y2: targetCenterY,
          });
        }
        return;
      }

      // Confluenza di 2 o più rami
      sources.forEach(src => {
        branchLines.push({
          x1: src.outX,
          y1: src.outY,
          x2: busX,
          y2: src.outY,
        });
      });

      const sourceYs = sources.map(s => s.outY).sort((a, b) => a - b);
      const yMinSources = sourceYs[0];
      const yMaxSources = sourceYs[sourceYs.length - 1];

      const allYs = [...sourceYs, targetCenterY];
      const yMin = Math.min(...allYs);
      const yMax = Math.max(...allYs);

      if (yMin !== yMax) {
        busPipes.push({
          busX,
          yMin,
          yMax,
        });
      }

      // Nodi di confluenza: posizionati dove le tratte affluenti si toccano/confluiscono fisicamente
      if (targetCenterY > yMaxSources) {
        // Target posizionato più in basso rispetto a tutte le sorgenti:
        // Il flusso scende; ciascuna sorgente successiva alla prima confluisce nel montante alla propria quota.
        for (let i = 1; i < sourceYs.length; i++) {
          junctionNodes.push({
            x: busX,
            y: sourceYs[i],
            targetId: targetKey,
          });
        }
      } else if (targetCenterY < yMinSources) {
        // Target posizionato più in alto rispetto a tutte le sorgenti:
        // Il flusso sale; ciascuna sorgente precedente all'ultima confluisce nel montante alla propria quota.
        for (let i = 0; i < sourceYs.length - 1; i++) {
          junctionNodes.push({
            x: busX,
            y: sourceYs[i],
            targetId: targetKey,
          });
        }
      } else {
        // Target compreso tra le quote delle sorgenti:
        // Il punto di confluenza principale tra il flusso da monte (sopra) e quello da monte (sotto) è a targetCenterY
        junctionNodes.push({
          x: busX,
          y: targetCenterY,
          targetId: targetKey,
        });
        // Per eventuali ulteriori sorgenti intermedie lungo il montante
        sourceYs.forEach(sY => {
          if (Math.abs(sY - targetCenterY) > 2 && sY !== yMinSources && sY !== yMaxSources) {
            junctionNodes.push({
              x: busX,
              y: sY,
              targetId: targetKey,
            });
          }
        });
      }

      entryPipes.push({
        x1: busX,
        y1: targetCenterY,
        x2: targetInX,
        y2: targetCenterY,
      });
    });

    // 4. Calcola il punto di uscita finale della rete (target 'FINAL')
    const finalSources = targetGroups.get('FINAL') || [];
    let finalOutX = PADDING_LEFT + CARD_W;
    let finalOutY = PADDING_TOP + CARD_H / 2;

    if (finalSources.length === 1) {
      finalOutX = finalSources[0].outX;
      finalOutY = finalSources[0].outY;
    } else if (finalSources.length > 1) {
      const maxSourceOutX = Math.max(...finalSources.map(s => s.outX));
      const busX = maxSourceOutX + 40;
      finalSources.forEach(src => {
        branchLines.push({
          x1: src.outX,
          y1: src.outY,
          x2: busX,
          y2: src.outY,
        });
      });
      const allYs = finalSources.map(s => s.outY);
      const yMin = Math.min(...allYs);
      const yMax = Math.max(...allYs);
      const avgY = (yMin + yMax) / 2;
      busPipes.push({ busX, yMin, yMax });
      junctionNodes.push({ x: busX, y: avgY, targetId: 'FINAL' });
      finalOutX = busX;
      finalOutY = avgY;
    }

    // 5. Layout condizionale: Mono-corsia vs 2-Corsie con U-Turn
    if (!isULayout) {
      // === LAYOUT MONO-CORSIA (reti corte / lineari) ===
      const centerY = PADDING_TOP + contentHeightTop / 2;
      let nextX = Math.max(finalOutX + 40, PADDING_LEFT + (maxRank + 1) * (CARD_W + COL_GAP));

      // Blocchi speciali
      generalSpecials.forEach(sp => {
        const w = 125;
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

      // Ventilatore
      const fanW = 175;
      const fanH = 82;
      const fanX = nextX;
      const fanY = centerY - fanH / 2;
      fanBlock = {
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
      nextX += fanW + 40;

      // Collegamento dalla rete al primo elemento
      const firstTargetInX = specialBlocks.length > 0 ? specialBlocks[0].inX : fanBlock.inX;
      const firstTargetInY = specialBlocks.length > 0 ? specialBlocks[0].inY : fanBlock.inY;

      if (Math.abs(finalOutY - firstTargetInY) < 1) {
        entryPipes.push({
          x1: finalOutX,
          y1: finalOutY,
          x2: firstTargetInX,
          y2: firstTargetInY,
        });
      } else {
        const midX = (finalOutX + firstTargetInX) / 2;
        branchLines.push({
          x1: finalOutX,
          y1: finalOutY,
          x2: midX,
          y2: finalOutY,
        });
        busPipes.push({
          busX: midX,
          yMin: Math.min(finalOutY, firstTargetInY),
          yMax: Math.max(finalOutY, firstTargetInY),
        });
        entryPipes.push({
          x1: midX,
          y1: firstTargetInY,
          x2: firstTargetInX,
          y2: firstTargetInY,
        });
      }

      // Collegamenti intermedi tra speciali e ventilatore
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

      // Camino
      if (chimney && chimney.enabled) {
        const chimX = nextX;
        const chimW = 155;
        const chimH = fanH;
        const chimY = centerY - chimH / 2;
        chimneyBlock = {
          x: chimX,
          y: chimY,
          w: chimW,
          h: chimH,
          inX: chimX,
          inY: centerY,
          outX: chimX + chimW,
          outY: centerY,
          name: chimney.name || 'Camino E1',
          D_mm: chimney.D_mm,
          H_m: chimney.H_m,
          dp_Pa: chimney.dp_Pa,
          v_ms: chimney.v_ms,
        };
        entryPipes.push({
          x1: fanBlock.outX,
          y1: fanBlock.outY,
          x2: chimneyBlock.inX,
          y2: chimneyBlock.inY,
        });
        nextX += chimW + 40;
      }

      totalWidth = Math.max(nextX + PADDING_LEFT, 780);
      totalHeight = Math.max(contentHeightTop + PADDING_TOP * 2, 280);

    } else {
      // === LAYOUT A 2 CORSIE CON CURVA A U (180°) ===
      const bottomLaneCenterY = PADDING_TOP + contentHeightTop + 125;
      const BOTTOM_GAP = 45;

      let bottomTotalW = 0;
      generalSpecials.forEach(() => { bottomTotalW += 135 + BOTTOM_GAP; });
      bottomTotalW += 175; // Fan
      if (chimney && chimney.enabled) {
        bottomTotalW += BOTTOM_GAP + 155; // Chimney
      }

      const turnX = Math.max(finalOutX, PADDING_LEFT + bottomTotalW);
      const uTurnArcX = turnX + 55;

      // Curva a U a 180° fluida e precisa
      uTurnPath = `M ${finalOutX} ${finalOutY} L ${turnX + 15} ${finalOutY} C ${uTurnArcX} ${finalOutY}, ${uTurnArcX} ${bottomLaneCenterY}, ${turnX + 15} ${bottomLaneCenterY} L ${turnX} ${bottomLaneCenterY}`;

      // Posizionamento blocchi corsia inferiore da destra verso sinistra
      let curInX = turnX;

      // Speciali generali (Separatore, Scrubber, Filtro, ecc.)
      generalSpecials.forEach(sp => {
        const w = 135;
        const h = 66;
        const x = curInX - w;
        const y = bottomLaneCenterY - h / 2;
        specialBlocks.push({
          id: sp.id,
          name: sp.name || sp.type,
          type: sp.type,
          dp_Pa: sp.dp_Pa,
          x,
          y,
          w,
          h,
          inX: curInX,
          inY: bottomLaneCenterY,
          outX: x,
          outY: bottomLaneCenterY,
        });
        curInX = x - BOTTOM_GAP;
      });

      // Ventilatore Industriale (V1)
      const fanW = 175;
      const fanH = 82;
      const fanX = curInX - fanW;
      const fanY = bottomLaneCenterY - fanH / 2;
      fanBlock = {
        x: fanX,
        y: fanY,
        w: fanW,
        h: fanH,
        inX: curInX,
        inY: bottomLaneCenterY,
        outX: fanX,
        outY: bottomLaneCenterY,
        totalFlow_m3h,
        dp_tot_ventilatore,
        fanPower_kW,
      };
      curInX = fanX - BOTTOM_GAP;

      // Connessioni orizzontali corsia inferiore (flusso verso sinistra)
      if (specialBlocks.length > 0) {
        for (let i = 0; i < specialBlocks.length - 1; i++) {
          entryPipes.push({
            x1: specialBlocks[i].outX,
            y1: bottomLaneCenterY,
            x2: specialBlocks[i + 1].inX,
            y2: bottomLaneCenterY,
          });
        }
        entryPipes.push({
          x1: specialBlocks[specialBlocks.length - 1].outX,
          y1: bottomLaneCenterY,
          x2: fanBlock.inX,
          y2: bottomLaneCenterY,
        });
      }

      // Camino (E1) se abilitato
      if (chimney && chimney.enabled) {
        const chimW = 155;
        const chimH = fanH;
        const chimX = curInX - chimW;
        const chimY = bottomLaneCenterY - chimH / 2;
        chimneyBlock = {
          x: chimX,
          y: chimY,
          w: chimW,
          h: chimH,
          inX: curInX,
          inY: bottomLaneCenterY,
          outX: chimX,
          outY: bottomLaneCenterY,
          name: chimney.name || 'Camino E1',
          D_mm: chimney.D_mm,
          H_m: chimney.H_m,
          dp_Pa: chimney.dp_Pa,
          v_ms: chimney.v_ms,
        };

        entryPipes.push({
          x1: fanBlock.outX,
          y1: bottomLaneCenterY,
          x2: chimneyBlock.inX,
          y2: bottomLaneCenterY,
        });
      }

      totalWidth = Math.max(uTurnArcX + 35, 800);
      totalHeight = bottomLaneCenterY + 55 + PADDING_TOP;
    }

    return {
      nodes: Array.from(nodeMap.values()),
      branchLines,
      busPipes,
      junctionNodes,
      entryPipes,
      specialBlocks,
      fanBlock,
      chimneyBlock,
      uTurnPath,
      isULayout,
      width: Math.max(totalWidth, 780),
      height: Math.max(totalHeight, 280),
    };
  }, [segments, specials, chimney, totalFlow_m3h, dp_tot_ventilatore, fanPower_kW]);

  if (!segments || segments.length === 0) {
    return (
      <div className="py-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
        <p className="text-xs">Nessun tratto presente per lo schema topologico.</p>
      </div>
    );
  }

  return (
    <div className={`w-full bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm print:bg-white print:border-none print:p-0 print:shadow-none ${className}`}>
      {/* Intestazione Legenda Ingegneristica Chiara e Controlli Zoom */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 text-xs text-slate-600 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-600"></span>
          <span className="font-bold uppercase tracking-wider text-[11px] text-slate-800">
            Schema Unifilare Aeraulico (Flusso da Monte a Valle)
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11px] flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-[2px] bg-[#0284c7] rounded-full"></span>
            <span className="text-slate-700 font-semibold">Condotta Rete</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-400"></span>
            <span className="text-slate-700 font-semibold">Ramo Sfavorito</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7] border border-[#075985]"></span>
            <span className="text-slate-700 font-semibold">Confluenza</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-sky-100 border border-sky-400"></span>
            <span className="text-slate-700 font-semibold">Ventilatore (V1)</span>
          </div>
          {chimney && chimney.enabled && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-400"></span>
              <span className="text-slate-700 font-semibold">Camino (E1)</span>
            </div>
          )}

          {/* Controlli Zoom Interattivi & Pan Hint */}
          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            {zoom > 1 && (
              <span className="text-[10px] text-cyan-700 hidden md:flex items-center gap-1 font-semibold select-none bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-md">
                <Move className="w-3 h-3 text-cyan-600" />
                Trascina per spostare
              </span>
            )}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 print:hidden shadow-sm">
              <button
                type="button"
                onClick={() => setZoom(z => Math.max(0.6, Math.round((z - 0.15) * 100) / 100))}
                className="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                title="Riduci Zoom (-15%)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-semibold text-slate-600 px-1.5 min-w-[38px] text-center select-none">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom(z => Math.min(2.0, Math.round((z + 0.15) * 100) / 100))}
                className="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                title="Aumenta Zoom (+15%)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1.0)}
                className="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                title="Adatta Vista (100%)"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Container SVG Responsive con scroll orizzontale, pan-by-drag con il mouse e zoom ad alta definizione */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className={`w-full overflow-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent select-none ${
          isPanning
            ? 'cursor-grabbing'
            : zoom > 1
            ? 'cursor-grab'
            : 'cursor-grab'
        } print:cursor-default`}
        style={{ touchAction: 'pan-y' }}
      >
        <div
          style={{
            minWidth: zoom > 1 ? `${Math.round(layout.width * zoom)}px` : '100%',
            width: zoom > 1 ? `${Math.round(layout.width * zoom)}px` : '100%',
            maxWidth: zoom === 1 ? '100%' : undefined,
          }}
          className="flex justify-center transition-all duration-200"
        >
          <svg
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            style={{ width: '100%', height: 'auto' }}
            className="select-none font-sans overflow-visible"
          >
            <defs>
              {/* Marker freccia Cyan per condotte e confluenze */}
              <marker
                id={arrowCyanId}
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0284c7" />
              </marker>

              {/* Marker freccia Verde per mandata camino in atmosfera */}
              <marker
                id={arrowEmeraldId}
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#059669" />
              </marker>
            </defs>

            {/* 0. Curva a U 180° tra corsia superiore e corsia inferiore */}
            {layout.uTurnPath && (
              <path
                d={layout.uTurnPath}
                fill="none"
                stroke="#0284c7"
                strokeWidth={2}
                strokeLinecap="round"
                markerEnd={`url(#${arrowCyanId})`}
              />
            )}

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

            {/* 4. Tubazioni di collegamento con freccia di flusso */}
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
                markerEnd={`url(#${arrowCyanId})`}
              />
            ))}

          {/* 5. Nodi dei Tratti Condotta (Card compatte e pulite) */}
          {layout.nodes.map(n => {
            const isSelected = selectedSegmentId ? (selectedSegmentId === n.seg.uid || selectedSegmentId === n.id) : false;
            const isCrit = n.seg.isCritical;
            const isSource = n.seg.type === 'source';

            // Larghezza dinamica del badge ID per supportare ID di 2-4 caratteri
            const badgeW = Math.max(30, n.id.length * 8 + 8);

            // Verifica eventuale utenza opzionale (es. 'Bottale B1' o 'B1')
            const rawName = (n.seg.name || '').trim();
            const isDefaultOrEmpty = !rawName ||
              rawName.toLowerCase().startsWith('linea') ||
              rawName.toLowerCase().startsWith('collettore') ||
              rawName.toLowerCase() === n.id.toLowerCase();
            const utenzaLabel = isDefaultOrEmpty ? '' : rawName;

            return (
              <g
                key={`node-${n.seg.uid || n.id}`}
                transform={`translate(${n.x}, ${n.y})`}
                onClick={(e) => {
                  if (panStateRef.current.moved) {
                    e.stopPropagation();
                    return;
                  }
                  onSelectSegment?.(n.seg.uid || n.id);
                }}
                className="cursor-pointer transition-all"
              >
                {/* Sfondo Card con Evidenziazione Tratta Selezionata */}
                <rect
                  width={n.w}
                  height={n.h}
                  rx="8"
                  ry="8"
                  fill={isSelected ? '#f0f9ff' : '#ffffff'}
                  stroke={isSelected ? '#0284c7' : isCrit ? '#f59e0b' : isSource ? '#cbd5e1' : '#818cf8'}
                  strokeWidth={isSelected ? 3 : isCrit ? 2 : 1.5}
                  filter={isSelected ? 'drop-shadow(0 0 8px rgba(2,132,199,0.45))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.06))'}
                />

                {/* Badge ID Tratto */}
                <rect
                  x="6"
                  y="6"
                  width={badgeW}
                  height="16"
                  rx="4"
                  ry="4"
                  fill={isCrit ? '#ea580c' : isSource ? '#0284c7' : '#4f46e5'}
                />
                <text
                  x={6 + badgeW / 2}
                  y="18"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="900"
                >
                  {n.id}
                </text>

                {/* Ruolo Automatico del Tratto: BOCCHETTA o COLLETTORE (+ eventuale utenza) */}
                <text
                  x={12 + badgeW}
                  y="18"
                  fill={isSource ? '#0369a1' : '#4338ca'}
                  fontSize="9"
                  fontWeight="800"
                  letterSpacing="0.2"
                >
                  {isSource ? 'BOCCHETTA' : 'COLLETTORE'}
                  {utenzaLabel ? ` • ${utenzaLabel}` : ''}
                </text>

                {/* Badge SFAVORITO (Evidenziazione ramo a maggior resistenza) */}
                {isCrit && (
                  <g transform={`translate(${n.w - 58}, 6)`}>
                    <rect width="52" height="15" rx="3" fill="#fef3c7" stroke="#f59e0b" strokeWidth="0.8" />
                    <text
                      x="26"
                      y="11"
                      textAnchor="middle"
                      fill="#b45309"
                      fontSize="7"
                      fontWeight="900"
                    >
                      SFAVORITO
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
                  </tspan>
                  {' • ΔP: '}
                  <tspan fill="#ea580c" fontWeight="700">
                    {formatNumber(n.seg.dp_Pa, 1)} Pa
                  </tspan>
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

          {/* 8. Blocco Camino / Mandata verso Atmosfera (E1) */}
          {layout.chimneyBlock && (
            <g transform={`translate(${layout.chimneyBlock.x}, ${layout.chimneyBlock.y})`}>
              <rect
                width={layout.chimneyBlock.w}
                height={layout.chimneyBlock.h}
                rx="10"
                ry="10"
                fill="#ffffff"
                stroke="#059669"
                strokeWidth="2"
                filter="drop-shadow(0 3px 6px rgba(5,150,105,0.15))"
              />
              <circle cx="24" cy="24" r="12" fill="#ecfdf5" stroke="#059669" strokeWidth="1.5" />
              <text x="24" y="28" textAnchor="middle" fill="#059669" fontSize="11" fontWeight="900">
                E1
              </text>

              <text x="44" y="23" fill="#065f46" fontSize="11" fontWeight="900">
                CAMINO
              </text>
              <text x="44" y="35" fill="#64748b" fontSize="8.5" fontWeight="600">
                Mandata Atmosfera
              </text>

              <line x1="12" y1="44" x2={layout.chimneyBlock.w - 12} y2="44" stroke="#e2e8f0" strokeWidth="1" />

              <text x="12" y="58" fill="#0f172a" fontSize="9" fontWeight="700">
                {layout.chimneyBlock.D_mm ? `Ø ${layout.chimneyBlock.D_mm} mm` : 'Ø —'}
                {layout.chimneyBlock.H_m ? ` • H ${layout.chimneyBlock.H_m} m` : ''}
              </text>
              <text x="12" y="72" fill="#059669" fontSize="9.5" fontWeight="800">
                ΔP: {formatNumber(layout.chimneyBlock.dp_Pa, 1)} Pa
              </text>
              {layout.chimneyBlock.v_ms > 0 && (
                <text x={layout.chimneyBlock.w - 12} y="72" textAnchor="end" fill="#64748b" fontSize="8.5" fontWeight="600">
                  {formatNumber(layout.chimneyBlock.v_ms, 1)} m/s
                </text>
              )}

              {/* Indicatore visivo di emissione libera in atmosfera verso l'alto */}
              <g transform={`translate(${layout.chimneyBlock.w - 22}, 14)`}>
                <circle cx="6" cy="6" r="8" fill="#ecfdf5" stroke="#059669" strokeWidth="1" />
                <path d="M 6 10 L 6 3 M 3.5 5.5 L 6 2.5 L 8.5 5.5" fill="none" stroke="#059669" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </g>
          )}

          {/* Scarico a vista per impianti senza camino */}
          {layout.isULayout && !layout.chimneyBlock && layout.fanBlock && (
            <g>
              <line
                x1={layout.fanBlock.outX}
                y1={layout.fanBlock.outY}
                x2={layout.fanBlock.outX - 25}
                y2={layout.fanBlock.outY}
                stroke="#0284c7"
                strokeWidth={2}
                strokeLinecap="round"
              />
              <polygon
                points={`${layout.fanBlock.outX - 30},${layout.fanBlock.outY} ${layout.fanBlock.outX - 22},${layout.fanBlock.outY - 4.5} ${layout.fanBlock.outX - 22},${layout.fanBlock.outY + 4.5}`}
                fill="#0284c7"
              />
              <text
                x={layout.fanBlock.outX - 35}
                y={layout.fanBlock.outY + 3}
                textAnchor="end"
                fill="#64748b"
                fontSize="9"
                fontWeight="700"
              >
                Scarico
              </text>
            </g>
          )}

          {!layout.isULayout && !layout.chimneyBlock && layout.fanBlock && (
            <g>
              <line
                x1={layout.fanBlock.outX}
                y1={layout.fanBlock.outY}
                x2={layout.fanBlock.outX + 25}
                y2={layout.fanBlock.outY}
                stroke="#0284c7"
                strokeWidth={2}
                strokeLinecap="round"
              />
              <polygon
                points={`${layout.fanBlock.outX + 30},${layout.fanBlock.outY} ${layout.fanBlock.outX + 22},${layout.fanBlock.outY - 4.5} ${layout.fanBlock.outX + 22},${layout.fanBlock.outY + 4.5}`}
                fill="#0284c7"
              />
              <text
                x={layout.fanBlock.outX + 35}
                y={layout.fanBlock.outY + 3}
                textAnchor="start"
                fill="#64748b"
                fontSize="9"
                fontWeight="700"
              >
                Scarico
              </text>
            </g>
          )}

          {/* Espulsione atmosferica sommitale dal camino (geometria solida garantita al 100% in stampa e a schermo) */}
          {layout.chimneyBlock && (() => {
            const cx = layout.chimneyBlock.x + layout.chimneyBlock.w / 2;
            const topY = layout.chimneyBlock.y;
            const arrowLen = 28;
            const tipY = topY - arrowLen;
            return (
              <g className="emission-chimney-group">
                {/* Tratto verticale verde di espulsione */}
                <line
                  x1={cx}
                  y1={topY}
                  x2={cx}
                  y2={tipY + 6}
                  stroke="#059669"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
                {/* Cuspide freccia solida verso l'alto (polygon nitido indipendente da marker esterni) */}
                <polygon
                  points={`${cx},${tipY} ${cx - 5.5},${tipY + 9} ${cx + 5.5},${tipY + 9}`}
                  fill="#059669"
                />
                {/* Dicitura chiara di espulsione aeraulica */}
                <text
                  x={cx}
                  y={tipY - 5}
                  textAnchor="middle"
                  fill="#047857"
                  fontSize="8.5"
                  fontWeight="800"
                  className="select-none"
                >
                  Espulsione in atmosfera
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  </div>
);
};

export default AeraulicTopologicalTree;
