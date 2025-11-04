/**
 * 坐标映射工具
 * 用于在双坐标轴系统中进行坐标转换
 */

export interface ChromosomeTrack {
  chromosome: string;
  start: number;
  end: number;
  svgX: number;
  svgY: number;
  svgWidth: number;
  svgHeight: number;
}

export interface CoordinateMapping {
  // 从基因组坐标到SVG X坐标的映射
  genomicToSvgX: (chromosome: string, position: number) => number | null;
  // 从SVG X坐标到基因组坐标的映射
  svgXToGenomic: (chromosome: string, svgX: number) => number | null;
  // 获取染色体在SVG中的X范围
  getChromosomeXRange: (chromosome: string) => [number, number] | null;
}

/**
 * 创建坐标映射器
 * @param tracks 染色体轨道信息
 * @param zoom 当前缩放级别
 * @param panX 当前X轴平移
 */
export function createCoordinateMapper(
  tracks: ChromosomeTrack[],
  zoom: number = 1,
  panX: number = 0
): CoordinateMapping {
  const trackMap = new Map<string, ChromosomeTrack>();
  tracks.forEach(track => {
    trackMap.set(track.chromosome, track);
  });

  const genomicToSvgX = (chromosome: string, position: number): number | null => {
    const track = trackMap.get(chromosome);
    if (!track) return null;

    const { start, end, svgX, svgWidth } = track;
    const genomicLength = end - start;
    if (genomicLength <= 0) return null;

    // 计算相对位置（0-1）
    const relativePos = (position - start) / genomicLength;
    
    // 映射到SVG坐标（考虑缩放和平移）
    const baseX = svgX + relativePos * svgWidth;
    return baseX * zoom + panX;
  };

  const svgXToGenomic = (chromosome: string, svgX: number): number | null => {
    const track = trackMap.get(chromosome);
    if (!track) return null;

    const { start, end, svgX: trackX, svgWidth } = track;
    
    // 反向变换：先减去平移，再除以缩放
    const baseX = (svgX - panX) / zoom;
    
    // 计算相对位置
    const relativePos = (baseX - trackX) / svgWidth;
    if (relativePos < 0 || relativePos > 1) return null;

    const genomicLength = end - start;
    return start + relativePos * genomicLength;
  };

  const getChromosomeXRange = (chromosome: string): [number, number] | null => {
    const track = trackMap.get(chromosome);
    if (!track) return null;

    const { svgX, svgWidth } = track;
    const startX = svgX * zoom + panX;
    const endX = (svgX + svgWidth) * zoom + panX;
    return [startX, endX];
  };

  return {
    genomicToSvgX,
    svgXToGenomic,
    getChromosomeXRange,
  };
}

/**
 * 从SVG内容中提取染色体轨道信息
 */
export function extractTracksFromSvg(svgContent: string): ChromosomeTrack[] {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
  const tracks: ChromosomeTrack[] = [];

  // 查找所有class="chro"的rect元素
  const rects = svgDoc.querySelectorAll('rect.chro');
  rects.forEach(rect => {
    const x = parseFloat(rect.getAttribute('x') || '0');
    const y = parseFloat(rect.getAttribute('y') || '0');
    const width = parseFloat(rect.getAttribute('width') || '0');
    const height = parseFloat(rect.getAttribute('height') || '0');

    // 尝试从附近的text元素获取染色体名称
    let chromosome = '';
    const textElements = svgDoc.querySelectorAll('text.label');
    textElements.forEach(text => {
      const textX = parseFloat(text.getAttribute('x') || '0');
      const textY = parseFloat(text.getAttribute('y') || '0');
      // 如果text在rect附近，可能是标签
      if (Math.abs(textY - (y + height)) < 50 && Math.abs(textX - (x + width / 2)) < 100) {
        chromosome = text.textContent?.trim() || '';
      }
    });

    if (chromosome) {
      // 这里需要从karyotype或alignment数据中获取实际的start和end
      // 暂时使用占位值，实际应该从解析的数据中获取
      tracks.push({
        chromosome,
        start: 0,
        end: 1000000, // 占位值
        svgX: x,
        svgY: y,
        svgWidth: width,
        svgHeight: height,
      });
    }
  });

  return tracks;
}

