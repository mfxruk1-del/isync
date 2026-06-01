// Self-hosted AI: CLIP (understands image content) + Tesseract (reads text).
// Everything runs locally on the VPS — no cloud, fully private.
//
// Models are loaded lazily on first use and cached on disk (paths.models).
import {
  env,
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
} from '@xenova/transformers';
import { createWorker } from 'tesseract.js';
import { paths } from './config';

// patch32 = a good speed/accuracy balance for CPU. Quantized by default (small).
const CLIP_MODEL = 'Xenova/clip-vit-base-patch32';

// Persist downloaded model weights on disk so restarts don't re-download.
env.cacheDir = paths.models;
env.allowRemoteModels = true;

// Lazy singletons (typed loosely — the library's runtime shapes are dynamic).
let processorP: Promise<any> | null = null;
let visionP: Promise<any> | null = null;
let tokenizerP: Promise<any> | null = null;
let textP: Promise<any> | null = null;
let ocrP: Promise<any> | null = null;

function getProcessor() {
  return (processorP ??= AutoProcessor.from_pretrained(CLIP_MODEL) as Promise<any>);
}
function getVision() {
  return (visionP ??= CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL) as Promise<any>);
}
function getTokenizer() {
  return (tokenizerP ??= AutoTokenizer.from_pretrained(CLIP_MODEL) as Promise<any>);
}
function getText() {
  return (textP ??= CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL) as Promise<any>);
}
function getOcr() {
  return (ocrP ??= createWorker('eng', undefined, { cachePath: paths.models }) as Promise<any>);
}

function l2normalize(v: Float32Array): Float32Array {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}

// Image → 512-dim CLIP embedding (normalized).
export async function embedImageFile(path: string): Promise<Float32Array> {
  const processor = await getProcessor();
  const vision = await getVision();
  const image = await RawImage.read(path);
  const inputs = await processor(image);
  const output: any = await vision(inputs);
  return l2normalize(Float32Array.from(output.image_embeds.data as Float32Array));
}

// Text query → 512-dim CLIP embedding (same space as images, normalized).
export async function embedText(query: string): Promise<Float32Array> {
  const tokenizer = await getTokenizer();
  const textModel = await getText();
  const inputs = tokenizer(query, { padding: true, truncation: true });
  const output: any = await textModel(inputs);
  return l2normalize(Float32Array.from(output.text_embeds.data as Float32Array));
}

// Image → any readable text it contains.
export async function ocrImageFile(path: string): Promise<string> {
  const worker = await getOcr();
  const { data } = await worker.recognize(path);
  return (data.text || '').trim();
}

// Cosine similarity of two normalized vectors (= dot product).
export function cosine(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) sum += a[i] * b[i];
  return sum;
}

// Convert a stored BLOB back into a Float32 vector.
export function bufferToVector(buf: Buffer): Float32Array {
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
}
