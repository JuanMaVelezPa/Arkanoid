'use strict';

const CANVAS_W = 800;
const CANVAS_H = 600;

const canvas = document.getElementById( 'game' );
const ctx = canvas.getContext( '2d' );

function clearPlayfield() {
  ctx.fillStyle = '#1a1a25';
  ctx.fillRect( 0, 0, CANVAS_W, CANVAS_H );
}

function loop() {
  clearPlayfield();
  requestAnimationFrame( loop );
}

loadSpritesheet( () => {
  requestAnimationFrame( loop );
} );
