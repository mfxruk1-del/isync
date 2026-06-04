import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { api, formatBytes, type ShareResponse } from './api';
import Viewer, { type ViewerItem } from './Viewer';
import InstallPrompt from './InstallPrompt';

export default function ShareView() {
  const { token = '' } = useParams();
  const [resp, setResp] = useState<ShareResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

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
        <form onSubmit={unlock} className="panel w-full max-w-sm animate-pop p-8 text-center">
          <div className="text-4xl">🔐</div>
          <h1 className="mt-2 text-xl font-semibold">Password required</h1>
          <p className="mt-1 text-sm text-slate-400">This link is password-protected.</p>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field mt-5"
            placeholder="Enter password"
          />
          {unlockError && <p className="mt-3 text-sm text-rose-400">{unlockError}</p>}
          <button
            type="submit"
            disabled={unlocking}
            className="btn-primary mt-4 w-full"
          >
            {unlocking ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>
      </div>
    );
  }

  const items: ViewerItem[] = resp.files.map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size,
    width: f.width,
    height: f.height,
    sha256: f.sha256,
    originalUrl: `/api/s/${token}/items/${f.id}/original`,
    thumbUrl: `/api/s/${token}/items/${f.id}/thumb`,
    hasThumb: f.hasThumb,
  }));

  return (
    <div className="mx-auto min-h-full max-w-5xl animate-fade px-4 pb-16 pt-6">
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
        {resp.files.map((f, i) => (
          <button
            key={f.id}
            onClick={() => setActiveIndex(i)}
            className="group relative aspect-square overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/5 transition hover:ring-white/20"
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

      {activeIndex !== null && (
        <Viewer
          items={items}
          index={activeIndex}
          onIndex={setActiveIndex}
          onClose={() => setActiveIndex(null)}
        />
      )}
    </div>
  );
}
