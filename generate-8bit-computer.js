"use strict";

const fs = require("fs");
const path = require("path");

const C = {
  power: "#ef4444",
  ground: "#2563eb",
  control: "#f59e0b",
  data: "#8b5cf6",
  alu: "#ec4899",
  result: "#22c55e",
  neutral: "#64748b",
  bus: ["#06b6d4", "#0891b2", "#0e7490", "#155e75", "#0284c7", "#0369a1", "#075985", "#0c4a6e"],
};

const boards = [
  { id: "bCtlL", x: 40, y: 40, cols: 64 },
  { id: "bCtlR", x: 1240, y: 40, cols: 64 },
  { id: "bRegL", x: 40, y: 430, cols: 64 },
  { id: "bRegR", x: 1240, y: 430, cols: 64 },
  { id: "bBusL", x: 40, y: 820, cols: 64 },
  { id: "bAluR", x: 1240, y: 820, cols: 64 },
  { id: "bRamL", x: 40, y: 1210, cols: 64 },
  { id: "bRamR", x: 1240, y: 1210, cols: 64 },
];

const components = [];
const wires = [];
const componentIds = new Set();
const powerTargets = [];
let wireSeq = 1;

const pin = (compId, pinNum) => ({ kind: "pin", compId, pinNum });
const hole = (boardId, row, col) => ({ kind: "hole", boardId, row, col });
const rail = (boardId, positive, col = 2, bottom = false) => hole(
  boardId,
  bottom ? (positive ? "RBP" : "RBM") : (positive ? "RTP" : "RTM"),
  col,
);

function add(id, type, x, y, state = {}, rot = 0) {
  if (componentIds.has(id)) throw new Error(`duplicate component: ${id}`);
  componentIds.add(id);
  components.push({ id, type, x, y, rot, pinPlug: {}, state });
  return id;
}

function refPoint(ref) {
  if (ref.kind === "hole") {
    const board = boards.find(b => b.id === ref.boardId);
    const rowY = { RTP: 14, RTM: 32, A: 68, B: 86, C: 104, D: 122, E: 140, F: 176, G: 194, H: 212, I: 230, J: 248, RBP: 284, RBM: 302 }[ref.row];
    return { x: board.x + (ref.col - 1) * 18 + 10, y: board.y + rowY };
  }
  const comp = components.find(c => c.id === ref.compId);
  return comp ? { x: comp.x, y: comp.y } : null;
}

