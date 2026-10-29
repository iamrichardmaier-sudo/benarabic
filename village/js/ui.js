// HUD, place list, room sheet, toasts, deep links.
(function () {
  const $ = (id) => document.getElementById(id);
  const cfg = V.cfg, AG = V.agents, W = V.world;
  const UI = (V.ui = { openPlace: null });

  UI.alias = (id) => {
    const e = cfg.ownerEmail || "you@gmail.com", at = e.indexOf("@");
    return at < 0 ? e : e.slice(0, at) + "+" + id + e.slice(at);
  };
  const mailto = (id, subject) => `mailto:${UI.alias(id)}${subject ? "?subject=" + encodeURIComponent(subject) : ""}`;
  const wa = (name) => (cfg.whatsappNumber ? `https://wa.me/${cfg.whatsappNumber}?text=${encodeURIComponent(name + ": ")}` : null);
  const ago = (iso) => {
    const d = (Date.now() - new Date(iso).getTime()) / 60000;
    if (!isFinite(d)) return "";
    if (d < 1) return "just now"; if (d < 60) return Math.round(d) + " min ago";
    if (d < 1440) return Math.round(d / 60) + " h ago"; return Math.round(d / 1440) + " d ago";
  };
  const nameOf = (id) => (id === "you" ? "You" : AG.byId[id]?.data.name || id);

  UI.toast = (text) => {
    const el = document.createElement("div");
    el.className = "toast panel"; el.textContent = text;
    $("toasts").appendChild(el);
    setTimeout(() => el.remove(), 4200);
  };

  UI.init = () => {
    $("vName").textContent = cfg.villageName || "Souq al-Qamar";
    $("vNameAr").textContent = cfg.villageNameArabic || "";
    document.title = cfg.villageName || document.title;
    $("btnPlaces").onclick = () => { V.audio.sfx("click"); UI.toggleSheet("placesSheet"); UI.renderPlaces(); };
    const snd = $("btnSound");
    const paint = () => { snd.textContent = V.audio.on ? "🔊" : "🔇"; snd.setAttribute("aria-pressed", V.audio.on); };
    paint();
    snd.onclick = () => { V.audio.toggle(); paint(); };
    document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => UI.close(b.dataset.close)));
    window.addEventListener("hashchange", UI.fromHash);
    setTimeout(() => ($("hint").style.opacity = 0.0), 9000);
  };

  UI.toggleSheet = (id) => { const el = $(id); el.classList.contains("open") ? UI.close(id) : UI.open(id); };
  UI.open = (id) => {
    ["placesSheet", "roomSheet"].forEach((s) => s !== id && UI.close(s));
    $(id).classList.add("open"); $(id).setAttribute("aria-hidden", "false");
  };
  UI.close = (id) => {
    $(id).classList.remove("open"); $(id).setAttribute("aria-hidden", "true");
    if (id === "roomSheet") { UI.openPlace = null; try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} }
  };
  UI.anyOpen = () => document.querySelector(".sheet.open");

  UI.hud = () => {
    $("clock").textContent = `${V.sky.timeLabel()} · ${V.sky.phaseLabel()}`;
    const wx = V.sky.weather;
    const icon = V.sky.isNight() && (wx.kind === "clear" || wx.kind === "partly") ? "🌙" : wx.icon;
    $("weather").textContent = `${icon} ${wx.temp != null ? wx.temp + (wx.unit || "°F") + " " : ""}${wx.label}`;
    const t = AG.avatar.tile();
    let near = null, nd = 1e9;
    W.places.forEach((p) => { const d = Math.hypot(p.doorTile.x - t.x, p.doorTile.y - t.y); if (d < nd) { nd = d; near = p; } });
    $("place").textContent = nd < W.nearDist ? "Near " + UI.placeTitle(near) : Math.hypot(t.x - W.spots.fountain.x, t.y - W.spots.fountain.y) < W.nearDist * 1.2 ? "By the fountain" : "In the souq";
  };

  UI.placeTitle = (p) => {
    if (p.kind !== "house") return p.name;
    const r = AG.residents(p.id);
    if (!r.length) return "Empty house";
    return (r.length === 2 && r[0].data.spouse === r[1].id ? `${r[0].data.name} & ${r[1].data.name}'s house` : r.map((a) => a.data.name).join(", ") + (r.length > 1 ? "'s house" : "'s house"));
  };

  UI.renderPlaces = () => {
    const list = $("placeList");
    list.innerHTML = "";
    const order = [...W.places].sort((a, b) => (a.kind === "house") - (b.kind === "house") || AG.residents(b.id).length - AG.residents(a.id).length);
    order.forEach((p) => {
      const r = AG.residents(p.id);
      const msg = r.some((a) => AG.hasMessage(a.id));
      const b = document.createElement("button");
      b.className = "place-btn";
      b.innerHTML = `<span class="ico">${p.icon}</span><span><b>${V.esc(UI.placeTitle(p))}</b><br><span class="who">${r.length ? V.esc(r.map((a) => a.data.name + (AG.st(a.id).status === "working" ? " (working)" : "")).join(" · ")) : p.kind === "house" ? "Ready for an agent" : ""}</span></span><span class="badge">${msg ? "!" : ""}</span>`;
      b.onclick = () => UI.enter(p.id);
      list.appendChild(b);
    });
  };

  // Jump straight into a building.
  UI.enter = (placeId) => {
    const p = W.place(placeId);
    if (!p) return;
    AG.avatar.place(p.doorTile.x, p.doorTile.y);
    AG.avatar.facing = -1;
    V.cam && (V.cam.free = false);
    UI.openPlace = p;
    V.audio.sfx("door");
    $("roomTitle").textContent = UI.placeTitle(p);
    $("roomTitleAr").textContent = p.ar || "";
    UI.renderRoom();
    UI.open("roomSheet");
    try { history.replaceState(null, "", "#room-" + p.id); } catch (e) {}
  };

  UI.fromHash = () => {
    const h = location.hash.slice(1);
    if (h.startsWith("room-")) UI.enter(h.slice(5));
    else if (h.startsWith("agent-") && AG.byId[h.slice(6)]) UI.enter(AG.byId[h.slice(6)].home.id);
  };

  const hearts = (n) => { const k = n % 5; return "♥".repeat(k) + "♡".repeat(5 - k); };

  const card = (a) => {
    const st = AG.st(a.id), d = a.data, msg = AG.hasMessage(a.id);
    const others = AG.list.filter((o) => o !== a);
    const waLink = wa(d.name);
    const log = AG.activityFor(a.id);
    return `<div class="card" data-agent="${a.id}">
      <div class="top"><canvas class="portrait" width="128" height="128" data-portrait="${a.id}"></canvas>
        <div><h3>${V.esc(d.name)}${d.spouse && AG.byId[d.spouse] ? ` <span class="job">· married to ${V.esc(AG.byId[d.spouse].data.name)}</span>` : ""}</h3><div class="job">${V.esc(d.job)}</div></div></div>
      <div class="actions">
        <span class="status ${st.status === "working" ? "working" : "idle"}">${st.status === "working" ? "✎ Working" + (st.task ? `: ${V.esc(st.task)}` : "") : a.inside ? "Inside" : "Out in the souq"}</span>
        ${msg ? `<span class="status msg">! ${V.esc(st.messageNote || "New message")}</span>` : ""}
        ${d.placeholder ? `<span class="status">Sample resident</span>` : ""}
      </div>
      <p><b>Personality:</b> ${V.esc(d.personality || "")}</p>
      <div class="hearts" aria-label="${AG.hearts(a.id) % 5} of 5 hearts toward the next level">${hearts(AG.hearts(a.id))}</div>
      <div class="stats">
        <div><b>${AG.level(a.id)}</b><span>Level</span></div>
        <div><b>${AG.hearts(a.id)}</b><span>Hearts</span></div>
        <div><b>${st.tasksDone || 0}</b><span>Tasks</span></div>
        <div><b>${AG.friends(a.id)}</b><span>Friends</span></div>
      </div>
      <div class="addr">✉️ <code>${V.esc(UI.alias(a.id))}</code><button class="btn" data-copy="${V.esc(UI.alias(a.id))}">Copy</button></div>
      <div class="actions">
        <a class="btn primary" href="${mailto(a.id)}">Email ${V.esc(d.name)}</a>
        ${waLink ? `<a class="btn" href="${waLink}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
        <button class="btn" data-heart="${a.id}">♥ Give a heart</button>
        ${msg ? `<button class="btn" data-read="${a.id}">Mark read</button>` : ""}
      </div>
      ${others.length ? `<div class="talk"><label for="talk-${a.id}">Ask ${V.esc(d.name)} to talk to</label>
        <select id="talk-${a.id}" data-talk="${a.id}">${others.map((o) => `<option value="${o.id}">${V.esc(o.data.name)}</option>`).join("")}</select>
        <a class="btn" data-talk-send="${a.id}" href="${mailto(a.id, others[0].data.name + ": ")}">Write it</a></div>` : ""}
      ${log.length ? `<h4>Recent mail</h4><ul class="log">${log.map((x) => `<li><time>${ago(x.time)} · ${V.esc(nameOf(x.from))} → ${V.esc(nameOf(x.to))}</time>${V.esc(x.subject)}</li>`).join("")}</ul>` : ""}
    </div>`;
  };

  UI.renderRoom = () => {
    const p = UI.openPlace;
    if (!p) return;
    const r = AG.residents(p.id);
    let html = r.map(card).join("");
    if (p.kind === "library") {
      const shelves = cfg.library?.shelves || [];
      html += `<div class="card"><h4>On the shelves</h4>${shelves.length ? `<div class="actions">${shelves.map((s) => `<a class="btn" href="${V.esc(s.url)}" target="_blank" rel="noopener">${V.esc(s.label)}</a>`).join("")}</div>` : `<p class="note">Add your school sites to <code>library.shelves</code> in config.js and they appear here.</p>`}</div>`;
    }
    if (p.kind === "post") {
      html += `<div class="card"><h4>Everyone's mail address</h4><p class="note">All of these land in your one inbox. To have two agents talk, put the other agent's name in the subject.</p>
        <ul class="log">${AG.list.map((a) => `<li><b>${V.esc(a.data.name)}</b> <span class="addr"><code>${V.esc(UI.alias(a.id))}</code><button class="btn" data-copy="${V.esc(UI.alias(a.id))}">Copy</button></span></li>`).join("")}</ul></div>`;
      const all = (AG.state.activity || []).slice(-20).reverse();
      html += `<div class="card"><h4>Mail log</h4>${all.length ? `<ul class="log">${all.map((x) => `<li><time>${ago(x.time)} · ${V.esc(nameOf(x.from))} → ${V.esc(nameOf(x.to))}</time>${V.esc(x.subject)}</li>`).join("")}</ul>` : `<p class="note">No mail yet.</p>`}</div>`;
    }
    if (p.kind === "qahwa") {
      const talks = (AG.state.activity || []).filter((x) => AG.byId[x.from] && AG.byId[x.to]).slice(-12).reverse();
      html += `<div class="card"><h4>Overheard at the coffee house</h4>${talks.length ? `<ul class="log">${talks.map((x) => `<li><time>${ago(x.time)} · ${V.esc(nameOf(x.from))} → ${V.esc(nameOf(x.to))}</time>${V.esc(x.subject)}</li>`).join("")}</ul>` : `<p class="note">When agents mail each other, they meet here.</p>`}</div>`;
    }
    if (p.kind === "house" && !r.length) {
      html += `<div class="card"><h4>This house is empty</h4><p class="note">To move an agent in, add them to <code>data/agents.js</code> with <code>home: "${p.id}"</code>. Two agents with the same home and each other as <code>spouse</code> live here together.</p></div>`;
    }
    const box = $("roomContent");
    box.innerHTML = html;
    box.style.display = "flex"; box.style.flexDirection = "column"; box.style.gap = "14px";
    box.querySelectorAll("[data-portrait]").forEach((c) => UI.portrait(c, AG.byId[c.dataset.portrait]));
    box.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => {
      const text = b.dataset.copy;
      const done = () => { b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1500); };
      try { navigator.clipboard.writeText(text).then(done, () => UI.selectText(b.previousElementSibling)); } catch (e) { UI.selectText(b.previousElementSibling); }
    }));
    box.querySelectorAll("[data-heart]").forEach((b) => (b.onclick = () => { AG.giveHeart(b.dataset.heart); UI.renderRoom(); }));
    box.querySelectorAll("[data-read]").forEach((b) => (b.onclick = () => { AG.markRead(b.dataset.read); UI.renderRoom(); }));
    box.querySelectorAll("[data-talk]").forEach((s) => (s.onchange = () => {
      const link = box.querySelector(`[data-talk-send="${s.dataset.talk}"]`);
      link.href = mailto(s.dataset.talk, AG.byId[s.value].data.name + ": ");
    }));
  };
  UI.selectText = (el) => { try { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {} };

  UI.portrait = (c, a) => {
    const g = c.getContext("2d");
    g.fillStyle = V.mix(a.look.robe, "#fbf1dc", 0.75); g.fillRect(0, 0, 128, 128);
    const img = V.assets.get("agents/" + a.id + "/portrait");
    if (img) { const s = Math.max(128 / img.width, 128 / img.height); g.drawImage(img, (128 - img.width * s) / 2, (128 - img.height * s) / 2, img.width * s, img.height * s); return; }
    V.art.person(g, 60, 214, Object.assign({}, a.look, { facing: 1, walk: null, seed: a.seed, scale: 3.6 }), 0);
  };
})();
