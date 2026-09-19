// interactions.js — pointer & keyboard event handling for the workspace.
(function (global) {
  'use strict';

  const G = () => global.MC.Geometry;
  const S = () => global.MC.State;
  const R = () => global.MC.Render;
  const UI = () => global.MC.UI;

  let svgRoot, container, marqueeEl;
  let mode = 'idle';
  let renderScheduled = false;

  let panStartClient = null, panStartView = null;
  let dragStartWorld = null, dragSnapshot = null;
  let boxStartClient = null, boxStartWorld = null;
  let wireDraft = null; // { fromRef, points: [world points] }
  let bendDrag = null;  // { wireId, index }
  let pendingLabelKind = null;
  let hoveredPinKey = null;

  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => { renderScheduled = false; R().renderAll(); });
  }

  function clientToWorld(clientX, clientY) {
    const rect = svgRoot.getBoundingClientRect();
    const v = S().data.view;
    return { x: (clientX - rect.left - v.panX) / v.zoom, y: (clientY - rect.top - v.panY) / v.zoom };
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ---------------- zoom / pan ----------------

  function zoomAt(clientX, clientY, factor) {
    const rect = svgRoot.getBoundingClientRect();
    const mx = clientX - rect.left, my = clientY - rect.top;
    const v = S().data.view;
    const worldBefore = { x: (mx - v.panX) / v.zoom, y: (my - v.panY) / v.zoom };
    const newZoom = clamp(v.zoom * factor, 0.1, 5);
    v.zoom = newZoom;
    v.panX = mx - worldBefore.x * newZoom;
    v.panY = my - worldBefore.y * newZoom;
    scheduleRender();
  }
  function setZoom(zoom) {
    const rect = svgRoot.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, zoom / S().data.view.zoom);
  }
  function fitToView(padding) {
    const bbox = G().boardsAndComponentsBBox(S().data.boards, S().data.components, S().data.labels);
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, bbox.maxX - bbox.minX), h = Math.max(1, bbox.maxY - bbox.minY);
    const pad = padding == null ? 60 : padding;
    const zoom = clamp(Math.min((rect.width - pad * 2) / w, (rect.height - pad * 2) / h), 0.1, 5);
    const v = S().data.view;
    v.zoom = zoom;
    v.panX = rect.width / 2 - (bbox.minX + w / 2) * zoom;
    v.panY = rect.height / 2 - (bbox.minY + h / 2) * zoom;
    scheduleRender();
  }
  function fitToSelection() {
    const items = [];
    S().selection.components.forEach(id => { const c = S().getComponent(id); if (c) items.push(R().componentWorldBBox(c)); });
    S().selection.boards.forEach(id => { const b = S().getBoard(id); if (b) items.push(R().boardWorldBBox(b)); });
    if (!items.length) { fitToView(); return; }
    const minX = Math.min(...items.map(i => i.minX)), minY = Math.min(...items.map(i => i.minY));
    const maxX = Math.max(...items.map(i => i.maxX)), maxY = Math.max(...items.map(i => i.maxY));
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
    const zoom = clamp(Math.min((rect.width - 120) / w, (rect.height - 120) / h), 0.1, 5);
    const v = S().data.view;
    v.zoom = zoom;
    v.panX = rect.width / 2 - (minX + w / 2) * zoom;
    v.panY = rect.height / 2 - (minY + h / 2) * zoom;
    scheduleRender();
  }
  function panToWorld(x, y) {
    const rect = container.getBoundingClientRect();
    const v = S().data.view;
    v.panX = rect.width / 2 - x * v.zoom;
    v.panY = rect.height / 2 - y * v.zoom;
    scheduleRender();
  }

  // ---------------- hit testing ----------------

  function hitTest(target) {
    const pinHit = target.closest && target.closest('[data-pin]');
    if (pinHit) return { kind: 'pin', componentId: pinHit.getAttribute('data-comp-id'), pin: parseInt(pinHit.getAttribute('data-pin'), 10) };
    const bendHit = target.closest && target.closest('.wire-bend');
    if (bendHit) return { kind: 'bend', wireId: bendHit.getAttribute('data-wire-id'), index: parseInt(bendHit.getAttribute('data-bend-index'), 10) };
    const compHit = target.closest && target.closest('[data-comp-id]');
    if (compHit) return { kind: 'component', id: compHit.getAttribute('data-comp-id') };
    const wireHit = target.closest && target.closest('[data-wire-id]');
    if (wireHit) return { kind: 'wire', id: wireHit.getAttribute('data-wire-id') };
    const labelHit = target.closest && target.closest('[data-label-id]');
    if (labelHit) return { kind: 'label', id: labelHit.getAttribute('data-label-id') };
    const boardHit = target.closest && target.closest('[data-board-id]');
    if (boardHit) return { kind: 'board', id: boardHit.getAttribute('data-board-id') };
    return { kind: 'empty' };
  }

  // World-space radius for resolving a click to a breadboard hole. Must exceed the
  // worst-case distance from any point to its nearest hole (PITCH/sqrt(2) ~= 7.07)
  // so every click inside a board's hole field resolves to *some* hole, with no dead
  // zones. Deliberately zoom-independent: hole spacing is fixed in world units.
  function holeThreshold() { return G().PITCH * 0.8; }

  function resolveConnectionPoint(hit, world) {
    if (hit.kind === 'pin') return { type: 'componentPin', componentId: hit.componentId, pin: hit.pin };
    const hole = G().nearestHoleAmongBoards(S().data.boards, world.x, world.y, holeThreshold());
    if (hole) return { type: 'breadboardHole', boardId: hole.boardId, row: hole.row, column: hole.col };
    return null;
  }

  function refsEqual(a, b) {
    if (!a || !b || a.type !== b.type) return false;
    if (a.type === 'componentPin') return a.componentId === b.componentId && a.pin === b.pin;
    return a.boardId === b.boardId && a.row === b.row && a.column === b.column;
  }

  // ---------------- wire drawing ----------------

  function startWireDraft(ref) {
    wireDraft = { fromRef: ref, points: [] };
    mode = 'wiring';
    svgRoot.classList.add('wiring');
    UI().setStatusMode('점퍼선 연결 중 (Esc 취소)');
    UI().hideHoverTip();
    if (hoveredPinKey) { hoveredPinKey = null; R().setHighlightPin(null); }
  }

  function cancelWireDraft() {
    wireDraft = null;
    mode = 'idle';
    svgRoot.classList.remove('wiring');
    clearWirePreview();
    UI().setStatusMode('선택');
    UI().hideHoverTip();
  }

  function completeWire(targetRef) {
    if (refsEqual(wireDraft.fromRef, targetRef)) return; // no self-loop on same point
    const color = S().data.recentColors[0] || '#f2c94c';
    const wire = {
      id: S().nextId('w'),
      color,
      thickness: S().data.settings.wireThickness,
      from: wireDraft.fromRef,
      to: targetRef,
      points: wireDraft.points.slice()
    };
    S().addWire(wire);
    S().selectOnly('wires', wire.id);
    cancelWireDraft();
  }

  function clearWirePreview() {
    const layer = document.getElementById('wire-preview-layer');
    while (layer.firstChild) layer.removeChild(layer.firstChild);
  }

  function renderWirePreview(currentWorld) {
    clearWirePreview();
    const from = R().resolveEndpoint(wireDraft.fromRef);
    if (!from) return;
    const pts = [{ x: from.x, y: from.y }, ...wireDraft.points, currentWorld];
    const d = R().pathD(pts);
    const layer = document.getElementById('wire-preview-layer');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', S().data.recentColors[0] || '#f2c94c');
    path.setAttribute('stroke-width', 2);
    path.setAttribute('stroke-dasharray', '4 3');
    path.setAttribute('opacity', '0.85');
    layer.appendChild(path);
  }

  // ---------------- entity drag ----------------

  function startDragSelected(world) {
    mode = 'dragging';
    dragStartWorld = world;
    dragSnapshot = { components: [], boards: [], labels: [] };
    S().selection.components.forEach(id => {
      const c = S().getComponent(id);
      if (c && !c.locked) dragSnapshot.components.push({ id, x0: c.x, y0: c.y });
    });
    S().selection.boards.forEach(id => {
      const b = S().getBoard(id);
      if (!b || b.locked) return;
      dragSnapshot.boards.push({ id, x0: b.x, y0: b.y });
      if (S().data.settings.moveChildrenWithBoard) {
        S().data.components.forEach(c => {
          if (c.boardId === id && !c.locked && !dragSnapshot.components.find(x => x.id === c.id)) {
            dragSnapshot.components.push({ id: c.id, x0: c.x, y0: c.y });
          }
        });
      }
    });
    S().selection.labels.forEach(id => {
      const l = S().getLabel(id);
      if (l && !l.locked) dragSnapshot.labels.push({ id, x0: l.x, y0: l.y, x2_0: l.x2, y2_0: l.y2 });
    });
  }

  function computeSnappedDelta(rawDx, rawDy, altHeld) {
    if (!dragSnapshot.components.length && !dragSnapshot.boards.length) return { dx: rawDx, dy: rawDy };
    if (!S().data.settings.snapToGrid || altHeld) return { dx: rawDx, dy: rawDy };
    if (dragSnapshot.components.length) {
      const primary = dragSnapshot.components[0];
      const targetX = primary.x0 + rawDx, targetY = primary.y0 + rawDy;
      const hole = G().nearestHoleAmongBoards(S().data.boards, targetX, targetY, G().PITCH * 4);
      if (hole) return { dx: hole.x - primary.x0, dy: hole.y - primary.y0 };
      const g = G().snapToGlobalGrid(targetX, targetY);
      return { dx: g.x - primary.x0, dy: g.y - primary.y0 };
    }
    const primary = dragSnapshot.boards[0];
    const g = G().snapToGlobalGrid(primary.x0 + rawDx, primary.y0 + rawDy);
    return { dx: g.x - primary.x0, dy: g.y - primary.y0 };
  }

  function liveUpdateDrag(dx, dy) {
    dragSnapshot.components.forEach(item => {
      const node = document.querySelector('[data-comp-id="' + cssEscape(item.id) + '"]');
      const comp = S().getComponent(item.id);
      if (!node || !comp) return;
      const nx = item.x0 + dx, ny = item.y0 + dy;
      const center = R().componentLocalCenter(comp);
      node.setAttribute('transform', `translate(${nx},${ny}) rotate(${comp.rotation || 0} ${center.x} ${center.y})`);
    });
    dragSnapshot.boards.forEach(item => {
      const node = document.querySelector('[data-board-id="' + cssEscape(item.id) + '"]');
      if (node) node.setAttribute('transform', `translate(${item.x0 + dx},${item.y0 + dy})`);
    });
    dragSnapshot.labels.forEach(item => {
      // labels re-rendered fully on drag end; skip live transform for simplicity of mixed shapes
    });
    liveUpdateWires(dx, dy);
    liveUpdateSelectionOutlines(dx, dy);
  }

  function liveUpdateWires(dx, dy) {
    const movedComp = new Set(dragSnapshot.components.map(c => c.id));
    S().data.wires.forEach(wire => {
      const touches = ref => ref.type === 'componentPin' && movedComp.has(ref.componentId);
      if (!touches(wire.from) && !touches(wire.to)) return;
      const applied = applyDeltaToWire(wire, dx, dy, movedComp);
      const d = R().pathD(applied);
      const g = document.querySelector('[data-wire-id="' + cssEscape(wire.id) + '"]');
      if (!g) return;
      g.querySelectorAll('path').forEach(p => p.setAttribute('d', d));
    });
  }

  function applyDeltaToWire(wire, dx, dy, movedSet) {
    const from = R().resolveEndpoint(wire.from);
    const to = R().resolveEndpoint(wire.to);
    const fromMoved = wire.from.type === 'componentPin' && movedSet.has(wire.from.componentId);
    const toMoved = wire.to.type === 'componentPin' && movedSet.has(wire.to.componentId);
    const fromPt = from ? { x: from.x + (fromMoved ? dx : 0), y: from.y + (fromMoved ? dy : 0) } : { x: 0, y: 0 };
    const toPt = to ? { x: to.x + (toMoved ? dx : 0), y: to.y + (toMoved ? dy : 0) } : { x: 0, y: 0 };
    return [fromPt, ...(wire.points || []), toPt];
  }

  function liveUpdateSelectionOutlines(dx, dy) {
    document.querySelectorAll('#selection-layer .selection-outline').forEach(rect => {
      const x = parseFloat(rect.getAttribute('data-base-x'));
      const y = parseFloat(rect.getAttribute('data-base-y'));
      if (isNaN(x) || isNaN(y)) {
        rect.setAttribute('data-base-x', rect.getAttribute('x'));
        rect.setAttribute('data-base-y', rect.getAttribute('y'));
        return;
      }
      rect.setAttribute('x', x + dx);
      rect.setAttribute('y', y + dy);
    });
  }

  function cssEscape(id) {
    return (window.CSS && CSS.escape) ? CSS.escape(id) : id.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function commitDrag(dx, dy) {
    const moves = [];
    dragSnapshot.components.forEach(item => moves.push({ kind: 'components', id: item.id, dx, dy }));
    dragSnapshot.boards.forEach(item => moves.push({ kind: 'boards', id: item.id, dx, dy }));
    dragSnapshot.labels.forEach(item => moves.push({ kind: 'labels', id: item.id, dx, dy }));
    if (moves.length) S().moveEntities(moves, '이동');
    else R().renderAll();
  }

  function cancelDrag() {
    mode = 'idle';
    dragSnapshot = null;
    R().renderAll();
  }

  // ---------------- box select ----------------

  function rectsOverlap(a, b) {
    return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
  }

  function startBoxSelect(clientPt, worldPt) {
    mode = 'boxSelecting';
    boxStartClient = clientPt;
    boxStartWorld = worldPt;
    marqueeEl.hidden = false;
  }

  function updateBoxSelect(clientPt) {
    const rect = container.getBoundingClientRect();
    const x1 = boxStartClient.x - rect.left, y1 = boxStartClient.y - rect.top;
    const x2 = clientPt.x - rect.left, y2 = clientPt.y - rect.top;
    marqueeEl.style.left = Math.min(x1, x2) + 'px';
    marqueeEl.style.top = Math.min(y1, y2) + 'px';
    marqueeEl.style.width = Math.abs(x2 - x1) + 'px';
    marqueeEl.style.height = Math.abs(y2 - y1) + 'px';
  }

  function finalizeBoxSelect(worldPt, additive) {
    marqueeEl.hidden = true;
    const rectWorld = {
      minX: Math.min(boxStartWorld.x, worldPt.x), maxX: Math.max(boxStartWorld.x, worldPt.x),
      minY: Math.min(boxStartWorld.y, worldPt.y), maxY: Math.max(boxStartWorld.y, worldPt.y)
    };
    if (Math.abs(rectWorld.maxX - rectWorld.minX) < 2 && Math.abs(rectWorld.maxY - rectWorld.minY) < 2) {
      if (!additive) S().clearSelection();
      mode = 'idle';
      return;
    }
    if (!additive) { S().selection.boards.clear(); S().selection.components.clear(); S().selection.wires.clear(); S().selection.labels.clear(); }
    S().data.components.forEach(c => { if (!c.hidden && rectsOverlap(rectWorld, R().componentWorldBBox(c))) S().selection.components.add(c.id); });
    S().data.boards.forEach(b => { if (!b.hidden && rectsOverlap(rectWorld, R().boardWorldBBox(b))) S().selection.boards.add(b.id); });
    S().data.labels.forEach(l => { if (!l.hidden && rectsOverlap(rectWorld, R().labelWorldBBox(l))) S().selection.labels.add(l.id); });
    S().data.wires.forEach(w => {
      if (w.hidden) return;
      const pts = R().wirePathPoints(w);
      if (!pts) return;
      if (pts.some(p => p.x >= rectWorld.minX && p.x <= rectWorld.maxX && p.y >= rectWorld.minY && p.y <= rectWorld.maxY)) S().selection.wires.add(w.id);
    });
    S().notifySelection();
    mode = 'idle';
  }

  // ---------------- labels placement ----------------

  function beginPlaceLabel(kind) { pendingLabelKind = kind; svgRoot.classList.add('wiring'); UI().setStatusMode('배치할 위치 클릭 (Esc 취소)'); }

  function placeLabel(kind, world) {
    const id = S().nextId('l');
    let label;
    if (kind === 'text') label = { id, kind: 'text', x: world.x, y: world.y, text: '텍스트', fontSize: 14, color: '#e6e9ef' };
    else if (kind === 'rect') label = { id, kind: 'rect', x: world.x, y: world.y, width: 160, height: 100, color: '#e6e9ef', text: '' };
    else label = { id, kind: 'arrow', x: world.x, y: world.y, x2: world.x + 80, y2: world.y, color: '#e6e9ef' };
    S().addLabel(label);
    S().selectOnly('labels', id);
    pendingLabelKind = null;
    svgRoot.classList.remove('wiring');
    UI().setStatusMode('선택');
  }

  // ---------------- pointer events ----------------

  function onPointerDown(e) {
    if (e.target.closest('#minimap')) return; // handled separately
    const clientPt = { x: e.clientX, y: e.clientY };
    const world = clientToWorld(e.clientX, e.clientY);

    if (e.button === 1) {
      e.preventDefault();
      mode = 'panning';
      panStartClient = clientPt;
      panStartView = { x: S().data.view.panX, y: S().data.view.panY };
      svgRoot.classList.add('panning');
      return;
    }
    if (e.button !== 0) return;

    if (pendingLabelKind) { placeLabel(pendingLabelKind, world); return; }

    if (wireDraft) {
      const hit = hitTest(e.target);
      const conn = resolveConnectionPoint(hit, world);
      if (conn) { completeWire(conn); return; }
      wireDraft.points.push(snapPointMaybe(world, e.altKey));
      renderWirePreview(world);
      return;
    }

    if (e.shiftKey && hitTest(e.target).kind === 'empty' && !G().nearestHoleAmongBoards(S().data.boards, world.x, world.y, holeThreshold())) {
      mode = 'panning';
      panStartClient = clientPt;
      panStartView = { x: S().data.view.panX, y: S().data.view.panY };
      svgRoot.classList.add('panning');
      return;
    }

    const hit = hitTest(e.target);

    if (hit.kind === 'pin') {
      const comp = S().getComponent(hit.componentId);
      if (comp && comp.locked) { /* still allow starting a wire from a locked component's pin */ }
      startWireDraft({ type: 'componentPin', componentId: hit.componentId, pin: hit.pin });
      renderWirePreview(world);
      return;
    }
    if (hit.kind === 'bend') {
      bendDrag = { wireId: hit.wireId, index: hit.index };
      mode = 'draggingBend';
      S().selectOnly('wires', hit.wireId);
      return;
    }
    if (hit.kind === 'wire') {
      if (e.shiftKey) S().toggleSelect('wires', hit.id); else S().selectOnly('wires', hit.id);
      return;
    }
    if (hit.kind === 'label') {
      selectAndMaybeDrag('labels', hit.id, e, world);
      return;
    }
    if (hit.kind === 'component') {
      selectAndMaybeDrag('components', hit.id, e, world);
      return;
    }
    if (hit.kind === 'board') {
      selectAndMaybeDrag('boards', hit.id, e, world);
      return;
    }

    const hole = G().nearestHoleAmongBoards(S().data.boards, world.x, world.y, holeThreshold());
    if (hole) {
      startWireDraft({ type: 'breadboardHole', boardId: hole.boardId, row: hole.row, column: hole.col });
      renderWirePreview(world);
      return;
    }

    if (!e.shiftKey) S().clearSelection();
    startBoxSelect(clientPt, world);
  }

  function selectAndMaybeDrag(kind, id, e, world) {
    const already = S().isSelected(kind, id);
    if (e.shiftKey) S().toggleSelect(kind, id);
    else if (!already) S().selectOnly(kind, id);
    if (S().isLocked(kind === 'boards' ? 'board' : kind === 'labels' ? 'label' : 'component', id)) return;
    if (e.shiftKey && !already) return; // just added to selection, don't yank into a drag unexpectedly
    startDragSelected(world);
  }

  function snapPointMaybe(world, altHeld) {
    if (!S().data.settings.snapToGrid || altHeld) return world;
    const hole = G().nearestHoleAmongBoards(S().data.boards, world.x, world.y, G().PITCH * 0.9);
    if (hole) return { x: hole.x, y: hole.y };
    return G().snapToGlobalGrid(world.x, world.y);
  }

  function onPointerMove(e) {
    const world = clientToWorld(e.clientX, e.clientY);
    UI().setStatusCoords(world);

    if (mode === 'panning') {
      const dx = e.clientX - panStartClient.x, dy = e.clientY - panStartClient.y;
      S().data.view.panX = panStartView.x + dx;
      S().data.view.panY = panStartView.y + dy;
      scheduleRender();
      return;
    }
    if (mode === 'boxSelecting') { updateBoxSelect({ x: e.clientX, y: e.clientY }); return; }
    if (mode === 'dragging') {
      const rawDx = world.x - dragStartWorld.x, rawDy = world.y - dragStartWorld.y;
      const { dx, dy } = computeSnappedDelta(rawDx, rawDy, e.altKey);
      liveUpdateDrag(dx, dy);
      lastDragDelta = { dx, dy };
      return;
    }
    if (mode === 'draggingBend') {
      const wire = S().getWire(bendDrag.wireId);
      if (!wire) return;
      const pt = snapPointMaybe(world, e.altKey);
      const pts = (wire.points || []).slice();
      pts[bendDrag.index] = pt;
      const g = document.querySelector('[data-wire-id="' + cssEscape(wire.id) + '"]');
      const from = R().resolveEndpoint(wire.from), to = R().resolveEndpoint(wire.to);
      if (g && from && to) {
        const d = R().pathD([from, ...pts, to]);
        g.querySelectorAll('path').forEach(p => p.setAttribute('d', d));
      }
      const handle = document.querySelector('.wire-bend[data-wire-id="' + cssEscape(wire.id) + '"][data-bend-index="' + bendDrag.index + '"]');
      if (handle) { handle.setAttribute('cx', pt.x); handle.setAttribute('cy', pt.y); }
      pendingBendPoints = pts;
      return;
    }
    if (mode === 'wiring') { renderWirePreview(snapPointMaybe(world, e.altKey)); return; }

    // idle hover: pin tooltip + connection highlight, wire hover
    const hit = hitTest(e.target);
    if (hit.kind === 'pin') {
      const comp = S().getComponent(hit.componentId);
      const pinInfo = comp ? R().componentPinWorldByIndex(comp, hit.pin) : null;
      const key = hit.componentId + ':' + hit.pin;
      if (hoveredPinKey !== key) { hoveredPinKey = key; R().setHighlightPin(key); }
      UI().showHoverTip(e.clientX, e.clientY, buildPinTooltip(comp, hit.pin, pinInfo));
      R().setHoverWire(null);
    } else {
      if (hoveredPinKey) { hoveredPinKey = null; R().setHighlightPin(null); }
      if (hit.kind === 'wire') {
        R().setHoverWire(hit.id);
        UI().showHoverTip(e.clientX, e.clientY, buildWireTooltip(S().getWire(hit.id)));
      } else {
        R().setHoverWire(null);
        UI().hideHoverTip();
      }
    }
  }

  let lastDragDelta = { dx: 0, dy: 0 };
  let pendingBendPoints = null;

  function buildPinTooltip(comp, pinIndex, pinInfo) {
    if (!comp || !pinInfo) return '';
    const connected = S().data.wires.filter(w => (w.from.type === 'componentPin' && w.from.componentId === comp.id && w.from.pin === pinIndex) ||
      (w.to.type === 'componentPin' && w.to.componentId === comp.id && w.to.pin === pinIndex));
    let html = `<b>${comp.name || comp.type}</b><br>Pin ${pinIndex}${pinInfo.name ? ' (' + pinInfo.name + ')' : ''}`;
    if (connected.length) html += '<br>Connected to: ' + connected.map(w => 'Wire ' + w.id).join(', ');
    else html += '<br>연결 없음';
    return html;
  }
  function buildWireTooltip(wire) {
    if (!wire) return '';
    const from = R().resolveEndpoint(wire.from), to = R().resolveEndpoint(wire.to);
    return `${from ? from.label : '?'}<br>↔<br>${to ? to.label : '?'}`;
  }

  function onPointerUp(e) {
    if (mode === 'panning') { mode = 'idle'; svgRoot.classList.remove('panning'); return; }
    if (mode === 'boxSelecting') { finalizeBoxSelect(clientToWorld(e.clientX, e.clientY), e.shiftKey); R().renderAll(); return; }
    if (mode === 'dragging') {
      const d = lastDragDelta;
      mode = 'idle';
      if (Math.abs(d.dx) > 0.01 || Math.abs(d.dy) > 0.01) commitDrag(d.dx, d.dy);
      else R().renderAll();
      dragSnapshot = null;
      lastDragDelta = { dx: 0, dy: 0 };
      return;
    }
    if (mode === 'draggingBend') {
      mode = 'idle';
      const wire = S().getWire(bendDrag.wireId);
      if (wire && pendingBendPoints) S().updateWire(wire.id, { points: pendingBendPoints }, '점퍼선 경로 변경');
      bendDrag = null; pendingBendPoints = null;
      return;
    }
  }

  function onDblClick(e) {
    const hit = hitTest(e.target);
    if (hit.kind === 'wire') {
      const wire = S().getWire(hit.id);
      if (!wire) return;
      const world = clientToWorld(e.clientX, e.clientY);
      const pts = R().wirePathPoints(wire);
      let bestIdx = 0, bestDist = Infinity;
      for (let i = 0; i < pts.length - 1; i++) {
        const d = G().distToSegment(world.x, world.y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      const newPoints = (wire.points || []).slice();
      newPoints.splice(bestIdx, 0, world);
      S().updateWire(wire.id, { points: newPoints }, '꺾임점 추가');
    } else if (hit.kind === 'component') {
      S().selectOnly('components', hit.id);
      UI().focusNameField();
    }
  }

  function onWheel(e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    } else {
      e.preventDefault();
      S().data.view.panX -= e.deltaX;
      S().data.view.panY -= e.deltaY;
      scheduleRender();
    }
  }

  function onContextMenu(e) {
    e.preventDefault();
    const hit = hitTest(e.target);
    const world = clientToWorld(e.clientX, e.clientY);
    let items = [];
    if (hit.kind === 'component') {
      if (!S().isSelected('components', hit.id)) S().selectOnly('components', hit.id);
      items = UI().componentContextItems(hit.id);
    } else if (hit.kind === 'wire') {
      if (!S().isSelected('wires', hit.id)) S().selectOnly('wires', hit.id);
      items = UI().wireContextItems(hit.id);
    } else if (hit.kind === 'board') {
      if (!S().isSelected('boards', hit.id)) S().selectOnly('boards', hit.id);
      items = UI().boardContextItems(hit.id);
    } else if (hit.kind === 'label') {
      if (!S().isSelected('labels', hit.id)) S().selectOnly('labels', hit.id);
      items = UI().labelContextItems(hit.id);
    } else {
      items = UI().canvasContextItems(world);
    }
    UI().showContextMenu(items, e.clientX, e.clientY);
  }

  // ---------------- clipboard ----------------

  let clipboard = null;

  function copySelection() {
    const compIds = new Set(S().selection.components);
    if (!compIds.size && !S().selection.labels.size) return;
    const components = S().data.components.filter(c => compIds.has(c.id)).map(c => JSON.parse(JSON.stringify(c)));
    const wires = S().data.wires.filter(w => {
      const hit = ref => ref.type === 'componentPin' && compIds.has(ref.componentId);
      return hit(w.from) && hit(w.to);
    }).map(w => JSON.parse(JSON.stringify(w)));
    const labels = S().data.labels.filter(l => S().selection.labels.has(l.id)).map(l => JSON.parse(JSON.stringify(l)));
    clipboard = { components, wires, labels };
  }

  function pasteClipboard() {
    if (!clipboard || (!clipboard.components.length && !clipboard.labels.length)) return;
    const OFFSET = 24;
    const idMap = {};
    const newComponents = clipboard.components.map(c => {
      const newId = S().nextId('c');
      idMap[c.id] = newId;
      return Object.assign({}, c, { id: newId, x: c.x + OFFSET, y: c.y + OFFSET, boardId: null });
    });
    const newWires = clipboard.wires.map(w => {
      const remap = ref => ref.type === 'componentPin' ? Object.assign({}, ref, { componentId: idMap[ref.componentId] }) : ref;
      return Object.assign({}, w, {
        id: S().nextId('w'),
        from: remap(w.from), to: remap(w.to),
        points: (w.points || []).map(p => ({ x: p.x + OFFSET, y: p.y + OFFSET }))
      });
    });
    const newLabels = clipboard.labels.map(l => {
      const copy = Object.assign({}, l, { id: S().nextId('l'), x: l.x + OFFSET, y: l.y + OFFSET });
      if (copy.x2 !== undefined) copy.x2 += OFFSET;
      if (copy.y2 !== undefined) copy.y2 += OFFSET;
      return copy;
    });
    S().transaction('붙여넣기', d => {
      newComponents.forEach(c => d.components.push(c));
      newWires.forEach(w => d.wires.push(w));
      newLabels.forEach(l => d.labels.push(l));
    });
    S().selection.boards.clear(); S().selection.components.clear(); S().selection.wires.clear(); S().selection.labels.clear();
    newComponents.forEach(c => S().selection.components.add(c.id));
    newLabels.forEach(l => S().selection.labels.add(l.id));
    S().notifySelection();
  }

  function duplicateBoard(boardId) {
    const b = S().getBoard(boardId);
    if (!b) return;
    const copy = Object.assign({}, b, { id: S().nextId('bb'), name: (b.name || b.id) + ' 복사본', x: b.x + 30, y: b.y + 30, locked: false });
    S().addBoard(copy);
    S().selectOnly('boards', copy.id);
  }

  // ---------------- keyboard ----------------

  function isTypingTarget(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  function rotateSelection() {
    const ids = Array.from(S().selection.components).filter(id => !S().isLocked('component', id));
    if (!ids.length) return;
    S().transaction('회전', d => {
      ids.forEach(id => {
        const c = d.components.find(x => x.id === id);
        if (c) c.rotation = ((c.rotation || 0) + 90) % 360;
      });
    });
  }

  function onKeyDown(e) {
    if (isTypingTarget(e)) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); global.MC.IO.saveProject(); return; }
    if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); S().undo(); return; }
    if ((ctrl && e.key.toLowerCase() === 'y') || (ctrl && e.shiftKey && e.key.toLowerCase() === 'z')) { e.preventDefault(); S().redo(); return; }
    if (ctrl && e.key.toLowerCase() === 'c') { e.preventDefault(); copySelection(); return; }
    if (ctrl && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteClipboard(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); S().deleteSelection(); return; }
    if (e.key.toLowerCase() === 'r' && !ctrl) { rotateSelection(); return; }
    if (e.key === 'Escape') {
      if (wireDraft) cancelWireDraft();
      else if (mode === 'dragging') cancelDrag();
      else if (pendingLabelKind) { pendingLabelKind = null; svgRoot.classList.remove('wiring'); UI().setStatusMode('선택'); }
      else S().clearSelection();
      return;
    }
    if (e.key.toLowerCase() === 'f' && !ctrl) { fitToView(); return; }
    if (e.key === '1' && !ctrl) { setZoom(1); return; }
    if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomAt(container.getBoundingClientRect().width / 2 + container.getBoundingClientRect().left, container.getBoundingClientRect().height / 2 + container.getBoundingClientRect().top, 1.15); return; }
    if (ctrl && e.key === '-') { e.preventDefault(); zoomAt(container.getBoundingClientRect().width / 2 + container.getBoundingClientRect().left, container.getBoundingClientRect().height / 2 + container.getBoundingClientRect().top, 1 / 1.15); return; }
  }

  // ---------------- minimap drag-to-pan ----------------

  function onMinimapPointerDown(e) {
    const svg = document.getElementById('minimap');
    const rect = svg.getBoundingClientRect();
    const scale = parseFloat(svg.dataset.scale || '1');
    const offx = parseFloat(svg.dataset.offx || '0');
    const offy = parseFloat(svg.dataset.offy || '0');
    function go(ev) {
      const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
      const worldX = (mx - offx) / scale, worldY = (my - offy) / scale;
      panToWorld(worldX, worldY);
    }
    go(e);
    function move(ev) { go(ev); }
    function up() { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function init() {
    svgRoot = document.getElementById('workspace');
    container = document.getElementById('workspace-container');
    marqueeEl = document.getElementById('marquee');

    svgRoot.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    svgRoot.addEventListener('dblclick', onDblClick);
    container.addEventListener('wheel', onWheel, { passive: false });
    svgRoot.addEventListener('contextmenu', onContextMenu);
    document.getElementById('minimap').addEventListener('pointerdown', onMinimapPointerDown);
    window.addEventListener('keydown', onKeyDown);
    svgRoot.addEventListener('mouseleave', () => { UI().hideHoverTip(); });
  }

  global.MC = global.MC || {};
  global.MC.Interactions = {
    init, zoomAt, setZoom, fitToView, fitToSelection, panToWorld,
    beginPlaceLabel, copySelection, pasteClipboard, duplicateBoard, rotateSelection,
    cancelWireDraft, scheduleRender
  };
})(window);
