// ui.js — sidebars, properties panel, lists, context menu, tooltips, toolbar wiring.
(function (global) {
  'use strict';

  const S = () => global.MC.State;
  const G = () => global.MC.Geometry;
  const P = () => global.MC.Parts;
  const R = () => global.MC.Render;
  const IX = () => global.MC.Interactions;
  const IO = () => global.MC.IO;

  const WIRE_PALETTE = ['#e05d5d', '#1a1a1a', '#4dbb63', '#f2c94c', '#4da6ff', '#f2994a', '#f5f5f5', '#9b6dd6', '#8c8c8c', '#8a5a3a'];

  function collapsedState() { return JSON.parse(localStorage.getItem('mc_collapsed_categories') || '{}'); }
  function saveCollapsedState(s) { try { localStorage.setItem('mc_collapsed_categories', JSON.stringify(s)); } catch (e) {} }

  // ---------------- parts list (left sidebar) ----------------

  function currentViewCenterWorld() {
    const rect = document.getElementById('workspace-container').getBoundingClientRect();
    const v = S().data.view;
    return { x: (rect.width / 2 - v.panX) / v.zoom, y: (rect.height / 2 - v.panY) / v.zoom };
  }

  function clientToWorld(clientX, clientY) {
    const rect = document.getElementById('workspace').getBoundingClientRect();
    const v = S().data.view;
    return { x: (clientX - rect.left - v.panX) / v.zoom, y: (clientY - rect.top - v.panY) / v.zoom };
  }

  function addBoardAt(world) {
    const pitch = G().PITCH;
    const board = {
      id: S().nextId('bb'), name: 'BB' + (S().data.boards.length + 1),
      x: Math.round(world.x / pitch) * pitch, y: Math.round(world.y / pitch) * pitch,
      locked: false, hidden: false
    };
    S().addBoard(board);
    S().selectOnly('boards', board.id);
  }

  function addPartToCanvas(partKey, world) {
    const part = P().get(partKey);
    if (!part) return;
    if (part.kind === 'board') { addBoardAt(world); return; }
    const component = {
      id: S().nextId('c'), type: partKey, name: '', x: Math.round(world.x), y: Math.round(world.y),
      rotation: 0, boardId: null, locked: false, hidden: false, note: '',
      props: Object.assign({}, part.defaultProps || {})
    };
    if (part.editablePins) component.props.pinNames = part.pins.slice();
    S().addComponent(component);
    S().selectOnly('components', component.id);
  }

  function renderPartsList(query) {
    const list = document.getElementById('parts-list');
    list.innerHTML = '';
    const collapsed = collapsedState();
    const filtered = query ? P().search(query) : P().ALL;
    P().CATEGORIES.forEach(cat => {
      const items = filtered.filter(p => p.category === cat.key);
      if (!items.length) return;
      const catDiv = document.createElement('div');
      catDiv.className = 'parts-category' + (collapsed[cat.key] && !query ? ' collapsed' : '');
      const title = document.createElement('div');
      title.className = 'parts-category-title';
      title.innerHTML = `<span class="chev">▾</span> ${cat.label} (${items.length})`;
      title.addEventListener('click', () => {
        catDiv.classList.toggle('collapsed');
        const st = collapsedState(); st[cat.key] = catDiv.classList.contains('collapsed'); saveCollapsedState(st);
      });
      catDiv.appendChild(title);
      const itemsDiv = document.createElement('div');
      itemsDiv.className = 'parts-category-items';
      items.forEach(part => {
        const row = document.createElement('div');
        row.className = 'part-item';
        row.draggable = true;
        row.innerHTML = `<span class="part-name">${part.label}</span>`;
        row.title = '클릭하면 화면 중앙에 추가, 드래그하면 원하는 위치에 추가';
        row.addEventListener('click', () => addPartToCanvas(part.key, currentViewCenterWorld()));
        row.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/plain', part.key);
          row.classList.add('dragging');
        });
        row.addEventListener('dragend', () => row.classList.remove('dragging'));
        itemsDiv.appendChild(row);
      });
      catDiv.appendChild(itemsDiv);
      list.appendChild(catDiv);
    });
  }

  function initPartsDnD() {
    const container = document.getElementById('workspace-container');
    container.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    container.addEventListener('drop', e => {
      e.preventDefault();
      const key = e.dataTransfer.getData('text/plain');
      if (!key) return;
      addPartToCanvas(key, clientToWorld(e.clientX, e.clientY));
    });
  }

  // ---------------- properties panel ----------------

  function el(tag, attrs, html) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  function renderPropertiesPanel() {
    const panel = document.getElementById('panel-properties');
    panel.innerHTML = '';
    const sel = S().selection;
    const total = S().selectionCount();
    if (total === 0) { panel.appendChild(el('div', { class: 'prop-empty' }, '선택 없음')); return; }

    if (total > 1) { renderMultiSelectionProps(panel); return; }

    if (sel.components.size === 1) renderComponentProps(panel, Array.from(sel.components)[0]);
    else if (sel.boards.size === 1) renderBoardProps(panel, Array.from(sel.boards)[0]);
    else if (sel.wires.size === 1) renderWireProps(panel, Array.from(sel.wires)[0]);
    else if (sel.labels.size === 1) renderLabelProps(panel, Array.from(sel.labels)[0]);
  }

  function section(panel, title, contentBuilder) {
    const sec = el('div', { class: 'prop-section' });
    sec.appendChild(el('div', { class: 'prop-title' }, title));
    contentBuilder(sec);
    panel.appendChild(sec);
    return sec;
  }

  function textRow(container, label, value, onChange, type) {
    const row = el('div', { class: 'prop-row' });
    row.appendChild(el('label', {}, label));
    const input = document.createElement('input');
    input.type = type || 'text';
    input.value = value == null ? '' : value;
    input.addEventListener('change', () => onChange(input.value));
    row.appendChild(input);
    container.appendChild(row);
    return input;
  }

  function renderMultiSelectionProps(panel) {
    section(panel, `다중 선택 (${S().selectionCount()}개)`, sec => {
      const row = el('div', { class: 'prop-row full' });
      const btnRotate = el('button', { class: 'btn-small' }, '90° 회전');
      btnRotate.addEventListener('click', () => IX().rotateSelection());
      const btnDelete = el('button', { class: 'btn-small danger' }, '삭제');
      btnDelete.addEventListener('click', () => S().deleteSelection());
      row.appendChild(btnRotate); row.appendChild(btnDelete);
      sec.appendChild(row);
      const row2 = el('div', { class: 'prop-row full' });
      const btnLock = el('button', { class: 'btn-small' }, '잠금 토글');
      btnLock.addEventListener('click', () => toggleLockSelection());
      const btnHide = el('button', { class: 'btn-small' }, '숨김 토글');
      btnHide.addEventListener('click', () => toggleHideSelection());
      row2.appendChild(btnLock); row2.appendChild(btnHide);
      sec.appendChild(row2);
    });
  }

  function toggleLockSelection() {
    S().transaction('잠금 토글', d => {
      S().selection.components.forEach(id => { const c = d.components.find(x => x.id === id); if (c) c.locked = !c.locked; });
      S().selection.boards.forEach(id => { const b = d.boards.find(x => x.id === id); if (b) b.locked = !b.locked; });
      S().selection.wires.forEach(id => { const w = d.wires.find(x => x.id === id); if (w) w.locked = !w.locked; });
      S().selection.labels.forEach(id => { const l = d.labels.find(x => x.id === id); if (l) l.locked = !l.locked; });
    });
  }
  function toggleHideSelection() {
    S().transaction('숨김 토글', d => {
      S().selection.components.forEach(id => { const c = d.components.find(x => x.id === id); if (c) c.hidden = !c.hidden; });
      S().selection.boards.forEach(id => { const b = d.boards.find(x => x.id === id); if (b) b.hidden = !b.hidden; });
      S().selection.wires.forEach(id => { const w = d.wires.find(x => x.id === id); if (w) w.hidden = !w.hidden; });
      S().selection.labels.forEach(id => { const l = d.labels.find(x => x.id === id); if (l) l.hidden = !l.hidden; });
    });
    S().clearSelection();
  }

  function renderComponentProps(panel, id) {
    const c = S().getComponent(id);
    if (!c) return;
    const part = P().get(c.type);
    section(panel, '부품', sec => {
      sec.appendChild(el('div', { class: 'prop-row' }, `<label>Type</label><span>${part ? part.label : c.type}</span>`));
      textRow(sec, 'Name', c.name, v => S().updateComponent(id, { name: v }, '이름 변경')).id = 'prop-name-input';
      const posRow = el('div', { class: 'prop-row' });
      posRow.appendChild(el('label', {}, 'Position'));
      const xi = document.createElement('input'); xi.type = 'number'; xi.value = Math.round(c.x); xi.style.width = '58px';
      const yi = document.createElement('input'); yi.type = 'number'; yi.value = Math.round(c.y); yi.style.width = '58px';
      xi.addEventListener('change', () => S().updateComponent(id, { x: parseFloat(xi.value) || 0 }, '위치 변경'));
      yi.addEventListener('change', () => S().updateComponent(id, { y: parseFloat(yi.value) || 0 }, '위치 변경'));
      posRow.appendChild(xi); posRow.appendChild(yi);
      sec.appendChild(posRow);

      const rotRow = el('div', { class: 'prop-row full' });
      rotRow.appendChild(el('label', {}, 'Rotation'));
      const btns = el('div', { class: 'rotation-buttons' });
      [0, 90, 180, 270].forEach(r => {
        const b = el('button', {}, r + '°');
        if ((c.rotation || 0) === r) b.classList.add('active');
        b.addEventListener('click', () => S().updateComponent(id, { rotation: r }, '회전'));
        btns.appendChild(b);
      });
      rotRow.appendChild(btns);
      sec.appendChild(rotRow);

      sec.appendChild(el('div', { class: 'prop-row' }, `<label>Breadboard</label><span>${c.boardId ? (S().getBoard(c.boardId) || {}).name || c.boardId : '-'}</span>`));
    });

    if (part && (part.editableValue || (part.defaultProps && 'value' in part.defaultProps))) {
      section(panel, '값', sec => {
        c.props = c.props || {};
        textRow(sec, 'Value', c.props.value || '', v => S().updateComponent(id, { props: Object.assign({}, c.props, { value: v }) }, '값 변경'));
      });
    }
    if (part && part.visual === 'led') {
      section(panel, 'LED 색상', sec => {
        const row = el('div', { class: 'color-swatch-row' });
        ['Red', 'Green', 'Blue', 'Yellow', 'White', 'Orange'].forEach(color => {
          const map = { Red: '#ff4d4d', Green: '#4dff88', Blue: '#4d8dff', Yellow: '#f5e14d', White: '#f5f5f5', Orange: '#ff9d4d' };
          const sw = el('div', { class: 'sw' + ((c.props || {}).color === color ? ' selected' : '') });
          sw.style.background = map[color];
          sw.title = color;
          sw.addEventListener('click', () => S().updateComponent(id, { props: Object.assign({}, c.props, { color }) }, 'LED 색상 변경'));
          row.appendChild(sw);
        });
        sec.appendChild(row);
      });
    }
    if (part && part.editablePins) {
      section(panel, '핀 이름 편집', sec => {
        const names = (c.props && c.props.pinNames) || part.pins;
        names.forEach((name, i) => {
          const row = el('div', { class: 'prop-row' });
          row.appendChild(el('label', {}, 'Pin ' + (i + 1)));
          const input = document.createElement('input');
          input.type = 'text'; input.value = name; input.style.width = '100px';
          input.addEventListener('change', () => {
            const newNames = names.slice(); newNames[i] = input.value || String(i + 1);
            S().updateComponent(id, { props: Object.assign({}, c.props, { pinNames: newNames }) }, '핀 이름 변경');
          });
          row.appendChild(input);
          sec.appendChild(row);
        });
      });
    }

    section(panel, 'Note', sec => {
      const ta = document.createElement('textarea');
      ta.value = c.note || '';
      ta.addEventListener('change', () => S().updateComponent(id, { note: ta.value }, '메모 변경'));
      sec.appendChild(el('div', { class: 'prop-row full' }));
      sec.lastChild.appendChild(ta);
    });

    section(panel, '기타', sec => {
      const row = el('div', { class: 'prop-row full' });
      const lockBtn = el('button', { class: 'btn-small' }, c.locked ? '🔒 잠금 해제' : '🔓 잠금');
      lockBtn.addEventListener('click', () => S().updateComponent(id, { locked: !c.locked }, '잠금'));
      const hideBtn = el('button', { class: 'btn-small' }, c.hidden ? '표시' : '숨기기');
      hideBtn.addEventListener('click', () => { S().updateComponent(id, { hidden: !c.hidden }, '숨기기'); S().clearSelection(); });
      row.appendChild(lockBtn); row.appendChild(hideBtn);
      sec.appendChild(row);
      const row2 = el('div', { class: 'prop-row full' });
      const dupBtn = el('button', { class: 'btn-small' }, '복제');
      dupBtn.addEventListener('click', () => { IX().copySelection(); IX().pasteClipboard(); });
      const delBtn = el('button', { class: 'btn-small danger' }, '삭제');
      delBtn.addEventListener('click', () => S().deleteSelection());
      row2.appendChild(dupBtn); row2.appendChild(delBtn);
      sec.appendChild(row2);
    });
  }

  function renderBoardProps(panel, id) {
    const b = S().getBoard(id);
    if (!b) return;
    section(panel, '브레드보드', sec => {
      textRow(sec, 'Name', b.name, v => S().updateBoard(id, { name: v }, '이름 변경'));
      const posRow = el('div', { class: 'prop-row' });
      posRow.appendChild(el('label', {}, 'Position'));
      const xi = document.createElement('input'); xi.type = 'number'; xi.value = Math.round(b.x); xi.style.width = '58px';
      const yi = document.createElement('input'); yi.type = 'number'; yi.value = Math.round(b.y); yi.style.width = '58px';
      xi.addEventListener('change', () => S().updateBoard(id, { x: parseFloat(xi.value) || 0 }, '위치 변경'));
      yi.addEventListener('change', () => S().updateBoard(id, { y: parseFloat(yi.value) || 0 }, '위치 변경'));
      posRow.appendChild(xi); posRow.appendChild(yi);
      sec.appendChild(posRow);
    });
    section(panel, '기타', sec => {
      const row = el('div', { class: 'prop-row full' });
      const lockBtn = el('button', { class: 'btn-small' }, b.locked ? '🔒 잠금 해제' : '🔓 잠금');
      lockBtn.addEventListener('click', () => S().updateBoard(id, { locked: !b.locked }, '잠금'));
      const dupBtn = el('button', { class: 'btn-small' }, '복제');
      dupBtn.addEventListener('click', () => IX().duplicateBoard(id));
      row.appendChild(lockBtn); row.appendChild(dupBtn);
      sec.appendChild(row);
      const row2 = el('div', { class: 'prop-row full' });
      const delBtn = el('button', { class: 'btn-small danger' }, '삭제');
      delBtn.addEventListener('click', () => S().deleteSelection());
      row2.appendChild(delBtn);
      sec.appendChild(row2);
    });
  }

  function renderWireProps(panel, id) {
    const w = S().getWire(id);
    if (!w) return;
    section(panel, '점퍼선', sec => {
      const from = R().resolveEndpoint(w.from), to = R().resolveEndpoint(w.to);
      sec.appendChild(el('div', { class: 'prop-row full' }, `<div>${from ? from.label : '?'}</div><div>↕</div><div>${to ? to.label : '?'}</div>`));
    });
    section(panel, '색상', sec => {
      const row = el('div', { class: 'color-swatch-row' });
      WIRE_PALETTE.forEach(color => {
        const sw = el('div', { class: 'sw' + (w.color === color ? ' selected' : '') });
        sw.style.background = color;
        sw.addEventListener('click', () => setWireColor(id, color));
        row.appendChild(sw);
      });
      sec.appendChild(row);
      const customRow = el('div', { class: 'prop-row' });
      customRow.appendChild(el('label', {}, '사용자 지정'));
      const colorInput = document.createElement('input'); colorInput.type = 'color'; colorInput.value = /^#[0-9a-f]{6}$/i.test(w.color) ? w.color : '#f2c94c';
      colorInput.addEventListener('change', () => setWireColor(id, colorInput.value));
      customRow.appendChild(colorInput);
      sec.appendChild(customRow);
      if (S().data.recentColors.length) {
        const recentRow = el('div', { class: 'recent-colors' });
        S().data.recentColors.forEach(color => {
          const sw = el('div', { class: 'sw' });
          sw.style.background = color;
          sw.addEventListener('click', () => setWireColor(id, color));
          recentRow.appendChild(sw);
        });
        sec.appendChild(el('div', { class: 'prop-title' }, '최근 색'));
        sec.appendChild(recentRow);
      }
    });
    section(panel, '두께', sec => {
      const row = el('div', { class: 'rotation-buttons' });
      [['thin', '얇게'], ['normal', '보통'], ['thick', '굵게']].forEach(([val, label]) => {
        const b = el('button', {}, label);
        if ((w.thickness || 'normal') === val) b.classList.add('active');
        b.addEventListener('click', () => S().updateWire(id, { thickness: val }, '두께 변경'));
        row.appendChild(b);
      });
      sec.appendChild(row);
    });
    section(panel, '기타', sec => {
      const row = el('div', { class: 'prop-row full' });
      const lockBtn = el('button', { class: 'btn-small' }, w.locked ? '🔒 잠금 해제' : '🔓 잠금');
      lockBtn.addEventListener('click', () => S().updateWire(id, { locked: !w.locked }, '잠금'));
      const delBtn = el('button', { class: 'btn-small danger' }, '삭제');
      delBtn.addEventListener('click', () => S().deleteSelection());
      row.appendChild(lockBtn); row.appendChild(delBtn);
      sec.appendChild(row);
    });
  }

  function setWireColor(id, color) {
    S().transaction('점퍼선 색상 변경', d => {
      const w = d.wires.find(x => x.id === id);
      if (w) w.color = color;
      S().pushRecentColor(color);
    });
  }

  function renderLabelProps(panel, id) {
    const l = S().getLabel(id);
    if (!l) return;
    section(panel, '라벨 (' + l.kind + ')', sec => {
      if (l.kind === 'text' || l.kind === 'rect') {
        const row = el('div', { class: 'prop-row full' });
        row.appendChild(el('label', {}, 'Text'));
        const ta = document.createElement('textarea'); ta.value = l.text || '';
        ta.addEventListener('change', () => S().updateLabel(id, { text: ta.value }, '텍스트 변경'));
        row.appendChild(ta);
        sec.appendChild(row);
      }
      const colorRow = el('div', { class: 'prop-row' });
      colorRow.appendChild(el('label', {}, 'Color'));
      const ci = document.createElement('input'); ci.type = 'color'; ci.value = l.color || '#e6e9ef';
      ci.addEventListener('change', () => S().updateLabel(id, { color: ci.value }, '색상 변경'));
      colorRow.appendChild(ci);
      sec.appendChild(colorRow);
    });
    section(panel, '기타', sec => {
      const row = el('div', { class: 'prop-row full' });
      const delBtn = el('button', { class: 'btn-small danger' }, '삭제');
      delBtn.addEventListener('click', () => S().deleteSelection());
      row.appendChild(delBtn);
      sec.appendChild(row);
    });
  }

  function focusNameField() {
    setActiveTab('properties');
    setTimeout(() => { const input = document.getElementById('prop-name-input'); if (input) { input.focus(); input.select(); } }, 0);
  }

  // ---------------- entity lists (component / wire) ----------------

  function renderComponentList(filterText) {
    const list = document.getElementById('component-list');
    list.innerHTML = '';
    const q = (filterText || '').toLowerCase();
    S().data.components.forEach(c => {
      const part = P().get(c.type);
      const label = c.name || part && part.label || c.type;
      if (q && !label.toLowerCase().includes(q) && !c.type.toLowerCase().includes(q)) return;
      const row = el('div', { class: 'entity-row' + (S().isSelected('components', c.id) ? ' selected' : '') + (c.hidden ? ' hidden-row' : '') });
      row.appendChild(el('span', { class: 'name' }, label));
      row.appendChild(el('span', { class: 'type' }, part ? part.label : c.type));
      const eye = el('span', { class: 'eye' }, c.hidden ? '🚫' : '👁');
      eye.addEventListener('click', e => { e.stopPropagation(); S().updateComponent(c.id, { hidden: !c.hidden }, '숨기기'); });
      row.appendChild(eye);
      row.addEventListener('click', e => {
        if (e.shiftKey) S().toggleSelect('components', c.id);
        else { S().selectOnly('components', c.id); IX().fitToSelection(); }
      });
      list.appendChild(row);
    });
  }

  function renderWireList() {
    const list = document.getElementById('wire-list');
    list.innerHTML = '';
    S().data.wires.forEach((w, i) => {
      const row = el('div', { class: 'entity-row' + (S().isSelected('wires', w.id) ? ' selected' : '') + (w.hidden ? ' hidden-row' : '') });
      row.appendChild(el('span', { class: 'swatch' }, ''));
      row.querySelector('.swatch').style.background = w.color || '#f2c94c';
      row.appendChild(el('span', { class: 'name' }, 'Wire ' + String(i + 1).padStart(3, '0')));
      const eye = el('span', { class: 'eye' }, w.hidden ? '🚫' : '👁');
      eye.addEventListener('click', e => { e.stopPropagation(); S().updateWire(w.id, { hidden: !w.hidden }, '숨기기'); });
      row.appendChild(eye);
      row.addEventListener('click', e => { if (e.shiftKey) S().toggleSelect('wires', w.id); else S().selectOnly('wires', w.id); });
      list.appendChild(row);
    });
  }

  function renderColorFilterPanel() {
    const wrap = document.getElementById('wire-color-filter');
    wrap.innerHTML = '';
    const used = Array.from(new Set(S().data.wires.map(w => (w.color || '#f2c94c').toLowerCase())));
    if (!used.length) return;
    used.forEach(color => {
      const active = !S().colorFilterActive || S().colorFilterActive.has(color);
      const sw = el('div', { class: 'cf-swatch' + (active ? ' active-border' : ' off') });
      sw.style.background = color;
      sw.title = color;
      sw.addEventListener('click', () => {
        if (!S().colorFilterActive) S().colorFilterActive = new Set(used);
        if (S().colorFilterActive.has(color)) S().colorFilterActive.delete(color); else S().colorFilterActive.add(color);
        if (S().colorFilterActive.size === used.length) S().colorFilterActive = null;
        R().renderAll();
        renderColorFilterPanel();
      });
      wrap.appendChild(sw);
    });
  }

  // ---------------- context menu ----------------

  function showContextMenu(items, x, y) {
    const menu = document.getElementById('context-menu');
    menu.innerHTML = '';
    items.forEach(item => {
      if (item.sep) { menu.appendChild(el('div', { class: 'context-menu-sep' })); return; }
      const row = el('div', { class: 'context-menu-item' + (item.danger ? ' danger' : '') }, item.label);
      row.addEventListener('click', () => { hideContextMenu(); item.action(); });
      menu.appendChild(row);
    });
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.hidden = false;
    // Clamp into the viewport after layout so a menu opened near the right/bottom
    // edge doesn't render partly off-screen (position:fixed, so it never clips
    // against #workspace-container, but it can still overshoot the window itself).
    const menuRect = menu.getBoundingClientRect();
    const overflowX = menuRect.right - window.innerWidth;
    const overflowY = menuRect.bottom - window.innerHeight;
    if (overflowX > 0) menu.style.left = Math.max(0, x - overflowX) + 'px';
    if (overflowY > 0) menu.style.top = Math.max(0, y - overflowY) + 'px';
    setTimeout(() => window.addEventListener('pointerdown', hideContextMenuOnce, { once: true }), 0);
  }
  function hideContextMenuOnce(e) {
    const menu = document.getElementById('context-menu');
    // A pointerdown ON a menu item must NOT hide the menu here: that would set
    // display:none before the item's own 'click' handler fires (click follows
    // pointerdown/up), and browsers drop a click whose target got hidden mid-gesture
    // — silently swallowing every context-menu action. Let the item's own handler
    // (which already calls hideContextMenu()) close it instead, and re-arm so a
    // later actual outside-click still dismisses the menu.
    if (!menu.hidden && menu.contains(e.target)) {
      window.addEventListener('pointerdown', hideContextMenuOnce, { once: true });
      return;
    }
    hideContextMenu();
  }
  function hideContextMenu() { document.getElementById('context-menu').hidden = true; }

  function componentContextItems(id) {
    const c = S().getComponent(id);
    return [
      { label: '복사', action: () => { IX().copySelection(); toast('복사됨'); } },
      { label: '회전', action: () => IX().rotateSelection() },
      { label: '이름 변경', action: () => focusNameField() },
      { sep: true },
      { label: '맨 앞으로', action: () => S().reorder('component', id, 'front') },
      { label: '맨 뒤로', action: () => S().reorder('component', id, 'back') },
      { sep: true },
      { label: c && c.locked ? '잠금 해제' : '잠금', action: () => S().updateComponent(id, { locked: !(c && c.locked) }, '잠금') },
      { label: c && c.hidden ? '표시' : '숨기기', action: () => { S().updateComponent(id, { hidden: !(c && c.hidden) }, '숨기기'); S().clearSelection(); } },
      { sep: true },
      { label: '삭제', danger: true, action: () => S().deleteSelection() }
    ];
  }
  function wireContextItems(id) {
    const w = S().getWire(id);
    return [
      { label: '색 변경', action: () => setActiveTab('properties') },
      { label: '꺾임점 추가', action: () => addMidpointBend(id) },
      { sep: true },
      { label: w && w.locked ? '잠금 해제' : '잠금', action: () => S().updateWire(id, { locked: !(w && w.locked) }, '잠금') },
      { label: '삭제', danger: true, action: () => S().deleteByIds('wire', [id]) }
    ];
  }
  function bendContextItems(wireId, index) {
    return [
      { label: '이 꺾임점 삭제', danger: true, action: () => deleteBendPoint(wireId, index) }
    ];
  }
  function deleteBendPoint(wireId, index) {
    const w = S().getWire(wireId);
    if (!w) return;
    const points = (w.points || []).slice();
    points.splice(index, 1);
    S().updateWire(wireId, { points }, '꺾임점 삭제');
  }
  function boardContextItems(id) {
    const b = S().getBoard(id);
    return [
      { label: '이름 변경', action: () => focusNameField() },
      { label: '복제', action: () => IX().duplicateBoard(id) },
      { sep: true },
      { label: b && b.locked ? '잠금 해제' : '잠금', action: () => S().updateBoard(id, { locked: !(b && b.locked) }, '잠금') },
      { label: '삭제', danger: true, action: () => S().deleteSelection() }
    ];
  }
  function labelContextItems(id) {
    return [
      { label: '삭제', danger: true, action: () => S().deleteByIds('label', [id]) }
    ];
  }
  function canvasContextItems(worldPt) {
    return [
      { label: '붙여넣기', action: () => IX().pasteClipboard() },
      { label: '브레드보드 추가', action: () => addBoardAt(worldPt || currentViewCenterWorld()) },
      { sep: true },
      { label: '전체 보기', action: () => IX().fitToView() }
    ];
  }

  function addMidpointBend(wireId) {
    const w = S().getWire(wireId);
    if (!w) return;
    const from = R().resolveEndpoint(w.from), to = R().resolveEndpoint(w.to);
    if (!from || !to) return;
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const points = (w.points || []).slice();
    const insertAt = Math.floor(points.length / 2);
    points.splice(insertAt, 0, mid);
    S().updateWire(wireId, { points }, '꺾임점 추가');
  }

  // ---------------- hover tip / toast / status ----------------

  function showHoverTip(clientX, clientY, html) {
    if (!html) return hideHoverTip();
    const tip = document.getElementById('hover-tip');
    tip.innerHTML = html;
    const containerRect = document.getElementById('workspace-container').getBoundingClientRect();
    tip.style.left = (clientX - containerRect.left + 14) + 'px';
    tip.style.top = (clientY - containerRect.top + 14) + 'px';
    tip.hidden = false;
  }
  function hideHoverTip() { document.getElementById('hover-tip').hidden = true; }

  function toast(msg) {
    const c = document.getElementById('toast-container');
    const t = el('div', { class: 'toast' }, msg);
    c.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  function setStatusMode(text) { document.getElementById('status-mode').textContent = '모드: ' + text; }
  function setStatusCoords(world) { document.getElementById('status-coords').textContent = `X: ${String(Math.round(world.x)).padStart(4, '0')} Y: ${String(Math.round(world.y)).padStart(4, '0')}`; }
  function setAutosaveStatus(text) { document.getElementById('status-autosave').textContent = text; }
  function setStatusSelection() {
    const n = S().selectionCount();
    document.getElementById('status-selection').textContent = n === 0 ? '선택 없음' : n + '개 선택됨';
  }

  // ---------------- tabs ----------------

  function setActiveTab(tabKey) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabKey));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-' + tabKey).classList.add('active');
  }

  // ---------------- toolbar & settings wiring ----------------

  function bindToolbar() {
    document.getElementById('btn-new').addEventListener('click', () => IO().newProject());
    document.getElementById('btn-open').addEventListener('click', () => IO().triggerOpenDialog());
    document.getElementById('file-input').addEventListener('change', e => {
      if (e.target.files && e.target.files[0]) IO().openFile(e.target.files[0]);
      e.target.value = '';
    });
    document.getElementById('btn-save').addEventListener('click', () => IO().saveProject());
    document.getElementById('btn-save-as').addEventListener('click', () => IO().saveAsProject());
    document.getElementById('btn-undo').addEventListener('click', () => S().undo());
    document.getElementById('btn-redo').addEventListener('click', () => S().redo());
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      const r = document.getElementById('workspace-container').getBoundingClientRect();
      IX().zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.2);
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      const r = document.getElementById('workspace-container').getBoundingClientRect();
      IX().zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2);
    });
    document.getElementById('btn-zoom-100').addEventListener('click', () => IX().setZoom(1));
    document.getElementById('btn-zoom-fit').addEventListener('click', () => IX().fitToView());
    document.getElementById('btn-add-board').addEventListener('click', () => addBoardAt(currentViewCenterWorld()));
    document.getElementById('btn-add-text').addEventListener('click', () => IX().beginPlaceLabel('text'));
    document.getElementById('btn-add-rect').addEventListener('click', () => IX().beginPlaceLabel('rect'));
    document.getElementById('btn-add-arrow').addEventListener('click', () => IX().beginPlaceLabel('arrow'));
    document.getElementById('btn-export-png').addEventListener('click', showExportMenu);
    document.getElementById('btn-settings').addEventListener('click', () => setActiveTab('view'));

    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => setActiveTab(b.dataset.tab)));

    document.getElementById('part-search').addEventListener('input', e => renderPartsList(e.target.value));
    document.getElementById('component-filter').addEventListener('input', e => renderComponentList(e.target.value));
    document.getElementById('btn-wires-show-all').addEventListener('click', () => {
      S().transaction('모든 선 표시', d => d.wires.forEach(w => { w.hidden = false; }));
    });
    document.getElementById('btn-wires-hide-all').addEventListener('click', () => {
      S().transaction('모든 선 숨김', d => d.wires.forEach(w => { w.hidden = true; }));
    });

    document.getElementById('chk-show-grid').addEventListener('change', e => {
      S().data.settings.showGrid = e.target.checked; R().updateTransform();
    });
    document.getElementById('chk-snap').addEventListener('change', e => { S().data.settings.snapToGrid = e.target.checked; });

    document.querySelectorAll('input[name="pinnum"]').forEach(r => r.addEventListener('change', e => { S().data.settings.pinNumberDisplay = e.target.value; R().renderAll(); }));
    document.querySelectorAll('input[name="pinname"]').forEach(r => r.addEventListener('change', e => { S().data.settings.pinNameDisplay = e.target.value; R().renderAll(); }));
    document.querySelectorAll('input[name="routing"]').forEach(r => r.addEventListener('change', e => { S().data.settings.wireRouting = e.target.value === 'ortho' ? 'ortho' : 'direct'; R().renderAll(); }));
    document.querySelectorAll('input[name="thickness"]').forEach(r => r.addEventListener('change', e => { S().data.settings.wireThickness = e.target.value; R().renderAll(); }));
    document.getElementById('chk-move-children').addEventListener('change', e => { S().data.settings.moveChildrenWithBoard = e.target.checked; });
  }

  function showExportMenu() {
    const btn = document.getElementById('btn-export-png');
    const rect = btn.getBoundingClientRect();
    const items = [];
    ['view', 'all', 'selection'].forEach(scope => {
      const scopeLabel = scope === 'view' ? '현재 화면' : scope === 'all' ? '전체 작업 공간' : '선택 영역';
      [1, 2, 4].forEach(scale => items.push({ label: `${scopeLabel} (${scale}x)`, action: () => IO().exportPNG(scope, scale) }));
    });
    showContextMenu(items, rect.left, rect.bottom + 4);
  }

  function refreshAll() {
    renderPropertiesPanel();
    renderComponentList(document.getElementById('component-filter').value);
    renderWireList();
    renderColorFilterPanel();
    setStatusSelection();
  }

  function init() {
    renderPartsList('');
    initPartsDnD();
    bindToolbar();
    S().subscribe(() => { refreshAll(); });
    S().subscribeSelection(() => { refreshAll(); });
    refreshAll();
  }

  global.MC = global.MC || {};
  global.MC.UI = {
    init, renderPartsList, renderPropertiesPanel, renderComponentList, renderWireList,
    showContextMenu, hideContextMenu, showHoverTip, hideHoverTip, toast,
    setStatusMode, setStatusCoords, setAutosaveStatus, focusNameField, setActiveTab,
    componentContextItems, wireContextItems, bendContextItems, boardContextItems, labelContextItems, canvasContextItems
  };
})(window);
