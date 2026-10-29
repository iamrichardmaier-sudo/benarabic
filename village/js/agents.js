// The people: you, and the agents who live in the souq.
(function () {
  const W = V.world;
  const AG = (V.agents = { list: [], byId: {}, avatar: null, fx: [], chats: [], state: { agents: {}, activity: [] } });

  class Walker {
    constructor(x, y, look, id) {
      this.x = x + 0.5; this.y = y + 0.5; this.look = look; this.id = id;
      this.path = []; this.speed = 2.4 * (V.world.speedScale || 1); this.facing = 1; this.walk = 0; this.moving = false; this.seed = V.hash(id) % 1000;
    }
    tile() { return { x: Math.floor(this.x), y: Math.floor(this.y) }; }
    goTo(tx, ty) {
      const t = this.tile();
      const p = W.findPath(t.x, t.y, tx, ty);
      this.path = p || [];
      return !!p;
    }
    place(tx, ty) { this.x = tx + 0.5; this.y = ty + 0.5; this.path = []; }
    step(dt) {
      this.moving = false;
      if (!this.path.length) return false;
      const n = this.path[0], tx = n.x + 0.5, ty = n.y + 0.5;
      const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy), s = this.speed * dt;
      if (V.world.painted) { if (Math.abs(dx) > 0.01) this.facing = dx > 0 ? 1 : -1; }
      else if (Math.abs(dx - dy) > 0.01) this.facing = dx - dy > 0 ? 1 : -1;
      if (d <= s) { this.x = tx; this.y = ty; this.path.shift(); }
      else { this.x += (dx / d) * s; this.y += (dy / d) * s; }
      this.moving = true; this.walk += dt * this.speed * 2.6;
      return true;
    }
    screen() { return V.iso(this.x, this.y); }
    sortBox() { return { x0: this.x - 0.3, x1: this.x + 0.3, y0: this.y - 0.3, y1: this.y + 0.3 }; }
    draw(ctx, t) {
      const p = this.screen();
      V.art.person(ctx, p.x, p.y, Object.assign({}, this.look, { id: this.id, facing: this.facing, walk: this.moving ? this.walk : null, seed: this.seed, working: this.working }), t);
    }
  }
  AG.Walker = Walker;

  /* ---------- state helpers ---------- */
  AG.st = (id) => AG.state.agents?.[id] || {};
  AG.bonus = (id) => (V.store.get("bonusHearts", {})[id] || 0);
  AG.hearts = (id) => (AG.st(id).tasksDone || 0) + AG.bonus(id);
  AG.level = (id) => 1 + Math.floor(AG.hearts(id) / 5);
  AG.msgKey = (id) => `${AG.state.updated || ""}|${AG.st(id).messageNote || ""}`;
  AG.hasMessage = (id) => !!AG.st(id).message && V.store.get("readMsgs", {})[id] !== AG.msgKey(id);
  AG.markRead = (id) => { const r = V.store.get("readMsgs", {}); r[id] = AG.msgKey(id); V.store.set("readMsgs", r); };
  AG.giveHeart = (id) => {
    const b = V.store.get("bonusHearts", {}); b[id] = (b[id] || 0) + 1; V.store.set("bonusHearts", b);
    AG.checkHearts(false);
  };
  AG.residents = (placeId) => AG.list.filter((a) => a.home.id === placeId);
  AG.activityFor = (id) => (AG.state.activity || []).filter((x) => x.from === id || x.to === id).slice(-8).reverse();
  AG.friends = (id) => new Set(AG.activityFor(id).map((x) => (x.from === id ? x.to : x.from)).filter((o) => o && o !== "you" && AG.byId[o])).size;

  /* ---------- talk ---------- */
  const generic = {
    greet: ["Salaam, {other}!", "Ahlan, {other}!", "Marhaba, {other}. Busy day?", "{salute}, {other}!"],
    idle: ["The saffron stall has new stock.", "{weather} again today.", "Taking a short break before the next task.", "Have you seen the lanterns after dark?", "The fountain is loud today.", "I finished early. Don't tell anyone."],
    reply: ["Ha, true.", "Inshallah.", "Yalla, see you later.", "Tell me about it.", "Good idea.", "Same here."],
    couple: ["Habibi, lunch at the qahwa?", "There you are, {other}!", "Tea at home tonight?"],
  };
  const weatherLines = {
    rain: ["Rain in the souq! Under the awnings, quick.", "Good day to stay near the qahwa."],
    storm: ["Did you hear that thunder?", "Everyone inside, the storm is here."],
    snow: ["Snow on the domes. That's new.", "My sandals were a mistake today."],
    fog: ["I can barely see the gate.", "Fog like this hides the whole souq."],
  };
  AG.say = (a, kind, other) => {
    const L = a.data.lines || {};
    let pool = (L[kind] && L[kind].length ? L[kind] : generic[kind]).slice();
    if (kind === "idle" && weatherLines[V.sky.weather.kind]) pool = pool.concat(weatherLines[V.sky.weather.kind]);
    if (kind === "idle" && V.sky.isNight()) pool.push("Late night at the souq.");
    const line = pool[Math.floor(Math.random() * pool.length)];
    const salute = V.sky.minutes() < 12 * 60 ? "Sabah al-khair" : "Masa' al-khair";
    return line.replace(/\{other\}/g, other ? other.data.name : "friend").replace(/\{weather\}/g, V.sky.weather.label || "Sunshine").replace(/\{salute\}/g, salute);
  };
  AG.bubble = (a, text, secs = 2.8) => { a.bubble = { text, until: AG.now + secs }; };

  AG.startChat = (a, b, lines) => {
    [a, b].forEach((x) => { x.mode = "chat"; x.path = []; });
    a.facing = a.x - a.y < b.x - b.y ? 1 : -1;
    b.facing = -a.facing;
    const married = a.data.spouse === b.id;
    const seq = lines || [
      { who: a, text: married ? AG.say(a, "couple", b) : AG.say(a, "greet", b) },
      { who: b, text: AG.say(b, Math.random() < 0.5 ? "greet" : "reply", a) },
      { who: a, text: AG.say(a, "idle", b) },
      { who: b, text: AG.say(b, "reply", a) },
    ];
    AG.chats.push({ a, b, seq, i: -1, next: AG.now, married });
  };

  /* ---------- setup ---------- */
  AG.init = () => {
    const cfg = V.cfg.avatar || {};
    const spawn = W.spots.spawn;
    AG.avatar = new Walker(spawn.x, spawn.y, { robe: cfg.robe || "#f4ecdc", trim: cfg.trim || "#2f7a78", head: cfg.head || "keffiyeh", headColor: cfg.headColor || "#e9e2d0", skin: cfg.skin || "#c99a74" }, "avatar");
    AG.avatar.speed = 3.4 * W.speedScale;
    AG.avatar.name = cfg.name || "You";
    (window.VILLAGE_AGENTS || []).forEach((d, i) => {
      const home = W.place(d.home) || W.place("qahwa");
      const spot = W.randomWalkableNear(home.doorTile.x, home.doorTile.y, Math.ceil(W.wanderRadius * 0.6), V.rng(V.hash(d.id))) || home.doorTile;
      const a = new Walker(spot.x, spot.y, Object.assign({ robe: "#8a6a4a", trim: "#f2d39a", head: "none", headColor: "#eee", skin: "#c99a74" }, d.look || {}), d.id);
      Object.assign(a, { data: d, home, mode: "pause", timer: 1 + Math.random() * 3, inside: false, chatCool: 3 + Math.random() * 10, bubble: null, speed: (1.6 + Math.random() * 0.4) * W.speedScale });
      AG.list.push(a); AG.byId[d.id] = a;
    });
    AG.setState(window.VILLAGE_STATE || {}, true);
    AG.list.forEach((a) => { if (AG.st(a.id).status === "working") { a.inside = true; a.place(a.home.doorTile.x, a.home.doorTile.y); } });
  };

  AG.setState = (s, first) => {
    AG.state = { agents: {}, activity: [], ...s };
    AG.checkHearts(first);
    AG.queueActivity(first);
  };

  AG.checkHearts = (first) => {
    const seen = V.store.get("seenHearts", {});
    AG.list.forEach((a) => {
      const h = AG.hearts(a.id);
      if (seen[a.id] == null) seen[a.id] = h;
      else if (h > seen[a.id]) {
        const gained = h - seen[a.id];
        const lvlUp = Math.floor(h / 5) > Math.floor(seen[a.id] / 5);
        seen[a.id] = h;
        if (!first) {
          AG.burst(a, gained);
          V.ui && V.ui.toast(lvlUp ? `${a.data.name} reached level ${AG.level(a.id)}!` : `${a.data.name} earned ${gained > 1 ? gained + " hearts" : "a heart"}`);
          V.audio.sfx("heart");
        }
      }
    });
    V.store.set("seenHearts", seen);
  };

  AG.burst = (a, n = 1) => {
    const p = a.inside ? a.home.top : V.iso(a.x, a.y, 60);
    for (let i = 0; i < Math.min(6, n + 2); i++) AG.fx.push({ x: p.x + (Math.random() - 0.5) * 20, y: p.y, vy: -30 - Math.random() * 20, t: 0, life: 1.8 + Math.random() * 0.6, kind: "heart" });
  };

  // Agent-to-agent mail shows up as the two of them meeting at the coffee house.
  AG.meetQueue = [];
  AG.queueActivity = (first) => {
    const seen = new Set(V.store.get("seenActivity", []));
    const fresh = (AG.state.activity || []).filter((x) => !seen.has(x.time + x.from + x.to));
    fresh.slice(-3).forEach((x) => {
      const a = AG.byId[x.from], b = AG.byId[x.to];
      if (a && b) AG.meetQueue.push({ a, b, subject: x.subject });
      else if (a && x.to === "you" && !first) V.ui && V.ui.toast(`✉️ ${a.data.name}: ${x.subject}`);
    });
    fresh.forEach((x) => seen.add(x.time + x.from + x.to));
    V.store.set("seenActivity", [...seen].slice(-200));
  };

  /* ---------- update ---------- */
  AG.now = 0;
  AG.update = (dt) => {
    AG.now += dt;
    const now = AG.now;
    AG.avatar.step(dt);

    // pending meetings
    if (AG.meetQueue.length && !AG.meeting) {
      const m = AG.meetQueue.shift();
      if (!m.a.inside && !m.b.inside && m.a.mode !== "chat" && m.b.mode !== "chat") {
        AG.meeting = m;
        m.a.mode = "meet"; m.b.mode = "meet";
        m.a.goTo(W.spots.meet[0].x, W.spots.meet[0].y); m.b.goTo(W.spots.meet[1].x, W.spots.meet[1].y);
        m.started = now;
      } else V.ui && V.ui.toast(`${m.a.data.name} → ${m.b.data.name}: ${m.subject}`);
    }
    if (AG.meeting) {
      const m = AG.meeting;
      if ((!m.a.path.length && !m.b.path.length) || now - m.started > 25) {
        AG.meeting = null;
        AG.startChat(m.a, m.b, [
          { who: m.a, text: m.subject.length > 70 ? m.subject.slice(0, 68) + "…" : m.subject },
          { who: m.b, text: AG.say(m.b, "reply", m.a) },
        ]);
      }
    }

    AG.list.forEach((a) => {
      const st = AG.st(a.id);
      a.working = false;
      if (a.mode === "chat") return;
      if (a.mode === "meet") { a.step(dt); return; }
      if (st.status === "working") {
        if (a.inside) return;
        if (a.mode !== "gohome") { a.mode = "gohome"; a.goTo(a.home.doorTile.x, a.home.doorTile.y); }
        if (!a.step(dt)) { a.inside = true; a.mode = "inside"; }
        return;
      }
      if (a.inside) { a.inside = false; a.place(a.home.doorTile.x, a.home.doorTile.y); a.mode = "pause"; a.timer = 1; }
      if (a.mode === "walk") { if (!a.step(dt)) { a.mode = "pause"; a.timer = 2 + Math.random() * 6; } return; }
      a.timer -= dt;
      if (a.timer <= 0) {
        const r = Math.random();
        const anchor = r < 0.5 ? a.home.doorTile : r < 0.75 ? W.spots.plaza : W.place("qahwa").doorTile;
        const spouse = a.data.spouse && AG.byId[a.data.spouse];
        const target = spouse && !spouse.inside && Math.random() < 0.3 ? spouse.tile() : W.randomWalkableNear(anchor.x, anchor.y, W.wanderRadius);
        if (target && a.goTo(target.x, target.y)) a.mode = "walk";
        else a.timer = 2;
      }
    });

    // strike up conversations
    const free = AG.list.filter((a) => !a.inside && (a.mode === "pause" || a.mode === "walk") && a.chatCool < now);
    for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
      const a = free[i], b = free[j];
      if (a.mode === "chat" || b.mode === "chat") continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) < 1.9 * (W.painted ? 2.2 : 1)) AG.startChat(a, b);
    }

    // run conversations
    AG.chats = AG.chats.filter((c) => {
      if (now < c.next) return true;
      c.i++;
      if (c.i >= c.seq.length) {
        [c.a, c.b].forEach((x) => { x.mode = "pause"; x.timer = 1 + Math.random() * 2; x.chatCool = now + (c.married ? 15 : 25) + Math.random() * 20; });
        return false;
      }
      const line = c.seq[c.i];
      AG.bubble(line.who, line.text, 2.6);
      if (c.married && c.i === 0) AG.burst(line.who, 0);
      c.next = now + 2.7;
      return true;
    });

    AG.fx = AG.fx.filter((f) => { f.t += dt; f.y += f.vy * dt; return f.t < f.life; });
  };

  AG.drawables = () => {
    const out = [{ kind: "person", y: AG.avatar.y, box: AG.avatar.sortBox(), draw: (ctx, t) => AG.avatar.draw(ctx, t) }];
    AG.list.forEach((a) => { if (!a.inside) out.push({ kind: "person", y: a.y, box: a.sortBox(), draw: (ctx, t) => a.draw(ctx, t) }); });
    return out;
  };
})();
