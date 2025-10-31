import React from 'react';
import { Upload, Button, Space, Typography } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';

const { Text } = Typography;

interface GciFileUploadProps {
  fileList1?: UploadFile[];
  fileList2?: UploadFile[];
  onChange1?: (fileList: UploadFile[]) => void;
  onChange2?: (fileList: UploadFile[]) => void;
  onRemove1?: () => void;
  onRemove2?: () => void;
}

const GciFileUpload: React.FC<GciFileUploadProps> = ({
  fileList1 = [],
  fileList2 = [],
  onChange1,
  onChange2,
  onRemove1,
  onRemove2,
}) => {
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Text strong>GCI深度文件 (HiFi):</Text>
        <Upload
          accept=".gz"
          fileList={fileList1}
          onChange={({ fileList }) => onChange1?.(fileList)}
          beforeUpload={() => false}
          maxCount={1}
        >
          <Button icon={<UploadOutlined />} size="small" style={{ marginLeft: 8 }}>
            上传 .depth.gz 文件
          </Button>
        </Upload>
        {fileList1.length > 0 && (
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            size="small"
            onClick={onRemove1}
          >
            清除
          </Button>
        )}
      </div>
      
      <div>
        <Text strong>GCI深度文件 (Nano，可选):</Text>
        <Upload
          accept=".gz"
          fileList={fileList2}
          onChange={({ fileList }) => onChange2?.(fileList)}
          beforeUpload={() => false}
          maxCount={1}
        >
          <Button icon={<UploadOutlined />} size="small" style={{ marginLeft: 8 }}>
            上传 .depth.gz 文件
          </Button>
        </Upload>
        {fileList2.length > 0 && (
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            size="small"
            onClick={onRemove2}
          >
            清除
          </Button>
        )}
      </div>
    </Space>
  );
};

export default GciFileUpload;

