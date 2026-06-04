import { useState } from 'react';

export interface ShareOptions {
  expiresInDays?: number;
  password?: string;
}

export default function ShareCreateDialog({
  itemCount,
  onClose,
  onCreate,
}: {
  itemCount: number;
  onClose: () => void;
  onCreate: (opts: ShareOptions) => Promise<void>;
}) {
  const [expiry, setExpiry] = useState('0'); // "0" = never
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create() {
    setBusy(true);
    setError('');
    try {
      const days = parseInt(expiry, 10);
      await onCreate({
        expiresInDays: days > 0 ? days : undefined,
        password: password.trim() ? password.trim() : undefined,
      });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" onClick={onClose}>
      <div
        className="w-full max-w-md animate-pop rounded-2xl border border-white/10 bg-panel p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Create a share link</h2>
        <p className="mt-1 text-sm text-slate-400">
          Sharing {itemCount} item{itemCount === 1 ? '' : 's'}.
        </p>

        <label className="mt-5 mb-1 block text-sm text-slate-300">Link expires</label>
        <select
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-emerald-400/60"
        >
          <option value="0">Never</option>
          <option value="1">After 1 day</option>
          <option value="7">After 7 days</option>
          <option value="30">After 30 days</option>
        </select>

        <label className="mt-4 mb-1 block text-sm text-slate-300">
          Password <span className="text-slate-500">(optional)</span>
        </label>
        <input
          type="text"
          value={password}
          placeholder="Leave blank for no password"
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-emerald-400/60"
        />

        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={busy}
            className="flex-1 rounded-lg bg-emerald-500 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create link'}
          </button>
        </div>
      </div>
    </div>
  );
}
