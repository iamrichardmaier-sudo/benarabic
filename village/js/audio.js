// Sound slots. Add files named in config.audio and they play; missing files stay silent.
(function () {
  const cfg = V.cfg.audio || {};
  const A = (V.audio = { on: V.store.get("sound", false), tracks: {}, current: null });

  const make = (src, loop) => {
    if (!src) return null;
    const a = new Audio();
    a.preload = "none"; a.loop = loop; a.src = src; a.ok = true;
    a.addEventListener("error", () => (a.ok = false));
    return a;
  };
  Object.entries(cfg.tracks || {}).forEach(([k, src]) => (A.tracks[k] = make(src, true)));
  const sfx = {};
  Object.entries(cfg.sfx || {}).forEach(([k, src]) => (sfx[k] = make(src, false)));

  const vol = () => cfg.volume ?? 0.6;
  const fade = (a, to, ms = 1200) => {
    if (!a || !a.ok) return;
    const from = a.volume, t0 = performance.now();
    if (to > 0 && a.paused) a.play().catch(() => (a.ok = false));
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      a.volume = V.clamp(from + (to - from) * k, 0, 1);
      if (k < 1) requestAnimationFrame(step);
      else if (to === 0) a.pause();
    };
    step();
  };

  // Which ambience fits right now.
  A.pickAmbience = () => {
    const wx = V.sky.weather.kind;
    return { ambience: V.sky.isNight() ? "night" : "day", rain: wx === "rain" || wx === "storm" };
  };

  A.refresh = () => {
    const want = A.on ? A.pickAmbience() : { ambience: null, rain: false };
    ["day", "night"].forEach((k) => {
      const a = A.tracks[k]; if (!a) return;
      if (want.ambience === k) { if (a.paused) a.volume = 0; fade(a, vol() * 0.7); } else if (!a.paused) fade(a, 0);
    });
    const r = A.tracks.rain;
    if (r) { if (want.rain) { if (r.paused) r.volume = 0; fade(r, vol() * 0.6); } else if (!r.paused) fade(r, 0); }
    const m = A.tracks.music;
    if (m) { if (A.on) { if (m.paused) m.volume = 0; fade(m, vol() * 0.45); } else if (!m.paused) fade(m, 0); }
  };

  A.toggle = () => { A.on = !A.on; V.store.set("sound", A.on); A.refresh(); return A.on; };

  A.sfx = (name) => {
    const a = sfx[name];
    if (!A.on || !a || !a.ok) return;
    try { a.currentTime = 0; a.volume = vol(); a.play().catch(() => (a.ok = false)); } catch (e) {}
  };
})();
