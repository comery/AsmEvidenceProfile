// Ensure a robust global `process` for browser builds
import proc from 'process/browser';
const g: any = window as any;
g.process = g.process || proc;
g.process.env = g.process.env || { NODE_ENV: process.env?.NODE_ENV || 'development' };
g.process.browser = true;