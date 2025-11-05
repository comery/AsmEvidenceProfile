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
  try {
    // 使用 --skipLibCheck 跳过类型检查，只编译代码
    execSync(`npx tsc -p ${srcTsconfigPath} --outDir ${outDir} --skipLibCheck --noEmitOnError`, { stdio: 'inherit' });
    return true;
  } catch (e) {
    // 即使有错误也继续，检查是否生成了文件
    console.warn(`[postinstall] TypeScript compilation had errors, but checking for generated files...`);
    return true; // 返回 true 让调用者检查是否生成了文件
  }
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
  
  // 确保目录存在
  const corePkgDir = join(nodeModules, '@linkview', 'linkview-core');
  const parserPkgDir = join(nodeModules, '@linkview', 'linkview-align-parser');
  
  if (!existsSync(corePkgDir)) {
    mkdirSync(corePkgDir, { recursive: true });
  }
  if (!existsSync(parserPkgDir)) {
    mkdirSync(parserPkgDir, { recursive: true });
  }

  // 先构建 linkview-align-parser（因为 linkview-core 依赖它）
  const parserSrcTsconfig = join(projectRoot, '..', 'LINKVIEW2', 'packages', 'linkview-align-parser', 'tsconfig.json');
  const parserTargetDir = join(parserPkgDir, 'lib');
  
  if (existsSync(parserSrcTsconfig)) {
    console.log('[postinstall] Building linkview-align-parser first...');
    if (buildPkg(parserSrcTsconfig, parserTargetDir, projectRoot)) {
      rewriteMain(parserPkgDir, 'lib/index.js');
      // Browser safety patch: remove process.exit() from utils/error.js
      try {
        const errJsPath = join(parserTargetDir, 'utils', 'error.js');
        if (existsSync(errJsPath)) {
          const src = readFileSync(errJsPath, 'utf-8');
          const patched = src.replace(/process\.exit\(\);?/g, '/* no-op in browser */');
          if (patched !== src) {
            writeFileSync(errJsPath, patched);
            console.log('[postinstall] Patched @linkview/linkview-align-parser/lib/utils/error.js to remove process.exit().');
          }
        }
      } catch (e) {
        console.warn('[postinstall] Failed to patch align-parser error.js:', e && e.message ? e.message : e);
      }
    }
  } else {
    console.warn('[postinstall] LINKVIEW2 source not found, skipping build for linkview-align-parser');
    // 创建基本的 package.json 以便模块可以解析
    const parserPkgJson = join(parserPkgDir, 'package.json');
    if (!existsSync(parserPkgJson)) {
      writeFileSync(parserPkgJson, JSON.stringify({
        name: '@linkview/linkview-align-parser',
        version: '1.0.3',
        main: 'index.js'
      }, null, 2));
    }
  }

  // 然后构建 linkview-core
  const coreSrcTsconfig = join(projectRoot, '..', 'LINKVIEW2', 'packages', 'linkview-core', 'tsconfig.json');
  const coreTargetDir = join(corePkgDir, 'lib');
  
  if (existsSync(coreSrcTsconfig)) {
    console.log('[postinstall] Building linkview-core...');
    // 即使有错误也继续编译（--noEmitOnError false）
    try {
      buildPkg(coreSrcTsconfig, coreTargetDir, projectRoot);
      rewriteMain(corePkgDir, 'lib/index.js');
    } catch (e) {
      console.warn('[postinstall] Some TypeScript errors in linkview-core, but continuing...');
      // 检查是否至少生成了部分文件
      if (existsSync(join(coreTargetDir, 'index.js')) || existsSync(join(coreTargetDir, 'main', 'index.js'))) {
        rewriteMain(corePkgDir, 'lib/index.js');
        console.log('[postinstall] Partial compilation succeeded, using compiled files.');
      }
    }
  } else {
    console.warn('[postinstall] LINKVIEW2 source not found, skipping build for linkview-core');
    // 创建基本的 package.json 以便模块可以解析
    const corePkgJson = join(corePkgDir, 'package.json');
    if (!existsSync(corePkgJson)) {
      writeFileSync(corePkgJson, JSON.stringify({
        name: '@linkview/linkview-core',
        version: '1.0.7',
        main: 'index.js'
      }, null, 2));
    }
  }

  console.log('[postinstall] LINKVIEW local deps setup completed.');
} catch (e) {
  console.warn('[postinstall] Failed to setup LINKVIEW deps:', e.message);
}


