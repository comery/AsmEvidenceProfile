import React, { useState } from 'react';
import { Upload, Button, Space, Typography, Input, message } from 'antd';
import { UploadOutlined, ImportOutlined, ClearOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Text } = Typography;

export interface KaryotypeInputProps {
  onImport: (chromosomes: string[], content: string) => void;
  onContentChange?: (content: string) => void;
}

function parseKaryotype(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const ids: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue;
    // 取第一列作为染色体ID（按空格/制表符分隔）
    const id = trimmed.split(/\s+/)[0];
    if (id) ids.push(id);
  }
  // 去重并保持顺序
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      uniq.push(id);
    }
  }
  return uniq;
}

const KaryotypeInput: React.FC<KaryotypeInputProps> = ({ onImport, onContentChange }) => {
  const [fileText, setFileText] = useState<string>('');

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="small">
      <Text strong>karyotype.txt：</Text>
      <Upload
        accept=".txt,.tsv,.csv"
        beforeUpload={async (file) => {
          try {
            const text = await file.text();
            setFileText(text);
            onContentChange?.(text);
          } catch (e) {
            message.error('读取文件失败');
          }
          return false;
        }}
        maxCount={1}
        showUploadList={false}
      >
        <Button icon={<UploadOutlined />} size="small">上传 karyotype.txt</Button>
      </Upload>
      <TextArea
        rows={6}
        value={fileText}
        onChange={(e) => {
          setFileText(e.target.value);
          onContentChange?.(e.target.value);
        }}
        placeholder="粘贴或编辑 karyotype 内容，每行第一列为染色体ID"
        style={{ fontFamily: 'monospace' }}
      />
      <Space>
        <Button
          type="primary"
          icon={<ImportOutlined />}
          size="small"
          onClick={() => {
            const chrs = parseKaryotype(fileText || '');
            if (chrs.length === 0) {
              message.warning('未解析到任何染色体ID');
              return;
            }
            onImport(chrs, fileText);
          }}
        >导入</Button>
        <Button
          icon={<ClearOutlined />}
          size="small"
          onClick={() => setFileText('')}
        >清空</Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          解析规则：按行取第一列作为染色体ID，忽略空行与以#开头的注释。
        </Text>
      </Space>
    </Space>
  );
};

export default KaryotypeInput;