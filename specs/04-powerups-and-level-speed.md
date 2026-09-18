# SPEC 04 - Power-ups, levels.js, and per-level ball speed

> **Status:** Implemented
> **Depends on:** SPEC 01, SPEC 02, SPEC 03
> **Date:** 2026-09-18
> **Objective:** Move the five level patterns into `levels.js`, extract power-up logic into `powerups.js`, multiply ball speed by 1.15 per level, and drop one of six random capsules every 5 brick breaks.

## Why this spec exists

SPEC 03 hardcoded `LEVELS` in `game.js` and deferred both power-ups and `levels.js`. This spec does those two deferred items together, plus the level speed rule, because they were requested as one feature. Mid-impl, power-up code was moved to `powerups.js` so `game.js` stays the loop. Mid-impl again, the user expanded the drop table from two timed types to six random types and one POWER HUD slot.

## Scope

**In:**

- New file `levels.js` at repo root. Move `LEVELS`, `COLS`, `ROWS`, and `ROW_COLORS` there as globals. Patterns stay the five SPEC 03 ASCII grids.
- New file `powerups.js` at repo root. Move power-up constants, `breaksInLevel`, `powerups`, `effects`, shots, HUD writes for `#power`, and the drop/catch/draw/tick/clear/remap helpers there as globals. `game.js` keeps the loop, bricks, paddle, balls, `levelBallSpeed`, `currentBallSpeed`, serve, and paddle bounce, and calls those helpers. Script order in `index.html`: `assets/spritesheet.js`, `levels.js`, `powerups.js`, `game.js`.
- Ball speed on every `loadLevel(n)` (auto-next, pause keys 1-5, new game): `BALL_SPEED * SCALE * (1.15 ** (n - 1))`. Level 1 is the current base (`420 * SCALE`). Serve and paddle bounce use this speed unless slow is active. Slow applies to every live ball.
- Every 5 bricks broken in the current level, spawn one falling capsule at that brick's `x, y`. Size `32x16 * SCALE`. Fall speed `180` px/s `* SCALE`. Type is equal random among six: `wide`, `slow`, `life`, `sticky`, `multi`, `laser`. Counter resets to 0 on `loadLevel`. Several capsules may fall at once. Missed capsules that pass the bottom are deleted.
- Catch = paddle AABB. Play `ball-bounce.mp3`. Timed types last `5000` ms. Catching the same timed type restarts that timer only. Other types may run in parallel. Multipliers do not stack with themselves.
- `wide`: paddle width `* 1.5`, then clamp X. `slow`: ball speed `* 0.7` of the current level speed (every serve and paddle bounce, every ball). `life`: instant `+1` life, cap 3; at 3 lives the catch still plays bounce and does nothing else. `sticky`: for 5s, a paddle hit glues that ball; Space/click serves as usual unless laser is also active. `multi`: at most 3 balls; lose a life only when every ball is gone. `laser`: for 5s, Space/click fires one upward shot (does not serve); at most one shot on screen; a hit brick uses the same +10 / explosion / `break-sound.mp3` path as a ball break.
- HTML HUD item `POWER` with `#power`, between `LEVEL` and `LIVES`. Inactive `--`. Active: space-separated tokens in order `W S T M L` (skip `E`). Timed tokens are letter plus `Math.ceil(ms / 1000)` (`W5`). `M` shows while more than one ball is alive (no seconds). Extra life is not listed; LIVES pips update. Style `#power` like `#score` in `style.css`. Remove `#wide` and `#slow`.
- Canvas capsules only (no atlas names). Letters and fills: `W` cyan, `S` yellow, `E` green, `T` magenta, `M` red, `L` gray. White letter on cyan/magenta/red/gray, black letter on yellow/green. 1px black stroke. Draw after explosions, before paddle.
- Pause freezes capsule fall, shots, extra-ball motion, and all timers (same freeze idea as SPEC 03 explosions). `loadLevel`, new game, life miss, Win, and Lose delete falling capsules, shots, extra balls, and cancel all effects.

**Out of scope (for future specs):**

- A seventh power-up type. Extra life above 3. Auto-fire laser. More than one shot on screen. More than 3 balls.
- New overlay nodes, new audio files, atlas edits. ES modules.
- High scores, localStorage, gray / multi-hit bricks, color score table.
- Changing the five ASCII patterns. Touch controls.
- Carrying active effects across levels or across a life miss.
- Frameworks, bundlers, TypeScript, npm deps.

## Data model

