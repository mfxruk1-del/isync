// Tiny client for talking to our backend. Cookies (login) ride along automatically.

export interface VaultFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  sha256: string;
  width: number | null;
  height: number | null;
  hasThumb: boolean;
  createdAt: number;
}

export interface User {
  id: string;
  username: string;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const message = await res
      .json()
      .then((d) => d.error as string)
      .catch(() => res.statusText);
    throw new Error(message || 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  me: () => request<User>('GET', '/api/auth/me'),
  login: (username: string, password: string) =>
    request<User>('POST', '/api/auth/login', { username, password }),
  logout: () => request<{ ok: boolean }>('POST', '/api/auth/logout'),
  list: () => request<{ files: VaultFile[] }>('GET', '/api/files'),
  remove: (id: string) => request<void>('DELETE', `/api/files/${id}`),
  verifyOnServer: (id: string) =>
    request<{ ok: boolean; expected: string; actual: string }>(
      'GET',
      `/api/files/${id}/verify`
    ),
};

// Upload with progress, using XHR (fetch can't report upload progress).
export function uploadFiles(
  files: File[],
  onProgress: (percent: number) => void
): Promise<{ files: VaultFile[] }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const f of files) form.append('files', f, f.name);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/files');
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        try {
          reject(new Error(JSON.parse(xhr.responseText).error || 'Upload failed'));
        } catch {
          reject(new Error('Upload failed'));
        }
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(form);
  });
}

// SHA-256 of a Blob in the browser — used to prove a download is lossless.
export async function sha256OfBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}
