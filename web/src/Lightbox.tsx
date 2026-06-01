import { useState } from 'react';
import { api, sha256OfBlob, formatBytes, type VaultFile } from './api';

export default function Lightbox({
  file,
  onClose,
  onDeleted,
}: {
  file: VaultFile;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [status, setStatus] = useState('');
  const [verified, setVerified] = useState<null | boolean>(null);
  const [busy, setBusy] = useState(false);

  const isImage = file.mimeType.startsWith('image/');

  // Download the original AND prove in the browser that it's byte-identical.
  async function download() {
    setBusy(true);
    setStatus('Downloading original…');
    setVerified(null);
    try {
      const res = await fetch(`/api/files/${file.id}/original`, { credentials: 'include' });
      if (!res.ok) throw new Error('Download failed');
      const serverHash = res.headers.get('X-Checksum-SHA256');
      const blob = await res.blob();

      setStatus('Verifying…');
      const localHash = await sha256OfBlob(blob);
      const identical = localHash === file.sha256 && localHash === serverHash;
      setVerified(identical);
      setStatus(
        identical
          ? '✅ Verified byte-for-byte identical — zero quality loss.'
          : '⚠️ Checksum mismatch! The file changed in transit.'
      );

      // Trigger the actual save to the device.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
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

  async function remove() {
    if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.remove(file.id);
      onDeleted(file.id);
    } catch (err) {
      setStatus((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-slate-400">
            {formatBytes(file.size)}
            {file.width && file.height ? ` · ${file.width}×${file.height}` : ''}
          </p>
        </div>
        <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-white/10">
          ✕
        </button>
      </div>

      {/* Preview */}
      <div className="flex flex-1 items-center justify-center overflow-hidden p-4" onClick={onClose}>
        {isImage ? (
          <img
            src={`/api/files/${file.id}/original?inline=1`}
            alt={file.name}
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="text-center text-slate-300" onClick={(e) => e.stopPropagation()}>
            <div className="text-6xl">📄</div>
            <p className="mt-2">{file.name}</p>
          </div>
        )}
      </div>

      {/* Bottom controls */}
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
          <button
            onClick={remove}
            disabled={busy}
            className="rounded-lg border border-rose-500/40 px-4 py-2.5 text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-50"
          >
            Delete
          </button>
        </div>

        <p className="break-all text-center text-[11px] text-slate-500">
          SHA-256: {file.sha256}
        </p>
      </div>
    </div>
  );
}
