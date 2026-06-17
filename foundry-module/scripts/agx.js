/**
 * AGX — Galactic Exchange Link
 * ----------------------------------------------------------------------------
 * Bridges a Starfinder 2e (PF2e engine) character sheet to a player's balance
 * on the Algalterian Galactic Exchange website. Credits can be pushed from the
 * sheet's inventory to the AGX trading balance and pulled back the other way.
 *
 * The AGX site stores everything in a single Supabase `kv` table. A player
 * account lives at key `u:<callsign>` and looks like:
 *   { n, p:sha256("pwx:"+pass), cash, sc, dep, hist:[...], ... }
 * RLS is fully open with the public anon key (it's a game among friends), so
 * the only thing we need to act on an account is the callsign; we additionally
 * verify the access code so a player can't accidentally drain someone else's
 * balance.
 */

const MOD = "agx-link";

/* ── tiny helpers ───────────────────────────────────────────────────────── */

const t = (k) => game.i18n.localize(`AGX.${k}`);
const setting = (k) => game.settings.get(MOD, k);
const notify = (msg, type = "info") => ui.notifications.notify(msg, type);

/** SHA-256("pwx:"+s) as lowercase hex — must match AGX's sha() exactly. */
async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("pwx:" + s));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Normalise a callsign into the AGX account key the same way the site does. */
function accountKey(callsign) {
  return "u:" + callsign.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
}

function supaHeaders() {
  const anon = setting("supabaseKey");
  return {
    "Content-Type": "application/json",
    apikey: anon,
    Authorization: "Bearer " + anon,
  };
}

/** Read one kv row's value. Returns null when the key does not exist. Throws on
 *  any HTTP/transport failure so a server error is never mistaken for "no row". */
async function supaGet(key) {
  const url =
    setting("supabaseUrl").replace(/\/+$/, "") +
    "/rest/v1/kv?key=eq." + encodeURIComponent(key) + "&select=value";
  const r = await fetch(url, { headers: supaHeaders() });
  if (!r.ok) throw new Error(`AGX GET ${key}: HTTP ${r.status}`);
  const d = await r.json();
  if (!Array.isArray(d)) throw new Error(`AGX GET ${key}: bad response`);
  return d[0] ? d[0].value : null;
}