Reuse SPEC 03 `game` in `game.js`. Move layout constants into `levels.js`. Move power-up state and helpers into `powerups.js`. Speed formula stays in `game.js`. Balls become an array so multi-ball can run.

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
const POWERUP_TYPES = [ 'wide', 'slow', 'life', 'sticky', 'multi', 'laser' ];
const SHOT_W = 4;
const SHOT_H = 12;
const SHOT_SPEED = 500;
let breaksInLevel = 0;
const powerups = [/* { x, y, w, h, type } */];
const shots = [/* { x, y, w, h } */];
const effects = { wideMs: 0, slowMs: 0, stickyMs: 0, laserMs: 0 };
// helpers: maybeSpawnPowerup, updatePowerups, catchPowerups,
// tickEffects, drawPowerups, clearPowerups, remapPowerups,
// paddleBaseWidth, applyPaddleWidth, writePowerHud, fireLaser
// Helpers may read game.js globals (SCALE, paddle, balls, ctx, aabb, playBounce)
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
  balls: [/* { x, y, w, h, vx, vy, glued } */],
  bricks: [/* { x, y, w, h, color, alive } */],
  explosions: [/* { x, y, w, h, color, t0 } */],
};
```

- Type per drop: `POWERUP_TYPES[ Math.floor( Math.random() * 6 ) ]`. Equal 1/6. No "never the same twice" rule.
- `levelBallSpeed()` = `BALL_SPEED * SCALE * (LEVEL_SPEED_MULT ** (game.level - 1))`.
- `currentBallSpeed()` = `levelBallSpeed() * (effects.slowMs > 0 ? BALL_SLOW_MULT : 1)`. Serve and paddle bounce for every ball assign `vx`/`vy` from `currentBallSpeed()`.
- `paddleBaseWidth()` = `PADDLE_W * SCALE`. While `wideMs > 0`, `paddle.w = paddleBaseWidth() * PADDLE_WIDE_MULT`, then clamp `paddle.x`.
- On brick break (ball or laser shot): `breaksInLevel += 1`. If `breaksInLevel % BREAKS_PER_DROP === 0`, push a capsule at the brick rect.
- While `playing`, capsules `y += POWERUP_FALL_SPEED * SCALE * dt`. Delete if `y > CANVAS_H`. Shots `y -= SHOT_SPEED * SCALE * dt`. Delete if `y + h < 0`. Do not move capsules or shots while `paused`.
- While `playing`, subtract elapsed ms from `wideMs`, `slowMs`, `stickyMs`, `laserMs` (floor at 0). Do not subtract while `paused`. At 0, restore paddle width, ball speed, sticky glue-on-hit, or laser fire.
- Catch `wide` / `slow` / `sticky` / `laser`: set that `*Ms = POWERUP_DURATION`. Refresh does not stack 1.5*1.5 or 0.7*0.7.
- Catch `life`: if `lives < 3`, `lives += 1` and write LIVES. Always play bounce.
- Catch `multi`: ensure there are 3 balls. If 1 in flight, spawn 2 more at the same `x, y` with current speed and heading plus/minus `0.35` rad. If glued, 3 glued on the paddle. If already 3, bounce only.
- Lose a life only when `balls.length === 0` after a bottom miss. Then `clearPowerups` and glue a single new ball (or Lose if lives hit 0).
- Sticky: if `stickyMs > 0` and a ball hits the paddle, set that ball `glued`. Space/click serves glued balls unless `laserMs > 0`.
- Laser: while `laserMs > 0` and `state === 'playing'`, Space/click does not serve. If `shots.length === 0`, spawn a shot at paddle top-center, size `SHOT_W x SHOT_H * SCALE`. Shot vs brick uses the same break path as the ball, then deletes the shot. Shot vs top wall deletes the shot.
- `clearPowerups()`: empty `powerups` and `shots`, zero all four timers, collapse to one ball if called while any remain, restore paddle width, write `--` to `#power`. Call from `loadLevel`, `resetGame`, life miss, Win, and Lose.
- HUD `#power`: if no timed effect and `balls.length <= 1`, `--`. Else tokens in order W, S, T, M, L. Example: `W5 S2 M L4`.
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

9. Replace HUD `WIDE`/`SLOW` with one `POWER` (`#power`) between LEVEL and LIVES. Style like `#score`. `powerups.js` writes `--` or the token string. Spawn type is equal 1/6 among the six. Draw all six capsule letters/colors. Catch `life` (+1, cap 3). Manual test: fifth-brick drops show mixed letters; catching `E` at 2 lives shows 3 pips; at 3 pips it stays 3; HUD is one slot.

10. Catch `sticky`: `stickyMs = 5000`. Paddle hit glues that ball; Space/click still serves while laser is off. Pause freezes the sticky timer. `clearPowerups` cancels sticky. Manual test: catch `T`, next paddle hit glues, Space serves; P freezes the POWER token.

