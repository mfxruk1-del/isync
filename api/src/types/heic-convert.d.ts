// Minimal type declaration for heic-convert (no official types).
declare module 'heic-convert' {
  interface ConvertOptions {
    buffer: Buffer | Uint8Array;
    format: 'JPEG' | 'PNG';
    quality?: number; // 0..1
  }
  function convert(options: ConvertOptions): Promise<Buffer>;
  export default convert;
}
