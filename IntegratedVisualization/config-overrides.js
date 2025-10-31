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
    '@linkview/linkview-align-parser': path.resolve(__dirname, 'src/utils/alignParserShim.ts'),
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
      'process.env': JSON.stringify({ NODE_ENV: 'development' }),
    })
  ),
  (config) => {
    // Keep node polyfill defaults; do not override whole `process` object
    if (config.resolve && config.resolve.fallback) {
      config.resolve.fallback = Object.assign({}, config.resolve.fallback, {
        process: require.resolve('process/browser'),
      });
    }
    return config;
  }
);

