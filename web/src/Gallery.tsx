import { useCallback, useEffect, useRef, useState } from 'react';
import { api, uploadFiles, formatBytes, type Share, type User, type VaultFile } from './api';
import Viewer from './Viewer';
import ShareManager from './ShareManager';
import ShareLinkModal from './ShareLinkModal';
import ShareCreateDialog, { type ShareOptions } from './ShareCreateDialog';
import InstallPrompt from './InstallPrompt';
import AdminPanel from './AdminPanel';

export default function Gallery({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState<VaultFile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  function onTileClick(f: VaultFile) {
    if (selecting) toggleSelect(f.id);
    else setActive(f);
  }

  async function doCreate(opts: ShareOptions) {
    const { share } = await api.createShare([...selected], opts);
    setNewShare(share);
    setShowCreate(false);
    cancelSelecting();
  }

  async function deleteActive() {
    if (!active) return;
    if (!confirm(`Delete "${active.name}"? This cannot be undone.`)) return;
    const id = active.id;
    try {
      await api.remove(id);
      setActive(null);
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const isSearch = results !== null;
  const displayed = results ?? files;

  return (
    <div className="mx-auto min-h-full max-w-5xl px-4 pb-24 pt-4">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔒</span>
          <h1 className="text-xl font-semibold">Vault</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          {user.isAdmin && (
            <button
              onClick={() => setShowAdmin(true)}
              className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/5"
            >
              People
            </button>
          )}
          <button
            onClick={() => setShowShares(true)}
            className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/5"
          >
            Links
          </button>
          <button onClick={logout} className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/5">
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
            className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pl-10 pr-9 text-sm outline-none focus:border-emerald-400/60"
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

      {uploadPct !== null && (
        <div className="mb-4">
          <div className="mb-1 text-sm text-slate-400">Uploading… {uploadPct}%</div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${uploadPct}%` }} />
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
        <div className="mt-16 text-center text-slate-400">
          <p className="text-lg">No photos yet</p>
          <p className="mt-1 text-sm">Tap the + button to upload your first lossless image.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {displayed.map((f) => {
            const isSel = selected.has(f.id);
            return (
              <button
                key={f.id}
                onClick={() => onTileClick(f)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  startSelecting(f.id);
                }}
                className={`group relative aspect-square overflow-hidden rounded-lg bg-white/5 ${
                  isSel ? 'ring-2 ring-emerald-400' : ''
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

      {/* Floating upload button (hidden while selecting) */}
      {!selecting && (
        <button
          onClick={() => inputRef.current?.click()}
          className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-3xl text-emerald-950 shadow-lg transition hover:bg-emerald-400"
          aria-label="Upload"
        >
          +
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
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

      {active && (
        <Viewer
          item={{
            name: active.name,
            mimeType: active.mimeType,
            size: active.size,
            width: active.width,
            height: active.height,
            sha256: active.sha256,
            originalUrl: `/api/files/${active.id}/original`,
          }}
          onClose={() => setActive(null)}
          onDelete={deleteActive}
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
