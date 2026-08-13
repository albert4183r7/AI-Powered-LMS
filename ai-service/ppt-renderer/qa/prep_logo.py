#!/usr/bin/env python3
"""
prep_logo.py — strip a baked-in white background from an uploaded logo so
it can be placed on both light AND dark slide backgrounds without showing
a visible white box.

Most logos users upload are flattened PNG/JPG with a white background
baked in, not a real transparent PNG. This does a simple distance-from-white
alpha mattes it out, then crops to the visible bounding box.

Usage:
    python3 prep_logo.py input_logo.png output_logo.png [--threshold 18]
"""
import argparse
import numpy as np
from PIL import Image


def strip_white_background(input_path, output_path, threshold=18, gain=4):
    im = Image.open(input_path).convert("RGBA")
    arr = np.array(im)
    r, g, b = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int)

    # "distance" from pure white per pixel — higher means less white,
    # i.e. more likely to be actual logo content rather than background.
    dist = (255 - r) + (255 - g) + (255 - b)
    dist = np.clip(dist - threshold, 0, None)  # ignore near-white noise/anti-aliasing
    alpha = np.clip(dist * gain, 0, 255).astype(np.uint8)
    arr[:, :, 3] = alpha

    out = Image.fromarray(arr, "RGBA")
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    out.save(output_path)
    print(f"Saved {output_path} ({out.size[0]}x{out.size[1]})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--threshold", type=int, default=18,
                         help="Higher = more aggressive white removal. Raise if edges look hazy.")
    parser.add_argument("--gain", type=int, default=4,
                         help="How quickly alpha ramps from transparent to opaque.")
    args = parser.parse_args()
    strip_white_background(args.input, args.output, args.threshold, args.gain)
