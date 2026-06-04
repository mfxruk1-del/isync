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
      <form onSubmit={submit} className="panel w-full max-w-sm animate-pop p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-3xl ring-1 ring-emerald-400/30">
            🔒
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Vault</h1>
          <p className="mt-1 text-sm text-slate-400">Your private, lossless media vault</p>
        </div>

        <label className="mb-1 block text-sm text-slate-300">Username</label>
        <input
          className="field mb-4"
          value={username}
          autoCapitalize="none"
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
        />

        <label className="mb-1 block text-sm text-slate-300">Password</label>
        <input
          className="field mb-4"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
