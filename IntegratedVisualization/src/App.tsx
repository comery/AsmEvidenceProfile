import React, { useState } from 'react';
import './App.css';
import { PageHeader, Row, Col, Alert, Form, Input, Button, Collapse, InputNumber, Space, Divider, message } from 'antd';
import { GithubOutlined, DownloadOutlined } from '@ant-design/icons';
import GciFileUpload from './components/GciFileUpload';
import LinkviewUpload from './components/LinkviewUpload';
import KaryotypeInput from './components/KaryotypeInput';
import ChromosomeUploadPanel, { PerChromosomeFiles } from './components/ChromosomeUploadPanel';
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
  const [linkviewInputContent, setLinkviewInputContent] = useState<string>('');
  const [karyotypeContent, setKaryotypeContent] = useState<string>('');
  const [chromosomes, setChromosomes] = useState<string[]>([]);
  const [perChrFiles, setPerChrFiles] = useState<PerChromosomeFiles>({});

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
    // 校验：至少一个depth来源（全局GCI或按染色体的HiFi/Nano depth）
    const hasGlobalDepth = gciFile1.length > 0 || gciFile2.length > 0;
    const hasPerChrDepth = Object.values(perChrFiles).some(rec => (rec.hifiDepth && rec.hifiDepth.length > 0) || (rec.nanoDepth && rec.nanoDepth.length > 0));
    if (!hasGlobalDepth && !hasPerChrDepth) {
      message.error('请至少提供一个 depth 文件（可为全局GCI或按染色体上传）');
      return;
    }
    // 整理对齐输入：合并按染色体上传的PAF与全局上传/粘贴内容
    let combinedAlignments = linkviewInputContent || values.inputContent || '';
    for (const chr of Object.keys(perChrFiles)) {
      const rec = perChrFiles[chr];
      const filesToRead = [rec.hifiPaf?.[0]?.originFileObj, rec.nanoPaf?.[0]?.originFileObj].filter(Boolean) as File[];
      for (const f of filesToRead) {
        const text = await (f as File).text();
        combinedAlignments += (combinedAlignments ? '\n' : '') + text;
      }
    }

    const options: ExtendedOptions = {
      ...initOptions,
      ...values,
      inputContent: combinedAlignments,
      karyotypeContent: values.karyotypeContent || '',
      highlightContent: values.highlightContent || '',
      gffContent: values.gffContent || '',
      parameterContent: values.parameterContent || '',
      svg_content_width: (values.svg_width || initOptions.svg_width) * (1 - (values.svg_space || initOptions.svg_space)),
    };
    
    // 解析并合并按染色体的depth文件
    let mergedDepth1: { [chromosome: string]: number[] } = gciDepthData ? { ...gciDepthData } : {};
    let mergedDepth2: { [chromosome: string]: number[] } = gciDepthData2 ? { ...gciDepthData2 } : {};
    for (const chr of Object.keys(perChrFiles)) {
      const rec = perChrFiles[chr];
      if (rec.hifiDepth && rec.hifiDepth[0]?.originFileObj) {
        try {
          const file = rec.hifiDepth[0].originFileObj as File;
          const buf = new Uint8Array(await file.arrayBuffer());
          const { depths } = await parseDepthFile(buf);
          // 合并：覆盖同名染色体或追加新染色体
          Object.assign(mergedDepth1, depths);
        } catch (e) {
          console.warn('解析 HiFi depth 失败:', e);
        }
      }
      if (rec.nanoDepth && rec.nanoDepth[0]?.originFileObj) {
        try {
          const file = rec.nanoDepth[0].originFileObj as File;
          const buf = new Uint8Array(await file.arrayBuffer());
          const { depths } = await parseDepthFile(buf);
          Object.assign(mergedDepth2, depths);
        } catch (e) {
          console.warn('解析 Nano depth 失败:', e);
        }
      }
    }

    // 添加GCI数据（考虑合并结果）
    if (Object.keys(mergedDepth1).length > 0) {
      options.gciDepthData = mergedDepth1;
      const meanDepth1 = calculateMeanDepth(mergedDepth1);
      if (Object.keys(mergedDepth2).length > 0) {
        options.gciDepthData2 = mergedDepth2;
        const meanDepth2 = calculateMeanDepth(mergedDepth2);
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

  // 导入 karyotype 后生成按染色体的上传面板
  const handleImportKaryotype = (chrs: string[], content: string) => {
    setChromosomes(chrs);
    setKaryotypeContent(content);
    // 初始化每个染色体的文件记录
    const initial: PerChromosomeFiles = {};
    chrs.forEach(chr => {
      initial[chr] = { hifiDepth: [], hifiPaf: [], nanoDepth: [], nanoPaf: [] };
    });
    setPerChrFiles(initial);
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
            {/* karyotype 输入 */}
            <Form.Item label="karyotype">
              <KaryotypeInput onImport={handleImportKaryotype} />
            </Form.Item>

            {/* GCI文件上传（在导入 karyotype 后隐藏） */}
            {chromosomes.length === 0 && (
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
            )}

            {/* 按染色体上传面板（导入karyotype后显示） */}
            {chromosomes.length > 0 && (
              <Form.Item label="按染色体上传">
                <ChromosomeUploadPanel
                  chromosomes={chromosomes}
                  files={perChrFiles}
                  onChange={setPerChrFiles}
                />
              </Form.Item>
            )}

            {/* LINKVIEW 比对文件上传 */}
            <Form.Item label="LINKVIEW比对文件">
              <LinkviewUpload
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
                请先导入 karyotype 并按染色体上传 depth/PAF 或粘贴比对数据，然后点击「生成可视化」
              </div>
            )}
          </div>
        </Col>
      </Row>
    </div>
  );
}

export default App;

