'use strict';

const BASE_W = 800;
const BASE_H = 600;
let CANVAS_W = BASE_W;
let CANVAS_H = BASE_H;
let SCALE = 1;
const PADDLE_W = 162;
const PADDLE_H = 14;
const PADDLE_SPEED = 500;
const BALL_W = 16;
const BALL_H = 16;
const BALL_SPEED = 420;
const LEVEL_SPEED_MULT = 1.15;
const SERVE_ANGLE = -Math.PI / 3;
const MAX_BOUNCE_ANGLE = Math.PI * 0.4;
const BRICK_W = 32;
const BRICK_H = 16;
const BRICK_TOP = 48;
const POINTS_PER_BRICK = 10;
const START_LIVES = 3;
const BALL_MAX_STEP = 8;
const BREAKS_PER_DROP = 5;
const POWERUP_FALL_SPEED = 180;
const POWERUP_W = 32;
const POWERUP_H = 16;
const POWERUP_DURATION = 5000;
const PADDLE_WIDE_MULT = 1.5;

const canvas = document.getElementById( 'game' );
const ctx = canvas.getContext( '2d' );
const stage = canvas.parentElement;
const pageEl = document.querySelector( '.page' );

const bounceSound = new Audio( 'assets/sounds/ball-bounce.mp3' );
const breakSound = new Audio( 'assets/sounds/break-sound.mp3' );
const scoreEl = document.getElementById( 'score' );
const levelEl = document.getElementById( 'level' );
const wideEl = document.getElementById( 'wide' );
const slowEl = document.getElementById( 'slow' );
const livesEl = document.getElementById( 'lives' );
const overlayEl = document.getElementById( 'overlay' );
const overlayTitleEl = document.getElementById( 'overlay-title' );
const overlayMsgEl = document.getElementById( 'overlay-msg' );

const keys = Object.create( null );
let serveQueued = false;
let score = 0;
let lives = START_LIVES;
let level = 1;
let breaksInLevel = 0;
let state = 'start';
let paused = false;

const paddle = {
  x: ( CANVAS_W - PADDLE_W ) / 2,
  y: CANVAS_H - PADDLE_H,
  w: PADDLE_W,
  h: PADDLE_H,
};

const ball = {
  x: 0,
  y: 0,
  w: BALL_W,
  h: BALL_H,
  vx: 0,
  vy: 0,
  glued: true,
};

const bricks = [];
const explosions = [];
const powerups = [];
const effects = { wideMs: 0, slowMs: 0 };

function scaledPaddleSpeed() {
  return PADDLE_SPEED * SCALE;
}

function levelBallSpeed() {
  return BALL_SPEED * SCALE * ( LEVEL_SPEED_MULT ** ( level - 1 ) );
}

function scaledBallMaxStep() {
  return Math.max( 1, BALL_MAX_STEP * SCALE );
}

function applyEntitySizes() {
  paddle.w = PADDLE_W * SCALE;
  paddle.h = PADDLE_H * SCALE;
  ball.w = BALL_W * SCALE;
  ball.h = BALL_H * SCALE;
}

function measureFit() {
  const pad = 24;
  const chromeY = 64;
  const availW = Math.max( 1, window.innerWidth - pad );
  const availH = Math.max( 1, window.innerHeight - chromeY - pad );
  const maxW = Math.min( BASE_W, availW );
  const maxH = Math.min( BASE_H, availH );
  let w = maxW;
  let h = w * BASE_H / BASE_W;
  if ( h > maxH ) {
    h = maxH;
    w = h * BASE_W / BASE_H;
  }
  w = Math.max( 1, Math.round( w ) );
  h = Math.max( 1, Math.round( w * BASE_H / BASE_W ) );
  if ( h > maxH ) {
    h = Math.max( 1, Math.round( maxH ) );
    w = Math.max( 1, Math.round( h * BASE_W / BASE_H ) );
  }
  if ( w > BASE_W ) {
    w = BASE_W;
    h = BASE_H;
  }
  return { w: w, h: h };
}

