// Minimal browser shim for Node 'fs' used by LINKVIEW core.
export function readFileSync() {
  throw new Error('fs.readFileSync is not available in the browser');
}
export default {} as any;