# SPEC 03 - Five levels, pause, and change level

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-09-18
> **Objective:** Add five brick-pattern levels with auto-advance, a LEVEL HUD, P pause, and keys 1-5 to jump level while paused.

## Scope

**In:**

- Five hardcoded 13x6 cell patterns in `game.js`. Row colors stay SPEC 01: `red`, `yellow`, `cyan`, `magenta`, `hotpink`, `green` top to bottom. `X` is a brick. `.` is empty (no brick, not gray).
- HTML HUD shows `LEVEL` as `1`..`5` in `#level`. Files: `index.html`, `style.css`, `game.js`.
- New game from Start always loads level 1, score 0, lives 3.
- Clear all alive bricks on levels 1-4: load the next level immediately, glue the ball, keep score and lives, stay in `playing`. No Level Complete overlay.
- Clear all alive bricks on level 5: `YOU WIN` overlay (same copy as SPEC 01).
- P only while `playing` (glued or in flight) sets `paused` and shows the existing HTML overlay: title `PAUSED`, msg `P, Space or click to resume. Keys 1-5 change level.`
- P, Space, or click while `paused` resumes `playing` and hides the overlay. That press does not launch a glued ball.
- Keys `1`..`5` while `paused` call `loadLevel(n)`, keep score and lives, glue the ball, hide overlay, stay in `playing`.
- Freeze paddle, ball, and bricks while paused. Draw the last frame. Keep SPEC 02 explosions from advancing while paused (freeze `t0` clock or skip explosion update).
- Resize still scales the world. Rebuild the **current** pattern, not a full 13x6.

**Out of scope (for future specs):**

- Power-ups, high scores, localStorage.
- Pause on Start / Win / Lose. Level pick on the Start overlay.
- Unbreakable or multi-hit gray bricks. Color-based score table.
- Touch controls, extra audio files, `levels.js`, new overlay DOM nodes.
- Frameworks, bundlers, TypeScript, npm deps, atlas edits.



## Data model

Reuse SPEC 01 `game` in `game.js`. Add `level` and `paused`. Replace the always-full grid with `LEVELS`.

```js
const COLS = 13;
const ROWS = 6;
const ROW_COLORS = ['red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green'];

// X = brick, . = empty. Each string length is 13. Six rows per level.
const LEVELS = [
  [ // 1 full
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX',
    'XXXXXXXXXXXXX'
  ],
  [ // 2 checker
    'X.X.X.X.X.X.X',
    '.X.X.X.X.X.X.',
    'X.X.X.X.X.X.X',
    '.X.X.X.X.X.X.',
    'X.X.X.X.X.X.X',
    '.X.X.X.X.X.X.'
  ],
  [ // 3 pyramid
    '.....XXX.....',
    '....XXXXX....',
    '...XXXXXXX...',
    '..XXXXXXXXX..',
    '.XXXXXXXXXXX.',
    'XXXXXXXXXXXXX'
  ],
  [ // 4 two banks
    'XXXXX...XXXXX',
    'XXXXX...XXXXX',
    'XXXXX...XXXXX',
    'XXXXX...XXXXX',
    'XXXXX...XXXXX',
    'XXXXX...XXXXX'
  ],
  [ // 5 sparse
    'X.X.X.X.X.X.X',
    '.............',
    '.X.X.X.X.X.X.',
    '.............',
    'X.X.X.X.X.X.X',
    '.............'
  ]
];

// state: 'start' | 'playing' | 'paused' | 'win' | 'lose'
const game = {
  state: 'start',
  level: 1,
  paused: false, // true only when state is 'paused'; kept in sync
  score: 0,
  lives: 3,
  paddle: { x: 0, y: 0, w: PADDLE_W, h: PADDLE_H },
  ball: { x: 0, y: 0, w: BALL_W, h: BALL_H, vx: 0, vy: 0, glued: true },
  bricks: [/* { x, y, w, h, color, alive } */],
  explosions: [/* { x, y, w, h, color, t0 } */],
};
```

- `loadLevel(n)` with `n` in `1..5`: set `game.level = n`, write `#level`, rebuild `bricks` from `LEVELS[n - 1]` at current `SCALE`, glue the ball on the paddle, clear `explosions`. Do not change score or lives.
- Empty cells are omitted from `bricks` (no `alive: false` placeholders required).
- Win condition: no brick in `bricks` has `alive === true`.
- Coordinates origin top-left. No persistence.
- DOM: existing overlay ids plus `#level` in the HUD.



## Implementation plan

