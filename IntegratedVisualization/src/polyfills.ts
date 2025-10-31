// Ensure a global process object exists in browser builds (webpack 4 / CRA)
import proc from 'process/browser';
(window as any).process = proc as any;