// geometry.js — breadboard hole grid math, DIP pin layout, snapping.
// Everything lives on a uniform PITCH grid. Positions are in "world units" (SVG user units).
(function (global) {
  'use strict';

  const PITCH = 10;           // spacing between adjacent holes (one grid step)
  const MARGIN = 16;          // padding around the hole field inside a board
  const LABEL_GUTTER = 16;    // space reserved for row-letter / rail labels
  const COLS = 63;            // holes per row on a full-size breadboard
  const GAP_BEFORE_MAIN = 12; // extra vertical gap between top rail and row A
  const GAP_AFTER_MAIN = 12;  // extra vertical gap between row J and bottom rail
  const CENTER_GAP = 0;       // E->F stays exactly one PITCH apart (real 0.3" DIPs straddle it)

  // Row order top-to-bottom, matching the spec's ASCII diagram exactly.
  const ROW_KEYS = [
    'PWR_T_PLUS', 'PWR_T_MINUS',
    'A', 'B', 'C', 'D', 'E',
    'F', 'G', 'H', 'I', 'J',
    'PWR_B_PLUS', 'PWR_B_MINUS'
  ];

  function rowLocalY(index) {
    let y = index * PITCH;
    if (index >= 2) y += GAP_BEFORE_MAIN;
    if (index >= 12) y += GAP_AFTER_MAIN;
    return y;
  }

  // Precompute {key, index, y} for every row once.
  const ROWS = ROW_KEYS.map((key, index) => ({ key, index, y: rowLocalY(index) }));
  const ROW_BY_KEY = {};
  ROWS.forEach(r => { ROW_BY_KEY[r.key] = r; });

  const MAIN_ROW_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const RAIL_ROW_KEYS = ['PWR_T_PLUS', 'PWR_T_MINUS', 'PWR_B_PLUS', 'PWR_B_MINUS'];

  const BOARD_WIDTH = LABEL_GUTTER + MARGIN * 2 + (COLS - 1) * PITCH;
  const BOARD_HEIGHT = MARGIN * 2 + rowLocalY(ROWS.length - 1);

  function colLocalX(col) {
    return LABEL_GUTTER + MARGIN + col * PITCH;
  }

  function holeLocalPos(rowKey, col) {
    const row = ROW_BY_KEY[rowKey];
    if (!row) return null;
    return { x: colLocalX(col), y: MARGIN + row.y };
  }

  function holeWorldPos(board, rowKey, col) {
    const local = holeLocalPos(rowKey, col);
    if (!local) return null;
    return { x: board.x + local.x, y: board.y + local.y };
  }

  function clampCol(col) {
    return Math.max(0, Math.min(COLS - 1, Math.round(col)));
  }

  // Given a point in a board's local space, find the nearest hole (row + col).
  function nearestHoleLocal(localX, localY) {
    const rawCol = (localX - LABEL_GUTTER - MARGIN) / PITCH;
    const col = clampCol(rawCol);
    const y = localY - MARGIN;
    let best = ROWS[0];
    let bestDist = Math.abs(y - best.y);
    for (let i = 1; i < ROWS.length; i++) {
      const d = Math.abs(y - ROWS[i].y);
      if (d < bestDist) { bestDist = d; best = ROWS[i]; }
    }
    return { row: best.key, col };
  }

  // Given a world point and a board, return nearest hole info + world position + distance.
  function nearestHoleOnBoard(board, worldX, worldY) {
    const localX = worldX - board.x;
    const localY = worldY - board.y;
    const hole = nearestHoleLocal(localX, localY);
    const pos = holeWorldPos(board, hole.row, hole.col);
    const dist = Math.hypot(pos.x - worldX, pos.y - worldY);
    return { boardId: board.id, row: hole.row, col: hole.col, x: pos.x, y: pos.y, dist };
  }

  // Search all (visible, unlocked-doesn't matter for snapping) boards for the closest hole.
  function nearestHoleAmongBoards(boards, worldX, worldY, maxDist) {
    let best = null;
    for (const board of boards) {
      const cand = nearestHoleOnBoard(board, worldX, worldY);
      if (cand.dist <= (maxDist == null ? PITCH * 0.9 : maxDist)) {
        if (!best || cand.dist < best.dist) best = cand;
      }
    }
    return best;
  }

  // Snap an arbitrary world point to the global PITCH grid (used away from boards).
  function snapToGlobalGrid(worldX, worldY) {
    return {
      x: Math.round(worldX / PITCH) * PITCH,
      y: Math.round(worldY / PITCH) * PITCH
    };
  }

  // --- Generic DIP pin layout -------------------------------------------------
  // Standard DIP convention (matches every real datasheet): viewed from above with
  // the pin-1/notch mark at the top-left corner, pin 1 is the pin directly BELOW the
  // notch (bottom-left) and numbering runs counter-clockwise from there — right along
  // the bottom row (1..N/2), then back right-to-left along the top row (N/2+1..N),
  // ending at pin N in the top-left corner right next to the notch.
  function dipPinLocalOffset(pinIndex1based, totalPins, rowGapUnits) {
    const half = totalPins / 2;
    const gapY = (rowGapUnits == null ? 1 : rowGapUnits) * PITCH;
    if (pinIndex1based <= half) {
      return { x: (pinIndex1based - 1) * PITCH, y: gapY, row: 1 };
    }
    const colFromLeft = totalPins - pinIndex1based;
    return { x: colFromLeft * PITCH, y: 0, row: 0 };
  }

  function dipBodySize(totalPins, rowGapUnits) {
    const half = totalPins / 2;
    const gapY = (rowGapUnits == null ? 1 : rowGapUnits) * PITCH;
    return {
      width: (half - 1) * PITCH + PITCH,
      height: gapY,
      overhang: PITCH * 0.5
    };
  }

  // --- Rotation helpers --------------------------------------------------------
  // Rotate a local-space point (relative to a component's bounding-box center)
  // by 0/90/180/270 degrees.
  function rotatePoint(x, y, cx, cy, degrees) {
    const rad = (degrees * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const dx = x - cx, dy = y - cy;
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos
    };
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx, cy = y1 + t * dy;
    return Math.hypot(px - cx, py - cy);
  }

  function boardContaining(boards, worldX, worldY) {
    for (const b of boards) {
      if (worldX >= b.x && worldX <= b.x + BOARD_WIDTH && worldY >= b.y && worldY <= b.y + BOARD_HEIGHT) return b.id;
    }
    return null;
  }

  function boardsAndComponentsBBox(boards, components, labels) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let any = false;
    (boards || []).forEach(b => {
      any = true;
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + BOARD_WIDTH);
      maxY = Math.max(maxY, b.y + BOARD_HEIGHT);
    });
    (components || []).forEach(c => {
      any = true;
      const pad = 40;
      minX = Math.min(minX, c.x - pad);
      minY = Math.min(minY, c.y - pad);
      maxX = Math.max(maxX, c.x + pad);
      maxY = Math.max(maxY, c.y + pad);
    });
    (labels || []).forEach(l => {
      any = true;
      minX = Math.min(minX, l.x - 20);
      minY = Math.min(minY, l.y - 20);
      maxX = Math.max(maxX, l.x + (l.width || 60));
      maxY = Math.max(maxY, l.y + (l.height || 30));
    });
    if (!any) return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    return { minX, minY, maxX, maxY };
  }

  global.MC = global.MC || {};
  global.MC.Geometry = {
    PITCH, MARGIN, LABEL_GUTTER, COLS,
    ROW_KEYS, ROWS, ROW_BY_KEY, MAIN_ROW_KEYS, RAIL_ROW_KEYS,
    BOARD_WIDTH, BOARD_HEIGHT,
    colLocalX, rowLocalY,
    holeLocalPos, holeWorldPos,
    nearestHoleLocal, nearestHoleOnBoard, nearestHoleAmongBoards,
    snapToGlobalGrid,
    dipPinLocalOffset, dipBodySize,
    rotatePoint, distToSegment,
    boardContaining, boardsAndComponentsBBox
  };
})(window);
