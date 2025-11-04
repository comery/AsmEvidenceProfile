import React from 'react';
import { Upload, Button, Space, Typography } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';

const { Text } = Typography;

interface LinkviewUploadProps {
  fileList?: UploadFile[];
  onChange?: (fileList: UploadFile[]) => void;
  onRemove?: () => void;
  title?: string;
}

const LinkviewUpload: React.FC<LinkviewUploadProps> = ({
  fileList = [],
  onChange,
  onRemove,
  title,
}) => {
  return (
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      <Text strong>{title || 'LINKVIEW 比对文件：'}</Text>
      <Upload
        accept=".out,.txt,.tsv,.csv"
        fileList={fileList}
        onChange={({ fileList }) => onChange?.(fileList)}
        beforeUpload={() => false}
        maxCount={1}
      >
        <Button icon={<UploadOutlined />} size="small">
          上传比对文件
        </Button>
      </Upload>
      {fileList.length > 0 && (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          size="small"
          onClick={onRemove}
        >
          清除
        </Button>
      )}
      <Text type="secondary" style={{ fontSize: 12 }}>
        支持 BLAST、minimap2、MUMmer 等输出；也可使用 LINKVIEW2 专属格式。
      </Text>
    </Space>
  );
};

export default LinkviewUpload;