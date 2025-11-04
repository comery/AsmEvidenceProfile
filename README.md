# AsmEvidenceProfile
An interactive tool for visualization of assembly coverage and synteny

## Overview
AsmEvidenceProfile provides visual evidence for genome assemblies by combining depth coverage and alignment synteny. It supports:
- Static integrated outputs (SVG/PDF) that merge LINKVIEW alignment layouts with HiFi/ONT depth panels.
- An interactive React frontend for exploring examples and building custom views.

## Key Modules
- `static/integrated_montage.py`: Integrates LINKVIEW’s chromosome layout with HiFi/ONT depth panels into a single SVG/PDF.
- `static/depth_plotter_v2.py`: Sliding‑window statistics, zero/low‑depth region detection, and plotting utilities.
- `static/LINKVIEW.py`: Generates the intermediate SVG alignment layout.
- `IntegratedVisualization/`: React frontend for interactive visualization and example assets.
- `GCI/utility/`: Helper scripts for depth calculation, filtering, and plotting.

## Quick Start (Static Montage)
Prepare `alignments.txt`, `sequence.fa.fai`, `hifi.depth.gz`, `nano.depth.gz` (optional `karyotype.txt`), then run:
```
python3 static/integrated_montage.py alignments.txt -t 3 -r sequence.fa.fai \
  --hifi hifi.depth.gz --nano nano.depth.gz -k karyotype.txt -w 1000 \
  --top_margin 60 --debug_margin -o data/integrated_output
```
Output: `data/integrated_output.svg`. Set `--output_format pdf` to export PDF.

## Dependencies
- Python 3.8+ and `numpy`. For PDF export, install `cairosvg` or ensure `inkscape` CLI is available.

## License
See the root `LICENSE` file.
