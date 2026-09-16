# SPEC 01 - Playable MVP Arkanoid

> **Status:** Approved
> **Depends on:** None
> **Date:** 2026-09-16
> **Objective:** Ship a playable browser Arkanoid MVP with one brick grid, lives, score, atlas sprites, sounds, and a desktop playfield that resizes with the window.

## Scope

**In:**

- Flatten nested `assets/assets/` to `/assets` so `spritesheet.js` can load `assets/spritesheet-breakout.png`.
- Add `index.html`, `style.css`, and `game.js` at repo root.
- Base canvas `800x600`. On desktop, if the window cannot fit that size, shrink the actual canvas bitmap (world size), keep aspect `4:3`, cap at `800x600`. HTML HUD for score and lives. HTML overlays for Start, Win, and Lose.
- Paddle, ball, and bricks drawn with `drawSprite` / `drawFrame`. Do not hardcode atlas `sx/sy/sw/sh` in `game.js`.
- One hardcoded grid: 13 columns by 6 rows. One color per row: `red`, `yellow`, `cyan`, `magenta`, `hotpink`, `green`. Brick size `32x16`. No gap. Gray unused.
- Controls: ArrowLeft/ArrowRight and KeyA/KeyD. Mouse X on the canvas. Space or click: Start, serve, and dismiss Win/Lose.
- Ball glued to paddle until Space or click. Paddle bounce angle from hit offset. Walls: left, right, top. Bottom miss costs a life.
- 3 lives. Score `+10` per brick. Explosion frames + `break-sound.mp3` on break. `ball-bounce.mp3` on paddle, walls, and bricks.
- Win when every brick is gone. Lose at 0 lives. Space or click returns to Start. Next Space or click starts a new game.
- Desktop window resize changes `CANVAS_W` / `CANVAS_H` (not CSS-only scaling). Scale paddle, ball, bricks, and speeds from the 800x600 baseline so the 13x6 grid still fits. Rebuild/recenter the grid, clamp the paddle, keep the ball in bounds. HUD width follows the canvas.

**Out of scope (for future specs):**

- Power-ups, pause, multiple levels, high scores, localStorage.
- Unbreakable or multi-hit gray bricks. Color-based score table.
- Touch controls, mobile layout, extra audio files.
- Frameworks, bundlers, TypeScript, npm deps.
- Editing atlas coordinates in `spritesheet.js`.
- README rewrite.

## Data model

This spec introduces the game state in `game.js`. Coordinates origin top-left. Velocities in pixels per second. Simulation uses `dt` from `requestAnimationFrame`.

```js
const BASE_W = 800;
const BASE_H = 600;
let CANVAS_W = BASE_W;
let CANVAS_H = BASE_H;
let SCALE = 1; // CANVAS_W / BASE_W; sizes and speeds multiply by SCALE
const COLS = 13;
const ROWS = 6;
const BRICK_W = 32;
const BRICK_H = 16;
const ROW_COLORS = ['red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green'];
const POINTS_PER_BRICK = 10;
const START_LIVES = 3;
const PADDLE_W = 162;
const PADDLE_H = 14;
const BALL_W = 16;
const BALL_H = 16;

// state: 'start' | 'playing' | 'win' | 'lose'
const game = {
  state: 'start',
  score: 0,
  lives: 3,
  paddle: { x: 0, y: 0, w: PADDLE_W, h: PADDLE_H },
  ball: { x: 0, y: 0, w: BALL_W, h: BALL_H, vx: 0, vy: 0, glued: true },
  bricks: [/* { x, y, w, h, color, alive } */],
  explosions: [/* { x, y, w, h, color, t0 } */],
};
```

DOM ids in `index.html`: `game` (canvas), `score`, `lives`, `overlay`, `overlay-title`, `overlay-msg`.

Sprite names: `paddle`, `ball`, `block_<color>`. Explosions: `EXPLOSION_FRAMES[color]`, duration `EXPLOSION_DURATION` (150ms).

Sounds: `assets/sounds/ball-bounce.mp3`, `assets/sounds/break-sound.mp3`.

## Implementation plan

1. Flatten `assets/assets/*` into `/assets` (keep `spritesheet.js`, `spritesheet-breakout.png`, `sounds/`). Leave `__MACOSX/` untouched. Add `index.html` + `style.css`: dark page, canvas `800x600`, HUD placeholders, overlay markup, scripts `assets/spritesheet.js` then `game.js`. Manual test: `python3 -m http.server 8000`, page shows the canvas, no 404 for `spritesheet.js`.
2. Add `game.js` with `'use strict'`, canvas bootstrap, `loadSpritesheet`, `requestAnimationFrame` loop that clears the playfield. Manual test: canvas paints, no `Failed to load spritesheet`.
3. Paddle at the bottom. `drawSprite(ctx, 'paddle', ...)`. Hold Left/Right or A/D to move. `mousemove` on `#game` sets paddle X. Clamp to `[0, CANVAS_W - paddle.w]`. Manual test: paddle moves and stays on screen.
4. Ball glued on the paddle. Space or click (edge-triggered) launches. Move with `dt`. Bounce left, right, top. Paddle hit uses offset to set bounce angle. Bottom miss re-glues the ball (lives later). Play `ball-bounce.mp3` on paddle and walls. Manual test: serve, bounce, miss, re-serve.
5. Build the 13x6 grid centered horizontally. Draw alive bricks with `drawSprite(ctx, 'block_' + color, ...)`. Manual test: rainbow grid visible, gray unused.
6. AABB ball vs bricks. On hit: `alive = false`, spawn explosion, `score += 10`, play `break-sound.mp3` and bounce sound, reverse the colliding axis. Draw explosions with `drawFrame` then drop them after 150ms. Write score to `#score`. Manual test: brick explodes, score ticks by 10, ball does not pass through a live brick.
7. `lives` starts at 3. Show `#lives`. Miss: `lives -= 1`, re-glue, keep score. At 0 lives set `state` to `'lose'` and show overlay. Manual test: three misses show Lose.
8. When no alive bricks remain, set `state` to `'win'`. Start overlay on load. Space or click on Win/Lose sets `state` to `'start'`. Space or click on Start resets score, lives, grid, paddle, glued ball, then `'playing'`. Manual test: clear grid -> Win; Space -> Start; Space -> new game; Lose path still works.
9. Desktop resize: `CANVAS_W` / `CANVAS_H` are variables, not fixed. Base size `800x600`. On `window` `resize` (and once on load), fit the playfield into the available desktop page, cap at `800x600`. If the window is too narrow, shrink width and keep aspect `4:3`. Scale paddle, ball, brick size, and speeds by `SCALE = CANVAS_W / BASE_W`. Set `canvas.width` / `canvas.height` to the new world size. Recenter/rebuild the 13x6 grid, clamp the paddle, keep the ball inside the playfield. HUD and overlay follow the canvas width. Keyboard and mouse only. Manual test: shrink a desktop window below 800px without reload; the bitmap shrinks, the grid stays 13x6, mouse X still matches the paddle, play continues.

