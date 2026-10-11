# UTI 23 — Birthday Experience

This project is a lightweight, static birthday experience built around the supplied assets in `src/` and the original Nailong GLB model at the workspace root.

## Asset audit
- Audio: `src/aud/Happy-Birthday-lofi_007_128k.mp3`
- Photos: all 36 supplied images from `src/img/Foto Uti` and `src/img/Foto kenangan kita` appear in the Memories masonry; the homepage uses a five-photo editorial selection
- Nailong stickers: 17 transparent PNGs in `src/Stiker`; four unique assets are selectively placed as six floating decorations across Home and Memories, separate from the galleries
- Videos: all six source clips in `src/vid/Video uti` and `src/vid/Video kenangan kita` appear in Memories with native controls and frame-derived posters in `src/vid/posters/`
- Asset inventory: `documentation/asset-inventory.csv` lists the original photos, stickers, videos, and generated posters with paths, dimensions, aspect ratios, usage, and checksums
- Original 3D model backup: `Nailong 3D.glb` at the project root
- Homepage 3D model: `src/models/nailong-optimized.glb`
- Optimization experiments: `src/models/optimization-stages/`

## Structure
- `index.html` — beranda
- `memories.html` — album kenangan
- `jar.html` — toples pesan interaktif
- `letter.html` — surat ulang tahun
- `finale.html` — ucapan penutup
- `styles.css` — global styling and responsive design
- `script.js` — music controls, homepage scene, and Jar interactions

## Notes
- The interface uses warm Indonesian copy without inventing personal history.
- The shared navigation swaps the existing static page shells in one document and updates browser history. The single background-audio element therefore keeps playing and retains its volume/mute state between in-app routes.
- Direct URLs and refreshes still load the standalone HTML pages. A full document load starts music paused until the visitor presses Play, as required by browser autoplay policy; file-URL or navigation-fetch failures fall back to ordinary page loads.
- Finale's Replay music restarts the shared track at 00:00 without creating another audio element.
- The homepage loads the Meshopt-compressed Nailong GLB through Three.js `GLTFLoader` and `MeshoptDecoder`; it keeps a visible fallback if the model fails.
- The Jar has 30 Indonesian reminders grouped by theme. Each cycle shuffles without repeats; the supplied assets include no separate shake sound, and the picked note is revealed only after its paper is opened.
- Music plays through one shared audio element during in-page navigation. Direct loads start paused until the visitor presses Play, as required by browser autoplay policy.
- Jar browser QA screenshots are `jar-qa-desktop.png` and `jar-qa-mobile.png`.
- The optimized GLB retains the original mesh/material/UV layout and JPEG appearance, uses 50% mesh simplification with a 0.001 error limit, 14-bit position / 10-bit normal / 12-bit UV quantization, and the original 4K JPEG resized to 2K. The original GLB is unchanged.
- Retained stages: `nailong-meshopt.glb` (compression only), `nailong-simplified-50.glb` (simplification only), `nailong-meshopt-simplified-50.glb` (compressed geometry), `nailong-final-2048.glb` (2K texture stage before recompression), and `nailong-optimized.glb` (integrated result).
- Visual comparison captures are named `qa-model-original-{desktop,mobile}.png` and `qa-model-optimized-{desktop,mobile}.png`.

| Stage | File size | Triangles | Base-color JPEG |
| --- | ---: | ---: | --- |
| Original backup | 42,912,760 bytes | 1,450,962 | 4096×4096, 1,688,707 bytes |
| Meshopt only | 8,669,808 bytes | 1,450,962 | 4096×4096, unchanged |
| Simplification only | 22,557,800 bytes | 725,480 | 4096×4096, unchanged |
| Simplification + Meshopt | 5,385,960 bytes | 725,480 | 4096×4096, unchanged |
| Integrated optimization | 3,922,364 bytes | 725,480 | 2048×2048, 231,610 bytes |
- Music begins only after user interaction, per browser autoplay rules.
