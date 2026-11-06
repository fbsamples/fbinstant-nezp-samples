/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

const WIDTH = 600;
const HEIGHT = 400;

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTile(ctx, text, color, x, y) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  roundedRect(ctx, x, y + 6, 120, 90, 16);
  ctx.fill();
  ctx.fillStyle = color;
  roundedRect(ctx, x, y, 120, 90, 16);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '900 44px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(text, x + 60, y + 47);
}

/**
 * The custom update image, as a PNG data URL. It only shows the score: names
 * and photos are rendered by Meta, never by game code.
 */
export function drawUpdateCard(score, subtitle) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#2c2c2c';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 6;
  for (let x = -HEIGHT; x < WIDTH; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, HEIGHT);
    ctx.lineTo(x + HEIGHT, 0);
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawTile(ctx, 'COM', '#c2187a', 170, 40);
  drawTile(ctx, 'BO', '#e8711a', 310, 40);

  ctx.fillStyle = '#cfc22a';
  ctx.font = '900 96px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(String(score), WIDTH / 2, 215);
  ctx.fillStyle = '#fff';
  ctx.font = '800 28px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('points', WIDTH / 2, 280);
  ctx.font = '700 26px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(subtitle, WIDTH / 2, 340);

  return canvas.toDataURL('image/png');
}
