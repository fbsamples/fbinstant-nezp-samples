/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export function createOverlayView(overlayName, customCallback) {
  const tempView = FBInstant.overlayViews.createOverlayViewWithXMLString(
    document.getElementById('overlay_content_editor').value,
    'ig_views/styles.css',
    document.getElementById('overlay_dev_params').value,
    view => {
      view.iframeElement.style.zIndex = 100;
      view.iframeElement.style.position = 'absolute';
      const horizontalPosition =
        (window.innerWidth - view.iframeElement.offsetWidth) / 2;
      const verticalPosition =
        (window.innerHeight - view.iframeElement.offsetHeight) / 2;
      view.iframeElement.style.top = verticalPosition - 275 + 'px';
      view.iframeElement.style.left = horizontalPosition + 'px';
      view.iframeElement.style.height = '500px';
      if (customCallback) {
        customCallback();
      }
      updateOverlayStatusToHTML('Mounted');
    },
    (_, error) => {
      console.log(error);
    },
  );
  return tempView;
}

export function updateOverlayStatusToHTML(status) {
  document.getElementById('current_overlay_status').innerHTML = status;
  switch (status) {
    case '':
      updateOverlayButtonToNextStep('Load Overlay');
      break;
    case 'Loaded':
      updateOverlayButtonToNextStep('Mount Overlay');
      break;
    case 'Mounted':
      updateOverlayButtonToNextStep('Show Overlay');
      break;
    case 'Shown':
      updateOverlayButtonToNextStep('Dismiss Overlay');
      break;
  }
}

export function assertThatOverlayStatusIsCorrect(status) {
  const isCorrect =
    document.getElementById('current_overlay_status').innerHTML == status;
  if (!isCorrect) {
    throw new Error(
      'Overlay status is not correct, expected status should be ' +
        status +
        ' but got ' +
        document.getElementById('current_overlay_status').innerHTML,
    );
  }
}

function updateOverlayButtonToNextStep(nextStepContent) {
  document.getElementById('overlay-control-button').innerHTML = nextStepContent;
}

export async function setOverlayDevParams(overlayName) {
  let devParams = document.getElementById('overlay_dev_params').value;
  if (overlayName === 'ig_views/challenges_loop.xml') {
    devParams = {
      challenges: ['Daily challenge', 'Weekly challenge', 'Monthly challenge'],
    };
  } else if (overlayName === 'ig_views/level_rank_dev_param.xml') {
    devParams = {currentLevel: 'Word amateur', rank: 2};
  } else if (overlayName === 'ig_views/open_contexts.xml') {
    const contextIDs = await FBInstant.player
      .getDataAsync(['contextIDs'])
      .then(function (data) {
        return data.contextIDs;
      });
    devParams = {contextIDs};
  } else if (overlayName === 'ig_views/level_rank_if.xml') {
    devParams = {rank: 2, rankName: 'King', progress: 90};
  } else if (overlayName === 'ig_views/challenges_left_if.xml') {
    devParams = {finishedChallenges: ['weekly']};
  } else if (overlayName === 'ig_views/leaderboard_list.xml') {
    devParams = {
      players: [
        {name: 'Zebra', score: 100},
        {name: 'Lion', score: 200},
        {name: 'Pig', score: 300},
        {name: 'currentPlayer', score: 250},
        {name: 'Frog', score: 500},
        {name: 'Hippo', score: 600},
        {name: 'Cat', score: 600},
      ],
    };
  } else if (overlayName === 'ig_views/specific_friend.xml') {
    // eslint-disable-next-line no-undef
    const connectedPlayers = await FBInstant.player.getConnectedPlayersAsync();
    const playerID =
      connectedPlayers.length > 0 ? connectedPlayers[0].getID() : 'REPLACE-ME';
    devParams = {playerID};
  } else {
    document.getElementById('overlay_dev_params').value = devParams;
    return;
  }
  document.getElementById('overlay_dev_params').value =
    JSON.stringify(devParams);
}
