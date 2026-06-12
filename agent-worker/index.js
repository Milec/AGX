// AGX Market Agent — Cloudflare Worker Cron
// Fires every 5 real minutes but only acts when 2+ game-hours have elapsed.

const SUPA_URL = "https://ifcensohczakjhqbzzkv.supabase.co";
const SUPA_ANON = "sb_publishable_Y2-6dIwfLKBd2B5c8jUoRw_5AgeuLKE";

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAgent());
  }
};

async function supaGet(key) {
  const r = await fetch(
    `${SUPA_URL}/rest/v1/kv?key=eq.${encodeURIComponent(key)}&select=value`,
    { headers: { apikey: SUPA_ANON, Authorization: "Bearer " + SUPA_ANON } }
  );
  const d = await r.json();
  return d && d[0] ? d[0].value : null;
}

async function supaSet(key, value) {
  await fetch(`${SUPA_URL}/rest/v1/kv`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPA_ANON,
      Authorization: "Bearer " + SUPA_ANON,
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
  });
}

// ── Shared event generator (no external API) ─────────────────────────────────
function generateEvent(regime) {
  const r = Math.random;
  const pick = arr => arr[Math.floor(r() * arr.length)];

  const ALL_TICKERS = [
    "AIDA","MECH","ANDR","INFO","SPYG","DTNT","ABDR","BANK","VESK",
    "VITX","GENM","XNTH","HELL","SKYF","AEGI","SECC",
    "GRAV","PLSM","ARNA","MAGI","DRFC","ABIT","VDGE","GAPC"
  ];
  const SECTORS = [
    "Defense","Tech","Biotech","Finance","Starships","Mining",
    "Energy","Consumer","Media","Logistics","Terraform","Magitech"
  ];
  const NEWS = [
    "Epsilon Enclave AI nodes report unexpected synchronisation across Drift beacons",
    "AIDA consciousness fragmentation detected in Absalom Station subnet",
    "Rogue android cells disrupt automated shipping lanes near Akiton",
    "Epsilon Enclave denies involvement in Pact Worlds firewall breach",
    "MECH chassis recall expands amid reports of autonomous behaviour",
    "Directorate surveillance contract awarded for Castrovel border monitoring",
    "INFO Corp data harvest from Idari refugees draws AbadarCorp censure",
    "Pact Worlds intelligence committee demands Directorate transparency report",
    "SPYG surveillance drones spotted over Diaspora free-trader routes",
    "Directorate denies operating black sites on Eox outer ring",
    "Algalterian Senate ratifies expanded trade corridor to Near Space",
    "BANK of Algalteria raises inter-system lending rates by 0.5 basis points",
    "Vesk military attachés arrive at Algalterian Exchange for joint summit",
    "Algalterian treasury announces Drift-backed sovereign bond offering",
    "Empire credit rating affirmed stable by AbadarCorp ratings division",
    "Bradtopia biolab clears Phase III trials for combat-grade gene therapy",
    "GENM controversial memory-splice procedure approved on Bretheda",
    "Bradtopia cloning moratorium lifted in three Pact World jurisdictions",
    "XNTH xenobiological compound shows promise against Swarm-vector pathogens",
    "Ethics panel investigates Bradtopia neuro-augment trial on Triaxus",
    "Kurogane security forces renew Absalom Station perimeter contract",
    "HELL battalion deploys to Diaspora amid piracy surge",
    "Kurogane SKYF interceptors intercept Azlanti scout formation near Verces",
    "AEGI shield technology licensed to Stewards for fleet integration",
    "Kurogane reports record Q3 contract revenue from Near Space clients",
    "Drift route volatility index hits 18-month high amid Swarm incursions",
    "AbadarCorp quarterly outlook cites Near Space expansion as growth driver",
    "Free Captains trading bloc lodges Pact Worlds tariff dispute",
    "Starfinder Society expedition uncovers pre-Gap archive; market watches",
    "Absalom Station port authority raises docking fees; logistics chains react",
    "Vesk military exercises near Veskarium border spark defensive sector bids",
    "Ysoki black-market disruption spills into registered commodity exchanges",
    "Kasatha cultural envoy mission improves Idari trade sentiment",
    "Near Space energy grid upgrade tender draws 14 competing bids",
    "Pact Worlds unified credit index holds steady despite Drift instability",
    "Swarm incursion near Kalo-Mahoi triggers emergency defence spending review",
    "Drift beacon relay consortium reports record throughput; shipping costs ease",
    "AbadarCorp Absalom branch releases cautious outlook amid stellar fluctuations",
    "Triaxian dragon militia contract renewal boosts AEGI and SECC order books",
    "Void crystal speculation on Apostae draws regulatory scrutiny",
  ];

  const REGIME_HEADLINES = {
    bull:     "Optimism spreads across Algalterian Exchange as buy orders surge",
    bear:     "Selling pressure mounts as risk appetite retreats across sectors",
    volatile: "Exchange volatility spikes as conflicting signals hit the floor",
    calm:     "Market enters consolidation phase; trading volumes normalise",
    neutral:  "Algalterian Exchange returns to baseline after recent turbulence",
    crash:    "Circuit breakers triggered as panic selling sweeps the exchange",
    boom:     "Euphoric buying drives Algalterian Exchange to multi-cycle highs",
  };

  // Weighted type: 60% news, 24% pump, 11% sector_pump, 5% regime
  const roll = r();
  const type = roll < 0.60 ? "news"
             : roll < 0.84 ? "pump"
             : roll < 0.95 ? "sector_pump"
             : "regime";

  // Magnitude influenced by current regime
  const BASE = {bull:0.08,boom:0.12,bear:-0.06,crash:-0.14,volatile:0.09,calm:0.04,neutral:0.05};
  const base = BASE[regime] ?? 0.05;
  const rawMag = base + (r() - 0.5) * 0.10;
  const mag = Math.max(-0.20, Math.min(0.20, rawMag));
  const dur = Math.floor(r() * 300 + 60); // 60–360 mins

  if (type === "news") {
    return { type: "news", headline: pick(NEWS) };
  }
  if (type === "pump") {
    const sym = pick(ALL_TICKERS);
    return { type: "pump", sym, mag, duration_mins: dur,
             headline: `${sym} ${mag > 0 ? "surges" : "slides"} on exchange floor activity`,
             silent: false };
  }
  if (type === "sector_pump") {
    const sector = pick(SECTORS);
    return { type: "sector_pump", sector, mag, duration_mins: dur,
             headline: `${sector} sector ${mag > 0 ? "rallies" : "retreats"} amid Pact Worlds developments`,
             silent: false };
  }
  // regime change — never same as current
  const REGIMES = ["bull","bear","volatile","calm","neutral","crash","boom"];
  const next = pick(REGIMES.filter(x => x !== regime));
  return { type: "regime", regime: next, headline: REGIME_HEADLINES[next] };
}
// ─────────────────────────────────────────────────────────────────────────────