function applyChromeSize() {
  pageEl.style.setProperty( '--play-w', CANVAS_W + 'px' );
  pageEl.style.setProperty( '--play-h', CANVAS_H + 'px' );
}

function keepBallInBounds() {
  ball.x = clamp( ball.x, 0, Math.max( 0, CANVAS_W - ball.w ) );
  ball.y = clamp( ball.y, 0, Math.max( 0, CANVAS_H - ball.h ) );
}

function currentPattern() {
  return LEVELS[ level - 1 ];
}

function relayoutBricks() {
  const pattern = currentPattern();
  if ( !bricks.length ) {
    buildBricksFromPattern( pattern );
    return;
  }
  const bw = BRICK_W * SCALE;
  const bh = BRICK_H * SCALE;
  const top = BRICK_TOP * SCALE;
  const offsetX = ( CANVAS_W - COLS * bw ) / 2;
  for ( let i = 0; i < bricks.length; i++ ) {
    const brick = bricks[ i ];
    brick.x = offsetX + brick.col * bw;
    brick.y = top + brick.row * bh;
    brick.w = bw;
    brick.h = bh;
  }
}

function layoutPlayfield() {
  const fit = measureFit();
  const oldW = CANVAS_W;
  const oldH = CANVAS_H;
  if ( fit.w === CANVAS_W && fit.h === CANVAS_H && canvas.width === fit.w ) {
    applyChromeSize();
    applyEntitySizes();
    paddle.y = CANVAS_H - paddle.h;
    clampPaddle();
    if ( ball.glued ) stickBallToPaddle();
    return;
  }

  CANVAS_W = fit.w;
  CANVAS_H = fit.h;
  SCALE = CANVAS_W / BASE_W;
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  applyChromeSize();
  applyEntitySizes();

  const rx = CANVAS_W / oldW;
  const ry = CANVAS_H / oldH;
  paddle.x *= rx;
  paddle.y = CANVAS_H - paddle.h;
  clampPaddle();
  ball.x *= rx;
  ball.y *= ry;
  ball.vx *= rx;
  ball.vy *= ry;
  for ( let i = 0; i < explosions.length; i++ ) {
    const exp = explosions[ i ];
    exp.x *= rx;
    exp.y *= ry;
    exp.w *= rx;
    exp.h *= ry;
  }
  relayoutBricks();
  if ( ball.glued ) stickBallToPaddle();
  else keepBallInBounds();
}

function buildBricksFromPattern( pattern ) {
  bricks.length = 0;
  const bw = BRICK_W * SCALE;
  const bh = BRICK_H * SCALE;
  const top = BRICK_TOP * SCALE;
  const offsetX = ( CANVAS_W - COLS * bw ) / 2;
  for ( let row = 0; row < ROWS; row++ ) {
    const color = ROW_COLORS[ row ];
    const line = pattern[ row ];
    for ( let col = 0; col < COLS; col++ ) {
      if ( line[ col ] !== 'X' ) continue;
      bricks.push( {
        x: offsetX + col * bw,
        y: top + row * bh,
        w: bw,
        h: bh,
        color: color,
        alive: true,
        row: row,
        col: col,
      } );
    }
  }
}

function buildBricks() {
  buildBricksFromPattern( LEVELS[ 0 ] );
}

function clamp( value, min, max ) {
  return Math.max( min, Math.min( max, value ) );
}

function clampPaddle() {
  paddle.x = clamp( paddle.x, 0, CANVAS_W - paddle.w );
}

function paddleBaseWidth() {
  return PADDLE_W * SCALE;
}

function applyPaddleWidth() {
  paddle.w = paddleBaseWidth() * ( effects.wideMs > 0 ? PADDLE_WIDE_MULT : 1 );
  paddle.h = PADDLE_H * SCALE;
  clampPaddle();
}

