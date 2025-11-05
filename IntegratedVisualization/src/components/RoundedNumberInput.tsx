import React from 'react';
import { InputNumber, Button } from 'antd';
import './UploadComponents.css';

interface RoundedNumberInputProps {
  value?: number | null;
  onChange?: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  formatter?: (value: number | string | undefined) => string;
  parser?: (value: string | undefined) => number;
}

const clamp = (val: number, min?: number, max?: number) => {
  if (min !== undefined) val = Math.max(min, val);
  if (max !== undefined) val = Math.min(max, val);
  return val;
};

const RoundedNumberInput: React.FC<RoundedNumberInputProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  formatter,
  parser,
}) => {
  const current = typeof value === 'number' ? value : (min ?? 0);

  const handleDecrease = () => {
    const next = clamp(current - step, min, max);
    onChange?.(next);
  };

  const handleIncrease = () => {
    const next = clamp(current + step, min, max);
    onChange?.(next);
  };

  return (
    <div className="input-group number-input-group">
      <Button
        className="rounded-button rounded-button-secondary rounded-button-circle"
        onClick={handleDecrease}
      >
        −
      </Button>
      <div className="rounded-input" style={{ width: '100%', display: 'flex', alignItems: 'center' }}>
        <InputNumber
          value={value as number | undefined}
          onChange={(v) => onChange?.(v == null || Number.isNaN(v as number) ? null : (v as number))}
          controls={false}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          formatter={formatter}
          parser={parser}
          style={{ width: '100%', border: 'none' }}
        />
      </div>
      <Button
        className="rounded-button rounded-button-primary rounded-button-circle"
        onClick={handleIncrease}
      >
        +
      </Button>
    </div>
  );
};

export default RoundedNumberInput;