// "Painted" map: one big illustration (assets/map/souq.jpg) is the whole village.
// Walkable streets, doors, labels and lantern lights are traced over it below,
// all in the picture's own pixel coordinates.
(function () {
  if ((V.cfg.map || "painted") !== "painted") return;
  const C = 16; // walk-grid cell size in picture pixels
  const IMG = { src: "assets/map/souq.jpg", w: 2000, h: 1116 };
  const NX = Math.ceil(IMG.w / C), NY = Math.ceil(IMG.h / C);

  // Open ground people can walk on.
  const walk = [
    [[795, 590], [1200, 592], [1205, 650], [1192, 780], [1110, 792], [1000, 778], [900, 772], [830, 745], [788, 690]], // fountain plaza
    [[768, 300], [862, 296], [875, 420], [862, 560], [840, 625], [780, 620], [700, 585], [690, 552], [762, 540], [768, 470]], // lane to the library
    [[852, 285], [955, 268], [962, 302], [905, 322], [860, 320]], // ochre house step
    [[1195, 592], [1305, 565], [1325, 430], [1250, 335], [1335, 330], [1425, 350], [1482, 352], [1500, 250], [1570, 250], [1582, 360], [1592, 420], [1590, 560], [1700, 575], [1702, 605], [1560, 605], [1450, 535], [1350, 548], [1262, 565], [1180, 630]], // street to the gate
    [[1100, 760], [1195, 750], [1245, 850], [1300, 862], [1420, 872], [1482, 882], [1522, 900], [1562, 932], [1502, 962], [1460, 935], [1380, 912], [1260, 902], [1200, 882], [1130, 842]], // lane to the coffee house
    [[1520, 930], [1600, 990], [1840, 1008], [1862, 1060], [1905, 1090], [1862, 1104], [1700, 1062], [1580, 1042], [1530, 990]], // below the coffee house
  ];
  const blocked = [
    [[872, 688], [1005, 612], [1140, 688], [1005, 762]], // fountain
  ];

  // Buildings: what you tap (hit), where the name floats (top), and where the door is.
  const P = [
    { id: "library", kind: "library", name: "The Library", ar: "المكتبة", icon: "📚", door: [720, 562], top: [600, 95], wall: "#efe6d2",
      hit: [[360, 280], [460, 170], [560, 110], [660, 180], [720, 40], [800, 40], [810, 470], [760, 540], [560, 560], [360, 420]] },
    { id: "post", kind: "post", name: "Post Office", ar: "البريد", icon: "✉️", door: [1010, 608], top: [1060, 250], wall: "#f2ede2",
      hit: [[915, 300], [1040, 250], [1150, 290], [1200, 320], [1310, 400], [1300, 560], [1100, 590], [1000, 590], [870, 580], [880, 420]] },
    { id: "qahwa", kind: "qahwa", name: "Coffee House", ar: "المقهى", icon: "☕", door: [1515, 925], top: [1690, 580], wall: "#f1e9d8",
      hit: [[1490, 660], [1690, 590], [1880, 700], [1870, 900], [1730, 990], [1520, 950], [1490, 900]] },
    { id: "h1", door: [930, 305], top: [910, 50], wall: "#e3a85c", hit: [[810, 90], [900, 55], [1010, 90], [1010, 280], [930, 300], [810, 260]] },
    { id: "h2", door: [1640, 595], top: [1690, 280], wall: "#f4efe6", hit: [[1585, 330], [1680, 290], [1800, 345], [1800, 560], [1690, 600], [1585, 560]] },
    { id: "h3", door: [1470, 545], top: [1450, 505], wall: "#e3a85c", hit: [[1350, 560], [1460, 520], [1550, 560], [1550, 760], [1460, 790], [1350, 750]] },
    { id: "h4", door: [1360, 905], top: [1360, 890], wall: "#e0a557", hit: [[1210, 960], [1330, 900], [1500, 960], [1500, 1116], [1210, 1116]] },
    { id: "h5", door: [1000, 790], top: [1010, 800], wall: "#f3ece0", hit: [[900, 830], [1000, 800], [1110, 845], [1110, 1000], [1000, 1045], [900, 1000]] },
    { id: "h6", door: [1890, 1085], top: [1930, 790], wall: "#f4efe6", hit: [[1850, 820], [1950, 790], [2000, 800], [2000, 1116], [1850, 1116]] },
    { id: "h7", door: [1300, 345], top: [1210, 75], wall: "#f6f1e6", hit: [[1105, 130], [1200, 85], [1320, 130], [1320, 290], [1220, 320], [1105, 280]] },
    { id: "h8", door: [1700, 595], top: [1930, 415], wall: "#efc39a", hit: [[1830, 470], [1930, 420], [2000, 440], [2000, 780], [1920, 800], [1830, 760]] },
    { id: "h9", door: [790, 700], top: [520, 540], wall: "#f3ece0", hit: [[330, 600], [480, 545], [620, 580], [760, 560], [800, 600], [820, 700], [700, 780], [600, 800], [500, 760], [330, 720]] },
  ];

  // Lanterns painted into the picture; they glow at night.
  const lanterns = [[927, 240], [1415, 240], [1605, 310], [1052, 495], [268, 546], [48, 766], [345, 921], [452, 861], [577, 796], [1497, 751], [1443, 756], [1720, 866], [1815, 836], [1733, 535]];

  const inPoly = (x, y, poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  // Positions are in grid cells; the screen is the picture itself.
  V.iso = (x, y, z = 0) => ({ x: x * C, y: y * C - z });
  V.unIso = (sx, sy) => ({ x: sx / C, y: sy / C });
  V.personScale = 1.3;

  const W = (V.world = {
    painted: true, NX, NY, bounds: { x0: 0, y0: 0, x1: IMG.w, y1: IMG.h },
    speedScale: 2.4, wanderRadius: 12, doorReach: 3, nearDist: 9,
    objects: [], lights: [], groundOrigin: { x: 0, y: 0 },
  });
  const cell = (px, py) => ({ x: Math.floor(px / C), y: Math.floor(py / C) });

  W.grid = new Uint8Array(NX * NY);
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    const px = x * C + C / 2, py = y * C + C / 2;
    W.grid[y * NX + x] = walk.some((p) => inPoly(px, py, p)) && !blocked.some((p) => inPoly(px, py, p)) ? 1 : 0;
  }
  W.walkable = (x, y) => x >= 0 && y >= 0 && x < NX && y < NY && W.grid[y * NX + x] === 1;

  W.nearestWalkable = (x, y, fromX = x, fromY = y) => {
    let best = null, bd = Infinity;
    for (let r = 1; r < 30 && !best; r++)
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r || !W.walkable(x + i, y + j)) continue;
        const d = Math.hypot(x + i - fromX, y + j - fromY) + Math.hypot(i, j) * 2;
        if (d < bd) { bd = d; best = { x: x + i, y: y + j }; }
      }
    return best;
  };
  const snap = (px, py) => { const c = cell(px, py); return W.walkable(c.x, c.y) ? c : W.nearestWalkable(c.x, c.y) || c; };

  W.places = P.map((p) => {
    const house = !p.kind;
    return Object.assign({}, p, {
      kind: p.kind || "house", name: p.name || "House " + p.id.slice(1), ar: p.ar || "بيت", icon: p.icon || "🏠",
      look: { wall: p.wall }, doorTile: snap(p.door[0], p.door[1]), doorScreen: { x: p.door[0], y: p.door[1] },
      top: { x: p.top[0], y: p.top[1] }, n: house ? +p.id.slice(1) : 0,
    });
  });
  W.place = (id) => W.places.find((p) => p.id === id);
  const front = [...W.places].sort((a, b) => Math.max(...b.hit.map((q) => q[1])) - Math.max(...a.hit.map((q) => q[1])));
  W.hitPlace = (px, py) => front.find((p) => inPoly(px, py, p.hit)) || null;

  W.spots = {
    spawn: snap(1100, 770), plaza: snap(1130, 700), fountain: cell(1005, 688),
    meet: [snap(1430, 895), snap(1490, 912)],
  };

  W.findPath = (sx, sy, tx, ty) => {
    if (!W.walkable(tx, ty)) { const a = W.nearestWalkable(tx, ty, sx, sy); if (!a) return null; tx = a.x; ty = a.y; }
    const key = (x, y) => y * NX + x;
    const open = [{ x: sx, y: sy, g: 0, f: 0 }], came = new Map(), gs = new Map([[key(sx, sy), 0]]), closed = new Set();
    const h = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
    let guard = 0;
    while (open.length && guard++ < 20000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const c = open.splice(bi, 1)[0], ck = key(c.x, c.y);
      if (c.x === tx && c.y === ty) {
        const path = [{ x: tx, y: ty }]; let k = ck;
        while (came.has(k)) { k = came.get(k); path.unshift({ x: k % NX, y: Math.floor(k / NX) }); }
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
  W.randomWalkableNear = (cx, cy, r, rnd = Math.random) => {
    for (let k = 0; k < 40; k++) {
      const x = Math.round(cx + (rnd() - 0.5) * 2 * r), y = Math.round(cy + (rnd() - 0.5) * 2 * r);
      if (W.walkable(x, y)) return { x, y };
    }
    return null;
  };

  W.ready = new Promise((res) => {
    const img = new Image();
    img.onload = () => { W.groundCanvas = img; res(); };
    img.onerror = () => { const c = document.createElement("canvas"); c.width = IMG.w; c.height = IMG.h; W.groundCanvas = c; res(); };
    img.src = IMG.src;
  });
  W.build = () => {
    W.lights = lanterns.map(([x, y]) => ({ x, y, r: 70, kind: "lantern" }));
  };
  W.assetKeys = () => {
    const keys = new Set(["avatar/idle", "avatar/working", "rooms/house"]);
    W.places.forEach((p) => keys.add("rooms/" + p.id));
    (window.VILLAGE_AGENTS || []).forEach((a) => ["idle", "working", "portrait"].forEach((s) => keys.add("agents/" + a.id + "/" + s)));
    return [...keys];
  };
})();