function writeWideHud() {
  wideEl.textContent = effects.wideMs > 0
    ? String( Math.ceil( effects.wideMs / 1000 ) )
    : '--';
}

function clearPowerups() {
  powerups.length = 0;
  effects.wideMs = 0;
  effects.slowMs = 0;
  applyPaddleWidth();
  wideEl.textContent = '--';
  slowEl.textContent = '--';
}

function isHeld( code ) {
  return !!keys[ code ];
}

function consumeServe() {
  const queued = serveQueued;
  serveQueued = false;
  return queued;
}

function playSound( audio ) {
  audio.currentTime = 0;
  audio.play().catch( () => {} );
}

function playBounce() {
  playSound( bounceSound );
}

function playBreak() {
  playSound( breakSound );
}

function writeScore() {
  scoreEl.textContent = String( score );
}

function writeLevel() {
  levelEl.textContent = String( level );
}

function writeLives() {
  if ( livesEl.children.length !== START_LIVES ) {
    livesEl.textContent = '';
    for ( let i = 0; i < START_LIVES; i++ ) {
      const pip = document.createElement( 'span' );
      pip.className = 'life';
      livesEl.appendChild( pip );
    }
  }
  for ( let i = 0; i < livesEl.children.length; i++ ) {
    livesEl.children[ i ].classList.toggle( 'on', i < lives );
  }
  livesEl.setAttribute( 'aria-label', lives + ' lives' );
}

function showOverlay( title, msg ) {
  overlayTitleEl.textContent = title;
  overlayMsgEl.textContent = msg;
  overlayEl.classList.remove( 'hidden' );
}

function hideOverlay() {
  overlayEl.classList.add( 'hidden' );
}

function showStartOverlay() {
  state = 'start';
  paused = false;
  showOverlay( 'ARKANOID', 'Press Space or click to start' );
}

function holdExplosionClocks( dt ) {
  const ms = dt * 1000;
  for ( let i = 0; i < explosions.length; i++ ) {
    explosions[ i ].t0 += ms;
  }
}

function pausePlaying() {
  state = 'paused';
  paused = true;
  showOverlay( 'PAUSED', 'P, Space or click to resume. Keys 1-5 change level.' );
}

function resumePlaying() {
  state = 'playing';
  paused = false;
  hideOverlay();
}

function loadLevel( n ) {
  level = n;
  writeLevel();
  explosions.length = 0;
  breaksInLevel = 0;
  clearPowerups();
  buildBricksFromPattern( LEVELS[ n - 1 ] );
  glueBall();
}

function resetGame() {
  score = 0;
  lives = START_LIVES;
  writeScore();
  writeLives();
  clearPowerups();
  paddle.x = ( CANVAS_W - paddle.w ) / 2;
  paddle.y = CANVAS_H - paddle.h;
  loadLevel( 1 );
}

function startPlaying() {
  resetGame();
  state = 'playing';
  paused = false;
  hideOverlay();
  canvas.focus();
}

function anyBricksAlive() {
  for ( let i = 0; i < bricks.length; i++ ) {
    if ( bricks[ i ].alive ) return true;
  }
  return false;
}

function checkWin() {
  if ( state !== 'playing' ) return;
  if ( anyBricksAlive() ) return;
  if ( level < 5 ) {
    loadLevel( level + 1 );
    return;
  }
  state = 'win';
  clearPowerups();
  showOverlay( 'YOU WIN', 'Press Space or click' );
}

function missBall() {
  lives -= 1;
  writeLives();
  clearPowerups();
  glueBall();
  if ( lives <= 0 ) {
    lives = 0;
    writeLives();
    state = 'lose';
    showOverlay( 'YOU LOSE', 'Press Space or click' );
  }
}

function spawnExplosion( brick ) {
  explosions.push( {
    x: brick.x,
    y: brick.y,
    w: brick.w,
    h: brick.h,
    color: brick.color,
    t0: lastTs,
  } );
}

function glueBall() {
  ball.glued = true;
  ball.vx = 0;
  ball.vy = 0;
  stickBallToPaddle();
}

