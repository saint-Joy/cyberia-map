// wire3d — zero-dependency wireframe renderer (canvas 2d, perspective, auto-orbit)
// model = { groups: [{ color, dash, width, glow, edges: [[x1,y1,z1,x2,y2,z2],…] }], radius, cy }
// axes: Y up, ground at y = 0

const Wire3D = (() => {
  const GREEN = '#52e05a', DIM = '#23532a', ORANGE = '#e08a3c',
        CYAN = '#55d7e8', GRAY = '#3d4a40', BRIGHT = '#8df595';

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

  // ---- geometry helpers ----

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

  function ground(size, step) {
    const E = [], s = size;
    for (let i = -s; i <= s; i += step) E.push([i, 0, -s, i, 0, s], [-s, 0, i, s, 0, i]);
    return { color: '#141b15', edges: E, width: 1 };
  }

  function ringY(y, r, seg) {
    const E = [];
    for (let i = 0; i < seg; i++) {
      const a = i / seg * 2 * Math.PI, b = (i + 1) / seg * 2 * Math.PI;
      E.push([r * Math.cos(a), y, r * Math.sin(a), r * Math.cos(b), y, r * Math.sin(b)]);
    }
    return E;
  }

  // ---- structure builders ----

  function buildAtom(cfg) {
    const groups = [ground(7, 2), { color: GREEN, glow: true, edges: box(0, 2, 0, 4, 4, 4) }];
    if (cfg.mode === 'unit') {
      const beds = { color: ORANGE, edges: [] };
      beds.edges.push(...box(-0.8, 0.3, -0.9, 2, 0.6, 1.2));
      if (cfg.pax === 2) {
        beds.edges.push(...box(0.8, 2.3, 0.9, 2, 0.6, 1.2));
        groups.push({ color: DIM, dash: [4, 4], edges: rectY(2, -2, -2, 2, 2) });
      }
      groups.push(beds);
    }
    if (cfg.mode === 'room')
      groups.push({ color: DIM, dash: [3, 5], edges: rectY(0.02, -1.5, -1.5, 1.5, 1.5) });
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
    return { groups, radius: 5.5, cy: 2 };
  }

  function buildMolecule(cfg) {
    const gap = cfg.connector === 'direct' ? 0 : 2, pitch = 4 + gap;
    const cubes = { color: GREEN, glow: true, edges: [] };
    const conn = { color: cfg.connector === 'tube' ? CYAN : ORANGE, edges: [] };
    let maxR = 4;
    const pos = cfg.atoms.map(a => [a[0] * pitch, a[1] * pitch + 2, a[2] * pitch]);
    for (const p of pos) {
      cubes.edges.push(...box(p[0], p[1], p[2], 4, 4, 4));
      maxR = Math.max(maxR, Math.hypot(p[0], p[2]) + 4, p[1] + 2);
    }
    if (gap > 0) for (let i = 0; i < cfg.atoms.length; i++)
      for (let j = i + 1; j < cfg.atoms.length; j++) {
        const A = cfg.atoms[i], B = cfg.atoms[j];
        const d = Math.abs(A[0] - B[0]) + Math.abs(A[1] - B[1]) + Math.abs(A[2] - B[2]);
        if (d !== 1) continue;
        const m = [(pos[i][0] + pos[j][0]) / 2, (pos[i][1] + pos[j][1]) / 2, (pos[i][2] + pos[j][2]) / 2];
        const s = cfg.connector === 'tube' ? 1.6 : 2;
        const along = [Math.abs(A[0] - B[0]), Math.abs(A[1] - B[1]), Math.abs(A[2] - B[2])];
        conn.edges.push(...box(m[0], m[1], m[2],
          along[0] ? gap : s, along[1] ? gap : s, along[2] ? gap : s));
      }
    const groups = [ground(Math.ceil(maxR) + 3, 2), cubes];
    if (conn.edges.length) groups.push(conn);
    const cy = Math.max(...pos.map(p => p[1])) / 2 + 1;
    return { groups, radius: maxR + 1, cy };
  }

  function buildTube(cfg) {
    const s = cfg.size === 'M' ? 4 : 2, L = cfg.len, half = L / 2;
    const groups = [ground(half + 4, 4),
      { color: GREEN, glow: true, edges: box(0, s / 2, 0, L, s, s) }];
    const frames = { color: DIM, edges: [] };
    for (let x = -half + 2; x < half; x += 2)
      frames.edges.push([x, 0, -s / 2, x, s, -s / 2], [x, s, -s / 2, x, s, s / 2],
                        [x, s, s / 2, x, 0, s / 2], [x, 0, s / 2, x, 0, -s / 2]);
    groups.push(frames);
    const has = c => cfg.content.includes(c);
    if (has('closed pond'))
      groups.push({ color: CYAN, dash: [5, 4], edges: rectY(0.25, -half + 0.5, -s / 2 + 0.4, half - 0.5, s / 2 - 0.4) });
    if (has('glass path top'))
      groups.push({ color: CYAN, edges: [[-half, s, -s / 4, half, s, -s / 4], [-half, s, s / 4, half, s, s / 4]] });
    if (has('algae bioreactor'))
      groups.push({ color: BRIGHT, dash: [2, 3], edges: [[-half + 1, s * 0.6, 0, half - 1, s * 0.6, 0]] });
    if (has('vines')) {
      const v = { color: DIM, dash: [1, 3], edges: [] };
      for (let x = -half + 1; x < half; x += 3)
        v.edges.push([x, 0, -s / 2, x + 1, s, -s / 2], [x + 1, 0, s / 2, x, s, s / 2]);
      groups.push(v);
    }
    return { groups, radius: half + 2, cy: s / 2 };
  }

  function buildPrysm(cfg) {
    const h = cfg.h, base = 4, depth = cfg.modular ? 8 : 4, zh = depth / 2;
    const tri = z => [[-base / 2, 0, z, base / 2, 0, z],
                      [base / 2, 0, z, 0, h, z], [0, h, z, -base / 2, 0, z]];
    const groups = [ground(7, 2), { color: GREEN, glow: true, edges: [
      ...tri(-zh), ...tri(zh),
      [-base / 2, 0, -zh, -base / 2, 0, zh], [base / 2, 0, -zh, base / 2, 0, zh],
      [0, h, -zh, 0, h, zh]] }];
    if (cfg.modular) groups.push({ color: DIM, edges: tri(0) });
    if (cfg.mat.includes('glass')) {
      const i = 0.75;
      groups.push({ color: CYAN, dash: [4, 4], edges: [
        ...[[-base / 2 * i, 0.1, -zh, base / 2 * i, 0.1, -zh],
            [base / 2 * i, 0.1, -zh, 0, h * i, -zh], [0, h * i, -zh, -base / 2 * i, 0.1, -zh]]] });
    }
    if (cfg.mat.includes('wood'))
      groups.push({ color: ORANGE, edges: [[-base / 2, 0.12, -zh, -base / 2, 0.12, zh],
                                           [base / 2, 0.12, -zh, base / 2, 0.12, zh]] });
    if (cfg.mat.includes('metal'))
      groups.push({ color: GRAY, width: 2, edges: [[0, h, -zh, 0, h, zh]] });
    return { groups, radius: Math.max(zh, base) + 2, cy: h / 2 };
  }

  function buildPyramid(cfg) {
    const b = 6, h = 8;
    const groups = [ground(10, 2), { color: GREEN, glow: true, edges: [
      ...rectY(0, -b, -b, b, b),
      [-b, 0, -b, 0, h, 0], [b, 0, -b, 0, h, 0], [b, 0, b, 0, h, 0], [-b, 0, b, 0, h, 0]] }];
    const half = b * (1 - 4 / h);
    groups.push({ color: DIM, dash: [4, 4], edges: rectY(4, -half, -half, half, half) });
    const n = Math.min(cfg.fns.length, 8);
    if (n) {
      const stalls = { color: ORANGE, edges: [] };
      for (let i = 0; i < n; i++) {
        const a = i / n * 2 * Math.PI, r = b * 0.55;
        stalls.edges.push(...box(r * Math.cos(a), 0.6, r * Math.sin(a), 1.2, 1.2, 1.2));
      }
      groups.push(stalls);
    }
    return { groups, radius: b + 4, cy: h / 2 - 1 };
  }

  function buildSphere(cfg) {
    const r = 4, groups = [ground(8, 2)];
    const upper = { color: cfg.orangery ? GREEN : GRAY, glow: cfg.orangery, edges: [] };
    const lower = { color: cfg.water ? CYAN : GRAY, dash: [4, 4], edges: [] };
    for (const phi of [15, 35, 55, 75]) {
      const a = phi * Math.PI / 180;
      upper.edges.push(...ringY(r * Math.sin(a), r * Math.cos(a), 28));
      lower.edges.push(...ringY(-r * Math.sin(a), r * Math.cos(a), 28));
    }
    for (let m = 0; m < 8; m++) {
      const t = m / 8 * 2 * Math.PI, seg = 14;
      for (let i = 0; i < seg; i++) {
        const p0 = -Math.PI / 2 + i / seg * Math.PI, p1 = -Math.PI / 2 + (i + 1) / seg * Math.PI;
        const e = [r * Math.cos(p0) * Math.cos(t), r * Math.sin(p0), r * Math.cos(p0) * Math.sin(t),
                   r * Math.cos(p1) * Math.cos(t), r * Math.sin(p1), r * Math.cos(p1) * Math.sin(t)];
        ((p0 + p1) / 2 >= 0 ? upper : lower).edges.push(e);
      }
    }
    groups.push(upper, lower, { color: BRIGHT, glow: true, edges: ringY(0, r, 36) });
    return { groups, radius: r + 2.5, cy: 0 };
  }

  function build(id, cfg) {
    switch (id) {
      case 'atom':     return buildAtom(cfg);
      case 'molecule': return buildMolecule(cfg);
      case 'tube':     return buildTube(cfg);
      case 'prysm':    return buildPrysm(cfg);
      case 'pyramid':  return buildPyramid(cfg);
      case 'sphere':   return buildSphere(cfg);
    }
  }

  return { attach, build };
})();
