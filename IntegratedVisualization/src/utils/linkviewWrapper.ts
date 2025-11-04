/**
 * LINKVIEW包装器
 * 严格遵循 static/integrated_montage.py 的实现逻辑
 */

import { main } from '@linkview/linkview-core';
import { GciDepthData } from './gciParser';
import {
  extractChromosomeTracks,
  buildBarsForSequence,
  generateAxisTicks,
  ChromosomeTrack,
} from './montageRenderer';

/**
 * 从layout数组中提取染色体tracks（优先方法）
 */
function extractChromosomeTracksFromLayout(layout: any[]): ChromosomeTrack[] {
  const tracks: ChromosomeTrack[] = [];
  
  if (!layout || layout.length === 0) return tracks;
  
  // 按行处理layout
  for (const layoutLine of layout) {
    if (!Array.isArray(layoutLine) || layoutLine.length === 0) continue;
    
    // 找到该行的最小x和最大x，以及统一的y和高度
    let xLeft: number | null = null;
    let xRight: number | null = null;
    let yTop: number | null = null;
    let hMax = 0;
    
    for (const layoutItem of layoutLine) {
      if (!layoutItem.svgProps) continue;
      
      const { x, y, width, height } = layoutItem.svgProps;
      const itemRight = x + width;
      
      if (xLeft === null) {
        xLeft = x;
        xRight = itemRight;
        yTop = y;
        hMax = height || 15;
      } else {
        xLeft = Math.min(xLeft, x);
        xRight = Math.max(xRight, itemRight);
        if (yTop !== null && Math.abs(y - yTop) < 1e-6) {
          hMax = Math.max(hMax, height || 15);
        }
      }
    }
    
    if (xLeft !== null && xRight !== null && yTop !== null) {
      tracks.push({
        xLeft,
        yTop,
        width: xRight - xLeft,
        height: hMax > 0 ? hMax : 15.0,
      });
    }
  }
  
  return tracks;
}

type Options = any;

export interface ExtendedOptions extends Options {
  gciDepthData?: GciDepthData;
  gciDepthData2?: GciDepthData;
  gciMeanDepths?: number[];
  depth_height?: number; // 与Python版本一致：depth_height
  panel_gap?: number; // 与Python版本一致：panel_gap
  top_margin?: number; // 与Python版本一致：top_margin
  window_size?: number; // 与Python版本一致：window-size
  max_depth_ratio?: number; // 与Python版本一致：max-depth-ratio
  min_safe_depth?: number; // 与Python版本一致：min-safe-depth
  depth_axis_ticks?: number; // 与Python版本一致：depth_axis_ticks
  depth_axis_font_size?: number; // 与Python版本一致：depth_axis_font_size
  auxiliaryLines?: number[];
  auxiliaryLineColor?: string;
  
  // 兼容旧参数名（向后兼容）
  gciDepthHeight?: number;
  gciWindowSize?: number;
  gciDepthMax?: number;
  gciDepthMin?: number;
}

/**
 * 从SVG中提取内部内容、宽度和高度（参考Python版本的_extract_inner_svg）
 */
function extractInnerSvg(svgText: string): { inner: string; width: number; height: number } {
  const widthMatch = svgText.match(/<svg[^>]*\bwidth="(\d+)"/);
  const heightMatch = svgText.match(/<svg[^>]*\bheight="(\d+)"/);
  const width = widthMatch ? parseInt(widthMatch[1], 10) : 1200;
  const height = heightMatch ? parseInt(heightMatch[1], 10) : 800;
  
  // 去除最外层 <svg> 标签，保留内部内容
  let inner = svgText.replace(/^<svg[^>]*>/, '');
  inner = inner.replace(/<\/svg>\s*$/, '');
  
  return { inner, width, height };
}

/**
 * 渲染辅助线
 */
function renderAuxiliaryLines(
  auxiliaryLines: number[],
  layout: any[],
  totalHeight: number,
  lineColor: string
): string[] {
  const svgContents: string[] = [];
  
  if (!auxiliaryLines || auxiliaryLines.length === 0 || !layout || layout.length === 0) {
    return svgContents;
  }
  
  for (const linePos of auxiliaryLines) {
    let lineDrawn = false;
    
    for (const layoutLine of layout) {
      for (const layoutItem of layoutLine) {
        const { start, end } = layoutItem;
        const min = Math.min(start, end);
        const max = Math.max(start, end);
        
        if (linePos < min || linePos > max) continue;
        
        // 使用getSvgPos获取SVG坐标
        if (layoutItem.getSvgPos) {
          const [svgX] = layoutItem.getSvgPos(linePos, 'top', false);
          svgContents.push(
            `<line x1="${svgX}" y1="0" x2="${svgX}" y2="${totalHeight}" stroke="${lineColor}" stroke-width="1" stroke-dasharray="2,2"/>`
          );
          lineDrawn = true;
          break;
        }
      }
      
      if (lineDrawn) break;
    }
  }
  
  return svgContents;
}

