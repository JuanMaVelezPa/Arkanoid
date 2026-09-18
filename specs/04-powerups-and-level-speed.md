# SPEC 04 - Power-ups, levels.js, and per-level ball speed

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02, SPEC 03
> **Date:** 2026-09-18
> **Objective:** Move the five level patterns into `levels.js`, extract power-up drop/catch/effects into `powerups.js`, multiply ball speed by 1.15 per level, and drop timed wide-paddle and slow-ball capsules every 5 brick breaks.

## Why this spec exists

SPEC 03 hardcoded `LEVELS` in `game.js` and deferred both power-ups and `levels.js`. This spec does those two deferred items together, plus the level speed rule, because they were requested as one feature. Mid-impl, power-up code was moved to `powerups.js` so `game.js` stays the loop.

## Scope

**In:**

- New file `levels.js` at repo root. Move `LEVELS`, `COLS`, `ROWS`, and `ROW_COLORS` there as globals. Patterns stay the five SPEC 03 ASCII grids.
- New file `powerups.js` at repo root. Move power-up constants, `breaksInLevel`, `powerups`, `effects`, HUD writes for `#wide`/`#slow`, and the drop/catch/draw/tick/clear/remap helpers there as globals. `game.js` keeps the loop, bricks, paddle, ball, `levelBallSpeed`, `currentBallSpeed`, serve, and paddle bounce, and calls those helpers. Script order in `index.html`: `assets/spritesheet.js`, `levels.js`, `powerups.js`, `game.js`.
- Ball speed on every `loadLevel(n)` (auto-next, pause keys 1-5, new game): `BALL_SPEED * SCALE * (1.15 ** (n - 1))`. Level 1 is the current base (`420 * SCALE`). Serve and paddle bounce use this speed unless slow is active.
- Every 5 bricks broken in the current level, spawn one falling capsule at that brick's `x, y`. Size `32x16 * SCALE`. Fall speed `180` px/s `* SCALE`. Type is random 50/50 `wide` or `slow`. Counter resets to 0 on `loadLevel`. Several capsules may fall at once. Missed capsules that pass the bottom are deleted.
- Catch = paddle AABB. Play `ball-bounce.mp3`. `wide`: paddle width `* 1.5`, then clamp X to the canvas. `slow`: ball speed `* 0.7` of the current level speed. Duration `5000` ms for both. Catching the same type restarts its timer. The other type may run in parallel.
- HTML HUD items `WIDE` and `SLOW` with `#wide` and `#slow`, between `LEVEL` and `LIVES`. Inactive shows `--`. Active shows remaining whole seconds `5`..`1`. Style like `#score` in `style.css`.
- Canvas capsules only (no atlas names). Wide: cyan fill, white `W`. Slow: yellow fill, black `S`. 1px stroke. Draw after explosions, before paddle.
- Pause freezes capsule fall and both timers (same freeze idea as SPEC 03 explosions). `loadLevel`, new game, life miss, Win, and Lose delete falling capsules and cancel both effects.

**Out of scope (for future specs):**

- Extra life, sticky paddle, multi-ball, laser, or any third power-up type.
- New overlay nodes, new audio files, atlas edits. ES modules.
- High scores, localStorage, gray / multi-hit bricks, color score table.
- Changing the five ASCII patterns. Touch controls.
- Carrying active effects across levels or across a life miss.
- Frameworks, bundlers, TypeScript, npm deps.

## Data model

Reuse SPEC 03 `game` in `game.js`. Move layout constants into `levels.js`. Move power-up state and helpers into `powerups.js`. Speed formula stays in `game.js`.

