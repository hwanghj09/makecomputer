"use strict";
/* =========================================================================
 * 브레드보드 회로 시뮬레이터 - Core engine (Part 1/5)
 * 좌표 단위: HOLE = 0.1" 격자 한 칸(px)
 * ========================================================================= */
const HOLE = 18; // px per grid unit
const LEVEL = { H: 'H', L: 'L', X: 'X' }; // X = floating/unknown
const STRENGTH = { POWER: 3, STRONG: 2, WEAK: 1 };

let compSeq = 1;
let wireSeq = 1;
const uid = (p) => `${p}${compSeq++}`;

/* ---------------- Union-Find ---------------- */
class UnionFind {
  constructor() { this.parent = new Map(); }
  find(x) {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root);
    // path compression
    let cur = x;
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur);
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }
  union(a, b) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

/* ---------------- Global state ---------------- */
const state = {
  boards: [],       // breadboard instances
  components: [],   // non-breadboard placed components
  wires: [],        // {id, a:{...ref}, b:{...ref}, color}
  selection: null,  // {kind:'wire'|'comp', id}
  pendingWire: null, // connector ref {kind:'hole'|'pin', ...}
  pendingEl: null,
  pendingCursor: null,
  running: true,
  lastTs: null,
  nodeLevels: new Map(), // nodeId -> LEVEL
  nodeConflict: new Set(),
  holeEls: [],      // {el, boardId, row, col}
  pinEls: [],       // {el, compId, pinNum}
  activeWireColor: '#e63946',
  activeWireStyle: 'short',
  view: { zoom: 1, panX: 0, panY: 0 }, // pan/zoom camera for the workspace
  history: { past: [], future: [] }, // Ctrl+Z / Ctrl+Y undo-redo (whole-state snapshots)
  clipboard: null, pasteCount: 0,     // Ctrl+C / Ctrl+V
  activeDrag: null,                   // {cancel()} for the in-progress board/component drag, if any - Escape reverts it
};

/* ---------------- Breadboard model ---------------- */
// A "long" breadboard: 64 columns, rows A-E (top cluster) / F-J (bottom cluster),
// plus +/- power rails top and bottom.
const BB_COLS = 64;
const BB_TOP_ROWS = ['A', 'B', 'C', 'D', 'E'];
const BB_BOT_ROWS = ['F', 'G', 'H', 'I', 'J'];

function createBoard(x, y) {
  const board = { id: uid('bb'), x, y, cols: BB_COLS };
  state.boards.push(board);
  return board;
}

// Tie-node id for a given hole address on a board.
function holeTie(boardId, section, col) {
  // section: 'RTP' (rail top +), 'RTM' (rail top -), 'top' (A-E), 'bot' (F-J),
  //          'RBP' (rail bottom +), 'RBM' (rail bottom -)
  if (section === 'top' || section === 'bot') return `${boardId}_${section}_${col}`;
  return `${boardId}_${section}`; // rails: one shared node per rail per board
}

function holeSection(row) {
  if (row === 'RTP' || row === 'RTM' || row === 'RBP' || row === 'RBM') return row;
  if (BB_TOP_ROWS.includes(row)) return 'top';
  if (BB_BOT_ROWS.includes(row)) return 'bot';
  return null;
}

// Pixel position of a hole (row label, column 1-based) relative to board origin.
function holePixelOffset(row, col) {
  const colX = (col - 1) * HOLE + 10;
  let rowY;
  const rowOrder = ['RTP', 'RTM', 'GAP0', 'A', 'B', 'C', 'D', 'E', 'GAP1', 'F', 'G', 'H', 'I', 'J', 'GAP2', 'RBP', 'RBM'];
  const idx = rowOrder.indexOf(row);
  rowY = idx * HOLE + 14;
  return { x: colX, y: rowY };
}
const BB_HEIGHT_UNITS = 17; // rowOrder length above

/* ---------------- Netlist / point resolution ---------------- */
// A "connector ref" uniquely identifies a wire endpoint or a component pin's electrical point.
// {kind:'hole', boardId, row, col}  OR {kind:'pin', compId, pinNum}
function connectorPointId(ref) {
  if (ref.kind === 'hole') {
    const section = holeSection(ref.row);
    return holeTie(ref.boardId, section, ref.col);
  }
  // pin ref: if plugged into a hole, resolve to that hole's tie id; else its own free id
  const comp = getComponent(ref.compId);
  if (!comp) return `dead_${ref.compId}_${ref.pinNum}`;
  const plug = comp.pinPlug && comp.pinPlug[ref.pinNum];
  if (plug) return holeTie(plug.boardId, holeSection(plug.row), plug.col);
  return `pin_${ref.compId}_${ref.pinNum}`;
}

function getComponent(id) {
  return state.components.find(c => c.id === id);
}
function getBoard(id) {
  return state.boards.find(b => b.id === id);
}

/* Build union-find over all wires + return resolver */
function buildNetlist() {
  const uf = new UnionFind();
  // touch every hole tie id + every pin point id so isolated points exist too
  for (const b of state.boards) {
    ['RTP', 'RTM', 'RBP', 'RBM'].forEach(s => uf.find(holeTie(b.id, s, 0)));
    for (let c = 1; c <= b.cols; c++) {
      uf.find(holeTie(b.id, 'top', c));
      uf.find(holeTie(b.id, 'bot', c));
    }
  }
  for (const comp of state.components) {
    const def = PARTS[comp.type];
    if (!def) continue;
    for (const p of def.pins) uf.find(connectorPointId({ kind: 'pin', compId: comp.id, pinNum: p.n }));
    // internal always-on bridges (e.g. push button leg pairs)
    if (def.internalTies) {
      for (const [a, b] of def.internalTies) {
        uf.union(
          connectorPointId({ kind: 'pin', compId: comp.id, pinNum: a }),
          connectorPointId({ kind: 'pin', compId: comp.id, pinNum: b })
        );
      }
    }
  }
  for (const w of state.wires) {
    uf.union(connectorPointId(w.a), connectorPointId(w.b));
  }
  return uf;
}

/* ---------------- Simulation context ---------------- */
function makeSimCtx(uf) {
  const driversByNode = new Map(); // nodeRoot -> [{value, strength}]
  function nodeOf(compId, pinNum) {
    return uf.find(connectorPointId({ kind: 'pin', compId, pinNum }));
  }
  function levelOf(levels, compId, pinNum) {
    const n = nodeOf(compId, pinNum);
    return levels.get(n) ?? LEVEL.X;
  }
  function drive(compId, pinNum, value, strength) {
    const n = nodeOf(compId, pinNum);
    if (!driversByNode.has(n)) driversByNode.set(n, []);
    driversByNode.get(n).push({ value, strength });
  }
  function resolve() {
    const levels = new Map();
    const conflicts = new Set();
    for (const [node, drivers] of driversByNode) {
      let best = null, conflict = false;
      let maxStrength = -1;
      for (const d of drivers) {
        if (d.strength > maxStrength) { maxStrength = d.strength; }
      }
      const top = drivers.filter(d => d.strength === maxStrength);
      const values = new Set(top.map(d => d.value));
      if (values.size === 0) { continue; }
      if (values.size > 1) { conflict = true; best = LEVEL.X; }
      else { best = [...values][0]; }
      levels.set(node, best);
      if (conflict) conflicts.add(node);
    }
    return { levels, conflicts };
  }
  return { nodeOf, levelOf, drive, resolve, driversByNode };
}

function isPowered(comp, def, levels, ctx) {
  if (!def.power) return true;
  const vcc = ctx.levelOf(levels, comp.id, def.power.vcc);
  const gnd = ctx.levelOf(levels, comp.id, def.power.gnd);
  return vcc === LEVEL.H && gnd === LEVEL.L;
}

/* ---------------- Main simulation tick ---------------- */
function simulateTick(dtMs) {
  const uf = buildNetlist();
  const ctx = makeSimCtx(uf);
  // seed levels from last frame for sequential (edge-detect) components
  const prevLevels = state.nodeLevels;
  const prevLevelOf = (compId, pinNum) => {
    const n = ctx.nodeOf(compId, pinNum);
    return prevLevels.get(n) ?? LEVEL.X;
  };

  // 1) sequential / time-based state updates (once per tick, using previous settled levels)
  for (const comp of state.components) {
    const def = PARTS[comp.type];
    if (def && def.onTick) def.onTick(comp, def, prevLevelOf, dtMs, ctx);
  }

  // 2) iterative combinational settle
  let levels = new Map(prevLevels);
  let conflicts = new Set();
  const ITER = 6;
  for (let i = 0; i < ITER; i++) {
    ctx.driversByNode.clear();
    for (const comp of state.components) {
      const def = PARTS[comp.type];
      if (!def || !def.simulate) continue;
      def.simulate(comp, def, levels, ctx);
    }
    const res = ctx.resolve();
    levels = res.levels;
    conflicts = res.conflicts;
  }

  state.nodeLevels = levels;
  state.nodeConflict = conflicts;
  state.lastUF = uf;
  state.lastCtx = ctx;
}

/* =========================================================================
 * PARTS registry (Part 2/5): passives, switches, power components
 * Every part def: { name, category, pins:[{n,label}], power?:{vcc,gnd},
 *   internalTies?:[[pinA,pinB],...], render, simulate?, onTick?,
 *   footprint:{w,h in HOLE units} }
 * ========================================================================= */
const PARTS = {};

function resistorColorBands(ohms) {
  const digitColors = ['#1a1a1a', '#7a4a1a', '#c0392b', '#e67e22', '#e6c619',
    '#4caf50', '#2980b9', '#8e44ad', '#7f8c8d', '#f5f5f5'];
  const multColors = digitColors;
  let exp = 0, val = ohms;
  while (val >= 100) { val = Math.round(val / 10); exp++; }
  const d1 = Math.floor(val / 10), d2 = val % 10;
  return [digitColors[d1], digitColors[d2], multColors[exp], '#d4af37'];
}

function makeResistor(id, name, ohms) {
  PARTS[id] = {
    name, category: 'resistor', ohms,
    pins: [{ n: 1, label: 'A' }, { n: 2, label: 'B' }],
    footprint: { w: 2, h: 0.6 },
    layout: { type: 'row', spacing: 2 },
    render(comp) {
      const bands = resistorColorBands(ohms);
      return `<div class="resistor-body" style="width:${2*HOLE-6}px">${
        bands.map(c => `<div class="resistor-band" style="background:${c}"></div>`).join('')
      }</div>`;
    },
    simulate(comp, def, levels, ctx) {
      const a = ctx.levelOf(levels, comp.id, 1);
      const b = ctx.levelOf(levels, comp.id, 2);
      if (b !== LEVEL.X) ctx.drive(comp.id, 1, b, STRENGTH.WEAK);
      if (a !== LEVEL.X) ctx.drive(comp.id, 2, a, STRENGTH.WEAK);
    },
  };
}
makeResistor('res330', '저항 330Ω', 330);
makeResistor('res1k', '저항 1kΩ', 1000);
makeResistor('res2k2', '저항 2.2kΩ', 2200);
makeResistor('res10k', '저항 10kΩ', 10000);
makeResistor('res22k', '저항 22kΩ', 22000);

function makeCapacitor(id, name, farads, kind) {
  PARTS[id] = {
    name, category: 'capacitor', farads, kind,
    pins: [{ n: 1, label: '+' }, { n: 2, label: '-' }],
    footprint: { w: 1.4, h: 1.4 },
    layout: { type: 'row', spacing: 2 },
    render(comp) {
      const cls = kind === 'ceramic' ? 'cap-ceramic' : 'cap-elec';
      const label = kind === 'ceramic' ? '세라믹' : (farads >= 4e-4 ? '470µF' : '47µF');
      return `<div class="cap-body ${cls}" style="width:${1.4*HOLE}px;height:${1.4*HOLE}px">${label}</div>`;
    },
    // capacitors do not drive digital levels (open for DC); used by NE555 RC lookup only.
    simulate() {},
  };
}
makeCapacitor('cap0u1', '0.1µF 세라믹 커패시터', 1e-7, 'ceramic');
makeCapacitor('cap47u', '47µF 전해 커패시터', 4.7e-5, 'elec');
makeCapacitor('cap470u', '470µF 16V 평활 콘덴서', 4.7e-4, 'elec');

