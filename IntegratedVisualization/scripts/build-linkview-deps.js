/*
  在安装后编译本地依赖 LINKVIEW2 中的 TypeScript 源码到 node_modules，
  以便 CRA 能正常加载（CRA 默认不会编译 node_modules 里的 TS）
*/
const { execSync } = require('child_process');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

function buildPkg(srcTsconfigPath, outDir, projectRoot) {
  if (!existsSync(srcTsconfigPath)) return false;
  mkdirSync(outDir, { recursive: true });
  console.log(`[postinstall] Building TS -> JS: ${srcTsconfigPath} -> ${outDir}`);
  execSync(`npx tsc -p ${srcTsconfigPath} --outDir ${outDir} --noEmitOnError false`, { stdio: 'inherit' });
  return true;
}

function rewriteMain(pkgDir, newMain) {
  const pkgJsonPath = join(pkgDir, 'package.json');
  if (!existsSync(pkgJsonPath)) return;
  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
  pkg.main = newMain;
  // 有些包使用 exports 字段，删除以避免解析到 TS 源码
  delete pkg.exports;
  writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2));
}

try {
  const projectRoot = process.cwd();
  const nodeModules = join(projectRoot, 'node_modules');

  // 构建 linkview-core
  const coreSrcTsconfig = join(projectRoot, '..', 'LINKVIEW2', 'packages', 'linkview-core', 'tsconfig.json');
  const coreTargetDir = join(nodeModules, '@linkview', 'linkview-core', 'lib');
  const corePkgDir = join(nodeModules, '@linkview', 'linkview-core');
  if (buildPkg(coreSrcTsconfig, coreTargetDir, projectRoot)) {
    rewriteMain(corePkgDir, 'lib/index.js');
  }

  // 构建 linkview-align-parser
  const parserSrcTsconfig = join(projectRoot, '..', 'LINKVIEW2', 'packages', 'linkview-align-parser', 'tsconfig.json');
  const parserTargetDir = join(nodeModules, '@linkview', 'linkview-align-parser', 'lib');
  const parserPkgDir = join(nodeModules, '@linkview', 'linkview-align-parser');
  if (buildPkg(parserSrcTsconfig, parserTargetDir, projectRoot)) {
    rewriteMain(parserPkgDir, 'lib/index.js');
  }

  console.log('[postinstall] LINKVIEW local deps compiled successfully.');
} catch (e) {
  console.warn('[postinstall] Failed to build LINKVIEW deps:', e.message);
}


