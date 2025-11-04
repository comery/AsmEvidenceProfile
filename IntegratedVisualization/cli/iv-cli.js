#!/usr/bin/env node
/**
 * Integrated Visualization CLI
 * 生成整合的SVG，可选读取GCI深度、LINKVIEW对齐与karyotype。
 */
const fs = require('fs');
const path = require('path');
const { ungzip } = require('pako');
const { main } = require('@linkview/linkview-core');

function parseArgs(argv) {
  const args = {};
  const listFlags = new Set(['--paf', '--aux-line']);
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token;
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        if (listFlags.has(key)) {
          if (!args[key]) args[key] = [];
          args[key].push(next);
        } else {
          args[key] = next;
        }
        i++;
      }
    }
  }
  return args;
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function readUint8(filePath) {
  const buf = fs.readFileSync(filePath);
  return new Uint8Array(buf);
}

function parseDepthFile(inputData) {
  const isGzip = inputData.length >= 2 && inputData[0] === 0x1f && inputData[1] === 0x8b;
  const raw = isGzip ? ungzip(inputData) : inputData;
  const text = new TextDecoder('utf-8').decode(raw);
  const depths = {};
  const lengths = {};
  let currentChromosome = '';
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('>')) {
      if (currentChromosome) {
        lengths[currentChromosome] = depths[currentChromosome].length;
      }
      currentChromosome = trimmed.slice(1);
      depths[currentChromosome] = [];
    } else {
      if (currentChromosome) {
        const parts = trimmed.split(/\s+/);
        const depth = parseInt(parts[0], 10);
        if (!isNaN(depth)) depths[currentChromosome].push(depth);
      }
    }
  }
  if (currentChromosome) lengths[currentChromosome] = depths[currentChromosome].length;
  return { depths, lengths };
}

function slidingWindowAverage(depths, windowSize = 50000, start = 0) {
  const positions = [];
  const averages = [];
  const windowDepths = [];
  if (depths.length < windowSize) windowSize = 1;
  for (let i = 0; i < depths.length; i++) {
    const d = depths[i];
    if (d === 0) {
      if (windowDepths.length > 0) {
        const avg = windowDepths.reduce((a, b) => a + b, 0) / windowDepths.length;
        averages.push(avg);
        positions.push((i + start - 1) / 1e6);
        windowDepths.length = 0;
      }
      averages.push(0);
      positions.push((i + start) / 1e6);
    } else {
      windowDepths.push(d);
      if (windowDepths.length === windowSize) {
        const avg = windowDepths.reduce((a, b) => a + b, 0) / windowSize;
        averages.push(avg);
        positions.push((i + start) / 1e6);
        windowDepths.length = 0;
      }
    }
  }
  if (windowDepths.length > 0) {
    const avg = windowDepths.reduce((a, b) => a + b, 0) / windowDepths.length;
    averages.push(avg);
    positions.push((depths.length - 1 + start) / 1e6);
  }
  return [positions, averages];
}

function calculateMeanDepth(depthsByChr) {
  const all = [];
  for (const chr in depthsByChr) all.push(...depthsByChr[chr]);
  if (all.length === 0) return 0;
  return all.reduce((a, b) => a + b, 0) / all.length;
}