```js
// levels.js (globals)
const COLS = 13;
const ROWS = 6;
const ROW_COLORS = ['red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green'];
const LEVELS = [ /* same five 13x6 ASCII grids as SPEC 03 */ ];

// powerups.js (globals)
const BREAKS_PER_DROP = 5;
const POWERUP_DURATION = 5000;
const POWERUP_FALL_SPEED = 180;
const POWERUP_W = 32;
const POWERUP_H = 16;
const PADDLE_WIDE_MULT = 1.5;
const BALL_SLOW_MULT = 0.7;
let breaksInLevel = 0;
const powerups = [/* { x, y, w, h, type } */]; // type: 'wide' | 'slow'
const effects = { wideMs: 0, slowMs: 0 };
// helpers: maybeSpawnPowerup, updatePowerups, catchPowerups,
// tickEffects, drawPowerups, clearPowerups, remapPowerups,
// paddleBaseWidth, applyPaddleWidth
// Helpers may read game.js globals (SCALE, paddle, ball, ctx, aabb, playBounce)
// at call time. No ES modules.

// game.js
const BALL_SPEED = 420;
const LEVEL_SPEED_MULT = 1.15;

const game = {
  state: 'start', // 'start' | 'playing' | 'paused' | 'win' | 'lose'
  level: 1,
  paused: false,
  score: 0,
  lives: 3,
  paddle: { x: 0, y: 0, w: PADDLE_W, h: PADDLE_H },
  ball: { x: 0, y: 0, w: BALL_W, h: BALL_H, vx: 0, vy: 0, glued: true },
  bricks: [/* { x, y, w, h, color, alive } */],
  explosions: [/* { x, y, w, h, color, t0 } */],
};
```

- `levelBallSpeed()` = `BALL_SPEED * SCALE * (LEVEL_SPEED_MULT ** (game.level - 1))`.
- `currentBallSpeed()` = `levelBallSpeed() * (game.effects.slowMs > 0 ? BALL_SLOW_MULT : 1)`. Serve and paddle bounce assign `vx`/`vy` from `currentBallSpeed()`, never from a raw `BALL_SPEED * SCALE`.
- `paddleBaseWidth()` = `PADDLE_W * SCALE`. While `wideMs > 0`, `paddle.w = paddleBaseWidth() * PADDLE_WIDE_MULT`, then clamp `paddle.x` to `[0, CANVAS_W - paddle.w]`.
- On brick break: `breaksInLevel += 1`. If `breaksInLevel % BREAKS_PER_DROP === 0`, push a capsule `{ x: brick.x, y: brick.y, w: POWERUP_W * SCALE, h: POWERUP_H * SCALE, type }` with `type` from `Math.random() < 0.5 ? 'wide' : 'slow'`.
- While `playing`, capsules `y += POWERUP_FALL_SPEED * SCALE * dt`. Delete if `y > CANVAS_H`. Do not move them while `paused`.
- While `playing`, subtract elapsed ms from `wideMs` and `slowMs` (floor at 0). Do not subtract while `paused`. At 0, restore paddle width or ball speed.
- Catching `wide` sets `wideMs = POWERUP_DURATION`. Catching `slow` sets `slowMs = POWERUP_DURATION`. Refresh does not stack 1.5*1.5 or 0.7*0.7.
- `clearPowerups()`: `powerups = []`, `effects.wideMs = 0`, `effects.slowMs = 0`, restore paddle width, write `--` to `#wide` and `#slow`. Call from `loadLevel`, `resetGame`, life miss, Win, and Lose.
- HUD: if remaining is 0, show `--`. Else show `Math.ceil(ms / 1000)` (5000 shows `5`, 1 shows `1`).
- Coordinates origin top-left. Velocities in pixels per second. No persistence.

## Implementation plan

1. Create `levels.js` with `COLS`, `ROWS`, `ROW_COLORS`, and the five SPEC 03 `LEVELS` grids (same comments: full, checker, pyramid, two banks, sparse). Remove those four bindings from `game.js`. In `index.html`, add `<script src="levels.js"></script>` between `spritesheet.js` and `game.js`. Manual test: `python3 -m http.server 8000` still plays all five levels; no new 404.

2. In `index.html`, add HUD items `WIDE` (`#wide`) and `SLOW` (`#slow`) between `LEVEL` and `LIVES`, default `--`. In `style.css`, style them like `#score`. In `game.js`, cache the elements and write `--` from `resetGame`. Manual test: HUD shows `--`; play is unchanged.

3. Add `LEVEL_SPEED_MULT` and `levelBallSpeed()`. Point serve and paddle bounce at it. `loadLevel(n)` already sets `game.level` before the next serve. Manual test: level 1 serve matches today's speed; pause-jump to 5 then serve is faster (`1.15 ** 4`); Start new game is base speed again.

4. Add `breaksInLevel` and `game.powerups`. On break, increment and spawn a random capsule every 5th break of the level. Move and draw capsules (cyan `W` / yellow `S`) after explosions, before paddle. Cull below the canvas. Reset the counter and the list inside `loadLevel`. Manual test: fifth brick of level 1 drops a capsule that falls and vanishes; jumping level clears any in flight.

