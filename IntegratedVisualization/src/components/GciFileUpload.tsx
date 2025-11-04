import React from 'react';
import { Upload, Button, Space, Typography } from 'antd';
import { UploadOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import './UploadComponents.css';

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
      <div className="upload-item">
        <Upload
          accept=".gz,.depth,.txt,.bed"
          fileList={fileList1}
          onChange={({ fileList }) => onChange1?.(fileList)}
          beforeUpload={() => false}
          maxCount={1}
          showUploadList={false}
        >
          <div className="upload-button">
            <UploadOutlined style={{ fontSize: 16 }} />
            <span>上传 HiFi depth 文件</span>
          </div>
        </Upload>
        {fileList1.length > 0 && fileList1[0] && (
          <div className="file-info-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <FileTextOutlined style={{ color: '#667eea', fontSize: 16 }} />
              <span className="file-name">{fileList1[0].name}</span>
            </div>
            <button className="remove-button" onClick={onRemove1} title="清除">
              <DeleteOutlined />
            </button>
          </div>
        )}
      </div>
      
      <div className="upload-item">
        <Upload
          accept=".gz,.depth,.txt,.bed"
          fileList={fileList2}
          onChange={({ fileList }) => onChange2?.(fileList)}
          beforeUpload={() => false}
          maxCount={1}
          showUploadList={false}
        >
          <div className="upload-button">
            <UploadOutlined style={{ fontSize: 16 }} />
            <span>上传 Nano depth 文件</span>
          </div>
        </Upload>
        {fileList2.length > 0 && fileList2[0] && (
          <div className="file-info-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <FileTextOutlined style={{ color: '#667eea', fontSize: 16 }} />
              <span className="file-name">{fileList2[0].name}</span>
            </div>
            <button className="remove-button" onClick={onRemove2} title="清除">
              <DeleteOutlined />
            </button>
          </div>
        )}
      </div>
    </Space>
  );
};

export default GciFileUpload;

