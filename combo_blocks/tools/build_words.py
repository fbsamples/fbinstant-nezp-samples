#!/usr/bin/env python3
# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the license found in the
# LICENSE file in the root directory of this source tree.

"""Builds data/words.json and data/seeds.json for Combo Blocks.

Run from fbsource root:
  PYTHONPATH=third-party/pypi/pyphen/0.15.0/sources \
    python3 fbcode/games/instant_games/nezp-samples/combo_blocks/tools/build_words.py

Words and frequencies come from the AOSP LatinIME en_US word list
(Apache-2.0). Syllable splits come from pyphen's en_US hyphenation patterns,
used only at build time.
"""

import gzip
import json
import os
import re
import sys

import pyphen

FBSOURCE = os.path.abspath(os.path.join(os.path.dirname(__file__), *[".."] * 6))
WORDLIST = os.path.join(
    FBSOURCE, "third-party/LatinIME/dictionaries/en_US_wordlist.combined.gz"
)
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

WORD_PATTERN = re.compile(r"[a-z]{3,16}")
EXCLUDED_FLAGS = {"offensive", "abbreviation", "babytalk"}
# LatinIME f is 0-255; on lowercase words the 25th percentile is about 25.
RARE_BELOW = 25
SEED_AT_LEAST = 80
MIN_CHUNKS, MAX_CHUNKS = 2, 4
MAX_CHUNK_LEN = 4
VOWEL = re.compile(r"[aeiouy]")


def read_words():
    words = {}
    with gzip.open(WORDLIST, "rt", encoding="utf-8") as f:
        for line in f:
            if not line.startswith(" word="):
                continue
            fields = dict(kv.split("=", 1) for kv in line.strip().split(","))
            word = fields["word"]
            freq = int(fields["f"])
            if (
                freq == 0
                or fields.get("flags", "") in EXCLUDED_FLAGS
                or not WORD_PATTERN.fullmatch(word)
            ):
                continue
            words[word] = max(freq, words.get(word, 0))
    return words


def split_word(dic, word):
    chunks = dic.inserted(word).split("-")
    if not (MIN_CHUNKS <= len(chunks) <= MAX_CHUNKS):
        return None
    if any(len(c) > MAX_CHUNK_LEN or not VOWEL.search(c) for c in chunks):
        return None
    return chunks


def main():
    words = read_words()
    dic = pyphen.Pyphen(lang="en_US", left=2, right=2)

    all_words = sorted(words)
    rare = sorted(w for w, f in words.items() if f < RARE_BELOW)
    seeds = []
    for word in all_words:
        if words[word] < SEED_AT_LEAST or len(word) < 4:
            continue
        chunks = split_word(dic, word)
        if chunks is not None:
            seeds.append(chunks)

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, "words.json"), "w") as f:
        json.dump({"words": " ".join(all_words), "rare": " ".join(rare)}, f)
    with open(os.path.join(OUT_DIR, "seeds.json"), "w") as f:
        json.dump(seeds, f, separators=(",", ":"))

    by_len = {n: sum(1 for s in seeds if len(s) == n) for n in range(2, 5)}
    print(
        f"words={len(all_words)} rare={len(rare)} seeds={len(seeds)} "
        f"seeds_by_chunks={by_len}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
