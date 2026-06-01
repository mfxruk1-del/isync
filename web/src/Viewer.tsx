import { useState } from 'react';
import { sha256OfBlob, formatBytes } from './api';

// A generic full-screen viewer used for both owned files and shared files.
// It previews the item, and downloads the ORIGINAL while proving (in the
// browser) that the bytes are identical to what was stored.
export interface ViewerItem {
  name: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  sha256: string;
  // Base URL for the original file. We append ?inline=1 for preview.
  originalUrl: string;
}

export default function Viewer({
  item,
  onClose,
  onDelete,
}: {
  item: ViewerItem;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [status, setStatus] = useState('');
  const [verified, setVerified] = useState<null | boolean>(null);
  const [busy, setBusy] = useState(false);

  const isImage = item.mimeType.startsWith('image/');
  const isVideo = item.mimeType.startsWith('video/');
  const inlineUrl =
    item.originalUrl + (item.originalUrl.includes('?') ? '&' : '?') + 'inline=1';

  // Files above this size stream straight to disk (verifying in-browser would
  // load the whole file into memory and could crash a phone).
  const VERIFY_LIMIT = 150 * 1024 * 1024; // 150 MB

  async function download() {
    // Large files: efficient streamed download, no in-memory hashing.
    if (item.size > VERIFY_LIMIT) {
      const a = document.createElement('a');
      a.href = item.originalUrl;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setVerified(null);
      setStatus('Downloading in full original quality (large file — stored checksum shown below).');
      return;
    }

    setBusy(true);
    setVerified(null);
    setStatus('Downloading original…');
    try {
      const res = await fetch(item.originalUrl, { credentials: 'include' });
      if (!res.ok) throw new Error('Download failed');
      const serverHash = res.headers.get('X-Checksum-SHA256');
      const blob = await res.blob();

      setStatus('Verifying…');
      const localHash = await sha256OfBlob(blob);
      const identical = localHash === item.sha256 && localHash === serverHash;
      setVerified(identical);
      setStatus(
        identical
          ? '✅ Verified byte-for-byte identical — zero quality loss.'
          : '⚠️ Checksum mismatch! The file changed in transit.'
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
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
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.name}</p>
          <p className="text-xs text-slate-400">
            {formatBytes(item.size)}
            {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
          </p>
        </div>
        <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-white/10">
          ✕
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden p-4" onClick={onClose}>
        {isImage ? (
          <img
            src={inlineUrl}
            alt={item.name}
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        ) : isVideo ? (
          <video
            src={inlineUrl}
            controls
            playsInline
            className="max-h-full max-w-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="text-center text-slate-300" onClick={(e) => e.stopPropagation()}>
            <div className="text-6xl">📄</div>
            <p className="mt-2">{item.name}</p>
          </div>
        )}
      </div>

      <div className="space-y-3 p-4" onClick={(e) => e.stopPropagation()}>
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
        <p className="break-all text-center text-[11px] text-slate-500">SHA-256: {item.sha256}</p>
      </div>
    </div>
  );
}
