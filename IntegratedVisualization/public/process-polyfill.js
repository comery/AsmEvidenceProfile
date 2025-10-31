// Minimal process polyfill (copied from process/browser)
var process = window.process || {};
process.nextTick = process.nextTick || function (fun) { setTimeout(fun, 0); };
process.title = process.title || 'browser';
process.browser = true;
process.env = process.env || { NODE_ENV: 'development' };
process.argv = process.argv || [];
process.version = process.version || '';
process.versions = process.versions || {};
window.process = process;