/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {createRng, randomInt, shuffle} from './rng.js';

export const GRID_SIZE = 16;
// Cells filled from seed words, so every grid has real 2, 3 and 4 block words.
const SEEDED_CELLS = 12;
// Chunk counts of the seed words placed first; 2-chunk words fill the rest.
const SEED_PLAN = [4, 3, 3];
const MAX_TRIES = 200;

export const TILE_COLORS = [
  '#b0002a',
  '#c2187a',
  '#e8711a',
  '#14808f',
  '#cfc22a',
  '#d6402a',
  '#2ba6c4',
  '#e23d8a',
  '#8f0f2e',
  '#1aa29a',
];

function bucketByChunkCount(seeds) {
  const buckets = new Map([
    [2, []],
    [3, []],
    [4, []],
  ]);
  for (const chunks of seeds) {
    buckets.get(chunks.length)?.push(chunks);
  }
  return buckets;
}

function tryPlaceWord(bucket, rng, used, cellsLeft) {
  for (let i = 0; i < MAX_TRIES; i++) {
    const chunks = bucket[randomInt(rng, bucket.length)];
    if (
      chunks.length <= cellsLeft &&
      new Set(chunks).size === chunks.length &&
      chunks.every(chunk => !used.has(chunk))
    ) {
      return chunks;
    }
  }
  return null;
}

/**
 * Builds the 4x4 grid for a seed. `seeds` is the list of chunked common words
 * from data/seeds.json; its order must be the same for every player.
 */
export function generateGrid(seed, seeds) {
  const rng = createRng(seed);
  const buckets = bucketByChunkCount(seeds);
  const used = new Set();
  const seedWords = [];

  const place = chunkCount => {
    const chunks = tryPlaceWord(
      buckets.get(chunkCount),
      rng,
      used,
      SEEDED_CELLS - used.size,
    );
    if (chunks == null) {
      return false;
    }
    chunks.forEach(chunk => used.add(chunk));
    seedWords.push(chunks.join(''));
    return true;
  };

  SEED_PLAN.forEach(place);
  while (used.size < SEEDED_CELLS) {
    if (!place(2)) {
      break;
    }
  }

  // Fill the remaining cells with chunks of other common words.
  for (let i = 0; used.size < GRID_SIZE && i < MAX_TRIES * 10; i++) {
    const chunks = seeds[randomInt(rng, seeds.length)];
    used.add(chunks[randomInt(rng, chunks.length)]);
  }

  const tiles = shuffle([...used], rng).map((text, index) => ({
    id: index,
    text,
    color: TILE_COLORS[randomInt(rng, TILE_COLORS.length)],
  }));
  return {tiles, seedWords};
}