11. Turn the single ball into a `balls` array. Catch `multi` makes 3 balls (spread `+- 0.35` rad if in flight). Slow applies to every ball. Lose a life only when no balls remain. Extra balls vanish on `clearPowerups`. POWER shows `M` while `balls.length > 1`. Manual test: catch `M`, three balls; miss one and play continues; miss all and lose a life with one glued ball.

12. Catch `laser`: `laserMs = 5000`. While it is active, Space/click fires one shot up (`SHOT_SPEED`) and does not serve. One shot on screen. Shot vs brick = same break path as the ball, then the shot is gone. Pause freezes the shot and the timer. Resize remaps shots. Manual test: catch `L`, Space shoots, a brick breaks with explosion and +10; a second Space does nothing until the shot is gone; glued ball does not launch while laser is on.

13. Resize remaps every live ball (position + `currentBallSpeed()` direction) and every shot. Wide paddle still reapplies. Manual test: resize with multi-ball, a falling capsule, and wide+laser; play continues on-world.

## Acceptance criteria

- [ ] `python3 -m http.server 8000` loads with `levels.js` and `powerups.js` (no 404) and no spritesheet error. The five patterns still match SPEC 03.
- [ ] `LEVELS`, `COLS`, `ROWS`, and `ROW_COLORS` live in `levels.js`. They are not redeclared in `game.js`.
- [ ] Power-up constants, `breaksInLevel`, `powerups`, `effects`, shots, and the drop/catch/draw/tick/clear/remap helpers live in `powerups.js`. They are not redeclared in `game.js`. Script order is `spritesheet.js`, `levels.js`, `powerups.js`, `game.js`.
- [ ] Level 1 ball speed equals today's `BALL_SPEED * SCALE`. Level n uses `* (1.15 ** (n - 1))` on auto-next, pause keys 1-5, and a glued serve after `loadLevel`.
- [ ] New game (Start after Win/Lose) is level 1 at base speed, score 0, lives 3, one glued ball.
- [ ] The 5th, 10th, 15th, ... brick broken in the current level drops one capsule. The counter resets on `loadLevel`.
- [ ] Capsule type is equal random among `wide`, `slow`, `life`, `sticky`, `multi`, `laser`. Size is the brick rect. It spawns at the broken brick and falls at `180 * SCALE` px/s.
- [ ] Several capsules may fall at once. A capsule that passes the bottom is gone and does nothing.
- [ ] Paddle AABB catch plays `ball-bounce.mp3` and removes that capsule.
- [ ] Wide: paddle width is `1.5 * PADDLE_W * SCALE`, clamped, for 5 seconds.
- [ ] Slow: every ball is `0.7 * levelBallSpeed()` for 5 seconds, including serve and paddle bounce. Expiry restores `levelBallSpeed()`, not level-1 speed if the current level is 2-5.
- [ ] Life: +1 life, cap 3. Catch at 3 lives does not add a life.
- [ ] Sticky: for 5 seconds a paddle hit glues that ball; Space/click serves unless laser is active.
- [ ] Multi: catch yields 3 balls. A life is lost only when every ball is gone. Recatch at 3 balls does not add more.
- [ ] Laser: for 5 seconds Space/click shoots (does not serve), one shot on screen. Brick hit uses +10, explosion, `break-sound.mp3`, and the drop counter.
- [ ] Timed types can run at the same time. Catching the same timed type again sets that timer back to 5000 ms and does not stack the multiplier.
- [ ] HUD `#power` sits between LEVEL and LIVES. Inactive `--`. Active tokens via `Math.ceil` in order W S T M L.
- [ ] Pause freezes capsules, shots, extra balls, and all timers. Resume continues them. P still does not serve on the resume press (SPEC 03).
- [ ] `loadLevel`, new game, life miss, Win, and Lose clear falling capsules, shots, extra balls, and all effects.
- [ ] Draw order: bricks, explosions, capsules, paddle, balls, shots. Capsules are canvas fills, not atlas sprites.
- [ ] Resize remaps falling capsules, shots, live balls, and the wide paddle at the new `SCALE`.
- [ ] SPEC 02 explosions, +10 score, and `break-sound.mp3` on break still work. No new mp3s. `spritesheet.js` is unchanged. No ES modules.

## Decisions

