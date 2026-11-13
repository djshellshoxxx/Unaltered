#!/usr/bin/env python3
"""Independent third-party decoding of Unaltered archival QR certificates (opt-in test tool).

Decoder: zxing-cpp (Apache-2.0), a C++ QR implementation unrelated to the app's jsQR worker.
Reassembly: scripts/recover-archival-qr.py (Python stdlib reference, no Unaltered TypeScript).
Rasteriser: the system `pdftoppm` binary, run as an external program.

Commands (all print one JSON object on stdout):
  recover-pdf --pdf CERT.pdf --original RECEIPT.ots [--dpi 150] [--work DIR]
      Rasterise every page, decode every QR symbol with zxing-cpp, reassemble the raw byte payloads
      with the reference recoverer and compare with the original receipt byte for byte.
  decode-images IMAGE...
      Decode PNG/JPEG page images and report the archival frames found (index, size, version, ECC, mask).

Requires: pip install --require-hashes --no-deps -r tests/archival/requirements.txt
"""
import argparse
import hashlib
import importlib.metadata
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
MAGIC = b"UOTSQR01"

try:
    import zxingcpp  # noqa: E402  (optional, test-only)
    from PIL import Image  # noqa: E402  (optional, test-only)
except ImportError as error:  # pragma: no cover - reported to the caller
    zxingcpp = None
    Image = None
    IMPORT_ERROR = str(error)
else:
    IMPORT_ERROR = ""


def decoder_version() -> str:
    try:
        return "zxing-cpp " + importlib.metadata.version("zxing-cpp")
    except importlib.metadata.PackageNotFoundError:
        return "zxing-cpp (unknown version)"


def available() -> bool:
    return zxingcpp is not None and Image is not None


def reference_recover():
    spec = importlib.util.spec_from_file_location("archival_reference", ROOT / "scripts/recover-archival-qr.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.recover


def rasterize(pdf: Path, dpi: int, out_dir: Path, prefix: str = "page") -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(["pdftoppm", "-r", str(dpi), "-png", str(pdf), str(out_dir / prefix)], check=True)
    pages = sorted(out_dir.glob(f"{prefix}-*.png"), key=lambda p: int(p.stem.rsplit("-", 1)[1]))
    if not pages:
        raise RuntimeError("pdftoppm produced no pages")
    return pages


def decode_image(image) -> list[dict]:
    """Decode every QR symbol in a PIL image (or path). Raw byte-mode payloads are kept as bytes."""
    if not available():
        raise RuntimeError("zxing-cpp/Pillow not installed: " + IMPORT_ERROR)
    if not isinstance(image, Image.Image):
        with Image.open(image) as opened:
            image = opened.convert("L")
    elif image.mode != "L":
        image = image.convert("L")
    found = []
    for result in zxingcpp.read_barcodes(image, formats=zxingcpp.BarcodeFormat.QRCode):
        if not result.valid:
            continue
        extra = result.extra or {}
        p = result.position
        found.append({
            "bytes": bytes(result.bytes),
            "version": int(extra.get("Version", 0)),
            "ec": str(extra.get("ECLevel", result.ec_level)),
            "mask": int(extra.get("DataMask", -1)),
            "corners": [[p.top_left.x, p.top_left.y], [p.top_right.x, p.top_right.y],
                        [p.bottom_right.x, p.bottom_right.y], [p.bottom_left.x, p.bottom_left.y]],
        })
    return found


def archival_frames(symbols: list[dict]) -> list[dict]:
    return [s for s in symbols if s["bytes"][:8] == MAGIC]


def frame_index(frame: bytes) -> int:
    return int.from_bytes(frame[28:32], "big")


def recover_frames(frames: list[bytes]) -> bytes:
    return reference_recover()(frames)


def summarize(symbol: dict) -> dict:
    frame = symbol["bytes"]
    return {"index": frame_index(frame), "bytes": len(frame), "version": symbol["version"],
            "ec": symbol["ec"], "mask": symbol["mask"]}


def cmd_recover_pdf(args) -> int:
    original = args.original.read_bytes()
    with tempfile.TemporaryDirectory() as tmp:
        work = args.work or Path(tmp)
        pages = rasterize(args.pdf, args.dpi, work)
        symbols, per_page = [], []
        for page in pages:
            found = archival_frames(decode_image(page))
            per_page.append(len(found))
            symbols.extend(found)
    report = {"decoder": decoder_version(),
              "dpi": args.dpi, "pages": len(pages), "symbols_per_page": per_page,
              "symbols": sorted((summarize(s) for s in symbols), key=lambda s: s["index"])}
    try:
        receipt = recover_frames([s["bytes"] for s in symbols])
        report.update(recovered=True, identical=receipt == original,
                      recovered_sha256=hashlib.sha256(receipt).hexdigest())
    except ValueError as error:
        report.update(recovered=False, identical=False, error=str(error))
    report["original_sha256"] = hashlib.sha256(original).hexdigest()
    print(json.dumps(report))
    return 0 if report["identical"] else 1


def cmd_decode_images(args) -> int:
    out = []
    for path in args.images:
        out.append({"image": path.name, "frames": [summarize(s) for s in archival_frames(decode_image(path))]})
    print(json.dumps({"images": out}))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    rec = sub.add_parser("recover-pdf")
    rec.add_argument("--pdf", type=Path, required=True)
    rec.add_argument("--original", type=Path, required=True)
    rec.add_argument("--dpi", type=int, default=150)
    rec.add_argument("--work", type=Path)
    dec = sub.add_parser("decode-images")
    dec.add_argument("images", nargs="+", type=Path)
    sub.add_parser("probe")
    args = parser.parse_args()
    if args.command == "probe":
        print(json.dumps({"available": available(), "error": IMPORT_ERROR,
                          "decoder": decoder_version() if zxingcpp else None}))
        return 0 if available() else 3
    if not available():
        print(json.dumps({"error": "zxing-cpp/Pillow not installed: " + IMPORT_ERROR}))
        return 3
    return cmd_recover_pdf(args) if args.command == "recover-pdf" else cmd_decode_images(args)


if __name__ == "__main__":
    sys.exit(main())
