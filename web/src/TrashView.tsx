import { useEffect, useState } from 'react';
import { api, formatBytes, type VaultFile } from './api';
import { useBackToClose } from './useBackToClose';

const RETENTION_DAYS = 30;

function daysLeft(deletedAt?: number | null): number {
  if (!deletedAt) return RETENTION_DAYS;
  const elapsed = (Date.now() - deletedAt) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil(RETENTION_DAYS - elapsed));
}

// The Trash: soft-deleted items, restorable until they auto-purge after 30 days.
export default function TrashView({ onClose }: { onClose: () => void }) {
  useBackToClose(onClose);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    const { files } = await api.listTrash();
    setFiles(files);
  }

  useEffect(() => {
    load()
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function restore(f: VaultFile) {
    try {
      await api.restore(f.id);
      setFiles((prev) => prev.filter((x) => x.id !== f.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(f: VaultFile) {
    if (!confirm(`Permanently delete "${f.name}"? This cannot be undone.`)) return;
    try {
      await api.deletePermanent(f.id);
      setFiles((prev) => prev.filter((x) => x.id !== f.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function empty() {
    if (files.length === 0) return;
    if (!confirm('Permanently delete everything in the Trash? This cannot be undone.')) return;
    try {
      await api.emptyTrash();
      setFiles([]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="overlay items-center justify-center" onClick={onClose}>
      <div
        className="panel flex max-h-[85vh] w-full max-w-lg animate-pop flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-base p-4">
          <h2 className="text-lg font-semibold">Trash</h2>
          <div className="flex items-center gap-2">
            {files.length > 0 && (
              <button onClick={empty} className="btn-danger px-3 py-1.5 text-xs">
                Empty trash
              </button>
            )}
            <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-muted hover:bg-surface-2">
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}
          <p className="mb-3 text-xs text-faint">
            Items are kept for {RETENTION_DAYS} days, then permanently deleted.
          </p>
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : files.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Trash is empty.</p>
          ) : (
            <ul className="space-y-2">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-3 rounded-lg border border-base bg-surface-2 p-2"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-surface-2">
                    {f.hasThumb ? (
                      <img
                        src={`/api/files/${f.id}/thumb`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-lg">
                        {f.mimeType.startsWith('video/') ? '🎬' : '📄'}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{f.name}</p>
                    <p className="text-xs text-faint">
                      {formatBytes(f.size)} · deletes in {daysLeft(f.deletedAt)}d
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => restore(f)}
                      className="rounded-lg border border-base px-2.5 py-1 text-xs hover:bg-surface-2"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => remove(f)}
                      className="rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
