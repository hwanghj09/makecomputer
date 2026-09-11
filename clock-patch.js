"use strict";

(function installClockPatch() {
  if (typeof PARTS === 'undefined' || !PARTS.ne555 || !PARTS.pot10k) return;

  function resistanceEdges(ctx) {
    const edges = [];
    const addEdge = (a, b, ohms) => {
      if (!Number.isFinite(ohms) || ohms < 0) return;
      edges.push({ a, b, ohms: Math.max(0.001, ohms) });
    };

    for (const other of state.components) {
      const def = PARTS[other.type];
      if (!def) continue;

      if (def.category === 'resistor' && Number.isFinite(def.ohms)) {
        addEdge(ctx.nodeOf(other.id, 1), ctx.nodeOf(other.id, 2), def.ohms);
        continue;
      }

      if (other.type === 'pot10k') {
        const ratio = Math.max(0, Math.min(1, Number(other.state?.ratio ?? 0.5)));
        const total = 10000;
        const n1 = ctx.nodeOf(other.id, 1);
        const nw = ctx.nodeOf(other.id, 2);
        const n3 = ctx.nodeOf(other.id, 3);
        addEdge(n1, nw, total * ratio);
        addEdge(nw, n3, total * (1 - ratio));
        addEdge(n1, n3, total);
      }
    }
    return edges;
  }

  function findResistance(edges, start, end, maxEdges = 4) {
    if (start === end) return 0;
    let best = Infinity;

    function walk(node, visited, depth, total) {
      if (depth > maxEdges || total >= best) return;
      if (node === end) {
        best = Math.min(best, total);
        return;
      }
      for (const e of edges) {
        let next = null;
        if (e.a === node) next = e.b;
        else if (e.b === node) next = e.a;
        else continue;
        if (visited.has(next)) continue;
        const nextVisited = new Set(visited);
        nextVisited.add(next);
        walk(next, nextVisited, depth + 1, total + e.ohms);
      }
    }

    walk(start, new Set([start]), 0, 0);
    return Number.isFinite(best) ? best : null;
  }

  PARTS.ne555.onTick = function variableClockTick(comp, def, prevLevelOf, dtMs, ctx) {
    const st = comp.state;
    const powered = prevLevelOf(comp.id, 8) === LEVEL.H && prevLevelOf(comp.id, 1) === LEVEL.L;
    if (!powered) {
      st.out = LEVEL.L;
      st.statusMsg = '전원 필요';
      return;
    }

    const resetLv = prevLevelOf(comp.id, 4);
    if (resetLv === LEVEL.L) {
      st.out = LEVEL.L;
      st.phase = 'low';
      st.phaseElapsed = 0;
      st.statusMsg = 'RESET';
      return;
    }

    const nodeVcc = ctx.nodeOf(comp.id, 8);
    const node7 = ctx.nodeOf(comp.id, 7);
    const node26 = ctx.nodeOf(comp.id, 6);
    const nodeGnd = ctx.nodeOf(comp.id, 1);
    const edges = resistanceEdges(ctx);

    const R1 = findResistance(edges, nodeVcc, node7, 2);
    const R2 = findResistance(edges, node7, node26, 4);

    let C = null;
    for (const other of state.components) {
      const d2 = PARTS[other.type];
      if (!d2 || d2.category !== 'capacitor') continue;
      const n1 = ctx.nodeOf(other.id, 1);
      const n2 = ctx.nodeOf(other.id, 2);
      if ((n1 === node26 && n2 === nodeGnd) || (n2 === node26 && n1 === nodeGnd)) {
        C = d2.farads;
        break;
      }
    }

    if (!R1 || !R2 || !C) {
      st.out = LEVEL.L;
      st.statusMsg = 'RC망 필요';
      return;
    }

    const tHigh = 0.693 * (R1 + R2) * C;
    const tLow = 0.693 * R2 * C;
    const period = tHigh + tLow;
    const hz = period > 0 ? 1 / period : 0;
    st.statusMsg = `${hz.toFixed(2)} Hz`;

    st.phaseElapsed += dtMs / 1000;
    if (st.phase === 'high') {
      st.out = LEVEL.H;
      if (st.phaseElapsed >= tHigh) {
        st.phase = 'low';
        st.phaseElapsed = 0;
      }
    } else {
      st.out = LEVEL.L;
      if (st.phaseElapsed >= tLow) {
        st.phase = 'high';
        st.phaseElapsed = 0;
      }
    }
  };
})();
