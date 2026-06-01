import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { api, formatBytes, type ShareResponse, type SharedFile } from './api';
import Viewer from './Viewer';
import InstallPrompt from './InstallPrompt';

export default function ShareView() {
  const { token = '' } = useParams();
  const [resp, setResp] = useState<ShareResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<SharedFile | null>(null);

  // Password prompt state
  const [password, setPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setResp(await api.getShare(token));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function unlock(e: FormEvent) {
    e.preventDefault();
    setUnlocking(true);
    setUnlockError('');
    try {
      await api.unlockShare(token, password);
      await load();
    } catch (err) {
      setUnlockError((err as Error).message);
    } finally {
      setUnlocking(false);
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-slate-400">Loading…</div>;
  }

  if (error || !resp) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div>
          <div className="text-4xl">🔗</div>
          <p className="mt-3 text-lg">{error || 'This link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  // Password-protected and not yet unlocked.
  if (resp.locked) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <form onSubmit={unlock} className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="text-4xl">🔐</div>
          <h1 className="mt-2 text-xl font-semibold">Password required</h1>
          <p className="mt-1 text-sm text-slate-400">This link is password-protected.</p>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-emerald-400/60"
            placeholder="Enter password"
          />
          {unlockError && <p className="mt-3 text-sm text-rose-400">{unlockError}</p>}
          <button
            type="submit"
            disabled={unlocking}
            className="mt-4 w-full rounded-lg bg-emerald-500 py-2 font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {unlocking ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-full max-w-5xl px-4 pb-16 pt-6">
      <InstallPrompt />
      <header className="mb-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">🔒</span>
          <h1 className="text-xl font-semibold">Shared with you</h1>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          {resp.files.length} item{resp.files.length === 1 ? '' : 's'} · download in original quality
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {resp.files.map((f) => (
          <button
            key={f.id}
            onClick={() => setActive(f)}
            className="group relative aspect-square overflow-hidden rounded-lg bg-white/5"
            title={f.name}
          >
            {f.hasThumb ? (
              <img
                src={`/api/s/${token}/items/${f.id}/thumb`}
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
            <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-slate-200">
              {formatBytes(f.size)}
            </span>
          </button>
        ))}
      </div>

      {active && (
        <Viewer
          item={{
            name: active.name,
            mimeType: active.mimeType,
            size: active.size,
            width: active.width,
            height: active.height,
            sha256: active.sha256,
            originalUrl: `/api/s/${token}/items/${active.id}/original`,
          }}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}
