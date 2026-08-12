// cyberia master map — ui state, area selection, intent queue, dashboard
/* global CATALOG, ACTIONS, TUBE_CONTENT, PYRAMID_FN, PRYSM_MAT, FLATS, CONTEXT,
          LINES, PLACES, MAP_W, MAP_H, CELL, METER, PLOT_AREA_M2, MY_MAPS_ID,
          defaultConfig, Wire3D */

const LS_KEY = 'cyberia-map:intents:v2';
const SVGNS = 'http://www.w3.org/2000/svg';
const CELL_M2 = 16; // 4×4 m build cell

const state = {
  structure: 'cube',
  configs: {},
  flat: null,
  sel: null,          // {c0,r0,c1,r1} in cells
  action: 'BUILD',
  view: 'structure',  // 'structure' | 'site'
  intents: [],
};

function cfg() {
  if (!state.configs[state.structure]) state.configs[state.structure] = defaultConfig(state.structure);
  return state.configs[state.structure];
}

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---- grid / area helpers ----

function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const cellInPlot = (c, r) => inPoly((c + 0.5) * CELL, (r + 0.5) * CELL, FLATS[0].pts);

function occupiedSet() {
  const s = new Set();
  for (const it of state.intents) for (const c of it.cells) s.add(c[0] + ',' + c[1]);
  return s;
}

const normSel = s => ({ c0: Math.min(s.c0, s.c1), r0: Math.min(s.r0, s.r1),
                        c1: Math.max(s.c0, s.c1), r1: Math.max(s.r0, s.r1) });

function selCells(sel) {
  const n = normSel(sel), occ = occupiedSet(), out = [];
  for (let r = n.r0; r <= n.r1; r++) for (let c = n.c0; c <= n.c1; c++)
    if (cellInPlot(c, r) && !occ.has(c + ',' + r)) out.push([c, r]);
  return out;
}

function footprint() {
  const c = cfg();
  switch (state.structure) {
    case 'cube':    return { cols: 1, rows: 1 };
    case 'tube':    return { cols: Math.ceil(c.len / 4), rows: 1 };
    case 'prysm':   return { cols: 1, rows: c.modular ? 2 : 1 };
    case 'pyramid': return { cols: 3, rows: 3 };
    case 'sphere':  return { cols: 2, rows: 2 };
  }
}

function fitsSelection() {
  if (!state.sel) return false;
  const n = normSel(state.sel), fp = footprint();
  if (n.c1 - n.c0 + 1 < fp.cols || n.r1 - n.r0 + 1 < fp.rows) return false;
  const occ = occupiedSet();
  for (let r = n.r0; r < n.r0 + fp.rows; r++) for (let c = n.c0; c < n.c0 + fp.cols; c++)
    if (!cellInPlot(c, r) || occ.has(c + ',' + r)) return false;
  return selCells(state.sel).length > 0;
}

const areaOf = it => it.cells.length * CELL_M2;

function dashNumbers() {
  let built = 0, inbuild = 0;
  for (const it of state.intents) it.done ? built += areaOf(it) : inbuild += areaOf(it);
  return { built, inbuild, free: Math.max(0, PLOT_AREA_M2 - built - inbuild) };
}

// ---- structure catalog (left panel) ----

function renderCatalog() {
  const el = document.getElementById('struct-list');
  el.innerHTML = CATALOG.map(s => `
    <div class="card ${s.id === state.structure ? 'active' : ''}" data-id="${s.id}">
      <div class="card-top"><span class="card-name">${s.name}</span>
        <span class="card-status ${s.status === 'P0' ? 'ok' : 'dim'}">${s.status}</span></div>
      <div class="card-sub">${s.sub}</div>
      <div class="card-tag">${s.tag}</div>
    </div>`).join('');
  el.querySelectorAll('.card').forEach(c => c.addEventListener('click', () => {
    state.structure = c.dataset.id;
    state.view = 'structure';
    renderCatalog(); renderConfig(); renderView(); renderIntentRows();
  }));
}

// ---- 3d render panel ----

let viewer;

