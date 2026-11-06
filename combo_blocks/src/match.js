/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Challenge bookkeeping for one context. Pure functions; main.js does the SDK
// calls. A result is {c: challengeNo, s: score}.

export const PLAYER_DATA_KEY = 'cb';
export const MAX_SAVED_CONTEXTS = 20;

export function seedFor(contextID, challengeNo) {
  return `${contextID}:${challengeNo}`;
}

function isResult(value) {
  return (
    value != null &&
    Number.isInteger(value.c) &&
    value.c > 0 &&
    Number.isFinite(value.s)
  );
}

/** The opponent's result from a custom update's entry point data. */
export function readOpponentResult(entryPointData) {
  const result = entryPointData?.[PLAYER_DATA_KEY];
  return isResult(result) ? {c: result.c, s: result.s} : null;
}

/** Keeps the newer of two known opponent results. */
export function newerResult(a, b) {
  if (!isResult(a)) {
    return isResult(b) ? b : null;
  }
  return isResult(b) && b.c > a.c ? b : a;
}

/**
 * Decides what to show for a context:
 * - 'play': a challenge this player hasn't played yet (the first one, or one
 *   the opponent started);
 * - 'waiting': this player has played and the opponent hasn't;
 * - 'results': both played the same challenge.
 */
export function resolveChallenge(mine, opponent) {
  const myChallenge = isResult(mine) ? mine.c : 0;
  const opponentChallenge = isResult(opponent) ? opponent.c : 0;
  if (opponentChallenge > myChallenge) {
    return {phase: 'play', challengeNo: opponentChallenge};
  }
  if (myChallenge === 0) {
    return {phase: 'play', challengeNo: 1};
  }
  if (opponentChallenge === myChallenge) {
    return {phase: 'results', challengeNo: myChallenge};
  }
  return {phase: 'waiting', challengeNo: myChallenge};
}

/** 'win' | 'lose' | 'tie' once both played the same challenge, else 'waiting'. */
export function outcomeFor(mine, opponent) {
  if (!isResult(mine) || !isResult(opponent) || mine.c !== opponent.c) {
    return 'waiting';
  }
  if (mine.s === opponent.s) {
    return 'tie';
  }
  return mine.s > opponent.s ? 'win' : 'lose';
}

/**
 * Returns the saved map with this context's entry replaced, keeping only the
 * most recent MAX_SAVED_CONTEXTS contexts. An entry is
 * {m: my result, o: opponent result, t: timestamp}.
 */
export function saveContextEntry(saved, contextID, entry) {
  const next = {...(saved ?? {}), [contextID]: entry};
  const keep = Object.keys(next)
    .sort((a, b) => (next[b].t ?? 0) - (next[a].t ?? 0))
    .slice(0, MAX_SAVED_CONTEXTS);
  return Object.fromEntries(keep.map(key => [key, next[key]]));
}