function stickBallToPaddle() {
  ball.x = paddle.x + ( paddle.w - ball.w ) / 2;
  ball.y = paddle.y - ball.h;
}

function launchBall() {
  ball.glued = false;
  const speed = levelBallSpeed();
  ball.vx = speed * Math.cos( SERVE_ANGLE );
  ball.vy = speed * Math.sin( SERVE_ANGLE );
}

function aabb( a, b ) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function bounceOffPaddle() {
  const ballMid = ball.x + ball.w / 2;
  const paddleMid = paddle.x + paddle.w / 2;
  const offset = clamp( ( ballMid - paddleMid ) / ( paddle.w / 2 ), -1, 1 );
  const angle = offset * MAX_BOUNCE_ANGLE;
  const speed = levelBallSpeed();
  ball.vx = speed * Math.sin( angle );
  ball.vy = -speed * Math.cos( angle );
  ball.y = paddle.y - ball.h;
  playBounce();
}

function overlapAmount( axis, brick ) {
  if ( axis === 'x' ) {
    return Math.min( ball.x + ball.w, brick.x + brick.w ) - Math.max( ball.x, brick.x );
  }
  return Math.min( ball.y + ball.h, brick.y + brick.h ) - Math.max( ball.y, brick.y );
}

function reverseCollidingAxis( brick, prevX, prevY ) {
  const fromLeft = prevX + ball.w <= brick.x;
  const fromRight = prevX >= brick.x + brick.w;
  const fromTop = prevY + ball.h <= brick.y;
  const fromBottom = prevY >= brick.y + brick.h;

  let hitX = fromLeft || fromRight;
  let hitY = fromTop || fromBottom;
  if ( hitX && hitY ) {
    if ( overlapAmount( 'x', brick ) < overlapAmount( 'y', brick ) ) hitY = false;
    else hitX = false;
  }
  if ( !hitX && !hitY ) {
    hitX = overlapAmount( 'x', brick ) < overlapAmount( 'y', brick );
    hitY = !hitX;
  }

  if ( hitX ) {
    if ( fromLeft || ( !fromRight && ball.vx > 0 ) ) {
      ball.x = brick.x - ball.w;
      ball.vx = -Math.abs( ball.vx );
    } else {
      ball.x = brick.x + brick.w;
      ball.vx = Math.abs( ball.vx );
    }
    return;
  }

  if ( fromTop || ( !fromBottom && ball.vy > 0 ) ) {
    ball.y = brick.y - ball.h;
    ball.vy = -Math.abs( ball.vy );
  } else {
    ball.y = brick.y + brick.h;
    ball.vy = Math.abs( ball.vy );
  }
}

function spawnPowerup( brick ) {
  powerups.push( {
    x: brick.x,
    y: brick.y,
    w: POWERUP_W * SCALE,
    h: POWERUP_H * SCALE,
    type: Math.random() < 0.5 ? 'wide' : 'slow',
  } );
}

function maybeSpawnPowerup( brick ) {
  breaksInLevel += 1;
  if ( breaksInLevel % BREAKS_PER_DROP === 0 ) spawnPowerup( brick );
}

function hitBrick( brick, prevX, prevY ) {
  brick.alive = false;
  spawnExplosion( brick );
  score += POINTS_PER_BRICK;
  writeScore();
  playBreak();
  playBounce();
  reverseCollidingAxis( brick, prevX, prevY );
  maybeSpawnPowerup( brick );
  checkWin();
}

function collideBricks( prevX, prevY ) {
  for ( let i = 0; i < bricks.length; i++ ) {
    const brick = bricks[ i ];
    if ( !brick.alive ) continue;
    if ( !aabb( ball, brick ) ) continue;
    hitBrick( brick, prevX, prevY );
    return;
  }
}

