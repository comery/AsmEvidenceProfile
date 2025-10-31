/**
 * GCI深度数据解析器
 * 解析GCI生成的.depth.gz文件格式
 * 格式：>chromosome名称，然后是每行一个深度值
 */

import { ungzip } from 'pako';

export interface GciDepthData {
  [chromosome: string]: number[];
}

export interface ChromosomeLength {
  [chromosome: string]: number;
}

/**
 * 解析gzip压缩的深度文件
 * @param gzippedData 压缩的二进制数据
 * @returns 解析后的深度数据字典
 */
export async function parseDepthFile(gzippedData: Uint8Array): Promise<{
  depths: GciDepthData;
  lengths: ChromosomeLength;
}> {
  // 解压数据
  const decompressed = ungzip(gzippedData);
  const text = new TextDecoder('utf-8').decode(decompressed);
  
  const depths: GciDepthData = {};
  const lengths: ChromosomeLength = {};
  let currentChromosome = '';
  
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (trimmed.startsWith('>')) {
      // 新的染色体开始
      if (currentChromosome) {
        // 保存前一个染色体的长度
        lengths[currentChromosome] = depths[currentChromosome].length;
      }
      currentChromosome = trimmed.slice(1); // 移除 '>' 前缀
      depths[currentChromosome] = [];
    } else {
      // 深度值
      if (currentChromosome) {
        const depth = parseInt(trimmed, 10);
        if (!isNaN(depth)) {
          depths[currentChromosome].push(depth);
        }
      }
    }
  }
  
  // 保存最后一个染色体的长度
  if (currentChromosome) {
    lengths[currentChromosome] = depths[currentChromosome].length;
  }
  
  return { depths, lengths };
}

/**
 * 计算滑动窗口平均深度
 * @param depths 深度数组
 * @param windowSize 窗口大小（bp）
 * @param start 起始位置（用于计算绝对位置）
 * @returns [位置数组（Mb）, 平均深度数组]
 */
export function slidingWindowAverage(
  depths: number[],
  windowSize: number = 50000,
  start: number = 0
): [number[], number[]] {
  const positions: number[] = [];
  const averages: number[] = [];
  const windowDepths: number[] = [];
  
  if (depths.length < windowSize) {
    // 如果深度数组长度小于窗口大小，使用1bp窗口
    windowSize = 1;
  }
  
  for (let i = 0; i < depths.length; i++) {
    const depth = depths[i];
    
    if (depth === 0) {
      // 遇到0深度，先处理累积的窗口
      if (windowDepths.length > 0) {
        const avg = windowDepths.reduce((a, b) => a + b, 0) / windowDepths.length;
        averages.push(avg);
        positions.push((i + start - 1) / 1e6);
        windowDepths.length = 0;
      }
      averages.push(0);
      positions.push((i + start) / 1e6);
    } else {
      windowDepths.push(depth);
      if (windowDepths.length === windowSize) {
        const avg = windowDepths.reduce((a, b) => a + b, 0) / windowSize;
        averages.push(avg);
        positions.push((i + start) / 1e6);
        windowDepths.length = 0;
      }
    }
  }
  
  // 处理剩余的窗口
  if (windowDepths.length > 0) {
    const avg = windowDepths.reduce((a, b) => a + b, 0) / windowDepths.length;
    averages.push(avg);
    positions.push((depths.length - 1 + start) / 1e6);
  }
  
  return [positions, averages];
}

/**
 * 计算平均深度值
 * @param depths 深度字典
 * @returns 平均深度值
 */
export function calculateMeanDepth(depths: GciDepthData): number {
  const allDepths: number[] = [];
  for (const chromosome in depths) {
    allDepths.push(...depths[chromosome]);
  }
  if (allDepths.length === 0) return 0;
  return allDepths.reduce((a, b) => a + b, 0) / allDepths.length;
}

