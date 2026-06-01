import { useState, type FormEvent } from 'react';
import { api, type User } from './api';

export default function Login({ onAuthed }: { onAuthed: (u: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await api.login(username, password);
      onAuthed(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur"
      >
        <div className="mb-6 text-center">
          <div className="text-4xl">🔒</div>
          <h1 className="mt-2 text-2xl font-semibold">Vault</h1>
          <p className="mt-1 text-sm text-slate-400">Your private, lossless media vault</p>
        </div>

        <label className="mb-1 block text-sm text-slate-300">Username</label>
        <input
          className="mb-4 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-emerald-400/60"
          value={username}
          autoCapitalize="none"
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
        />

        <label className="mb-1 block text-sm text-slate-300">Password</label>
        <input
          className="mb-4 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-emerald-400/60"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-emerald-500 py-2 font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
