import os
import sys
from PIL import Image, ImageOps

TARGET_MAX_SIZE = (600, 600)
WEBP_QUALITY = 82

SOURCE_SUBDIRS = [
    os.path.join("src", "img", "Foto kenangan kita"),
    os.path.join("src", "img", "Foto Rere & Uti"),
    os.path.join("src", "img", "Foto Uti"),
]

THUMBNAILS_ROOT = os.path.join("src", "img", "thumbnails")

def process_image(src_path, dst_path):
    try:
        with Image.open(src_path) as img:
            # Handle EXIF orientation
            img = ImageOps.exif_transpose(img)
            orig_w, orig_h = img.size

            # Preserve aspect ratio, max 600x600, no upscale
            thumb_img = img.copy()
            if orig_w > TARGET_MAX_SIZE[0] or orig_h > TARGET_MAX_SIZE[1]:
                thumb_img.thumbnail(TARGET_MAX_SIZE, Image.Resampling.LANCZOS)
            thumb_w, thumb_h = thumb_img.size

            # Handle color modes for WebP
            if thumb_img.mode in ("RGBA", "LA"):
                pass  # RGBA is fine for WebP
            elif thumb_img.mode == "P":
                if "transparency" in thumb_img.info:
                    thumb_img = thumb_img.convert("RGBA")
                else:
                    thumb_img = thumb_img.convert("RGB")
            elif thumb_img.mode != "RGB":
                thumb_img = thumb_img.convert("RGB")

            os.makedirs(os.path.dirname(dst_path), exist_ok=True)
            thumb_img.save(dst_path, "WEBP", quality=WEBP_QUALITY, method=6)

            orig_size = os.path.getsize(src_path)
            thumb_size = os.path.getsize(dst_path)

            return {
                "src": src_path,
                "dst": dst_path,
                "orig_w": orig_w,
                "orig_h": orig_h,
                "thumb_w": thumb_w,
                "thumb_h": thumb_h,
                "orig_size": orig_size,
                "thumb_size": thumb_size,
                "status": "success"
            }
    except Exception as e:
        return {
            "src": src_path,
            "dst": dst_path,
            "status": "error",
            "error": str(e)
        }

def run():
    print("=== Memulai Pembuatan Thumbnail Fisik Otomatis ===")
    results = []

    for subdir in SOURCE_SUBDIRS:
        if not os.path.exists(subdir):
            print(f"Peringatan: Direktori sumber {subdir} tidak ditemukan.")
            continue

        rel_sub = os.path.relpath(subdir, os.path.join("src", "img"))
        target_dir = os.path.join(THUMBNAILS_ROOT, rel_sub)

        for filename in sorted(os.listdir(subdir)):
            lower_name = filename.lower()
            if not lower_name.endswith((".png", ".jpg", ".jpeg", ".webp")):
                continue

            src_file = os.path.join(subdir, filename)
            base_name = os.path.splitext(filename)[0]
            dst_file = os.path.join(target_dir, f"{base_name}.webp")

            res = process_image(src_file, dst_file)
            results.append(res)

    success_count = sum(1 for r in results if r["status"] == "success")
    error_count = sum(1 for r in results if r["status"] == "error")

    total_orig = sum(r["orig_size"] for r in results if r["status"] == "success")
    total_thumb = sum(r["thumb_size"] for r in results if r["status"] == "success")
    saved_bytes = total_orig - total_thumb
    pct_reduction = (saved_bytes / total_orig * 100) if total_orig > 0 else 0

    print(f"\nTotal gambar diproses: {len(results)}")
    print(f"Berhasil: {success_count} | Gagal: {error_count}")
    print(f"Ukuran asli total   : {total_orig / (1024*1024):.2f} MB")
    print(f"Ukuran thumbnail    : {total_thumb / (1024*1024):.2f} MB")
    print(f"Penghematan data    : {saved_bytes / (1024*1024):.2f} MB ({pct_reduction:.1f}% pengurangan)")

    print("\nContoh Perbandingan Dimensi (Landscape, Portrait, Square):")
    landscape_samples = [r for r in results if r.get("orig_w", 0) > r.get("orig_h", 0)]
    portrait_samples = [r for r in results if r.get("orig_h", 0) > r.get("orig_w", 0)]
    square_samples = [r for r in results if r.get("orig_w", 0) == r.get("orig_h", 0)]

    if landscape_samples:
        s = landscape_samples[0]
        print(f"- Landscape: {os.path.basename(s['src'])} -> {s['orig_w']}x{s['orig_h']} ({s['orig_size']/1024:.1f} KB) ==> {s['thumb_w']}x{s['thumb_h']} ({s['thumb_size']/1024:.1f} KB)")
    if portrait_samples:
        s = portrait_samples[0]
        print(f"- Portrait : {os.path.basename(s['src'])} -> {s['orig_w']}x{s['orig_h']} ({s['orig_size']/1024:.1f} KB) ==> {s['thumb_w']}x{s['thumb_h']} ({s['thumb_size']/1024:.1f} KB)")
    if square_samples:
        s = square_samples[0]
        print(f"- Square   : {os.path.basename(s['src'])} -> {s['orig_w']}x{s['orig_h']} ({s['orig_size']/1024:.1f} KB) ==> {s['thumb_w']}x{s['thumb_h']} ({s['thumb_size']/1024:.1f} KB)")

    if error_count > 0:
        print("\nDaftar Error:")
        for r in results:
            if r["status"] == "error":
                print(f"X {r['src']}: {r['error']}")
        sys.exit(1)

if __name__ == "__main__":
    run()
