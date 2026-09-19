// parts-data.js — part catalog: pin names (verified against datasheets), visuals, categories.
(function (global) {
  'use strict';

  const CATEGORIES = [
    { key: 'board', label: '브레드보드' },
    { key: 'ic', label: 'IC' },
    { key: 'memory', label: 'Memory' },
    { key: 'display', label: 'Display' },
    { key: 'input', label: 'Input' },
    { key: 'power', label: 'Power' },
    { key: 'passive', label: 'Passive' },
    { key: 'connector', label: 'Connector' },
    { key: 'other', label: 'Other' }
  ];

  function dip(key, category, label, pins, aliases, pinRowGap) {
    return { key, category, label, aliases: aliases || [], layout: 'dip', pins, pinRowGap: pinRowGap || 1, visual: 'chip' };
  }
  function inline(key, category, label, pins, visual, aliases, pinSpacing) {
    return { key, category, label, aliases: aliases || [], layout: 'inline', pins, pinSpacing: pinSpacing == null ? 1 : pinSpacing, visual };
  }

  const ALL = [];

  // ---------------- Breadboard (placed as a board, not a component) ----------------
  ALL.push({ key: 'BREADBOARD_FULL', category: 'board', label: '긴 브레드보드', aliases: ['breadboard', '브레드보드', 'bb'], kind: 'board' });

  // ---------------- IC: verified pin-by-pin against manufacturer datasheets ----------------
  ALL.push(dip('IC_NE555', 'ic', 'NE555', ['GND', 'TRIG', 'OUT', 'RESET', 'CONT', 'THRES', 'DISCH', 'VCC'], ['555', 'timer', '타이머', 'clock', '클럭']));
  ALL.push(dip('IC_74HC161', 'ic', '74HC161', ['/CLR', 'CLK', 'A', 'B', 'C', 'D', 'ENP', 'GND', '/LOAD', 'ENT', 'QD', 'QC', 'QB', 'QA', 'RCO', 'VCC'], ['161', 'counter', '카운터']));
  ALL.push(dip('IC_74HC273', 'ic', '74HC273', ['/MR', 'Q0', 'D0', 'D1', 'Q1', 'Q2', 'D2', 'D3', 'Q3', 'GND', 'CP', 'Q4', 'D4', 'D5', 'Q5', 'Q6', 'D6', 'D7', 'Q7', 'VCC'], ['273', 'register', '레지스터']));
  ALL.push(dip('IC_74HC245', 'ic', '74HC245', ['DIR', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'GND', 'B8', 'B7', 'B6', 'B5', 'B4', 'B3', 'B2', 'B1', '/OE', 'VCC'], ['245', 'transceiver', '버스', 'bus']));
  ALL.push(dip('IC_74HC157', 'ic', '74HC157', ['SEL', '1A', '1B', '1Y', '2A', '2B', '2Y', 'GND', '3Y', '3B', '3A', '4Y', '4B', '4A', '/OE', 'VCC'], ['157', 'mux', '멀티플렉서']));
  ALL.push(dip('IC_74HC283', 'ic', '74HC283', ['S2', 'B2', 'A2', 'S1', 'A1', 'B1', 'C0', 'GND', 'C4', 'S4', 'B4', 'A4', 'S3', 'A3', 'B3', 'VCC'], ['283', 'adder', '가산기', 'alu']));
  ALL.push(dip('IC_74HC86', 'ic', '74HC86', ['1A', '1B', '1Y', '2A', '2B', '2Y', 'GND', '3Y', '3B', '3A', '4Y', '4B', '4A', 'VCC'], ['86', 'xor']));
  ALL.push(dip('IC_74HC138', 'ic', '74HC138', ['A', 'B', 'C', '/E1', '/E2', 'E3', '/Y7', 'GND', '/Y6', '/Y5', '/Y4', '/Y3', '/Y2', '/Y1', '/Y0', 'VCC'], ['138', 'decoder', '디코더']));
  ALL.push(dip('IC_74HC139', 'ic', '74HC139', ['/1G', '1A', '1B', '/1Y0', '/1Y1', '/1Y2', '/1Y3', 'GND', '/2Y3', '/2Y2', '/2Y1', '/2Y0', '2B', '2A', '/2G', 'VCC'], ['139', 'decoder', '디코더']));
  ALL.push(dip('IC_74HC08', 'ic', '74HC08', ['1A', '1B', '1Y', '2A', '2B', '2Y', 'GND', '3Y', '3A', '3B', '4Y', '4A', '4B', 'VCC'], ['08', 'and']));
  ALL.push(dip('IC_74HC32', 'ic', '74HC32', ['1A', '1B', '1Y', '2A', '2B', '2Y', 'GND', '3Y', '3A', '3B', '4Y', '4A', '4B', 'VCC'], ['32', 'or']));
  ALL.push(dip('IC_74HC04', 'ic', '74HC04', ['1A', '1Y', '2A', '2Y', '3A', '3Y', 'GND', '4Y', '4A', '5Y', '5A', '6Y', '6A', 'VCC'], ['04', 'inverter', 'not', '인버터']));
  ALL.push(dip('IC_74HC74', 'ic', '74HC74', ['/1CLR', '1D', '1CLK', '/1PRE', '1Q', '1Qn', 'GND', '2Qn', '2Q', '/2PRE', '2CLK', '2D', '/2CLR', 'VCC'], ['74', 'flipflop', '플립플롭']));
  ALL.push(dip('IC_74HC14', 'ic', '74HC14', ['1A', '1Y', '2A', '2Y', '3A', '3Y', 'GND', '4Y', '4A', '5Y', '5A', '6Y', '6A', 'VCC'], ['14', 'schmitt', 'ps2']));
  ALL.push(dip('IC_74HC164', 'ic', '74HC164', ['DSA', 'DSB', 'Q0', 'Q1', 'Q2', 'Q3', 'GND', 'CP', 'MR', 'Q4', 'Q5', 'Q6', 'Q7', 'VCC'], ['164', 'shift', '시프트', 'ps2']));

  // ---------------- Memory ----------------
  ALL.push(dip('IC_CDP1824CE', 'memory', 'CDP1824CE', ['MA4', 'MA3', 'MA2', 'MA1', 'MA0', 'BUS7', 'BUS6', 'BUS5', 'VSS', 'BUS4', 'BUS3', 'BUS2', 'BUS1', 'BUS0', 'CS', 'MRD/', 'MWR/', 'VDD'], ['1824', 'ram', '램']));
  ALL.push(dip('IC_AT28C64B', 'memory', 'AT28C64B', ['NC', 'A12', 'A7', 'A6', 'A5', 'A4', 'A3', 'A2', 'A1', 'A0', 'IO0', 'IO1', 'IO2', 'GND', 'IO3', 'IO4', 'IO5', 'IO6', 'IO7', '/CE', 'A10', '/OE', 'A11', 'A9', 'A8', 'NC', '/WE', 'VCC'], ['28c64', 'eeprom', 'rom'], 9));

  // ---------------- Display ----------------
  ALL.push(inline('LCD_HD44780', 'display', 'HD44780 20x4 LCD', ['VSS', 'VDD', 'VO', 'RS', 'RW', 'E', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'LED+', 'LED-'], 'lcd', ['lcd', '엘시디', 'display', '디스플레이'], 1));

  // ---------------- Input: buttons / switches / potentiometer ----------------
  ALL.push(inline('BTN_PUSH', 'input', 'Push Button', ['1', '2', '3', '4'], 'button', ['button', '버튼', '푸시']));
  ALL.push(inline('BTN_RESET', 'input', 'Reset Button', ['1', '2', '3', '4'], 'button', ['reset', '리셋']));
  ALL.push(inline('SW_SLIDE', 'input', 'Slide Switch', ['1', '2', '3'], 'slide-switch', ['slide', '슬라이드']));
  ALL.push(inline('SW_TOGGLE', 'input', 'Toggle Switch', ['1', '2', '3'], 'toggle-switch', ['toggle', '토글']));
  ALL.push(inline('SW_DIP', 'input', 'DIP Switch', ['1', '2', '3', '4', '5', '6', '7', '8'], 'dip-switch', ['dip switch', '딥스위치']));
  ALL.push(inline('POT_10K', 'input', '가변저항 10kΩ', ['1', '2', '3'], 'potentiometer', ['potentiometer', '가변저항', 'pot'], 1));
  ALL.push(inline('POT_CUSTOM', 'input', '가변저항 (사용자 지정)', ['1', '2', '3'], 'potentiometer', ['potentiometer custom', '가변저항 사용자'], 1));

  // ---------------- Power ----------------
  ALL.push(inline('PWR_5V', 'power', '+5V Terminal', ['+5V'], 'power-terminal', ['5v', '전원']));
  ALL.push(inline('PWR_GND', 'power', 'GND Terminal', ['GND'], 'power-terminal', ['gnd', '그라운드', '접지']));
  ALL.push(inline('PWR_DCJACK', 'power', 'DC Jack', ['+', '-'], 'power-terminal', ['dc jack', '잭'], 2));
  ALL.push(inline('PWR_CONN', 'power', 'Power Connector', ['+', '-'], 'power-terminal', ['power connector', '전원 커넥터'], 2));

  // ---------------- Passive: resistor / capacitor / LED ----------------
  const RESISTOR_PRESETS = ['220', '330', '1k', '2.2k', '4.7k', '10k', '22k'];
  RESISTOR_PRESETS.forEach(v => {
    ALL.push(Object.assign(inline('RES_' + v, 'passive', v + 'Ω 저항', ['1', '2'], 'resistor', ['resistor', '저항', v], 4), { defaultProps: { value: v + 'Ω' } }));
  });
  ALL.push(Object.assign(inline('RES_CUSTOM', 'passive', '사용자 지정 저항', ['1', '2'], 'resistor', ['resistor custom', '저항 사용자 지정'], 4), { defaultProps: { value: '1kΩ' }, editableValue: true }));

  const CAP_PRESETS = [
    { key: 'CAP_10NF', label: '10nF 세라믹', value: '10nF', visual: 'capacitor-ceramic' },
    { key: 'CAP_0P1UF', label: '0.1µF 세라믹', value: '0.1µF', visual: 'capacitor-ceramic' },
    { key: 'CAP_47UF', label: '47µF 전해', value: '47µF', visual: 'capacitor-electrolytic' },
    { key: 'CAP_470UF', label: '470µF 전해', value: '470µF', visual: 'capacitor-electrolytic' }
  ];
  CAP_PRESETS.forEach(c => {
    ALL.push(Object.assign(inline(c.key, 'passive', c.label, ['1', '2'], c.visual, ['capacitor', '커패시터', c.value], 2), { defaultProps: { value: c.value } }));
  });
  ALL.push(Object.assign(inline('CAP_CUSTOM', 'passive', '사용자 지정 커패시터', ['1', '2'], 'capacitor-electrolytic', ['capacitor custom', '커패시터 사용자 지정'], 2), { defaultProps: { value: '100µF' }, editableValue: true }));

  const LED_COLORS = ['Red', 'Green', 'Blue', 'Yellow', 'White', 'Orange'];
  LED_COLORS.forEach(c => {
    ALL.push(Object.assign(inline('LED_' + c.toUpperCase(), 'passive', c + ' LED', ['A+', 'K-'], 'led', ['led', c], 2), { defaultProps: { color: c } }));
  });

  // ---------------- Connector ----------------
  ALL.push(inline('CONN_MINIDIN6', 'connector', 'Mini-DIN 6핀', ['1', '2', '3', '4', '5', '6'], 'connector-ps2', ['minidin', '미니딘'], 1));
  ALL.push(inline('CONN_PS2', 'connector', 'PS/2 Connector', ['DATA', 'N/C', 'GND', 'VCC', 'CLOCK', 'N/C'], 'connector-ps2', ['ps2', 'ps/2', '키보드', 'keyboard'], 1));
  ALL.push(inline('CONN_NPN', 'other', 'NPN Transistor', ['E', 'B', 'C'], 'transistor', ['transistor', '트랜지스터', 'npn'], 1));

  // ---------------- Generic / Other ----------------
  [8, 14, 16, 18, 20, 28].forEach(n => {
    const pins = Array.from({ length: n }, (_, i) => String(i + 1));
    ALL.push(Object.assign(dip('GENERIC_DIP' + n, 'other', 'Generic DIP' + n, pins, ['generic', 'dip' + n]), { editableName: true, editablePins: true }));
  });
  [2, 3, 4].forEach(n => {
    const pins = Array.from({ length: n }, (_, i) => String(i + 1));
    ALL.push(Object.assign(inline('GENERIC_' + n + 'PIN', 'other', 'Generic ' + n + '-pin', pins, 'generic-block', ['generic', n + 'pin']), { editableName: true, editablePins: true }));
  });

  const BY_KEY = {};
  ALL.forEach(p => { BY_KEY[p.key] = p; });

  function get(key) { return BY_KEY[key] || null; }

  function normalizeQuery(q) { return (q || '').trim().toLowerCase(); }

  function search(query) {
    const q = normalizeQuery(query);
    if (!q) return ALL;
    return ALL.filter(p => {
      if (p.label.toLowerCase().includes(q)) return true;
      return (p.aliases || []).some(a => a.toLowerCase().includes(q));
    });
  }

  function byCategory(catKey) { return ALL.filter(p => p.category === catKey); }

  // ---------------- Resistor color bands (standard EIA 4-band code, decorative) ----------------
  const DIGIT_COLORS = ['#0a0a0a', '#7a4a24', '#d43a2f', '#e07a1f', '#e3d21f', '#3a9e4a', '#2f6fbf', '#8a3fae', '#8c8c8c', '#f2f2f2'];
  function parseResistance(str) {
    if (!str) return null;
    const s = String(str).replace(/[Ωω\s]/g, '').toLowerCase();
    const m = /^([\d.]+)(k|m)?$/.exec(s);
    if (!m) return null;
    let val = parseFloat(m[1]);
    if (m[2] === 'k') val *= 1e3;
    if (m[2] === 'm') val *= 1e6;
    return isNaN(val) ? null : val;
  }
  function resistorColorBands(str) {
    const val = parseResistance(str);
    if (val == null || val <= 0) return ['#8c8c8c', '#8c8c8c', '#8c8c8c'];
    let exp = Math.floor(Math.log10(val)) - 1;
    let mantissa = Math.round(val / Math.pow(10, exp));
    if (mantissa >= 100) { mantissa = Math.round(mantissa / 10); exp += 1; }
    const d1 = Math.floor(mantissa / 10), d2 = mantissa % 10;
    const multIndex = Math.max(0, Math.min(9, exp));
    return [DIGIT_COLORS[d1] || '#8c8c8c', DIGIT_COLORS[d2] || '#8c8c8c', DIGIT_COLORS[multIndex] || '#8c8c8c', '#c9a227'];
  }

  global.MC = global.MC || {};
  global.MC.Parts = {
    CATEGORIES, ALL, get, search, byCategory,
    parseResistance, resistorColorBands
  };
})(window);