const LED_COLORS = { red: '#ff3b3b', green: '#3bff6a', blue: '#4d9dff', yellow: '#ffe93b', white: '#f4f4f4' };
PARTS['led'] = {
  name: '컬러 LED', category: 'output',
  pins: [{ n: 1, label: 'A+' }, { n: 2, label: 'K-' }],
  footprint: { w: 1.3, h: 1.5 },
  layout: { type: 'row', spacing: 2 },
  init() { return { color: 'red' }; },
  render(comp) {
    const color = LED_COLORS[comp.state.color] || LED_COLORS.red;
    const lit = comp.state.lit ? 'lit' : '';
    const size = 1.3 * HOLE;
    return `<div class="led-body ${lit}" style="width:${size}px;height:${size}px;--led-color:${color};background:${comp.state.lit ? color : '#333'}"></div>
      <select class="led-color-select" style="position:absolute;top:${size+2}px;left:0;font-size:9px;width:${size+18}px">
        ${Object.keys(LED_COLORS).map(c => `<option value="${c}" ${c===comp.state.color?'selected':''}>${c}</option>`).join('')}
      </select>`;
  },
  onDomReady(comp, el) {
    const sel = el.querySelector('.led-color-select');
    if (sel) sel.addEventListener('change', e => { comp.state.color = e.target.value; renderComponent(comp); });
  },
  simulate(comp, def, levels, ctx) {
    const a = ctx.levelOf(levels, comp.id, 1);
    const k = ctx.levelOf(levels, comp.id, 2);
    comp.state.lit = (a === LEVEL.H && k === LEVEL.L);
  },
};

/* ---------- switches ---------- */
PARTS['pushbtn'] = {
  name: '푸시 버튼', category: 'input',
  pins: [{ n: 1, label: '1' }, { n: 2, label: '2' }, { n: 3, label: '3' }, { n: 4, label: '4' }],
  internalTies: [[1, 3], [2, 4]],
  footprint: { w: 2, h: 2 },
  layout: { type: 'square2x2', spacing: 2 },
  init() { return { pressed: false }; },
  render(comp) {
    const s = 2 * HOLE;
    return `<div class="switch-body ${comp.state.pressed ? 'on' : ''}" style="width:${s}px;height:${s}px;border-radius:50%">PB</div>`;
  },
  onPointerDown(comp) { comp.state.pressed = true; renderComponent(comp); }, // mousedown press
  onPointerUp(comp) { comp.state.pressed = false; renderComponent(comp); },
  simulate(comp, def, levels, ctx) {
    if (!comp.state.pressed) return;
    const a = ctx.levelOf(levels, comp.id, 1);
    const b = ctx.levelOf(levels, comp.id, 2);
    if (a !== LEVEL.X) ctx.drive(comp.id, 2, a, STRENGTH.STRONG);
    if (b !== LEVEL.X) ctx.drive(comp.id, 1, b, STRENGTH.STRONG);
  },
};

PARTS['slideswitch'] = {
  name: 'SS-12D00-G3 슬라이드 스위치', category: 'input',
  pins: [{ n: 1, label: 'A' }, { n: 2, label: 'COM' }, { n: 3, label: 'B' }],
  footprint: { w: 2, h: 1.2 },
  layout: { type: 'row', spacing: 1 },
  init() { return { pos: 'A' }; },
  render(comp) {
    const w = 2 * HOLE, h = 1.2 * HOLE;
    const left = comp.state.pos === 'A' ? '2%' : '58%';
    return `<div class="slide-switch-body" style="width:${w}px;height:${h}px">
      <div class="slide-knob" style="left:${left}"></div></div>`;
  },
  onClick(comp) { comp.state.pos = comp.state.pos === 'A' ? 'B' : 'A'; renderComponent(comp); },
  simulate(comp, def, levels, ctx) {
    const other = comp.state.pos === 'A' ? 1 : 3;
    const com = ctx.levelOf(levels, comp.id, 2);
    const oth = ctx.levelOf(levels, comp.id, other);
    if (oth !== LEVEL.X) ctx.drive(comp.id, 2, oth, STRENGTH.STRONG);
    if (com !== LEVEL.X) ctx.drive(comp.id, other, com, STRENGTH.STRONG);
  },
};

function makeDipSwitch(id, name, poles) {
  PARTS[id] = {
    name, category: 'input', poles, kind: 'dip',
    pins: Array.from({ length: poles * 2 }, (_, i) => ({ n: i + 1, label: String(i + 1) })),
    footprint: { w: poles, h: 1.6 },
    init() { return { on: Array(poles).fill(false) }; },
    render(comp) {
      const w = poles * HOLE, h = 1.6 * HOLE;
      let html = `<div class="dip-switch-body" style="width:${w}px;height:${h}px">`;
      for (let i = 0; i < poles; i++) {
        html += `<div class="dip-pole ${comp.state.on[i] ? 'on' : 'off'}" data-pole="${i}"><div class="tab"></div></div>`;
      }
      return html + `</div>`;
    },
    onDomReady(comp, el) {
      el.querySelectorAll('.dip-pole').forEach(p => {
        p.addEventListener('pointerdown', e => {
          e.stopPropagation();
          const i = +p.dataset.pole;
          comp.state.on[i] = !comp.state.on[i];
          renderComponent(comp);
        });
      });
    },
    simulate(comp, def, levels, ctx) {
      for (let i = 0; i < poles; i++) {
        if (!comp.state.on[i]) continue;
        const p1 = 2 * i + 1, p2 = 2 * i + 2;
        const a = ctx.levelOf(levels, comp.id, p1);
        const b = ctx.levelOf(levels, comp.id, p2);
        if (a !== LEVEL.X) ctx.drive(comp.id, p2, a, STRENGTH.STRONG);
        if (b !== LEVEL.X) ctx.drive(comp.id, p1, b, STRENGTH.STRONG);
      }
    },
  };
}
makeDipSwitch('dip4', '4P DIP 스위치', 4);
makeDipSwitch('dip3', '3P DIP 스위치', 3);

PARTS['pot10k'] = {
  name: '10kΩ 전위차계', category: 'input',
  pins: [{ n: 1, label: 'T1' }, { n: 2, label: 'WIPER' }, { n: 3, label: 'T2' }],
  footprint: { w: 1.8, h: 1.8 },
  layout: { type: 'row', spacing: 1 },
  init() { return { ratio: 0.5 }; },
  render(comp) {
    const s = 1.8 * HOLE;
    return `<div class="pot-body" style="width:${s}px;height:${s}px">
      <input type="range" min="0" max="100" value="${Math.round(comp.state.ratio*100)}">
    </div>`;
  },
  onDomReady(comp, el) {
    const r = el.querySelector('input[type=range]');
    r.addEventListener('pointerdown', e => e.stopPropagation());
    r.addEventListener('input', e => { comp.state.ratio = (+e.target.value) / 100; });
  },
  // digital approximation: wiper reflects whichever terminal side the slider leans toward
  simulate(comp, def, levels, ctx) {
    const t1 = ctx.levelOf(levels, comp.id, 1);
    const t2 = ctx.levelOf(levels, comp.id, 3);
    const preferT1 = comp.state.ratio >= 0.5;
    const chosen = preferT1 ? t1 : t2;
    const other = preferT1 ? t2 : t1;
    if (chosen !== LEVEL.X) ctx.drive(comp.id, 2, chosen, STRENGTH.WEAK);
    else if (other !== LEVEL.X) ctx.drive(comp.id, 2, other, STRENGTH.WEAK);
    if (t1 !== LEVEL.X) ctx.drive(comp.id, 3, t1, STRENGTH.WEAK);
    if (t2 !== LEVEL.X) ctx.drive(comp.id, 1, t2, STRENGTH.WEAK);
  },
};

/* ---------- power components ---------- */
PARTS['adapter5v'] = {
  name: '정전압 5V 2A 어댑터', category: 'power',
  pins: [{ n: 1, label: 'VCC' }, { n: 2, label: 'GND' }],
  footprint: { w: 2.4, h: 1.6 },
  layout: { type: 'row', spacing: 2 },
  render(comp) {
    const w = 2.4 * HOLE, h = 1.6 * HOLE;
    return `<div class="power-body adapter-body" style="width:${w}px;height:${h}px">5V/2A<br>어댑터</div>`;
  },
  simulate(comp, def, levels, ctx) {
    ctx.drive(comp.id, 1, LEVEL.H, STRENGTH.POWER);
    ctx.drive(comp.id, 2, LEVEL.L, STRENGTH.POWER);
  },
};

PARTS['inlineswitch'] = {
  name: 'DC 인라인 전원 스위치', category: 'power',
  pins: [{ n: 1, label: 'IN' }, { n: 2, label: 'OUT' }],
  footprint: { w: 1.6, h: 1 },
  layout: { type: 'row', spacing: 2 },
  init() { return { on: true }; },
  render(comp) {
    const w = 1.6 * HOLE, h = HOLE;
    return `<div class="switch-body ${comp.state.on ? 'on' : ''}" style="width:${w}px;height:${h}px">${comp.state.on ? 'ON' : 'OFF'}</div>`;
  },
  onClick(comp) { comp.state.on = !comp.state.on; renderComponent(comp); },
  simulate(comp, def, levels, ctx) {
    if (!comp.state.on) return;
    const a = ctx.levelOf(levels, comp.id, 1);
    const b = ctx.levelOf(levels, comp.id, 2);
    if (a !== LEVEL.X) ctx.drive(comp.id, 2, a, STRENGTH.STRONG);
    if (b !== LEVEL.X) ctx.drive(comp.id, 1, b, STRENGTH.STRONG);
  },
};

PARTS['fuse1a'] = {
  name: '1A 리셋터블 퓨즈', category: 'power',
  pins: [{ n: 1, label: 'A' }, { n: 2, label: 'B' }],
  footprint: { w: 1.6, h: 0.8 },
  layout: { type: 'row', spacing: 2 },
  init() { return { tripped: false }; },
  render(comp) {
    const w = 1.6 * HOLE, h = 0.8 * HOLE;
    return `<div class="power-body fuse-body ${comp.state.tripped ? 'tripped' : ''}" style="width:${w}px;height:${h}px">${comp.state.tripped ? 'TRIP' : '1A'}</div>`;
  },
  onClick(comp) { comp.state.tripped = !comp.state.tripped; renderComponent(comp); },
  simulate(comp, def, levels, ctx) {
    if (comp.state.tripped) return;
    const a = ctx.levelOf(levels, comp.id, 1);
    const b = ctx.levelOf(levels, comp.id, 2);
    if (a !== LEVEL.X) ctx.drive(comp.id, 2, a, STRENGTH.STRONG);
    if (b !== LEVEL.X) ctx.drive(comp.id, 1, b, STRENGTH.STRONG);
  },
};

PARTS['dcjack'] = {
  name: 'DC 5.5×2.1mm 암잭 나사 터미널', category: 'power',
  pins: [{ n: 1, label: '+' }, { n: 2, label: '-' }],
  footprint: { w: 1.6, h: 1.2 },
  layout: { type: 'row', spacing: 2 },
  render(comp) {
    const w = 1.6 * HOLE, h = 1.2 * HOLE;
    return `<div class="power-body jack-body" style="width:${w}px;height:${h}px">DC 잭</div>`;
  },
  simulate(comp, def, levels, ctx) {
    const a = ctx.levelOf(levels, comp.id, 1);
    const b = ctx.levelOf(levels, comp.id, 2);
    if (a !== LEVEL.X) ctx.drive(comp.id, 2, a, STRENGTH.STRONG);
    if (b !== LEVEL.X) ctx.drive(comp.id, 1, b, STRENGTH.STRONG);
  },
};

