// Shared helpers: iso math, seeded randomness, sketchy drawing, storage, image assets.
(function () {
  const V = (window.V = {});
  V.cfg = window.VILLAGE_CONFIG || {};
  V.TW = 64; // tile width on screen
  V.TH = 32; // tile height on screen
  V.N = 36; // map is N x N tiles
  V.INK = "#4a3226";

  V.iso = (x, y, z = 0) => ({ x: ((x - y) * V.TW) / 2, y: ((x + y) * V.TH) / 2 - z });
  V.unIso = (sx, sy) => {
    const a = sx / (V.TW / 2), b = sy / (V.TH / 2);
    return { x: (a + b) / 2, y: (b - a) / 2 };
  };
  V.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  V.lerp = (a, b, t) => a + (b - a) * t;
  V.rng = (seed) => {
    let s = seed >>> 0 || 1;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0), s / 4294967296);
  };
  V.hash = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  };
  V.pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

  // Colors
  V.rgb = (hex) => {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  V.hex = (r, g, b) => "#" + [r, g, b].map((v) => V.clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
  V.mix = (a, b, t) => {
    const A = V.rgb(a), B = V.rgb(b);
    return V.hex(V.lerp(A[0], B[0], t), V.lerp(A[1], B[1], t), V.lerp(A[2], B[2], t));
  };
  V.shade = (c, amt) => (amt < 0 ? V.mix(c, "#3a2418", -amt) : V.mix(c, "#fff6e4", amt));

  // Hand-drawn polygon: wobbly corners, a fill, a soft double ink line.
  V.sketch = (ctx, pts, fill, rnd, opt = {}) => {
    const j = opt.jitter ?? 1.2;
    const p = pts.map((q) => ({ x: q.x + (rnd() - 0.5) * j, y: q.y + (rnd() - 0.5) * j }));
    ctx.beginPath();
    p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (opt.hatch) {
      V.hatch(ctx, p, opt.hatch, rnd);
      ctx.beginPath();
      p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
    }
    if (opt.stroke === false) return;
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = opt.ink || V.INK;
    ctx.lineWidth = opt.lw ?? 1.6;
    ctx.globalAlpha = opt.alpha ?? 0.9;
    ctx.stroke();
    ctx.globalAlpha = (opt.alpha ?? 0.9) * 0.3;
    ctx.beginPath();
    p.forEach((q, i) => { const x = q.x + (rnd() - 0.5) * 1.6, y = q.y + (rnd() - 0.5) * 1.6; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  // Pencil hatching clipped to a polygon (for shaded walls).
  V.hatch = (ctx, pts, alpha, rnd) => {
    ctx.save();
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    ctx.clip();
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x0 = Math.min(...xs) - 40, x1 = Math.max(...xs) + 40, y0 = Math.min(...ys), y1 = Math.max(...ys);
    ctx.strokeStyle = V.INK; ctx.globalAlpha = alpha; ctx.lineWidth = 0.8;
    for (let x = x0; x < x1; x += 6 + rnd() * 3) {
      ctx.beginPath(); ctx.moveTo(x, y1 + 4); ctx.lineTo(x + (y1 - y0) * 0.6 + 8, y0 - 4); ctx.stroke();
    }
    ctx.restore();
  };

  V.sketchLine = (ctx, pts, rnd, opt = {}) => {
    ctx.beginPath();
    pts.forEach((q, i) => { const x = q.x + (rnd() - 0.5) * (opt.jitter ?? 1), y = q.y + (rnd() - 0.5) * (opt.jitter ?? 1); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.strokeStyle = opt.color || V.INK; ctx.lineWidth = opt.lw ?? 1.6; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.globalAlpha = opt.alpha ?? 0.9; ctx.stroke(); ctx.globalAlpha = 1;
  };

  V.ellipse = (ctx, x, y, rx, ry, fill, rnd, opt = {}) => {
    const pts = [];
    const n = opt.n || 22;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push({ x: x + Math.cos(a) * rx, y: y + Math.sin(a) * ry }); }
    V.sketch(ctx, pts, fill, rnd, opt);
  };

  // Storage that never throws.
  V.store = {
    key: "souq-village-v1",
    read() { try { return JSON.parse(localStorage.getItem(this.key)) || {}; } catch (e) { return {}; } },
    write(d) { try { localStorage.setItem(this.key, JSON.stringify(d)); } catch (e) {} },
    get(k, def) { const d = this.read(); return d[k] ?? def; },
    set(k, v) { const d = this.read(); d[k] = v; this.write(d); },
  };

  // Hand-made images. Save a PNG at village/assets/<key>.png and it replaces the drawn version.
  // Images on a pure magenta (#FF00FF) background get that background removed automatically.
  V.assets = {
    map: {},
    load(keys) {
      return Promise.all(keys.map((k) => new Promise((res) => {
        const img = new Image();
        img.onload = () => { V.assets.map[k] = V.assets.cutout(img); res(); };
        img.onerror = () => res();
        img.src = "assets/" + k + ".png";
      })));
    },
    get(k) { return V.assets.map[k] || null; },
    cutout(img) {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      try {
        const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
        if (!(p[0] > 200 && p[1] < 90 && p[2] > 200)) return c; // corner is not magenta: keep as is
        for (let i = 0; i < p.length; i += 4) {
          const r = p[i], gg = p[i + 1], b = p[i + 2];
          const m = Math.min(r, b) - gg; // how magenta this pixel is
          if (m > 110) p[i + 3] = 0;
          else if (m > 50) { p[i + 3] = Math.round(255 * (1 - (m - 50) / 60)); p[i] = Math.min(r, gg + 40); p[i + 2] = Math.min(b, gg + 40); }
        }
        g.putImageData(d, 0, 0);
      } catch (e) { /* opened from file:// — serve the folder to enable cutouts */ }
      return c;
    },
  };

  V.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
})();