async function runAgent() {
  const cfg = await supaGet("cfg");
  if (!cfg) return;
  if (cfg.agentEnabled === false) return;

  const now = Date.now();
  const anchorG = cfg.anchorG || now;
  const anchorR = cfg.anchorR || now;
  const gameNow = cfg.paused
    ? anchorG
    : anchorG + (now - anchorR) * (cfg.speed || 1);

  const gameHoursElapsed = (gameNow - (cfg.lastAgentGameTime || 0)) / 3600000;
  if (gameHoursElapsed < 2) return;

  const events = await supaGet("ev") || [];
  const regimes = events.filter(e => e.t === "regime");
  const currentRegime = regimes.length ? regimes[regimes.length - 1].k : "neutral";

  const ev = generateEvent(currentRegime);

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
    gameEvent.silent = false;
    gameEvent.body = ev.headline;
  } else if (ev.type === "sector_pump") {
    gameEvent.t = "spump";
    gameEvent.sec = ev.sector;
    gameEvent.mag = ev.mag;
    gameEvent.dur = ev.duration_mins * 60000;
    gameEvent.silent = false;
    gameEvent.body = ev.headline;
  }

  events.push(gameEvent);
  if (events.length > 500) events.splice(0, events.length - 500);
  await supaSet("ev", events);
  cfg.lastAgentGameTime = gameNow;
  cfg.lastAgentAt = now;
  await supaSet("cfg", cfg);
}