/* ---------- jumper "catalog" entries (set active wire style) ---------- */
PARTS['wire_short'] = {
  name: '브레드보드 연결선', category: 'wire', isWireTool: true, wireStyle: 'short',
};
PARTS['wire_dupont'] = {
  name: '긴 Dupont 점퍼선', category: 'wire', isWireTool: true, wireStyle: 'long',
};

/* =========================================================================
 * PARTS registry (Part 3/5): logic-gate ICs, adder, multiplexer, decoders
 * All pinouts below were verified against manufacturer datasheets
 * (TI / Nexperia) rather than assumed from the generic 74xx family layout.
 * ========================================================================= */

function dipFootprint(pinCount) { return { w: pinCount / 2, h: 3 }; }

function renderDipBody(comp, def, label) {
  const n = def.pins.length;
  const w = (n / 2) * HOLE, h = 3 * HOLE;
  return `<div class="ic-body" style="width:${w}px;height:${h}px;position:relative">
    <div class="ic-notch"></div>${label}</div>`;
}

function makeQuad2InputGate(id, name, symbol, fn) {
  const pins = [
    { n: 1, label: '1A' }, { n: 2, label: '1B' }, { n: 3, label: '1Y' },
    { n: 4, label: '2A' }, { n: 5, label: '2B' }, { n: 6, label: '2Y' },
    { n: 7, label: 'GND' },
    { n: 8, label: '3Y' }, { n: 9, label: '3A' }, { n: 10, label: '3B' },
    { n: 11, label: '4Y' }, { n: 12, label: '4A' }, { n: 13, label: '4B' },
    { n: 14, label: 'VCC' },
  ];
  const gates = [
    { a: 1, b: 2, y: 3 }, { a: 4, b: 5, y: 6 },
    { a: 9, b: 10, y: 8 }, { a: 12, b: 13, y: 11 },
  ];
  PARTS[id] = {
    name, category: 'ic', kind: 'dip', pins,
    power: { vcc: 14, gnd: 7 },
    footprint: dipFootprint(14),
    render(comp) { return renderDipBody(comp, this, `${name.split(' ')[0]}<br>${symbol}`); },
    simulate(comp, def, levels, ctx) {
      if (!isPowered(comp, def, levels, ctx)) return;
      for (const g of gates) {
        const a = ctx.levelOf(levels, comp.id, g.a);
        const b = ctx.levelOf(levels, comp.id, g.b);
        if (a === LEVEL.X || b === LEVEL.X) continue;
        const y = fn(a === LEVEL.H, b === LEVEL.H) ? LEVEL.H : LEVEL.L;
        ctx.drive(comp.id, g.y, y, STRENGTH.STRONG);
      }
    },
  };
}
makeQuad2InputGate('hc08', '74HC08 AND 게이트', 'AND', (a, b) => a && b);
makeQuad2InputGate('hc32', '74HC32 OR 게이트', 'OR', (a, b) => a || b);
makeQuad2InputGate('hc86', '74HC86 XOR 게이트', 'XOR', (a, b) => a !== b);

PARTS['hc04'] = {
  name: '74HC04 NOT 게이트', category: 'ic', kind: 'dip',
  pins: [
    { n: 1, label: '1A' }, { n: 2, label: '1Y' }, { n: 3, label: '2A' }, { n: 4, label: '2Y' },
    { n: 5, label: '3A' }, { n: 6, label: '3Y' }, { n: 7, label: 'GND' },
    { n: 8, label: '4Y' }, { n: 9, label: '4A' }, { n: 10, label: '5Y' }, { n: 11, label: '5A' },
    { n: 12, label: '6Y' }, { n: 13, label: '6A' }, { n: 14, label: 'VCC' },
  ],
  power: { vcc: 14, gnd: 7 },
  footprint: dipFootprint(14),
  render(comp) { return renderDipBody(comp, this, `74HC04<br>NOT`); },
  simulate(comp, def, levels, ctx) {
    if (!isPowered(comp, def, levels, ctx)) return;
    const inv = [[1, 2], [3, 4], [5, 6], [9, 8], [11, 10], [13, 12]];
    for (const [a, y] of inv) {
      const av = ctx.levelOf(levels, comp.id, a);
      if (av === LEVEL.X) continue;
      ctx.drive(comp.id, y, av === LEVEL.H ? LEVEL.L : LEVEL.H, STRENGTH.STRONG);
    }
  },
};

/* ---- 74HC283 4-bit adder (verified pinout: sum/operand pins interleaved) ---- */
PARTS['hc283'] = {
  name: '74HC283 4비트 가산기', category: 'ic', kind: 'dip',
  pins: [
    { n: 1, label: 'S2' }, { n: 2, label: 'B2' }, { n: 3, label: 'A2' }, { n: 4, label: 'S1' },
    { n: 5, label: 'A1' }, { n: 6, label: 'B1' }, { n: 7, label: 'C0' }, { n: 8, label: 'GND' },
    { n: 9, label: 'C4' }, { n: 10, label: 'S4' }, { n: 11, label: 'B4' }, { n: 12, label: 'A4' },
    { n: 13, label: 'S3' }, { n: 14, label: 'A3' }, { n: 15, label: 'B3' }, { n: 16, label: 'VCC' },
  ],
  power: { vcc: 16, gnd: 8 },
  footprint: dipFootprint(16),
  render(comp) { return renderDipBody(comp, this, `74HC283<br>ADDER`); },
  simulate(comp, def, levels, ctx) {
    if (!isPowered(comp, def, levels, ctx)) return;
    const b = (n) => ctx.levelOf(levels, comp.id, n) === LEVEL.H ? 1 : 0;
    const anyX = [7, 5, 6, 3, 2, 14, 15, 12, 11].some(n => ctx.levelOf(levels, comp.id, n) === LEVEL.X);
    if (anyX) return;
    const A = b(5) | (b(3) << 1) | (b(14) << 2) | (b(12) << 3);
    const B = b(6) | (b(2) << 1) | (b(15) << 2) | (b(11) << 3);
    const sum = A + B + b(7);
    const sPins = [4, 1, 13, 10]; // S1,S2,S3,S4
    for (let i = 0; i < 4; i++) {
      ctx.drive(comp.id, sPins[i], (sum >> i) & 1 ? LEVEL.H : LEVEL.L, STRENGTH.STRONG);
    }
    ctx.drive(comp.id, 9, (sum >> 4) & 1 ? LEVEL.H : LEVEL.L, STRENGTH.STRONG); // C4
  },
};

/* ---- 74HC157 quad 2-input multiplexer ---- */
PARTS['hc157'] = {
  name: '74HC157 멀티플렉서', category: 'ic', kind: 'dip',
  pins: [
    { n: 1, label: 'S' }, { n: 2, label: '1I0' }, { n: 3, label: '1I1' }, { n: 4, label: '1Y' },
    { n: 5, label: '2I0' }, { n: 6, label: '2I1' }, { n: 7, label: '2Y' }, { n: 8, label: 'GND' },
    { n: 9, label: '3Y' }, { n: 10, label: '3I1' }, { n: 11, label: '3I0' }, { n: 12, label: '4Y' },
    { n: 13, label: '4I1' }, { n: 14, label: '4I0' }, { n: 15, label: 'E' }, { n: 16, label: 'VCC' },
  ],
  power: { vcc: 16, gnd: 8 },
  footprint: dipFootprint(16),
  render(comp) { return renderDipBody(comp, this, `74HC157<br>MUX`); },
  simulate(comp, def, levels, ctx) {
    if (!isPowered(comp, def, levels, ctx)) return;
    const s = ctx.levelOf(levels, comp.id, 1);
    const e = ctx.levelOf(levels, comp.id, 15);
    const chans = [
      { i0: 2, i1: 3, y: 4 }, { i0: 5, i1: 6, y: 7 },
      { i0: 11, i1: 10, y: 9 }, { i0: 14, i1: 13, y: 12 },
    ];
    if (e === LEVEL.H) {
      for (const c of chans) ctx.drive(comp.id, c.y, LEVEL.L, STRENGTH.STRONG);
      return;
    }
    if (e === LEVEL.X || s === LEVEL.X) return;
    for (const c of chans) {
      const sel = s === LEVEL.H ? c.i1 : c.i0;
      const v = ctx.levelOf(levels, comp.id, sel);
      if (v !== LEVEL.X) ctx.drive(comp.id, c.y, v, STRENGTH.STRONG);
    }
  },
};

/* ---- 74HC138 3-to-8 decoder ---- */
PARTS['hc138'] = {
  name: '74HC138 3-8 디코더', category: 'ic', kind: 'dip',
  pins: [
    { n: 1, label: 'A' }, { n: 2, label: 'B' }, { n: 3, label: 'C' }, { n: 4, label: 'G2A' },
    { n: 5, label: 'G2B' }, { n: 6, label: 'G1' }, { n: 7, label: 'Y7' }, { n: 8, label: 'GND' },
    { n: 9, label: 'Y6' }, { n: 10, label: 'Y5' }, { n: 11, label: 'Y4' }, { n: 12, label: 'Y3' },
    { n: 13, label: 'Y2' }, { n: 14, label: 'Y1' }, { n: 15, label: 'Y0' }, { n: 16, label: 'VCC' },
  ],
  power: { vcc: 16, gnd: 8 },
  footprint: dipFootprint(16),
  render(comp) { return renderDipBody(comp, this, `74HC138<br>DECODER`); },
  simulate(comp, def, levels, ctx) {
    if (!isPowered(comp, def, levels, ctx)) return;
    const yPins = [15, 14, 13, 12, 11, 10, 9, 7]; // Y0..Y7
    const g1 = ctx.levelOf(levels, comp.id, 6);
    const g2a = ctx.levelOf(levels, comp.id, 4);
    const g2b = ctx.levelOf(levels, comp.id, 5);
    const enabled = g1 === LEVEL.H && g2a === LEVEL.L && g2b === LEVEL.L;
    if (!enabled) {
      if (g1 === LEVEL.X || g2a === LEVEL.X || g2b === LEVEL.X) return;
      for (const y of yPins) ctx.drive(comp.id, y, LEVEL.H, STRENGTH.STRONG);
      return;
    }
    const a = ctx.levelOf(levels, comp.id, 1), b = ctx.levelOf(levels, comp.id, 2), c = ctx.levelOf(levels, comp.id, 3);
    if (a === LEVEL.X || b === LEVEL.X || c === LEVEL.X) return;
    const addr = (a === LEVEL.H ? 1 : 0) | (b === LEVEL.H ? 2 : 0) | (c === LEVEL.H ? 4 : 0);
    for (let i = 0; i < 8; i++) ctx.drive(comp.id, yPins[i], i === addr ? LEVEL.L : LEVEL.H, STRENGTH.STRONG);
  },
};

