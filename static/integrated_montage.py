#!/usr/bin/env python3
"""
Static integrated plotting script: linearly align GCI depth panels with LINKVIEW
alignment layout by chromosome coordinates and output a single SVG.

References:
- static/depth_plotter.py (reuse window statistics and depth reading)
- static/LINKVIEW.py (generate intermediate alignment SVG and extract contents)

Parameters:
- All original LINKVIEW parameters are preserved and forwarded (input/type/karyotype/...)
- Depth plotting parameters are preserved (--fai/--hifi/--nano/--window-size/--max-depth-ratio/--min-safe-depth)

Usage example:
  python3 static/integrated_montage.py \
    alignments.txt -t 3 -k karyotype.txt --svg_width 1600 --svg_space 0.15 \
    --hifi hifi.depth.gz --nano nano.depth.gz --fai ref.fai -w 1000 \
    -o integrated_output

Output: integrated_output.svg (optionally convertible to PNG)
"""

import argparse
import os
import re
import math
from typing import Dict, List, Tuple

# Import local modules
from depth_plotter import FAIParser, SynchronizedDepthReader, SlidingWindowProcessor, DataProcessor
import LINKVIEW as LV


def _read_file(path: str) -> str:
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def _extract_inner_svg(svg_text: str) -> Tuple[str, int, int]:
    """Extract the inner contents of the LINKVIEW-generated SVG and its width/height."""
    m_w = re.search(r'<svg[^>]*\bwidth="(\d+)"', svg_text)
    m_h = re.search(r'<svg[^>]*\bheight="(\d+)"', svg_text)
    width = int(m_w.group(1)) if m_w else 1200
    height = int(m_h.group(1)) if m_h else 800
    # 去除最外层 <svg> 包裹，保留内部节点
    inner = re.sub(r'^<svg[^>]*>', '', svg_text)
    inner = re.sub(r'</svg>\s*$', '', inner)
    return inner, width, height


def _collect_chro_tracks(inner_svg: str) -> List[Tuple[float, float, float, float]]:
    """Collect chromosome track rectangles (x/y/width/height) from LINKVIEW's inner SVG.
    Return a list sorted by y ascending: tuples of (x_left, y_top, width, height).
    """
    rects = []
    for m in re.finditer(r'<rect[^>]*class="chro"[^>]*>', inner_svg):
        tag = m.group(0)
        def _attr(name, default=0.0):
            mm = re.search(rf'\b{name}="([\d\.]+)"', tag)
            return float(mm.group(1)) if mm else default
        x = _attr('x')
        y = _attr('y')
        w = _attr('width')
        h = _attr('height', 0.0)
        rects.append((x, y, w, h))
    # Cluster by y (same row), take each row's min x and max right edge
    if not rects:
        return []
    rects.sort(key=lambda t: t[1])
    tracks = []
    current_y = None
    x_left = None
    x_right = None
    h_max = 0.0
    for x, y, w, h in rects:
        if current_y is None:
            current_y = y
            x_left = x
            x_right = x + w
            h_max = max(h_max, h)
            continue
        if abs(y - current_y) < 1e-6:
            x_left = min(x_left, x)
            x_right = max(x_right, x + w)
            h_max = max(h_max, h)
        else:
            tracks.append((x_left, current_y, x_right - x_left, h_max if h_max > 0 else 15.0))
            current_y = y
            x_left = x
            x_right = x + w
            h_max = h
    tracks.append((x_left, current_y, x_right - x_left, h_max if h_max > 0 else 15.0))
    return tracks

def _extract_scale_bbox(inner_svg: str) -> Tuple[float, float, float, float]:
    """Parse the scale bar bounding box (scale-bbox) inside LINKVIEW SVG.
    Return (x, y, w, h); return None if not present.
    """
    m = re.search(r'<rect[^>]*class="scale-bbox"[^>]*>', inner_svg)
    if not m:
        return None
    tag = m.group(0)
    def _attr(name, default=0.0):
        mm = re.search(rf'\b{name}="([\d\.]+)"', tag)
        return float(mm.group(1)) if mm else default
    return (_attr('x'), _attr('y'), _attr('width'), _attr('height'))


