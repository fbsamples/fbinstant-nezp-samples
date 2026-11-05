# Friend Match (beta)

Friend Match lets a Zero Permissions game show friends the player can invite to
a 1:1 game, inside the game's own UI. Meta renders the friends' names and
photos in an overlay view; the game never receives them.

Friend Match is in a closed beta and only works for games and players that are
enabled for it. Treat it as optional: always handle the case where it is not
available.

## 1. Get the candidates

```javascript
FBInstant.getFriendMatchCandidatesAsync()
  .then(ids => {
    if (ids.length === 0) {
      hideFriendsSection();
      return;
    }
    showFriendsSection(ids);
  })
  .catch(error => {
    // INVALID_OPERATION: Friend Match is not available for this player.
    // RATE_LIMITED or NETWORK_FAILURE: try again later.
    hideFriendsSection();
  });
```

- The result is an array of opaque IDs, in the order to show them. Do not
  reorder it.
- These IDs are **not player IDs**. They only work in overlay views, only for
  the current player, and only for the current session. Do not store them.
- Calling the method again in the same session returns the same list without a
  new request, so it is safe to call whenever you render the section.
- The list can be empty. Hide the section in that case.

## 2. Render them in an overlay view

Pass the IDs to the overlay as developer data and refer to each friend through
`FBInstant.friendMatch[<id>]`:

```xml
<View>
  <For source="{{candidates}}" itemName="f" limit="10">
    <View>
      <Image src="{{FBInstant.friendMatch[{{f.id}}].photo}}" width="40" height="40" />
      <Text content="{{FBInstant.friendMatch[{{f.id}}].name}}" />
      <Button action="{{FBInstant.action.friendMatchSelect({{f.id}})}}" content="Play" />
    </View>
  </For>
</View>
```

```javascript
overlay.updateAsync({candidates: ids.map(id => ({id}))})
  .then(() => overlay.showAsync());
```

Names and photos cannot be used in event attributes (`onTapEvent`,
`onErrorEvent`); the overlay fails to load if they are. Using the ID itself in
`onTapEvent` is allowed.

## 3. Handle the selection

The `friendMatchSelect` button action is the only way to pick a friend. When the
player taps it, Meta starts a 1:1 game with that friend and switches the game
into it. Your `onContextChange` success handler then receives the friend's
player ID as a second argument:

```javascript
FBInstant.onContextChange(
  (contextID, selectedPlayerID) => {
    if (selectedPlayerID != null) {
      startMatchWith(selectedPlayerID);
    }
  },
  error => {
    // The friend could not be selected. The next call to
    // getFriendMatchCandidatesAsync() fetches a fresh list.
    refreshFriendsSection();
  },
);
```

If anything fails, the error handler is called and no player ID is given.

## Things to get right

- **New players have no game data.** A selected friend has usually never played
  your game: no score, level or saved data. Render them with sensible defaults
  and keep them out of leaderboards until they play.
- **Label the section neutrally.** Use copy like "Play with friends". Do not
  write anything that says or implies whether a friend has played this game or
  other games ("new to this game", "plays 3 games"), and do not split the list
  into groups.
- **Reuse overlays.** Do not create one overlay per friend. Use one overlay with
  a `For` loop, or a small pool of overlays that you update, because many live
  overlays make browsers unstable.
- **Expect the list to change between sessions.** IDs from an earlier session
  do not work.
