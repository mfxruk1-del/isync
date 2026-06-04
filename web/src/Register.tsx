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
      <form onSubmit={submit} className="panel w-full max-w-sm animate-pop p-8">
        <div className="mb-6 text-center">
          <div className="text-4xl">🎉</div>
          <h1 className="mt-2 text-2xl font-semibold">Create your account</h1>
          <p className="mt-1 text-sm text-slate-400">You've been invited to Vault.</p>
        </div>

        <label className="mb-1 block text-sm text-slate-300">Choose a username</label>
        <input
          className="field mb-4"
          value={username}
          autoCapitalize="none"
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
        />

        <label className="mb-1 block text-sm text-slate-300">Choose a password</label>
        <input
          className="field mb-1"
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
          className="btn-primary mt-2 w-full"
        >
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