function refHash(ref) {
  const key = ref.kind === "pin" ? `${ref.compId}:${ref.pinNum}` : `${ref.boardId}:${ref.row}:${ref.col}`;
  return [...key].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

function connect(a, b, color = C.neutral, points = []) {
  if (color === C.control && points.length === 0) {
    const pa = refPoint(a), pb = refPoint(b);
    if (pa && pb && Math.hypot(pa.x - pb.x, pa.y - pb.y) > 220) {
      const lane = refHash(a) % 6;
      const laneX = pa.x < 1200 && pb.x < 1200
        ? 8 + lane * 6
        : pa.x > 1240 && pb.x > 1240
          ? 2400 + lane * 6
          : 1200 + lane * 6;
      points = [{ x: laneX, y: pa.y }, { x: laneX, y: pb.y }];
    }
  }
  const width = color === C.power || color === C.ground ? 1.8
    : color === C.control ? 1.7
      : C.bus.includes(color) ? 2.8
        : 2.2;
  const group = color === C.power || color === C.ground ? "power"
    : color === C.control ? "control"
      : C.bus.includes(color) ? "bus"
        : color === C.result ? "result"
          : color === C.data || color === C.alu ? "data"
            : "support";
  wires.push({ id: `w${wireSeq++}`, a, b, color, width, group, style: "short", points });
}

const POWER_PINS = {
  ne555: [8, 1], hc161: [16, 8], hc273: [20, 10], hc245: [20, 10],
  hc283: [16, 8], hc86: [14, 7], hc157: [16, 8], hc138: [16, 8],
  hc139: [16, 8], hc08: [14, 7], hc32: [14, 7], hc04: [14, 7], cdp1824: [18, 9],
};

function addIc(id, type, x, y, boardId, state = {}) {
  add(id, type, x, y, state);
  powerTargets.push({ id, type, x, y, boardId });
  return id;
}

const q273 = [2, 5, 6, 9, 12, 15, 16, 19];
const d273 = [3, 4, 7, 8, 13, 14, 17, 18];
const a245 = [2, 3, 4, 5, 6, 7, 8, 9];
const b245 = [18, 17, 16, 15, 14, 13, 12, 11];
const ramData = [14, 13, 12, 11, 10, 8, 7, 6];
const ramAddr = [5, 4, 3, 2, 1];
const muxI0 = [2, 5, 11, 14];
const muxI1 = [3, 6, 10, 13];
const muxY = [4, 7, 9, 12];
const BUS = Array.from({ length: 8 }, (_, i) => hole("bBusL", "A", 34 + i));
const RAM_DATA = Array.from({ length: 8 }, (_, i) => hole("bRamR", "A", 3 + i));
const RAM_ADDR = Array.from({ length: 5 }, (_, i) => hole("bRamR", "F", 3 + i));

const regState = () => ({ q: Array(8).fill(0), lastClk: "L" });
const counterState = () => ({ count: 0, lastClk: "L" });

add("supply", "adapter5v", 50, 350);
addIc("clock", "ne555", 90, 150, "bCtlL", { phase: "high", phaseElapsed: 0, out: "L", statusMsg: "RC망 필요" });
addIc("micro", "hc161", 310, 150, "bCtlL", counterState());
addIc("stepDec", "hc138", 560, 150, "bCtlL");
addIc("decode", "hc139", 810, 150, "bCtlL");
addIc("controlAnd", "hc08", 1030, 150, "bCtlL");
addIc("controlOr", "hc32", 1290, 150, "bCtlR");
addIc("controlInv", "hc04", 1500, 150, "bCtlR");
addIc("pc", "hc161", 1720, 150, "bCtlR", counterState());

addIc("regA", "hc273", 80, 540, "bRegL", regState());
addIc("regB", "hc273", 560, 540, "bRegL", regState());
addIc("regIR", "hc273", 1280, 540, "bRegR", regState());
addIc("regOUT", "hc273", 830, 540, "bRegL", regState());
addIc("regMAR", "hc273", 1810, 540, "bRegR", regState());
addIc("bufA", "hc245", 300, 540, "bRegL");
addIc("bufIR", "hc245", 1540, 540, "bRegR");
addIc("bufPC", "hc245", 2080, 540, "bRegR");

addIc("xorLo", "hc86", 1280, 930, "bAluR");
addIc("addLo", "hc283", 1500, 930, "bAluR");
addIc("xorHi", "hc86", 1720, 930, "bAluR");
addIc("addHi", "hc283", 1940, 930, "bAluR");
addIc("bufALU", "hc245", 2160, 930, "bAluR");

addIc("muxAddrLo", "hc157", 80, 1320, "bRamL");
addIc("muxAddrHi", "hc157", 330, 1320, "bRamL");
addIc("muxDataLo", "hc157", 580, 1320, "bRamL");
addIc("muxDataHi", "hc157", 830, 1320, "bRamL");
addIc("bufManual", "hc245", 1040, 1320, "bRamL");

const program = [0x20, 0x21, 0xa0, 0x40, 0xc1, 0x22, 0x41, 0xa1, 0x20, 0x42, 0xc0, 0x23, 0x43, 0xa2, 0x21, 0xc2];
const data1 = Array.from({ length: 32 }, (_, i) => (i + 1) & 0xff);
const data2 = Array.from({ length: 32 }, (_, i) => ((i + 1) * 3) & 0xff);
addIc("bufRAM", "hc245", 1240, 1320, "bRamR");
addIc("ram0", "cdp1824", 1480, 1320, "bRamR", { mem: [...program, ...Array(16).fill(0)] });
addIc("ram1", "cdp1824", 1740, 1320, "bRamR", { mem: data1 });
addIc("ram2", "cdp1824", 2000, 1320, "bRamR", { mem: data2 });

add("programMode", "slideswitch", 1980, 150, { pos: "A" });
add("resetButton", "pushbtn", 2110, 145, { pressed: false });
add("writeButton", "pushbtn", 2220, 145, { pressed: false });
add("resetPullup", "res10k", 2100, 240);
add("writePullup", "res10k", 2210, 240);

add("manualAddrLo", "dip4", 80, 1580, { on: Array(4).fill(false) });
add("manualAddrHi", "dip3", 250, 1580, { on: Array(3).fill(false) });
add("manualDataLo", "dip4", 1900, 1580, { on: Array(4).fill(false) });
add("manualDataHi", "dip4", 2080, 1580, { on: Array(4).fill(false) });

[
  ["labelControl", "CLOCK / CONTROL", 80, 105],
  ["labelPc", "PROGRAM COUNTER", 1710, 105],
  ["labelA", "A REGISTER + BUS BUFFER", 80, 485],
  ["labelB", "B REGISTER", 560, 485],
  ["labelOut", "OUTPUT REGISTER", 830, 485],
  ["labelIr", "INSTRUCTION REGISTER + BUFFER", 1280, 485],
  ["labelMar", "MEMORY ADDRESS REGISTER", 1810, 485],
  ["labelBus", "8-BIT COMMON DATA BUS  D0 → D7", 575, 845],
  ["labelAlu", "8-BIT ALU  A ± B", 1500, 875],
  ["labelMux", "CPU / PROGRAM MODE MUX", 320, 1265],
  ["labelRam", "SRAM BANKS  0 / 1 / 2", 1570, 1265],
  ["labelPanelA", "MANUAL ADDRESS", 80, 1535],
  ["labelPanelD", "MANUAL DATA", 1900, 1535],
].forEach(([id, text, x, y]) => add(id, "module_label", x, y, { text }));

const PROG = pin("programMode", 2);
const RESET_N = pin("resetButton", 2);
const WRITE_N = pin("writeButton", 2);

connect(pin("programMode", 1), rail("bCtlR", false, 50), C.ground);
connect(pin("programMode", 3), rail("bCtlR", true, 50), C.power);
connect(pin("resetButton", 1), rail("bCtlR", false, 52), C.ground);
connect(pin("resetPullup", 1), rail("bCtlR", true, 52), C.power);
connect(pin("resetPullup", 2), RESET_N, C.control);
connect(pin("writeButton", 1), rail("bCtlR", false, 54), C.ground);
connect(pin("writePullup", 1), rail("bCtlR", true, 54), C.power);
connect(pin("writePullup", 2), WRITE_N, C.control);

// NE555 astable clock: about 1.5 Hz with 1k + 10k + 47uF.
add("clockR1", "res1k", 80, 260);
add("clockR2", "res10k", 180, 260);
add("clockC", "cap47u", 280, 260, { voltage: 0 });
add("clockCtrlC", "cap0u1", 380, 260, { voltage: 0 });
connect(pin("clock", 4), rail("bCtlL", true, 12), C.power);
connect(rail("bCtlL", true, 14), pin("clockR1", 1), C.power);
connect(pin("clockR1", 2), pin("clock", 7), C.control);
connect(pin("clock", 7), pin("clockR2", 1), C.control);
connect(pin("clockR2", 2), pin("clock", 6), C.control);
connect(pin("clock", 6), pin("clock", 2), C.control);
connect(pin("clock", 6), pin("clockC", 1), C.control);
connect(pin("clockC", 2), rail("bCtlL", false, 14), C.ground);
connect(pin("clock", 5), pin("clockCtrlC", 1), C.neutral);
connect(pin("clockCtrlC", 2), rail("bCtlL", false, 16), C.ground);

// Instruction decoder: Y0=ADD#, Y1=SUB#; second half selects RAM bank 0..2.
connect(pin("regIR", q273[7]), pin("decode", 2), C.control);
connect(rail("bCtlL", false, 18), pin("decode", 3), C.ground);
connect(rail("bCtlL", false, 20), pin("decode", 1), C.ground);
connect(rail("bCtlL", false, 22), pin("decode", 15), C.ground);
connect(pin("decode", 5), pin("controlInv", 3), C.control);
const SUB = pin("controlInv", 4);

// Microstep decoder and six-step loop T0..T5; T6 clears the counter.
connect(pin("micro", 14), pin("stepDec", 1), C.control);
connect(pin("micro", 13), pin("stepDec", 2), C.control);
connect(pin("micro", 12), pin("stepDec", 3), C.control);
connect(rail("bCtlL", false, 24), pin("stepDec", 4), C.ground);
connect(rail("bCtlL", false, 26), pin("stepDec", 5), C.ground);
connect(rail("bCtlL", true, 24), pin("stepDec", 6), C.power);
connect(pin("stepDec", 9), pin("micro", 1), C.control); // T6 -> CLR#
for (const p of [3, 4, 5, 6]) connect(rail("bCtlL", false, 28 + p), pin("micro", p), C.ground);
for (const p of [7, 9, 10]) connect(rail("bCtlL", true, 28 + p), pin("micro", p), C.power);

// HC04: PROG#, SUB, and stable levels on unused inputs.
connect(PROG, pin("controlInv", 1), C.control);
const NOT_PROG = pin("controlInv", 2);
for (const p of [5, 9, 11, 13]) connect(rail("bCtlR", false, 30 + p), pin("controlInv", p), C.ground);

// HC08: MAR clock, RAM read window, RAM OE, and CPU clock gate.
connect(pin("stepDec", 15), pin("controlAnd", 1), C.control); // T0#
connect(pin("stepDec", 13), pin("controlAnd", 2), C.control); // T2#
const MAR_CLK = pin("controlAnd", 3);
connect(pin("stepDec", 14), pin("controlAnd", 4), C.control); // T1#
connect(pin("stepDec", 12), pin("controlAnd", 5), C.control); // T3#
const RAM_WINDOW = pin("controlAnd", 6);
connect(RAM_WINDOW, pin("controlAnd", 9), C.control);
connect(NOT_PROG, pin("controlAnd", 10), C.control);
const RAM_OE = pin("controlAnd", 8);
connect(pin("clock", 3), pin("controlAnd", 12), C.control);
connect(NOT_PROG, pin("controlAnd", 13), C.control);
connect(pin("controlAnd", 11), pin("micro", 2), C.control);

// HC32 disables CPU bus sources while the manual programmer owns the bus.
const gatedOe = [
  [15, 1, 2, 3, "bufPC"],  // T0#
  [13, 4, 5, 6, "bufIR"], // T2#
  [10, 9, 10, 8, "bufA"], // T5#
  [11, 12, 13, 11, "bufALU"], // T4#
];
for (const [stepPin, a, b, y, buffer] of gatedOe) {
  connect(pin("stepDec", stepPin), pin("controlOr", a), C.control);
  connect(PROG, pin("controlOr", b), C.control);
  connect(pin("controlOr", y), pin(buffer, 19), C.control);
}

// Register clocks and global reset.
connect(MAR_CLK, pin("regMAR", 11), C.control);
connect(pin("stepDec", 14), pin("regIR", 11), C.control); // T1 exit
connect(pin("stepDec", 12), pin("regB", 11), C.control);  // T3 exit
connect(pin("stepDec", 11), pin("regA", 11), C.control);  // T4 exit
connect(pin("stepDec", 10), pin("regOUT", 11), C.control); // T5 exit
for (const id of ["regA", "regB", "regIR", "regOUT", "regMAR"]) connect(RESET_N, pin(id, 1), C.control);

// Program counter: 4-bit, address range 0..15.
connect(pin("stepDec", 14), pin("pc", 2), C.control);
connect(RESET_N, pin("pc", 1), C.control);
for (const p of [3, 4, 5, 6]) connect(rail("bCtlR", false, 8 + p), pin("pc", p), C.ground);
for (const p of [7, 9, 10]) connect(rail("bCtlR", true, 8 + p), pin("pc", p), C.power);

function connectPinsToBus(id, pins, trunkX, trunkY) {
  pins.forEach((p, bit) => {
    const laneY = 748 + bit * 9;
    connect(pin(id, p), BUS[bit], C.bus[bit], [
      { x: trunkX + bit * 6, y: laneY },
      { x: 644 + bit * 18, y: laneY },
    ]);
  });
}

// All register inputs share the 8-bit bus.
connectPinsToBus("regA", d273, 280, 750);
connectPinsToBus("regB", d273, 730, 735);
connectPinsToBus("regIR", d273, 1450, 720);
connectPinsToBus("regOUT", d273, 1000, 705);
connectPinsToBus("regMAR", d273, 1990, 720);

// Tri-state buffer B sides connect to the common bus.
connectPinsToBus("bufA", b245, 480, 760);
connectPinsToBus("bufIR", b245, 1700, 745);
connectPinsToBus("bufPC", b245, 2200, 730);
connectPinsToBus("bufRAM", b245, 1400, 1160);
connectPinsToBus("bufManual", b245, 1200, 1145);
connectPinsToBus("bufALU", b245, 2280, 1080);

// A, IR and PC source buffers.
q273.forEach((q, i) => connect(pin("regA", q), pin("bufA", a245[i]), C.data));
q273.forEach((q, i) => connect(pin("regIR", q), pin("bufIR", a245[i]), C.data));
[14, 13, 12, 11].forEach((q, i) => connect(pin("pc", q), pin("bufPC", a245[i]), C.data, [
  { x: 1900 + i * 7, y: 390 }, { x: 1900 + i * 7, y: 500 },
]));
for (let i = 4; i < 8; i++) connect(rail("bRegR", false, 42 + i), pin("bufPC", a245[i]), C.ground);
const sourceBufferBoard = { bufA: "bRegL", bufIR: "bRegR", bufPC: "bRegR", bufALU: "bAluR", bufManual: "bRamL" };
for (const id of ["bufA", "bufIR", "bufPC", "bufALU", "bufManual"]) {
  const placed = components.find(c => c.id === id);
  connect(rail(sourceBufferBoard[id], true, nearestCol(sourceBufferBoard[id], placed.x)), pin(id, 1), C.power);
}

// 8-bit ALU: A + (B XOR SUB) + SUB.
const xorInputs = [["xorLo", 1, 2, 3], ["xorLo", 4, 5, 6], ["xorLo", 9, 10, 8], ["xorLo", 12, 13, 11],
  ["xorHi", 1, 2, 3], ["xorHi", 4, 5, 6], ["xorHi", 9, 10, 8], ["xorHi", 12, 13, 11]];
const addAPins = [["addLo", 5], ["addLo", 3], ["addLo", 14], ["addLo", 12], ["addHi", 5], ["addHi", 3], ["addHi", 14], ["addHi", 12]];
const addBPins = [["addLo", 6], ["addLo", 2], ["addLo", 15], ["addLo", 11], ["addHi", 6], ["addHi", 2], ["addHi", 15], ["addHi", 11]];
for (let i = 0; i < 8; i++) {
  const [xorId, xa, xb, xy] = xorInputs[i];
  const addDropX = (addAPins[i][0] === "addLo" ? 1470 : 1910) + (i % 4) * 4;
  const xorDropX = (xorId === "xorLo" ? 1250 : 1690) + (i % 4) * 4;
  const aLaneY = 1160 + i * 3;
  const bLaneY = 1185 + i * 3;
  connect(pin("regA", q273[i]), pin(addAPins[i][0], addAPins[i][1]), C.data, [
    { x: 18 + i * 3, y: 650 }, { x: 18 + i * 3, y: aLaneY },
    { x: addDropX, y: aLaneY }, { x: addDropX, y: 900 },
  ]);
  connect(pin("regB", q273[i]), pin(xorId, xa), C.data, [
    { x: 1195 + i * 3, y: 650 }, { x: 1195 + i * 3, y: bLaneY },
    { x: xorDropX, y: bLaneY }, { x: xorDropX, y: 900 },
  ]);
  connect(SUB, pin(xorId, xb), C.control);
  connect(pin(xorId, xy), pin(addBPins[i][0], addBPins[i][1]), C.alu);
}
connect(SUB, pin("addLo", 7), C.control);
connect(pin("addLo", 9), pin("addHi", 7), C.alu);
const sumPins = [["addLo", 4], ["addLo", 1], ["addLo", 13], ["addLo", 10], ["addHi", 4], ["addHi", 1], ["addHi", 13], ["addHi", 10]];
sumPins.forEach(([id, p], i) => connect(pin(id, p), pin("bufALU", a245[i]), C.result, id === "addLo" ? [
  { x: 1660 + i * 8, y: 880 - i * 7 }, { x: 2120 + i * 8, y: 880 - i * 7 },
] : []));

// Address MUX: CPU MAR (I0) or front-panel address (I1).
for (const id of ["muxAddrLo", "muxAddrHi", "muxDataLo", "muxDataHi"]) {
  connect(PROG, pin(id, 1), C.control);
  const placed = components.find(c => c.id === id);
  connect(rail("bRamL", false, nearestCol("bRamL", placed.x)), pin(id, 15), C.ground);
}

const manualAddr = [];
const manualData = [];
function wireDip(id, bits, boardId, startCol, out) {
  const placed = components.find(c => c.id === id);
  for (let i = 0; i < bits; i++) {
    const input = 2 * i + 1;
    const output = 2 * i + 2;
    const r = `${id}Pull${i}`;
    add(r, "res10k", placed.x + i * 36, placed.y + 82);
    const localCol = nearestCol(boardId, placed.x + i * 36);
    connect(rail(boardId, true, localCol, true), pin(id, input), C.power);
    connect(pin(id, output), pin(r, 1), C.neutral);
    connect(pin(r, 2), rail(boardId, false, localCol, true), C.ground);
    out.push(pin(id, output));
  }
}
wireDip("manualAddrLo", 4, "bRamL", 50, manualAddr);
wireDip("manualAddrHi", 3, "bRamL", 56, manualAddr);
wireDip("manualDataLo", 4, "bRamR", 50, manualData);
wireDip("manualDataHi", 4, "bRamR", 56, manualData);

for (let i = 0; i < 4; i++) {
  const laneY = 1730 + i * 6;
  const dropX = 90 + i * 18;
  connect(pin("regMAR", q273[i]), pin("muxAddrLo", muxI0[i]), C.data, [
    { x: 1210 + i * 4, y: 650 }, { x: 1210 + i * 4, y: laneY },
    { x: dropX, y: laneY }, { x: dropX, y: 1290 },
  ]);
  connect(manualAddr[i], pin("muxAddrLo", muxI1[i]), C.control);
}
for (let i = 0; i < 3; i++) {
  const laneY = 1756 + i * 6;
  const dropX = 340 + i * 18;
  connect(pin("regMAR", q273[4 + i]), pin("muxAddrHi", muxI0[i]), C.data, [
    { x: 1230 + i * 4, y: 650 }, { x: 1230 + i * 4, y: laneY },
    { x: dropX, y: laneY }, { x: dropX, y: 1290 },
  ]);
  connect(manualAddr[4 + i], pin("muxAddrHi", muxI1[i]), C.control);
}
connect(rail("bRamL", false, 46), pin("muxAddrHi", muxI0[3]), C.ground);
connect(rail("bRamL", false, 47), pin("muxAddrHi", muxI1[3]), C.ground);

const selectedAddr = [...muxY.map(p => pin("muxAddrLo", p)), ...muxY.slice(0, 3).map(p => pin("muxAddrHi", p))];
for (let bit = 0; bit < 5; bit++) {
  const laneY = 1260 + bit * 8;
  connect(selectedAddr[bit], RAM_ADDR[bit], C.data, [{ x: 1180 + bit * 5, y: laneY }, { x: 1290 + bit * 18, y: laneY }]);
  for (const ram of ["ram0", "ram1", "ram2"]) connect(pin(ram, ramAddr[bit]), RAM_ADDR[bit], C.data, [
    { x: 1420 + bit * 6, y: laneY }, { x: 1290 + bit * 18, y: laneY },
  ]);
}
connect(selectedAddr[5], pin("decode", 14), C.control);
connect(selectedAddr[6], pin("decode", 13), C.control);

// Data MUX drives a dedicated programmer buffer; CPU mode leaves that buffer disabled.
for (let i = 0; i < 4; i++) {
  connect(BUS[i], pin("muxDataLo", muxI0[i]), C.bus[i]);
  connect(manualData[i], pin("muxDataLo", muxI1[i]), C.control);
  connect(pin("muxDataLo", muxY[i]), pin("bufManual", a245[i]), C.data);
  connect(BUS[4 + i], pin("muxDataHi", muxI0[i]), C.bus[4 + i]);
  connect(manualData[4 + i], pin("muxDataHi", muxI1[i]), C.control);
  connect(pin("muxDataHi", muxY[i]), pin("bufManual", a245[4 + i]), C.data);
}
connect(NOT_PROG, pin("bufManual", 19), C.control);

// Bidirectional RAM buffer and three physical 32x8 banks.
connect(NOT_PROG, pin("bufRAM", 1), C.control); // CPU: RAM->BUS, PROG: BUS->RAM
connect(RAM_OE, pin("bufRAM", 19), C.control);
for (let bit = 0; bit < 8; bit++) {
  const laneY = 1490 + bit * 5;
  connect(pin("bufRAM", a245[bit]), RAM_DATA[bit], C.data, [{ x: 1400 + bit * 5, y: laneY }, { x: 1290 + bit * 18, y: laneY }]);
  for (const ram of ["ram0", "ram1", "ram2"]) connect(pin(ram, ramData[bit]), RAM_DATA[bit], C.data, [
    { x: 1440 + bit * 5, y: laneY }, { x: 1290 + bit * 18, y: laneY },
  ]);
}
for (const ram of ["ram0", "ram1", "ram2"]) {
  connect(PROG, pin(ram, 16), C.control);   // MRD: low in CPU mode
  connect(WRITE_N, pin(ram, 17), C.control); // MWR: low only while WRITE is pressed
}
connect(pin("decode", 12), pin("ram0", 15), C.control);
connect(pin("decode", 11), pin("ram1", 15), C.control);
connect(pin("decode", 10), pin("ram2", 15), C.control);

function addLed(id, x, y, source, boardId, col, activeLow = false) {
  add(`${id}R`, "res330", x, y);
  add(id, "led", x + 58, y - 8, { color: "green", lit: false });
  const localCol = nearestCol(boardId, x + 58);
  if (activeLow) {
    connect(rail(boardId, true, localCol, true), pin(`${id}R`, 1), C.power);
    connect(pin(`${id}R`, 2), pin(id, 1), C.result);
    connect(pin(id, 2), source, C.result);
  } else {
    connect(source, pin(`${id}R`, 1), C.result);
    connect(pin(`${id}R`, 2), pin(id, 1), C.result);
    connect(pin(id, 2), rail(boardId, false, localCol, true), C.ground);
  }
}

// Every LED in this project is green.
for (let i = 0; i < 8; i++) addLed(`busLed${i}`, 650 + i * 72, 1090, BUS[i], i < 7 ? "bBusL" : "bAluR", 8 + i);
for (let i = 0; i < 8; i++) addLed(`outLed${i}`, 70 + i * 130, 700, pin("regOUT", q273[i]), "bRegL", 8 + i);
const stepPins = [15, 14, 13, 12, 11, 10];
for (let i = 0; i < 6; i++) addLed(`stepLed${i}`, 1260 + i * 165, 310, pin("stepDec", stepPins[i]), "bCtlR", 8 + i, true);
addLed("addLed", 2100, 310, pin("decode", 4), "bCtlR", 20, true);
addLed("subLed", 2250, 310, pin("decode", 5), "bCtlR", 22, true);
addLed("carryLed", 2240, 1080, pin("addHi", 9), "bAluR", 24);

// Power distribution and one 0.1uF decoupler per IC.
connect(pin("supply", 1), rail("bCtlL", true, 2), C.power);
connect(pin("supply", 2), rail("bCtlL", false, 2), C.ground);
const chain = ["bCtlL", "bCtlR", "bRegR", "bRegL", "bBusL", "bAluR", "bRamR", "bRamL"];
const chainCols = [[64, 1], [64, 64], [1, 64], [1, 1], [64, 1], [64, 64], [1, 64]];
for (let i = 0; i < chain.length - 1; i++) {
  const [fromCol, toCol] = chainCols[i];
  connect(rail(chain[i], true, fromCol), rail(chain[i + 1], true, toCol), C.power);
  connect(rail(chain[i], false, fromCol), rail(chain[i + 1], false, toCol), C.ground);
}
for (const board of boards) {
  const gutterX = board.x + 1170;
  connect(rail(board.id, true, 64), rail(board.id, true, 64, true), C.power, [{ x: gutterX, y: board.y + 60 }, { x: gutterX, y: board.y + 270 }]);
  connect(rail(board.id, false, 63), rail(board.id, false, 63, true), C.ground, [{ x: gutterX - 10, y: board.y + 70 }, { x: gutterX - 10, y: board.y + 280 }]);
}
function dipPinX(x, pinNum, pinCount) {
  const half = pinCount / 2;
  return x + (pinNum <= half ? pinNum - 1 : half - 1 - (pinNum - half - 1)) * 18;
}
function nearestCol(boardId, x) {
  const board = boards.find(b => b.id === boardId);
  return Math.max(1, Math.min(64, Math.round((x - board.x - 10) / 18) + 1));
}
for (const t of powerTargets) {
  const [vcc, gnd] = POWER_PINS[t.type];
  const pinCount = { ne555: 8, hc161: 16, hc273: 20, hc245: 20, hc283: 16, hc86: 14, hc157: 16, hc138: 16, hc139: 16, hc08: 14, hc32: 14, hc04: 14, cdp1824: 18 }[t.type];
  const vccCol = nearestCol(t.boardId, dipPinX(t.x, vcc, pinCount));
  const gndCol = nearestCol(t.boardId, dipPinX(t.x, gnd, pinCount));
  connect(pin(t.id, vcc), rail(t.boardId, true, vccCol), C.power);
  connect(pin(t.id, gnd), rail(t.boardId, false, gndCol), C.ground);
  const capId = `dec_${t.id}`;
  const board = boards.find(b => b.id === t.boardId);
  const capX = t.x + 8;
  add(capId, "cap0u1", capX, board.y + 242, { voltage: 0 });
  connect(pin(capId, 1), rail(t.boardId, true, nearestCol(t.boardId, capX), true), C.power);
  connect(pin(capId, 2), rail(t.boardId, false, nearestCol(t.boardId, capX + 36), true), C.ground);
}

// ponytail: fixed six-step ADD/SUB cycle; add a control ROM when branches or more opcodes are needed.
// ponytail: the single 4-bit PC loops over RAM0[0..15]; cascade another counter for 32 program words.
const snapshot = { boards, components, wires };

const expectedIcCounts = {
  hc273: 5, hc245: 6, hc283: 2, hc86: 2, hc161: 2, hc157: 4,
  hc138: 1, hc139: 1, hc08: 1, hc32: 1, hc04: 1, cdp1824: 3,
};
for (const [type, expected] of Object.entries(expectedIcCounts)) {
  const actual = components.filter(c => c.type === type).length;
  if (actual !== expected) throw new Error(`${type}: expected ${expected}, got ${actual}`);
}
if (components.filter(c => c.type === "led").some(c => c.state.color !== "green")) throw new Error("all LEDs must be green");
if (new Set(wires.map(w => w.id)).size !== wires.length) throw new Error("duplicate wire id");
const pinCounts = {
  adapter5v: 2, ne555: 8, hc161: 16, hc273: 20, hc245: 20, hc283: 16,
  hc86: 14, hc157: 16, hc138: 16, hc139: 16, hc08: 14, hc32: 14, hc04: 14,
  cdp1824: 18, slideswitch: 3, pushbtn: 4, dip4: 8, dip3: 6,
  res330: 2, res1k: 2, res10k: 2, cap0u1: 2, cap47u: 2, led: 2,
};
const componentById = new Map(components.map(c => [c.id, c]));
for (const w of wires) {
  for (const end of [w.a, w.b]) {
    if (end.kind === "pin" && !componentIds.has(end.compId)) throw new Error(`missing component ${end.compId}`);
    if (end.kind === "pin" && (end.pinNum < 1 || end.pinNum > pinCounts[componentById.get(end.compId).type])) throw new Error(`invalid pin ${end.compId}.${end.pinNum}`);
    if (end.kind === "hole" && !boards.some(b => b.id === end.boardId)) throw new Error(`missing board ${end.boardId}`);
  }
}
for (const t of powerTargets) {
  const [vcc, gnd] = POWER_PINS[t.type];
  if (!wires.some(w => [w.a, w.b].some(e => e.kind === "pin" && e.compId === t.id && e.pinNum === vcc))) throw new Error(`missing VCC: ${t.id}`);
  if (!wires.some(w => [w.a, w.b].some(e => e.kind === "pin" && e.compId === t.id && e.pinNum === gnd))) throw new Error(`missing GND: ${t.id}`);
}

const output = path.join(__dirname, "8bit-computer.json");
fs.writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`wrote ${output}`);
console.log(`components=${components.length}, ICs=${Object.values(expectedIcCounts).reduce((a, b) => a + b, 0)}, wires=${wires.length}, LEDs=${components.filter(c => c.type === "led").length}`);
