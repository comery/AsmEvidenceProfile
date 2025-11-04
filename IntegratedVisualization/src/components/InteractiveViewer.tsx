import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button, Space, Slider } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, ReloadOutlined } from '@ant-design/icons';
import './InteractiveViewer.css';

interface InteractiveViewerProps {
  svgContent: string;
  onZoomChange?: (zoom: number) => void;
  onPanChange?: (panX: number, panY: number) => void;
}

/**
 * 可交互的SVG查看器组件
 * 支持缩放、平移、双坐标轴显示
 */
const InteractiveViewer: React.FC<InteractiveViewerProps> = ({
  svgContent,
  onZoomChange,
  onPanChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [originalPan, setOriginalPan] = useState({ x: 0, y: 0 });

  // 更新SVG内容
  useEffect(() => {
    if (!containerRef.current || !svgContent) return;

    const container = containerRef.current;
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;

    // 检查解析错误
    const parserError = svgDoc.querySelector('parsererror');
    if (parserError) {
      console.error('SVG parsing error:', parserError.textContent);
      return;
    }

    // 清空容器
    container.innerHTML = '';
    
    // 获取原始SVG的尺寸
    const originalWidth = svgElement.getAttribute('width') || '1200';
    const originalHeight = svgElement.getAttribute('height') || '800';
    
    // 创建外层SVG容器
    const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    wrapper.setAttribute('width', '100%');
    wrapper.setAttribute('height', '100%');
    wrapper.setAttribute('viewBox', `0 0 ${originalWidth} ${originalHeight}`);
    wrapper.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    wrapper.style.display = 'block';

    // 创建g元素用于变换
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'zoom-pan-group');
    
    // 复制原始SVG的内容（除了外层svg标签）
    Array.from(svgElement.children).forEach(child => {
      g.appendChild(child.cloneNode(true));
    });

    wrapper.appendChild(g);
    container.appendChild(wrapper);
    
    svgRef.current = wrapper;

    // 更新变换
    const updateTransform = () => {
      if (g) {
        g.setAttribute('transform', `translate(${panX}, ${panY}) scale(${zoom})`);
      }
    };
    updateTransform();
  }, [svgContent, zoom, panX, panY]);

  // 缩放控制
  const handleZoomIn = useCallback(() => {
    setZoom(prev => {
      const newZoom = Math.min(prev * 1.2, 10);
      onZoomChange?.(newZoom);
      return newZoom;
    });
  }, [onZoomChange]);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => {
      const newZoom = Math.max(prev / 1.2, 0.1);
      onZoomChange?.(newZoom);
      return newZoom;
    });
  }, [onZoomChange]);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
    onZoomChange?.(1);
    onPanChange?.(0, 0);
  }, [onZoomChange, onPanChange]);

  const handleZoomSliderChange = useCallback((value: number) => {
    setZoom(value);
    onZoomChange?.(value);
  }, [onZoomChange]);

  // 鼠标拖动平移
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // 只处理左键
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setIsDragging(true);
    // 保存鼠标相对于容器的初始位置和当前的平移值
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    setDragStart({ x: startX, y: startY });
    setOriginalPan({ x: panX, y: panY });
    e.preventDefault();
  }, [panX, panY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    // 计算鼠标移动的delta，并考虑缩放
    const deltaX = (currentX - dragStart.x) / zoom;
    const deltaY = (currentY - dragStart.y) / zoom;
    
    const newPanX = originalPan.x + deltaX;
    const newPanY = originalPan.y + deltaY;
    
    setPanX(newPanX);
    setPanY(newPanY);
    onPanChange?.(newPanX, newPanY);
  }, [isDragging, dragStart, originalPan, zoom, onPanChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => {
      const newZoom = Math.max(0.1, Math.min(prev * delta, 10));
      onZoomChange?.(newZoom);
      return newZoom;
    });
  }, [onZoomChange]);

  return (
    <div className="interactive-viewer-container">
      {/* 控制栏 */}
      <div className="viewer-controls">
        <Space>
          <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} size="small">
            放大
          </Button>
          <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} size="small">
            缩小
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleZoomReset} size="small">
            重置
          </Button>
          <span style={{ marginLeft: 8 }}>缩放: </span>
          <Slider
            min={0.1}
            max={10}
            step={0.1}
            value={zoom}
            onChange={handleZoomSliderChange}
            style={{ width: 150 }}
            tooltip={{ formatter: (value) => `${((value || 1) * 100).toFixed(0)}%` }}
          />
          <span>{((zoom * 100).toFixed(0))}%</span>
        </Space>
      </div>

      {/* SVG容器 */}
      <div
        ref={containerRef}
        className="svg-viewer-container"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      />
    </div>
  );
};

export default InteractiveViewer;