/** Upsert one kv row. Throws on failure. */
async function supaSet(key, value) {
  const url = setting("supabaseUrl").replace(/\/+$/, "") + "/rest/v1/kv";
  const r = await fetch(url, {
    method: "POST",
    headers: { ...supaHeaders(), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(`AGX SET ${key}: HTTP ${r.status}`);
  return true;
}

/* ── sheet credit access ────────────────────────────────────────────────── */

/** Whole credits currently on a character sheet (the configured coin denom). */
function sheetCredits(actor) {
  const denom = setting("denomination");
  const coins = actor?.inventory?.coins;
  if (!coins) return 0;
  return Math.floor(Number(coins[denom]) || 0);
}

/* ── account access ─────────────────────────────────────────────────────── */

/** Fetch the AGX account for the current client's callsign and verify the
 *  access code. Throws a user-facing Error on any problem. */
async function authedAccount() {
  const callsign = (setting("callsign") || "").trim();
  const code = setting("accessCode") || "";
  if (!callsign || !code) throw new Error(t("err.notLinked"));

  const key = accountKey(callsign);
  const acct = await supaGet(key);
  if (!acct) throw new Error(game.i18n.format("AGX.err.noAccount", { callsign }));
  if (acct.p !== (await sha256(code))) throw new Error(t("err.badCode"));
  return { key, acct };
}

/* ── transfers ──────────────────────────────────────────────────────────── */

/**
 * Move `amount` whole credits from the character sheet to the AGX balance.
 * Removes coins first; if the website write fails the coins are refunded so the
 * two ledgers never silently diverge.
 */
async function depositToAGX(actor, amount) {
  amount = Math.floor(Number(amount));
  if (!(amount > 0)) throw new Error(t("err.amount"));
  if (sheetCredits(actor) < amount) throw new Error(t("err.sheetFunds"));

  const denom = setting("denomination");
  const removed = await actor.inventory.removeCoins({ [denom]: amount });
  if (!removed) throw new Error(t("err.sheetFunds"));

  try {
    const { key, acct } = await authedAccount();
    acct.cash = (Number(acct.cash) || 0) + amount;
    acct.dep = (Number(acct.dep) || 0) + amount; // external capital → invested basis
    pushHist(acct, amount, actor.name);
    await supaSet(key, acct);
    return acct.cash;
  } catch (err) {
    // roll the coins back onto the sheet — the website never took them
    await actor.inventory.addCoins({ [denom]: amount });
    throw err;
  }
}

/**
 * Move `amount` whole credits from the AGX balance to the character sheet.
 * Debits the website first (the shared source of truth), then credits the
 * sheet; if the sheet write throws, the website debit is rolled back.
 */
async function withdrawToSheet(actor, amount) {
  amount = Math.floor(Number(amount));
  if (!(amount > 0)) throw new Error(t("err.amount"));

  const { key, acct } = await authedAccount();
  if ((Number(acct.cash) || 0) < amount) throw new Error(t("err.agxFunds"));

  acct.cash = (Number(acct.cash) || 0) - amount;
  acct.dep = (Number(acct.dep) || 0) - amount;
  pushHist(acct, -amount, actor.name);
  await supaSet(key, acct);

  try {
    await actor.inventory.addCoins({ [setting("denomination")]: amount });
    return acct.cash;
  } catch (err) {
    // refund the website debit — the sheet never received the credits
    acct.cash += amount;
    acct.dep += amount;
    pushHist(acct, amount, actor.name + " (rollback)");
    await supaSet(key, acct).catch(() => {});
    throw err;
  }
}

/** Append a transfer record in the shape AGX's history renderer understands. */
function pushHist(acct, delta, charName) {
  acct.hist = Array.isArray(acct.hist) ? acct.hist : [];
  acct.hist.push({
    at: Date.now(),
    side: "XFER",
    d: delta,
    o: (delta >= 0 ? "from " : "to ") + charName,
  });
  if (acct.hist.length > 500) acct.hist = acct.hist.slice(-500);
}

/* ── transfer dialog ────────────────────────────────────────────────────── */

function fmt(n) {
  return "₢" + Number(n || 0).toLocaleString("en-US");
}

async function openTransfer(actor) {
  if (!actor) return notify(t("err.noActor"), "warn");
  if (!actor.inventory?.coins) return notify(t("err.noInventory"), "warn");
  if (!setting("callsign") || !setting("accessCode")) {
    return notify(t("err.notLinked"), "warn");
  }

  // Pull the live AGX balance up front so the dialog can show both sides.
  let acctCash = null;
  try {
    const { acct } = await authedAccount();
    acctCash = Number(acct.cash) || 0;
  } catch (err) {
    return notify(err.message, "error");
  }

  const callsign = setting("callsign");
  const content = `
    <div class="agx-dialog">
      <div class="agx-balances">
        <div class="agx-bal">
          <span class="agx-bal-l">${t("dlg.sheet")} — ${foundry.utils.escapeHTML(actor.name)}</span>
          <span class="agx-bal-v" data-agx="sheet">${fmt(sheetCredits(actor))}</span>
        </div>
        <div class="agx-bal">
          <span class="agx-bal-l">${t("dlg.agx")} — ${foundry.utils.escapeHTML(callsign)}</span>
          <span class="agx-bal-v" data-agx="agx">${fmt(acctCash)}</span>
        </div>
      </div>
      <div class="agx-field">
        <label>${t("dlg.amount")}</label>
        <input type="number" name="amount" min="1" step="1" value="" placeholder="0" autofocus>
      </div>
      <p class="agx-hint">${t("dlg.hint")}</p>
    </div>`;

  // Run a transfer from a DialogV2 callback. `dialogApp` is the DialogV2 instance;
  // `.element` is its outermost HTMLElement in V13 ApplicationV2.
  const run = async (fn, dialogApp) => {
    const amount = Number(dialogApp.element.querySelector('input[name="amount"]')?.value ?? 0);
    try {
      await fn(actor, amount);
      const msgKey = fn === depositToAGX ? "msg.deposited" : "msg.withdrew";
      notify(game.i18n.format(`AGX.${msgKey}`, { amount: fmt(Math.floor(amount)), callsign }));
    } catch (err) {
      console.error(`${MOD} | transfer failed`, err);
      notify(err.message, "error");
    }
  };

  // DialogV2 is the V13 replacement for the deprecated Dialog class.
  await foundry.applications.api.DialogV2.wait({
    window: { title: t("dlg.title"), width: 380 },
    content,
    rejectClose: false,
    classes: ["agx-link"],
    buttons: [
      {
        action: "deposit",
        label: t("dlg.deposit"),
        icon: "fas fa-arrow-up",
        default: true,
        callback: (ev, btn, dialog) => run(depositToAGX, dialog),
      },
      {
        action: "withdraw",
        label: t("dlg.withdraw"),
        icon: "fas fa-arrow-down",
        callback: (ev, btn, dialog) => run(withdrawToSheet, dialog),
      },
      {
        action: "close",
        label: t("dlg.close"),
        icon: "fas fa-times",
      },
    ],
  });
}

/* ── settings ───────────────────────────────────────────────────────────── */

Hooks.once("init", () => {
  // NOTE: the `init` hook fires before translations are loaded, so we pass
  // localization *keys* — Foundry localizes setting name/hint/choices itself
  // when it renders the settings menu.

  // Per-player link credentials (client scope: each player sets their own).
  game.settings.register(MOD, "callsign", {
    name: "AGX.set.callsign.name",
    hint: "AGX.set.callsign.hint",
    scope: "client",
    config: true,
    type: String,
    default: "",
  });
  game.settings.register(MOD, "accessCode", {
    name: "AGX.set.accessCode.name",
    hint: "AGX.set.accessCode.hint",
    scope: "client",
    config: true,
    type: String,
    default: "",
  });

  // World-level connection config (GM scope).
  game.settings.register(MOD, "supabaseUrl", {
    name: "AGX.set.url.name",
    hint: "AGX.set.url.hint",
    scope: "world",
    config: true,
    type: String,
    default: "https://ifcensohczakjhqbzzkv.supabase.co",
  });
  game.settings.register(MOD, "supabaseKey", {
    name: "AGX.set.key.name",
    hint: "AGX.set.key.hint",
    scope: "world",
    config: true,
    type: String,
    default: "sb_publishable_Y2-6dIwfLKBd2B5c8jUoRw_5AgeuLKE",
  });
  game.settings.register(MOD, "denomination", {
    name: "AGX.set.denom.name",
    hint: "AGX.set.denom.hint",
    scope: "world",
    config: true,
    type: String,
    choices: { pp: "pp", gp: "AGX.set.denom.credits", sp: "sp", cp: "cp" },
    default: "gp",
  });
});

Hooks.once("ready", () => {
  const api = { openTransfer, depositToAGX, withdrawToSheet, sheetCredits };
  game.modules.get(MOD).api = api;
  game.agx = api;
  console.log(`${MOD} | ready — game.agx.openTransfer(actor)`);
});

/* ── sheet button ───────────────────────────────────────────────────────── */

// PF2e/SF2e on Foundry V13 still fires getActorSheetHeaderButtons for module
// compatibility. The hook injects the AGX button at the left end of the header.
Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  const actor = sheet.actor;
  if (!actor?.isOwner || !actor.inventory?.coins) return;
  buttons.unshift({
    label: "AGX",
    class: "agx-link-btn",
    icon: "fas fa-coins",
    onclick: () => openTransfer(actor),
  });
});