5. Paddle AABB catch for `wide`: remove capsule, `ball-bounce.mp3`, `wideMs = 5000`, widen paddle 1.5x and clamp X. Tick `wideMs` only while `playing`. Expire restores base width. HUD `#wide` shows `5`..`1` then `--`. `clearPowerups` on `loadLevel`, life miss, Win, Lose, and `resetGame`. Pause does not tick the timer or move capsules. Manual test: catch wide, paddle grows for 5s, P freezes the HUD number, resume finishes the timer; miss a life and the paddle is normal.

6. Catch `slow` the same way with `slowMs`. `currentBallSpeed()` applies `0.7` while `slowMs > 0`. Paddle bounce and serve must use `currentBallSpeed()` so a bounce does not restore full level speed. Wide and slow may both be active. Same-type catch refreshes that timer only. Manual test: catch slow, ball is slower for 5s including after a paddle hit; catch wide while slow is running and both HUD numbers tick; catch slow again and the slow timer returns to 5.

7. On desktop resize, remap each falling capsule `x, y, w, h` by the SCALE ratio (same idea as SPEC 01 explosions). Re-apply current paddle width from `wideMs` and clamp X. Ball velocity keeps direction and uses `currentBallSpeed()` at the new SCALE. Manual test: resize with a falling capsule and an active wide paddle; both stay on-world and play continues.

8. Create `powerups.js` with the power-up constants, `breaksInLevel`, `powerups`, `effects`, `#wide`/`#slow` HUD writes, and the drop/catch/draw/tick/clear/remap helpers (plus `paddleBaseWidth` / `applyPaddleWidth`). Remove those bindings from `game.js`. In `index.html`, add `<script src="powerups.js"></script>` between `levels.js` and `game.js`. `levelBallSpeed`, `currentBallSpeed`, `applyBallSpeed`, serve, and paddle bounce stay in `game.js`. Manual test: play is unchanged from step 7; `powerups.js` is 200, no new 404.

## Acceptance criteria

- [ ] `python3 -m http.server 8000` loads with `levels.js` and `powerups.js` (no 404) and no spritesheet error. The five patterns still match SPEC 03.
- [ ] `LEVELS`, `COLS`, `ROWS`, and `ROW_COLORS` live in `levels.js`. They are not redeclared in `game.js`.
- [ ] Power-up constants, `breaksInLevel`, `powerups`, `effects`, and the drop/catch/draw/tick/clear/remap helpers live in `powerups.js`. They are not redeclared in `game.js`. Script order is `spritesheet.js`, `levels.js`, `powerups.js`, `game.js`.
- [ ] Level 1 ball speed equals today's `BALL_SPEED * SCALE`. Level n uses `* (1.15 ** (n - 1))` on auto-next, pause keys 1-5, and a glued serve after `loadLevel`.
- [ ] New game (Start after Win/Lose) is level 1 at base speed, score 0, lives 3.
- [ ] The 5th, 10th, 15th, ... brick broken in the current level drops one capsule. The counter resets on `loadLevel`.
- [ ] Capsule type is random `wide` or `slow`. Size is the brick rect. It spawns at the broken brick and falls at `180 * SCALE` px/s.
- [ ] Several capsules may fall at once. A capsule that passes the bottom is gone and does nothing.
- [ ] Paddle AABB catch plays `ball-bounce.mp3`, removes that capsule, and starts or refreshes that type's 5000 ms timer.
- [ ] Wide: paddle width is `1.5 * PADDLE_W * SCALE`, clamped inside the canvas, for 5 seconds.
- [ ] Slow: ball speed is `0.7 * levelBallSpeed()` for 5 seconds, including serve and paddle bounce while it is active. Expiry restores `levelBallSpeed()`, not base level-1 speed if the current level is 2-5.
- [ ] Wide and slow can run at the same time. Catching the same type again sets that timer back to 5000 ms and does not stack the multiplier.
- [ ] HUD `#wide` and `#slow` sit between LEVEL and LIVES. Inactive `--`. Active whole seconds via `Math.ceil`.
- [ ] Pause freezes capsule motion and both timers. Resume continues them. P still does not serve on the resume press (SPEC 03).
- [ ] `loadLevel`, new game, life miss, Win, and Lose clear falling capsules and both effects (paddle and ball back to non-power-up sizes/speeds for that moment).
- [ ] Draw order: bricks, explosions, capsules, paddle, ball. Capsules are canvas fills with `W` / `S`, not atlas sprites.
- [ ] Resize remaps falling capsules and the wide paddle at the new `SCALE`.
- [ ] SPEC 02 explosions, +10 score, and `break-sound.mp3` on break still work. No new mp3s. `spritesheet.js` is unchanged. No ES modules.

