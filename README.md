# AGX — Algalterian Galactic Exchange

A simulated stock market and casino for a Starfinder 2e campaign. Players trade
100+ fictional listings (megacorp stocks, ETFs, starmetal commodities, crypto,
treasury bonds) on their phones while the GM rigs the market from an admin panel.

## How it works

- **`public/index.html`** — the entire game: a single-file vanilla-JS terminal
  UI served as a Cloudflare static-assets Worker. No build step.
- **`agent-worker/index.js`** — a Cloudflare Worker on a cron trigger that acts
  as the "market agent": every few game-hours it publishes news, pump events,
  sector moves, and regime changes (bull/bear/boom/crash/volatile/calm).
- **Supabase `kv` table** — the shared real-time store. Config, the event log,
  and player accounts all live in one key/value table accessed via PostgREST
  with the public anon key (RLS policy is fully open by design — it's a game
  among friends, not a bank).

### Price engine

Prices are **deterministic**, not stored. `rawLp(asset, gameTime)` computes a
log-price from seeded noise + secular drift + the active regime + any pump
effects, so every client renders identical charts and history for any time
range on demand. The game clock can run faster than real time (`cfg.speed`).

### Events

Events are appended to the shared `ev` array with two timestamps: `at` (real
time, for display) and `g` (game time, for the price model). Pump effects use a
triangular envelope — they build to full magnitude over `dur`, then decay back
to zero over a second `dur`.

## Deploying

Both Workers deploy via `npx wrangler deploy`:

- The static site uses the root `wrangler.toml` (Cloudflare Git integration).
- The market agent uses `agent-worker/wrangler.toml` and is deployed by the
  `.github/workflows/deploy-worker.yml` workflow on push to `main`.

## GM features

The admin panel (GM account) can broadcast newswire stories, force agent
events, rig individual tickers or whole sectors, change regimes, halt trading,
clear the newsfeed or stacked pumps, adjust game speed, and reset the market
to a fresh launch with one year of simulated history.