/**
 * 扩展的main函数，严格遵循Python版本的run函数逻辑
 */
export async function extendedMain(options: ExtendedOptions): Promise<string> {
  console.log('[extendedMain] Starting, options:', {
    hasGciDepthData: !!options.gciDepthData,
    hasGciDepthData2: !!options.gciDepthData2,
    inputContentLength: options.inputContent?.length || 0,
    karyotypeContent: options.karyotypeContent?.substring(0, 100) || '',
  });
  
  // 1. 调用LINKVIEW生成SVG
  const linkviewOptions: Options = {
    ...options,
  } as Options;
  
  console.log('[extendedMain] Calling LINKVIEW main...');
  const linkviewSvg = await main(linkviewOptions);
  
  console.log('[extendedMain] LINKVIEW main returned, SVG length:', linkviewSvg?.length || 0);
  
  if (!linkviewSvg) {
    console.warn('[extendedMain] LINKVIEW returned empty SVG');
    return '';
  }
  
  // 2. 提取内部SVG和尺寸
  const { inner, width, height: alignHeight } = extractInnerSvg(linkviewSvg);
  
  // 3. 从layout或SVG中提取染色体tracks
  const layout = linkviewOptions.layout || [];
  let tracks = extractChromosomeTracksFromLayout(layout);
  
  // 如果从layout中无法提取，尝试从SVG中提取
  if (tracks.length === 0) {
    tracks = extractChromosomeTracks(linkviewSvg);
  }
  
  if (tracks.length === 0) {
    console.warn('Failed to identify chromosome tracks in LINKVIEW SVG');
    return linkviewSvg; // 如果没有找到tracks，返回原始SVG
  }
  
  // 4. 获取参数（使用新参数名，兼容旧参数名）
  const depthHeight = options.depth_height ?? options.gciDepthHeight ?? 160;
  const panelGap = options.panel_gap ?? Math.max(1, Math.round(depthHeight * 0.1));
  const topMargin = options.top_margin ?? 40;
  const windowSize = options.window_size ?? options.gciWindowSize ?? 1000;
  const maxDepthRatio = options.max_depth_ratio ?? options.gciDepthMax ?? 3.0;
  const minSafeDepth = options.min_safe_depth ?? (options.gciDepthMin ? Math.round(options.gciDepthMin * 10) : 5);
  const numAxisTicks = options.depth_axis_ticks ?? 5;
  const axisFontSize = options.depth_axis_font_size ?? 12;
  
  // 5. 计算深度面板布局位置（参考Python版本的逻辑）
  const topTrack = tracks[0];
  const bottomTrack = tracks.length > 1 ? tracks[1] : tracks[0];
  
  let xLeftTop = topTrack.xLeft;
  let yTop = topTrack.yTop;
  let wTop = topTrack.width;
  let hTop = topTrack.height;
  let xRightTop = xLeftTop + wTop;
  
  let xLeftBottom = bottomTrack.xLeft;
  let yBottom = bottomTrack.yTop;
  let wBottom = bottomTrack.width;
  let hBottom = bottomTrack.height;
  let xRightBottom = xLeftBottom + wBottom;
  
  // 计算深度面板的y位置
  let blockYTop = yTop - panelGap - (2 * depthHeight);
  let blockYBottom = yBottom + hBottom + panelGap;
  
  // 全局偏移（如果顶部面板会超出SVG顶部）
  let globalOffset = 0.0;
  if (blockYTop < 0) {
    globalOffset = -blockYTop;
    blockYTop += globalOffset;
    blockYBottom += globalOffset;
    yTop += globalOffset;
    yBottom += globalOffset;
  }
  
  // 应用顶部边距
  if (topMargin > 0) {
    blockYTop += topMargin;
    blockYBottom += topMargin;
    yTop += topMargin;
    yBottom += topMargin;
    globalOffset += topMargin;
  }
  
  const middleY = globalOffset;
  
  // 6. 获取深度数据
  const gciDepthData = options.gciDepthData;
  const gciDepthData2 = options.gciDepthData2;
  
  if (!gciDepthData || Object.keys(gciDepthData).length === 0) {
    // 如果没有深度数据，只返回LINKVIEW SVG（加上偏移）
    if (globalOffset > 0) {
      const adjustedHeight = alignHeight + globalOffset;
      const offsetSvgContent = `<g transform="translate(0,${globalOffset})">${inner}</g>`;
      return `<svg width="${width}" height="${adjustedHeight}" xmlns="http://www.w3.org/2000/svg" version="1.1">${offsetSvgContent}</svg>`;
    }
    return linkviewSvg;
  }
  
  // 7. 确定目标染色体（从karyotype或depth数据中提取）
  const targetChrs: string[] = [];
  if (options.karyotypeContent) {
    const lines = options.karyotypeContent.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const token = trimmed.split(/\s+/)[0];
      const parts = token.split(':');
      targetChrs.push(parts[0]);
      if (targetChrs.length >= 2) break;
    }
  }
  
  // 如果karyotype没有提供足够的染色体，从depth数据中提取
  if (targetChrs.length < 2) {
    const allChrs = Object.keys(gciDepthData);
    if (allChrs.length >= 2) {
      targetChrs.push(allChrs[0], allChrs[1]);
    } else if (allChrs.length === 1) {
      targetChrs.push(allChrs[0], allChrs[0]);
    }
  }
  
  const chr1 = targetChrs[0] || null;
  const chr2 = targetChrs.length > 1 ? targetChrs[1] : chr1;
  
  // 8. 获取每个染色体的深度数据
  const hifi1 = chr1 ? (gciDepthData[chr1] || []) : [];
  const nano1 = chr1 && gciDepthData2 ? (gciDepthData2[chr1] || []) : [];
  const hifi2 = chr2 ? (gciDepthData[chr2] || []) : [];
  const nano2 = chr2 && gciDepthData2 ? (gciDepthData2[chr2] || []) : [];
  
  // 9. 计算轴标签范围（1-based，参考Python版本的_axis_labels）
  const getAxisLabels = (seqId: string | null, hArr: number[], nArr: number[]): [number, number] => {
    const L = Math.max(hArr.length, nArr.length);
    return L > 0 ? [1, L] : [1, 1];
  };
  
  const [label1Start, label1End] = getAxisLabels(chr1, hifi1, nano1);
  const [label2Start, label2End] = getAxisLabels(chr2, hifi2, nano2);
  
  // 10. 构建深度条（上方和下方面板）
  const { backgroundElements: bg1, barsTop: barsTop1, barsBottom: barsBottom1, baselineY: baseline1Y } =
    buildBarsForSequence(hifi1, nano1, xLeftTop, xRightTop, blockYTop, depthHeight, windowSize, maxDepthRatio, minSafeDepth);
  
  const { backgroundElements: bg2, barsTop: barsTop2, barsBottom: barsBottom2, baselineY: baseline2Y } =
    buildBarsForSequence(hifi2, nano2, xLeftBottom, xRightBottom, blockYBottom, depthHeight, windowSize, maxDepthRatio, minSafeDepth);
  
  // 11. 计算总高度
  const innerBottom = middleY + alignHeight;
  const bottomBlockBottom = blockYBottom + (2 * depthHeight);
  const totalHeight = Math.max(innerBottom, bottomBlockBottom) + panelGap;
  
  // 12. 构建SVG样式（参考Python版本）
  const styles = `<defs><style>
        .depth-top { fill: #2ca25f; opacity: 0.85; }
        .depth-bottom { fill: #3C5488; opacity: 0.85; }
        .baseline { stroke: #555; stroke-width: 1px; }
        .axis-tick { stroke: #555; stroke-width: 1px; }
        .axis-label { fill: #222; text-anchor: middle; dominant-baseline: central; }
        .mean { stroke: #cc3333; stroke-width: 1.2px; stroke-dasharray: 6 4; }
        .depth-zero-bg { fill: #FAD7DD; opacity: 0.8; }
        .depth-low-bg { fill: #B7DBEA; opacity: 0.8; }
    </style></defs>`;
  
  // 13. 组装SVG内容
  const svgParts: string[] = [
    `<svg width="${width}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg" version="1.1">`,
    styles,
  ];
  
  // 顶部深度面板（背景、条、基线、刻度）
  svgParts.push(...bg1);
  svgParts.push(...barsTop1);
  svgParts.push(...barsBottom1);
  svgParts.push(`<line x1="${xLeftTop.toFixed(2)}" y1="${baseline1Y.toFixed(2)}" x2="${xRightTop.toFixed(2)}" y2="${baseline1Y.toFixed(2)}" class="baseline"/>`);
  svgParts.push(...generateAxisTicks(xLeftTop, xRightTop, baseline1Y, label1Start, label1End, true, numAxisTicks, axisFontSize));
  
  // LINKVIEW内容（应用偏移）
  svgParts.push(`<g transform="translate(0,${middleY.toFixed(2)})">${inner}</g>`);
  
  // 底部深度面板
  svgParts.push(...bg2);
  svgParts.push(...barsTop2);
  svgParts.push(...barsBottom2);
  svgParts.push(`<line x1="${xLeftBottom.toFixed(2)}" y1="${baseline2Y.toFixed(2)}" x2="${xRightBottom.toFixed(2)}" y2="${baseline2Y.toFixed(2)}" class="baseline"/>`);
  svgParts.push(...generateAxisTicks(xLeftBottom, xRightBottom, baseline2Y, label2Start, label2End, false, numAxisTicks, axisFontSize));
  
  // 辅助线
  if (options.auxiliaryLines && options.auxiliaryLines.length > 0) {
    const lineColor = options.auxiliaryLineColor || 'rgba(255, 0, 0, 0.5)';
    svgParts.push(...renderAuxiliaryLines(options.auxiliaryLines, layout, totalHeight, lineColor));
  }
  
  svgParts.push('</svg>');
  
  return svgParts.join('\n');
}
