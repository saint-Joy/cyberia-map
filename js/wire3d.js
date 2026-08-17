// wire3d — zero-dependency wireframe renderer (canvas 2d, axonometric, auto-orbit)
// model = { groups: [{ color, dash, width, glow, edges: [[x1,y1,z1,x2,y2,z2],…] }], radius, cy }
// axes: Y up, ground at y = 0. all solids are canonical: cube, prism, pyramid, sphere.
// projection is orthographic (elevation 30°, azimuth orbits): parallel edges stay
// parallel and vertical edges stay vertical — no perspective skew.

const Wire3D = (() => {
  const GREEN = '#52e05a', DIM = '#23532a', ORANGE = '#e08a3c',
        CYAN = '#55d7e8', GRAY = '#6b756d', BRIGHT = '#8df595';
  const MATCOL = { wood: ORANGE, glass: CYAN, metal: GRAY };

  const ELEV = Math.PI / 6; // 30° elevation, fixed

  // pure: model + camera azimuth + viewport → groups of 2d segments
  // [x1, y1, x2, y2, nearness] where nearness 0 = farthest, 1 = closest to camera.
  // orthographic, so parallel 3d edges stay parallel and verticals stay vertical
  function project(model, angle, w, h) {
    const r = model.radius, cy = model.cy || 0;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const cE = Math.cos(ELEV), sE = Math.sin(ELEV);
    const scale = Math.min(w, h) / (r * 2.4);
    const ox = w / 2, oy = h * 0.56;
    const depth = (x, y, z) => (y - cy) * sE - (z * ca - x * sa) * cE; // toward camera
    const p = (x, y, z) =>
      [ox + (x * ca + z * sa) * scale, oy - ((y - cy) * cE + (z * ca - x * sa) * sE) * scale];

    let lo = Infinity, hi = -Infinity;
    const out = model.groups.map(g => ({
      ...g,
      segs: g.edges.map(e => {
        const a = p(e[0], e[1], e[2]), b = p(e[3], e[4], e[5]);
        const d = (depth(e[0], e[1], e[2]) + depth(e[3], e[4], e[5])) / 2;
        if (d < lo) lo = d;
        if (d > hi) hi = d;
        return [a[0], a[1], b[0], b[1], d];
      }),
    }));
    const span = hi - lo || 1;
    for (const g of out) for (const s of g.segs) s[4] = (s[4] - lo) / span;
    return out;
  }

  function attach(canvas) {
    const ctx = canvas.getContext('2d');
    let model = null, angle = 0.55, last = 0; // 0.55 rad: 3/4 view, no edge collapses

    function fit() {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      return dpr;
    }

    function draw() {
      const dpr = fit();
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      if (!model) return;
      // three depth passes: far edges dimmer, so the solid reads at any azimuth
      const BANDS = [[0.34, 0.4], [0.67, 0.7], [1.01, 1]];
      for (const g of project(model, angle, w, h)) {
        ctx.strokeStyle = g.color;
        ctx.lineWidth = (g.width || 1.4) * dpr;
        ctx.setLineDash(g.dash ? g.dash.map(d => d * dpr) : []);
        ctx.shadowBlur = (g.glow ? 9 : 0) * dpr;
        ctx.shadowColor = g.color;
        let from = -0.01;
        for (const [upTo, alpha] of BANDS) {
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          for (const s of g.segs)
            if (s[4] > from && s[4] <= upTo) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); }
          ctx.stroke();
          from = upTo;
        }
      }
      ctx.globalAlpha = 1; ctx.setLineDash([]); ctx.shadowBlur = 0;
    }

    function frame(t) {
      const dt = last ? Math.min((t - last) / 1000, 0.1) : 0;
      last = t; angle += dt * 0.35;
      draw();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { setModel: m => { model = m; } };
  }

  // ---- geometry primitives ----

  function box(cx, cy, cz, w, h, d) {
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2,
          z0 = cz - d / 2, z1 = cz + d / 2, E = [];
    for (const y of [y0, y1]) E.push([x0, y, z0, x1, y, z0], [x1, y, z0, x1, y, z1],
                                     [x1, y, z1, x0, y, z1], [x0, y, z1, x0, y, z0]);
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) E.push([x, y0, z, x, y1, z]);
    return E;
  }

  function rectY(y, x0, z0, x1, z1) {
    return [[x0, y, z0, x1, y, z0], [x1, y, z0, x1, y, z1],
            [x1, y, z1, x0, y, z1], [x0, y, z1, x0, y, z0]];
  }

  function ringY(y, r, seg) {
    const E = [];
    for (let i = 0; i < seg; i++) {
      const a = i / seg * 2 * Math.PI, b = (i + 1) / seg * 2 * Math.PI;
      E.push([r * Math.cos(a), y, r * Math.sin(a), r * Math.cos(b), y, r * Math.sin(b)]);
    }
    return E;
  }

  function ground(size, step) {
    const E = [], s = size;
    for (let i = -s; i <= s; i += step) E.push([i, 0, -s, i, 0, s], [-s, 0, i, s, 0, i]);
    return { color: '#141b15', edges: E, width: 1 };
  }

  const tr = (groups, dx, dz) => groups.map(g => ({
    ...g, edges: g.edges.map(e => [e[0] + dx, e[1], e[2] + dz, e[3] + dx, e[4], e[5] + dz]),
  }));

  const recolor = (groups, color) => groups.map(g => ({ ...g, color, glow: false }));

  // ---- structures: canonical solids ----

  // the six faces of the 4 m cube, as origin + column/row unit vectors (metres).
  // same unfolding the config net shows: top over front, bottom under it,
  // left · front · right · back in a strip.
  const FACES = {
    top:    { o: [-2, 4, -2], u: [1, 0, 0],  v: [0, 0, 1] },
    left:   { o: [-2, 4, -2], u: [0, 0, 1],  v: [0, -1, 0] },
    front:  { o: [-2, 4,  2], u: [1, 0, 0],  v: [0, -1, 0] },
    right:  { o: [ 2, 4,  2], u: [0, 0, -1], v: [0, -1, 0] },
    back:   { o: [ 2, 4, -2], u: [-1, 0, 0], v: [0, -1, 0] },
    bottom: { o: [-2, 0,  2], u: [1, 0, 0],  v: [0, 0, -1] },
  };

  const matColor = id => (typeof WALL_MATERIALS !== 'undefined'
    ? (WALL_MATERIALS.find(m => m.id === id) || {}).color : null) || BRIGHT;

  // point on a face at column k, row l (both in metres from the face origin)
  function onFace(face, k, l) {
    const f = FACES[face];
    return [f.o[0] + f.u[0] * k + f.v[0] * l,
            f.o[1] + f.u[1] * k + f.v[1] * l,
            f.o[2] + f.u[2] * k + f.v[2] * l];
  }

  // one 1×1 m panel on a face, inset so neighbours stay readable
  function panel(face, r, c, inset) {
    const lo = inset / 2, hi = 1 - inset / 2;
    const q = [onFace(face, c + lo, r + lo), onFace(face, c + hi, r + lo),
               onFace(face, c + hi, r + hi), onFace(face, c + lo, r + hi)];
    return q.map((p, i) => [...p, ...q[(i + 1) % 4]]);
  }

  function cubeGroups(cfg) {
    const groups = [{ color: GREEN, glow: true, edges: box(0, 2, 0, 4, 4, 4) }];
    if (cfg.mode !== 'wallgrid') return groups;

    const cells = cfg.cells || {};
    const seams = { color: '#1d3524', width: 1, edges: [] }; // 1 m panel seams
    for (const face in FACES)
      for (let i = 1; i < 4; i++)
        seams.edges.push([...onFace(face, i, 0), ...onFace(face, i, 4)],
                         [...onFace(face, 0, i), ...onFace(face, 4, i)]);
    groups.push(seams);

    const byColor = {}, openings = { color: CYAN, dash: [3, 3], width: 1.6, edges: [] };
    for (const key in cells) {
      const [face, r, c] = key.split(':');
      if (!FACES[face]) continue;
      const cell = cells[key];
      if (cell.t === 'open') { openings.edges.push(...panel(face, +r, +c, 0.28)); continue; }
      const col = matColor(cell.m);
      (byColor[col] = byColor[col] || { color: col, width: 1.6, edges: [] })
        .edges.push(...panel(face, +r, +c, 0.16));
    }
    groups.push(...Object.values(byColor));
    if (openings.edges.length) groups.push(openings);
    return groups;
  }

  // tube = arch: straight walls up to half height, semicircular vault above.
  // axis along x, span s across z, total height s (spec: 2 m size S, 4 m size M)
  function tubeGroups(cfg) {
    const s = cfg.size === 'M' ? 4 : 2, L = cfg.len, half = L / 2;
    const r = s / 2, wall = s - r, SEG = 12;

    const prof = [[-r, 0]];
    for (let i = 0; i <= SEG; i++) {
      const t = Math.PI - i / SEG * Math.PI;
      prof.push([r * Math.cos(t), wall + r * Math.sin(t)]);
    }
    prof.push([r, 0]);

    const ring = x => prof.slice(0, -1).map((p, i) =>
      [x, p[1], p[0], x, prof[i + 1][1], prof[i + 1][0]]);
    const rail = i => [-half, prof[i][1], prof[i][0], half, prof[i][1], prof[i][0]];

    const crown = 1 + SEG / 2;
    const shell = { color: GREEN, glow: true, edges: [...ring(-half), ...ring(half)] };
    for (const i of [0, 1, 1 + SEG / 4, crown, 1 + 3 * SEG / 4, 1 + SEG, SEG + 2])
      shell.edges.push(rail(i));
    const frames = { color: DIM, edges: [] };
    for (let x = -half + 2; x < half; x += 2) frames.edges.push(...ring(x));
    const groups = [shell, frames];

    if (cfg.content.includes('glass path top'))
      groups.push({ color: CYAN, dash: [6, 4], edges: [rail(crown - 1), rail(crown + 1)] });
    if (cfg.content.includes('closed pond'))
      groups.push({ color: CYAN, dash: [5, 4],
                    edges: rectY(0.25, -half + 0.5, -r + 0.4, half - 0.5, r - 0.4) });
    return groups;
  }

  // prysm = A-frame: 4 × 2 m base rectangle, ridge along the middle, height h.
  // the gable face is the isosceles triangle (half of a rhomb). modular = two modules deep.
  function prysmGroups(cfg) {
    const h = cfg.h, span = 4, unit = 2, depth = cfg.modular ? unit * 2 : unit, zh = depth / 2;
    const color = cfg.mat.length === 1 ? MATCOL[cfg.mat[0]] : GREEN;
    const gable = z => [[-span / 2, 0, z, span / 2, 0, z],
                        [span / 2, 0, z, 0, h, z], [0, h, z, -span / 2, 0, z]];
    const groups = [{ color, glow: true, edges: [
      ...gable(-zh), ...gable(zh),
      [-span / 2, 0, -zh, -span / 2, 0, zh], [span / 2, 0, -zh, span / 2, 0, zh],
      [0, h, -zh, 0, h, zh]] }];
    if (cfg.modular) groups.push({ color: DIM, edges: gable(0) });
    return groups;
  }

  // square base, height = side: 4 base edges + 4 lateral edges, nothing else
  function pyramidGroups(cfg) {
    const b = cfg.base / 2, h = cfg.base;
    return [{ color: GREEN, glow: true, edges: [
      ...rectY(0, -b, -b, b, b),
      [-b, 0, -b, 0, h, 0], [b, 0, -b, 0, h, 0], [b, 0, b, 0, h, 0], [-b, 0, b, 0, h, 0]] }];
  }

  function sphereGroups(cfg) {
    const r = cfg.d / 2;
    const upper = { color: cfg.orangery ? GREEN : GRAY, glow: cfg.orangery, edges: [] };
    const lower = { color: cfg.water ? CYAN : GRAY, dash: [4, 4], edges: [] };
    for (const phi of [22.5, 45, 67.5]) {
      const a = phi * Math.PI / 180;
      upper.edges.push(...ringY(r * Math.sin(a), r * Math.cos(a), 28));
      lower.edges.push(...ringY(-r * Math.sin(a), r * Math.cos(a), 28));
    }
    for (let m = 0; m < 8; m++) {
      const t = m / 8 * 2 * Math.PI, seg = 16;
      for (let i = 0; i < seg; i++) {
        const p0 = -Math.PI / 2 + i / seg * Math.PI, p1 = -Math.PI / 2 + (i + 1) / seg * Math.PI;
        const e = [r * Math.cos(p0) * Math.cos(t), r * Math.sin(p0), r * Math.cos(p0) * Math.sin(t),
                   r * Math.cos(p1) * Math.cos(t), r * Math.sin(p1), r * Math.cos(p1) * Math.sin(t)];
        ((p0 + p1) / 2 >= 0 ? upper : lower).edges.push(e);
      }
    }
    return [upper, lower, { color: BRIGHT, glow: true, edges: ringY(0, r, 36) }];
  }

  const BUILDERS = { cube: cubeGroups, tube: tubeGroups, prysm: prysmGroups,
                     pyramid: pyramidGroups, sphere: sphereGroups };
  const RADII = { cube: () => 5, tube: c => c.len / 2 + 2,
                  prysm: c => Math.max(4, c.h) + 1.5,
                  pyramid: c => c.base + 1, sphere: c => c.d / 2 + 3 };

  function build(id, cfg) {
    const radius = RADII[id](cfg);
    const groups = [ground(Math.ceil(radius), 2), ...BUILDERS[id](cfg)];
    const cy = { cube: 2, tube: cfg.size === 'M' ? 2 : 1, prysm: cfg.h / 2,
                 pyramid: cfg.base / 2, sphere: 0 }[id];
    return { groups, radius, cy };
  }

  // ---- site landscape: plot + placed structures + selection ----
  // plotPts in svg units; intents: [{structure, config, anchor:[c,r], fp:{cols,rows}, done}]
  // sel: {c0,r0,c1,r1} in cells or null

  function buildSite(plotPts, intents, sel, METER, CELLU) {
    const m = plotPts.map(p => [p[0] / METER, p[1] / METER]);
    const xs = m.map(p => p[0]), zs = m.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const z0 = Math.min(...zs), z1 = Math.max(...zs);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const X = x => x - cx, Z = z => z - cz;

    const outline = { color: GREEN, glow: true, width: 1.8, edges: [] };
    for (let i = 0; i < m.length; i++) {
      const a = m[i], b = m[(i + 1) % m.length];
      outline.edges.push([X(a[0]), 0, Z(a[1]), X(b[0]), 0, Z(b[1])]);
    }
    const grid = { color: '#16211a', width: 1, edges: [] };
    for (let gx = Math.ceil(x0 / 4) * 4; gx <= x1; gx += 4)
      grid.edges.push([X(gx), 0, Z(z0), X(gx), 0, Z(z1)]);
    for (let gz = Math.ceil(z0 / 4) * 4; gz <= z1; gz += 4)
      grid.edges.push([X(x0), 0, Z(gz), X(x1), 0, Z(gz)]);

    const groups = [grid, outline];
    const cellM = CELLU / METER;
    for (const it of intents) {
      const bx = (it.anchor[0] + it.fp.cols / 2) * cellM;
      const bz = (it.anchor[1] + it.fp.rows / 2) * cellM;
      let g = BUILDERS[it.structure](it.config);
      if (it.done) g = recolor(g, GRAY);
      groups.push(...tr(g, X(bx), Z(bz)));
    }
    if (sel) {
      const sx0 = Math.min(sel.c0, sel.c1) * cellM, sx1 = (Math.max(sel.c0, sel.c1) + 1) * cellM;
      const sz0 = Math.min(sel.r0, sel.r1) * cellM, sz1 = (Math.max(sel.r0, sel.r1) + 1) * cellM;
      groups.push({ color: CYAN, dash: [4, 3], width: 1.6,
                    edges: rectY(0.05, X(sx0), Z(sz0), X(sx1), Z(sz1)) });
    }
    const radius = Math.max(x1 - x0, z1 - z0) / 2 + 4;
    return { groups, radius, cy: 3 };
  }

  return { attach, build, buildSite, project };
})();
