/**
 * LINKVIEW包装器
 * 扩展LINKVIEW核心功能以支持GCI深度图集成
 */

// 使用包入口（postinstall 已将 main 指向 lib/index.js 并编译到 lib）
import { main } from '@linkview/linkview-core';
import { slidingWindowAverage, calculateMeanDepth, GciDepthData } from './gciParser';
type Options = any;

const DEPTH_COLOR_1 = '#2ca25f'; // HiFi green
const DEPTH_COLOR_2 = '#3C5488'; // Nano blue
const BASELINE_COLOR = 'black';
const MEAN_LINE_COLOR = 'red';

export interface ExtendedOptions extends Options {
  gciDepthData?: GciDepthData;
  gciDepthData2?: GciDepthData;
  gciMeanDepths?: number[];
  gciDepthHeight?: number;
  gciWindowSize?: number;
  gciDepthMin?: number;
  gciDepthMax?: number;
  auxiliaryLines?: number[];
  auxiliaryLineColor?: string;
}

/**
 * 渲染GCI深度图SVG
 */
function renderGciDepthSvg(
  options: ExtendedOptions,
  layout: any[],
  gciDepthData: GciDepthData,
  meanDepth: number,
  topY: number,
  height: number,
  isNegative: boolean = false,
  color: string = DEPTH_COLOR_1
): string[] {
  const svgContents: string[] = [];
  const windowSize = options.gciWindowSize || 50000;
  const depthMax = (options.gciDepthMax || 4.0) * meanDepth;
  
  const firstLayoutLine = layout[0];
  if (!firstLayoutLine) return svgContents;
  
  const yBaseline = isNegative ? topY + height : topY + height / 2;
  const yMean = isNegative 
    ? yBaseline - (meanDepth / depthMax) * height * 0.4
    : yBaseline + (meanDepth / depthMax) * height * 0.4;
  
  for (const layoutItem of firstLayoutLine) {
    const { ctg, start, end } = layoutItem;
    if (!(ctg in gciDepthData)) continue;
    
    const depths = gciDepthData[ctg];
    const min = Math.min(start, end);
    const max = Math.max(start, end);
    
    const startIdx = Math.max(0, Math.floor(min));
    const endIdx = Math.min(depths.length - 1, Math.ceil(max));
    const regionDepths = depths.slice(startIdx, endIdx + 1);
    
    const [positions, averages] = slidingWindowAverage(regionDepths, windowSize, startIdx);
    
    if (averages.length > 0 && positions.length > 0) {
      const pathPoints: string[] = [];
      let firstX: number | null = null;
      
      for (let i = 0; i < positions.length; i++) {
        const posMb = positions[i];
        const genomicPos = posMb * 1e6;
        
        if (genomicPos < min || genomicPos > max) continue;
        
        const [svgX] = layoutItem.getSvgPos!(genomicPos, 'top', false);
        
        if (firstX === null) {
          firstX = svgX;
          pathPoints.push(`M ${svgX} ${yBaseline}`);
        }
        
        let depth = averages[i];
        if (depth > depthMax) depth = depthMax;
        
        const depthRatio = depth / depthMax;
        const yDepth = isNegative
          ? yBaseline - depthRatio * height * 0.4
          : yBaseline + depthRatio * height * 0.4;
        
        pathPoints.push(`L ${svgX} ${yDepth}`);
      }
      
      if (pathPoints.length > 1 && firstX !== null) {
        const lastPoint = pathPoints[pathPoints.length - 1];
        const lastX = parseFloat(lastPoint.split(' ')[1]);
        pathPoints.push(`L ${lastX} ${yBaseline}`);
        pathPoints.push(`L ${firstX} ${yBaseline} Z`);
        
        const pathData = pathPoints.join(' ');
        svgContents.push(
          `<path d="${pathData}" fill="${color}" stroke="none" opacity="0.7"/>`
        );
      }
    }
    
    const [x1] = layoutItem.getSvgPos!(min, 'top', false);
    const [x2] = layoutItem.getSvgPos!(max, 'top', true);
    svgContents.push(
      `<line x1="${x1}" y1="${yBaseline}" x2="${x2}" y2="${yBaseline}" stroke="${BASELINE_COLOR}" stroke-width="1"/>`
    );
    svgContents.push(
      `<line x1="${x1}" y1="${yMean}" x2="${x2}" y2="${yMean}" stroke="${MEAN_LINE_COLOR}" stroke-width="1" stroke-dasharray="5,5"/>`
    );
  }
  
  return svgContents;
}

/**
 * 渲染辅助线
 */
