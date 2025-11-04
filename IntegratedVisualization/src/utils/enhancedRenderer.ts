/**
 * 增强的渲染器
 * 参考integrated_montage.py的实现，支持双坐标轴和更精确的坐标映射
 */

import { slidingWindowAverage, calculateMeanDepth, GciDepthData } from './gciParser';
import { ExtendedOptions } from './linkviewWrapper';

const DEPTH_COLOR_1 = '#2ca25f'; // HiFi green
const DEPTH_COLOR_2 = '#3C5488'; // Nano blue
const BASELINE_COLOR = '#555';
const MEAN_LINE_COLOR = '#cc3333';
const ZERO_DEPTH_COLOR = '#FAD7DD';
const LOW_DEPTH_COLOR = '#B7DBEA';

export interface ChromosomeTrack {
  chromosome: string;
  start: number;
  end: number;
  svgX: number;
  svgY: number;
  svgWidth: number;
  svgHeight: number;
}

/**
 * 从SVG内容中提取染色体轨道信息
 */
export function extractTracksFromSvg(svgContent: string, layout: any[]): ChromosomeTrack[] {
  const tracks: ChromosomeTrack[] = [];
  
  if (!layout || layout.length === 0) return tracks;
  
  // 从layout中提取轨道信息
  layout.forEach((layoutLine, lineIndex) => {
    layoutLine.forEach((layoutItem: any) => {
      const { ctg, start, end, svgProps } = layoutItem;
      if (!svgProps) return;
      
      tracks.push({
        chromosome: ctg,
        start: Math.min(start, end),
        end: Math.max(start, end),
        svgX: svgProps.x || 0,
        svgY: svgProps.y || 0,
        svgWidth: svgProps.width || 0,
        svgHeight: svgProps.height || 0,
      });
    });
  });
  
  return tracks;
}

/**
 * 计算窗口统计信息
 */
