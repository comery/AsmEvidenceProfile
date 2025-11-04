/**
 * 集成可视化渲染器
 * 严格遵循 static/integrated_montage.py 的实现逻辑
 */

export interface ChromosomeTrack {
  xLeft: number;
  yTop: number;
  width: number;
  height: number;
}

export interface WindowedStats {
  means: number[];
  starts: number[];
  ends: number[];
}

export interface DepthRegions {
  zero: Array<[number, number]>;
  low: Array<[number, number]>;
}

/**
 * 从SVG内容中提取染色体track矩形（参考Python版本的_collect_chro_tracks）
 */
export function extractChromosomeTracks(svgContent: string): ChromosomeTrack[] {
  const tracks: ChromosomeTrack[] = [];
  
  // 使用正则表达式查找所有 <rect class="chro"> 标签
  const rectRegex = /<rect[^>]*class="chro"[^>]*>/g;
  const rects: Array<{ x: number; y: number; width: number; height: number }> = [];
  
  let match;
  while ((match = rectRegex.exec(svgContent)) !== null) {
    const tag = match[0];
    const getAttr = (name: string, defaultVal: number = 0): number => {
      const attrRegex = new RegExp(`\\b${name}="([\\d\\.]+)"`, 'i');
      const m = tag.match(attrRegex);
      return m ? parseFloat(m[1]) : defaultVal;
    };
    
    rects.push({
      x: getAttr('x'),
      y: getAttr('y'),
      width: getAttr('width'),
      height: getAttr('height', 0),
    });
  }
  
  if (rects.length === 0) return tracks;
  
  // 按y坐标排序并聚类（同一行的矩形）
  rects.sort((a, b) => a.y - b.y);
  
  let currentY: number | null = null;
  let xLeft: number | null = null;
  let xRight: number | null = null;
  let hMax = 0;
  
  for (const rect of rects) {
    if (currentY === null) {
      currentY = rect.y;
      xLeft = rect.x;
      xRight = rect.x + rect.width;
      hMax = Math.max(hMax, rect.height);
      continue;
    }
    
    // 如果y坐标接近（同一行），扩展边界
    if (Math.abs(rect.y - currentY) < 1e-6) {
      xLeft = Math.min(xLeft!, rect.x);
      xRight = Math.max(xRight!, rect.x + rect.width);
      hMax = Math.max(hMax, rect.height);
    } else {
      // 新行，保存当前track
      tracks.push({
        xLeft: xLeft!,
        yTop: currentY,
        width: xRight! - xLeft!,
        height: hMax > 0 ? hMax : 15.0,
      });
      
      currentY = rect.y;
      xLeft = rect.x;
      xRight = rect.x + rect.width;
      hMax = rect.height;
    }
  }
  
  // 保存最后一个track
  if (currentY !== null) {
    tracks.push({
      xLeft: xLeft!,
      yTop: currentY,
      width: xRight! - xLeft!,
      height: hMax > 0 ? hMax : 15.0,
    });
  }
  
  return tracks;
}

/**
 * 计算窗口统计信息（参考Python版本的DataProcessor.calculate_windowed_stats）
 */