## Decisions

- **Yes:** One spec for `levels.js` + 15% speed + power-ups. User rejected a split into SPEC 04 / SPEC 05.
- **Yes:** Separate `powerups.js` (mid-impl amendment). User wants drop/catch/effects out of `game.js` so the loop file is easier to read. Same global-script pattern as `levels.js`. No ES modules.
- **Yes:** `powerups.js` owns constants, falling list, timers, HUD writes for `#wide`/`#slow`, and helpers. `game.js` keeps `levelBallSpeed` / `currentBallSpeed` / serve / paddle bounce and calls the helpers.
- **Yes:** Move `LEVELS`, `COLS`, `ROWS`, `ROW_COLORS` to `levels.js` so the grid contract lives in one file. Speed formula stays in `game.js`.
- **No:** Per-level speed table inside `levels.js`. Compound `1.15 ** (level - 1)` is enough.
- **Yes:** Compound multiplier on every `loadLevel`, including pause jump 1-5. Jump to 5 is immediately faster.
- **No:** Apply +15% only on auto-advance. That would make keys 1-5 lie about difficulty.
- **No:** Additive `1 + 0.15 * (level - 1)`. User chose compound.
- **Yes:** Timed types are only wider paddle and slower ball. Duration 5s for both (`POWERUP_DURATION = 5000`).
- **Yes:** Magnitudes `1.5` width and `0.7` of current level speed. Slow is on top of the level multiplier, then restores to that level speed.
- **Yes:** At most one wide timer and one slow timer. Same-type catch refreshes. Other type can run in parallel. Multipliers do not stack with themselves.
- **No:** Replace-all single slot. No ignore-if-already-active.
- **Yes:** Break counter is per level and resets on `loadLevel`. Missed capsules are deleted.
- **Yes:** Spawn every 5th break even if other capsules are still falling.
- **Yes:** Type per drop is `Math.random()` 50/50.
- **No:** Alternate wide/slow. No "never the same twice in a row" rule.
- **Yes:** Canvas capsule (brick-sized), cyan `W` / yellow `S`. No atlas names, no new images.
- **Yes:** HTML HUD `#wide` / `#slow` between LEVEL and LIVES.
- **No:** Canvas timer bar. No combined POWER slot.
- **Yes:** Catch sound is `ball-bounce.mp3`. Brick still plays `break-sound.mp3`.
- **Yes:** Clear falling + effects on `loadLevel`, new game, life miss, Win, and Lose. Pause only freezes.
- **No:** Carry wide/slow across levels or across a life miss.
- **Yes:** Remaining-ms timers (`wideMs` / `slowMs`) so pause can skip the tick without clock skew.
- **No:** Extra life, sticky, multi-ball, laser, gray bricks, localStorage, extra audio, atlas edits.

## Risks

| Risk | Mitigation |
| --- | --- |
| Level 5 compound speed tunnels through bricks | Keep SPEC 01 `BALL_MAX_STEP` substeps. Speed stays a named helper, not a one-off multiply. |
| Paddle bounce assigns full `scaledBallSpeed()` and cancels slow | Serve and paddle bounce must call `currentBallSpeed()`. |
| Wide paddle hangs off the right edge | After any width change or resize, clamp `paddle.x`. |
| Timestamp-based expiry keeps running during pause | Store remaining ms; subtract only while `state === 'playing'`. |
| Resize mid-fall desyncs capsules | Remap `x,y,w,h` by the SCALE ratio, same as explosions. |
| Sparse level 5 has few bricks so few drops | Accepted. Counter is per level by design. |
| `powerups.js` loads before `game.js` so it cannot read `SCALE` at parse time | Helpers read `SCALE`, paddle, ball, and `ctx` at call time only. |

## What is **not** in this spec

- Extra life, sticky paddle, multi-ball, laser, or other power-up types.
- New audio, atlas edits, new overlay markup, ES modules.
- High scores, localStorage, gray / multi-hit bricks.
- Pattern changes to the five SPEC 03 grids.
- Carrying power-ups across levels or life misses.
- Frameworks, bundlers, tests, touch controls.

Each one of those, if it lands, goes in its own spec.