/* ---- 74HC139 dual 2-to-4 decoder ---- */
PARTS['hc139'] = {
  name: '74HC139 듀얼 2-4 디코더', category: 'ic', kind: 'dip',
  pins: [
    { n: 1, label: '1E' }, { n: 2, label: '1A0' }, { n: 3, label: '1A1' }, { n: 4, label: '1Y0' },
    { n: 5, label: '1Y1' }, { n: 6, label: '1Y2' }, { n: 7, label: '1Y3' }, { n: 8, label: 'GND' },
    { n: 9, label: '2Y3' }, { n: 10, label: '2Y2' }, { n: 11, label: '2Y1' }, { n: 12, label: '2Y0' },
    { n: 13, label: '2A1' }, { n: 14, label: '2A0' }, { n: 15, label: '2E' }, { n: 16, label: 'VCC' },
  ],
  power: { vcc: 16, gnd: 8 },
  footprint: dipFootprint(16),
  render(comp) { return renderDipBody(comp, this, `74HC139<br>DEC x2`); },
  simulate(comp, def, levels, ctx) {
    if (!isPowered(comp, def, levels, ctx)) return;
    const sections = [
      { e: 1, a0: 2, a1: 3, y: [4, 5, 6, 7] },
      { e: 15, a0: 14, a1: 13, y: [12, 11, 10, 9] },
    ];
    for (const s of sections) {
      const e = ctx.levelOf(levels, comp.id, s.e);
      if (e === LEVEL.H) { for (const y of s.y) ctx.drive(comp.id, y, LEVEL.H, STRENGTH.STRONG); continue; }
      if (e === LEVEL.X) continue;
      const a0 = ctx.levelOf(levels, comp.id, s.a0), a1 = ctx.levelOf(levels, comp.id, s.a1);
      if (a0 === LEVEL.X || a1 === LEVEL.X) continue;
      const addr = (a0 === LEVEL.H ? 1 : 0) | (a1 === LEVEL.H ? 2 : 0);
      for (let i = 0; i < 4; i++) ctx.drive(comp.id, s.y[i], i === addr ? LEVEL.L : LEVEL.H, STRENGTH.STRONG);
    }
  },
};

/* =========================================================================
 * PARTS registry (Part 4/5): NE555, 74HC161, 74HC273, 74HC245, CDP1824CE
 * ========================================================================= */

/* ---- NE555 timer, astable ("pulse output") mode ----
 * Frequency/duty are derived from the actual R1/R2/C the user wires up
 * (VCC -R1- pin7 -R2- pin6/2 -C- GND), matching real 555 astable formulas.
 */
PARTS['ne555'] = {
  name: 'NE555 타이머', category: 'ic', kind: 'dip',
  pins: [
    { n: 1, label: 'GND' }, { n: 2, label: 'TRIG' }, { n: 3, label: 'OUT' }, { n: 4, label: 'RESET' },
    { n: 5, label: 'CTRL' }, { n: 6, label: 'THRESH' }, { n: 7, label: 'DISCH' }, { n: 8, label: 'VCC' },
  ],
  power: { vcc: 8, gnd: 1 },
  footprint: dipFootprint(8),
  init() { return { phase: 'high', phaseElapsed: 0, out: LEVEL.L, statusMsg: 'RC망 필요' }; },
  render(comp) {
    const badge = comp.state.statusMsg ? `<div class="status-badge">${comp.state.statusMsg}</div>` : '';
    return renderDipBody(comp, this, `${badge}NE555`);
  },
  onTick(comp, def, prevLevelOf, dtMs, ctx) {
    const st = comp.state;
    const powered = prevLevelOf(comp.id, 8) === LEVEL.H && prevLevelOf(comp.id, 1) === LEVEL.L;
    if (!powered) { st.out = LEVEL.L; st.statusMsg = '전원 필요'; return; }
    const resetLv = prevLevelOf(comp.id, 4);
    if (resetLv === LEVEL.L) { st.out = LEVEL.L; st.phase = 'low'; st.phaseElapsed = 0; st.statusMsg = 'RESET'; return; }
    const nodeVcc = ctx.nodeOf(comp.id, 8);
    const nodeX = ctx.nodeOf(comp.id, 7);
    const nodeY = ctx.nodeOf(comp.id, 6);
    const nodeGnd = ctx.nodeOf(comp.id, 1);
    let R1 = null, R2 = null, C = null;
    for (const other of state.components) {
      const d2 = PARTS[other.type];
      if (!d2) continue;
      if (d2.category === 'resistor') {
        const set = new Set([ctx.nodeOf(other.id, 1), ctx.nodeOf(other.id, 2)]);
        if (set.has(nodeVcc) && set.has(nodeX)) R1 = d2.ohms;
        if (set.has(nodeX) && set.has(nodeY)) R2 = d2.ohms;
      } else if (d2.category === 'capacitor') {
        const set = new Set([ctx.nodeOf(other.id, 1), ctx.nodeOf(other.id, 2)]);
        if (set.has(nodeY) && set.has(nodeGnd)) C = d2.farads;
      }
    }
    if (!R1 || !R2 || !C) { st.out = LEVEL.L; st.statusMsg = 'RC망 필요(VCC-R1-7번, 7번-R2-6번, 6번-C-GND)'; return; }
    st.statusMsg = '';
    const tHigh = 0.693 * (R1 + R2) * C;
    const tLow = 0.693 * R2 * C;
    st.phaseElapsed += dtMs / 1000;
    if (st.phase === 'high') {
      st.out = LEVEL.H;
      if (st.phaseElapsed >= tHigh) { st.phase = 'low'; st.phaseElapsed = 0; }
    } else {
      st.out = LEVEL.L;
      if (st.phaseElapsed >= tLow) { st.phase = 'high'; st.phaseElapsed = 0; }
    }
  },
  simulate(comp, def, levels, ctx) {
    ctx.drive(comp.id, 3, comp.state.out === LEVEL.H ? LEVEL.H : LEVEL.L, STRENGTH.STRONG);
  },
};

/* ---- 74HC161 synchronous 4-bit counter ---- */
PARTS['hc161'] = {
  name: '74HC161 4비트 동기 카운터', category: 'ic', kind: 'dip',
  pins: [
    { n: 1, label: 'CLR' }, { n: 2, label: 'CLK' }, { n: 3, label: 'A' }, { n: 4, label: 'B' },
    { n: 5, label: 'C' }, { n: 6, label: 'D' }, { n: 7, label: 'ENP' }, { n: 8, label: 'GND' },
    { n: 9, label: 'LOAD' }, { n: 10, label: 'ENT' }, { n: 11, label: 'QD' }, { n: 12, label: 'QC' },
    { n: 13, label: 'QB' }, { n: 14, label: 'QA' }, { n: 15, label: 'RCO' }, { n: 16, label: 'VCC' },
  ],
  power: { vcc: 16, gnd: 8 },
  footprint: dipFootprint(16),
  init() { return { count: 0, lastClk: LEVEL.L }; },
  render(comp) { return renderDipBody(comp, this, `74HC161<div class="status-badge">Q=${comp.state.count}</div>`); },
  onTick(comp, def, prevLevelOf, dtMs, ctx) {
    const st = comp.state;
    const powered = prevLevelOf(comp.id, 16) === LEVEL.H && prevLevelOf(comp.id, 8) === LEVEL.L;
    if (!powered) { st.lastClk = prevLevelOf(comp.id, 2); return; }
    const clr = prevLevelOf(comp.id, 1);
    if (clr === LEVEL.L) { st.count = 0; st.lastClk = prevLevelOf(comp.id, 2); return; }
    const clk = prevLevelOf(comp.id, 2);
    if (st.lastClk === LEVEL.L && clk === LEVEL.H) {
      const load = prevLevelOf(comp.id, 9);
      if (load === LEVEL.L) {
        const bit = (n) => prevLevelOf(comp.id, n) === LEVEL.H ? 1 : 0;
        st.count = bit(3) | (bit(4) << 1) | (bit(5) << 2) | (bit(6) << 3);
      } else {
        const enp = prevLevelOf(comp.id, 7), ent = prevLevelOf(comp.id, 10);
        if (enp === LEVEL.H && ent === LEVEL.H) st.count = (st.count + 1) & 0xF;
      }
    }
    st.lastClk = clk;
  },
  simulate(comp, def, levels, ctx) {
    if (!isPowered(comp, def, levels, ctx)) return;
    const clr = ctx.levelOf(levels, comp.id, 1);
    const count = clr === LEVEL.L ? 0 : (comp.state.count ?? 0);
    const qPins = [14, 13, 12, 11]; // QA,QB,QC,QD
    for (let i = 0; i < 4; i++) ctx.drive(comp.id, qPins[i], (count >> i) & 1 ? LEVEL.H : LEVEL.L, STRENGTH.STRONG);
    const ent = ctx.levelOf(levels, comp.id, 10);
    if (ent !== LEVEL.X) ctx.drive(comp.id, 15, (ent === LEVEL.H && count === 15) ? LEVEL.H : LEVEL.L, STRENGTH.STRONG);
  },
};

/* ---- 74HC273 octal D flip-flop register ---- */
PARTS['hc273'] = {
  name: '74HC273 8비트 D 레지스터', category: 'ic', kind: 'dip',
  pins: [
    { n: 1, label: 'CLR' }, { n: 2, label: '1Q' }, { n: 3, label: '1D' }, { n: 4, label: '2D' },
    { n: 5, label: '2Q' }, { n: 6, label: '3Q' }, { n: 7, label: '3D' }, { n: 8, label: '4D' },
    { n: 9, label: '4Q' }, { n: 10, label: 'GND' }, { n: 11, label: 'CLK' }, { n: 12, label: '5Q' },
    { n: 13, label: '5D' }, { n: 14, label: '6D' }, { n: 15, label: '6Q' }, { n: 16, label: '7Q' },
    { n: 17, label: '7D' }, { n: 18, label: '8D' }, { n: 19, label: '8Q' }, { n: 20, label: 'VCC' },
  ],
  power: { vcc: 20, gnd: 10 },
  footprint: dipFootprint(20),
  init() { return { q: [0, 0, 0, 0, 0, 0, 0, 0], lastClk: LEVEL.L }; },
  render(comp) { return renderDipBody(comp, this, `74HC273<br>REGISTER`); },
  onTick(comp, def, prevLevelOf, dtMs, ctx) {
    const st = comp.state;
    const dPins = [3, 4, 7, 8, 13, 14, 17, 18];
    const powered = prevLevelOf(comp.id, 20) === LEVEL.H && prevLevelOf(comp.id, 10) === LEVEL.L;
    if (!powered) { st.lastClk = prevLevelOf(comp.id, 11); return; }
    const clr = prevLevelOf(comp.id, 1);
    if (clr === LEVEL.L) { st.q = [0, 0, 0, 0, 0, 0, 0, 0]; st.lastClk = prevLevelOf(comp.id, 11); return; }
    const clk = prevLevelOf(comp.id, 11);
    if (st.lastClk === LEVEL.L && clk === LEVEL.H) {
      for (let i = 0; i < 8; i++) {
        const dv = prevLevelOf(comp.id, dPins[i]);
        if (dv !== LEVEL.X) st.q[i] = dv === LEVEL.H ? 1 : 0;
      }
    }
    st.lastClk = clk;
  },
  simulate(comp, def, levels, ctx) {
    if (!isPowered(comp, def, levels, ctx)) return;
    const qPins = [2, 5, 6, 9, 12, 15, 16, 19];
    const q = comp.state.q || [0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 8; i++) ctx.drive(comp.id, qPins[i], q[i] ? LEVEL.H : LEVEL.L, STRENGTH.STRONG);
  },
};

