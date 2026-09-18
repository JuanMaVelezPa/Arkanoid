'use strict';

const BREAKS_PER_DROP = 5;
const POWERUP_DURATION = 5000;
const POWERUP_FALL_SPEED = 180;
const POWERUP_W = 32;
const POWERUP_H = 16;
const PADDLE_WIDE_MULT = 1.5;
const BALL_SLOW_MULT = 0.7;

const wideEl = document.getElementById( 'wide' );
const slowEl = document.getElementById( 'slow' );

let breaksInLevel = 0;
const powerups = [];
const effects = { wideMs: 0, slowMs: 0 };

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

function writeSlowHud() {
  slowEl.textContent = effects.slowMs > 0
    ? String( Math.ceil( effects.slowMs / 1000 ) )
    : '--';
}

function clearPowerups() {
  powerups.length = 0;
  effects.wideMs = 0;
  effects.slowMs = 0;
  applyPaddleWidth();
  applyBallSpeed();
  wideEl.textContent = '--';
  slowEl.textContent = '--';
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

function remapPowerups( rx, ry ) {
  for ( let i = 0; i < powerups.length; i++ ) {
    const drop = powerups[ i ];
    drop.x *= rx;
    drop.y *= ry;
    drop.w *= rx;
    drop.h *= ry;
  }
}

function catchPowerups() {
  let write = 0;
  for ( let i = 0; i < powerups.length; i++ ) {
    const drop = powerups[ i ];
    if ( aabb( paddle, drop ) ) {
      activatePowerup( drop.type );
      continue;
    }
    powerups[ write++ ] = drop;
  }
  powerups.length = write;
}

function activatePowerup( type ) {
  playBounce();
  if ( type === 'wide' ) {
    effects.wideMs = POWERUP_DURATION;
    applyPaddleWidth();
    writeWideHud();
    return;
  }
  effects.slowMs = POWERUP_DURATION;
  applyBallSpeed();
  writeSlowHud();
}

function tickEffects( dt ) {
  if ( effects.wideMs > 0 ) {
    effects.wideMs = Math.max( 0, effects.wideMs - dt * 1000 );
    if ( effects.wideMs === 0 ) applyPaddleWidth();
    writeWideHud();
  }
  if ( effects.slowMs > 0 ) {
    effects.slowMs = Math.max( 0, effects.slowMs - dt * 1000 );
    if ( effects.slowMs === 0 ) applyBallSpeed();
    writeSlowHud();
  }
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