## Acceptance criteria

- [ ] `python3 -m http.server 8000` (or `npx serve .`) loads the game with no missing atlas/sound 404s and no spritesheet error in the console.
- [ ] Canvas bitmap is `800x600` when the desktop window can fit it. HUD shows score and lives in HTML, not on the canvas.
- [ ] Shrinking a desktop window below 800px shrinks the canvas bitmap (world size), keeps aspect `4:3`, keeps a 13x6 grid, and maps mouse X to world X without a reload. No touch-specific UI.
- [ ] Start overlay is visible on first load. Space or click hides it and starts a game with the ball glued.
- [ ] Paddle moves with ArrowLeft/ArrowRight, KeyA/KeyD, and mouse X, and stays inside the canvas.
- [ ] Space or click while glued launches the ball. Space/click is edge-triggered (one press does not start and launch in the same frame).
- [ ] Ball bounces on left, right, and top. Paddle bounce angle depends on hit position.
- [ ] Bottom miss with lives left: lives decrease by 1, score stays, ball glues to the paddle again.
- [ ] Three bottom misses show the Lose overlay. Space or click returns to Start.
- [ ] Grid is 13x6, colors `red yellow cyan magenta hotpink green` top to bottom, no gray.
- [ ] Breaking a brick plays the 4-frame explosion, plays `break-sound.mp3`, and adds exactly 10 points.
- [ ] `ball-bounce.mp3` plays on paddle, wall, and brick hits.
- [ ] Clearing all bricks shows the Win overlay. Space or click returns to Start. Next Space or click starts a new game (3 lives, score 0, full grid).
- [ ] No pause, no localStorage, no extra npm deps.

## Decisions

- **Yes:** Flatten assets to `/assets`. `spritesheet.js` already points at `assets/spritesheet-breakout.png`.
- **No:** Keep `assets/assets/` or put `index.html` inside the nested folder. Path bugs would follow.
- **Yes:** `index.html` + `style.css` + `game.js` at root. Same shape as sibling course games.
- **Yes:** HTML HUD and HTML overlays. Canvas is the playfield only.
- **Yes:** One 13x6 grid this spec. Skip gray so the rainbow rows stay distinct.
- **Yes:** Gray would be breakable if used. This spec does not place gray.
- **Yes:** 3 lives, `+10` per brick, no persistence.
- **Yes:** Keyboard and mouse. Space or click for Start, serve, and overlay dismiss.
- **Yes:** Hit-offset paddle bounce. Reverse-Y-only can trap a vertical loop.
- **Yes:** Edge-triggered Space/click so Start does not also serve in the same press.
- **Yes:** English UI strings. ASCII-only in `.md` files.
- **Yes:** Explosions from `EXPLOSION_FRAMES` plus the two existing mp3s.
- **Yes:** Desktop window shrink resizes the game world (`canvas.width` / `height`), cap `800x600`, aspect `4:3`. Scale units from the 800x600 baseline so the grid still fits.
- **No:** CSS-only scale of a fixed 800x600 bitmap. That was the alternative not chosen.
- **No:** Touch controls or a mobile-first layout. Desktop window shrink only.
- **No:** Pause, high scores, multiple levels, power-ups, frameworks.
- **No:** Change atlas coordinates. Draw only through `spritesheet.js` helpers.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Atlas 404 if flatten is skipped | Step 1 is flatten first. Acceptance checks the network/console. |
| `file://` blocks Image/Audio | Run a static server, not a raw file open. |
| Audio autoplay blocked | First gesture is Start click/Space. Sounds run after that. |
| Same keydown starts and serves | Use `justPressed` / click edge, not `keys.Space` held. |
| Ball tunnels through bricks at high speed | AABB on the swept side. Clamp `dt`. Keep ball speed in a named constant. |
| Resize mid-game desyncs grid, paddle, or mouse | Resize handler rebuilds layout from `SCALE`, clamps paddle, and remaps mouse via `getBoundingClientRect`. |

## What is **not** in this spec

- Power-ups.
- Pause.
- Multiple levels and high scores.
- localStorage or any save.
- Unbreakable gray, multi-hit bricks, color score table.
- Touch controls and mobile layout.
- Frameworks, bundlers, tests, atlas edits, README rewrite.

Each one of those, if it lands, goes in its own spec.
