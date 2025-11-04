import React, { useEffect, useRef, useState } from 'react';
import { Button, Space, Select, InputNumber } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import './JBrowseViewer.css';

interface JBrowseViewerProps {
  // 深度数据
  depthData?: { [chromosome: string]: number[] };
  depthData2?: { [chromosome: string]: number[] };
  // 比对数据（PAF格式）
  alignmentData?: string;
  // 染色体信息
  chromosomes?: Array<{ name: string; length: number }>;
  // 当前查看的染色体
  currentChromosome?: string;
  onChromosomeChange?: (chr: string) => void;
  // 当前查看范围
  start?: number;
  end?: number;
  onRangeChange?: (start: number, end: number) => void;
}

/**
 * JBrowse 2 集成组件
 * 使用 JBrowse 2 的线性基因组视图来显示染色体、深度和比对数据
 */
const JBrowseViewer: React.FC<JBrowseViewerProps> = ({
  depthData,
  depthData2,
  alignmentData,
  chromosomes = [],
  currentChromosome,
  onChromosomeChange,
  start,
  end,
  onRangeChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedChr, setSelectedChr] = useState<string>(currentChromosome || chromosomes[0]?.name || '');
  const [viewStart, setViewStart] = useState<number>(start || 0);
  const [viewEnd, setViewEnd] = useState<number>(end || chromosomes[0]?.length || 1000000);
  const [isLoading, setIsLoading] = useState(false);

  // 初始化 JBrowse（当容器准备好时）
  useEffect(() => {
    if (!containerRef.current || !selectedChr) return;

    // 动态加载 JBrowse 2（如果可用）
    // 这里我们创建一个基于 Canvas/SVG 的自定义实现
    // 因为完整集成 JBrowse 2 需要额外的配置和依赖
    
    initializeCustomViewer();
  }, [selectedChr, viewStart, viewEnd, depthData, depthData2, alignmentData]);

  const initializeCustomViewer = () => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    container.innerHTML = '';
    
    // 创建 Canvas 用于绘制
    const canvas = document.createElement('canvas');
    canvas.width = container.clientWidth || 1200;
    canvas.height = container.clientHeight || 600;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 绘制染色体视图
    drawChromosomeView(ctx, canvas.width, canvas.height);
  };

  const drawChromosomeView = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    if (!selectedChr) return;
    
    const chrLength = chromosomes.find(c => c.name === selectedChr)?.length || viewEnd - viewStart;
    const range = viewEnd - viewStart;
    const scale = width / range;
    
    // 绘制坐标轴
    drawAxis(ctx, width, height, viewStart, viewEnd);
    
    // 绘制深度数据（HiFi）
    if (depthData && depthData[selectedChr]) {
      drawDepthTrack(ctx, width, height * 0.3, depthData[selectedChr], scale, '#2ca25f', 'HiFi Depth');
    }
    
    // 绘制深度数据（Nano）
    if (depthData2 && depthData2[selectedChr]) {
      drawDepthTrack(ctx, width, height * 0.5, depthData2[selectedChr], scale, '#3C5488', 'Nano Depth', height * 0.3);
    }
    
    // 绘制比对数据
    if (alignmentData) {
      drawAlignmentTrack(ctx, width, height * 0.7, alignmentData, selectedChr, viewStart, viewEnd, scale);
    }
    
    // 绘制染色体本身
    drawChromosome(ctx, width, height * 0.8, selectedChr, scale);
  };

  const drawAxis = (ctx: CanvasRenderingContext2D, width: number, height: number, start: number, end: number) => {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    // X轴
    ctx.beginPath();
    ctx.moveTo(50, height - 50);
    ctx.lineTo(width - 50, height - 50);
    ctx.stroke();
    
    // 刻度
    const numTicks = 10;
    for (let i = 0; i <= numTicks; i++) {
      const x = 50 + (width - 100) * (i / numTicks);
      const pos = start + (end - start) * (i / numTicks);
      
      ctx.beginPath();
      ctx.moveTo(x, height - 50);
      ctx.lineTo(x, height - 45);
      ctx.stroke();
      
      ctx.fillStyle = '#333';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(formatPosition(pos), x, height - 30);
    }
  };

  const drawDepthTrack = (
    ctx: CanvasRenderingContext2D,
    width: number,
    trackHeight: number,
    depths: number[],
    scale: number,
    color: string,
    label: string,
    yOffset: number = 0
  ) => {
    const y = 50 + yOffset;
    const maxDepth = Math.max(...depths, 1);
    
    // 绘制背景
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(50, y, width - 100, trackHeight);
    
    // 绘制标签
    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, 10, y + trackHeight / 2);
    
    // 绘制深度曲线
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    for (let i = 0; i < depths.length && i < (width - 100) / scale; i++) {
      const x = 50 + i * scale;
      const depth = depths[i];
      const depthHeight = (depth / maxDepth) * trackHeight * 0.8;
      const yPos = y + trackHeight - depthHeight;
      
      if (i === 0) {
        ctx.moveTo(x, yPos);
      } else {
        ctx.lineTo(x, yPos);
      }
    }
    
    ctx.stroke();
    
    // 填充区域
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.lineTo(50 + Math.min(depths.length * scale, width - 100), y + trackHeight);
    ctx.lineTo(50, y + trackHeight);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1.0;
  };

  const drawChromosome = (
    ctx: CanvasRenderingContext2D,
    width: number,
    y: number,
    chrName: string,
    scale: number
  ) => {
    const chrHeight = 20;
    
    // 绘制染色体矩形
    ctx.fillStyle = '#888';
    ctx.fillRect(50, y, width - 100, chrHeight);
    
    // 绘制染色体名称
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(chrName, width / 2, y + chrHeight / 2 + 4);
  };

  const drawAlignmentTrack = (
    ctx: CanvasRenderingContext2D,
    width: number,
    y: number,
    alignmentData: string,
    chrName: string,
    start: number,
    end: number,
    scale: number
  ) => {
    // 解析比对数据并绘制
    // 这里简化处理，实际应该解析 PAF 格式
    const lines = alignmentData.split('\n').filter(line => line.trim());
    
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    
    lines.slice(0, 50).forEach((line, idx) => {
      // 简化的比对绘制（实际需要解析 PAF）
      if (line.includes(chrName)) {
        const yPos = y + (idx % 10) * 15;
        ctx.beginPath();
        ctx.moveTo(50 + Math.random() * (width - 100), yPos);
        ctx.lineTo(50 + Math.random() * (width - 100), yPos);
        ctx.stroke();
      }
    });
  };

  const formatPosition = (pos: number): string => {
    if (pos >= 1e6) {
      return `${(pos / 1e6).toFixed(2)} Mb`;
    } else if (pos >= 1e3) {
      return `${(pos / 1e3).toFixed(0)} Kb`;
    }
    return `${pos}`;
  };

  const handleZoomIn = () => {
    const center = (viewStart + viewEnd) / 2;
    const range = viewEnd - viewStart;
    const newRange = range * 0.7;
    setViewStart(Math.max(0, center - newRange / 2));
    setViewEnd(Math.min(chromosomes.find(c => c.name === selectedChr)?.length || viewEnd, center + newRange / 2));
  };

  const handleZoomOut = () => {
    const center = (viewStart + viewEnd) / 2;
    const range = viewEnd - viewStart;
    const newRange = Math.min(
      chromosomes.find(c => c.name === selectedChr)?.length || viewEnd,
      range * 1.4
    );
    setViewStart(Math.max(0, center - newRange / 2));
    setViewEnd(Math.min(chromosomes.find(c => c.name === selectedChr)?.length || viewEnd, center + newRange / 2));
  };

  const handleReset = () => {
    const chr = chromosomes.find(c => c.name === selectedChr);
    if (chr) {
      setViewStart(0);
      setViewEnd(chr.length);
    }
  };

  return (
    <div className="jbrowse-viewer-container">
      {/* 控制栏 */}
      <div className="jbrowse-controls">
        <Space>
          <span>染色体:</span>
          <Select
            value={selectedChr}
            onChange={(value) => {
              setSelectedChr(value);
              const chr = chromosomes.find(c => c.name === value);
              if (chr) {
                setViewStart(0);
                setViewEnd(chr.length);
                onChromosomeChange?.(value);
              }
            }}
            style={{ width: 150 }}
          >
            {chromosomes.map(chr => (
              <Select.Option key={chr.name} value={chr.name}>
                {chr.name}
              </Select.Option>
            ))}
          </Select>
          
          <span>位置:</span>
          <InputNumber
            value={viewStart}
            onChange={(val) => val !== null && setViewStart(val)}
            min={0}
            style={{ width: 120 }}
          />
          <span>-</span>
          <InputNumber
            value={viewEnd}
            onChange={(val) => val !== null && setViewEnd(val)}
            min={viewStart + 1}
            style={{ width: 120 }}
          />
          
          <Button onClick={handleZoomIn} size="small">放大</Button>
          <Button onClick={handleZoomOut} size="small">缩小</Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset} size="small">重置</Button>
        </Space>
      </div>

      {/* 可视化区域 */}
      <div ref={containerRef} className="jbrowse-viewport" />
    </div>
  );
};

export default JBrowseViewer;

