"""Convert all EPS portrait files in 司法大観/画像/Links/{A..G}/ to JPG under
scripts/out/past_photos_jpg/{A..G}/.

Prerequisites:
  pip install Pillow
  Install Ghostscript (https://ghostscript.com/releases/gsdnld.html) and ensure
  gswin64c.exe (or gs) is on PATH. Pillow's EPS reader shells out to Ghostscript.

Usage:
  python scripts/convert_eps_to_jpg.py            # convert all
  python scripts/convert_eps_to_jpg.py --limit 10 # convert only first 10 (smoke test)
  python scripts/convert_eps_to_jpg.py --force    # overwrite existing jpgs
"""
from __future__ import annotations
import os, sys, glob, argparse, time
from PIL import Image

SRC = os.path.join(
    r"C:\Users\ishij\Documents\GitHub\shihotaikan",
    "司法大観", "画像", "Links",
)
DST = os.path.join(
    r"C:\Users\ishij\Documents\GitHub\shihotaikan",
    "scripts", "out", "past_photos_jpg",
)
JPG_QUALITY = 85
TARGET_HEIGHT = 600  # px — sufficient for web preview, keeps Storage small

def convert_one(src_path: str, dst_path: str) -> tuple[bool, str]:
    try:
        with Image.open(src_path) as im:
            # EPS needs scale set BEFORE load to control rasterization resolution.
            # Default EPS DPI is 100; bump to ~300 for quality.
            im.load(scale=3)
            im = im.convert("L")  # grayscale; printed Taikan is monochrome
            w, h = im.size
            if h > TARGET_HEIGHT:
                new_w = int(w * TARGET_HEIGHT / h)
                im = im.resize((new_w, TARGET_HEIGHT), Image.LANCZOS)
            os.makedirs(os.path.dirname(dst_path), exist_ok=True)
            im.save(dst_path, "JPEG", quality=JPG_QUALITY, optimize=True)
        return True, ""
    except Exception as e:
        return False, str(e)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0,
                    help="convert only the first N files (0=all)")
    ap.add_argument("--force", action="store_true",
                    help="overwrite existing jpgs")
    args = ap.parse_args()

    sys.stdout.reconfigure(encoding="utf-8")

    # Collect tasks
    tasks = []
    for prefix in ["A", "B", "C", "D", "E", "F", "G"]:
        for src in sorted(glob.glob(os.path.join(SRC, prefix, "*.eps"))):
            stem = os.path.splitext(os.path.basename(src))[0]
            dst = os.path.join(DST, prefix, f"{stem}.jpg")
            if os.path.exists(dst) and not args.force:
                continue
            tasks.append((src, dst, prefix, stem))

    if args.limit:
        tasks = tasks[: args.limit]

    print(f"Converting {len(tasks)} EPS files → {DST}")
    if not tasks:
        print("Nothing to do.")
        return

    t0 = time.time()
    ok = fail = 0
    for i, (src, dst, prefix, stem) in enumerate(tasks, 1):
        success, err = convert_one(src, dst)
        if success:
            ok += 1
        else:
            fail += 1
            print(f"  FAIL {prefix}/{stem}: {err}")
        if i % 100 == 0 or i == len(tasks):
            elapsed = time.time() - t0
            rate = i / elapsed if elapsed else 0
            remain = (len(tasks) - i) / rate if rate else 0
            print(f"  [{i}/{len(tasks)}] ok={ok} fail={fail} "
                  f"rate={rate:.1f}/s ETA={remain/60:.1f}min")

    print(f"DONE in {(time.time() - t0)/60:.1f} min  ok={ok} fail={fail}")
    print(f"Output: {DST}")


if __name__ == "__main__":
    main()
