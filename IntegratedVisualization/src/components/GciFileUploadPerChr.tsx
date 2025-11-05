import React from 'react';
import { Upload, Space } from 'antd';
import { UploadOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import './UploadComponents.css';

interface GciFileUploadPerChrProps {
  hifiA?: UploadFile[];
  ontA?: UploadFile[];
  hifiB?: UploadFile[];
  ontB?: UploadFile[];
  onChangeHifiA?: (fileList: UploadFile[]) => void;
  onChangeOntA?: (fileList: UploadFile[]) => void;
  onChangeHifiB?: (fileList: UploadFile[]) => void;
  onChangeOntB?: (fileList: UploadFile[]) => void;
  onRemoveHifiA?: () => void;
  onRemoveOntA?: () => void;
  onRemoveHifiB?: () => void;
  onRemoveOntB?: () => void;
}

const GciFileUploadPerChr: React.FC<GciFileUploadPerChrProps> = ({
  hifiA = [],
  ontA = [],
  hifiB = [],
  ontB = [],
  onChangeHifiA,
  onChangeOntA,
  onChangeHifiB,
  onChangeOntB,
  onRemoveHifiA,
  onRemoveOntA,
  onRemoveHifiB,
  onRemoveOntB,
}) => {
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {/* 染色体A */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#595959', marginBottom: 8 }}>
          染色体 A
        </div>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div className="upload-item">
            <Upload
              accept=".gz,.depth,.txt,.bed"
              fileList={hifiA}
              onChange={({ fileList }) => onChangeHifiA?.(fileList)}
              beforeUpload={() => false}
              maxCount={1}
              showUploadList={false}
            >
              <div className="upload-button">
                <UploadOutlined style={{ fontSize: 16 }} />
                <span>上传 HiFi depth (A)</span>
              </div>
            </Upload>
            {hifiA.length > 0 && hifiA[0] && (
              <div className="file-info-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <FileTextOutlined style={{ color: '#667eea', fontSize: 16 }} />
                  <span className="file-name">{hifiA[0].name}</span>
                </div>
                <button className="remove-button" onClick={onRemoveHifiA} title="清除">
                  <DeleteOutlined />
                </button>
              </div>
            )}
          </div>
          
          <div className="upload-item">
            <Upload
              accept=".gz,.depth,.txt,.bed"
              fileList={ontA}
              onChange={({ fileList }) => onChangeOntA?.(fileList)}
              beforeUpload={() => false}
              maxCount={1}
              showUploadList={false}
            >
              <div className="upload-button">
                <UploadOutlined style={{ fontSize: 16 }} />
                <span>上传 ONT depth (A)</span>
              </div>
            </Upload>
            {ontA.length > 0 && ontA[0] && (
              <div className="file-info-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <FileTextOutlined style={{ color: '#667eea', fontSize: 16 }} />
                  <span className="file-name">{ontA[0].name}</span>
                </div>
                <button className="remove-button" onClick={onRemoveOntA} title="清除">
                  <DeleteOutlined />
                </button>
              </div>
            )}
          </div>
        </Space>
      </div>

      {/* 染色体B */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#595959', marginBottom: 8 }}>
          染色体 B
        </div>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div className="upload-item">
            <Upload
              accept=".gz,.depth,.txt,.bed"
              fileList={hifiB}
              onChange={({ fileList }) => onChangeHifiB?.(fileList)}
              beforeUpload={() => false}
              maxCount={1}
              showUploadList={false}
            >
              <div className="upload-button">
                <UploadOutlined style={{ fontSize: 16 }} />
                <span>上传 HiFi depth (B)</span>
              </div>
            </Upload>
            {hifiB.length > 0 && hifiB[0] && (
              <div className="file-info-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <FileTextOutlined style={{ color: '#667eea', fontSize: 16 }} />
                  <span className="file-name">{hifiB[0].name}</span>
                </div>
                <button className="remove-button" onClick={onRemoveHifiB} title="清除">
                  <DeleteOutlined />
                </button>
              </div>
            )}
          </div>
          
          <div className="upload-item">
            <Upload
              accept=".gz,.depth,.txt,.bed"
              fileList={ontB}
              onChange={({ fileList }) => onChangeOntB?.(fileList)}
              beforeUpload={() => false}
              maxCount={1}
              showUploadList={false}
            >
              <div className="upload-button">
                <UploadOutlined style={{ fontSize: 16 }} />
                <span>上传 ONT depth (B)</span>
              </div>
            </Upload>
            {ontB.length > 0 && ontB[0] && (
              <div className="file-info-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <FileTextOutlined style={{ color: '#667eea', fontSize: 16 }} />
                  <span className="file-name">{ontB[0].name}</span>
                </div>
                <button className="remove-button" onClick={onRemoveOntB} title="清除">
                  <DeleteOutlined />
                </button>
              </div>
            )}
          </div>
        </Space>
      </div>
    </Space>
  );
};

export default GciFileUploadPerChr;



