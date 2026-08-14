// wire3d — zero-dependency wireframe renderer (canvas 2d, perspective, auto-orbit)
// model = { groups: [{ color, dash, width, glow, edges: [[x1,y1,z1,x2,y2,z2],…] }], radius, cy }
// axes: Y up, ground at y = 0. all solids are canonical: cube, prism, pyramid, sphere.

const Wire3D = (() => {
  const GREEN = '#52e05a', DIM = '#23532a', ORANGE = '#e08a3c',
        CYAN = '#55d7e8', GRAY = '#6b756d', BRIGHT = '#8df595';
  const MATCOL = { wood: ORANGE, glass: CYAN, metal: GRAY };

  function attach(canvas) {
    const ctx = canvas.getContext('2d');
    let model = null, angle = 0.8, last = 0;

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
      const r = model.radius, cy = model.cy || 0;
      const ca = Math.cos(angle), sa = Math.sin(angle);
      const tilt = 0.5, cT = Math.cos(tilt), sT = Math.sin(tilt);
      const f = r * 4.2, scale = Math.min(w, h) / (r * 2.7);
      const ox = w / 2, oy = h * 0.55;

      function proj(x, y, z) {
        const y0 = y - cy;
        const X = x * ca - z * sa, Z = x * sa + z * ca;
        const Y = y0 * cT - Z * sT, Zc = y0 * sT + Z * cT;
        const p = f / (f + Zc);
        return [ox + X * scale * p, oy - Y * scale * p];
      }

      for (const g of model.groups) {
        ctx.strokeStyle = g.color;
        ctx.lineWidth = (g.width || 1.4) * dpr;
        ctx.setLineDash(g.dash ? g.dash.map(d => d * dpr) : []);
        ctx.shadowBlur = (g.glow ? 9 : 0) * dpr;
        ctx.shadowColor = g.color;
        ctx.beginPath();
        for (const e of g.edges) {
          const a = proj(e[0], e[1], e[2]), b = proj(e[3], e[4], e[5]);
          ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]); ctx.shadowBlur = 0;
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

  function cubeGroups(cfg) {
    const groups = [{ color: GREEN, glow: true, edges: box(0, 2, 0, 4, 4, 4) }];
    if (cfg.mode === 'wallgrid') {
      const lat = { color: DIM, dash: [2, 4], edges: [] };
      for (let i = -1; i <= 1; i++) lat.edges.push([i, 0.02, -2, i, 0.02, 2], [-2, 0.02, i, 2, 0.02, i]);
      groups.push(lat);
      const walls = { color: BRIGHT, edges: [] };
      for (const key of cfg.walls) {
        const [r, c] = key.split(',').map(Number);
        walls.edges.push(...box(c - 1.5, 2, r - 1.5, 1, 4, 1));
      }
      if (walls.edges.length) groups.push(walls);
    }
    return groups;
  }

  function tubeGroups(cfg) {
    const s = cfg.size === 'M' ? 4 : 2, L = cfg.len, half = L / 2;
    const groups = [{ color: GREEN, glow: true, edges: box(0, s / 2, 0, L, s, s) }];
    const frames = { color: DIM, edges: [] };
    for (let x = -half + 2; x < half; x += 2)
      frames.edges.push([x, 0, -s / 2, x, s, -s / 2], [x, s, -s / 2, x, s, s / 2],
                        [x, s, s / 2, x, 0, s / 2], [x, 0, s / 2, x, 0, -s / 2]);
    groups.push(frames);
    if (cfg.content.includes('closed pond'))
      groups.push({ color: CYAN, dash: [5, 4],
                    edges: rectY(0.25, -half + 0.5, -s / 2 + 0.4, half - 0.5, s / 2 - 0.4) });
    return groups;
  }

  function prysmGroups(cfg) {
    const h = cfg.h, base = 4, depth = cfg.modular ? 8 : 4, zh = depth / 2;
    const color = cfg.mat.length === 1 ? MATCOL[cfg.mat[0]] : GREEN;
    const tri = z => [[-base / 2, 0, z, base / 2, 0, z],
                      [base / 2, 0, z, 0, h, z], [0, h, z, -base / 2, 0, z]];
    const groups = [{ color, glow: true, edges: [
      ...tri(-zh), ...tri(zh),
      [-base / 2, 0, -zh, -base / 2, 0, zh], [base / 2, 0, -zh, base / 2, 0, zh],
      [0, h, -zh, 0, h, zh]] }];
    if (cfg.modular) groups.push({ color: DIM, edges: tri(0) });
    return groups;
  }

  function pyramidGroups(cfg) {
    const b = cfg.base / 2, h = cfg.base * 2 / 3;
    const groups = [{ color: GREEN, glow: true, edges: [
      ...rectY(0, -b, -b, b, b),
      [-b, 0, -b, 0, h, 0], [b, 0, -b, 0, h, 0], [b, 0, b, 0, h, 0], [-b, 0, b, 0, h, 0]] }];
    const half = b / 2;
    groups.push({ color: DIM, dash: [4, 4], edges: rectY(h / 2, -half, -half, half, half) });
    return groups;
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
  const RADII = { cube: () => 5.5, tube: c => c.len / 2 + 2, prysm: () => 6,
                  pyramid: c => c.base * 0.8 + 2, sphere: c => c.d / 2 + 2.5 };

  function build(id, cfg) {
    const radius = RADII[id](cfg);
    const groups = [ground(Math.ceil(radius), 2), ...BUILDERS[id](cfg)];
    const cy = { cube: 2, tube: cfg.size === 'M' ? 2 : 1, prysm: cfg.h / 2,
                 pyramid: cfg.base / 4, sphere: 0 }[id];
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

  return { attach, build, buildSite };
})();
