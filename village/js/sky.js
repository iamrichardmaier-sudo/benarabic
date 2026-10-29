// Real time of day and real weather (Open-Meteo, no key), plus how they are drawn.
(function () {
  const S = (V.sky = {});
  const cfg = V.cfg;
  const params = new URLSearchParams(location.search);
  S.override = { hour: params.has("hour") ? parseFloat(params.get("hour")) : null, weather: params.get("weather") };

  S.weather = { kind: "clear", intensity: 0, temp: null, wind: 5, label: "Clear", icon: "☀️", place: cfg.location?.label || "" };
  S.sun = { rise: 7 * 60, set: 18 * 60 + 30 };

  const WMO = (code) => {
    if (code === 0) return ["clear", 0, "Clear", "☀️"];
    if (code <= 2) return ["partly", 0.3, "Partly cloudy", "⛅"];
    if (code === 3) return ["cloudy", 0.6, "Overcast", "☁️"];
    if (code === 45 || code === 48) return ["fog", 0.8, "Fog", "🌫️"];
    if (code >= 51 && code <= 57) return ["rain", 0.3, "Drizzle", "🌦️"];
    if (code >= 61 && code <= 67) return ["rain", code >= 65 ? 1 : 0.6, "Rain", "🌧️"];
    if (code >= 71 && code <= 77) return ["snow", code >= 75 ? 1 : 0.6, "Snow", "🌨️"];
    if (code >= 80 && code <= 82) return ["rain", 0.8, "Showers", "🌧️"];
    if (code === 85 || code === 86) return ["snow", 0.8, "Snow showers", "🌨️"];
    if (code >= 95) return ["storm", 1, "Thunderstorm", "⛈️"];
    return ["clear", 0, "Clear", "☀️"];
  };
  const presets = { clear: 0, partly: 2, cloudy: 3, fog: 45, rain: 63, storm: 95, snow: 73, drizzle: 53 };

  const getLocation = () => new Promise((res) => {
    const fallback = cfg.location || { lat: 40.2338, lon: -111.6585, label: "" };
    if (!cfg.useDeviceLocation || !navigator.geolocation) return res(fallback);
    const t = setTimeout(() => res(fallback), 5000);
    try {
      navigator.geolocation.getCurrentPosition(
        (p) => { clearTimeout(t); res({ lat: p.coords.latitude, lon: p.coords.longitude, label: "Here" }); },
        () => { clearTimeout(t); res(fallback); },
        { maximumAge: 3600e3, timeout: 4500 }
      );
    } catch (e) { clearTimeout(t); res(fallback); }
  });

  S.fetchWeather = async () => {
    if (S.override.weather) {
      const [kind, intensity, label, icon] = WMO(presets[S.override.weather] ?? 0);
      Object.assign(S.weather, { kind, intensity, label, icon, temp: S.weather.temp ?? 60 });
      return;
    }
    try {
      const loc = await getLocation();
      const unit = cfg.temperatureUnit === "celsius" ? "celsius" : "fahrenheit";
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code,wind_speed_10m&daily=sunrise,sunset&forecast_days=1&timezone=auto&temperature_unit=${unit}`;
      const r = await fetch(url);
      const d = await r.json();
      const [kind, intensity, label, icon] = WMO(d.current.weather_code);
      Object.assign(S.weather, { kind, intensity, label, icon, temp: Math.round(d.current.temperature_2m), wind: d.current.wind_speed_10m, place: loc.label, unit: unit === "celsius" ? "°C" : "°F" });
      const hm = (s) => { const t = s.split("T")[1].split(":"); return +t[0] * 60 + +t[1]; };
      if (d.daily?.sunrise?.[0]) S.sun = { rise: hm(d.daily.sunrise[0]), set: hm(d.daily.sunset[0]) };
    } catch (e) {
      S.weather.label = "Weather offline";
    }
  };

  S.minutes = () => {
    if (S.override.hour != null) return S.override.hour * 60;
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  };

  // 1 = full day, 0 = full night. golden = strength of sunrise/sunset glow.
  S.light = () => {
    const m = S.minutes(), { rise, set } = S.sun, ramp = 50;
    let day;
    if (m < rise - ramp || m > set + ramp) day = 0;
    else if (m < rise + ramp) day = (m - (rise - ramp)) / (2 * ramp);
    else if (m > set - ramp) day = 1 - (m - (set - ramp)) / (2 * ramp);
    else day = 1;
    const golden = Math.max(0, 1 - Math.min(Math.abs(m - rise), Math.abs(m - set)) / 80);
    return { day, night: 1 - day, golden };
  };
  S.isNight = () => S.light().night > 0.5;

  S.timeLabel = () => {
    const m = S.minutes(), h = Math.floor(m / 60) % 24, mm = Math.floor(m % 60);
    return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
  };
  S.phaseLabel = () => {
    const { day, golden } = S.light(), m = S.minutes();
    if (day < 0.2) return "Night";
    if (golden > 0.4) return m < 12 * 60 ? "Dawn" : "Sunset";
    return m < 12 * 60 ? "Morning" : m < 17 * 60 ? "Afternoon" : "Evening";
  };

  /* ---------- drawing ---------- */
  const drops = [], flakes = [], clouds = [];
  let flash = 0, nextFlash = 4;
  let mask = null;

  S.update = (dt, w, h) => {
    const wx = S.weather, wind = V.clamp((wx.wind || 5) / 30, 0.05, 1.2);
    const area = (w * h) / (1280 * 720);
    const want = (k) => Math.round((k === "rain" || k === "storm" ? 140 + 260 * wx.intensity : k === "snow" ? 80 + 140 * wx.intensity : 0) * Math.min(area, 2));
    const nr = wx.kind === "rain" || wx.kind === "storm" ? want("rain") : 0;
    while (drops.length < nr) drops.push({ x: Math.random() * w, y: Math.random() * h, s: 600 + Math.random() * 300, l: 10 + Math.random() * 10 });
    drops.length = Math.min(drops.length, nr);
    drops.forEach((d) => { d.y += d.s * dt; d.x += d.s * dt * wind * 0.25; if (d.y > h) { d.y = -20; d.x = Math.random() * w; } if (d.x > w) d.x -= w; });
    const ns = wx.kind === "snow" ? want("snow") : 0;
    while (flakes.length < ns) flakes.push({ x: Math.random() * w, y: Math.random() * h, s: 30 + Math.random() * 40, r: 1.2 + Math.random() * 2.2, p: Math.random() * 6 });
    flakes.length = Math.min(flakes.length, ns);
    flakes.forEach((f) => { f.p += dt; f.y += f.s * dt; f.x += Math.sin(f.p) * 20 * dt + wind * 15 * dt; if (f.y > h) { f.y = -5; f.x = Math.random() * w; } if (f.x > w) f.x -= w; });
    const nc = { partly: 4, cloudy: 7, rain: 7, storm: 8, snow: 6, fog: 3 }[wx.kind] || 1;
    const B = V.world.bounds;
    while (clouds.length < nc) clouds.push({ x: B.x0 + Math.random() * (B.x1 - B.x0), y: B.y0 + Math.random() * (B.y1 - B.y0), r: 160 + Math.random() * 200 });
    clouds.length = nc;
    clouds.forEach((c) => { c.x += (8 + wind * 30) * dt; if (c.x > B.x1 + 400) c.x = B.x0 - 400; });
    if (wx.kind === "storm") {
      nextFlash -= dt;
      if (nextFlash <= 0) { flash = 1; nextFlash = 5 + Math.random() * 10; V.audio && V.audio.sfx("thunder"); }
    }
    flash = Math.max(0, flash - dt * 2.5);
  };

  // World space, right after the ground: soft cloud shadows sliding over the souq.
  S.drawGround = (ctx) => {
    const k = S.weather.kind === "clear" ? 0.05 : 0.11;
    clouds.forEach((c) => {
      const g = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, c.r);
      g.addColorStop(0, `rgba(60,50,70,${k})`); g.addColorStop(1, "rgba(60,50,70,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r, c.r * 0.5, 0, 0, 7); ctx.fill();
    });
  };

  // Screen space: daylight tint, night with lantern light, weather.
  S.drawOverlay = (ctx, w, h, toScreen, zoom, lights, t) => {
    const L = S.light(), wx = S.weather;
    const gray = { partly: 0.15, cloudy: 0.35, rain: 0.5, storm: 0.65, snow: 0.3, fog: 0.35 }[wx.kind] || 0;
    let tint = V.mix("#ffffff", "#ffc994", L.golden * 0.75 * (1 - gray * 0.6));
    tint = V.mix(tint, "#b9bfd0", gray * 0.7);
    ctx.save();
    ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = tint; ctx.fillRect(0, 0, w, h);
    ctx.restore();

    const dark = Math.max(L.night * 0.68, gray * 0.18 * L.day);
    if (dark > 0.01) {
      const scale = 0.5;
      if (!mask || mask.width !== Math.ceil(w * scale) || mask.height !== Math.ceil(h * scale)) { mask = document.createElement("canvas"); mask.width = Math.ceil(w * scale); mask.height = Math.ceil(h * scale); }
      const m = mask.getContext("2d");
      m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = "source-over";
      m.clearRect(0, 0, mask.width, mask.height);
      m.fillStyle = `rgba(16,20,56,${dark})`; m.fillRect(0, 0, mask.width, mask.height);
      if (L.night > 0.05) {
        m.globalCompositeOperation = "destination-out";
        lights.forEach((l) => {
          const p = toScreen(l.x, l.y), r = l.r * zoom * 1.5 * scale;
          const x = p.x * scale, y = p.y * scale;
          if (x < -r || y < -r || x > mask.width + r || y > mask.height + r) return;
          const flick = l.kind === "lantern" ? 0.92 + Math.sin(t * 7 + l.x) * 0.05 : 1;
          const g = m.createRadialGradient(x, y, 0, x, y, r * flick);
          g.addColorStop(0, `rgba(0,0,0,${0.9 * L.night})`); g.addColorStop(1, "rgba(0,0,0,0)");
          m.fillStyle = g; m.beginPath(); m.arc(x, y, r, 0, 7); m.fill();
        });
      }
      ctx.drawImage(mask, 0, 0, w, h);
      if (L.night > 0.05) {
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        lights.forEach((l) => {
          const p = toScreen(l.x, l.y), r = l.r * zoom * (l.kind === "window" ? 0.6 : 1);
          if (p.x < -r || p.y < -r || p.x > w + r || p.y > h + r) return;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          g.addColorStop(0, `rgba(255,170,80,${0.28 * L.night})`); g.addColorStop(1, "rgba(255,170,80,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
        });
        ctx.restore();
      }
    }

    // weather
    if (drops.length) {
      ctx.save(); ctx.strokeStyle = L.night > 0.5 ? "rgba(190,200,230,.45)" : "rgba(110,130,170,.5)"; ctx.lineWidth = 1.2; ctx.beginPath();
      const wind = V.clamp((wx.wind || 5) / 30, 0.05, 1.2) * 0.25;
      drops.forEach((d) => { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.l * wind, d.y - d.l); });
      ctx.stroke(); ctx.restore();
    }
    if (flakes.length) {
      ctx.save(); ctx.fillStyle = "rgba(255,255,255,.9)";
      flakes.forEach((f) => { ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill(); });
      ctx.restore();
    }
    if (wx.kind === "fog") {
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const y = h * (0.3 + i * 0.25) + Math.sin(t * 0.1 + i) * 30;
        const g = ctx.createLinearGradient(0, y - 120, 0, y + 120);
        g.addColorStop(0, "rgba(240,240,235,0)"); g.addColorStop(0.5, `rgba(240,240,235,${0.32 * wx.intensity})`); g.addColorStop(1, "rgba(240,240,235,0)");
        ctx.fillStyle = g; ctx.fillRect(0, y - 120, w, 240);
      }
      ctx.restore();
    }
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,245,${flash * 0.55})`; ctx.fillRect(0, 0, w, h); }
  };
})();
