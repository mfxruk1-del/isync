import { useEffect, useRef, useState } from 'react';
import { api, uploadFiles, formatBytes, type User, type VaultFile } from './api';
import Lightbox from './Lightbox';

export default function Gallery({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState<VaultFile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const { files } = await api.list();
    setFiles(files);
  }

  useEffect(() => {
    refresh()
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    setError('');
    setUploadPct(0);
    try {
      await uploadFiles(picked, setUploadPct);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadPct(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function logout() {
    await api.logout().catch(() => {});
    onLogout();
  }

  async function onDeleted(id: string) {
    setActive(null);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="mx-auto min-h-full max-w-5xl px-4 pb-24 pt-4">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔒</span>
          <h1 className="text-xl font-semibold">Vault</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span className="hidden sm:inline">{user.username}</span>
          <button onClick={logout} className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/5">
            Sign out
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Upload progress */}
      {uploadPct !== null && (
        <div className="mb-4">
          <div className="mb-1 text-sm text-slate-400">Uploading… {uploadPct}%</div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${uploadPct}%` }} />
          </div>
        </div>
      )}

      {/* Gallery */}
      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : files.length === 0 ? (
        <div className="mt-16 text-center text-slate-400">
          <p className="text-lg">No photos yet</p>
          <p className="mt-1 text-sm">Tap the + button to upload your first lossless image.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {files.map((f) => (
            <button
              key={f.id}
              onClick={() => setActive(f)}
              className="group relative aspect-square overflow-hidden rounded-lg bg-white/5"
              title={f.name}
            >
              {f.hasThumb ? (
                <img
                  src={`/api/files/${f.id}/thumb`}
                  alt={f.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center text-xs text-slate-400">
                  <span className="text-2xl">📄</span>
                  <span className="mt-1 line-clamp-2 break-all">{f.name}</span>
                </div>
              )}
              <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-slate-200">
                {formatBytes(f.size)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Floating upload button */}
      <button
        onClick={() => inputRef.current?.click()}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-3xl text-emerald-950 shadow-lg transition hover:bg-emerald-400"
        aria-label="Upload"
      >
        +
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={onPick}
      />

      {active && <Lightbox file={active} onClose={() => setActive(null)} onDeleted={onDeleted} />}
    </div>
  );
}
