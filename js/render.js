// render.js — turns MC.State.data into SVG. Pure(ish) rendering; interactions.js owns events.
(function (global) {
  'use strict';

  const G = () => global.MC.Geometry;
  const S = () => global.MC.State;
  const P = () => global.MC.Parts;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, children) {
    const node = document.createElementNS(SVG_NS, tag);
    if (attrs) for (const k in attrs) {
      if (attrs[k] === undefined || attrs[k] === null) continue;
      if (k === 'text') node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    }
    if (children) children.forEach(c => c && node.appendChild(c));
    return node;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // ---------------- geometry helpers shared with interactions/io ----------------

  function componentLocalBBox(component) {
    const part = P().get(component.type);
    if (!part) return { width: 20, height: 20 };
    if (part.layout === 'dip') {
      const size = G().dipBodySize(part.pins.length, part.pinRowGap || 1);
      return { width: size.width, height: size.height, overhang: size.overhang };
    }
    const n = part.pins.length;
    const spacing = (part.pinSpacing == null ? 1 : part.pinSpacing) * G().PITCH;
    return { width: (n - 1) * spacing, height: 0, overhang: G().PITCH * 0.6 };
  }

  function effectivePinNames(component, part) {
    if (part.editablePins && component.props && Array.isArray(component.props.pinNames) && component.props.pinNames.length === part.pins.length) {
      return component.props.pinNames;
    }
    return part.pins;
  }

  function componentPinLocalOffsets(component) {
    const part = P().get(component.type);
    if (!part) return [];
    const names = effectivePinNames(component, part);
    if (part.layout === 'dip') {
      return names.map((name, i) => {
        const off = G().dipPinLocalOffset(i + 1, names.length, part.pinRowGap || 1);
        return { index: i + 1, name, x: off.x, y: off.y, row: off.row };
      });
    }
    const spacing = (part.pinSpacing == null ? 1 : part.pinSpacing) * G().PITCH;
    return names.map((name, i) => ({ index: i + 1, name, x: i * spacing, y: 0, row: 0 }));
  }

  // Bounding-box center in local space (rotation pivot), before translating to world.
  function componentLocalCenter(component) {
    const bbox = componentLocalBBox(component);
    return { x: bbox.width / 2, y: bbox.height / 2 };
  }

  function componentPinWorldPositions(component) {
    const offsets = componentPinLocalOffsets(component);
    const center = componentLocalCenter(component);
    const rot = component.rotation || 0;
    return offsets.map(o => {
      const rotated = G().rotatePoint(o.x, o.y, center.x, center.y, rot);
      return { index: o.index, name: o.name, x: component.x + rotated.x, y: component.y + rotated.y };
    });
  }

  function componentPinWorldByIndex(component, pinIndex) {
    return componentPinWorldPositions(component).find(p => p.index === pinIndex) || null;
  }

  // World-space bounding box of a component (post-rotation), for selection outlines / hit boxes.
  function componentWorldBBox(component) {
    const bbox = componentLocalBBox(component);
    const overhang = bbox.overhang || 0;
    const corners = [
      { x: -overhang, y: -overhang },
      { x: bbox.width + overhang, y: -overhang },
      { x: bbox.width + overhang, y: bbox.height + overhang },
      { x: -overhang, y: bbox.height + overhang }
    ];
    const center = componentLocalCenter(component);
    const rot = component.rotation || 0;
    const pts = corners.map(c => G().rotatePoint(c.x, c.y, center.x, center.y, rot));
    const xs = pts.map(p => p.x + component.x), ys = pts.map(p => p.y + component.y);
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
  }

  function boardWorldBBox(board) {
    return { minX: board.x, minY: board.y, maxX: board.x + G().BOARD_WIDTH, maxY: board.y + G().BOARD_HEIGHT };
  }

  function labelWorldBBox(label) {
    if (label.kind === 'arrow') {
      const minX = Math.min(label.x, label.x2), maxX = Math.max(label.x, label.x2);
      const minY = Math.min(label.y, label.y2), maxY = Math.max(label.y, label.y2);
      return { minX: minX - 6, minY: minY - 6, maxX: maxX + 6, maxY: maxY + 6 };
    }
    const w = label.width || (label.kind === 'text' ? Math.max(40, (label.text || '').length * (label.fontSize || 14) * 0.6) : 120);
    const h = label.height || (label.kind === 'text' ? (label.fontSize || 14) * 1.4 : 80);
    return { minX: label.x, minY: label.y, maxX: label.x + w, maxY: label.y + h };
  }

  // Resolve a wire endpoint reference to a world point (+ optional pin metadata).
  function resolveEndpoint(ref) {
    if (!ref) return null;
    if (ref.type === 'componentPin') {
      const c = S().getComponent(ref.componentId);
      if (!c) return null;
      const p = componentPinWorldByIndex(c, ref.pin);
      return p ? { x: p.x, y: p.y, label: (c.name || c.type) + ' Pin ' + ref.pin + (p.name ? ' (' + p.name + ')' : '') } : null;
    }
    if (ref.type === 'breadboardHole') {
      const b = S().getBoard(ref.boardId);
      if (!b) return null;
      const pos = G().holeWorldPos(b, ref.row, ref.column);
      return pos ? { x: pos.x, y: pos.y, label: (b.name || b.id) + ' ' + ref.row + ref.column } : null;
    }
    return null;
  }

  function wirePathPoints(wire) {
    const from = resolveEndpoint(wire.from);
    const to = resolveEndpoint(wire.to);
    if (!from || !to) return null;
    const mid = (wire.points || []);
    const pts = [{ x: from.x, y: from.y }, ...mid, { x: to.x, y: to.y }];
    if (S().data.settings.wireRouting === 'ortho' && mid.length === 0) {
      const midX = (from.x + to.x) / 2;
      return [{ x: from.x, y: from.y }, { x: midX, y: from.y }, { x: midX, y: to.y }, { x: to.x, y: to.y }];
    }
    return pts;
  }

  function pathD(points) {
    if (!points || !points.length) return '';
    return 'M ' + points.map(p => p.x.toFixed(2) + ' ' + p.y.toFixed(2)).join(' L ');
  }

  function wireStrokeWidth(wire) {
    const t = wire.thickness || S().data.settings.wireThickness || 'normal';
    return t === 'thin' ? 1.4 : t === 'thick' ? 3.4 : 2.2;
  }

  // ---------------- top-level render ----------------

  let svgRoot, worldG, boardsLayer, componentsLayer, wiresLayer, labelsLayer, selectionLayer, handlesLayer, wirePreviewLayer;
  let hoverState = { wireId: null, highlightPinKey: null };

  function init() {
    svgRoot = document.getElementById('workspace');
    worldG = document.getElementById('world');
    boardsLayer = document.getElementById('boards-layer');
    componentsLayer = document.getElementById('components-layer');
    wiresLayer = document.getElementById('wires-layer');
    labelsLayer = document.getElementById('labels-layer');
    selectionLayer = document.getElementById('selection-layer');
    handlesLayer = document.getElementById('handles-layer');
    wirePreviewLayer = document.getElementById('wire-preview-layer');
    buildGridPattern();
  }

  function buildGridPattern() {
    const defs = document.getElementById('workspace-defs');
    const pitch = G().PITCH;
    const pattern = el('pattern', { id: 'grid-pattern', width: pitch, height: pitch, patternUnits: 'userSpaceOnUse' }, [
      el('circle', { cx: pitch / 2, cy: pitch / 2, r: 0.6, class: 'grid-dot' })
    ]);
    defs.appendChild(pattern);
    const grid = document.getElementById('grid-layer');
    grid.appendChild(el('rect', { x: -20000, y: -20000, width: 40000, height: 40000, fill: 'url(#grid-pattern)' }));
  }

  function updateTransform() {
    const v = S().data.view;
    worldG.setAttribute('transform', `translate(${v.panX},${v.panY}) scale(${v.zoom})`);
    document.getElementById('grid-layer').style.display = S().data.settings.showGrid ? '' : 'none';
    const zoomPct = Math.round(v.zoom * 100);
    document.getElementById('zoom-display').textContent = zoomPct + '%';
    document.getElementById('status-zoom').textContent = 'Zoom ' + zoomPct + '%';
  }

  function pinLabelVisible(setting, zoom) {
    if (setting === 'always') return true;
    if (setting === 'hidden') return false;
    return zoom >= 1.4; // 'zoom' -> only once reasonably zoomed in
  }

  function renderBoards() {
    clear(boardsLayer);
    const geo = G();
    S().data.boards.forEach(board => {
      if (board.hidden) return;
      const g = el('g', { class: 'component' + (board.locked ? ' locked' : ''), 'data-board-id': board.id, transform: `translate(${board.x},${board.y})` });
      g.appendChild(el('rect', { class: 'board-body' + (board.locked ? ' locked' : ''), x: 0, y: 0, width: geo.BOARD_WIDTH, height: geo.BOARD_HEIGHT, rx: 4 }));

      // center gap band between E and F
      const eRow = geo.ROW_BY_KEY.E, fRow = geo.ROW_BY_KEY.F;
      const gapY = geo.MARGIN + (eRow.y + fRow.y) / 2;
      g.appendChild(el('rect', { class: 'center-gap', x: 4, y: gapY - 3, width: geo.BOARD_WIDTH - 8, height: 6 }));

      geo.ROWS.forEach(row => {
        const isRail = row.key.startsWith('PWR');
        if (isRail && geo.MAIN_ROW_KEYS.indexOf(row.key) === -1) {
          // rail label at left
        } else {
          g.appendChild(el('text', { class: 'row-tag', x: 4, y: geo.MARGIN + row.y + 2.6, text: row.key }));
        }
        for (let c = 0; c < geo.COLS; c++) {
          const pos = geo.holeLocalPos(row.key, c);
          let cls = 'hole';
          if (row.key.endsWith('PLUS')) cls += ' rail-plus';
          else if (row.key.endsWith('MINUS')) cls += ' rail-minus';
          g.appendChild(el('circle', { class: cls, cx: pos.x, cy: pos.y, r: 1.1 }));
        }
        if (row.key.endsWith('PLUS')) g.appendChild(el('text', { class: 'row-tag', x: geo.MARGIN - 12, y: geo.MARGIN + row.y + 2.6, text: '+', fill: '#b23b3b' }));
        if (row.key.endsWith('MINUS')) g.appendChild(el('text', { class: 'row-tag', x: geo.MARGIN - 12, y: geo.MARGIN + row.y + 2.6, text: '-', fill: '#2f4f9e' }));
      });

      g.appendChild(el('text', { class: 'board-label', x: geo.BOARD_WIDTH / 2, y: -6, 'text-anchor': 'middle', text: board.name || board.id }));
      boardsLayer.appendChild(g);
    });
  }

  function drawDipVisual(g, component, part, bbox) {
    const pad = 3;
    g.appendChild(el('rect', {
      class: 'chip-body', x: -pad, y: -pad, width: bbox.width + pad * 2, height: bbox.height + pad * 2, rx: 1.5
    }));
    // pin-1 notch (semi-circle) centered on the short edge nearest pin 1 (top-left, row0)
    g.appendChild(el('circle', { class: 'chip-pin1-dot', cx: -pad + 2.2, cy: -pad + 2.2, r: 1.1 }));
    const midY = bbox.height / 2;
    g.appendChild(el('text', {
      class: 'chip-label', x: bbox.width / 2, y: midY - 1, transform: `rotate(90 ${bbox.width / 2} ${midY})`, text: part.label
    }));
    if (component.name) {
      g.appendChild(el('text', {
        class: 'chip-name-label', x: bbox.width / 2, y: midY + 6, transform: `rotate(90 ${bbox.width / 2} ${midY})`, text: component.name
      }));
    }
  }

  function drawInlineVisual(g, component, part, bbox) {
    const visual = part.visual;
    const midX = bbox.width / 2;
    if (visual === 'resistor') {
      g.appendChild(el('line', { x1: 0, y1: 0, x2: bbox.width, y2: 0, stroke: '#9a9a9a', 'stroke-width': 1 }));
      g.appendChild(el('rect', { class: 'resistor-body', x: bbox.width * 0.2, y: -3.5, width: bbox.width * 0.6, height: 7, rx: 1.5 }));
      const bands = P().resistorColorBands(component.props && component.props.value);
      bands.forEach((color, i) => {
        g.appendChild(el('rect', { x: bbox.width * 0.28 + i * 4, y: -3.5, width: 2.4, height: 7, fill: color }));
      });
      g.appendChild(el('text', { class: 'part-label', x: midX, y: -7, text: (component.props && component.props.value) || part.label }));
    } else if (visual === 'led') {
      const color = (component.props && component.props.color) || 'Red';
      const fillMap = { Red: '#ff4d4d', Green: '#4dff88', Blue: '#4d8dff', Yellow: '#f5e14d', White: '#f5f5f5', Orange: '#ff9d4d' };
      g.appendChild(el('line', { x1: 0, y1: 0, x2: bbox.width, y2: 0, stroke: '#9a9a9a', 'stroke-width': 1 }));
      g.appendChild(el('circle', { class: 'led-body', cx: midX, cy: 0, r: bbox.width * 0.42, fill: fillMap[color] || '#ccc' }));
      g.appendChild(el('text', { class: 'part-label', x: midX, y: -bbox.width * 0.42 - 4, text: color + ' LED' }));
      g.appendChild(el('text', { class: 'pin-name', x: 0, y: 6, text: 'A+' }));
      g.appendChild(el('text', { class: 'pin-name', x: bbox.width, y: 6, text: 'K-' }));
    } else if (visual === 'capacitor-ceramic' || visual === 'capacitor-electrolytic') {
      g.appendChild(el('line', { x1: 0, y1: 0, x2: bbox.width, y2: 0, stroke: '#9a9a9a', 'stroke-width': 1 }));
      if (visual === 'capacitor-electrolytic') {
        g.appendChild(el('rect', { class: 'cap-body', x: midX - 4.5, y: -6, width: 9, height: 12, rx: 4 }));
        g.appendChild(el('text', { class: 'pin-name', x: 0, y: -8, text: '+' }));
      } else {
        g.appendChild(el('rect', { class: 'cap-body', x: midX - 5, y: -3.5, width: 10, height: 7, rx: 2 }));
      }
      g.appendChild(el('text', { class: 'part-label', x: midX, y: -12, text: (component.props && component.props.value) || part.label }));
    } else if (visual === 'potentiometer') {
      g.appendChild(el('line', { x1: 0, y1: 0, x2: bbox.width, y2: 0, stroke: '#9a9a9a', 'stroke-width': 1 }));
      g.appendChild(el('rect', { x: midX - 8, y: -8, width: 16, height: 16, fill: '#555', stroke: '#222' }));
      g.appendChild(el('circle', { cx: midX, cy: 0, r: 4, fill: '#888' }));
      g.appendChild(el('text', { class: 'part-label', x: midX, y: -12, text: (component.props && component.props.value) || part.label }));
    } else if (visual === 'button' || visual === 'toggle-switch' || visual === 'slide-switch' || visual === 'dip-switch') {
      g.appendChild(el('rect', { class: 'switch-body', x: -2, y: -8, width: bbox.width + 4, height: 16, rx: 2 }));
      g.appendChild(el('text', { class: 'part-label', x: midX, y: -12, text: part.label }));
    } else if (visual === 'lcd') {
      g.appendChild(el('rect', { class: 'lcd-body', x: -6, y: -30, width: bbox.width + 12, height: 34, rx: 2 }));
      g.appendChild(el('rect', { class: 'lcd-screen', x: 2, y: -26, width: bbox.width - 4, height: 22 }));
      g.appendChild(el('text', { class: 'part-label', x: midX, y: -34, text: component.name || part.label, fill: 'var(--text)' }));
    } else if (visual === 'power-terminal') {
      g.appendChild(el('circle', { r: 4, fill: (component.props && component.props.kind === 'GND') ? '#333' : '#c0392b' }));
      g.appendChild(el('text', { class: 'part-label', x: 0, y: -8, text: component.name || part.label }));
    } else if (visual === 'connector-ps2') {
      g.appendChild(el('line', { x1: 0, y1: 0, x2: bbox.width, y2: 0, stroke: '#9a9a9a', 'stroke-width': 1 }));
      g.appendChild(el('rect', { class: 'generic-body', x: -4, y: -10, width: bbox.width + 8, height: 20, rx: 8 }));
      g.appendChild(el('text', { class: 'part-label', x: midX, y: -14, text: component.name || part.label }));
    } else if (visual === 'transistor') {
      g.appendChild(el('path', { class: 'switch-body', d: `M ${-3} 6 A 9 9 0 1 1 ${bbox.width + 3} 6 Z` }));
      g.appendChild(el('text', { class: 'part-label', x: midX, y: 20, text: component.name || part.label }));
    } else {
      g.appendChild(el('line', { x1: 0, y1: 0, x2: bbox.width, y2: 0, stroke: '#9a9a9a', 'stroke-width': 1 }));
      g.appendChild(el('rect', { class: 'generic-body', x: -3, y: -6, width: bbox.width + 6, height: 12, rx: 2 }));
      g.appendChild(el('text', { class: 'part-label', x: midX, y: -10, text: component.name || part.label }));
    }
  }

  function renderComponents() {
    clear(componentsLayer);
    const zoom = S().data.view.zoom;
    const pinNumSetting = S().data.settings.pinNumberDisplay;
    const pinNameSetting = S().data.settings.pinNameDisplay;
    S().data.components.forEach(component => {
      if (component.hidden) return;
      const part = P().get(component.type);
      if (!part) return;
      const bbox = componentLocalBBox(component);
      const center = componentLocalCenter(component);
      const rot = component.rotation || 0;
      const g = el('g', {
        class: 'component' + (component.locked ? ' locked' : ''),
        'data-comp-id': component.id,
        transform: `translate(${component.x},${component.y}) rotate(${rot} ${center.x} ${center.y})`
      });

      if (part.layout === 'dip') drawDipVisual(g, component, part, bbox);
      else drawInlineVisual(g, component, part, bbox);

      // pins: leg + hit target + number/name
      const offsets = componentPinLocalOffsets(component);
      offsets.forEach(o => {
        const legLen = 3;
        const legDir = part.layout === 'dip' ? (o.row === 0 ? -1 : 1) : -1;
        g.appendChild(el('line', { class: 'pin-leg', x1: o.x, y1: o.y, x2: o.x, y2: o.y + legDir * legLen }));
        g.appendChild(el('circle', { class: 'pin-tip', cx: o.x, cy: o.y, r: 0.9 }));
        g.appendChild(el('circle', { class: 'pin-hit', 'data-comp-id': component.id, 'data-pin': o.index, cx: o.x, cy: o.y, r: 2.6 }));
        if (pinLabelVisible(pinNumSetting, zoom)) {
          g.appendChild(el('text', { class: 'pin-num', x: o.x, y: o.y + legDir * (legLen + 3), text: String(o.index) }));
        }
        if (pinLabelVisible(pinNameSetting, zoom) && o.name) {
          g.appendChild(el('text', { class: 'pin-name', x: o.x, y: o.y + legDir * (legLen + (pinLabelVisible(pinNumSetting, zoom) ? 8 : 3)), text: o.name }));
        }
      });

      if (component.locked) {
        g.appendChild(el('text', { class: 'lock-icon', x: bbox.width + 4, y: -4, text: '🔒', 'font-size': 6 }));
      }

      componentsLayer.appendChild(g);
    });
  }

  function renderWires() {
    clear(wiresLayer);
    const highlightSet = hoverState.highlightPinKey;
    const dimAll = !!highlightSet;
    const colorFilter = S().colorFilterActive; // optional Set of active colors, set by ui.js
    S().data.wires.forEach(wire => {
      if (wire.hidden) return;
      if (colorFilter && !colorFilter.has((wire.color || '').toLowerCase())) return;
      const pts = wirePathPoints(wire);
      if (!pts) return;
      const d = pathD(pts);
      const selected = S().isSelected('wires', wire.id);
      const width = wireStrokeWidth(wire);
      const g = el('g', { 'data-wire-id': wire.id });
      g.appendChild(el('path', { class: 'wire-hit', d, 'stroke-width': Math.max(10, width + 8) }));
      let connected = false;
      if (dimAll) {
        connected = (wireTouchesKey(wire.from, highlightSet) || wireTouchesKey(wire.to, highlightSet));
      }
      const cls = 'wire-path' + (selected ? ' selected' : '') + (dimAll && !connected ? ' dimmed' : '') + (hoverState.wireId === wire.id ? ' hovered' : '');
      g.appendChild(el('path', { class: cls, d, stroke: wire.color || '#f2c94c', 'stroke-width': width }));
      wiresLayer.appendChild(g);

      if (selected && S().selection.wires.size === 1) {
        (wire.points || []).forEach((p, i) => {
          handlesLayer.appendChild(el('circle', { class: 'wire-bend', 'data-wire-id': wire.id, 'data-bend-index': i, cx: p.x, cy: p.y, r: 3 }));
        });
        const from = resolveEndpoint(wire.from), to = resolveEndpoint(wire.to);
        if (from) handlesLayer.appendChild(el('circle', { class: 'wire-endpoint-highlight', cx: from.x, cy: from.y, r: 4 }));
        if (to) handlesLayer.appendChild(el('circle', { class: 'wire-endpoint-highlight', cx: to.x, cy: to.y, r: 4 }));
      }
    });
  }

  function wireTouchesKey(ref, key) {
    if (!ref) return false;
    if (ref.type === 'componentPin') return (ref.componentId + ':' + ref.pin) === key;
    if (ref.type === 'breadboardHole') return (ref.boardId + ':' + ref.row + ':' + ref.column) === key;
    return false;
  }

  function renderLabels() {
    clear(labelsLayer);
    S().data.labels.forEach(label => {
      if (label.hidden) return;
      const g = el('g', { 'data-label-id': label.id });
      if (label.kind === 'text') {
        g.appendChild(el('text', {
          class: 'label-text', x: label.x, y: label.y, fill: label.color || '#e6e9ef',
          'font-size': label.fontSize || 14, 'font-weight': 700, text: label.text || ''
        }));
      } else if (label.kind === 'rect') {
        g.appendChild(el('rect', {
          class: 'label-rect', x: label.x, y: label.y, width: label.width || 120, height: label.height || 80,
          stroke: label.color || '#e6e9ef'
        }));
        if (label.text) g.appendChild(el('text', { class: 'label-text', x: label.x + 6, y: label.y + 14, fill: label.color || '#e6e9ef', 'font-size': 11, text: label.text }));
      } else if (label.kind === 'arrow') {
        const id = 'arrowhead-' + label.id;
        const defs = document.getElementById('workspace-defs');
        if (!document.getElementById(id)) {
          defs.appendChild(el('marker', { id, markerWidth: 8, markerHeight: 8, refX: 6, refY: 3, orient: 'auto' }, [
            el('path', { d: 'M0,0 L6,3 L0,6 Z', fill: label.color || '#e6e9ef' })
          ]));
        }
        g.appendChild(el('line', {
          class: 'label-arrow', x1: label.x, y1: label.y, x2: label.x2, y2: label.y2,
          stroke: label.color || '#e6e9ef', 'marker-end': `url(#${id})`
        }));
      }
      labelsLayer.appendChild(g);
    });
  }

  function outlineForBBox(bbox, pad) {
    pad = pad == null ? 3 : pad;
    return el('rect', {
      class: 'selection-outline', x: bbox.minX - pad, y: bbox.minY - pad,
      width: (bbox.maxX - bbox.minX) + pad * 2, height: (bbox.maxY - bbox.minY) + pad * 2
    });
  }

  function renderSelection() {
    clear(selectionLayer);
    clear(handlesLayer);
    S().selection.boards.forEach(id => { const b = S().getBoard(id); if (b) selectionLayer.appendChild(outlineForBBox(boardWorldBBox(b), 2)); });
    S().selection.components.forEach(id => { const c = S().getComponent(id); if (c) selectionLayer.appendChild(outlineForBBox(componentWorldBBox(c))); });
    S().selection.labels.forEach(id => { const l = S().getLabel(id); if (l) selectionLayer.appendChild(outlineForBBox(labelWorldBBox(l))); });
    // wire handles re-added inside renderWires (needs per-wire geometry); trigger there.
    renderWires();
  }

  function renderMinimap() {
    const svg = document.getElementById('minimap');
    clear(svg);
    const bbox = G().boardsAndComponentsBBox(S().data.boards, S().data.components, S().data.labels);
    const w = bbox.maxX - bbox.minX || 1, h = bbox.maxY - bbox.minY || 1;
    const mmW = 200, mmH = 140;
    const scale = Math.min(mmW / w, mmH / h) * 0.9;
    const offX = (mmW - w * scale) / 2 - bbox.minX * scale;
    const offY = (mmH - h * scale) / 2 - bbox.minY * scale;
    svg.setAttribute('viewBox', `0 0 ${mmW} ${mmH}`);
    const g = el('g', {});
    S().data.boards.forEach(b => {
      if (b.hidden) return;
      g.appendChild(el('rect', {
        x: b.x * scale + offX, y: b.y * scale + offY,
        width: G().BOARD_WIDTH * scale, height: G().BOARD_HEIGHT * scale,
        fill: '#c9c0a3', opacity: 0.85
      }));
    });
    S().data.components.forEach(c => {
      if (c.hidden) return;
      g.appendChild(el('circle', { cx: c.x * scale + offX, cy: c.y * scale + offY, r: 1.4, fill: '#4da6ff' }));
    });
    svg.appendChild(g);

    const container = document.getElementById('workspace-container');
    const rect = container.getBoundingClientRect();
    const v = S().data.view;
    const viewMinX = -v.panX / v.zoom, viewMinY = -v.panY / v.zoom;
    const viewW = rect.width / v.zoom, viewH = rect.height / v.zoom;
    svg.appendChild(el('rect', {
      x: viewMinX * scale + offX, y: viewMinY * scale + offY,
      width: viewW * scale, height: viewH * scale,
      fill: 'none', stroke: '#fff', 'stroke-width': 1.2
    }));
    svg.dataset.scale = scale; svg.dataset.offx = offX; svg.dataset.offy = offY;
  }

  function renderAll() {
    updateTransform();
    renderBoards();
    renderComponents();
    renderSelection(); // also calls renderWires()
    renderLabels();
    renderMinimap();
  }

  function setHoverWire(wireId) { hoverState.wireId = wireId; renderWires(); }
  function setHighlightPin(key) { hoverState.highlightPinKey = key; renderWires(); }

  global.MC = global.MC || {};
  global.MC.Render = {
    init, renderAll, updateTransform, renderMinimap,
    componentPinLocalOffsets, componentPinWorldPositions, componentPinWorldByIndex,
    componentLocalBBox, componentLocalCenter, componentWorldBBox, boardWorldBBox, labelWorldBBox,
    resolveEndpoint, wirePathPoints, pathD, wireStrokeWidth,
    setHoverWire, setHighlightPin
  };
})(window);
