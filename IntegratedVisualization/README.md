# Integrated Visualization

An interactive web tool that integrates GCI depth plots with LINKVIEW alignment visualization, aligned by genome coordinates.

## Highlights

- GCI depth visualization: upload and render `.depth.gz`/plain depth files.
- LINKVIEW alignment visualization: render genome-to-genome alignments.
- Coordinate-synchronized panels: align depth and alignment panels on the same genomic axes.
- Auxiliary lines: add vertical markers rendered across all panels.
- Configurable parameters: control resolution, panel height, window size, and more.
- PAF auto-normalization: PAF lines are automatically converted to LINKVIEW’s 6-column format.

## Installation

```bash
cd IntegratedVisualization
npm install
```

## Run (Web App)

```bash
npm start
```

Open `http://localhost:3000`.
it looks like: ![web_ui](../images/webUI.png)

## Usage (Web UI)

- Inputs
  - Karyotype: paste or upload karyotype text.
  - Depth data:
    - Global mode: upload HiFi (`depth1`) and optionally Nano (`depth2`).
    - Per-chromosome mode: upload per-chromosome files for HiFi/Nano (A/B groups supported in the UI).
  - Alignment data (required): upload your main alignment file (PAF, BLAST, MUMmer, or LINKVIEW 6-column).
  - Optional PAF files: optionally upload HiFi/Nano PAF files; they will be merged with the main file.

- Alignment normalization
  - PAF lines are automatically converted into LINKVIEW 6-column format: `ctg1 start1 end1 ctg2 start2 end2`.
  - Blank and comment lines (`#`) are ignored; existing 6-column lines are kept.
  - If normalization results in empty content, the app warns you to review input formatting.

- Generate
  - Optionally configure parameters in the sidebar.
  - Click “Generate Visualization”. The SVG renders either in an interactive viewer or as inline SVG.

## CLI (Generate Integrated SVG without Browser)

Two ways to run:
- Direct script: `node IntegratedVisualization/cli/iv-cli.js --out output.svg [flags...]`
- NPM script: `npm run iv-cli -- --out output.svg [flags...]`

Common flags
- `--out` Path to output SVG (required).
- `--karyotype` Path to karyotype file (recommended).
- `--depth1` HiFi depth file (supports `.gz`, `.depth`, `.txt`, single-value-per-line; basic `.bed` lists also accepted when single-value rows).
- `--depth2` Nano depth file (same as above).
- `--paf` PAF alignment file (repeatable).
- `--per-chr-json` JSON mapping of per-chromosome files (see example below).
- `--svg-width` Output width, default `1200`.
- `--svg-height` Output height of the alignment panel (excludes depth panels), default `800`.
- Depth parameters (aliases supported):
  - `--gci-window-size` or `--window-size` (default `50000`).
  - `--gci-depth-height` or `--depth-height` (default `150`).
  - `--gci-depth-min` or `--min-safe-depth` (default `0.1` relative threshold).
  - `--gci-depth-max` or `--max-depth-ratio` (default `4.0` relative ceiling).
  - `--depth-axis-ticks` (default `5`).
  - `--depth-axis-font-size` (default `12`).
  - `--panel-gap` (gap between alignment and depth panels).
  - `--top-margin` (top margin for layout).

Examples

1) Karyotype + HiFi depth only (renders depth panels + empty alignment):
```bash
node IntegratedVisualization/cli/iv-cli.js \
  --out out.svg \
  --karyotype example/karyotype.txt \
  --depth1 example/hifi.depth.gz
```

2) Karyotype + two depth files + alignments (full integrated figure):
```bash
node IntegratedVisualization/cli/iv-cli.js \
  --out out.svg \
  --karyotype example/karyotype.txt \
  --depth1 example/hifi.depth.gz \
  --depth2 example/nano.depth.gz \
  --paf example/hifi.paf \
  --paf example/nano.paf
```

3) Per-chromosome mapping (JSON):
```json
{
  "chr1": {
    "hifiDepth": "data/chr1.hifi.depth.gz",
    "nanoDepth": "data/chr1.nano.depth.gz",
    "hifiPaf": "data/chr1.hifi.paf",
    "nanoPaf": "data/chr1.nano.paf"
  },
  "chr2": { "hifiDepth": "data/chr2.hifi.depth.gz" }
}
```
Run:
```bash
node IntegratedVisualization/cli/iv-cli.js \
  --out out.svg \
  --karyotype example/karyotype.txt \
  --per-chr-json example/mapping.json
```

Note: The depth parser expects “one depth value per line” GCI format. Interval-style `.bed` files require conversion to density series before use.

## Minimal Example & Demo Script

Place your test files under `example/` at the repository root. Example run (produces `images/integrated_output.svg`):
```bash
node IntegratedVisualization/cli/iv-cli.js \
  --out images/integrated_output.svg \
  --karyotype example/karyotype.txt \
  --depth1 example/hifi.depth.txt \
  --depth2 example/nano.depth.txt \
  --alignments example/alignments.txt
```

## Build

```bash
npm run build
```

## Dependencies

- React 17
- Ant Design 4
- LINKVIEW Core (local dependency)
- pako (gzip support)

## Developer Notes

- The CLI auto-detects gzip by magic bytes and supports both plain text and `.gz`.
- Depth panels are aligned to LINKVIEW output using karyotype layout; supports symmetric rendering for HiFi/Nano.
- Web UI and CLI both normalize PAF input to 6-column LINKVIEW format and log normalization statistics.