function renderGciDepthSvg(options, layout, gciDepthData, meanDepth, topY, height, isNegative = false, color = '#2ca25f') {
  const svgContents = [];
  const windowSize = options.gciWindowSize || 50000;
  const depthMax = (options.gciDepthMax || 4.0) * meanDepth;
  const firstLayoutLine = layout[0];
  if (!firstLayoutLine) return svgContents;
  const yBaseline = isNegative ? topY + height : topY + height / 2;
  const yMean = isNegative ? (yBaseline - (meanDepth / depthMax) * height * 0.4) : (yBaseline + (meanDepth / depthMax) * height * 0.4);
  for (const layoutItem of firstLayoutLine) {
    const { ctg, start, end } = layoutItem;
    if (!(ctg in gciDepthData)) continue;
    const depths = gciDepthData[ctg];
    const min = Math.min(start, end);
    const max = Math.max(start, end);
    const startIdx = Math.max(0, Math.floor(min));
    const endIdx = Math.min(depths.length - 1, Math.ceil(max));
    const regionDepths = depths.slice(startIdx, endIdx + 1);
    const [positions, averages] = slidingWindowAverage(regionDepths, windowSize, startIdx);
    if (averages.length > 0 && positions.length > 0) {
      const pathPoints = [];
      let firstX = null;
      for (let i = 0; i < positions.length; i++) {
        const posMb = positions[i];
        const genomicPos = posMb * 1e6;
        if (genomicPos < min || genomicPos > max) continue;
        const svgX = layoutItem.getSvgPos(genomicPos, 'top', false)[0];
        if (firstX === null) {
          firstX = svgX;
          pathPoints.push(`M ${svgX} ${yBaseline}`);
        }
        let depth = averages[i];
        if (depth > depthMax) depth = depthMax;
        const depthRatio = depth / depthMax;
        const yDepth = isNegative ? (yBaseline - depthRatio * height * 0.4) : (yBaseline + depthRatio * height * 0.4);
        pathPoints.push(`L ${svgX} ${yDepth}`);
      }
      if (pathPoints.length > 1 && firstX !== null) {
        const lastPoint = pathPoints[pathPoints.length - 1];
        const lastX = parseFloat(lastPoint.split(' ')[1]);
        pathPoints.push(`L ${lastX} ${yBaseline}`);
        pathPoints.push(`L ${firstX} ${yBaseline} Z`);
        const pathData = pathPoints.join(' ');
        svgContents.push(`<path d="${pathData}" fill="${color}" stroke="none" opacity="0.7"/>`);
      }
    }
    const x1 = layoutItem.getSvgPos(min, 'top', false)[0];
    const x2 = layoutItem.getSvgPos(max, 'top', true)[0];
    svgContents.push(`<line x1="${x1}" y1="${yBaseline}" x2="${x2}" y2="${yBaseline}" stroke="black" stroke-width="1"/>`);
    svgContents.push(`<line x1="${x1}" y1="${yMean}" x2="${x2}" y2="${yMean}" stroke="red" stroke-width="1" stroke-dasharray="5,5"/>`);
  }
  return svgContents;
}

function renderAuxiliaryLines(options, layout, totalHeight) {
  const svgContents = [];
  const { auxiliaryLines, auxiliaryLineColor } = options;
  if (!auxiliaryLines || auxiliaryLines.length === 0 || !layout || layout.length === 0) return svgContents;
  const lineColor = auxiliaryLineColor || 'rgba(255, 0, 0, 0.5)';
  for (const linePos of auxiliaryLines) {
    let lineDrawn = false;
    for (const layoutLine of layout) {
      for (const layoutItem of layoutLine) {
        const { start, end } = layoutItem;
        const min = Math.min(start, end);
        const max = Math.max(start, end);
        if (linePos < min || linePos > max) continue;
        const svgX = layoutItem.getSvgPos(linePos, 'top', false)[0];
        svgContents.push(`<line x1="${svgX}" y1="0" x2="${svgX}" y2="${totalHeight}" stroke="${lineColor}" stroke-width="1" stroke-dasharray="2,2"/>`);
        lineDrawn = true;
        break;
      }
      if (lineDrawn) break;
    }
  }
  return svgContents;
}

