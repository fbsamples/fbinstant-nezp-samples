/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const MIN_TILES = 2;
export const MAX_TILES = 4;
export const POINTS_BY_TILES = {2: 10, 3: 30, 4: 60};
export const RARE_MULTIPLIER = 2;

/** `data` is data/words.json: space-separated `words` and `rare`. */
export function createDictionary(data) {
  const words = new Set(data.words.split(' '));
  const rare = new Set(data.rare.split(' '));
  return {
    has: word => words.has(word),
    isRare: word => rare.has(word),
  };
}

export function scoreWord(word, tileCount, dictionary) {
  const rare = dictionary.isRare(word);
  return {
    points: POINTS_BY_TILES[tileCount] * (rare ? RARE_MULTIPLIER : 1),
    rare,
  };
}

/**
 * Checks the tiles at `indices`, in tap order, as one word. Each tile can be
 * used once per word; `foundWords` holds words already scored this round.
 */
export function checkWord(tiles, indices, dictionary, foundWords) {
  if (indices.length < MIN_TILES) {
    return {ok: false, reason: 'too_short'};
  }
  if (indices.length > MAX_TILES) {
    return {ok: false, reason: 'too_long'};
  }
  if (new Set(indices).size !== indices.length) {
    return {ok: false, reason: 'repeat_tile'};
  }
  const word = indices.map(i => tiles[i].text).join('');
  if (!dictionary.has(word)) {
    return {ok: false, reason: 'not_a_word', word};
  }
  if (foundWords.has(word)) {
    return {ok: false, reason: 'already_found', word};
  }
  return {ok: true, word, tileCount: indices.length, ...scoreWord(word, indices.length, dictionary)};
}

/** Every word the grid can make, word -> best {tileCount, points, rare}. */
export function findAllWords(tiles, dictionary) {
  const found = new Map();
  const visit = (indices, used) => {
    if (indices.length >= MIN_TILES) {
      const word = indices.map(i => tiles[i].text).join('');
      if (dictionary.has(word)) {
        const scored = {tileCount: indices.length, ...scoreWord(word, indices.length, dictionary)};
        const best = found.get(word);
        if (best == null || scored.points > best.points) {
          found.set(word, scored);
        }
      }
    }
    if (indices.length === MAX_TILES) {
      return;
    }
    for (let i = 0; i < tiles.length; i++) {
      if (!used.has(i)) {
        used.add(i);
        visit([...indices, i], used);
        used.delete(i);
      }
    }
  };
  visit([], new Set());
  return found;
}
