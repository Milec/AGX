// AGX Market Agent — Cloudflare Worker Cron
// Fires every 5 real minutes but only acts when 2+ game-hours have elapsed
// so 48x time compression doesn't exhaust Gemini's free tier quota.

const SUPA_URL = "https://ifcensohczakjhqbzzkv.supabase.co";

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAgent(env));
  }
};

async function supaGet(key, env) {
  const r = await fetch(
    `${SUPA_URL}/rest/v1/kv?key=eq.${encodeURIComponent(key)}&select=value`,
    { headers: {
      apikey: env.SUPA_ANON,
      Authorization: "Bearer " + env.SUPA_ANON
    }}
  );
  const d = await r.json();
  return d && d[0] ? d[0].value : null;
}

async function supaSet(key, value, env) {
  await fetch(`${SUPA_URL}/rest/v1/kv`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPA_ANON,
      Authorization: "Bearer " + env.SUPA_ANON,
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
  });
}

async function runAgent(env) {
  const cfg = await supaGet("cfg", env);
  if (!cfg) return;

  // Respect the agent toggle (independent of market clock pause)
  if (cfg.agentEnabled === false) return;

  // Calculate current game-time
  const now = Date.now();
  const gameSpeed = cfg.paused ? 0 : (cfg.speed || 1);
  const anchorG = cfg.anchorG || now;
  const anchorR = cfg.anchorR || now;
  const gameNow = cfg.paused
    ? anchorG
    : anchorG + (now - anchorR) * gameSpeed;

  // Only act if 2+ game-hours have elapsed since last agent action
  const lastAgentGameTime = cfg.lastAgentGameTime || 0;
  const gameHoursElapsed = (gameNow - lastAgentGameTime) / 3600000;
  if (gameHoursElapsed < 2) return;

  // Load recent events for context
  const events = await supaGet("ev", env) || [];
  const recentEvents = events.slice(-8).map(e => {
    if (e.t === "news" || e.t === "regime") return `[${e.t}] ${e.body || e.label || ""}`;
    if (e.t === "pump") return `[pump] ${e.sym} ${e.mag > 0 ? "+" : ""}${(e.mag*100).toFixed(0)}%`;
    if (e.t === "spump") return `[sector pump] ${e.sec} ${e.mag > 0 ? "+" : ""}${(e.mag*100).toFixed(0)}%`;
    return `[${e.t}]`;
  }).join("\n");

  const regimes = events.filter(e => e.t === "regime");
  const currentRegime = regimes.length ? regimes[regimes.length-1].k : "neutral";

  const prompt = `You are the autonomous market intelligence system for the Algalterian Galactic Exchange, a sci-fi stock exchange in the Starfinder RPG universe.

Current market regime: ${currentRegime}
Recent market events:
${recentEvents || "No recent events."}

Factions and their tickers:
- Epsilon Enclave (rogue AI): AIDA, MECH, ANDR
- The Directorate (surveillance): INFO, SPYG, DTNT
- Algalterian Empire: ABDR, BANK, VESK
- Bradtopia (biotech/cloning): VITX, GENM, XNTH
- Kurogane (private security): HELL, SKYF, AEGI, SECC
- Breakout stocks: GRAV, PLSM, ARNA, MAGI
- Crypto: DRFC, ABIT, VDGE, GAPC

Generate exactly ONE market event. Return ONLY valid JSON, no other text:

{
  "type": "news",
  "headline": "string under 120 chars"
}

OR

{
  "type": "regime",
  "regime": "bull|bear|volatile|calm|neutral|crash|boom",
  "headline": "string under 120 chars"
}

OR

{
  "type": "pump",
  "sym": "TICKER",
  "mag": number between -0.20 and 0.20,
  "duration_mins": number between 60 and 480,
  "headline": "string under 120 chars",
  "silent": false
}

OR

{
  "type": "sector_pump",
  "sector": "Defense|Tech|Biotech|Finance|Starships|Mining|Energy|Consumer|Media|Logistics|Terraform|Magitech",
  "mag": number between -0.20 and 0.20,
  "duration_mins": number between 60 and 480,
  "headline": "string under 120 chars",
  "silent": false
}

Rules:
- Prefer "news" (no price effect) most of the time — about 60% of events
- Regime changes should be rare and narratively justified
- Pump magnitudes should feel realistic: 0.05-0.10 for normal moves, up to 0.20 for major events
- Headlines must fit the sci-fi Starfinder setting and reference the factions naturally
- Be narratively consistent with recent events`;

  let ev;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.85, maxOutputTokens: 300 }
        })
      }
    );
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return;
    ev = JSON.parse(match[0]);
  } catch(e) {
    return; // Gemini down or bad JSON — skip silently
  }

  // Validate
  if (!["news","regime","pump","sector_pump"].includes(ev.type)) return;
  if (ev.mag !== undefined) ev.mag = Math.max(-0.20, Math.min(0.20, ev.mag));
  if (ev.duration_mins !== undefined)
    ev.duration_mins = Math.max(60, Math.min(480, ev.duration_mins));

  // Build the game event (same format as GM console pushEv)
  const gameEvent = { at: now, g: gameNow, src: "agent" };

  if (ev.type === "news") {
    gameEvent.t = "news";
    gameEvent.body = ev.headline;
  } else if (ev.type === "regime") {
    gameEvent.t = "regime";
    gameEvent.k = ev.regime;
    gameEvent.d = ["bull","boom"].includes(ev.regime) ? 0.15 : -0.15;
    gameEvent.xv = ["volatile","crash"].includes(ev.regime) ? 0.3 : 0;
    gameEvent.start = gameNow;
    gameEvent.end = gameNow + 864e5 * 7;
    gameEvent.seed = Math.floor(Math.random() * 0xFFFFFF);
    gameEvent.label = ev.regime.charAt(0).toUpperCase() + ev.regime.slice(1);
    gameEvent.body = ev.headline;
  } else if (ev.type === "pump") {
    gameEvent.t = "pump";
    gameEvent.sym = ev.sym;
    gameEvent.mag = ev.mag;
    gameEvent.dur = ev.duration_mins * 60000;
    gameEvent.silent = ev.silent || false;
    if (ev.headline && !ev.silent) gameEvent.body = ev.headline;
  } else if (ev.type === "sector_pump") {
    gameEvent.t = "spump";
    gameEvent.sec = ev.sector;
    gameEvent.mag = ev.mag;
    gameEvent.dur = ev.duration_mins * 60000;
    gameEvent.silent = ev.silent || false;
    if (ev.headline && !ev.silent) gameEvent.body = ev.headline;
  }

  // Write event and update timestamp
  const existing = await supaGet("ev", env) || [];
  existing.push(gameEvent);
  if (existing.length > 500) existing.splice(0, existing.length - 500);
  await supaSet("ev", existing, env);
  cfg.lastAgentGameTime = gameNow;
  cfg.lastAgentAt = now;
  await supaSet("cfg", cfg, env);
}