async function run() {
  const args = parseArgs(process.argv);
  if (!args['--out']) {
    console.error('Usage: iv-cli --out output.svg [--karyotype karyotype.txt] [--depth1 hifi.depth.gz] [--depth2 nano.depth.gz] [--paf file1.paf --paf file2.paf ...] [--per-chr-json mapping.json] [--svg-width 1200] [--svg-height 800] [--gci-window-size 50000]');
    process.exit(1);
  }

  // 初始化默认参数
  const options = {
    inputContent: '',
    min_alignment_length: parseInt(args['--min-alignment-length'] || '0', 10),
    max_evalue: parseFloat(args['--max-evalue'] || '1e-5'),
    min_identity: parseFloat(args['--min-identity'] || '0'),
    min_bit_score: parseFloat(args['--min-bit-score'] || '1000'),
    chro_thickness: parseFloat(args['--chro-thickness'] || '15'),
    no_label: !!args['--no-label'],
    label_angle: parseFloat(args['--label-angle'] || '30'),
    label_font_size: parseFloat(args['--label-font-size'] || '30'),
    label_pos: args['--label-pos'] || 'right',
    label_x_offset: parseFloat(args['--label-x-offset'] || '0'),
    label_y_offset: parseFloat(args['--label-y-offset'] || '0'),
    gap_length: parseFloat(args['--gap-length'] || '0.2'),
    svg_height: parseInt(args['--svg-height'] || '800', 10),
    svg_width: parseInt(args['--svg-width'] || '1200', 10),
    svg_space: parseFloat(args['--svg-space'] || '0.2'),
    svg_content_width: (parseInt(args['--svg-width'] || '1200', 10)) * (1 - parseFloat(args['--svg-space'] || '0.2')),
    show_scale: !!args['--show-scale'],
    scale: parseFloat(args['--scale'] || '0'),
    chro_axis_pos: args['--chro-axis-pos'] || 'bottom',
    chro_axis_unit: args['--chro-axis-unit'] || 'auto',
    align: args['--align'] || 'center',
    hl_min1px: !!args['--hl-min1px'],
    highlightContent: '',
    karyotypeContent: '',
    parameterContent: '',
    gffContent: '',
    style: args['--style'] || 'classic',
    gciDepthHeight: parseInt(args['--gci-depth-height'] || '150', 10),
    gciWindowSize: parseInt(args['--gci-window-size'] || '50000', 10),
    gciDepthMin: parseFloat(args['--gci-depth-min'] || '0.1'),
    gciDepthMax: parseFloat(args['--gci-depth-max'] || '4.0'),
    auxiliaryLines: args['--aux-line'] || [],
    auxiliaryLineColor: args['--aux-color'] || 'rgba(255, 0, 0, 0.5)',
    depthMode: args['--depth-mode'] || 'by_chromosome',
    layout: [],
    alignments: [],
    lenInfo: {},
    alignmentsByCtgs: {},
    intervalInfoByAlignments: {},
  };

  // 为 LINKVIEW 核心添加 use()，用于按插件管线执行（绑定 this）
  options.use = async function(plugin) {
    return await plugin.call(this);
  };

  // 读取karyotype
  if (args['--karyotype']) {
    options.karyotypeContent = readText(args['--karyotype']);
  }

  // 读取全局深度
  let mergedDepth1 = {};
  let mergedDepth2 = {};
  if (args['--depth1']) {
    const { depths } = parseDepthFile(readUint8(args['--depth1']));
    mergedDepth1 = { ...mergedDepth1, ...depths };
  }
  if (args['--depth2']) {
    const { depths } = parseDepthFile(readUint8(args['--depth2']));
    mergedDepth2 = { ...mergedDepth2, ...depths };
  }

  // 读取按染色体JSON映射
  if (args['--per-chr-json']) {
    const mapping = JSON.parse(readText(args['--per-chr-json']));
    for (const chr of Object.keys(mapping)) {
      const rec = mapping[chr] || {};
      if (rec.hifiDepth) {
        try {
          const { depths } = parseDepthFile(readUint8(rec.hifiDepth));
          Object.assign(mergedDepth1, depths);
        } catch (e) { console.warn('解析 HiFi depth 失败:', e.message || e); }
      }
      if (rec.nanoDepth) {
        try {
          const { depths } = parseDepthFile(readUint8(rec.nanoDepth));
          Object.assign(mergedDepth2, depths);
        } catch (e) { console.warn('解析 Nano depth 失败:', e.message || e); }
      }
      if (rec.hifiPaf) {
        options.inputContent += (options.inputContent ? '\n' : '') + readText(rec.hifiPaf);
      }
      if (rec.nanoPaf) {
        options.inputContent += (options.inputContent ? '\n' : '') + readText(rec.nanoPaf);
      }
    }
  }

  // 读取PAF文件
  const pafList = args['--paf'] || [];
  for (const pafPath of pafList) {
    options.inputContent += (options.inputContent ? '\n' : '') + readText(pafPath);
  }

  // 读取自定义 alignments（LINKVIEW 专属格式）
  if (args['--alignments']) {
    options.inputContent += (options.inputContent ? '\n' : '') + readText(args['--alignments']);
  }

  // 添加GCI数据
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

  // 运行LINKVIEW核心
  const linkviewOptions = { ...options, svg_height: options.svg_height };
  if (args['--debug']) {
    console.log('Pre-core karyotypeContent length:', options.karyotypeContent ? options.karyotypeContent.length : 0);
    console.log('Pre-core typeof use:', typeof linkviewOptions.use);
  }
  const linkviewSvg = await main(linkviewOptions);
  if (args['--debug']) {
    console.log('Core SVG length:', linkviewSvg ? linkviewSvg.length : linkviewSvg);
    console.log('Layout lines:', Array.isArray(linkviewOptions.layout) ? linkviewOptions.layout.length : 'no layout');
    console.log('Has svg_template:', Array.isArray(linkviewOptions.svg_template));
  }
  if (!linkviewSvg) {
    console.error('生成失败：LINKVIEW核心未返回SVG。请检查输入对齐数据。');
    process.exit(2);
  }
  const layout = linkviewOptions.layout || [];
  const svgMatch = linkviewSvg.match(/<svg([^>]*)>(.*)<\/svg>/s);
  if (!svgMatch) {
    fs.writeFileSync(args['--out'], linkviewSvg, 'utf-8');
    console.log('已输出：', args['--out']);
    return;
  }
  const svgAttrs = svgMatch[1];
  const svgContent = svgMatch[2];
  const widthMatch = svgAttrs.match(/width="([^"]*)"/);
  const width = widthMatch ? widthMatch[1] : String(options.svg_width || 1200);

  const gciTopHeight = options.gciDepthData ? (options.gciDepthHeight || 150) : 0;
  const gciBottomHeight = options.gciDepthData2 ? (options.gciDepthHeight || 150) : 0;
  const spaceBetweenPanels = 20;
  const adjustedHeight = options.svg_height + gciTopHeight + gciBottomHeight + ((gciTopHeight > 0 || gciBottomHeight > 0) ? spaceBetweenPanels * 2 : 0);

  const gciSvgContents = [];
  if (layout.length > 0 && (options.gciDepthData || options.gciDepthData2)) {
    const lineTop = layout[0] || [];
    const lineBottom = layout[1] || [];
    const hasTwoDatasets = !!(options.gciDepthData && options.gciDepthData2);
    // Top panel: chr1（来自第一行布局）
    if (options.gciDepthData) {
      const meanDepthTop = options.gciMeanDepths && options.gciMeanDepths[0] ? options.gciMeanDepths[0] : calculateMeanDepth(options.gciDepthData);
      gciSvgContents.push(...renderGciDepthSvg(options, [lineTop], options.gciDepthData, meanDepthTop, 0, gciTopHeight, false, '#2ca25f'));
    } else if (options.gciDepthData2) {
      const meanDepthTop = options.gciMeanDepths && options.gciMeanDepths[1] ? options.gciMeanDepths[1] : calculateMeanDepth(options.gciDepthData2);
      gciSvgContents.push(...renderGciDepthSvg(options, [lineTop], options.gciDepthData2, meanDepthTop, 0, gciTopHeight, false, '#3C5488'));
    }
    // Bottom panel: chr2（来自第二行布局）
    if (options.gciDepthData2) {
      const meanDepthBottom = options.gciMeanDepths && options.gciMeanDepths[1] ? options.gciMeanDepths[1] : calculateMeanDepth(options.gciDepthData2);
      gciSvgContents.push(...renderGciDepthSvg(options, [lineBottom], options.gciDepthData2, meanDepthBottom, gciTopHeight + (gciTopHeight > 0 ? spaceBetweenPanels : 0), gciBottomHeight, true, '#3C5488'));
    } else if (options.gciDepthData) {
      const meanDepthBottom = options.gciMeanDepths && options.gciMeanDepths[0] ? options.gciMeanDepths[0] : calculateMeanDepth(options.gciDepthData);
      gciSvgContents.push(...renderGciDepthSvg(options, [lineBottom], options.gciDepthData, meanDepthBottom, gciTopHeight + (gciTopHeight > 0 ? spaceBetweenPanels : 0), gciBottomHeight, true, '#2ca25f'));
    }
  }

  const linkviewOffset = gciTopHeight + (gciTopHeight > 0 ? spaceBetweenPanels : 0);
  const offsetSvgContent = linkviewOffset > 0 ? `<g transform="translate(0, ${linkviewOffset})">${svgContent}</g>` : svgContent;
  const auxiliaryLinesSvg = renderAuxiliaryLines(options, layout, adjustedHeight);
  const finalSvg = `<svg width="${width}" height="${adjustedHeight}" xmlns="http://www.w3.org/2000/svg">${gciSvgContents.join('\n')}${offsetSvgContent}${auxiliaryLinesSvg.join('\n')}</svg>`;
  fs.writeFileSync(args['--out'], finalSvg, 'utf-8');
  console.log('已输出：', args['--out']);
}

run().catch(err => {
  console.error('运行出错：', err && err.message ? err.message : err);
  process.exit(99);
});