function renderAuxiliaryLines(
  options: ExtendedOptions,
  layout: any[],
  totalHeight: number
): string[] {
  const svgContents: string[] = [];
  const { auxiliaryLines, auxiliaryLineColor } = options;
  
  if (!auxiliaryLines || auxiliaryLines.length === 0 || !layout || layout.length === 0) {
    return svgContents;
  }
  
  const lineColor = auxiliaryLineColor || 'rgba(255, 0, 0, 0.5)';
  
  for (const linePos of auxiliaryLines) {
    let lineDrawn = false;
    
    for (const layoutLine of layout) {
      for (const layoutItem of layoutLine) {
        const { start, end } = layoutItem;
        const min = Math.min(start, end);
        const max = Math.max(start, end);
        
        if (linePos < min || linePos > max) continue;
        
        const [svgX] = layoutItem.getSvgPos!(linePos, 'top', false);
        svgContents.push(
          `<line x1="${svgX}" y1="0" x2="${svgX}" y2="${totalHeight}" stroke="${lineColor}" stroke-width="1" stroke-dasharray="2,2"/>`
        );
        
        lineDrawn = true;
        break;
      }
      
      if (lineDrawn) break;
    }
  }
  
  return svgContents;
}

/**
 * 扩展的main函数，支持GCI深度图
 */
export async function extendedMain(options: ExtendedOptions): Promise<string> {
  // 计算GCI面板高度
  const gciTopHeight = options.gciDepthData ? (options.gciDepthHeight || 150) : 0;
  const gciBottomHeight = options.gciDepthData2 ? (options.gciDepthHeight || 150) : 0;
  const spaceBetweenPanels = 20;
  
  // 调整svg_height以包含GCI面板
  const adjustedHeight = options.svg_height + gciTopHeight + gciBottomHeight + 
    (gciTopHeight > 0 || gciBottomHeight > 0 ? spaceBetweenPanels * 2 : 0);
  
  // LINKVIEW实际使用的height（排除GCI面板）
  const linkviewHeight = options.svg_height;
  
  // 调用LINKVIEW的main函数（会自动执行所有plugins并填充layout）
  const linkviewOptions: Options = {
    ...options,
    svg_height: linkviewHeight,
  } as Options;
  
  const linkviewSvg = await main(linkviewOptions);
  
  if (!linkviewSvg) return '';
  
  // 从执行后的options中获取layout（main函数会填充它）
  const layout = linkviewOptions.layout || [];
  
  // 提取SVG内容
  const svgMatch = linkviewSvg.match(/<svg([^>]*)>(.*)<\/svg>/s);
  if (!svgMatch) return linkviewSvg;
  
  const svgAttrs = svgMatch[1];
  const svgContent = svgMatch[2];
  
  // 解析SVG属性
  const widthMatch = svgAttrs.match(/width="([^"]*)"/);
  const width = widthMatch ? widthMatch[1] : (options.svg_width?.toString() || '1200');
  
  // 插入GCI深度图
  const gciSvgContents: string[] = [];
  
  if (options.gciDepthData && layout.length > 0) {
    const meanDepth1 = options.gciMeanDepths?.[0] || calculateMeanDepth(options.gciDepthData);
    const hasTwoDatasets = !!options.gciDepthData2;
    const panelHeight = hasTwoDatasets ? gciTopHeight / 2 : gciTopHeight;
    
    // 渲染顶层正区域
    gciSvgContents.push(...renderGciDepthSvg(
      options,
      layout,
      options.gciDepthData,
      meanDepth1,
      0,
      panelHeight,
      false,
      DEPTH_COLOR_1
    ));
    
    // 如果有第二个数据集，渲染负区域
    if (hasTwoDatasets && options.gciDepthData2) {
      const meanDepth2 = options.gciMeanDepths?.[1] || calculateMeanDepth(options.gciDepthData2);
      gciSvgContents.push(...renderGciDepthSvg(
        options,
        layout,
        options.gciDepthData2,
        meanDepth2,
        panelHeight,
        panelHeight,
        true,
        DEPTH_COLOR_2
      ));
    }
  }
  
  // 计算LINKVIEW内容需要向下偏移的距离
  const linkviewOffset = gciTopHeight + (gciTopHeight > 0 ? spaceBetweenPanels : 0);
  
  // 将LINKVIEW内容向下偏移（通过g元素和transform）
  const offsetSvgContent = linkviewOffset > 0
    ? `<g transform="translate(0, ${linkviewOffset})">${svgContent}</g>`
    : svgContent;
  
  // 渲染辅助线
  const auxiliaryLinesSvg = renderAuxiliaryLines(options, layout, adjustedHeight);
  
  // 组合所有SVG内容：GCI顶层、LINKVIEW（偏移后）、辅助线
  const finalSvgContent = [
    ...gciSvgContents,
    offsetSvgContent,
    ...auxiliaryLinesSvg,
  ].join('\n');
  
  // 构建新的SVG，更新height属性
  const newSvgAttrs = svgAttrs
    .replace(/height="[^"]*"/, `height="${adjustedHeight}"`)
    .replace(/width="[^"]*"/, `width="${width}"`);
  
  return `<svg ${newSvgAttrs}>${finalSvgContent}</svg>`;
}

