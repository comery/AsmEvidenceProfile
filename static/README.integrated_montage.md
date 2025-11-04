# Integrated Montage (LINKVIEW + Depth)

Integrated montage is a standalone Python script that stitches together:
- LINKVIEW chromosome alignment layout (as SVG), and
- windowed depth panels for HiFi and ONT reads (top/bottom),

into a single, publication‑ready SVG or PDF, aligned by chromosome coordinates.

The script lives at `static/integrated_montage.py` and reuses logic from `static/LINKVIEW.py` and `static/depth_plotter_v2.py`.

## Features
- Aligns depth bars directly to LINKVIEW’s per‑chromosome tracks.
- HiFi depth plotted above the axis; ONT depth plotted below, sharing a common baseline.
- Zero/low depth regions highlighted in the background.
- Auto‑relocates LINKVIEW’s scale bar to avoid overlapping the depth panels.
- Enforces a top padding (`--top_margin`) across the whole composition; `--debug_margin` can visualize it.
- Outputs either a single `*.svg` or `*.pdf` file and optionally keeps the intermediate LINKVIEW SVG (`--keep_tmp`).

## Dependencies
- Python 3.8+ recommended.
- Required: `numpy`.
- Optional (for saving figures in some environments): `matplotlib` (depth plotting logic does not require it for SVG assembly).
- PDF export: `cairosvg` (preferred) or `inkscape` CLI.

## Inputs
- LINKVIEW alignment file: `input` (same format expected by `static/LINKVIEW.py`).
- Reference index: `--fai` (FAI file for coordinate ranges).
- Depth files (supports `.gz`):
  - HiFi: `--hifi` (or per‑chromosome `--hifi_a`, `--hifi_b`).
  - ONT/Nano: `--nano` (or per‑chromosome `--nano_a`, `--nano_b`).
- Optional karyotype: `--karyotype` to pick two sequences and optionally ranges like `chrA:start:end`.

## Output
- Default: `integrated_output.svg` in the current directory.
- If `--output_format pdf` is set, attempts to produce `integrated_output.pdf` and removes the intermediate SVG on success.
- Use `--keep_tmp` to retain the intermediate LINKVIEW SVG (`<output>.__linkview_tmp.svg`).

## Quick Start

```bash
python3 static/integrated_montage.py \
  IntegratedVisualization/examples/alignments.txt -t 3 -k IntegratedVisualization/examples/karyotype.txt \
  --svg_width 1600 --svg_space 0.15 \
  --hifi IntegratedVisualization/examples/hifi.normal.depth.txt \
  --nano IntegratedVisualization/examples/nano.normal.depth.txt \
  --fai IntegratedVisualization/examples/sequence.fa.fai \
  -w 1000 --max-depth-ratio 3.0 --min-safe-depth 5 \
  --depth_height 160 --top_margin 60 --debug_margin \
  -o data/integrated_output
```

This generates `data/integrated_output.svg`. Open it directly in a browser or a vector editor.

## Key Options

- LINKVIEW options (forwarded):
  - `input`, `-t/--type`, `-k/--karyotype`, `--svg_height`, `--svg_width`, `--svg_space`, `--no_dash`, `--chro_thickness`, `-n/--no_label`, `--label_font_size`, `--label_angle`, `--chro_axis`, `--chro_axis_density`, `-s/--show_pos_with_label`, `--scale`, `--scale_y_ratio`, `--no_scale`, `--min_identity`, `--min_alignment_length`, `--max_evalue`, `--min_bit_score`, `--gap_length`, `--chro_len`, `-p/--parameter`, `-g/--gff`, `--bezier`, `--style`.
  - Note: the script may adjust `--scale_y_ratio` automatically to avoid overlap with depth panels.

- Depth options:
  - `-r/--fai`: reference index (required).
  - `--hifi`, `--nano`: depth files (supports `.gz`).
  - Per‑chromosome: `--hifi_a`, `--nano_a`, `--hifi_b`, `--nano_b` to avoid reparsing when sequences differ.
  - `-w/--window-size`: sliding window length (default 1000).
  - `--max-depth-ratio`: vertical clamp relative to dataset average (default 3.0).
  - `--min-safe-depth`: threshold for “low depth” background (default 5).

- Layout and axis:
  - `--depth_height`: height of each half panel (default 160).
  - `--panel_gap`: gap between panels (default 10% of `depth_height`).
  - `--top_margin`: extra padding above the top depth panel (pixels; default 40). Use this if top looks “flush”.
  - `--debug_margin`: draw a semi‑transparent rectangle for the top margin and a dashed line at its bottom.
  - `--depth_axis_ticks`: number of ticks (default 5).
  - `--depth_axis_font_size`: axis label font size (default 12).

- Output control:
  - `-o/--output`: output file prefix (default `integrated_output`).
  - `--output_format`: `svg` or `pdf` (default `svg`).
  - `--keep_tmp`: keep the intermediate LINKVIEW SVG (default off).

## Behavior Details
- Depth windows are computed per dataset; zero/low depth regions are highlighted using upper/lower half spans.
- HiFi bars are plotted above the baseline; ONT bars are plotted below. Mean lines are optional and drawn as dashed lines.
- A shared vertical cap is used so the visual heights are comparable between datasets.
- Axis labels reflect karyotype ranges when provided; otherwise they span the full depth length.
- The script enforces a global top margin when `--top_margin` is set and translates the LINKVIEW group accordingly. Use `--debug_margin` to verify visually.
- If LINKVIEW’s scale bar overlaps depth panels, the script tries alternative vertical ratios automatically.

## Examples
- Basic two‑chromosome montage:
  ```bash
  python3 static/integrated_montage.py input.align -t 3 -r ref.fai --hifi hifi.depth.gz --nano ont.depth.gz -o out
  ```

- Restrict to ranges via karyotype:
  ```
  chrA:100000:900000
  chrB:200000:800000
  ```
  ```bash
  python3 static/integrated_montage.py input.align -t 3 -k karyotype.txt -r ref.fai --hifi hifi.depth.gz --nano ont.depth.gz -o out
  ```

- Increase top padding and visualize it:
  ```bash
  python3 static/integrated_montage.py input.align -t 3 -r ref.fai --hifi hifi.depth.gz --nano ont.depth.gz \
    --top_margin 120 --debug_margin -o out
  ```

- Generate PDF (requires cairosvg or inkscape):
  ```bash
  python3 static/integrated_montage.py input.align -t 3 -r ref.fai --hifi hifi.depth.gz --nano ont.depth.gz \
    --output_format pdf -o out
  ```

## Troubleshooting
- Top margin looks flush: set `--top_margin` and optionally `--debug_margin`. Open the SVG directly to avoid browser CSS interference.
- Scale bar overlaps depth panels: try setting `--scale_y_ratio` or rely on the script’s automatic relocation.
- Mismatched depths: when both HiFi and ONT are provided, their lengths must match for the same sequence; otherwise supply per‑chromosome files.
- PDF export fails: ensure `cairosvg` is installed; if not, `inkscape` must be available on `$PATH`.

## License
This repository includes its own license file. This script inherits the project’s license terms.