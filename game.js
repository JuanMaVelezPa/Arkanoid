'use strict';

const CANVAS_W = 800;
const CANVAS_H = 600;
const PADDLE_W = 162;
const PADDLE_H = 14;
const PADDLE_SPEED = 500;
const BALL_W = 16;
const BALL_H = 16;
const BALL_SPEED = 420;
const SERVE_ANGLE = -Math.PI / 3;
const MAX_BOUNCE_ANGLE = Math.PI * 0.4;
const COLS = 13;
const ROWS = 6;
const BRICK_W = 32;
const BRICK_H = 16;
const BRICK_TOP = 48;
const ROW_COLORS = [ 'red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green' ];
const POINTS_PER_BRICK = 10;
const START_LIVES = 3;
const BALL_MAX_STEP = 8;

const canvas = document.getElementById( 'game' );
const ctx = canvas.getContext( '2d' );
const stage = canvas.parentElement;

const bounceSound = new Audio( 'assets/sounds/ball-bounce.mp3' );
const breakSound = new Audio( 'assets/sounds/break-sound.mp3' );
const scoreEl = document.getElementById( 'score' );
const livesEl = document.getElementById( 'lives' );
const overlayEl = document.getElementById( 'overlay' );
const overlayTitleEl = document.getElementById( 'overlay-title' );
const overlayMsgEl = document.getElementById( 'overlay-msg' );

const keys = Object.create( null );
let serveQueued = false;
let score = 0;
let lives = START_LIVES;
let state = 'playing';

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

function buildBricks() {
  bricks.length = 0;
  const gridW = COLS * BRICK_W;
  const offsetX = ( CANVAS_W - gridW ) / 2;
  for ( let row = 0; row < ROWS; row++ ) {
    const color = ROW_COLORS[ row ];
    for ( let col = 0; col < COLS; col++ ) {
      bricks.push( {
        x: offsetX + col * BRICK_W,
        y: BRICK_TOP + row * BRICK_H,
        w: BRICK_W,
        h: BRICK_H,
        color: color,
        alive: true,
      } );
    }
  }
}

function clamp( value, min, max ) {
  return Math.max( min, Math.min( max, value ) );
}

