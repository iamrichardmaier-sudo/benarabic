// Camera, input, and the frame loop.
(function () {
  const W = V.world, AG = V.agents, UI = V.ui;
  const canvas = document.getElementById("world");
  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, dpr = 1;
  const cam = (V.cam = { x: 0, y: 0, zoom: 1, free: false });

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    cam.zoom = V.clamp(cam.zoom || (w < 600 ? 0.8 : 1), 0.45, 2);
  };
  const toScreen = (x, y) => ({ x: (x - cam.x) * cam.zoom + w / 2, y: (y - cam.y) * cam.zoom + h / 2 });
  const toWorld = (sx, sy) => ({ x: (sx - w / 2) / cam.zoom + cam.x, y: (sy - h / 2) / cam.zoom + cam.y });
  V.toScreen = toScreen;

  /* ---------- drawing ---------- */
  const staticDrawables = () => W.objects.map((o) => ({ kind: o.kind, obj: o, box: { x0: o.x, x1: o.x + o.w, y0: o.y, y1: o.y + o.h } }));
  let statics = [];
  const cmp = (a, b) => {
    const A = a.box, B = b.box, e = 1e-6;
    const aFront = A.x0 >= B.x1 - e || A.y0 >= B.y1 - e;
    const bFront = B.x0 >= A.x1 - e || B.y0 >= A.y1 - e;
    if (aFront && !bFront) return 1;
    if (bFront && !aFront) return -1;
    return A.x0 + A.x1 + A.y0 + A.y1 - (B.x0 + B.x1 + B.y0 + B.y1);
  };

  const assetRect = (o, img) => {
    const tw = (V.cfg.assetTweaks || {})[o.artOwn && V.assets.get(o.artOwn) ? o.artOwn : o.art] || {};
    const width = (((o.w + o.h) * V.TW) / 2) * 1.12 * (tw.scale || 1);
    const height = (img.height / img.width) * width;
    const cx = V.iso(o.x + o.w / 2, o.y + o.h / 2).x + (tw.dx || 0);
    const by = V.iso(o.x + o.w, o.y + o.h).y + 4 + (tw.dy || 0);
    return { x: cx - width / 2, y: by - height, w: width, h: height };
  };
  const drawStatic = (o, t) => {
    const img = (o.artOwn && V.assets.get(o.artOwn)) || (o.art && V.assets.get(o.art));
    if (img) { const r = assetRect(o, img); ctx.drawImage(img, r.x, r.y, r.w, r.h); }
    else { const A = V.iso(o.x, o.y); ctx.drawImage(o.pre.canvas, A.x - o.pre.ox, A.y - o.pre.oy); }
    if (o.kind === "fountain") drawFountainWater(t);
    if (o.kind === "qahwa") drawSmoke(V.iso(22.7, 22.7, 76), t);
  };
  const drawFountainWater = (t) => {
    const c = V.iso(18.5, 18.5, 16 + 44);
    ctx.save(); ctx.strokeStyle = "rgba(120,190,210,.85)"; ctx.lineWidth = 1.6;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, ph = (t * 0.9 + k * 0.13) % 1;
      const dx = Math.cos(a) * 22, dy = Math.sin(a) * 9;
      ctx.beginPath();
      for (let s = 0; s <= 1; s += 0.1) { const x = c.x + dx * s, y = c.y + dy * s - 14 * Math.sin(Math.PI * s * 0.9) + 26 * s * s; s ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.globalAlpha = 0.55; ctx.stroke();
      const x = c.x + dx * ph, y = c.y + dy * ph - 14 * Math.sin(Math.PI * ph * 0.9) + 26 * ph * ph;
      ctx.globalAlpha = 0.9; ctx.fillStyle = "#e9fbff"; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill();
    }
    ctx.restore();
  };
  const drawSmoke = (p, t) => {
    ctx.save();
    for (let k = 0; k < 4; k++) {
      const ph = (t * 0.25 + k / 4) % 1;
      ctx.globalAlpha = 0.35 * (1 - ph); ctx.fillStyle = "#f5efe6";
      ctx.beginPath(); ctx.arc(p.x + Math.sin(t + k) * 6 + ph * 14, p.y - ph * 60, 5 + ph * 10, 0, 7); ctx.fill();
    }
    ctx.restore();
  };

  // Text bubbles, names, "!" markers: screen space so they stay crisp.
  const pill = (x, y, text, o = {}) => {
    ctx.font = `${o.size || 14}px 'Patrick Hand', sans-serif`;
    const tw = ctx.measureText(text).width + 14, hh = (o.size || 14) + 8;
    ctx.fillStyle = o.bg || "rgba(251,241,220,.93)"; ctx.strokeStyle = V.INK; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.roundRect(x - tw / 2, y - hh, tw, hh, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = o.fg || V.INK; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText(text, x, y - 6);
  };
  const wrap = (text, max) => {
    const words = text.split(" "), lines = []; let line = "";
    words.forEach((wd) => { const tryL = line ? line + " " + wd : wd; if (ctx.measureText(tryL).width > max && line) { lines.push(line); line = wd; } else line = tryL; });
    if (line) lines.push(line);
    return lines.slice(0, 4);
  };
  const bubble = (x, y, text) => {
    ctx.font = "15px 'Patrick Hand', sans-serif";
    const lines = wrap(text, 170), lh = 17;
    const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18, bh = lines.length * lh + 10;
    const bx = V.clamp(x - bw / 2, 6, w - bw - 6), by = y - bh - 10;
    ctx.fillStyle = "#fffaf0"; ctx.strokeStyle = V.INK; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 6, by + bh - 1); ctx.lineTo(x, y - 2); ctx.lineTo(x + 6, by + bh - 1); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fffaf0"; ctx.fillRect(x - 5, by + bh - 3, 10, 3);
    ctx.fillStyle = V.INK; ctx.textAlign = "left";
    lines.forEach((l, i) => ctx.fillText(l, bx + 9, by + 18 + i * lh));
  };
  const bang = (x, y, t) => {
    const yy = y + Math.sin(t * 4) * 3;
    ctx.fillStyle = "#c4566b"; ctx.strokeStyle = V.INK; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, yy, 11, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff8ea"; ctx.font = "bold 17px 'Patrick Hand', sans-serif"; ctx.textAlign = "center"; ctx.fillText("!", x, yy + 6);
  };
  const working = (x, y, t) => {
    ctx.fillStyle = "rgba(251,241,220,.95)"; ctx.strokeStyle = V.INK; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.roundRect(x - 24, y - 16, 48, 20, 9); ctx.fill(); ctx.stroke();
    ctx.font = "13px 'Patrick Hand', sans-serif"; ctx.fillStyle = V.INK; ctx.textAlign = "left"; ctx.fillText("✎", x - 18, y - 1);
    for (let k = 0; k < 3; k++) { ctx.globalAlpha = Math.floor(t * 3) % 3 === k ? 1 : 0.3; ctx.beginPath(); ctx.arc(x + k * 7, y - 6, 2.2, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  };

  let hover = null;
  const drawOverlays = (t) => {
    const av = AG.avatar;
    // building labels near you
    W.places.forEach((p) => {
      const r = AG.residents(p.id);
      const near = Math.hypot(p.doorTile.x - av.x, p.doorTile.y - av.y) < 5;
      const s = toScreen(p.top.x, p.top.y);
      const insideNow = r.filter((a) => a.inside);
      if (insideNow.some((a) => AG.st(a.id).status === "working")) working(s.x + 4, s.y - 6, t);
      if (insideNow.some((a) => AG.hasMessage(a.id))) bang(s.x - 30, s.y - 14, t);
      if (near || hover === p) pill(s.x, s.y - 26, UI.placeTitle(p), { size: 14 });
    });
    // people
    [AG.avatar, ...AG.list].forEach((a) => {
      if (a.inside) return;
      const s = toScreen(...Object.values(V.iso(a.x, a.y)));
      const head = s.y - 52 * cam.zoom;
      if (a !== av && AG.hasMessage(a.id)) bang(s.x, head - 10, t);
      if (a.bubble && a.bubble.until > AG.now) bubble(s.x, head - (AG.hasMessage(a.id) ? 22 : 0), a.bubble.text);
      else if (a !== av && (Math.hypot(a.x - av.x, a.y - av.y) < 3.5 || hover === a)) pill(s.x, head + 2, a.data.name + (a.data.spouse && AG.byId[a.data.spouse] ? " ♥" : ""), { size: 13 });
    });
    // hearts
    AG.fx.forEach((f) => {
      const s = toScreen(f.x, f.y);
      ctx.globalAlpha = 1 - f.t / f.life; ctx.fillStyle = "#c4566b"; ctx.font = "18px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("♥", s.x + Math.sin(f.t * 5) * 4, s.y); ctx.globalAlpha = 1;
    });
  };

  let order = [];
  const occupied = () => new Set(AG.list.map((a) => a.home.id));
  const frame = (t) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const L = V.sky.light();
    ctx.fillStyle = V.mix("#d9bf8a", "#e7cf9c", L.day); ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.x, -cam.y);
    ctx.drawImage(W.groundCanvas, -W.groundOrigin.x, -W.groundOrigin.y);
    V.sky.drawGround(ctx);
    order = statics.concat(AG.drawables()).sort(cmp);
    order.forEach((d) => (d.obj ? drawStatic(d.obj, t) : d.draw(ctx, t)));
    ctx.restore();
    const occ = occupied();
    const lights = W.lights.filter((l) => l.kind !== "window" || !l.place || ["library", "post", "qahwa"].includes(l.place) || occ.has(l.place));
    V.sky.drawOverlay(ctx, w, h, toScreen, cam.zoom, lights, t);
    drawOverlays(t);
  };

  /* ---------- hit testing ---------- */
  const alphaAt = (o, wx, wy) => {
    const img = (o.artOwn && V.assets.get(o.artOwn)) || (o.art && V.assets.get(o.art));
    if (img) {
      const r = assetRect(o, img);
      if (wx < r.x || wy < r.y || wx > r.x + r.w || wy > r.y + r.h) return false;
      try { return img.getContext("2d").getImageData(Math.floor(((wx - r.x) / r.w) * img.width), Math.floor(((wy - r.y) / r.h) * img.height), 1, 1).data[3] > 30; } catch (e) { return true; }
    }
    const A = V.iso(o.x, o.y), lx = Math.floor(wx - (A.x - o.pre.ox)), ly = Math.floor(wy - (A.y - o.pre.oy));
    if (lx < 0 || ly < 0 || lx >= o.pre.canvas.width || ly >= o.pre.canvas.height) return false;
    o.pre.ctx = o.pre.ctx || o.pre.canvas.getContext("2d", { willReadFrequently: true });
    return o.pre.ctx.getImageData(lx, ly, 1, 1).data[3] > 30;
  };
  const hitTest = (sx, sy) => {
    const p = toWorld(sx, sy);
    for (const a of AG.list) {
      if (a.inside) continue;
      const s = V.iso(a.x, a.y);
      if (Math.abs(p.x - s.x) < 13 && p.y < s.y + 4 && p.y > s.y - 50) return a;
    }
    for (let i = order.length - 1; i >= 0; i--) {
      const d = order[i];
      if (!d.obj || !d.obj.place) continue;
      if (alphaAt(d.obj, p.x, p.y)) return W.place(d.obj.place);
    }
    return null;
  };

  /* ---------- input ---------- */
  const pointers = new Map();
  let drag = null, pinch = null;
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.zoom }; drag = null;
    } else drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      cam.zoom = V.clamp((pinch.z * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d, 0.45, 2);
      return;
    }
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 8) drag.moved = true;
      if (drag.moved) { cam.free = true; cam.x = drag.cx - dx / cam.zoom; cam.y = drag.cy - dy / cam.zoom; }
      return;
    }
    if (e.pointerType === "mouse") {
      hover = hitTest(e.clientX, e.clientY);
      canvas.style.cursor = hover ? "pointer" : "default";
    }
  });
  const up = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!drag || drag.moved || e.type === "pointercancel") { drag = null; return; }
    drag = null;
    V.audio.refresh();
    const hit = hitTest(e.clientX, e.clientY);
    if (hit && hit.kind) return UI.enter(hit.id);
    if (hit && hit.home) return UI.enter(hit.home.id);
    const p = toWorld(e.clientX, e.clientY), g = V.unIso(p.x, p.y);
    const tx = Math.floor(g.x), ty = Math.floor(g.y);
    if (AG.avatar.goTo(tx, ty)) { cam.free = false; tapMark = { x: tx, y: ty, t: 0 }; }
  };
  let tapMark = null;
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); cam.zoom = V.clamp(cam.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.45, 2); }, { passive: false });

  const keys = new Set();
  window.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input,select,textarea")) return;
    if (e.key === "Escape") { UI.close("roomSheet"); UI.close("placesSheet"); return; }
    if ((e.key === "e" || e.key === "E" || e.key === "Enter") && !UI.anyOpen()) {
      const p = doorNear(); if (p) { UI.enter(p.id); e.preventDefault(); } return;
    }
    keys.add(e.key.toLowerCase());
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  const doorNear = () => {
    const t = AG.avatar.tile();
    return W.places.find((p) => Math.abs(p.doorTile.x - t.x) <= 1 && Math.abs(p.doorTile.y - t.y) <= 1);
  };
  const keyMove = (dt) => {
    let sx = 0, sy = 0;
    if (keys.has("w") || keys.has("arrowup")) sy -= 1;
    if (keys.has("s") || keys.has("arrowdown")) sy += 1;
    if (keys.has("a") || keys.has("arrowleft")) sx -= 1;
    if (keys.has("d") || keys.has("arrowright")) sx += 1;
    if (!sx && !sy) return;
    // screen direction to tile direction
    let gx = sx + sy, gy = sy - sx;
    const n = Math.hypot(gx, gy); gx /= n; gy /= n;
    const a = AG.avatar, s = a.speed * dt;
    a.path = []; cam.free = false;
    const free = (x, y) => W.walkable(Math.floor(x + Math.sign(gx) * 0.25), Math.floor(y)) && W.walkable(Math.floor(x), Math.floor(y + Math.sign(gy) * 0.25)) && W.walkable(Math.floor(x), Math.floor(y));
    if (free(a.x + gx * s, a.y)) a.x += gx * s;
    if (free(a.x, a.y + gy * s)) a.y += gy * s;
    a.moving = true; a.walk += dt * a.speed * 2.6;
    if (Math.abs(gx - gy) > 0.01) a.facing = gx - gy > 0 ? 1 : -1;
  };

  /* ---------- loop ---------- */
  let last = performance.now(), hudT = 0;
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    AG.update(dt);
    keyMove(dt);
    V.sky.update(dt, w, h);
    if (!cam.free) {
      const s = AG.avatar.screen();
      cam.x += (s.x - cam.x) * Math.min(1, dt * 4);
      cam.y += (s.y - 30 - cam.y) * Math.min(1, dt * 4);
    }
    const half = (V.N * V.TW) / 2;
    cam.x = V.clamp(cam.x, -half, half); cam.y = V.clamp(cam.y, 0, V.N * V.TH);
    frame(t);
    if (tapMark) {
      tapMark.t += dt;
      const s = toScreen(...Object.values(V.iso(tapMark.x + 0.5, tapMark.y + 0.5)));
      ctx.strokeStyle = `rgba(74,50,38,${1 - tapMark.t})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, 14 * cam.zoom * (1 + tapMark.t), 7 * cam.zoom * (1 + tapMark.t), 0, 0, 7); ctx.stroke();
      if (tapMark.t > 1) tapMark = null;
    }
    hudT -= dt;
    if (hudT <= 0) {
      hudT = 1; UI.hud();
      const d = doorNear(), hint = document.getElementById("hint");
      if (d && !UI.anyOpen()) { hint.textContent = `Tap the building or press E to enter ${UI.placeTitle(d)}`; hint.style.opacity = 1; }
      if (UI.openPlace) V.room.draw(document.getElementById("roomArt"), UI.openPlace, t);
    }
    if (UI.openPlace) roomAnim(t);
    requestAnimationFrame(loop);
  };
  let roomT = 0;
  const roomAnim = (t) => { if (t - roomT > 0.12) { roomT = t; V.room.draw(document.getElementById("roomArt"), UI.openPlace, t); } };

  /* ---------- state polling ---------- */
  const poll = () => {
    const s = document.createElement("script");
    s.src = "data/state.js?t=" + Date.now();
    s.onload = () => {
      s.remove();
      const before = JSON.stringify(AG.state);
      if (JSON.stringify(window.VILLAGE_STATE) === before) return;
      AG.setState(window.VILLAGE_STATE || {}, false);
      if (UI.openPlace) UI.renderRoom();
    };
    s.onerror = () => s.remove();
    document.body.appendChild(s);
  };

  /* ---------- boot ---------- */
  const boot = () => {
    resize();
    window.addEventListener("resize", resize);
    W.build();
    statics = staticDrawables();
    AG.init();
    UI.init();
    const s = AG.avatar.screen(); cam.x = s.x; cam.y = s.y - 30;
    V.assets.load(W.assetKeys()).then(() => { if (UI.openPlace) UI.renderRoom(); });
    V.sky.fetchWeather().then(() => V.audio.refresh());
    setInterval(() => V.sky.fetchWeather().then(() => V.audio.refresh()), 15 * 60e3);
    setInterval(poll, Math.max(15, V.cfg.statePollSeconds || 60) * 1000);
    UI.fromHash();
    requestAnimationFrame(loop);
  };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(boot, boot);
})();
