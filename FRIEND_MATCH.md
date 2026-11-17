# Friend Match (beta)

Friend Match lets a Zero Permissions game show friends the player can invite to
a 1:1 game or a group, inside the game's own UI. Meta renders the friends' names and
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
player ID in an array as a second argument:

```javascript
FBInstant.onContextChange(
  (contextID, selectedPlayerIDs) => {
    if (selectedPlayerIDs != null) {
      startMatchWith(selectedPlayerIDs);
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

## 4. Start a group (multi-select)

Players can also pick 2 to 5 friends and start a group with all of them. Meta
keeps the selection: use `friendMatchToggle` buttons to add or remove a friend,
the local key `FBInstant.friendMatch.selection` (a JSON array of the selected
IDs) to show who is selected, and one `friendMatchCreateGroup` button to start
the group.

```xml
<View>
  <For source="{{candidates}}" itemName="f" limit="10">
    <View>
      <Image src="{{FBInstant.friendMatch[{{f.id}}].photo}}" width="40" height="40" />
      <Text content="{{FBInstant.friendMatch[{{f.id}}].name}}" />
      <If>
        <Condition lhs="{{f.id}}" operator="IN" rhs="{{FBInstant.friendMatch.selection}}"/>
        <View><Button action="{{FBInstant.action.friendMatchToggle({{f.id}})}}" content="Selected" /></View>
        <Else>
          <View><Button action="{{FBInstant.action.friendMatchToggle({{f.id}})}}" content="Select" /></View>
        </Else>
      </If>
    </View>
  </For>
  <Button action="{{FBInstant.action.friendMatchCreateGroup()}}" content="Start group" />
  <Button action="{{FBInstant.action.friendMatchClearSelection()}}" content="Clear" />
</View>
```

- Overlays that use `FBInstant.friendMatch.selection` update by themselves
  when the selection changes; you do not need to call `updateAsync`.
- To show a count or enable your own UI, listen for changes. The callback gets
  the selected IDs from your candidate list, in the order they were picked:

  ```javascript
  FBInstant.onFriendMatchSelectionChange(ids => {
    selectedCount.textContent = ids.length;
  });
  ```

- Tapping the create button shows Meta's dialog with the selected friends. When
  the player confirms, Meta creates the group and switches the game into it,
  and `onContextChange` receives the friends' player IDs. Closing the dialog
  keeps the selection; if a friend can no longer be selected, the error handler
  is called and the selection is cleared.
- The create button does nothing with fewer than two friends selected, and a
  sixth friend cannot be added.

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