function metaLine() {
  const c = cfg();
  switch (state.structure) {
    case 'cube':
      if (c.mode === 'unit') return `cell · 4×4×4 m · unit · ${c.pax}-pax`;
      if (c.mode === 'room') return `cell · 4×4×4 m · room · ${c.purpose ? '“' + c.purpose + '”' : 'purpose unset'}`;
      return `cell · 4×4×4 m · wall grid 1×1×1 · ${c.walls.length} blocks`;
    case 'tube': {
      const s = c.size === 'M' ? 4 : 2;
      return `link · ${c.size} ${s}×${s} · ${c.len} m · ${c.content.slice(0, 3).join(', ') || 'empty'}${c.content.length > 3 ? ' +' + (c.content.length - 3) : ''}`;
    }
    case 'prysm': return `module · half-rhomb · h ${c.h} m · ${c.mat.join('+') || 'no mat'} · ${c.modular ? 'modular' : 'monolith'}`;
    case 'pyramid': return `hub · 12×12 base · ${c.fns.length} functions`;
    case 'sphere': return `core · r 4 · ${c.water ? 'water store below' : 'below empty'} · ${c.orangery ? 'orangery above' : 'shell above'}`;
  }
}

function renderView() {
  document.querySelectorAll('.vchip').forEach(b =>
    b.classList.toggle('on', b.dataset.view === state.view));
  if (state.view === 'site') {
    viewer.setModel(Wire3D.buildSite(FLATS[0].pts, state.intents, state.sel, METER, CELL));
    const d = dashNumbers();
    document.getElementById('render-name').textContent = 'SITE 0';
    document.getElementById('render-meta').textContent =
      `0.096 ha · ${state.intents.length} builds · ${d.built + d.inbuild} m² allocated`;
    return;
  }
  viewer.setModel(Wire3D.build(state.structure, cfg()));
  const s = CATALOG.find(x => x.id === state.structure);
  document.getElementById('render-name').textContent = s.name;
  document.getElementById('render-meta').textContent = metaLine();
}

// ---- config panel ----

const chip = (label, on, attrs) => `<button class="chip-btn ${on ? 'on' : ''}" ${attrs}>${label}</button>`;

function renderConfig() {
  const el = document.getElementById('config');
  const c = cfg();
  let html = '';
  if (state.structure === 'cube') {
    html += `<div class="cfg-row"><span class="cfg-label">MODE</span>` +
      ['unit', 'room', 'wallgrid'].map(m => chip(m === 'wallgrid' ? 'WALL GRID' : m.toUpperCase(), c.mode === m, `data-mode="${m}"`)).join('') + `</div>`;
    if (c.mode === 'unit')
      html += `<div class="cfg-row"><span class="cfg-label">PAX</span>` +
        [1, 2].map(p => chip(`${p}-PAX`, c.pax === p, `data-pax="${p}"`)).join('') + `</div>`;
    if (c.mode === 'room')
      html += `<div class="cfg-row"><span class="cfg-label">PURPOSE</span>
        <input id="purpose" type="text" maxlength="60" placeholder="type your prompt here" value="${esc(c.purpose)}"></div>`;
    if (c.mode === 'wallgrid') {
      html += `<div class="cfg-row"><span class="cfg-label">GRID 1×1×1</span><div class="wallgrid">`;
      for (let r = 0; r < 4; r++) for (let col = 0; col < 4; col++) {
        const k = `${r},${col}`;
        html += `<button class="wg ${c.walls.includes(k) ? 'on' : ''}" data-w="${k}"></button>`;
      }
      html += `</div></div>`;
    }
  }
  if (state.structure === 'tube') {
    html += `<div class="cfg-row"><span class="cfg-label">SIZE</span>` +
      chip('S · 2 m', c.size === 'S', 'data-size="S"') + chip('M · 4 m', c.size === 'M', 'data-size="M"') + `</div>`;
    html += `<div class="cfg-row"><span class="cfg-label">LENGTH</span>` +
      [4, 8, 12, 16].map(l => chip(`${l} m`, c.len === l, `data-len="${l}"`)).join('') + `</div>`;
    html += `<div class="cfg-row wrap"><span class="cfg-label">FILL</span>` +
      TUBE_CONTENT.map(t => chip(t, c.content.includes(t), `data-fill="${esc(t)}"`)).join('') + `</div>`;
  }
  if (state.structure === 'prysm') {
    html += `<div class="cfg-row"><span class="cfg-label">HEIGHT</span>` +
      [2, 4].map(h => chip(`${h} m`, c.h === h, `data-h="${h}"`)).join('') + `</div>`;
    html += `<div class="cfg-row"><span class="cfg-label">PARTS</span>` +
      PRYSM_MAT.map(m => chip(m.toUpperCase(), c.mat.includes(m), `data-mat="${m}"`)).join('') + `</div>`;
    html += `<div class="cfg-row"><span class="cfg-label">MODULAR</span>` +
      chip('YES', c.modular, 'data-mod="1"') + chip('NO', !c.modular, 'data-mod="0"') + `</div>`;
  }
  if (state.structure === 'pyramid')
    html += `<div class="cfg-row wrap"><span class="cfg-label">FUNCTIONS</span>` +
      PYRAMID_FN.map(f => chip(f, c.fns.includes(f), `data-fn="${esc(f)}"`)).join('') + `</div>`;
  if (state.structure === 'sphere') {
    html += `<div class="cfg-row"><span class="cfg-label">BELOW</span>` +
      chip('WATER STORAGE', c.water, 'data-sph="water"') + `</div>`;
    html += `<div class="cfg-row"><span class="cfg-label">ABOVE</span>` +
      chip('ORANGERY', c.orangery, 'data-sph="orangery"') + `</div>`;
  }
  el.innerHTML = html;
  wireConfig(el, c);
}

