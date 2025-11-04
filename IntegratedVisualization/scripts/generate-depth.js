#!/usr/bin/env node
/**
 * Generate synthetic depth files with normal distribution per chromosome.
 * Usage:
 *   node scripts/generate-depth.js --karyotype examples/karyotype.txt \
 *     --out1 examples/hifi.normal.depth.txt --mean1 30 --std1 5 \
 *     --out2 examples/nano.normal.depth.txt --mean2 25 --std2 8
 */
const fs = require('fs');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key.startsWith('--')) {
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function parseKaryotype(content) {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const chroms = [];
  for (const line of lines) {
    const [ctg, startStr, endStr] = line.split(':');
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    if (!ctg || isNaN(start) || isNaN(end)) continue;
    const length = Math.max(start, end) + 1; // ensure index end is included
    chroms.push({ ctg, length });
  }
  return chroms;
}

function gaussianBoxMuller() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); // [0,1) -> (0,1)
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function generateDepth(chroms, mean, std) {
  const lines = [];
  for (const { ctg, length } of chroms) {
    lines.push('>' + ctg);
    for (let i = 0; i < length; i++) {
      const g = gaussianBoxMuller();
      let val = Math.round(mean + std * g);
      if (val < 0) val = 0;
      lines.push(String(val));
    }
  }
  return lines.join('\n') + '\n';
}

function main() {
  const args = parseArgs(process.argv);
  const karyotypePath = args['--karyotype'] || 'examples/karyotype.txt';
  const out1 = args['--out1'] || 'examples/hifi.normal.depth.txt';
  const out2 = args['--out2'] || 'examples/nano.normal.depth.txt';
  const mean1 = parseFloat(args['--mean1'] || '30');
  const std1 = parseFloat(args['--std1'] || '5');
  const mean2 = parseFloat(args['--mean2'] || '25');
  const std2 = parseFloat(args['--std2'] || '8');

  const karyotype = readText(karyotypePath);
  const chroms = parseKaryotype(karyotype);
  if (chroms.length === 0) {
    console.error('No valid chromosomes parsed from karyotype:', karyotypePath);
    process.exit(1);
  }

  const content1 = generateDepth(chroms, mean1, std1);
  const content2 = generateDepth(chroms, mean2, std2);
  fs.writeFileSync(out1, content1, 'utf-8');
  fs.writeFileSync(out2, content2, 'utf-8');
  console.log('Generated:', out1, 'and', out2);
}

main();