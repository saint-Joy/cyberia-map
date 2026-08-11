// cyberia master map — ui state, map interaction, intent queue
/* global CATALOG, ACTIONS, TUBE_CONTENT, PYRAMID_FN, PRYSM_MAT, FLATS, PLACES,
          MAP_W, MAP_H, CELL, MY_MAPS_ID, defaultConfig, Wire3D */

const LS_KEY = 'cyberia-map:intents:v1';
const SVGNS = 'http://www.w3.org/2000/svg';

const state = {
  structure: 'cube',
  configs: {},
  flat: null,
  cell: null,
  action: 'BUILD',
  intents: [],
};

function cfg() {
  if (!state.configs[state.structure]) state.configs[state.structure] = defaultConfig(state.structure);
  return state.configs[state.structure];
}

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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

function refresh() { renderConfig(); renderView(); }

// ---- map (center panel) ----

function svgEl(tag, attrs, text) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text) e.textContent = text;
  return e;
}

function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function buildMap() {
  const svg = document.getElementById('map');
  svg.setAttribute('viewBox', `0 0 ${MAP_W} ${MAP_H}`);
  const grid = svgEl('g', { stroke: '#111811', 'stroke-width': 1 });
  for (let x = 0; x <= MAP_W; x += CELL * 4) grid.appendChild(svgEl('line', { x1: x, y1: 0, x2: x, y2: MAP_H }));
  for (let y = 0; y <= MAP_H; y += CELL * 4) grid.appendChild(svgEl('line', { x1: 0, y1: y, x2: MAP_W, y2: y }));
  svg.appendChild(grid);
  for (const f of FLATS) {
    const poly = svgEl('polygon', {
      id: `flat-${f.id}`, points: f.pts.map(p => p.join(',')).join(' '),
      fill: f.fill, stroke: f.color, 'stroke-width': 2.5, 'stroke-linejoin': 'round',
    });
    poly.classList.add('flat');
    svg.appendChild(poly);
    const cx = f.pts.reduce((s, p) => s + p[0], 0) / f.pts.length;
    const cy = f.pts.reduce((s, p) => s + p[1], 0) / f.pts.length;
    svg.appendChild(svgEl('text', { x: cx, y: cy, class: 'flat-label', fill: f.color }, f.name));
  }
  for (const p of PLACES) {
    svg.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 3.5, class: 'place-dot' }));
    svg.appendChild(svgEl('text', { x: p.x, y: p.y - 8, class: 'place-label' }, p.name));
  }
  svg.appendChild(svgEl('g', { id: 'glyphs' }));
  svg.appendChild(svgEl('g', { id: 'sel' }));
  svg.addEventListener('click', e => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const flat = FLATS.find(f => inPoly(p.x, p.y, f.pts));
    if (!flat) return;
    state.flat = flat.id;
    state.cell = [Math.floor(p.x / CELL), Math.floor(p.y / CELL)];
    renderSelection(); renderIntentRows();
  });
}

function renderSelection() {
  const g = document.getElementById('sel');
  g.innerHTML = '';
  for (const f of FLATS)
    document.getElementById(`flat-${f.id}`).classList.toggle('selected', f.id === state.flat);
  if (!state.cell) return;
  const [c, r] = state.cell, x = c * CELL, y = r * CELL;
  g.appendChild(svgEl('rect', { x, y, width: CELL, height: CELL, class: 'sel-cell' }));
  const mx = x + CELL / 2, my = y + CELL / 2, t = 16;
  g.appendChild(svgEl('path', {
    class: 'sel-cross',
    d: `M${mx - t},${my} H${mx - 6} M${mx + 6},${my} H${mx + t} M${mx},${my - t} V${my - 6} M${mx},${my + 6} V${my + t}`,
  }));
}

function renderGlyphs() {
  const g = document.getElementById('glyphs');
  g.innerHTML = '';
  for (const it of state.intents) {
    const flat = FLATS.find(f => f.id === it.flat);
    const s = CATALOG.find(x => x.id === it.structure);
    const x = it.cell[0] * CELL, y = it.cell[1] * CELL;
    g.appendChild(svgEl('rect', {
      x: x + 3, y: y + 3, width: CELL - 6, height: CELL - 6,
      class: 'glyph', stroke: flat ? flat.color : '#888',
    }));
    g.appendChild(svgEl('text', {
      x: x + CELL / 2, y: y + CELL / 2 + 3.5, class: 'glyph-t', fill: flat ? flat.color : '#888',
    }, s ? s.glyph : '?'));
  }
}