function toggle(list, v) { const i = list.indexOf(v); i >= 0 ? list.splice(i, 1) : list.push(v); }

function wireConfig(el, c) {
  el.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { c.mode = b.dataset.mode; refresh(); });
  el.querySelectorAll('[data-pax]').forEach(b => b.onclick = () => { c.pax = +b.dataset.pax; refresh(); });
  const purpose = el.querySelector('#purpose');
  if (purpose) purpose.oninput = () => { c.purpose = purpose.value; renderView(); };
  el.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { toggle(c.walls, b.dataset.w); refresh(); });
  el.querySelectorAll('[data-size]').forEach(b => b.onclick = () => { c.size = b.dataset.size; refresh(); });
  el.querySelectorAll('[data-len]').forEach(b => b.onclick = () => { c.len = +b.dataset.len; refresh(); });
  el.querySelectorAll('[data-fill]').forEach(b => b.onclick = () => { toggle(c.content, b.dataset.fill); refresh(); });
  el.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { c.h = +b.dataset.h; refresh(); });
  el.querySelectorAll('[data-mat]').forEach(b => b.onclick = () => { toggle(c.mat, b.dataset.mat); refresh(); });
  el.querySelectorAll('[data-mod]').forEach(b => b.onclick = () => { c.modular = b.dataset.mod === '1'; refresh(); });
  el.querySelectorAll('[data-fn]').forEach(b => b.onclick = () => { toggle(c.fns, b.dataset.fn); refresh(); });
  el.querySelectorAll('[data-sph]').forEach(b => b.onclick = () => { c[b.dataset.sph] = !c[b.dataset.sph]; refresh(); });
}

function refresh() {
  if (state.view === 'site') state.view = 'structure';
  renderConfig(); renderView(); renderIntentRows();
}

// ---- map (center panel) ----

function svgEl(tag, attrs, text) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text) e.textContent = text;
  return e;
}

function buildMap() {
  const svg = document.getElementById('map');
  svg.setAttribute('viewBox', `0 0 ${MAP_W} ${MAP_H}`);
  svg.style.aspectRatio = `${MAP_W} / ${MAP_H}`;
  const grid = svgEl('g', { stroke: '#121a12', 'stroke-width': 1 });
  for (let x = 0; x <= MAP_W; x += CELL) grid.appendChild(svgEl('line', { x1: x, y1: 0, x2: x, y2: MAP_H }));
  for (let y = 0; y <= MAP_H; y += CELL) grid.appendChild(svgEl('line', { x1: 0, y1: y, x2: MAP_W, y2: y }));
  svg.appendChild(grid);
  for (const l of LINES)
    svg.appendChild(svgEl('polyline', {
      points: l.pts.map(p => p.join(',')).join(' '),
      class: l.name === 'road' ? 'ctx-road' : 'ctx-line',
      'stroke-width': 2 * METER,
    }));
  for (const c of CONTEXT)
    svg.appendChild(svgEl('polygon', {
      points: c.pts.map(p => p.join(',')).join(' '),
      class: c.kind === 'certificates' ? 'ctx-cert' : 'ctx',
    }));
  for (const f of FLATS) {
    const poly = svgEl('polygon', {
      id: `flat-${f.id}`, points: f.pts.map(p => p.join(',')).join(' '),
      fill: f.fill, stroke: f.color, 'stroke-width': 3, 'stroke-linejoin': 'round',
    });
    poly.classList.add('flat');
    svg.appendChild(poly);
    const cx = f.pts.reduce((s, p) => s + p[0], 0) / f.pts.length;
    const by = Math.max(...f.pts.map(p => p[1]));
    svg.appendChild(svgEl('text', { x: cx, y: by - 28, class: 'flat-label', fill: f.color }, f.name));
  }
  const sbX = 24, sbY = MAP_H - 24, sbL = 10 * METER;
  const sb = svgEl('g', { class: 'scalebar' });
  sb.appendChild(svgEl('path', { d: `M${sbX},${sbY - 8} V${sbY} H${sbX + sbL} V${sbY - 8}` }));
  sb.appendChild(svgEl('text', { x: sbX + sbL / 2, y: sbY - 14, class: 'scalebar-t' }, '10 m'));
  svg.appendChild(sb);
  svg.appendChild(svgEl('g', { id: 'glyphs' }));
  svg.appendChild(svgEl('g', { id: 'sel' }));
  wirePointer(svg);
}

