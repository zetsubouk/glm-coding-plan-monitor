#!/usr/bin/env python
"""Generate GLM Coding Plan monitor extension icons (rounded square + gauge arc)."""
import os
from PIL import Image, ImageDraw

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def make_icon(size):
    scale = size / 128.0
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # rounded square background (indigo)
    pad = int(6 * scale)
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=int(28 * scale),
                        fill=(63, 81, 181, 255))
    cx = cy = size / 2
    r = int(40 * scale)
    lw = int(11 * scale)
    bbox = [cx - r, cy - r, cx + r, cy + r]
    # background ring (open at bottom)
    d.arc(bbox, start=160, end=20, fill=(255, 255, 255, 60), width=lw)
    # progress arc ~62% (yellow)
    d.arc(bbox, start=160, end=160 + (260 * 0.62), fill=(255, 214, 0, 255), width=lw)
    # center dot
    dr = int(5 * scale)
    d.ellipse([cx - dr, cy - dr, cx + dr, cy + dr], fill=(255, 255, 255, 255))
    return img

for s in (16, 32, 48, 128):
    make_icon(s).save(os.path.join(BASE, "icons", f"icon{s}.png"))
    print("wrote", s)