// Procedural hand-drawn art. Every building and person is drawn here until a real image
// (see ART_PROMPTS.md) is saved under assets/, which then takes over.
(function () {
  const { iso, sketch, ellipse, shade, mix } = V;
  const A = (V.art = {});

  // A face of a box, addressed by (u along the wall, z up, d outward).
  A.faceX = (bx, by, bw, bh) => ({ len: bh, at: (u, z, d = 0) => iso(bx + bw + d, by + u, z), axis: "x" });
  A.faceY = (bx, by, bw, bh) => ({ len: bw, at: (u, z, d = 0) => iso(bx + u, by + bh + d, z), axis: "y" });

  A.box = (ctx, x, y, w, h, z0, z1, col, rnd, opt = {}) => {
    const top = [iso(x, y, z1), iso(x + w, y, z1), iso(x + w, y + h, z1), iso(x, y + h, z1)];
    const right = [iso(x + w, y, z0), iso(x + w, y + h, z0), iso(x + w, y + h, z1), iso(x + w, y, z1)];
    const left = [iso(x, y + h, z0), iso(x + w, y + h, z0), iso(x + w, y + h, z1), iso(x, y + h, z1)];
    sketch(ctx, left, col.left, rnd, { hatch: opt.hatchLeft });
    sketch(ctx, right, col.right, rnd, { hatch: opt.hatchRight ?? 0.1 });
    if (!opt.noTop) sketch(ctx, top, col.top, rnd);
  };
  A.wallColors = (c) => ({ top: shade(c, 0.12), left: shade(c, 0.02), right: shade(c, -0.16) });

  // Arched opening on a face: u = center, w = width in tiles, z0 = sill, h = height in px.
  A.archPts = (face, u, w, z0, h, d = 0) => {
    const r = w / 2, rz = r * 34, pts = [];
    pts.push(face.at(u - r, z0, d));
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI - (i / 10) * Math.PI;
      pts.push(face.at(u + Math.cos(a) * r, z0 + h - rz + Math.sin(a) * rz, d));
    }
    pts.push(face.at(u + r, z0, d));
    return pts;
  };
  A.arch = (ctx, face, u, w, z0, h, fill, rnd, opt = {}) => {
    if (opt.frame) sketch(ctx, A.archPts(face, u, w + 0.12, z0 - 2, h + 5), opt.frame, rnd, { lw: 1.2 });
    sketch(ctx, A.archPts(face, u, w, z0, h), fill, rnd, { lw: 1.4 });
  };

  A.window = (ctx, face, u, z0, rnd, lights, o = {}) => {
    const w = o.w ?? 0.36, h = o.h ?? 24;
    A.arch(ctx, face, u, w, z0, h, o.fill || "#3d2f3c", rnd, { frame: o.frame || "#f6ead0" });
    // little lattice
    ctx.save(); ctx.strokeStyle = "#c9a36a"; ctx.lineWidth = 0.9; ctx.globalAlpha = 0.7;
    const a = face.at(u, z0 + 2), b = face.at(u, z0 + h - 4);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    const c = face.at(u - w / 2 + 0.03, z0 + h * 0.45), d = face.at(u + w / 2 - 0.03, z0 + h * 0.45);
    ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke(); ctx.restore();
    // sill
    const s0 = face.at(u - w / 2 - 0.05, z0 - 1, 0.06), s1 = face.at(u + w / 2 + 0.05, z0 - 1, 0.06);
    V.sketchLine(ctx, [s0, s1], rnd, { lw: 2.4, color: "#a77a4f" });
    if (o.plant) { const p = face.at(u, z0 + 3, 0.12); ellipse(ctx, p.x - 3, p.y - 3, 4, 3, "#6f9a4a", rnd, { lw: 1 }); ellipse(ctx, p.x + 3, p.y - 4, 4, 3, "#86ad55", rnd, { lw: 1 }); ellipse(ctx, p.x + 1, p.y - 7, 2, 2, "#e0607a", rnd, { lw: 0.8 }); }
    const m = face.at(u, z0 + h * 0.5);
    lights && lights.push({ x: m.x, y: m.y, r: 30, kind: "window" });
  };

  A.door = (ctx, face, u, rnd, o = {}) => {
    const w = o.w ?? 0.5, h = o.h ?? 36;
    A.arch(ctx, face, u, w, 0, h, o.color || "#7a4a2b", rnd, { frame: o.frame || "#f3e3c2" });
    // planks and studs
    ctx.save(); ctx.strokeStyle = "rgba(40,24,14,.45)"; ctx.lineWidth = 0.8;
    for (let i = 1; i < 4; i++) { const uu = u - w / 2 + (w * i) / 4; const a = face.at(uu, 1), b = face.at(uu, h - 10); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    ctx.fillStyle = "#e2b64f";
    const k = face.at(u + w * 0.25, h * 0.42); ctx.beginPath(); ctx.arc(k.x, k.y, 1.8, 0, 7); ctx.fill();
    ctx.restore();
    // step
    const s = [face.at(u - w / 2 - 0.1, 0, 0), face.at(u + w / 2 + 0.1, 0, 0), face.at(u + w / 2 + 0.1, 0, 0.22), face.at(u - w / 2 - 0.1, 0, 0.22)];
    sketch(ctx, s, "#d9c29a", rnd, { lw: 1 });
  };

  A.awning = (ctx, face, u0, u1, z, depth, colors, rnd) => {
    const n = Math.max(3, Math.round((u1 - u0) * 6));
    for (let i = 0; i < n; i++) {
      const a = u0 + ((u1 - u0) * i) / n, b = u0 + ((u1 - u0) * (i + 1)) / n;
      const pts = [face.at(a, z), face.at(b, z), face.at(b, z - 14, depth), face.at(a, z - 14, depth)];
      sketch(ctx, pts, colors[i % colors.length], rnd, { lw: 1, alpha: 0.6, jitter: 0.6 });
    }
    // scalloped edge
    for (let i = 0; i < n; i++) {
      const m = face.at(u0 + ((u1 - u0) * (i + 0.5)) / n, z - 14, depth);
      ctx.beginPath(); ctx.arc(m.x, m.y, 3.2, 0, Math.PI); ctx.fillStyle = colors[i % colors.length]; ctx.fill();
      ctx.strokeStyle = V.INK; ctx.globalAlpha = 0.5; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
    }
  };

  // Dome sitting on a round drum. (cx, cy) = screen center of the drum base.
  A.dome = (ctx, cx, cy, r, drumH, domeH, col, rnd, o = {}) => {
    const ry = r / 2;
    if (drumH > 0) {
      const side = [];
      for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI; side.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * ry }); }
      for (let i = 16; i >= 0; i--) { const a = (i / 16) * Math.PI; side.push({ x: cx + Math.cos(a) * r, y: cy - drumH + Math.sin(a) * ry }); }
      sketch(ctx, side, o.drum || "#e9d6ae", rnd, { hatch: 0.06 });
      // drum windows
      for (let k = 0; k < 5; k++) {
        const a = 0.35 + (k / 4) * (Math.PI - 0.7);
        const wx = cx + Math.cos(a) * r * 0.92, wy = cy + Math.sin(a) * ry * 0.92 - drumH * 0.55;
        ctx.fillStyle = "#3d2f3c"; ctx.beginPath(); ctx.ellipse(wx, wy, 2.6 * Math.sin(a) + 0.8, drumH * 0.22, 0, 0, 7); ctx.fill();
        o.lights && o.lights.push({ x: wx, y: wy, r: 18, kind: "window" });
      }
    }
    const by = cy - drumH, pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, a = Math.PI * t;
      const x = cx - Math.cos(a) * r;
      const lift = Math.pow(Math.sin(a), 0.85) * domeH;
      pts.push({ x, y: by - lift + Math.sin(a) * 0 });
    }
    for (let i = 24; i >= 0; i--) { const a = (i / 24) * Math.PI; pts.push({ x: cx - Math.cos(a) * r, y: by + Math.sin(a) * ry * 0.9 }); }
    sketch(ctx, pts, col, rnd);
    // tile ribs + highlight
    ctx.save(); ctx.strokeStyle = shade(col, -0.25); ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
    for (let k = -3; k <= 3; k++) {
      ctx.beginPath(); ctx.moveTo(cx + (k / 4) * r, by + ry * 0.85 * Math.cos((k / 4) * 1.2));
      ctx.quadraticCurveTo(cx + (k / 4) * r * 0.9, by - domeH * 0.7, cx, by - domeH); ctx.stroke();
    }
    ctx.globalAlpha = 0.35; ctx.fillStyle = "#fff8e8";
    ctx.beginPath(); ctx.ellipse(cx - r * 0.35, by - domeH * 0.55, r * 0.12, domeH * 0.22, -0.4, 0, 7); ctx.fill();
    ctx.restore();
    // finial
    V.sketchLine(ctx, [{ x: cx, y: by - domeH }, { x: cx, y: by - domeH - 12 }], rnd, { color: "#b8862f", lw: 2 });
    ctx.fillStyle = "#e2b64f"; ctx.beginPath(); ctx.arc(cx, by - domeH - 13, 3, 0, 7); ctx.fill();
  };

  A.plaque = (ctx, face, u, z, text, rnd, o = {}) => {
    const w = o.w ?? 0.9;
    const pts = [face.at(u - w / 2, z), face.at(u + w / 2, z), face.at(u + w / 2, z + 13), face.at(u - w / 2, z + 13)];
    sketch(ctx, pts, o.bg || "#2f7a78", rnd, { lw: 1.2 });
    const m = face.at(u, z + 6.5);
    ctx.save(); ctx.translate(m.x, m.y);
    ctx.transform(1, face.axis === "x" ? -0.5 : 0.5, 0, 1, 0, 0);
    ctx.fillStyle = o.fg || "#f8e7bf"; ctx.font = "bold 10px Amiri, serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, 0, 1); ctx.restore();
  };

  A.parapet = (ctx, x, y, w, h, z, col, rnd) => {
    // flat roof with a raised rim
    const i = 0.16;
    sketch(ctx, [iso(x + i, y + i, z), iso(x + w - i, y + i, z), iso(x + w - i, y + h - i, z), iso(x + i, y + h - i, z)], shade(col, -0.22), rnd, { lw: 1.1, alpha: 0.6 });
  };

  A.crenels = (ctx, face, len, z, col, rnd, step = 0.5) => {
    for (let u = 0.05; u < len - 0.2; u += step) {
      const pts = [face.at(u, z), face.at(u + step * 0.55, z), face.at(u + step * 0.55, z + 8), face.at(u, z + 8)];
      sketch(ctx, pts, col, rnd, { lw: 1, jitter: 0.6 });
    }
  };

  /* ---------- buildings ---------- */

  A.house = (ctx, w, h, rnd, o, lights) => {
    const H = o.stories === 2 ? 80 : 56;
    const wall = o.wall;
    A.box(ctx, 0, 0, w, h, 0, H, A.wallColors(wall), rnd);
    A.parapet(ctx, 0, 0, w, h, H, wall, rnd);
    const fx = A.faceX(0, 0, w, h), fy = A.faceY(0, 0, w, h);
    // painted band under the roof
    [fx, fy].forEach((f) => V.sketchLine(ctx, [f.at(0.05, H - 7), f.at(f.len - 0.05, H - 7)], rnd, { color: o.trim, lw: 3, alpha: 0.75 }));
    const doorFace = o.door === "x" ? fx : fy, other = doorFace === fx ? fy : fx;
    const du = doorFace.len / 2;
    A.door(ctx, doorFace, du, rnd, { color: o.doorColor, frame: shade(wall, 0.35) });
    if (o.awning) A.awning(ctx, doorFace, du - 0.55, du + 0.55, 46, 0.45, o.awning, rnd);
    else A.window(ctx, doorFace, du, 44, rnd, lights, { w: 0.3, h: 12, frame: shade(wall, 0.3) });
    // windows
    for (const f of [doorFace, other]) {
      const spots = f === doorFace ? [0.55, f.len - 0.55] : [f.len * 0.3, f.len * 0.7];
      spots.forEach((u, i) => A.window(ctx, f, u, 20, rnd, lights, { plant: rnd() < 0.4, frame: shade(wall, 0.3) }));
      if (o.stories === 2) spots.forEach((u) => A.window(ctx, f, u, 52, rnd, lights, { frame: shade(wall, 0.3) }));
    }
    if (o.stories === 2 && o.mashrabiya) {
      const f = other, u = f.len / 2;
      const bx = f === fx ? [w, u - 0.35, 0.22, 0.7] : [u - 0.35, h, 0.7, 0.22];
      A.box(ctx, bx[0], bx[1], bx[2], bx[3], 44, 70, A.wallColors("#8a5a36"), rnd);
      ctx.save(); ctx.strokeStyle = "#e6c98f"; ctx.globalAlpha = 0.55; ctx.lineWidth = 0.7;
      for (let k = 1; k < 6; k++) { const a = f.at(u - 0.35 + k * 0.12, 46, 0.22), b = f.at(u - 0.35 + k * 0.12, 68, 0.22); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      ctx.restore();
    }
    // roof life
    const c = iso(w / 2, h / 2, H);
    if (o.dome) A.dome(ctx, c.x, c.y + 4, 15, 4, 16, o.dome, rnd, { lights });
    if (o.jar) { const p = iso(0.6, 0.7, H); ellipse(ctx, p.x, p.y - 7, 6, 8, "#c47a4a", rnd, { lw: 1.1 }); ellipse(ctx, p.x, p.y - 15, 3, 1.5, "#8d4f2c", rnd, { lw: 0.8 }); }
    if (o.laundry) {
      const a = iso(0.4, h - 0.5, H + 22), b = iso(w - 0.4, 0.5, H + 22);
      [iso(0.4, h - 0.5, H), iso(w - 0.4, 0.5, H)].forEach((p, i) => V.sketchLine(ctx, [p, i ? b : a], rnd, { lw: 1.4, color: "#6d4b33" }));
      ctx.strokeStyle = "rgba(60,40,30,.6)"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 6, b.x, b.y); ctx.stroke();
      ["#e0607a", "#f2d06b", "#5fa0c8"].forEach((cl, i) => {
        const t = 0.25 + i * 0.25, x = V.lerp(a.x, b.x, t), y = V.lerp(a.y, b.y, t) + 5 * Math.sin(Math.PI * t);
        sketch(ctx, [{ x: x - 4, y }, { x: x + 4, y }, { x: x + 3, y: y + 11 }, { x: x - 3, y: y + 11 }], cl, rnd, { lw: 0.8 });
      });
    }
    if (o.plants) { const p = iso(w - 0.5, h - 0.5, H); ellipse(ctx, p.x, p.y - 6, 7, 5, "#5d8c45", rnd, { lw: 1 }); ellipse(ctx, p.x - 3, p.y - 10, 5, 4, "#77a352", rnd, { lw: 1 }); }
    return H;
  };

  A.library = (ctx, w, h, rnd, lights) => {
    const H = 76, wall = "#ead6ac";
    // minaret-style reading tower at the back corner
    A.box(ctx, 0.2, 0.2, 1.3, 1.3, 0, 156, A.wallColors("#e3cc9c"), rnd);
    const tf = A.faceY(0.2, 0.2, 1.3, 1.3), tx = A.faceX(0.2, 0.2, 1.3, 1.3);
    A.window(ctx, tf, 0.65, 116, rnd, lights, { w: 0.3, h: 18 });
    A.window(ctx, tx, 0.65, 116, rnd, lights, { w: 0.3, h: 18 });
    A.box(ctx, 0.05, 0.05, 1.6, 1.6, 140, 146, A.wallColors("#c9a46b"), rnd);
    const tt = iso(0.85, 0.85, 146); A.dome(ctx, tt.x, tt.y, 20, 6, 22, "#3f8f8a", rnd, { lights });
    // main hall
    A.box(ctx, 0, 0, w, h, 0, H, A.wallColors(wall), rnd);
    A.parapet(ctx, 0, 0, w, h, H, wall, rnd);
    const fx = A.faceX(0, 0, w, h), fy = A.faceY(0, 0, w, h);
    A.crenels(ctx, fy, w, H, shade(wall, 0.05), rnd);
    A.crenels(ctx, fx, h, H, shade(wall, -0.12), rnd);
    // blue tile band
    [fx, fy].forEach((f) => {
      const pts = [f.at(0, H - 16), f.at(f.len, H - 16), f.at(f.len, H - 9), f.at(0, H - 9)];
      sketch(ctx, pts, "#3d6f9a", rnd, { lw: 1 });
      for (let u = 0.15; u < f.len; u += 0.3) { const p = f.at(u, H - 12.5); ctx.fillStyle = "#f3e2b4"; ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, 7); ctx.fill(); }
    });
    // arcade of windows
    for (let u = 0.7; u < w - 0.4; u += 1.1) if (Math.abs(u - w / 2) > 0.8) A.window(ctx, fy, u, 18, rnd, lights, { w: 0.45, h: 34 });
    for (let u = 0.7; u < h - 0.4; u += 1.1) A.window(ctx, fx, u, 18, rnd, lights, { w: 0.45, h: 34 });
    // grand door
    A.arch(ctx, fy, w / 2, 1.4, 0, 62, "#f1dfb6", rnd);
    A.door(ctx, fy, w / 2, rnd, { w: 0.95, h: 50, color: "#2f6d73", frame: "#d9b26f" });
    A.plaque(ctx, fy, w / 2, 60, "المكتبة", rnd, { w: 1.1, bg: "#3d6f9a" });
    // lanterns by the door
    [-0.85, 0.85].forEach((d) => {
      const p = fy.at(w / 2 + d, 40, 0.1);
      ctx.fillStyle = "#b8862f"; ctx.fillRect(p.x - 3, p.y - 8, 6, 10);
      ctx.fillStyle = "#ffd77a"; ctx.fillRect(p.x - 2, p.y - 6, 4, 6);
      lights.push({ x: p.x, y: p.y - 3, r: 46, kind: "lantern" });
    });
    // great dome
    const c = iso(w / 2 + 0.3, h / 2, H);
    A.dome(ctx, c.x, c.y + 6, 62, 16, 60, "#3f8f8a", rnd, { lights, drum: "#ead6ac" });
    // steps
    for (let s = 0; s < 2; s++) A.box(ctx, w / 2 - 1 + s * 0.1, h + s * 0.2, 2 - s * 0.2, 0.2, 0, 6 - s * 3, A.wallColors("#dcc59a"), rnd, { hatchRight: 0 });
    return H + 160;
  };

  A.post = (ctx, w, h, rnd, lights) => {
    const H = 60, wall = "#f0dcb4";
    A.box(ctx, 0, 0, w, h, 0, H, A.wallColors(wall), rnd);
    A.parapet(ctx, 0, 0, w, h, H, wall, rnd);
    const fx = A.faceX(0, 0, w, h), fy = A.faceY(0, 0, w, h);
    [fx, fy].forEach((f) => V.sketchLine(ctx, [f.at(0.05, H - 7), f.at(f.len - 0.05, H - 7)], rnd, { color: "#2c5d8a", lw: 3, alpha: 0.8 }));
    A.door(ctx, fy, w / 2, rnd, { w: 0.7, h: 40, color: "#2c5d8a", frame: "#f7ead0" });
    A.awning(ctx, fy, w / 2 - 1.1, w / 2 + 1.1, 50, 0.55, ["#2c5d8a", "#f6efdf"], rnd);
    [0.6, w - 0.6].forEach((u) => A.window(ctx, fy, u, 18, rnd, lights));
    [0.8, h / 2, h - 0.8].forEach((u) => A.window(ctx, fx, u, 18, rnd, lights));
    A.plaque(ctx, fx, h / 2, 42, "البريد", rnd, { w: 1, bg: "#2c5d8a" });
    // pigeon loft on the roof
    A.box(ctx, 0.8, 0.8, 1.2, 1, H, H + 18, A.wallColors("#9a6b44"), rnd);
    const r1 = iso(0.8, 0.8, H + 26), r2 = iso(2.0, 0.8, H + 18), r3 = iso(2.0, 1.8, H + 18), r4 = iso(0.8, 1.8, H + 26);
    sketch(ctx, [iso(0.8, 0.8, H + 18), r2, r3, iso(0.8, 1.8, H + 18), r4, r1], "#b8582f", rnd, { lw: 1.1 });
    [[1.2, 1.9, H + 10], [1.6, 1.9, H + 12]].forEach(([x, y, z]) => { const p = iso(x, y, z); ctx.fillStyle = "#2c2124"; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, 7); ctx.fill(); });
    // pigeons
    [[2.6, 0.4], [3.1, 0.6], [3.5, 1.4]].forEach(([x, y]) => { const p = iso(x, y, H); ellipse(ctx, p.x, p.y - 3, 4, 3, "#c9c4c9", rnd, { lw: 0.9 }); ctx.fillStyle = "#8b8590"; ctx.beginPath(); ctx.arc(p.x + 3, p.y - 6, 2, 0, 7); ctx.fill(); });
    // mailbox by the door
    A.box(ctx, w / 2 + 1.25, h + 0.1, 0.3, 0.3, 0, 26, A.wallColors("#2c5d8a"), rnd);
    const top = iso(w / 2 + 1.4, h + 0.25, 30); ellipse(ctx, top.x, top.y, 8, 4, "#3a6ea0", rnd, { lw: 1 });
    return H + 30;
  };

  A.qahwa = (ctx, w, h, rnd, lights) => {
    const H = 54, wall = "#e6b98a";
    A.box(ctx, 0, 0, w, h, 0, H, A.wallColors(wall), rnd);
    A.parapet(ctx, 0, 0, w, h, H, wall, rnd);
    const fx = A.faceX(0, 0, w, h), fy = A.faceY(0, 0, w, h);
    // open arcade with warm interior
    [w * 0.2, w * 0.5, w * 0.8].forEach((u) => {
      A.arch(ctx, fy, u, 0.85, 0, 40, "#5a3424", rnd, { frame: "#f6dfb8" });
      const glow = fy.at(u, 16);
      const g = ctx.createRadialGradient(glow.x, glow.y, 2, glow.x, glow.y, 20);
      g.addColorStop(0, "rgba(255,190,90,.75)"); g.addColorStop(1, "rgba(255,190,90,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(glow.x, glow.y, 20, 0, 7); ctx.fill();
      lights.push({ x: glow.x, y: glow.y, r: 46, kind: "window" });
      // hanging lantern
      const l = fy.at(u, 30, 0.02); V.sketchLine(ctx, [fy.at(u, 40 - 3), l], rnd, { lw: 0.8 });
      ctx.fillStyle = "#e2a93b"; ctx.beginPath(); ctx.arc(l.x, l.y + 3, 3, 0, 7); ctx.fill();
    });
    A.door(ctx, fx, h / 2, rnd, { color: "#7a3b2b" });
    [0.6, h - 0.6].forEach((u) => A.window(ctx, fx, u, 20, rnd, lights));
    A.awning(ctx, fy, 0.1, w - 0.1, 50, 0.6, ["#c4566b", "#f6efdf", "#2f7a78", "#f6efdf"], rnd);
    A.plaque(ctx, fx, h / 2, 44, "قهوة", rnd, { w: 0.9, bg: "#7a3b2b" });
    const c = iso(w * 0.7, h * 0.4, H);
    A.dome(ctx, c.x, c.y + 3, 18, 4, 18, "#c4566b", rnd, { lights });
    // chimney with coffee smoke happens at runtime
    A.box(ctx, 0.5, 0.5, 0.4, 0.4, H, H + 20, A.wallColors("#b88356"), rnd);
    return H + 30;
  };

  A.wallRun = (ctx, x, y, w, h, H, rnd, lights, gate) => {
    const col = "#dcc293";
    A.box(ctx, x, y, w, h, 0, H, A.wallColors(col), rnd, { hatchRight: 0.08, hatchLeft: 0.05 });
    const f = w > h ? A.faceY(x, y, w, h) : A.faceX(x, y, w, h);
    A.crenels(ctx, f, f.len, H, shade(col, 0.05), rnd, 0.6);
    if (gate) {
      const g = gate; // { u, width }
      A.box(ctx, x + g.u - 1.2, y - 0.2, 1.1, h + 0.4, 0, H + 40, A.wallColors("#d6b986"), rnd);
      A.box(ctx, x + g.u + g.width + 0.1, y - 0.2, 1.1, h + 0.4, 0, H + 40, A.wallColors("#d6b986"), rnd);
      const gf = A.faceY(x, y - 0.2, w, h + 0.4);
      A.arch(ctx, gf, g.u + g.width / 2, g.width + 0.2, 0, H + 14, "#d6b986", rnd);
      A.arch(ctx, gf, g.u + g.width / 2, g.width - 0.4, 0, H + 2, "#4e3326", rnd);
      A.plaque(ctx, gf, g.u + g.width / 2, H + 18, "باب القمر", rnd, { w: 1.6, bg: "#2f7a78" });
      [g.u - 0.65, g.u + g.width + 0.65].forEach((u) => {
        const t = gf.at(u, H + 40); A.dome(ctx, t.x, t.y + 6, 15, 0, 12, "#3f8f8a", rnd);
        const lp = gf.at(u, H - 4, 0.1); ctx.fillStyle = "#ffd77a"; ctx.fillRect(lp.x - 2, lp.y - 5, 4, 6);
        lights.push({ x: lp.x, y: lp.y - 2, r: 52, kind: "lantern" });
      });
    }
    return H + (gate ? 70 : 12);
  };

  A.stall = (ctx, rnd, o, lights) => {
    const wood = "#9a6b44";
    // posts
    [[0.15, 0.85], [0.85, 0.85], [0.85, 0.15]].forEach(([x, y]) => V.sketchLine(ctx, [iso(x, y, 0), iso(x, y, 44)], rnd, { color: "#6d4b33", lw: 2.2 }));
    A.box(ctx, 0.12, 0.12, 0.76, 0.76, 0, 16, A.wallColors(wood), rnd);
    const goods = o.goods;
    if (goods === "spice") {
      [[0.35, 0.35], [0.62, 0.35], [0.35, 0.62], [0.62, 0.62]].forEach(([x, y], i) => {
        const p = iso(x, y, 16), c = o.palette[i % o.palette.length];
        ellipse(ctx, p.x, p.y, 7, 3.5, "#8b5e3c", rnd, { lw: 0.9 });
        sketch(ctx, [{ x: p.x - 6, y: p.y }, { x: p.x, y: p.y - 9 }, { x: p.x + 6, y: p.y }], c, rnd, { lw: 1 });
      });
    } else if (goods === "pots") {
      [[0.35, 0.4], [0.62, 0.38], [0.48, 0.66]].forEach(([x, y], i) => {
        const p = iso(x, y, 16), c = o.palette[i % o.palette.length];
        ellipse(ctx, p.x, p.y - 6, 6, 7, c, rnd, { lw: 1 }); ellipse(ctx, p.x, p.y - 13, 3, 1.4, shade(c, -0.3), rnd, { lw: 0.7 });
      });
    } else if (goods === "cloth") {
      [0, 1, 2].forEach((i) => {
        const p0 = iso(0.25, 0.3 + i * 0.2, 18 + i * 0.5), p1 = iso(0.75, 0.3 + i * 0.2, 18);
        sketch(ctx, [{ x: p0.x, y: p0.y - 3 }, { x: p1.x, y: p1.y - 3 }, { x: p1.x, y: p1.y + 3 }, { x: p0.x, y: p0.y + 3 }], o.palette[i % o.palette.length], rnd, { lw: 0.9 });
      });
    } else {
      // lamps
      [[0.35, 0.35], [0.62, 0.45], [0.42, 0.66]].forEach(([x, y], i) => {
        const p = iso(x, y, 16); ctx.fillStyle = "#c9933a"; ctx.beginPath(); ctx.moveTo(p.x - 4, p.y); ctx.lineTo(p.x + 4, p.y); ctx.lineTo(p.x + 2, p.y - 10); ctx.lineTo(p.x - 2, p.y - 10); ctx.fill();
        ctx.fillStyle = o.palette[i % 3]; ctx.beginPath(); ctx.arc(p.x, p.y - 6, 2.4, 0, 7); ctx.fill();
        lights.push({ x: p.x, y: p.y - 6, r: 22, kind: "lamp" });
      });
    }
    // sloped awning
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n;
      const pts = [iso(0.05 + a * 0.95, 0.05, 54), iso(0.05 + b * 0.95, 0.05, 54), iso(0.05 + b * 0.95, 1.0, 42), iso(0.05 + a * 0.95, 1.0, 42)];
      sketch(ctx, pts, i % 2 ? "#f5ecd8" : o.awning, rnd, { lw: 0.9, alpha: 0.55, jitter: 0.5 });
    }
    const e0 = iso(1.0, 0.05, 54), e1 = iso(1.0, 1.0, 42);
    V.sketchLine(ctx, [e0, e1], rnd, { lw: 1.2 });
    return 60;
  };

  A.palm = (ctx, rnd) => {
    const base = iso(0.5, 0.5, 0);
    const lean = (rnd() - 0.5) * 30, H = 88 + rnd() * 24;
    const pts = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push({ x: base.x + lean * t * t, y: base.y - H * t }); }
    // trunk
    ctx.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const a = pts[i], b = pts[i + 1];
      ctx.strokeStyle = V.INK; ctx.lineWidth = 9 - i * 0.5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = i % 2 ? "#a77a4f" : "#94683f"; ctx.lineWidth = 7 - i * 0.5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    const top = pts[8];
    const fronds = 8;
    for (let k = 0; k < fronds; k++) {
      const a = (k / fronds) * Math.PI * 2 + rnd() * 0.3;
      const len = 34 + rnd() * 14;
      const tip = { x: top.x + Math.cos(a) * len, y: top.y + Math.sin(a) * len * 0.45 + 16 };
      const mid = { x: top.x + Math.cos(a) * len * 0.55, y: top.y + Math.sin(a) * len * 0.25 - 8 };
      const col = k % 2 ? "#5e8f45" : "#4f7d3b";
      ctx.strokeStyle = col; ctx.lineWidth = 1.6;
      for (let s = 0.15; s < 1; s += 0.1) {
        const x = (1 - s) * (1 - s) * top.x + 2 * (1 - s) * s * mid.x + s * s * tip.x;
        const y = (1 - s) * (1 - s) * top.y + 2 * (1 - s) * s * mid.y + s * s * tip.y;
        const l = 9 * (1 - s * 0.6);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.sin(a) * l, y + 6 * (1 - s) + 2); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(a) * l, y + 5 * (1 - s) + 3); ctx.stroke();
      }
      ctx.strokeStyle = V.INK; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.quadraticCurveTo(mid.x, mid.y, tip.x, tip.y); ctx.stroke(); ctx.globalAlpha = 1;
    }
    ["#7a4a24", "#8d5a2c", "#6d3f1d"].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(top.x - 4 + i * 4, top.y + 4 + (i % 2) * 2, 3, 0, 7); ctx.fill(); });
    return H + 30;
  };

  A.lantern = (ctx, rnd, lights) => {
    const b = iso(0.5, 0.5, 0), t = iso(0.5, 0.5, 64);
    V.sketchLine(ctx, [b, t], rnd, { lw: 3, color: "#3b2a22" });
    V.sketchLine(ctx, [t, { x: t.x + 9, y: t.y }], rnd, { lw: 2, color: "#3b2a22" });
    const l = { x: t.x + 9, y: t.y + 4 };
    sketch(ctx, [{ x: l.x - 5, y: l.y }, { x: l.x + 5, y: l.y }, { x: l.x + 4, y: l.y + 12 }, { x: l.x - 4, y: l.y + 12 }], "#ffd77a", rnd, { lw: 1.2 });
    sketch(ctx, [{ x: l.x - 6, y: l.y }, { x: l.x, y: l.y - 6 }, { x: l.x + 6, y: l.y }], "#b8862f", rnd, { lw: 1 });
    ellipse(ctx, b.x, b.y, 6, 3, "#6d5a4a", rnd, { lw: 1 });
    lights.push({ x: l.x, y: l.y + 6, r: 70, kind: "lantern" });
    return 80;
  };

  A.jars = (ctx, rnd) => {
    [[0.35, 0.4, 12, "#c47a4a"], [0.65, 0.45, 9, "#b06a3e"], [0.5, 0.7, 10, "#d08b57"]].forEach(([x, y, s, c]) => {
      const p = iso(x, y, 0);
      ellipse(ctx, p.x, p.y - s, s * 0.6, s * 0.95, c, rnd, { lw: 1.1 });
      ellipse(ctx, p.x, p.y - s * 1.9, s * 0.3, s * 0.15, shade(c, -0.3), rnd, { lw: 0.8 });
    });
    return 30;
  };

  A.well = (ctx, rnd) => {
    const c = iso(0.5, 0.5, 0);
    const pts = [];
    for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI; pts.push({ x: c.x + Math.cos(a) * 18, y: c.y + Math.sin(a) * 9 }); }
    for (let i = 16; i >= 0; i--) { const a = (i / 16) * Math.PI; pts.push({ x: c.x + Math.cos(a) * 18, y: c.y - 16 + Math.sin(a) * 9 }); }
    sketch(ctx, pts, "#cdb48a", rnd, { hatch: 0.08 });
    ellipse(ctx, c.x, c.y - 16, 18, 9, "#d9c29a", rnd); ellipse(ctx, c.x, c.y - 16, 13, 6, "#2d4752", rnd, { lw: 1 });
    [-16, 16].forEach((d) => V.sketchLine(ctx, [{ x: c.x + d, y: c.y - 14 }, { x: c.x + d, y: c.y - 48 }], rnd, { lw: 2.5, color: "#6d4b33" }));
    V.sketchLine(ctx, [{ x: c.x - 20, y: c.y - 48 }, { x: c.x + 20, y: c.y - 48 }], rnd, { lw: 3, color: "#6d4b33" });
    V.sketchLine(ctx, [{ x: c.x + 2, y: c.y - 48 }, { x: c.x + 2, y: c.y - 30 }], rnd, { lw: 0.8 });
    sketch(ctx, [{ x: c.x - 3, y: c.y - 30 }, { x: c.x + 7, y: c.y - 30 }, { x: c.x + 6, y: c.y - 22 }, { x: c.x - 2, y: c.y - 22 }], "#8d5a2c", rnd, { lw: 1 });
    return 60;
  };

  A.fountain = (ctx, rnd) => {
    const c = iso(1.5, 1.5, 0), R = 52, r2 = R / 2, H = 16;
    // basin wall
    const side = [];
    for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI; side.push({ x: c.x + Math.cos(a) * R, y: c.y + Math.sin(a) * r2 }); }
    for (let i = 24; i >= 0; i--) { const a = (i / 24) * Math.PI; side.push({ x: c.x + Math.cos(a) * R, y: c.y - H + Math.sin(a) * r2 }); }
    sketch(ctx, side, "#e7d4ae", rnd, { hatch: 0.06 });
    // zellij band
    for (let i = 1; i < 12; i++) {
      const a = (i / 12) * Math.PI, x = c.x + Math.cos(a) * R, y = c.y - H / 2 + Math.sin(a) * r2;
      ctx.fillStyle = i % 2 ? "#2f7a78" : "#3d6f9a"; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 3, y); ctx.lineTo(x, y + 4); ctx.lineTo(x - 3, y); ctx.fill();
    }
    ellipse(ctx, c.x, c.y - H, R, r2, "#efe0bd", rnd, { n: 30 });
    ellipse(ctx, c.x, c.y - H + 1, R - 7, r2 - 4, "#5fa6b6", rnd, { n: 30, lw: 1.2 });
    ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = "#e9fbff"; ctx.beginPath(); ctx.ellipse(c.x - 12, c.y - H - 4, 16, 4, 0, 0, 7); ctx.fill(); ctx.restore();
    // pillar + bowl
    const px = c.x, py = c.y - H;
    sketch(ctx, [{ x: px - 5, y: py }, { x: px + 5, y: py }, { x: px + 4, y: py - 30 }, { x: px - 4, y: py - 30 }], "#e7d4ae", rnd, { hatch: 0.1 });
    ellipse(ctx, px, py - 31, 17, 6, "#efe0bd", rnd);
    ellipse(ctx, px, py - 32, 12, 3.5, "#6fb4c2", rnd, { lw: 1 });
    sketch(ctx, [{ x: px - 2.5, y: py - 32 }, { x: px + 2.5, y: py - 32 }, { x: px + 2, y: py - 42 }, { x: px - 2, y: py - 42 }], "#e7d4ae", rnd, { lw: 1 });
    return 70;
  };

  /* ---------- people ---------- */

  // (x, y) = feet on screen. o: look + { facing: 1|-1, walk: phase|null, bob, scale, id }
  A.person = (ctx, x, y, o, t) => {
    const s = o.scale || 1;
    const img = o.id && V.assets.get((o.id === "avatar" ? "avatar/" : "agents/" + o.id + "/") + (o.working ? "working" : "idle"));
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(60,35,20,.25)"; ctx.beginPath(); ctx.ellipse(0, 0, 11 * s, 4.5 * s, 0, 0, 7); ctx.fill();
    const walking = o.walk != null;
    const bob = walking ? Math.abs(Math.sin(o.walk * 2)) * 2.2 : Math.sin(t * 2 + (o.seed || 0)) * 0.6;
    if (img) {
      const h = 58 * s, w = (img.width / img.height) * h;
      ctx.translate(0, -bob);
      if (o.facing < 0) ctx.scale(-1, 1);
      ctx.drawImage(img, -w / 2, -h, w, h);
      ctx.restore();
      return;
    }
    ctx.scale(o.facing < 0 ? -s : s, s);
    ctx.translate(0, -bob);
    const rnd = V.rng(o.seed || 7);
    // legs
    const sw = walking ? Math.sin(o.walk * 2) * 3.5 : 0;
    ctx.strokeStyle = V.INK; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-3, -8); ctx.lineTo(-3 + sw, -1); ctx.moveTo(3, -8); ctx.lineTo(3 - sw, -1); ctx.stroke();
    ctx.strokeStyle = "#6b4a36"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-3, -8); ctx.lineTo(-3 + sw, -1); ctx.moveTo(3, -8); ctx.lineTo(3 - sw, -1); ctx.stroke();
    // robe
    const robe = [{ x: -7, y: -31 }, { x: 7, y: -31 }, { x: 11, y: -6 }, { x: -11, y: -6 }];
    V.sketch(ctx, robe, o.robe, rnd, { lw: 1.5, jitter: 0.5 });
    ctx.strokeStyle = o.trim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(1, -30); ctx.lineTo(1.5, -7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10.5, -8); ctx.lineTo(10.5, -8); ctx.stroke();
    // arms
    const as = walking ? Math.sin(o.walk * 2) * 3 : 0;
    const armY = o.working ? -24 : -20;
    V.ellipse(ctx, -9 - as * 0.3, armY + as, 3, 7, V.shade(o.robe, -0.12), rnd, { lw: 1.1, jitter: 0.3, n: 12 });
    V.ellipse(ctx, 9 + as * 0.3, armY - as, 3, 7, V.shade(o.robe, -0.12), rnd, { lw: 1.1, jitter: 0.3, n: 12 });
    if (o.working) { ctx.fillStyle = "#f6ead0"; ctx.fillRect(4, -26, 8, 10); ctx.strokeStyle = V.INK; ctx.lineWidth = 1; ctx.strokeRect(4, -26, 8, 10); }
    // head
    const hx = 0.5, hy = -38;
    const head = o.head || "none", hc = o.headColor || "#eee";
    if (head === "hijab" || head === "keffiyeh") {
      V.sketch(ctx, [{ x: hx - 9, y: hy - 2 }, { x: hx + 9, y: hy - 2 }, { x: hx + 10, y: hy + 10 }, { x: hx - 10, y: hy + 10 }], hc, rnd, { lw: 1.2, jitter: 0.4 });
    }
    V.ellipse(ctx, hx, hy, 7.5, 8, o.skin || "#c99a74", rnd, { lw: 1.4, jitter: 0.3, n: 16 });
    if (head === "hijab") {
      ctx.beginPath(); ctx.arc(hx, hy, 9.5, Math.PI * 0.95, Math.PI * 2.05); ctx.lineTo(hx + 9.5, hy + 4); ctx.quadraticCurveTo(hx + 4, hy - 4, hx + 1, hy - 4); ctx.quadraticCurveTo(hx - 4, hy - 4, hx - 9.5, hy + 4); ctx.closePath();
      ctx.fillStyle = hc; ctx.fill(); ctx.strokeStyle = V.INK; ctx.lineWidth = 1.3; ctx.stroke();
    } else if (head === "keffiyeh") {
      ctx.beginPath(); ctx.arc(hx, hy - 1, 9, Math.PI, Math.PI * 2); ctx.lineTo(hx + 10, hy + 6); ctx.lineTo(hx + 6, hy - 2); ctx.lineTo(hx - 6, hy - 2); ctx.lineTo(hx - 10, hy + 6); ctx.closePath();
      ctx.fillStyle = hc; ctx.fill(); ctx.strokeStyle = V.INK; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.strokeStyle = "#c4566b"; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.6;
      for (let k = -6; k <= 6; k += 3) { ctx.beginPath(); ctx.moveTo(hx + k, hy - 9); ctx.lineTo(hx + k + 2, hy - 3); ctx.stroke(); }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#2b2122"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.ellipse(hx, hy - 6, 8.5, 2.2, 0, 0, 7); ctx.stroke();
    } else if (head === "kufi") {
      ctx.beginPath(); ctx.ellipse(hx, hy - 5, 7.6, 4.6, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fillStyle = hc; ctx.fill(); ctx.strokeStyle = V.INK; ctx.lineWidth = 1.2; ctx.stroke();
    } else if (head === "turban") {
      V.ellipse(ctx, hx, hy - 7, 9.5, 5.5, hc, rnd, { lw: 1.3, jitter: 0.3, n: 16 });
      ctx.strokeStyle = V.shade(hc, -0.25); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx - 8, hy - 6); ctx.quadraticCurveTo(hx, hy - 11, hx + 8, hy - 8); ctx.stroke();
    } else {
      ctx.fillStyle = "#2b2122"; ctx.beginPath(); ctx.ellipse(hx, hy - 5, 7.5, 4, 0, Math.PI, Math.PI * 2); ctx.fill();
    }
    // face
    ctx.fillStyle = "#2b2122";
    ctx.beginPath(); ctx.arc(hx + 1.5, hy + 1, 1.1, 0, 7); ctx.arc(hx + 5, hy + 1, 1.1, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(220,110,110,.4)"; ctx.beginPath(); ctx.arc(hx + 6, hy + 4, 1.8, 0, 7); ctx.fill();
    ctx.restore();
  };

  // Offscreen pre-render: draw(ctx, rnd, lights) in local tile coords with the footprint at (0,0).
  A.prerender = (w, h, maxZ, seed, draw) => {
    const pad = 46;
    const ox = (h * V.TW) / 2 + pad + 30, oy = maxZ + pad;
    const cw = Math.ceil(((w + h) * V.TW) / 2 + pad * 2 + 60), ch = Math.ceil(maxZ + ((w + h) * V.TH) / 2 + pad * 2);
    const c = document.createElement("canvas");
    c.width = cw; c.height = ch;
    const ctx = c.getContext("2d");
    ctx.translate(ox, oy);
    const lights = [];
    draw(ctx, V.rng(seed), lights);
    return { canvas: c, ox, oy, lights };
  };
})();
