# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/PakBOSS-007/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/PakBOSS-007/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar — ranks tokenless DefiLlama protocols by what their token would be worth at launch, with airdrop farming plans, as a static dashboard.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=yacq0m6m&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>

## What is in this repository

| Path | What it is |
| --- | --- |
| `main.ts` | The entry's program (Node 22+, standard library only). Reads the snapshot, scores the board, writes `board.json`, `data.js`, the dashboard, the screenshots and `dossier.json` into the output directory. No network, no clock, no randomness — the same snapshot in makes the same bytes out. |
| `lib/model.ts` | The ranking model (`radar-2`) and the farm-plan generator. |
| `vendor/makefun-board.ts` | The kit's dossier library, copied byte-for-byte. |
| `dashboard/` | The static dashboard: `index.html`, `app.css`, `app.js` (34 KB total, renders with no network). |
| `screenshots/` | The three screenshots: board, detail view, filtered view (1440×900). |
| `LICENSE` | MIT. |

`--input <snapshot.json>` and `--output <dir>` override the defaults. The snapshot defaults to
the kit's copy beside this repository.

## Methodology — model `radar-2`

A protocol is **pre-token** when its index entry records no token: no market cap, no CoinGecko id,
no symbol. The board carries the whole 40-protocol watchlist, plus the **early radar**: pre-token
protocols below the $50,000,000 floor that the watchlist's own rule would keep — no wrapped, staked
or bridged product of a token that trades, no versioned pool, no exchange. Live-token protocols are
kept apart in the Live token view: they price the board, they are never ranked on it.

Implied value follows only from the snapshot's own figures:

```
implied = round(TVL × categoryMultiple × growthMult × maturityMult × breadthMult)
```

- **categoryMultiple** — the median market-cap-to-TVL ratio of the snapshot's live-token protocols
  in the same category (at least 3 of them, market cap and TVL both positive, exchanges excluded).
  A category with fewer live peers uses the global median over all live protocols. Clamped to
  [0.05, 0.75], so one wild outlier cannot set the price for a whole category. The dashboard's
  Methodology tab prints the full calibration table.
- **growthMult** = 1 + clamp(change_7d, −60, +120) / 100 × 0.5.
- **maturityMult** = 0.6 + min(age, 1095 days) / 1095 × 0.4; unknown listing date counts as 365 days.
- **breadthMult** = 1 + 0.05 × min(chains − 1, 4).

No protocol name is ever special-cased: the same function scores every row, and the dashboard shows
each row's factor breakdown in its detail view.

### The board, as built

- **178 rows**: all 40 watchlist protocols + 138 early-radar protocols (every rankable pre-token
  protocol below the floor in the snapshot).
- **Top 5 by implied value**: Steakhouse Financial $641,893,402 · Gauntlet $382,296,140 ·
  Veda $367,549,718 · USDD $159,021,873 · Upshift $131,864,300.
- **Total implied value**: $3,309,413,363.
- **Global median mcap / TVL**: ×0.246 (119 live protocols with positive market cap and TVL,
  exchanges excluded). Category multiples used: Basis Trading ×0.654, Dexs ×0.342, RWA ×0.275,
  Yield ×0.191, CDP ×0.169, Lending ×0.132; every other watchlist category uses the global median.
- **Farm plans**: 6 steps per protocol, generated from its own record (category, chains, TVL, age).
  Capital scales with TVL ($50–$250), the holding period with age (30–60 days), and the weekly
  action with the category. Every step states its cost and its time.

Implied value is a model of what a token would be worth *if* it launched at its live peers' ratio.
It is not a prediction, a price target, or advice.

## Verification performed

- `main.ts` run twice into two directories: outputs byte-for-byte identical (deterministic).
- Local gate check, all passing: 178 rows (100–4,000), all 40 watchlist slugs covered, ranks
  exactly 1..178, implied values non-increasing and not all equal, farm steps 6 per row of 106–189
  characters, dashboard 3 files / 34,206 bytes with no `http://` or `https://` in any HTML
  attribute, CSS file or JS import, screenshots 3 × 1440×900 PNG at 152–203 KB (≤512 KiB),
  `dossier.json` byte-for-byte equal to `buildDossier(output, { text_max_bytes: 65536 })`
  (725,105 bytes, under the 1.5 MiB cap).
