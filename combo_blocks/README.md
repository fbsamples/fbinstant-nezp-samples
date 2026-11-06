# Combo Blocks

A turn-based Zero Permissions sample that shows off Friend Match. Players get a
4x4 grid of syllable blocks and have 90 seconds to build as many words as they
can from 2 to 4 blocks. Both players in a match get the same grid.

| Word | Points |
| --- | --- |
| 2 blocks | 10 |
| 3 blocks | 30 |
| 4 blocks | 60 |
| Rare word | x2 |

Each block can be used once per word and again in other words. Any English
word counts, whatever its "real" syllables are.

## What it shows

- **Home screen, two sections.** "Friends playing" lists connected players
  (`FBInstant.player.connectedPlayers`, Play creates a context with
  `FBInstant.action.contextCreate`). "Challenge a friend" lists Friend Match
  candidates (`FBInstant.getFriendMatchCandidatesAsync()`, Play selects with
  `FBInstant.action.friendMatchSelect`). Each section is hidden when empty.
- **Starting a match.** `FBInstant.onContextChange(contextID, playerID)` gives
  the new 1:1 context and, after a Friend Match selection, the friend's player
  ID before the friend has ever opened the game.
- **Same grid for both.** The grid is generated from
  `"<contextID>:<challengeNo>"` with a seeded PRNG, so no grid data needs to
  be sent. Rematches bump `challengeNo`.
- **Async turns.** At the end of a round (time up or End) the score is saved
  in player data and sent to the opponent with `FBInstant.updateAsync`. The
  card image is drawn on a canvas in game code and shows only the score; the
  score travels in the update's `data` and arrives through
  `FBInstant.getEntryPointData()`. The results screen says whether the update
  was sent, and while the opponent has not played it shows your grid and words
  and a Send a reminder button that sends another update.
- **No personal data in game code.** Names and photos only appear in overlays
  (`overlays/*.xml`); the game handles only IDs and scores.

Matches are 1:1 for now. Game state is kept per player list and results wait
until everyone has played, so group matches only need platform support.

Known limitation: a player only learns the opponent's score by opening the
game from the opponent's update.

## Layout

- `main.js`: screens and SDK calls.
- `src/`: grid generation, word checking, match state (pure, tested) and the
  board UI.
- `overlays/`: overlay XML and CSS. Overlay CSS supports single-class
  selectors only, and overlay XML must not contain apostrophes: the overlay
  server turns every `"` into `'` before parsing.
- `data/`: generated word list and seed words.
- `tools/build_words.py`: regenerates `data/` from the AOSP LatinIME en_US word
  list (Apache-2.0) and pyphen's hyphenation patterns.
- `tools/package.sh`: builds `combo_blocks.zip` for upload.

## Develop

```bash
# From fbsource root
node --test 'fbcode/games/instant_games/nezp-samples/combo_blocks/tests/*.test.mjs'
PYTHONPATH=third-party/pypi/pyphen/0.15.0/sources \
  python3 fbcode/games/instant_games/nezp-samples/combo_blocks/tools/build_words.py
fbcode/games/instant_games/nezp-samples/combo_blocks/tools/package.sh
```

Upload `combo_blocks.zip` as a Zero Permissions bundle. Friend Match is in a
closed beta: the game and players must be enabled for it (see
`../FRIEND_MATCH.md`). Without it the "Challenge a friend" section stays hidden.
