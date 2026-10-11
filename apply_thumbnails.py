import os
import re

def update_figure(fig_match):
    fig_text = fig_match.group(0)

    # Find the img src
    img_src_match = re.search(r'<img\s+src="(\./src/img/(?!thumbnails/)[^"]+)"', fig_text)
    if not img_src_match:
        return fig_text

    orig_src = img_src_match.group(1)
    base_no_ext = os.path.splitext(orig_src)[0]
    thumb_src = base_no_ext.replace("./src/img/", "./src/img/thumbnails/") + ".webp"

    # Verify physical file existence
    local_path = thumb_src.replace("./", "").replace("/", os.sep)
    if not os.path.exists(local_path):
        print(f"Warning: {local_path} not found!")

    # 1. Replace <img src="{orig_src}" specifically
    fig_text = re.sub(
        r'<img\s+src="' + re.escape(orig_src) + r'"',
        f'<img src="{thumb_src}"',
        fig_text,
        count=1
    )

    # 2. Add data-lightbox and data-full-src to opening <figure> tag
    def add_attrs_to_figure(tag_m):
        tag_text = tag_m.group(0)
        if "data-lightbox" in tag_text:
            return tag_text
        return tag_text[:-1] + f' data-lightbox data-full-src="{orig_src}">'

    fig_text = re.sub(r'<figure\b[^>]*>', add_attrs_to_figure, fig_text, count=1)

    return fig_text

def update_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    fig_pattern = re.compile(r'<figure\b[^>]*class="[^"]*(?:preview-card|memory-card)[^"]*"[^>]*>[\s\S]*?</figure>')

    matches = list(fig_pattern.finditer(content))
    print(f"Found {len(matches)} figure cards in {file_path}")

    new_content = fig_pattern.sub(update_figure, content)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"Successfully updated {file_path}!")

if __name__ == "__main__":
    update_file("index.html")
    update_file("memories.html")