- **Yes:** One spec for `levels.js` + 15% speed + power-ups. User rejected a split into SPEC 04 / SPEC 05.
- **Yes:** Separate `powerups.js` (mid-impl amendment). User wants drop/catch/effects out of `game.js` so the loop file is easier to read. Same global-script pattern as `levels.js`. No ES modules.
- **Yes:** `powerups.js` owns constants, falling list, timers, shots, HUD writes, and helpers. `game.js` keeps `levelBallSpeed` / `currentBallSpeed` / serve / paddle bounce and calls the helpers.
- **Yes:** Move `LEVELS`, `COLS`, `ROWS`, `ROW_COLORS` to `levels.js` so the grid contract lives in one file. Speed formula stays in `game.js`.
- **No:** Per-level speed table inside `levels.js`. Compound `1.15 ** (level - 1)` is enough.
- **Yes:** Compound multiplier on every `loadLevel`, including pause jump 1-5. Jump to 5 is immediately faster.
- **No:** Apply +15% only on auto-advance. That would make keys 1-5 lie about difficulty.
- **No:** Additive `1 + 0.15 * (level - 1)`. User chose compound.
- **Yes:** Six types (mid-impl amendment): wide, slow, extra life, sticky, multi-ball, laser. User asked for six random power-ups.
- **Yes:** Equal 1/6 per drop, still every 5th brick. No weighted table. No "never the same twice".
- **Yes:** Timed types `wide`, `slow`, `sticky`, `laser` use `POWERUP_DURATION = 5000`. Extra life is instant. Multi lasts until balls are gone or `clearPowerups`.
- **Yes:** Magnitudes `1.5` width and `0.7` of current level speed. Slow is on top of the level multiplier, then restores to that level speed, and applies to every live ball.
- **Yes:** Parallel timers per timed type. Same-type catch refreshes. Extra life does not use a timer.
- **No:** Replace-all single slot. No ignore-if-already-active (except life at cap 3 and multi at 3 balls).
- **Yes:** Extra life +1, cap 3, so the existing 3 LIVES pips stay valid.
- **Yes:** Sticky 5s window: paddle hit glues that ball; Space/click still serves unless laser is on.
- **Yes:** Multi-ball is 3 balls. Miss a life only when all are gone. Recatch with 3 already live is bounce-only.
- **Yes:** Laser 5s, Space/click shoots and does not serve, one shot on screen. Brick break reuses SPEC 02.
- **Yes:** One POWER HUD `#power` between LEVEL and LIVES. User rejected six SCORE-like columns.
- **No:** Keep `#wide` / `#slow` after the six-type amendment. No canvas timer bar.
- **Yes:** Capsule letters W cyan, S yellow, E green, T magenta, M red, L gray. Canvas fills, no atlas.
- **Yes:** Break counter is per level and resets on `loadLevel`. Missed capsules are deleted.
- **Yes:** Spawn every 5th break even if other capsules are still falling.
- **Yes:** Catch sound is `ball-bounce.mp3`. Brick still plays `break-sound.mp3`.
- **Yes:** Clear falling + shots + extra balls + effects on `loadLevel`, new game, life miss, Win, and Lose. Pause only freezes.
- **No:** Carry power-ups across levels or across a life miss.
- **Yes:** Remaining-ms timers so pause can skip the tick without clock skew.
- **No:** Seventh type, extra life above 3, auto-fire, gray bricks, localStorage, extra audio, atlas edits.
- **Yes:** Shot size `4x12` and speed `500` px/s, multi spread `0.35` rad. Picked so the data model is implementable; user did not give geometry.

## Risks

| Risk | Mitigation |
| --- | --- |
| Level 5 compound speed tunnels through bricks | Keep SPEC 01 `BALL_MAX_STEP` substeps. Speed stays a named helper, not a one-off multiply. |
| Paddle bounce assigns full `scaledBallSpeed()` and cancels slow | Serve and paddle bounce must call `currentBallSpeed()` for every ball. |
| Wide paddle hangs off the right edge | After any width change or resize, clamp `paddle.x`. |
| Timestamp-based expiry keeps running during pause | Store remaining ms; subtract only while `state === 'playing'`. |
| Resize mid-fall desyncs capsules | Remap `x,y,w,h` by the SCALE ratio, same as explosions. |
| Sparse level 5 has few bricks so few drops | Accepted. Counter is per level by design. |
| `powerups.js` loads before `game.js` so it cannot read `SCALE` at parse time | Helpers read `SCALE`, paddle, balls, and `ctx` at call time only. |
| Laser Space vs serve vs pause Space | Laser fire only while `state === 'playing'` and `laserMs > 0`. Start / Pause / Win / Lose keep SPEC 03 Space meaning. |
| Sticky plus laser leaves a glued ball that cannot serve | Accepted. Laser owns Space until `laserMs` hits 0. |
| Three balls plus substeps cost | Still cap at 3. Same `BALL_MAX_STEP` per ball. |

## What is **not** in this spec

- A seventh power-up type. Extra life above 3. Auto-fire laser. More than 3 balls.
- New audio, atlas edits, new overlay markup, ES modules.
- High scores, localStorage, gray / multi-hit bricks.
- Pattern changes to the five SPEC 03 grids.
- Carrying power-ups across levels or life misses.
- Frameworks, bundlers, tests, touch controls.

Each one of those, if it lands, goes in its own spec.
