#!/usr/bin/env node
/**
 * 测试示例数据解析与绘图生成
 * - 检查目录下关键文件是否存在
 * - 解析 HiFi/Nano 深度文件，输出基本统计
 * - 运行 iv-cli 生成 SVG，并校验输出文件
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ungzip } = require('pako');

function log(msg) {
  console.log(`[TEST] ${msg}`);
}

function readUint8(filePath) {
  const buf = fs.readFileSync(filePath);
  return new Uint8Array(buf);
}

function parseDepthFile(inputData) {
  // 与 CLI 中保持一致的解析逻辑
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

function calculateMeanDepth(depthsByChr) {
  let sum = 0;
  let count = 0;
  for (const chr in depthsByChr) {
    const arr = depthsByChr[chr];
    if (!arr || arr.length === 0) continue;
    for (let i = 0; i < arr.length; i++) {
      sum += arr[i];
      count++;
    }
  }
  if (count === 0) return 0;
  return sum / count;
}

function findFileByPatterns(dir, patterns) {
  const files = fs.readdirSync(dir);
  for (const pat of patterns) {
    const re = new RegExp(pat);
    const found = files.find(f => re.test(f));
    if (found) return path.join(dir, found);
  }
  return null;
}

function main() {
  const exampleDirArg = process.argv[2];
  if (!exampleDirArg) {
    console.error('用法: node scripts/test-example.js <示例数据目录>');
    process.exit(1);
  }

  const exampleDir = path.resolve(exampleDirArg);
  log(`示例数据目录: ${exampleDir}`);
  if (!fs.existsSync(exampleDir) || !fs.statSync(exampleDir).isDirectory()) {
    console.error('错误: 指定目录不存在或不是目录');
    process.exit(2);
  }

  // 寻找关键文件
  const karyotype = findFileByPatterns(exampleDir, [
    '^karyotype\\.txt$', 'karyotype', '^karyotype\\.tsv$'
  ]);
  const hifiDepth = findFileByPatterns(exampleDir, [
    '^hifi.*depth.*(gz|txt)$', 'hifi.*depth', '.*hifi.*\\.(txt|gz)$'
  ]);
  const nanoDepth = findFileByPatterns(exampleDir, [
    '^nano.*depth.*(gz|txt)$', 'nano.*depth', '.*nano.*\\.(txt|gz)$'
  ]);
  const alignments = findFileByPatterns(exampleDir, [
    '^alignments\\.txt$', 'alignments.*\\.(txt|paf)$', '\\.(paf)$'
  ]);

  log(`karyotype: ${karyotype || '未找到'}`);
  log(`HiFi depth: ${hifiDepth || '未找到'}`);
  log(`Nano depth: ${nanoDepth || '未找到'}`);
  log(`alignments: ${alignments || '未找到'}`);

  // 基本存在性检查
  const missing = [];
  if (!karyotype) missing.push('karyotype');
  if (!hifiDepth && !nanoDepth) missing.push('至少一个 depth 文件 (hifi/nano)');
  if (!alignments) missing.push('alignments/paf');
  if (missing.length) {
    console.error('缺少必要文件: ' + missing.join(', '));
  }

  // 尝试解析深度文件并输出统计
  try {
    if (hifiDepth) {
      const data = readUint8(hifiDepth);
      const { depths, lengths } = parseDepthFile(data);
      const mean = calculateMeanDepth(depths);
      const chrCount = Object.keys(lengths).length;
      const totalLen = Object.values(lengths).reduce((a, b) => a + b, 0);
      log(`HiFi 解析成功: 染色体=${chrCount}, 总长度=${totalLen}, 平均深度=${mean.toFixed(2)}`);
    } else {
      log('未提供 HiFi 深度文件，跳过解析');
    }
  } catch (e) {
    console.error('HiFi 深度解析失败:', e && e.message ? e.message : e);
  }

  try {
    if (nanoDepth) {
      const data = readUint8(nanoDepth);
      const { depths, lengths } = parseDepthFile(data);
      const mean = calculateMeanDepth(depths);
      const chrCount = Object.keys(lengths).length;
      const totalLen = Object.values(lengths).reduce((a, b) => a + b, 0);
      log(`Nano 解析成功: 染色体=${chrCount}, 总长度=${totalLen}, 平均深度=${mean.toFixed(2)}`);
    } else {
      log('未提供 Nano 深度文件，跳过解析');
    }
  } catch (e) {
    console.error('Nano 深度解析失败:', e && e.message ? e.message : e);
  }

  // 运行 CLI 生成 SVG
  const repoRoot = path.resolve(__dirname, '..');
  const cliPath = path.join(repoRoot, 'cli', 'iv-cli.js');
  const outSvg = path.join(exampleDir, 'test_out.svg');

  const args = ['--out', outSvg];
  if (karyotype) args.push('--karyotype', karyotype);
  if (hifiDepth) args.push('--depth1', hifiDepth);
  if (nanoDepth) args.push('--depth2', nanoDepth);
  if (alignments) {
    // 如果是 paf 或 txt 都允许
    const ext = path.extname(alignments).toLowerCase();
    if (ext === '.paf') {
      args.push('--paf', alignments);
    } else {
      args.push('--alignments', alignments);
    }
  }

  log(`运行 CLI: node ${cliPath} ${args.join(' ')}`);
  const res = spawnSync('node', [cliPath, ...args], { encoding: 'utf-8' });
  if (res.error) {
    console.error('运行 CLI 失败:', res.error);
  }
  if (res.stdout) {
    console.log(res.stdout);
  }
  if (res.stderr) {
    console.error(res.stderr);
  }

  // 校验输出 SVG
  if (fs.existsSync(outSvg)) {
    const size = fs.statSync(outSvg).size;
    log(`输出文件: ${outSvg}, 大小=${size} 字节`);
    if (size < 100) {
      console.error('警告: 输出 SVG 过小，可能生成失败或无有效内容');
    } else {
      const content = fs.readFileSync(outSvg, 'utf-8');
      if (/^<svg[\s\S]*<\/svg>\s*$/.test(content)) {
        log('SVG 验证通过: 文件包含有效 <svg> 标签');
      } else {
        console.error('SVG 验证失败: 文件不包含完整的 <svg> 标签');
      }
    }
  } else {
    console.error('未生成输出 SVG 文件');
  }
}

main();