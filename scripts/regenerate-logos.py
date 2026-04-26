#!/usr/bin/env python3
"""Regenerate RestoSuite logo PNGs (and JPG) from client/assets/logo-icon.svg.

Sources of truth:
  client/assets/logo-icon.svg          → transparent variant (navy stroke + navy R)
  client/assets/logo-icon-light.svg    → filled-navy variant (cream R) — used for dark/PWA tiles

Run:
  /opt/homebrew/bin/python3.13 scripts/regenerate-logos.py
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

import cairosvg  # type: ignore
from PIL import Image  # type: ignore

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "client" / "assets"

NAVY = "#1B2A4A"
CREAM = "#F5EFE6"
ORANGE = "#C45A18"

# Transparent variant (navy on transparent — for light backgrounds & favicons)
SVG_TRANSPARENT = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="RestoSuite">
  <title>RestoSuite</title>
  <path d="M 100 14 C 148 14 186 54 185 101 C 186 147 147 186 100 185 C 53 186 14 148 15 100 C 14 53 53 16 100 14 Z"
        fill="none" stroke="{NAVY}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="100" y="148" font-family="'Fraunces','Georgia','Times New Roman',serif" font-size="150" font-weight="600"
        fill="{NAVY}" text-anchor="middle">R</text>
  <circle cx="142" cy="150" r="7" fill="{ORANGE}"/>
</svg>
"""

# Navy-background variant (cream R + cream stroke — for dark/PWA tiles, JPEG)
SVG_NAVY = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="RestoSuite">
  <title>RestoSuite</title>
  <rect width="200" height="200" fill="{NAVY}"/>
  <path d="M 100 14 C 148 14 186 54 185 101 C 186 147 147 186 100 185 C 53 186 14 148 15 100 C 14 53 53 16 100 14 Z"
        fill="none" stroke="{CREAM}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="100" y="148" font-family="'Fraunces','Georgia','Times New Roman',serif" font-size="150" font-weight="600"
        fill="{CREAM}" text-anchor="middle">R</text>
  <circle cx="142" cy="150" r="7" fill="{ORANGE}"/>
</svg>
"""


def render_png(svg: str, size: int, out: Path) -> None:
    cairosvg.svg2png(
        bytestring=svg.encode("utf-8"),
        write_to=str(out),
        output_width=size,
        output_height=size,
    )
    print(f"  wrote {out.name:30s} {size}x{size}  {out.stat().st_size:>7} bytes")


def render_jpg(svg: str, size: int, out: Path, quality: int = 92) -> None:
    png_bytes = cairosvg.svg2png(
        bytestring=svg.encode("utf-8"),
        output_width=size,
        output_height=size,
    )
    img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    img.save(out, format="JPEG", quality=quality, optimize=True)
    print(f"  wrote {out.name:30s} {size}x{size}  {out.stat().st_size:>7} bytes")


def main() -> int:
    if not ASSETS.is_dir():
        print(f"ERROR: assets dir not found: {ASSETS}", file=sys.stderr)
        return 1

    print(f"Writing into {ASSETS}\n")

    print("Transparent variants (light backgrounds):")
    render_png(SVG_TRANSPARENT, 32, ASSETS / "favicon.png")
    render_png(SVG_TRANSPARENT, 180, ASSETS / "apple-touch-icon.png")
    render_png(SVG_TRANSPARENT, 192, ASSETS / "icon-192.png")
    render_png(SVG_TRANSPARENT, 128, ASSETS / "logo-128.png")
    render_png(SVG_TRANSPARENT, 512, ASSETS / "logo.png")

    print("\nNavy-background variants (PWA tiles, JPEG):")
    render_png(SVG_NAVY, 512, ASSETS / "icon-512.png")
    render_png(SVG_NAVY, 512, ASSETS / "logo-512.png")
    render_jpg(SVG_NAVY, 512, ASSETS / "logo.jpg")

    print("\ndone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