/* ---- 74HC245 octal bus transceiver ---- */
PARTS['hc245'] = {
  name: '74HC245 8비트 버스 트랜시버', category: 'ic', kind: 'dip',
  pins: [
    { n: 1, label: 'DIR' }, { n: 2, label: 'A1' }, { n: 3, label: 'A2' }, { n: 4, label: 'A3' },
    { n: 5, label: 'A4' }, { n: 6, label: 'A5' }, { n: 7, label: 'A6' }, { n: 8, label: 'A7' },
    { n: 9, label: 'A8' }, { n: 10, label: 'GND' }, { n: 11, label: 'B8' }, { n: 12, label: 'B7' },
    { n: 13, label: 'B6' }, { n: 14, label: 'B5' }, { n: 15, label: 'B4' }, { n: 16, label: 'B3' },
    { n: 17, label: 'B2' }, { n: 18, label: 'B1' }, { n: 19, label: 'OE' }, { n: 20, label: 'VCC' },
  ],
  power: { vcc: 20, gnd: 10 },
  footprint: dipFootprint(20),
  render(comp) { return renderDipBody(comp, this, `74HC245<br>BUS XCVR`); },
  simulate(comp, def, levels, ctx) {
    if (!isPowered(comp, def, levels, ctx)) return;
    const oe = ctx.levelOf(levels, comp.id, 19);
    if (oe !== LEVEL.L) return; // HIGH or unknown -> both buses stay high-Z
    const dir = ctx.levelOf(levels, comp.id, 1);
    if (dir === LEVEL.X) return;
    const Apins = [2, 3, 4, 5, 6, 7, 8, 9], Bpins = [18, 17, 16, 15, 14, 13, 12, 11];
    for (let i = 0; i < 8; i++) {
      if (dir === LEVEL.H) {
        const v = ctx.levelOf(levels, comp.id, Apins[i]);
        if (v !== LEVEL.X) ctx.drive(comp.id, Bpins[i], v, STRENGTH.STRONG);
      } else {
        const v = ctx.levelOf(levels, comp.id, Bpins[i]);
        if (v !== LEVEL.X) ctx.drive(comp.id, Apins[i], v, STRENGTH.STRONG);
      }
    }
  },
};

/* ---- CDP1824CE static RAM ----
 * NOTE: the real RCA/Intersil CDP1824 datasheet specifies a 32-word x 8-bit
 * array (5 address lines, MA0-MA4), not 128x8 as is sometimes assumed online
 * (128x8 is the different, separate CDP1823 part). Modeled per the verified
 * CDP1824 pinout/truth table: CS (active-low chip select), MRD (active-low
 * read/output-enable), MWR (active-low write), shared bidirectional BUS0-7.
 */
PARTS['cdp1824'] = {
  name: 'CDP1824CE 정적 RAM (32x8)', category: 'ic', kind: 'dip',
  pins: [
    { n: 1, label: 'MA4' }, { n: 2, label: 'MA3' }, { n: 3, label: 'MA2' }, { n: 4, label: 'MA1' },
    { n: 5, label: 'MA0' }, { n: 6, label: 'BUS7' }, { n: 7, label: 'BUS6' }, { n: 8, label: 'BUS5' },
    { n: 9, label: 'VSS' }, { n: 10, label: 'BUS4' }, { n: 11, label: 'BUS3' }, { n: 12, label: 'BUS2' },
    { n: 13, label: 'BUS1' }, { n: 14, label: 'BUS0' }, { n: 15, label: 'CS' }, { n: 16, label: 'MRD' },
    { n: 17, label: 'MWR' }, { n: 18, label: 'VDD' },
  ],
  power: { vcc: 18, gnd: 9 },
  footprint: dipFootprint(18),
  init() { return { mem: new Array(32).fill(0) }; },
  render(comp) { return renderDipBody(comp, this, `CDP1824CE<br>32x8 SRAM`); },
  onTick(comp, def, prevLevelOf, dtMs, ctx) {
    const st = comp.state;
    const powered = prevLevelOf(comp.id, 18) === LEVEL.H && prevLevelOf(comp.id, 9) === LEVEL.L;
    if (!powered) return;
    const cs = prevLevelOf(comp.id, 15), mrd = prevLevelOf(comp.id, 16), mwr = prevLevelOf(comp.id, 17);
    if (cs !== LEVEL.L || mrd !== LEVEL.H || mwr !== LEVEL.L) return; // write mode only
    const maPins = [5, 4, 3, 2, 1]; // MA0..MA4
    let addr = 0;
    for (let i = 0; i < 5; i++) {
      const v = prevLevelOf(comp.id, maPins[i]);
      if (v === LEVEL.X) return;
      addr |= (v === LEVEL.H ? 1 : 0) << i;
    }
    const busPins = [14, 13, 12, 11, 10, 8, 7, 6]; // BUS0..BUS7
    let byte = 0;
    for (let i = 0; i < 8; i++) {
      const v = prevLevelOf(comp.id, busPins[i]);
      if (v === LEVEL.X) return;
      byte |= (v === LEVEL.H ? 1 : 0) << i;
    }
    st.mem[addr] = byte;
  },
  simulate(comp, def, levels, ctx) {
    if (!isPowered(comp, def, levels, ctx)) return;
    const cs = ctx.levelOf(levels, comp.id, 15), mrd = ctx.levelOf(levels, comp.id, 16);
    if (cs !== LEVEL.L || mrd !== LEVEL.L) return; // not in read mode -> leave bus high-Z
    const maPins = [5, 4, 3, 2, 1];
    let addr = 0;
    for (let i = 0; i < 5; i++) {
      const v = ctx.levelOf(levels, comp.id, maPins[i]);
      if (v === LEVEL.X) return;
      addr |= (v === LEVEL.H ? 1 : 0) << i;
    }
    const byte = comp.state.mem[addr] || 0;
    const busPins = [14, 13, 12, 11, 10, 8, 7, 6];
    for (let i = 0; i < 8; i++) ctx.drive(comp.id, busPins[i], (byte >> i) & 1 ? LEVEL.H : LEVEL.L, STRENGTH.STRONG);
  },
};

/* live status badges for a few stateful chips */
PARTS['led'].refresh = function (comp) {
  const body = comp.el.querySelector('.led-body');
  if (!body) return;
  const color = LED_COLORS[comp.state.color] || LED_COLORS.red;
  body.classList.toggle('lit', !!comp.state.lit);
  body.style.background = comp.state.lit ? color : '#333';
};
PARTS['ne555'].refresh = function (comp) {
  const badge = comp.el.querySelector('.status-badge');
  if (badge) badge.textContent = comp.state.statusMsg || '';
  const has = !!comp.state.statusMsg;
  if (badge) badge.style.display = has ? '' : 'none';
};
PARTS['hc161'].refresh = function (comp) {
  const badge = comp.el.querySelector('.status-badge');
  if (badge) badge.textContent = `Q=${comp.state.count}`;
};

PARTS['board_long'] = { name: '긴 브레드보드', category: 'board', isBoard: true };

/* =========================================================================
 * Rendering / placement / drag engine (Part 5/5)
 * ========================================================================= */
const ALL_ROWS = ['RTP', 'RTM', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'RBP', 'RBM'];

function getBaseOffsets(def) {
  if (def.__offs) return def.__offs;
  const n = def.pins.length;
  const offs = {};
  if (def.kind === 'dip' || (def.layout && def.layout.type === 'square2x2')) {
    const half = def.kind === 'dip' ? n / 2 : 2;
    const mirror = def.kind === 'dip';
    for (let i = 1; i <= half; i++) offs[i] = { dx: (i - 1) * HOLE, dy: 0 };
    for (let i = half + 1; i <= n; i++) {
      const localIdx = i - half - 1;
      const dxIdx = mirror ? (half - 1 - localIdx) : localIdx;
      offs[i] = { dx: dxIdx * HOLE, dy: 2 * HOLE };
    }
  } else {
    const spacing = (def.layout && def.layout.spacing) || 1;
    def.pins.forEach((p, idx) => { offs[p.n] = { dx: idx * spacing * HOLE, dy: 0 }; });
  }
  def.__offs = offs;
  return offs;
}

// Rotate a base offset map by a multiple of 90deg (clockwise) around the anchor pin (dx=dy=0).
// Safe for simple parts (their leads are flexible in reality, so any two independently-valid
// holes are fine at any angle) but NOT for a straddle part's 180deg case - see below.
function rotateOffsets(offs, rotDeg) {
  const turns = (((Math.round((rotDeg || 0) / 90)) % 4) + 4) % 4;
  if (turns === 0) return offs;
  const out = {};
  for (const k of Object.keys(offs)) {
    let { dx, dy } = offs[k];
    for (let t = 0; t < turns; t++) { const ndx = -dy, ndy = dx; dx = ndx; dy = ndy; }
    out[k] = { dx, dy };
  }
  return out;
}

// A DIP/square2x2 part physically straddles the board's one fixed trench, which is NOT
// symmetric (there's no matching gap on the other side of row E) - so naively rotating its
// coordinates 180deg would walk pins two rows the WRONG way and land them in-cluster, on the
// same column tie as a pin from the other row (an electrical short). A real 180deg flip keeps
// the part seated across the SAME trench; only which pins sit in row E vs row F, and their
// left-right order, changes. Compute that swap explicitly instead of rotating coordinates.
function getStraddleFlipOffsets(def) {
  if (def.__flipOffs) return def.__flipOffs;
  const n = def.pins.length;
  const half = def.kind === 'dip' ? n / 2 : 2;
  const mirror = def.kind === 'dip';
  const offs = {};
  for (let i = 1; i <= half; i++) {
    offs[i] = { dx: (half - i) * HOLE, dy: 2 * HOLE };
  }
  for (let i = half + 1; i <= n; i++) {
    const localIdx = i - half - 1;
    const dxIdx = mirror ? (half - 1 - localIdx) : localIdx;
    offs[i] = { dx: (half - 1 - dxIdx) * HOLE, dy: 0 };
  }
  def.__flipOffs = offs;
  return offs;
}

// Per-component pin offsets (base layout is cached on the def; rotation is applied per call
// since it's per-instance state, not per-part-type).
function getPinOffsets(def, rotDeg) {
  const base = getBaseOffsets(def);
  const turns = (((Math.round((rotDeg || 0) / 90)) % 4) + 4) % 4;
  if (turns === 0) return base;
  const isStraddle = def.kind === 'dip' || (def.layout && def.layout.type === 'square2x2');
  if (isStraddle && turns === 2) return getStraddleFlipOffsets(def);
  return rotateOffsets(base, rotDeg);
}

function boardHoleAbs(board, row, col) {
  const off = holePixelOffset(row, col);
  return { x: board.x + off.x, y: board.y + off.y };
}

// y-position (in HOLE-grid units, unscaled) of each named row - used to test whether a
// rotated pin offset lands on a real row (rows are mostly 1*HOLE apart, except the two
// rail gaps and the center trench between E/F, which are 2*HOLE).
const ROW_Y_UNITS = {};
ALL_ROWS.forEach(r => { ROW_Y_UNITS[r] = holePixelOffset(r, 1).y; });
const Y_UNIT_TO_ROW = {};
ALL_ROWS.forEach(r => { Y_UNIT_TO_ROW[ROW_Y_UNITS[r]] = r; });

// Generic hole-snap solver: works for any pin-offset layout (row, square2x2, dip; any
// 90deg rotation) by checking whether, for some candidate anchor row/column on some board,
// every pin's rotated offset lands exactly on a real hole. A DIP part can only physically
// sit straddling a board's center trench, so any drop reasonably near a board snaps there
// (column clamped to a valid range) instead of requiring the cursor on the trench line;
// rotated orientations that don't line up with any real row span (e.g. a 14-pin DIP turned
// 90deg) simply find no valid placement and stay unsnapped/free-floating.
function findGenericSnap(offsets, x, y) {
  const margin = HOLE * 2;
  let best = null;
  for (const board of state.boards) {
    const width = board.cols * HOLE + 20;
    const height = BB_HEIGHT_UNITS * HOLE + 28;
    if (x < board.x - margin || x > board.x + width + margin) continue;
    if (y < board.y - margin || y > board.y + height + margin) continue;
    const anchorCol = Math.round((x - board.x - 10) / HOLE) + 1;
    const anchorX = board.x + (anchorCol - 1) * HOLE + 10;
    for (const row of ALL_ROWS) {
      const anchorY = board.y + ROW_Y_UNITS[row];
      const dist = Math.hypot(x - anchorX, y - anchorY);
      if (best && dist >= best.dist) continue;
      const plug = {};
      let ok = true;
      for (const pinNum of Object.keys(offsets)) {
        const off = offsets[pinNum];
        const targetRow = Y_UNIT_TO_ROW[ROW_Y_UNITS[row] + off.dy];
        if (targetRow === undefined) { ok = false; break; }
        const targetCol = anchorCol + off.dx / HOLE;
        if (targetCol < 1 || targetCol > board.cols) { ok = false; break; }
        plug[pinNum] = { boardId: board.id, row: targetRow, col: targetCol };
      }
      if (!ok) continue;
      best = { board, col: anchorCol, row, dist, plug };
    }
  }
  return best;
}

