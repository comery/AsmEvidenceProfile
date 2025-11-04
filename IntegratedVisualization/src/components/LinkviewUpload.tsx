import React from 'react';
import { Upload, Button, Space, Typography } from 'antd';
import { UploadOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import './UploadComponents.css';

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
    <div className="upload-wrapper">
      <Upload
        accept=".out,.txt,.tsv,.csv,.paf"
        fileList={fileList}
        onChange={({ fileList }) => onChange?.(fileList)}
        beforeUpload={() => false}
        maxCount={1}
        showUploadList={false}
      >
        <div className="upload-button">
          <UploadOutlined style={{ fontSize: 16 }} />
          <span>上传比对文件</span>
        </div>
      </Upload>
      {fileList.length > 0 && fileList[0] && (
        <div className="file-info-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <FileTextOutlined style={{ color: '#667eea', fontSize: 16 }} />
            <span className="file-name">{fileList[0].name}</span>
          </div>
          <button className="remove-button" onClick={onRemove} title="清除">
            <DeleteOutlined />
          </button>
        </div>
      )}
      <div className="help-text">
        支持 BLAST、minimap2、MUMmer 等输出；也可使用 LINKVIEW2 专属格式。
      </div>
    </div>
  );
};

export default LinkviewUpload;