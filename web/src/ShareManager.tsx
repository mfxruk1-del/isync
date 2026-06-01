import { useEffect, useState } from 'react';
import { api, type Share } from './api';

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ShareManager({ onClose }: { onClose: () => void }) {
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    const { shares } = await api.listShares();
    setShares(shares);
  }

  useEffect(() => {
    load()
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function copy(share: Share) {
    const url = `${window.location.origin}${share.path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(share.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* ignore */
    }
  }

  async function revoke(share: Share) {
    if (!confirm('Revoke this link? Anyone using it will lose access immediately.')) return;
    try {
      await api.revokeShare(share.id);
      setShares((prev) => prev.filter((s) => s.id !== share.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 className="text-lg font-semibold">Your share links</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-white/10">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}
          {loading ? (
            <p className="text-slate-400">Loading…</p>
          ) : shares.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No share links yet. Select photos and tap “Create share link”.
            </p>
          ) : (
            <ul className="space-y-2">
              {shares.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {s.itemCount} item{s.itemCount === 1 ? '' : 's'}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      Created {formatDate(s.createdAt)}
                      {s.expiresAt ? ` · expires ${formatDate(s.expiresAt)}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => copy(s)}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5"
                    >
                      {copiedId === s.id ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={() => revoke(s)}
                      className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
                    >
                      Revoke
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
