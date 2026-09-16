# SPEC 02 - Block-breaking animation

> **Status:** Draft
> **Depends on:** SPEC 01
> **Date:** 2026-09-16
> **Objective:** Polish the existing atlas brick-break explosion so every hit plays all 4 color-matched frames in the brick rect for 150ms.

## Why this spec exists

SPEC 01 already spawns `EXPLOSION_FRAMES` on break. This spec does not add a second effect. It locks the visible contract: color, dest rect, duration, draw order, and overlay lifecycle, and it fixes playback so the 4 frames are actually seen.

## Scope

**In:**

- Keep the SPEC 01 explosion: `drawFrame` over `EXPLOSION_FRAMES[color]`, duration `EXPLOSION_DURATION` (150ms).
- On hit: set `brick.alive = false` immediately, spawn one explosion in that brick's `x, y, w, h`.
- Map each brick color to the matching `EXPLOSION_FRAMES` key: `red`, `yellow`, `cyan`, `magenta`, `hotpink`, `green`.
- Show all 4 frames in equal slices of 150ms. Do not drop the last frame by culling at the start of the last slice.
- Draw order stays: playfield, bricks, explosions, paddle, ball.
- Keep drawing and advancing explosions during `win` and `lose`. Clear the list only in `resetGame` / Start.
- Win overlay still appears immediately when the last brick dies.
- Change only `game.js`. Do not edit `spritesheet.js` atlas coords, `EXPLOSION_DURATION`, or `EXPLOSION_FRAMES`.

**Out of scope (for future specs):**

- Drawing larger than the brick rect.
- Particles, screen shake, canvas flash, extra motion, CSS animation.
- New image or audio files. Extra sounds beyond `break-sound.mp3` / `ball-bounce.mp3`.
- Overlay delay, overlay opacity, or any `style.css` change.
- New files (`explosions.js` or similar). New HTML script tags.
- Pause, power-ups, gray/multi-hit bricks, color score table.

## Data model

This feature introduces no new data structures. It reuses SPEC 01 explosions in `game.js`.

```js
// existing list in game.js
explosions: [/* { x, y, w, h, color, t0 } */]
```

- `x, y, w, h`: same dest rect as the brick at hit time (already scaled).
- `color`: the brick's `color` string; used as `EXPLOSION_FRAMES[color]`.
- `t0`: the same clock as the `requestAnimationFrame` timestamp passed to `draw` (`DOMHighResTimeStamp`).
- Frame index: `floor((elapsed / EXPLOSION_DURATION) * 4)` clamped to `0..3` while `elapsed < EXPLOSION_DURATION`.
- Coordinates origin top-left. No persistence.

## Implementation plan

1. In `game.js`, keep `spawnExplosion(brick)` writing `{ x, y, w, h, color, t0 }` from the hit brick. Set `t0` from the current rAF timestamp (or the same clock `draw` uses), not a mismatched clock. Manual test: break one brick; the explosion sits in that cell and the brick sprite is gone.
2. In the explosion draw/cull path, map elapsed time to 4 equal slices of `EXPLOSION_DURATION`. Draw with `drawFrame(ctx, frames[idx], exp.x, exp.y, exp.w, exp.h)` only. Cull when `elapsed >= EXPLOSION_DURATION`. Manual test: break several bricks; 4 frames play in 150ms in the brick rect.
3. Keep draw order `drawBricks` -> explosions -> paddle -> ball. Do not skip explosion draw when `state` is `win` or `lose`. Clear `explosions` only inside `resetGame`. Manual test: last brick still shows Win immediately; starting a new game leaves no leftover frames.
4. Confirm `hitBrick` still plays `break-sound.mp3` and adds 10 points, and that each row color uses `EXPLOSION_FRAMES[color]`. Manual test: break at least one brick in each of the 6 rows; explosion color matches the row.

## Acceptance criteria

- [ ] Breaking a brick hides that brick immediately and plays the 4-frame atlas explosion in the same `x, y, w, h`.
- [ ] The explosion lasts 150ms (`EXPLOSION_DURATION`) and uses all 4 frames in order.
- [ ] Row colors `red`, `yellow`, `cyan`, `magenta`, `hotpink`, `green` each use `EXPLOSION_FRAMES` for that color.
- [ ] Explosions draw above remaining bricks and below paddle and ball.
- [ ] Several explosions can play at once.
- [ ] Win overlay still appears on the same break that clears the last brick. No delay for animations.
- [ ] Explosions keep advancing while the Win/Lose overlay is visible. A new game from Start shows none of the old frames.
- [ ] `spritesheet.js` is unchanged. No new files, no `style.css` change, no extra audio.
- [ ] Breaking a brick still adds exactly 10 points and still plays `break-sound.mp3`.

## Decisions

- **Yes:** Polish the SPEC 01 atlas explosion. It is already the break animation.
- **No:** Replace it with fade, scale, or particles. Extra effect types belong in another spec.
- **Yes:** Dest size is the brick rect. "Too small" was dropped in favor of matching the cell.
- **No:** 1.25x / 1.5x dest. Would cover neighbors and needs a size rule we rejected.
- **Yes:** Duration stays `EXPLOSION_DURATION` (150ms). Do not fork a second duration in `game.js`.
- **Yes:** Brick hides immediately. Explosion occupies that rect.
- **Yes:** Win overlay stays immediate, same as SPEC 01.
- **Yes:** Keep drawing explosions under the overlay. Do not freeze or clear on Win/Lose.
- **Yes:** Only `game.js` changes.
- **No:** `style.css` overlay opacity. Last-brick frames may sit under an opaque overlay; accepted.
- **No:** Edit atlas coordinates or invent sprite names.
- **No:** Extract `explosions.js`.

## Risks

| Risk | Mitigation |
| --- | --- |
| 150ms is about 9 frames at 60Hz, so each atlas frame is brief | Accepted. Duration is locked to `EXPLOSION_DURATION`. |
| Opaque Win overlay can hide the last brick's explosion | Accepted. Overlay timing and opacity stay SPEC 01. |
| `t0` from `performance.now()` vs rAF `ts` can skip the first frame | Use the same timestamp clock as `draw`. |
| Resize mid-explosion already remaps `x,y,w,h` in SPEC 01 | Keep that remap. Do not store unscaled dest. |

## What is **not** in this spec

- A new animation system or a dest rect larger than the brick.
- Particles, screen shake, flash, or CSS effects.
- Overlay delay or overlay opacity.
- New assets, new files, `spritesheet.js` edits, extra audio.
- Pause, power-ups, gray bricks, multi-hit bricks.

Each one of those, if it lands, goes in its own spec.
