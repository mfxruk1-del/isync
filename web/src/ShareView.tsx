import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, formatBytes, type ShareContents, type SharedFile } from './api';
import Viewer from './Viewer';

export default function ShareView() {
  const { token = '' } = useParams();
  const [data, setData] = useState<ShareContents | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<SharedFile | null>(null);

  useEffect(() => {
    api
      .getShare(token)
      .then(setData)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-slate-400">Loading…</div>;
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div>
          <div className="text-4xl">🔗</div>
          <p className="mt-3 text-lg">{error || 'This link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-full max-w-5xl px-4 pb-16 pt-6">
      <header className="mb-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">🔒</span>
          <h1 className="text-xl font-semibold">Shared with you</h1>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          {data.files.length} item{data.files.length === 1 ? '' : 's'} · download in original quality
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {data.files.map((f) => (
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