function clampPaddle() {
  paddle.x = clamp( paddle.x, 0, CANVAS_W - paddle.w );
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

function writeLives() {
  livesEl.textContent = String( lives );
}

function showOverlay( title, msg ) {
  overlayTitleEl.textContent = title;
  overlayMsgEl.textContent = msg;
  overlayEl.classList.remove( 'hidden' );
}

function missBall() {
  lives -= 1;
  writeLives();
  if ( lives <= 0 ) {
    lives = 0;
    writeLives();
    glueBall();
    state = 'lose';
    showOverlay( 'YOU LOSE', 'Press Space or click' );
    return;
  }
  glueBall();
}

function spawnExplosion( brick ) {
  explosions.push( {
    x: brick.x,
    y: brick.y,
    w: brick.w,
    h: brick.h,
    color: brick.color,
    t0: performance.now(),
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
  ball.vx = BALL_SPEED * Math.cos( SERVE_ANGLE );
  ball.vy = BALL_SPEED * Math.sin( SERVE_ANGLE );
}

function aabb( a, b ) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function bounceOffPaddle() {
  const ballMid = ball.x + ball.w / 2;
  const paddleMid = paddle.x + paddle.w / 2;
  const offset = clamp( ( ballMid - paddleMid ) / ( paddle.w / 2 ), -1, 1 );
  const angle = offset * MAX_BOUNCE_ANGLE;
  ball.vx = BALL_SPEED * Math.sin( angle );
  ball.vy = -BALL_SPEED * Math.cos( angle );
  ball.y = paddle.y - ball.h;
  playBounce();
}

function reverseCollidingAxis( brick, prevX, prevY ) {
  const fromLeft = prevX + ball.w <= brick.x;
  const fromRight = prevX >= brick.x + brick.w;
  const fromTop = prevY + ball.h <= brick.y;
  const fromBottom = prevY >= brick.y + brick.h;

  if ( fromLeft || fromRight ) {
    ball.vx = fromLeft ? -Math.abs( ball.vx ) : Math.abs( ball.vx );
    ball.x = fromLeft ? brick.x - ball.w : brick.x + brick.w;
  }
  if ( fromTop || fromBottom ) {
    ball.vy = fromTop ? -Math.abs( ball.vy ) : Math.abs( ball.vy );
    ball.y = fromTop ? brick.y - ball.h : brick.y + brick.h;
  }
  if ( fromLeft || fromRight || fromTop || fromBottom ) return;

  const overlapX = Math.min( ball.x + ball.w, brick.x + brick.w ) - Math.max( ball.x, brick.x );
  const overlapY = Math.min( ball.y + ball.h, brick.y + brick.h ) - Math.max( ball.y, brick.y );
  if ( overlapX < overlapY ) {
    ball.vx *= -1;
  } else {
    ball.vy *= -1;
  }
}

function hitBrick( brick, prevX, prevY ) {
  brick.alive = false;
  spawnExplosion( brick );
  score += POINTS_PER_BRICK;
  writeScore();
  playBreak();
  playBounce();
  reverseCollidingAxis( brick, prevX, prevY );
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

function collideWalls() {
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
  } else if ( ball.y + ball.h >= CANVAS_H ) {
    missBall();
  }
}

function stepBall( stepDt ) {
  const prevX = ball.x;
  const prevY = ball.y;
  ball.x += ball.vx * stepDt;
  ball.y += ball.vy * stepDt;
  collideWalls();
  if ( ball.glued ) return;
  collideBricks( prevX, prevY );
  if ( ball.vy > 0 && aabb( ball, paddle ) ) bounceOffPaddle();
}

function update( dt ) {
  if ( state === 'lose' ) {
    consumeServe();
    return;
  }

  let dir = 0;
  if ( isHeld( 'ArrowLeft' ) || isHeld( 'KeyA' ) ) dir -= 1;
  if ( isHeld( 'ArrowRight' ) || isHeld( 'KeyD' ) ) dir += 1;
  if ( dir !== 0 ) {
    paddle.x += dir * PADDLE_SPEED * dt;
    clampPaddle();
  }

  const serve = consumeServe();

  if ( ball.glued ) {
    stickBallToPaddle();
    if ( serve ) launchBall();
    return;
  }

  const dist = Math.hypot( ball.vx * dt, ball.vy * dt );
  const steps = Math.max( 1, Math.ceil( dist / BALL_MAX_STEP ) );
  const stepDt = dt / steps;
  for ( let i = 0; i < steps; i++ ) {
    stepBall( stepDt );
    if ( ball.glued ) return;
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

function drawExplosions( now ) {
  let write = 0;
  for ( let i = 0; i < explosions.length; i++ ) {
    const exp = explosions[ i ];
    const elapsed = now - exp.t0;
    if ( elapsed >= EXPLOSION_DURATION ) continue;
    const frames = EXPLOSION_FRAMES[ exp.color ];
    const idx = Math.min(
      frames.length - 1,
      Math.floor( ( elapsed / EXPLOSION_DURATION ) * frames.length )
    );
    drawFrame( ctx, frames[ idx ], exp.x, exp.y, exp.w, exp.h );
    explosions[ write++ ] = exp;
  }
  explosions.length = write;
}

function draw( now ) {
  clearPlayfield();
  drawBricks();
  drawExplosions( now );
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

function onPointerMove( e ) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  paddle.x = ( e.clientX - rect.left ) * scaleX - paddle.w / 2;
  clampPaddle();
}

window.addEventListener( 'keydown', ( e ) => {
  keys[ e.code ] = true;
  if ( e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space' ) {
    e.preventDefault();
  }
  if ( e.code === 'Space' && !e.repeat ) serveQueued = true;
} );

window.addEventListener( 'keyup', ( e ) => {
  keys[ e.code ] = false;
} );

stage.addEventListener( 'mousemove', onPointerMove );
stage.addEventListener( 'click', () => {
  serveQueued = true;
} );

buildBricks();
glueBall();
writeScore();
writeLives();

loadSpritesheet( () => {
  requestAnimationFrame( loop );
} );
