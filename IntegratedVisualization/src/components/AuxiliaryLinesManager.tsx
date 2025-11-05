import React, { useState } from 'react';
import { InputNumber, Button, Space, Typography, List } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import './UploadComponents.css';

const { Text } = Typography;

interface AuxiliaryLinesManagerProps {
  lines: number[];
  onChange: (lines: number[]) => void;
}

const AuxiliaryLinesManager: React.FC<AuxiliaryLinesManagerProps> = ({
  lines,
  onChange,
}) => {
  const [newLinePos, setNewLinePos] = useState<number | null>(null);

  const handleAdd = () => {
    if (newLinePos !== null && !lines.includes(newLinePos)) {
      onChange([...lines, newLinePos].sort((a, b) => a - b));
      setNewLinePos(null);
    }
  };

  const handleRemove = (pos: number) => {
    onChange(lines.filter(p => p !== pos));
  };

  const formatPosition = (pos: number): string => {
    if (pos >= 1e6) {
      return `${(pos / 1e6).toFixed(2)} Mb`;
    } else if (pos >= 1e3) {
      return `${(pos / 1e3).toFixed(0)} Kb`;
    }
    return `${pos} bp`;
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div className="input-group">
        <div className="rounded-input" style={{ width: '100%', display: 'flex', alignItems: 'center' }}>
          <InputNumber
            placeholder="输入位置 (bp)"
            value={newLinePos}
            onChange={(value) => setNewLinePos(value == null || Number.isNaN(value) ? null : value)}
            style={{ width: '100%', border: 'none' }}
            controls={false}
            min={0}
            formatter={(value) => value ? formatPosition(Number(value)) : ''}
            parser={(value) => {
              if (!value) return NaN;
              // 解析 "42 Mb" 或 "42000000" 等格式
              const match = value.match(/^(\d+\.?\d*)\s*(Mb|Kb|bp)?$/i);
              if (match) {
                const num = parseFloat(match[1]);
                const unit = match[2]?.toLowerCase();
                if (unit === 'mb') return num * 1e6;
                if (unit === 'kb') return num * 1e3;
                return num;
              }
              const parsed = parseFloat(value);
              return Number.isNaN(parsed) ? NaN : parsed;
            }}
          />
        </div>
        <Button
          className="rounded-button rounded-button-primary rounded-button-circle-lg"
          icon={<PlusOutlined />}
          onClick={handleAdd}
          disabled={newLinePos === null}
        />
      </div>
      
      {lines.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {lines.map((pos, index) => (
            <div key={index} className="auxiliary-list-item">
              <span style={{ fontSize: 13, fontWeight: 500, color: '#262626' }}>
                {formatPosition(pos)}
              </span>
              <button
                className="remove-button"
                onClick={() => handleRemove(pos)}
                title="删除"
              >
                <DeleteOutlined />
              </button>
            </div>
          ))}
        </div>
      )}
    </Space>
  );
};

export default AuxiliaryLinesManager;

