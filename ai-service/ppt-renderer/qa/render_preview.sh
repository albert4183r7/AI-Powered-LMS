#!/usr/bin/env bash
# render_preview.sh — converts a .pptx into per-slide JPEGs for visual QA.
#
# This is the step that lets a vision-capable model (or a human) actually
# LOOK at what was generated instead of trusting the generation code blind.
# Requires: LibreOffice (soffice) and poppler-utils (pdftoppm) on the host.
#
# Usage:
#   ./render_preview.sh deck.pptx [output_prefix]
#
# Produces: <output_prefix>-1.jpg, <output_prefix>-2.jpg, ...

set -euo pipefail

PPTX="$1"
PREFIX="${2:-slide}"

if [ ! -f "$PPTX" ]; then
  echo "File not found: $PPTX" >&2
  exit 1
fi

BASENAME=$(basename "$PPTX" .pptx)
DIR=$(dirname "$PPTX")

echo "Converting $PPTX to PDF..."
soffice --headless --convert-to pdf --outdir "$DIR" "$PPTX"

echo "Rendering PDF pages to JPEG..."
rm -f "${PREFIX}"-*.jpg
pdftoppm -jpeg -r 150 "$DIR/$BASENAME.pdf" "$PREFIX"

echo "Done. Rendered images:"
ls -1 "${PREFIX}"-*.jpg
