export const meta = {
  name: 'verify-breadboard-sim',
  description: 'Verify IC logic/pinouts and review new engine code (rotation, undo/redo, wire bending) for bugs',
  phases: [
    { title: 'Verify IC logic' },
    { title: 'Recheck IC findings' },
    { title: 'Review engine code' },
    { title: 'Recheck engine findings' },
  ],
}

const FILE = 'C:\\Users\\hwang\\Desktop\\project\\test\\makecomputer\\script.js'

const FINDING_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string' },
    hasBug: { type: 'boolean' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          detail: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          lineHint: { type: 'string' },
        },
        required: ['summary', 'detail', 'severity'],
      },
    },
  },
  required: ['subject', 'hasBug', 'findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    confirmed: { type: 'boolean' },
    explanation: { type: 'string' },
  },
  required: ['confirmed', 'explanation'],
}

const IC_TASKS = [
  {
    key: 'quadGates',
    label: '74HC08/74HC32/74HC86',
    lines: '527-568',
    prompt: `Read ${FILE} lines 527-568 (function dipFootprint, renderDipBody, makeQuad2InputGate, and its three call sites for 74HC08/74HC32/74HC86).
This is a JS breadboard circuit simulator. Each IC part def has a "pins" array (pin number -> label) and a "simulate(comp, def, levels, ctx)" function that reads input levels via ctx.levelOf(levels, comp.id, pinNum) and writes outputs via ctx.drive(comp.id, pinNum, value, strength).
Verify, against the REAL manufacturer datasheet pinout for the 74xx quad 2-input gate package (standard for 74HC08 AND, 74HC32 OR, 74HC86 XOR - all share the same 14-pin pinout: pins 1,2,3=1A,1B,1Y; 4,5,6=2A,2B,2Y; 7=GND; 8,9,10=3Y,3A,3B; 11,12,13=4Y,4A,4B; 14=VCC):
1. Does the "pins" array's pin numbers and labels match this real pinout exactly?
2. Does the "gates" array (a,b,y pin-number triples) in makeQuad2InputGate correctly match each gate's actual A/B input pins and Y output pin per that pinout (pay close attention to gates 3 and 4, whose datasheet pin order is Y,A,B not A,B,Y - a common transcription mistake)?
3. Is the boolean logic function correct for each of AND/OR/XOR as called (a&&b, a||b, a!==b)?
4. Is power (vcc:14, gnd:7) correct?
Report hasBug=true only for a genuine, concrete mismatch versus the real datasheet pinout or wrong logic - not style preferences. Set subject to "74HC08/32/86".`,
  },
  {
    key: 'hc04',
    label: '74HC04',
    lines: '570-591',
    prompt: `Read ${FILE} lines 570-591 (PARTS['hc04'], the 74HC04 hex inverter).
Verify against the real 74HC04 datasheet pinout (14-pin hex inverter: 1A/1Y=1/2, 2A/2Y=3/4, 3A/3Y=5/6, GND=7, 4Y/4A=8/9, 5Y/5A=10/11, 6Y/6A=12/13, VCC=14):
1. Does the "pins" array match this exactly (note gates 4/5/6 are output-then-input order on the datasheet, mirroring the first three which are input-then-output)?
2. Does the "inv" array of [inputPin, outputPin] pairs correctly implement all 6 inverters per that pinout?
3. Is power (vcc:14, gnd:7) correct, and is the inversion logic (output = NOT input) correct?
Report hasBug=true only for a genuine mismatch vs the real datasheet. Set subject to "74HC04".`,
  },
  {
    key: 'hc283',
    label: '74HC283',
    lines: '593-620',
    prompt: `Read ${FILE} lines 593-620 (PARTS['hc283'], a 74HC283 4-bit binary full adder).
Verify against the real 74HC283 datasheet pinout (16-pin: 1=S2,2=B2,3=A2,4=S1,5=A1,6=B1,7=C0(carry-in),8=GND,9=C4(carry-out),10=S4,11=B4,12=A4,13=S3,14=A3,15=B3,16=VCC):
1. Does the "pins" array match this exactly?
2. In simulate(), are A (bits A1..A4) and B (bits B1..B4) built from the correct pin numbers per that pinout, in correct bit order (A1=bit0, A4=bit3)?
3. Is the carry-in (pin 7) added correctly, and is the sum's bit 4 (overflow) driven onto the correct carry-out pin (9)?
4. Are the sum output pins (S1..S4, i.e. pins 4,1,13,10) driven with the correct bit of the computed sum?
Report hasBug=true only for a genuine arithmetic or pin-mapping bug vs the real datasheet. Set subject to "74HC283".`,
  },
  {
    key: 'hc157',
    label: '74HC157',
    lines: '621-653',
    prompt: `Read ${FILE} lines 621-653 (PARTS['hc157'], a 74HC157 quad 2-input multiplexer).
Verify against the real 74HC157 datasheet pinout (16-pin: 1=S(select),2=1I0,3=1I1,4=1Y,5=2I0,6=2I1,7=2Y,8=GND,9=3Y,10=3I1,11=3I0,12=4Y,13=4I1,14=4I0,15=E(active-low enable/strobe),16=VCC):
1. Does the "pins" array match exactly (note channels 3 and 4 have their I0/I1 pins swapped in physical order compared to channels 1 and 2 on the real part - a common source of bugs)?
2. In simulate(), for each of the 4 channels, is the correct I0/I1 pin selected based on S, matching that channel's actual pin numbers?
3. Is E (pin 15) correctly treated as ACTIVE-LOW (E=H forces all outputs low/disabled, not high)?
Report hasBug=true only for a genuine mismatch. Set subject to "74HC157".`,
  },
  {
    key: 'hc138',
    label: '74HC138',
    lines: '654-684',
    prompt: `Read ${FILE} lines 654-684 (PARTS['hc138'], a 74HC138 3-to-8 decoder).
Verify against the real 74HC138 datasheet pinout (16-pin: 1=A,2=B,3=C,4=G2A(active-low enable),5=G2B(active-low enable),6=G1(active-high enable),7=Y7,8=GND,9=Y6,10=Y5,11=Y4,12=Y3,13=Y2,14=Y1,15=Y0,16=VCC):
1. Does the "pins" array match exactly, and does the yPins array [15,14,13,12,11,10,9,7] correctly map Y0..Y7 to those pin numbers?
2. Is the enable logic correct: outputs only active when G1=H AND G2A=L AND G2B=L; otherwise ALL outputs forced HIGH (this is an active-low-output decoder)?
3. Is the selected output (matching the binary address from A,B,C) correctly driven LOW while all others stay HIGH?
Report hasBug=true only for a genuine mismatch. Set subject to "74HC138".`,
  },
  {
    key: 'hc139',
    label: '74HC139',
    lines: '685-720',
    prompt: `Read ${FILE} lines 685-720 (PARTS['hc139'], a 74HC139 dual 2-to-4 decoder/demultiplexer).
Verify against the real 74HC139 datasheet pinout (16-pin: 1=1E(active-low enable),2=1A0,3=1A1,4=1Y0,5=1Y1,6=1Y2,7=1Y3,8=GND,9=2Y3,10=2Y2,11=2Y1,12=2Y0,13=2A1,14=2A0,15=2E(active-low enable),16=VCC):
1. Does the "pins" array and the two "sections" (e,a0,a1,y[]) match this real pinout exactly, including that section 2's pin order is mirrored vs section 1 (2A0 is pin 14 not paired the same way as 1A0's pin 2)?
2. Is E correctly active-LOW (E=H disables that section, forcing all its outputs HIGH)?
3. Is the addressed output (from a0,a1) correctly driven LOW while the other 3 in that section stay HIGH?
Report hasBug=true only for a genuine mismatch. Set subject to "74HC139".`,
  },
  {
    key: 'ne555',
    label: 'NE555',
    lines: '722-776',
    prompt: `Read ${FILE} lines 722-776 (PARTS['ne555'], an NE555 timer in astable mode).
Verify against the real NE555 datasheet (8-pin: 1=GND,2=TRIG,3=OUT,4=RESET(active-low),5=CTRL,6=THRESH,7=DISCH,8=VCC):
1. Does the "pins" array match exactly?
2. The standard astable formula is tHigh = 0.693*(R1+R2)*C and tLow = 0.693*R2*C, with R1 between VCC and pin7(DISCH), R2 between pin7(DISCH) and pin6/2(THRESH/TRIG tied together), C between pin6/2 and GND. Does the code's onTick correctly identify R1/R2/C by checking which resistor/capacitor is wired between which node pairs (nodeVcc-nodeX, nodeX-nodeY, nodeY-nodeGnd), and does it use the correct tHigh/tLow formula?
3. Is RESET (pin4) correctly active-LOW (forces output low when pin4=L)?
4. Is "powered" correctly checked as VCC=H and GND=L before the timer runs?
Report hasBug=true only for a genuine formula or pin-mapping bug vs the real part. Set subject to "NE555".`,
  },
  {
    key: 'hc161',
    label: '74HC161',
    lines: '777-819',
    prompt: `Read ${FILE} lines 777-819 (PARTS['hc161'], a 74HC161 synchronous 4-bit binary counter).
Verify against the real 74HC161 datasheet pinout (16-pin: 1=CLR(async active-low),2=CLK,3=A,4=B,5=C,6=D(parallel data inputs),7=ENP,8=GND,9=LOAD(sync active-low),10=ENT,11=QD,12=QC,13=QB,14=QA,15=RCO(ripple carry out),16=VCC):
1. Does the "pins" array match exactly (note the parallel data inputs are A,B,C,D but the outputs are QA,QB,QC,QD)?
2. Is CLR correctly asynchronous (active immediately, not waiting for a clock edge) per the real part - check whether the code applies CLR only on a clock edge or immediately in onTick?
3. On a rising CLK edge: if LOAD=L, are data inputs A,B,C,D loaded correctly bit-order into count (A=bit0..D=bit3)? If LOAD=H and ENP=H and ENT=H, does it increment (wrapping 15->0)?
4. Is RCO driven HIGH only when ENT=H AND count=15 (the real 74161 behavior - note RCO depends on ENT but NOT ENP), matching the datasheet?
5. Are QA..QD (pins 14,13,12,11) driven with the correct bit of count?
Report hasBug=true only for a genuine mismatch. Set subject to "74HC161".`,
  },
  {
    key: 'hc273',
    label: '74HC273',
    lines: '820-857',
    prompt: `Read ${FILE} lines 820-857 (PARTS['hc273'], a 74HC273 octal D flip-flop register).
Verify against the real 74HC273 datasheet pinout (20-pin: 1=CLR(async active-low),2=1Q,3=1D,4=2D,5=2Q,6=3Q,7=3D,8=4D,9=4Q,10=GND,11=CLK,12=5Q,13=5D,14=6D,15=6Q,16=7Q,17=7D,18=8D,19=8Q,20=VCC):
1. Does the "pins" array match this exactly (note the D/Q pin ordering alternates per flip-flop across the package)?
2. Is CLR correctly asynchronous and active-low?
3. On a rising CLK edge (and CLR not active), are all 8 D inputs latched into Q correctly using the dPins array [3,4,7,8,13,14,17,18] and output via qPins [2,5,6,9,12,15,16,19] - do these two arrays correspond to the SAME physical flip-flop in the same array position (e.g. dPins[0]=pin3 should pair with qPins[0]=pin2, both flip-flop #1)?
Report hasBug=true only for a genuine mismatch. Set subject to "74HC273".`,
  },
  {
    key: 'hc245',
    label: '74HC245',
    lines: '858-895',
    prompt: `Read ${FILE} lines 858-895 (PARTS['hc245'], a 74HC245 octal bus transceiver).
Verify against the real 74HC245 datasheet pinout (20-pin: 1=DIR,2-9=A1..A8,10=GND,11-18=B8..B1(note: reverse order from A side),19=OE(active-low),20=VCC):
1. Does the "pins" array match this real pinout exactly, including B8..B1 being numbered in REVERSE order (pin11=B8, pin18=B1) relative to A1..A8 (pin2=A1..pin9=A8)?
2. Is OE correctly active-LOW (only pin19=L enables the buffers; H or floating means both sides stay high-Z/undriven)?
3. Is DIR correctly interpreted: DIR=H drives A->B, DIR=L drives B->A? And do the Apins/Bpins arrays in the code correctly pair each A[i] with its corresponding B[i] per the real pinout (A1<->B1, not A1<->B8)?
Report hasBug=true only for a genuine mismatch. Set subject to "74HC245".`,
  },
  {
    key: 'cdp1824',
    label: 'CDP1824CE',
    lines: '896-955',
    prompt: `Read ${FILE} lines 896-955 (PARTS['cdp1824'], modeling a CDP1824CE 32x8 static RAM).
This is a less common/obscure part - focus on internal self-consistency and the comment's own claims rather than obscure datasheet trivia:
1. Do the write path (onTick, triggered on CS=L, MRD=H, MWR=L) and read path (simulate, triggered on CS=L, MRD=L) use CONSISTENT pin-to-bit-position mappings for maPins [5,4,3,2,1] and busPins [14,13,12,11,10,8,7,6] (i.e. would a byte written at some address read back correctly at that same address with the same bit order)?
2. Is the address correctly bounded to the declared 32-word array (5 address bits = 0-31, matching 'mem = new Array(32)')?
3. Are the enable conditions for read vs write mutually exclusive and correctly using active-low CS/MWR and active-high-for-write MRD in onTick vs active-low MRD in simulate (double check simulate's read condition isn't accidentally requiring the SAME MRD polarity as the write path, which would make read and write impossible to distinguish)?
Report hasBug=true only for a genuine internal-consistency bug (e.g. read/write pin-order mismatch, wrong array bound, or a read/write enable condition that can never trigger). Set subject to "CDP1824CE".`,
  },
]

