/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* global FBInstant */

import {createBoard} from './src/board.js';
import {drawUpdateCard} from './src/card.js';
import {generateGrid} from './src/grid.js';
import {
  PLAYER_DATA_KEY,
  newerResult,
  outcomeFor,
  readOpponentResult,
  resolveChallenge,
  saveContextEntry,
  seedFor,
} from './src/match.js';
import {checkWord, createDictionary} from './src/words.js';

const CSS_PATH = 'overlays/overlays.css';
const ROUND_SECONDS = 90;
const MAX_SAVED_WORDS = 60;
// updateAsync can stay pending without an error; give up and say so.
const UPDATE_TIMEOUT_MS = 20000;

const $ = id => document.getElementById(id);

const state = {
  dictionary: null,
  seeds: [],
  saved: {},
  // Overlay name -> Promise<OverlayView>. Overlays are created once and reused.
  overlays: {},
  // {contextID, opponentID, mine, opponent, words, sendStatus, sendError}
  // while in a 1:1 context.
  match: null,
  // Tiles and words of the round just played, solo or not.
  lastRound: null,
  startRound: null,
  endRound: null,
};

function logError(where, error) {
  console.error(`[Combo Blocks] ${where}`, error);
}

function showScreen(name) {
  for (const screen of ['loading', 'home', 'round', 'results']) {
    $(`screen-${screen}`).hidden = screen !== name;
  }
}

function mountOverlay(path, container, json) {
  return new Promise((resolve, reject) => {
    const view = FBInstant.overlayViews.createOverlayView(
      path,
      CSS_PATH,
      json,
      resolve,
      (_view, error) => reject(error),
    );
    view.iframeElement.className = 'overlay-frame';
    container.append(view.iframeElement);
  });
}

async function showOverlay(name, container, data) {
  const json = JSON.stringify(data);
  container.hidden = false;
  if (state.overlays[name] == null) {
    state.overlays[name] = mountOverlay(`overlays/${name}.xml`, container, json);
    try {
      const view = await state.overlays[name];
      await view.showAsync();
    } catch (error) {
      state.overlays[name] = null;
      throw error;
    }
    return;
  }
  const view = await state.overlays[name];
  await view.updateAsync(json);
  await view.showAsync();
}

// ---------- Home: connected players first, then Friend Match ----------

function getConnectedPlayerCount() {
  return FBInstant.player
    .getConnectedPlayersAsync()
    .then(players => players.length)
    .catch(error => {
      logError('getConnectedPlayersAsync', error);
      return 0;
    });
}

function getFriendMatchCandidates() {
  if (typeof FBInstant.getFriendMatchCandidatesAsync !== 'function') {
    return Promise.resolve([]);
  }
  // Unavailable and empty both mean there is no Friend Match section.
  return FBInstant.getFriendMatchCandidatesAsync().catch(error => {
    logError('getFriendMatchCandidatesAsync', error);
    return [];
  });
}

async function showHome() {
  state.match = null;
  showScreen('home');
  const [connectedCount, candidates] = await Promise.all([
    getConnectedPlayerCount(),
    getFriendMatchCandidates(),
  ]);
  const hasFriends = connectedCount > 0 || candidates.length > 0;
  $('home-empty').hidden = hasFriends;
  if (!hasFriends) {
    $('home-overlay').hidden = true;
    return;
  }
  await showOverlay('home', $('home-overlay'), {
    showConnected: connectedCount > 0 ? 'yes' : 'no',
    showFriendMatch: candidates.length > 0 ? 'yes' : 'no',
    candidates: candidates.map(id => ({id})),
  }).catch(error => logError('home overlay', error));
}

// ---------- Matches ----------

async function saveEntry(contextID, entry) {
  state.saved = saveContextEntry(state.saved, contextID, {
    ...entry,
    t: Date.now(),
  });
  await FBInstant.player
    .setDataAsync({[PLAYER_DATA_KEY]: state.saved})
    .catch(error => logError('setDataAsync', error));
}

async function findOpponentID() {
  try {
    const myID = FBInstant.player.getID();
    const players = await FBInstant.context.getPlayersAsync();
    return players.map(p => p.getID()).find(id => id !== myID) ?? null;
  } catch (error) {
    logError('getPlayersAsync', error);
    return null;
  }
}