1. In `index.html`, add a HUD item `LEVEL` with `#level` default `1`, between SCORE and LIVES. In `style.css`, style `#level` like `#score`. In `game.js`, add `game.level = 1` and write `#level` in `resetGame`. Manual test: page still plays SPEC 01; HUD shows LEVEL 1.
2. Add `LEVELS` (all five grids) and `buildBricksFromPattern(pattern)`. Point the existing grid builder at `LEVELS[0]`. Resize uses the current pattern. Manual test: new game still looks like the full 13x6 rainbow grid.
3. Add `loadLevel(n)`. `resetGame` calls `loadLevel(1)` after zeroing score and lives. Manual test: Start still begins level 1, full grid, score 0, lives 3.
4. Add `paused`. P in `playing` sets `state` to `'paused'`, shows overlay copy from Scope, skips `update` movement. P / Space / click while paused returns to `'playing'` and `hideOverlay`, and does not serve. Ignore P on Start / Win / Lose. Manual test: mid-game P freezes ball and paddle; Space resumes without launching a glued ball; a second Space serves if glued.
5. While paused, keys `1`..`5` call `loadLevel(n)`, hide overlay, set `playing`. Keep score and lives. Manual test: break a few bricks, P, press 3; HUD says 3, pyramid is intact, ball is glued, score unchanged.
6. On last-brick break: if `game.level < 5`, `loadLevel(game.level + 1)` and stay `playing` (glued). If `game.level === 5`, `YOU WIN` as SPEC 01. Lose still at 0 lives on any level. Manual test: clear level 1 loads level 2 glued; clear level 5 shows YOU WIN; Space then Space starts level 1 again.



## Acceptance criteria

- [x] HUD shows `LEVEL` and the current number `1`..`5`. `python3 -m http.server 8000` still loads with no new 404s.
- [x] Start (first load or after Win/Lose) always begins level 1, score 0, lives 3, ball glued. Pattern is the full 13x6.
- [ ] Levels 2-5 match the ASCII grids in the data model (checker, pyramid, two banks, sparse). Row colors unchanged. `.` cells have no brick.
- [ ] Clearing levels 1-4 loads the next pattern immediately, glues the ball, keeps score and lives, updates `#level`. No extra overlay.
- [ ] Clearing level 5 shows `YOU WIN` / `Press Space or click`. Next Space/click returns to Start. Next Space/click starts a new game at level 1.
- [ ] Lose at 0 lives still shows `YOU LOSE` on any level. Space/click returns to Start.
- [ ] P during `playing` shows `PAUSED` and the agreed msg, and freezes paddle, ball, bricks, and explosions.
- [ ] P, Space, or click while paused resumes play and does not serve a glued ball on that same press.
- [ ] P does nothing on Start, Win, and Lose.
- [ ] Keys `1`..`5` do nothing unless paused. While paused they load that level, glue the ball, keep score and lives, hide overlay, and set `playing`.
- [ ] Jumping to the level you are already on rebuilds that pattern (broken bricks come back).
- [ ] Desktop resize mid-run rebuilds the current level pattern at the new `SCALE`, not a full 13x6.
- [ ] SPEC 02 explosions still play on break while `playing`. Break still adds 10 points and plays `break-sound.mp3`.
- [ ] No `levels.js`, no new audio, no localStorage, no pause on Start.



## Decisions

- **Yes:** One spec for levels + pause + change-level. Pause overlay is the UI that accepts keys 1-5.
- **No:** Split into SPEC 03 levels and SPEC 04 pause. User chose one spec.
- **Yes:** Five named ASCII grids (full, checker, pyramid, two banks, sparse). Empty is `.`, not gray.
- **No:** Speed-only levels or extra row counts. Patterns are the identity.
- **Yes:** Auto-load next level on clear. No Level Complete overlay.
- **Yes:** Score and lives carry across levels and across pause jumps.
- **Yes:** New game always level 1. No Start-screen level pick.
- **Yes:** P pause only in `playing`. Resume with P, Space, or click. Space on pause does not serve. Esc is not the pause key (host UI often swallows it).
- **Yes:** `state === 'paused'` plus overlay reuse (`overlay-title` / `overlay-msg`). No new overlay nodes.
- **Yes:** LEVEL in the HTML HUD. Files: `game.js`, `index.html`, `style.css`.
- **No:** `levels.js` or a third script tag.
- **No:** Canvas-drawn HUD. SPEC 01 keeps score/lives (and now level) in HTML.
- **No:** Pause on Start / Win / Lose. Keys 1-5 only while paused.
- **No:** localStorage, high scores, power-ups, gray bricks, touch, extra mp3s.



## Risks


| Risk                                             | Mitigation                                                                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Space on pause also serves a glued ball          | Same edge-triggered press as SPEC 01. Resume consumes the press; launch only on a later playing press.                                                          |
| Click hits the overlay, not the canvas           | SPEC 01 already listens on `stage` (canvas + overlay). Keep that.                                                                                               |
| Resize rebuilds a full 13x6 and wipes holes      | Resize must call `loadLevel(game.level)` (or rebuild from `LEVELS[level-1]`) and re-glue only if the ball was glued; if in flight, remap position like SPEC 01. |
| Pause while an explosion is playing skips frames | Do not advance explosion elapsed time while paused (hold `t0` or skip update).                                                                                  |
| Win on level 5 vs auto-next                      | Auto-next only when `level < 5`. Level 5 clear is Win only.                                                                                                     |




## What is **not** in this spec

- Power-ups, high scores, localStorage.
- Pause or level pick on the Start overlay.
- Gray / multi-hit bricks, color score table.
- Touch, extra audio, `levels.js`, new overlay markup.
- Frameworks, bundlers, tests, atlas edits.

Each one of those, if it lands, goes in its own spec.