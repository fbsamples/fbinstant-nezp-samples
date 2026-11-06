/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {MAX_TILES} from './words.js';

const REASON_TEXT = {
  too_short: 'Use at least 2 blocks',
  repeat_tile: 'Each block once per word',
  not_a_word: 'Not a word',
  already_found: 'Already found',
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text != null) {
    node.textContent = text;
  }
  return node;
}

/**
 * Renders the grid and the word tray into `root`. `submit(indices)` checks a
 * word and returns the result of checkWord.
 */
export function createBoard(root, tiles, submit) {
  root.replaceChildren();
  const grid = el('div', 'grid');
  const tray = el('div', 'tray');
  const trayTiles = el('div', 'tray-tiles');
  const clearButton = el('button', 'tray-button', 'Clear');
  const submitButton = el('button', 'tray-button primary', 'Submit');
  const popup = el('div', 'popup');
  tray.append(trayTiles, clearButton, submitButton);
  root.append(grid, tray, popup);

  let selected = [];
  let enabled = false;

  const tileButtons = tiles.map((tile, index) => {
    const button = el('button', 'tile', tile.text.toUpperCase());
    button.style.background = tile.color;
    button.addEventListener('click', () => toggle(index));
    grid.append(button);
    return button;
  });

  function render() {
    tileButtons.forEach((button, index) =>
      button.classList.toggle('selected', selected.includes(index)),
    );
    trayTiles.replaceChildren(
      ...selected.map(index => {
        const chip = el('button', 'tile small', tiles[index].text.toUpperCase());
        chip.style.background = tiles[index].color;
        chip.addEventListener('click', () => toggle(index));
        return chip;
      }),
    );
    submitButton.disabled = !enabled || selected.length < 2;
  }

  function toggle(index) {
    if (!enabled) {
      return;
    }
    if (selected.includes(index)) {
      selected = selected.filter(i => i !== index);
    } else if (selected.length < MAX_TILES) {
      selected = [...selected, index];
    }
    render();
  }

  function showPopup(title, value, good) {
    popup.replaceChildren(el('div', 'popup-title', title), el('div', 'popup-value', value));
    popup.classList.toggle('bad', !good);
    popup.classList.remove('show');
    void popup.offsetWidth;
    popup.classList.add('show');
  }

  clearButton.addEventListener('click', () => {
    selected = [];
    render();
  });
  submitButton.addEventListener('click', () => {
    const result = submit(selected);
    if (result.ok) {
      showPopup(
        `${result.tileCount} blocks${result.rare ? ' · rare!' : ''}`,
        `+${result.points}`,
        true,
      );
    } else {
      showPopup(REASON_TEXT[result.reason] ?? 'Try again', '✕', false);
    }
    selected = [];
    render();
  });

  render();
  return {
    setEnabled(value) {
      enabled = value;
      if (!value) {
        selected = [];
      }
      render();
    },
  };
}
