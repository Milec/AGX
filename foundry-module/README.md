# AGX — Galactic Exchange Link (Foundry VTT module)

Links a **Starfinder 2e** character sheet to a player's balance on the
[Algalterian Galactic Exchange](../README.md) website, so credits can move both
ways:

- **Deposit** — pull credits off the character sheet and into the AGX trading
  balance.
- **Withdraw** — pull credits from the AGX balance back onto the sheet.

The Starfinder 2e Foundry system runs on the PF2e engine (system id `sf2e`), so
the module also works on `pf2e` worlds using Starfinder content. Credits are the
`gp` coin denomination by default (configurable).

## Install

**By manifest** (Foundry → Add-on Modules → Install Module → Manifest URL):

```
https://raw.githubusercontent.com/Milec/AGX/main/foundry-module/module.json
```

**Manually** — copy the `foundry-module` folder into your Foundry
`Data/modules/` directory and rename it to `agx-link`.

Then enable **AGX — Galactic Exchange Link** in your world.

## Setup

Open **Game Settings → Configure Settings → AGX — Galactic Exchange Link**.

Per player (client settings — every player sets their own):

| Setting | Value |
| --- | --- |
| **AGX Callsign** | your operative callsign on the website |
| **AGX Access Code** | your AGX passphrase (used to verify the account before a transfer) |

World settings (GM only — defaults already point at the live AGX server):

| Setting | Default |
| --- | --- |
| **Supabase URL** | the AGX Supabase project URL |
| **Supabase Anon Key** | the public AGX anon key |
| **Credit Denomination** | `gp` (Credits) |

## Use

Open your character sheet and click the **AGX** button in the sheet's window
header. A dialog shows the credits on your sheet and on the exchange; enter an
amount and choose **Deposit to AGX** or **Withdraw to sheet**.

You can also trigger it from a macro:

```js
game.agx.openTransfer(actor); // or canvas.tokens.controlled[0]?.actor
```

## How it works / safety

- AGX stores accounts in a Supabase `kv` table at key `u:<callsign>` with a
  `cash` balance. The module reads that row, verifies your access code against
  the stored hash, then adjusts `cash` and appends a `XFER` history entry that
  shows up in your AGX transaction feed.
- Deposits also increase the account's deposit basis (`dep`) so your AGX
  return percentage stays honest; withdrawals decrease it.
- Transfers are **atomic-ish with rollback**: when depositing, coins are removed
  from the sheet first and refunded if the website write fails; when
  withdrawing, the website is debited first and refunded if the sheet credit
  fails. The two ledgers never silently diverge.
- Whole credits only.
