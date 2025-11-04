import React from 'react';
import { Upload, Space, Typography, Button } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { DeleteOutlined } from '@ant-design/icons';

const { Text } = Typography;

export type PerChromosomeFiles = Record<string, {
  hifiDepth: UploadFile[];
  hifiPaf: UploadFile[];
  nanoDepth: UploadFile[];
  nanoPaf: UploadFile[];
}>;

interface ChromosomeUploadPanelProps {
  chromosomes: string[];
  files: PerChromosomeFiles;
  onChange: (files: PerChromosomeFiles) => void;
}

const ChromosomeUploadPanel: React.FC<ChromosomeUploadPanelProps> = ({ chromosomes, files, onChange }) => {
  const updateFiles = (chr: string, key: keyof PerChromosomeFiles[string], list: UploadFile[]) => {
    const next: PerChromosomeFiles = { ...files };
    next[chr] = next[chr] || { hifiDepth: [], hifiPaf: [], nanoDepth: [], nanoPaf: [] };
    next[chr][key] = list;
    onChange(next);
  };

  const clearFiles = (chr: string, key: keyof PerChromosomeFiles[string]) => {
    const next: PerChromosomeFiles = { ...files };
    next[chr] = next[chr] || { hifiDepth: [], hifiPaf: [], nanoDepth: [], nanoPaf: [] };
    next[chr][key] = [];
    onChange(next);
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="small">
      <Text strong>按染色体上传文件：</Text>
      <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(4, 1fr)', gap: 8 }}>
        <div />
        <Text>HiFi depth</Text>
        <Text>HiFi PAF</Text>
        <Text>Nano depth</Text>
        <Text>Nano PAF</Text>
        {chromosomes.map((chr) => {
          const record = files[chr] || { hifiDepth: [], hifiPaf: [], nanoDepth: [], nanoPaf: [] };
          return (
            <React.Fragment key={chr}>
              <Text style={{ alignSelf: 'center' }}>{chr}</Text>
              <div>
                <Upload
                  accept=".gz,.depth,.txt,.bed"
                  fileList={record.hifiDepth}
                  beforeUpload={() => false}
                  onChange={({ fileList }) => updateFiles(chr, 'hifiDepth', fileList)}
                  maxCount={1}
                >
                  <Button size="small">选择</Button>
                </Upload>
                {record.hifiDepth.length > 0 && (
                  <Button type="link" icon={<DeleteOutlined />} size="small" danger onClick={() => clearFiles(chr, 'hifiDepth')}>清除</Button>
                )}
              </div>
              <div>
                <Upload
                  accept=".paf,.out,.tsv"
                  fileList={record.hifiPaf}
                  beforeUpload={() => false}
                  onChange={({ fileList }) => updateFiles(chr, 'hifiPaf', fileList)}
                  maxCount={1}
                >
                  <Button size="small">选择</Button>
                </Upload>
                {record.hifiPaf.length > 0 && (
                  <Button type="link" icon={<DeleteOutlined />} size="small" danger onClick={() => clearFiles(chr, 'hifiPaf')}>清除</Button>
                )}
              </div>
              <div>
                <Upload
                  accept=".gz,.depth,.txt,.bed"
                  fileList={record.nanoDepth}
                  beforeUpload={() => false}
                  onChange={({ fileList }) => updateFiles(chr, 'nanoDepth', fileList)}
                  maxCount={1}
                >
                  <Button size="small">选择</Button>
                </Upload>
                {record.nanoDepth.length > 0 && (
                  <Button type="link" icon={<DeleteOutlined />} size="small" danger onClick={() => clearFiles(chr, 'nanoDepth')}>清除</Button>
                )}
              </div>
              <div>
                <Upload
                  accept=".paf,.out,.tsv"
                  fileList={record.nanoPaf}
                  beforeUpload={() => false}
                  onChange={({ fileList }) => updateFiles(chr, 'nanoPaf', fileList)}
                  maxCount={1}
                >
                  <Button size="small">选择</Button>
                </Upload>
                {record.nanoPaf.length > 0 && (
                  <Button type="link" icon={<DeleteOutlined />} size="small" danger onClick={() => clearFiles(chr, 'nanoPaf')}>清除</Button>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <Text type="secondary" style={{ fontSize: 12 }}>
        至少为任一染色体提供一个 depth 文件（HiFi/Nano）。
      </Text>
    </Space>
  );
};

export default ChromosomeUploadPanel;