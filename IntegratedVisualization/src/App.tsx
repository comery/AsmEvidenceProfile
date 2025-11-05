import React, { useState } from 'react';
import './App.css';
import { PageHeader, Alert, Form, Button, Collapse, InputNumber, Space, message, Select, Spin, Slider, Upload, Input } from 'antd';
import { GithubOutlined, DownloadOutlined, LoadingOutlined, UploadOutlined } from '@ant-design/icons';
import GciFileUpload from './components/GciFileUpload';
import GciFileUploadPerChr from './components/GciFileUploadPerChr';
import LinkviewUpload from './components/LinkviewUpload';
import RoundedNumberInput from './components/RoundedNumberInput';
import KaryotypeInput from './components/KaryotypeInput';
import AuxiliaryLinesManager from './components/AuxiliaryLinesManager';
import InteractiveViewer from './components/InteractiveViewer';
import SidebarResizer from './components/SidebarResizer';
import { extendedMain, ExtendedOptions } from './utils/linkviewWrapper';
import { parseDepthFile, calculateMeanDepth, GciDepthData } from './utils/gciParser';
import initOptions from './utils/initOptions';
import type { UploadFile } from 'antd/es/upload/interface';

const { Panel } = Collapse;

function App() {
  const [svg, setSvg] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [form] = Form.useForm();
  const [gciFile1, setGciFile1] = useState<UploadFile[]>([]);
  const [gciFile2, setGciFile2] = useState<UploadFile[]>([]);
  const [gciDepthData, setGciDepthData] = useState<{ [chromosome: string]: number[] } | undefined>();
  const [gciDepthData2, setGciDepthData2] = useState<{ [chromosome: string]: number[] } | undefined>();
  
  // 按染色体分别上传的文件
  const [hifiAFile, setHifiAFile] = useState<UploadFile[]>([]);
  const [ontAFile, setOntAFile] = useState<UploadFile[]>([]);
  const [hifiBFile, setHifiBFile] = useState<UploadFile[]>([]);
  const [ontBFile, setOntBFile] = useState<UploadFile[]>([]);
  const [hifiADepthData, setHifiADepthData] = useState<GciDepthData | undefined>();
  const [ontADepthData, setOntADepthData] = useState<GciDepthData | undefined>();
  const [hifiBDepthData, setHifiBDepthData] = useState<GciDepthData | undefined>();
  const [ontBDepthData, setOntBDepthData] = useState<GciDepthData | undefined>();
  
  const [usePerChrUpload, setUsePerChrUpload] = useState<boolean>(false);
  const [auxiliaryLines, setAuxiliaryLines] = useState<number[]>([]);
  const [linkviewFiles, setLinkviewFiles] = useState<UploadFile[]>([]);
  const [hifiPafFiles, setHifiPafFiles] = useState<UploadFile[]>([]);
  const [nanoPafFiles, setNanoPafFiles] = useState<UploadFile[]>([]);
  const [linkviewInputContent, setLinkviewInputContent] = useState<string>('');
  const [karyotypeContent, setKaryotypeContent] = useState<string>('');
  const [useInteractiveViewer, setUseInteractiveViewer] = useState<boolean>(true);
  const [currentZoom, setCurrentZoom] = useState<number>(1);
  const [chromosomes, setChromosomes] = useState<Array<{ name: string; length: number }>>([]);
  const [sidebarWidth, setSidebarWidth] = useState<number>(320);

  // 快速自检：检查当前输入的完整性与解析结果
  const runQuickDiagnostics = () => {
    const diagnostics: string[] = [];

    // karyotype 检查
    const karyoText = (karyotypeContent || '').trim();
    if (karyoText.length === 0) {
      diagnostics.push('karyotype: 未提供');
    } else {
      const lines = karyoText.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'));
      diagnostics.push(`karyotype: 行数=${lines.length}`);
    }

    // depth 检查
    const summarizeDepth = (data?: { [chromosome: string]: number[] }) => {
      if (!data || Object.keys(data).length === 0) return '未提供';
      const chrs = Object.keys(data);
      let totalLen = 0;
      for (const c of chrs) totalLen += (data[c]?.length || 0);
      return `染色体=${chrs.length}, 总长度=${totalLen}`;
    };
    if (usePerChrUpload) {
      diagnostics.push(`HiFi(A+B): ${summarizeDepth(hifiADepthData as any)}`);
      diagnostics.push(`ONT(A+B): ${summarizeDepth(ontADepthData as any)}`);
      diagnostics.push(`HiFi(B): ${summarizeDepth(hifiBDepthData as any)}`);
      diagnostics.push(`ONT(B): ${summarizeDepth(ontBDepthData as any)}`);
    } else {
      diagnostics.push(`HiFi depth: ${summarizeDepth(gciDepthData)}`);
      diagnostics.push(`Nano depth: ${summarizeDepth(gciDepthData2)}`);
    }

    // 比对数据检查（必填）
    const alnLen = (linkviewInputContent || '').length;
    if (alnLen === 0) {
      diagnostics.push('比对数据: 未提供（必填）');
    } else {
      diagnostics.push(`比对数据: 文本长度=${alnLen}`);
    }

    // 输出提示
    const msg = diagnostics.join('\n');
    console.log('[Diagnostics]', msg);
    if (alnLen === 0) {
      message.error('输入自检：缺少必填的比对数据文件');
    } else {
      message.info(`输入自检结果:\n${msg}`);
    }
  };

  // 更新染色体信息（从深度数据中提取）
  const updateChromosomes = (depths1?: { [chromosome: string]: number[] }, depths2?: { [chromosome: string]: number[] }) => {
    const chrSet = new Set<string>();
    if (depths1) Object.keys(depths1).forEach(k => chrSet.add(k));
    if (depths2) Object.keys(depths2).forEach(k => chrSet.add(k));
    
    const chrList = Array.from(chrSet).map(name => ({
      name,
      length: Math.max(
        depths1?.[name]?.length || 0,
        depths2?.[name]?.length || 0
      )
    }));
    
    setChromosomes(chrList);
  };

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
        updateChromosomes(depths, gciDepthData2);
      } catch (error) {
        console.error('Error parsing GCI file 1:', error);
        setErrMsg(`Error parsing GCI file 1: ${(error as Error).message}`);
      }
    } else {
      setGciDepthData(undefined);
      updateChromosomes(undefined, gciDepthData2);
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
        updateChromosomes(gciDepthData, depths);
      } catch (error) {
        console.error('Error parsing GCI file 2:', error);
        setErrMsg(`Error parsing GCI file 2: ${(error as Error).message}`);
      }
    } else {
      setGciDepthData2(undefined);
      updateChromosomes(gciDepthData, undefined);
    }
  };

  // 处理按染色体分别上传的文件
  const handleHifiAChange = async (fileList: UploadFile[]) => {
    setHifiAFile(fileList);
    if (fileList.length > 0 && fileList[0].originFileObj) {
      try {
        const file = fileList[0].originFileObj;
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const { depths } = await parseDepthFile(uint8Array);
        setHifiADepthData(depths);
      } catch (error) {
        console.error('Error parsing HiFi A file:', error);
        message.error(`解析 HiFi A 文件失败: ${(error as Error).message}`);
      }
    } else {
      setHifiADepthData(undefined);
    }
  };

  const handleOntAChange = async (fileList: UploadFile[]) => {
    setOntAFile(fileList);
    if (fileList.length > 0 && fileList[0].originFileObj) {
      try {
        const file = fileList[0].originFileObj;
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const { depths } = await parseDepthFile(uint8Array);
        setOntADepthData(depths);
      } catch (error) {
        console.error('Error parsing ONT A file:', error);
        message.error(`解析 ONT A 文件失败: ${(error as Error).message}`);
      }
    } else {
      setOntADepthData(undefined);
    }
  };

  const handleHifiBChange = async (fileList: UploadFile[]) => {
    setHifiBFile(fileList);
    if (fileList.length > 0 && fileList[0].originFileObj) {
      try {
        const file = fileList[0].originFileObj;
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const { depths } = await parseDepthFile(uint8Array);
        setHifiBDepthData(depths);
      } catch (error) {
        console.error('Error parsing HiFi B file:', error);
        message.error(`解析 HiFi B 文件失败: ${(error as Error).message}`);
      }
    } else {
      setHifiBDepthData(undefined);
    }
  };

  const handleOntBChange = async (fileList: UploadFile[]) => {
    setOntBFile(fileList);
    if (fileList.length > 0 && fileList[0].originFileObj) {
      try {
        const file = fileList[0].originFileObj;
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const { depths } = await parseDepthFile(uint8Array);
        setOntBDepthData(depths);
      } catch (error) {
        console.error('Error parsing ONT B file:', error);
        message.error(`解析 ONT B 文件失败: ${(error as Error).message}`);
      }
    } else {
      setOntBDepthData(undefined);
    }
  };

  const onSubmit = async (values: any) => {
    console.log('onSubmit called', { values, usePerChrUpload, hifiAFile, ontAFile, hifiBFile, ontBFile });
    
    // 校验：至少一个 depth 来源
    const hasGlobalDepth = !usePerChrUpload && (gciFile1.length > 0 || gciFile2.length > 0);
    const hasPerChrDepth = usePerChrUpload && (
      hifiAFile.length > 0 || ontAFile.length > 0 || 
      hifiBFile.length > 0 || ontBFile.length > 0
    );
    
    console.log('Depth check:', { hasGlobalDepth, hasPerChrDepth, usePerChrUpload });
    
    if (!hasGlobalDepth && !hasPerChrDepth) {
      message.error('请至少提供一个 depth 文件（HiFi 或 Nano）');
      return;
    }
    
    setIsLoading(true);
    setErrMsg('');
    
    console.log('Starting visualization generation...');
    
    try {
  // 整理对齐输入：合并两个 PAF 上传内容，以及额外比对文件
  let combinedAlignments = '';
      
      // 必填：额外比对数据文件
      if (linkviewFiles.length === 0 || !linkviewFiles[0]?.originFileObj) {
        message.error('请上传额外比对数据文件');
        setIsLoading(false);
        return;
      }

      // 合并额外比对文件（如 scaffold_38.paf）
      if (linkviewFiles.length > 0 && linkviewFiles[0].originFileObj) {
        const file = linkviewFiles[0].originFileObj as File;
        const text = await file.text();
        combinedAlignments += (combinedAlignments ? '\n' : '') + text;
      }

      // 合并 HiFi 和 Nano PAF 文件（可选）
      const pafFiles: UploadFile[] = [hifiPafFiles[0], nanoPafFiles[0]].filter(Boolean) as UploadFile[];
      for (const uf of pafFiles) {
        if (uf.originFileObj) {
          const text = await (uf.originFileObj as File).text();
          combinedAlignments += (combinedAlignments ? '\n' : '') + text;
        }
      }

      console.log('Combined alignments length (raw):', combinedAlignments.length);

      if (!combinedAlignments.trim()) {
        message.error('额外比对数据文件内容为空');
        setIsLoading(false);
        return;
      }

      // 归一化：将可能的 PAF 行转换为 LINKVIEW 六列格式
      const normalizedAlignments = normalizeAlignmentsText(combinedAlignments);
      console.log('Combined alignments length (normalized):', normalizedAlignments.length);
      if (!normalizedAlignments.trim()) {
        message.error('比对数据归一化后为空，请检查输入格式');
        setIsLoading(false);
        return;
      }

      const options: ExtendedOptions = {
        ...initOptions,
        ...values,
        // 传入归一化后的 alignments 内容（PAF 将转为六列 LINKVIEW 格式）
        inputContent: normalizedAlignments,
        // 使用已导入的 karyotype 内容（来自组件状态）
        karyotypeContent: karyotypeContent || '',
        highlightContent: values.highlightContent || '',
        gffContent: values.gffContent || '',
        parameterContent: values.parameterContent || '',
        svg_content_width: (values.svg_width || initOptions.svg_width) * (1 - (values.svg_space || initOptions.svg_space)),
      };
      
      // 添加 GCI 数据
      if (usePerChrUpload) {
        // 按染色体分别上传模式：合并数据（使用浅拷贝避免循环引用）
        const mergedHifi: GciDepthData = {};
        const mergedOnt: GciDepthData = {};
        
        // 合并染色体A的数据（浅拷贝数组引用）
        if (hifiADepthData) {
          for (const chr in hifiADepthData) {
            mergedHifi[chr] = hifiADepthData[chr];
          }
        }
        if (ontADepthData) {
          for (const chr in ontADepthData) {
            mergedOnt[chr] = ontADepthData[chr];
          }
        }
        
        // 合并染色体B的数据
        if (hifiBDepthData) {
          for (const chr in hifiBDepthData) {
            mergedHifi[chr] = hifiBDepthData[chr];
          }
        }
        if (ontBDepthData) {
          for (const chr in ontBDepthData) {
            mergedOnt[chr] = ontBDepthData[chr];
          }
        }
        
        if (Object.keys(mergedHifi).length > 0) {
          options.gciDepthData = mergedHifi;
        }
        if (Object.keys(mergedOnt).length > 0) {
          options.gciDepthData2 = mergedOnt;
        }
        
        if (Object.keys(mergedHifi).length > 0 || Object.keys(mergedOnt).length > 0) {
          const meanDepths: number[] = [];
          if (Object.keys(mergedHifi).length > 0) {
            meanDepths.push(calculateMeanDepth(mergedHifi));
          }
          if (Object.keys(mergedOnt).length > 0) {
            meanDepths.push(calculateMeanDepth(mergedOnt));
          }
          options.gciMeanDepths = meanDepths;
        }
      } else {
        // 全局文件模式
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
      }
      
      // 添加辅助线
      if (auxiliaryLines.length > 0) {
        options.auxiliaryLines = auxiliaryLines;
      }
      
      console.log('Calling extendedMain with options:', {
        ...options,
        gciDepthData: options.gciDepthData ? Object.keys(options.gciDepthData) : undefined,
        gciDepthData2: options.gciDepthData2 ? Object.keys(options.gciDepthData2) : undefined,
        inputContentLength: combinedAlignments.length,
      });
      
      const svg = await extendedMain(options) || '';
      
      console.log('extendedMain returned SVG length:', svg.length);
      
      if (!svg) {
        throw new Error('生成的SVG为空，请检查输入数据');
      }
      
      setSvg(svg);
      setErrMsg('');
      console.log('Visualization generated successfully');
    } catch(error) {
      console.error('Error in onSubmit:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setSvg('');
      setErrMsg(errorMessage);
      message.error(`生成可视化失败: ${errorMessage}`);
    } finally {
      setIsLoading(false);
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
          本工具可以同时可视化GCI深度数据和LINKVIEW比对关系，并通过基因组坐标进行对齐，方便检查基因组组装情况。
        </p>
      </PageHeader>

      {/* 主布局：侧边栏 + 主内容区 */}
      <div className="main-layout">
        {/* 侧边栏：参数配置 */}
        <div className="sidebar" style={{ width: `${sidebarWidth}px` }}>
          <Form
            form={form}
            onFinish={onSubmit}
            autoComplete="off"
            size="small"
            layout="vertical"
          >
            {/* 数据输入区域 */}
            <div className="sidebar-section">
              <div className="sidebar-title">数据输入</div>
              <Form.Item label="karyotype">
                <KaryotypeInput onImport={handleImportKaryotype} onContentChange={setKaryotypeContent} />
              </Form.Item>

              <Form.Item label="GCI深度数据">
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  <Select
                    value={usePerChrUpload ? 'perChr' : 'global'}
                    onChange={(value) => setUsePerChrUpload(value === 'perChr')}
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="global">全局文件（所有染色体）</Select.Option>
                    <Select.Option value="perChr">按染色体分别上传</Select.Option>
                  </Select>
                  
                  {usePerChrUpload ? (
                    <GciFileUploadPerChr
                      hifiA={hifiAFile}
                      ontA={ontAFile}
                      hifiB={hifiBFile}
                      ontB={ontBFile}
                      onChangeHifiA={handleHifiAChange}
                      onChangeOntA={handleOntAChange}
                      onChangeHifiB={handleHifiBChange}
                      onChangeOntB={handleOntBChange}
                      onRemoveHifiA={() => {
                        setHifiAFile([]);
                        setHifiADepthData(undefined);
                      }}
                      onRemoveOntA={() => {
                        setOntAFile([]);
                        setOntADepthData(undefined);
                      }}
                      onRemoveHifiB={() => {
                        setHifiBFile([]);
                        setHifiBDepthData(undefined);
                      }}
                      onRemoveOntB={() => {
                        setOntBFile([]);
                        setOntBDepthData(undefined);
                      }}
                    />
                  ) : (
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
                  )}
                </Space>
          </Form.Item>

          <Collapse ghost>
            <Panel header="PAF比对文件（可选）" key="paf">
              <Form.Item label="HiFi PAF">
                <LinkviewUpload
                  fileList={hifiPafFiles}
                  onChange={handleHifiPafChange}
                  onRemove={() => setHifiPafFiles([])}
                />
              </Form.Item>
              
              <Form.Item label="Nano PAF">
                <LinkviewUpload
                  fileList={nanoPafFiles}
                  onChange={handleNanoPafChange}
                  onRemove={() => setNanoPafFiles([])}
                />
              </Form.Item>
            </Panel>
          </Collapse>

          <Form.Item label="比对数据（必填）">
            <LinkviewUpload
              fileList={linkviewFiles}
              onChange={handleLinkviewFileChange}
              onRemove={() => {
                setLinkviewFiles([]);
                setLinkviewInputContent('');
              }}
            />
          </Form.Item>

          {/* 额外配置文件输入 */}
          <Form.Item label="Highlight 配置（可选）" name="highlightContent">
            <div className="upload-section">
              <Upload
                accept=".txt,.tsv,.csv"
                beforeUpload={async (file) => {
                  try {
                    const text = await file.text();
                    form.setFieldsValue({ highlightContent: text });
                    message.success('已载入 highlight 配置');
                  } catch (e) {
                    message.error('读取 highlight 文件失败');
                  }
                  return false;
                }}
                maxCount={1}
                showUploadList={false}
              >
                <div className="upload-button">
                  <UploadOutlined style={{ fontSize: 16 }} />
                  <span>上传 highlight 文件</span>
                </div>
              </Upload>
              <Input.TextArea
                rows={3}
                placeholder="每行：seq start end [color:opacity]，例如：ctg1 1000 2000 red:0.5"
                className="rounded-textarea"
              />
              <div className="help-text">支持 LINKVIEW2 文档中描述的 highlight 文件格式；颜色可省略。</div>
            </div>
          </Form.Item>

          <Form.Item label="GFF 配置（可选）" name="gffContent">
            <div className="upload-section">
              <Upload
                accept=".gff,.gff3,.txt"
                beforeUpload={async (file) => {
                  try {
                    const text = await file.text();
                    form.setFieldsValue({ gffContent: text });
                    message.success('已载入 GFF 配置');
                  } catch (e) {
                    message.error('读取 GFF 文件失败');
                  }
                  return false;
                }}
                maxCount={1}
                showUploadList={false}
              >
                <div className="upload-button">
                  <UploadOutlined style={{ fontSize: 16 }} />
                  <span>上传 GFF 文件</span>
                </div>
              </Upload>
              <Input.TextArea
                rows={3}
                placeholder="粘贴或编辑 GFF/GFF3 内容"
                className="rounded-textarea"
              />
              <div className="help-text">支持标准 GFF/GFF3 格式，将在 LINKVIEW2 中用于绘制基因结构。</div>
            </div>
          </Form.Item>
            </div>

            {/* 可视化设置 */}
            <div className="sidebar-section">
              <div className="sidebar-title">可视化设置</div>
              <Collapse ghost>
                <Panel header="显示选项" key="1">
                  <Form.Item
                    name="svg_width"
                    label="分辨率宽度 (px)"
                    initialValue={initOptions.svg_width}
                    help="导出 SVG 的基础内容宽度"
                  >
                    <RoundedNumberInput min={100} />
                  </Form.Item>
                  <Form.Item
                    name="svg_height"
                    label="基础高度 (px)"
                    initialValue={initOptions.svg_height}
                    help="LINKVIEW 中部区域的基础高度"
                  >
                    <RoundedNumberInput min={100} />
                  </Form.Item>
                  <Form.Item
                    name="svg_space"
                    label="左右边距比例"
                    initialValue={initOptions.svg_space}
                    help="0 表示无边距，1 表示全部留白"
                  >
                    <Slider
                      min={0}
                      max={1}
                      step={0.05}
                      tooltip={{ formatter: (v) => `${(v ?? 0).toFixed(2)}` }}
                    />
                  </Form.Item>
                </Panel>
                
                <Panel header="GCI选项" key="2">
                  <Form.Item
                    name="depth_height"
                    label="深度面板高度 (px)"
                    initialValue={initOptions.depth_height}
                    help="每个深度面板的高度（上/下各一个）"
                  >
                    <RoundedNumberInput min={50} max={500} />
                  </Form.Item>
                  <Form.Item
                    name="window_size"
                    label="滑动窗口大小 (bp)"
                    initialValue={initOptions.window_size}
                    help="用于计算平均深度的窗口大小"
                  >
                    <RoundedNumberInput min={1} />
                  </Form.Item>
                  <Form.Item
                    name="max_depth_ratio"
                    label="最大深度比例"
                    initialValue={initOptions.max_depth_ratio}
                    help="深度值的显示上限比例（用于裁剪高峰）"
                  >
                    <RoundedNumberInput min={1} max={10} step={0.1} />
                  </Form.Item>
                  <Form.Item
                    name="min_safe_depth"
                    label="最小安全深度"
                    initialValue={initOptions.min_safe_depth}
                    help="用于高亮低深度区域的阈值"
                  >
                    <RoundedNumberInput min={1} step={1} />
                  </Form.Item>
                  <Form.Item
                    name="top_margin"
                    label="顶部边距 (px)"
                    initialValue={initOptions.top_margin}
                    help="整体可视化的顶部留白"
                  >
                    <RoundedNumberInput min={0} step={10} />
                  </Form.Item>
                </Panel>
              </Collapse>
            </div>

            {/* 辅助功能 */}
            <div className="sidebar-section">
              <div className="sidebar-title">辅助功能</div>
              <Form.Item label="辅助线">
                <AuxiliaryLinesManager
                  lines={auxiliaryLines}
                  onChange={setAuxiliaryLines}
                />
              </Form.Item>
              
            </div>

            {/* 生成按钮 */}
            <Form.Item style={{ marginBottom: 0 }}>
              <Space style={{ width: '100%' }}>
                <Button
                  className="rounded-button rounded-button-secondary"
                  style={{ height: '42px' }}
                  onClick={runQuickDiagnostics}
                  disabled={isLoading}
                >
                  快速自检
                </Button>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  style={{ width: '100%', height: '42px', fontSize: '16px' }}
                  loading={isLoading}
                  disabled={isLoading}
                >
                  {isLoading ? '正在生成可视化...' : '生成可视化'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>

        {/* 分隔条：可拖拽调整宽度 */}
        <SidebarResizer
          onResize={setSidebarWidth}
          initialWidth={320}
          minWidth={200}
          maxWidth={600}
        />

        {/* 主内容区：可视化结果 */}
        <div className="main-content">
          <div className="display-container">
            {isLoading ? (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                minHeight: '400px',
                gap: 16
              }}>
                <Spin 
                  indicator={<LoadingOutlined style={{ fontSize: 48, color: '#667eea' }} spin />} 
                  size="large"
                />
                <div style={{ fontSize: 16, color: '#595959' }}>
                  正在处理文件并生成可视化，请稍候...
                </div>
                <div style={{ fontSize: 13, color: '#8c8c8c' }}>
                  大文件可能需要较长时间，请耐心等待
                </div>
              </div>
            ) : errMsg ? (
              <Alert
                message="错误"
                description={<code style={{ whiteSpace: 'pre-wrap' }}>{errMsg}</code>}
                type="error"
                closable
                onClose={() => setErrMsg('')}
              />
            ) : svg ? (
              <>
                <div className="control-bar">
                  <Space>
                    <span style={{ fontWeight: 500, color: '#595959' }}>查看模式:</span>
                    <Select
                      value={useInteractiveViewer ? 'interactive' : 'static'}
                      onChange={(value) => {
                        if (value === 'interactive') {
                          setUseInteractiveViewer(true);
                        } else {
                          setUseInteractiveViewer(false);
                        }
                      }}
                      style={{ width: 150 }}
                    >
                      <Select.Option value="interactive">交互式 SVG</Select.Option>
                      <Select.Option value="static">静态 SVG</Select.Option>
                    </Select>
                  </Space>
                  <a
                    href={`data:text/plain;charset=utf-8,${svg.replaceAll('#', '%23')}`}
                    download="visualization.svg"
                    className="download-btn"
                  >
                    <DownloadOutlined /> 下载SVG
                  </a>
                </div>
                {useInteractiveViewer ? (
                  <div style={{ height: '600px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
                    <InteractiveViewer
                      svgContent={svg}
                      onZoomChange={setCurrentZoom}
                      onPanChange={(x, y) => {
                        // 可以在这里处理平移变化
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="svg-container"
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                )}
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <div className="empty-state-text">
                  <p style={{ marginBottom: 8, fontSize: '18px', fontWeight: 500, color: '#595959' }}>
                    准备开始可视化
                  </p>
                  <p style={{ margin: 0 }}>
                    请在左侧侧边栏上传 karyotype、HiFi/Nano depth 与 PAF 文件，然后点击「生成可视化」按钮。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
  // 将可能的 PAF 行归一化为 LINKVIEW 默认六列格式：ctg1 s1 e1 ctg2 s2 e2
  const isLikelyPafLine = (line: string) => {
    const parts = line.trim().split(/\s+/);
    // 典型 PAF 至少 12 列，列5通常为 "+/-"；列10/11为数字
    if (parts.length >= 12) {
      const strand = parts[4];
      const hasNumCols = /^\d+$/.test(parts[10]) && /^\d+$/.test(parts[11]);
      return (strand === '+' || strand === '-') || hasNumCols;
    }
    return false;
  };

  const convertPafLineToLinkview = (line: string): string | null => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) return null;
    const qName = parts[0];
    const qStart = parseInt(parts[2], 10);
    const qEnd = parseInt(parts[3], 10);
    const tName = parts[5];
    const tStart = parseInt(parts[7], 10);
    const tEnd = parseInt(parts[8], 10);
    if ([qStart, qEnd, tStart, tEnd].some(n => Number.isNaN(n))) return null;
    return `${qName} ${qStart} ${qEnd} ${tName} ${tStart} ${tEnd}`;
  };

  const normalizeAlignmentsText = (text: string): string => {
    const lines = text.split(/\r?\n/);
    const out: string[] = [];
    let pafCount = 0;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      if (isLikelyPafLine(line)) {
        pafCount++;
        const conv = convertPafLineToLinkview(line);
        if (conv) out.push(conv);
      } else {
        const parts = line.split(/\s+/);
        if (parts.length >= 6) {
          // 只取前6列，兼容已是 LINKVIEW 六列格式的情况
          out.push([parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]].join(' '));
        } else {
          // 保留原行，避免误删
          out.push(line);
        }
      }
    }
    if (pafCount > 0) {
      console.log(`[Alignments] Detected ${pafCount} PAF lines; normalized to 6-column LINKVIEW format`);
    }
    return out.join('\n');
  };