function cellAt(svg, e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  return [Math.floor(p.x / CELL), Math.floor(p.y / CELL)];
}

function wirePointer(svg) {
  let dragging = false;
  svg.addEventListener('pointerdown', e => {
    const [c, r] = cellAt(svg, e);
    dragging = true;
    svg.classList.add('dragging');
    svg.setPointerCapture(e.pointerId);
    state.sel = { c0: c, r0: r, c1: c, r1: r };
    state.flat = FLATS[0].id;
    state.view = 'site';
    renderSelection(); renderIntentRows(); renderView();
  });
  svg.addEventListener('pointermove', e => {
    if (!dragging) return;
    const [c, r] = cellAt(svg, e);
    if (c === state.sel.c1 && r === state.sel.r1) return;
    state.sel.c1 = c; state.sel.r1 = r;
    renderSelection(); renderIntentRows(); renderView();
  });
  svg.addEventListener('pointerup', e => {
    dragging = false;
    svg.classList.remove('dragging');
    if (state.sel && !selCells(state.sel).length) { state.sel = null; state.flat = null; }
    renderSelection(); renderIntentRows(); renderView();
  });
}

function renderSelection() {
  const g = document.getElementById('sel');
  g.innerHTML = '';
  document.getElementById(`flat-${FLATS[0].id}`).classList.toggle('selected', !!state.sel);
  if (!state.sel) return;
  const n = normSel(state.sel);
  for (const [c, r] of selCells(state.sel))
    g.appendChild(svgEl('rect', { x: c * CELL, y: r * CELL, width: CELL, height: CELL, class: 'sel-cell' }));
  g.appendChild(svgEl('rect', {
    x: n.c0 * CELL, y: n.r0 * CELL,
    width: (n.c1 - n.c0 + 1) * CELL, height: (n.r1 - n.r0 + 1) * CELL, class: 'sel-rect',
  }));
}

function renderGlyphs() {
  const g = document.getElementById('glyphs');
  g.innerHTML = '';
  for (const it of state.intents) {
    const s = CATALOG.find(x => x.id === it.structure);
    const cls = it.done ? 'built' : 'inbuild';
    for (const [c, r] of it.cells)
      g.appendChild(svgEl('rect', {
        x: c * CELL + 2, y: r * CELL + 2, width: CELL - 4, height: CELL - 4,
        class: `cellfill ${cls}`,
      }));
    const gx = (it.anchor[0] + it.fp.cols / 2) * CELL;
    const gy = (it.anchor[1] + it.fp.rows / 2) * CELL;
    g.appendChild(svgEl('text', {
      x: gx, y: gy + CELL * 0.14, class: `glyph-t ${cls}`, 'font-size': CELL * 0.42,
    }, s ? s.glyph : '?'));
  }
}

// ---- intent (right panel) ----

function renderIntentRows() {
  const s = CATALOG.find(x => x.id === state.structure);
  const fp = footprint();
  document.getElementById('iv-structure').textContent = s.name;
  document.getElementById('iv-flat').textContent = state.flat ? FLATS[0].name : '—';
  if (state.sel) {
    const n = normSel(state.sel);
    const area = selCells(state.sel).length * CELL_M2;
    document.getElementById('iv-site').textContent =
      `${n.c1 - n.c0 + 1}×${n.r1 - n.r0 + 1} · ${area} m²`;
  } else document.getElementById('iv-site').textContent = '—';
  document.getElementById('iv-fp').textContent =
    `${fp.cols * fp.rows * CELL_M2} m² · ${fp.cols}×${fp.rows} cells`;
  const fits = fitsSelection();
  document.getElementById('commit').disabled = !fits;
  document.getElementById('fit-hint').textContent =
    state.sel && !fits ? 'selection is smaller than the footprint or overlaps a build' : '';
  const rn = document.getElementById('render-sub');
  rn.textContent = state.sel ? `site 0 · ${FLATS[0].note}` : 'selected structure · 3d';
}

function renderActions() {
  const el = document.getElementById('actions');
  el.innerHTML = ACTIONS.map(a => chip(a, a === state.action, `data-action="${a}"`)).join('');
  el.querySelectorAll('[data-action]').forEach(b => b.onclick = () => { state.action = b.dataset.action; renderActions(); });
}

