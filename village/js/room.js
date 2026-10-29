// Inside a building: a small hand-drawn room with its residents.
(function () {
  const R = (V.room = {});
  const ri = (x, y, z = 0) => ({ x: 320 + (x - y) * 56, y: 150 + (x + y) * 28 - z });

  const box = (ctx, x, y, w, h, z0, z1, col, rnd) => {
    const top = [ri(x, y, z1), ri(x + w, y, z1), ri(x + w, y + h, z1), ri(x, y + h, z1)];
    const right = [ri(x + w, y, z0), ri(x + w, y + h, z0), ri(x + w, y + h, z1), ri(x + w, y, z1)];
    const left = [ri(x, y + h, z0), ri(x + w, y + h, z0), ri(x + w, y + h, z1), ri(x, y + h, z1)];
    V.sketch(ctx, left, V.shade(col, 0.02), rnd);
    V.sketch(ctx, right, V.shade(col, -0.18), rnd, { hatch: 0.08 });
    V.sketch(ctx, top, V.shade(col, 0.14), rnd);
  };

  const skyColor = () => {
    const L = V.sky.light(), kind = V.sky.weather.kind;
    let c = V.mix("#1d2350", "#9fd3e6", L.day);
    c = V.mix(c, "#f5a76a", L.golden * 0.6);
    if (["cloudy", "rain", "storm", "fog", "snow"].includes(kind)) c = V.mix(c, "#9aa0ad", 0.45);
    return c;
  };

  // Window on the right wall, showing the real sky outside.
  const windowOnRight = (ctx, u, rnd, t) => {
    const pts = [], w = 0.9, z0 = 70, h = 70, r = w / 2, rz = r * 46;
    const at = (uu, z) => ri(5, uu, z);
    pts.push(at(u - r, z0));
    for (let i = 0; i <= 12; i++) { const a = Math.PI - (i / 12) * Math.PI; pts.push(at(u + Math.cos(a) * r, z0 + h - rz + Math.sin(a) * rz)); }
    pts.push(at(u + r, z0));
    V.sketch(ctx, pts, skyColor(), rnd, { lw: 2 });
    ctx.save();
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.clip();
    const c = at(u, z0 + h / 2);
    if (V.sky.isNight()) { ctx.fillStyle = "#fff7d6"; for (let i = 0; i < 8; i++) ctx.fillRect(c.x - 25 + ((i * 37) % 50), c.y - 40 + ((i * 23) % 60), 1.6, 1.6); ctx.beginPath(); ctx.arc(c.x + 8, c.y - 20, 7, 0, 7); ctx.fill(); }
    else if (V.sky.weather.kind === "clear" || V.sky.weather.kind === "partly") { ctx.fillStyle = "rgba(255,240,180,.9)"; ctx.beginPath(); ctx.arc(c.x - 6, c.y - 18, 9, 0, 7); ctx.fill(); }
    // a dome on the skyline
    ctx.fillStyle = "rgba(60,90,100,.55)"; ctx.beginPath(); ctx.ellipse(c.x + 4, c.y + 40, 22, 20, 0, Math.PI, 0); ctx.fill();
    if (V.sky.weather.kind === "rain" || V.sky.weather.kind === "storm") {
      ctx.strokeStyle = "rgba(220,230,255,.6)"; ctx.lineWidth = 1;
      for (let i = 0; i < 14; i++) { const x = c.x - 30 + ((i * 13 + t * 120) % 60), y = c.y - 50 + ((i * 29 + t * 300) % 100); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y - 8); ctx.stroke(); }
    }
    if (V.sky.weather.kind === "snow") { ctx.fillStyle = "#fff"; for (let i = 0; i < 12; i++) { const x = c.x - 30 + ((i * 17) % 60), y = c.y - 50 + ((i * 31 + t * 30) % 100); ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill(); } }
    ctx.restore();
    const m = [at(u, z0), at(u, z0 + h - 8)]; V.sketchLine(ctx, m, rnd, { lw: 2, color: "#8a5a36" });
  };

  const shelves = (ctx, rnd, side, from, to, rows, zTop) => {
    for (let r = 0; r < rows; r++) {
      const z = 20 + r * ((zTop - 20) / rows);
      for (let u = from; u < to; u += 0.12) {
        const col = V.pick(rnd, ["#9b3b3b", "#2f7a78", "#3b4a8a", "#d99a2b", "#6b7d3a", "#7a3b56", "#c47a4a"]);
        const hgt = 18 + rnd() * 8;
        const p = side === "left" ? [ri(u, 0, z), ri(u + 0.1, 0, z), ri(u + 0.1, 0, z + hgt), ri(u, 0, z + hgt)] : [ri(0, u, z), ri(0, u + 0.1, z), ri(0, u + 0.1, z + hgt), ri(0, u, z + hgt)];
        V.sketch(ctx, p, col, rnd, { lw: 0.7, jitter: 0.3 });
      }
      const a = side === "left" ? ri(from, 0, z - 2) : ri(0, from, z - 2), b = side === "left" ? ri(to, 0, z - 2) : ri(0, to, z - 2);
      V.sketchLine(ctx, [a, b], rnd, { lw: 3, color: "#7a4a2b" });
    }
  };

  R.draw = (canvas, place, t) => {
    const ctx = canvas.getContext("2d");
    const rnd = V.rng(V.hash(place.id) + 5);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 640, 360);
    const img = V.assets.get("rooms/" + place.id) || (place.kind === "house" ? V.assets.get("rooms/house") : null);
    const residents = V.agents.residents(place.id);
    if (img) {
      const s = Math.max(640 / img.width, 360 / img.height);
      ctx.drawImage(img, (640 - img.width * s) / 2, (360 - img.height * s) / 2, img.width * s, img.height * s);
    } else {
      const wall = place.kind === "house" ? place.look.wall : { library: "#ead6ac", post: "#f0dcb4", qahwa: "#e6b98a" }[place.kind];
      ctx.fillStyle = V.shade(wall, -0.35); ctx.fillRect(0, 0, 640, 360);
      // walls
      V.sketch(ctx, [ri(0, 5), ri(0, 0), ri(0, 0, 190), ri(0, 5, 190)], V.shade(wall, 0.05), rnd);
      V.sketch(ctx, [ri(0, 0), ri(5, 0), ri(5, 0, 190), ri(0, 0, 190)], V.shade(wall, -0.12), rnd, { hatch: 0.06 });
      // tile dado
      [[ri(0, 5, 40), ri(0, 0, 40), ri(0, 0, 0), ri(0, 5, 0)], [ri(0, 0, 40), ri(5, 0, 40), ri(5, 0, 0), ri(0, 0, 0)]].forEach((p) => V.sketch(ctx, p, place.kind === "qahwa" ? "#3d6f9a" : "#2f7a78", rnd, { lw: 1.2 }));
      // floor
      V.sketch(ctx, [ri(0, 0), ri(5, 0), ri(5, 5), ri(0, 5)], place.kind === "library" ? "#b7895a" : "#d9c29a", rnd);
      ctx.strokeStyle = "rgba(74,50,38,.15)"; ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) { let a = ri(i, 0), b = ri(i, 5); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); a = ri(0, i); b = ri(5, i); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      // rug
      V.sketch(ctx, [ri(1.2, 1.4), ri(3.8, 1.4), ri(3.8, 3.8), ri(1.2, 3.8)], "#9b3b3b", rnd);
      V.sketch(ctx, [ri(1.5, 1.7), ri(3.5, 1.7), ri(3.5, 3.5), ri(1.5, 3.5)], "#d99a2b", rnd, { lw: 1 });
      const rc = ri(2.5, 2.6); ctx.fillStyle = "#2f7a78"; ctx.beginPath(); ctx.moveTo(rc.x, rc.y - 14); ctx.lineTo(rc.x + 28, rc.y); ctx.lineTo(rc.x, rc.y + 14); ctx.lineTo(rc.x - 28, rc.y); ctx.fill();
      // windows show the real sky
      windowOnRight(ctx, 1.4, rnd, t);
      if (place.kind !== "library") windowOnRight(ctx, 3.6, rnd, t);

      if (place.kind === "library") {
        shelves(ctx, rnd, "left", 0.2, 4.8, 5, 180);
        shelves(ctx, rnd, "right", 0.2, 4.8, 5, 180);
        box(ctx, 2.6, 0.6, 1.6, 0.8, 0, 34, "#8a5a36", rnd); // desk
        [[2.8, 0.8], [3.3, 0.9], [3.8, 0.7]].forEach(([x, y], i) => box(ctx, x, y, 0.3, 0.4, 34, 40 + i * 6, V.pick(rnd, ["#9b3b3b", "#3b4a8a", "#d99a2b"]), rnd));
        // ladder
        const l0 = ri(0.2, 3.8, 0), l1 = ri(0.2, 3.8, 160);
        V.sketchLine(ctx, [{ x: l0.x + 20, y: l0.y }, { x: l1.x + 10, y: l1.y }], rnd, { lw: 3, color: "#7a4a2b" });
        V.sketchLine(ctx, [{ x: l0.x + 44, y: l0.y + 6 }, { x: l1.x + 34, y: l1.y + 6 }], rnd, { lw: 3, color: "#7a4a2b" });
      } else if (place.kind === "post") {
        for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
          const u = 0.4 + c * 0.5, z = 60 + r * 28;
          V.sketch(ctx, [ri(u, 0, z), ri(u + 0.45, 0, z), ri(u + 0.45, 0, z + 24), ri(u, 0, z + 24)], (r + c) % 3 ? "#6a4a33" : "#f2e6c9", rnd, { lw: 0.8 });
        }
        box(ctx, 0.6, 1.6, 0.8, 3, 0, 40, "#2c5d8a", rnd);
        [[3.4, 3.8], [3.9, 3.6], [3.6, 4.2]].forEach(([x, y], i) => box(ctx, x, y, 0.45, 0.4, 0 + (i === 2 ? 0 : 0), 18 + i * 4, "#c9a36a", rnd));
      } else if (place.kind === "qahwa") {
        box(ctx, 0.5, 0.5, 3.5, 0.8, 0, 46, "#7a4a2b", rnd);
        [1, 1.8, 2.6, 3.4].forEach((u, i) => {
          const p = ri(u, 0.9, 54); ctx.fillStyle = i % 2 ? "#d9a441" : "#c9933a";
          ctx.beginPath(); ctx.moveTo(p.x - 7, p.y + 6); ctx.quadraticCurveTo(p.x - 9, p.y - 10, p.x, p.y - 14); ctx.quadraticCurveTo(p.x + 9, p.y - 10, p.x + 7, p.y + 6); ctx.closePath(); ctx.fill(); ctx.strokeStyle = V.INK; ctx.lineWidth = 1.2; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(p.x + 7, p.y - 6); ctx.lineTo(p.x + 16, p.y - 14); ctx.stroke();
        });
        [[3.6, 3.2], [1.2, 3.8]].forEach(([x, y]) => box(ctx, x, y, 0.9, 0.9, 0, 10, "#c4566b", rnd));
      } else {
        box(ctx, 0.15, 0.6, 0.7, 3.8, 0, 16, "#c4566b", rnd); // majlis cushions
        box(ctx, 0.15, 0.6, 0.25, 3.8, 16, 40, "#a8445a", rnd);
        box(ctx, 2.2, 2.2, 0.9, 0.9, 0, 14, "#8a5a36", rnd); // tea table
        const tp = ri(2.65, 2.65, 14); ctx.fillStyle = "#e2b64f"; ctx.beginPath(); ctx.ellipse(tp.x, tp.y - 6, 7, 9, 0, 0, 7); ctx.fill(); ctx.strokeStyle = V.INK; ctx.stroke();
        shelves(ctx, rnd, "left", 2.6, 4.6, 2, 150);
      }
      // hanging lamp
      const lp = ri(2.5, 2.5, 210); V.sketchLine(ctx, [{ x: lp.x, y: 0 }, lp], rnd, { lw: 1 });
      ctx.fillStyle = "#e2a93b"; ctx.beginPath(); ctx.moveTo(lp.x - 10, lp.y); ctx.lineTo(lp.x + 10, lp.y); ctx.lineTo(lp.x + 6, lp.y + 18); ctx.lineTo(lp.x - 6, lp.y + 18); ctx.fill(); ctx.strokeStyle = V.INK; ctx.stroke();
      const g = ctx.createRadialGradient(lp.x, lp.y + 12, 2, lp.x, lp.y + 12, 120);
      const night = V.sky.light().night;
      g.addColorStop(0, `rgba(255,200,110,${0.25 + night * 0.35})`); g.addColorStop(1, "rgba(255,200,110,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 640, 360);
    }

    // residents
    const spots = place.kind === "library" ? [[3.4, 1.9]] : place.kind === "post" ? [[1.8, 2.6], [2.6, 3.2]] : place.kind === "qahwa" ? [[2.2, 2.2], [3, 2.6]] : [[1.8, 2.4], [3.1, 2.0]];
    residents.forEach((a, i) => {
      const [x, y] = spots[i % spots.length];
      const p = ri(x + (i >= spots.length ? 0.6 : 0), y);
      const working = V.agents.st(a.id).status === "working";
      V.art.person(ctx, p.x, p.y, Object.assign({}, a.look, { id: a.id, facing: i % 2 ? -1 : 1, walk: null, seed: a.seed, working, scale: 2.1 }), t);
      ctx.font = "16px 'Patrick Hand', sans-serif"; ctx.textAlign = "center";
      const label = a.data.name;
      const w = ctx.measureText(label).width + 14;
      ctx.fillStyle = "rgba(251,241,220,.92)"; ctx.strokeStyle = V.INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(p.x - w / 2, p.y + 6, w, 20, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = V.INK; ctx.fillText(label, p.x, p.y + 21);
      if (V.agents.hasMessage(a.id)) {
        const by = p.y - 112 + Math.sin(t * 4) * 3;
        ctx.fillStyle = "#c4566b"; ctx.beginPath(); ctx.arc(p.x, by, 13, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#fff8ea"; ctx.font = "bold 18px 'Patrick Hand', sans-serif"; ctx.fillText("!", p.x, by + 6);
      }
      if (working) {
        for (let k = 0; k < 3; k++) { ctx.fillStyle = `rgba(74,50,38,${0.3 + 0.7 * ((Math.floor(t * 3) % 3) === k)})`; ctx.beginPath(); ctx.arc(p.x + 30 + k * 8, p.y - 90, 2.6, 0, 7); ctx.fill(); }
      }
    });
    if (!residents.length && place.kind === "house") {
      ctx.font = "20px 'Patrick Hand', sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(251,241,220,.9)";
      ctx.fillText("Nobody lives here yet", 320, 330);
    }
  };
})();
