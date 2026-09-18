# Arkanoid

Vanilla browser Breakout clone. HTML5 Canvas, no bundler, no npm deps.

Clear five brick patterns. Catch falling capsules. Ball speed rises 15% each level.

## Play

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. A static server is required (`file://` can block Image/Audio).

## Controls

- Move: Left/Right or A/D, or mouse X on the canvas
- Space or click: start, serve, resume, or fire laser while L is active
- P: pause / resume
- Keys 1-5 while paused: jump to that level (score and lives stay)

## Gameplay

- HUD: SCORE, LEVEL, POWER, LIVES (3 pips)
- +10 per brick. Miss the bottom and lose a life when no balls remain
- Levels 1-4 auto-advance on a clear. Level 5 clear is YOU WIN
- New game is level 1, score 0, lives 3, one glued ball
- Every 5th brick in the current level drops one capsule (equal random among six)

| Letter | Type   | Effect                                      |
| ------ | ------ | ------------------------------------------- |
| W      | wide   | Paddle 1.5x wide for 5s                     |
| S      | slow   | Balls at 0.7 of level speed for 5s          |
| E      | life   | +1 life, cap 3                              |
| T      | sticky | Paddle hit glues that ball for 5s           |
| M      | multi  | Up to 3 balls                               |
| L      | laser  | Space/click shoots (does not serve) for 5s  |

POWER shows timed tokens (`W5 S2 M L4`) or `--`. Extra life is not listed there.

## Layout

```
index.html          HUD, overlay, script tags
style.css
game.js             loop, paddle, balls, bricks, speed, serve
levels.js           COLS, ROWS, ROW_COLORS, LEVELS (five 13x6 grids)
powerups.js         drops, catch, effects, shots, POWER HUD
assets/
  spritesheet.js
  spritesheet-breakout.png
  sounds/
    ball-bounce.mp3
    break-sound.mp3
specs/              SPEC 01-04
```

Script order: `assets/spritesheet.js`, `levels.js`, `powerups.js`, `game.js`.
