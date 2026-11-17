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
  mergeOpponentIDs,
  mergeResult,
  outcomeFor,
  readIncomingResult,
  resolveChallenge,
  saveContextEntry,
  seedFor,
  standingsFor,
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

const ONE = ['p1'];
const GROUP = ['p1', 'p2', 'p3'];

test('resolveChallenge picks play, waiting or results for 1:1', () => {
  assert.deepEqual(resolveChallenge(null, {}, ONE), {phase: 'play', challengeNo: 1});
  assert.deepEqual(resolveChallenge(null, {p1: {c: 1, s: 40}}, ONE), {
    phase: 'play',
    challengeNo: 1,
  });
  assert.deepEqual(resolveChallenge({c: 1, s: 30}, {}, ONE), {
    phase: 'waiting',
    challengeNo: 1,
  });
  assert.deepEqual(resolveChallenge({c: 1, s: 30}, {p1: {c: 1, s: 40}}, ONE), {
    phase: 'results',
    challengeNo: 1,
  });
  assert.deepEqual(resolveChallenge({c: 1, s: 30}, {p1: {c: 2, s: 50}}, ONE), {
    phase: 'play',
    challengeNo: 2,
  });
  assert.deepEqual(resolveChallenge({c: 2, s: 30}, {p1: {c: 1, s: 50}}, ONE), {
    phase: 'waiting',
    challengeNo: 2,
  });
});

test('a group shows results only once everyone played', () => {
  const mine = {c: 1, s: 30};
  const two = {p1: {c: 1, s: 20}, p2: {c: 1, s: 50}};
  assert.equal(resolveChallenge(mine, two, GROUP).phase, 'waiting');
  assert.deepEqual(outcomeFor(mine, two, GROUP), {outcome: 'waiting'});
  const all = {...two, p3: {c: 1, s: 10}};
  assert.equal(resolveChallenge(mine, all, GROUP).phase, 'results');
  assert.deepEqual(outcomeFor(mine, all, GROUP), {outcome: 'lose', winnerID: 'p2'});
  // The newest challenge anyone started is the one to play.
  assert.deepEqual(resolveChallenge(mine, {...all, p3: {c: 2, s: 5}}, GROUP), {
    phase: 'play',
    challengeNo: 2,
  });
});

test('outcome waits until everyone played the same challenge', () => {
  assert.deepEqual(outcomeFor({c: 1, s: 30}, {}, ONE), {outcome: 'waiting'});
  assert.deepEqual(outcomeFor({c: 2, s: 30}, {p1: {c: 1, s: 90}}, ONE), {
    outcome: 'waiting',
  });
  assert.deepEqual(outcomeFor({c: 1, s: 30}, {p1: {c: 1, s: 20}}, ONE), {
    outcome: 'win',
  });
  assert.deepEqual(outcomeFor({c: 1, s: 30}, {p1: {c: 1, s: 40}}, ONE), {
    outcome: 'lose',
    winnerID: 'p1',
  });
  assert.deepEqual(
    outcomeFor({c: 1, s: 30}, {p1: {c: 1, s: 30}, p2: {c: 1, s: 10}}, ['p1', 'p2']),
    {outcome: 'tie'},
  );
  assert.deepEqual(outcomeFor({c: 1, s: 30}, {}, []), {outcome: 'waiting'});
});

test('standings list who played, best first, then who has not', () => {
  const results = {p1: {c: 1, s: 20}, p2: {c: 1, s: 50}, p3: {c: 0, s: 0}};
  assert.deepEqual(standingsFor({c: 1, s: 30}, results, GROUP), [
    {id: 'p2', score: 50, played: 'yes'},
    {id: 'p1', score: 20, played: 'yes'},
    {id: 'p3', score: 0, played: 'no'},
  ]);
});

test('incoming results carry the sender and keep the newest per player', () => {
  assert.deepEqual(readIncomingResult({cb: {c: 2, s: 90, p: 'p1'}}), {
    playerID: 'p1',
    members: [],
    c: 2,
    s: 90,
  });
  assert.deepEqual(
    readIncomingResult({cb: {c: 1, s: 5, p: 'p1', g: ['p1', 'me', 7, 'p2']}})
      .members,
    ['p1', 'me', 'p2'],
  );
  assert.equal(readIncomingResult({cb: {c: 2, s: 90}}), null);
  assert.equal(readIncomingResult({cb: {c: 'x', s: 90, p: 'p1'}}), null);
  assert.equal(readIncomingResult(null), null);

  const results = {p1: {c: 2, s: 10}};
  assert.equal(mergeResult(results, null), results);
  assert.equal(mergeResult(results, {playerID: 'p1', c: 1, s: 99}), results);
  assert.deepEqual(mergeResult(results, {playerID: 'p1', c: 3, s: 5}), {
    p1: {c: 3, s: 5},
  });
  assert.deepEqual(mergeResult(results, {playerID: 'p2', c: 1, s: 7}), {
    p1: {c: 2, s: 10},
    p2: {c: 1, s: 7},
  });
});

test('opponent IDs merge every source without the player or duplicates', () => {
  assert.deepEqual(
    mergeOpponentIDs('me', ['p1'], ['p2', 'p1'], ['me', 'p3', ''], null),
    ['p1', 'p2', 'p3'],
  );
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