function clearPinPlugs(comp) { comp.pinPlug = {}; }

function applySnap(comp, def, x, y) {
  clearPinPlugs(comp);
  if (def.isBoard) return false;
  const offsets = getPinOffsets(def, comp.rot || 0);
  const snap = findGenericSnap(offsets, x, y);
  if (snap) {
    comp.x = snap.board.x + (snap.col - 1) * HOLE + 10;
    comp.y = snap.board.y + ROW_Y_UNITS[snap.row];
    comp.pinPlug = snap.plug;
    return true;
  }
  comp.x = x; comp.y = y;
  return false;
}

function workspacePointFromClient(cx, cy) {
  const rect = document.getElementById('workspace').getBoundingClientRect();
  const lx = cx - rect.left, ly = cy - rect.top;
  return { x: (lx - state.view.panX) / state.view.zoom, y: (ly - state.view.panY) / state.view.zoom };
}

function renderBoardDom(board) {
  const el = document.createElement('div');
  el.className = 'comp breadboard';
  el.style.left = board.x + 'px';
  el.style.top = board.y + 'px';
  const width = board.cols * HOLE + 20, height = BB_HEIGHT_UNITS * HOLE + 28;
  el.style.width = width + 'px';
  el.style.height = height + 'px';
  board.holeEls = [];
  for (const row of ALL_ROWS) {
    const isRail = row === 'RTP' || row === 'RTM' || row === 'RBP' || row === 'RBM';
    for (let c = 1; c <= board.cols; c++) {
      const off = holePixelOffset(row, c);
      const hole = document.createElement('div');
      hole.className = 'hole';
      hole.dataset.board = board.id; hole.dataset.row = row; hole.dataset.col = c;
      hole.style.position = 'absolute';
      hole.style.left = (off.x - 4) + 'px';
      hole.style.top = (off.y - 4) + 'px';
      el.appendChild(hole);
      board.holeEls.push({ el: hole, boardId: board.id, row, col: c });
    }
    if (isRail) {
      const line = document.createElement('div');
      line.className = 'rail-line';
      line.style.position = 'absolute';
      line.style.top = (holePixelOffset(row, 1).y) + 'px';
      line.style.left = '4px'; line.style.right = '4px'; line.style.height = '2px';
      line.style.background = (row === 'RTP' || row === 'RBP') ? '#c0392b' : '#2c3e91';
      el.appendChild(line);
    }
  }
  const delBtn = document.createElement('div');
  delBtn.textContent = '✕';
  delBtn.title = '브레드보드 삭제';
  delBtn.style.cssText = 'position:absolute;top:2px;right:4px;cursor:pointer;color:#933;font-size:12px;font-weight:bold;z-index:30;';
  delBtn.addEventListener('pointerdown', e => { e.stopPropagation(); });
  delBtn.addEventListener('click', e => { e.stopPropagation(); pushHistory(); deleteBoard(board); });
  el.appendChild(delBtn);
  el.addEventListener('pointerdown', e => {
    if (e.target.closest('.hole')) return;
    startDragBoard(e, board);
  });
  document.getElementById('componentsLayer').appendChild(el);
  board.el = el;
  state.holeEls.push(...board.holeEls);
}

function startDragBoard(e, board) {
  e.stopPropagation();
  const startX = e.clientX, startY = e.clientY;
  const origX = board.x, origY = board.y;
  const attached = state.components.filter(c => Object.values(c.pinPlug).some(p => p.boardId === board.id));
  const origins = attached.map(c => ({ comp: c, x: c.x, y: c.y }));
  let dragging = false;
  let historyPushed = false;
  function cancel() {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    board.x = origX; board.y = origY;
    board.el.style.left = board.x + 'px';
    board.el.style.top = board.y + 'px';
    for (const o of origins) {
      o.comp.x = o.x; o.comp.y = o.y;
      o.comp.el.style.left = o.comp.x + 'px';
      o.comp.el.style.top = o.comp.y + 'px';
    }
    if (historyPushed) state.history.past.pop();
    state.activeDrag = null;
  }
  function move(ev) {
    const dx = (ev.clientX - startX) / state.view.zoom;
    const dy = (ev.clientY - startY) / state.view.zoom;
    if (!dragging && Math.hypot(dx, dy) > 3) {
      dragging = true;
      pushHistory(); historyPushed = true;
      state.activeDrag = { cancel };
    }
    if (!dragging) return;
    board.x = origX + dx; board.y = origY + dy;
    board.el.style.left = board.x + 'px';
    board.el.style.top = board.y + 'px';
    for (const o of origins) {
      o.comp.x = o.x + dx; o.comp.y = o.y + dy;
      o.comp.el.style.left = o.comp.x + 'px';
      o.comp.el.style.top = o.comp.y + 'px';
    }
  }
  function up() {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    state.activeDrag = null;
    if (!dragging) selectBoard(board);
  }
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}

function deleteBoard(board) {
  board.el.remove();
  state.boards = state.boards.filter(b => b !== board);
  state.holeEls = state.holeEls.filter(h => h.boardId !== board.id);
  for (const comp of state.components) {
    for (const pin of Object.keys(comp.pinPlug)) {
      if (comp.pinPlug[pin].boardId === board.id) delete comp.pinPlug[pin];
    }
  }
  state.wires = state.wires.filter(w =>
    !((w.a.kind === 'hole' && w.a.boardId === board.id) || (w.b.kind === 'hole' && w.b.boardId === board.id))
  );
}

function renderComponentInner(comp, def) {
  const rot = comp.rot || 0;
  const turns = (((Math.round(rot / 90)) % 4) + 4) % 4;
  const offs = getPinOffsets(def, rot);
  const isStraddle = def.kind === 'dip' || (def.layout && def.layout.type === 'square2x2');
  const bodyHtml = def.render ? def.render(comp) : '';
  const isDip = def.kind === 'dip';
  const bodyLeft = -6;
  const bodyTop = isDip ? -14 : -6;
  // The body graphic rotates as a rigid CSS transform. At 90/270deg it pivots on the anchor
  // pin (dx=dy=0), matching the coordinate-rotated pin offsets. At 180deg a straddle part
  // uses the explicit row/column swap (getStraddleFlipOffsets) instead of coordinate math
  // (see its comment), so the body must pivot on the pin cluster's own center to stay lined
  // up with it, not on the anchor pin (which itself moved to a corner under the swap).
  let originX = -bodyLeft, originY = -bodyTop;
  if (isStraddle && turns === 2) {
    const half = def.kind === 'dip' ? def.pins.length / 2 : 2;
    originX = -bodyLeft + (half - 1) * HOLE / 2;
    originY = -bodyTop + HOLE;
  }
  const bodyTransform = rot ? ` transform:rotate(${rot}deg);transform-origin:${originX}px ${originY}px;` : '';
  comp.el.innerHTML = `<div class="body-wrap" style="position:absolute;left:${bodyLeft}px;top:${bodyTop}px;${bodyTransform}">${bodyHtml}</div>`;
  // For a straddle-kind part, pin-number labels need to be nudged OUTWARD off the body, away
  // from the centered part-name text. Which screen axis is "outward" depends on rotation: at
  // 0/180deg the two pin-rows differ in dy (the short axis) with dx spanning the long row, so
  // labels nudge along dy. At 90/270deg coordinate-rotation swaps that - the two rows now
  // differ in dx while dy spans the long row - so labels must nudge along dx instead, or they
  // land deep inside the (also-rotated) body next to the name text instead of beside the pins.
  let thinAxis = null, thinMin = 0, thinMax = 0;
  if (isStraddle) {
    thinAxis = (turns === 1 || turns === 3) ? 'dx' : 'dy';
    const vals = def.pins.map(p => offs[p.n][thinAxis]);
    thinMin = Math.min(...vals); thinMax = Math.max(...vals);
  }
  for (const p of def.pins) {
    const off = offs[p.n];
    const pinEl = document.createElement('div');
    pinEl.className = 'pin';
    pinEl.dataset.comp = comp.id; pinEl.dataset.pin = p.n;
    pinEl.title = `${def.name} - pin ${p.n} (${p.label})`;
    pinEl.style.left = (off.dx - 5) + 'px';
    pinEl.style.top = (off.dy - 5) + 'px';
    comp.el.appendChild(pinEl);
    state.pinEls.push({ el: pinEl, compId: comp.id, pinNum: p.n });
    const lbl = document.createElement('div');
    lbl.className = 'pin-label';
    if (isStraddle && thinMax > thinMin) {
      const isNearSide = off[thinAxis] === thinMin;
      if (thinAxis === 'dy') {
        lbl.style.left = (off.dx - 3) + 'px';
        lbl.style.top = (isNearSide ? off.dy - 12 : off.dy + 11) + 'px';
      } else {
        lbl.style.left = (isNearSide ? off.dx - 14 : off.dx + 8) + 'px';
        lbl.style.top = (off.dy - 3) + 'px';
      }
    } else {
      lbl.style.left = (off.dx - 3) + 'px';
      lbl.style.top = (off.dy + 11) + 'px';
    }
    lbl.textContent = p.n;
    comp.el.appendChild(lbl);
  }
  if (def.onDomReady) def.onDomReady(comp, comp.el);
}

function renderComponent(comp) {
  const def = PARTS[comp.type];
  if (!def || !comp.el) return;
  state.pinEls = state.pinEls.filter(p => p.compId !== comp.id);
  renderComponentInner(comp, def);
}