function collideSideAndTopWalls() {
  if ( ball.x <= 0 ) {
    ball.x = 0;
    ball.vx = Math.abs( ball.vx );
    playBounce();
  } else if ( ball.x + ball.w >= CANVAS_W ) {
    ball.x = CANVAS_W - ball.w;
    ball.vx = -Math.abs( ball.vx );
    playBounce();
  }

  if ( ball.y <= 0 ) {
    ball.y = 0;
    ball.vy = Math.abs( ball.vy );
    playBounce();
  }
}

function collidePaddleOrMiss() {
  if ( ball.vy > 0 && aabb( ball, paddle ) ) {
    bounceOffPaddle();
    return;
  }
  if ( aabb( ball, paddle ) ) return;
  if ( ball.y + ball.h >= CANVAS_H ) missBall();
}

function stepBall( stepDt ) {
  const prevX = ball.x;
  const prevY = ball.y;
  ball.x += ball.vx * stepDt;
  ball.y += ball.vy * stepDt;
  collideSideAndTopWalls();
  collideBricks( prevX, prevY );
  if ( state !== 'playing' || ball.glued ) return;
  collidePaddleOrMiss();
}

function update( dt ) {
  const pressed = consumeServe();

  if ( state === 'start' ) {
    if ( pressed ) startPlaying();
    return;
  }

  if ( state === 'win' || state === 'lose' ) {
    if ( pressed ) showStartOverlay();
    return;
  }

  if ( state === 'paused' ) {
    if ( pressed ) resumePlaying();
    else holdExplosionClocks( dt );
    return;
  }

  let dir = 0;
  if ( isHeld( 'ArrowLeft' ) || isHeld( 'KeyA' ) ) dir -= 1;
  if ( isHeld( 'ArrowRight' ) || isHeld( 'KeyD' ) ) dir += 1;
  if ( dir !== 0 ) {
    paddle.x += dir * scaledPaddleSpeed() * dt;
    clampPaddle();
  }

  updatePowerups( dt );
  catchWidePowerups();
  tickWideEffect( dt );

  if ( ball.glued ) {
    stickBallToPaddle();
    if ( pressed ) launchBall();
    return;
  }

  const dist = Math.hypot( ball.vx * dt, ball.vy * dt );
  const steps = Math.max( 1, Math.ceil( dist / scaledBallMaxStep() ) );
  const stepDt = dt / steps;
  for ( let i = 0; i < steps; i++ ) {
    stepBall( stepDt );
    if ( ball.glued || state !== 'playing' ) return;
  }
}

function clearPlayfield() {
  ctx.fillStyle = '#1a1a25';
  ctx.fillRect( 0, 0, CANVAS_W, CANVAS_H );
}

function drawBricks() {
  for ( let i = 0; i < bricks.length; i++ ) {
    const brick = bricks[ i ];
    if ( !brick.alive ) continue;
    drawSprite( ctx, 'block_' + brick.color, brick.x, brick.y, brick.w, brick.h );
  }
}

function updatePowerups( dt ) {
  const fall = POWERUP_FALL_SPEED * SCALE * dt;
  let write = 0;
  for ( let i = 0; i < powerups.length; i++ ) {
    const drop = powerups[ i ];
    drop.y += fall;
    if ( drop.y > CANVAS_H ) continue;
    powerups[ write++ ] = drop;
  }
  powerups.length = write;
}

function catchWidePowerups() {
  let write = 0;
  for ( let i = 0; i < powerups.length; i++ ) {
    const drop = powerups[ i ];
    if ( drop.type === 'wide' && aabb( paddle, drop ) ) {
      playBounce();
      effects.wideMs = POWERUP_DURATION;
      applyPaddleWidth();
      writeWideHud();
      continue;
    }
    powerups[ write++ ] = drop;
  }
  powerups.length = write;
}

function tickWideEffect( dt ) {
  if ( effects.wideMs <= 0 ) return;
  effects.wideMs = Math.max( 0, effects.wideMs - dt * 1000 );
  if ( effects.wideMs === 0 ) applyPaddleWidth();
  writeWideHud();
}

