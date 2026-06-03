import { useEffect, useRef, useState } from 'react';
import { sha256OfBlob, formatBytes } from './api';
import { useBackToClose } from './useBackToClose';

export interface ViewerItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  sha256: string;
  // Base URL for the original file. We append ?inline=1 for preview.
  originalUrl: string;
  // Thumbnail URL — used in the filmstrip and to preview HEIC.
  thumbUrl?: string;
  hasThumb?: boolean;
}

// Files above this size stream straight to disk (verifying in-browser would
// load the whole file into memory and could crash a phone).
const VERIFY_LIMIT = 150 * 1024 * 1024; // 150 MB

export default function Viewer({
  items,
  index,
  onIndex,
  onClose,
  onDelete,
}: {
  items: ViewerItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [status, setStatus] = useState('');
  const [verified, setVerified] = useState<null | boolean>(null);
  const [busy, setBusy] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  // Android Back button closes the viewer instead of leaving the app.
  useBackToClose(onClose);

  const current = items[index];

  const goPrev = () => index > 0 && onIndex(index - 1);
  const goNext = () => index < items.length - 1 && onIndex(index + 1);

  // Reset the download status whenever the current item changes.
  useEffect(() => {
    setStatus('');
    setVerified(null);
    setBusy(false);
  }, [index]);

  // Keyboard navigation (desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, items.length]);

  // Keep the active filmstrip thumbnail centered.
  useEffect(() => {
    const el = stripRef.current?.querySelector(`[data-idx="${index}"]`);
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [index]);

  if (!current) return null;

  const isImage = current.mimeType.startsWith('image/');
  const isVideo = current.mimeType.startsWith('video/');
  const inlineUrl =
    current.originalUrl + (current.originalUrl.includes('?') ? '&' : '?') + 'inline=1';
  const isHeic = /heic|heif/i.test(current.mimeType);
  const previewSrc = isImage && isHeic && current.thumbUrl ? current.thumbUrl : inlineUrl;

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) goPrev();
      else goNext();
    }
  }

  async function download() {
    if (current.size > VERIFY_LIMIT) {
      const a = document.createElement('a');
      a.href = current.originalUrl;
      a.download = current.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setVerified(null);
      setStatus('Downloading in full original quality (large file — checksum below).');
      return;
    }
    setBusy(true);
    setVerified(null);
    setStatus('Downloading original…');
    try {
      const res = await fetch(current.originalUrl, { credentials: 'include' });
      if (!res.ok) throw new Error('Download failed');
      const serverHash = res.headers.get('X-Checksum-SHA256');
      const blob = await res.blob();
      setStatus('Verifying…');
      const localHash = await sha256OfBlob(blob);
      const identical = localHash === current.sha256 && localHash === serverHash;
      setVerified(identical);
      setStatus(
        identical
          ? '✅ Verified byte-for-byte identical — zero quality loss.'
          : '⚠️ Checksum mismatch! The file changed in transit.'
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = current.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setStatus((err as Error).message);
      setVerified(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm" onClick={onClose}>
      {/* Top bar */}
      <div className="flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{current.name}</p>
          <p className="text-xs text-slate-400">
            {index + 1} / {items.length} · {formatBytes(current.size)}
            {current.width && current.height ? ` · ${current.width}×${current.height}` : ''}
          </p>
        </div>
        <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-white/10">
          ✕
        </button>
      </div>

      {/* Media area (swipeable) */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden px-2"
        onClick={onClose}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {index > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-1 z-10 hidden h-12 w-12 items-center justify-center rounded-full bg-black/40 text-2xl text-white hover:bg-black/60 sm:flex"
            aria-label="Previous"
          >
            ‹
          </button>
        )}

        {isImage ? (
          <img
            key={current.id}
            src={previewSrc}
            alt={current.name}
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        ) : isVideo ? (
          <video
            key={current.id}
            src={inlineUrl}
            controls
            playsInline
            className="max-h-full max-w-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="text-center text-slate-300" onClick={(e) => e.stopPropagation()}>
            <div className="text-6xl">📄</div>
            <p className="mt-2">{current.name}</p>
          </div>
        )}

        {index < items.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-1 z-10 hidden h-12 w-12 items-center justify-center rounded-full bg-black/40 text-2xl text-white hover:bg-black/60 sm:flex"
            aria-label="Next"
          >
            ›
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2 px-4 pt-2" onClick={(e) => e.stopPropagation()}>
        {status && (
          <p
            className={`text-center text-sm ${
              verified === true
                ? 'text-emerald-400'
                : verified === false
                ? 'text-rose-400'
                : 'text-slate-400'
            }`}
          >
            {status}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={download}
            disabled={busy}
            className="rounded-lg bg-emerald-500 px-5 py-2.5 font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            Download (lossless)
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={busy}
              className="rounded-lg border border-rose-500/40 px-4 py-2.5 text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Filmstrip */}
      <div
        ref={stripRef}
        className="flex gap-1.5 overflow-x-auto p-3"
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((it, i) => (
          <button
            key={it.id}
            data-idx={i}
            onClick={() => onIndex(i)}
            className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-white/5 ${
              i === index ? 'ring-2 ring-emerald-400' : 'opacity-60 hover:opacity-100'
            }`}
            title={it.name}
          >
            {it.hasThumb && it.thumbUrl ? (
              <img src={it.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-lg">
                {it.mimeType.startsWith('video/') ? '🎬' : '📄'}
              </span>
            )}
            {it.mimeType.startsWith('video/') && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-white drop-shadow">
                ▶
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
