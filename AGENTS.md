# AGENTS.md

Asteroids clone: HTML5 Canvas + vanilla JS. No frameworks, no bundler, no dependencies, and **no `package.json`** — there are no npm scripts, tests, or lint config to find.

## Run / verify

- `npx serve .` → http://localhost:3000, or open `index.html` directly (`game.js` is a classic script, not a module, so `file://` works).
- Syntax check without a browser: `node --check game.js` (parse-only; the script can't run under Node because it touches `document`/`window` at top level).

## Architecture

All logic lives in the single file `game.js`, in this order: input (`keys`/`justPressed`) → utils (`wrap`, `dist`, `rand`) → `Bullet`/`Asteroid`/`FleetingAsteroid`/`Ship`/`Particle` classes → game state (`initGame`, `nextLevel`) → `update()`/`draw()` → `requestAnimationFrame` loop. The entry point is the last two lines of the file.

## Gotchas

- Canvas size is duplicated: `W`/`H` in `game.js` (800×600) and the `<canvas width/height>` attributes in `index.html`. Change both together.
- Space is toroidal — every moving entity wraps position with `wrap(v, W/H)`. A new entity that skips wrapping breaks at the screen edges.
- `pressed(code)` is edge-detection that clears on read; call it at most once per frame per key.
- Input reads `e.code` values (`'ArrowLeft'`, `'Space'`), not `e.key`.
- Asteroid tuning lives in the parallel arrays `RADII`/`SPEEDS`/`POINTS`, indexed by `size` 1–3.
- Fleeting asteroids (`FleetingAsteroid`, the "estrella fugaz") live in the `fleeting` array, **not** `asteroids` — only `asteroids` counts for level completion. They expire on a 6 s ttl and spawn from screen edges on `fugazTimer`.

## Conventions

- User-facing strings (HUD, overlays) and comments are in Spanish — keep them Spanish.
- Style: single quotes, 2-space indent, `// ── Section ──` divider comments.
- The README's feature list is partly aspirational: power-ups are not implemented in `game.js` (the "estrella fugaz" / `FleetingAsteroid` is). Trust the code over the README.