const ENGINE_TASKS = [
  {
    key: 'rotationSnap',
    label: 'Rotation + hole-snap engine',
    prompt: `Read ${FILE} lines 960-1100 (getBaseOffsets, rotateOffsets, getStraddleFlipOffsets, getPinOffsets, boardHoleAbs, ROW_Y_UNITS/Y_UNIT_TO_ROW, findGenericSnap, applySnap) and lines 1231-1275 (renderComponentInner, which also computes CSS rotation transform-origin and pin-number label placement).
Context: this is a breadboard simulator. Components can now be rotated in 90deg steps (comp.rot). Simple 2-pin/4-pin parts use plain coordinate rotation (rotateOffsets, pivoting on the anchor pin) at any angle - that's fine since their leads are "flexible" in the model. DIP ICs and the square 4-pin footprint physically straddle the board's ONE fixed center trench (rows E/F, which sit 2 grid-units apart while every other adjacent row pair is only 1 unit apart) - so a genuine 180deg flip is modeled explicitly via getStraddleFlipOffsets (row/column swap) instead of coordinate rotation, specifically to avoid a pin ending up shorted onto the wrong row's electrical node. 90/270deg for these parts falls back to plain coordinate rotation, which for a large chip should correctly find NO valid snap (pins can't fit within one 5-row cluster without crossing the trench) but for a small chip (e.g. an 8-pin NE555) can validly fit within a single cluster.
Look specifically for:
1. Any case where a straddle-kind part at some rotation could have two DIFFERENT pins resolve to the exact same (boardId,row,col) in findGenericSnap's returned plug map (an electrical short bug) - trace through the math by hand for at least one concrete example (e.g. a 20-pin part like 74HC273 or 74HC245, half=10) at rot=0 and rot=180.
2. Whether findGenericSnap's column-range check (targetCol < 1 || targetCol > board.cols) can produce a plug with a non-integer or out-of-range col that still gets accepted due to a rounding/floating-point issue (off.dx/HOLE - is this always an exact integer given how offsets are constructed?).
3. Whether renderComponentInner's CSS transform-origin computation for the 180deg straddle case (using half = def.pins.length/2 for kind==='dip' or 2 for square2x2) matches the SAME half/pivot logic used in getStraddleFlipOffsets, so the visual body stays reasonably aligned with the pin dots after a flip.
4. Whether the pin-number label placement logic (isTopRow, using baseOffs for 90/270 vs off.dy===0 for 0/180) could ever mislabel a pin's line position such that it visually overlaps the rendered part name text for some other IC's differently-shaped render() output - check a couple of the render() functions (search "renderDipBody" callers) for anything unusual.
Report hasBug=true only for a concrete, traceable bug with a specific reproduction (exact part + rotation + pin numbers). Set subject to "rotation/snap engine".`,
  },
  {
    key: 'undoRedoClipboard',
    label: 'Undo/redo + clipboard',
    prompt: `Read ${FILE} lines 37-56 (state object) and lines 1414-1502 (finishWire, handleConnectorDown-adjacent code if included, serializeState, restoreState, pushHistory, undo, redo, copySelection, pasteClipboard, rotateComponent) - if the range cuts off mid-function, read a bit further to get the complete functions.
Context: undo/redo is implemented via whole-state JSON snapshots (serializeState/restoreState), pushed onto state.history.past before each mutating action (place/delete/rotate/wire-create/wire-bend-drag/clear), with state.history.future cleared on any new action. Ctrl+Z pops past->restores, pushes current onto future; Ctrl+Y/Ctrl+Shift+Z is the mirror. Ctrl+C copies the selected component's {type,rot,x,y,state} into state.clipboard; Ctrl+V clones it as a new component offset by state.pasteCount*2*HOLE.
Look specifically for:
1. Does restoreState correctly reconstruct EVERYTHING needed for the simulation to keep working - in particular, does it forget to restore anything that render()/simulateTick() depends on (check what fields comp/board objects have elsewhere in the file vs what restoreState sets)?
2. Does serializeState's JSON.parse(JSON.stringify(...)) correctly deep-clone every field it captures, or could two history entries end up sharing a reference to the same nested object (e.g. a component's state.q array for 74HC273) such that mutating live state after a snapshot also corrupts the snapshot?
3. In pasteClipboard, if state.clipboard.type no longer exists as a PARTS key (shouldn't normally happen, but check), or if def.init exists and would normally set up state.clipboard.state differently than what's stored - is there any way pasting could produce a component with a state shape simulate()/render() don't expect and would throw on?
4. Does copySelection/pasteClipboard interact correctly with rotated components (rot field round-trips)?
5. Any place a pushHistory() call is missing before a mutation that a user would expect Ctrl+Z to undo, or any place pushHistory() fires but the corresponding action can silently no-op (leaving a useless undo step) - is that handled elsewhere (e.g. the drag-cancel logic popping speculative entries)?
Report hasBug=true only for a concrete bug with a specific repro. Set subject to "undo/redo + clipboard".`,
  },
  {
    key: 'wireBend',
    label: 'Bendable wire interaction',
    prompt: `Read ${FILE} lines 1495-1590 (smoothPath, distToSegment, nearestPointIndex, insertIndexForClick, startWireBendDrag, removeNearestBendPoint) and the wireLayer pointerdown/dblclick/click listeners plus the updateWires rendering of wire.points (search "wire-bend-handle" and "smoothPath(" for the exact call site around line 1728-1760).
Context: a placed wire normally renders as a fixed droop curve. Dragging on its rendered <path> body should insert a new bend point (or move the nearest existing one within a 14px threshold) at the drag location; releasing without having moved more than ~2px should discard that speculative point again (treated as a plain click-to-select instead). Double-clicking removes the nearest bend point. Points are stored as an ordered array and rendered via smoothPath([a, ...points, b]).
Look specifically for:
1. In insertIndexForClick, is the segment-index-to-array-index mapping correct, i.e. does inserting at the returned index always keep wire.points in the same left-to-right (or start-to-end) order as the visual path, for BOTH a point being added between two existing points AND one being added before the first / after the last existing point?
2. Can startWireBendDrag ever leave wire.points with a point at a NaN or undefined position, e.g. if connectorWorldPos(wire.a) or (wire.b) returns null for a wire whose component was deleted mid-drag, or if the wire is deleted (Delete key) while a bend-drag is still in progress (are the module-scope pointermove/pointerup listeners for that drag still attached to a since-removed wire)?
3. Does removeNearestBendPoint (and the dblclick handler) correctly no-op (not throw, not push a needless history entry) when double-clicking a wire that currently has zero bend points?
4. In smoothPath, does the pts.length===1 case (can this ever occur given callers always build [a,...points,b] which has at least 2 elements when points=[])) get handled safely, or could it produce an invalid SVG path string it's never actually reachable?
5. Does dragging a bend point to a position that overlaps a hole/pin/component (i.e. released ON TOP of some other element) cause any conflict with THAT element's own pointerdown handler, given the wireLayer pointerdown handler calls e.stopPropagation()?
Report hasBug=true only for a concrete, reachable bug with a specific repro (exact user action sequence). Set subject to "wire bending".`,
  },
  {
    key: 'dragCancel',
    label: 'Drag + Escape-cancel engine',
    prompt: `Read ${FILE} lines 1167-1230 (startDragBoard) and lines 1313-1358 (startDragComponent), plus the Escape-key handling inside setupWiringHandlers (search "state.activeDrag").
Context: dragging a board or a component now supports Escape-to-cancel: on the first real pointer movement past a small threshold, pushHistory() is called once and state.activeDrag={cancel} is set; Escape calls activeDrag.cancel() which reverts position (and, for components, pinPlug) and pops the just-pushed history entry (since nothing net happened); a normal pointerup either commits the drag (re-running applySnap) or (if never dragged) treats it as a click/select.
Look specifically for:
1. Race/cleanup bugs: after Escape cancels a drag, are the document-level pointermove/pointerup listeners for that SAME drag definitely removed, so a subsequent pointerup (the one the user's mouse button release naturally generates right after the Escape keypress) can't fire the original move/up closures again and re-apply position changes or push a stray second history entry?
2. For startDragBoard specifically: if a board is dragged and then cancelled, are ALL attached components' positions correctly restored (the 'origins' array) - what happens if a component was ADDED to that board (newly snapped onto it) DURING the same drag gesture (can't happen here since dragging a board doesn't create components, but double-check nothing else mutates 'state.components' mid-drag that could desync 'origins' from 'state.components')?
3. Is there any scenario where state.activeDrag could be left non-null after a drag legitimately completes via pointerup (should be set to null in both the drag-committed and click branches) - trace both branches of each function's up() handler.
4. If the user presses Escape when NO drag and NO pending wire are active, does the handler no-op safely (activeDrag is null, clearPending() on an already-clear pending state)?
Report hasBug=true only for a concrete, reachable bug with a specific repro. Set subject to "drag/escape-cancel".`,
  },
]

