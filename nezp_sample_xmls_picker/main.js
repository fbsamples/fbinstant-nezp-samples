/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  assertThatOverlayStatusIsCorrect,
  createOverlayView,
  setOverlayDevParams,
  updateOverlayStatusToHTML,
} from './overlayManagementUtils.js';

let currentOverlayName = null;
let currentOverlay = null;

currentOverlayName = 'ig_views/profile_view.xml';

window.addEventListener('DOMContentLoaded', function () {
  console.log('DOM LOADED!');
  document.getElementById('overlay-control-button-update').style.display =
    'none';
  FBInstant.initializeAsync().then(function () {
    console.log('INITIALIZED!');
    FBInstant.setLoadingProgress(100);
    FBInstant.startGameAsync().then(function () {
      console.log('GAME STARTED!');
      FBInstant.overlayViews.setCustomEventHandler((eventStr, overlayID) => {
        document.getElementById('overlayCustomEventOutput').innerHTML +=
          ' |' + eventStr + ' triggered by ' + overlayID + '| ';

        if (eventStr === 'share') {
          console.log('Share Event Triggered');
          FBInstant.shareAsync({
            intent: 'CHALLENGE',
            image:
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAABACAIAAAD07OL5AAABjklEQVR4nOzX3yt7cRzH8XO+rb6uUFxw1iJxI8vFXKiVX0V+ZBeIi6WwpqQkIVJKGdOoXQxpNaW0lJqLUXaxsptlLGVTU35cTBONLewMZbny+vwBcvHp83lfPd4X61nvi51zFIvGQeFndJoQ3C27YIP5GW6KrsKm5nv4/44HLlIG4H/CHw8P8MDvR/GZUmKJuk1w0mGHbXVWeMRyB6sCMXi+fwau/MqG6T8RDzAQEPesGSwxbTvsbW2AM8U6WArOkl+nbGB5/QXsUOth+k/EAwwExIinEMvA5j5xG2nb3WtwXu0UPJw8gie2jHBSKIPpPxEPMBAQ/e8PWLSNt7D9qQLW93bBVadpuMV1BufunsD+806Y/hPxAAMBhS84hqU0ZIHl6QW4+uoDTm8vw+ZR8iwRatTgkCYB038iHmAgICZ841hyDOR/PHycBUsrJfCj1AEbJg/gpZQT7olswPSfiAcYCIg3zj4sb6+XsBQn3wGqwwI4ni/Dc+svsNdK3ovC1xGY/hPxAAOB7wAAAP//u2xofqwWhNYAAAAASUVORK5CYII=',
            text: 'Play to win!',
            data: {source: 'cute meerkat share'},
          });
        }
      });
      getOverlayContent('./' + currentOverlayName, (err, data) => {
        if (err == null) {
          document.getElementById('overlay_content_editor').value = data;
        }
      });
      document.getElementById('overlay_dev_params').value =
        '{"players":[{"name":"Zebra","score":100},{"name":"Lion","score":200},{"name":"Pig","score":300},{"name":"currentPlayer","score":250},{"name":"Frog", "score":500},{"name":"Hippo", "score":600},{"name":"Cat", "score":600}]}';

      FBInstant.onContextChange(contextID => {
        document.getElementById('overlayContextResponse').innerHTML +=
          ' ' + contextID;
        FBInstant.player.getDataAsync(['contextIDs']).then(data => {
          const existingContextIDs = Array.isArray(data.contextIDs)
            ? data.contextIDs
            : [];
          if (contextID != null) {
            existingContextIDs.push(contextID);
          }
          FBInstant.player.setDataAsync({contextIDs: existingContextIDs});
        });
      });

      // Getting payments
      document.getElementById('showStore').addEventListener('click', () => {
        if (
          document.getElementById('storeContainer').style.display == '' ||
          document.getElementById('storeContainer').style.display === 'none'
        ) {
          document.getElementById('storeContainer').innerHTML = '';
          document.getElementById('storeContainer').style.display = 'flex';
          showStore();
        } else {
          document.getElementById('storeContainer').style.display = 'none';
        }
      });

      document.getElementById('showPurchases').addEventListener('click', () => {
        if (
          document.getElementById('historyContainer').style.display == '' ||
          document.getElementById('historyContainer').style.display === 'none'
        ) {
          document.getElementById('historyContainer').innerHTML = '';
          document.getElementById('historyContainer').style.display = 'flex';
          showPurchases();
        } else {
          document.getElementById('historyContainer').style.display = 'none';
        }
      });

      document.getElementById('showAvatarExpressions').addEventListener('click', () => {
        if (
          document.getElementById('avatarExpressionContainer').style.display == '' ||
          document.getElementById('avatarExpressionContainer').style.display === 'none'
        ) {
          document.getElementById('avatarExpressionContainer').innerHTML = '';
          document.getElementById('avatarExpressionContainer').style.display = 'flex';
          showAvatarExpressions();
        } else {
          document.getElementById('avatarExpressionContainer').style.display = 'none';
        }
      });
    });
  });

  /**
   * Lifecycle Control Buttons
   */

  document
    .getElementById('overlay-control-button')
    .addEventListener('click', async () => {
      const status = document.getElementById(
        'current_overlay_status',
      ).innerHTML;
      document.getElementById('overlay-control-button-update').style.display =
        'none';
      try {
        switch (status) {
          case '':
            assertThatOverlayStatusIsCorrect('');
            currentOverlay = await createOverlayView(currentOverlayName);
            updateOverlayStatusToHTML('Loaded');
            return;
          case 'Loaded':
            assertThatOverlayStatusIsCorrect('Loaded');
            currentOverlay.iframeElement.style.border = '0';
            currentOverlay.iframeElement.id = currentOverlay.iframeElement.name;
            currentOverlay.iframeElement.style.width = '400px';

            document.body.appendChild(currentOverlay.iframeElement);
            updateOverlayStatusToHTML('Mounting');
            return;
          case 'Mounted':
            assertThatOverlayStatusIsCorrect('Mounted');
            currentOverlay.showAsync();
            document.getElementById(
              'overlay-control-button-update',
            ).style.display = 'inline';
            updateOverlayStatusToHTML('Shown');
            return;
          case 'Shown':
            assertThatOverlayStatusIsCorrect('Shown');
            document.body.removeChild(
              document.getElementById(currentOverlay.iframeElement.id),
            );
            updateOverlayStatusToHTML('');
            currentOverlay.dismissAsync();
            return;
        }
      } catch (e) {
        console.log('Error in overlays', e);
      }
    });

  document
    .getElementById('overlay-control-button-update')
    .addEventListener('click', () => {
      currentOverlay
        .updateAsync(document.getElementById('overlay_dev_params').value)
        .then(() => currentOverlay.showAsync());
    });

  /**
   * Overlay Selection
   */

  document
    .getElementById('overlay_selection')
    .addEventListener('change', async () => {
      currentOverlayName = document.getElementById('overlay_selection').value;
      await setOverlayDevParams(currentOverlayName);
      getOverlayContent('./' + currentOverlayName, (err, data) => {
        if (err == null) {
          document.getElementById('overlay_content_editor').value = data;
        }
      });
    });

  /**
   * Special Effects
   */
  document.getElementById('rotate').addEventListener('click', () => {
    currentOverlay.iframeElement.animate(
      [{transform: 'rotate(0)'}, {transform: 'rotate(360deg)'}],
      {
        duration: 3000,
        iterations: Infinity,
      },
    );
  });

  document.getElementById('scale').addEventListener('click', () => {
    currentOverlay.iframeElement.animate(
      [{transform: 'scale(1.0)'}, {transform: 'scale(0.5)'}],
      {
        duration: 3000,
        iterations: Infinity,
      },
    );
  });

  document.getElementById('fade').addEventListener('click', () => {
    currentOverlay.iframeElement.animate(
      {opacity: 0},
      {
        duration: 2000,
        iterations: Infinity,
      },
    );
  });

  function getOverlayContent(url, callback) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'text';
    xhr.onload = function () {
      const status = xhr.status;
      if (status === 200) {
        callback(null, xhr.response);
      } else {
        callback(status, xhr.response);
      }
    };
    xhr.send();
  }

  function showStore() {
    FBInstant.payments.onReady(function () {
      console.log('PAYMENTS READY');
      FBInstant.payments
        .getCatalogAsync()
        .then(function (catalog) {
          console.log('getCatalogAsync success', catalog);
          let debugString = catalog.length + ' item(s): ';
          debugString += JSON.stringify(catalog);
          for (let i = 0; i < catalog.length; i++) {
            const itemWrapper = document.createElement('div');
            itemWrapper.className = 'storeItem';
            itemWrapper.id = 'child' + i;

            const image = document.createElement('img');
            image.src = catalog[i].imageURI;
            image.className = 'storeItemIcon';

            const itemTitle = document.createElement('div');
            itemTitle.innerHTML =
              catalog[i].title +
              ' ' +
              catalog[i].price +
              '<br>' +
              catalog[i].productID;
            itemTitle.className = 'storeItemTitle';

            const buyButton = document.createElement('button');
            buyButton.innerHTML = 'Buy';
            const item = catalog[i];
            buyButton.onclick = function () {
              purchaseAsync(item.productID);
            };
            buyButton.className = 'storeItemButton';
            buyButton.id = catalog[i].productID;

            itemWrapper.appendChild(image);
            itemWrapper.appendChild(itemTitle);
            itemWrapper.appendChild(buyButton);
            document.getElementById('storeContainer').appendChild(itemWrapper);
          }
          document.getElementById('storeContainer').style.display = 'flex';
        })
        .catch(function (error) {
          console.log('getCatalogAsync error', error);
        });
    });
  }

  function purchaseAsync(productID) {
    FBInstant.payments
      .purchaseAsync({
        productID,
        developerPayload: '{customPayload: 1234}',
      })
      .then(function (purchase) {
        console.log('purchaseAsync success', purchase);
      })
      .catch(function (error) {
        console.log('purchaseAsync error', error);
      });
  }

  function showPurchases() {
    FBInstant.payments
      .getPurchasesAsync()
      .then(function (purchases) {
        console.log('getPurchasesAsync success', purchases);
        for (let i = 0; i < purchases.length; i++) {
          const itemWrapper = getPurchaseDetails(purchases[i], i);
          document.getElementById('historyContainer').appendChild(itemWrapper);
        }
      })
      .catch(function (error) {
        console.log('getPurchasesAsync error', error);
      });
  }

  function showAvatarExpressions() {
    const values = Object.values(FBInstant.avatarExpressions.AvatarExpressionEnums);
    const randomIndex = Math.floor(Math.random() * values.length);
    const randomTemplate = values[randomIndex];

    FBInstant.avatarExpressions.getAvatarExpressionsAsync([
      randomTemplate
    ]).then(function (uri_by_template) {
      console.log("Avatar expression URI fetched:", uri_by_template);
      const uri = uri_by_template.get(randomTemplate);
      if (uri == null) {
        console.log('Avatar expression not fetched');
        return;
      }

      const img = document.createElement("img");
      img.src = uri;
      img.width = 200;
      img.height = 200;
      img.style = 'width: 100%; height: auto; object-fit: contain;';
      document.getElementById('avatarExpressionContainer').appendChild(img);
    }).catch(function (error) {
      console.log('getAvatarExpressionsAsync error', error);
    });
  }

  function getPurchaseDetails(item, index) {
    const buttons = [];

    if (!item.isConsumed) {
      const consumeButton = document.createElement('button');
      consumeButton.innerHTML = 'Consume';
      consumeButton.onclick = function () {
        consumePurchaseAsync(item.purchaseToken);
      };
      consumeButton.className = 'historyItemButton';
      buttons.push(consumeButton);
    }

    const details = [
      [addDetail, 'isConsumed'],
      [addDetail, 'purchasePlatform'],
      [addDetail, 'purchaseToken'],
      [addDetail, 'paymentActionType'],
      [addDateDetail, 'purchaseTime'],
    ];

    return getItemDetails(index, item, details, buttons);
  }

  function getItemDetails(index, item, details, buttons) {
    const body = document.createElement('div');
    body.className = 'historyItem';
    body.id = 'purchased' + index;

    const rowOne = getRow();
    body.appendChild(rowOne);

    const itemTitle = document.createElement('div');
    itemTitle.innerHTML = item.productID;
    itemTitle.className = 'historyItemTitle';
    rowOne.appendChild(itemTitle);

    for (const button of buttons) {
      rowOne.appendChild(button);
    }

    const toggleDetails = document.createElement('button');
    toggleDetails.innerHTML = 'Toggle Details';
    toggleDetails.onclick = function () {
      document.getElementById(innerDetails.id).classList.toggle('hidden');
    };
    toggleDetails.className = 'historyItemButton';
    rowOne.appendChild(toggleDetails);

    const rowTwo = getColumn();
    body.appendChild(rowTwo);

    const innerDetails = document.createElement('div');
    innerDetails.className = 'historyItemDetails';
    innerDetails.classList.add('hidden');
    innerDetails.id = `purchased${index}-details`;
    rowTwo.appendChild(innerDetails);

    for (const info of details) {
      const func = info[0];
      const key = info[1];
      func(innerDetails, key, item[key]);
    }

    return body;
  }

  function addDetail(parentDiv, label, value) {
    const detailRow = document.createElement('div');
    detailRow.innerHTML = label + ': ' + value;
    parentDiv.appendChild(detailRow);
  }

  function consumePurchaseAsync(token) {
    FBInstant.payments
      .consumePurchaseAsync(token)
      .then(function (response) {
        clearOutItems();
        console.log('consumePurchaseAsync success');
      })
      .catch(function (error) {
        console.log('consumePurchaseAsync error', error);
      });
  }

  function clearOutItems() {
    const storeContainer = document.getElementById('storeContainer');
    while (storeContainer.hasChildNodes()) {
      storeContainer.removeChild(storeContainer.lastChild);
    }
    const historyContainer = document.getElementById('historyContainer');
    while (historyContainer.hasChildNodes()) {
      historyContainer.removeChild(historyContainer.lastChild);
    }
  }

  function addDateDetail(parentDiv, label, value) {
    const date = new Date(value * 1000);
    addDetail(parentDiv, label, date);
  }

  function getRow() {
    const row = document.createElement('div');
    row.className = 'row';
    return row;
  }

  function getColumn() {
    const row = document.createElement('div');
    row.className = 'column';
    return row;
  }
});
