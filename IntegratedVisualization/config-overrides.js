const { override, addBabelPlugin, addWebpackAlias, addWebpackPlugin } = require('customize-cra');
const webpack = require('webpack');
const path = require('path');

module.exports = override(
  addBabelPlugin([
    'import',
    {
      libraryName: 'antd',
      libraryDirectory: 'es',
      style: 'css',
    },
  ]),
  addWebpackAlias({
    '@linkview/linkview-core': path.resolve(__dirname, 'node_modules/@linkview/linkview-core'),
    'chalk': path.resolve(__dirname, 'src/utils/chalkShim.ts'),
    'fs': path.resolve(__dirname, 'src/utils/fsShim.ts'),
    'async-validator': path.resolve(__dirname, 'src/utils/asyncValidatorShim.js'),
    // Keep aliases minimal to avoid interfering with module resolution
  }),
  addWebpackPlugin(
    new webpack.ProvidePlugin({
      process: 'process/browser',
    })
  ),
  addWebpackPlugin(
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    })
  ),
  (config) => {
    // Keep node polyfill defaults; do not override whole `process` object
    if (config.resolve && config.resolve.fallback) {
      config.resolve.fallback = Object.assign({}, config.resolve.fallback, {
        process: require.resolve('process/browser'),
      });
    }
    
    // 禁用 ModuleScopePlugin 以允许从 node_modules 导入本地包
    // Create React App 默认只允许从 src/ 导入，这会阻止导入 node_modules 中的本地包
    config.resolve.plugins = config.resolve.plugins.filter(
      (plugin) => plugin.constructor.name !== 'ModuleScopePlugin'
    );
    
    return config;
  }
);

