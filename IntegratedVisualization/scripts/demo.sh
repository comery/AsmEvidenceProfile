#!/usr/bin/env bash
set -euo pipefail

# 运行最小示例，输出到 examples/out.svg
DIR=$(cd "$(dirname "$0")/.."; pwd)
node "$DIR/cli/iv-cli.js" \
  --out "$DIR/examples/out.svg" \
  --karyotype "$DIR/examples/karyotype.txt" \
  --depth1 "$DIR/examples/hifi.depth.txt" \
  --depth2 "$DIR/examples/nano.depth.txt" \
  --alignments "$DIR/examples/alignments.txt"

echo "示例已生成：$DIR/examples/out.svg"