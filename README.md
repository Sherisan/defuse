# DEFUSE

Instant-win casino game: six wires, one detonator. Cut safe wires to climb the
multiplier ladder, cash out any time, or clear all five safe wires to defuse
the bomb for the max win.

```
npm install
npm run dev      # http://localhost:5180
npm run build
```

## Math (RTP 97%)

| Safe wires | Survive | Pays  |
|-----------:|--------:|------:|
| 1          | 83.3%   | ×1.16 |
| 2          | 66.7%   | ×1.45 |
| 3          | 50.0%   | ×1.94 |
| 4          | 33.3%   | ×2.91 |
| 5 (defuse) | 16.7%   | ×5.82 |

Multiplier = floor(0.97 × 6 / (6 − k), 2 dp). See `src/game/math.ts`.

**Bomb Squad Tip**: once per round, it reveals a safe wire, which counts as a
cleared rung. At rung k it costs `(m(k+1) − m(k)) / 0.97 × bet`, rounded up to the cent
(16.5% → 29.9% → 50.5% → 100% → 300% of the bet): the value of a free rung divided by the RTP,
so every rand spent on the tip returns 97% whenever it's bought.

## Provably fair

See `src/game/fair.ts`. The detonator is
`(first 52 bits of HMAC_SHA256(serverSeed, "clientSeed:nonce") × 6) >> 52`.
The tip wire uses the message `"clientSeed:nonce:intel"` over the uncut safe wires
in ascending order. A fresh server seed is used for each round, its SHA-256 hash
is shown before the bet, and the seed is revealed after the round.

## Backend

Plays against FeedingFranzeeAPI's `api/defuse` (Engine `Defuse`, GameId `defuse`), see
`src/game/httpEngine.ts`. In dev, `/api` is proxied to http://localhost:5003 and a player
token comes from `/api/dev-token`. In production the lobby launches the game with `?token=<jwt>`
and the API base comes from `VITE_API_BASE`.

Add `?demo` to the URL (or set `VITE_DEMO=1`) to play offline against the in-browser engine
(`createLocalEngine()` in `src/game/engine.ts`) with a demo wallet.

Note: `crypto.subtle` (used by the Verify button) requires a secure context (localhost or https).
