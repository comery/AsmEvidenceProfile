import React, { useState } from 'react';
import './App.css';
import { PageHeader, Row, Col, Alert, Form, Input, Button, Collapse, InputNumber, Space, Divider, message } from 'antd';
import { GithubOutlined, DownloadOutlined } from '@ant-design/icons';
import GciFileUpload from './components/GciFileUpload';
import LinkviewUpload from './components/LinkviewUpload';
import KaryotypeInput from './components/KaryotypeInput';
import AuxiliaryLinesManager from './components/AuxiliaryLinesManager';
import { extendedMain, ExtendedOptions } from './utils/linkviewWrapper';
import { parseDepthFile, calculateMeanDepth } from './utils/gciParser';
import initOptions from './utils/initOptions';
import type { UploadFile } from 'antd/es/upload/interface';

const { TextArea } = Input;
const { Panel } = Collapse;

function App() {
  const [svg, setSvg] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [form] = Form.useForm();
  const [gciFile1, setGciFile1] = useState<UploadFile[]>([]);
  const [gciFile2, setGciFile2] = useState<UploadFile[]>([]);
  const [gciDepthData, setGciDepthData] = useState<{ [chromosome: string]: number[] } | undefined>();
  const [gciDepthData2, setGciDepthData2] = useState<{ [chromosome: string]: number[] } | undefined>();
  const [auxiliaryLines, setAuxiliaryLines] = useState<number[]>([]);
  const [linkviewFiles, setLinkviewFiles] = useState<UploadFile[]>([]);
  const [hifiPafFiles, setHifiPafFiles] = useState<UploadFile[]>([]);
  const [nanoPafFiles, setNanoPafFiles] = useState<UploadFile[]>([]);
  const [linkviewInputContent, setLinkviewInputContent] = useState<string>('');
  const [karyotypeContent, setKaryotypeContent] = useState<string>('');
  // 统一输入逻辑后，不再需要按染色体上传

  // 处理GCI文件上传
  const handleGciFile1Change = async (fileList: UploadFile[]) => {
    setGciFile1(fileList);
    if (fileList.length > 0 && fileList[0].originFileObj) {
      try {
        const file = fileList[0].originFileObj;
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const { depths } = await parseDepthFile(uint8Array);
        setGciDepthData(depths);
      } catch (error) {
        console.error('Error parsing GCI file 1:', error);
        setErrMsg(`Error parsing GCI file 1: ${(error as Error).message}`);
      }
    } else {
      setGciDepthData(undefined);
    }
  };

  const handleGciFile2Change = async (fileList: UploadFile[]) => {
    setGciFile2(fileList);
    if (fileList.length > 0 && fileList[0].originFileObj) {
      try {
        const file = fileList[0].originFileObj;
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const { depths } = await parseDepthFile(uint8Array);
        setGciDepthData2(depths);
      } catch (error) {
        console.error('Error parsing GCI file 2:', error);
        setErrMsg(`Error parsing GCI file 2: ${(error as Error).message}`);
      }
    } else {
      setGciDepthData2(undefined);
    }
  };

  const onSubmit = async (values: any) => {
    // 校验：至少一个 depth 来源（HiFi/Nano 其中之一）
    const hasGlobalDepth = gciFile1.length > 0 || gciFile2.length > 0;
    if (!hasGlobalDepth) {
      message.error('请至少提供一个 depth 文件（HiFi 或 Nano）');
      return;
    }
    // 整理对齐输入：合并用户粘贴与两个 PAF 上传内容
    let combinedAlignments = linkviewInputContent || values.inputContent || '';
    const pafFiles: UploadFile[] = [hifiPafFiles[0], nanoPafFiles[0]].filter(Boolean) as UploadFile[];
    for (const uf of pafFiles) {
      if (uf.originFileObj) {
        const text = await (uf.originFileObj as File).text();
        combinedAlignments += (combinedAlignments ? '\n' : '') + text;
      }
    }

    const options: ExtendedOptions = {
      ...initOptions,
      ...values,
      inputContent: combinedAlignments,
      // 使用已导入的 karyotype 内容（来自组件状态）
      karyotypeContent: karyotypeContent || '',
      highlightContent: values.highlightContent || '',
      gffContent: values.gffContent || '',
      parameterContent: values.parameterContent || '',
      svg_content_width: (values.svg_width || initOptions.svg_width) * (1 - (values.svg_space || initOptions.svg_space)),
    };
    
    // 添加 GCI 数据（统一为全局合并文件）
    if (gciDepthData && Object.keys(gciDepthData).length > 0) {
      options.gciDepthData = gciDepthData;
      const meanDepth1 = calculateMeanDepth(gciDepthData);
      if (gciDepthData2 && Object.keys(gciDepthData2).length > 0) {
        options.gciDepthData2 = gciDepthData2;
        const meanDepth2 = calculateMeanDepth(gciDepthData2);
        options.gciMeanDepths = [meanDepth1, meanDepth2];
      } else {
        options.gciMeanDepths = [meanDepth1];
      }
    }
    
    // 添加辅助线
    if (auxiliaryLines.length > 0) {
      options.auxiliaryLines = auxiliaryLines;
    }
    
    console.log('options', options);
    try {
      const svg = await extendedMain(options) || '';
      setSvg(svg);
      setErrMsg('');
    } catch(error) {
      console.log((error as Error).message);
      setSvg('');
      setErrMsg((error as Error).message);
    }
  };

  // karyotype 内容更新（无需生成染色体列表）
  const handleImportKaryotype = (_chrs: string[], content: string) => {
    setKaryotypeContent(content);
  };

  // 读取 LINKVIEW 上传文件
  const handleLinkviewFileChange = async (fileList: UploadFile[]) => {
    setLinkviewFiles(fileList);
    if (fileList.length > 0 && fileList[0].originFileObj) {
      const file = fileList[0].originFileObj as File;
      const text = await file.text();
      setLinkviewInputContent(text);
    } else {
      setLinkviewInputContent('');
    }
  };

  const handleHifiPafChange = async (fileList: UploadFile[]) => {
    setHifiPafFiles(fileList);
  };
  const handleNanoPafChange = async (fileList: UploadFile[]) => {
    setNanoPafFiles(fileList);
  };

  return (
    <div className="App">
      <PageHeader
        className="head"
        title="Integrated Visualization"
        subTitle="整合GCI深度图和LINKVIEW比对关系的可视化工具"
      >
        <p className="supplement">
          本工具可以同时可视化GCI深度数据和LINKVIEW比对关系，并通过基因组坐标进行对齐。
        </p>
      </PageHeader>

      {/* 顶部参数区（紧凑布局） */}
      <Row className="main-container" gutter={[12, 12]}>
        <Col span={22} offset={1}>
          <Form
            form={form}
            onFinish={onSubmit}
            autoComplete="off"
            size="small"
            layout="vertical"
          >
            {/* karyotype 输入（直接接收文本或文件，无需生成染色体列表） */}
            <Form.Item label="karyotype">
              <KaryotypeInput onImport={handleImportKaryotype} onContentChange={setKaryotypeContent} />
            </Form.Item>

            {/* 全局深度文件上传（HiFi/Nano） */}
            <Form.Item label="GCI深度数据">
              <GciFileUpload
                fileList1={gciFile1}
                fileList2={gciFile2}
                onChange1={handleGciFile1Change}
                onChange2={handleGciFile2Change}
                onRemove1={() => {
                  setGciFile1([]);
                  setGciDepthData(undefined);
                }}
                onRemove2={() => {
                  setGciFile2([]);
                  setGciDepthData2(undefined);
                }}
              />
            </Form.Item>

            {/* LINKVIEW 比对文件上传：HiFi 与 Nano 分开入口 */}
            <Form.Item label="HiFi PAF">
              <LinkviewUpload
                title="HiFi PAF/比对文件："
                fileList={hifiPafFiles}
                onChange={handleHifiPafChange}
                onRemove={() => setHifiPafFiles([])}
              />
            </Form.Item>
            <Form.Item label="Nano PAF（可选）">
              <LinkviewUpload
                title="Nano PAF/比对文件："
                fileList={nanoPafFiles}
                onChange={handleNanoPafChange}
                onRemove={() => setNanoPafFiles([])}
              />
            </Form.Item>

            {/* 额外：合并或粘贴的比对数据入口（保持兼容） */}
            <Form.Item label="额外比对数据（可选）">
              <LinkviewUpload
                title="附加比对文件（合并到输入内容）："
                fileList={linkviewFiles}
                onChange={handleLinkviewFileChange}
                onRemove={() => {
                  setLinkviewFiles([]);
                  setLinkviewInputContent('');
                }}
              />
            </Form.Item>

            {/* 辅助线管理 */}
            <Form.Item label="辅助线">
              <AuxiliaryLinesManager
                lines={auxiliaryLines}
                onChange={setAuxiliaryLines}
              />
            </Form.Item>

            {/* 可选：直接粘贴比对数据 */}
            <Collapse ghost>
              <Panel header="手动粘贴比对数据（可选）" key="paste">
                <Form.Item name="inputContent" initialValue={initOptions.inputContent}>
                  <TextArea rows={6} wrap="off" placeholder="每行一个比对关系" style={{ fontFamily: 'monospace' }} />
                </Form.Item>
              </Panel>
            </Collapse>

            {/* 折叠面板 */}
            <Collapse ghost>
              <Panel header="显示选项" key="1">
                <Form.Item
                  name="svg_width"
                  label="分辨率宽度 (px)"
                  initialValue={initOptions.svg_width}
                >
                  <InputNumber
                    min={100}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <Form.Item
                  name="svg_height"
                  label="基础高度 (px)"
                  initialValue={initOptions.svg_height}
                >
                  <InputNumber
                    min={100}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <Form.Item
                  name="svg_space"
                  label="左右边距比例"
                  initialValue={initOptions.svg_space}
                >
                  <InputNumber
                    min={0}
                    max={1}
                    step={0.1}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Panel>
              
              <Panel header="GCI选项" key="2">
                <Form.Item
                  name="gciDepthHeight"
                  label="GCI面板高度 (px)"
                  initialValue={initOptions.gciDepthHeight}
                >
                  <InputNumber
                    min={50}
                    max={500}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <Form.Item
                  name="gciWindowSize"
                  label="滑动窗口大小 (bp)"
                  initialValue={initOptions.gciWindowSize}
                >
                  <InputNumber
                    min={1}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <Form.Item
                  name="gciDepthMin"
                  label="最小深度倍数"
                  initialValue={initOptions.gciDepthMin}
                >
                  <InputNumber
                    min={0}
                    max={1}
                    step={0.1}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <Form.Item
                  name="gciDepthMax"
                  label="最大深度倍数"
                  initialValue={initOptions.gciDepthMax}
                >
                  <InputNumber
                    min={1}
                    max={10}
                    step={0.1}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Panel>
            </Collapse>

            <Form.Item>
              <Button type="primary" htmlType="submit" style={{ width: '100%' }}>
                生成可视化
              </Button>
            </Form.Item>
          </Form>
        </Col>
      </Row>

      <Divider style={{ margin: '8px 0' }} />

      {/* 底部可视化区 */}
      <Row className="main-container" gutter={[12, 12]}>
        <Col span={22} offset={1}>
          <div className="display-container">
            {errMsg ? (
              <Alert
                message="错误"
                description={<code style={{ whiteSpace: 'pre-wrap' }}>{errMsg}</code>}
                type="error"
                closable
                onClose={() => setErrMsg('')}
              />
            ) : svg ? (
              <>
                <a
                  href={`data:text/plain;charset=utf-8,${svg.replaceAll('#', '%23')}`}
                  download="visualization.svg"
                  className="download"
                >
                  <DownloadOutlined /> 下载SVG
                </a>
                <div
                  className="svg-container"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              </>
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
                请在首页提供 karyotype、HiFi/Nano depth 与 PAF 文件（或粘贴比对数据），然后点击「生成可视化」。
              </div>
            )}
          </div>
        </Col>
      </Row>
    </div>
  );
}

export default App;

