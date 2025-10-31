declare module 'pako' {
  export function ungzip(
    data: Uint8Array | ArrayBuffer | string,
    options?: any
  ): Uint8Array;
}