// ---- intent (right panel) ----

function renderIntentRows() {
  const s = CATALOG.find(x => x.id === state.structure);
  const flat = FLATS.find(f => f.id === state.flat);
  document.getElementById('iv-structure').textContent = s.name;
  document.getElementById('iv-flat').textContent = flat ? flat.name : '—';
  document.getElementById('iv-site').textContent = state.cell ? `${state.cell[0]}·${state.cell[1]}` : '—';
  document.getElementById('commit').disabled = !(state.flat && state.cell);
  const rn = document.getElementById('render-sub');
  rn.textContent = flat ? `selected flat · ${flat.note}` : 'selected structure · 3d';
}

function renderActions() {
  const el = document.getElementById('actions');
  el.innerHTML = ACTIONS.map(a => chip(a, a === state.action, `data-action="${a}"`)).join('');
  el.querySelectorAll('[data-action]').forEach(b => b.onclick = () => { state.action = b.dataset.action; renderActions(); });
}

function commit() {
  if (!(state.flat && state.cell)) return;
  state.intents.push({
    n: (state.intents[state.intents.length - 1]?.n || 0) + 1,
    ts: Date.now(),
    action: state.action,
    structure: state.structure,
    meta: metaLine(),
    config: JSON.parse(JSON.stringify(cfg())),
    flat: state.flat,
    cell: state.cell.slice(),
  });
  save(); renderQueue(); renderGlyphs(); renderStats();
}

function removeIntent(n) {
  state.intents = state.intents.filter(i => i.n !== n);
  save(); renderQueue(); renderGlyphs(); renderStats();
}

function renderQueue() {
  const el = document.getElementById('queue');
  if (!state.intents.length) {
    el.innerHTML = `<div class="queue-empty">no intents yet — assign a cube to a flat</div>`;
    return;
  }
  el.innerHTML = state.intents.slice().reverse().map(it => {
    const s = CATALOG.find(x => x.id === it.structure);
    const flat = FLATS.find(f => f.id === it.flat);
    const t = new Date(it.ts);
    const hh = String(t.getHours()).padStart(2, '0'), mm = String(t.getMinutes()).padStart(2, '0');
    return `<div class="qitem">
      <div class="q-top"><span class="q-id">#${String(it.n).padStart(3, '0')}</span>
        <span class="q-act">${it.action}</span> · <span class="q-s">${s.name}</span>
        <span class="q-arrow">→</span> <span class="q-flat" style="color:${flat ? flat.color : '#888'}">${flat ? flat.name : it.flat}</span>
        <span class="q-cell">[${it.cell[0]}·${it.cell[1]}]</span>
        <button class="q-x" data-n="${it.n}">×</button></div>
      <div class="q-meta">${esc(it.meta)} · ${hh}:${mm}</div>
    </div>`;
  }).join('');
  el.querySelectorAll('.q-x').forEach(b => b.onclick = () => removeIntent(+b.dataset.n));
}

function renderStats() {
  document.getElementById('stats').textContent =
    `${state.intents.length} intents · ${FLATS.length} phase-0 flats · ${CATALOG.length} structures`;
}

function save() { localStorage.setItem(LS_KEY, JSON.stringify(state.intents)); }

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY)) || [];
    state.intents = raw
      .map(it => it.structure === 'atom' ? { ...it, structure: 'cube' } : it)
      .filter(it => CATALOG.some(s => s.id === it.structure));
  } catch { state.intents = []; }
}

// ---- boot ----

document.addEventListener('DOMContentLoaded', () => {
  load();
  viewer = Wire3D.attach(document.getElementById('view3d'));
  document.getElementById('kml-link').href =
    `https://www.google.com/maps/d/viewer?mid=${MY_MAPS_ID}`;
  buildMap();
  renderCatalog(); renderConfig(); renderView();
  renderActions(); renderIntentRows(); renderQueue(); renderGlyphs(); renderStats();
  document.getElementById('commit').addEventListener('click', commit);
});
