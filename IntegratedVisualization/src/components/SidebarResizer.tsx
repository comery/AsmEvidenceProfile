import React, { useRef, useEffect, useState } from 'react';
import './SidebarResizer.css';

interface SidebarResizerProps {
  onResize: (width: number) => void;
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

/**
 * 侧边栏宽度调整器
 * 允许用户通过拖拽来调整侧边栏宽度
 */
const SidebarResizer: React.FC<SidebarResizerProps> = ({
  onResize,
  initialWidth = 320,
  minWidth = 200,
  maxWidth = 600,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(initialWidth);
  const resizerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 从localStorage恢复宽度
    const savedWidth = localStorage.getItem('sidebar-width');
    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      if (width >= minWidth && width <= maxWidth) {
        onResize(width);
      }
    }
  }, [minWidth, maxWidth, onResize]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // 只处理左键
    setIsDragging(true);
    setStartX(e.clientX);
    const currentWidth = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width') || initialWidth.toString(),
      10
    );
    setStartWidth(currentWidth);
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
      
      onResize(newWidth);
      document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        const currentWidth = parseInt(
          getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width') || initialWidth.toString(),
          10
        );
        localStorage.setItem('sidebar-width', currentWidth.toString());
      }
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, startX, startWidth, minWidth, maxWidth, initialWidth, onResize]);

  return (
    <div
      ref={resizerRef}
      className={`sidebar-resizer ${isDragging ? 'dragging' : ''}`}
      onMouseDown={handleMouseDown}
      title="拖拽调整宽度"
    >
      <div className="resizer-handle" />
    </div>
  );
};

export default SidebarResizer;