async function openMatch(contextID, opponentID, incoming) {
  const entry = state.saved[contextID] ?? {m: null, o: null};
  const opponent = newerResult(entry.o, incoming);
  if (opponent !== entry.o) {
    await saveEntry(contextID, {...entry, o: opponent});
  }
  state.match = {
    contextID,
    opponentID: opponentID ?? (await findOpponentID()),
    mine: entry.m,
    opponent,
    words: entry.w ?? [],
    sendStatus: null,
    sendError: null,
  };
  state.lastRound = null;
  const {phase, challengeNo} = resolveChallenge(entry.m, opponent);
  if (phase === 'play') {
    startRound(challengeNo);
  } else {
    showResults();
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`no response after ${ms / 1000}s`)),
      ms,
    );
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function sendTurnUpdate(mine, opponent, isReminder) {
  if (!FBInstant.getSupportedAPIs().includes('updateAsync')) {
    return Promise.reject(new Error('updateAsync is not supported here'));
  }
  const bothPlayed = opponent != null && opponent.c === mine.c;
  let text = `I scored ${mine.s} on our Combo Blocks grid. Your turn!`;
  let subtitle = 'Same blocks. Can you beat it?';
  if (isReminder) {
    text = `Your turn on our Combo Blocks grid! I scored ${mine.s}.`;
    subtitle = 'Your turn!';
  } else if (bothPlayed) {
    text = `I scored ${mine.s} on our Combo Blocks grid. See who won!`;
    subtitle = 'See who won!';
  }
  return withTimeout(
    FBInstant.updateAsync({
      action: 'CUSTOM',
      template: 'turn_done',
      cta: bothPlayed ? 'See results' : 'Play',
      text,
      image: drawUpdateCard(mine.s, subtitle),
      data: {[PLAYER_DATA_KEY]: mine},
      strategy: 'IMMEDIATE',
      notification: 'NO_PUSH',
    }),
    UPDATE_TIMEOUT_MS,
  );
}

function sendUpdateWithStatus(isReminder) {
  const match = state.match;
  if (match?.mine == null || match.sendStatus === 'sending') {
    return;
  }
  const isCurrent = () => state.match === match;
  match.sendStatus = 'sending';
  renderSendStatus();
  sendTurnUpdate(match.mine, match.opponent, isReminder).then(
    () => {
      match.sendStatus = isReminder ? 'reminded' : 'sent';
      if (isCurrent()) {
        renderSendStatus();
      }
    },
    error => {
      logError('updateAsync', error);
      match.sendStatus = 'failed';
      match.sendError = String(error?.code ?? error?.message ?? error);
      if (isCurrent()) {
        renderSendStatus();
      }
    },
  );
}

// ---------- Round ----------

function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function startRound(challengeNo) {
  const match = state.match;
  const seed =
    match != null
      ? seedFor(match.contextID, challengeNo)
      : `solo:${FBInstant.player.getID()}:${Date.now()}`;
  const {tiles} = generateGrid(seed, state.seeds);
  const found = new Map();
  let score = 0;

  showScreen('round');
  $('round-score').textContent = '0';
  $('round-timer').textContent = formatTime(ROUND_SECONDS);
  $('round-words').replaceChildren();
  $('start-cover').hidden = false;

  if (match?.opponentID != null) {
    showOverlay('versus', $('versus-overlay'), {
      opponentID: match.opponentID,
    }).catch(error => logError('versus overlay', error));
  } else {
    $('versus-overlay').hidden = true;
  }

  const board = createBoard($('board'), tiles, indices => {
    const result = checkWord(
      tiles,
      indices,
      state.dictionary,
      new Set(found.keys()),
    );
    if (result.ok) {
      found.set(result.word, result);
      score += result.points;
      $('round-score').textContent = String(score);
      const chip = document.createElement('span');
      chip.className = result.rare ? 'word rare' : 'word';
      chip.textContent = `${result.word} +${result.points}`;
      $('round-words').prepend(chip);
    }
    return result;
  });

  state.startRound = () => {
    state.startRound = null;
    $('start-cover').hidden = true;
    $('end-button').hidden = false;
    board.setEnabled(true);
    const deadline = Date.now() + ROUND_SECONDS * 1000;
    const end = () => {
      clearInterval(timer);
      state.endRound = null;
      $('end-button').hidden = true;
      board.setEnabled(false);
      state.lastRound = {tiles, words: [...found.keys()]};
      finishRound(challengeNo, score).catch(error =>
        logError('finishRound', error),
      );
    };
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      $('round-timer').textContent = formatTime(left);
      if (left === 0) {
        end();
      }
    }, 250);
    state.endRound = end;
  };
}

async function finishRound(challengeNo, score) {
  const match = state.match;
  if (match == null) {
    showSoloResults(score);
    return;
  }
  const mine = {c: challengeNo, s: score};
  const words = state.lastRound?.words.slice(0, MAX_SAVED_WORDS) ?? [];
  match.mine = mine;
  match.words = words;
  match.sendStatus = null;
  match.sendError = null;
  await saveEntry(match.contextID, {m: mine, o: match.opponent, w: words});
  FBInstant.player
    .flushDataAsync()
    .catch(error => logError('flushDataAsync', error));
  showResults();
  sendUpdateWithStatus(false);
}

// ---------- Results ----------

