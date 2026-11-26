import * as FileSystem from 'expo-file-system/legacy';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64(base64: string): Uint8Array {
  const clean = base64.replace(/\s/g, '');
  if (clean.length % 4 === 1) throw new Error('The selected image is invalid');

  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4) - padding);
  let bits = 0;
  let buffer = 0;
  let offset = 0;

  for (const char of clean) {
    if (char === '=') break;
    const value = BASE64_ALPHABET.indexOf(char);
    if (value < 0) throw new Error('The selected image is invalid');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[offset++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}

/**
 * Reads a picked image into bytes for Supabase Storage.
 *
 * React Native's `fetch()` cannot reliably read the `content://` URIs returned
 * by the Android image picker (it responds with 404). FileSystem supports both
 * those URIs and regular `file://` paths. Remote/blob/data URIs still use
 * `fetch()`, which also covers expo-image-picker on web.
 */
export async function readImageBytes(uri: string): Promise<Uint8Array> {
  if (/^(file:|content:)/i.test(uri)) {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    if (!base64) throw new Error('The selected image is empty');
    return decodeBase64(base64);
  }

  if (/^(https?:|blob:|data:)/i.test(uri)) {
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`Could not read image (${response.status})`);
    return new Uint8Array(await response.arrayBuffer());
  }

  throw new Error('The selected image could not be read');
}

/** Detects the real image format so content:// URIs without extensions upload correctly. */
export function detectImageExtension(bytes: Uint8Array): string | null {
  const matches = (signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);

  if (matches([0xff, 0xd8, 0xff])) return 'jpg';
  if (matches([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (matches([0x47, 0x49, 0x46, 0x38])) return 'gif';
  if (matches([0x52, 0x49, 0x46, 0x46]) && matches([0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp';
  }
  return null;
}

export function contentTypeForExtension(extension: string): string {
  switch (extension.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}