phase('Verify IC logic')
const icResults = await pipeline(
  IC_TASKS,
  task => agent(task.prompt, { label: `ic:${task.key}`, phase: 'Verify IC logic', schema: FINDING_SCHEMA })
)

phase('Recheck IC findings')
const icFlagged = icResults.map((r, i) => ({ r, task: IC_TASKS[i] })).filter(x => x.r && x.r.hasBug)
const icRechecked = await parallel(icFlagged.map(({ r, task }) => () =>
  agent(
    `Independently verify this claimed bug in a breadboard circuit simulator's ${task.label} implementation, before it gets reported to the user. Read ${FILE} lines ${task.lines} yourself and re-derive the real datasheet facts from scratch (do not just trust the claim). Claimed bug: ${JSON.stringify(r.findings)}. Try to REFUTE it - is the original pin mapping/logic actually correct and the claim mistaken? Only confirm if you independently reach the same conclusion.`,
    { label: `recheck:${task.key}`, phase: 'Recheck IC findings', schema: VERDICT_SCHEMA }
  ).then(v => ({ key: task.key, label: task.label, lines: task.lines, findings: r.findings, verdict: v }))
))

phase('Review engine code')
const engineResults = await pipeline(
  ENGINE_TASKS,
  task => agent(task.prompt, { label: `engine:${task.key}`, phase: 'Review engine code', schema: FINDING_SCHEMA })
)

phase('Recheck engine findings')
const engineFlagged = engineResults.map((r, i) => ({ r, task: ENGINE_TASKS[i] })).filter(x => x.r && x.r.hasBug)
const engineRechecked = await parallel(engineFlagged.map(({ r, task }) => () =>
  agent(
    `Independently verify this claimed bug in a breadboard circuit simulator's ${task.label} code, before it gets reported to the user. Read ${FILE} yourself around the relevant functions and re-trace the logic from scratch with a concrete example (do not just trust the claim). Claimed bug: ${JSON.stringify(r.findings)}. Try to REFUTE it first - construct the scenario and check whether the described failure actually reproduces. Only confirm if you independently reproduce/confirm the same conclusion.`,
    { label: `recheck:${task.key}`, phase: 'Recheck engine findings', schema: VERDICT_SCHEMA }
  ).then(v => ({ key: task.key, label: task.label, findings: r.findings, verdict: v }))
))

return {
  icResults: IC_TASKS.map((t, i) => ({ key: t.key, label: t.label, lines: t.lines, result: icResults[i] })),
  icRechecked,
  engineResults: ENGINE_TASKS.map((t, i) => ({ key: t.key, label: t.label, result: engineResults[i] })),
  engineRechecked,
}
