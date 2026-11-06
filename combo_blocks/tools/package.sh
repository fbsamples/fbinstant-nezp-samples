#!/bin/bash
# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the license found in the
# LICENSE file in the root directory of this source tree.
#
# Builds combo_blocks.zip, the bundle to upload in the app dashboard.

set -euo pipefail
cd "$(dirname "$0")/.."
rm -f combo_blocks.zip
zip -r combo_blocks.zip \
  index.html style.css main.js fbapp-config.json \
  src data overlays \
  -x '*.DS_Store'
echo "Built $(pwd)/combo_blocks.zip"
