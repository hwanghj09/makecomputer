// state.js — central data model, selection, undo/redo history, pub/sub.
(function (global) {
  'use strict';

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function defaultData() {
    return {
      projectName: 'MAKECOMPUTER',
      view: { zoom: 1, panX: 0, panY: 0 },
      settings: {
        snapToGrid: true,
        pinNumberDisplay: 'zoom',   // 'always' | 'zoom' | 'hidden'
        pinNameDisplay: 'zoom',
        wireRouting: 'direct',     // 'direct' | 'ortho'
        wireThickness: 'normal',   // 'thin' | 'normal' | 'thick'
        showGrid: true,
        moveChildrenWithBoard: true
      },
      boards: [],
      components: [],
      wires: [],
      labels: [],
      recentColors: [],
      snapshots: []
    };
  }

  const State = {
    data: defaultData(),
    filename: null,
    selection: { boards: new Set(), components: new Set(), wires: new Set(), labels: new Set() },
    undoStack: [],
    redoStack: [],
    listeners: [],
    selectionListeners: [],
    counters: { bb: 1, c: 1, w: 1, l: 1 },
    dirty: false,
    colorFilterActive: null, // transient UI state: Set of lowercase hex colors, or null = show all

    // ---------------- pub/sub ----------------
    subscribe(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter(f => f !== fn); }; },
    notify() { this.dirty = true; this.listeners.forEach(fn => fn(this.data)); },
    subscribeSelection(fn) { this.selectionListeners.push(fn); return () => { this.selectionListeners = this.selectionListeners.filter(f => f !== fn); }; },
    notifySelection() { this.selectionListeners.forEach(fn => fn(this.selection)); },

    // ---------------- id management ----------------
    recomputeCounters() {
      const scan = (arr, prefix) => {
        let max = 0;
        (arr || []).forEach(item => {
          const m = /^([a-zA-Z]+)(\d+)$/.exec(item.id || '');
          if (m && m[1] === prefix) max = Math.max(max, parseInt(m[2], 10));
        });
        return max + 1;
      };
      this.counters.bb = scan(this.data.boards, 'bb');
      this.counters.c = scan(this.data.components, 'c');
      this.counters.w = scan(this.data.wires, 'w');
      this.counters.l = scan(this.data.labels, 'l');
    },
    nextId(prefix) { const n = this.counters[prefix]++; return prefix + n; },

    // ---------------- project lifecycle ----------------
    loadData(data, filename) {
      this.data = Object.assign(defaultData(), clone(data));
      this.filename = filename || null;
      this.recomputeCounters();
      this.clearSelection();
      this.undoStack = [];
      this.redoStack = [];
      this.notify();
    },
    newProject() {
      this.loadData(defaultData(), null);
    },
    exportData() {
      // Strip transient/derived-only fields nothing needs on reload (none currently).
      return clone(this.data);
    },

    // ---------------- undo/redo ----------------
    transaction(label, mutateFn) {
      const before = clone(this.data);
      mutateFn(this.data);
      this.recomputeBoardMembership();
      this.undoStack.push({ before, after: null, label });
      if (this.undoStack.length > 200) this.undoStack.shift();
      this.redoStack = [];
      this.notify();
    },
    recomputeBoardMembership() {
      const geo = global.MC.Geometry;
      this.data.components.forEach(c => { c.boardId = geo.boardContaining(this.data.boards, c.x, c.y); });
    },
    canUndo() { return this.undoStack.length > 0; },
    canRedo() { return this.redoStack.length > 0; },
    undo() {
      if (!this.canUndo()) return;
      const entry = this.undoStack.pop();
      entry.after = clone(this.data);
      this.data = entry.before;
      this.redoStack.push(entry);
      this.pruneSelectionToExisting();
      this.notify();
    },
    redo() {
      if (!this.canRedo()) return;
      const entry = this.redoStack.pop();
      this.data = clone(entry.after);
      this.undoStack.push(entry);
      this.pruneSelectionToExisting();
      this.notify();
    },
    pruneSelectionToExisting() {
      const has = (set, arr) => { for (const id of Array.from(set)) if (!arr.find(x => x.id === id)) set.delete(id); };
      has(this.selection.boards, this.data.boards);
      has(this.selection.components, this.data.components);
      has(this.selection.wires, this.data.wires);
      has(this.selection.labels, this.data.labels);
      this.notifySelection();
    },

    // ---------------- selection ----------------
    clearSelection() {
      this.selection.boards.clear();
      this.selection.components.clear();
      this.selection.wires.clear();
      this.selection.labels.clear();
      this.notifySelection();
    },
    hasSelection() {
      return this.selection.boards.size || this.selection.components.size || this.selection.wires.size || this.selection.labels.size;
    },
    selectOnly(kind, id) {
      // No-op if this exact single item is already the whole selection: avoids a
      // pointless re-render on every repeat click (e.g. clicking an already-selected
      // wire), which matters beyond performance — replacing the DOM node under the
      // cursor between the two clicks of a double-click breaks the browser's native
      // dblclick detection, silently killing double-click-to-add-a-bend-point.
      if (kind && id && this.selectionCount() === 1 && this.selection[kind].has(id)) return;
      this.clearSelection();
      if (kind && id) this.selection[kind].add(id);
      this.notifySelection();
    },
    toggleSelect(kind, id) {
      const set = this.selection[kind];
      if (set.has(id)) set.delete(id); else set.add(id);
      this.notifySelection();
    },
    addSelect(kind, id) {
      this.selection[kind].add(id);
      this.notifySelection();
    },
    isSelected(kind, id) { return this.selection[kind].has(id); },
    selectionCount() {
      return this.selection.boards.size + this.selection.components.size + this.selection.wires.size + this.selection.labels.size;
    },

    // ---------------- lookups ----------------
    getBoard(id) { return this.data.boards.find(b => b.id === id) || null; },
    getComponent(id) { return this.data.components.find(c => c.id === id) || null; },
    getWire(id) { return this.data.wires.find(w => w.id === id) || null; },
    getLabel(id) { return this.data.labels.find(l => l.id === id) || null; },

    // ---------------- CRUD (all undo-able) ----------------
    addBoard(board) {
      this.transaction('브레드보드 추가', d => { d.boards.push(board); });
    },
    addComponent(component) {
      this.transaction('부품 추가', d => { d.components.push(component); });
    },
    addComponents(components) {
      this.transaction('부품 추가', d => { components.forEach(c => d.components.push(c)); });
    },
    addWire(wire) {
      this.transaction('점퍼선 추가', d => { d.wires.push(wire); });
    },
    addLabel(label) {
      this.transaction('라벨 추가', d => { d.labels.push(label); });
    },
    updateComponent(id, patch, label) {
      this.transaction(label || '부품 편집', d => {
        const c = d.components.find(x => x.id === id);
        if (c) Object.assign(c, patch);
      });
    },
    updateBoard(id, patch, label) {
      this.transaction(label || '브레드보드 편집', d => {
        const b = d.boards.find(x => x.id === id);
        if (b) Object.assign(b, patch);
      });
    },
    updateWire(id, patch, label) {
      this.transaction(label || '점퍼선 편집', d => {
        const w = d.wires.find(x => x.id === id);
        if (w) Object.assign(w, patch);
      });
    },
    updateLabel(id, patch, label) {
      this.transaction(label || '라벨 편집', d => {
        const l = d.labels.find(x => x.id === id);
        if (l) Object.assign(l, patch);
      });
    },
    moveEntities(moves, label) {
      // moves: [{kind:'components'|'boards'|'labels', id, dx, dy}]
      this.transaction(label || '이동', d => {
        moves.forEach(m => {
          const arr = m.kind === 'boards' ? d.boards : m.kind === 'labels' ? d.labels : d.components;
          const item = arr.find(x => x.id === m.id);
          if (!item) return;
          item.x += m.dx; item.y += m.dy;
          if (item.x2 !== undefined) item.x2 += m.dx;
          if (item.y2 !== undefined) item.y2 += m.dy;
        });
      });
    },
    deleteSelection() {
      const sel = this.selection;
      if (!this.hasSelection()) return;
      const goneComponents = new Set(Array.from(sel.components).filter(id => { const c = this.getComponent(id); return c && !c.locked; }));
      const goneBoards = new Set(Array.from(sel.boards).filter(id => { const b = this.getBoard(id); return b && !b.locked; }));
      const goneWires = new Set(Array.from(sel.wires).filter(id => { const w = this.getWire(id); return w && !w.locked; }));
      const goneLabels = new Set(Array.from(sel.labels).filter(id => { const l = this.getLabel(id); return l && !l.locked; }));
      this.transaction('삭제', d => {
        d.boards = d.boards.filter(b => !goneBoards.has(b.id));
        d.components = d.components.filter(c => !goneComponents.has(c.id));
        d.labels = d.labels.filter(l => !goneLabels.has(l.id));
        d.wires = d.wires.filter(w => {
          if (goneWires.has(w.id)) return false;
          const refGone = ref => ref.type === 'componentPin' && goneComponents.has(ref.componentId);
          return !(refGone(w.from) || refGone(w.to));
        });
      });
      this.clearSelection();
    },
    isLocked(kind, id) {
      const key = kind === 'board' ? 'getBoard' : kind === 'wire' ? 'getWire' : kind === 'label' ? 'getLabel' : 'getComponent';
      const item = this[key](id);
      return !!(item && item.locked);
    },
    deleteByIds(kind, ids) {
      this.transaction('삭제', d => {
        const key = kind === 'board' ? 'boards' : kind === 'wire' ? 'wires' : kind === 'label' ? 'labels' : 'components';
        d[key] = d[key].filter(x => !ids.includes(x.id));
      });
    },
    removeWiresReferencing(componentId) {
      this.data.wires = this.data.wires.filter(w => {
        const hit = ref => ref.type === 'componentPin' && ref.componentId === componentId;
        return !(hit(w.from) || hit(w.to));
      });
    },
    reorder(kind, id, dir) {
      // dir: 'front' | 'back'
      const key = kind + 's';
      this.transaction('순서 변경', d => {
        const arr = d[key];
        const idx = arr.findIndex(x => x.id === id);
        if (idx < 0) return;
        const [item] = arr.splice(idx, 1);
        if (dir === 'front') arr.push(item); else arr.unshift(item);
      });
    },

    // ---------------- recent colors ----------------
    pushRecentColor(color) {
      const list = this.data.recentColors.filter(c => c !== color);
      list.unshift(color);
      this.data.recentColors = list.slice(0, 8);
    },

    // ---------------- snapshots ----------------
    createSnapshot(name) {
      const snap = {
        id: 'snap' + Date.now(),
        name: name || ('Snapshot ' + (this.data.snapshots.length + 1)),
        time: new Date().toISOString(),
        boards: clone(this.data.boards),
        components: clone(this.data.components),
        wires: clone(this.data.wires),
        labels: clone(this.data.labels)
      };
      this.transaction('스냅샷 생성', d => { d.snapshots.push(snap); });
    },
    restoreSnapshot(id) {
      const snap = this.data.snapshots.find(s => s.id === id);
      if (!snap) return;
      this.transaction('스냅샷 복원', d => {
        d.boards = clone(snap.boards);
        d.components = clone(snap.components);
        d.wires = clone(snap.wires);
        d.labels = clone(snap.labels);
      });
      this.clearSelection();
    },
    deleteSnapshot(id) {
      this.transaction('스냅샷 삭제', d => { d.snapshots = d.snapshots.filter(s => s.id !== id); });
    }
  };

  global.MC = global.MC || {};
  global.MC.State = State;
})(window);
