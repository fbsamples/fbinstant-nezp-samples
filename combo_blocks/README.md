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
- **Challenging several friends.** "Challenge several" (an `onTapEvent` the
  game handles) switches the Friend Match section to multi-select in the same
  overlay: each friend gets a Pick button (`FBInstant.action.friendMatchToggle`)
  that shows Picked through `FBInstant.friendMatch.selection`, and
  "Challenge picked friends" (`FBInstant.action.friendMatchCreateGroup`) starts
  a group with 2 to 5 of them. The game shows how many are picked from
  `FBInstant.onFriendMatchSelectionChange`. "One friend" switches back. The
  toggle only appears when the SDK supports multi-select.
- **Starting a match.** `FBInstant.onContextChange(contextID, playerIDs)` gives
  the new context and, after a Friend Match pick, the picked friends' player
  IDs before they have ever opened the game: one for 1:1, up to five for a
  group.
- **Same grid for both.** The grid is generated from
  `"<contextID>:<challengeNo>"` with a seeded PRNG, so no grid data needs to
  be sent. Rematches bump `challengeNo`.
- **Async turns.** At the end of a round (time up or End) the score is saved
  in player data and sent to the context with `FBInstant.updateAsync`. The
  update carries the sender's player ID and everyone in the match, so group
  members tell results apart and know who they are still waiting for. The
  card image is drawn on a canvas in game code and shows only the score; the
  score travels in the update's `data` and arrives through
  `FBInstant.getEntryPointData()`. The results screen says whether the update
  was sent, and while anyone has not played it shows your grid and words and a
  Send a reminder button that sends another update. Results list every
  opponent, best score first, and wait until everyone has played.
- **No personal data in game code.** Names and photos only appear in overlays
  (`overlays/*.xml`); the game handles only IDs and scores.

Known limitation: a player only learns an opponent's score by opening the
game from that opponent's update.

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