function createComponentDom(comp, def) {
  const wrap = document.createElement('div');
  wrap.className = 'comp part-body';
  wrap.dataset.compId = comp.id;
  wrap.style.left = comp.x + 'px';
  wrap.style.top = comp.y + 'px';
  document.getElementById('componentsLayer').appendChild(wrap);
  comp.el = wrap;
  renderComponentInner(comp, def);
  if (def.onPointerDown || def.onPointerUp) {
    wrap.addEventListener('pointerdown', e => {
      if (e.target.closest('.pin')) return;
      e.stopPropagation();
      if (def.onPointerDown) def.onPointerDown(comp);
      selectComponent(comp);
      const up = () => { if (def.onPointerUp) def.onPointerUp(comp); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointerup', up);
    });
  } else {
    wrap.addEventListener('pointerdown', e => {
      if (e.target.closest('.pin,input,select,.dip-pole')) return;
      startDragComponent(e, comp, def);
    });
  }
}

function startDragComponent(e, comp, def) {
  e.stopPropagation();
  const startX = e.clientX, startY = e.clientY;
  const origX = comp.x, origY = comp.y;
  const origPinPlug = { ...comp.pinPlug };
  let dragging = false;
  let historyPushed = false;
  function cancel() {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    comp.x = origX; comp.y = origY; comp.pinPlug = origPinPlug;
    comp.el.style.left = comp.x + 'px';
    comp.el.style.top = comp.y + 'px';
    if (historyPushed) state.history.past.pop();
    state.activeDrag = null;
  }
  function move(ev) {
    const dx = (ev.clientX - startX) / state.view.zoom, dy = (ev.clientY - startY) / state.view.zoom;
    if (!dragging && Math.hypot(dx, dy) > 4) {
      dragging = true;
      pushHistory(); historyPushed = true;
      state.activeDrag = { cancel };
    }
    if (dragging) {
      comp.x = origX + dx; comp.y = origY + dy;
      comp.el.style.left = comp.x + 'px';
      comp.el.style.top = comp.y + 'px';
    }
  }
  function up() {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    if (dragging) {
      applySnap(comp, def, comp.x, comp.y);
      comp.el.style.left = comp.x + 'px';
      comp.el.style.top = comp.y + 'px';
      state.activeDrag = null;
    } else {
      selectComponent(comp);
      if (def.onClick) { def.onClick(comp); }
    }
  }
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}

function placeComponent(partId, dropX, dropY) {
  const def = PARTS[partId];
  if (!def) return null;
  if (def.isWireTool) {
    state.activeWireStyle = def.wireStyle;
    const lbl = document.getElementById('wireStyleLabel');
    if (lbl) lbl.textContent = `스타일: ${def.name}`;
    return null;
  }
  pushHistory();
  if (def.isBoard) {
    const board = createBoard(dropX, dropY);
    renderBoardDom(board);
    return board;
  }
  const comp = { id: uid('c'), type: partId, x: dropX, y: dropY, rot: 0, pinPlug: {}, state: def.init ? def.init() : {} };
  applySnap(comp, def, dropX, dropY);
  state.components.push(comp);
  createComponentDom(comp, def);
  selectComponent(comp);
  return comp;
}

/* ---------------- Wiring interaction (click-click / click-drag hybrid) ---------------- */
function pinWorldPos(compId, pinNum) {
  const comp = getComponent(compId);
  if (!comp) return null;
  const def = PARTS[comp.type];
  const off = getPinOffsets(def, comp.rot || 0)[pinNum];
  if (!off) return null;
  return { x: comp.x + off.dx, y: comp.y + off.dy };
}
function connectorWorldPos(ref) {
  if (ref.kind === 'hole') {
    const board = getBoard(ref.boardId);
    if (!board) return null;
    return boardHoleAbs(board, ref.row, ref.col);
  }
  return pinWorldPos(ref.compId, ref.pinNum);
}
function connectorRefFromEl(el) {
  if (el.classList.contains('hole')) {
    return { kind: 'hole', boardId: el.dataset.board, row: el.dataset.row, col: +el.dataset.col };
  }
  return { kind: 'pin', compId: el.dataset.comp, pinNum: +el.dataset.pin };
}
function sameConnector(a, b) {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'hole') return a.boardId === b.boardId && a.row === b.row && a.col === b.col;
  return a.compId === b.compId && a.pinNum === b.pinNum;
}
function clearPending() {
  if (state.pendingEl) state.pendingEl.classList.remove('pending');
  state.pendingWire = null; state.pendingEl = null; state.pendingCursor = null;
}
function finishWire(a, b) {
  pushHistory();
  state.wires.push({ id: uid('w'), a, b, color: state.activeWireColor, style: state.activeWireStyle, points: [] });
}
function handleConnectorDown(el, e) {
  const ref = connectorRefFromEl(el);
  if (state.pendingWire) {
    if (!sameConnector(ref, state.pendingWire)) finishWire(state.pendingWire, ref);
    clearPending();
    return;
  }
  state.pendingWire = ref;
  state.pendingEl = el;
  el.classList.add('pending');
  state.pendingCursor = workspacePointFromClient(e.clientX, e.clientY);
}
/* ---------------- Undo/redo history + clipboard ---------------- */
function serializeState() {
  return JSON.parse(JSON.stringify({
    boards: state.boards.map(b => ({ id: b.id, x: b.x, y: b.y, cols: b.cols })),
    components: state.components.map(c => ({ id: c.id, type: c.type, x: c.x, y: c.y, rot: c.rot || 0, pinPlug: c.pinPlug, state: c.state })),
    wires: state.wires.map(w => ({ id: w.id, a: w.a, b: w.b, color: w.color, style: w.style, points: w.points || [] })),
  }));
}
function restoreState(snap) {
  document.getElementById('componentsLayer').innerHTML = '';
  state.boards = []; state.components = []; state.wires = [];
  state.holeEls = []; state.pinEls = []; state.selection = null;
  clearPending();
  for (const bd of snap.boards) {
    const board = { id: bd.id, x: bd.x, y: bd.y, cols: bd.cols };
    state.boards.push(board);
    renderBoardDom(board);
  }
  for (const cd of snap.components) {
    const def = PARTS[cd.type];
    if (!def) continue;
    const comp = { id: cd.id, type: cd.type, x: cd.x, y: cd.y, rot: cd.rot || 0, pinPlug: cd.pinPlug || {}, state: cd.state };
    state.components.push(comp);
    createComponentDom(comp, def);
  }
  state.wires = snap.wires.map(w => ({ ...w, points: (w.points || []).map(p => ({ ...p })) }));
}
function pushHistory() {
  state.history.past.push(serializeState());
  if (state.history.past.length > 60) state.history.past.shift();
  state.history.future = [];
}
function undo() {
  if (!state.history.past.length) return;
  const cur = serializeState();
  const prev = state.history.past.pop();
  state.history.future.push(cur);
  restoreState(prev);
}
function redo() {
  if (!state.history.future.length) return;
  const cur = serializeState();
  const next = state.history.future.pop();
  state.history.past.push(cur);
  restoreState(next);
}
function copySelection() {
  if (!state.selection || state.selection.kind !== 'comp') return;
  const comp = getComponent(state.selection.id);
  if (!comp) return;
  state.clipboard = JSON.parse(JSON.stringify({ type: comp.type, rot: comp.rot || 0, x: comp.x, y: comp.y, state: comp.state }));
  state.pasteCount = 0;
}
function pasteClipboard() {
  if (!state.clipboard) return;
  const def = PARTS[state.clipboard.type];
  if (!def) return;
  pushHistory();
  state.pasteCount = (state.pasteCount || 0) + 1;
  const offset = state.pasteCount * HOLE * 2;
  const comp = {
    id: uid('c'), type: state.clipboard.type,
    x: state.clipboard.x + offset, y: state.clipboard.y + offset,
    rot: state.clipboard.rot || 0,
    pinPlug: {},
    state: JSON.parse(JSON.stringify(state.clipboard.state)),
  };
  applySnap(comp, def, comp.x, comp.y);
  state.components.push(comp);
  createComponentDom(comp, def);
  selectComponent(comp);
}
function rotateComponent(comp) {
  const def = PARTS[comp.type];
  if (!def || def.isBoard) return;
  pushHistory();
  comp.rot = ((comp.rot || 0) + 90) % 360;
  applySnap(comp, def, comp.x, comp.y);
  renderComponent(comp);
  comp.el.style.left = comp.x + 'px';
  comp.el.style.top = comp.y + 'px';
}

/* ---------------- Bendable jumper wires ---------------- */
// Smooth path through arbitrary points (exact at the endpoints, curved near the rest) -
// used once a wire has user-added bend points; the default (no bends) keeps the original
// fixed droop curve so untouched wires look exactly as before.
function smoothPath(pts) {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 2; i++) {
    const mid = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
    d += ` Q ${pts[i].x} ${pts[i].y} ${mid.x} ${mid.y}`;
  }
  const n = pts.length;
  d += ` Q ${pts[n - 2].x} ${pts[n - 2].y} ${pts[n - 1].x} ${pts[n - 1].y}`;
  return d;
}
function distToSegment(p, v, w) {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}
function nearestPointIndex(pts, x, y, threshold) {
  let best = -1, bestDist = threshold;
  pts.forEach((p, i) => { const d = Math.hypot(p.x - x, p.y - y); if (d < bestDist) { bestDist = d; best = i; } });
  return best;
}
function insertIndexForClick(a, pts, b, x, y) {
  const poly = [a, ...pts, b];
  let bestSeg = 0, bestDist = Infinity;
  for (let i = 0; i < poly.length - 1; i++) {
    const d = distToSegment({ x, y }, poly[i], poly[i + 1]);
    if (d < bestDist) { bestDist = d; bestSeg = i; }
  }
  return bestSeg;
}
function startWireBendDrag(e, wire) {
  if (!wire.points) wire.points = [];
  const startWorld = workspacePointFromClient(e.clientX, e.clientY);
  const a = connectorWorldPos(wire.a), b = connectorWorldPos(wire.b);
  if (!a || !b) return;
  pushHistory();
  let idx = nearestPointIndex(wire.points, startWorld.x, startWorld.y, 14);
  const isNew = idx === -1;
  if (isNew) {
    idx = insertIndexForClick(a, wire.points, b, startWorld.x, startWorld.y);
    wire.points.splice(idx, 0, { x: startWorld.x, y: startWorld.y });
  }
  let dragging = false;
  function move(ev) {
    const p = workspacePointFromClient(ev.clientX, ev.clientY);
    if (Math.hypot(p.x - startWorld.x, p.y - startWorld.y) > 2) dragging = true;
    wire.points[idx] = { x: p.x, y: p.y };
  }
  function up() {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    if (!dragging) {
      // plain click, not a drag: discard the speculative bend point and the history entry
      if (isNew) wire.points.splice(idx, 1);
      state.history.past.pop();
    }
  }
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}
function removeNearestBendPoint(wire, x, y) {
  const idx = nearestPointIndex(wire.points || [], x, y, 14);
  if (idx === -1) return false;
  pushHistory();
  wire.points.splice(idx, 1);
  return true;
}

function setupWiringHandlers() {
  const layer = document.getElementById('componentsLayer');
  layer.addEventListener('pointerdown', e => {
    const el = e.target.closest('.hole,.pin');
    if (!el) return;
    e.stopPropagation();
    handleConnectorDown(el, e);
  });
  document.addEventListener('pointermove', e => {
    if (!state.pendingWire) return;
    state.pendingCursor = workspacePointFromClient(e.clientX, e.clientY);
  });
  document.addEventListener('pointerup', e => {
    if (!state.pendingWire) return;
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const target = hit && hit.closest('.hole,.pin');
    if (target) {
      const ref = connectorRefFromEl(target);
      if (!sameConnector(ref, state.pendingWire)) finishWire(state.pendingWire, ref);
      clearPending();
    }
  });
  const wireLayer = document.getElementById('wireLayer');
  wireLayer.addEventListener('pointerdown', e => {
    const path = e.target.closest('path.wire');
    if (!path) return;
    e.stopPropagation();
    const wire = state.wires.find(w => w.id === path.dataset.wireId);
    if (wire) startWireBendDrag(e, wire);
  });
  wireLayer.addEventListener('dblclick', e => {
    const path = e.target.closest('path.wire');
    if (!path) return;
    const wire = state.wires.find(w => w.id === path.dataset.wireId);
    if (!wire) return;
    const pt = workspacePointFromClient(e.clientX, e.clientY);
    removeNearestBendPoint(wire, pt.x, pt.y);
  });
  wireLayer.addEventListener('click', e => {
    const path = e.target.closest('path.wire');
    if (path) selectWire(path.dataset.wireId);
  });
  // Right-click while a wire endpoint is pending (first click already made) cancels it,
  // same as Escape - it should not also open the browser's context menu.
  document.addEventListener('contextmenu', e => {
    if (state.pendingWire) { e.preventDefault(); clearPending(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (state.activeDrag) state.activeDrag.cancel();
      clearPending();
      return;
    }
    const typing = e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.isContentEditable;
    if (typing) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelection(); return; }
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && !e.shiftKey && key === 'z') { e.preventDefault(); undo(); return; }
    if (mod && (key === 'y' || (e.shiftKey && key === 'z'))) { e.preventDefault(); redo(); return; }
    if (mod && key === 'c') { e.preventDefault(); copySelection(); return; }
    if (mod && key === 'v') { e.preventDefault(); pasteClipboard(); return; }
    if (!mod && key === 'r' && state.selection && state.selection.kind === 'comp') {
      const comp = getComponent(state.selection.id);
      if (comp) rotateComponent(comp);
    }
  });
}