def _build_depth_polygon(xs: List[float], ys: List[float], baseline_y: float, fill_down: bool) -> str:
    """Build path data for filled curves, supporting upward/downward fill."""
    if not xs:
        return ''
    pts = []
    if fill_down:
        # Curve from left to right, then return to right baseline, close to left baseline
        pts.append(f'M {xs[0]:.2f} {baseline_y:.2f}')
        for x, y in zip(xs, ys):
            pts.append(f'L {x:.2f} {y:.2f}')
        pts.append(f'L {xs[-1]:.2f} {baseline_y:.2f}')
        pts.append(f'L {xs[0]:.2f} {baseline_y:.2f}')
    else:
        # Upward fill: go along the curve, return to right baseline, close
        pts.append(f'M {xs[0]:.2f} {ys[0]:.2f}')
        for x, y in zip(xs[1:], ys[1:]):
            pts.append(f'L {x:.2f} {y:.2f}')
        pts.append(f'L {xs[-1]:.2f} {baseline_y:.2f}')
        pts.append(f'L {xs[0]:.2f} {baseline_y:.2f}')
    pts.append('Z')
    return ' '.join(pts)


def _scale_x_by_length(indexes: List[int], total_length: int, x_left: float, x_right: float) -> List[float]:
    """将索引按总长度线性映射到 [x_left, x_right]，确保首尾精确对齐。
    当 total_length==1 时，调用方应特殊处理（绘制到两端）。
    """
    if not indexes:
        return []
    if total_length <= 1:
        return [x_left for _ in indexes]
    span = x_right - x_left
    return [x_left + (i / (total_length - 1)) * span for i in indexes]


def _scale_y(depths: List[float], mean_depth: float, panel_top: float, panel_height: float, max_ratio: float, up: bool) -> List[float]:
    """Map depths (relative to mean) to pixel coordinates.
    up=True draws upward; False draws downward.
    """
    if mean_depth <= 0:
        mean_depth = 1e-6
    scaled = []
    for d in depths:
        ratio = max(0.0, min(d / mean_depth, max_ratio))
        offset = ratio / max_ratio * panel_height
        y = panel_top + (panel_height - offset) if up else (panel_top + panel_height + offset)
        scaled.append(y)
    return scaled


