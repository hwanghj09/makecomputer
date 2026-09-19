// io.js — save / load / autosave / PNG export.
(function (global) {
  'use strict';

  const S = () => global.MC.State;
  const G = () => global.MC.Geometry;
  const R = () => global.MC.Render;
  const UI = () => global.MC.UI;

  const AUTOSAVE_KEY = 'makecomputer_autosave_v1';
  let fileHandle = null;
  let autosaveTimer = null;

  function pad2(n) { return String(n).padStart(2, '0'); }
  function defaultFilename() {
    const d = new Date();
    return `makecomputer_${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}.json`;
  }

  function downloadBlob(filename, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function saveProject(forceNewName) {
    const json = JSON.stringify(S().exportData(), null, 2);
    const filename = S().filename || defaultFilename();
    if (window.showSaveFilePicker) {
      try {
        let handle = forceNewName ? null : fileHandle;
        if (!handle) {
          handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: 'MAKECOMPUTER Project', accept: { 'application/json': ['.json'] } }]
          });
          fileHandle = handle;
        }
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        S().filename = handle.name;
        UI().toast('저장됨: ' + handle.name);
        UI().setAutosaveStatus('저장됨 ' + new Date().toLocaleTimeString());
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        // fall through to plain download
      }
    }
    downloadBlob(filename, json);
    S().filename = filename;
    UI().toast('저장됨: ' + filename);
  }

  function saveAsProject() {
    fileHandle = null;
    let name = S().filename || defaultFilename();
    if (!window.showSaveFilePicker) {
      const input = window.prompt('파일 이름', name);
      if (input === null) return;
      S().filename = input.endsWith('.json') ? input : input + '.json';
    }
    return saveProject(true);
  }

  function triggerOpenDialog() { document.getElementById('file-input').click(); }

  function validateProjectData(data) {
    return data && Array.isArray(data.boards) && Array.isArray(data.components) && Array.isArray(data.wires);
  }

  function openFile(file) {
    file.text().then(text => {
      let parsed;
      try { parsed = JSON.parse(text); } catch (e) { UI().toast('JSON 파싱 실패: 올바른 프로젝트 파일이 아닙니다.'); return; }
      if (!validateProjectData(parsed)) { UI().toast('올바른 프로젝트 파일이 아닙니다.'); return; }
      S().loadData(parsed, file.name);
      global.MC.Interactions.fitToView();
      UI().toast('불러옴: ' + file.name);
    }).catch(() => UI().toast('파일을 읽을 수 없습니다.'));
  }

  function newProject() {
    if (S().data.boards.length || S().data.components.length) {
      if (!window.confirm('새 프로젝트를 시작하면 현재 작업 내용이 사라질 수 있습니다 (자동 저장은 유지됩니다). 계속할까요?')) return;
    }
    S().newProject();
    fileHandle = null;
    global.MC.Interactions.fitToView();
  }

  // ---------------- autosave ----------------

  let autosaveDebounce = null;
  function writeAutosave() {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ data: S().exportData(), time: Date.now(), filename: S().filename }));
      UI().setAutosaveStatus('자동 저장됨 ' + new Date().toLocaleTimeString());
    } catch (e) { /* storage unavailable/full: ignore */ }
  }
  function scheduleAutosave() {
    clearTimeout(autosaveDebounce);
    autosaveDebounce = setTimeout(writeAutosave, 1500);
  }
  function checkAutosaveOnStartup() {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const hasContent = parsed.data && ((parsed.data.boards || []).length || (parsed.data.components || []).length);
      if (!hasContent) return;
      const when = new Date(parsed.time).toLocaleString();
      if (window.confirm('이전 자동 저장 데이터가 있습니다 (' + when + ').\n복구하시겠습니까?')) {
        S().loadData(parsed.data, parsed.filename);
        global.MC.Interactions.fitToView();
        UI().toast('자동 저장 데이터를 복구했습니다.');
      }
    } catch (e) { /* ignore corrupt autosave */ }
  }
  function initAutosave() {
    checkAutosaveOnStartup();
    S().subscribe(scheduleAutosave);
    autosaveTimer = setInterval(writeAutosave, 30000);
    window.addEventListener('beforeunload', writeAutosave);
  }

  // ---------------- PNG export ----------------

  const EXPORT_STYLE = `
    .board-body { fill:#f4efe1; stroke:#c9c0a3; stroke-width:1.5; }
    .board-label { fill:#6b6350; font-size:11px; font-weight:700; font-family:sans-serif; }
    .center-gap { fill:#d8d0b6; }
    .hole { fill:#55606e; } .hole.rail-plus { fill:#b23b3b; } .hole.rail-minus { fill:#2f4f9e; }
    .row-tag { fill:#8a8264; font-size:7px; font-family:sans-serif; }
    .chip-body { fill:#23262b; stroke:#000; stroke-width:0.6; }
    .chip-notch, .chip-pin1-dot { fill:#14161a; }
    .chip-label { fill:#e6e9ef; font-size:6.5px; text-anchor:middle; font-family:sans-serif; }
    .chip-name-label { fill:#e6e9ef; font-size:5.6px; text-anchor:middle; font-family:sans-serif; }
    .pin-leg { stroke:#c7c9a8; stroke-width:1.2; } .pin-tip { fill:#b8bd9a; }
    .pin-num { fill:#cfd3e6; font-size:4.6px; text-anchor:middle; font-family:sans-serif; }
    .pin-name { fill:#4a5a8a; font-size:4.2px; text-anchor:middle; font-family:sans-serif; }
    .resistor-body { fill:#d8c9a0; stroke:#6b5c3a; stroke-width:0.6; }
    .cap-body { fill:#8ea9c9; stroke:#3a5f8a; stroke-width:0.6; }
    .switch-body { fill:#444; stroke:#222; stroke-width:0.6; }
    .generic-body { fill:#3a3f47; stroke:#14161a; stroke-width:0.6; }
    .lcd-body { fill:#274d2e; stroke:#14261a; stroke-width:1; }
    .lcd-screen { fill:#7fae86; stroke:#14261a; stroke-width:0.6; }
    .part-label { fill:#222; font-size:6.5px; text-anchor:middle; font-family:sans-serif; }
    .wire-path { fill:none; stroke-linecap:round; stroke-linejoin:round; }
    .label-text { font-family:sans-serif; } .label-rect { fill:rgba(0,0,0,0.03); stroke:#333; stroke-width:1; }
    .label-arrow { stroke:#333; stroke-width:2; fill:none; }
  `;

  function computeExportRect(scope) {
    if (scope === 'view') {
      const rect = document.getElementById('workspace-container').getBoundingClientRect();
      const v = S().data.view;
      return { minX: -v.panX / v.zoom, minY: -v.panY / v.zoom, width: rect.width / v.zoom, height: rect.height / v.zoom };
    }
    if (scope === 'selection') {
      const items = [];
      S().selection.components.forEach(id => { const c = S().getComponent(id); if (c) items.push(R().componentWorldBBox(c)); });
      S().selection.boards.forEach(id => { const b = S().getBoard(id); if (b) items.push(R().boardWorldBBox(b)); });
      if (!items.length) return computeExportRect('all');
      const minX = Math.min(...items.map(i => i.minX)) - 20, minY = Math.min(...items.map(i => i.minY)) - 20;
      const maxX = Math.max(...items.map(i => i.maxX)) + 20, maxY = Math.max(...items.map(i => i.maxY)) + 20;
      return { minX, minY, width: maxX - minX, height: maxY - minY };
    }
    const bbox = G().boardsAndComponentsBBox(S().data.boards, S().data.components, S().data.labels);
    return { minX: bbox.minX - 30, minY: bbox.minY - 30, width: (bbox.maxX - bbox.minX) + 60, height: (bbox.maxY - bbox.minY) + 60 };
  }

  function buildExportSvg(rect, scale) {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('xmlns', SVG_NS);
    svg.setAttribute('viewBox', `${rect.minX} ${rect.minY} ${rect.width} ${rect.height}`);
    svg.setAttribute('width', Math.round(rect.width * scale));
    svg.setAttribute('height', Math.round(rect.height * scale));
    const style = document.createElementNS(SVG_NS, 'style');
    style.textContent = EXPORT_STYLE;
    svg.appendChild(style);
    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('x', rect.minX); bg.setAttribute('y', rect.minY);
    bg.setAttribute('width', rect.width); bg.setAttribute('height', rect.height);
    bg.setAttribute('fill', '#eef1f5');
    svg.appendChild(bg);
    ['boards-layer', 'components-layer', 'wires-layer', 'labels-layer'].forEach(id => {
      const src = document.getElementById(id);
      const clone = src.cloneNode(true);
      // strip interactive-only helper nodes (pin hit targets) — keep visuals only
      clone.querySelectorAll('.pin-hit, .wire-hit').forEach(n => n.setAttribute('fill', 'none'));
      svg.appendChild(clone);
    });
    return svg;
  }

  function exportPNG(scope, scale) {
    const rect = computeExportRect(scope || 'all');
    const svg = buildExportSvg(rect, scale || 1);
    const xml = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(rect.width * scale);
      canvas.height = Math.round(rect.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#eef1f5';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => {
        const a = document.createElement('a');
        const dlUrl = URL.createObjectURL(blob);
        a.href = dlUrl;
        a.download = (S().data.projectName || 'makecomputer') + '_' + scope + '.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(dlUrl), 1000);
        UI().toast('PNG 내보내기 완료');
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); UI().toast('PNG 내보내기 실패'); };
    img.src = url;
  }

  global.MC = global.MC || {};
  global.MC.IO = {
    saveProject, saveAsProject, triggerOpenDialog, openFile, newProject,
    initAutosave, writeAutosave, exportPNG, defaultFilename
  };
})(window);
