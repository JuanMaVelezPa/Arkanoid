'use strict';

const BREAKS_PER_DROP = 5;
const POWERUP_DURATION = 5000;
const POWERUP_FALL_SPEED = 180;
const POWERUP_W = 32;
const POWERUP_H = 16;
const PADDLE_WIDE_MULT = 1.5;
const BALL_SLOW_MULT = 0.7;
const MULTI_SPREAD = 0.35;
const SHOT_W = 4;
const SHOT_H = 12;
const SHOT_SPEED = 500;
const POWERUP_TYPES = [ 'wide', 'slow', 'life', 'sticky', 'multi', 'laser' ];
const POWERUP_LOOK = {
  wide: { fill: 'cyan', letter: 'W', ink: '#ffffff' },
  slow: { fill: 'yellow', letter: 'S', ink: '#000000' },
  life: { fill: 'green', letter: 'E', ink: '#000000' },
  sticky: { fill: 'magenta', letter: 'T', ink: '#ffffff' },
  multi: { fill: 'red', letter: 'M', ink: '#ffffff' },
  laser: { fill: 'gray', letter: 'L', ink: '#ffffff' },
};

const powerEl = document.getElementById( 'power' );

let breaksInLevel = 0;
const powerups = [];
const shots = [];
const effects = { wideMs: 0, slowMs: 0, stickyMs: 0, laserMs: 0 };

function paddleBaseWidth() {
  return PADDLE_W * SCALE;
}

function applyPaddleWidth() {
  paddle.w = paddleBaseWidth() * ( effects.wideMs > 0 ? PADDLE_WIDE_MULT : 1 );
  paddle.h = PADDLE_H * SCALE;
  clampPaddle();
}

function writePowerHud() {
  const tokens = [];
  if ( effects.wideMs > 0 ) tokens.push( 'W' + Math.ceil( effects.wideMs / 1000 ) );
  if ( effects.slowMs > 0 ) tokens.push( 'S' + Math.ceil( effects.slowMs / 1000 ) );
  if ( effects.stickyMs > 0 ) tokens.push( 'T' + Math.ceil( effects.stickyMs / 1000 ) );
  if ( typeof balls !== 'undefined' && balls.length > 1 ) tokens.push( 'M' );
  if ( effects.laserMs > 0 ) tokens.push( 'L' + Math.ceil( effects.laserMs / 1000 ) );
  powerEl.textContent = tokens.length ? tokens.join( ' ' ) : '--';
}

function clearPowerups() {
  powerups.length = 0;
  shots.length = 0;
  effects.wideMs = 0;
  effects.slowMs = 0;
  effects.stickyMs = 0;
  effects.laserMs = 0;
  applyPaddleWidth();
  if ( typeof balls !== 'undefined' && balls.length > 1 ) {
    balls.length = 1;
  }
  applyBallSpeed();
  writePowerHud();
}