function drawPowerups() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 1;
  for ( let i = 0; i < powerups.length; i++ ) {
    const drop = powerups[ i ];
    const wide = drop.type === 'wide';
    ctx.fillStyle = wide ? 'cyan' : 'yellow';
    ctx.strokeStyle = '#000000';
    ctx.fillRect( drop.x, drop.y, drop.w, drop.h );
    ctx.strokeRect( drop.x, drop.y, drop.w, drop.h );
    ctx.fillStyle = wide ? '#ffffff' : '#000000';
    ctx.font = 'bold ' + Math.round( drop.h * 0.75 ) + 'px sans-serif';
    ctx.fillText( wide ? 'W' : 'S', drop.x + drop.w / 2, drop.y + drop.h / 2 );
  }
}

function drawExplosions( now ) {
  let write = 0;
  for ( let i = 0; i < explosions.length; i++ ) {
    const exp = explosions[ i ];
    const elapsed = Math.max( 0, now - exp.t0 );
    if ( elapsed >= EXPLOSION_DURATION ) continue;
    const frames = EXPLOSION_FRAMES[ exp.color ];
    if ( !frames || frames.length === 0 ) continue;
    const idx = Math.min( 3, Math.max( 0, Math.floor( ( elapsed / EXPLOSION_DURATION ) * 4 ) ) );
    drawFrame( ctx, frames[ idx ], exp.x, exp.y, exp.w, exp.h );
    explosions[ write++ ] = exp;
  }
  explosions.length = write;
}

function draw( now ) {
  clearPlayfield();
  drawBricks();
  drawExplosions( now );
  drawPowerups();
  drawSprite( ctx, 'paddle', paddle.x, paddle.y, paddle.w, paddle.h );
  drawSprite( ctx, 'ball', ball.x, ball.y, ball.w, ball.h );
}

let lastTs = 0;

function loop( ts ) {
  if ( lastTs === 0 ) lastTs = ts;
  const dt = Math.min( ( ts - lastTs ) / 1000, 0.05 );
  lastTs = ts;
  update( dt );
  draw( ts );
  requestAnimationFrame( loop );
}

function isPauseKey( e ) {
  return e.code === 'KeyP' || e.key === 'p' || e.key === 'P' || e.keyCode === 80;
}

function onKeyDown( e ) {
  keys[ e.code ] = true;
  if ( e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space' || isPauseKey( e ) ) {
    e.preventDefault();
  }
  if ( isPauseKey( e ) && !e.repeat ) {
    if ( state === 'playing' ) pausePlaying();
    else if ( state === 'paused' ) resumePlaying();
    return;
  }
  if ( state === 'paused' && !e.repeat ) {
    if ( e.key >= '1' && e.key <= '5' ) {
      loadLevel( Number( e.key ) );
      resumePlaying();
      return;
    }
  }
  if ( ( e.code === 'Space' || e.key === ' ' ) && !e.repeat ) serveQueued = true;
}

function onKeyUp( e ) {
  keys[ e.code ] = false;
}

function onPointerMove( e ) {
  if ( state !== 'playing' ) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  paddle.x = ( e.clientX - rect.left ) * scaleX - paddle.w / 2;
  clampPaddle();
}

document.addEventListener( 'keydown', onKeyDown, true );
document.addEventListener( 'keyup', onKeyUp, true );

stage.addEventListener( 'mousemove', onPointerMove );
stage.addEventListener( 'pointerdown', () => {
  canvas.focus();
} );
stage.addEventListener( 'click', () => {
  serveQueued = true;
} );

let resizeQueued = false;
window.addEventListener( 'resize', () => {
  if ( resizeQueued ) return;
  resizeQueued = true;
  requestAnimationFrame( () => {
    resizeQueued = false;
    layoutPlayfield();
  } );
} );

layoutPlayfield();
buildBricks();
glueBall();
writeScore();
writeLives();
showStartOverlay();

loadSpritesheet( () => {
  requestAnimationFrame( loop );
} );
