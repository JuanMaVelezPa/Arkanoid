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

const canvas = document.getElementById( 'game' );
const ctx = canvas.getContext( '2d' );
const stage = canvas.parentElement;

const bounceSound = new Audio( 'assets/sounds/ball-bounce.mp3' );

const keys = Object.create( null );
let serveQueued = false;

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

function playBounce() {
  bounceSound.currentTime = 0;
  bounceSound.play().catch( () => {} );
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

function update( dt ) {
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

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

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
    glueBall();
    return;
  }

  if ( ball.vy > 0 && aabb( ball, paddle ) ) bounceOffPaddle();
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

function draw() {
  clearPlayfield();
  drawBricks();
  drawSprite( ctx, 'paddle', paddle.x, paddle.y, paddle.w, paddle.h );
  drawSprite( ctx, 'ball', ball.x, ball.y, ball.w, ball.h );
}

let lastTs = 0;

function loop( ts ) {
  if ( lastTs === 0 ) lastTs = ts;
  const dt = Math.min( ( ts - lastTs ) / 1000, 0.05 );
  lastTs = ts;
  update( dt );
  draw();
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

loadSpritesheet( () => {
  requestAnimationFrame( loop );
} );
