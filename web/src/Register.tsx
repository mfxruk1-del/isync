import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from './api';

export default function Register() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .checkInvite(code)
      .then((r) => setValid(r.valid))
      .catch(() => setValid(false))
      .finally(() => setChecking(false));
  }, [code]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.register(code, username, password);
      navigate('/'); // logged in — go to the app
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (checking) {
    return <div className="flex h-full items-center justify-center text-slate-400">Loading…</div>;
  }

  if (!valid) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div>
          <div className="text-4xl">🚫</div>
          <p className="mt-3 text-lg">This invite is invalid or has already been used.</p>
          <Link to="/" className="mt-4 inline-block text-emerald-400 hover:underline">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8">
        <div className="mb-6 text-center">
          <div className="text-4xl">🎉</div>
          <h1 className="mt-2 text-2xl font-semibold">Create your account</h1>
          <p className="mt-1 text-sm text-slate-400">You've been invited to Vault.</p>
        </div>

        <label className="mb-1 block text-sm text-slate-300">Choose a username</label>
        <input
          className="mb-4 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-emerald-400/60"
          value={username}
          autoCapitalize="none"
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
        />

        <label className="mb-1 block text-sm text-slate-300">Choose a password</label>
        <input
          className="mb-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-emerald-400/60"
          type="password"
          value={password}
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="mb-4 text-xs text-slate-500">At least 8 characters.</p>

        {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-emerald-500 py-2 font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
