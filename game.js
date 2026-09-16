'use strict';

const CANVAS_W = 800;
const CANVAS_H = 600;
const PADDLE_W = 162;
const PADDLE_H = 14;
const PADDLE_SPEED = 500;

const canvas = document.getElementById( 'game' );
const ctx = canvas.getContext( '2d' );

const keys = Object.create( null );

const paddle = {
  x: ( CANVAS_W - PADDLE_W ) / 2,
  y: CANVAS_H - PADDLE_H,
  w: PADDLE_W,
  h: PADDLE_H,
};

function clamp( value, min, max ) {
  return Math.max( min, Math.min( max, value ) );
}

function clampPaddle() {
  paddle.x = clamp( paddle.x, 0, CANVAS_W - paddle.w );
}

function isHeld( code ) {
  return !!keys[ code ];
}

function update( dt ) {
  let dir = 0;
  if ( isHeld( 'ArrowLeft' ) || isHeld( 'KeyA' ) ) dir -= 1;
  if ( isHeld( 'ArrowRight' ) || isHeld( 'KeyD' ) ) dir += 1;
  if ( dir !== 0 ) {
    paddle.x += dir * PADDLE_SPEED * dt;
    clampPaddle();
  }
}

function clearPlayfield() {
  ctx.fillStyle = '#1a1a25';
  ctx.fillRect( 0, 0, CANVAS_W, CANVAS_H );
}

function draw() {
  clearPlayfield();
  drawSprite( ctx, 'paddle', paddle.x, paddle.y, paddle.w, paddle.h );
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

window.addEventListener( 'keydown', ( e ) => {
  keys[ e.code ] = true;
  if ( e.code === 'ArrowLeft' || e.code === 'ArrowRight' ) e.preventDefault();
} );

window.addEventListener( 'keyup', ( e ) => {
  keys[ e.code ] = false;
} );

canvas.addEventListener( 'mousemove', ( e ) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  paddle.x = ( e.clientX - rect.left ) * scaleX - paddle.w / 2;
  clampPaddle();
} );

loadSpritesheet( () => {
  requestAnimationFrame( loop );
} );