function commit() {
  if (!fitsSelection()) return;
  const n = normSel(state.sel);
  state.intents.push({
    n: (state.intents[state.intents.length - 1]?.n || 0) + 1,
    ts: Date.now(),
    action: state.action,
    structure: state.structure,
    meta: metaLine(),
    config: JSON.parse(JSON.stringify(cfg())),
    flat: FLATS[0].id,
    anchor: [n.c0, n.r0],
    fp: footprint(),
    cells: selCells(state.sel),
    done: false,
  });
  state.sel = null;
  save(); renderAllDynamic();
}

function removeIntent(n) {
  state.intents = state.intents.filter(i => i.n !== n);
  save(); renderAllDynamic();
}

function toggleDone(n) {
  const it = state.intents.find(i => i.n === n);
  if (it) it.done = !it.done;
  save(); renderAllDynamic();
}

function renderAllDynamic() {
  renderSelection(); renderQueue(); renderGlyphs(); renderDash();
  renderStats(); renderIntentRows(); renderView();
}

function renderQueue() {
  const el = document.getElementById('queue');
  if (!state.intents.length) {
    el.innerHTML = `<div class="queue-empty">no intents yet — select an area, assign a cube</div>`;
    return;
  }
  el.innerHTML = state.intents.slice().reverse().map(it => {
    const s = CATALOG.find(x => x.id === it.structure);
    const t = new Date(it.ts);
    const hh = String(t.getHours()).padStart(2, '0'), mm = String(t.getMinutes()).padStart(2, '0');
    return `<div class="qitem ${it.done ? 'done' : ''}">
      <div class="q-top"><span class="q-id">#${String(it.n).padStart(3, '0')}</span>
        <span class="q-act">${it.done ? 'BUILT' : it.action}</span> · <span class="q-s">${s.name}</span>
        <span class="q-cell">[${it.anchor[0]}·${it.anchor[1]}] · ${areaOf(it)} m²</span>
        <button class="q-ok" data-n="${it.n}" title="toggle built">✓</button>
        <button class="q-x" data-n="${it.n}" title="remove">×</button></div>
      <div class="q-meta">${esc(it.meta)} · ${hh}:${mm}</div>
    </div>`;
  }).join('');
  el.querySelectorAll('.q-x').forEach(b => b.onclick = () => removeIntent(+b.dataset.n));
  el.querySelectorAll('.q-ok').forEach(b => b.onclick = () => toggleDone(+b.dataset.n));
}

// ---- dashboard + footer ----

function renderDash() {
  const d = dashNumbers();
  const pct = v => PLOT_AREA_M2 ? (v / PLOT_AREA_M2 * 100) : 0;
  document.getElementById('dash').innerHTML = `
    <div class="dash-bar">
      <span class="seg built" style="width:${pct(d.built)}%"></span>
      <span class="seg inbuild" style="width:${pct(d.inbuild)}%"></span>
      <span class="seg free" style="width:${pct(d.free)}%"></span>
    </div>
    <div class="dash-rows">
      <span class="d-total">TOTAL ${PLOT_AREA_M2} m²</span>
      <span class="d-built">BUILT ${d.built} m²</span>
      <span class="d-inbuild">IN BUILD ${d.inbuild} m²</span>
      <span class="d-free">FREE ${d.free} m²</span>
    </div>`;
}

function renderStats() {
  const d = dashNumbers();
  document.getElementById('stats').textContent =
    `${state.intents.length} intents · ${d.built} m² built · ${d.inbuild} m² in build · ${d.free} m² free`;
}

function save() { localStorage.setItem(LS_KEY, JSON.stringify(state.intents)); }

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY)) || [];
    state.intents = raw.filter(it =>
      CATALOG.some(s => s.id === it.structure) && FLATS.some(f => f.id === it.flat) &&
      Array.isArray(it.cells) && Array.isArray(it.anchor) && it.fp);
  } catch { state.intents = []; }
}

// ---- boot ----

document.addEventListener('DOMContentLoaded', () => {
  load();
  viewer = Wire3D.attach(document.getElementById('view3d'));
  document.getElementById('kml-link').href =
    `https://www.google.com/maps/d/viewer?mid=${MY_MAPS_ID}`;
  buildMap();
  renderCatalog(); renderConfig(); renderActions();
  renderAllDynamic();
  document.getElementById('commit').addEventListener('click', commit);
  document.querySelectorAll('.vchip').forEach(b => b.onclick = () => {
    state.view = b.dataset.view;
    renderView();
  });
});
