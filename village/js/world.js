// The map: places, decor, ground, and what is walkable.
(function () {
  const { N, iso } = V;
  const W = (V.world = {});

  // Buildings. door "y" = front-left wall, "x" = front-right wall.
  W.places = [
    { id: "library", kind: "library", name: "The Library", ar: "المكتبة", icon: "📚", x: 5, y: 4, w: 7, h: 6, door: "y" },
    { id: "post", kind: "post", name: "Post Office", ar: "البريد", icon: "✉️", x: 22, y: 4, w: 5, h: 4, door: "y" },
    { id: "qahwa", kind: "qahwa", name: "Coffee House", ar: "المقهى", icon: "☕", x: 22, y: 22, w: 5, h: 4, door: "y" },
    { id: "h1", x: 12, y: 4, door: "x" }, { id: "h2", x: 4, y: 12, door: "y" }, { id: "h3", x: 9, y: 12, door: "y" },
    { id: "h4", x: 28, y: 4, door: "y" }, { id: "h5", x: 22, y: 11, door: "x" }, { id: "h6", x: 28, y: 11, door: "y" },
    { id: "h7", x: 4, y: 21, door: "y" }, { id: "h8", x: 10, y: 21, door: "y" }, { id: "h9", x: 4, y: 27, door: "y" },
    { id: "h10", x: 10, y: 27, door: "y" }, { id: "h11", x: 28, y: 22, door: "y" }, { id: "h12", x: 22, y: 28, door: "y" },
  ];
  W.places.forEach((p, i) => {
    if (!p.kind) Object.assign(p, { kind: "house", w: 3, h: 3, name: "House " + p.id.slice(1), ar: "بيت", icon: "🏠", n: +p.id.slice(1) });
    p.doorTile = p.door === "y" ? { x: p.x + Math.floor(p.w / 2), y: p.y + p.h } : { x: p.x + p.w, y: p.y + Math.floor(p.h / 2) };
  });
  W.place = (id) => W.places.find((p) => p.id === id);

  const stalls = [
    [16, 3], [16, 6], [16, 9], [16, 12], [16, 23], [16, 26], [16, 29], [16, 32],
    [20, 3], [20, 6], [20, 9], [20, 12], [20, 26], [20, 29], [20, 32],
    [3, 16], [7, 16], [11, 16], [25, 16], [29, 16], [33, 16],
    [3, 20], [8, 20], [25, 20], [29, 20], [33, 20],
  ];
  const palms = [[2, 9], [14, 9], [33, 9], [26, 15], [2, 25], [15, 25], [14, 32], [31, 26], [26, 32], [33, 33], [8, 33], [29, 28], [31, 30], [2, 2], [33, 2]];
  const lanterns = [[15, 15], [21, 15], [15, 21], [21, 21], [16, 34], [20, 34], [16, 1], [8, 11], [24, 9], [24, 27], [13, 20]];
  const jars = [[13, 16], [27, 20], [8, 26], [26, 13], [31, 15], [3, 33]];
  const wells = [[30, 32]];

  W.blocked = new Uint8Array(N * N);
  W.ground = new Array(N * N).fill("sand");
  const at = (x, y) => y * N + x;
  W.walkable = (x, y) => x >= 0 && y >= 0 && x < N && y < N && !W.blocked[at(x, y)];
  W.bounds = { x0: (-N * V.TW) / 2, y0: 0, x1: (N * V.TW) / 2, y1: N * V.TH };
  W.speedScale = 1; W.wanderRadius = 5; W.doorReach = 1; W.nearDist = 4;
  W.spots = { spawn: { x: 18, y: 24 }, plaza: { x: 18, y: 23 }, fountain: { x: 18, y: 18 }, meet: [{ x: 23, y: 27 }, { x: 25, y: 27 }] };

  // Ground types
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x + 0.5 - 18.5, y + 0.5 - 18.5);
    if (d <= 4.8) W.ground[at(x, y)] = "plaza";
    else if ((x >= 17 && x <= 19) || (y >= 17 && y <= 19)) W.ground[at(x, y)] = "cobble";
    else if (x >= 28 && y >= 28 && x <= 33 && y <= 33) W.ground[at(x, y)] = "grass";
  }
  // Walls all around
  for (let i = 0; i < N; i++) [[i, 0], [0, i], [i, N - 1], [N - 1, i]].forEach(([x, y]) => (W.blocked[at(x, y)] = 1));
  const block = (x, y, w, h) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) W.blocked[at(i, j)] = 1; };
  W.places.forEach((p) => block(p.x, p.y, p.w, p.h));
  block(17, 17, 3, 3); // fountain
  [...stalls, ...palms, ...lanterns, ...jars, ...wells].forEach(([x, y]) => block(x, y, 1, 1));

  // Little packed-earth paths from each door to the nearest street.
  W.places.forEach((p) => {
    const start = p.doorTile, seen = new Map([[at(start.x, start.y), null]]), q = [start];
    while (q.length) {
      const c = q.shift(), g = W.ground[at(c.x, c.y)];
      if (g === "cobble" || g === "plaza") {
        let k = at(c.x, c.y);
        while (k != null) { if (W.ground[k] === "sand" || W.ground[k] === "grass") W.ground[k] = "path"; k = seen.get(k); }
        break;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = c.x + dx, ny = c.y + dy, k = at(nx, ny);
        if (W.walkable(nx, ny) && !seen.has(k)) { seen.set(k, at(c.x, c.y)); q.push({ x: nx, y: ny }); }
      }
    }
  });

  /* ---------- static drawables ---------- */
  const houseLook = (id) => {
    const r = V.rng(V.hash(id) + 11);
    const walls = ["#efd9b0", "#e9c79a", "#f3e6cc", "#e4b98b", "#dfc7a6", "#eed2b8", "#e8cfa0"];
    const doors = ["#2f6d73", "#7a4a2b", "#3b4a8a", "#9b3b3b", "#2c5d8a", "#5b6d2f"];
    const trims = ["#2f7a78", "#c4566b", "#3d6f9a", "#d99a2b", "#7a3b56"];
    const awn = [["#c4566b", "#f6efdf"], ["#2f7a78", "#f6efdf"], ["#d99a2b", "#f6efdf"], ["#3b4a8a", "#f2d39a"]];
    const stories = r() < 0.4 ? 2 : 1;
    return {
      wall: V.pick(r, walls), doorColor: V.pick(r, doors), trim: V.pick(r, trims), stories,
      mashrabiya: stories === 2 && r() < 0.7, awning: r() < 0.5 ? V.pick(r, awn) : null,
      dome: r() < 0.22 ? V.pick(r, ["#3f8f8a", "#c4566b", "#3d6f9a"]) : null, jar: r() < 0.5, laundry: r() < 0.35, plants: r() < 0.5,
    };
  };

  W.objects = [];
  W.lights = [];
  const add = (o) => {
    const A = iso(o.x, o.y);
    o.pre.lights.forEach((l) => W.lights.push({ x: A.x + l.x, y: A.y + l.y, r: l.r, kind: l.kind, place: o.place || null }));
    W.objects.push(o);
    return o;
  };

  W.build = () => {
    const A = V.art;
    W.objects = []; W.lights = [];
    // back walls first (with the north gate)
    add({ kind: "wall", x: 0, y: 0, w: N, h: 1, pre: A.prerender(N, 1, 150, 3, (c, r, l) => A.wallRun(c, 0, 0, N, 1, 54, r, l, { u: 16, width: 3 })) });
    add({ kind: "wall", x: 0, y: 1, w: 1, h: N - 1, pre: A.prerender(1, N - 1, 90, 4, (c, r, l) => A.wallRun(c, 0, 0, 1, N - 1, 54, r, l)) });
    add({ kind: "wall", x: 1, y: N - 1, w: N - 1, h: 1, pre: A.prerender(N - 1, 1, 40, 5, (c, r, l) => A.wallRun(c, 0, 0, N - 1, 1, 14, r, l)) });
    add({ kind: "wall", x: N - 1, y: 1, w: 1, h: N - 2, pre: A.prerender(1, N - 2, 40, 6, (c, r, l) => A.wallRun(c, 0, 0, 1, N - 2, 14, r, l)) });

    W.places.forEach((p) => {
      const seed = V.hash(p.id);
      let pre;
      if (p.kind === "library") pre = A.prerender(p.w, p.h, 240, seed, (c, r, l) => A.library(c, p.w, p.h, r, l));
      else if (p.kind === "post") pre = A.prerender(p.w, p.h, 120, seed, (c, r, l) => A.post(c, p.w, p.h, r, l));
      else if (p.kind === "qahwa") pre = A.prerender(p.w, p.h, 120, seed, (c, r, l) => A.qahwa(c, p.w, p.h, r, l));
      else { p.look = houseLook(p.id); pre = A.prerender(p.w, p.h, 140, seed, (c, r, l) => A.house(c, p.w, p.h, r, Object.assign({ door: p.door }, p.look), l)); }
      const H = p.kind === "library" ? 120 : p.kind === "house" ? (p.look.stories === 2 ? 80 : 56) + (p.look.dome ? 20 : 0) : 70;
      p.top = iso(p.x + p.w / 2, p.y + p.h / 2, H + 10);
      p.doorScreen = iso(p.doorTile.x + 0.5, p.doorTile.y + 0.5);
      p.obj = add({ kind: p.kind, place: p.id, x: p.x, y: p.y, w: p.w, h: p.h, pre, art: p.kind === "house" ? "places/house-" + (((p.n - 1) % 4) + 1) : "places/" + p.kind, artOwn: "places/" + p.id });
    });

    const fx = 17, fy = 17;
    W.fountain = add({ kind: "fountain", x: fx, y: fy, w: 3, h: 3, pre: A.prerender(3, 3, 90, 9, (c, r) => A.fountain(c, r)), art: "decor/fountain" });

    const r = V.rng(42);
    const awnings = ["#c4566b", "#2f7a78", "#d99a2b", "#3b4a8a", "#b8582f", "#6b7d3a"];
    const palettes = [["#d9452b", "#e8b13a", "#6b8e23", "#8b4513"], ["#2f7a78", "#c4566b", "#e2a93b"], ["#3b4a8a", "#d99a2b", "#f6efdf"], ["#c47a4a", "#3d6f9a", "#7a3b56"]];
    stalls.forEach(([x, y], i) => {
      const o = { goods: V.pick(r, ["spice", "pots", "cloth", "lamps", "spice"]), awning: V.pick(r, awnings), palette: V.pick(r, palettes) };
      add({ kind: "stall", x, y, w: 1, h: 1, pre: A.prerender(1, 1, 70, 100 + i, (c, rr, l) => A.stall(c, rr, o, l)), art: "decor/stall-" + o.goods });
    });
    palms.forEach(([x, y], i) => add({ kind: "palm", x, y, w: 1, h: 1, pre: A.prerender(1, 1, 140, 200 + i, (c, rr) => A.palm(c, rr)), art: "decor/palm" }));
    lanterns.forEach(([x, y], i) => add({ kind: "lantern", x, y, w: 1, h: 1, pre: A.prerender(1, 1, 90, 300 + i, (c, rr, l) => A.lantern(c, rr, l)), art: "decor/lantern" }));
    jars.forEach(([x, y], i) => add({ kind: "jars", x, y, w: 1, h: 1, pre: A.prerender(1, 1, 40, 400 + i, (c, rr) => A.jars(c, rr)), art: "decor/jars" }));
    wells.forEach(([x, y], i) => add({ kind: "well", x, y, w: 1, h: 1, pre: A.prerender(1, 1, 70, 500 + i, (c, rr) => A.well(c, rr)), art: "decor/well" }));

    W.buildGround();
  };

  W.assetKeys = () => {
    const keys = new Set(["avatar/idle", "avatar/working"]);
    W.objects.forEach((o) => { o.art && keys.add(o.art); o.artOwn && keys.add(o.artOwn); });
    W.places.forEach((p) => keys.add("rooms/" + p.id));
    ["rooms/house"].forEach((k) => keys.add(k));
    (window.VILLAGE_AGENTS || []).forEach((a) => ["idle", "working", "portrait"].forEach((s) => keys.add("agents/" + a.id + "/" + s)));
    return [...keys];
  };

  /* ---------- ground ---------- */
  W.groundOrigin = { x: 0, y: 0 };
  W.buildGround = () => {
    const M = 360;
    const c = document.createElement("canvas");
    c.width = N * V.TW + M * 2; c.height = N * V.TH + M * 2;
    const g = c.getContext("2d");
    const ox = (N * V.TW) / 2 + M, oy = M;
    W.groundOrigin = { x: ox, y: oy };
    g.translate(ox, oy);
    const rnd = V.rng(77);
    // desert beyond the walls
    g.fillStyle = "#e7cf9c"; g.fillRect(-ox, -oy, c.width, c.height);
    g.strokeStyle = "rgba(140,95,50,.18)"; g.lineWidth = 1.4;
    for (let i = 0; i < 70; i++) {
      const x = (rnd() - 0.5) * c.width, y = (rnd() - 0.2) * c.height, l = 30 + rnd() * 80;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 8, x + l, y); g.stroke();
    }
    const tileCol = { sand: "#ecd6a6", path: "#e2c38f", cobble: "#d9c7a5", plaza: "#e8dcc2", grass: "#a7b86a" };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const t = W.ground[at(x, y)];
      const pts = [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)];
      const n = rnd();
      let col = V.shade(tileCol[t], (n - 0.5) * 0.08);
      if (t === "plaza") col = (x + y) % 2 ? "#ebdfc6" : "#e2d2b2";
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath();
      g.fillStyle = col; g.fill();
      const cx = (pts[0].x + pts[2].x) / 2, cy = (pts[0].y + pts[2].y) / 2;
      if (t === "cobble") {
        for (let k = 0; k < 5; k++) {
          const sx = cx + (rnd() - 0.5) * 34, sy = cy + (rnd() - 0.5) * 14;
          g.fillStyle = V.shade("#cdb994", (rnd() - 0.5) * 0.2); g.beginPath(); g.ellipse(sx, sy, 6 + rnd() * 3, 3 + rnd() * 1.5, 0, 0, 7); g.fill();
          g.strokeStyle = "rgba(74,50,38,.35)"; g.lineWidth = 0.8; g.stroke();
        }
      } else if (t === "plaza") {
        if ((x + y) % 2 === 0) { // eight-point star tile
          g.save(); g.translate(cx, cy); g.scale(1, 0.5);
          g.fillStyle = (x * 7 + y) % 3 ? "#2f7a78" : "#3d6f9a"; g.globalAlpha = 0.55;
          g.beginPath();
          for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, rr = k % 2 ? 4 : 9; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
          g.closePath(); g.fill(); g.restore();
        }
        g.strokeStyle = "rgba(74,50,38,.15)"; g.lineWidth = 0.8; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.stroke();
      } else if (t === "grass") {
        g.strokeStyle = "rgba(70,100,40,.6)"; g.lineWidth = 1;
        for (let k = 0; k < 6; k++) { const sx = cx + (rnd() - 0.5) * 36, sy = cy + (rnd() - 0.5) * 14; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - 1.5, sy - 5); g.moveTo(sx, sy); g.lineTo(sx + 2, sy - 4); g.stroke(); }
        if (rnd() < 0.2) { g.fillStyle = V.pick(rnd, ["#e0607a", "#f2d06b", "#fff"]); g.beginPath(); g.arc(cx + (rnd() - 0.5) * 20, cy, 2, 0, 7); g.fill(); }
      } else {
        for (let k = 0; k < 4; k++) { g.fillStyle = `rgba(120,85,50,${0.12 + rnd() * 0.15})`; g.beginPath(); g.arc(cx + (rnd() - 0.5) * 40, cy + (rnd() - 0.5) * 16, 0.8 + rnd() * 1.4, 0, 7); g.fill(); }
        if (t === "path") { g.strokeStyle = "rgba(120,85,50,.18)"; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - 12, cy); g.lineTo(cx + 12, cy); g.stroke(); }
      }
    }
    // soft street edges
    g.strokeStyle = "rgba(74,50,38,.28)"; g.lineWidth = 1.4;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const t = W.ground[at(x, y)];
      if (t !== "cobble") continue;
      const nb = [[1, 0, iso(x + 1, y), iso(x + 1, y + 1)], [-1, 0, iso(x, y), iso(x, y + 1)], [0, 1, iso(x, y + 1), iso(x + 1, y + 1)], [0, -1, iso(x, y), iso(x + 1, y)]];
      nb.forEach(([dx, dy, a, b]) => {
        const o = W.ground[at(x + dx, y + dy)];
        if (o && o !== "cobble" && o !== "plaza") { g.beginPath(); g.moveTo(a.x + (rnd() - 0.5), a.y); g.lineTo(b.x, b.y + (rnd() - 0.5)); g.stroke(); }
      });
    }
    // rugs
    const rug = (x, y, w, h, c1, c2) => {
      const pts = [iso(x, y), iso(x + w, y), iso(x + w, y + h), iso(x, y + h)];
      V.sketch(g, pts, c1, rnd, { lw: 1.3 });
      const inner = [iso(x + 0.2, y + 0.2), iso(x + w - 0.2, y + 0.2), iso(x + w - 0.2, y + h - 0.2), iso(x + 0.2, y + h - 0.2)];
      V.sketch(g, inner, c2, rnd, { lw: 1 });
      const m = iso(x + w / 2, y + h / 2); g.fillStyle = c1; g.beginPath(); g.moveTo(m.x, m.y - 6); g.lineTo(m.x + 12, m.y); g.lineTo(m.x, m.y + 6); g.lineTo(m.x - 12, m.y); g.fill();
    };
    rug(22.3, 26.2, 4.4, 1.5, "#9b3b3b", "#d99a2b");
    rug(13.2, 26.4, 1.6, 2.4, "#3b4a8a", "#c4566b");
    rug(21.2, 7.3, 1.4, 2.2, "#2f7a78", "#e8c37a");
    // building shadows (sun from the upper left)
    W.objects.forEach((o) => {
      if (o.kind === "wall") return;
      const hgt = { library: 70, post: 55, qahwa: 50, house: 55, palm: 30, stall: 20, lantern: 10, fountain: 10, jars: 6, well: 12 }[o.kind] || 20;
      const s = hgt / 60;
      const pts = [iso(o.x + o.w, o.y), iso(o.x + o.w + s, o.y + s * 0.3), iso(o.x + o.w + s, o.y + o.h + s * 0.3), iso(o.x + s * 0.3, o.y + o.h + s * 0.3), iso(o.x, o.y + o.h)];
      g.fillStyle = "rgba(90,55,30,.16)"; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fill();
    });
    // paper grain
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(80,50,30,${rnd() * 0.05})`; g.fillRect((rnd() - 0.5) * c.width, rnd() * c.height - oy, 1.5, 1.5); }
    W.groundCanvas = c;
  };

  // A* over the tile grid (8 directions, no corner cutting).
  W.findPath = (sx, sy, tx, ty) => {
    if (!W.walkable(tx, ty)) {
      const alt = W.nearestWalkable(tx, ty, sx, sy);
      if (!alt) return null;
      tx = alt.x; ty = alt.y;
    }
    const key = (x, y) => y * N + x;
    const open = [{ x: sx, y: sy, g: 0, f: 0 }], came = new Map(), gs = new Map([[key(sx, sy), 0]]), closed = new Set();
    const h = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const c = open.splice(bi, 1)[0], ck = key(c.x, c.y);
      if (c.x === tx && c.y === ty) {
        const path = [{ x: tx, y: ty }]; let k = ck;
        while (came.has(k)) { k = came.get(k); path.unshift({ x: k % N, y: Math.floor(k / N) }); }
        path.shift();
        return path;
      }
      if (closed.has(ck)) continue; closed.add(ck);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const nx = c.x + dx, ny = c.y + dy;
        if (!W.walkable(nx, ny)) continue;
        if (dx && dy && (!W.walkable(c.x + dx, c.y) || !W.walkable(c.x, c.y + dy))) continue;
        const ng = c.g + (dx && dy ? 1.41 : 1), nk = key(nx, ny);
        if (ng < (gs.get(nk) ?? Infinity)) { gs.set(nk, ng); came.set(nk, ck); open.push({ x: nx, y: ny, g: ng, f: ng + h(nx, ny) }); }
      }
    }
    return null;
  };
  W.nearestWalkable = (x, y, fromX = x, fromY = y) => {
    let best = null, bd = Infinity;
    for (let r = 1; r < 8 && !best; r++)
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r || !W.walkable(x + i, y + j)) continue;
        const d = Math.hypot(x + i - fromX, y + j - fromY);
        if (d < bd) { bd = d; best = { x: x + i, y: y + j }; }
      }
    return best;
  };
  W.randomWalkableNear = (cx, cy, r, rnd = Math.random) => {
    for (let k = 0; k < 30; k++) {
      const x = Math.round(cx + (rnd() - 0.5) * 2 * r), y = Math.round(cy + (rnd() - 0.5) * 2 * r);
      if (W.walkable(x, y)) return { x, y };
    }
    return null;
  };
})();