/* ---------------- Selection / deletion ---------------- */
function clearSelectionVisual() {
  document.querySelectorAll('.part-body.selected').forEach(e => e.classList.remove('selected'));
  document.querySelectorAll('.breadboard.selected').forEach(e => e.classList.remove('selected'));
}
function selectComponent(comp) {
  clearSelectionVisual();
  state.selection = { kind: 'comp', id: comp.id };
  comp.el.classList.add('selected');
}
function selectBoard(board) {
  clearSelectionVisual();
  state.selection = { kind: 'board', id: board.id };
  board.el.classList.add('selected');
}
function selectWire(wireId) {
  clearSelectionVisual();
  state.selection = { kind: 'wire', id: wireId };
}
function refUsesComp(ref, compId) { return ref.kind === 'pin' && ref.compId === compId; }
function deleteSelection() {
  if (!state.selection) return;
  pushHistory();
  if (state.selection.kind === 'comp') {
    const comp = getComponent(state.selection.id);
    if (comp) {
      comp.el.remove();
      state.components = state.components.filter(c => c !== comp);
      state.pinEls = state.pinEls.filter(p => p.compId !== comp.id);
      state.wires = state.wires.filter(w => !(refUsesComp(w.a, comp.id) || refUsesComp(w.b, comp.id)));
    }
  } else if (state.selection.kind === 'wire') {
    state.wires = state.wires.filter(w => w.id !== state.selection.id);
  } else if (state.selection.kind === 'board') {
    const board = getBoard(state.selection.id);
    if (board) deleteBoard(board);
  }
  state.selection = null;
}

/* ---------------- Visual refresh (per frame) ---------------- */
function levelClass(lvl, conflict) {
  if (conflict) return 'energized-x';
  if (lvl === LEVEL.H) return 'energized-h';
  if (lvl === LEVEL.L) return 'energized-l';
  return '';
}
function applyLevelClass(el, cls) {
  if (el.dataset.lvl === cls) return;
  el.classList.remove('energized-h', 'energized-l', 'energized-x');
  if (cls) el.classList.add(cls);
  el.dataset.lvl = cls;
}
function updateHoleVisuals() {
  if (!state.lastUF) return;
  for (const h of state.holeEls) {
    const section = holeSection(h.row);
    const tie = holeTie(h.boardId, section, h.col);
    const root = state.lastUF.find(tie);
    const lvl = state.nodeLevels.get(root) ?? LEVEL.X;
    applyLevelClass(h.el, levelClass(lvl, state.nodeConflict.has(root)));
  }
}
function updatePinVisuals() {
  if (!state.lastCtx) return;
  for (const p of state.pinEls) {
    const root = state.lastCtx.nodeOf(p.compId, p.pinNum);
    const lvl = state.nodeLevels.get(root) ?? LEVEL.X;
    applyLevelClass(p.el, levelClass(lvl, state.nodeConflict.has(root)));
  }
}
function updateWires() {
  const svg = document.getElementById('wireLayer');
  svg.innerHTML = '';
  for (const w of state.wires) {
    const a = connectorWorldPos(w.a), b = connectorWorldPos(w.b);
    if (!a || !b) continue;
    let d;
    if (w.points && w.points.length) {
      d = smoothPath([a, ...w.points, b]);
    } else {
      const droop = w.style === 'short' ? 8 : 30;
      const midY = (a.y + b.y) / 2 + droop;
      d = `M ${a.x} ${a.y} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`;
    }
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    let cls = 'wire';
    if (state.selection && state.selection.kind === 'wire' && state.selection.id === w.id) cls += ' selected';
    const root = state.lastUF ? state.lastUF.find(connectorPointId(w.a)) : null;
    if (root != null && state.nodeConflict.has(root)) cls += ' conflict';
    path.setAttribute('class', cls);
    path.setAttribute('stroke', w.color);
    path.setAttribute('stroke-width', '3');
    path.setAttribute('fill', 'none');
    path.dataset.wireId = w.id;
    svg.appendChild(path);
    if (w.points) {
      for (const p of w.points) {
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        handle.setAttribute('cx', p.x); handle.setAttribute('cy', p.y); handle.setAttribute('r', 3.5);
        handle.setAttribute('class', 'wire-bend-handle');
        handle.style.pointerEvents = 'none';
        svg.appendChild(handle);
      }
    }
  }
  if (state.pendingWire) {
    const a = connectorWorldPos(state.pendingWire);
    const c = state.pendingCursor;
    if (a && c) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${a.x} ${a.y} L ${c.x} ${c.y}`);
      path.setAttribute('stroke', state.activeWireColor);
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-dasharray', '4 3');
      path.setAttribute('fill', 'none');
      path.style.pointerEvents = 'none';
      svg.appendChild(path);
    }
  }
}
function render() {
  updateHoleVisuals();
  updatePinVisuals();
  updateWires();
  for (const comp of state.components) {
    const def = PARTS[comp.type];
    if (def && def.refresh) def.refresh(comp);
  }
}

/* ---------------- Sidebar (search + categorized toolbox) ---------------- */
const CATEGORY_LABELS = {
  board: '브레드보드', ic: 'IC 칩 (로직/연산/메모리)', input: '입력/스위치',
  resistor: '저항', capacitor: '커패시터', output: '출력', power: '전원 부품', wire: '배선/점퍼선',
};
const CATEGORY_SWATCH = {
  board: '#e9e2cf', ic: '#ffcf40', input: '#7fd1ff', resistor: '#d9c9a3',
  capacitor: '#7fdd9a', output: '#ff8a8a', power: '#c9a4ff', wire: '#9aa0a8',
};
function renderSidebar(filter) {
  const root = document.getElementById('partCategories');
  root.innerHTML = '';
  const f = (filter || '').toLowerCase();
  const cats = {};
  for (const [id, def] of Object.entries(PARTS)) {
    if (f && !(def.name.toLowerCase().includes(f) || id.toLowerCase().includes(f))) continue;
    (cats[def.category] = cats[def.category] || []).push([id, def]);
  }
  let any = false;
  for (const catKey of Object.keys(CATEGORY_LABELS)) {
    const items = cats[catKey] || [];
    if (items.length === 0) continue;
    any = true;
    const sec = document.createElement('div');
    sec.className = 'part-category';
    sec.innerHTML = `<div class="part-category-title">${CATEGORY_LABELS[catKey]}<span class="count">${items.length}</span></div><div class="part-list"></div>`;
    const list = sec.querySelector('.part-list');
    for (const [id, def] of items) {
      const item = document.createElement('div');
      item.className = 'part-item';
      item.draggable = true;
      item.dataset.partId = id;
      item.innerHTML = `<div class="swatch" style="background:${CATEGORY_SWATCH[def.category] || '#666'}"></div><div class="pname">${def.name}</div>`;
      item.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', id); });
      list.appendChild(item);
    }
    sec.querySelector('.part-category-title').addEventListener('click', () => sec.classList.toggle('collapsed'));
    root.appendChild(sec);
  }
  if (!any) root.innerHTML = '<div class="part-empty">검색 결과가 없습니다.</div>';
}

/* ---------------- Toolbar / drag-drop wiring / bootstrap ---------------- */
function setupToolbar() {
  const chkRunning = document.getElementById('chkRunning');
  chkRunning.addEventListener('change', () => { state.running = chkRunning.checked; });
  const wireColorInput = document.getElementById('wireColorInput');
  state.activeWireColor = wireColorInput.value;
  wireColorInput.addEventListener('input', () => { state.activeWireColor = wireColorInput.value; });
  document.getElementById('btnDeleteSelected').addEventListener('click', deleteSelection);
  document.getElementById('btnClearWires').addEventListener('click', () => {
    if (!state.wires.length) return;
    pushHistory();
    state.wires = [];
  });
  document.getElementById('btnClearAll').addEventListener('click', () => {
    if (!state.boards.length && !state.components.length && !state.wires.length) return;
    if (!confirm('작업 공간의 모든 부품과 배선을 삭제합니다. 계속할까요?')) return;
    pushHistory();
    document.getElementById('componentsLayer').innerHTML = '';
    state.boards = []; state.components = []; state.wires = [];
    state.holeEls = []; state.pinEls = []; state.selection = null;
    clearPending();
  });
  document.getElementById('partSearch').addEventListener('input', e => renderSidebar(e.target.value.trim()));
}
function setupDragDrop() {
  const workspace = document.getElementById('workspace');
  workspace.addEventListener('dragover', e => e.preventDefault());
  workspace.addEventListener('drop', e => {
    e.preventDefault();
    const partId = e.dataTransfer.getData('text/plain');
    if (!partId) return;
    const pt = workspacePointFromClient(e.clientX, e.clientY);
    placeComponent(partId, pt.x, pt.y);
  });
}
/* ---------------- Pan / zoom camera ---------------- */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function applyView() {
  const vp = document.getElementById('viewport');
  vp.style.transform = `translate(${state.view.panX}px, ${state.view.panY}px) scale(${state.view.zoom})`;
}
function updateZoomLabel() {
  const lbl = document.getElementById('zoomLabel');
  if (lbl) lbl.textContent = Math.round(state.view.zoom * 100) + '%';
}
function zoomAt(clientX, clientY, factor) {
  const rect = document.getElementById('workspace').getBoundingClientRect();
  const mx = clientX - rect.left, my = clientY - rect.top;
  const oldZoom = state.view.zoom;
  const newZoom = clamp(oldZoom * factor, 0.25, 3);
  const worldX = (mx - state.view.panX) / oldZoom;
  const worldY = (my - state.view.panY) / oldZoom;
  state.view.panX = mx - worldX * newZoom;
  state.view.panY = my - worldY * newZoom;
  state.view.zoom = newZoom;
  applyView();
  updateZoomLabel();
}
function zoomByButton(factor) {
  const rect = document.getElementById('workspace').getBoundingClientRect();
  zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
}
function startPan(e) {
  const workspace = document.getElementById('workspace');
  workspace.classList.add('panning');
  const startX = e.clientX, startY = e.clientY;
  const origPanX = state.view.panX, origPanY = state.view.panY;
  function move(ev) {
    state.view.panX = origPanX + (ev.clientX - startX);
    state.view.panY = origPanY + (ev.clientY - startY);
    applyView();
  }
  function up() {
    workspace.classList.remove('panning');
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
  }
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}
function setupPanZoom() {
  const workspace = document.getElementById('workspace');
  // pointerdown reaches here only when nothing else (pin/hole/component/board) stopped it -> empty canvas
  workspace.addEventListener('pointerdown', e => { startPan(e); });
  workspace.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    } else {
      state.view.panX -= e.deltaX;
      state.view.panY -= e.deltaY;
      applyView();
    }
  }, { passive: false });
  document.getElementById('btnZoomIn').addEventListener('click', () => zoomByButton(1.2));
  document.getElementById('btnZoomOut').addEventListener('click', () => zoomByButton(1 / 1.2));
  document.getElementById('btnZoomReset').addEventListener('click', () => {
    state.view = { zoom: 1, panX: 0, panY: 0 };
    applyView();
    updateZoomLabel();
  });
  applyView();
  updateZoomLabel();
}

function frameLoop(ts) {
  if (state.lastTs == null) state.lastTs = ts;
  const dt = Math.min(ts - state.lastTs, 100);
  state.lastTs = ts;
  if (state.running) simulateTick(dt);
  render();
  requestAnimationFrame(frameLoop);
}
function init() {
  renderBoardDom(createBoard(40, 40));
  renderSidebar('');
  setupWiringHandlers();
  setupToolbar();
  setupDragDrop();
  setupPanZoom();
  requestAnimationFrame(frameLoop);
}
document.addEventListener('DOMContentLoaded', init);
