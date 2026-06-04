import { useState } from 'react';
import type { Share } from './api';

export default function ShareLinkModal({
  share,
  onClose,
}: {
  share: Share;
  onClose: () => void;
}) {
  const url = `${window.location.origin}${share.path}`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the user can still select the text manually.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" onClick={onClose}>
      <div
        className="w-full max-w-md animate-pop rounded-2xl border border-base bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 text-center">
          <div className="text-3xl">🔗</div>
          <h2 className="mt-2 text-lg font-semibold">Share link created</h2>
          <p className="mt-1 text-sm text-muted">
            Anyone with this link can preview and download {share.itemCount} item
            {share.itemCount === 1 ? '' : 's'} — and nothing else from your vault.
          </p>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            className="flex-1 truncate rounded-lg border border-base bg-surface-2 px-3 py-2 text-sm"
          />
          <button
            onClick={copy}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-lg border border-base py-2 text-sm text-muted hover:bg-surface-2"
        >
          Done
        </button>
      </div>
    </div>
  );
}