function spawnPowerup( brick ) {
  powerups.push( {
    x: brick.x,
    y: brick.y,
    w: POWERUP_W * SCALE,
    h: POWERUP_H * SCALE,
    type: POWERUP_TYPES[ Math.floor( Math.random() * POWERUP_TYPES.length ) ],
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
  for ( let i = 0; i < shots.length; i++ ) {
    const shot = shots[ i ];
    shot.x *= rx;
    shot.y *= ry;
    shot.w = SHOT_W * SCALE;
    shot.h = SHOT_H * SCALE;
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
    writePowerHud();
    return;
  }
  if ( type === 'slow' ) {
    effects.slowMs = POWERUP_DURATION;
    applyBallSpeed();
    writePowerHud();
    return;
  }
  if ( type === 'life' ) {
    if ( lives < START_LIVES ) {
      lives += 1;
      writeLives();
    }
    return;
  }
  if ( type === 'sticky' ) {
    effects.stickyMs = POWERUP_DURATION;
    writePowerHud();
    return;
  }
  if ( type === 'multi' ) {
    activateMulti();
    return;
  }
  if ( type === 'laser' ) {
    effects.laserMs = POWERUP_DURATION;
    writePowerHud();
  }
}

function anyGluedBall() {
  for ( let i = 0; i < balls.length; i++ ) {
    if ( balls[ i ].glued ) return true;
  }
  return false;
}

function cloneInFlightBall( src, heading, mag ) {
  const extra = makeBall();
  extra.x = src.x;
  extra.y = src.y;
  extra.w = src.w;
  extra.h = src.h;
  extra.glued = false;
  extra.vx = mag * Math.cos( heading );
  extra.vy = mag * Math.sin( heading );
  return extra;
}

function activateMulti() {
  if ( balls.length >= 3 ) return;
  if ( anyGluedBall() ) {
    while ( balls.length < 3 ) balls.push( makeBall() );
    for ( let i = 0; i < balls.length; i++ ) {
      balls[ i ].glued = true;
      balls[ i ].vx = 0;
      balls[ i ].vy = 0;
      stickBallToPaddle( balls[ i ] );
    }
    writePowerHud();
    return;
  }
  const src = balls[ 0 ];
  const heading = Math.atan2( src.vy, src.vx );
  const mag = Math.hypot( src.vx, src.vy ) || currentBallSpeed();
  if ( balls.length === 1 ) {
    balls.push( cloneInFlightBall( src, heading - MULTI_SPREAD, mag ) );
    balls.push( cloneInFlightBall( src, heading + MULTI_SPREAD, mag ) );
  } else {
    while ( balls.length < 3 ) {
      const offset = balls.length === 2 ? MULTI_SPREAD : -MULTI_SPREAD;
      balls.push( cloneInFlightBall( src, heading + offset, mag ) );
    }
  }
  applyBallSpeed();
  writePowerHud();
}

function tickEffects( dt ) {
  if ( effects.wideMs > 0 ) {
    effects.wideMs = Math.max( 0, effects.wideMs - dt * 1000 );
    if ( effects.wideMs === 0 ) applyPaddleWidth();
    writePowerHud();
  }
  if ( effects.slowMs > 0 ) {
    effects.slowMs = Math.max( 0, effects.slowMs - dt * 1000 );
    if ( effects.slowMs === 0 ) applyBallSpeed();
    writePowerHud();
  }
  if ( effects.stickyMs > 0 ) {
    effects.stickyMs = Math.max( 0, effects.stickyMs - dt * 1000 );
    writePowerHud();
  }
  if ( effects.laserMs > 0 ) {
    effects.laserMs = Math.max( 0, effects.laserMs - dt * 1000 );
    writePowerHud();
  }
}

function fireLaser() {
  if ( shots.length > 0 ) return;
  const w = SHOT_W * SCALE;
  const h = SHOT_H * SCALE;
  shots.push( {
    x: paddle.x + paddle.w / 2 - w / 2,
    y: paddle.y - h,
    w: w,
    h: h,
  } );
}

function collideShotBricks( shot ) {
  for ( let i = 0; i < bricks.length; i++ ) {
    const brick = bricks[ i ];
    if ( !brick.alive ) continue;
    if ( !aabb( shot, brick ) ) continue;
    breakBrick( brick );
    checkWin();
    return true;
  }
  return false;
}

function updateShots( dt ) {
  const rise = SHOT_SPEED * SCALE * dt;
  let write = 0;
  for ( let i = 0; i < shots.length; i++ ) {
    const shot = shots[ i ];
    shot.y -= rise;
    if ( shot.y + shot.h < 0 ) continue;
    if ( collideShotBricks( shot ) ) continue;
    shots[ write++ ] = shot;
  }
  shots.length = write;
}

function drawShots() {
  ctx.fillStyle = '#ffffff';
  for ( let i = 0; i < shots.length; i++ ) {
    const shot = shots[ i ];
    ctx.fillRect( shot.x, shot.y, shot.w, shot.h );
  }
}

function drawPowerups() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 1;
  for ( let i = 0; i < powerups.length; i++ ) {
    const drop = powerups[ i ];
    const look = POWERUP_LOOK[ drop.type ] || POWERUP_LOOK.slow;
    ctx.fillStyle = look.fill;
    ctx.strokeStyle = '#000000';
    ctx.fillRect( drop.x, drop.y, drop.w, drop.h );
    ctx.strokeRect( drop.x, drop.y, drop.w, drop.h );
    ctx.fillStyle = look.ink;
    ctx.font = 'bold ' + Math.round( drop.h * 0.75 ) + 'px sans-serif';
    ctx.fillText( look.letter, drop.x + drop.w / 2, drop.y + drop.h / 2 );
  }
}
