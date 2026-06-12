# AGX Deployment — Claude Code Instructions

You have access to a GitHub repository. Your job is to deploy the Algalterian
Galactic Exchange to Cloudflare Pages + a Cloudflare Worker agent, backed by
Supabase. Everything should be set up so that pushing to main auto-deploys.

The HTML file is in this repo as: algalterian-galactic-exchange.html

---

## CREDENTIALS

Supabase URL:          https://ifcensohczakjhqbzzkv.supabase.co
Supabase anon key:     sb_publishable_Y2-6dIwfLKBd2B5c8jUoRw_5AgeuLKE
Supabase service key:  sb_secret_MMOyJN3XrJvMEI2GsbuBqg_2QeyuF6N
Cloudflare API token:  cfut_GfC1Q1CW2lt5aI9OdFyQBDnzjIiau0ThxpZrbnyxc7d0f3dd
Cloudflare account ID: f9de2a9d86aabf96d354151dd006e5f8
Gemini API key:        AQ.Ab8RN6L9zCT98mBnLmSwxeoU5Hs8ANwGZ1-h_tlEC45PFdEAUQ

---

## STEP 1 — Create Supabase table

Hit this endpoint to create the kv table. Do it via curl:

```bash
curl -X POST "https://ifcensohczakjhqbzzkv.supabase.co/rest/v1/rpc/query" \
  -H "apikey: sb_secret_MMOyJN3XrJvMEI2GsbuBqg_2QeyuF6N" \
  -H "Authorization: Bearer sb_secret_MMOyJN3XrJvMEI2GsbuBqg_2QeyuF6N" \
  -H "Content-Type: application/json"
```

If that doesn't work, use the Supabase management API to run this SQL:

```sql
create table if not exists kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);
alter table kv enable row level security;
create policy "public_all" on kv for all using (true) with check (true);
create index if not exists kv_key_prefix on kv (key text_pattern_ops);
```

Use the Supabase SQL API endpoint:
POST https://ifcensohczakjhqbzzkv.supabase.co/rest/v1/rpc
Or just confirm it's been created and move on if you can't run DDL via REST
(the user can paste it into the Supabase dashboard SQL editor manually as a
fallback — tell them if needed).

---

## STEP 2 — Modify the HTML file

Open algalterian-galactic-exchange.html and find this comment block:

```
/* ── storage layer: tries window.storage (shared/web), then localStorage
```

Replace everything from that comment through to the closing `};` of the SG
object (just before `/* ── ETF COMPOSITION MAP`) with this Supabase client:

```javascript
// ── SUPABASE STORAGE ─────────────────────────────────────────────────────
const SUPA_URL = "https://ifcensohczakjhqbzzkv.supabase.co";
const SUPA_ANON = "sb_publishable_Y2-6dIwfLKBd2B5c8jUoRw_5AgeuLKE";

async function supaReq(method, key, value) {
  const h = {
    "Content-Type": "application/json",
    "apikey": SUPA_ANON,
    "Authorization": "Bearer " + SUPA_ANON
  };
  if (method === "GET") {
    const r = await fetch(
      SUPA_URL + "/rest/v1/kv?key=eq." + encodeURIComponent(key) + "&select=value",
      { headers: h }
    );
    const d = await r.json();
    return d && d[0] ? d[0].value : null;
  }
  if (method === "SET") {
    await fetch(SUPA_URL + "/rest/v1/kv", {
      method: "POST",
      headers: { ...h, "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
    });
    return true;
  }
  if (method === "DEL") {
    await fetch(
      SUPA_URL + "/rest/v1/kv?key=eq." + encodeURIComponent(key),
      { method: "DELETE", headers: h }
    );
    return true;
  }
  if (method === "LIST") {
    const r = await fetch(
      SUPA_URL + "/rest/v1/kv?key=like=" + encodeURIComponent(key + "%") + "&select=key&limit=200",
      { headers: h }
    );
    const d = await r.json();
    return Array.isArray(d) ? d.map(x => x.key) : [];
  }
}

let SG_MODE = "shared";
const SG = {
  async get(k)   { try { return await supaReq("GET", k); }      catch(e) { return null; } },
  async set(k,v) { try { return await supaReq("SET", k, v); }   catch(e) { return false; } },
  async del(k)   { try { return await supaReq("DEL", k); }      catch(e) {} },
  async list(p)  { try { return await supaReq("LIST", p); }     catch(e) { return []; } },
  async probe()  { SG_MODE = "shared"; STORAGE_OK = true; return true; }
};
```

Also find the `renderAuth` function and remove or simplify the storage-mode
banner — with Supabase it's always shared, so the old localStorage/memory
fallback messaging is no longer needed. Replace the banner with a simple
connecting indicator that disappears once login succeeds.

---

## STEP 3 — Add GM agent toggle to the HTML

Find the `ensureCfg` function and add these two fields to the default CFG:

```javascript
agentEnabled: true,
lastAgentGameTime: 0,
```

Find the `migrateCfg` function and add:

```javascript
if (c && c.agentEnabled === undefined) c.agentEnabled = true;
if (c && !c.lastAgentGameTime) c.lastAgentGameTime = 0;
```

In the GM admin console render function, find the market clock pause button
and add an agent toggle button next to it:

```javascript
`<button class="btn ${CFG.agentEnabled!==false?"amber":"ghost"}"
  onclick="adToggleAgent()">
  ${CFG.agentEnabled!==false?"🤖 AGENT ON":"🤖 AGENT OFF"}
</button>`
```

Add the handler function near the other `ad*` admin functions:

```javascript
async function adToggleAgent(){
  CFG = migrateCfg(await SG.get("cfg")) || CFG;
  CFG.agentEnabled = CFG.agentEnabled === false ? true : false;
  await SG.set("cfg", CFG);
  toast(CFG.agentEnabled !== false
    ? "Market agent enabled." : "Market agent paused.");
  renderApp(); go("admin");
}
```

---

## STEP 4 — Create the Gemini agent Worker

Create the file `agent-worker/index.js` in the repo:

```javascript
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
      Authorization: "Bearer " + env.SUPA_SERVICE
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
      Authorization: "Bearer " + env.SUPA_SERVICE,
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
```

Create `agent-worker/wrangler.toml`:

```toml
name = "agx-market-agent"
main = "index.js"
compatibility_date = "2024-01-01"
account_id = "f9de2a9d86aabf96d354151dd006e5f8"

[triggers]
crons = ["*/5 * * * *"]
```

---

## STEP 5 — GitHub Actions workflows

Create `.github/workflows/deploy-pages.yml`:

```yaml
name: Deploy AGX to Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: f9de2a9d86aabf96d354151dd006e5f8
          projectName: algalterian-galactic-exchange
          directory: dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}

      - name: Copy HTML to dist
        run: |
          mkdir -p dist
          cp algalterian-galactic-exchange.html dist/index.html
```

Create `.github/workflows/deploy-worker.yml`:

```yaml
name: Deploy AGX Market Agent Worker

on:
  push:
    branches: [main]
    paths:
      - 'agent-worker/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy Worker
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: agent-worker
        env:
          CLOUDFLARE_ACCOUNT_ID: f9de2a9d86aabf96d354151dd006e5f8
          SUPA_ANON: ${{ secrets.SUPA_ANON }}
          SUPA_SERVICE: ${{ secrets.SUPA_SERVICE }}
          GEMINI_KEY: ${{ secrets.GEMINI_KEY }}
```

---

## STEP 6 — Add GitHub repository secrets

Using the GitHub API or CLI, add these secrets to the repo:

- `CLOUDFLARE_API_TOKEN` = `cfut_GfC1Q1CW2lt5aI9OdFyQBDnzjIiau0ThxpZrbnyxc7d0f3dd`
- `SUPA_ANON` = `sb_publishable_Y2-6dIwfLKBd2B5c8jUoRw_5AgeuLKE`
- `SUPA_SERVICE` = `sb_secret_MMOyJN3XrJvMEI2GsbuBqg_2QeyuF6N`
- `GEMINI_KEY` = `AQ.Ab8RN6L9zCT98mBnLmSwxeoU5Hs8ANwGZ1-h_tlEC45PFdEAUQ`

Via GitHub CLI:
```bash
gh secret set CLOUDFLARE_API_TOKEN --body "cfut_GfC1Q1CW2lt5aI9OdFyQBDnzjIiau0ThxpZrbnyxc7d0f3dd"
gh secret set SUPA_ANON --body "sb_publishable_Y2-6dIwfLKBd2B5c8jUoRw_5AgeuLKE"
gh secret set SUPA_SERVICE --body "sb_secret_MMOyJN3XrJvMEI2GsbuBqg_2QeyuF6N"
gh secret set GEMINI_KEY --body "AQ.Ab8RN6L9zCT98mBnLmSwxeoU5Hs8ANwGZ1-h_tlEC45PFdEAUQ"
```

---

## STEP 7 — Create Cloudflare Pages project

If it doesn't already exist, create the Pages project via API:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/f9de2a9d86aabf96d354151dd006e5f8/pages/projects" \
  -H "Authorization: Bearer cfut_GfC1Q1CW2lt5aI9OdFyQBDnzjIiau0ThxpZrbnyxc7d0f3dd" \
  -H "Content-Type: application/json" \
  -d '{"name":"algalterian-galactic-exchange","production_branch":"main"}'
```

---

## FINAL RESULT

After all steps complete and the GitHub Actions workflow runs, the game will
be live at:

`https://algalterian-galactic-exchange.pages.dev`

The Gemini agent Worker will fire every 5 minutes, check if 2+ game-hours
have elapsed, and generate a market event if so. The GM can toggle it on/off
independently of the market clock from the admin console.