function calculateWindowedStats(
  depths: number[],
  windowSize: number
): { means: number[], starts: number[], ends: number[] } {
  const means: number[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  
  if (depths.length === 0) return { means, starts, ends };
  
  const effectiveWindowSize = Math.min(windowSize, depths.length);
  
  for (let i = 0; i < depths.length; i += effectiveWindowSize) {
    const endIdx = Math.min(i + effectiveWindowSize, depths.length);
    const window = depths.slice(i, endIdx);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    
    means.push(mean);
    starts.push(i);
    ends.push(endIdx - 1);
  }
  
  return { means, starts, ends };
}

/**
 * 分析深度区域（零深度和低深度）
 */
function analyzeDepthRegions(
  depths: number[],
  minSafeDepth: number = 5
): { zero: Array<[number, number]>, low: Array<[number, number]> } {
  const zero: Array<[number, number]> = [];
  const low: Array<[number, number]> = [];
  
  let zeroStart: number | null = null;
  let lowStart: number | null = null;
  
  for (let i = 0; i < depths.length; i++) {
    const depth = depths[i];
    
    // 零深度区域
    if (depth === 0) {
      if (zeroStart === null) zeroStart = i;
    } else {
      if (zeroStart !== null) {
        zero.push([zeroStart, i - 1]);
        zeroStart = null;
      }
    }
    
    // 低深度区域
    if (depth > 0 && depth < minSafeDepth) {
      if (lowStart === null) lowStart = i;
    } else {
      if (lowStart !== null) {
        low.push([lowStart, i - 1]);
        lowStart = null;
      }
    }
  }
  
  // 处理末尾
  if (zeroStart !== null) {
    zero.push([zeroStart, depths.length - 1]);
  }
  if (lowStart !== null) {
    low.push([lowStart, depths.length - 1]);
  }
  
  return { zero, low };
}

/**
 * 为单个序列构建深度条（参考integrated_montage.py的build_bars_for_seq）
 */
export function buildDepthBarsForSequence(
  hifiArr: number[],
  ontArr: number[],
  xLeft: number,
  xRight: number,
  panelOriginY: number,
  options: ExtendedOptions,
  seqLength: number
): {
  backgroundElements: string[];
  barsTop: string[];
  barsBottom: string[];
  baselineY: number;
} {
  const bgElems: string[] = [];
  const barsTop: string[] = [];
  const barsBottom: string[] = [];
  
  const h = hifiArr || [];
  const n = ontArr || [];
  const seqLen = seqLength || Math.max(h.length, n.length);
  
  if (seqLen === 0) {
    return {
      backgroundElements: bgElems,
      barsTop,
      barsBottom,
      baselineY: panelOriginY + (options.gciDepthHeight || 150),
    };
  }
  
  const depthHeight = options.gciDepthHeight || 150;
  const windowSize = options.gciWindowSize || 50000;
  const maxRatio = options.gciDepthMax || 4.0;
  const minSafeDepth = options.gciDepthMin ? (options.gciDepthMin * 10) : 5; // 转换为绝对深度
  
  // 计算平均值和上限
  const nzH = h.filter(v => v > 0);
  const nzN = n.filter(v => v > 0);
  const avgHNonzero = nzH.length > 0 ? nzH.reduce((a, b) => a + b, 0) / nzH.length : 0;
  const avgNNonzero = nzN.length > 0 ? nzN.reduce((a, b) => a + b, 0) / nzN.length : 0;
  const capH = avgHNonzero * maxRatio;
  const capN = avgNNonzero * maxRatio;
  const globalCap = Math.max(capH, capN, 1);
  
  const baselineY = panelOriginY + depthHeight;
  const span = xRight - xLeft;
  
  // 处理HiFi数据（上方）
  if (h.length > 0) {
    const { means, starts, ends } = calculateWindowedStats(h, windowSize);
    const regions = analyzeDepthRegions(h, minSafeDepth);
    
    // 背景高亮
    for (const [s, e] of regions.zero) {
      const x1 = xLeft + (s / Math.max(1, seqLen - 1)) * span;
      const x2 = xLeft + (e / Math.max(1, seqLen - 1)) * span;
      const w = Math.max(0, x2 - x1);
      if (w > 0) {
        bgElems.push(
          `<rect x="${x1.toFixed(2)}" y="${(baselineY - depthHeight).toFixed(2)}" width="${w.toFixed(2)}" height="${depthHeight.toFixed(2)}" class="depth-zero-bg"/>`
        );
      }
    }
    for (const [s, e] of regions.low) {
      const x1 = xLeft + (s / Math.max(1, seqLen - 1)) * span;
      const x2 = xLeft + (e / Math.max(1, seqLen - 1)) * span;
      const w = Math.max(0, x2 - x1);
      if (w > 0) {
        bgElems.push(
          `<rect x="${x1.toFixed(2)}" y="${(baselineY - depthHeight).toFixed(2)}" width="${w.toFixed(2)}" height="${depthHeight.toFixed(2)}" class="depth-low-bg"/>`
        );
      }
    }
    
    // 生成深度条
    for (let i = 0; i < means.length; i++) {
      const m = means[i];
      const s = starts[i];
      const e = ends[i];
      const center = (s + e) / 2;
      const widthBp = e - s + 1;
      
      const xCenter = xLeft + (center / Math.max(1, seqLen - 1)) * span;
      const wPx = span * (widthBp / Math.max(1, seqLen - 1));
      
      const hifiCap = capH > 0 ? capH : globalCap;
      const mClamped = Math.min(m, hifiCap);
      const hPx = depthHeight * (mClamped / globalCap);
      
      const xRect = xCenter - wPx / 2;
      const yRect = baselineY - hPx;
      
      barsTop.push(
        `<rect x="${xRect.toFixed(2)}" y="${yRect.toFixed(2)}" width="${wPx.toFixed(2)}" height="${hPx.toFixed(2)}" class="depth-top"/>`
      );
    }
    
    // 平均线
    if (means.length > 0) {
      const avgH = means.reduce((a, b) => a + b, 0) / means.length;
      if (avgH > 0) {
        const hifiCap = capH > 0 ? capH : globalCap;
        const avgHClamped = Math.min(avgH, hifiCap);
        const yMean = baselineY - depthHeight * (avgHClamped / globalCap);
        barsTop.push(
          `<line x1="${xLeft.toFixed(2)}" y1="${yMean.toFixed(2)}" x2="${xRight.toFixed(2)}" y2="${yMean.toFixed(2)}" class="mean"/>`
        );
      }
    }
  }
  
  // 处理ONT数据（下方）
  if (n.length > 0) {
    const { means, starts, ends } = calculateWindowedStats(n, windowSize);
    const regions = analyzeDepthRegions(n, minSafeDepth);
    
    // 背景高亮
    for (const [s, e] of regions.zero) {
      const x1 = xLeft + (s / Math.max(1, seqLen - 1)) * span;
      const x2 = xLeft + (e / Math.max(1, seqLen - 1)) * span;
      const w = Math.max(0, x2 - x1);
      if (w > 0) {
        bgElems.push(
          `<rect x="${x1.toFixed(2)}" y="${baselineY.toFixed(2)}" width="${w.toFixed(2)}" height="${depthHeight.toFixed(2)}" class="depth-zero-bg"/>`
        );
      }
    }
    for (const [s, e] of regions.low) {
      const x1 = xLeft + (s / Math.max(1, seqLen - 1)) * span;
      const x2 = xLeft + (e / Math.max(1, seqLen - 1)) * span;
      const w = Math.max(0, x2 - x1);
      if (w > 0) {
        bgElems.push(
          `<rect x="${x1.toFixed(2)}" y="${baselineY.toFixed(2)}" width="${w.toFixed(2)}" height="${depthHeight.toFixed(2)}" class="depth-low-bg"/>`
        );
      }
    }
    
    // 生成深度条
    for (let i = 0; i < means.length; i++) {
      const m = means[i];
      const s = starts[i];
      const e = ends[i];
      const center = (s + e) / 2;
      const widthBp = e - s + 1;
      
      const xCenter = xLeft + (center / Math.max(1, seqLen - 1)) * span;
      const wPx = span * (widthBp / Math.max(1, seqLen - 1));
      
      const ontCap = capN > 0 ? capN : globalCap;
      const mClamped = Math.min(m, ontCap);
      const hPx = depthHeight * (mClamped / globalCap);
      
      const xRect = xCenter - wPx / 2;
      const yRect = baselineY;
      
      barsBottom.push(
        `<rect x="${xRect.toFixed(2)}" y="${yRect.toFixed(2)}" width="${wPx.toFixed(2)}" height="${hPx.toFixed(2)}" class="depth-bottom"/>`
      );
    }
    
    // 平均线
    if (means.length > 0) {
      const avgN = means.reduce((a, b) => a + b, 0) / means.length;
      if (avgN > 0) {
        const ontCap = capN > 0 ? capN : globalCap;
        const avgNClamped = Math.min(avgN, ontCap);
        const yMean = baselineY + depthHeight * (avgNClamped / globalCap);
        barsBottom.push(
          `<line x1="${xLeft.toFixed(2)}" y1="${yMean.toFixed(2)}" x2="${xRight.toFixed(2)}" y2="${yMean.toFixed(2)}" class="mean"/>`
        );
      }
    }
  }
  
  return {
    backgroundElements: bgElems,
    barsTop,
    barsBottom,
    baselineY,
  };
}

/**
 * 生成坐标轴刻度和标签
 */
export function generateAxisTicks(
  xLeft: number,
  xRight: number,
  y: number,
  start: number,
  end: number,
  above: boolean = true,
  numTicks: number = 5,
  fontSize: number = 12
): string[] {
  const elements: string[] = [];
  const span = xRight - xLeft;
  const tickHeight = 6;
  
  for (let i = 0; i <= numTicks; i++) {
    const x = xLeft + span * (i / numTicks);
    
    // 刻度线
    const y1 = above ? y - tickHeight : y;
    const y2 = above ? y : y + tickHeight;
    elements.push(
      `<line x1="${x.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x.toFixed(2)}" y2="${y2.toFixed(2)}" class="axis-tick"/>`
    );
    
    // 标签
    const val = Math.round(start + (end - start) * (i / numTicks));
    const dy = above ? -10 : 18;
    elements.push(
      `<text x="${x.toFixed(2)}" y="${(y + dy).toFixed(2)}" class="axis-label" font-size="${fontSize}">${formatGenomicPosition(val)}</text>`
    );
  }
  
  return elements;
}

/**
 * 格式化基因组位置显示
 */
function formatGenomicPosition(pos: number): string {
  if (pos >= 1e6) {
    return `${(pos / 1e6).toFixed(2)} Mb`;
  } else if (pos >= 1e3) {
    return `${(pos / 1e3).toFixed(0)} Kb`;
  }
  return `${pos}`;
}

