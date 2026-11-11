#!/usr/bin/env python3
"""Deterministic camera-like distortion corpus for printed archival QR certificates (opt-in test tool).

Usage:
  qr_distort.py generate --pdf CERT.pdf --original RECEIPT.ots --out DIR [--seed 20261111] [--axes a,b]
      Rasterise the certificate pages that carry QR symbols, write seeded distorted variants of every
      such page to DIR/<variant>/page-N.(png|jpg), decode every variant with zxing-cpp, reassemble with
      the Python reference recoverer, and write DIR/manifest.json (variants, files, zxing results).
  qr_distort.py to-ppm IMAGE OUT.ppm
      Decode an image with Pillow and write binary RGB PPM (for the jsQR diagnostic path in Node).

Images are synthetic test data derived from synthetic receipts. They are regenerated on demand and are never
committed. Only this generator and the compact results JSON are kept in Git.
Axes: rotation, perspective, blur, jpeg, gamma, lighting, contrast, dpi, occlusion, camera (combined).
Requires Pillow and zxing-cpp (tests/archival/requirements.txt) plus the system pdftoppm binary.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import random
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import zxing_qr  # noqa: E402

from PIL import Image, ImageDraw, ImageFilter  # noqa: E402

BASE_DPI = 150
AXES = ("rotation", "perspective", "blur", "jpeg", "gamma", "lighting", "contrast", "dpi", "occlusion", "camera")


def perspective_coeffs(dst: list[tuple[float, float]], src: list[tuple[float, float]]) -> list[float]:
    """Coefficients for Image.transform(PERSPECTIVE): maps output (dst) points to input (src) points."""
    rows, rhs = [], []
    for (x, y), (u, v) in zip(dst, src):
        rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); rhs.append(u)
        rows.append([0, 0, 0, x, y, 1, -v * x, -v * y]); rhs.append(v)
    n = 8
    m = [row[:] + [b] for row, b in zip(rows, rhs)]
    for col in range(n):  # Gaussian elimination with partial pivoting
        pivot = max(range(col, n), key=lambda r: abs(m[r][col]))
        m[col], m[pivot] = m[pivot], m[col]
        for r in range(n):
            if r != col and m[r][col]:
                f = m[r][col] / m[col][col]
                m[r] = [a - f * b for a, b in zip(m[r], m[col])]
    return [m[i][n] / m[i][i] for i in range(n)]


def rotate(img: Image.Image, degrees: float) -> Image.Image:
    return img.rotate(degrees, resample=Image.Resampling.BICUBIC, expand=True, fillcolor=255)


def perspective(img: Image.Image, strength: float, rng: random.Random) -> Image.Image:
    """Camera tilt: the far edge shrinks by `strength` of the width, plus seeded corner jitter."""
    w, h = img.size
    pad = int(max(w, h) * strength) + 8
    canvas = Image.new("L", (w + 2 * pad, h + 2 * pad), 255)
    canvas.paste(img, (pad, pad))
    W, H = canvas.size
    src = [(pad, pad), (pad + w, pad), (pad + w, pad + h), (pad, pad + h)]
    inset = strength * w / 2
    jitter = lambda: rng.uniform(-0.25, 0.25) * strength * w  # noqa: E731
    top_is_far = rng.random() < 0.5
    dst = [(pad + (inset if top_is_far else 0) + jitter(), pad + jitter()),
           (pad + w - (inset if top_is_far else 0) + jitter(), pad + jitter()),
           (pad + w - (0 if top_is_far else inset) + jitter(), pad + h + jitter()),
           (pad + (0 if top_is_far else inset) + jitter(), pad + h + jitter())]
    coeffs = perspective_coeffs(dst, src)
    return canvas.transform((W, H), Image.Transform.PERSPECTIVE, coeffs, Image.Resampling.BICUBIC, fillcolor=255)


def blur(img: Image.Image, radius: float) -> Image.Image:
    return img.filter(ImageFilter.GaussianBlur(radius))


def gamma(img: Image.Image, g: float) -> Image.Image:
    return img.point([round(255 * (v / 255) ** g) for v in range(256)])


def lighting(img: Image.Image, darkest: float, rng: random.Random) -> Image.Image:
    """Uneven illumination: linear falloff in a seeded direction times a soft vignette, down to `darkest`."""
    w, h = img.size
    angle = rng.uniform(0, 2 * math.pi)
    dx, dy = math.cos(angle), math.sin(angle)
    small_w, small_h = 64, max(2, round(64 * h / w))
    field = Image.new("L", (small_w, small_h))
    px = field.load()
    corners = [(0, 0), (1, 0), (0, 1), (1, 1)]
    proj = [cx * dx + cy * dy for cx, cy in corners]
    lo, hi = min(proj), max(proj)
    for y in range(small_h):
        for x in range(small_w):
            fx, fy = x / (small_w - 1), y / (small_h - 1)
            t = ((fx * dx + fy * dy) - lo) / (hi - lo)
            vignette = 1 - 0.35 * ((fx - 0.5) ** 2 + (fy - 0.5) ** 2) / 0.5
            level = (1 - (1 - darkest) * t) * (darkest + (1 - darkest) * vignette)
            px[x, y] = max(0, min(255, round(255 * level)))
    field = field.resize((w, h), Image.Resampling.BICUBIC)
    from PIL import ImageChops
    return ImageChops.multiply(img, field)


def contrast(img: Image.Image, ink: int, paper: int) -> Image.Image:
    return img.point([round(ink + (paper - ink) * v / 255) for v in range(256)])


def occlude(img: Image.Image, symbol_corners: list[list[float]], fraction: float, rng: random.Random) -> Image.Image:
    """One opaque blot covering `fraction` of one symbol's area, placed inside the symbol away from
    the three finder patterns (a stain or torn patch on the data region)."""
    xs = [p[0] for p in symbol_corners]; ys = [p[1] for p in symbol_corners]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    side = math.sqrt(fraction) * (x1 - x0)
    margin = 0.22 * (x1 - x0)  # finder patterns occupy about 7/(4v+17)+separator of each corner
    lo_x, hi_x = x0 + margin, max(x0 + margin, x1 - margin - side)
    lo_y, hi_y = y0 + margin, max(y0 + margin, y1 - margin - side)
    left = rng.uniform(lo_x, hi_x) if hi_x > lo_x else (x0 + x1 - side) / 2
    top = rng.uniform(lo_y, hi_y) if hi_y > lo_y else (y0 + y1 - side) / 2
    out = img.copy()
    ImageDraw.Draw(out).rectangle([left, top, left + side, top + side], fill=0)
    return out


def resample(img: Image.Image, from_dpi: int, to_dpi: float) -> Image.Image:
    w, h = img.size
    return img.resize((max(21, round(w * to_dpi / from_dpi)), max(21, round(h * to_dpi / from_dpi))),
                      Image.Resampling.LANCZOS)


def variants(seed: int):
    """(axis, parameter label, recipe) in a fixed order. Tens per axis, not thousands."""
    for d in range(0, 11):
        yield "rotation", f"{d}deg", {"rotate": d}
    for s in (0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.15, 0.20):
        yield "perspective", f"{s:.2f}", {"perspective": s}
    for r in (0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0):
        yield "blur", f"r{r}px", {"blur": r}
    for q in (30, 40, 50, 60, 70, 80, 90):
        yield "jpeg", f"q{q}", {"jpeg": q, "pre_blur": 0.6}
    for g in (0.3, 0.5, 0.7, 1.5, 2.2, 3.0):
        yield "gamma", f"g{g}", {"gamma": g}
    for m in (0.85, 0.7, 0.55, 0.4, 0.3, 0.2):
        yield "lighting", f"min{m}", {"lighting": m}
    for ink, paper in ((64, 255), (112, 255), (160, 255), (192, 255), (112, 200), (160, 210)):
        yield "contrast", f"ink{ink}-paper{paper}", {"contrast": [ink, paper]}
    for dpi in (100, 120, 150, 200, 250, 300):
        yield "dpi", f"{dpi}dpi", {"dpi": dpi}
    for f in (0.02, 0.05, 0.08, 0.12, 0.16, 0.20, 0.25, 0.30):
        yield "occlusion", f"{round(f * 100)}pct", {"occlude": f}
    rng = random.Random(seed)
    for i in range(10):
        yield "camera", f"c{i}", {
            "dpi": 300, "rotate": round(rng.uniform(-6, 6), 2), "perspective": round(rng.uniform(0.02, 0.08), 3),
            "lighting": round(rng.uniform(0.5, 0.85), 2), "blur": round(rng.uniform(0.6, 1.6), 2),
            "resample": round(rng.uniform(120, 200)), "jpeg": rng.randrange(55, 90)}


def apply(recipe: dict, page: Image.Image, page_dpi: int, rng: random.Random, symbols: list[dict], occlude_page: bool):
    img = page
    if "occlude" in recipe and occlude_page and symbols:
        img = occlude(img, symbols[0]["corners"], recipe["occlude"], rng)
    if "contrast" in recipe:
        img = contrast(img, *recipe["contrast"])
    if "gamma" in recipe:
        img = gamma(img, recipe["gamma"])
    if "perspective" in recipe:
        img = perspective(img, recipe["perspective"], rng)
    if "rotate" in recipe and recipe["rotate"]:
        img = rotate(img, recipe["rotate"])
    if "lighting" in recipe:
        img = lighting(img, recipe["lighting"], rng)
    if "blur" in recipe:
        img = blur(img, recipe["blur"])
    if "pre_blur" in recipe:
        img = blur(img, recipe["pre_blur"])
    if "resample" in recipe:
        img = resample(img, page_dpi, recipe["resample"])
    return img


def cmd_generate(args) -> int:
    original = args.original.read_bytes()
    out = args.out
    out.mkdir(parents=True, exist_ok=True)
    wanted = set(args.axes.split(",")) if args.axes else set(AXES)
    rasters: dict[int, list[Path]] = {}

    def pages_at(dpi: int) -> list[Path]:
        if dpi not in rasters:
            rasters[dpi] = zxing_qr.rasterize(args.pdf, dpi, out / "_raster", f"r{dpi}")
        return rasters[dpi]

    # Pages with QR symbols, located once on the clean base raster (the appendix carries none).
    base_symbols = [zxing_qr.archival_frames(zxing_qr.decode_image(p)) for p in pages_at(BASE_DPI)]
    qr_pages = [i for i, found in enumerate(base_symbols) if found]
    expected = sum(len(found) for found in base_symbols)
    manifest = {"pdf_sha256": hashlib.sha256(args.pdf.read_bytes()).hexdigest(), "seed": args.seed,
                "original_bytes": len(original), "original_sha256": hashlib.sha256(original).hexdigest(),
                "qr_pages": [i + 1 for i in qr_pages], "expected_symbols": expected,
                "decoder": zxing_qr.decoder_version(), "variants": []}
    recover = zxing_qr.reference_recover()
    for number, (axis, label, recipe) in enumerate([("clean", "150dpi", {})] + list(variants(args.seed))):
        if axis != "clean" and axis not in wanted:
            continue
        vid = f"{axis}-{label}"
        rng = random.Random(f"{args.seed}/{vid}")
        dpi = recipe.get("dpi", BASE_DPI)
        vdir = out / vid
        vdir.mkdir(exist_ok=True)
        files, found = [], []
        for n, page_index in enumerate(qr_pages):
            with Image.open(pages_at(dpi)[page_index]) as opened:
                page = opened.convert("L")
            symbols = base_symbols[page_index]
            if dpi != BASE_DPI:
                scale = dpi / BASE_DPI
                symbols = [{**s, "corners": [[x * scale, y * scale] for x, y in s["corners"]]} for s in symbols]
            img = apply(recipe, page, dpi, rng, symbols, occlude_page=(n == 0))
            if "jpeg" in recipe:
                path = vdir / f"page-{page_index + 1}.jpg"
                img.convert("RGB").save(path, "JPEG", quality=recipe["jpeg"], optimize=False)
            else:
                path = vdir / f"page-{page_index + 1}.png"
                img.save(path, "PNG", compress_level=6)
            files.append(path.name)
            found.extend(zxing_qr.archival_frames(zxing_qr.decode_image(path)))
        unique = {s["bytes"] for s in found}
        try:
            receipt = recover([s["bytes"] for s in found]) if found else None
            ok = receipt == original
        except ValueError:
            ok = False
        with Image.open(vdir / files[0]) as first:
            size = list(first.size)
        manifest["variants"].append({"id": vid, "axis": axis, "param": label, "recipe": recipe, "dir": vid,
                                     "files": files, "first_page_px": size,
                                     "zxing": {"symbols": len(unique), "recovered": ok}})
        print(f"{number:3d} {vid:28s} zxing {len(unique)}/{expected} {'OK' if ok else '--'}", file=sys.stderr)
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n")
    print(json.dumps({"variants": len(manifest["variants"]), "manifest": str(out / "manifest.json")}))
    return 0


def cmd_to_ppm(args) -> int:
    with Image.open(args.image) as opened:
        rgb = opened.convert("RGB")
    rgb.save(args.out, "PPM")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    gen = sub.add_parser("generate")
    gen.add_argument("--pdf", type=Path, required=True)
    gen.add_argument("--original", type=Path, required=True)
    gen.add_argument("--out", type=Path, required=True)
    gen.add_argument("--seed", type=int, default=20261111)
    gen.add_argument("--axes", default="")
    ppm = sub.add_parser("to-ppm")
    ppm.add_argument("image", type=Path)
    ppm.add_argument("out", type=Path)
    args = parser.parse_args()
    return cmd_generate(args) if args.command == "generate" else cmd_to_ppm(args)


if __name__ == "__main__":
    sys.exit(main())