export function calculateWindowedStats(
  depths: number[],
  windowSize: number
): WindowedStats {
  const means: number[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  
  if (depths.length === 0) {
    return { means, starts, ends };
  }
  
  // 找到非零段（跳过零深度区域）
  const zeroMask = depths.map(d => d === 0);
  const segments = findNonZeroSegments(zeroMask);
  
  for (const [segmentStart, segmentEnd] of segments) {
    const segmentLength = segmentEnd - segmentStart + 1;
    if (segmentLength === 0) continue;
    
    // 计算需要的窗口数
    let numWindows = Math.max(1, Math.floor(segmentLength / windowSize));
    if (segmentLength % windowSize !== 0) {
      numWindows += 1;
    }
    
    for (let i = 0; i < numWindows; i++) {
      const windowStartInSegment = i * windowSize;
      const windowEndInSegment = Math.min((i + 1) * windowSize, segmentLength);
      
      const absStart = segmentStart + windowStartInSegment;
      const absEnd = segmentStart + windowEndInSegment - 1;
      
      const windowData = depths.slice(absStart, absEnd + 1);
      if (windowData.length > 0) {
        const mean = windowData.reduce((a, b) => a + b, 0) / windowData.length;
        means.push(mean);
        starts.push(absStart);
        ends.push(absEnd);
      }
    }
  }
  
  return { means, starts, ends };
}

/**
 * 查找非零段（参考Python版本的_find_non_zero_segments）
 */
function findNonZeroSegments(zeroMask: boolean[]): Array<[number, number]> {
  const segments: Array<[number, number]> = [];
  let start: number | null = null;
  
  for (let i = 0; i < zeroMask.length; i++) {
    const isZero = zeroMask[i];
    if (!isZero && start === null) {
      start = i;
    } else if (isZero && start !== null) {
      segments.push([start, i - 1]);
      start = null;
    }
  }
  
  if (start !== null) {
    segments.push([start, zeroMask.length - 1]);
  }
  
  return segments;
}

/**
 * 分析深度区域（参考Python版本的DataProcessor.analyze_depth_regions）
 */
export function analyzeDepthRegions(
  depths: number[],
  minSafeDepth: number = 5
): DepthRegions {
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
 * 为单个序列构建深度条（严格遵循Python版本的build_bars_for_seq）
 */
export function buildBarsForSequence(
  hifiArr: number[],
  ontArr: number[],
  xLeft: number,
  xRight: number,
  panelOriginY: number,
  depthHeight: number,
  windowSize: number,
  maxDepthRatio: number,
  minSafeDepth: number
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
  const seqLen = Math.max(h.length, n.length);
  
  if (seqLen === 0) {
    return {
      backgroundElements: bgElems,
      barsTop,
      barsBottom,
      baselineY: panelOriginY + depthHeight,
    };
  }
  
  // 计算每个数据集的非零平均值和上限（避免大数组导致的栈溢出）
  let sumH = 0;
  let countH = 0;
  for (let i = 0; i < h.length; i++) {
    if (h[i] > 0) {
      sumH += h[i];
      countH++;
    }
  }
  const avgHNonzero = countH > 0 ? sumH / countH : 0;
  
  let sumN = 0;
  let countN = 0;
  for (let i = 0; i < n.length; i++) {
    if (n[i] > 0) {
      sumN += n[i];
      countN++;
    }
  }
  const avgNNonzero = countN > 0 ? sumN / countN : 0;
  const capH = avgHNonzero > 0 ? avgHNonzero * maxDepthRatio : 0;
  const capN = avgNNonzero > 0 ? avgNNonzero * maxDepthRatio : 0;
  const globalCap = Math.max(capH, capN, 1.0);
  
  const baselineY = panelOriginY + depthHeight;
  const span = xRight - xLeft;
  
  // 处理HiFi数据（上方）
  if (h.length > 0) {
    const { means, starts, ends } = calculateWindowedStats(h, windowSize);
    const regions = analyzeDepthRegions(h, minSafeDepth);
    
    // 背景高亮（零深度和低深度区域）
    for (const [s, e] of regions.zero) {
      const x1 = xLeft + (s / Math.max(1, seqLen - 1)) * span;
      const x2 = xLeft + (e / Math.max(1, seqLen - 1)) * span;
      const wPxBg = Math.max(0, x2 - x1);
      if (wPxBg > 0) {
        bgElems.push(
          `<rect x="${x1.toFixed(2)}" y="${(baselineY - depthHeight).toFixed(2)}" width="${wPxBg.toFixed(2)}" height="${depthHeight.toFixed(2)}" class="depth-zero-bg"/>`
        );
      }
    }
    for (const [s, e] of regions.low) {
      const x1 = xLeft + (s / Math.max(1, seqLen - 1)) * span;
      const x2 = xLeft + (e / Math.max(1, seqLen - 1)) * span;
      const wPxBg = Math.max(0, x2 - x1);
      if (wPxBg > 0) {
        bgElems.push(
          `<rect x="${x1.toFixed(2)}" y="${(baselineY - depthHeight).toFixed(2)}" width="${wPxBg.toFixed(2)}" height="${depthHeight.toFixed(2)}" class="depth-low-bg"/>`
        );
      }
    }
    
    // 生成深度条（矩形）
    for (let i = 0; i < means.length; i++) {
      const m = means[i];
      const s = starts[i];
      const e = ends[i];
      const center = (s + e) / 2.0;
      const widthBp = e - s + 1;
      
      const xCenter = xLeft + (center / Math.max(1, seqLen - 1)) * span;
      const wPx = span * (widthBp / Math.max(1, seqLen - 1));
      
      const hifiCap = capH > 0 ? capH : globalCap;
      const mClamped = Math.min(m, hifiCap);
      const hPx = depthHeight * (mClamped / globalCap);
      
      const xRect = xCenter - wPx / 2.0;
      const yRect = baselineY - hPx;
      
      barsTop.push(
        `<rect x="${xRect.toFixed(2)}" y="${yRect.toFixed(2)}" width="${wPx.toFixed(2)}" height="${hPx.toFixed(2)}" class="depth-top"/>`
      );
    }
    
    // 平均线（HiFi）
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
      const wPxBg = Math.max(0, x2 - x1);
      if (wPxBg > 0) {
        bgElems.push(
          `<rect x="${x1.toFixed(2)}" y="${baselineY.toFixed(2)}" width="${wPxBg.toFixed(2)}" height="${depthHeight.toFixed(2)}" class="depth-zero-bg"/>`
        );
      }
    }
    for (const [s, e] of regions.low) {
      const x1 = xLeft + (s / Math.max(1, seqLen - 1)) * span;
      const x2 = xLeft + (e / Math.max(1, seqLen - 1)) * span;
      const wPxBg = Math.max(0, x2 - x1);
      if (wPxBg > 0) {
        bgElems.push(
          `<rect x="${x1.toFixed(2)}" y="${baselineY.toFixed(2)}" width="${wPxBg.toFixed(2)}" height="${depthHeight.toFixed(2)}" class="depth-low-bg"/>`
        );
      }
    }
    
    // 生成深度条
    for (let i = 0; i < means.length; i++) {
      const m = means[i];
      const s = starts[i];
      const e = ends[i];
      const center = (s + e) / 2.0;
      const widthBp = e - s + 1;
      
      const xCenter = xLeft + (center / Math.max(1, seqLen - 1)) * span;
      const wPx = span * (widthBp / Math.max(1, seqLen - 1));
      
      const ontCap = capN > 0 ? capN : globalCap;
      const mClamped = Math.min(m, ontCap);
      const hPx = depthHeight * (mClamped / globalCap);
      
      const xRect = xCenter - wPx / 2.0;
      const yRect = baselineY;
      
      barsBottom.push(
        `<rect x="${xRect.toFixed(2)}" y="${yRect.toFixed(2)}" width="${wPx.toFixed(2)}" height="${hPx.toFixed(2)}" class="depth-bottom"/>`
      );
    }
    
    // 平均线（ONT）
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
 * 生成坐标轴刻度和标签（参考Python版本的_axis_ticks）
 */
export function generateAxisTicks(
  xLeft: number,
  xRight: number,
  y: number,
  labelStart: number,
  labelEnd: number,
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
    const val = Math.round(labelStart + (labelEnd - labelStart) * (i / numTicks));
    const dy = above ? -10 : 18;
    elements.push(
      `<text x="${x.toFixed(2)}" y="${(y + dy).toFixed(2)}" class="axis-label" font-size="${fontSize}">${val}</text>`
    );
  }
  
  return elements;
}