function renderMatchView(tiles, words) {
  $('results-match').hidden = false;
  $('results-grid').replaceChildren(
    ...tiles.map(tile => {
      const cell = document.createElement('div');
      cell.className = 'mini-tile';
      cell.style.background = tile.color;
      cell.textContent = tile.text.toUpperCase();
      return cell;
    }),
  );
  $('results-words-title').textContent =
    words.length === 0 ? 'No words found' : `Your words (${words.length})`;
  $('results-words').replaceChildren(
    ...words.map(word => {
      const chip = document.createElement('span');
      chip.className = state.dictionary.isRare(word) ? 'word rare' : 'word';
      chip.textContent = word;
      return chip;
    }),
  );
}

function renderSendStatus() {
  const match = state.match;
  if (match == null) {
    $('send-status').textContent = '';
    $('remind-button').hidden = true;
    return;
  }
  const waiting = outcomeFor(match.mine, match.opponent) === 'waiting';
  const messages = {
    sending: 'Sending your score...',
    sent: 'Score sent to your friend.',
    reminded: 'Reminder sent.',
    failed: `Could not send your score (${match.sendError ?? 'unknown'}). Try Send a reminder.`,
  };
  $('send-status').textContent =
    match.sendStatus != null
      ? messages[match.sendStatus]
      : waiting
        ? 'Waiting for your friend to play this grid.'
        : '';
  $('remind-button').hidden = !waiting || match.mine == null;
  $('remind-button').disabled =
    match.sendStatus === 'sending' || match.sendStatus === 'reminded';
}

function showSoloResults(score) {
  showScreen('results');
  $('results-overlay').hidden = true;
  $('results-summary').textContent = `You scored ${score}`;
  $('rematch-button').textContent = 'Play again';
  $('rematch-button').hidden = false;
  renderSendStatus();
  if (state.lastRound != null) {
    renderMatchView(state.lastRound.tiles, state.lastRound.words);
  }
}

function showResults() {
  const {contextID, mine, opponent, opponentID, words} = state.match;
  const outcome = outcomeFor(mine, opponent);
  showScreen('results');
  $('rematch-button').textContent = 'Rematch';
  $('rematch-button').hidden = outcome === 'waiting';
  renderSendStatus();
  $('results-match').hidden = true;
  if (mine != null) {
    const tiles =
      state.lastRound?.tiles ??
      generateGrid(seedFor(contextID, mine.c), state.seeds).tiles;
    renderMatchView(tiles, words);
  }
  if (opponentID == null) {
    $('results-overlay').hidden = true;
    $('results-summary').textContent =
      outcome === 'waiting'
        ? `You scored ${mine?.s ?? 0}.`
        : `You ${mine.s} - ${opponent.s} Opponent`;
    return;
  }
  $('results-summary').textContent = '';
  showOverlay('results', $('results-overlay'), {
    opponentID,
    myScore: mine?.s ?? 0,
    opponentScore: opponent?.s ?? 0,
    outcome,
  }).catch(error => logError('results overlay', error));
}

function rematch() {
  if (state.match == null) {
    startRound(0);
    return;
  }
  startRound((state.match.mine?.c ?? 0) + 1);
}

// ---------- Startup ----------

async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

async function main() {
  $('start-button').addEventListener('click', () => state.startRound?.());
  $('end-button').addEventListener('click', () => state.endRound?.());
  $('solo-button').addEventListener('click', () => {
    state.match = null;
    startRound(0);
  });
  $('rematch-button').addEventListener('click', rematch);
  $('remind-button').addEventListener('click', () =>
    sendUpdateWithStatus(true),
  );
  $('home-button').addEventListener('click', () => {
    showHome().catch(error => logError('showHome', error));
  });

  await FBInstant.initializeAsync();
  const [words, seeds] = await Promise.all([
    loadJSON('data/words.json'),
    loadJSON('data/seeds.json'),
  ]);
  state.dictionary = createDictionary(words);
  state.seeds = seeds;
  FBInstant.setLoadingProgress(100);
  await FBInstant.startGameAsync();

  const data = await FBInstant.player
    .getDataAsync([PLAYER_DATA_KEY])
    .catch(error => {
      logError('getDataAsync', error);
      return {};
    });
  state.saved = data?.[PLAYER_DATA_KEY] ?? {};

  FBInstant.onContextChange(
    (contextID, playerID) => {
      const next =
        contextID == null
          ? showHome()
          : openMatch(contextID, playerID ?? null, null);
      next.catch(error => logError('onContextChange', error));
    },
    error => logError('context change failed', error),
  );

  const contextID = FBInstant.context.getID();
  if (contextID != null && FBInstant.context.getType() !== 'SOLO') {
    await openMatch(
      contextID,
      null,
      readOpponentResult(FBInstant.getEntryPointData()),
    );
  } else {
    await showHome();
  }
}

main().catch(error => logError('startup', error));
