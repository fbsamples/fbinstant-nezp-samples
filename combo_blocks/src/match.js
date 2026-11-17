/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Challenge bookkeeping for one context with one or more opponents. Pure
// functions; main.js does the SDK calls. A result is {c: challengeNo, s: score}
// and opponents' results are kept per player ID.

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

/**
 * An opponent's result from a custom update's entry point data:
 * {playerID, members, c, s}. Updates carry the sender's player ID, so group
 * members can tell each other's results apart, and everyone in the match, so
 * a friend who opens the group before the others played still knows to wait
 * for them.
 */
export function readIncomingResult(entryPointData) {
  const result = entryPointData?.[PLAYER_DATA_KEY];
  if (!isResult(result) || typeof result.p !== 'string' || result.p === '') {
    return null;
  }
  const members = Array.isArray(result.g)
    ? result.g.filter(id => typeof id === 'string')
    : [];
  return {playerID: result.p, members, c: result.c, s: result.s};
}

/** Adds an incoming result, keeping each opponent's newest challenge. */
export function mergeResult(results, incoming) {
  if (incoming == null) {
    return results;
  }
  const known = results[incoming.playerID];
  if (isResult(known) && known.c >= incoming.c) {
    return results;
  }
  return {...results, [incoming.playerID]: {c: incoming.c, s: incoming.s}};
}

function everyonePlayed(mine, results, opponentIDs) {
  return (
    isResult(mine) &&
    opponentIDs.length > 0 &&
    opponentIDs.every(id => results[id]?.c === mine.c)
  );
}

/**
 * Decides what to show for a context:
 * - 'play': a challenge this player hasn't played yet (the first one, or the
 *   newest one an opponent started);
 * - 'waiting': this player has played and some opponents haven't;
 * - 'results': everyone played the same challenge.
 */
export function resolveChallenge(mine, results, opponentIDs) {
  const myChallenge = isResult(mine) ? mine.c : 0;
  const newestOpponentChallenge = Math.max(
    0,
    ...opponentIDs.map(id => (isResult(results[id]) ? results[id].c : 0)),
  );
  if (newestOpponentChallenge > myChallenge) {
    return {phase: 'play', challengeNo: newestOpponentChallenge};
  }
  if (myChallenge === 0) {
    return {phase: 'play', challengeNo: 1};
  }
  return {
    phase: everyonePlayed(mine, results, opponentIDs) ? 'results' : 'waiting',
    challengeNo: myChallenge,
  };
}

/**
 * {outcome: 'win' | 'lose' | 'tie' | 'waiting', winnerID?}. Until every
 * opponent played this player's challenge the outcome is 'waiting'. A tie
 * means sharing the best score.
 */
export function outcomeFor(mine, results, opponentIDs) {
  if (!everyonePlayed(mine, results, opponentIDs)) {
    return {outcome: 'waiting'};
  }
  let winnerID = opponentIDs[0];
  for (const id of opponentIDs) {
    if (results[id].s > results[winnerID].s) {
      winnerID = id;
    }
  }
  const best = results[winnerID].s;
  if (mine.s > best) {
    return {outcome: 'win'};
  }
  return mine.s === best ? {outcome: 'tie'} : {outcome: 'lose', winnerID};
}

/**
 * The opponents' rows for this player's challenge: those who played it, best
 * score first, then those who haven't, as {id, score, played: 'yes' | 'no'}.
 */
export function standingsFor(mine, results, opponentIDs) {
  const challenge = isResult(mine) ? mine.c : 0;
  const rows = opponentIDs.map(id => {
    const played = results[id]?.c === challenge && challenge > 0;
    return {id, score: played ? results[id].s : 0, played: played ? 'yes' : 'no'};
  });
  return [
    ...rows.filter(row => row.played === 'yes').sort((a, b) => b.score - a.score),
    ...rows.filter(row => row.played === 'no'),
  ];
}

/** Opponent player IDs from every source, without duplicates or the player. */
export function mergeOpponentIDs(myID, ...lists) {
  const ids = [];
  for (const list of lists) {
    for (const id of list ?? []) {
      if (typeof id === 'string' && id !== '' && id !== myID && !ids.includes(id)) {
        ids.push(id);
      }
    }
  }
  return ids;
}

/**
 * Returns the saved map with this context's entry replaced, keeping only the
 * most recent MAX_SAVED_CONTEXTS contexts. An entry is
 * {m: my result, r: opponents' results by player ID, ids: opponent player
 * IDs, w: my words, t: timestamp}.
 */
export function saveContextEntry(saved, contextID, entry) {
  const next = {...(saved ?? {}), [contextID]: entry};
  const keep = Object.keys(next)
    .sort((a, b) => (next[b].t ?? 0) - (next[a].t ?? 0))
    .slice(0, MAX_SAVED_CONTEXTS);
  return Object.fromEntries(keep.map(key => [key, next[key]]));
}