def run(args: argparse.Namespace):
    # 1) Call LINKVIEW to generate the middle alignment layout (SVG only),
    #    and save to a temporary file prefix
    tmp_prefix = args.output + '.__linkview_tmp'
    lv_args = argparse.Namespace(**{
        'input': args.input,
        'type': args.type,
        'highlight': args.highlight,
        'hl_min1px': args.hl_min1px,
        'karyotype': args.karyotype,
        'svg_height': args.svg_height,
        'svg_width': args.svg_width,
        'svg_space': args.svg_space,
        'no_dash': args.no_dash,
        'chro_thickness': args.chro_thickness,
        'no_label': args.no_label,
        'label_font_size': args.label_font_size,
        'label_angle': args.label_angle,
        'chro_axis': args.chro_axis,
        'chro_axis_density': args.chro_axis_density,
        'show_pos_with_label': args.show_pos_with_label,
        'scale': args.scale,
        'scale_y_ratio': getattr(args, 'scale_y_ratio', 0.9),
        'no_scale': args.no_scale,
        'output': tmp_prefix,
        'min_identity': args.min_identity,
        'min_alignment_length': args.min_alignment_length,
        'max_evalue': args.max_evalue,
        'min_bit_score': args.min_bit_score,
        'gap_length': args.gap_length,
        'chro_len': args.chro_len,
        'parameter': args.parameter,
        'gff': args.gff,
        'bezier': args.bezier,
        'style': args.style,
        'svg2png': 'none',
        'svg2png_dpi': 350,
    })
    # LINKVIEW uses label_angle = 360 - angle; keep consistent here
    if lv_args.label_angle:
        lv_args.label_angle = 360 - float(lv_args.label_angle)
    LV.main(lv_args)
    tmp_svg_path = tmp_prefix + '.svg'
    inner, width, align_height = _extract_inner_svg(_read_file(tmp_svg_path))
    tracks = _collect_chro_tracks(inner)
    if not tracks:
        raise RuntimeError('Failed to identify chromosome tracks in LINKVIEW SVG.')

    # Compute depth panel layout positions, used to test overlap with scale bar bbox
    top_track = tracks[0]
    bottom_track = tracks[1] if len(tracks) > 1 else tracks[0]
    x_left_top, y_top, w_top, h_top = top_track
    x_left_bottom, y_bottom, w_bottom, h_bottom = bottom_track
    x_right_top = x_left_top + w_top
    x_right_bottom = x_left_bottom + w_bottom
    depth_height = args.depth_height
    panel_gap = args.panel_gap if args.panel_gap is not None else max(1, int(round(depth_height * 0.1)))
    block_y_top = y_top - panel_gap - (2 * depth_height)
    block_y_bottom = y_bottom + h_bottom + panel_gap
    global_offset = 0.0
    # If the top combined panel would be negative, shift down to 0
    if block_y_top < 0:
        global_offset = -block_y_top
        block_y_top += global_offset
        block_y_bottom += global_offset
        y_top += global_offset
        y_bottom += global_offset
    # Force an explicit top margin padding for the entire composition
    top_margin = max(0, int(getattr(args, 'top_margin', 0)))
    if top_margin > 0:
        block_y_top += top_margin
        block_y_bottom += top_margin
        y_top += top_margin
        y_bottom += top_margin
        global_offset += top_margin
    middle_y = global_offset

    # Parse the scale bar bbox and test if it overlaps with top/bottom depth panels.
    # If overlapping, try other candidate positions and regenerate LINKVIEW.
    def _overlaps(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2):
        return not (ax2 <= bx1 or bx2 <= ax1 or ay2 <= by1 or by2 <= ay1)
    def _scale_bbox_abs(inner_svg_text: str):
        bbox = _extract_scale_bbox(inner_svg_text)
        if not bbox:
            return None
        sx, sy, sw, sh = bbox
        return (sx, sy + middle_y, sx + sw, sy + sh + middle_y)
    def _depth_rects():
        return [
            (x_left_top, block_y_top, x_right_top, block_y_top + 2 * depth_height),
            (x_left_bottom, block_y_bottom, x_right_bottom, block_y_bottom + 2 * depth_height),
        ]

    # First, quick check whether the default bottom-right position overlaps depth panels
    default_ratio = getattr(lv_args, 'scale_y_ratio', 0.9)
    default_abs_y = middle_y + args.svg_height * float(default_ratio)
    depth_rects = _depth_rects()
    default_hits_depth = (block_y_top <= default_abs_y <= (block_y_top + 2 * depth_height)) or (block_y_bottom <= default_abs_y <= (block_y_bottom + 2 * depth_height))
    if default_hits_depth:
        # Choose a safe vertical position in the lower half of the gap between tracks,
        # prioritizing bottom-right placement
        gap = max(0.0, y_bottom - (y_top + h_top))
        # Select ~75% into the lower half and leave 10px margin to avoid touching bottom
        safe_y = min(y_bottom - 10.0, y_top + h_top + gap * 0.75)
        safe_ratio = max(0.0, min(1.0, safe_y / args.svg_height))
        lv_args.scale_y_ratio = safe_ratio
        LV.main(lv_args)
        inner_new, width_new, align_height_new = _extract_inner_svg(_read_file(tmp_svg_path))
        # If it still overlaps depth panels, try other candidate vertical ratios
        sb_abs_try = _scale_bbox_abs(inner_new)
        if sb_abs_try is not None:
            hit_depth = any(_overlaps(sb_abs_try[0], sb_abs_try[1], sb_abs_try[2], sb_abs_try[3], rx1, ry1, rx2, ry2) for rx1, ry1, rx2, ry2 in depth_rects)
            if hit_depth:
                for ratio in [max(0.0, min(1.0, (y_top + h_top + gap * 0.6) / args.svg_height)),
                              max(0.0, min(1.0, (y_top + h_top + gap * 0.3) / args.svg_height)),
                              0.95]:
                    lv_args.scale_y_ratio = ratio
                    LV.main(lv_args)
                    inner_new2, width_new2, align_height_new2 = _extract_inner_svg(_read_file(tmp_svg_path))
                    sb_abs_new2 = _scale_bbox_abs(inner_new2)
                    if sb_abs_new2 is None:
                        inner_new = inner_new2; align_height_new = align_height_new2; width_new = width_new2
                        break
                    hit2 = any(_overlaps(sb_abs_new2[0], sb_abs_new2[1], sb_abs_new2[2], sb_abs_new2[3], rx1, ry1, rx2, ry2) for rx1, ry1, rx2, ry2 in depth_rects)
                    if not hit2:
                        inner_new = inner_new2; align_height_new = align_height_new2; width_new = width_new2
                        break
        inner = inner_new; align_height = align_height_new; width = width_new
    else:
        # If default does not overlap but parsed bbox overlaps, try candidate positions
        sb_abs = _scale_bbox_abs(inner)
        if sb_abs is not None:
            need_relocate = any(_overlaps(sb_abs[0], sb_abs[1], sb_abs[2], sb_abs[3], rx1, ry1, rx2, ry2) for rx1, ry1, rx2, ry2 in depth_rects)
            if need_relocate:
                for ratio in [0.42, 0.12, 0.95]:
                    lv_args.scale_y_ratio = ratio
                    LV.main(lv_args)
                    inner_new, width_new, align_height_new = _extract_inner_svg(_read_file(tmp_svg_path))
                    sb_abs_new = _scale_bbox_abs(inner_new)
                    if sb_abs_new is None:
                        inner = inner_new; align_height = align_height_new; width = width_new
                        break
                    hit = any(_overlaps(sb_abs_new[0], sb_abs_new[1], sb_abs_new[2], sb_abs_new[3], rx1, ry1, rx2, ry2) for rx1, ry1, rx2, ry2 in depth_rects)
                    if not hit:
                        inner = inner_new; align_height = align_height_new; width = width_new
                        break

    # 2) Read depth for two chromosomes and compute windowed means
    fai_parser = FAIParser(args.fai)
    fai_lengths = fai_parser.parse_fai()

    # If karyotype is not provided, default to the first two FAI sequences;
    # otherwise parse names and ranges
    target_chrs: List[str] = []
    karyotype_regions: Dict[str, Tuple[int, int]] = {}
    if args.karyotype and os.path.exists(args.karyotype):
        with open(args.karyotype, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                token = re.split(r'\s+', line)[0]
                parts = token.split(':')
                base = parts[0]
                target_chrs.append(base)
                if len(parts) == 3:
                    try:
                        start = int(parts[1])
                        end = int(parts[2])
                        # Convert to 0-based closed interval slice: start-1 to end-1
                        karyotype_regions[base] = (max(0, start - 1), max(0, end - 1))
                    except Exception:
                        pass
                if len(target_chrs) >= 2:
                    break
    if len(target_chrs) < 2:
        target_chrs = list(fai_lengths.keys())[:2]

    # Support specifying hifi/ont depth files per chromosome to avoid re-parsing
    chr1 = target_chrs[0] if target_chrs else None
    chr2 = target_chrs[1] if len(target_chrs) > 1 else chr1
    hifi_a = getattr(args, 'hifi_a', None) or args.hifi
    nano_a = getattr(args, 'nano_a', None) or args.nano
    hifi_b = getattr(args, 'hifi_b', None) or args.hifi
    nano_b = getattr(args, 'nano_b', None) or args.nano

    depth_by_chr: Dict[str, Tuple[List[int], List[int]]] = {}
    def _read_one(seq_id: str, hf: str, nf: str):
        if not seq_id:
            return
        reader = SynchronizedDepthReader(
            hifi_file=hf,
            ont_file=nf,
            target_sequences={seq_id},
            regions=None,
        )
        for sid, hifi_depths, ont_depths in reader.read_sequences():
            if sid != seq_id:
                continue
            # If karyotype specifies a range, slice the arrays accordingly
            if sid in karyotype_regions:
                s, e = karyotype_regions[sid]
                s = max(0, s)
                e = min(len(hifi_depths) - 1 if len(hifi_depths) > 0 else e,
                        len(ont_depths) - 1 if len(ont_depths) > 0 else e)
                if len(hifi_depths) > 0:
                    hifi_depths = hifi_depths[s:e+1]
                if len(ont_depths) > 0:
                    ont_depths = ont_depths[s:e+1]
            depth_by_chr[sid] = (hifi_depths.tolist() if hasattr(hifi_depths, 'tolist') else hifi_depths,
                                  ont_depths.tolist() if hasattr(ont_depths, 'tolist') else ont_depths)
    _read_one(chr1, hifi_a, nano_a)
    _read_one(chr2, hifi_b, nano_b)

    # 3) Coordinate mapping: use per-track x range (top/bottom)
    #    If only one track exists, use the same range for top and bottom
    top_track = tracks[0]
    bottom_track = tracks[1] if len(tracks) > 1 else tracks[0]
    x_left_top, y_top, w_top, h_top = top_track
    x_left_bottom, y_bottom, w_bottom, h_bottom = bottom_track
    x_right_top = x_left_top + w_top
    x_right_bottom = x_left_bottom + w_bottom

    # 4) Depth window bars (strictly follow depth_plotter_v2 window stats and split logic)
    sw = SlidingWindowProcessor(window_size=args.window_size)
    # Panel gap defaults to 10% of depth panel height
    depth_height = args.depth_height
    panel_gap = args.panel_gap if args.panel_gap is not None else max(1, int(round(depth_height * 0.1)))
    max_ratio = args.max_depth_ratio

    def build_bars_for_seq(hifi_arr, ont_arr, x_left: float, x_right: float, panel_origin_y: float) -> Tuple[List[str], List[str], List[str], float]:
        # Input can be list or numpy; convert to list
        h = hifi_arr if hifi_arr is not None else []
        n = ont_arr if ont_arr is not None else []
        seq_len = max(len(h) if hasattr(h, '__len__') else 0,
                      len(n) if hasattr(n, '__len__') else 0)
        if seq_len == 0:
            return [], [], [], panel_origin_y + depth_height
        # Compute window statistics (reuse DataProcessor)
        # Background highlights (zero/low depth) following depth_plotter_v2's _plot_depth_regions
        bg_elems = []
        bars_top = []
        bars_bottom = []
        # Compute per-dataset average depths (excluding zeros) and a unified cap for scaling
        nz_h = [v for v in h if v > 0]
        nz_n = [v for v in n if v > 0]
        avg_h_nonzero = (sum(nz_h) / len(nz_h)) if len(nz_h) > 0 else 0.0
        avg_n_nonzero = (sum(nz_n) / len(nz_n)) if len(nz_n) > 0 else 0.0
        cap_h = (avg_h_nonzero * max_ratio) if avg_h_nonzero > 0 else 0.0
        cap_n = (avg_n_nonzero * max_ratio) if avg_n_nonzero > 0 else 0.0
        # Use a shared cap for both halves so their heights are comparable
        global_cap = max(cap_h, cap_n)
        if global_cap <= 0:
            global_cap = 1.0
        baseline_y = panel_origin_y + depth_height

        if len(h) > 0:
            dp_h = DataProcessor('hifi', color='#2ca25f', window_size=args.window_size)
            means_h, starts_h, ends_h = dp_h.calculate_windowed_stats(__import__('numpy').array(h))
            # Region analysis and background rectangles (upper half)
            regions_h = dp_h.analyze_depth_regions(__import__('numpy').array(h), args.min_safe_depth)
            span = x_right - x_left
            for region_type, region_list in regions_h.items():
                cls = 'depth-zero-bg' if region_type == 'zero' else ('depth-low-bg' if region_type == 'low' else None)
                if not cls:
                    continue
                for s, e in region_list:
                    x1 = x_left + (s / max(1, seq_len - 1)) * span
                    x2 = x_left + (e / max(1, seq_len - 1)) * span
                    w_px_bg = max(0.0, x2 - x1)
                    if w_px_bg <= 0:
                        continue
                    bg_elems.append(f'<rect x="{x1:.2f}" y="{(baseline_y - depth_height):.2f}" width="{w_px_bg:.2f}" height="{depth_height:.2f}" class="{cls}"/>')
            # Generate upper-half bars (HiFi)
            for m, s, e in zip(means_h.tolist(), starts_h.tolist(), ends_h.tolist()):
                center = (s + e) / 2.0
                width_bp = (e - s + 1)
                x_center = x_left + (center / max(1, seq_len - 1)) * span
                w_px = span * (width_bp / max(1, seq_len - 1))
                # Clamp bar height to HiFi cap, scale by shared global cap
                hifi_cap = cap_h if cap_h > 0 else global_cap
                m_clamped = min(m, hifi_cap)
                h_px = depth_height * (m_clamped / global_cap)
                x_rect = x_center - w_px / 2.0
                y_rect = baseline_y - h_px
                bars_top.append(f'<rect x="{x_rect:.2f}" y="{y_rect:.2f}" width="{w_px:.2f}" height="{h_px:.2f}" class="depth-top"/>')
            # Mean line (HiFi)
            avg_h = (sum(means_h.tolist()) / len(means_h)) if len(means_h) > 0 else 0.0
            if avg_h > 0:
                avg_h_clamped = min(avg_h, hifi_cap)
                y_mean = baseline_y - depth_height * (avg_h_clamped / global_cap)
                bars_top.append(f'<line x1="{x_left:.2f}" y1="{y_mean:.2f}" x2="{x_right:.2f}" y2="{y_mean:.2f}" class="mean"/>')
        if len(n) > 0:
            dp_n = DataProcessor('ont', color='#3C5488', window_size=args.window_size)
            means_n, starts_n, ends_n = dp_n.calculate_windowed_stats(__import__('numpy').array(n))
            # Region analysis and background rectangles (lower half)
            regions_n = dp_n.analyze_depth_regions(__import__('numpy').array(n), args.min_safe_depth)
            span = x_right - x_left
            for region_type, region_list in regions_n.items():
                cls = 'depth-zero-bg' if region_type == 'zero' else ('depth-low-bg' if region_type == 'low' else None)
                if not cls:
                    continue
                for s, e in region_list:
                    x1 = x_left + (s / max(1, seq_len - 1)) * span
                    x2 = x_left + (e / max(1, seq_len - 1)) * span
                    w_px_bg = max(0.0, x2 - x1)
                    if w_px_bg <= 0:
                        continue
                    bg_elems.append(f'<rect x="{x1:.2f}" y="{baseline_y:.2f}" width="{w_px_bg:.2f}" height="{depth_height:.2f}" class="{cls}"/>')
            for m, s, e in zip(means_n.tolist(), starts_n.tolist(), ends_n.tolist()):
                center = (s + e) / 2.0
                width_bp = (e - s + 1)
                x_center = x_left + (center / max(1, seq_len - 1)) * span
                w_px = span * (width_bp / max(1, seq_len - 1))
                # Clamp bar height to ONT cap, scale by shared global cap
                ont_cap = cap_n if cap_n > 0 else global_cap
                m_clamped = min(m, ont_cap)
                h_px = depth_height * (m_clamped / global_cap)
                x_rect = x_center - w_px / 2.0
                y_rect = baseline_y
                bars_bottom.append(f'<rect x="{x_rect:.2f}" y="{y_rect:.2f}" width="{w_px:.2f}" height="{h_px:.2f}" class="depth-bottom"/>')
            avg_n = (sum(means_n.tolist()) / len(means_n)) if len(means_n) > 0 else 0.0
            if avg_n > 0:
                avg_n_clamped = min(avg_n, ont_cap)
                y_mean = baseline_y + depth_height * (avg_n_clamped / global_cap)
                bars_bottom.append(f'<line x1="{x_left:.2f}" y1="{y_mean:.2f}" x2="{x_right:.2f}" y2="{y_mean:.2f}" class="mean"/>')
        return bg_elems, bars_top, bars_bottom, baseline_y

    # Row-anchored layout: top depth panels above the top track; bottom depth panels below the bottom track
    block_y_top = y_top - panel_gap - (2 * depth_height)
    block_y_bottom = y_bottom + h_bottom + panel_gap
    # If the top panel would start at a negative y, shift everything down
    global_offset = 0.0
    if block_y_top < 0:
        global_offset = -block_y_top
        block_y_top += global_offset
        block_y_bottom += global_offset
        y_top += global_offset
        y_bottom += global_offset
    # Enforce explicit top margin padding for the entire composition
    top_margin = max(0, int(getattr(args, 'top_margin', 0)))
    if top_margin > 0:
        block_y_top += top_margin
        block_y_bottom += top_margin
        y_top += top_margin
        y_bottom += top_margin
        global_offset += top_margin
    # Translate alignment contents as a whole to keep track alignment
    middle_y = global_offset

    hifi1, nano1 = depth_by_chr.get(chr1, ([], []))
    hifi2, nano2 = depth_by_chr.get(chr2, ([], []))

    # Axis label range (1-based): prefer karyotype ranges, otherwise use depth array length
    def _axis_labels(seq_id: str, h_arr, n_arr):
        if seq_id in karyotype_regions:
            s0, e0 = karyotype_regions[seq_id]
            return (s0 + 1, e0 + 1)
        L = max(len(h_arr) if hasattr(h_arr, '__len__') else 0,
                len(n_arr) if hasattr(n_arr, '__len__') else 0)
        return (1, L if L > 0 else 1)
    label1_start, label1_end = _axis_labels(chr1, hifi1, nano1)
    label2_start, label2_end = _axis_labels(chr2, hifi2, nano2)

    # For each combined panel: draw HiFi bars above and ONT bars below (share same origin)
    bg_1, bars_top_1, bars_bottom_1, baseline1_y = build_bars_for_seq(hifi1, nano1, x_left_top, x_right_top, block_y_top)
    bg_2, bars_top_2, bars_bottom_2, baseline2_y = build_bars_for_seq(hifi2, nano2, x_left_bottom, x_right_bottom, block_y_bottom)

    # 5) Assemble final SVG
    # Total height equals max(alignment bottom, bottom combined panel bottom) + bottom margin
    inner_bottom = middle_y + align_height
    bottom_block_bottom = block_y_bottom + (2 * depth_height)
    total_height = max(inner_bottom, bottom_block_bottom) + panel_gap
    styles = '''<defs><style>
        .depth-top { fill: #2ca25f; opacity: 0.85; }
        .depth-bottom { fill: #3C5488; opacity: 0.85; }
        .baseline { stroke: #555; stroke-width: 1px; }
        .axis-tick { stroke: #555; stroke-width: 1px; }
        .axis-label { fill: #222; text-anchor: middle; dominant-baseline: central; }
        .mean { stroke: #cc3333; stroke-width: 1.2px; stroke-dasharray: 6 4; }
        .depth-zero-bg { fill: #FAD7DD; opacity: 0.8; }
        .depth-low-bg { fill: #B7DBEA; opacity: 0.8; }
        /* bar rectangles reuse depth-top/depth-bottom fill */
    </style></defs>'''

    # Mean lines (optional) — could be added individually in the future

    svg_parts = [f'<svg width="{width}" height="{int(total_height)}" xmlns="http://www.w3.org/2000/svg" version="1.1">']
    svg_parts.append(styles)
    # Debug: visualize the enforced top margin if requested
    if getattr(args, 'debug_margin', False) and top_margin > 0:
        svg_parts.append(f'<rect x="0" y="0" width="{width}" height="{top_margin}" fill="#ffecec" fill-opacity="0.25"/>')
        svg_parts.append(f'<line x1="0" y1="{top_margin}" x2="{width}" y2="{top_margin}" stroke="#ff4d4f" stroke-dasharray="4,4" stroke-width="1"/>')
    # Top combined depth panels (HiFi + ONT)
    # Draw background first, then bars
    svg_parts.extend(bg_1)
    svg_parts.extend(bars_top_1)
    svg_parts.extend(bars_bottom_1)
    # Axis baseline located at the split between the two halves
    svg_parts.append(f'<line x1="{x_left_top:.2f}" y1="{baseline1_y:.2f}" x2="{x_right_top:.2f}" y2="{baseline1_y:.2f}" class="baseline"/>')
    # Axis ticks and labels (top: labels above the axis)
    def _axis_ticks(xl, xr, y, ls, le, above: bool):
        elems = []
        tick_n = max(2, int(getattr(args, 'depth_axis_ticks', 5)))
        span = xr - xl
        for i in range(tick_n + 1):
            x = xl + span * (i / tick_n)
            # Tick line
            tick_h = 6
            y1 = y - (tick_h if above else 0)
            y2 = y + (0 if above else tick_h)
            elems.append(f'<line x1="{x:.2f}" y1="{y1:.2f}" x2="{x:.2f}" y2="{y2:.2f}" class="axis-tick"/>')
            # Label
            val = int(round(ls + (le - ls) * (i / tick_n)))
            dy = -10 if above else 18
            font_size = getattr(args, 'depth_axis_font_size', 12)
            elems.append(f'<text x="{x:.2f}" y="{(y + dy):.2f}" class="axis-label" font-size="{font_size}">{val}</text>')
        return elems
    svg_parts.extend(_axis_ticks(x_left_top, x_right_top, baseline1_y, label1_start, label1_end, above=True))

    # Middle LINKVIEW contents (translate by global_offset)
    svg_parts.append(f'<g transform="translate(0,{middle_y:.2f})">{inner}</g>')

    # Bottom combined depth panels (HiFi + ONT)
    svg_parts.extend(bg_2)
    svg_parts.extend(bars_top_2)
    svg_parts.extend(bars_bottom_2)
    svg_parts.append(f'<line x1="{x_left_bottom:.2f}" y1="{baseline2_y:.2f}" x2="{x_right_bottom:.2f}" y2="{baseline2_y:.2f}" class="baseline"/>')
    # Bottom: labels below the axis
    svg_parts.extend(_axis_ticks(x_left_bottom, x_right_bottom, baseline2_y, label2_start, label2_end, above=False))

    svg_parts.append('</svg>')
    svg_text = '\n'.join(svg_parts)

    out_svg = args.output + '.svg'
    with open(out_svg, 'w', encoding='utf-8') as fo:
        fo.write(svg_text)

    # Keep only one output file: svg or pdf
    if args.output_format == 'pdf':
        converted = False
        try:
            import cairosvg
            cairosvg.svg2pdf(bytestring=svg_text.encode('utf-8'), write_to=args.output + '.pdf')
            converted = True
        except Exception:
            try:
                exit_code = os.system(f'inkscape --file {out_svg} --export-type=pdf --export-filename {args.output}.pdf')
                converted = (exit_code == 0)
            except Exception:
                converted = False
        if converted:
            try:
                os.remove(out_svg)
            except Exception:
                pass
        else:
            print('warning: pdf conversion failed, keeping SVG output')

    # Clean up LINKVIEW temporary artifacts
    if not args.keep_tmp:
        try:
            os.remove(tmp_svg_path)
        except Exception:
            pass


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description='Static montage integrating GCI depth and LINKVIEW alignments (SVG)')
    # —— LINKVIEW original parameters ——
    p.add_argument('input', help='LINKVIEW input alignment file')
    p.add_argument('-t','--type', default=0, type=int)
    p.add_argument('-hl','--highlight')
    p.add_argument('--hl_min1px', action='store_true')
    p.add_argument('-k','--karyotype')
    p.add_argument('--svg_height', default=800, type=int)
    p.add_argument('--svg_width', default=1200, type=int)
    p.add_argument('--svg_space', default=0.2, type=float)
    p.add_argument('--no_dash', action='store_true')
    p.add_argument('--chro_thickness', default=15, type=int)
    p.add_argument('-n','--no_label', action='store_true')
    p.add_argument('--label_font_size', default=18, type=int)
    p.add_argument('--label_angle', default=0, type=int)
    p.add_argument('--chro_axis', action='store_true')
    p.add_argument('--chro_axis_density', default=2, type=int)
    p.add_argument('-s','--show_pos_with_label', action='store_true')
    p.add_argument('--scale')
    p.add_argument('--scale_y_ratio', default=0.9, type=float, help='LINKVIEW scale bar vertical position (relative to SVG height 0-1), default 0.9')
    p.add_argument('--no_scale', action='store_true')
    p.add_argument('-o','--output', default='integrated_output', type=str)
    p.add_argument('--min_identity', default=95, type=float)
    p.add_argument('--min_alignment_length', default=200, type=int)
    p.add_argument('--max_evalue', default=1e-5, type=float)
    p.add_argument('--min_bit_score', default=5000, type=float)
    p.add_argument('--gap_length', default=0.2, type=float)
    p.add_argument('--chro_len')
    p.add_argument('-p','--parameter')
    p.add_argument('-g','--gff')
    p.add_argument('--bezier', action='store_true')
    p.add_argument('--style', default='classic')
    # Output format control (keep only one file)
    p.add_argument('--output_format', choices=['svg','pdf'], default='svg', help='Output file format; only generate and keep the selected format')
    p.add_argument('--keep_tmp', action='store_true', help='Keep intermediate SVG generated by LINKVIEW (default: not kept)')

    # —— Depth parameters (consistent with depth_plotter_v2) ——
    p.add_argument('-r','--fai', required=True, help='Reference genome FAI')
    # Common files (compatible with legacy options)
    p.add_argument('--hifi', help='HiFi depth file (.gz supported)')
    p.add_argument('--nano', help='ONT/Nano depth file (.gz supported)')
    # Per-chromosome files (avoid re-parsing)
    p.add_argument('--hifi_a', help='HiFi depth file for chrA')
    p.add_argument('--nano_a', help='ONT/Nano depth file for chrA')
    p.add_argument('--hifi_b', help='HiFi depth file for chrB')
    p.add_argument('--nano_b', help='ONT/Nano depth file for chrB')
    p.add_argument('-w','--window-size', default=1000, type=int)
    p.add_argument('--max-depth-ratio', default=3.0, type=float)
    p.add_argument('--min-safe-depth', default=5, type=int)

    # —— Layout parameters (new: depth panel height and gap) ——
    p.add_argument('--depth_height', default=160, type=int, help='Height of each depth panel')
    p.add_argument('--panel_gap', default=None, type=int, help='Gap between panels (default: 10 percent of depth_height)')
    p.add_argument('--top_margin', default=40, type=int, help='Top margin above the top depth panel (pixels)')
    p.add_argument('--debug_margin', action='store_true', help='Draw a visual guide for the top margin (for debugging)')
    # —— Axis tick parameters ——
    p.add_argument('--depth_axis_ticks', default=5, type=int, help='Number of depth axis ticks')
    p.add_argument('--depth_axis_font_size', default=12, type=int, help='Font size of depth axis labels')
    return p


def main():
    parser = build_parser()
    args = parser.parse_args()
    run(args)


if __name__ == '__main__':
    main()
