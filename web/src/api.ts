// Tiny client for talking to our backend. Cookies (login) ride along automatically.
import Uppy from '@uppy/core';
import Tus from '@uppy/tus';

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
  isAdmin: boolean;
}

export interface Invite {
  id: string;
  code: string;
  path: string; // e.g. /join/abc123
  used: boolean;
  usedBy: string | null;
  expiresAt: number | null;
  createdAt: number;
}

export interface Member {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: number;
  fileCount: number;
}

export interface Share {
  id: string;
  token: string;
  path: string; // e.g. /s/abc123
  title: string | null;
  expiresAt: number | null;
  hasPassword: boolean;
  createdAt: number;
  itemCount: number;
}

// A file as seen through a public share link (no internal fields).
export interface SharedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  sha256: string;
  width: number | null;
  height: number | null;
  hasThumb: boolean;
}

// A protected share returns { locked: true } until the password is provided.
export type ShareResponse =
  | { locked: true }
  | {
      locked: false;
      title: string | null;
      createdAt: number;
      expiresAt: number | null;
      files: SharedFile[];
    };

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

  // --- Invite-based registration ---
  checkInvite: (code: string) =>
    request<{ valid: boolean }>('GET', `/api/auth/invite/${code}`),
  register: (code: string, username: string, password: string) =>
    request<User>('POST', '/api/auth/register', { code, username, password }),

  // --- Admin: invites & members ---
  createInvite: (expiresInDays?: number) =>
    request<{ invite: Invite }>('POST', '/api/admin/invites', { expiresInDays }),
  listInvites: () => request<{ invites: Invite[] }>('GET', '/api/admin/invites'),
  revokeInvite: (id: string) => request<void>('DELETE', `/api/admin/invites/${id}`),
  listMembers: () => request<{ users: Member[] }>('GET', '/api/admin/users'),

  // --- AI / OCR search ---
  search: (q: string) =>
    request<{ files: VaultFile[] }>('GET', `/api/search?q=${encodeURIComponent(q)}`),
  indexStatus: () =>
    request<{ total: number; indexed: number; pending: number; aiDisabled: boolean }>(
      'GET',
      '/api/index/status'
    ),
  list: () => request<{ files: VaultFile[] }>('GET', '/api/files'),
  remove: (id: string) => request<void>('DELETE', `/api/files/${id}`),
  verifyOnServer: (id: string) =>
    request<{ ok: boolean; expected: string; actual: string }>(
      'GET',
      `/api/files/${id}/verify`
    ),

  // --- Shares (owner) ---
  createShare: (
    fileIds: string[],
    opts?: { title?: string; expiresInDays?: number; password?: string }
  ) => request<{ share: Share }>('POST', '/api/shares', { fileIds, ...opts }),
  listShares: () => request<{ shares: Share[] }>('GET', '/api/shares'),
  revokeShare: (id: string) => request<void>('DELETE', `/api/shares/${id}`),

  // --- Public share (no login) ---
  getShare: (token: string) => request<ShareResponse>('GET', `/api/s/${token}`),
  unlockShare: (token: string, password: string) =>
    request<{ ok: boolean }>('POST', `/api/s/${token}/unlock`, { password }),
};

// Resumable, chunked uploads via the tus protocol (Uppy client).
// Big files survive dropped connections and resume instead of restarting.
export function uploadFiles(
  files: File[],
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const uppy = new Uppy({ autoProceed: true });
    uppy.use(Tus, {
      endpoint: '/api/uploads',
      chunkSize: 16 * 1024 * 1024, // 16 MB chunks → fine-grained resume
      retryDelays: [0, 1000, 3000, 5000, 10000],
    });

    uppy.on('progress', (percent) => onProgress(percent));
    uppy.on('complete', (result) => {
      const failed = result.failed ?? [];
      if (failed.length > 0) {
        reject(new Error(failed[0]?.error || 'Upload failed'));
      } else {
        resolve();
      }
      uppy.destroy();
    });

    try {
      for (const f of files) {
        uppy.addFile({
          name: f.name,
          type: f.type,
          data: f,
          meta: { filename: f.name, filetype: f.type },
        });
      }
    } catch (err) {
      uppy.destroy();
      reject(err as Error);
    }
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
