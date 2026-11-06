/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Run: node --test 'fbcode/games/instant_games/nezp-samples/combo_blocks/tests/*.test.mjs'

import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {test} from 'node:test';

import {GRID_SIZE, generateGrid} from '../src/grid.js';
import {
  newerResult,
  outcomeFor,
  readOpponentResult,
  resolveChallenge,
  saveContextEntry,
  seedFor,
} from '../src/match.js';
import {createRng, hashString} from '../src/rng.js';
import {
  checkWord,
  createDictionary,
  findAllWords,
} from '../src/words.js';

const readJSON = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const seeds = readJSON('../data/seeds.json');
const dictionary = createDictionary(readJSON('../data/words.json'));

const tilesOf = (...texts) => texts.map((text, id) => ({id, text, color: ''}));

test('rng is deterministic per seed', () => {
  const draw = seed => {
    const rng = createRng(seed);
    return [rng(), rng(), rng()];
  };
  assert.deepEqual(draw('ctx:1'), draw('ctx:1'));
  assert.notDeepEqual(draw('ctx:1'), draw('ctx:2'));
  assert.equal(hashString('abc'), hashString('abc'));
});

test('the same seed gives every player the same grid', () => {
  const seed = seedFor('1122334455', 1);
  assert.deepEqual(generateGrid(seed, seeds), generateGrid(seed, seeds));
  assert.notDeepEqual(
    generateGrid(seedFor('1122334455', 2), seeds).tiles,
    generateGrid(seed, seeds).tiles,
  );
});

test('grids have 16 distinct tiles and real 2, 3 and 4 tile words', () => {
  for (let i = 1; i <= 25; i++) {
    const {tiles, seedWords} = generateGrid(seedFor('ctx', i), seeds);
    assert.equal(tiles.length, GRID_SIZE);
    assert.equal(new Set(tiles.map(t => t.text)).size, GRID_SIZE);
    const all = findAllWords(tiles, dictionary);
    seedWords.forEach(word => assert.ok(all.has(word), word));
    const counts = new Set([...all.values()].map(w => w.tileCount));
    assert.ok(counts.has(2) && counts.has(3) && counts.has(4), `seed ${i}`);
  }
});

test('checkWord validates tile count, reuse, dictionary and repeats', () => {
  const tiles = tilesOf('com', 'bi', 'na', 'tion', 'pa', 'per', 'zz');
  const found = new Set();
  assert.equal(checkWord(tiles, [0], dictionary, found).reason, 'too_short');
  assert.equal(
    checkWord(tiles, [0, 1, 2, 3, 4], dictionary, found).reason,
    'too_long',
  );
  assert.equal(checkWord(tiles, [4, 4], dictionary, found).reason, 'repeat_tile');
  assert.equal(checkWord(tiles, [6, 4], dictionary, found).reason, 'not_a_word');

  const paper = checkWord(tiles, [4, 5], dictionary, found);
  assert.deepEqual(
    {ok: paper.ok, word: paper.word, tileCount: paper.tileCount},
    {ok: true, word: 'paper', tileCount: 2},
  );
  assert.equal(paper.points, paper.rare ? 20 : 10);
  found.add('paper');
  assert.equal(checkWord(tiles, [4, 5], dictionary, found).reason, 'already_found');

  const combination = checkWord(tiles, [0, 1, 2, 3], dictionary, found);
  assert.equal(combination.word, 'combination');
  assert.equal(combination.points, combination.rare ? 120 : 60);
});

test('rare words score double', () => {
  const rareDictionary = createDictionary({words: 'paper', rare: 'paper'});
  const result = checkWord(tilesOf('pa', 'per'), [0, 1], rareDictionary, new Set());
  assert.equal(result.rare, true);
  assert.equal(result.points, 20);
});

test('resolveChallenge picks play, waiting or results', () => {
  assert.deepEqual(resolveChallenge(null, null), {phase: 'play', challengeNo: 1});
  assert.deepEqual(resolveChallenge(null, {c: 1, s: 40}), {
    phase: 'play',
    challengeNo: 1,
  });
  assert.deepEqual(resolveChallenge({c: 1, s: 30}, null), {
    phase: 'waiting',
    challengeNo: 1,
  });
  assert.deepEqual(resolveChallenge({c: 1, s: 30}, {c: 1, s: 40}), {
    phase: 'results',
    challengeNo: 1,
  });
  assert.deepEqual(resolveChallenge({c: 1, s: 30}, {c: 2, s: 50}), {
    phase: 'play',
    challengeNo: 2,
  });
  assert.deepEqual(resolveChallenge({c: 2, s: 30}, {c: 1, s: 50}), {
    phase: 'waiting',
    challengeNo: 2,
  });
});

test('opponent results are read and merged safely', () => {
  assert.deepEqual(readOpponentResult({cb: {c: 2, s: 90}}), {c: 2, s: 90});
  assert.equal(readOpponentResult({cb: {c: 'x', s: 90}}), null);
  assert.equal(readOpponentResult(null), null);
  assert.deepEqual(newerResult({c: 1, s: 10}, {c: 2, s: 5}), {c: 2, s: 5});
  assert.deepEqual(newerResult({c: 2, s: 10}, {c: 1, s: 5}), {c: 2, s: 10});
  assert.deepEqual(newerResult(null, {c: 1, s: 5}), {c: 1, s: 5});
});

test('outcome waits until both played the same challenge', () => {
  assert.equal(outcomeFor({c: 1, s: 30}, null), 'waiting');
  assert.equal(outcomeFor({c: 2, s: 30}, {c: 1, s: 90}), 'waiting');
  assert.equal(outcomeFor({c: 1, s: 30}, {c: 1, s: 20}), 'win');
  assert.equal(outcomeFor({c: 1, s: 30}, {c: 1, s: 40}), 'lose');
  assert.equal(outcomeFor({c: 1, s: 30}, {c: 1, s: 30}), 'tie');
});

test('saved contexts keep only the most recent 20', () => {
  let saved = {};
  for (let i = 0; i < 25; i++) {
    saved = saveContextEntry(saved, `ctx${i}`, {c: 1, s: i, t: i});
  }
  assert.equal(Object.keys(saved).length, 20);
  assert.ok(!('ctx0' in saved));
  assert.ok('ctx24' in saved);
});

// The overlay server rewrites every " in the XML to ', so an apostrophe in an
// attribute value breaks the whole overlay.
test('overlay attribute values have no apostrophes', () => {
  const dir = new URL('../overlays/', import.meta.url);
  for (const file of readdirSync(dir).filter(name => name.endsWith('.xml'))) {
    const xml = readFileSync(new URL(file, dir), 'utf8');
    assert.ok(!xml.includes("'"), file + ' contains an apostrophe');
  }
});
