import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  uploadFiles,
  formatBytes,
  MAX_BATCH,
  type Share,
  type UploadProgress,
  type User,
  type VaultFile,
} from './api';
import Viewer, { type ViewerItem } from './Viewer';
import ShareManager from './ShareManager';
import ShareLinkModal from './ShareLinkModal';
import ShareCreateDialog, { type ShareOptions } from './ShareCreateDialog';
import InstallPrompt from './InstallPrompt';
import AdminPanel from './AdminPanel';

export default function Gallery({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadStatus, setUploadStatus] = useState<UploadProgress | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Selection + sharing state
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [newShare, setNewShare] = useState<Share | null>(null);
  const [showShares, setShowShares] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  // Search + indexing state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VaultFile[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [pending, setPending] = useState(0);

  async function refresh() {
    const { files } = await api.list();
    setFiles(files);
  }

  useEffect(() => {
    refresh()
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  // Debounced search: empty query shows the full gallery.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { files } = await api.search(q);
        setResults(files);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Poll indexing progress (so we can show "indexing…" while it catches up).
  const pollStatus = useCallback(async () => {
    try {
      const s = await api.indexStatus();
      setPending(s.aiDisabled ? 0 : s.pending);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    pollStatus();
    const t = setInterval(pollStatus, 6000);
    return () => clearInterval(t);
  }, [pollStatus]);

  // Arrived via Android "Share to Vault"? Pick up the shared files and upload.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('share-target')) {
      importShared();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startUpload(picked: File[]) {
    if (picked.length === 0) return;
    if (picked.length > MAX_BATCH) {
      setError(`You can upload up to ${MAX_BATCH} files at once (you chose ${picked.length}).`);
      return;
    }
    setError('');
    setNotice('');
    setUploadStatus({ percent: 0, completed: 0, total: picked.length });
    try {
      const { uploaded, failed } = await uploadFiles(picked, setUploadStatus);
      await refresh();
      if (failed > 0) setError(`${failed} file(s) failed. ${uploaded} uploaded.`);
      else setNotice(`Uploaded ${uploaded} file${uploaded === 1 ? '' : 's'}.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadStatus(null);
      if (inputRef.current) inputRef.current.value = '';
      pollStatus();
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    startUpload(Array.from(e.target.files ?? []));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    startUpload(dropped);
  }

  // Read files the service worker stashed from an Android share, then upload.
  async function importShared() {
    window.history.replaceState({}, '', '/'); // clean the URL
    try {
      const cache = await caches.open('vault-shared');
      const idxRes = await cache.match('/__shared__/index');
      if (!idxRes) return;
      const ids: string[] = await idxRes.json();
      const files: File[] = [];
      for (const id of ids) {
        const r = await cache.match(`/__shared__/${id}`);
        if (r) {
          const blob = await r.blob();
          const name = decodeURIComponent(r.headers.get('x-filename') || `shared-${id}`);
          files.push(new File([blob], name, { type: blob.type }));
        }
        await cache.delete(`/__shared__/${id}`);
      }
      await cache.delete('/__shared__/index');
      if (files.length) startUpload(files);
    } catch {
      /* ignore */
    }
  }

  async function logout() {
    await api.logout().catch(() => {});
    onLogout();
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startSelecting(id: string) {
    setSelecting(true);
    setSelected(new Set([id]));
  }

  function cancelSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  function onTileClick(f: VaultFile, i: number) {
    if (selecting) toggleSelect(f.id);
    else setActiveIndex(i);
  }

  async function doCreate(opts: ShareOptions) {
    const { share } = await api.createShare([...selected], opts);
    setNewShare(share);
    setShowCreate(false);
    cancelSelecting();
  }

  async function deleteCurrent() {
    if (activeIndex === null) return;
    const f = displayed[activeIndex];
    if (!f) return;
    if (!confirm(`Delete "${f.name}"? This cannot be undone.`)) return;
    try {
      await api.remove(f.id);
      const wasSearch = results !== null;
      const newList = (wasSearch ? results! : files).filter((x) => x.id !== f.id);
      if (wasSearch) {
        setResults(newList);
        setFiles((prev) => prev.filter((x) => x.id !== f.id));
      } else {
        setFiles(newList);
      }
      setActiveIndex(newList.length === 0 ? null : Math.min(activeIndex, newList.length - 1));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const isSearch = results !== null;
  const displayed = results ?? files;
  const viewerItems: ViewerItem[] = displayed.map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size,
    width: f.width,
    height: f.height,
    sha256: f.sha256,
    originalUrl: `/api/files/${f.id}/original`,
    thumbUrl: `/api/files/${f.id}/thumb`,
    hasThumb: f.hasThumb,
  }));

  return (
    <div
      className="relative mx-auto min-h-full max-w-5xl px-4 pb-24"
      onDragOver={(e) => {
        e.preventDefault();
        if (!selecting) setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-emerald-500/10 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-emerald-400/70 bg-ink/80 px-8 py-6 text-center">
            <div className="text-4xl">⬇️</div>
            <p className="mt-2 text-lg font-medium text-emerald-300">Drop to upload</p>
            <p className="text-xs text-slate-400">Images & videos · up to {MAX_BATCH} at once</p>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="sticky top-0 z-20 -mx-4 mb-4 flex items-center justify-between border-b border-white/5 bg-ink/70 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔒</span>
          <h1 className="text-lg font-semibold tracking-tight">Vault</h1>
        </div>
        <div className="flex items-center gap-2">
          {user.isAdmin && (
            <button onClick={() => setShowAdmin(true)} className="chip">
              People
            </button>
          )}
          <button onClick={() => setShowShares(true)} className="chip">
            Links
          </button>
          <button onClick={logout} className="chip">
            Sign out
          </button>
        </div>
      </header>

      <InstallPrompt />

      {/* Search */}
      <div className="mb-3">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            🔍
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your photos & videos (e.g. cat, beach, a name…)"
            className="field pl-10 pr-9"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-slate-400 hover:bg-white/5"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {pending > 0 && (
        <div className="mb-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">
          🧠 Making {pending} item{pending === 1 ? '' : 's'} searchable… (search works as
          they finish)
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {error}
        </div>
      )}

      {notice && !uploadStatus && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      {uploadStatus && (
        <div className="mb-4">
          <div className="mb-1 text-sm text-slate-400">
            Uploading {uploadStatus.completed}/{uploadStatus.total} · {uploadStatus.percent}%
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${uploadStatus.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Toolbar */}
      {displayed.length > 0 && (
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-slate-400">
            {isSearch ? `${displayed.length} result${displayed.length === 1 ? '' : 's'}` : `${files.length} item(s)`}
          </span>
          {selecting ? (
            <button onClick={cancelSelecting} className="text-slate-300 hover:underline">
              Cancel
            </button>
          ) : (
            <button onClick={() => setSelecting(true)} className="text-emerald-400 hover:underline">
              Select to share
            </button>
          )}
        </div>
      )}

      {/* Gallery */}
      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : isSearch && searching && displayed.length === 0 ? (
        <p className="mt-16 text-center text-slate-400">Searching…</p>
      ) : isSearch && displayed.length === 0 ? (
        <div className="mt-16 text-center text-slate-400">
          <p className="text-lg">No matches for “{query.trim()}”</p>
          <p className="mt-1 text-sm">Try a different word, or wait for indexing to finish.</p>
        </div>
      ) : !isSearch && files.length === 0 ? (
        <div className="mt-20 text-center text-slate-400">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-3xl">
            🖼️
          </div>
          <p className="text-lg font-medium text-slate-200">No photos yet</p>
          <p className="mt-1 text-sm">Tap the + button to upload your first lossless image.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {displayed.map((f, i) => {
            const isSel = selected.has(f.id);
            return (
              <button
                key={f.id}
                onClick={() => onTileClick(f, i)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  startSelecting(f.id);
                }}
                className={`group relative aspect-square overflow-hidden rounded-xl bg-white/5 ring-1 transition ${
                  isSel ? 'ring-2 ring-emerald-400' : 'ring-white/5 hover:ring-white/20'
                }`}
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
                {f.mimeType.startsWith('video/') && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white">
                      ▶
                    </span>
                  </span>
                )}
                {selecting && (
                  <span
                    className={`absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      isSel ? 'bg-emerald-500 text-emerald-950' : 'bg-black/50 text-white'
                    }`}
                  >
                    {isSel ? '✓' : ''}
                  </span>
                )}
                <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-slate-200">
                  {formatBytes(f.size)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Floating upload button + menu (hidden while selecting) */}
      {!selecting && (
        <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2">
          {showUploadMenu && (
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={() => {
                  setShowUploadMenu(false);
                  inputRef.current?.click();
                }}
                className="rounded-full border border-white/10 bg-panel px-4 py-2 text-sm shadow-lg hover:bg-white/5"
              >
                🖼️ Photos &amp; videos
              </button>
              <button
                onClick={() => {
                  setShowUploadMenu(false);
                  cameraRef.current?.click();
                }}
                className="rounded-full border border-white/10 bg-panel px-4 py-2 text-sm shadow-lg hover:bg-white/5"
              >
                📷 Take photo/video
              </button>
            </div>
          )}
          <button
            onClick={() => setShowUploadMenu((v) => !v)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-3xl text-emerald-950 shadow-glow transition hover:from-emerald-300 hover:to-emerald-500 active:scale-95"
            aria-label="Add"
          >
            {showUploadMenu ? '×' : '+'}
          </button>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden onChange={onPick} />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        hidden
        onChange={onPick}
      />

      {/* Selection action bar */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-ink/95 p-4 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <span className="text-sm text-slate-300">{selected.size} selected</span>
            <button
              onClick={() => setShowCreate(true)}
              disabled={selected.size === 0}
              className="rounded-lg bg-emerald-500 px-5 py-2.5 font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              Create share link
            </button>
          </div>
        </div>
      )}

      {activeIndex !== null && (
        <Viewer
          items={viewerItems}
          index={activeIndex}
          onIndex={setActiveIndex}
          onClose={() => setActiveIndex(null)}
          onDelete={deleteCurrent}
        />
      )}

      {showCreate && (
        <ShareCreateDialog
          itemCount={selected.size}
          onClose={() => setShowCreate(false)}
          onCreate={doCreate}
        />
      )}
      {newShare && <ShareLinkModal share={newShare} onClose={() => setNewShare(null)} />}
      {showShares && <ShareManager onClose={() => setShowShares(false)} />}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
    </div>
  );
}
